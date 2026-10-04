import {
  QUESTION_RULES,
  scorePersonality,
  type PersonalityResult,
} from "../lib/personality";
import { byId, bindCopyBtn, hideStatus, showStatus } from "./toolkit";
import {
  getFunData,
  setText,
  saveBlob,
  canvasBlob,
  wrapCanvasText,
} from "./fun-ui";

const { copy } = getFunData("quiz");
const t = copy.quiz;
const answers: (number | null)[] = Array(QUESTION_RULES.length).fill(null);
const radios = Array.from(
  document.querySelectorAll<HTMLInputElement>('input[name="pqAnswer"]'),
);
let index = 0;
let result: PersonalityResult | null = null;
let revision = 0;
const axisColors = ["#66977D", "#9695C7", "#C58087", "#C39852"];
function exportsState(enabled: boolean): void {
  ["pqSave", "pqCopy"].forEach((id) => {
    byId<HTMLButtonElement>(id).disabled = !enabled;
  });
}
function mode(value: "intro" | "question" | "result"): void {
  byId<HTMLElement>("pqIntro").hidden = value !== "intro";
  byId<HTMLElement>("pqQuestionCard").hidden = value !== "question";
  byId<HTMLElement>("pqResult").hidden = value !== "result";
}
function progress(): void {
  const done = answers.filter((answer) => answer !== null).length;
  const label = t.progress.replace("{done}", String(done));
  setText("pqProgressText", label);
  byId<HTMLProgressElement>("pqProgress").value = done;
  byId<HTMLProgressElement>("pqProgress").setAttribute("aria-label", label);
}
function question(focus = true): void {
  result = null;
  revision++;
  exportsState(false);
  hideStatus("pqStatus");
  hideStatus("pqExportStatus");
  mode("question");
  setText("pqCounter", `${String(index + 1).padStart(2, "0")} / 24`);
  setText("pqQuestion", t.questions[index]);
  radios.forEach((radio) => {
    radio.checked =
      answers[index] !== null && Number(radio.value) === answers[index];
  });
  byId<HTMLButtonElement>("pqPrevious").disabled = index === 0;
  const next = byId<HTMLButtonElement>("pqNext");
  next.replaceChildren(
    document.createTextNode(index === answers.length - 1 ? t.finish : t.next),
  );
  const icon = document.createElement("i");
  icon.className = "bi bi-arrow-right";
  icon.setAttribute("aria-hidden", "true");
  next.append(icon);
  progress();
  if (focus) byId<HTMLElement>("pqQuestion").focus();
}
function showResult(): void {
  try {
    result = scorePersonality(answers);
  } catch {
    index = answers.findIndex((answer) => answer === null);
    question();
    showStatus("pqStatus", "error", t.choose);
    return;
  }
  revision++;
  mode("result");
  setText("pqCode", result.code);
  const axes = result.axes.map((axis, i) => {
    const row = document.createElement("div");
    row.className = "quiz-axis";
    row.style.setProperty("--axis-color", axisColors[i]);
    const heading = document.createElement("div");
    heading.className = "quiz-axis-heading";
    const name = document.createElement("h3");
    name.textContent = t.axes[i];
    const preference = document.createElement("span");
    preference.textContent =
      axis.score === 0 ? t.balance : axis.score > 0 ? t.left[i] : t.right[i];
    heading.append(name, preference);
    const labels = document.createElement("div");
    labels.className = "quiz-axis-labels";
    const left = document.createElement("span");
    left.textContent = `${t.left[i]} ${axis.left}%`;
    const right = document.createElement("span");
    right.textContent = `${axis.right}% ${t.right[i]}`;
    labels.append(left, right);
    const track = document.createElement("div");
    track.className = "quiz-axis-track";
    track.setAttribute("role", "img");
    track.setAttribute(
      "aria-label",
      `${t.axes[i]}: ${left.textContent}, ${right.textContent}`,
    );
    const fill = document.createElement("span");
    fill.style.width = `${axis.left}%`;
    track.append(fill);
    row.append(heading, labels, track);
    return row;
  });
  byId<HTMLElement>("pqAxes").replaceChildren(...axes);
  const descriptions = result.axes.map((axis, i) => {
    const item = document.createElement("p");
    const title = document.createElement("strong");
    title.textContent = t.axes[i];
    const text = document.createElement("span");
    text.textContent =
      axis.score === 0 ? t.balance : t.descriptions[i][axis.score > 0 ? 0 : 1];
    item.append(title, text);
    return item;
  });
  byId<HTMLElement>("pqDescriptions").replaceChildren(...descriptions);
  exportsState(true);
  const heading = byId<HTMLElement>("pqResultHeading");
  heading.setAttribute("tabindex", "-1");
  heading.focus();
}
function advance(): void {
  if (answers[index] === null) {
    showStatus("pqStatus", "error", t.choose);
    radios[0].focus();
    return;
  }
  if (index === answers.length - 1) showResult();
  else {
    index++;
    question();
  }
}
radios.forEach((radio) =>
  radio.addEventListener("change", () => {
    answers[index] = Number(radio.value);
    revision++;
    result = null;
    exportsState(false);
    hideStatus("pqStatus");
    progress();
  }),
);
byId<HTMLButtonElement>("pqStart").addEventListener("click", () => {
  index = 0;
  question();
});
byId<HTMLButtonElement>("pqPrevious").addEventListener("click", () => {
  if (index > 0) {
    index--;
    question();
  }
});
byId<HTMLFormElement>("pqForm").addEventListener("submit", (event) => {
  event.preventDefault();
  advance();
});
byId<HTMLFormElement>("pqForm").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    advance();
  }
});
byId<HTMLButtonElement>("pqEdit").addEventListener("click", () => {
  index = 0;
  question();
});
byId<HTMLButtonElement>("pqRestart").addEventListener("click", () => {
  answers.fill(null);
  index = 0;
  question();
});
bindCopyBtn("pqCopy", () =>
  result
    ? `${t.result}: ${result.code}\n` +
      result.axes
        .map(
          (axis, i) =>
            `${t.axes[i]}: ${t.left[i]} ${axis.left}% / ${t.right[i]} ${axis.right}%`,
        )
        .join("\n") +
      `\n${t.balancedHint}\n${t.notice}`
    : "",
);
function sharingCard(snapshot: PersonalityResult): HTMLCanvasElement {
  const canvas = document.createElement("canvas");
  canvas.width = 1000;
  canvas.height = 1340;
  const c = canvas.getContext("2d")!;
  c.fillStyle = "#F6F3EB";
  c.fillRect(0, 0, 1000, 1340);
  c.fillStyle = "#E8EEE4";
  c.fillRect(0, 0, 1000, 292);
  c.fillStyle = "#4A6353";
  c.font = "600 18px system-ui, sans-serif";
  c.fillText("CLOVER / SELF EXPLORATION", 80, 64);
  c.fillStyle = "#253B2D";
  c.font = "600 32px system-ui, sans-serif";
  c.fillText(t.result, 80, 117);
  c.font = "600 112px ui-monospace, monospace";
  c.fillText(snapshot.code, 73, 239);
  snapshot.axes.forEach((axis, i) => {
    const y = 352 + i * 152;
    c.fillStyle = "#263A31";
    c.font = "600 25px system-ui, sans-serif";
    c.fillText(t.axes[i], 80, y);
    c.font = "18px system-ui, sans-serif";
    c.fillStyle = "#6B6656";
    c.fillText(`${t.left[i]} ${axis.left}%`, 80, y + 40);
    c.textAlign = "right";
    c.fillText(`${axis.right}% ${t.right[i]}`, 920, y + 40);
    c.textAlign = "left";
    c.fillStyle = "#DFDDD5";
    c.fillRect(80, y + 61, 840, 18);
    c.fillStyle = axisColors[i];
    c.fillRect(80, y + 61, (840 * axis.left) / 100, 18);
    c.fillStyle = "#FFFCF5";
    c.fillRect(498, y + 56, 4, 28);
  });
  c.fillStyle = "#4A6353";
  c.font = "22px system-ui, sans-serif";
  let y = wrapCanvasText(c, t.resultHint, 80, 986, 840, 33) + 25;
  c.font = "16px system-ui, sans-serif";
  c.fillStyle = "#6B6656";
  y = wrapCanvasText(c, t.balancedHint, 80, y, 840, 26) + 15;
  wrapCanvasText(c, t.notice, 80, y, 840, 26);
  c.fillStyle = "#4A6353";
  c.font = "600 18px system-ui, sans-serif";
  c.fillText("clovertools.cn", 80, 1286);
  return canvas;
}
byId<HTMLButtonElement>("pqSave").addEventListener("click", async () => {
  if (!result) return;
  const snapshot = result,
    version = revision;
  try {
    const blob = await canvasBlob(sharingCard(snapshot));
    if (revision === version)
      saveBlob(`clover-preferences-${snapshot.code}.png`, blob);
  } catch {
    if (revision === version)
      showStatus("pqExportStatus", "error", copy.exportError);
  }
});
exportsState(false);
window.addEventListener("pagehide", () => {
  // Clear the visit even when the browser keeps this page in its back/forward cache.
  answers.fill(null);
  index = 0;
  result = null;
  revision++;
  exportsState(false);
  radios.forEach((radio) => {
    radio.checked = false;
  });
  setText("pqCode", "—");
  byId<HTMLElement>("pqAxes").replaceChildren();
  byId<HTMLElement>("pqDescriptions").replaceChildren();
  progress();
  mode("intro");
});
