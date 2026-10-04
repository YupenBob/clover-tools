export class CalculationError extends Error {
  code: "input" | "range";
  constructor(code: "input" | "range") {
    super(code);
    this.code = code;
  }
}

function finite(...values: number[]) {
  if (values.some((value) => !Number.isFinite(value)))
    throw new CalculationError("range");
}

export function calculateLoan(
  principal: number,
  years: number,
  annualPercent: number,
) {
  finite(principal, years, annualPercent);
  const months = years * 12;
  if (
    principal <= 0 ||
    months <= 0 ||
    !Number.isSafeInteger(months) ||
    annualPercent < 0
  )
    throw new CalculationError("input");
  const rate = annualPercent / 1200;
  const monthly =
    rate === 0
      ? principal / months
      : (principal * rate) / -Math.expm1(-months * Math.log1p(rate));
  const total = monthly * months;
  const interest = Math.max(0, total - principal);
  finite(monthly, total, interest);
  return { monthly, total, interest, principal, months };
}

export function calculateCompound(
  principal: number,
  annualPercent: number,
  years: number,
) {
  finite(principal, annualPercent, years);
  if (principal <= 0 || annualPercent <= -100 || years < 0)
    throw new CalculationError("input");
  const exponent = years * Math.log1p(annualPercent / 100);
  const gain = principal * Math.expm1(exponent);
  const total = principal * Math.exp(exponent);
  const growth = Math.expm1(exponent) * 100;
  finite(gain, total, growth);
  return { principal, total, gain, growth };
}

export function calculatePercentage(a: number, b: number) {
  finite(a, b);
  if (a === 0) throw new CalculationError("input");
  const ratio = (b / a) * 100;
  const change = (b / Math.abs(a) - Math.sign(a)) * 100;
  const scale = Math.max(Math.abs(a), Math.abs(b));
  const sum = a / scale + b / scale;
  const share = sum === 0 ? null : (b / scale / sum) * 100;
  finite(ratio, change, ...(share === null ? [] : [share]));
  return { ratio, change, share };
}

export type BmiStandard = "cn" | "who";
export function calculateBmi(
  heightCm: number,
  weightKg: number,
  standard: BmiStandard,
) {
  finite(heightCm, weightKg);
  if (heightCm <= 0 || weightKg <= 0) throw new CalculationError("input");
  const square = (heightCm / 100) ** 2;
  const value = weightKg / square;
  const limits = standard === "cn" ? [18.5, 24, 28] : [18.5, 25, 30];
  const category = limits.findIndex((limit) => value < limit);
  finite(value);
  return {
    value,
    category: category === -1 ? 3 : category,
    limits,
    minimumKg: 18.5 * square,
    maximumKg: limits[1] * square,
  };
}

export function readFiniteNumber(value: string): number | null {
  if (!value.trim()) return null;
  const number = Number(value);
  return Number.isFinite(number) ? number : null;
}
