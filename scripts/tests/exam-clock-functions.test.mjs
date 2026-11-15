import test from "node:test";
import assert from "node:assert/strict";
import {
  handleTime,
  parseTrace,
  SOURCE_URL,
  CACHE_KEY,
} from "../../functions/lib/exam-clock-time.ts";
import { readTextLimited, readJsonLimited } from "../../functions/lib/http.ts";
import { verifyLiveTime } from "../lib/tool-cases/exam-clock.mjs";
const epoch = Date.UTC(2026, 10, 15);
function fixture(options = {}) {
  let time = epoch,
    mono = 0,
    calls = 0,
    entry;
  const cache = {
    match: async () => entry?.clone(),
    put: async (key, response) => {
      assert.equal(key, CACHE_KEY);
      entry = response.clone();
    },
  };
  const deps = {
    now: () => time,
    mono: () => mono,
    cache,
    fetch: async (url, init) => {
      calls++;
      assert.equal(String(url), SOURCE_URL);
      assert.equal(init.redirect, "manual");
      assert.deepEqual(Object.keys(init.headers).sort(), [
        "Accept",
        "User-Agent",
      ]);
      time += 20;
      mono += 20;
      return new Response(`ip=discard-me\nts=${epoch / 1000}\n`);
    },
    ...options,
  };
  return {
    deps,
    request: (url = "https://site.test/api/time", method = "GET") =>
      handleTime(
        new Request(url, {
          method,
          headers: { Cookie: "private", Authorization: "private" },
        }),
        deps,
      ),
    advance: (ms) => {
      time += ms;
      mono += ms;
    },
    get calls() {
      return calls;
    },
    set entry(v) {
      entry = v;
    },
    get entry() {
      return entry;
    },
  };
}
test("GET returns complete advancing time response in milliseconds without trace data", async () => {
  const f = fixture();
  const r = await f.request(),
    v = await r.json();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.match(r.headers.get("content-type"), /application\/json/);
  assert.equal(v.source, "cloudflare-trace");
  assert.equal(v.sourceUrl, SOURCE_URL);
  assert.equal(v.serverNowMs, epoch + 10);
  assert.equal(v.sourceSampleMs, epoch);
  assert.equal(v.upstreamRttMs, 20);
  assert.equal(v.uncertaintyMs, 1010);
  assert.equal(v.sampleAgeMs, 0);
  assert.equal(v.cached, false);
  assert.equal(v.ok, true);
  assert.ok(!JSON.stringify(v).includes("discard-me"));
  const c = await f.entry.json();
  assert.deepEqual(
    Object.keys(c).sort(),
    [
      "source",
      "sourceSampleMs",
      "upstreamRttMs",
      "receivedAtMs",
      "referenceMs",
      "expiresAtMs",
    ].sort(),
  );
});
test("method and query cannot become upstream targets", async () => {
  const f = fixture();
  const r = await f.request(undefined, "POST");
  assert.equal(r.status, 405);
  assert.equal(r.headers.get("allow"), "GET");
  assert.equal((await r.json()).code, "method-not-allowed");
  assert.equal(
    (await f.request("https://site.test/api/time?url=http://localhost")).status,
    400,
  );
  assert.equal(f.calls, 0);
});
test("trace requires exactly one valid Unix seconds field", () => {
  assert.equal(parseTrace(`ts=${epoch / 1000}\n`), epoch);
  for (const text of [
    "",
    "ts=NaN",
    "ts=Infinity",
    "ts=1",
    "ts=1e10",
    `ts=${epoch / 1000}\nts=${epoch / 1000}`,
    '{"ts":1794700800}',
    `<html>ts=${epoch / 1000}</html>`,
    "ts=999999999999",
  ])
    assert.throws(() => parseTrace(text), /upstream-invalid/);
});
test("timeout covers response headers and stalled response bodies", async () => {
  for (const fetch of [
    async () => new Promise(() => {}),
    async () => new Response(new ReadableStream({ start() {} })),
  ]) {
    const f = fixture({ fetch, timeoutMs: 15 });
    const r = await f.request();
    assert.equal(r.status, 504);
    assert.equal((await r.json()).code, "upstream-timeout");
  }
});
test("stream cap counts UTF-8 bytes and cancels immediately", async () => {
  let cancelled = false;
  const body = new ReadableStream({
    pull(c) {
      c.enqueue(new TextEncoder().encode("中".repeat(22000)));
    },
    cancel() {
      cancelled = true;
    },
  });
  await assert.rejects(
    readTextLimited(new Response(body), 65536),
    /body-too-large/,
  );
  assert.equal(cancelled, true);
  assert.deepEqual(await readJsonLimited(new Response('{"a":1}')), { a: 1 });
  const f = fixture({ fetch: async () => new Response("中".repeat(22000)) });
  const r = await f.request();
  assert.equal(r.status, 502);
  assert.equal((await r.json()).code, "upstream-too-large");
});
test("limited readers preserve split UTF-8 at the byte limit and cap JSON bytes", async () => {
  const bytes = new TextEncoder().encode("中");
  const body = new ReadableStream({
    start(controller) {
      controller.enqueue(bytes.slice(0, 1));
      controller.enqueue(bytes.slice(1));
      controller.close();
    },
  });
  assert.equal(await readTextLimited(new Response(body), 3), "中");
  await assert.rejects(readJsonLimited(new Response('"中"'), 4), /body-too-large/);
  assert.equal(await readJsonLimited(new Response('"中"'), 5), "中");
});
test("aborting a stalled body cancels its reader and rejects with the abort reason", async () => {
  const controller = new AbortController();
  const reason = new Error("upstream-timeout");
  let cancelled = false;
  const response = new Response(new ReadableStream({
    cancel(value) {
      assert.equal(value, reason);
      cancelled = true;
    },
  }));
  const reading = readTextLimited(response, 65536, controller.signal);
  controller.abort(reason);
  await assert.rejects(reading, (error) => error === reason);
  assert.equal(cancelled, true);
  assert.equal(response.body.locked, false);
  await assert.rejects(
    readTextLimited(new Response("unused"), 65536, controller.signal),
    (error) => error === reason,
  );
});
test("non-2xx and all redirects fail with sanitized structured errors", async () => {
  for (const status of [301, 302, 307, 308, 400, 500]) {
    const f = fixture({
      fetch: async () =>
        new Response("secret upstream stack", {
          status,
          headers: { Location: "https://localhost" },
        }),
    });
    const r = await f.request(),
      v = await r.json();
    assert.equal(r.status, 502);
    assert.equal(
      v.code,
      status < 400 ? "upstream-redirect" : "upstream-failed",
    );
    assert.equal(v.retryable, true);
    assert.equal(v.ok, false);
    assert.ok(!JSON.stringify(v).includes("secret"));
    assert.equal(r.headers.get("cache-control"), "no-store");
  }
});
test("cache hit advances time without fetching or renewing expiration", async () => {
  const f = fixture();
  const first = await (await f.request()).json();
  const expires = (await f.entry.clone().json()).expiresAtMs;
  f.advance(2000);
  const second = await (await f.request()).json();
  assert.equal(second.cached, true);
  assert.equal(second.serverNowMs - first.serverNowMs, 2000);
  assert.equal(second.sampleAgeMs, 2000);
  assert.equal(f.calls, 1);
  assert.equal((await f.entry.clone().json()).expiresAtMs, expires);
  f.advance(13000);
  assert.equal((await (await f.request()).json()).cached, false);
  assert.equal(f.calls, 2);
});
test("backwards, corrupted, expired and unavailable caches fetch fresh samples", async () => {
  for (const mode of ["back", "bad", "expired"]) {
    const f = fixture();
    await f.request();
    if (mode === "back") f.advance(-100);
    if (mode === "bad") f.entry = new Response("{bad");
    if (mode === "expired") f.advance(15000);
    assert.equal((await f.request()).status, 200);
    assert.equal(f.calls, 2);
  }
  const f = fixture({
    cache: {
      match: async () => {
        throw Error("cache");
      },
      put: async () => {
        throw Error("quota");
      },
    },
  });
  assert.equal((await f.request()).status, 200);
});
test("invalid trace fails rather than substituting edge device time", async () => {
  for (const text of [
    "<html>failure</html>",
    '{"ts":1}',
    "ip=discard\n",
    "ts=NaN",
  ]) {
    const f = fixture({ fetch: async () => new Response(text) });
    const r = await f.request();
    assert.equal(r.status, 502);
    const v = await r.json();
    assert.equal(v.code, "upstream-invalid");
    assert.equal(v.serverNowMs, undefined);
  }
});

