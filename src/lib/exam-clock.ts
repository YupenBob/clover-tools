/** Deterministic exam clock core. No ambient clocks, I/O, or browser APIs. */
export const STORAGE_KEY = "clover-exam-clock:v1";
export const THRESHOLDS = [30, 15, 5, 1] as const;
export type NodeId = "30" | "15" | "5" | "1" | "end";
export type Phase = "normal" | "warning" | "critical" | "finished";
export type ExamInput = {
  name: string;
  start: string;
  end: string;
  durationSeconds?: number;
};
export type Exam = {
  name: string;
  start: string;
  end: string;
  startMs: number;
  endMs: number;
  totalSeconds: number;
};
export type FieldError = {
  field: "name" | "start" | "end" | "duration";
  code: string;
};
const finite = (n: unknown): n is number =>
  typeof n === "number" && Number.isFinite(n);
const fail = (code: string): never => {
  throw new RangeError(code);
};
const pad = (n: number) => String(n).padStart(2, "0");
export function parseBeijing(value: string): number | null {
  if (typeof value !== "string") return null;
  const match = /^(20\d{2})-(\d{2})-(\d{2})T(\d{2}):(\d{2})(?::(\d{2}))?$/.exec(
    value,
  );
  if (!match) return null;
  const [y, m, d, h, min, s] = match.slice(1).map((v) => Number(v || 0));
  if (m < 1 || m > 12 || d < 1 || h > 23 || min > 59 || s > 59) return null;
  const civil = Date.UTC(y, m - 1, d, h, min, s);
  const date = new Date(civil);
  if (
    date.getUTCFullYear() !== y ||
    date.getUTCMonth() !== m - 1 ||
    date.getUTCDate() !== d
  )
    return null;
  return civil - 8 * 3600000;
}
export function beijingInput(ms: number): string {
  if (!finite(ms)) return fail("invalid-time");
  const date = new Date(ms + 8 * 3600000);
  if (!finite(date.getTime())) return fail("invalid-time");
  return date.toISOString().slice(0, 19);
}
export function validateExam(
  input: ExamInput,
): { ok: true; value: Exam } | { ok: false; errors: FieldError[] } {
  const errors: FieldError[] = [];
  const name = typeof input.name === "string" ? input.name.trim() : "";
  if (!name) errors.push({ field: "name", code: "missing-name" });
  if ([...name].length > 80)
    errors.push({ field: "name", code: "name-too-long" });
  if (
    /[\u0000-\u001f\u007f-\u009f]/u.test(
      typeof input.name === "string" ? input.name : "",
    )
  )
    errors.push({ field: "name", code: "invalid-name" });
  const startMs = parseBeijing(input.start),
    endMs = parseBeijing(input.end);
  if (startMs === null) errors.push({ field: "start", code: "invalid-time" });
  if (endMs === null) errors.push({ field: "end", code: "invalid-time" });
  if (startMs !== null && endMs !== null) {
    const seconds = (endMs - startMs) / 1000;
    if (input.start.slice(0, 10) !== input.end.slice(0, 10))
      errors.push({ field: "end", code: "cross-midnight" });
    else if (endMs <= startMs)
      errors.push({ field: "end", code: "end-before-start" });
    if (
      seconds < 1 ||
      seconds > 86399 ||
      !Number.isInteger(seconds) ||
      (input.durationSeconds !== undefined && input.durationSeconds !== seconds)
    )
      errors.push({ field: "duration", code: "invalid-duration" });
  }
  if (
    input.durationSeconds !== undefined &&
    (!finite(input.durationSeconds) ||
      !Number.isInteger(input.durationSeconds) ||
      input.durationSeconds < 1 ||
      input.durationSeconds > 86399)
  ) {
    if (!errors.some((e) => e.field === "duration"))
      errors.push({ field: "duration", code: "invalid-duration" });
  }
  return errors.length
    ? { ok: false, errors }
    : {
        ok: true,
        value: {
          name,
          start: beijingInput(startMs!),
          end: beijingInput(endMs!),
          startMs: startMs!,
          endMs: endMs!,
          totalSeconds: (endMs! - startMs!) / 1000,
        },
      };
}
export function formatClock(
  ms: number,
  options: {
    hour12?: boolean;
    showSeconds?: boolean;
    timeZone: string;
    locale?: string;
    fixedOffsetFallback?: boolean;
  },
) {
  if (!finite(ms) || !Number.isFinite(new Date(ms).getTime()))
    return fail("invalid-time");
  const locale = options.locale || "zh-CN";
  let date = new Date(ms),
    zone = options.timeZone;
  let fallback = false;
  try {
    new Intl.DateTimeFormat("en", { timeZone: zone }).format(date);
  } catch {
    if (!options.fixedOffsetFallback || zone !== "Asia/Shanghai")
      return fail("invalid-timezone");
    date = new Date(ms + 28800000);
    zone = "UTC";
    fallback = true;
  }
  const fmt = new Intl.DateTimeFormat(locale, {
    timeZone: zone,
    numberingSystem: "latn",
    hourCycle: options.hour12 ? "h12" : "h23",
    hour: "2-digit",
    minute: "2-digit",
    ...(options.showSeconds !== false ? { second: "2-digit" as const } : {}),
  });
  const parts = fmt.formatToParts(date);
  const get = (type: string) => parts.find((p) => p.type === type)?.value || "";
  const hour = get("hour"),
    minute = get("minute"),
    second = get("second");
  return {
    time: `${hour}:${minute}${second ? ":" + second : ""}`,
    hour,
    minute,
    second,
    period: get("dayPeriod"),
    date: new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      numberingSystem: "latn",
      year: "numeric",
      month: "long",
      day: "numeric",
    }).format(date),
    weekday: new Intl.DateTimeFormat(locale, {
      timeZone: zone,
      weekday: "long",
    }).format(date),
    timeZone: options.timeZone,
    fallback,
  };
}
export function computeOffset(sample: {
  sentAt: number;
  receivedAt: number;
  serverNowMs: number;
}) {
  const { sentAt, receivedAt, serverNowMs } = sample;
  if (![sentAt, receivedAt, serverNowMs].every(finite))
    return fail("invalid-sample");
  const rttMs = receivedAt - sentAt;
  if (rttMs < 0) return fail("reversed-sample");
  if (rttMs > 2000) return fail("poor-rtt");
  const offsetMs = serverNowMs - (sentAt + rttMs / 2);
  const referenceMs = serverNowMs + rttMs / 2;
  if (![offsetMs, referenceMs].every(finite)) return fail("invalid-sample");
  return { rttMs, offsetMs, uncertaintyMs: rttMs / 2, referenceMs };
}
export function progressFor(
  nowMs: number,
  startMs: number,
  endMs: number,
): number {
  if (![nowMs, startMs, endMs].every(finite) || endMs <= startMs)
    return fail("invalid-interval");
  if (nowMs <= startMs) return 0;
  if (nowMs >= endMs) return 1;
  const span = endMs - startMs;
  const fraction = finite(span)
    ? (nowMs - startMs) / span
    : (nowMs / 2 - startMs / 2) / (endMs / 2 - startMs / 2);
  if (!finite(fraction)) return fail("invalid-interval");
  return Math.max(0, Math.min(1, fraction));
}
export function phaseFor(input: {
  nowMs: number;
  startMs: number;
  endMs: number;
  thresholds: readonly number[];
  finished?: boolean;
}): {
  phase: Phase;
  node: NodeId | null;
  status: "waiting" | "running" | "finished";
} {
  const { nowMs, startMs, endMs, thresholds } = input;
  progressFor(nowMs, startMs, endMs);
  if (input.finished || nowMs >= endMs)
    return { phase: "finished", node: "end", status: "finished" };
  if (nowMs < startMs)
    return { phase: "normal", node: null, status: "waiting" };
  const applicable = THRESHOLDS.filter(
    (m) =>
      thresholds.includes(m) &&
      m * 60000 < endMs - startMs &&
      endMs - nowMs <= m * 60000,
  );
  const minute = applicable.at(-1);
  return {
    phase: minute ? (minute <= 5 ? "critical" : "warning") : "normal",
    node: minute ? (String(minute) as NodeId) : null,
    status: "running",
  };
}
export function formatRemaining(
  ms: number,
  options: {
    style?: "human";
    zero?: string;
    underMinute?: string;
    hours?: string;
    minutes?: string;
  } = {},
): string {
  if (!finite(ms)) return fail("invalid-time");
  const seconds = Math.max(0, Math.ceil(ms / 1000));
  if (options.style !== "human")
    return `${pad(Math.floor(seconds / 3600))}:${pad(Math.floor(seconds / 60) % 60)}:${pad(seconds % 60)}`;
  if (!seconds) return options.zero || "0 秒";
  if (ms < 60000) return options.underMinute || "不足 1 分钟";
  const minutes = Math.ceil(ms / 60000),
    h = Math.floor(minutes / 60),
    m = minutes % 60;
  return h
    ? `${h} ${options.hours || "小时"} ${pad(m)} ${options.minutes || "分"}`
    : `${m} ${options.minutes || "分"}`;
}
export type Anchor = { referenceMs: number; monoMs: number };
export function anchoredNow(anchor: Anchor, monoMs: number): number {
  if (
    ![anchor.referenceMs, anchor.monoMs, monoMs].every(finite) ||
    monoMs < anchor.monoMs
  )
    return fail("invalid-anchor");
  const result = anchor.referenceMs + (monoMs - anchor.monoMs);
  if (!finite(result)) return fail("invalid-anchor");
  return result;
}
export function detectJump(
  previous: { deviceMs: number; monoMs: number },
  current: { deviceMs: number; monoMs: number },
): number {
  if (
    ![
      previous.deviceMs,
      previous.monoMs,
      current.deviceMs,
      current.monoMs,
    ].every(finite)
  )
    return fail("invalid-anchor");
  const difference =
    current.deviceMs - previous.deviceMs - (current.monoMs - previous.monoMs);
  if (!finite(difference)) return fail("invalid-anchor");
  return Math.abs(difference) > 1000 ? difference : 0;
}
export type ActiveExam = {
  exam: Exam;
  thresholds: number[];
  processed: NodeId[];
  finished: boolean;
};
export function advanceExam(
  active: ActiveExam,
  nowMs: number,
  suppress: boolean,
) {
  const state = phaseFor({
    nowMs,
    ...active.exam,
    thresholds: active.thresholds,
    finished: active.finished,
  });
  const crossed: NodeId[] =
    nowMs < active.exam.startMs && !active.finished
      ? []
      : [
          ...THRESHOLDS.filter(
            (m) =>
              active.thresholds.includes(m) &&
              m * 60000 < active.exam.endMs - active.exam.startMs &&
              active.exam.endMs - nowMs <= m * 60000,
          ).map((m) => String(m) as NodeId),
          ...(state.phase === "finished" ? ["end" as const] : []),
        ];
  const newNodes = crossed.filter((n) => !active.processed.includes(n));
  const processed = Array.from(new Set([...active.processed, ...crossed]));
  return {
    ...state,
    active: { ...active, processed, finished: state.phase === "finished" },
    alert:
      !suppress && state.node && newNodes.includes(state.node)
        ? state.node
        : null,
    changed:
      newNodes.length > 0 || active.finished !== (state.phase === "finished"),
  };
}
export type Settings = {
  hour12: boolean;
  showSeconds: boolean;
  scale: 80 | 100 | 120 | 140;
  theme: "site" | "light" | "dark";
  contrast: boolean;
  sound: boolean;
  volume: number;
  thresholds: number[];
};
export type Draft = {
  name: string;
  start: string;
  end: string;
  mode: "end" | "duration";
  hours: string;
  minutes: string;
  seconds: string;
};
export type SyncHistory = {
  source: "cloudflare-trace";
  at: number;
  offsetMs: number;
  rttMs: number;
  uncertaintyMs: number;
};
export type Stored = {
  version: 1;
  settings: Settings;
  draft: Draft;
  presets: { id: number; exam: Exam; thresholds: number[] }[];
  nextId: number;
  active: ActiveExam | null;
  history: SyncHistory | null;
};
export function defaults(): Stored {
  return {
    version: 1,
    settings: {
      hour12: false,
      showSeconds: true,
      scale: 100,
      theme: "site",
      contrast: false,
      sound: false,
      volume: 25,
      thresholds: [...THRESHOLDS],
    },
    draft: {
      name: "",
      start: "",
      end: "",
      mode: "end",
      hours: "1",
      minutes: "30",
      seconds: "0",
    },
    presets: [],
    nextId: 1,
    active: null,
    history: null,
  };
}
const object = (v: unknown): v is Record<string, unknown> =>
  !!v && typeof v === "object" && !Array.isArray(v);
