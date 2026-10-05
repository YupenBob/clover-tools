/** Pure geography and experience timing; independent of DOM, audio and rendering. */
export type FlightMood = "day" | "dusk" | "night";
export type FlightPhase =
  "lounge" | "takeoff" | "cruise" | "descent" | "arrived";
export const clamp = (n: number, min = 0, max = 1) =>
  Math.min(max, Math.max(min, Number.isFinite(n) ? n : min));
const radians = Math.PI / 180;
export function globePoint(
  coords: readonly number[],
  radius = 1,
): [number, number, number] {
  const [longitude, latitude] = coords;
  if (
    ![longitude, latitude, radius].every(Number.isFinite) ||
    Math.abs(latitude) > 90 ||
    radius <= 0
  )
    throw new RangeError("coordinates");
  const lon = longitude * radians,
    lat = latitude * radians;
  return [
    radius * Math.cos(lat) * Math.cos(lon),
    radius * Math.sin(lat),
    -radius * Math.cos(lat) * Math.sin(lon),
  ];
}
export function greatCircle(
  from: readonly number[],
  to: readonly number[],
  progress: number,
): [number, number] {
  const p = clamp(progress);
  if (p === 0) {
    globePoint(from);
    return [from[0], from[1]];
  }
  if (p === 1) {
    globePoint(to);
    return [to[0], to[1]];
  }
  const a = globePoint(from),
    b = globePoint(to);
  const dot = clamp(
    a.reduce((n, v, i) => n + v * b[i], 0),
    -1,
    1,
  );
  const angle = Math.acos(dot);
  let v: number[];
  if (angle < 1e-7) v = a;
  else if (Math.PI - angle < 1e-7) {
    const axis = Math.abs(a[1]) < 0.9 ? [0, 1, 0] : [1, 0, 0];
    const cross = [
      axis[1] * a[2] - axis[2] * a[1],
      axis[2] * a[0] - axis[0] * a[2],
      axis[0] * a[1] - axis[1] * a[0],
    ];
    const length = Math.hypot(...cross);
    v = a.map(
      (n, i) =>
        n * Math.cos(Math.PI * p) + (cross[i] / length) * Math.sin(Math.PI * p),
    );
  } else {
    const l = Math.sin((1 - p) * angle) / Math.sin(angle),
      r = Math.sin(p * angle) / Math.sin(angle);
    v = a.map((n, i) => n * l + b[i] * r);
  }
  return [
    Math.atan2(-v[2], v[0]) / radians,
    Math.asin(clamp(v[1], -1, 1)) / radians,
  ];
}
export function flightDistance(
  from: readonly number[],
  to: readonly number[],
): number {
  const a = globePoint(from),
    b = globePoint(to);
  return (
    6371 *
    Math.acos(
      clamp(
        a.reduce((n, v, i) => n + v * b[i], 0),
        -1,
        1,
      ),
    )
  );
}
export function flightPhase(
  durationMs: number,
  remainingMs: number,
): FlightPhase {
  if (!Number.isFinite(durationMs) || durationMs <= 0) return "lounge";
  if (remainingMs <= 0) return "arrived";
  const elapsed = durationMs - remainingMs;
  if (elapsed < Math.min(6000, durationMs * 0.08)) return "takeoff";
  if (remainingMs <= Math.min(45000, durationMs * 0.06)) return "descent";
  return "cruise";
}
export const tearProgress = (distance: number, threshold: number) =>
  clamp(distance / Math.max(1, threshold));
