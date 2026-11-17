/** Pure focus clock. Callers supply every time sample and identifier. */
export const STORAGE_KEY = "clover-focus-timer:v1";
export const TASK_LIMIT = 100;
export const RECORD_LIMIT = 2000;
export type Phase = "focus" | "short" | "long";
export type Status = "idle" | "running" | "paused" | "break" | "finished";
export interface Settings {
  focus: number;
  short: number;
  long: number;
  interval: number;
  auto: boolean;
  sound: boolean;
  environment: "white" | "rain" | "cafe";
  volume: number;
  muted: boolean;
  notifications: boolean;
  wake: boolean;
}
export interface Task {
  id: string;
  name: string;
  createdAt: number;
  completedAt: number | null;
}
export interface Allocation {
  date: string;
  ms: number;
  timeZone: string;
}
export interface Anchor {
  mono: number;
  wall: number;
  timeZone: string;
}
export interface Stage {
  id: string;
  sessionId: string;
  phase: Phase;
  durationMs: number;
  remainingMs: number;
  focusMs: number;
  taskId: string | null;
  taskName: string | null;
  startedAt: number;
  lastAt: number;
  lastZone: string;
  allocations: Allocation[];
  anchor: Anchor | null;
}
export interface FocusRecord {
  sessionId: string;
  taskId: string | null;
  taskName: string | null;
  startedAt: number;
  endedAt: number;
  endDate: string;
  timeZone: string;
  actualMs: number;
  configuredMs: number;
  method: "complete" | "early";
  allocations: Allocation[];
}
export interface Snapshot {
  schemaVersion: 1;
  revision: number;
  settings: Settings;
  tasks: Task[];
  selectedTaskId: string | null;
  cycle: number;
  status: Status;
  stage: Stage | null;
  nextPhase: Phase;
  records: FocusRecord[];
}
export type Effect = {
  type: "ended";
  id: string;
  phase: Phase;
  method: "complete" | "early" | "skip";
};
export interface Sample extends Anchor {
  id?: string;
  sessionId?: string;
}
export type Action = "tick" | "start" | "pause" | "early" | "skip" | "reset";
export const defaults = (): Snapshot => ({
  schemaVersion: 1,
  revision: 0,
  settings: {
    focus: 25,
    short: 5,
    long: 15,
    interval: 4,
    auto: false,
    sound: false,
    environment: "white",
    volume: 30,
    muted: false,
    notifications: false,
    wake: false,
  },
  tasks: [],
  selectedTaskId: null,
  cycle: 0,
  status: "idle",
  stage: null,
  nextPhase: "focus",
  records: [],
});
export function validateDuration(
  raw: string,
  field: "focus" | "short" | "long" | "interval",
) {
  const limits = {
    focus: [1, 180],
    short: [1, 30],
    long: [1, 60],
    interval: [2, 8],
  }[field];
  if (!raw.trim()) return { ok: false as const, error: "required" as const };
  if (!/^\d+$/.test(raw.trim()))
    return { ok: false as const, error: "integer" as const };
  const value = Number(raw);
  if (!Number.isSafeInteger(value) || value < limits[0] || value > limits[1])
    return { ok: false as const, error: "range" as const };
  return { ok: true as const, value };
}
export function validateTask(raw: string) {
  // Inspect before trimming, so a newline/control at either edge is still rejected.
  if (/[\p{Cc}\p{Zl}\p{Zp}]/u.test(raw))
    return { ok: false as const, error: "taskControl" as const };
  const value = raw.trim().normalize("NFC");
  if (!value) return { ok: false as const, error: "taskEmpty" as const };
  if ([...value].length > 80)
    return { ok: false as const, error: "taskLong" as const };
  return { ok: true as const, value };
}
const dateFormatters = new Map<string, Intl.DateTimeFormat>();
export function dateKey(ms: number, timeZone: string): string {
  let fmt = dateFormatters.get(timeZone);
  if (!fmt) {
    fmt = new Intl.DateTimeFormat("en-CA", {
      timeZone,
      year: "numeric",
      month: "2-digit",
      day: "2-digit",
    });
    dateFormatters.set(timeZone, fmt);
  }
  const p = Object.fromEntries(
    fmt.formatToParts(ms).map((x) => [x.type, x.value]),
  );
  return `${p.year}-${p.month}-${p.day}`;
}
export function addDays(date: string, days: number): string {
  const d = new Date(`${date}T12:00:00Z`);
  d.setUTCDate(d.getUTCDate() + days);
  return d.toISOString().slice(0, 10);
}
export function weekDates(today: string): string[] {
  const weekday = new Date(`${today}T12:00:00Z`).getUTCDay();
  const start = addDays(today, -(weekday + 6) % 7);
  return Array.from({ length: 7 }, (_, i) => addDays(start, i));
}
/** Find actual local midnight by searching UTC, including 23/25-hour days. */
export function splitByDate(
  start: number,
  ms: number,
  timeZone: string,
): Allocation[] {
  if (
    !Number.isSafeInteger(start) ||
    !Number.isSafeInteger(ms) ||
    ms < 0 ||
    ms > 31 * 86400000
  )
    throw new Error("invalid-segment");
  const result: Allocation[] = [];
  const end = start + ms;
  let cursor = start;
  while (cursor < end) {
    const date = dateKey(cursor, timeZone);
    let boundary = end;
    if (dateKey(end - 1, timeZone) !== date) {
      let lo = cursor,
        hi = Math.min(end, cursor + 48 * 3600000);
      while (hi - lo > 1) {
        const mid = Math.floor((lo + hi) / 2);
        if (dateKey(mid, timeZone) === date) lo = mid;
        else hi = mid;
      }
      boundary = hi;
    }
    result.push({ date, ms: boundary - cursor, timeZone });
    cursor = boundary;
  }
  return result;
}
function mergeAllocations(a: Allocation[], b: Allocation[]) {
  const result = a.map((x) => ({ ...x }));
  for (const row of b) {
    const old = result.find(
      (x) => x.date === row.date && x.timeZone === row.timeZone,
    );
    if (old) old.ms += row.ms;
    else result.push({ ...row });
  }
  return result;
}
export function commitRecord(
  records: FocusRecord[],
  record: FocusRecord,
): FocusRecord[] {
  if (records.some((r) => r.sessionId === record.sessionId)) return records;
  if (records.length >= RECORD_LIMIT) throw new Error("record-capacity");
  return [...records, record];
}
export const isActive = (s: Snapshot) =>
  ["running", "break", "paused"].includes(s.status);
