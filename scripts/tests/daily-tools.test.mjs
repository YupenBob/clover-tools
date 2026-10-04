import test from "node:test";
import assert from "node:assert/strict";
import { execFileSync } from "node:child_process";
import {
  ArithmeticError,
  evaluateArithmetic,
  formatArithmetic,
} from "../../src/lib/arithmetic.ts";
import {
  addDays,
  addMonths,
  calculateAge,
  calendarSpan,
  daysBetween,
  formatCivilDate,
  parseCivilDate,
} from "../../src/lib/civil-date.ts";
import {
  calculateBmi,
  calculateCompound,
  calculateLoan,
  calculatePercentage,
  readFiniteNumber,
} from "../../src/lib/daily-calculations.ts";
import { CountdownClock, StopwatchClock } from "../../src/lib/timer-clock.ts";

const date = (value) => {
  const parsed = parseCivilDate(value);
  assert.ok(parsed);
  return parsed;
};
const close = (value, expected, tolerance = 1e-10) =>
  assert.ok(
    Math.abs(value - expected) <= tolerance * Math.max(1, Math.abs(expected)),
    `${value} ≈ ${expected}`,
  );
const arithmeticError = (source, code) =>
  assert.throws(
    () => evaluateArithmetic(source),
    (error) => error instanceof ArithmeticError && error.code === code,
  );

test("arithmetic respects parentheses and precedence without evaluating source code", () => {
  assert.equal(evaluateArithmetic("2 + 3 × (4 − 1)"), 11);
  assert.equal(evaluateArithmetic("7÷2"), 3.5);
  assert.equal(evaluateArithmetic(".5 + 2."), 2.5);
  assert.equal(evaluateArithmetic("1e-8 * 1E+3"), 0.00001);
});
test("powers associate to the right and bind before a leading negative sign", () => {
  assert.equal(evaluateArithmetic("2^3^2"), 512);
  assert.equal(evaluateArithmetic("-2^2"), -4);
  assert.equal(evaluateArithmetic("(-2)^2"), 4);
  assert.equal(evaluateArithmetic("2^-3"), 0.125);
});
test("square roots, factorials and percentages share the arithmetic grammar", () => {
  assert.equal(evaluateArithmetic("√(9+7)"), 4);
  assert.equal(evaluateArithmetic("5! + 0!"), 121);
  assert.equal(evaluateArithmetic("200 * 15%"), 30);
  close(evaluateArithmetic("170!"), 7.257415615307994e306);
});
test("division by zero is a specific recoverable error", () => {
  arithmeticError("1/0", "division");
  arithmeticError("0/0", "division");
});
test("invalid real-number operations and overflowing results are rejected", () => {
  arithmeticError("√(-1)", "domain");
  arithmeticError("(-2)^.5", "domain");
  arithmeticError("(-1)!", "domain");
  arithmeticError("1.5!", "domain");
  arithmeticError("171!", "range");
  arithmeticError("1e309", "range");
  arithmeticError("1e308*10", "range");
});
test("malformed expressions and executable JavaScript are not accepted", () => {
  for (const source of [
    "2+",
    "(2+3",
    "2 3",
    "2(3)",
    "Math.sqrt(4)",
    "globalThis.x=1",
    "alert(1)",
    "1;2",
    "1**2",
    "",
  ])
    arithmeticError(source, "syntax");
});
test("arithmetic has bounded input length and recursion", () => {
  arithmeticError("(".repeat(140) + "1" + ")".repeat(140), "limit");
  arithmeticError("1".repeat(2001), "limit");
});
test("displayed arithmetic results preserve tiny values and can be reused", () => {
  assert.equal(
    formatArithmetic(evaluateArithmetic("1/1000000000000")),
    "1e-12",
  );
  assert.equal(evaluateArithmetic(formatArithmetic(1e-12)), 1e-12);
  assert.equal(formatArithmetic(0.1 + 0.2), "0.3");
  assert.equal(evaluateArithmetic("-0"), 0);
});

