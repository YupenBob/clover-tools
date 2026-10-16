import {
  FLIGHT_ROUTES,
  FLIGHT_STORAGE,
  flightRoute,
  createFlight,
  advanceFlight,
  pauseFlight,
  resumeFlight,
  parseFlight,
  parseFlightHistory,
  flightRecord,
  addFlightRecord,
  routeGeometry,
  mapPoint,
  type FlightSession,
  type FlightRecord,
} from "../lib/focus-flight";
import {
  flightDistance,
  flightPhase,
  greatCircle,
  type FlightMood,
} from "../lib/flight-experience";
import type { FlightText } from "../lib/focus-flight-i18n";
import type { JourneyText } from "../lib/flight-journey-i18n";
import { byId as queryById } from "./toolkit";
import { canvasBlob, saveBlob, wrapCanvasText } from "./fun-ui";
import { boardingTear } from "./flight/tear";
import { CabinAudio } from "./flight/audio";
// @ts-ignore The installed barcode package has no bundled type declarations.
import JsBarcode from "jsbarcode";

const byId = <T extends Element = HTMLElement>(id: string) => queryById<T>(id);
const {
  lang,
  copy: t,
  journey: j,
  airports,
} = JSON.parse(byId("ffData").textContent ?? "{}") as {
  lang: string;
  copy: FlightText;
  journey: JourneyText;
  airports: { code: string; city: string; label: string }[];
};
const locale =
  (
    { zh: "zh-CN", tw: "zh-TW", en: "en", ko: "ko", ja: "ja" } as Record<
      string,
      string
    >
  )[lang] ?? "zh-CN";
const root = byId("ffRoot"),
  originalTitle = document.title;
