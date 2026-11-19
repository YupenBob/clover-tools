/** Pure shared contract and parsers. Registry review: 2026-11-18; see docs/IP-REPUTATION.md. */
export const SOURCE_IDS = ["ipwho.is", "ipapi.co", "ipapi.is"] as const;
export type SourceId = (typeof SOURCE_IDS)[number];
export const BASIC_FIELDS = [
  "country",
  "countryCode",
  "city",
  "asn",
  "asnOrg",
  "registeredOrg",
] as const;
export const FLAG_FIELDS = [
  "hosting",
  "vpn",
  "proxy",
  "tor",
  "crawler",
  "abuser",
] as const;
export const FIELD_IDS = [...BASIC_FIELDS, ...FLAG_FIELDS] as const;
export type FieldId = (typeof FIELD_IDS)[number];
export const ERROR_CODES = [
  "empty-input",
  "input-too-long",
  "invalid-input",
  "special-address",
  "invalid-domain",
  "internal-domain",
  "method-not-allowed",
  "invalid-body",
  "unsupported-media",
  "body-too-large",
  "origin-rejected",
  "upstream-timeout",
  "upstream-http",
  "upstream-invalid",
  "upstream-too-large",
  "upstream-redirect",
  "rate-limited",
  "auth-failed",
  "dns-failed",
  "dns-no-address",
  "dns-invalid",
  "upstreams-unavailable",
  "offline",
  "cancelled",
  "clipboard-denied",
  "storage-unavailable",
  "history-invalid",
] as const;
export type ErrorCode = (typeof ERROR_CODES)[number];
export type ApiError = {
  code: ErrorCode;
  retryable: boolean;
  sourceId?: SourceId;
  retryAfterSeconds?: number;
};
export type Missing =
  "not-provided" | "unsupported" | "unavailable" | "key-required";
