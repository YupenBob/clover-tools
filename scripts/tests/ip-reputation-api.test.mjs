import test from "node:test";
import assert from "node:assert/strict";
import { setTimeout as delay } from "node:timers/promises";
import {
  handleIpReputation,
  onRequest,
} from "../../functions/api/ip-reputation.ts";
import {
  parseIp,
  parseInput,
  isPublicIp,
  filterDns,
  selectAddresses,
  normalizeSource,
} from "../../functions/lib/ip-reputation.ts";
import {
  validateResponse,
  serializeHistory,
} from "../../src/lib/ip-reputation.ts";
const epoch = Date.UTC(2026, 10, 18, 16),
  origin = "https://clovertools.cn";
const post = (body, headers = {}) =>
  new Request(origin + "/api/ip-reputation", {
    method: "POST",
    headers: { "Content-Type": "application/json", ...headers },
    body: JSON.stringify(body),
  });
function doh(name = "example.com", type = "A", answers) {
  return {
    Status: 0,
    TC: false,
    Question: [{ name: name + ".", type: type === "A" ? 1 : 28 }],
    Answer: answers ?? [
      {
        name: name + ".",
        type: type === "A" ? 1 : 28,
        TTL: 45,
        data: type === "A" ? "8.8.8.8" : "2606:4700:4700::1111",
      },
    ],
  };
}
function harness(options = {}) {
  let now = epoch;
  const calls = [],
    cache = new Map(),
    backoff = new Map();
  const deps = {
    now: () => now,
    cache,
    backoff,
    timeoutMs: 50,
    budgetMs: 150,
    fetch: async (input, init) => {
      const url = new URL(input);
      calls.push({ url: String(url), init });
      if (options.fetch) return options.fetch(url, init);
      const ip =
        url.hostname === "api.ipapi.is"
          ? JSON.parse(init.body).q
          : decodeURIComponent(url.pathname.split("/")[1]);
      if (url.hostname === "cloudflare-dns.com")
        return Response.json(
          doh(url.searchParams.get("name"), url.searchParams.get("type")),
        );
      return Response.json({
        ip,
        success: true,
        country: "United States",
        country_code: "US",
        country_name: "United States",
        city: "Town",
        connection: { asn: 15169, org: "Google" },
        asn:
          url.hostname === "api.ipapi.is"
            ? { asn: 15169, org: "Google" }
            : "AS15169",
        org: "Google",
        location: {
          country: "United States",
          country_code: "US",
          city: "Town",
        },
        is_datacenter: true,
        is_vpn: false,
        is_crawler: "GoogleBot",
        company: { name: "Example company", abuser_score: "0.001 (Low)" },
      });
    },
    ...options.deps,
  };
  return {
    calls,
    cache,
    backoff,
    deps,
    setNow: (n) => (now = n),
    async request(body = { action: "lookup", query: "8.8.8.8" }, env = {}) {
      const r = await handleIpReputation(post(body), env, deps);
      const json = await r.json();
      assert.ok(
        validateResponse(json),
        "valid envelope " + JSON.stringify(json),
      );
      return { r, json };
    },
  };
}
test("strict-ipv4-and-ipv6", () => {
  for (const [raw, out] of [
    ["8.8.8.8", "8.8.8.8"],
    ["2606:4700:4700:0:0:0:0:1111", "2606:4700:4700::1111"],
    ["2001:4860:0:0:1:0:0:1", "2001:4860::1:0:0:1"],
    ["::ffff:8.8.8.8", "8.8.8.8"],
    ["::ffff:0808:0808", "8.8.8.8"],
    ["2606:4700::8.8.8.8", "2606:4700::808:808"],
  ])
    assert.equal(parseIp(raw).ip, out);
  for (const v of [
    "127.1",
    "2130706433",
    "0177.0.0.1",
    "0x7f.0.0.1",
    "1.1.1.256",
    "1.2.3.-1",
    "1.2.3.04",
    "::1::2",
    "1:2:3:4:5:6:7:8::",
    "1:2:3:4:5:6:7",
    "fe80::1%eth0",
    "[::1]",
    "::1/128",
  ])
    assert.equal(parseIp(v), null, v);
});
test("special-ranges-and-boundaries", () => {
  for (const v of [
    "100.63.255.255",
    "100.128.0.0",
    "8.8.8.8",
    "2606:4700::1111",
    "3ffe:ffff::1",
    "2001:4860::8888",
  ])
    assert.equal(isPublicIp(parseIp(v)), true, v);
  for (const v of [
    "100.64.0.0",
    "100.127.255.255",
    "0.0.0.0",
    "10.0.0.1",
    "127.0.0.1",
    "169.254.169.254",
    "172.31.255.255",
    "192.0.0.9",
    "192.31.196.1",
    "192.52.193.1",
    "192.88.99.1",
    "192.175.48.1",
    "198.18.0.1",
    "198.51.100.1",
    "203.0.113.1",
    "224.0.0.0",
    "255.255.255.255",
    "fe80::1",
    "febf:ffff::1",
    "2001:db8::1",
    "2001:1::1",
    "2002::1",
    "2620:4f:8000::1",
    "3fff::1",
    "3fff:fff::1",
    "4000::1",
    "64:ff9b::808:808",
    "::808:808",
  ])
    assert.equal(isPublicIp(parseIp(v)), false, v);
});
test("mapped-private-is-blocked", () => {
  for (const v of [
    "::ffff:192.168.1.1",
    "::ffff:c0a8:0101",
    "0:0:0:0:0:ffff:7f00:1",
    "::ffff:a9fe:a9fe",
  ])
    assert.equal(parseInput(v).code, "special-address");
});
test("invalid-input-never-fetches", async () => {
  const h = harness();
  for (const query of [
    "",
    "https://example.com",
    "127.0.0.1",
    "::ffff:c0a8:1",
    "a".repeat(257),
    "123.123",
    "a..example",
    "example.com/",
    "foo.local",
    "localhost",
    "1.2.3.004",
    "０１２３",
  ]) {
    const { r, json } = await h.request({ action: "lookup", query });
    assert.equal(r.status, 400, query);
    assert.equal(json.ok, false);
  }
  assert.equal(h.calls.length, 0);
});
test("action-types-and-query-kinds-never-fetch", async () => {
  const h = harness();
  for (const action of [["lookup"], ["resolve"], [], {}, null, true, 2]) {
    for (const query of ["example.com", "8.8.8.8"]) {
      const { r, json } = await h.request({ action, query });
      assert.equal(r.status, 400, JSON.stringify({ action, query }));
      assert.equal(json.error.code, "invalid-body");
      assert.equal(h.calls.length, 0);
    }
  }
  for (const body of [
    { action: "lookup", query: "example.com" },
    { action: "resolve", query: "8.8.8.8" },
  ]) {
    const { r, json } = await h.request(body);
    assert.equal(r.status, 400);
    assert.equal(json.error.code, "invalid-input");
    assert.equal(h.calls.length, 0);
  }
});
test("dns-filters-and-bounds", () => {
  const raw = doh("example.com", "A", [
    { name: "example.com", type: 5, TTL: 30, data: "alias.example.net." },
    { name: "alias.example.net", type: 1, TTL: 20, data: "10.0.0.1" },
    { name: "alias.example.net", type: 1, TTL: 25, data: "8.8.8.8" },
    { name: "other.example.net", type: 1, TTL: 20, data: "1.1.1.1" },
  ]);
  const filtered = filterDns(raw, "example.com", "A");
  assert.equal(filtered.filteredCount, 1);
  assert.deepEqual(
    filtered.ips.map((p) => p.ip),
    ["8.8.8.8"],
  );
  assert.equal(filtered.ttl, 20);
  const addresses = selectAddresses([
    ...Array.from({ length: 12 }, (_, i) => parseIp(`8.8.8.${12 - i}`)),
    parseIp("8.8.8.1"),
    parseIp("2606:4700::1111"),
  ]);
  assert.equal(addresses.addresses.length, 8);
  assert.equal(addresses.addresses[0].ip, "8.8.8.1");
  assert.equal(addresses.truncated, true);
  for (const mutate of [
    (v) => (v.TC = true),
    (v) => (v.Question[0].name = "evil.example"),
    (v) =>
      v.Answer.push({
        name: "alias.example.net",
        type: 5,
        TTL: 20,
        data: "example.com",
      }),
    (v) => (v.Answer = Array(129).fill(v.Answer[0])),
  ]) {
    const v = structuredClone(raw);
    mutate(v);
    assert.equal(filterDns(v, "example.com", "A"), null);
  }
  const unrelated = filterDns(
    doh("example.com", "A", [
      { name: "other.example.net", type: 1, TTL: 60, data: "8.8.8.8" },
    ]),
    "example.com",
    "A",
  );
  assert.equal(unrelated.ips.length, 0);
});
test("two-basic-sources-support-both-families", async () => {
  for (const query of ["8.8.8.8", "2606:4700:4700::1111"]) {
    const h = harness(),
      { json } = await h.request({ action: "lookup", query });
    assert.equal(json.status, "complete");
    assert.equal(json.data.ip, query);
    assert.deepEqual(
      h.calls.map((c) => c.url),
      [
        `https://ipwho.is/${encodeURIComponent(query)}`,
        `https://ipapi.co/${encodeURIComponent(query)}/json/`,
      ],
    );
    for (const c of h.calls) {
      assert.equal(c.init.redirect, "manual");
      assert.deepEqual(Object.keys(c.init.headers), ["Accept"]);
    }
  }
});
test("missing-key-skips-enhancement", async () => {
  const h = harness(),
    { json } = await h.request();
  assert.equal(h.calls.length, 2);
  assert.equal(json.data.enhancement, "key-required");
  for (const f of ["hosting", "vpn", "proxy", "tor", "crawler", "abuser"]) {
    assert.equal(json.data.sources[2].fields[f].value, null);
    assert.equal(json.data.sources[2].fields[f].reason, "key-required");
  }
  assert.equal(json.data.sources[0].fields.vpn.reason, "unsupported");
});
test("source-failure-is-isolated", async () => {
  for (const [mode, expected] of [
    ["timeout", "timeout"],
    ["429", "rate-limited"],
    ["403", "auth-failed"],
    ["business", "invalid"],
  ]) {
    const h = harness({
      fetch: async (url) => {
        if (url.hostname === "ipwho.is") {
          if (mode === "timeout") {
            await delay(70);
            return Response.json({});
          }
          return mode === "business"
            ? Response.json({ success: false, message: "not available" })
            : new Response("{}", {
                status: Number(mode),
                headers: { "Retry-After": "30" },
              });
        }
        return Response.json({ ip: "8.8.8.8", asn: "AS15169" });
      },
    });
    const { json } = await h.request();
    assert.equal(json.status, "partial");
    assert.equal(json.data.sources[0].status, expected);
    assert.equal(json.data.sources[1].status, "success");
  }
  const h = harness({ fetch: async () => new Response("{}", { status: 500 }) });
  const { r, json } = await h.request();
  assert.equal(r.status, 503);
  assert.equal(json.ok, false);
});
test("mismatched-ip-is-rejected", async () => {
  const h = harness({
    fetch: async () => Response.json({ ip: "1.1.1.1", success: true }),
  });
  const { json } = await h.request();
  assert.equal(json.status, "unavailable");
  assert.ok(
    json.data.sources
      .slice(0, 2)
      .every((s) => s.error.code === "upstream-invalid"),
  );
  assert.equal(
    normalizeSource(
      "ipwho.is",
      { ip: "8.8.8.8", success: true, connection: { asn: NaN } },
      "8.8.8.8",
      new Date(epoch).toISOString(),
    ).fields.asn.value,
    null,
  );
});
test("body-and-time-are-bounded", async () => {
  const h = harness({
    fetch: async () => new Response("x".repeat(128 * 1024 + 1)),
  });
  assert.equal(
    (await h.request()).json.data.sources[0].error.code,
    "upstream-too-large",
  );
  let cancelled = 0;
  const slow = harness({
    fetch: async () =>
      new Response(
        new ReadableStream({
          start(c) {
            c.enqueue(new TextEncoder().encode("{"));
          },
          cancel() {
            cancelled++;
          },
        }),
      ),
  });
  const hold = delay(100);
  const start = performance.now(),
    result = await slow.request();
  await hold;
  assert.equal(result.r.status, 503);
  assert.ok(performance.now() - start < 500);
  assert.equal(cancelled, 2);
  const request = new Request(origin + "/api/ip-reputation", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    duplex: "half",
    body: new ReadableStream({
      start(c) {
        c.enqueue(new TextEncoder().encode("{"));
      },
    }),
  });
  const keep = delay(200);
  const r = await handleIpReputation(request, {}, h.deps);
  await keep;
  assert.equal(r.status, 503);
});
test("redirects-are-not-followed", async () => {
  for (const location of [
    "https://ipapi.co/8.8.8.8/json/",
    "http://169.254.169.254/",
  ]) {
    const h = harness({
      fetch: async () =>
        new Response(null, { status: 302, headers: { Location: location } }),
    });
    const { json } = await h.request();
    assert.equal(h.calls.length, 2);
    assert.equal(json.data.sources[0].error.code, "upstream-redirect");
    assert.ok(h.calls.every((c) => c.init.redirect === "manual"));
  }
});
test("cache-preserves-observation-time", async () => {
  const h = harness();
  const first = (await h.request()).json;
  h.setNow(epoch + 20000);
  const hit = (await h.request()).json;
  assert.equal(h.calls.length, 2);
  assert.equal(hit.data.sources[0].cacheHit, true);
  assert.equal(hit.data.sources[0].cacheAgeMs, 20000);
  assert.equal(hit.data.sources[0].fetchedAt, first.data.sources[0].fetchedAt);
  h.setNow(epoch + 60000);
  const expired = (await h.request()).json;
  assert.equal(h.calls.length, 4);
  assert.equal(expired.data.sources[0].cacheHit, false);
  assert.equal(
    expired.data.sources[0].fetchedAt,
    new Date(epoch + 60000).toISOString(),
  );
});
test("cache-isolates-key-mode", async () => {
  const h = harness(),
    keyA = "test-" + "key-A",
    keyB = "test-" + "key-B";
  await h.request();
  await h.request(undefined, { IPAPI_IS_KEY: keyA });
  assert.equal(h.calls.length, 5);
  await h.request(undefined, { IPAPI_IS_KEY: keyA });
  assert.equal(h.calls.length, 5);
  await h.request(undefined, { IPAPI_IS_KEY: keyB });
  assert.equal(h.calls.length, 8);
  assert.ok([...h.cache.keys()].every((k) => !k.includes("test-key")));
});
test("secret-does-not-escape", async () => {
  const key = "secret-reputation-test-KEY";
  const h = harness(),
    { json } = await h.request(undefined, { IPAPI_IS_KEY: key });
  assert.equal(
    h.calls.find((c) => new URL(c.url).hostname === "api.ipapi.is").init.body,
    JSON.stringify({ q: "8.8.8.8", key }),
  );
  assert.ok(!h.calls.some((c) => c.url.includes(key)));
  assert.ok(!JSON.stringify(json).includes(key));
  assert.ok(!JSON.stringify([...h.cache]).includes(key));
  assert.ok(
    !serializeHistory([
      { query: "8.8.8.8", selectedIp: "8.8.8.8", report: json },
    ]).includes(key),
  );
  const echo = harness({
    fetch: async () =>
      Response.json({ ip: "8.8.8.8", success: true, country: key }),
  });
  const result = (await echo.request(undefined, { IPAPI_IS_KEY: key })).json;
  assert.ok(!JSON.stringify(result).includes(key));
  assert.equal(echo.cache.size, 0);
});
test("capabilities-does-not-query-visitor", async () => {
  const h = harness();
  const r = await handleIpReputation(
    new Request(origin + "/api/ip-reputation", {
      headers: { "CF-Connecting-IP": "1.1.1.1" },
    }),
    {},
    h.deps,
  );
  const json = await r.json();
  assert.equal(r.status, 200);
  assert.equal(json.kind, "capabilities");
  assert.ok(validateResponse(json));
  assert.equal(h.calls.length, 0);
  assert.equal(r.headers.get("Cache-Control"), "no-store");
  assert.equal(r.headers.get("Access-Control-Allow-Origin"), null);
  const configured = "con" + "figured";
  const wrapper = await onRequest({
    request: new Request(origin + "/api/ip-reputation"),
    env: { IPAPI_IS_KEY: configured },
  });
  assert.equal((await wrapper.json()).data.enhancement, "enabled");
});
test("method-and-body-guards", async () => {
  const h = harness();
  const cases = [
    [
      new Request(origin + "/api/ip-reputation", { method: "PUT" }),
      405,
      "method-not-allowed",
    ],
    [
      new Request(origin + "/api/ip-reputation", {
        method: "POST",
        body: "{}",
      }),
      415,
      "unsupported-media",
    ],
    [
      post({ action: "lookup", query: "8.8.8.8", key: "no" }),
      400,
      "invalid-body",
    ],
    [post({ action: "unknown", query: "8.8.8.8" }), 400, "invalid-body"],
    [post({ action: 2, query: "8.8.8.8" }), 400, "invalid-body"],
    [post({ action: "lookup", query: ["8.8.8.8"] }), 400, "invalid-body"],
    [
      post(
        { action: "lookup", query: "8.8.8.8" },
        { Origin: "https://evil.example" },
      ),
      403,
      "origin-rejected",
    ],
    [
      post({ action: "lookup", query: "x".repeat(2100) }),
      413,
      "body-too-large",
    ],
    [
      new Request(origin + "/api/ip-reputation?ip=8.8.8.8"),
      400,
      "invalid-body",
    ],
  ];
  for (const [req, status, code] of cases) {
    const r = await handleIpReputation(req, {}, h.deps),
      json = await r.json();
    assert.equal(r.status, status);
    assert.equal(json.error.code, code);
    assert.ok(validateResponse(json));
    if (status === 405) assert.equal(r.headers.get("Allow"), "GET, POST");
  }
  assert.equal(h.calls.length, 0);
});
test("dns-api-partial-nxdomain-and-cache", async () => {
  const h = harness();
  const a = (await h.request({ action: "resolve", query: "EXAMPLE.com." }))
    .json;
  assert.equal(a.kind, "resolution");
  assert.deepEqual(
    a.data.addresses.map((x) => x.ip),
    ["8.8.8.8", "2606:4700:4700::1111"],
  );
  h.setNow(epoch + 1000);
  const b = (await h.request({ action: "resolve", query: "example.com" })).json;
  assert.equal(h.calls.length, 2);
  assert.equal(b.data.families[0].fetchedAt, a.data.families[0].fetchedAt);
  assert.equal(b.data.families[0].cacheHit, true);
  for (const mode of ["partial", "empty", "failure", "short-ttl"]) {
    const x = harness({
      fetch: async (url) => {
        const type = url.searchParams.get("type");
        if ((mode === "partial" && type === "AAAA") || mode === "failure")
          return new Response("{}", { status: 503 });
        const v = doh("example.com", type, mode === "empty" ? [] : undefined);
        if (mode === "empty") v.Status = 3;
        if (mode === "short-ttl") v.Answer[0].TTL = 14;
        return Response.json(v);
      },
    });
    const { r, json } = await x.request({
      action: "resolve",
      query: "example.com",
    });
    assert.equal(
      json.status,
      mode === "partial"
        ? "partial"
        : ["empty", "failure"].includes(mode)
          ? "unavailable"
          : "complete",
    );
    if (mode === "empty") assert.equal(r.status, 422);
    if (mode === "failure") assert.equal(r.status, 503);
    if (mode === "short-ttl") assert.equal(x.cache.size, 0);
  }
});
test("rate-limit-backoff-and-cache-failure", async () => {
  const h = harness({
    fetch: async () =>
      new Response("{}", { status: 429, headers: { "Retry-After": "30" } }),
  });
  await h.request();
  h.setNow(epoch + 20000);
  const { json } = await h.request();
  assert.equal(h.calls.length, 2);
  assert.equal(json.data.sources[0].error.retryAfterSeconds, 10);
  h.setNow(epoch + 31000);
  await h.request();
  assert.equal(h.calls.length, 4);
  const x = harness({
    deps: {
      cache: {
        get() {
          throw Error("unavailable");
        },
        set() {
          throw Error("unavailable");
        },
        size: 0,
      },
    },
  });
  assert.equal((await x.request()).json.status, "complete");
});

