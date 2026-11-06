#!/usr/bin/env node
/**
 * GitHub 设备授权登录（Device Flow）：无需用户把 token 交给对话。
 * 用户只需在浏览器打开 https://github.com/login/device 输入一次性代码并授权（scope: public_repo）。
 * 成功后 token 写入 .editorial/secrets/github-token（600，gitignored），并在 stdout 输出 non-secret 摘要。
 *
 * 用法：node scripts/editorial/github-device-login.mjs [--timeout 900]
 */
import { mkdirSync, writeFileSync, chmodSync } from 'node:fs';
import { dirname } from 'node:path';
import { STATE_PATHS } from './lib/paths.mjs';
import { remoteInfo } from './lib/git.mjs';

const CLIENT_ID = process.env.GITHUB_OAUTH_CLIENT_ID || '178c6fc778ccc68e1d6a'; // GitHub CLI 公开 OAuth App
const SCOPE = 'public_repo';
const API = 'https://github.com';

function parseArgs(argv) {
  let timeout = 900;
  for (let index = 0; index < argv.length; index += 1) {
    if (argv[index] === '--timeout') timeout = Number(argv[index + 1]);
  }
  return { timeout };
}

async function postForm(url, params) {
  const response = await fetch(url, {
    method: 'POST',
    headers: { Accept: 'application/json', 'Content-Type': 'application/x-www-form-urlencoded' },
    body: new URLSearchParams(params).toString(),
  });
  const text = await response.text();
  try {
    return JSON.parse(text);
  } catch {
    return { error: 'invalid_response', raw: text.slice(0, 200) };
  }
}

async function main() {
  const { timeout } = parseArgs(process.argv.slice(2));
  mkdirSync(dirname(STATE_PATHS.githubToken), { recursive: true, mode: 0o700 });

  const start = await postForm(`${API}/login/device/code`, { client_id: CLIENT_ID, scope: SCOPE });
  if (!start.device_code) {
    console.log(JSON.stringify({ ok: false, stage: 'start', response: start }, null, 2));
    process.exit(1);
  }
  const { device_code: deviceCode, user_code: userCode, verification_uri: verificationUri, expires_in: expiresIn, interval } = start;
  console.log(`[device-login] 请在浏览器打开：${verificationUri}`);
  console.log(`[device-login] 输入一次性代码：${userCode}`);
  console.log(`[device-login] 授权后会自动继续（有效期 ${expiresIn} 秒）。scope=${SCOPE}`);

  const deadline = Date.now() + Math.min(expiresIn, timeout) * 1000;
  let waitSeconds = Math.max(5, Number(interval) || 5);
  while (Date.now() < deadline) {
    await new Promise((resolve) => setTimeout(resolve, waitSeconds * 1000));
    const result = await postForm(`${API}/login/oauth/access_token`, {
      client_id: CLIENT_ID,
      device_code: deviceCode,
      grant_type: 'urn:ietf:params:oauth:grant-type:device_code',
    });
    if (result.access_token) {
      writeFileSync(STATE_PATHS.githubToken, `${result.access_token}\n`, { mode: 0o600 });
      chmodSync(STATE_PATHS.githubToken, 0o600);
      // 校验 token 与仓库写权限（不输出 token 本身）
      const userResponse = await fetch('https://api.github.com/user', {
        headers: { Authorization: `Bearer ${result.access_token}`, Accept: 'application/vnd.github+json' },
      }).catch(() => null);
      const user = userResponse ? await userResponse.json().catch(() => null) : null;
      const { owner, repo } = remoteInfo();
      let repoStatus = null;
      try {
        const repoResponse = await fetch(`https://api.github.com/repos/${owner}/${repo}`, {
          headers: { Authorization: `Bearer ${result.access_token}`, Accept: 'application/vnd.github+json' },
        });
        const body = await repoResponse.json();
        repoStatus = { status: repoResponse.status, full_name: body.full_name ?? null, permissions: body.permissions ?? null, private: body.private ?? null };
      } catch (error) {
        repoStatus = { error: String(error.message ?? error) };
      }
      console.log(JSON.stringify({ ok: true, saved: '.editorial/secrets/github-token', scope: SCOPE, login: user?.login ?? null, repo: repoStatus }, null, 2));
      return;
    }
    const error = result.error ?? 'unknown';
    if (error === 'authorization_pending') continue;
    if (error === 'slow_down') {
      waitSeconds += 5;
      continue;
    }
    if (error === 'expired_token' || error === 'access_denied') {
      console.log(JSON.stringify({ ok: false, stage: 'poll', error }, null, 2));
      process.exit(2);
    }
    console.log(JSON.stringify({ ok: false, stage: 'poll', error, description: result.error_description ?? null }, null, 2));
    process.exit(1);
  }
  console.log(JSON.stringify({ ok: false, stage: 'timeout', hint: '代码已过期，可重新运行本脚本' }, null, 2));
  process.exit(2);
}

main().catch((error) => {
  console.error(String(error.stack ?? error));
  process.exit(1);
});
