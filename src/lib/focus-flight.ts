import { greatCircle } from "./flight-experience.ts";
import { FLIGHT_AIRPORTS } from "./flight-airports.ts";
export const FLIGHT_ROUTES = [
  // OurAirports public-domain airport coordinates, verified 2026-10-05.
  {
    id: "shanghai-tokyo",
    from: "PVG",
    to: "HND",
    minutes: 25,
    origin: [121.805, 31.1434],
    destination: [139.786958, 35.549678],
  },
  {
    id: "beijing-seoul",
    from: "PEK",
    to: "ICN",
    minutes: 35,
    origin: [116.596702, 40.077349],
    destination: [126.450996, 37.469101],
  },
  {
    id: "taipei-hongkong",
    from: "TPE",
    to: "HKG",
    minutes: 45,
    origin: [121.233002, 25.0777],
    destination: [113.914862, 22.31184],
  },
  {
    id: "hongkong-singapore",
    from: "HKG",
    to: "SIN",
    minutes: 60,
    origin: [113.914862, 22.31184],
    destination: [103.994003, 1.35019],
  },
  {
    id: "chengdu-bangkok",
    from: "TFU",
    to: "BKK",
    minutes: 90,
    origin: [104.441284, 30.31252],
    destination: [100.747002, 13.6811],
  },
  {
    id: "tokyo-sapporo",
    from: "HND",
    to: "CTS",
    minutes: 120,
    origin: [139.786958, 35.549678],
    destination: [141.690414, 42.774753],
  },
] as const;
export const ROUTE_CITIES = [
  [0, 1],
  [2, 3],
  [4, 5],
  [5, 6],
  [7, 8],
  [1, 9],
] as const;