export type Field = {
  value: string | boolean | null;
  reason: Missing | null;
  upstreamField: string | null;
};
export type Source = {
  id: SourceId;
  status:
    | "success"
    | "timeout"
    | "rate-limited"
    | "auth-failed"
    | "invalid"
    | "failed"
    | "disabled";
  fetchedAt: string | null;
  cacheHit: boolean;
  cacheAgeMs: number;
  error: ApiError | null;
  fields: Record<FieldId, Field>;
  crawlerName: string | null;
  networkIndicators: { scope: "company" | "asn"; raw: string }[];
};
export type Report = {
  ip: string;
  ipVersion: 4 | 6;
  enhancement: "enabled" | "key-required";
  sources: Source[];
};
export type Family = {
  type: "A" | "AAAA";
  status: "success" | "empty" | "failed";
  error: ApiError | null;
  fetchedAt: string | null;
  cacheHit: boolean;
  cacheAgeMs: number;
};
export type Resolution = {
  query: string;
  addresses: { ip: string; ipVersion: 4 | 6 }[];
  families: Family[];
  filteredCount: number;
  truncated: boolean;
};
export type Envelope = {
  version: 1;
  kind: "capabilities" | "resolution" | "report" | "error";
  ok: boolean;
  status: "complete" | "partial" | "unavailable" | "invalid";
  responseAt: string;
  data:
    | Report
    | Resolution
    | { enhancement: "enabled" | "key-required"; sources: readonly SourceId[] }
    | null;
  error: ApiError | null;
};
export const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
export const cleanText = (v: unknown, max = 240): string | null =>
  typeof v === "string" && v.trim()
    ? v
        .replace(
          /[\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/g,
          "",
        )
        .trim()
        .replace(/\s+/gu, " ")
        .slice(0, max) || null
    : null;
export type Ip = { ip: string; ipVersion: 4 | 6; numeric: bigint };
function ipv4(v: string): Ip | null {
  const a = v.split(".");
  if (
    a.length !== 4 ||
    a.some((x) => !/^(0|[1-9]\d{0,2})$/.test(x) || Number(x) > 255)
  )
    return null;
  return {
    ip: a.join("."),
    ipVersion: 4,
    numeric: a.reduce((n, x) => (n << 8n) + BigInt(x), 0n),
  };
}
export function parseIp(raw: string): Ip | null {
  const v4 = ipv4(raw);
  if (v4) return v4;
  if (!raw.includes(":") || /[^0-9a-fA-F:.]/.test(raw)) return null;
  let v = raw.toLowerCase();
  if (v.includes(".")) {
    const i = v.lastIndexOf(":"),
      a = ipv4(v.slice(i + 1));
    if (!a) return null;
    v =
      v.slice(0, i + 1) +
      ((a.numeric >> 16n) & 65535n).toString(16) +
      ":" +
      (a.numeric & 65535n).toString(16);
  }
  if (v.split("::").length > 2) return null;
  const compressed = v.includes("::"),
    [l, r = ""] = v.split("::");
  const left = l ? l.split(":") : [],
    right = r ? r.split(":") : [];
  if ([...left, ...right].some((x) => !/^[0-9a-f]{1,4}$/.test(x))) return null;
  const count = left.length + right.length;
  if (compressed ? count >= 8 : count !== 8) return null;
  const parts = [
    ...left,
    ...Array(compressed ? 8 - count : 0).fill("0"),
    ...right,
  ].map((x) => Number.parseInt(x, 16));
  const numeric = parts.reduce((n, x) => (n << 16n) + BigInt(x), 0n);
  if (numeric >> 32n === 65535n)
    return ipv4(
      [24n, 16n, 8n, 0n].map((s) => Number((numeric >> s) & 255n)).join("."),
    );
  let start = -1,
    len = 0;
  for (let i = 0; i < 8;) {
    if (parts[i] !== 0) {
      i++;
      continue;
    }
    let j = i;
    while (j < 8 && parts[j] === 0) j++;
    if (j - i > len && j - i >= 2) {
      start = i;
      len = j - i;
    }
    i = j;
  }
  const words = parts.map((x) => x.toString(16));
  const ip =
    start < 0
      ? words.join(":")
      : words.slice(0, start).join(":") +
        "::" +
        words.slice(start + len).join(":");
  return { ip, ipVersion: 6, numeric };
}
// Includes entire parent reservations; individual globally reachable exceptions remain special.
export const SPECIAL_V4 = [
  "0.0.0.0/8",
  "10.0.0.0/8",
  "100.64.0.0/10",
  "127.0.0.0/8",
  "169.254.0.0/16",
  "172.16.0.0/12",
  "192.0.0.0/24",
  "192.0.2.0/24",
  "192.31.196.0/24",
  "192.52.193.0/24",
  "192.88.99.0/24",
  "192.168.0.0/16",
  "192.175.48.0/24",
  "198.18.0.0/15",
  "198.51.100.0/24",
  "203.0.113.0/24",
  "224.0.0.0/4",
  "240.0.0.0/4",
];
export const SPECIAL_V6 = [
  "2001::/23",
  "2001:db8::/32",
  "2002::/16",
  "2620:4f:8000::/48",
  "3fff::/20",
];
export function inCidr(ip: Ip, cidr: string): boolean {
  const [base, bits] = cidr.split("/"),
    p = parseIp(base);
  return (
    !!p &&
    p.ipVersion === ip.ipVersion &&
    ip.numeric >> BigInt((ip.ipVersion === 4 ? 32 : 128) - Number(bits)) ===
      p.numeric >> BigInt((p.ipVersion === 4 ? 32 : 128) - Number(bits))
  );
}
export function isPublicIp(ip: Ip): boolean {
  return ip.ipVersion === 4
    ? !SPECIAL_V4.some((c) => inCidr(ip, c))
    : inCidr(ip, "2000::/3") && !SPECIAL_V6.some((c) => inCidr(ip, c));
}
export type ParsedInput =
  | { ok: true; kind: "ip" | "domain"; query: string; ipVersion?: 4 | 6 }
  | { ok: false; code: ErrorCode };
export function parseInput(raw: unknown): ParsedInput {
  if (typeof raw !== "string") return { ok: false, code: "invalid-input" };
  if ([...raw].length > 256) return { ok: false, code: "input-too-long" };
  const v = raw.trim();
  if (!v) return { ok: false, code: "empty-input" };
  if (
    /[\s\u0000-\u001f\u007f-\u009f\u061c\u200e\u200f\u202a-\u202e\u2066-\u2069]/u.test(
      v,
    ) ||
    /[\/\\?#@%\[\]]/.test(v)
  )
    return { ok: false, code: "invalid-input" };
  const ip = parseIp(v);
  if (ip)
    return isPublicIp(ip)
      ? { ok: true, kind: "ip", query: ip.ip, ipVersion: ip.ipVersion }
      : { ok: false, code: "special-address" };
  if (v.includes(":") || /^[\d.]+$/.test(v) || /^0x[\da-f]+$/i.test(v))
    return { ok: false, code: "invalid-input" };
  let domain: string;
  try {
    domain = new URL("https://" + v).hostname.toLowerCase().replace(/\.$/, "");
  } catch {
    return { ok: false, code: "invalid-domain" };
  }
  if (
    domain === "localhost" ||
    [".localhost", ".local", ".internal", ".home.arpa"].some((x) =>
      domain.endsWith(x),
    )
  )
    return { ok: false, code: "internal-domain" };
  const labels = domain.split(".");
  if (
    domain.length > 253 ||
    labels.length < 2 ||
    labels.some(
      (x) => x.length > 63 || !/^[a-z0-9](?:[a-z0-9-]*[a-z0-9])?$/.test(x),
    ) ||
    labels.every((x) => /^\d+$/.test(x)) ||
    parseIp(domain)
  )
    return { ok: false, code: "invalid-domain" };
  return { ok: true, kind: "domain", query: domain };
}
const MAP: Record<
  SourceId,
  Record<(typeof BASIC_FIELDS)[number], string | null>
> = {
  "ipwho.is": {
    country: "country",
    countryCode: "country_code",
    city: "city",
    asn: "connection.asn",
    asnOrg: "connection.org",
    registeredOrg: null,
  },
  "ipapi.co": {
    country: "country_name",
    countryCode: "country_code",
    city: "city",
    asn: "asn",
    asnOrg: "org",
    registeredOrg: null,
  },
  "ipapi.is": {
    country: "location.country",
    countryCode: "location.country_code",
    city: "location.city",
    asn: "asn.asn",
    asnOrg: "asn.org",
    registeredOrg: "company.name",
  },
};
export const FLAG_MAP = {
  hosting: "is_datacenter",
  vpn: "is_vpn",
  proxy: "is_proxy",
  tor: "is_tor",
  crawler: "is_crawler",
  abuser: "is_abuser",
} as const;
function at(v: unknown, path: string): unknown {
  return path
    .split(".")
    .reduce<unknown>((x, key) => (object(x) ? x[key] : undefined), v);
}
export function blankSource(
  id: SourceId,
  reason: Missing,
  error: ApiError | null = null,
): Source {
  const fields = {} as Record<FieldId, Field>;
  for (const k of FIELD_IDS)
    fields[k] = {
      value: null,
      reason,
      upstreamField: BASIC_FIELDS.includes(k as (typeof BASIC_FIELDS)[number])
        ? MAP[id][k]
        : id === "ipapi.is"
          ? FLAG_MAP[k]
          : null,
    };
  return {
    id,
    status: reason === "key-required" ? "disabled" : "failed",
    fetchedAt: null,
    cacheHit: false,
    cacheAgeMs: 0,
    error,
    fields,
    crawlerName: null,
    networkIndicators: [],
  };
}
export function normalizeSource(
  id: SourceId,
  raw: unknown,
  requested: string,
  fetchedAt: string,
): Source | null {
  if (
    !object(raw) ||
    (id === "ipwho.is" && raw.success !== true) ||
    raw.error ||
    raw.success === false ||
    typeof raw.ip !== "string" ||
    parseIp(raw.ip)?.ip !== requested
  )
    return null;
  const s = blankSource(id, "not-provided");
  s.status = "success";
  s.fetchedAt = fetchedAt;
  for (const k of BASIC_FIELDS) {
    const path = MAP[id][k];
    if (!path) {
      s.fields[k].reason = "unsupported";
      continue;
    }
    let value = at(raw, path);
    if (k === "asn") {
      const n =
        typeof value === "number"
          ? value
          : typeof value === "string" && /^(?:AS)?\d+$/i.test(value.trim())
            ? Number(value.trim().replace(/^AS/i, ""))
            : NaN;
      value = Number.isInteger(n) && n > 0 && n <= 4294967295 ? "AS" + n : null;
    }
    let text = cleanText(value);
    if (k === "countryCode")
      text = text && /^[a-z]{2}$/i.test(text) ? text.toUpperCase() : null;
    s.fields[k] = {
      value: text,
      reason: text === null ? "not-provided" : null,
      upstreamField: path,
    };
  }
  for (const k of FLAG_FIELDS) {
    const path = FLAG_MAP[k];
    if (id !== "ipapi.is") {
      s.fields[k] = { value: null, reason: "unsupported", upstreamField: null };
      continue;
    }
    const v = raw[path];
    let value: boolean | null = typeof v === "boolean" ? v : null;
    if (k === "crawler") {
      s.crawlerName = cleanText(v, 120);
      value = v === false ? false : s.crawlerName ? true : null;
    }
    s.fields[k] = {
      value,
      reason: value === null ? "not-provided" : null,
      upstreamField: path,
    };
  }
  if (id === "ipapi.is")
    for (const scope of ["company", "asn"] as const) {
      const indicator = cleanText(at(raw, scope + ".abuser_score"), 160);
      if (indicator) s.networkIndicators.push({ scope, raw: indicator });
    }
  return s;
}
export type DnsResult = {
  ips: Ip[];
  filteredCount: number;
  ttl: number;
  empty: boolean;
};
/** RFC 2308 负缓存 TTL：取 SOA 记录 TTL 与 MINIMUM 中较小者；没有 SOA 就不缓存。 */
function negativeTtl(raw: unknown): number {
  const authority =
    object(raw) && Array.isArray(raw.Authority) ? raw.Authority : [];
  for (const record of authority) {
    if (
      !object(record) ||
      record.type !== 6 ||
      typeof record.TTL !== "number" ||
      !Number.isFinite(record.TTL) ||
      record.TTL < 0 ||
      typeof record.data !== "string"
    )
      continue;
    // SOA rdata 必须是 7 个字段：MNAME RNAME SERIAL REFRESH RETRY EXPIRE MINIMUM，
    // 且后 5 个都是十进制无符号整数；字段缺失、截断或非十进制都视为不可缓存，
    // 不能把别的字段（例如 REFRESH）误当成 MINIMUM 去猜负缓存时长。
    const match =
      /^(\S+)\s+(\S+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)\s+(\d+)$/.exec(
        record.data.trim(),
      );
    if (!match) return 0;
    const minimum = Number(match[7]);
    if (!Number.isSafeInteger(minimum) || minimum < 0) return 0;
    return Math.min(record.TTL, minimum);
  }
  return 0;
}
export function filterDns(
  raw: unknown,
  query: string,
  family: "A" | "AAAA",
): DnsResult | null {
  if (
    !object(raw) ||
    raw.TC !== false ||
    typeof raw.Status !== "number" ||
    ![0, 3].includes(raw.Status)
  )
    return null;
  if (
    !Array.isArray(raw.Question) ||
    raw.Question.length !== 1 ||
    !object(raw.Question[0]) ||
    String(raw.Question[0].name).toLowerCase().replace(/\.$/, "") !== query ||
    raw.Question[0].type !== (family === "A" ? 1 : 28)
  )
    return null;
  const answers = raw.Answer ?? [];
  if (!Array.isArray(answers) || answers.length > 128) return null;
  const nodes = new Set<string>();
  let name = query;
  let ttl = 60;
  for (let depth = 0; ; depth++) {
    if (nodes.has(name)) return null;
    nodes.add(name);
    const links = answers.filter(
      (a) =>
        object(a) &&
        a.type === 5 &&
        typeof a.name === "string" &&
        a.name.toLowerCase().replace(/\.$/, "") === name,
    );
    if (!links.length) break;
    if (depth >= 8 || links.length !== 1 || typeof links[0].data !== "string")
      return null;
    const target = parseInput(links[0].data);
    if (!target.ok || target.kind !== "domain") return null;
    if (
      typeof links[0].TTL !== "number" ||
      !Number.isFinite(links[0].TTL) ||
      links[0].TTL < 0
    )
      return null;
    ttl = Math.min(ttl, links[0].TTL);
    name = target.query;
  }
  const ips: Ip[] = [];
  let filteredCount = 0;
  for (const a of answers) {
    if (
      !object(a) ||
      a.type !== (family === "A" ? 1 : 28) ||
      typeof a.name !== "string" ||
      !nodes.has(a.name.toLowerCase().replace(/\.$/, ""))
    )
      continue;
    if (typeof a.data !== "string") return null;
    const ip = parseIp(a.data);
    if (!ip || ip.ipVersion !== (family === "A" ? 4 : 6)) return null;
    if (typeof a.TTL !== "number" || !Number.isFinite(a.TTL) || a.TTL < 0)
      return null;
    ttl = Math.min(ttl, a.TTL);
    if (isPublicIp(ip)) ips.push(ip);
    else filteredCount++;
  }
  if (raw.Status === 3 && ips.length) return null;
  const empty = ips.length === 0;
  // NXDOMAIN / NODATA：按负缓存 SOA TTL 缩短，没有 SOA 则视为不可缓存。
  if (empty) ttl = Math.min(ttl, negativeTtl(raw));
  return { ips, filteredCount, ttl, empty };
}
export function selectAddresses(ips: Ip[]): {
  addresses: Resolution["addresses"];
  truncated: boolean;
} {
  const sorted = [...new Map(ips.map((p) => [p.ip, p])).values()].sort(
    (a, b) =>
      a.ipVersion - b.ipVersion ||
      (a.numeric < b.numeric ? -1 : a.numeric > b.numeric ? 1 : 0),
  );
  return {
    addresses: sorted
      .slice(0, 8)
      .map(({ ip, ipVersion }) => ({ ip, ipVersion })),
    truncated: sorted.length > 8,
  };
}