function thresholds(v: unknown): v is number[] {
  return (
    Array.isArray(v) &&
    v.length <= 4 &&
    v.every((m) => (THRESHOLDS as readonly unknown[]).includes(m)) &&
    new Set(v).size === v.length
  );
}
function examValue(v: unknown): Exam {
  if (!object(v)) return fail("invalid-storage");
  const result = validateExam(v as unknown as ExamInput);
  if (
    !result.ok ||
    result.value.startMs !== v.startMs ||
    result.value.endMs !== v.endMs ||
    result.value.totalSeconds !== v.totalSeconds
  )
    return fail("invalid-storage");
  return result.value;
}
/** Rebuild allowed fields only; never trust parsed JSON's asserted types. */
export function normalizeStorage(value: unknown): Stored {
  if (!object(value) || value.version !== 1) return fail("invalid-storage");
  const s = value.settings,
    d = value.draft;
  if (!object(s) || !object(d)) return fail("invalid-storage");
  for (const key of ["hour12", "showSeconds", "contrast", "sound"])
    if (typeof s[key] !== "boolean") return fail("invalid-storage");
  if (
    ![80, 100, 120, 140].includes(s.scale as number) ||
    !["site", "light", "dark"].includes(s.theme as string) ||
    !finite(s.volume) ||
    s.volume < 0 ||
    s.volume > 100 ||
    !thresholds(s.thresholds)
  )
    return fail("invalid-storage");
  for (const key of ["name", "start", "end", "hours", "minutes", "seconds"])
    if (typeof d[key] !== "string") return fail("invalid-storage");
  if (
    [...String(d.name).trim()].length > 80 ||
    /[\u0000-\u001f\u007f-\u009f]/u.test(d.name as string) ||
    !["end", "duration"].includes(d.mode as string)
  )
    return fail("invalid-storage");
  for (const key of ["start", "end"])
    if (d[key] !== "" && parseBeijing(d[key] as string) === null)
      return fail("invalid-storage");
  for (const key of ["hours", "minutes", "seconds"])
    if (
      !/^\d{0,2}$/.test(d[key] as string) ||
      Number(d[key]) > (key === "hours" ? 23 : 59)
    )
      return fail("invalid-storage");
  if (
    !Array.isArray(value.presets) ||
    value.presets.length > 10 ||
    !Number.isSafeInteger(value.nextId) ||
    (value.nextId as number) < 1
  )
    return fail("invalid-storage");
  const presets = value.presets.map((p: unknown) => {
    if (
      !object(p) ||
      !Number.isSafeInteger(p.id) ||
      (p.id as number) < 1 ||
      (p.id as number) >= (value.nextId as number) ||
      !thresholds(p.thresholds)
    )
      return fail("invalid-storage");
    return {
      id: p.id as number,
      exam: examValue(p.exam),
      thresholds: [...p.thresholds],
    };
  });
  if (new Set(presets.map((p) => p.id)).size !== presets.length)
    return fail("invalid-storage");
  let active: ActiveExam | null = null;
  if (value.active !== null) {
    const a = value.active;
    if (
      !object(a) ||
      !thresholds(a.thresholds) ||
      typeof a.finished !== "boolean" ||
      !Array.isArray(a.processed) ||
      a.processed.length > 5 ||
      a.processed.some(
        (n: unknown) => !["30", "15", "5", "1", "end"].includes(n as string),
      ) ||
      new Set(a.processed).size !== a.processed.length ||
      a.finished !== a.processed.includes("end")
    )
      return fail("invalid-storage");
    active = {
      exam: examValue(a.exam),
      thresholds: [...a.thresholds],
      processed: [...a.processed] as NodeId[],
      finished: a.finished,
    };
  }
  let history: SyncHistory | null = null;
  if (value.history !== null) {
    const h = value.history;
    if (
      !object(h) ||
      h.source !== "cloudflare-trace" ||
      ![h.at, h.offsetMs, h.rttMs, h.uncertaintyMs].every(finite) ||
      (h.at as number) < Date.UTC(2000, 0, 1) ||
      (h.at as number) >= Date.UTC(2100, 0, 1) ||
      (h.rttMs as number) < 0 ||
      (h.rttMs as number) > 2000 ||
      (h.uncertaintyMs as number) < 1000 ||
      (h.uncertaintyMs as number) > 10000 ||
      Math.abs(h.offsetMs as number) > 4e12
    )
      return fail("invalid-storage");
    history = {
      source: "cloudflare-trace",
      at: h.at as number,
      offsetMs: h.offsetMs as number,
      rttMs: h.rttMs as number,
      uncertaintyMs: h.uncertaintyMs as number,
    };
  }
  return {
    version: 1,
    settings: {
      hour12: s.hour12 as boolean,
      showSeconds: s.showSeconds as boolean,
      scale: s.scale as Settings["scale"],
      theme: s.theme as Settings["theme"],
      contrast: s.contrast as boolean,
      sound: s.sound as boolean,
      volume: s.volume,
      thresholds: [...s.thresholds],
    },
    draft: {
      name: (d.name as string).trim(),
      start: d.start as string,
      end: d.end as string,
      mode: d.mode as Draft["mode"],
      hours: d.hours as string,
      minutes: d.minutes as string,
      seconds: d.seconds as string,
    },
    presets,
    nextId: value.nextId as number,
    active,
    history,
  };
}
export function deserializeStorage(text: string): Stored {
  if (new TextEncoder().encode(text).byteLength > 65536)
    return fail("storage-too-large");
  let value: unknown;
  try {
    value = JSON.parse(text);
  } catch {
    return fail("invalid-storage");
  }
  return normalizeStorage(value);
}
export function serializeStorage(value: Stored): string {
  const text = JSON.stringify(normalizeStorage(value));
  if (new TextEncoder().encode(text).byteLength > 65536)
    return fail("storage-too-large");
  return text;
}
export type TimeResponse = {
  ok: true;
  source: "cloudflare-trace";
  sourceUrl: string;
  serverNowMs: number;
  sourceSampleMs: number;
  sampleAgeMs: number;
  upstreamRttMs: number;
  uncertaintyMs: number;
  cached: boolean;
};
export function validateTimeResponse(v: unknown): TimeResponse {
  if (
    !object(v) ||
    v.ok !== true ||
    v.source !== "cloudflare-trace" ||
    v.sourceUrl !== "https://www.cloudflare.com/cdn-cgi/trace" ||
    typeof v.cached !== "boolean" ||
    ![
      v.serverNowMs,
      v.sourceSampleMs,
      v.sampleAgeMs,
      v.upstreamRttMs,
      v.uncertaintyMs,
    ].every(finite)
  )
    return fail("invalid-response");
  const n = v as unknown as TimeResponse;
  if (
    n.sourceSampleMs < Date.UTC(2000, 0, 1) ||
    n.sourceSampleMs >= Date.UTC(2100, 0, 1) ||
    n.serverNowMs < Date.UTC(2000, 0, 1) ||
    n.serverNowMs >= Date.UTC(2100, 0, 1) ||
    n.sampleAgeMs < 0 ||
    n.sampleAgeMs >= 15000 ||
    n.upstreamRttMs < 0 ||
    n.upstreamRttMs > 3000 ||
    n.uncertaintyMs < 1000 + n.upstreamRttMs / 2 + n.sampleAgeMs * 0.0001 ||
    n.uncertaintyMs > 5000 ||
    Math.abs(
      n.serverNowMs - (n.sourceSampleMs + n.upstreamRttMs / 2 + n.sampleAgeMs),
    ) > 5
  )
    return fail("invalid-response");
  return n;
}