export const isRunning = (s: Snapshot) =>
  s.status === "running" || s.status === "break";
function finish(
  s: Snapshot,
  method: "complete" | "early" | "skip",
  end: number,
  timeZone: string,
): { state: Snapshot; effects: Effect[] } {
  const stage = s.stage!;
  let cycle = s.cycle;
  let records = s.records;
  let nextPhase: Phase = "focus";
  if (stage.phase === "focus") {
    if (method !== "skip")
      records = commitRecord(records, {
        sessionId: stage.sessionId,
        taskId: stage.taskId,
        taskName: stage.taskName,
        startedAt: stage.startedAt,
        endedAt: end,
        endDate: dateKey(end, timeZone),
        timeZone,
        actualMs: stage.focusMs,
        configuredMs: stage.durationMs,
        method,
        allocations: stage.allocations,
      });
    if (method === "complete") {
      cycle += 1;
      nextPhase = cycle >= s.settings.interval ? "long" : "short";
    }
    if (method === "skip") nextPhase = "short";
  } else if (stage.phase === "long") cycle = 0;
  return {
    state: {
      ...s,
      cycle,
      records,
      nextPhase,
      status: "finished",
      stage: { ...stage, anchor: null },
    },
    effects: [{ type: "ended", id: stage.id, phase: stage.phase, method }],
  };
}
export function advance(
  state: Snapshot,
  sample: Sample,
): { state: Snapshot; effects: Effect[] } {
  const stage = state.stage;
  if (!isRunning(state) || !stage?.anchor) return { state, effects: [] };
  if (!Number.isFinite(sample.mono)) throw new Error("invalid-sample");
  const delta = Math.min(
    stage.remainingMs,
    Math.max(0, Math.floor(sample.mono - stage.anchor.mono)),
  );
  if (!delta) return { state, effects: [] };
  const end = stage.anchor.wall + delta;
  const next: Stage = {
    ...stage,
    remainingMs: stage.remainingMs - delta,
    lastAt: end,
    lastZone: stage.anchor.timeZone,
    focusMs: stage.focusMs + (stage.phase === "focus" ? delta : 0),
    allocations:
      stage.phase === "focus"
        ? mergeAllocations(
            stage.allocations,
            splitByDate(stage.anchor.wall, delta, stage.anchor.timeZone),
          )
        : [],
    anchor: { ...stage.anchor, mono: stage.anchor.mono + delta, wall: end },
  };
  const s = { ...state, stage: next };
  return next.remainingMs === 0
    ? finish(s, "complete", end, stage.anchor.timeZone)
    : { state: s, effects: [] };
}
export function transition(
  state: Snapshot,
  action: Action,
  sample: Sample,
): { state: Snapshot; effects: Effect[] } {
  if (
    !Number.isFinite(sample.mono) ||
    sample.mono < 0 ||
    !Number.isSafeInteger(sample.wall) ||
    Math.abs(sample.wall) > 8640000000000000
  )
    throw new Error("invalid-sample");
  dateKey(sample.wall, sample.timeZone);
  const advanced = advance(state, sample);
  let s = advanced.state;
  // An action coincident with expiry cannot undo or reclassify completion.
  if (advanced.effects.length || action === "tick") return advanced;
  if (action === "pause" && isRunning(s))
    return {
      state: {
        ...s,
        status: "paused",
        stage: {
          ...s.stage!,
          lastAt: s.stage!.anchor!.wall,
          lastZone: s.stage!.anchor!.timeZone,
          anchor: null,
        },
      },
      effects: [],
    };
  if (action === "start") {
    if (s.status === "paused")
      return {
        state: {
          ...s,
          status: s.stage!.phase === "focus" ? "running" : "break",
          stage: {
            ...s.stage!,
            anchor: {
              mono: sample.mono,
              wall: sample.wall,
              timeZone: sample.timeZone,
            },
          },
        },
        effects: [],
      };
    if (isActive(s)) return { state: s, effects: [] };
    const phase = s.status === "idle" ? "focus" : s.nextPhase;
    if (phase === "focus" && s.records.length >= RECORD_LIMIT)
      return { state: s, effects: [] };
    if (!sample.id || !sample.sessionId) throw new Error("missing-id");
    const task = s.tasks.find(
      (t) => t.id === s.selectedTaskId && t.completedAt === null,
    );
    const durationMs = s.settings[phase] * 60000;
    s = {
      ...s,
      status: phase === "focus" ? "running" : "break",
      stage: {
        id: sample.id,
        sessionId: sample.sessionId,
        phase,
        durationMs,
        remainingMs: durationMs,
        focusMs: 0,
        taskId: phase === "focus" ? (task?.id ?? null) : null,
        taskName: phase === "focus" ? (task?.name ?? null) : null,
        startedAt: sample.wall,
        lastAt: sample.wall,
        lastZone: sample.timeZone,
        allocations: [],
        anchor: {
          mono: sample.mono,
          wall: sample.wall,
          timeZone: sample.timeZone,
        },
      },
    };
  } else if (action === "early" && isActive(s) && s.stage?.phase === "focus") {
    return finish(
      s,
      "early",
      s.stage.anchor?.wall ?? s.stage.lastAt,
      s.stage.anchor?.timeZone ?? s.stage.lastZone,
    );
  } else if (action === "skip" && s.status !== "idle") {
    if (s.status === "finished") {
      if (s.nextPhase !== "focus")
        s = {
          ...s,
          cycle: s.nextPhase === "long" ? 0 : s.cycle,
          nextPhase: "focus",
        };
    } else
      return finish(
        s,
        "skip",
        s.stage?.anchor?.wall ?? sample.wall,
        sample.timeZone,
      );
  } else if (action === "reset")
    s = { ...s, status: "idle", stage: null, nextPhase: "focus", cycle: 0 };
  return { state: s, effects: [] };
}
export interface Aggregate {
  totalMs: number;
  completed: number;
  days: { date: string; ms: number; completed: number }[];
  tasks: {
    id: string | null;
    name: string | null;
    ms: number;
    completed: number;
    deleted: boolean;
  }[];
  records: FocusRecord[];
}
export function aggregate(
  records: FocusRecord[],
  dates: string[],
  tasks: Task[] = [],
): Aggregate {
  const days = dates.map((date) => ({ date, ms: 0, completed: 0 }));
  const byTask = new Map<string | null, Aggregate["tasks"][number]>();
  const included: FocusRecord[] = [];
  for (const r of records) {
    let ms = 0;
    for (const a of r.allocations) {
      const d = days.find((x) => x.date === a.date);
      if (d) {
        d.ms += a.ms;
        ms += a.ms;
      }
    }
    const finishDay = days.find((x) => x.date === r.endDate);
    const completed = r.method === "complete" && finishDay ? 1 : 0;
    if (completed) finishDay!.completed++;
    if (!ms && !completed && !finishDay) continue;
    included.push(r);
    let task = byTask.get(r.taskId);
    if (!task) {
      task = {
        id: r.taskId,
        name: r.taskName,
        ms: 0,
        completed: 0,
        deleted: r.taskId !== null && !tasks.some((t) => t.id === r.taskId),
      };
      byTask.set(r.taskId, task);
    }
    task.ms += ms;
    task.completed += completed;
  }
  return {
    totalMs: days.reduce((n, d) => n + d.ms, 0),
    completed: days.reduce((n, d) => n + d.completed, 0),
    days,
    tasks: [...byTask.values()].sort((a, b) => b.ms - a.ms),
    records: included,
  };
}
export function checkpoint(s: Snapshot): Snapshot {
  return { ...s, stage: s.stage ? { ...s.stage, anchor: null } : null };
}
export const serialize = (s: Snapshot) => JSON.stringify(checkpoint(s));
export const acceptRevision = (current: number, incoming: number) =>
  incoming > current;

