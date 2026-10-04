import { calculateBmi, type BmiStandard } from "../lib/daily-calculations";
import { interpolate } from "../lib/daily-tool-i18n";
import { byId, hideStatus, showStatus } from "./toolkit";
import {
  copyControl,
  getDailyData,
  markInvalid,
  numberInput,
  text,
} from "./daily-ui";

const { copy: t } = getDailyData();
const height = byId<HTMLInputElement>("bmiHeight");
const weight = byId<HTMLInputElement>("bmiWeight");
const units = byId<HTMLSelectElement>("bmiUnits");
const standard = byId<HTMLSelectElement>("bmiStandard");
const heightRange = byId<HTMLInputElement>("bmiHeightRange");
const weightRange = byId<HTMLInputElement>("bmiWeightRange");
let previousUnits = "metric";
let copied = "";
const enableCopy = copyControl("bmiCopy", () => copied);

function update() {
  const h = numberInput("bmiHeight"),
    w = numberInput("bmiWeight");
  const imperial = units.value === "imperial";
  const cm = h === null ? null : h * (imperial ? 2.54 : 1);
  const kg = w === null ? null : w * (imperial ? 0.45359237 : 1);
  // Two-decimal unit conversion can round a boundary by a few thousandths.
  const badHeight =
    cm === null ||
    cm < 100 - (imperial ? 0.02 : 0) ||
    cm > 250 + (imperial ? 0.02 : 0);
  const badWeight =
    kg === null ||
    kg < 20 - (imperial ? 0.005 : 0) ||
    kg > 350 + (imperial ? 0.005 : 0);
  markInvalid("bmiHeight", badHeight);
  markInvalid("bmiWeight", badWeight);
  if (h !== null) heightRange.value = String(h);
  if (w !== null) weightRange.value = String(w);
  heightRange.setAttribute(
    "aria-valuetext",
    `${heightRange.value} ${imperial ? "in" : "cm"}`,
  );
  weightRange.setAttribute(
    "aria-valuetext",
    `${weightRange.value} ${imperial ? "lb" : "kg"}`,
  );
  for (const range of [heightRange, weightRange]) {
    const progress =
      ((Number(range.value) - Number(range.min)) /
        (Number(range.max) - Number(range.min))) *
      100;
    range.style.setProperty("--range-position", `${progress}%`);
  }
  if (badHeight || badWeight || cm === null || kg === null) {
    for (const id of ["bmiNumber", "bmiReference"]) text(id, "—");
    text("bmiCategory", "—");
    byId<HTMLElement>("bmiMarker").hidden = true;
    enableCopy(false);
    copied = "";
    showStatus("bmiStatus", "error", t.bmiInvalid);
    return;
  }
  const result = calculateBmi(
    Math.min(250, Math.max(100, cm)),
    Math.min(350, Math.max(20, kg)),
    standard.value as BmiStandard,
  );
  const value = result.value.toFixed(1);
  const category = t.bmiCategories[result.category];
  text("bmiNumber", value);
  text("bmiCategory", category);
  byId<HTMLElement>("bmiResult").dataset.category = String(result.category);
  const [low, middle, high] = result.limits;
  const position = (value: number) => ((value - 12) / 28) * 100;
  const scale = byId<HTMLElement>("bmiScale");
  scale.style.gridTemplateColumns = `${low - 12}fr ${middle - low}fr ${high - middle}fr ${40 - high}fr`;
  const ticks =
    byId<HTMLElement>("bmiTicks").querySelectorAll<HTMLElement>("span");
  result.limits.forEach((limit, i) => {
    ticks[i + 1].textContent = String(limit);
    ticks[i + 1].style.left = `${position(limit)}%`;
  });
  const marker = byId<HTMLElement>("bmiMarker");
  marker.hidden = false;
  marker.style.left = `${Math.max(0, Math.min(100, position(result.value)))}%`;
  marker.setAttribute(
    "aria-label",
    interpolate(t.bmiPosition, { value, category }),
  );
  text(
    "bmiReferenceLabel",
    interpolate(t.bmiReferenceWeight, { low, high: middle }),
  );
  const factor = imperial ? 0.45359237 : 1;
  text(
    "bmiReference",
    `${(result.minimumKg / factor).toFixed(1)}–<${(result.maximumKg / factor).toFixed(1)} ${imperial ? "lb" : "kg"}`,
  );
  copied = `BMI ${value} · ${category}\n${standard.selectedOptions[0].textContent}\n${height.value} ${imperial ? "in" : "cm"} / ${weight.value} ${imperial ? "lb" : "kg"}`;
  enableCopy(true);
  hideStatus("bmiStatus");
}

units.addEventListener("change", () => {
  const toImperial = units.value === "imperial";
  if (units.value === previousUnits) return;
  for (const [input, range, metricMin, metricMax, factor, unit] of [
    [height, heightRange, 100, 250, 2.54, "in"],
    [weight, weightRange, 20, 350, 0.45359237, "lb"],
  ] as const) {
    const value = Number(input.value);
    if (input.value && Number.isFinite(value))
      input.value = String(
        Number((toImperial ? value / factor : value * factor).toFixed(2)),
      );
    const minimum = String(toImperial ? metricMin / factor : metricMin);
    const maximum = String(toImperial ? metricMax / factor : metricMax);
    input.min = range.min = minimum;
    input.max = range.max = maximum;
    range.step = toImperial ? "0.01" : "0.1";
    text(
      input === height ? "bmiHeightUnit" : "bmiWeightUnit",
      toImperial ? unit : input === height ? "cm" : "kg",
    );
  }
  previousUnits = units.value;
  update();
});
for (const [input, range] of [
  [height, heightRange],
  [weight, weightRange],
]) {
  input.addEventListener("input", update);
  range.addEventListener("input", () => {
    input.value = range.value;
    update();
  });
}
standard.addEventListener("change", update);
byId<HTMLFormElement>("bmiForm").addEventListener("submit", (event) => {
  event.preventDefault();
  update();
});
update();
