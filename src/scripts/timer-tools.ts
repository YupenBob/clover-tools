import { CountdownClock, StopwatchClock } from "../lib/timer-clock";
import { byId, hideStatus, showStatus } from "./toolkit";
import { getDailyData, numberInput, text } from "./daily-ui";

const { copy: t } = getDailyData();
const countdown = new CountdownClock(300000);
const stopwatch = new StopwatchClock();
const minuteInput = byId<HTMLInputElement>("tmMin");
const secondInput = byId<HTMLInputElement>("tmSec");
const soundInput = byId<HTMLInputElement>("cdSound");
let tick: ReturnType<typeof setInterval> | undefined;
let audio: AudioContext | null = null;
let finishedAnnounced = false;

function duration(): number | null {
  const minutes = numberInput("tmMin"),
    seconds = numberInput("tmSec");
  if (
    minutes === null ||
    seconds === null ||
    !Number.isInteger(minutes) ||
    !Number.isInteger(seconds) ||
    minutes < 0 ||
    minutes > 999 ||
    seconds < 0 ||
    seconds > 59 ||
    minutes * 60 + seconds === 0
  )
    return null;
  return (minutes * 60 + seconds) * 1000;
}
function countdownText(milliseconds: number): string {
  const seconds = Math.ceil(milliseconds / 1000);
  return `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
}
function stopwatchText(milliseconds: number): string {
  const tenths = Math.floor(milliseconds / 100);
  return `${String(Math.floor(tenths / 600)).padStart(2, "0")}:${String(Math.floor(tenths / 10) % 60).padStart(2, "0")}.${tenths % 10}`;
}
async function prepareSound() {
  if (!soundInput.checked) return;
  try {
    audio ??= new AudioContext();
    await audio.resume();
  } catch {
    showStatus("cdStatus", "info", t.soundUnavailable);
  }
}
function chime() {
  if (!soundInput.checked || !audio || audio.state !== "running") return;
  const now = audio.currentTime;
  for (let i = 0; i < 3; i++) {
    const oscillator = audio.createOscillator();
    const gain = audio.createGain();
    oscillator.type = "sine";
    oscillator.frequency.value = i === 1 ? 880 : 660;
    gain.gain.setValueAtTime(0, now + i * 0.24);
    gain.gain.linearRampToValueAtTime(0.12, now + i * 0.24 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.001, now + i * 0.24 + 0.19);
    oscillator.connect(gain);
    gain.connect(audio.destination);
    oscillator.start(now + i * 0.24);
    oscillator.stop(now + i * 0.24 + 0.2);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
}

function render() {
  const left = countdown.remaining(Date.now());
  const state = countdown.state;
  if (state === "finished" && !finishedAnnounced) {
    finishedAnnounced = true;
    showStatus("cdStatus", "success", t.finished);
    chime();
  }
  text("cdDisplay", duration() === null ? "—" : countdownText(left));
  text("cdState", t[state]);
  byId<HTMLElement>("cdState").dataset.state = state;
  byId<HTMLElement>("cdDial").dataset.state = state;
  byId<SVGCircleElement>("cdProgress").style.strokeDashoffset = String(
    1 - left / countdown.durationMs,
  );
  text(
    "cdStart",
    state === "paused" ? t.resume : state === "finished" ? t.restart : t.start,
  );
  byId<HTMLButtonElement>("cdStart").disabled =
    state === "running" || duration() === null;
  byId<HTMLButtonElement>("cdPause").disabled = state !== "running";
  minuteInput.disabled = secondInput.disabled = state === "running";
  document
    .querySelectorAll<HTMLButtonElement>("[data-minutes]")
    .forEach((button) => {
      button.disabled = state === "running";
      button.setAttribute(
        "aria-pressed",
        String(
          Number(button.dataset.minutes) * 60000 === countdown.durationMs &&
            duration() === countdown.durationMs,
        ),
      );
    });
  const elapsed = stopwatch.elapsed(performance.now());
  const swState = stopwatch.running
    ? "running"
    : elapsed > 0
      ? "paused"
      : "ready";
  text("swDisplay", stopwatchText(elapsed));
  text("swState", t[swState]);
  byId<HTMLElement>("swState").dataset.state = swState;
  text("swStart", swState === "paused" ? t.resume : t.start);
  byId<HTMLButtonElement>("swStart").disabled = stopwatch.running;
  byId<HTMLButtonElement>("swPause").disabled = !stopwatch.running;
  byId<HTMLButtonElement>("swLap").disabled = !stopwatch.running;
  if (state !== "running" && !stopwatch.running && tick !== undefined) {
    clearInterval(tick);
    tick = undefined;
  }
}
function startTick() {
  if (tick === undefined) tick = setInterval(render, 100);
  render();
}
function updateDuration() {
  const value = duration();
  if (value === null) {
    text("cdDisplay", "—");
    byId<HTMLButtonElement>("cdStart").disabled = true;
    showStatus("cdStatus", "error", t.timerDuration);
    return;
  }
  countdown.reset(value);
  finishedAnnounced = false;
  hideStatus("cdStatus");
  render();
}
for (const input of [minuteInput, secondInput])
  input.addEventListener("input", updateDuration);
document
  .querySelectorAll<HTMLButtonElement>("[data-minutes]")
  .forEach((button) => {
    button.addEventListener("click", () => {
      minuteInput.value = button.dataset.minutes!;
      secondInput.value = "0";
      updateDuration();
    });
  });
byId<HTMLButtonElement>("cdStart").addEventListener("click", () => {
  if (duration() === null) {
    showStatus("cdStatus", "error", t.timerDuration);
    return;
  }
  hideStatus("cdStatus");
  void prepareSound();
  finishedAnnounced = false;
  countdown.start(Date.now());
  startTick();
});
byId<HTMLButtonElement>("cdPause").addEventListener("click", () => {
  countdown.pause(Date.now());
  render();
  if (countdown.state === "paused") showStatus("cdStatus", "info", t.paused);
});
byId<HTMLButtonElement>("cdReset").addEventListener("click", () => {
  if (duration() === null) {
    const seconds = countdown.durationMs / 1000;
    minuteInput.value = String(Math.floor(seconds / 60));
    secondInput.value = String(seconds % 60);
  }
  updateDuration();
});
byId<HTMLButtonElement>("swStart").addEventListener("click", () => {
  stopwatch.start(performance.now());
  hideStatus("swStatus");
  startTick();
});
byId<HTMLButtonElement>("swPause").addEventListener("click", () => {
  stopwatch.pause(performance.now());
  render();
  showStatus("swStatus", "info", t.paused);
});
byId<HTMLButtonElement>("swLap").addEventListener("click", () => {
  const lap = stopwatch.lap(performance.now());
  if (!lap) return;
  const item = document.createElement("li");
  for (const [i, value] of [
    String(stopwatch.laps.length).padStart(2, "0"),
    stopwatchText(lap.split),
    stopwatchText(lap.elapsed),
  ].entries()) {
    const cell = document.createElement(i === 2 ? "strong" : "span");
    cell.textContent = value;
    item.append(cell);
  }
  item.setAttribute(
    "aria-label",
    `${t.lapNumber} ${stopwatch.laps.length}, ${t.lapSplit} ${stopwatchText(lap.split)}, ${t.lapTotal} ${stopwatchText(lap.elapsed)}`,
  );
  byId<HTMLOListElement>("swLaps").prepend(item);
  byId<HTMLElement>("swLapEmpty").hidden = true;
});
byId<HTMLButtonElement>("swReset").addEventListener("click", () => {
  stopwatch.reset();
  byId<HTMLElement>("swLaps").replaceChildren();
  byId<HTMLElement>("swLapEmpty").hidden = false;
  hideStatus("swStatus");
  render();
});
document.addEventListener("visibilitychange", () => {
  if (!document.hidden) render();
});
window.addEventListener("pagehide", () => {
  clearInterval(tick);
  tick = undefined;
  void audio?.close();
  audio = null;
});
window.addEventListener("pageshow", (event) => {
  if (event.persisted) startTick();
});
render();