test("retry-after-date-and-long-window-are-preserved", async () => {
  for (const [header, seconds] of [
    ["172800", 172800],
    [new Date(epoch + 45000).toUTCString(), 45],
    ["not-a-date", undefined],
  ]) {
    const h = harness({
      fetch: async () =>
        new Response("{}", { status: 429, headers: { "Retry-After": header } }),
    });
    const { json } = await h.request();
    assert.equal(json.data.sources[0].error.retryAfterSeconds, seconds);
  }
});
test("live-verifier-requires-real-query-success", async () => {
  const { verifyLiveIpReputation } =
    await import("../lib/tool-cases/ip-reputation.mjs");
  const h = harness();
  const fetcher = (url, init) =>
    handleIpReputation(new Request(url, init), {}, h.deps);
  const verified = await verifyLiveIpReputation(origin, fetcher);
  assert.equal(verified.observations.length, 2);
  assert.ok(verified.observations.every((o) => o.crossChecked));
  const unavailable = harness({
    fetch: async () => new Response("{}", { status: 503 }),
  });
  await assert.rejects(
    verifyLiveIpReputation(origin, (url, init) =>
      handleIpReputation(new Request(url, init), {}, unavailable.deps),
    ),
  );
});

test("dns-rate-limit-backoff-and-response-cap", async () => {
  const h = harness({
    fetch: async () =>
      new Response("{}", { status: 429, headers: { "Retry-After": "45" } }),
  });
  const first = await h.request({ action: "resolve", query: "example.com" });
  assert.equal(first.json.data.families[0].error.retryAfterSeconds, 45);
  assert.equal(h.calls.length, 2);
  h.setNow(epoch + 10000);
  const second = await h.request({ action: "resolve", query: "example.net" });
  assert.equal(h.calls.length, 2);
  assert.equal(second.json.data.families[1].error.retryAfterSeconds, 35);
  const large = harness({
    fetch: async () => new Response("x".repeat(64 * 1024 + 1)),
  });
  const result = await large.request({
    action: "resolve",
    query: "example.com",
  });
  assert.equal(result.json.data.families[0].error.code, "upstream-too-large");
});