test("production probe rejects frozen time, bad fields and cacheable final JSON", async () => {
  for (const mode of ["valid", "frozen", "bad-fields", "cacheable"]) {
    let elapsed = 0;
    const fetcher = async () =>
      new Response(
        JSON.stringify({
          ok: true,
          serverNowMs: epoch + (mode === "frozen" ? 0 : elapsed),
          source: mode === "bad-fields" ? "device" : "cloudflare-trace",
          sourceUrl: SOURCE_URL,
          sourceSampleMs: epoch,
          sampleAgeMs: mode === "frozen" ? 0 : elapsed,
          upstreamRttMs: 0,
          uncertaintyMs: 1000 + elapsed * 0.0001,
          cached: elapsed > 0,
        }),
        {
          headers: {
            "Content-Type": "application/json",
            "Cache-Control":
              mode === "cacheable" ? "public, max-age=15" : "no-store",
          },
        },
      );
    const action = () =>
      verifyLiveTime("https://site.test", {
        fetcher,
        mono: () => elapsed,
        sleep: async (ms) => {
          elapsed += ms;
        },
      });
    if (mode === "valid") assert.equal((await action()).advancedMs, 2000);
    else await assert.rejects(action);
  }
});

test("pending cache writes do not block the response", async () => {
  let writeStarted = false;
  const f = fixture({
    cache: {
      match: async () => undefined,
      put: async () => {
        writeStarted = true;
        return new Promise(() => {});
      },
    },
  });
  assert.equal((await f.request()).status, 200);
  assert.equal(writeStarted, true);
});

test("synchronous cache write failures also preserve fresh API success", async () => {
  const f = fixture({
    cache: {
      match: async () => undefined,
      put: () => {
        throw new Error("cache unavailable");
      },
    },
  });
  assert.equal((await f.request()).status, 200);
});