/** Fail closed: never return defaults for invalid or unknown stored data. */
export function restore(
  raw: string,
): { ok: true; value: Snapshot } | { ok: false; error: "corrupt" | "version" } {
  try {
    if (raw.length > 16000000) throw new Error("oversize");
    const x = JSON.parse(raw);
    if (!x || typeof x !== "object") throw 0;
    if (x.schemaVersion !== 1) return { ok: false, error: "version" };
    const fail = () => {
      throw new Error("invalid");
    };
    const int = (n: unknown, min = 0, max = Number.MAX_SAFE_INTEGER) =>
      typeof n === "number" && Number.isSafeInteger(n) && n >= min && n <= max;
    const timestamp = (n: unknown) => int(n, 0, 8640000000000000);
    const id = (n: unknown) =>
      typeof n === "string" && /^[A-Za-z0-9_-]{1,100}$/.test(n);
    const zone = (n: unknown) => {
      if (typeof n !== "string") return false;
      try {
        dateKey(0, n);
        return true;
      } catch {
        return false;
      }
    };
    const date = (n: unknown) =>
      typeof n === "string" &&
      /^\d{4}-\d{2}-\d{2}$/.test(n) &&
      Number.isFinite(Date.parse(n)) &&
      new Date(n).toISOString().slice(0, 10) === n;
    const name = (n: unknown) =>
      typeof n === "string" &&
      validateTask(n).ok &&
      validateTask(n).value === n;
    const link = (n: any) =>
      (n.taskId === null && n.taskName === null) ||
      (id(n.taskId) && name(n.taskName));
    const allocations = (v: any, total: number) =>
      Array.isArray(v) &&
      v.length <= 10000 &&
      v.every(
        (a) => a && date(a.date) && int(a.ms, 1, 10800000) && zone(a.timeZone),
      ) &&
      v.reduce((n, a) => n + a.ms, 0) === total &&
      new Set(v.map((a) => `${a.date}|${a.timeZone}`)).size === v.length;
    if (
      !int(x.revision) ||
      !Array.isArray(x.tasks) ||
      x.tasks.length > TASK_LIMIT ||
      !Array.isArray(x.records) ||
      x.records.length > RECORD_LIMIT
    )
      fail();
    const settings = { ...defaults().settings, ...x.settings };
    if (
      !x.settings ||
      ["focus", "short", "long", "interval"].some(
        (k) =>
          typeof x.settings[k] !== "number" ||
          !validateDuration(String(settings[k]), k as "focus").ok,
      )
    )
      fail();
    if (
      ["auto", "sound", "muted", "notifications", "wake"].some(
        (k) => typeof settings[k] !== "boolean",
      ) ||
      !["white", "rain", "cafe"].includes(settings.environment) ||
      !int(settings.volume, 0, 100)
    )
      fail();
    if (
      !x.tasks.every(
        (t: any) =>
          t &&
          id(t.id) &&
          name(t.name) &&
          timestamp(t.createdAt) &&
          (t.completedAt === null || timestamp(t.completedAt)),
      ) ||
      new Set(x.tasks.map((t: any) => t.id)).size !== x.tasks.length
    )
      fail();
    if (
      x.selectedTaskId !== null &&
      !x.tasks.some(
        (t: any) => t.id === x.selectedTaskId && t.completedAt === null,
      )
    )
      fail();
    if (
      !int(x.cycle, 0, 8) ||
      !["idle", "running", "paused", "break", "finished"].includes(x.status) ||
      !["focus", "short", "long"].includes(x.nextPhase ?? "focus")
    )
      fail();
    if (
      !x.records.every(
        (r: any) =>
          r &&
          id(r.sessionId) &&
          link(r) &&
          timestamp(r.startedAt) &&
          timestamp(r.endedAt) &&
          date(r.endDate) &&
          zone(r.timeZone) &&
          int(r.configuredMs, 60000, 10800000) &&
          r.configuredMs % 60000 === 0 &&
          int(r.actualMs, 0, r.configuredMs) &&
          ["complete", "early"].includes(r.method) &&
          (r.method !== "complete" || r.actualMs === r.configuredMs) &&
          allocations(r.allocations, r.actualMs),
      ) ||
      new Set(x.records.map((r: any) => r.sessionId)).size !== x.records.length
    )
      fail();
    const st = x.stage;
    if (x.status === "idle") {
      if (st !== null) fail();
    } else {
      if (
        !st ||
        !id(st.id) ||
        !id(st.sessionId) ||
        !["focus", "short", "long"].includes(st.phase) ||
        !int(
          st.durationMs,
          60000,
          (st.phase === "focus" ? 180 : st.phase === "short" ? 30 : 60) * 60000,
        ) ||
        st.durationMs % 60000 ||
        !int(st.remainingMs, 0, st.durationMs) ||
        !int(st.focusMs, 0, st.durationMs) ||
        !timestamp(st.startedAt) ||
        !link(st) ||
        !allocations(st.allocations, st.focusMs)
      )
        fail();
      if (
        !timestamp(st.lastAt ?? st.startedAt) ||
        !zone(st.lastZone ?? st.allocations.at(-1)?.timeZone ?? "UTC") ||
        (st.anchor !== null && st.anchor !== undefined)
      )
        fail();
      if (
        st.phase === "focus"
          ? st.focusMs !== st.durationMs - st.remainingMs
          : st.focusMs !== 0 || st.taskId !== null
      )
        fail();
      if (
        (x.status === "running" && st.phase !== "focus") ||
        (x.status === "break" && st.phase === "focus") ||
        (x.status !== "finished" && st.remainingMs === 0)
      )
        fail();
      if (isActive(x) && st.durationMs !== settings[st.phase] * 60000) fail();
      if (
        isActive(x) &&
        st.phase === "focus" &&
        x.records.length >= RECORD_LIMIT
      )
        fail();
      if (
        isActive(x) &&
        (x.records.some((r: any) => r.sessionId === st.sessionId) ||
          (st.taskId !== null &&
            !x.tasks.some(
              (t: any) =>
                t.id === st.taskId &&
                t.name === st.taskName &&
                t.completedAt === null,
            )))
      )
        fail();
    }
    const cleanAllocations = (rows: Allocation[]): Allocation[] =>
      rows.map(({ date, ms, timeZone }) => ({ date, ms, timeZone }));
    const cleanSettings = Object.fromEntries(
      Object.keys(defaults().settings).map((key) => [key, settings[key]]),
    ) as unknown as Settings;
    return {
      ok: true,
      value: {
        schemaVersion: 1,
        revision: x.revision,
        tasks: x.tasks.map(({ id, name, createdAt, completedAt }: Task) => ({
          id,
          name,
          createdAt,
          completedAt,
        })),
        selectedTaskId: x.selectedTaskId,
        cycle: x.cycle,
        records: x.records.map((r: FocusRecord) => ({
          sessionId: r.sessionId,
          taskId: r.taskId,
          taskName: r.taskName,
          startedAt: r.startedAt,
          endedAt: r.endedAt,
          endDate: r.endDate,
          timeZone: r.timeZone,
          actualMs: r.actualMs,
          configuredMs: r.configuredMs,
          method: r.method,
          allocations: cleanAllocations(r.allocations),
        })),
        settings: cleanSettings,
        nextPhase: x.nextPhase ?? "focus",
        status: isRunning(x) ? "paused" : x.status,
        stage: st
          ? {
              id: st.id,
              sessionId: st.sessionId,
              phase: st.phase,
              durationMs: st.durationMs,
              remainingMs: st.remainingMs,
              focusMs: st.focusMs,
              taskId: st.taskId,
              taskName: st.taskName,
              startedAt: st.startedAt,
              allocations: cleanAllocations(st.allocations),
              lastAt: st.lastAt ?? st.startedAt + st.focusMs,
              lastZone: st.lastZone ?? st.allocations.at(-1)?.timeZone ?? "UTC",
              anchor: null,
            }
          : null,
      },
    };
  } catch {
    return { ok: false, error: "corrupt" };
  }
}