test("negative-dns-answer-uses-soa-negative-ttl", () => {
  const base = (authority) => ({
    Status: 3,
    TC: false,
    Question: [{ name: "example.com.", type: 1 }],
    Answer: [],
    Authority: authority,
  });
  const soa = (ttl, minimum) => [
    {
      name: "example.com.",
      type: 6,
      TTL: ttl,
      data: `ns1.example.com. admin.example.com. 1 7200 3600 1209600 ${minimum}`,
    },
  ];
  assert.equal(filterDns(base(soa(300, 20)), "example.com", "A").ttl, 20);
  assert.equal(filterDns(base(soa(10, 300)), "example.com", "A").ttl, 10);
  assert.equal(filterDns(base([]), "example.com", "A").ttl, 0);
  // SOA MINIMUM 无法解析时不能退回 SOA 自身 TTL，只能视为不可缓存。
  const broken = [
    {
      name: "example.com.",
      type: 6,
      TTL: 300,
      data: "ns1.example.com. admin.example.com. 1 7200 3600 1209600 not-a-number",
    },
  ];
  assert.equal(filterDns(base(broken), "example.com", "A").ttl, 0);
  const truncated = [
    { name: "example.com.", type: 6, TTL: 300, data: "garbage" },
  ];
  assert.equal(filterDns(base(truncated), "example.com", "A").ttl, 0);
  // 数字结尾但字段不足 7 个的截断 SOA：最后一个数字不是 MINIMUM，只能不可缓存。
  for (const data of [
    "ns1.example.com. admin.example.com. 1 7200 3600 1209600",
    "ns1.example.com. admin.example.com. 1 7200 3600",
    "ns1.example.com. admin.example.com. 1 7200 3600 1209600 0x10",
    "ns1.example.com. admin.example.com. 1 7200 3600 1209600 20 extra",
  ]) {
    const brokenSoa = [{ name: "example.com.", type: 6, TTL: 300, data }];
    assert.equal(filterDns(base(brokenSoa), "example.com", "A").ttl, 0, data);
  }
});

test("negative-answer-cache-honours-short-soa-ttl", async () => {
  const dohWith = (minimum) => {
    const v = doh("example.com", "A", []);
    v.Authority = [
      {
        name: "example.com.",
        type: 6,
        TTL: 300,
        data: `ns1.example.com. admin.example.com. 1 7200 3600 1209600 ${minimum}`,
      },
    ];
    return v;
  };
  const short = harness({
    fetch: async () => Response.json(dohWith(10)),
  });
  await short.request({ action: "resolve", query: "example.com" });
  assert.equal(short.cache.size, 0);

  const twenty = harness({
    fetch: async () => Response.json(dohWith(20)),
  });
  await twenty.request({ action: "resolve", query: "example.com" });
  assert.ok(twenty.cache.size > 0);
  twenty.setNow(epoch + 25000);
  await twenty.request({ action: "resolve", query: "example.com" });
  const hits = [...twenty.cache.values()];
  assert.ok(hits.every((c) => c.ttl <= 20000));
});