test("calendar parsing validates real days and four-digit years", () => {
  assert.ok(parseCivilDate("2000-02-29"));
  assert.equal(parseCivilDate("1900-02-29"), null);
  assert.equal(parseCivilDate("2026-04-31"), null);
  assert.equal(parseCivilDate("0000-01-01"), null);
  assert.equal(parseCivilDate("2026-1-01"), null);
  assert.equal(daysBetween(date("0099-12-31"), date("0100-01-01")), 1);
});
test("calendar intervals remain exact across DST and timezones", () => {
  const module = new URL("../../src/lib/civil-date.ts", import.meta.url).href;
  const source = `import {parseCivilDate,daysBetween} from '${module}'; console.log(daysBetween(parseCivilDate('2026-03-08'),parseCivilDate('2026-03-09')),daysBetween(parseCivilDate('2026-11-01'),parseCivilDate('2026-11-02')));`;
  for (const TZ of ["UTC", "America/New_York", "Asia/Seoul"]) {
    assert.equal(
      execFileSync(process.execPath, ["--input-type=module", "-e", source], {
        env: { ...process.env, TZ },
        encoding: "utf8",
      }).trim(),
      "1 1",
    );
  }
});
test("date offsets cross leap days and reject fractional or out-of-range days", () => {
  assert.equal(formatCivilDate(addDays(date("2024-02-28"), 2)), "2024-03-01");
  assert.equal(formatCivilDate(addDays(date("2026-01-01"), -1)), "2025-12-31");
  assert.equal(addDays(date("2026-01-01"), 1.5), null);
  assert.equal(addDays(date("0001-01-01"), -1), null);
  assert.equal(addDays(date("9999-12-31"), 1), null);
  assert.equal(addDays(date("2026-01-01"), Number.MAX_SAFE_INTEGER), null);
});
test("whole calendar months clamp to month end without negative residual days", () => {
  assert.deepEqual(calendarSpan(date("2026-01-31"), date("2026-03-01")), {
    years: 0,
    months: 1,
    days: 1,
  });
  assert.deepEqual(calendarSpan(date("2026-01-31"), date("2026-02-28")), {
    years: 0,
    months: 1,
    days: 0,
  });
  assert.deepEqual(calendarSpan(date("2026-08-31"), date("2026-09-01")), {
    years: 0,
    months: 0,
    days: 1,
  });
  assert.equal(
    formatCivilDate(addMonths(date("2024-02-29"), 12)),
    "2025-02-28",
  );
});
test("birthday today stays today and completed years are exact", () => {
  const age = calculateAge(date("2000-10-04"), date("2026-10-04"));
  assert.equal(age.years, 26);
  assert.equal(age.daysUntilBirthday, 0);
  assert.equal(age.birthdayToday, true);
  assert.equal(formatCivilDate(age.nextBirthday), "2026-10-04");
  assert.equal(age.birthdayProgress, 1);
});
test("age rolls over only on the birthday and counts calendar days lived", () => {
  const before = calculateAge(date("2000-10-04"), date("2026-10-03"));
  assert.equal(before.years, 25);
  assert.equal(before.daysUntilBirthday, 1);
  const after = calculateAge(date("2000-10-04"), date("2026-10-05"));
  assert.equal(after.years, 26);
  assert.equal(formatCivilDate(after.nextBirthday), "2027-10-04");
  assert.equal(
    calculateAge(date("2026-03-08"), date("2026-03-09")).livedDays,
    1,
  );
});
test("leap-day birthdays use the declared February 28 anniversary policy", () => {
  const age = calculateAge(date("2000-02-29"), date("2026-02-28"));
  assert.deepEqual(
    { years: age.years, months: age.months, days: age.days },
    { years: 26, months: 0, days: 0 },
  );
  assert.equal(age.daysUntilBirthday, 0);
  assert.equal(
    formatCivilDate(
      calculateAge(date("2000-02-29"), date("2024-02-28")).nextBirthday,
    ),
    "2024-02-29",
  );
});
test("newborn and future-birth cases are handled explicitly", () => {
  const newborn = calculateAge(date("2026-10-04"), date("2026-10-04"));
  assert.equal(newborn.livedDays, 0);
  assert.equal(newborn.years, 0);
  assert.equal(newborn.daysUntilBirthday, 0);
  assert.throws(() => calculateAge(date("2026-10-05"), date("2026-10-04")));
});

