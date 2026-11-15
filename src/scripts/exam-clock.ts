import {
  STORAGE_KEY,
  defaults,
  deserializeStorage,
  serializeStorage,
  validateExam,
  formatClock,
  formatRemaining,
  beijingInput,
  parseBeijing,
  progressFor,
  advanceExam,
  computeOffset,
  validateTimeResponse,
  anchoredNow,
  detectJump,
  type Stored,
  type Draft,
  type Anchor,
  type FieldError,
  type TimeResponse,
} from "../lib/exam-clock";
import type { ExamText } from "../lib/exam-clock-i18n";
// This module has one root, one refresh loop, and one in-flight sampling round.
const root = document.getElementById("examClock");
if (root) boot(root);
function boot(root: HTMLElement) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const input = (id: string) => el<HTMLInputElement>(id);
  const button = (id: string) => el<HTMLButtonElement>(id);
  const select = (id: string) => el<HTMLSelectElement>(id);
  const text = (id: string, value: string) => {
    const e = el(id);
    if (e.textContent !== value) e.textContent = value;
  };
  const t = JSON.parse(el("examClockText").textContent || "{}") as ExamText;
  const tr = (template: string, values: Record<string, string | number>) =>
    template.replace(/\{(\w+)\}/g, (_, k: string) => String(values[k] ?? ""));
  const locale = (
    {
      zh: "zh-CN",
      tw: "zh-TW",
      en: "en-GB",
      ja: "ja-JP",
      ko: "ko-KR",
    } as Record<string, string>
  )[root.dataset.lang || "zh"];
  const notice = (v: string) => text("ecNotice", v);
  let state: Stored = defaults(),
    storageBlocked = false,
    persistenceAllowed = false;
  try {
    const saved = localStorage.getItem(STORAGE_KEY);
    if (saved !== null) {
      try {
        state = deserializeStorage(saved);
        persistenceAllowed = true;
        if (state.active) notice(t.restored);
      } catch {
        storageBlocked = true;
        text("ecStorageNotice", t.storageCorrupt);
      }
    }
  } catch {
    text("ecStorageNotice", t.storageError);
  }
  let life = 0,
    round = 0,
    syncing = false,
    controller: AbortController | null = null;
  let anchor: Anchor | null = null,
    syncAtMono = 0,
    syncReason = t.localHint;
  let previous = { deviceMs: Date.now(), monoMs: performance.now() };
  let nextAutoMono = performance.now() + 300000;
  let soundReady = false,
    soundPaused = false,
    audio: AudioContext | null = null;
  let wakeWanted = false,
    wakePending = false,
    wakeSequence = 0,
    wake: WakeLockSentinel | null = null;
  let immersive = false,
    fullscreenPending = false,
    settingsOpen = true,
    idleTimer: ReturnType<typeof setTimeout> | undefined;
  let settingsTrigger: HTMLElement | null = null,
    bigTrigger: HTMLElement | null = null;
  const inertNodes = new Map<HTMLElement, boolean>();
  let selectedId: number | null = null,
    renderedStage = "";
  let unsavedInvalid = false;
  let savedDraft: Draft = state.draft;
  function persist(explicit = false) {
    if (explicit) persistenceAllowed = true;
    if (storageBlocked || !persistenceAllowed) return;
    let value: string | null = null;
    let draftSaved = true;
    try {
      value = serializeStorage(state);
    } catch {
      // A draft that is still being edited must not block the independent
      // settings: keep the last saved draft and write everything else, then say
      // that the form content is what was left out.
      draftSaved = false;
      try {
        value = serializeStorage({ ...state, draft: savedDraft });
      } catch {
        text("ecStorageNotice", t.storageError);
        return;
      }
    }
    try {
      localStorage.setItem(STORAGE_KEY, value);
    } catch {
      text("ecStorageNotice", t.storageError);
      return;
    }
    if (draftSaved) {
      savedDraft = { ...state.draft };
      if (unsavedInvalid) {
        unsavedInvalid = false;
        if (el("ecStorageNotice").textContent === t.unsavedInvalid)
          text("ecStorageNotice", "");
      }
    } else {
      unsavedInvalid = true;
      text("ecStorageNotice", t.unsavedInvalid);
    }
  }
  function now() {
    return anchor ? anchoredNow(anchor, performance.now()) : Date.now();
  }
  const jumpAmount = (ms: number) =>
    `${ms >= 0 ? "+" : ""}${(ms / 1000).toFixed(1)}`;
  function human(ms: number) {
    return formatRemaining(ms, {
      style: "human",
      zero: t.zero,
      underMinute: t.underMinute,
      hours: t.hours,
      minutes: t.minutes,
    });
  }
  const clock = (ms: number) =>
    formatClock(ms, {
      timeZone: "Asia/Shanghai",
      locale,
      hour12: state.settings.hour12,
      showSeconds: state.settings.showSeconds,
      fixedOffsetFallback: true,
    });
  const shortTime = (ms: number) => {
    const c = clock(ms);
    return `${c.time}${c.period ? " " + c.period : ""}`;
  };
  function renderSource() {
    text("ecSource", syncing ? t.syncing : anchor ? t.synced : t.local);
    button("ecSync").disabled = syncing;
    const h = state.history;
    text(
      "ecSourceDetail",
      (syncing ? t.syncingHint + " " : "") +
        (anchor && h
          ? tr(t.syncDetails, {
              at: shortTime(h.at),
              rtt: Math.round(h.rttMs),
              offset: Math.round(h.offsetMs),
              error: Math.ceil(h.uncertaintyMs),
            })
          : `${syncReason}${h ? " · " + tr(t.history, { at: `${beijingInput(h.at).slice(0, 10)} ${shortTime(h.at)}` }) : ""}`),
    );
  }
  function render(suppress = false) {
    const current = now();
    const c = clock(current);
    text("ecTime", c.time);
    text("ecPeriod", c.period);
    text("ecDate", `${c.date} · ${c.weekday}`);
    if (c.fallback) text("ecCompatibility", t.compat);
    let label = t.empty;
    const active = state.active;
    el("ecCountdownArea").hidden = !active;
    text("ecName", active?.exam.name || state.draft.name.trim() || t.title);
    el("ecName").setAttribute(
      "aria-label",
      active?.exam.name || state.draft.name.trim() || t.title,
    );
    el("ecName").title =
      active?.exam.name || state.draft.name.trim() || t.title;
    if (active) {
      const r = advanceExam(active, current, suppress || document.hidden);
      state.active = r.active;
      root.dataset.phase = r.phase;
      root.dataset.node = r.node || "";
      root.dataset.examState = r.status;
      label =
        r.status === "waiting"
          ? t.waiting
          : r.status === "finished"
            ? t.finished
            : r.node
              ? tr(t.remainingNode, { minutes: r.node })
              : t.running;
      const remaining =
        r.status === "finished"
          ? 0
          : r.status === "waiting"
            ? active.exam.startMs - current
            : active.exam.endMs - current;
      text(
        "ecRemainingLabel",
        r.status === "waiting" ? t.untilStart : t.untilEnd,
      );
      text("ecRemaining", formatRemaining(remaining));
      text("ecHumanRemaining", human(remaining));
      const progress = r.active.finished
        ? 1
        : progressFor(current, active.exam.startMs, active.exam.endMs);
      el<HTMLProgressElement>("ecProgress").value = progress;
      el("ecProgress").setAttribute(
        "aria-valuetext",
        `${Math.round(progress * 100)}%`,
      );
      text(
        "ecSchedule",
        `${t.start}: ${active.exam.start.replace("T", " ")} · ${t.end}: ${active.exam.end.replace("T", " ")} · ${t.duration}: ${formatRemaining(active.exam.totalSeconds * 1000)}`,
      );
      if (r.changed) persist();
      if (r.alert && state.settings.sound && soundReady && !soundPaused)
        void playSound(r.alert === "end");
    } else {
      root.dataset.phase = "normal";
      root.dataset.node = "";
      root.dataset.examState = "disabled";
      if (validateDraft().ok) label = t.preview;
    }
    text("ecExamStatus", label);
    if (label !== renderedStage) {
      if (renderedStage) notice(label);
      renderedStage = label;
    }
  }
  function setSource(next: Anchor | null, reason = t.localHint) {
    const old = now();
    anchor = next;
    syncReason = reason;
    const adjustment = now() - old;
    if (Math.abs(adjustment) > 1000)
      text(
        "ecAdjustment",
        tr(t.adjust, {
          amount: `${adjustment >= 0 ? "+" : ""}${(adjustment / 1000).toFixed(1)}`,
        }),
      );
    render(true);
    renderSource();
  }
  function cancelSync() {
    round++;
    controller?.abort();
    controller = null;
    syncing = false;
    renderSource();
  }
  function failureText(error: unknown) {
    const code = error instanceof Error ? error.message : "";
    return code === "timeout"
      ? t.timeout
      : code === "poor-rtt"
        ? t.poorRtt
        : code === "jump-sample"
          ? t.jumpSample
          : code === "invalid-response" || error instanceof SyntaxError
            ? t.invalidResponse
            : navigator.onLine === false
              ? t.offline
              : t.requestFailed;
  }
  async function sync() {
    if (syncing || document.hidden) return;
    syncing = true;
    nextAutoMono = performance.now() + 300000;
    const sequence = ++round,
      generation = life;
    renderSource();
    type Good = {
      data: TimeResponse;
      offset: ReturnType<typeof computeOffset>;
      mono: number;
    };
    let best: Good | null = null,
      reason = t.requestFailed;
    for (let i = 0; i < 3; i++) {
      if (sequence !== round || generation !== life || document.hidden) return;
      controller = new AbortController();
      const requestController = controller;
      let timeout: ReturnType<typeof setTimeout> | undefined;
      const sentAt = Date.now(),
        sentMono = performance.now();
      try {
        const limited = new Promise<never>((_, reject) => {
          timeout = setTimeout(() => {
            requestController.abort();
            reject(new Error("timeout"));
          }, 4000);
        });
        const data = await Promise.race([
          limited,
          (async () => {
            const response = await fetch("/api/time", {
              method: "GET",
              credentials: "omit",
              cache: "no-store",
              signal: requestController.signal,
            });
            if (!response.ok) throw new Error("request-failed");
            return validateTimeResponse(await response.json());
          })(),
        ]);
        const mono = performance.now(),
          rtt = mono - sentMono;
        if (Math.abs(Date.now() - (sentAt + rtt)) > 1000)
          throw new Error("jump-sample");
        const offset = computeOffset({
          sentAt,
          receivedAt: sentAt + rtt,
          serverNowMs: data.serverNowMs,
        });
        if (!best || offset.rttMs < best.offset.rttMs)
          best = { data, offset, mono };
      } catch (error) {
        reason = failureText(error);
      } finally {
        clearTimeout(timeout);
      }
    }
    if (sequence !== round || generation !== life || document.hidden) return;
    syncing = false;
    controller = null;
    if (best) {
      syncAtMono = performance.now();
      state.history = {
        source: "cloudflare-trace",
        at: best.offset.referenceMs,
        offsetMs: best.offset.offsetMs,
        rttMs: best.offset.rttMs,
        uncertaintyMs: Math.ceil(
          best.data.uncertaintyMs + best.offset.uncertaintyMs,
        ),
      };
      setSource({ referenceMs: best.offset.referenceMs, monoMs: best.mono });
      persist();
    } else {
      setSource(null, reason);
      notice(reason);
    }
    renderSource();
  }
  function readDraft() {
    state.draft = {
      name: input("ecInputName").value,
      start: input("ecStart").value,
      end: input("ecEnd").value,
      mode: select("ecMode").value as Draft["mode"],
      hours: input("ecHours").value,
      minutes: input("ecMinutes").value,
      seconds: input("ecSeconds").value,
    };
  }
  function duration() {
    const d = state.draft;
    const values = [d.hours, d.minutes, d.seconds];
    if (values.some((v) => !/^\d{1,2}$/.test(v))) return NaN;
    const [h, m, s] = values.map(Number);
    return h <= 23 && m <= 59 && s <= 59 ? h * 3600 + m * 60 + s : NaN;
  }
  function deriveDraft() {
    const d = state.draft,
      start = parseBeijing(d.start);
    if (d.mode === "duration") {
      const seconds = duration();
      d.end =
        start !== null && Number.isFinite(seconds) && seconds > 0
          ? beijingInput(start + seconds * 1000)
          : "";
      input("ecEnd").value = d.end;
    } else {
      const end = parseBeijing(d.end),
        seconds = start !== null && end !== null ? (end - start) / 1000 : NaN;
      [d.hours, d.minutes, d.seconds] =
        Number.isInteger(seconds) && seconds > 0 && seconds <= 86399
          ? [
              String(Math.floor(seconds / 3600)),
              String(Math.floor(seconds / 60) % 60),
              String(seconds % 60),
            ]
          : ["", "", ""];
      input("ecHours").value = d.hours;
      input("ecMinutes").value = d.minutes;
      input("ecSeconds").value = d.seconds;
    }
  }
  function validateDraft() {
    const d = state.draft;
    return validateExam({
      name: d.name,
      start: d.start,
      end: d.end,
      ...(d.mode === "duration" ? { durationSeconds: duration() } : {}),
    });
  }
  const fieldIds = {
    name: "ecInputName",
    start: "ecStart",
    end: "ecEnd",
    duration: "ecHours",
  };
  const errorIds = {
    name: "ecErrorName",
    start: "ecErrorStart",
    end: "ecErrorEnd",
    duration: "ecErrorDuration",
  };
  function errors(list: FieldError[] = []) {
    for (const key of Object.keys(fieldIds) as (keyof typeof fieldIds)[]) {
      const error = list
        .filter((e) => e.field === key)
        .map((e) => t[e.code as keyof ExamText] || t["invalid-time"])
        .join(" ");
      text(errorIds[key], error);
      const ids =
        key === "duration"
          ? ["ecHours", "ecMinutes", "ecSeconds"]
          : [fieldIds[key]];
      for (const id of ids)
        input(id).setAttribute("aria-invalid", error ? "true" : "false");
    }
    const summary = el("ecErrorSummary");
    summary.replaceChildren();
    summary.hidden = !list.length;
    if (list.length) {
      const heading = document.createElement("p");
      heading.textContent = t.errors;
      summary.append(heading);
      for (const e of list) {
        const line = document.createElement("p"),
          a = document.createElement("a");
        a.href = "#" + fieldIds[e.field];
        a.textContent = t[e.code as keyof ExamText] || t["invalid-time"];
        line.append(a);
        summary.append(line);
      }
      input(fieldIds[list[0].field]).focus();
    }
  }
  function validExam(checkFuture = false) {
    readDraft();
    deriveDraft();
    const result = validateDraft();
    if (!result.ok) {
      errors(result.errors);
      return null;
    }
    if (checkFuture && result.value.endMs <= now()) {
      errors([{ field: "end", code: "past" }]);
      return null;
    }
    errors();
    return result.value;
  }
  function formState() {
    const active = !!state.active;
    el<HTMLFieldSetElement>("ecExamFields").disabled = active;
    input("ecEnd").readOnly = state.draft.mode === "duration";
    for (const id of ["ecHours", "ecMinutes", "ecSeconds"])
      input(id).readOnly = state.draft.mode === "end";
    button("ecReset").disabled = !active;
    el("ecLocked").hidden = !active;
    button("ecCopy").disabled = !active && !validateDraft().ok;
    button("ecLoad").disabled = active || selectedId === null;
  }
  function fillForm() {
    const d = state.draft;
    for (const [id, key] of [
      ["ecInputName", "name"],
      ["ecStart", "start"],
      ["ecEnd", "end"],
      ["ecHours", "hours"],
      ["ecMinutes", "minutes"],
      ["ecSeconds", "seconds"],
    ] as const)
      input(id).value = d[key];
    select("ecMode").value = d.mode;
    for (const box of root.querySelectorAll<HTMLInputElement>(
      "[data-threshold]",
    ))
      box.checked = state.settings.thresholds.includes(
        Number(box.dataset.threshold),
      );
    formState();
  }
  function displaySettings() {
    const s = state.settings;
    root.dataset.theme = s.theme;
    root.dataset.scale = String(s.scale);
    root.dataset.contrast = String(s.contrast);
    for (const [id, key] of [
      ["ecHour12", "hour12"],
      ["ecShowSeconds", "showSeconds"],
      ["ecContrast", "contrast"],
      ["ecSound", "sound"],
    ] as const)
      input(id).checked = s[key];
    select("ecScale").value = String(s.scale);
    select("ecTheme").value = s.theme;
    input("ecVolume").value = String(s.volume);
    text("ecSoundStatus", soundReady ? t.soundReady : t.soundEnable);
    button("ecEnableSound").hidden = soundReady;
    text("ecPauseSound", soundPaused ? t.resumeSound : t.pauseSound);
    button("ecPauseSound").setAttribute("aria-pressed", String(soundPaused));
    render(true);
    renderSource();
  }
  function renderPresets() {
    const list = select("ecPresets");
    list.replaceChildren(new Option(t.selectPreset, ""));
    for (const p of state.presets)
      list.add(
        new Option(
          `#${p.id} · ${p.exam.name} · ${p.exam.start.replace("T", " ")} – ${p.exam.end.replace("T", " ")}`,
          String(p.id),
        ),
      );
    list.value = selectedId === null ? "" : String(selectedId);
    button("ecSaveNew").disabled = state.presets.length >= 10;
    button("ecUpdate").disabled = selectedId === null;
    button("ecDelete").disabled = selectedId === null;
    button("ecLoad").disabled = selectedId === null || !!state.active;
    text("ecPresetLimit", state.presets.length >= 10 ? t.limit : "");
  }
  function enable() {
    if (state.active) return;
    const exam = validExam(true);
    if (!exam) return;
    state.active = {
      exam,
      thresholds: [...state.settings.thresholds],
      processed: [],
      finished: false,
    };
    // Consume all nodes already reached on enabling. No retrospective alerts.
    render(true);
    formState();
    persist(true);
    notice(t.locked);
  }
  el<HTMLFormElement>("ecForm").addEventListener("submit", (event) => {
    event.preventDefault();
    enable();
  });
  for (const id of [
    "ecInputName",
    "ecStart",
    "ecEnd",
    "ecMode",
    "ecHours",
    "ecMinutes",
    "ecSeconds",
  ])
    el(id).addEventListener("input", () => {
      if (state.active) return;
      readDraft();
      deriveDraft();
      errors();
      formState();
      el("ecManualCopy").hidden = true;
      persist(true);
      render(true);
    });
  for (const box of root.querySelectorAll<HTMLInputElement>("[data-threshold]"))
    box.addEventListener("change", () => {
      state.settings.thresholds = [
        ...root.querySelectorAll<HTMLInputElement>("[data-threshold]:checked"),
      ].map((e) => Number(e.dataset.threshold));
      persist(true);
    });
  button("ecExample").addEventListener("click", () => {
    if (state.active) return;
    const day = beijingInput(now() + 86400000).slice(0, 10);
    state.draft = {
      name: t.exampleName,
      start: `${day}T09:00:00`,
      end: `${day}T10:30:00`,
      mode: "end",
      hours: "1",
      minutes: "30",
      seconds: "0",
    };
    errors();
    fillForm();
    persist(true);
    render(true);
  });
  button("ecReset").addEventListener("click", () => {
    state.active = null;
    renderedStage = "";
    errors();
    formState();
    render(true);
    persist(true);
    notice(t.resetDone);
  });
  button("ecCopy").addEventListener("click", async () => {
    const exam = state.active?.exam || validExam();
    if (!exam) return;
    const copy = `${exam.name}\n${t.zone}\n${t.start}: ${exam.start.replace("T", " ")}\n${t.end}: ${exam.end.replace("T", " ")}\n${t.duration}: ${formatRemaining(exam.totalSeconds * 1000)}`;
    const generation = life;
    try {
      if (!navigator.clipboard?.writeText) throw new Error("clipboard");
      await navigator.clipboard.writeText(copy);
      if (generation === life) notice(t.copied);
    } catch {
      if (generation !== life) return;
      el("ecManualCopy").hidden = false;
      el<HTMLTextAreaElement>("ecCopyText").value = copy;
      el<HTMLTextAreaElement>("ecCopyText").focus();
      el<HTMLTextAreaElement>("ecCopyText").select();
      notice(t.manualCopy);
    }
  });
  select("ecPresets").addEventListener("change", () => {
    selectedId = select("ecPresets").value
      ? Number(select("ecPresets").value)
      : null;
    renderPresets();
  });
  function save(update: boolean) {
    if (
      (!update && state.presets.length >= 10) ||
      (update && selectedId === null)
    )
      return;
    const exam = state.active?.exam || validExam();
    if (!exam) return;
    const thresholds = [
      ...(state.active?.thresholds || state.settings.thresholds),
    ];
    if (update) {
      const p = state.presets.find((p) => p.id === selectedId);
      if (p) {
        p.exam = { ...exam };
        p.thresholds = thresholds;
      }
    } else {
      selectedId = state.nextId++;
      state.presets.push({ id: selectedId, exam: { ...exam }, thresholds });
    }
    persist(true);
    renderPresets();
    notice(t.saved);
  }
  button("ecSaveNew").addEventListener("click", () => save(false));
  button("ecUpdate").addEventListener("click", () => save(true));
  button("ecLoad").addEventListener("click", () => {
    if (state.active) return;
    const p = state.presets.find((p) => p.id === selectedId);
    if (!p) return;
    state.draft = {
      name: p.exam.name,
      start: p.exam.start,
      end: p.exam.end,
      mode: "end",
      hours: "",
      minutes: "",
      seconds: "",
    };
    state.settings.thresholds = [...p.thresholds];
    fillForm();
    deriveDraft();
    fillForm();
    errors();
    render(true);
    persist(true);
    notice(p.exam.endMs <= now() ? t.past : t.loaded);
  });
  button("ecDelete").addEventListener("click", () => {
    state.presets = state.presets.filter((p) => p.id !== selectedId);
    selectedId = null;
    persist(true);
    renderPresets();
  });
  for (const id of [
    "ecHour12",
    "ecShowSeconds",
    "ecScale",
    "ecTheme",
    "ecContrast",
    "ecVolume",
  ])
    el(id).addEventListener("input", () => {
      Object.assign(state.settings, {
        hour12: input("ecHour12").checked,
        showSeconds: input("ecShowSeconds").checked,
        scale: Number(select("ecScale").value),
        theme: select("ecTheme").value,
        contrast: input("ecContrast").checked,
        volume: Number(input("ecVolume").value),
      });
      displaySettings();
      persist(true);
    });
  async function prepareAudio(): Promise<boolean> {
    const generation = life;
    try {
      const Audio =
        window.AudioContext ||
        (window as unknown as { webkitAudioContext?: typeof AudioContext })
          .webkitAudioContext;
      if (!Audio) throw new Error("audio");
      const ctx = audio || new Audio();
      audio = ctx;
      if (ctx.state !== "running") await ctx.resume();
      if (generation !== life || audio !== ctx) return false;
      if (ctx.state !== "running") throw new Error("audio");
      soundReady = true;
      button("ecEnableSound").hidden = true;
      text("ecSoundStatus", t.soundReady);
      return true;
    } catch {
      if (generation === life) {
        soundReady = false;
        text("ecSoundStatus", t.soundError);
        notice(t.soundError);
      }
      return false;
    }
  }
  async function playSound(finished = false) {
    if (!audio || !soundReady) return;
    try {
      if (audio.state !== "running") throw new Error("audio");
      const ctx = audio,
        at = ctx.currentTime;
      for (let i = 0; i < (finished ? 2 : 1); i++) {
        const oscillator = ctx.createOscillator(),
          gain = ctx.createGain(),
          start = at + i * 0.28;
        oscillator.frequency.value = finished ? 660 : 880;
        gain.gain.setValueAtTime(0, start);
        gain.gain.linearRampToValueAtTime(
          (state.settings.volume / 100) * 0.2,
          start + 0.015,
        );
        gain.gain.linearRampToValueAtTime(0, start + 0.19);
        oscillator.connect(gain);
        gain.connect(ctx.destination);
        oscillator.start(start);
        oscillator.stop(start + 0.2);
        oscillator.onended = () => {
          oscillator.disconnect();
          gain.disconnect();
        };
      }
    } catch {
      soundReady = false;
      text("ecSoundStatus", t.soundError);
      notice(t.soundError);
    }
  }
  function closeAudio() {
    const ctx = audio;
    audio = null;
    soundReady = false;
    if (ctx) {
      try {
        void ctx.close().catch(() => {});
      } catch {
        /* Closing an unavailable context is harmless. */
      }
    }
  }
  input("ecSound").addEventListener("change", () => {
    state.settings.sound = input("ecSound").checked;
    if (state.settings.sound) void prepareAudio();
    else {
      closeAudio();
      text("ecSoundStatus", t.soundEnable);
    }
    persist(true);
  });
  button("ecEnableSound").addEventListener("click", async () => {
    if (await prepareAudio()) {
      state.settings.sound = true;
      input("ecSound").checked = true;
      persist(true);
    }
  });
  button("ecTestSound").addEventListener("click", async () => {
    if (await prepareAudio()) await playSound();
  });
  function pauseSounds() {
    soundPaused = !soundPaused;
    text("ecPauseSound", soundPaused ? t.resumeSound : t.pauseSound);
    button("ecPauseSound").setAttribute("aria-pressed", String(soundPaused));
    notice(soundPaused ? t.pauseSound : t.resumeSound);
  }
  button("ecPauseSound").addEventListener("click", pauseSounds);
  async function releaseWake() {
    wakeSequence++;
    wakePending = false;
    button("ecRetryWake").disabled = false;
    const lock = wake;
    wake = null;
    if (lock)
      try {
        await lock.release();
      } catch {
        /* Already released by the system. */
      }
  }
  async function requestWake() {
    if (!wakeWanted || document.hidden || wake || wakePending) return;
    if (!navigator.wakeLock?.request) {
      text("ecWakeStatus", t.wakeUnsupported);
      return;
    }
    const sequence = ++wakeSequence,
      generation = life;
    wakePending = true;
    button("ecRetryWake").disabled = true;
    text("ecWakeStatus", t.wakePending);
    try {
      const lock = await navigator.wakeLock.request("screen");
      if (
        !wakeWanted ||
        sequence !== wakeSequence ||
        generation !== life ||
        document.hidden
      ) {
        await lock.release().catch(() => {});
        return;
      }
      wake = lock;
      text("ecWakeStatus", lock.released ? t.wakeReleased : t.wakeOn);
      lock.addEventListener("release", () => {
        if (wake !== lock) return;
        wake = null;
        text("ecWakeStatus", wakeWanted ? t.wakeReleased : t.wakeOff);
      });
      if (lock.released) wake = null;
    } catch {
      if (sequence === wakeSequence && generation === life && wakeWanted)
        text("ecWakeStatus", t.wakeFailed);
    } finally {
      if (sequence === wakeSequence) {
        wakePending = false;
        button("ecRetryWake").disabled = false;
      }
    }
  }
  input("ecWake").addEventListener("change", () => {
    wakeWanted = input("ecWake").checked;
    if (wakeWanted) void requestWake();
    else {
      void releaseWake();
      text("ecWakeStatus", t.wakeOff);
    }
  });
  button("ecRetryWake").addEventListener("click", () => {
    if (wakeWanted) void requestWake();
  });
  function isolate(on: boolean) {
    if (on) {
      let child: HTMLElement = root;
      while (child.parentElement) {
        const parent = child.parentElement;
        for (const sibling of parent.children) {
          if (
            sibling !== child &&
            sibling instanceof HTMLElement &&
            !inertNodes.has(sibling)
          ) {
            inertNodes.set(sibling, sibling.inert);
            sibling.inert = true;
          }
        }
        if (parent === document.body) break;
        child = parent;
      }
    } else {
      for (const [node, inert] of inertNodes) node.inert = inert;
      inertNodes.clear();
    }
  }
  function reveal() {
    root.classList.remove("ec-controls-hidden");
    el("ecControls").inert = false;
    button("ecSync").inert = false;
    clearTimeout(idleTimer);
    if (immersive)
      idleTimer = setTimeout(() => {
        if (
          settingsOpen ||
          el("ecControls").contains(document.activeElement) ||
          el("ecControls").matches(":hover") ||
          button("ecSync") === document.activeElement ||
          button("ecSync").matches(":hover")
        ) {
          reveal();
          return;
        }
        root.classList.add("ec-controls-hidden");
        el("ecControls").inert = true;
        button("ecSync").inert = true;
      }, 5000);
  }
  function setSettings(open: boolean, restore = true) {
    settingsOpen = open;
    const aside = el("ecSettings");
    aside.hidden = !open;
    button("ecSettingsToggle").setAttribute("aria-expanded", String(open));
    if (immersive && open) {
      aside.setAttribute("role", "dialog");
      aside.setAttribute("aria-modal", "true");
    } else {
      aside.removeAttribute("role");
      aside.removeAttribute("aria-modal");
    }
    if (open) {
      settingsTrigger = button("ecSettingsToggle");
      button("ecCloseSettings").focus();
    } else if (restore)
      (settingsTrigger?.isConnected
        ? settingsTrigger
        : button("ecSettingsToggle")
      ).focus();
    reveal();
  }
  function setImmersive(on: boolean) {
    if (immersive === on) return;
    immersive = on;
    root.classList.toggle("ec-immersive", on);
    isolate(on);
    text("ecFullscreen", on ? t.exitFullscreen : t.fullscreen);
    if (on) {
      bigTrigger = button("ecFullscreen");
      setSettings(false, false);
      button("ecFullscreen").focus();
    } else {
      setSettings(true, false);
      el("ecSettings").removeAttribute("role");
      el("ecSettings").removeAttribute("aria-modal");
      (bigTrigger?.isConnected ? bigTrigger : button("ecFullscreen")).focus();
    }
    reveal();
  }
  async function toggleFullscreen() {
    if (fullscreenPending) return;
    if (immersive) {
      if (document.fullscreenElement === root) {
        try {
          await document.exitFullscreen();
        } catch {
          /* native state remains authoritative */
        }
      } else setImmersive(false);
      return;
    }
    const generation = life;
    fullscreenPending = true;
    try {
      if (!root.requestFullscreen) throw new Error("fullscreen");
      await root.requestFullscreen();
      if (generation !== life) {
        if (document.fullscreenElement === root)
          await document.exitFullscreen();
        return;
      }
      setImmersive(document.fullscreenElement === root);
    } catch {
      if (generation !== life) return;
      setImmersive(true);
      text("ecFullscreenNote", t.fullscreenFallback);
      notice(t.fullscreenFallback);
    } finally {
      fullscreenPending = false;
    }
  }
  document.addEventListener("fullscreenchange", () => {
    setImmersive(document.fullscreenElement === root);
  });
  button("ecFullscreen").addEventListener(
    "click",
    () => void toggleFullscreen(),
  );
  button("ecSettingsToggle").addEventListener("click", () =>
    setSettings(!settingsOpen),
  );
  button("ecCloseSettings").addEventListener("click", () => setSettings(false));
  for (const name of ["pointermove", "pointerdown", "focusin"] as const)
    root.addEventListener(name, reveal);
  document.addEventListener("keydown", (event) => {
    if (event.repeat || event.isComposing) return;
    const target = event.target as HTMLElement;
    if (
      (event.ctrlKey || event.metaKey) &&
      !event.altKey &&
      event.key === "Enter"
    ) {
      event.preventDefault();
      enable();
      reveal();
      return;
    }
    if (event.ctrlKey || event.metaKey || event.altKey) return;
    if (immersive && settingsOpen && event.key === "Tab") {
      const focusable = [
        ...el("ecSettings").querySelectorAll<HTMLElement>(
          "button:not(:disabled),input:not(:disabled),select:not(:disabled),textarea,a[href],summary",
        ),
      ].filter(
        (e) => e.getClientRects().length && !e.closest("fieldset:disabled"),
      );
      if (focusable.length) {
        const first = focusable[0],
          last = focusable.at(-1)!;
        if (event.shiftKey && document.activeElement === first) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
      }
    }
    if (event.key === "Escape") {
      if (settingsOpen) {
        event.preventDefault();
        setSettings(false);
      } else if (immersive && document.fullscreenElement !== root) {
        event.preventDefault();
        setImmersive(false);
      }
      reveal();
      return;
    }
    if (
      target.isContentEditable ||
      target.closest('input,select,textarea,[role="textbox"]')
    )
      return;
    // Space and Enter on buttons keep native button activation.
    if (event.key === " " && target.closest("button,summary,a")) return;
    const key = event.key.toLowerCase();
    if (["f", "s", "r", " "].includes(key)) {
      event.preventDefault();
      reveal();
      if (key === "f") void toggleFullscreen();
      if (key === "s") setSettings(!settingsOpen);
      if (key === "r") void sync();
      if (key === " ") pauseSounds();
    } else if (immersive) reveal();
  });
  function clearData(remove: boolean) {
    life++;
    cancelSync();
    wakeWanted = false;
    void releaseWake();
    closeAudio();
    soundPaused = false;
    state = defaults();
    // Clearing must not resurrect the draft this tab kept for an invalid edit.
    savedDraft = state.draft;
    selectedId = null;
    anchor = null;
    syncReason = t.localHint;
    storageBlocked = false;
    persistenceAllowed = false;
    previous = { deviceMs: Date.now(), monoMs: performance.now() };
    nextAutoMono = performance.now() + 300000;
    renderedStage = "";
    text("ecStorageNotice", "");
    if (remove)
      try {
        localStorage.removeItem(STORAGE_KEY);
      } catch {
        text("ecStorageNotice", t.storageError);
      }
    text("ecAdjustment", "");
    text("ecWakeStatus", t.wakeOff);
    input("ecWake").checked = false;
    el("ecManualCopy").hidden = true;
    el<HTMLTextAreaElement>("ecCopyText").value = "";
    errors();
    fillForm();
    displaySettings();
    renderPresets();
    notice(t.cleared);
    // Do not persist defaults or schedule a sync here. Late requests are invalidated.
  }
  button("ecClear").addEventListener("click", () => {
    if (window.confirm(t.confirmClear)) clearData(true);
  });
  window.addEventListener("storage", (event) => {
    if (event.key !== STORAGE_KEY && event.key !== null) return;
    if (event.newValue === null) clearData(false);
    else {
      text("ecStorageNotice", t.otherTab);
    }
  });
  button("ecSync").addEventListener("click", () => void sync());
  function resume() {
    const monoMs = performance.now(),
      deviceMs = Date.now(),
      jump = detectJump(previous, { deviceMs, monoMs });
    previous = { deviceMs, monoMs };
    // Report a device-clock jump that happened while hidden and re-check right
    // away; the anchor is only dropped if that re-check fails, so a jump alone
    // never ends the exam.
    if (jump) {
      text("ecAdjustment", tr(t.jump, { amount: jumpAmount(jump) }));
      notice(el("ecAdjustment").textContent || "");
      cancelSync();
    }
    render(true);
    void sync();
    if (wakeWanted) void requestWake();
  }
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      cancelSync();
      if (wakeWanted) {
        void releaseWake();
        text("ecWakeStatus", t.wakeReleased);
      }
    } else resume();
  });
  window.addEventListener("online", () => {
    if (!document.hidden) void sync();
  });
  window.addEventListener("offline", () => {
    notice(t.offlineHint);
    if (!document.hidden) void sync();
  });
  window.addEventListener("pageshow", (event) => {
    if (event.persisted) resume();
  });
  window.addEventListener("pagehide", () => {
    cancelSync();
    void releaseWake();
    closeAudio();
  });
  function tick() {
    if (document.hidden) return;
    const current = { deviceMs: Date.now(), monoMs: performance.now() },
      jump = detectJump(previous, current);
    previous = current;
    if (jump) {
      // Report the change and re-check immediately. The verified anchor survives
      // until that re-check fails, so a jump alone cannot end the exam.
      text("ecAdjustment", tr(t.jump, { amount: jumpAmount(jump) }));
      notice(el("ecAdjustment").textContent || "");
      cancelSync();
      void sync();
    }
    if (anchor && current.monoMs - syncAtMono >= 300000)
      setSource(null, t.expired);
    render(!!jump);
    if (current.monoMs >= nextAutoMono) void sync();
  }
  fillForm();
  displaySettings();
  renderPresets();
  render(true);
  renderSource();
  window.setInterval(tick, 250);
  void sync();
}
