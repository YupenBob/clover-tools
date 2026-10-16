const UINT32_RANGE = 0x1_0000_0000;

/** Uniform sampling: reject the incomplete tail instead of using biased modulo. */
export function randomBelow(
  range: number,
  next = () => crypto.getRandomValues(new Uint32Array(1))[0],
): number {
  if (!Number.isSafeInteger(range) || range < 1 || range > UINT32_RANGE)
    throw new RangeError("Invalid random range");
  const limit = Math.floor(UINT32_RANGE / range) * range;
  let value: number;
  do {
    value = next();
  } while (value >= limit);
  return value % range;
}

export function generateRandomIntegers(
  min: number,
  max: number,
  count: number,
  unique: boolean,
): number[] {
  const range = max - min + 1;
  if (
    ![min, max, count].every(Number.isSafeInteger) ||
    range < 1 ||
    range > UINT32_RANGE ||
    count < 1 ||
    count > 1000 ||
    (unique && count > range)
  ) {
    throw new RangeError(
      "Use safe integer bounds, a range of 1–4294967296 values and a count of 1–1000. Unique results must fit in the range.",
    );
  }
  if (!unique)
    return Array.from({ length: count }, () => min + randomBelow(range));
  // Floyd sampling performs exactly count draws, including near-full ranges.
  const selected = new Set<number>();
  for (let j = range - count; j < range; j++) {
    const value = randomBelow(j + 1);
    selected.add(selected.has(value) ? j : value);
  }
  return [...selected].map((value) => min + value).sort((a, b) => a - b);
}
