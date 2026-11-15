import { spawn } from 'node:child_process';
import { createWriteStream, existsSync } from 'node:fs';
import { join } from 'node:path';
import { ensureDir, nowIso, readText, stripAnsi, tail } from './util.mjs';

export function codexBin(config = {}) {
  return config.bin ?? process.env.CODEX_BIN ?? 'codex';
}

export function buildCodexArgs({
  model,
  reasoning,
  sandbox,
  cwd,
  outputFile,
  schemaFile,
  images = [],
  json = true,
}) {
  const args = [
    'exec',
    '-m',
    model,
    '-c',
    `model_reasoning_effort=${reasoning}`,
    '-s',
    sandbox,
    '-C',
    cwd,
  ];
  if (schemaFile) args.push('--output-schema', schemaFile);
  for (const image of images ?? []) args.push('-i', image);
  if (outputFile) args.push('-o', outputFile);
  if (json) args.push('--json');
  args.push('-');
  return args;
}

function usageFromEvents(events) {
  const usage = {};
  for (const event of events) {
    const candidate = event?.usage ?? event?.data?.usage ?? event?.msg?.usage;
    if (!candidate || typeof candidate !== 'object') continue;
    for (const [key, value] of Object.entries(candidate)) {
      if (typeof value === 'number') usage[key] = (usage[key] ?? 0) + value;
    }
  }
  return usage;
}

/**
 * Run `codex exec` non-interactively. The prompt is sent over stdin so long tasks
 * never hit the OS argument limit. Events are captured as JSONL for the report.
 */
export async function runCodex({
  prompt,
  cwd,
  logDir,
  name,
  model,
  reasoning,
  sandbox,
  timeoutMs,
  schemaFile,
  images = [],
  config = {},
  env = process.env,
}) {
  ensureDir(logDir);
  const stdoutFile = join(logDir, `${name}.jsonl`);
  const stderrFile = join(logDir, `${name}.stderr.log`);
  const lastMessageFile = join(logDir, `${name}.last.md`);
  const stdout = createWriteStream(stdoutFile, { flags: 'w' });
  const stderr = createWriteStream(stderrFile, { flags: 'w' });
  const args = buildCodexArgs({
    model,
    reasoning,
    sandbox,
    cwd,
    outputFile: lastMessageFile,
    schemaFile,
    images,
  });
  const startedAt = Date.now();
  const events = [];
  const stdoutTail = [];
  const stderrTail = [];
  let timedOut = false;
  let aborted = false;
  let usageLimited = false;

  const child = spawn(codexBin(config), args, {
    cwd,
    env: {
      ...env,
      GIT_TERMINAL_PROMPT: '0',
      CODEX_HOME: env.CODEX_HOME || join(env.HOME || '/home/ubuntu', '.codex'),
    },
    stdio: ['pipe', 'pipe', 'pipe'],
  });

  let stdoutBuffer = '';
  const onStdout = (chunk) => {
    const text = stripAnsi(chunk.toString());
    stdout.write(text);
    stdoutBuffer += text;
    const lines = stdoutBuffer.split('\n');
    stdoutBuffer = lines.pop() ?? '';
    for (const line of lines) {
      if (!line.trim()) continue;
      try {
        const event = JSON.parse(line);
        events.push(event);
        if (event?.type === 'error' && /usage limit/i.test(String(event.message ?? ''))) {
          usageLimited = true;
        }
        if (event?.type === 'turn.failed' && /usage limit/i.test(JSON.stringify(event))) {
          usageLimited = true;
        }
        if (stdoutTail.length < 200) stdoutTail.push(line);
        else {
          stdoutTail.shift();
          stdoutTail.push(line);
        }
      } catch {
        /* codex can emit non-JSON progress lines; they stay in the raw log */
      }
    }
  };
  const onStderr = (chunk) => {
    const text = stripAnsi(chunk.toString());
    if (/usage limit/i.test(text)) usageLimited = true;
    stderr.write(text);
    if (stderrTail.length < 200) stderrTail.push(text);
    else {
      stderrTail.shift();
      stderrTail.push(text);
    }
  };
  child.stdout.on('data', onStdout);
  child.stderr.on('data', onStderr);

  try {
    child.stdin.write(prompt);
    child.stdin.end();
  } catch {
    /* codex may have exited before reading the prompt; close will surface it */
  }

  const timer = setTimeout(() => {
    timedOut = true;
    child.kill('SIGTERM');
    setTimeout(() => {
      if (!child.killed) child.kill('SIGKILL');
    }, 10000).unref?.();
  }, timeoutMs);
  timer.unref?.();

  const exitCode = await new Promise((resolve) => {
    child.on('error', (error) => {
      stderr.write(`spawn error: ${error.message}\n`);
      resolve(127);
    });
    child.on('close', (code, signal) => {
      if (signal) aborted = true;
      resolve(code ?? 1);
    });
  });
  clearTimeout(timer);
  stdout.end();
  stderr.end();

  const lastMessage = existsSync(lastMessageFile) ? readText(lastMessageFile) : '';
  const result = {
    ok: exitCode === 0 && !timedOut,
    exitCode,
    timedOut,
    signal: aborted,
    usageLimited,
    durationMs: Date.now() - startedAt,
    model,
    reasoning,
    sandbox,
    args,
    stdoutFile,
    stderrFile,
    lastMessageFile,
    lastMessage,
    usage: usageFromEvents(events),
    eventCount: events.length,
    stdoutTail: tail(stdoutTail.join('\n'), 8000),
    stderrTail: tail(stderrTail.join(''), 8000),
    finishedAt: nowIso(),
  };
  return result;
}