test("loan payments match an independent equal-payment reference", () => {
  const loan = calculateLoan(1000000, 30, 3.6);
  close(loan.monthly, 4546.453502, 1e-9);
  assert.equal(loan.months, 360);
  close(loan.total, loan.monthly * 360);
});
test("zero and tiny loan rates remain finite and stable", () => {
  assert.equal(calculateLoan(120000, 10, 0).monthly, 1000);
  close(calculateLoan(120000, 10, 1e-12).monthly, 1000, 1e-12);
  assert.equal(calculateLoan(1200, 1 / 12, 0).monthly, 1200);
});
test("loan inputs reject undefined amounts, fractional months and negative rates", () => {
  for (const args of [
    [0, 30, 3.6],
    [1000, 0, 3],
    [1000, 0.1, 3],
    [1000, 1, -1],
    [Infinity, 1, 1],
  ])
    assert.throws(() => calculateLoan(...args));
});
test("annual compounding handles zero duration, growth and losses", () => {
  close(calculateCompound(10000, 5, 10).total, 16288.94626777442);
  assert.equal(calculateCompound(10000, 5, 0).total, 10000);
  assert.equal(calculateCompound(10000, -50, 1).total, 5000);
  assert.equal(calculateCompound(10000, -50, 1).growth, -50);
});
test("compound inputs reject zero principal, invalid rates and overflow", () => {
  for (const args of [
    [0, 5, 10],
    [10000, -100, 1],
    [10000, 5, -1],
    [1e300, 100, 1000],
  ])
    assert.throws(() => calculateCompound(...args));
});
test("percentage comparisons handle negative bases and a zero sum", () => {
  assert.deepEqual(calculatePercentage(200, 150), {
    ratio: 75,
    change: -25,
    share: (150 / 350) * 100,
  });
  assert.equal(calculatePercentage(-200, -150).change, 25);
  assert.deepEqual(calculatePercentage(200, -200), {
    ratio: -100,
    change: -200,
    share: null,
  });
  assert.throws(() => calculatePercentage(0, 1));
});
test("empty or nonfinite numeric input is not silently treated as zero", () => {
  assert.equal(readFiniteNumber(""), null);
  assert.equal(readFiniteNumber("   "), null);
  assert.equal(readFiniteNumber("Infinity"), null);
  assert.equal(readFiniteNumber("0"), 0);
});
test("percentage comparisons stay correct when finite operands would overflow their sum", () => {
  assert.deepEqual(calculatePercentage(1e308, 1e308), {
    ratio: 100,
    change: 0,
    share: 50,
  });
  assert.deepEqual(calculatePercentage(-1e308, 1e308), {
    ratio: -100,
    change: 200,
    share: null,
  });
});
test("BMI reference standards differ at their exact boundaries", () => {
  assert.equal(calculateBmi(200, 96, "cn").category, 2);
  assert.equal(calculateBmi(200, 96, "who").category, 1);
  assert.equal(calculateBmi(200, 120, "who").category, 3);
  assert.equal(calculateBmi(200, 74, "who").category, 1);
  close(calculateBmi(175, 70, "cn").value, 22.857142857142858);
});

test("countdown uses its deadline after callbacks have been missed", () => {
  const clock = new CountdownClock(10000);
  clock.start(1000);
  assert.equal(clock.remaining(7500), 3500);
  assert.equal(clock.remaining(20000), 0);
  assert.equal(clock.state, "finished");
});
test("countdown pause and resume preserve the exact remaining duration", () => {
  const clock = new CountdownClock(10000);
  clock.start(1000);
  clock.pause(3250);
  assert.equal(clock.remaining(50000), 7750);
  clock.start(60000);
  assert.equal(clock.remaining(60750), 7000);
  clock.reset();
  assert.equal(clock.remaining(90000), 10000);
  assert.equal(clock.state, "ready");
});
test("countdown resets to its configured duration and can restart after finishing", () => {
  const clock = new CountdownClock(1000);
  clock.start(0);
  assert.equal(clock.remaining(1000), 0);
  clock.start(10000);
  assert.equal(clock.remaining(10100), 900);
  clock.reset(5000);
  assert.equal(clock.remaining(20000), 5000);
  assert.throws(() => clock.reset(0));
});
test("stopwatch samples the pause tail and excludes time spent paused", () => {
  const clock = new StopwatchClock();
  clock.start(0);
  assert.equal(clock.elapsed(900), 900);
  clock.pause(975);
  assert.equal(clock.elapsed(10000), 975);
  clock.start(20000);
  assert.equal(clock.elapsed(20025), 1000);
  clock.pause(20125);
  assert.equal(clock.elapsed(30000), 1100);
});
test("stopwatch laps record both splits and totals at the action time", () => {
  const clock = new StopwatchClock();
  assert.equal(clock.lap(0), null);
  clock.start(1000);
  assert.deepEqual(clock.lap(2125), { elapsed: 1125, split: 1125 });
  assert.deepEqual(clock.lap(3000), { elapsed: 2000, split: 875 });
  clock.pause(4000);
  clock.start(10000);
  assert.deepEqual(clock.lap(10500), { elapsed: 3500, split: 1500 });
  clock.reset();
  assert.equal(clock.elapsed(99999), 0);
  assert.deepEqual(clock.laps, []);
});
