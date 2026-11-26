const TOOL_PATH = '/tools/daily/time-sync/';
const FIXED = new Date('2026-11-26T12:00:00Z');
const ALT_BEFORE = '设备时间卡片显示时刻，网络参考北京时间卡片显示横线和「尚未校时」。';
const CAPTION_BEFORE = ALT_BEFORE;
const ALT_MEASURED = '推荐偏移区显示「设备约慢 1.2 秒」和「多源一致」，下方列出估计误差、往返延迟、测量时间和有效状态。';
const CAPTION_MEASURED = ALT_MEASURED;

export function timeResponse(nowMs, mode = 'consistent') {
  const sources = ['cloudflare-trace', 'timeapi-io'].map((source, index) => {
    if ((index === 1 && mode === 'single') || mode === 'unavailable') {
      return { source, ok: false, error: { code: 'upstream-timeout', retryable: true } };
    }
    const sample = nowMs + 1200 + (index === 1 && mode === 'conflict' ? 10000 : 0);
    return {
      source, ok: true, nowMs: sample, sourceSampleMs: sample,
      upstreamRttMs: 0, sampleAgeMs: 0, timestampResolutionMs: 1000, cached: false,
    };
  });
  return {
    version: 1,
    ok: mode !== 'unavailable',
    status: { single: 'partial', unavailable: 'unavailable' }[mode] ?? 'complete',
    responseAtRuntimeMs: nowMs,
    sources,
    error: mode === 'unavailable' ? { code: 'upstreams-unavailable', retryable: true } : null,
  };
}

export default async function ({ page, base, shot }) {
  const cdp = await page.context().newCDPSession(page);
  await cdp.send('Emulation.setTimezoneOverride', { timezoneId: 'UTC' });
  await page.clock.install({ time: FIXED });
  await page.clock.pauseAt(new Date(FIXED.getTime() + 1000));
  const fixture = async (route) => {
    await route.fulfill({ json: timeResponse(await page.evaluate(() => Date.now())) });
  };
  await page.route('**/api/time-sync', fixture);
  try {
    const response = await page.goto(new URL(TOOL_PATH, base).href);
    if (!response?.ok()) throw new Error(`Time Sync page returned HTTP ${response?.status()}`);
    await page.waitForFunction(() => {
      const clock = document.querySelector('#tsDeviceTime');
      return clock && clock.textContent !== '—';
    }, null, { polling: 100 });
    const results = page.locator('#tsResults');
    await shot(results, 'before.jpg', {
      alt: ALT_BEFORE, caption: CAPTION_BEFORE, source: TOOL_PATH,
      purpose: '展示测量前的设备时钟与网络卡片状态',
    });

    await page.locator('#tsStart').click();
    await page.locator('#timeSync[data-state="consistent"][data-lang="zh"]').waitFor();
    await page.getByText('设备约慢 1.2 秒', { exact: true }).first().waitFor();
    await shot(results, 'measured.jpg', {
      alt: ALT_MEASURED, caption: CAPTION_MEASURED, source: TOOL_PATH,
      purpose: '展示固定时钟和模拟响应下的偏移与测量字段',
    });
  } finally {
    await page.unroute('**/api/time-sync', fixture);
    await cdp.detach();
  }
}
