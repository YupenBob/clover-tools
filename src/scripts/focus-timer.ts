import {
  defaults,
  transition,
  aggregate,
  dateKey,
  weekDates,
  isActive,
  isRunning,
  validateDuration,
  validateTask,
  TASK_LIMIT,
  RECORD_LIMIT,
  type Snapshot,
  type Action,
  type Sample,
  type Aggregate,
} from "../lib/focus-timer";
import {
  sentence,
  focusLocale,
  type FocusText,
  type FocusLang,
} from "../lib/focus-timer-i18n";
import { FocusStorage, type StorageMode } from "./focus-timer-storage";
import { FocusAudio } from "./focus-timer-audio";
import { FocusPlatform } from "./focus-timer-platform";
let cleanup: (() => void) | undefined;
let activeRoot: HTMLElement | null = null;
function init() {
  const root = document.querySelector<HTMLElement>("#focusTimer");
  if (root && root === activeRoot) return;
  cleanup?.();
  activeRoot = root;
  if (!root) return;
  const $ = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>(`#${id}`)!;
  const text = (id: string, value: string) => {
    const e = $(id);
    if (e.textContent !== value) e.textContent = value;
  };
  const t = JSON.parse($("ftText").textContent!) as FocusText;
  root.dataset.ready = "false";
  root.setAttribute("aria-busy", "true");
  text("ftStorage", t.loading);
  const lang = root.dataset.lang as FocusLang,
    locale = focusLocale(lang);
  const nf = new Intl.NumberFormat(locale, { maximumFractionDigits: 1 });
  const df = new Intl.DateTimeFormat(locale, {
    month: "short",
    day: "numeric",
    weekday: "short",
    timeZone: "UTC",
  });
  const dateLabel = (date: string) => df.format(new Date(`${date}T12:00:00Z`));
  const dateTime = (ms: number, timeZone: string) =>
    new Intl.DateTimeFormat(locale, {
      dateStyle: "short",
      timeStyle: "medium",
      timeZone,
    }).format(ms);
  const minutes = (ms: number) =>
    ms > 0 && ms < 6000 ? t.underMinute : nf.format(ms / 60000);
  const detailed = (ms: number) =>
    sentence(t.minuteSecond, {
      m: nf.format(Math.floor(ms / 60000)),
      s: nf.format(Math.floor((ms % 60000) / 1000)),
    });
  const controller = new AbortController(),
    { signal } = controller;
  const on = (id: string, type: string, fn: (e: Event) => void) =>
    $(id).addEventListener(type, fn, { signal });
  let state: Snapshot = defaults(),
    ready = false,
    dead = false,
    mode: StorageMode = "loading",
    epoch = 0,
    resourceKey = "",
    permissionPending = false;
  let selectedRange = "week",
    stats: Aggregate = aggregate([], []),
    week: Aggregate = aggregate([], []),
    currentDates: string[] = [],
    clockDate = "",
    copyValue = "";
  let clearedNoWrite = false;
  let lastSave = 0,
    lastTime: Sample | null = null;
  const canWrite = () =>
    ready && !dead && mode !== "readonly" && mode !== "loading";
  const sample = (): Sample => ({
    mono: performance.now(),
    wall: Date.now(),
    timeZone: Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    id: crypto.randomUUID(),
    sessionId: crypto.randomUUID(),
  });
  const notice = (message: string) => text("ftAnnounce", message);
  const audio = new FocusAudio((playing, failed) =>
    text(
      "ftSoundStatus",
      failed ? t.soundError : playing ? t.soundOn : t.soundOff,
    ),
  );
  const platform = new FocusPlatform(
    t,
    (value) => {
      text("ftWakeStatus", value);
      $<HTMLButtonElement>("ftRetryWake").disabled =
        value === t.wakePending || !canWrite();
    },
    (value, pending) => {
      text("ftNotificationStatus", value);
      permissionPending = pending;
      if (ready)
        $("ftNotifications").toggleAttribute(
          "disabled",
          pending || !canWrite(),
        );
    },
  );
  const storage = new FocusStorage(
    (value) => {
      mode = value;
      text(
        "ftStorage",
        t[
          value === "writer" ? "local" : value === "loading" ? "loading" : value
        ],
      );
      $("ftTakeover").hidden = value !== "readonly";
      if (ready) renderControls();
    },
    (value, cleared, problem) => {
      epoch++;
      audio.stop(true);
      platform.reset();
      resourceKey = "";
      state = value;
      fillSettings();
      notice(problem ? t[problem] : cleared ? t.externalClear : t.restored);
      render(true);
    },
  );
  const save = (checkpointOnly = false) => {
    if (clearedNoWrite && checkpointOnly) return;
    clearedNoWrite = false;
    if (canWrite()) storage.save(state);
    lastSave = performance.now();
  };
  function fillSettings() {
    for (const key of ["focus", "short", "long", "interval"] as const)
      $<HTMLInputElement>(`ft-${key}`).value = String(state.settings[key]);
    for (const [id, key] of [
      ["ftAuto", "auto"],
      ["ftSound", "sound"],
      ["ftMute", "muted"],
      ["ftWake", "wake"],
      ["ftNotifications", "notifications"],
    ] as const)
      $<HTMLInputElement>(id).checked = state.settings[key];
    $<HTMLSelectElement>("ftEnvironment").value = state.settings.environment;
    $<HTMLInputElement>("ftVolume").value = String(state.settings.volume);
    text("ftVolumeValue", nf.format(state.settings.volume));
    platform.notificationStatus(state.settings.notifications);
  }
  function validSettings(show = true): boolean {
    let valid = true;
    for (const [key, min, max] of [
      ["focus", 1, 180],
      ["short", 1, 30],
      ["long", 1, 60],
      ["interval", 2, 8],
    ] as const) {
      const input = $<HTMLInputElement>(`ft-${key}`),
        r = validateDuration(input.value, key);
      if (show) {
        input.setAttribute("aria-invalid", String(!r.ok));
        text(
          `ft-error-${key}`,
          r.ok
            ? ""
            : r.error === "range"
              ? sentence(t.range, { min, max })
              : t[r.error],
        );
      }
      valid = valid && r.ok;
    }
    return valid;
  }
  function syncResources() {
    const running = isRunning(state),
      focus = state.status === "running";
    void platform.wake(
      canWrite() && state.settings.wake,
      canWrite() && running,
      document.visibilityState === "visible",
    );
    const key = `${state.stage?.id}-${state.status}-${state.settings.sound}-${state.settings.environment}-${canWrite()}-${document.visibilityState}`;
    if (key !== resourceKey) {
      resourceKey = key;
      audio.stop();
      if (
        canWrite() &&
        focus &&
        state.settings.sound &&
        audio.enabled &&
        document.visibilityState === "visible"
      )
        audio.play(
          state.settings.environment,
          state.settings.volume,
          state.settings.muted,
        );
    }
  }
  function renderControls() {
    const writable = canWrite(),
      active = isActive(state),
      stage = state.stage;
    root!
      .querySelectorAll<HTMLInputElement | HTMLButtonElement>("[data-write]")
      .forEach((e) => (e.disabled = !writable));
    $<HTMLFieldSetElement>("ftDurationFields").disabled = !writable || active;
    $<HTMLFieldSetElement>("ftSoundFields").disabled = !writable;
    $<HTMLFieldSetElement>("ftPlatformFields").disabled = !writable;
    $<HTMLInputElement>("ftNotifications").disabled =
      !writable || permissionPending;
    $("ftLocked").hidden = !active;
    $("ftTaskLocked").hidden =
      !active || stage?.phase !== "focus" || stage.taskId === null;
    const focusNext =
      state.status === "idle" ||
      (state.status === "finished" && state.nextPhase === "focus");
    $<HTMLButtonElement>("ftPrimary").disabled =
      !writable ||
      !validSettings() ||
      (focusNext && state.records.length >= RECORD_LIMIT);
    text(
      "ftPrimary",
      isRunning(state)
        ? t.pause
        : state.status === "paused"
          ? t.resume
          : state.status === "finished"
            ? state.nextPhase === "focus"
              ? t.startNext
              : t.startBreak
            : t.start,
    );
    $<HTMLButtonElement>("ftEarly").disabled =
      !writable || !active || stage?.phase !== "focus";
    $<HTMLButtonElement>("ftSkip").disabled =
      !writable ||
      state.status === "idle" ||
      (state.status === "finished" && state.nextPhase === "focus");
    $<HTMLButtonElement>("ftReset").disabled =
      !writable || state.status === "idle";
    $<HTMLButtonElement>("ftClearRecords").disabled =
      !writable || active || !state.records.length;
    $<HTMLButtonElement>("ftExample").disabled =
      !writable || state.status !== "idle";
    $<HTMLButtonElement>("ftPreview").disabled = !writable || active;
    $<HTMLButtonElement>("ftAdd").disabled =
      !writable || state.tasks.length >= TASK_LIMIT;
    $<HTMLButtonElement>("ftEmptyStart").disabled =
      !writable ||
      active ||
      !validSettings() ||
      state.records.length >= RECORD_LIMIT;
    // 当前范围没有记录时保留可操作的“开始专注”入口；该入口确实开始专注，
    // 需要时会连同待开始的休息一起跳过。
    $("ftEmptyStart").hidden = stats.records.length > 0 || active;
    const emptyStart = $<HTMLButtonElement>("ftEmptyStart");
    if (emptyStart.textContent !== t.start) emptyStart.textContent = t.start;
    $<HTMLButtonElement>("ftCopy").disabled = !ready || !stats.records.length;
    $<HTMLSelectElement>("ftRange").disabled = !ready;
    $("ftNoTask").setAttribute(
      "aria-pressed",
      String(state.selectedTaskId === null),
    );
    text(
      "ftCapacity",
      state.records.length >= RECORD_LIMIT ? t.recordLimit : "",
    );
    root!
      .querySelectorAll<HTMLButtonElement>("[data-task-action]")
      .forEach((button) => {
        const locked =
          active &&
          stage?.phase === "focus" &&
          stage.taskId === button.dataset.id;
        button.disabled =
          !writable || (locked && button.dataset.taskAction !== "select");
      });
  }
  function renderClock() {
    root!.dataset.status = state.status;
    // 阶段结束后固定显示 00:00 与满进度，不再残留“看起来还在跑”的剩余时间。
    const finished = state.status === "finished";
    const stage = state.stage,
      ms = finished
        ? 0
        : stage
          ? stage.remainingMs
          : state.settings.focus * 60000;
    const seconds = Math.ceil(ms / 1000),
      time = `${String(Math.floor(seconds / 60)).padStart(2, "0")}:${String(seconds % 60).padStart(2, "0")}`;
    text("ftTime", time);
    text("ftPhase", t[stage?.phase ?? "focus"]);
    text("ftStatus", t[state.status]);
    $<HTMLProgressElement>("ftProgress").value = finished
      ? 1
      : stage
        ? 1 - ms / stage.durationMs
        : 0;
    const task =
      stage?.phase === "focus"
        ? stage.taskName
        : state.tasks.find((x) => x.id === state.selectedTaskId)?.name;
    text("ftCurrentTask", task ?? t.noTask);
    text(
      "ftCycle",
      sentence(t.cycle, {
        n: nf.format(state.cycle),
        total: nf.format(state.settings.interval),
      }),
    );
    $("ftNext").hidden = state.status !== "finished";
    text("ftNext", sentence(t.next, { phase: t[state.nextPhase] }));
    $("ftUnsubmitted").hidden = !isActive(state) || stage?.phase !== "focus";
    platform.title(
      isActive(state) ? time : null,
      t[stage?.phase ?? "focus"],
      state.status === "paused",
    );
  }
  function button(label: string, action: string, id: string) {
    const e = document.createElement("button");
    e.type = "button";
    e.className = "btn btn-ghost";
    e.textContent = label;
    e.dataset.taskAction = action;
    e.dataset.id = id;
    e.setAttribute(
      "aria-label",
      `${label}: ${state.tasks.find((task) => task.id === id)?.name ?? ""}`,
    );
    if (action === "select")
      e.setAttribute("aria-pressed", String(state.selectedTaskId === id));
    return e;
  }
  function renderTasks() {
    $("ftOpenTasks").replaceChildren();
    $("ftDoneTasks").replaceChildren();
    $("ftEmptyTasks").hidden = !!state.tasks.length;
    for (const task of state.tasks) {
      const li = document.createElement("li");
      li.dataset.selected = String(state.selectedTaskId === task.id);
      const name = document.createElement("strong");
      name.textContent = task.name;
      const amount = document.createElement("small");
      const total = week.tasks.find((x) => x.id === task.id)?.ms ?? 0;
      amount.textContent = `${t.week} · ${detailed(total)}`;
      const actions = document.createElement("div");
      actions.className = "ft-actions";
      if (task.completedAt === null)
        actions.append(
          button(
            state.selectedTaskId === task.id ? t.selected : t.select,
            "select",
            task.id,
          ),
        );
      actions.append(
        button(
          task.completedAt === null ? t.done : t.reopen,
          "toggle",
          task.id,
        ),
        button(t.delete, "delete", task.id),
      );
      li.append(name, amount, actions);
      $(task.completedAt === null ? "ftOpenTasks" : "ftDoneTasks").append(li);
    }
    if (state.tasks.length >= TASK_LIMIT) text("ftTaskError", t.taskLimit);
    else if ($("ftTaskError").textContent === t.taskLimit)
      text("ftTaskError", "");
  }
  function renderData() {
    const today = dateKey(
      Date.now(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    clockDate = today;
    const dates = weekDates(today);
    week = aggregate(state.records, dates, state.tasks);
    currentDates = selectedRange === "today" ? [today] : dates;
    stats =
      selectedRange === "today"
        ? aggregate(state.records, currentDates, state.tasks)
        : week;
    text("ftWeekRange", `${dateLabel(dates[0])} – ${dateLabel(dates[6])}`);
    text(
      "ftStatsRange",
      `${dateLabel(currentDates[0])} – ${dateLabel(currentDates.at(-1)!)}`,
    );
    text("ftWeekMinutes", minutes(week.totalMs));
    text("ftWeekRounds", nf.format(week.completed));
    text("ftTotalMinutes", minutes(stats.totalMs));
    text("ftTotalRounds", nf.format(stats.completed));
    // 空态按当前选定范围判断；文案已写明“该范围”，不会与同屏的本周数据矛盾。
    $("ftEmptyRecords").hidden = stats.records.length > 0;
    $("ftBars").replaceChildren();
    $("ftDays").replaceChildren();
    const max = Math.max(1, ...week.days.map((d) => d.ms));
    for (const [i, day] of week.days.entries()) {
      const ns = "http://www.w3.org/2000/svg",
        bar = document.createElementNS(ns, "rect");
      const height = (145 * day.ms) / max;
      for (const [k, v] of Object.entries({
        x: String(i * 100 + 23),
        y: String(160 - height),
        width: "54",
        height: String(height),
        rx: "4",
        class: day.date === today ? "ft-bar ft-bar-today" : "ft-bar",
      }))
        bar.setAttribute(k, v);
      const title = document.createElementNS(ns, "title");
      title.textContent = `${dateLabel(day.date)}: ${detailed(day.ms)}`;
      bar.append(title);
      const label = document.createElementNS(ns, "text");
      label.setAttribute("x", String(i * 100 + 50));
      label.setAttribute("y", "187");
      label.setAttribute("text-anchor", "middle");
      label.setAttribute("class", "ft-chart-label");
      label.textContent = new Intl.DateTimeFormat(locale, {
        weekday: "short",
        timeZone: "UTC",
      }).format(new Date(`${day.date}T12:00:00Z`));
      $("ftBars").append(bar, label);
      const row = document.createElement("tr");
      for (const val of [
        dateLabel(day.date),
        detailed(day.ms),
        nf.format(day.completed),
      ]) {
        const cell = document.createElement("td");
        cell.textContent = val;
        row.append(cell);
      }
      if (day.date === today) row.setAttribute("aria-current", "date");
      $("ftDays").append(row);
    }
    $("ftTaskTotals").replaceChildren();
    const taskLines = stats.tasks.map(
      (task) =>
        `${task.name ?? t.noTask}${task.deleted ? ` (${t.deleted})` : ""}: ${detailed(task.ms)} · ${t.rounds} ${nf.format(task.completed)}`,
    );
    for (const line of taskLines) {
      const li = document.createElement("li");
      li.textContent = line;
      $("ftTaskTotals").append(li);
    }
    $("ftRecent").replaceChildren();
    for (const record of [...stats.records].reverse().slice(0, 20)) {
      const li = document.createElement("li"),
        name = document.createElement("strong"),
        detail = document.createElement("small");
      name.textContent = `${record.taskName ?? t.noTask}${record.taskId && !state.tasks.some((x) => x.id === record.taskId) ? ` (${t.deleted})` : ""}`;
      detail.textContent = `${dateTime(record.endedAt, record.timeZone)} · ${record.timeZone} · ${detailed(record.actualMs)} · ${record.method === "complete" ? t.complete : t.earlyMethod}`;
      li.append(name, detail);
      $("ftRecent").append(li);
    }
    copyValue = [
      t.title,
      `${t[selectedRange === "today" ? "today" : "week"]}: ${currentDates[0]} – ${currentDates.at(-1)}`,
      t.dateRule,
      `${t.minutes}: ${minutes(stats.totalMs)}`,
      `${t.rounds}: ${nf.format(stats.completed)}`,
      t.byTask,
      ...taskLines,
      ...stats.days.map(
        (d) =>
          `${d.date}: ${detailed(d.ms)} · ${t.rounds} ${nf.format(d.completed)}`,
      ),
    ].join("\n");
    if (!$("ftManualCopy").hidden)
      $<HTMLTextAreaElement>("ftCopyText").value = copyValue;
    renderTasks();
  }
  function render(data = false) {
    if (dead) return;
    if (data) renderData();
    renderClock();
    renderControls();
    syncResources();
  }
  function act(action: Action, suppressAuto = false) {
    if (!canWrite()) return;
    const now = sample(),
      beforeStatus = state.status;
    const result = transition(state, action, now);
    // Detect wall-clock jumps even before the first tick after start/resume.
    if (!isRunning(state) && isRunning(result.state)) lastTime = now;
    state = result.state;
    // 时间跳变提示只针对刚结束的那一段：开始新一轮或重置后清除，
    // 避免页面永远宣称“检测到系统时间变化”；从暂停恢复不清除，
    // 因为用户可能正要看到刚才的跳变原因。
    if (action === "reset" || (action === "start" && beforeStatus !== "paused"))
      text("ftJump", "");
    if (
      action !== "tick" &&
      !result.effects.length &&
      beforeStatus !== state.status
    )
      notice(`${t[state.stage?.phase ?? "focus"]} · ${t[state.status]}`);
    for (const effect of result.effects) {
      notice(
        `${t[effect.phase]} · ${t.finished} · ${sentence(t.next, { phase: t[state.nextPhase] })}`,
      );
      if (effect.method === "complete")
        platform.notify(
          effect.id,
          t[effect.phase],
          state.settings.notifications,
        );
    }
    if (
      result.effects.some((e) => e.method === "complete") &&
      !suppressAuto &&
      state.settings.auto &&
      document.visibilityState === "visible" &&
      state.status === "finished" &&
      validSettings()
    )
      state = transition(state, "start", sample()).state;
    if (action !== "tick" || result.effects.length) {
      save();
      render(true);
    } else renderClock();
  }
  const dialog = $<HTMLDialogElement>("ftDialog");
  async function confirm(message: string): Promise<boolean> {
    if (dialog.open || dead) return false;
    const focused = document.activeElement as HTMLElement | null,
      at = epoch;
    text("ftDialogMessage", message);
    dialog.returnValue = "cancel";
    dialog.showModal();
    await new Promise<void>((resolve) =>
      dialog.addEventListener("close", () => resolve(), { once: true }),
    );
    if (focused?.isConnected) focused.focus();
    return dialog.returnValue === "confirm" && at === epoch && canWrite();
  }
  async function guarded(action: "early" | "skip" | "reset") {
    if (!canWrite()) return;
    act("tick");
    const stageId = state.stage?.id;
    const active = isActive(state),
      focus = state.stage?.phase === "focus";
    if (action === "early") {
      if (!active || !focus) return;
      if (!(await confirm(t.confirmEarly))) return;
    }
    if (action === "skip" && active && focus && !(await confirm(t.confirmSkip)))
      return;
    if (
      action === "reset" &&
      active &&
      focus &&
      (state.stage?.focusMs ?? 0) > 0 &&
      !(await confirm(t.confirmReset))
    )
      return;
    if (
      state.stage?.id !== stageId ||
      (action !== "reset" && !isActive(state) && active)
    )
      return;
    act(action);
  }
  on("ftPrimary", "click", () => {
    if (validSettings()) act(isRunning(state) ? "pause" : "start");
  });
  on("ftEmptyStart", "click", () => {
    if (!validSettings()) return;
    // 空态入口始终意味着“开始专注”：若上一轮结束后在等休息，先跳过这次
    // 休息（与显式“跳过”一致），再直接开始下一轮专注。
    if (state.status === "finished" && state.nextPhase !== "focus")
      act("skip");
    act("start");
  });
  for (const [id, action] of [
    ["ftEarly", "early"],
    ["ftSkip", "skip"],
    ["ftReset", "reset"],
  ] as const)
    on(id, "click", () => {
      void guarded(action);
    });
  on("ftTaskName", "input", () => {
    text("ftTaskError", "");
    $("ftTaskName").removeAttribute("aria-invalid");
  });
  on("ftTaskForm", "submit", (e) => {
    e.preventDefault();
    if (!canWrite()) return;
    const input = $<HTMLInputElement>("ftTaskName"),
      result = validateTask(input.value);
    if (!result.ok || state.tasks.length >= TASK_LIMIT) {
      text("ftTaskError", !result.ok ? t[result.error] : t.taskLimit);
      input.setAttribute("aria-invalid", "true");
      return;
    }
    const id = crypto.randomUUID();
    state = {
      ...state,
      tasks: [
        ...state.tasks,
        { id, name: result.value, createdAt: Date.now(), completedAt: null },
      ],
      selectedTaskId: id,
    };
    input.value = "";
    text("ftTaskError", "");
    save();
    render(true);
    input.focus();
  });
  root.addEventListener(
    "click",
    async (event) => {
      const b = (event.target as Element).closest<HTMLButtonElement>(
        "[data-task-action]",
      );
      if (!b || !canWrite() || b.disabled) return;
      act("tick");
      const id = b.dataset.id!,
        task = state.tasks.find((x) => x.id === id);
      if (!task) return;
      const action = b.dataset.taskAction;
      const locked =
        isActive(state) &&
        state.stage?.phase === "focus" &&
        state.stage.taskId === id;
      if (locked && action !== "select") return;
      const index = state.tasks.findIndex((x) => x.id === id);
      if (action === "delete") {
        if (!(await confirm(sentence(t.confirmDelete, { name: task.name }))))
          return;
        if (
          isActive(state) &&
          state.stage?.phase === "focus" &&
          state.stage.taskId === id
        ) {
          notice(t.locked);
          return;
        }
        state = {
          ...state,
          tasks: state.tasks.filter((x) => x.id !== id),
          selectedTaskId:
            state.selectedTaskId === id ? null : state.selectedTaskId,
        };
      } else if (action === "toggle") {
        state = {
          ...state,
          tasks: state.tasks.map((x) =>
            x.id === id
              ? {
                  ...x,
                  completedAt: x.completedAt === null ? Date.now() : null,
                }
              : x,
          ),
          selectedTaskId:
            state.selectedTaskId === id && task.completedAt === null
              ? null
              : state.selectedTaskId,
        };
      } else state = { ...state, selectedTaskId: id };
      save();
      render(true);
      const nextId =
        action === "delete"
          ? state.tasks[Math.min(index, state.tasks.length - 1)]?.id
          : id;
      const target = [
        ...root!.querySelectorAll<HTMLButtonElement>("[data-task-action]"),
      ].find((x) => x.dataset.id === nextId && !x.disabled);
      (target ?? $("ftTaskName")).focus();
    },
    { signal },
  );
  on("ftNoTask", "click", () => {
    if (canWrite()) {
      state.selectedTaskId = null;
      save();
      render(true);
    }
  });
  for (const key of ["focus", "short", "long", "interval"] as const)
    on(`ft-${key}`, "input", () => {
      if (!canWrite() || isActive(state)) return;
      const input = $<HTMLInputElement>(`ft-${key}`),
        result = validateDuration(input.value, key);
      if (result.ok) {
        state.settings[key] = result.value;
        save();
      }
      render();
    });
  root.querySelectorAll<HTMLButtonElement>("[data-preset]").forEach((button) =>
    button.addEventListener(
      "click",
      () => {
        if (!canWrite() || isActive(state)) return;
        state.settings.focus = Number(button.dataset.preset);
        $<HTMLInputElement>("ft-focus").value = String(state.settings.focus);
        save();
        render();
      },
      { signal },
    ),
  );
  on("ftExample", "click", () => {
    if (!canWrite() || state.status !== "idle") return;
    const draft = $<HTMLInputElement>("ftTaskName");
    if (!draft.value) draft.value = t.exampleName;
    state.settings = {
      ...state.settings,
      focus: 25,
      short: 5,
      long: 15,
      interval: 4,
    };
    fillSettings();
    save();
    render();
    draft.focus();
  });
  on("ftAuto", "change", () => {
    if (canWrite()) {
      state.settings.auto = $<HTMLInputElement>("ftAuto").checked;
      save();
    }
  });
  on("ftRange", "change", () => {
    selectedRange = $<HTMLSelectElement>("ftRange").value;
    render(true);
  });
  on("ftCopy", "click", async () => {
    if (!stats.records.length) return;
    const value = copyValue,
      at = epoch;
    try {
      await navigator.clipboard.writeText(value);
      if (at !== epoch || dead) return;
      notice(t.copied);
      $("ftManualCopy").hidden = true;
    } catch {
      if (at !== epoch || dead) return;
      $("ftManualCopy").hidden = false;
      $<HTMLTextAreaElement>("ftCopyText").value = value;
      $("ftCopyText").focus();
      $<HTMLTextAreaElement>("ftCopyText").select();
    }
  });
  on("ftClearRecords", "click", async () => {
    if (!canWrite() || isActive(state) || !state.records.length) return;
    if (
      !(await confirm(
        sentence(t.confirmRecords, { n: nf.format(state.records.length) }),
      )) ||
      isActive(state)
    )
      return;
    state.records = [];
    save();
    render(true);
    notice(t.cleared);
  });
  on("ftClearAll", "click", async () => {
    if (!canWrite() || !(await confirm(t.confirmAll))) return;
    epoch++;
    audio.stop(true);
    audio.enabled = false;
    platform.reset();
    resourceKey = "";
    state = defaults();
    $<HTMLInputElement>("ftTaskName").value = "";
    text("ftTaskError", "");
    text("ftJump", "");
    $("ftTaskName").removeAttribute("aria-invalid");
    $("ftManualCopy").hidden = true;
    $<HTMLTextAreaElement>("ftCopyText").value = "";
    lastTime = null;
    const success = storage.clear();
    clearedNoWrite = true;
    fillSettings();
    render(true);
    notice(success ? t.cleared : t.clearFailed);
    // Deliberately do not write defaults until the next effective operation.
  });
  on("ftTakeover", "click", async () => {
    const next = await storage.takeover();
    if (next && !dead) {
      epoch++;
      state = next;
      resourceKey = "";
      fillSettings();
      render(true);
      notice(t.restored);
    } else if (!dead) {
      // 另一标签页仍持有写锁：明确告知接管失败，而不是看起来毫无反应。
      notice(t.readonly);
    }
  });
  async function enableSound(preview: boolean) {
    if (!canWrite()) return;
    const at = epoch;
    if (!(await audio.enable()) || at !== epoch || !canWrite()) return;
    // “重试声音”只解锁播放权限：连续环境声仅在用户勾选启用时播放，
    // 未启用时最多给一次试听，不会自行开始持续播放。
    if (state.status === "running" && state.settings.sound)
      audio.play(
        state.settings.environment,
        state.settings.volume,
        state.settings.muted,
      );
    else if (preview && !isActive(state))
      audio.play(
        state.settings.environment,
        state.settings.volume,
        state.settings.muted,
        true,
      );
  }
  on("ftSound", "change", () => {
    if (!canWrite()) return;
    state.settings.sound = $<HTMLInputElement>("ftSound").checked;
    save();
    if (state.settings.sound) void enableSound(false);
    else audio.stop();
  });
  on("ftPreview", "click", () => {
    if (!isActive(state)) void enableSound(true);
  });
  on("ftRetrySound", "click", () => {
    void enableSound(!isActive(state));
  });
  on("ftStopSound", "click", () => {
    if (!canWrite()) return;
    audio.stop(true);
    state.settings.sound = false;
    $<HTMLInputElement>("ftSound").checked = false;
    save();
  });
  on("ftEnvironment", "change", () => {
    if (!canWrite()) return;
    const wasPlaying = audio.active;
    state.settings.environment = $<HTMLSelectElement>("ftEnvironment").value as
      "white" | "rain" | "cafe";
    save();
    resourceKey = "";
    syncResources();
    if (wasPlaying && !isActive(state))
      audio.play(
        state.settings.environment,
        state.settings.volume,
        state.settings.muted,
        true,
      );
  });
  for (const id of ["ftVolume", "ftMute"])
    on(id, id === "ftVolume" ? "input" : "change", () => {
      if (!canWrite()) return;
      state.settings.volume = Number($<HTMLInputElement>("ftVolume").value);
      state.settings.muted = $<HTMLInputElement>("ftMute").checked;
      text("ftVolumeValue", nf.format(state.settings.volume));
      audio.volume(state.settings.volume, state.settings.muted);
      save();
    });
  on("ftNotifications", "change", async () => {
    if (!canWrite()) return;
    const at = epoch;
    const enabled = $<HTMLInputElement>("ftNotifications").checked;
    const granted = enabled ? await platform.requestNotification() : false;
    if (at !== epoch || !canWrite()) return;
    state.settings.notifications = granted;
    $<HTMLInputElement>("ftNotifications").checked =
      state.settings.notifications;
    platform.notificationStatus(state.settings.notifications);
    save();
  });
  on("ftWake", "change", () => {
    if (!canWrite()) return;
    state.settings.wake = $<HTMLInputElement>("ftWake").checked;
    save();
    syncResources();
  });
  on("ftRetryWake", "click", () => {
    if (canWrite())
      void platform.wake(
        state.settings.wake,
        isRunning(state),
        document.visibilityState === "visible",
        true,
      );
  });
  root.addEventListener(
    "keydown",
    (e) => {
      if (e.isComposing || e.repeat || dialog.open || !canWrite() || e.altKey)
        return;
      const target = e.target as HTMLElement;
      if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
        e.preventDefault();
        if (!isRunning(state) && !$<HTMLButtonElement>("ftPrimary").disabled)
          act("start");
        return;
      }
      if (
        e.ctrlKey ||
        e.metaKey ||
        target.isContentEditable ||
        target.closest(
          "input,textarea,select,[contenteditable]:not([contenteditable=false]),[role=textbox],dialog,[role=dialog]",
        )
      )
        return;
      const key = e.key.toLowerCase();
      if (e.key === " " && !target.closest("button,a")) {
        e.preventDefault();
        if (!$<HTMLButtonElement>("ftPrimary").disabled)
          act(isRunning(state) ? "pause" : "start");
      } else if (key === "s" && !$<HTMLButtonElement>("ftSkip").disabled) {
        e.preventDefault();
        void guarded("skip");
      } else if (key === "r" && !$<HTMLButtonElement>("ftReset").disabled) {
        e.preventDefault();
        void guarded("reset");
      }
    },
    { signal },
  );
  document.addEventListener(
    "visibilitychange",
    () => {
      if (!ready || dead) return;
      // Sample while hidden, so expiry never triggers a foreground auto-start.
      if (canWrite()) {
        act("tick", true);
        save(true);
      }
      if (document.visibilityState === "hidden") audio.stop();
      syncResources();
    },
    { signal },
  );
  const interval = setInterval(() => {
    if (!ready || dead) return;
    if (canWrite()) {
      const now = sample();
      if (
        lastTime &&
        isRunning(state) &&
        Math.abs(now.wall - lastTime.wall - (now.mono - lastTime.mono)) > 2000
      )
        text("ftJump", t.jump);
      lastTime = now;
      act("tick");
      if (now.mono - lastSave >= 5000 && isActive(state)) save(true);
    }
    const today = dateKey(
      Date.now(),
      Intl.DateTimeFormat().resolvedOptions().timeZone || "UTC",
    );
    if (today !== clockDate) render(true);
  }, 250);
  function dispose() {
    if (dead) return;
    if (canWrite()) {
      // Checkpoint exit progress without starting another stage.
      const result = transition(state, "tick", sample());
      state = result.state;
      save(true);
    }
    dead = true;
    if (activeRoot === root) activeRoot = null;
    epoch++;
    clearInterval(interval);
    audio.dispose();
    platform.dispose();
    storage.dispose();
    controller.abort();
    if (dialog.open) dialog.close("cancel");
  }
  window.addEventListener("pagehide", dispose, { signal });
  cleanup = dispose;
  renderControls();
  void storage
    .init()
    .then((value) => {
      if (dead) return;
      state = value;
      ready = true;
      root.dataset.ready = "true";
      root.setAttribute("aria-busy", "false");
      fillSettings();
      render(true);
      if (state.status === "paused") notice(t.restored);
    })
    .catch(() => {
      if (dead) return;
      mode = "temporary";
      ready = true;
      root.dataset.ready = "true";
      root.setAttribute("aria-busy", "false");
      text("ftStorage", t.temporary);
      fillSettings();
      render(true);
    });
}
init();
document.addEventListener("astro:page-load", init);
document.addEventListener("astro:before-swap", () => cleanup?.());

window.addEventListener("pageshow", (event) => {
  if (event.persisted) {
    activeRoot = null;
    init();
  }
});
