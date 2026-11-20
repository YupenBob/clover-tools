#!/usr/bin/env node
/**
 * Codex 阶段运行器（生产门禁，入库版本）。
 *
 * 与 v1 的差别（2026-11-20 双模型评审驱动）：
 * 1. 整次调用跑在独立 rootless PID namespace 里（unshare -Urpf --mount-proc --kill-child=SIGKILL），
 *    超时先 TERM 再 KILL 整个 namespace，终止后扫 /proc 确认无残留；
 * 2. 成功判定不看退出码：必须出现 turn.completed + 全部 --expect 产物存在且非空 + schema 校验通过；
 * 3. 事件流实时落盘，解析未知事件容错，用量缺失记 usage:null 而不阻断；
 * 4. 追加不可变事件流 .editorial/runs/<runKey>/backends.jsonl（不再有「计划文件」）。
 *
 * 用法：
 *   node scripts/editorial/codex-run.mjs --stage draft --run <runKey> --slug <slug> \
 *     --prompt-file <path> --cwd <workspaceDir> --expect .editorial/drafts/<slug>/guide.json \
 *     [--expect ...] [--schema <json>] [--timeout-min 22] [--attempt 1] [--model gpt-6.2-sol] \
 *     [--network] [--dry-run] [--quiet]
 */
import { spawn } from 'node:child_process';
import { appendFileSync, existsSync, mkdirSync, readFileSync, renameSync, statSync, writeFileSync } from 'node:fs';
import { dirname, join, resolve } from 'node:path';
import { ROOT, STATE_PATHS } from './lib/paths.mjs';

const USAGE_DIR = join(STATE_PATHS.dir, 'usage');
import { loadConfig } from './lib/config.mjs';
import { killEverything, readStartTicks } from './lib/proc-tree.mjs';

const EXIT = { ok: 0, preflight: 2, timeout: 3, nonzero: 4, invalidArtifact: 5, usage: 6, quota: 7 };
const QUOTA_PATTERN = /usage limit|quota|insufficient_quota|try again at|rate limit/i;

const DEFAULTS = {
  command: 'codex',
  model: 'gpt-6.2-sol',
  sandbox: 'workspace-write',
  networkAccess: false,
  isolation: 'namespace',
  timeoutMinutes: { draft: 22, polish: 6, altVerify: 6, illustration: 8, translate: 12 },
};

function parseArgs(argv) {
  const options = { expect: [], quiet: false };
  for (let index = 0; index < argv.length; index += 1) {
    const arg = argv[index];
    if (arg === '--stage') options.stage = argv[++index];
    else if (arg === '--run') options.run = argv[++index];
    else if (arg === '--slug') options.slug = argv[++index];
    else if (arg === '--prompt-file') options.promptFile = argv[++index];
    else if (arg === '--prompt') options.prompt = argv[++index];
    else if (arg === '--cwd') options.cwd = argv[++index];
    else if (arg === '--out-last') options.outLast = argv[++index];
    else if (arg === '--expect') options.expect.push(argv[++index]);
    else if (arg === '--resume') options.resume = argv[++index];
    else if (arg === '--thread-file') options.threadFile = argv[++index];
    else if (arg === '--schema') options.schema = argv[++index];
    else if (arg === '--timeout-min') options.timeoutMin = Number(argv[++index]);
    else if (arg === '--attempt') options.attempt = Number(argv[++index]);
    else if (arg === '--model') options.model = argv[++index];
    else if (arg === '--network') options.network = true;
    else if (arg === '--no-network') options.network = false;
    else if (arg === '--dry-run') options.dryRun = true;
    else if (arg === '--quiet') options.quiet = true;
    else if (arg === '-h' || arg === '--help') options.help = true;
    else throw new Error(`未知参数：${arg}`);
  }
  return options;
}

function usage() {
  console.log(
    [
      '用法：node scripts/editorial/codex-run.mjs --stage <stage> --run <runKey> --prompt-file <path> --cwd <dir> [--slug] [--expect p]...',
      '退出码：0 成功｜2 预检失败｜3 超时｜4 退出码非 0｜5 产物不达标｜6 参数/环境错误',
    ].join('\n'),
  );
}

function readJson(file, fallback) {
  try {
    return JSON.parse(readFileSync(file, 'utf8'));
  } catch {
    return fallback;
  }
}

