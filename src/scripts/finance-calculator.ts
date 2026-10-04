import {
  CalculationError,
  calculateCompound,
  calculateLoan,
  calculatePercentage,
} from "../lib/daily-calculations";
import { byId, hideStatus, showStatus } from "./toolkit";
import {
  bindLiveForm,
  copyControl,
  getDailyData,
  markInvalid,
  numberInput,
  text,
} from "./daily-ui";

const { copy: t, locale } = getDailyData();
const modes = ["loan", "compound", "percentage"] as const;
const tabs = modes.map((mode) => byId<HTMLButtonElement>(`finTab-${mode}`));
function activate(index: number, focus = false) {
  tabs.forEach((tab, i) => {
    tab.setAttribute("aria-selected", String(i === index));
    tab.tabIndex = i === index ? 0 : -1;
    byId<HTMLElement>(`finPanel-${modes[i]}`).hidden = i !== index;
  });
  if (focus) tabs[index].focus();
}
tabs.forEach((tab, index) => {
  tab.addEventListener("click", () => activate(index));
  tab.addEventListener("keydown", (event) => {
    let target = index;
    if (event.key === "ArrowRight") target = (index + 1) % tabs.length;
    else if (event.key === "ArrowLeft")
      target = (index + tabs.length - 1) % tabs.length;
    else if (event.key === "Home") target = 0;
    else if (event.key === "End") target = tabs.length - 1;
    else return;
    event.preventDefault();
    activate(target, true);
  });
});

const money = (value: number) =>
  value.toLocaleString(locale, {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
    notation: Math.abs(value) >= 1e12 ? "scientific" : "standard",
  });
const percentage = (value: number) =>
  `${value.toLocaleString(locale, { maximumFractionDigits: 3, notation: Math.abs(value) >= 1e12 ? "scientific" : "standard" })}%`;
const bar = (id: string, fraction: number) => {
  byId<HTMLElement>(id).style.width =
    `${Math.max(0, Math.min(1, fraction)) * 100}%`;
};
const values = (ids: string[]) =>
  ids.map((id) => {
    const value = numberInput(id);
    markInvalid(id, value === null);
    if (value === null) throw new CalculationError("input");
    return value;
  });
let loanCopy = "",
  compoundCopy = "",
  percentageCopy = "";
const enableLoan = copyControl("finLoanCopy", () => loanCopy);
const enableCompound = copyControl("finCompoundCopy", () => compoundCopy);
const enablePercentage = copyControl("finPctCopy", () => percentageCopy);
function failure(
  error: unknown,
  status: string,
  message: string,
  outputs: string[],
  bars: string[],
  disable: (enabled: boolean) => void,
) {
  for (const id of outputs) text(id, "—");
  for (const id of bars) bar(id, 0);
  disable(false);
  showStatus(
    status,
    "error",
    error instanceof CalculationError && error.code === "range"
      ? t.rangeError
      : message,
  );
}
function loan() {
  try {
    const [principal, years, rate] = values(["finLoan", "finYears", "finRate"]);
    const result = calculateLoan(principal * 10000, years, rate);
    text("finMonthly", money(result.monthly));
    text("finTotal", `${money(result.total)} ${t.amountCny}`);
    text("finInterest", `${money(result.interest)} ${t.amountCny}`);
    text("finMonths", result.months.toLocaleString(locale));
    bar("finPrincipalBar", result.principal / result.total);
    bar("finInterestBar", result.interest / result.total);
    loanCopy = `${t.monthlyPayment}: ${money(result.monthly)} ${t.amountCny}\n${t.totalRepayment}: ${money(result.total)} ${t.amountCny}\n${t.interest}: ${money(result.interest)} ${t.amountCny}\n${t.paymentCount}: ${result.months}`;
    enableLoan(true);
    hideStatus("finLoanStatus");
  } catch (error) {
    loanCopy = "";
    failure(
      error,
      "finLoanStatus",
      t.loanInvalid,
      ["finMonthly", "finTotal", "finInterest", "finMonths"],
      ["finPrincipalBar", "finInterestBar"],
      enableLoan,
    );
  }
}
function compound() {
  try {
    const [principal, rate, years] = values(["finP", "finRp", "finN"]);
    const result = calculateCompound(principal, rate, years);
    text("finFinal", money(result.total));
    text("finBase", `${money(result.principal)} ${t.amountCny}`);
    text("finGain", `${money(result.gain)} ${t.amountCny}`);
    text("finGrowth", percentage(result.growth));
    const denominator = Math.max(result.principal, result.total);
    bar("finBaseBar", Math.min(result.principal, result.total) / denominator);
    bar("finGainBar", Math.abs(result.gain) / denominator);
    text("finBaseLegend", result.gain >= 0 ? t.principal : t.finalAmount);
    byId<HTMLElement>("finCompoundResult").dataset.trend =
      result.gain < 0 ? "loss" : "gain";
    compoundCopy = `${t.finalAmount}: ${money(result.total)} ${t.amountCny}\n${t.principal}: ${money(result.principal)} ${t.amountCny}\n${t.gain}: ${money(result.gain)} ${t.amountCny}\n${t.growth}: ${percentage(result.growth)}`;
    enableCompound(true);
    hideStatus("finCompoundStatus");
  } catch (error) {
    compoundCopy = "";
    failure(
      error,
      "finCompoundStatus",
      t.compoundInvalid,
      ["finFinal", "finBase", "finGain", "finGrowth"],
      ["finBaseBar", "finGainBar"],
      enableCompound,
    );
  }
}
function percent() {
  try {
    const [a, b] = values(["finA", "finB"]);
    const result = calculatePercentage(a, b);
    text("finRatio", percentage(result.ratio).replace(/%$/, ""));
    text("finChange", percentage(result.change));
    text("finShare", result.share === null ? "—" : percentage(result.share));
    const maximum = Math.max(Math.abs(a), Math.abs(b));
    bar("finABar", Math.abs(a) / maximum);
    bar("finBBar", Math.abs(b) / maximum);
    text(
      "finAValue",
      a.toLocaleString(locale, { maximumSignificantDigits: 10 }),
    );
    text(
      "finBValue",
      b.toLocaleString(locale, { maximumSignificantDigits: 10 }),
    );
    percentageCopy = `${t.ratio}: ${percentage(result.ratio)}\n${t.change}: ${percentage(result.change)}\n${t.share}: ${result.share === null ? "—" : percentage(result.share)}`;
    enablePercentage(true);
    hideStatus("finPctStatus");
  } catch (error) {
    percentageCopy = "";
    failure(
      error,
      "finPctStatus",
      t.percentageInvalid,
      ["finRatio", "finChange", "finShare", "finAValue", "finBValue"],
      ["finABar", "finBBar"],
      enablePercentage,
    );
  }
}
bindLiveForm("finLoanForm", loan);
bindLiveForm("finCompoundForm", compound);
bindLiveForm("finPctForm", percent);
loan();
compound();
percent();
