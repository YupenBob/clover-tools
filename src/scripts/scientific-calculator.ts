import {
  ArithmeticError,
  evaluateArithmetic,
  formatArithmetic,
} from "../lib/arithmetic";
import { byId, hideStatus, showStatus } from "./toolkit";
import { copyControl, getDailyData, markInvalid, text } from "./daily-ui";

const { copy: t } = getDailyData();
const expression = byId<HTMLInputElement>("calcExpr");
const history = byId<HTMLOListElement>("calcHistory");
const entries: { expression: string; result: string }[] = [];
const enableCopy = copyControl("calcCopy", () => currentResult ?? "");
let currentResult: string | null = "0";
let committed = false;

function render() {
  markInvalid("calcExpr", false);
  try {
    currentResult = formatArithmetic(
      evaluateArithmetic(expression.value.trim() || "0"),
    );
  } catch {
    currentResult = null;
  }
  text("calcResult", currentResult ?? "—");
  enableCopy(currentResult !== null);
}

function renderHistory() {
  history.replaceChildren();
  for (const entry of entries) {
    const item = document.createElement("li");
    const button = document.createElement("button");
    button.type = "button";
    const formula = document.createElement("code");
    formula.textContent = entry.expression;
    const result = document.createElement("strong");
    result.textContent = `= ${entry.result}`;
    button.append(formula, result);
    button.addEventListener("click", () => {
      expression.value = entry.expression;
      expression.setSelectionRange(
        expression.value.length,
        expression.value.length,
      );
      committed = false;
      hideStatus("calcStatus");
      render();
    });
    item.append(button);
    history.append(item);
  }
  byId<HTMLElement>("calcHistoryEmpty").hidden = entries.length > 0;
  byId<HTMLButtonElement>("calcHistoryClear").disabled = entries.length === 0;
}

function calculate() {
  const source = expression.value.trim() || "0";
  try {
    currentResult = formatArithmetic(evaluateArithmetic(source));
    text("calcResult", currentResult);
    enableCopy(true);
    hideStatus("calcStatus");
    committed = true;
    markInvalid("calcExpr", false);
    if (
      entries[0]?.expression !== source ||
      entries[0]?.result !== currentResult
    ) {
      entries.unshift({ expression: source, result: currentResult });
      entries.splice(20);
      renderHistory();
    }
  } catch (error) {
    const messages = {
      syntax: t.calcSyntax,
      division: t.calcDivision,
      domain: t.calcDomain,
      range: t.calcRange,
      limit: t.calcLimit,
    };
    currentResult = null;
    markInvalid("calcExpr", true);
    enableCopy(false);
    text("calcResult", "—");
    showStatus(
      "calcStatus",
      "error",
      error instanceof ArithmeticError ? messages[error.code] : t.calcSyntax,
    );
  }
}

function insert(value: string) {
  const start = expression.selectionStart ?? expression.value.length;
  const end = expression.selectionEnd ?? start;
  expression.setRangeText(value, start, end, "end");
}

function press(key: string) {
  if (key === "=") {
    calculate();
    return;
  }
  hideStatus("calcStatus");
  if (committed && /^[0-9.(√]$/.test(key)) expression.value = "";
  else if (committed && "+-*/".includes(key) && currentResult !== null)
    expression.value = currentResult;
  if (committed)
    expression.setSelectionRange(
      expression.value.length,
      expression.value.length,
    );
  committed = false;
  if (key === "C") expression.value = "";
  else if (key === "back") {
    const start = expression.selectionStart ?? expression.value.length;
    const end = expression.selectionEnd ?? start;
    expression.setRangeText(
      "",
      start === end ? Math.max(0, start - 1) : start,
      end,
      "end",
    );
  } else if (key === "sign") {
    const source = expression.value.trim() || "0";
    expression.value = /^-?(?:\d+(?:\.\d*)?|\.\d+)(?:[eE][+-]?\d+)?$/.test(
      source,
    )
      ? source.startsWith("-")
        ? source.slice(1)
        : `-${source}`
      : `-(${source})`;
    expression.setSelectionRange(
      expression.value.length,
      expression.value.length,
    );
  } else if (key === "sqrt" || key === "pow") {
    if (expression.value.trim() && currentResult !== null) {
      expression.value =
        key === "sqrt" ? `√(${expression.value})` : `(${expression.value})^`;
      expression.setSelectionRange(
        expression.value.length,
        expression.value.length,
      );
    } else insert(key === "sqrt" ? "√" : "^");
  } else if (/^[0-9.+\-*/()!%^√]$/.test(key)) insert(key);
  render();
}

document.querySelectorAll<HTMLButtonElement>(".calc-key").forEach((button) => {
  button.addEventListener("click", () => press(button.dataset.key ?? ""));
});
expression.addEventListener("input", () => {
  committed = false;
  hideStatus("calcStatus");
  render();
});
expression.addEventListener("keydown", (event) => {
  if (event.isComposing) return;
  if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  } else if (event.key === "Escape") {
    event.preventDefault();
    press("C");
  }
});
document.addEventListener("keydown", (event) => {
  if (event.ctrlKey || event.metaKey || event.altKey || event.isComposing)
    return;
  const target = event.target as HTMLElement;
  if (target.matches("input, textarea, select, a") || target.isContentEditable)
    return;
  const inKeys = target.closest(".calc-grid");
  if (!inKeys && target !== document.body) return;
  if (event.key === "Enter" && target.closest("button")) return; // Preserve native button activation.
  if (/^[0-9.+\-*/()!%^√]$/.test(event.key)) {
    event.preventDefault();
    press(event.key);
  } else if (event.key === "Enter" || event.key === "=") {
    event.preventDefault();
    calculate();
  } else if (event.key === "Backspace") {
    event.preventDefault();
    press("back");
  } else if (event.key === "Escape") {
    event.preventDefault();
    press("C");
  }
});
byId<HTMLButtonElement>("calcHistoryClear").addEventListener("click", () => {
  entries.length = 0;
  renderHistory();
});
render();