function writeJson(file, value) {
  mkdirSync(dirname(file), { recursive: true });
  writeFileSync(file, `${JSON.stringify(value, null, 2)}\n`);
}

export function codexConfig(overrides = {}) {
  const config = readJson(STATE_PATHS.config, {});
  const codex = { ...DEFAULTS, ...(config.codex || {}) };
  codex.timeoutMinutes = { ...DEFAULTS.timeoutMinutes, ...(codex.timeoutMinutes || {}) };
  const defined = Object.fromEntries(Object.entries(overrides).filter(([, value]) => value !== undefined));
  return { ...codex, ...defined };
}

/** 解析 JSONL：容错，未知事件忽略。 */
export function parseEvents(lines) {
  const result = { threadId: null, completed: false, usage: null, items: [], errors: [] };
  for (const line of lines) {
    const trimmed = String(line).trim();
    if (!trimmed.startsWith('{')) continue;
    let event;
    try {
      event = JSON.parse(trimmed);
    } catch {
      continue;
    }
    if (event.type === 'thread.started') result.threadId = event.thread_id ?? null;
    else if (event.type === 'turn.completed') {
      result.completed = true;
      if (event.usage) {
        result.usage = {
          input: Number(event.usage.input_tokens ?? 0),
          cachedInput: Number(event.usage.cached_input_tokens ?? 0),
          output: Number(event.usage.output_tokens ?? 0),
          reasoningOutput: Number(event.usage.reasoning_output_tokens ?? 0),
        };
      }
    } else if (event.type === 'item.completed' && event.item) {
      result.items.push(event.item);
    } else if (event.type === 'error' || event.type === 'turn.failed') {
      result.errors.push(event.message ?? event.error ?? JSON.stringify(event).slice(0, 400));
    }
  }
  return result;
}

/** 极简 JSON Schema 校验（type/required/properties/items/enum/oneOf）。返回错误列表。 */
export function validateSchema(value, schema, path = '$') {
  const errors = [];
  if (!schema || typeof schema !== 'object') return errors;
  if (schema.enum && !schema.enum.includes(value)) errors.push(`${path} 不在枚举内`);
  if (schema.const !== undefined && value !== schema.const) errors.push(`${path} 不等于 const`);
  const type = schema.type;
  const typeOk = (() => {
    if (!type) return true;
    if (type === 'object') return value !== null && typeof value === 'object' && !Array.isArray(value);
    if (type === 'array') return Array.isArray(value);
    if (type === 'integer') return Number.isInteger(value);
    if (type === 'number') return typeof value === 'number' && Number.isFinite(value);
    if (type === 'boolean') return typeof value === 'boolean';
    return typeof value === type;
  })();
  if (!typeOk) {
    errors.push(`${path} 类型应为 ${type}`);
    return errors;
  }
  if (type === 'object') {
    for (const key of schema.required ?? []) {
      if (!(key in value)) errors.push(`${path}.${key} 缺失`);
    }
    for (const [key, sub] of Object.entries(schema.properties ?? {})) {
      if (value[key] !== undefined) errors.push(...validateSchema(value[key], sub, `${path}.${key}`));
    }
  }
  if (type === 'array' && schema.items) {
    value.forEach((entry, index) => errors.push(...validateSchema(entry, schema.items, `${path}[${index}]`)));
  }
  if (schema.oneOf) {
    const matched = schema.oneOf.filter((candidate) => validateSchema(value, candidate, path).length === 0);
    if (matched.length !== 1) errors.push(`${path} 不满足 oneOf`);
  }
  return errors;
}

async function preflight(config, options) {
  const checks = [];
  const run = (command, args) =>
    new Promise((resolvePromise) => {
      const child = spawn(command, args, { stdio: ['ignore', 'pipe', 'pipe'] });
      let out = '';
      child.stdout.on('data', (chunk) => (out += chunk));
      child.stderr.on('data', (chunk) => (out += chunk));
      child.on('close', (code) => resolvePromise({ code, out: out.trim() }));
      child.on('error', (error) => resolvePromise({ code: 127, out: String(error.message) }));
    });
  const login = await run(config.command, ['login', 'status']);
  checks.push({ name: 'login', ok: login.code === 0, detail: login.out.slice(0, 300) });
  if (options.stage === 'illustration') {
    const features = await run(config.command, ['features', 'list']);
    checks.push({
      name: 'image_generation',
      ok: features.code === 0 && /image_generation\s+.*true/.test(features.out),
      detail: features.out.split('\n').find((line) => line.includes('image_generation')) ?? '',
    });
  }
  return checks;
}