const timeFormat = new Intl.DateTimeFormat(locale, {
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const dateFormat = new Intl.DateTimeFormat(locale, {
  month: "short",
  day: "numeric",
  hour: "2-digit",
  minute: "2-digit",
  hour12: false,
});
const text = (id: string, value: string | number) => {
  byId(id).textContent = String(value);
};
const notice = (value: string) => text("ffNotice", value);
let storageAvailable = true;
function readStorage(key: string) {
  try {
    return localStorage.getItem(key);
  } catch {
    storageAvailable = false;
    return null;
  }
}
function writeStorage(key: string, value: unknown) {
  try {
    if (value === null) localStorage.removeItem(key);
    else localStorage.setItem(key, JSON.stringify(value));
  } catch {
    storageAvailable = false;
  }
  text("ffLocalNote", storageAvailable ? t.local : t.storageError);
}
let session: FlightSession | null = parseFlight(
  readStorage(FLIGHT_STORAGE.active),
  Date.now(),
);
let history = parseFlightHistory(readStorage(FLIGHT_STORAGE.history));
let boardingPassId = "",
  ticketIssuedAt = Date.now(),
  ticketCode = "";
let routeId: string = session?.routeId ?? FLIGHT_ROUTES[0].id;
let historyDay = "",
  saving = false,
  immersive = false,
  skippedTakeoff = false;
let view: "window" | "map" = "map",
  camera: "route" | "follow" | "navigation" = "route";
let cameraRotation = 0,
  targetRotation = 0;
let cameraBox = [240, 230, 460, 285],
  targetBox = [...cameraBox],
  frame = 0,
  previousFrame = 0;
const audio = new CabinAudio();
let wantsSound = false,
  soundRevision = 0;
const reduced = matchMedia("(prefers-reduced-motion:reduce)");
let sceneWidth = 800,
  sceneHeight = 500;
let paintedBox = "",
  paintedGeographySize = "",
  paintedGeographyPosition = "",
  paintedPlane = "",
  paintedRoute = "",
  paintedUnit = -1;
function routeInfo(id = routeId) {
  const route = flightRoute(id) ?? FLIGHT_ROUTES[0];
  return {
    route,
    from: airports.find((a) => a.code === route.from)!.city,
    to: airports.find((a) => a.code === route.to)!.city,
  };
}
function configuredMinutes(): number | null {
  const value = byId<HTMLInputElement>("ffMinutes").value,
    minutes = Number(value);
  return value.trim() &&
    Number.isInteger(minutes) &&
    minutes >= 1 &&
    minutes <= 180
    ? minutes
    : null;
}
function minutesChoice() {
  document
    .querySelectorAll<HTMLButtonElement>("[data-minutes]")
    .forEach((b) =>
      b.setAttribute(
        "aria-pressed",
        String(Number(b.dataset.minutes) === configuredMinutes()),
      ),
    );
}
function durationValidation(valid: boolean) {
  byId("ffValidation").hidden = valid;
  text("ffValidation", valid ? "" : t.invalid);
  byId("ffMinutes").setAttribute("aria-invalid", String(!valid));
}
function persist() {
  writeStorage(FLIGHT_STORAGE.active, session);
}
function fitCamera(progress = 0) {
  const ratio = sceneWidth / Math.max(1, sceneHeight);
  const route = routeInfo().route,
    from = mapPoint(route.origin),
    to = mapPoint(route.destination);
  const current = mapPoint(
    greatCircle(route.origin, route.destination, progress),
  );
  const g = { from, to, x: current[0], y: current[1] },
    width = Math.max(
      220,
      Math.abs(g.to[0] - g.from[0]) * 1.8,
      Math.abs(g.to[1] - g.from[1]) * ratio * 1.7,
    );
  const w =
      camera === "navigation"
        ? Math.max(65, Math.min(300, 140 * ratio))
        : camera === "follow"
          ? Math.max(160, width * 0.6)
          : width,
    h = w / ratio;
  // Route sits to the right of the clock in a wide scene; centered on phones.
  const wide = ratio > 1.25,
    centerX = camera !== "route" ? g.x : (g.from[0] + g.to[0]) / 2,
    centerY = camera !== "route" ? g.y : (g.from[1] + g.to[1]) / 2;
  targetBox = [
    centerX - w * (camera === "navigation" ? 0.5 : wide ? 0.63 : 0.5),
    centerY - h * (camera === "navigation" ? 0.64 : 0.44),
    w,
    h,
  ];
  const before = mapPoint(
    greatCircle(route.origin, route.destination, Math.max(0, progress - 0.001)),
  );
  const after = mapPoint(
    greatCircle(route.origin, route.destination, Math.min(1, progress + 0.001)),
  );
  targetRotation =
    camera === "navigation"
      ? -90 -
        (Math.atan2(after[1] - before[1], after[0] - before[0]) * 180) / Math.PI
      : 0;
}
function paintMap(progress: number) {
  const a = mapPoint(
    greatCircle(
      routeInfo().route.origin,
      routeInfo().route.destination,
      progress,
    ),
  );
  const b = mapPoint(
    greatCircle(
      routeInfo().route.origin,
      routeInfo().route.destination,
      Math.min(1, progress + 0.001),
    ),
  );
  const before = mapPoint(
    greatCircle(
      routeInfo().route.origin,
      routeInfo().route.destination,
      Math.max(0, progress - 0.001),
    ),
  );
  const angle =
    (Math.atan2(b[1] - before[1], b[0] - before[0]) * 180) / Math.PI;
  const unit = cameraBox[2] / sceneWidth;
  if (reduced.matches) cameraRotation = targetRotation;
  const world = byId("ffMapWorld");
  world.style.transformOrigin = `${(a[0] - cameraBox[0]) / unit}px ${(a[1] - cameraBox[1]) / unit}px`;
  world.style.transform = `rotate(${cameraRotation}deg)`;
  root.dataset.camera = camera;
  root.dataset.heading = String((angle + 90 + 360) % 360);
  for (const [id, point] of [
    ["ffOriginLabel", mapPoint(routeInfo().route.origin)],
    ["ffDestinationLabel", mapPoint(routeInfo().route.destination)],
  ] as const) {
    byId(id).setAttribute(
      "transform",
      `translate(${point.join(" ")}) rotate(${-cameraRotation}) translate(${unit * 10} ${-unit * 12})`,
    );
  }
  const plane =
    "translate(" +
    a.map((v) => v.toFixed(3)).join(" ") +
    ") rotate(" +
    angle.toFixed(3) +
    ") scale(" +
    (unit * 0.72).toFixed(4) +
    ")";
  if (plane !== paintedPlane) {
    byId("ffPlane").setAttribute("transform", plane);
    paintedPlane = plane;
  }
  const box = cameraBox.map((v) => v.toFixed(3)).join(" ");
  if (box !== paintedBox) {
    byId("ffMapSvg").setAttribute("viewBox", box);
    paintedBox = box;
  }
  // A static SVG surface moves in the compositor; route updates paint only the overlay.
  const ground = byId("ffGeographyLayer");
  if (!paintedGeographySize) {
    byId("ffGeographySvg").setAttribute(
      "viewBox",
      "0 0 " + ground.dataset.width + " " + ground.dataset.height,
    );
    byId("ffGeographySvg").setAttribute("preserveAspectRatio", "none");
  }
  const groundUnit = targetBox[2] / sceneWidth;
  const groundSize = [
    Number(ground.dataset.width) / groundUnit,
    Number(ground.dataset.height) / groundUnit,
  ].map((n) => n.toFixed(3) + "px");
  if (groundSize.join(" ") !== paintedGeographySize) {
    ground.style.width = groundSize[0];
    ground.style.height = groundSize[1];
    paintedGeographySize = groundSize.join(" ");
  }
  const groundPosition =
    "translate3d(" +
    (-cameraBox[0] / unit).toFixed(3) +
    "px," +
    (-cameraBox[1] / unit).toFixed(3) +
    "px,0) scale(" +
    (groundUnit / unit).toFixed(7) +
    ")";
  if (groundPosition !== paintedGeographyPosition) {
    ground.style.transform = groundPosition;
    paintedGeographyPosition = groundPosition;
  }
  const route = routeInfo().route;
  const count = Math.max(2, Math.ceil(progress * 64) + 1);
  const traveled =
    progress === 0
      ? ""
      : Array.from({ length: count }, (_, i) => {
          const point = mapPoint(
            greatCircle(
              route.origin,
              route.destination,
              (progress * i) / (count - 1),
            ),
          );
          return (i ? "L" : "M") + point.map((v) => v.toFixed(3)).join(" ");
        }).join(" ");
  if (traveled !== paintedRoute) {
    byId("ffRouteProgress").setAttribute("d", traveled);
    paintedRoute = traveled;
  }
  if (Math.abs(unit - paintedUnit) < 0.0001) return;
  paintedUnit = unit;
  for (const id of ["ffOriginDot", "ffDestinationDot"])
    byId(id).setAttribute("r", String(unit * 3.2));
  for (const id of ["ffOriginLabel", "ffDestinationLabel"]) {
    byId(id)
      .querySelectorAll("text")
      .forEach((node, i) => {
        node.setAttribute("font-size", String(unit * (i ? 10 : 12)));
        if (i) node.setAttribute("dy", String(unit * 14));
      });
  }
}
function updateRoute() {
  const { route, from, to } = routeInfo(),
    g = routeGeometry(routeId);
  const selector = byId<HTMLSelectElement>("ffRouteSelect");
  selector.querySelector("[data-custom-route]")?.remove();
  if (routeId.startsWith("airport:")) {
    const custom = new Option(`${from} → ${to}`, routeId);
    custom.dataset.customRoute = "true";
    custom.disabled = true;
    selector.add(custom);
  }
  selector.value = routeId;
  byId<HTMLSelectElement>("ffOriginSelect").value = route.from;
  byId<HTMLSelectElement>("ffDestinationSelect").value = route.to;
  byId<HTMLSelectElement>("ffDestinationSelect")
    .querySelectorAll("option")
    .forEach((option) => (option.disabled = option.value === route.from));
  text("ffFromCity", from);
  text("ffToCity", to);
  text("ffFromCode", route.from);
  text("ffToCode", route.to);
  text("ffLandingCity", to);
  text(
    "ffMapDescription",
    from + " (" + route.from + ") → " + to + " (" + route.to + "). " + j.ground,
  );
  byId("ffTrail").setAttribute("d", g.path);
  for (const [id, point, label, city] of [
    ["ffOriginDot", g.from, route.from, from],
    ["ffDestinationDot", g.to, route.to, to],
  ] as const) {
    byId(id).setAttribute("cx", String(point[0]));
    byId(id).setAttribute("cy", String(point[1]));
    const node = byId(
      id === "ffOriginDot" ? "ffOriginLabel" : "ffDestinationLabel",
    );
    node.setAttribute(
      "transform",
      "translate(" + (point[0] + 8) + " " + (point[1] - 8) + ")",
    );
    node.querySelector(".ff-airport-code")!.textContent = label;
    node.querySelector(".ff-airport-city")!.textContent = city;
  }
  document.querySelectorAll<HTMLButtonElement>("[data-route]").forEach((b) => {
    b.setAttribute("aria-pressed", String(b.dataset.route === routeId));
    b.disabled = !!session;
  });
  fitCamera();
  if (!lastState || reduced.matches) cameraBox = [...targetBox];
}
function fillTicket() {
  const { route, from, to } = routeInfo(),
    minutes = session
      ? session.durationMs / 60000
      : (configuredMinutes() ?? 25);
  text("ffPaperFlight", "CF " + String(minutes).padStart(3, "0"));
  text("ffPaperFrom", route.from);
  text("ffPaperTo", route.to);
  text("ffPaperFromCity", from);
  text("ffPaperToCity", to);
  text("ffPaperDuration", minutes + " " + t.minutes);
  const flight = "CF " + String(minutes).padStart(3, "0");
  const serial = String(
    ((parseInt(
      (session?.id || boardingPassId).replaceAll("-", "").slice(0, 8),
      16,
    ) || 1) %
      900) +
      100,
  );
  const issuedAt = session?.startedAt ?? ticketIssuedAt;
  text(
    "ffPaperDate",
    new Intl.DateTimeFormat("en", {
      day: "2-digit",
      month: "short",
      year: "numeric",
    })
      .format(issuedAt)
      .toUpperCase(),
  );
  text("ffPaperTime", timeFormat.format(issuedAt));
  text("ffPaperSequence", serial);
  text("ffStubFlight", flight);
  const code = flight.replace(" ", "") + route.from + route.to + "01A" + serial;
  text(
    "ffTicketSerial",
    flight + " · " + route.from + route.to + " · " + serial,
  );
  if (code !== ticketCode) {
    ticketCode = code;
    JsBarcode(byId("ffMainBarcode"), code, {
      format: "CODE128",
      displayValue: false,
      width: 1,
      height: 27,
      margin: 0,
      background: "transparent",
      lineColor: "#263f3b",
    });
    JsBarcode(byId("ffStubBarcode"), flight.replace(" ", "") + serial, {
      format: "CODE128",
      displayValue: false,
      width: 1,
      height: 32,
      margin: 0,
      background: "transparent",
      lineColor: "#263f3b",
    });
  }
  text(
    "ffPaperTask",
    session?.task ||
      byId<HTMLInputElement>("ffTask").value.trim() ||
      t.taskDefault,
  );
  text("ffStubRoute", route.from + " / " + route.to);
}
function showHistory() {
  const now = new Date();
  historyDay = now.toDateString();
  const today = history
    .filter(
      (record) => new Date(record.completedAt).toDateString() === historyDay,
    )
    .reduce((sum, record) => sum + record.durationMs / 60000, 0);
  byId("ffToday").replaceChildren(
    document.createTextNode(String(today)),
    Object.assign(document.createElement("span"), { textContent: t.minutes }),
  );
  text("ffLandings", history.length);
  byId("ffEmptyLog").hidden = history.length > 0;
  byId<HTMLButtonElement>("ffClear").disabled = !history.length;
  byId("ffLogList").replaceChildren(
    ...history.map((record) => {
      const entry = document.createElement("li");
      entry.className = "ff-log-entry";
      entry.dataset.flightId = record.id;
      const mark = document.createElement("span");
      mark.textContent = "↗";
      mark.setAttribute("aria-hidden", "true");
      const content = document.createElement("div"),
        title = document.createElement("strong"),
        info = document.createElement("p"),
        task = document.createElement("small");
      const { from, to } = routeInfo(record.routeId);
      title.textContent = from + " → " + to;
      info.textContent = t.record
        .replace("{minutes}", String(record.durationMs / 60000))
        .replace("{date}", dateFormat.format(record.completedAt));
      task.textContent = record.task || t.taskDefault;
      content.append(title, info, task);
      entry.append(mark, content);
      return entry;
    }),
  );
}
const level = (id: string) => Number(byId<HTMLInputElement>(id).value) / 100;
const preferencesKey = "clover:focus-flight:preferences:v2";
function savePreferences() {
  writeStorage(preferencesKey, {
    mood: root.dataset.mood,
    camera,
    volume: Number(byId<HTMLInputElement>("ffVolume").value),
    engine: Number(byId<HTMLInputElement>("ffEngine").value),
    airflow: Number(byId<HTMLInputElement>("ffAirflow").value),
    chime: byId<HTMLInputElement>("ffChime").checked,
    boardSound: byId<HTMLInputElement>("ffBoardSound").checked,
  });
}
function restorePreferences() {
  try {
    const p = JSON.parse(readStorage(preferencesKey) ?? "{}");
    if (!p || typeof p !== "object") return;
    if (["day", "dusk", "night"].includes(p.mood)) root.dataset.mood = p.mood;
    if (["route", "follow", "navigation"].includes(p.camera)) camera = p.camera;
    if (typeof p.boardSound === "boolean")
      byId<HTMLInputElement>("ffBoardSound").checked = p.boardSound;
    for (const [key, id] of [
      ["volume", "ffVolume"],
      ["engine", "ffEngine"],
      ["airflow", "ffAirflow"],
    ])
      if (Number.isFinite(p[key]) && p[key] >= 0 && p[key] <= 100)
        byId<HTMLInputElement>(id).value = String(p[key]);
    byId<HTMLInputElement>("ffChime").checked = p.chime === true;
    text("ffVolumeValue", byId<HTMLInputElement>("ffVolume").value + "%");
    document
      .querySelectorAll<HTMLButtonElement>("button[data-mood]")
      .forEach((b) =>
        b.setAttribute(
          "aria-pressed",
          String(b.dataset.mood === root.dataset.mood),
        ),
      );
    document
      .querySelectorAll<HTMLButtonElement>("button[data-camera]")
      .forEach((b) =>
        b.setAttribute("aria-pressed", String(b.dataset.camera === camera)),
      );
  } catch {
    /* Loading a preference never starts audio without a user gesture. */
  }
}
function updateNoise() {
  audio.update(
    level("ffVolume"),
    level("ffEngine"),
    level("ffAirflow"),
    wantsSound && session?.state === "flying",
    root.dataset.phase,
  );
}
async function startNoise() {
  const version = ++soundRevision;
  try {
    await audio.start(
      level("ffVolume"),
      level("ffEngine"),
      level("ffAirflow"),
      wantsSound && session?.state === "flying",
    );
    if (version === soundRevision) updateNoise();
  } catch {
    if (version === soundRevision) {
      wantsSound = false;
      byId("ffSound").setAttribute("aria-checked", "false");
      notice(t.soundError);
    }
  }
}
function stopNoise() {
  soundRevision++;
  audio.stop();
}
let wakeLock: WakeLockSentinel | null = null,
  requestingWake = false;
async function updateWakeLock() {
  if (session?.state !== "flying" || document.visibilityState !== "visible") {
    const lock = wakeLock;
    wakeLock = null;
    await lock?.release().catch(() => {});
    return;
  }
  if (wakeLock || requestingWake || !("wakeLock" in navigator)) return;
  requestingWake = true;
  try {
    const lock = await navigator.wakeLock.request("screen");
    if (session?.state !== "flying" || document.visibilityState !== "visible")
      await lock.release();
    else {
      wakeLock = lock;
      lock.addEventListener("release", () => {
        if (wakeLock === lock) wakeLock = null;
      });
    }
  } catch {
    /* Screen wake lock is optional. */
  } finally {
    requestingWake = false;
  }
}
function finish(arriving = false) {
  if (!session) return;
  const record = flightRecord(session);
  if (!record) return;
  const saved = parseFlightHistory(readStorage(FLIGHT_STORAGE.history));
  const isNew =
    !history.some((item) => item.id === record.id) &&
    !saved.some((item) => item.id === record.id);
  history = addFlightRecord(storageAvailable ? saved : history, record);
  writeStorage(FLIGHT_STORAGE.history, history);
  persist();
  showHistory();
  if (arriving && isNew)
    audio.chime(byId<HTMLInputElement>("ffChime").checked, level("ffVolume"));
  fillTicket();
  const main = byId("ffPaperTicket")
    .querySelector(".ff-paper-main")!
    .cloneNode(true) as HTMLElement;
  const ids = new Map<string, string>();
  main.querySelectorAll("[id]").forEach((node) => {
    const id = node.id;
    ids.set(id, "receipt-" + id);
    node.id = "receipt-" + id;
  });
  main.querySelectorAll("*").forEach((node) => {
    for (const attr of ["fill", "filter"]) {
      const value = node.getAttribute(attr);
      if (value?.startsWith("url(#")) {
        const id = value.slice(5, -1);
        if (ids.has(id)) node.setAttribute(attr, "url(#" + ids.get(id) + ")");
      }
    }
  });
  main.querySelector(".ff-paper-stamp")?.remove();
  const stamps = document.createElement("div");
  stamps.className = "ff-receipt-stamps";
  for (const label of [j.boarded, j.arrived]) {
    const mark = document.createElement("span");
    mark.textContent = label;
    stamps.append(mark);
  }
  main.append(stamps);
  byId("ffReceipt").replaceChildren(main);
  notice(
    t.complete
      .replace("{city}", routeInfo().to)
      .replace("{minutes}", String(session.durationMs / 60000)),
  );
  text("ffStampDate", dateFormat.format(record.completedAt));
  byId<HTMLDialogElement>("ffStopDialog").close();
}
let lastState = "",
  lastPhase = "";
function render(force = false) {
  const now = Date.now(),
    prior = session?.state;
  if (session) {
    session = advanceFlight(session, now);
    if (prior === "flying" && session.state === "landed") finish(true);
  }
  const state = session?.state ?? "boarding",
    minutes = session
      ? session.durationMs / 60000
      : (configuredMinutes() ?? 25);
  const remaining = session?.remainingMs ?? minutes * 60000,
    seconds = Math.ceil(remaining / 1000),
    clock =
      String(Math.floor(seconds / 60)).padStart(2, "0") +
      ":" +
      String(seconds % 60).padStart(2, "0");
  text("ffClock", clock);
  text("ffCabinClock", clock);
  const progress = session ? 1 - remaining / session.durationMs : 0,
    percent = Math.min(100, Math.floor(progress * 100));
  byId("ffProgressFill").style.width = progress * 100 + "%";
  byId("ffCabinClockFill").style.width = progress * 100 + "%";
  byId("ffProgress").setAttribute("aria-valuenow", String(percent));
  text("ffPercent", percent + "%");
  const arrival = session
    ? (session.deadline ?? session.completedAt)
    : configuredMinutes()
      ? now + minutes * 60000
      : null;
  text("ffArrivalTime", arrival ? timeFormat.format(arrival) : "—");
  text(
    "ffDistance",
    Math.round(
      flightDistance(routeInfo().route.origin, routeInfo().route.destination) *
        (session ? 1 - progress : 1),
    ).toLocaleString(locale) + " km",
  );
  text("ffDistanceLabel", session ? j.remainingDistance : j.distance);
  document.title = session
    ? clock + " · " + t[state] + " · " + originalTitle
    : originalTitle;
  const naturalPhase = session
    ? flightPhase(session.durationMs, remaining)
    : "lounge";
  const phase =
    naturalPhase === "takeoff" && skippedTakeoff ? "cruise" : naturalPhase;
  if (force || lastState !== state || lastPhase !== phase) {
    const stateChanged = lastState !== state;
    lastState = state;
    if (stateChanged) wakeControls();
    lastPhase = phase;
    root.dataset.state = state;
    root.dataset.phase = phase;
    text(
      "ffStateText",
      state === "flying"
        ? (j[phase as "takeoff" | "cruise" | "descent"] ?? t.flying)
        : t[state],
    );
    text("ffSceneTitle", state === "boarding" ? j.lounge : j.cabinLabel);
    text(
      "ffClockHint",
      state === "boarding"
        ? j.welcome
        : state === "paused"
          ? t.pausedHint
          : state === "landed"
            ? t.landedHint
            : j[
                (phase + "Hint") as "takeoffHint" | "cruiseHint" | "descentHint"
              ],
    );
    text("ffArrivalLabel", state === "landed" ? t.arrivalDone : t.arrivalTime);
    byId<HTMLFieldSetElement>("ffSettings").disabled = !!session;
    byId<HTMLInputElement>("ffBoardSound").disabled = !!session;
    byId("ffEnd").hidden = !session || state === "landed";
    byId("ffArrivalPanel").hidden = state !== "landed";
    if (state === "landed" && immersive) {
      setMixer(false);
      byId("ffSave").focus({ preventScroll: true });
    }
    byId<HTMLButtonElement>("ffSave").disabled = saving;
    byId("ffActiveTask").hidden = !session;
    text("ffActiveTask", session?.task || t.taskDefault);
    byId("ffSkip").hidden = state !== "flying" || phase !== "takeoff";
    const control = byId("ffControl");
    control.querySelector("span")!.textContent =
      state === "paused" ? t.resume : t.pause;
    control.setAttribute("aria-label", state === "paused" ? t.resume : t.pause);
    control.querySelector("i")!.className =
      "bi " + (state === "paused" ? "bi-play" : "bi-pause");
    updateNoise();
    void updateWakeLock();
  }
  if (view === "map") {
    fitCamera(progress);
    if (reduced.matches) cameraBox = [...targetBox];
    paintMap(progress);
    scheduleScene();
  }
}
function sceneFrame(now: number) {
  frame = 0;
  if (document.hidden || view !== "map") return;
  if (now - previousFrame > 32) {
    previousFrame = now;
    const current = session ? advanceFlight(session, Date.now()) : null,
      progress = current ? 1 - current.remainingMs / current.durationMs : 0;
    fitCamera(progress);
    cameraBox = cameraBox.map((n, i) =>
      reduced.matches ? targetBox[i] : n + (targetBox[i] - n) * 0.12,
    );
    const rotationDelta =
      ((((targetRotation - cameraRotation + 180) % 360) + 360) % 360) - 180;
    cameraRotation = reduced.matches
      ? targetRotation
      : cameraRotation + rotationDelta * 0.12;
    paintMap(progress);
  }
  if (
    session?.state === "flying" ||
    cameraBox.some((n, i) => Math.abs(n - targetBox[i]) > 0.01) ||
    Math.abs(
      ((((targetRotation - cameraRotation + 180) % 360) + 360) % 360) - 180,
    ) > 0.01
  )
    frame = requestAnimationFrame(sceneFrame);
}
function scheduleScene() {
  if (!frame && !document.hidden && view === "map")
    frame = requestAnimationFrame(sceneFrame);
}
function setView(value: "window" | "map") {
  view = value;
  root.dataset.view = value;
  byId("ffMapViewport").setAttribute("aria-hidden", String(value !== "map"));
  byId<HTMLElement>("ffMapViewport").inert = value !== "map";
  document
    .querySelectorAll<HTMLButtonElement>("button[data-view]")
    .forEach((b) =>
      b.setAttribute("aria-pressed", String(b.dataset.view === value)),
    );
  if (value === "map") scheduleScene();
  else {
    cancelAnimationFrame(frame);
    frame = 0;
  }
}
const siblings = new Map<HTMLElement, boolean>();
let previousFocus: HTMLElement | null = null,
  scrollPosition = 0;
function immersiveView(enabled: boolean) {
  if (immersive === enabled) return;
  immersive = enabled;
  document.documentElement.classList.toggle("ff-immersive", enabled);
  if (enabled) {
    previousFocus =
      document.activeElement instanceof HTMLElement
        ? document.activeElement
        : null;
    scrollPosition = scrollY;
    let element = root;
    while (element.parentElement) {
      for (const sibling of element.parentElement.children)
        if (sibling !== element && sibling instanceof HTMLElement) {
          siblings.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      element = element.parentElement;
      if (element === document.body) break;
    }
    if (session?.state !== "landed") root.focus({ preventScroll: true });
    else byId("ffSave").focus({ preventScroll: true });
  } else {
    for (const [element, inert] of siblings) element.inert = inert;
    siblings.clear();
    setMixer(false);
    if (document.fullscreenElement)
      void document.exitFullscreen().catch(() => {});
    window.scrollTo(0, scrollPosition);
    (previousFocus?.offsetParent ? previousFocus : byId("ffImmersive")).focus({
      preventScroll: true,
    });
  }
  byId("ffImmersive").setAttribute("aria-pressed", String(enabled));
  byId("ffImmersive").querySelector("span")!.textContent = enabled
    ? t.exitImmersive
    : t.immersive;
  byId("ffImmersiveHint").hidden = !enabled;
  wakeControls();
  resizeScene();
}
function reset() {
  session = null;
  persist();
  skippedTakeoff = false;
  immersiveView(false);
  setView("map");
  notice("");
  durationValidation(true);
  updateRoute();
  render(true);
}
function adopt(value: FlightSession) {
  session = value;
  routeId = value.routeId;
  byId<HTMLInputElement>("ffTask").value = value.task;
  byId<HTMLInputElement>("ffMinutes").value = String(value.durationMs / 60000);
  byId<HTMLDialogElement>("ffBoardingDialog").close();
  minutesChoice();
  updateRoute();
  if (value.state === "landed") finish();
  render(true);
}
const boardDialog = byId<HTMLDialogElement>("ffBoardingDialog");
const tear = boardingTear({
  ticket: byId("ffPaperTicket"),
  stub: byId<HTMLButtonElement>("ffTear"),
  dialog: boardDialog,
  onProgress: (p) => {
    if (wantsSound) audio.tear(p, level("ffVolume"));
  },
  onCommit: async () => {
    const begin = () => {
      const existing = parseFlight(
        readStorage(FLIGHT_STORAGE.active),
        Date.now(),
      );
      if (existing && existing.state !== "landed") {
        adopt(existing);
        setView("window");
        immersiveView(true);
        return false;
      }
      if (session || !boardDialog.open) return false;
      const minutes = configuredMinutes();
      if (minutes === null) return false;
      session = createFlight(
        boardingPassId,
        routeId,
        byId<HTMLInputElement>("ffTask").value,
        minutes,
        Date.now(),
      );
      skippedTakeoff = false;
      persist();
      fillTicket();
      render(true);
      updateRoute();
      notice("");
      if (wantsSound) audio.chime(true, level("ffVolume") * 0.65);
      return true;
    };
    return "locks" in navigator
      ? await navigator.locks.request("clover-focus-flight-boarding", begin)
      : begin();
  },
  onDepart: () => {
    boardDialog.close();
    setView("window");
    immersiveView(true);
  },
});
byId<HTMLFormElement>("ffForm").addEventListener("submit", (event) => {
  event.preventDefault();
  if (session) return;
  const minutes = configuredMinutes();
  durationValidation(minutes !== null);
  if (minutes === null) {
    byId("ffMinutes").focus();
    return;
  }
  boardingPassId = crypto.randomUUID();
  ticketIssuedAt = Date.now();
  tear.reset();
  fillTicket();
  text(
    "ffTearHint",
    matchMedia("(max-width:760px)").matches ? j.mobileTearHint : j.tearHint,
  );
  boardDialog.showModal();
  byId("ffTear").focus({ preventScroll: true });
  wantsSound = byId<HTMLInputElement>("ffBoardSound").checked;
  byId("ffSound").setAttribute("aria-checked", String(wantsSound));
  savePreferences();
  if (wantsSound) void startNoise();
  else if (byId<HTMLInputElement>("ffChime").checked)
    void audio.ready().catch(() => notice(t.soundError));
});
byId("ffBoardClose").addEventListener("click", () => {
  if (!session && !byId<HTMLButtonElement>("ffTear").disabled) {
    tear.cancel();
    boardDialog.close();
  }
});
byId("ffControl").addEventListener("click", () => {
  render();
  if (!session || session.state === "landed") return;
  session =
    session.state === "flying"
      ? pauseFlight(session, Date.now())
      : resumeFlight(session, Date.now());
  persist();
  render(true);
  if (wantsSound) void startNoise();
});
byId("ffAgain").addEventListener("click", reset);
byId("ffSkip").addEventListener("click", () => {
  skippedTakeoff = true;
  render(true);
});
byId<HTMLInputElement>("ffMinutes").addEventListener("input", () => {
  durationValidation(true);
  minutesChoice();
  render();
});
document.querySelectorAll<HTMLButtonElement>("[data-minutes]").forEach((b) =>
  b.addEventListener("click", () => {
    if (session) return;
    byId<HTMLInputElement>("ffMinutes").value = b.dataset.minutes!;
    durationValidation(true);
    minutesChoice();
    render();
  }),
);
function chooseRoute(id: string) {
  if (session) return;
  routeId = id;
  byId<HTMLInputElement>("ffMinutes").value = String(routeInfo().route.minutes);
  durationValidation(true);
  minutesChoice();
  updateRoute();
  render(true);
}
document
  .querySelectorAll<HTMLButtonElement>("[data-route]")
  .forEach((b) =>
    b.addEventListener("click", () => chooseRoute(b.dataset.route!)),
  );
byId<HTMLSelectElement>("ffRouteSelect").addEventListener("change", () =>
  chooseRoute(byId<HTMLSelectElement>("ffRouteSelect").value),
);
function chooseAirports() {
  if (session) return;
  const origin = byId<HTMLSelectElement>("ffOriginSelect").value;
  let destination = byId<HTMLSelectElement>("ffDestinationSelect").value;
  if (origin === destination) destination = routeInfo().route.from;
  routeId =
    FLIGHT_ROUTES.find((r) => r.from === origin && r.to === destination)?.id ??
    `airport:${origin}-${destination}`;
  if (!flightRoute(routeId)) return;
  updateRoute();
  render(true);
}
byId("ffOriginSelect").addEventListener("change", chooseAirports);
byId("ffDestinationSelect").addEventListener("change", chooseAirports);
byId("ffSwapAirports").addEventListener("click", () => {
  if (session) return;
  const { route } = routeInfo();
  byId<HTMLSelectElement>("ffOriginSelect").value = route.to;
  byId<HTMLSelectElement>("ffDestinationSelect").value = route.from;
  chooseAirports();
});
document
  .querySelectorAll<HTMLButtonElement>("button[data-view]")
  .forEach((b) =>
    b.addEventListener("click", () =>
      setView(b.dataset.view as "window" | "map"),
    ),
  );
document
  .querySelectorAll<HTMLButtonElement>("button[data-camera]")
  .forEach((b) =>
    b.addEventListener("click", () => {
      camera = b.dataset.camera as "route" | "follow" | "navigation";
      document
        .querySelectorAll("button[data-camera]")
        .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
      fitCamera(
        session
          ? 1 -
              advanceFlight(session, Date.now()).remainingMs /
                session.durationMs
          : 0,
      );
      scheduleScene();
      savePreferences();
    }),
  );
document.querySelectorAll<HTMLButtonElement>("button[data-mood]").forEach((b) =>
  b.addEventListener("click", () => {
    root.dataset.mood = b.dataset.mood as FlightMood;
    document
      .querySelectorAll("button[data-mood]")
      .forEach((n) => n.setAttribute("aria-pressed", String(n === b)));
    savePreferences();
  }),
);
byId("ffImmersive").addEventListener("click", () => immersiveView(!immersive));
byId("ffFullscreen").addEventListener("click", () => {
  if (document.fullscreenElement)
    void document.exitFullscreen().catch(() => {});
  else {
    immersiveView(true);
    void root.requestFullscreen?.().catch(() => {});
  }
});
function setMixer(open: boolean) {
  root.dataset.mixer = String(open);
  byId("ffMixer").setAttribute("aria-expanded", String(open));
}
byId("ffMixer").addEventListener("click", () => {
  if (!immersive) {
    byId("ffAudioPanel").scrollIntoView({
      behavior: reduced.matches ? "instant" : "smooth",
      block: "center",
    });
    byId("ffSound").focus({ preventScroll: true });
    return;
  }
  const open = root.dataset.mixer !== "true";
  setMixer(open);
  if (open)
    root
      .querySelector<HTMLButtonElement>("button[data-mood]")!
      .focus({ preventScroll: true });
});
document.addEventListener("keydown", (event) => {
  if (event.key !== "Escape" || document.querySelector("dialog[open]")) return;
  if (root.dataset.mixer === "true") {
    setMixer(false);
    byId("ffMixer").focus();
    event.preventDefault();
  } else if (immersive) immersiveView(false);
});
byId("ffEnd").addEventListener("click", () => {
  render();
  if (session && session.state !== "landed")
    byId<HTMLDialogElement>("ffStopDialog").showModal();
});
byId("ffKeepFlying").addEventListener("click", () =>
  byId<HTMLDialogElement>("ffStopDialog").close(),
);
byId("ffStopConfirm").addEventListener("click", () => {
  byId<HTMLDialogElement>("ffStopDialog").close();
  render();
  if (session && session.state !== "landed") {
    reset();
    wantsSound = false;
    byId("ffSound").setAttribute("aria-checked", "false");
    stopNoise();
  }
});
byId("ffClear").addEventListener("click", () => {
  if (history.length) byId<HTMLDialogElement>("ffClearDialog").showModal();
});
byId("ffClearCancel").addEventListener("click", () =>
  byId<HTMLDialogElement>("ffClearDialog").close(),
);
byId("ffClearConfirm").addEventListener("click", () => {
  history = [];
  writeStorage(FLIGHT_STORAGE.history, history);
  showHistory();
  byId<HTMLDialogElement>("ffClearDialog").close();
  if (session?.state === "landed") writeStorage(FLIGHT_STORAGE.active, null);
});
byId("ffSound").addEventListener("click", () => {
  wantsSound = !wantsSound;
  byId("ffSound").setAttribute("aria-checked", String(wantsSound));
  byId<HTMLInputElement>("ffBoardSound").checked = wantsSound;
  savePreferences();
  if (wantsSound) void startNoise();
  else stopNoise();
});
byId("ffBoardSound").addEventListener("change", () => {
  wantsSound = byId<HTMLInputElement>("ffBoardSound").checked;
  byId("ffSound").setAttribute("aria-checked", String(wantsSound));
  if (!wantsSound) stopNoise();
  savePreferences();
});
for (const id of ["ffVolume", "ffEngine", "ffAirflow"])
  byId<HTMLInputElement>(id).addEventListener("input", () => {
    text("ffVolumeValue", byId<HTMLInputElement>("ffVolume").value + "%");
    updateNoise();
    savePreferences();
  });
byId<HTMLInputElement>("ffChime").addEventListener("change", () => {
  savePreferences();
  if (byId<HTMLInputElement>("ffChime").checked)
    void audio.ready().catch(() => notice(t.soundError));
});

async function saveCard(record: FlightRecord) {
  const canvas = document.createElement("canvas");
  canvas.width = 1080;
  canvas.height = 900;
  const ctx = canvas.getContext("2d")!,
    { route, from, to } = routeInfo(record.routeId),
    g = routeGeometry(record.routeId);
  ctx.fillStyle = "#152c32";
  ctx.fillRect(0, 0, 1080, 900);
  ctx.save();
  ctx.beginPath();
  ctx.moveTo(40, 34);
  ctx.lineTo(1030, 34);
  for (let y = 34; y < 862; y += 8) ctx.lineTo(y % 3 === 0 ? 1038 : 1031, y);
  ctx.lineTo(40, 866);
  ctx.closePath();
  ctx.clip();
  ctx.fillStyle = "#f2eee0";
  ctx.fillRect(40, 34, 1000, 840);
  ctx.fillStyle = "#29493f";
  ctx.font = "18px ui-monospace,monospace";
  ctx.font = "600 23px system-ui,sans-serif";
  ctx.fillText("Clover航空", 78, 90);
  ctx.font = "12px ui-monospace,monospace";
  ctx.fillText("CLOVER AIR", 260, 90);
  ctx.textAlign = "right";
  ctx.font = "14px ui-monospace,monospace";
  ctx.fillText("BOARDING PASS · 01A", 998, 90);
  ctx.textAlign = "left";
  ctx.fillStyle = "#17363e";
  ctx.fillRect(40, 120, 1000, 305);
  const w = Math.max(
      220,
      Math.abs(g.to[0] - g.from[0]) * 1.7,
      Math.abs(g.to[1] - g.from[1]) * 3.3 * 1.6,
    ),
    h = w / 3.3,
    x = (g.from[0] + g.to[0]) / 2 - w / 2,
    y = (g.from[1] + g.to[1]) / 2 - h / 2;
  ctx.save();
  ctx.beginPath();
  ctx.rect(40, 120, 1000, 305);
  ctx.clip();
  ctx.translate(40 - (x * 1000) / w, 120 - (y * 1000) / w);
  ctx.scale(1000 / w, 1000 / w);
  const land = byId("ffGeographySvg").querySelector(
    'path[fill="url(#fmLand)"]',
  )!;
  ctx.fillStyle = "#36534e";
  ctx.strokeStyle = "#719388";
  ctx.lineWidth = w / 2000;
  const path = new Path2D(land.getAttribute("d")!);
  ctx.fill(path, "evenodd");
  ctx.stroke(path);
  ctx.strokeStyle = "#ebd6a8";
  ctx.lineWidth = w / 700;
  ctx.beginPath();
  const routePath = new Path2D(g.path);
  ctx.stroke(routePath);
  ctx.fillStyle = "#f8eac5";
  for (const p of [g.from, g.to]) {
    ctx.beginPath();
    ctx.arc(p[0], p[1], w / 170, 0, Math.PI * 2);
    ctx.fill();
  }
  ctx.restore();
  ctx.fillStyle = "#29493f";
  ctx.font = "48px ui-monospace,monospace";
  ctx.fillText(route.from, 78, 497);
  ctx.textAlign = "right";
  ctx.fillText(route.to, 998, 497);
  ctx.font = "22px system-ui,sans-serif";
  ctx.fillText(to, 998, 535);
  ctx.textAlign = "left";
  ctx.fillText(from, 78, 535);
  ctx.strokeStyle = "#b9c0ad";
  ctx.beginPath();
  ctx.moveTo(78, 564);
  ctx.lineTo(998, 564);
  ctx.stroke();
  ctx.fillStyle = "#81907c";
  ctx.font = "15px system-ui,sans-serif";
  ctx.fillText(j.taskLabel, 78, 603);
  ctx.fillStyle = "#29493f";
  ctx.font = "24px system-ui,sans-serif";
  wrapCanvasText(ctx, record.task || t.taskDefault, 78, 641, 640, 33);
  ctx.fillStyle = "#81907c";
  ctx.font = "14px system-ui,sans-serif";
  ctx.fillText(t.duration, 78, 744);
  ctx.fillText(t.arrivalDone, 350, 744);
  ctx.fillStyle = "#29493f";
  ctx.font = "32px ui-monospace,monospace";
  ctx.fillText(String(record.durationMs / 60000), 78, 786);
  ctx.font = "17px system-ui,sans-serif";
  ctx.fillText(t.minutes, 145, 786);
  ctx.fillText(dateFormat.format(record.completedAt), 350, 785);
  ctx.save();
  ctx.translate(855, 688);
  ctx.rotate(-0.15);
  ctx.strokeStyle = "#557e68";
  ctx.lineWidth = 3;
  ctx.strokeRect(-110, -42, 220, 84);
  ctx.lineWidth = 1;
  ctx.strokeRect(-104, -36, 208, 72);
  ctx.fillStyle = "#557e68";
  ctx.textAlign = "center";
  ctx.font = "11px ui-monospace,monospace";
  ctx.fillText("CLOVER AIR", 0, -20);
  ctx.font = "23px system-ui,sans-serif";
  ctx.fillText(j.arrived, 0, 10);
  ctx.font = "10px ui-monospace,monospace";
  ctx.fillText("TIME WELL SPENT", 0, 29);
  ctx.restore();
  ctx.fillStyle = "#83917d";
  ctx.font = "12px ui-monospace,monospace";
  ctx.fillText("FIRST CLASS FOCUS · BOARDED & ARRIVED", 78, 835);
  ctx.textAlign = "right";
  ctx.fillText("CLOVERTOOLS.CN", 998, 835);
  ctx.restore();
  saveBlob(
    "clover-focus-flight-" + route.from + "-" + route.to + ".png",
    await canvasBlob(canvas),
  );
}
byId("ffSave").addEventListener("click", async () => {
  const record = session && flightRecord(session);
  if (!record || saving) return;
  saving = true;
  byId<HTMLButtonElement>("ffSave").disabled = true;
  try {
    await saveCard(record);
    notice(t.saved);
  } catch {
    notice(t.exportError);
  } finally {
    saving = false;
    byId<HTMLButtonElement>("ffSave").disabled = false;
  }
});
function resizeScene() {
  const bounds = byId("ffStage").getBoundingClientRect();
  sceneWidth = bounds.width || 800;
  sceneHeight = bounds.height || 500;
  const mobile = matchMedia("(max-width:760px)").matches;
  byId("ffCabinArt").setAttribute(
    "viewBox",
    sceneWidth < sceneHeight
      ? immersive
        ? "720 0 650 950"
        : "560 0 880 900"
      : "0 0 1440 900",
  );
  root.querySelectorAll(".ff-torn-fibers").forEach((svg) => {
    svg.setAttribute("viewBox", mobile ? "0 0 340 10" : "0 0 10 340");
    const points = Array.from({ length: 85 }, (_, i) => {
      const v = i % 3 === 0 ? 8 : i % 3 === 1 ? 3 : 6;
      return "L" + (mobile ? i * 4 : v) + " " + (mobile ? v : i * 4);
    }).join("");
    svg
      .querySelector("path")!
      .setAttribute("d", "M0 0" + points + (mobile ? "L340 0Z" : "L0 340Z"));
  });
  root.querySelectorAll(".ff-perforation").forEach((svg) => {
    svg.setAttribute("viewBox", mobile ? "0 0 340 2" : "0 0 2 340");
    svg
      .querySelector("path")!
      .setAttribute("d", mobile ? "M0 1H340" : "M1 0V340");
  });
  fitCamera();
  scheduleScene();
}
new ResizeObserver(resizeScene).observe(byId("ffStage"));
let idleTimer = 0,
  keyboardNavigation = false;
function setControlsVisible(visible: boolean) {
  if (!visible) {
    setMixer(false);
    if (
      document.activeElement instanceof HTMLElement &&
      document.activeElement.closest("[data-flight-chrome], #ffPreferences")
    )
      root.focus({ preventScroll: true });
    clearTimeout(idleTimer);
  }
  root.dataset.idle = String(!visible);
  byId("ffReveal").setAttribute("aria-expanded", String(visible));
  byId("ffReveal").setAttribute(
    "aria-label",
    visible ? j.hideControls : j.flightControls,
  );
}
function wakeControls() {
  setControlsVisible(true);
  clearTimeout(idleTimer);
  idleTimer = window.setTimeout(() => {
    if (
      immersive &&
      session?.state === "flying" &&
      root.dataset.mixer !== "true" &&
      !(
        keyboardNavigation &&
        document.activeElement instanceof HTMLElement &&
        document.activeElement.closest("[data-flight-chrome], #ffReveal")
      ) &&
      !document.querySelector("dialog[open]")
    )
      setControlsVisible(false);
  }, 4200);
}
root.addEventListener(
  "pointermove",
  (event) => {
    // A passing cursor should not interrupt quiet cruising. The bottom edge is
    // the mouse affordance; a tap anywhere on the scene works on touch screens.
    const overReveal =
      event.target instanceof Element && event.target.closest("#ffReveal");
    if (
      root.dataset.idle !== "true" ||
      (!overReveal && event.clientY > innerHeight - 100)
    )
      wakeControls();
  },
  { passive: true },
);
root.addEventListener(
  "pointerdown",
  (event) => {
    keyboardNavigation = false;
    if (
      immersive &&
      root.dataset.mixer === "true" &&
      event.target instanceof Element &&
      !event.target.closest("#ffPreferences, #ffMixer")
    )
      setMixer(false);
    wakeControls();
  },
  { passive: true },
);
root.addEventListener("keydown", () => {
  keyboardNavigation = true;
  wakeControls();
});
root.addEventListener("focusin", wakeControls);
root.addEventListener("focusout", wakeControls);
let revealWasIdle = false;
byId("ffReveal").addEventListener("pointerdown", (event) => {
  event.stopPropagation();
  keyboardNavigation = false;
  revealWasIdle = root.dataset.idle === "true";
});
byId("ffReveal").addEventListener("click", (event) => {
  if ((event.detail > 0 && revealWasIdle) || root.dataset.idle === "true")
    wakeControls();
  else if (session?.state === "flying") setControlsVisible(false);
});
window.addEventListener("resize", resizeScene);
document.addEventListener("visibilitychange", () => {
  if (document.hidden) {
    cancelAnimationFrame(frame);
    frame = 0;
    tear.cancel();
  } else {
    render();
    scheduleScene();
  }
  void updateWakeLock();
});
window.addEventListener("storage", (event) => {
  if (event.key === FLIGHT_STORAGE.active || event.key === null) {
    const value = parseFlight(readStorage(FLIGHT_STORAGE.active), Date.now());
    if (value) {
      adopt(value);
    } else {
      session = null;
      boardDialog.close();
      immersiveView(false);
      setView("map");
      updateRoute();
      render(true);
    }
  }
  if (event.key === FLIGHT_STORAGE.history || event.key === null) {
    history = parseFlightHistory(readStorage(FLIGHT_STORAGE.history));
    showHistory();
  }
});
window.addEventListener("pagehide", () => {
  audio.suspend();
  void wakeLock?.release().catch(() => {});
});
window.addEventListener("pageshow", () => {
  render();
  void updateWakeLock();
  if (wantsSound) void startNoise();
});
if (session) {
  byId<HTMLInputElement>("ffTask").value = session.task;
  byId<HTMLInputElement>("ffMinutes").value = String(
    session.durationMs / 60000,
  );
  if (session.state === "landed") finish();
  else notice(t.restored);
  setView("window");
}
restorePreferences();
text("ffLocalNote", storageAvailable ? t.local : t.storageError);
minutesChoice();
showHistory();
updateRoute();
render(true);
resizeScene();
scheduleScene();
setInterval(() => {
  if (session?.state === "flying") render();
  if (new Date().toDateString() !== historyDay) showHistory();
}, 250);