export type FlightState = "flying" | "paused" | "landed";
export interface FlightSession {
  version: 1;
  id: string;
  routeId: string;
  task: string;
  durationMs: number;
  remainingMs: number;
  deadline: number | null;
  startedAt: number;
  completedAt: number | null;
  state: FlightState;
}
export interface FlightRecord {
  id: string;
  routeId: string;
  task: string;
  durationMs: number;
  startedAt: number;
  completedAt: number;
}
export const FLIGHT_STORAGE = {
  active: "clover:focus-flight:active:v1",
  history: "clover:focus-flight:history:v1",
};
export const HISTORY_LIMIT = 20;
export function flightRoute(id: string) {
  const preset = FLIGHT_ROUTES.find((route) => route.id === id);
  if (preset) return preset;
  if (!/^airport:[A-Z]{3}-[A-Z]{3}$/.test(id)) return null;
  const [from, to] = id.slice(8).split("-");
  const origin = FLIGHT_AIRPORTS.find((a) => a.code === from);
  const destination = FLIGHT_AIRPORTS.find((a) => a.code === to);
  return origin && destination && from !== to
    ? {
        id,
        from,
        to,
        minutes: 25,
        origin: origin.at,
        destination: destination.at,
      }
    : null;
}
function validTime(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isSafeInteger(value) &&
    value > 0 &&
    value < 8.64e15
  );
}
function validDuration(value: unknown): value is number {
  return (
    typeof value === "number" &&
    Number.isInteger(value) &&
    value >= 60_000 &&
    value <= 180 * 60_000 &&
    value % 60_000 === 0
  );
}
function validBase(value: Record<string, unknown>): boolean {
  return (
    typeof value.id === "string" &&
    /^[a-zA-Z0-9-]{1,80}$/.test(value.id) &&
    typeof value.routeId === "string" &&
    !!flightRoute(value.routeId) &&
    typeof value.task === "string" &&
    value.task.length <= 80 &&
    validDuration(value.durationMs) &&
    validTime(value.startedAt)
  );
}
export function createFlight(
  id: string,
  routeId: string,
  task: string,
  minutes: number,
  now: number,
): FlightSession {
  const base = {
    id,
    routeId,
    task: task.trim(),
    durationMs: minutes * 60_000,
    startedAt: now,
  };
  if (!validBase(base)) throw new RangeError("flight");
  return {
    ...base,
    version: 1,
    remainingMs: base.durationMs,
    deadline: now + base.durationMs,
    completedAt: null,
    state: "flying",
  };
}
/** A deadline, rather than a tick count, keeps background callbacks and reloads accurate. */
export function advanceFlight(
  flight: FlightSession,
  now: number,
): FlightSession {
  if (flight.state !== "flying" || flight.deadline === null) return flight;
  const remainingMs = Math.max(
    0,
    Math.min(flight.durationMs, flight.deadline - now),
  );
  return remainingMs === 0
    ? {
        ...flight,
        remainingMs: 0,
        completedAt: flight.deadline,
        deadline: null,
        state: "landed",
      }
    : { ...flight, remainingMs };
}
export function pauseFlight(flight: FlightSession, now: number): FlightSession {
  const current = advanceFlight(flight, now);
  return current.state === "flying"
    ? { ...current, state: "paused", deadline: null }
    : current;
}
export function resumeFlight(
  flight: FlightSession,
  now: number,
): FlightSession {
  return flight.state === "paused"
    ? { ...flight, state: "flying", deadline: now + flight.remainingMs }
    : flight;
}
export function parseFlight(
  raw: string | null,
  now: number,
): FlightSession | null {
  try {
    if (!raw || raw.length > 4096) return null;
    const value = JSON.parse(raw);
    if (
      !value ||
      typeof value !== "object" ||
      !validBase(value) ||
      value.version !== 1 ||
      !["flying", "paused", "landed"].includes(value.state) ||
      !Number.isInteger(value.remainingMs) ||
      value.remainingMs < 0 ||
      value.remainingMs > value.durationMs
    )
      return null;
    if (
      value.state === "flying" &&
      (!validTime(value.deadline) ||
        value.deadline < value.startedAt + value.durationMs ||
        value.deadline > now + value.durationMs ||
        value.completedAt !== null)
    )
      return null;
    if (
      value.state === "paused" &&
      (value.deadline !== null ||
        value.remainingMs === 0 ||
        value.completedAt !== null)
    )
      return null;
    if (
      value.state === "landed" &&
      (value.deadline !== null ||
        value.remainingMs !== 0 ||
        !validTime(value.completedAt) ||
        value.completedAt < value.startedAt + value.durationMs)
    )
      return null;
    return advanceFlight(
      {
        version: 1,
        id: value.id,
        routeId: value.routeId,
        task: value.task,
        durationMs: value.durationMs,
        remainingMs: value.remainingMs,
        deadline: value.deadline,
        startedAt: value.startedAt,
        completedAt: value.completedAt,
        state: value.state,
      },
      now,
    );
  } catch {
    return null;
  }
}
export function flightRecord(flight: FlightSession): FlightRecord | null {
  if (flight.state !== "landed" || flight.completedAt === null) return null;
  const { id, routeId, task, durationMs, startedAt, completedAt } = flight;
  return { id, routeId, task, durationMs, startedAt, completedAt };
}
export function parseFlightHistory(raw: string | null): FlightRecord[] {
  try {
    if (!raw || raw.length > 50_000) return [];
    const values = JSON.parse(raw);
    if (!Array.isArray(values)) return [];
    const ids = new Set<string>();
    return values
      .filter((v): v is FlightRecord => {
        if (
          !v ||
          typeof v !== "object" ||
          !validBase(v) ||
          !validTime(v.completedAt) ||
          v.completedAt < v.startedAt + v.durationMs ||
          ids.has(v.id)
        )
          return false;
        ids.add(v.id);
        return true;
      })
      .map(({ id, routeId, task, durationMs, startedAt, completedAt }) => ({
        id,
        routeId,
        task,
        durationMs,
        startedAt,
        completedAt,
      }))
      .sort((a, b) => b.completedAt - a.completedAt)
      .slice(0, HISTORY_LIMIT);
  } catch {
    return [];
  }
}
export function addFlightRecord(
  history: FlightRecord[],
  record: FlightRecord,
): FlightRecord[] {
  return parseFlightHistory(JSON.stringify([record, ...history]));
}
/** Uniform-scale Mercator, identical to prepare-flight-geography.py. */
export function mapPoint(coords: readonly number[]): [number, number] {
  const scale = 800 / ((70 * Math.PI) / 180);
  const mercator = (lat: number) =>
    Math.log(Math.tan(Math.PI / 4 + (lat * Math.PI) / 360));
  return [
    (((coords[0] - 80) * Math.PI) / 180) * scale,
    (mercator(60) - mercator(coords[1])) * scale,
  ];
}
export function routeGeometry(routeId: string, progress = 0) {
  const route = flightRoute(routeId);
  if (!route) throw new RangeError("route");
  const from = mapPoint(route.origin),
    to = mapPoint(route.destination);
  const p = Number.isFinite(progress) ? Math.min(1, Math.max(0, progress)) : 0;
  const [x, y] = mapPoint(greatCircle(route.origin, route.destination, p));
  const before = mapPoint(
    greatCircle(route.origin, route.destination, Math.max(0, p - 0.001)),
  );
  const after = mapPoint(
    greatCircle(route.origin, route.destination, Math.min(1, p + 0.001)),
  );
  const angle =
    (Math.atan2(after[1] - before[1], after[0] - before[0]) * 180) / Math.PI;
  const path = Array.from(
    { length: 65 },
    (_, i) =>
      `${i ? "L" : "M"} ${mapPoint(
        greatCircle(route.origin, route.destination, i / 64),
      )
        .map((v) => v.toFixed(3))
        .join(" ")}`,
  ).join(" ");
  return { from, to, path, x, y, angle };
}