/** OpenAI strict response_format 要求：object 必须 additionalProperties:false 且所有 properties 都进 required。 */
export function normalizeStrictSchema(schema) {
  if (!schema || typeof schema !== 'object') return schema;
  const next = { ...schema };
  if (next.type === 'object' && next.properties) {
    next.additionalProperties = false;
    next.required = Object.keys(next.properties);
    next.properties = Object.fromEntries(
      Object.entries(next.properties).map(([key, value]) => [key, normalizeStrictSchema(value)]),
    );
  }
  if (next.items) next.items = normalizeStrictSchema(next.items);
  return next;
}

function pruneOldAttempts(usageFile, stage, attempt) {
  const record = readJson(usageFile, { run: null, attempts: [] });
  const attempts = Array.isArray(record.attempts) ? record.attempts : [];
  return { record, attempts, previous: attempts.filter((entry) => !(entry.stage === stage && entry.attempt === attempt)) };
}

async function main() {
  const options = parseArgs(process.argv.slice(2));
  if (options.help) return usage();
  if (!options.stage) throw new Error('缺少 --stage');
  if (!options.run) throw new Error('缺少 --run');
  if (!options.promptFile && !options.prompt) throw new Error('缺少 --prompt-file 或 --prompt');
  if (!options.cwd) throw new Error('缺少 --cwd（必须是本次 attempt 的隔离工作目录）');

  const config = codexConfig({ model: options.model ?? undefined, networkAccess: options.network ?? undefined });
  const prompt = options.promptFile ? readFileSync(options.promptFile, 'utf8') : options.prompt;
  if (!prompt.trim()) throw new Error('prompt 为空');
  const attempt = options.attempt ?? 1;
  const timeoutMinutes = options.timeoutMin ?? config.timeoutMinutes[options.stage] ?? 15;
  const cwd = resolve(options.cwd);
  if (!existsSync(cwd)) throw new Error(`--cwd 不存在：${cwd}`);
  const outLast = options.outLast ?? join(USAGE_DIR, `${options.run}.codex-${options.stage}-${attempt}.last.md`);
  const jsonlPath = join(USAGE_DIR, `${options.run}.codex-${options.stage}-${attempt}.jsonl`);
  const usageFile = join(USAGE_DIR, `${options.run}.codex.json`);
  mkdirSync(dirname(jsonlPath), { recursive: true });
  mkdirSync(dirname(outLast), { recursive: true });

  // 预检
  const checks = await preflight(config, options);
  const failedChecks = checks.filter((entry) => !entry.ok);
  if (failedChecks.length > 0) {
    return fail(EXIT.preflight, `预检失败：${failedChecks.map((entry) => `${entry.name}: ${entry.detail}`).join(' | ')}`);
  }

  const commonFlags = [
    '-m',
    config.model,
    '-c',
    'approval_policy=never',
    '--skip-git-repo-check',
    '--json',
    '-o',
    outLast,
  ];
  // resume 子命令没有 -C/-s：cwd 用 spawn 的 cwd，sandbox 走 config 覆盖
  const baseArgv = options.resume
    ? [
        'exec',
        'resume',
        options.resume,
        ...commonFlags,
        '-c',
        `sandbox_mode=${config.sandbox}`,
        '-c',
        `sandbox_workspace_write.network_access=${config.networkAccess ? 'true' : 'false'}`,
      ]
    : [
        'exec',
        '-C',
        cwd,
        ...commonFlags,
        '-s',
        config.sandbox,
        '-c',
        `sandbox_workspace_write.network_access=${config.networkAccess ? 'true' : 'false'}`,
      ];
  let schemaPath = null;
  if (options.schema) {
    schemaPath = join(USAGE_DIR, `${options.run}.codex-${options.stage}-${attempt}.schema.json`);
    mkdirSync(dirname(schemaPath), { recursive: true });
    writeFileSync(schemaPath, `${JSON.stringify(normalizeStrictSchema(readJson(resolve(options.schema), {})), null, 2)}\n`);
    baseArgv.push('--output-schema', schemaPath);
  }
  baseArgv.push('-');

  const namespace = config.isolation === 'namespace';
  const command = namespace ? 'unshare' : config.command;
  const argv = namespace
    ? ['-Urpf', '--mount-proc', '--kill-child=SIGKILL', config.command, ...baseArgv]
    : baseArgv;

  if (options.dryRun) {
    console.log(
      JSON.stringify({ dryRun: true, command, argv, cwd, timeoutMinutes, expect: options.expect, stdinBytes: prompt.length }, null, 2),
    );
    return EXIT.ok;
  }

  const startedAt = Date.now();
  writeFileSync(jsonlPath, '');
  const child = spawn(command, argv, {
    cwd,
    detached: true,
    stdio: ['pipe', 'pipe', 'pipe'],
    env: { ...process.env, NO_COLOR: '1' },
  });
  const minStartTicks = readStartTicks(child.pid);
  let stderr = '';
  const lines = [];
  const buffer = { value: '' };
  const onData = (chunk) => {
    buffer.value += chunk;
    const parts = buffer.value.split('\n');
    buffer.value = parts.pop() ?? '';
    for (const line of parts) {
      if (!line.trim()) continue;
      lines.push(line);
    }
    appendFileSync(jsonlPath, chunk);
  };
  child.stdout.on('data', onData);
  child.stderr.on('data', (chunk) => {
    stderr += chunk;
    if (stderr.length > 200_000) stderr = stderr.slice(-200_000);
  });
  child.stdin.end(prompt);

  let timedOut = false;
  const timeoutMs = timeoutMinutes * 60_000;
  const timer = setTimeout(() => {
    timedOut = true;
  }, timeoutMs);

  const exitInfo = await new Promise((resolvePromise) => {
    child.on('close', (code, sig) => resolvePromise({ code, sig }));
    child.on('error', (error) => resolvePromise({ code: 127, sig: null, error }));
    // 超时轮询：由外部 timer 触发终止
    const poll = setInterval(() => {
      if (!timedOut) return;
      clearInterval(poll);
      killEverything({ pid: child.pid, pgid: child.pid, marker: cwd, minStartTicks }).then(() => resolvePromise({ code: null, sig: 'TIMEOUT' }));
    }, 250);
    child.on('close', () => clearInterval(poll));
  });
  clearTimeout(timer);
  if (buffer.value.trim()) lines.push(buffer.value);

  const wallSeconds = Number(((Date.now() - startedAt) / 1000).toFixed(1));
  const events = parseEvents(lines);

  // 产物校验
  const missing = [];
  for (const expectPath of options.expect) {
    const absolute = resolve(cwd, expectPath);
    if (!existsSync(absolute)) missing.push(expectPath);
    else if (statSync(absolute).isFile() && statSync(absolute).size === 0) missing.push(`${expectPath}(空文件)`);
  }
  let schemaErrors = [];
  if (options.schema && existsSync(outLast)) {
    try {
      schemaErrors = validateSchema(JSON.parse(readFileSync(outLast, 'utf8')), JSON.parse(readFileSync(resolve(options.schema), 'utf8')));
    } catch (error) {
      schemaErrors = [`输出不是合法 JSON：${String(error.message).slice(0, 200)}`];
    }
  }

  let status = 'ok';
  let reason = '';
  let exitCode = 0;
  if (timedOut) {
    status = 'timeout';
    reason = `超过 ${timeoutMinutes} 分钟`;
    exitCode = EXIT.timeout;
  } else if (exitInfo.code !== 0) {
    status = 'nonzero';
    reason = `退出码 ${exitInfo.code ?? exitInfo.sig}`;
    exitCode = EXIT.nonzero;
  } else if (!events.completed) {
    status = 'invalid-artifact';
    reason = '缺少 turn.completed 完成事件';
    exitCode = EXIT.invalidArtifact;
  } else if (missing.length > 0) {
    status = 'invalid-artifact';
    reason = `产物缺失：${missing.join('、')}`;
    exitCode = EXIT.invalidArtifact;
  } else if (schemaErrors.length > 0) {
    status = 'invalid-artifact';
    reason = `schema 校验失败：${schemaErrors.slice(0, 4).join('；')}`;
    exitCode = EXIT.invalidArtifact;
  } else if (events.errors.some((message) => QUOTA_PATTERN.test(String(message)))) {
    // 套餐额度用尽：不是代码/内容问题，别浪费修复预算，交给上层「延后到下一趟」
    status = 'usage-limit';
    reason = events.errors.find((message) => QUOTA_PATTERN.test(String(message))) ?? 'codex 套餐额度用尽';
    exitCode = EXIT.quota;
  } else if (events.errors.length > 0) {
    status = 'reported-error';
    reason = events.errors.slice(0, 3).join(' | ').slice(0, 500);
    exitCode = EXIT.nonzero;
  }

  // 清理残留（超时/异常路径）
  let cleanup = { killed: [], survivors: [] };
  if (status !== 'ok') cleanup = await killEverything({ pid: child.pid, pgid: child.pid, marker: cwd, minStartTicks });
  else cleanup = await killEverything({ pid: null, pgid: null, marker: cwd, graceMs: 0, minStartTicks });

  const lastMessage = events.items.filter((item) => item.type === 'agent_message').map((item) => item.text ?? '').join('\n');
  const record = {
    stage: options.stage,
    slug: options.slug ?? null,
    attempt,
    backend: 'codex',
    model: config.model,
    isolation: config.isolation,
    networkAccess: config.networkAccess,
    cwd,
    status,
    reason,
    exitCode,
    wallSeconds,
    timeoutMinutes,
    usage: events.usage ?? null,
    threadId: events.threadId,
    expects: options.expect,
    missing,
    schemaErrors,
    lastMessagePath: existsSync(outLast) ? outLast : null,
    lastMessageChars: lastMessage.length,
    killed: cleanup.killed,
    survivors: cleanup.survivors,
    stderrTail: stderr.slice(-2000),
    finishedAt: new Date().toISOString(),
    jsonlPath,
  };

  const threadFile = options.threadFile ?? join(STATE_PATHS.runs, options.run, 'codex-session.json');
  if (events.threadId) {
    mkdirSync(dirname(threadFile), { recursive: true });
    const previous = readJson(threadFile, { stages: {} });
    writeJson(threadFile, {
      run: options.run,
      threadId: events.threadId,
      updatedAt: new Date().toISOString(),
      stages: { ...(previous.stages ?? {}), [options.stage]: { threadId: events.threadId, at: new Date().toISOString(), attempt } },
    });
  }

  const { record: usageRecord, attempts } = pruneOldAttempts(usageFile, options.stage, attempt);
  const nextAttempts = [...attempts, record].sort((a, b) => (a.finishedAt ?? '').localeCompare(b.finishedAt ?? ''));
  writeJson(usageFile, { run: options.run, updatedAt: new Date().toISOString(), attempts: nextAttempts });

  const backendsFile = join(STATE_PATHS.runs, options.run, 'backends.jsonl');
  mkdirSync(dirname(backendsFile), { recursive: true });
  appendFileSync(
    backendsFile,
    `${JSON.stringify({
      at: new Date().toISOString(),
      run: options.run,
      slug: options.slug ?? null,
      stage: options.stage,
      attempt,
      backend: 'codex',
      model: config.model,
      status,
      reason,
      wallSeconds,
      tokens: events.usage ? events.usage.input + events.usage.output : null,
      expects: options.expect,
      survivors: cleanup.survivors.length,
    })}\n`,
  );

  if (!options.quiet) {
    const tokens = events.usage ? `${events.usage.input}/${events.usage.cachedInput}/${events.usage.output}` : 'n/a';
    console.log(
      `codex ${options.stage} #${attempt}：${status}${reason ? `（${reason}）` : ''}｜${config.model}｜${wallSeconds}s｜tokens(in/cached/out)=${tokens}`,
    );
    if (cleanup.killed.length > 0) console.log(`  已清理残留进程：${cleanup.killed.map((entry) => entry.pid).join(',')}`);
    if (cleanup.survivors.length > 0) {
      console.log(`  警告：仍有残留进程：${JSON.stringify(cleanup.survivors)}`);
      return EXIT.usage;
    }
  }

  return exitCode;
}

async function fail(code, message) {
  console.error(`codex-run 失败：${message}`);
  return code;
}

main()
  .then((code) => process.exit(code))
  .catch((error) => {
    console.error(`codex-run 异常：${error.stack ?? error.message}`);
    process.exit(EXIT.usage);
  });
