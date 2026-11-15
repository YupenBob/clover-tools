import test from 'node:test';
import assert from 'node:assert/strict';
import http from 'node:http';

import {
  assertAllowedTarget,
  fetchWithTimeout,
  isPrivateHost,
  normalizeError,
  readJsonLimited,
} from '../../functions/lib/http.ts';

test('private, loopback, link-local and metadata hosts are rejected', () => {
  for (const host of [
    'localhost',
    '127.0.0.1',
    '10.0.0.1',
    '172.16.0.1',
    '192.168.1.1',
    '169.254.169.254',
    '100.64.0.1',
    '::1',
    'fc00::1',
    'fe80::1',
    'foo.local',
  ]) {
    assert.equal(isPrivateHost(host), true, host);
  }
  assert.equal(isPrivateHost('claude.ai'), false);
  assert.equal(isPrivateHost('fdic.gov'), false);
  assert.equal(isPrivateHost('8.8.8.8'), false);
});

test('outbound targets require http(s), a safe port and an allowlist match', () => {
  assert.equal(assertAllowedTarget('https://claude.ai/', ['claude.ai']).hostname, 'claude.ai');
  assert.equal(assertAllowedTarget('https://api.claude.ai/x', ['claude.ai']).hostname, 'api.claude.ai');
  assert.throws(() => assertAllowedTarget('ftp://claude.ai/'), /invalid-protocol/);
  assert.throws(() => assertAllowedTarget('https://claude.ai:8080/'), /invalid-port/);
  assert.throws(() => assertAllowedTarget('https://evil.example/', ['claude.ai']), /target-not-allowed/);
  assert.throws(() => assertAllowedTarget('https://127.0.0.1/', ['127.0.0.1']), /private-target/);
});

test('fetchWithTimeout aborts slow upstreams', async () => {
  const server = http.createServer((request, response) => {
    setTimeout(() => {
      response.writeHead(200, { 'content-type': 'application/json' });
      response.end('{"ok":true}');
    }, 400);
  });
  await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
  const { port } = server.address();
  try {
    await assert.rejects(() => fetchWithTimeout(`http://127.0.0.1:${port}/`, {}, 120));
  } finally {
    server.close();
  }
});

test('readJsonLimited returns JSON and rejects oversized bodies', async () => {
  const ok = await readJsonLimited(new Response('{"a":1}'), 64);
  assert.deepEqual(ok, { a: 1 });
  await assert.rejects(() => readJsonLimited(new Response('{"a":"' + 'x'.repeat(100) + '"}'), 64), /body-too-large/);
});

test('errors normalize to stable API codes', () => {
  assert.equal(normalizeError(new Error('The operation was aborted due to timeout')), 'upstream-timeout');
  assert.equal(normalizeError(new Error('TimeoutError')), 'upstream-timeout');
  assert.equal(normalizeError(new Error('body-too-large')), 'upstream-too-large');
  assert.equal(normalizeError(new Error('private-target')), 'target-blocked');
});
