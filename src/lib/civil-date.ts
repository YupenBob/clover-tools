/** Calendar arithmetic uses UTC day ordinals, independent of local DST. */
export interface CivilDate {
  year: number;
  month: number;
  day: number;
}
export interface CalendarSpan {
  years: number;
  months: number;
  days: number;
}
const DAY_MS = 86400000;

export function daysInMonth(year: number, month: number): number {
  if (month === 2)
    return year % 4 === 0 && (year % 100 !== 0 || year % 400 === 0) ? 29 : 28;
  return [4, 6, 9, 11].includes(month) ? 30 : 31;
}

export function parseCivilDate(value: string): CivilDate | null {
  const parts = /^(\d{4})-(\d{2})-(\d{2})$/.exec(value);
  if (!parts) return null;
  const [year, month, day] = parts.slice(1).map(Number);
  if (
    year < 1 ||
    year > 9999 ||
    month < 1 ||
    month > 12 ||
    day < 1 ||
    day > daysInMonth(year, month)
  )
    return null;
  return { year, month, day };
}

export function formatCivilDate(date: CivilDate): string {
  return `${String(date.year).padStart(4, "0")}-${String(date.month).padStart(2, "0")}-${String(date.day).padStart(2, "0")}`;
}

export function civilToDate(date: CivilDate): Date {
  const instant = new Date(0);
  instant.setUTCFullYear(date.year, date.month - 1, date.day);
  instant.setUTCHours(0, 0, 0, 0);
  return instant;
}

export function dayOrdinal(date: CivilDate): number {
  return civilToDate(date).getTime() / DAY_MS;
}
export function daysBetween(from: CivilDate, to: CivilDate): number {
  return dayOrdinal(to) - dayOrdinal(from);
}

export function addDays(date: CivilDate, days: number): CivilDate | null {
  if (!Number.isSafeInteger(days)) return null;
  const ordinal = dayOrdinal(date) + days;
  if (
    ordinal < dayOrdinal({ year: 1, month: 1, day: 1 }) ||
    ordinal > dayOrdinal({ year: 9999, month: 12, day: 31 })
  )
    return null;
  const instant = new Date(ordinal * DAY_MS);
  return {
    year: instant.getUTCFullYear(),
    month: instant.getUTCMonth() + 1,
    day: instant.getUTCDate(),
  };
}

export function addMonths(date: CivilDate, months: number): CivilDate {
  const index = date.year * 12 + date.month - 1 + months;
  const year = Math.floor(index / 12);
  const month = index - year * 12 + 1;
  return { year, month, day: Math.min(date.day, daysInMonth(year, month)) };
}

/** Whole anchored months first, then calendar days. Month-end anniversaries clamp. */
export function calendarSpan(from: CivilDate, to: CivilDate): CalendarSpan {
  if (daysBetween(from, to) < 0) throw new RangeError("date order");
  let months = (to.year - from.year) * 12 + to.month - from.month;
  if (daysBetween(addMonths(from, months), to) < 0) months--;
  const days = daysBetween(addMonths(from, months), to);
  return { years: Math.floor(months / 12), months: months % 12, days };
}

export function localToday(now = new Date()): CivilDate {
  return {
    year: now.getFullYear(),
    month: now.getMonth() + 1,
    day: now.getDate(),
  };
}

function birthdayInYear(birth: CivilDate, year: number): CivilDate {
  return {
    year,
    month: birth.month,
    day: Math.min(birth.day, daysInMonth(year, birth.month)),
  };
}

export function calculateAge(birth: CivilDate, at: CivilDate) {
  const livedDays = daysBetween(birth, at);
  if (livedDays < 0) throw new RangeError("future birth");
  const thisBirthday = birthdayInYear(birth, at.year);
  const birthdayPassed = daysBetween(thisBirthday, at) >= 0;
  const nextYear = daysBetween(at, thisBirthday) >= 0 ? at.year : at.year + 1;
  const nextBirthday =
    nextYear <= 9999 ? birthdayInYear(birth, nextYear) : null;
  const previousBirthday = birthdayInYear(
    birth,
    birthdayPassed ? at.year : at.year - 1,
  );
  const followingBirthday = birthdayInYear(birth, previousBirthday.year + 1);
  const birthdayToday = daysBetween(thisBirthday, at) === 0;
  return {
    ...calendarSpan(birth, at),
    livedDays,
    nominalYears: at.year - birth.year + 1,
    nextBirthday,
    daysUntilBirthday: nextBirthday ? daysBetween(at, nextBirthday) : null,
    birthdayToday,
    birthdayProgress: birthdayToday
      ? 1
      : daysBetween(previousBirthday, at) /
        daysBetween(previousBirthday, followingBirthday),
  };
}
