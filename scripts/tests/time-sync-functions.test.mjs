import test from "node:test";
import assert from "node:assert/strict";
import {
  handleTimeSync,
  parseTrace,
  parseTimeApi,
  exactTarget,
  URLS,
  cacheKey,
  ISOLATE,
} from "../../functions/lib/time-sync.ts";
import { onRequest } from "../../functions/api/time-sync.ts";
import { validateTimeResponse, SOURCES } from "../../src/lib/time-sync.ts";
const epoch = Date.UTC(2026, 10, 17);
function fixture(extra = {}) {
  let wall = epoch,
    mono = 0;
  const entries = new Map(),
    calls = [];
  const deps = {
    now: () => wall,
    mono: () => mono,
    cache: {
      match: async (k) => entries.get(k)?.clone(),
      put: async (k, r) => {
        entries.set(k, r.clone());
      },
    },
    fetch: async (url, init) => {
      calls.push({ url, init });
      wall += 20;
      mono += 20;
      return body(url);
    },
    ...extra,
  };
  return {
    deps,
    calls,
    entries,
    advance: (n) => {
      wall += n;
      mono += n;
    },
    jump: (n) => {
      wall += n;
    },
    request: (url = "https://site.test/api/time-sync", method = "GET") =>
      handleTimeSync(
        new Request(url, {
          method,
          headers: { Cookie: "secret", Authorization: "secret" },
        }),
        deps,
      ),
  };
}
function body(url) {
  return new Response(
    url === URLS["cloudflare-trace"]
      ? `ip=discard-me\nloc=discard-me\nts=${epoch / 1000}\n`
      : JSON.stringify({
          timeZone: "UTC",
          dateTime: "2026-11-17T00:00:00.0000000",
        }),
  );
}
test("parallel-sources-return-in-fixed-order-and-share-assembly-time", async () => {
  let release;
  const first = new Promise((r) => (release = r));
  let count = 0;
  const f = fixture({
    fetch: async (url) => {
      count++;
      if (url === URLS["cloudflare-trace"]) await first;
      else {
        assert.equal(count, 2);
        release();
      }
      f.advance(20);
      return body(url);
    },
  });
  const r = await f.request(),
    v = await r.json();
  assert.equal(r.status, 200);
  assert.equal(r.headers.get("cache-control"), "no-store");
  assert.deepEqual(
    v.sources.map((s) => s.source),
    SOURCES,
  );
  assert.ok(validateTimeResponse(v).value);
  assert.equal(
    v.sources[0].nowMs,
    v.sources[0].sourceSampleMs +
      v.sources[0].upstreamRttMs / 2 +
      v.sources[0].sampleAgeMs,
  );
  for (const s of v.sources)
    assert.equal(
      s.nowMs,
      s.sourceSampleMs + s.upstreamRttMs / 2 + s.sampleAgeMs,
    );
});
test("one-timeout-other-success-is-200-partial", async () => {
  const f = fixture({
    timeoutMs: 15,
    fetch: async (url) =>
      url === URLS["timeapi-io"] ? new Promise(() => {}) : body(url),
  });
  const r = await f.request(),
    v = await r.json();
  assert.equal(r.status, 200);
  assert.equal(v.status, "partial");
  assert.equal(v.sources[1].error.code, "upstream-timeout");
});
test("all-timeout-504-and-other-failures-502", async () => {
  for (const mode of ["timeout", "http", "mixed"]) {
    const f = fixture({
      timeoutMs: 10,
      fetch: async (url) =>
        mode === "timeout" ||
        (mode === "mixed" && url === URLS["cloudflare-trace"])
          ? new Promise(() => {})
          : new Response("bad", { status: 503 }),
    });
    const r = await f.request(),
      v = await r.json();
    assert.equal(r.status, mode === "timeout" ? 504 : 502);
    assert.equal(v.ok, false);
    assert.ok(validateTimeResponse(v).value);
    assert.ok(v.sources.every((s) => !s.ok));
  }
});
test("trace-only-extracts-unique-strict-timestamp", () => {
  assert.equal(parseTrace(`ip=private\nts=${epoch / 1000}\n`), epoch);
  for (const s of [
    "",
    "ts=NaN",
    "ts=1e9",
    "ts=0",
    `ts=${epoch / 1000}\nts=${epoch / 1000}`,
    `<html>\nts=${epoch / 1000}`,
  ])
    assert.throws(() => parseTrace(s));
});
test("timeapi-strict-gregorian-utc-and-fraction-truncation", () => {
  for (const suffix of ["", "Z", "+00:00", "-00:00"])
    assert.equal(
      parseTimeApi(
        JSON.stringify({
          timeZone: "UTC",
          dateTime: "2024-02-29T23:59:59.123456789012" + suffix,
        }),
      ),
      Date.UTC(2024, 1, 29, 23, 59, 59, 123),
    );
  for (const v of [
    null,
    [],
    { timeZone: "UTC", dateTime: "2023-02-29T00:00:00" },
    { timeZone: "UTC", dateTime: "2024-01-01T24:00:00" },
    { timeZone: "UTC", dateTime: "2024-01-01T00:00:60Z" },
    { timeZone: "UTC", dateTime: "2024-01-01T00:00:00+08:00" },
    { timeZone: "Asia/Shanghai", dateTime: "2024-01-01T00:00:00" },
    { timezone: "UTC", dateTime: "2024-01-01T00:00:00" },
    { timeZone: "UTC", datetime: "2024-01-01T00:00:00" },
  ])
    assert.throws(() => parseTimeApi(JSON.stringify(v)));
  assert.throws(() => parseTimeApi("<html>"));
});
test("cached-anchor-advances-after-two-seconds-and-expires-at-15000", async () => {
  const f = fixture(),
    a = await (await f.request()).json();
  assert.equal(f.calls.length, 2);
  f.advance(2000);
  const b = await (await f.request()).json();
  assert.equal(f.calls.length, 2);
  assert.ok(b.sources.every((s) => s.cached));
  for (let i = 0; i < 2; i++) {
    assert.equal(b.sources[i].nowMs - a.sources[i].nowMs, 2000);
    assert.equal(b.sources[i].sampleAgeMs - a.sources[i].sampleAgeMs, 2000);
  }
  f.advance(13000);
  const c = await (await f.request()).json();
  assert.equal(f.calls.length, 4);
  assert.ok(c.sources.every((s) => !s.cached));
});
test("cache-corruption-unavailability-or-stall-falls-back-to-sampling", async () => {
  for (const cache of [
    {
      match: async () => new Response("garbage"),
      put: async () => {
        throw Error();
      },
    },
    {
      match: async () => {
        throw Error();
      },
      put: async () => {},
    },
    { match: async () => new Promise(() => {}), put: async () => {} },
    {
      match: async () => new Response(JSON.stringify({ version: 2 })),
      put: async () => {},
    },
  ]) {
    const f = fixture({ cache });
    assert.equal((await f.request()).status, 200);
    assert.equal(f.calls.length, 2);
  }
});
test("fixed-targets-static-headers-and-zero-redirects", async () => {
  const f = fixture();
  await f.request();
  assert.deepEqual(
    f.calls.map((c) => c.url),
    Object.values(URLS),
  );
  for (const c of f.calls) {
    assert.equal(c.init.redirect, "manual");
    assert.deepEqual(Object.keys(c.init.headers).sort(), [
      "Accept",
      "User-Agent",
    ]);
  }
  for (const url of [
    "http://timeapi.io/",
    "https://sub.timeapi.io/",
    "https://127.0.0.1/",
    "https://169.254.169.254/",
    "https://localhost/",
    "https://timeapi.io:444/",
    "https://timeapi.io/api/Time/current/zone?timeZone=UTC&x=1",
  ])
    assert.throws(() => exactTarget("timeapi-io", url));
  const r = await fixture({
    fetch: async () =>
      new Response(null, {
        status: 302,
        headers: { Location: "https://localhost/" },
      }),
  }).request();
  assert.equal(r.status, 502);
  assert.equal((await r.json()).sources[0].error.code, "upstream-redirect");
});
test("body-timeout-cancels-stream-and-normalizes-error", async () => {
  let canceled = 0;
  const f = fixture({
    timeoutMs: 15,
    fetch: async () =>
      new Response(
        new ReadableStream({
          pull() {
            return new Promise(() => {});
          },
          cancel() {
            canceled++;
          },
        }),
      ),
  });
  const r = await f.request();
  assert.equal(r.status, 504);
  assert.equal(canceled, 2);
  assert.equal((await r.json()).sources[0].error.code, "upstream-timeout");
});
test("oversized-decompressed-stream-canceled", async () => {
  let canceled = 0;
  const f = fixture({
    fetch: async () =>
      new Response(
        new ReadableStream({
          pull(c) {
            c.enqueue(new Uint8Array(65537));
          },
          cancel() {
            canceled++;
          },
        }),
      ),
  });
  const r = await f.request(),
    v = await r.json();
  assert.equal(r.status, 502);
  assert.equal(canceled, 2);
  assert.ok(v.sources.every((s) => s.error.code === "upstream-too-large"));
});
test("invalid-method-and-query-never-contact-upstream", async () => {
  const f = fixture();
  const m = await f.request(undefined, "POST");
  assert.equal(m.status, 405);
  assert.equal(m.headers.get("allow"), "GET");
  for (const url of [
    "https://site.test/api/time-sync?x=1",
    "https://site.test/api/time-sync?x=",
  ])
    assert.equal((await f.request(url)).status, 400);
  assert.equal(f.calls.length, 0);
});
test("server-wall-clock-jump-refuses-samples", async () => {
  const f = fixture({
    fetch: async (url) => {
      f.jump(101);
      return body(url);
    },
  });
  const r = await f.request(),
    v = await r.json();
  assert.equal(r.status, 502);
  assert.ok(v.sources.every((s) => s.error.code === "server-clock-changed"));
});
test("early-cache-anchor-advances-to-common-assembly-and-cannot-survive-expiry", async () => {
  for (const age of [1000, 14999]) {
    const f = fixture({
      fetch: async (url) => {
        await new Promise((r) => setTimeout(r, 0));
        f.advance(20);
        return body(url);
      },
    });
    f.entries.set(
      cacheKey("cloudflare-trace"),
      new Response(
        JSON.stringify({
          version: 1,
          source: "cloudflare-trace",
          sourceSampleMs: epoch,
          upstreamRttMs: 0,
          receivedAtMs: epoch - age,
          monoAtMs: -age,
          isolate: ISOLATE,
          timestampResolutionMs: 1000,
        }),
      ),
    );
    const v = await (await f.request()).json();
    if (age === 1000) {
      assert.equal(v.sources[0].nowMs, epoch + 1020);
      assert.equal(v.sources[0].sampleAgeMs, 1020);
      assert.equal(v.sources[0].cached, true);
    } else {
      assert.equal(v.sources[0].ok, false);
      assert.equal(v.sources[0].error.code, "sample-expired");
      assert.equal(v.status, "partial");
    }
  }
});
test("responses-cache-and-exceptions-do-not-leak-trace-fields", async () => {
  const f = fixture();
  const r = await f.request();
  assert.doesNotMatch(await r.text(), /discard-me|secret|loc=/);
  for (const cached of f.entries.values())
    assert.doesNotMatch(await cached.clone().text(), /discard-me|secret|loc=/);
  const fail = await fixture({
    fetch: async () => {
      throw Error("private visitor IP secret");
    },
  }).request();
  assert.doesNotMatch(await fail.text(), /private visitor|secret/);
});
test("entry-wraps-native-fetch-with-global-receiver", async () => {
  const original = globalThis.fetch;
  let calls = 0;
  globalThis.fetch = function (url) {
    assert.equal(this, globalThis);
    calls++;
    return Promise.resolve(body(url));
  };
  try {
    const r = await onRequest({
      request: new Request("https://site.test/api/time-sync"),
      waitUntil: () => {},
    });
    assert.equal(r.status, 200);
    assert.equal(calls, 2);
  } finally {
    globalThis.fetch = original;
  }
});
test("synchronous-cache-write-errors-do-not-discard-successful-samples", async () => {
  const f = fixture({
    cache: {
      match: async () => undefined,
      put: () => {
        throw Error("cache unavailable");
      },
    },
  });
  assert.equal((await f.request()).status, 200);
});
test("whole-round-deadline-aborts-uncooperative-upstream", async () => {
  const f = fixture({
    timeoutMs: 3000,
    roundTimeoutMs: 12,
    fetch: async () => new Promise(() => {}),
  });
  const response = await f.request();
  assert.equal(response.status, 504);
});
test("independent-probe-requires-real-contract-common-source-and-progress", async () => {
  const { verifyLiveTimeSync } =
    await import("../lib/tool-cases/time-sync.mjs");
  const f = fixture();
  const value = await verifyLiveTimeSync(
    "https://site.test",
    () => f.request(),
    async (ms) => {
      assert.ok(ms >= 2000);
      f.advance(ms);
      await new Promise((r) => setTimeout(r, 2001));
    },
  );
  assert.equal(value.availability, "complete");
  assert.equal(value.sources.length, 2);
  assert.ok(value.sources[1].every((s) => s.cached));
});
test("elapsed-upstream-budget-is-a-timeout-rather-than-a-clock-jump", async () => {
  const f = fixture({
    fetch: async (url) => {
      f.advance(3001);
      return body(url);
    },
  });
  const response = await f.request(),
    value = await response.json();
  assert.equal(response.status, 504);
  assert.ok(value.sources.every((s) => s.error.code === "upstream-timeout"));
});
test("stalled-cache-bodies-are-canceled-before-fresh-sampling", async () => {
  let canceled = 0;
  const f = fixture({
    cache: {
      match: async () =>
        new Response(
          new ReadableStream({
            pull() {
              return new Promise(() => {});
            },
            cancel() {
              canceled++;
            },
          }),
        ),
      put: async () => {},
    },
  });
  assert.equal((await f.request()).status, 200);
  assert.equal(canceled, 2);
  assert.equal(f.calls.length, 2);
});

test("rejected clock-jump round never caches the samples it rejected", async () => {
  const f = fixture();
  const upstream = f.deps.fetch;
  let calls = 0;
  f.deps.fetch = async (url, init) => {
    const response = await upstream(url, init);
    if (++calls === 1) f.jump(5000);
    return response;
  };
  const response = await f.request();
  const data = await response.json();
  assert.equal(data.ok, false);
  assert.ok(data.sources.every((s) => s.error?.code === "server-clock-changed"));
  // 整轮被判定为服务端时钟跳变时，不应把跳变前的采样写进缓存。
  assert.equal(f.entries.size, 0);
});

test("cache is not reused when the wall clock jumped between rounds", async () => {
  const f = fixture();
  const first = await (await f.request()).json();
  assert.ok(first.sources.every((s) => s.cached === false));
  // 首次响应后墙上时钟向前跳 5 秒（单调时钟不动），此前缓存的锚点不再可信。
  f.jump(5000);
  const second = await (await f.request()).json();
  assert.ok(second.sources.every((s) => s.cached === false));
  assert.equal(second.ok, true);
});
