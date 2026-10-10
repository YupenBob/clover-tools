import test from 'node:test';
import assert from 'node:assert/strict';
import { ensureBotFightModeOff } from '../lib/cloudflare-bots.mjs';

function fixture(initial, { deny = false, wrongZone = false, ignoreWrite = false } = {}) {
  let config = { fight_mode: initial, ai_bots_protection: 'block', sbfm_verified_bots: 'allow', enable_js: true, using_latest_model: true };
  const writes = [];
  const request = async (url, options) => {
    if (deny) return Response.json({ success: false, errors: [{ code: 10000 }] }, { status: 403 });
    if (url.includes('/zones?')) return Response.json({ success: true, result: [{ name: wrongZone ? 'other.example' : 'clovertools.cn', id: 'zone', account: { id: 'account' } }] });
    if (options.method === 'PUT') {
      const body = JSON.parse(options.body);
      writes.push(body);
      if (!ignoreWrite) config = { ...config, ...body };
    }
    return Response.json({ success: true, result: config });
  };
  return { request, writes };
}
const args = { token: 'test-token', accountId: 'account', domain: 'clovertools.cn' };
test('off state is read back without writing any settings', async () => {
  const f = fixture(false);
  const result = await ensureBotFightModeOff({ ...args, request: f.request });
  assert.equal(result.after, false);
  assert.equal(result.changed, false);
  assert.deepEqual(f.writes, []);
});
test('on state is disabled without changing unrelated settings or writing read-only fields', async () => {
  const f = fixture(true);
  const result = await ensureBotFightModeOff({ ...args, request: f.request });
  assert.equal(result.changed, true);
  assert.deepEqual(f.writes, [{ fight_mode: false, ai_bots_protection: 'block', sbfm_verified_bots: 'allow', enable_js: true }]);
});
test('permission failures and ambiguous zones are reported as unverified', async () => {
  for (const options of [{ deny: true }, { wrongZone: true }]) {
    const f = fixture(true, options);
    await assert.rejects(ensureBotFightModeOff({ ...args, request: f.request }));
    assert.deepEqual(f.writes, []);
  }
});
test('a successful write response alone does not establish that the setting is off', async () => {
  const f = fixture(true, { ignoreWrite: true });
  await assert.rejects(ensureBotFightModeOff({ ...args, request: f.request }), /read-back/);
});
