import {
  analyze,
  generateSql,
  DEFAULT_OPTIONS,
  type Analysis,
  type Options,
  type Output,
  type Result,
  type SqlError,
} from "../lib/json-to-sql";
import type { Copy, Language } from "../lib/json-to-sql-i18n";
import type { Task } from "./json-to-sql-worker";
import presentation from "../../data/tool-presentation/json-to-sql.json";
const root = document.getElementById("jsonToSql");
if (root) boot(root);
function boot(root: HTMLElement) {
  const el = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>("#" + id)!;
  const input = el<HTMLTextAreaElement>("jtsInput"),
    output = el<HTMLPreElement>("jtsOutput"),
    reveal = el("jtsReveal"),
    panel = el("jtsSettings"),
    actionsBar = root.querySelector<HTMLElement>(".jts-actions"),
    exit = el("jtsExit"),
    settingsToggle = el("jtsSettingsToggle");
  const t = JSON.parse(el("jtsCopyData").textContent!) as Copy;
  const locale =
    { zh: "zh-CN", tw: "zh-TW", en: "en", ko: "ko", ja: "ja" }[
      root.dataset.lang as Language
    ] ?? "en";
  const fmt = new Intl.NumberFormat(locale);
  const tr = (s: string, p: Record<string, string | number> = {}) =>
    s.replace(/\{(\w+)\}/g, (_, k: string) => String(p[k] ?? ""));
  const announce = (s: string) => {
    el("jtsLive").textContent = s;
  };
  const status = (s: string) => {
    el("jtsStatus").textContent = s;
    announce(
      [
        s,
        workerFailed ? t.workerFallback : "",
        fullscreenFailed ? t.fullscreenFallback : "",
      ]
        .filter(Boolean)
        .join(" "),
    );
  };
  let revision = 0,
    worker: Worker | undefined,
    debounce = 0,
    fallbackTimer = 0,
    hideTimer = 0,
    settingsOpen = presentation.interaction.settingsInitiallyOpen,
    settingsReturnToReveal = true,
    running = false,
    workerFailed = false,
    fullscreenFailed = false,
    suppressFocus = false;
  let current: Output | undefined,
    error: SqlError | undefined,
    focusBeforeFullscreen: HTMLElement | null = null,
    viewBeforeFullscreen = "reveal",
    settingsBeforeFullscreen = false;
  const inertOriginal = new Map<HTMLElement, boolean>();
  let options: Options = { ...DEFAULT_OPTIONS };
  const samples: Record<string, string> = {
    users:
      '[\n  {"id": 1, "name": "Alice", "active": true},\n  {"id": 2, "name": "Bob", "active": false}\n]',
    nested:
      '[\n  {"id": 1, "profile": {"city": "A"}, "tags": ["dev", "test"]},\n  {"id": 2, "profile": null, "tags": []}\n]',
    special: JSON.stringify(
      [
        {
          id: 1,
          name: "O'Reilly",
          note: "C:\\tmp\nline\ttab",
          text: "<script>sample</script>",
          unicode: "中文 한국어 日本語",
        },
      ],
      null,
      2,
    ),
  };
  const show = (e: HTMLElement, visible: boolean) => {
    e.hidden = !visible;
    e.inert = !visible;
  };
  const restoreInert = () => {
    for (const [e, value] of inertOriginal) e.inert = value;
    inertOriginal.clear();
  };
  const isolate = () => {
    restoreInert();
    let branch: HTMLElement = root;
    while (branch.parentElement) {
      for (const sibling of branch.parentElement.children)
        if (
          sibling !== branch &&
          sibling instanceof HTMLElement &&
          !["SCRIPT", "STYLE", "LINK"].includes(sibling.tagName)
        ) {
          inertOriginal.set(sibling, sibling.inert);
          sibling.inert = true;
        }
      branch = branch.parentElement;
      if (branch === document.body) break;
    }
  };
  const collapsedState = () =>
    document.fullscreenElement === root
      ? "fullscreen"
      : workerFailed || fullscreenFailed
        ? "degraded"
        : "primary";
  function setView(state: string) {
    root.dataset.presentationState = state;
    const expanded = state === "reveal" || state === "settingsOpen";
    show(reveal, expanded);
    show(panel, settingsOpen && expanded);
    settingsToggle.setAttribute("aria-expanded", String(settingsOpen));
    if (expanded) {
      restoreInert();
      output.tabIndex = 0;
    } else {
      isolate();
      output.removeAttribute("tabindex");
    }
    resetHide();
  }
  function resetHide() {
    clearTimeout(hideTimer);
    if (!["reveal", "settingsOpen"].includes(root.dataset.presentationState!))
      return;
    hideTimer = window.setTimeout(() => {
      const active = document.activeElement;
      if (
        settingsOpen ||
        running ||
        active === output ||
        (active instanceof Node &&
          (reveal.contains(active) ||
            panel.contains(active) ||
            Boolean(actionsBar?.contains(active))))
      ) {
        resetHide();
        return;
      }
      collapse();
    }, presentation.interaction.autoHideMs);
  }
  function expand() {
    setView(settingsOpen ? "settingsOpen" : "reveal");
  }
  function safeFocus(e: HTMLElement) {
    suppressFocus = true;
    e.focus({ preventScroll: true });
    suppressFocus = false;
  }
  function collapse() {
    const active = document.activeElement;
    if (
      active && active !== document.body && active !== input && active !== exit
    )
      safeFocus(input);
    settingsOpen = false;
    setView(collapsedState());
  }
  function degraded() {
    const reasons = [
      workerFailed ? t.workerFallback : "",
      fullscreenFailed ? t.fullscreenFallback : "",
    ].filter(Boolean);
    root.dataset.presentationDegraded = reasons.length ? "true" : "false";
    el("jtsDegraded").textContent = reasons.join(" ");
    show(el("jtsDegraded"), !!reasons.length);
    if (
      reasons.length &&
      !["reveal", "settingsOpen"].includes(root.dataset.presentationState!)
    )
      setView(collapsedState());
  }
  function process(state: string) {
    root.dataset.process = state;
    running = state === "analyzing" || state === "generating";
    output.setAttribute("aria-busy", String(running));
    show(el("jtsCancel"), running);
    resetHide();
  }
  function stop() {
    worker?.terminate();
    worker = undefined;
    clearTimeout(debounce);
    clearTimeout(fallbackTimer);
    running = false;
  }
  function invalidate() {
    revision++;
    stop();
    current = undefined;
    error = undefined;
    delete root.dataset.errorCode;
    output.textContent = "-- SQL\n-- " + t.emptyResult;
    el<HTMLButtonElement>("jtsCopy").disabled = true;
    el<HTMLButtonElement>("jtsDownload").disabled = true;
    show(el("jtsError"), false);
    show(el("jtsManualArea"), false);
    el<HTMLTextAreaElement>("jtsManual").value = "";
    el("jtsFields").replaceChildren();
    el("jtsStatus").textContent = "";
    announce("");
    process(input.value.trim() ? "analyzing" : "empty");
  }
  function failure(e: SqlError) {
    error = e;
    root.dataset.errorCode = e.code;
    current = undefined;
    output.textContent = "-- SQL\n-- " + t.emptyResult;
    el<HTMLButtonElement>("jtsCopy").disabled = true;
    el<HTMLButtonElement>("jtsDownload").disabled = true;
    process("error");
    const message = tr(
      t.errors[e.code as keyof Copy["errors"]] ?? t.errorSyntax,
      e.params,
    );
    const location =
      e.line !== undefined
        ? tr(t.errorLocation, {
            line: fmt.format(e.line),
            column: fmt.format(e.column!),
            path: e.path || "/",
          })
        : "";
    const first = e.first
      ? tr(t.firstLocation, {
          line: fmt.format(e.first.line),
          column: fmt.format(e.first.column),
        })
      : "";
    el("jtsErrorText").textContent = [message, location, first]
      .filter(Boolean)
      .join(" ");
    show(el("jtsError"), true);
    status([message, location].filter(Boolean).join(" "));
  }
  function inspect(model: Analysis) {
    const body = el("jtsFields");
    body.replaceChildren();
    for (const c of model.columns) {
      const row = document.createElement("tr");
      const values = [
        c.path,
        c.name,
        t.types[c.type],
        c.sqlType,
        fmt.format(c.missing),
        fmt.format(c.nulls),
        c.asText
          ? t.mixedText
          : c.type === "json"
            ? t.json
            : c.parts.length > 1
              ? t.flatten
              : c.type === "date" || c.type === "timestamp"
                ? t.dates
                : t.scalar,
        c.warnings
          .map((w) => t.warningText[w as keyof Copy["warningText"]])
          .join("; "),
      ];
      for (const v of values) {
        const td = document.createElement("td");
        td.textContent = v;
        row.append(td);
      }
      body.append(row);
    }
    const select = el<HTMLSelectElement>("jtsPrimaryKey"),
      chosen = options.primaryKey;
    select.replaceChildren(new Option(t.noPrimaryKey, ""));
    for (const c of model.columns) select.add(new Option(c.name, c.name));
    // Preserve an explicit selection across edits so a missing key fails visibly.
    if (chosen && !model.columns.some((c) => c.name === chosen))
      select.add(new Option(chosen, chosen));
    select.value = chosen;
  }
  function receive(task: Task, result: Result<Analysis | Output>) {
    if (task.revision !== revision) return;
    worker?.terminate();
    worker = undefined;
    if (!result.ok) {
      failure(result.error);
      return;
    }
    if (task.action === "analyze") {
      inspect(result.value as Analysis);
      process("ready");
      status(t.ready);
    } else {
      current = result.value as Output;
      inspect(current.analysis);
      output.textContent = current.sql;
      process("success");
      el<HTMLButtonElement>("jtsCopy").disabled = false;
      el<HTMLButtonElement>("jtsDownload").disabled = false;
      status(
        tr(
          t.statistics,
          Object.fromEntries(
            ["rows", "columns", "statements", "bytes"].map((k) => [
              k,
              fmt.format(current![k as "rows"]),
            ]),
          ),
        ),
      );
    }
  }
  function mainThread(task: Task) {
    fallbackTimer = window.setTimeout(() => {
      if (task.revision !== revision) return;
      receive(
        task,
        task.action === "generate"
          ? generateSql(task.text, task.options)
          : analyze(task.text, task.options),
      );
    }, 0);
  }
  function task(action: "analyze" | "generate") {
    stop();
    revision++;
    if (action === "generate") {
      error = undefined;
      delete root.dataset.errorCode;
      show(el("jtsError"), false);
      show(el("jtsManualArea"), false);
      current = undefined;
      output.textContent = "-- SQL\n-- " + t.emptyResult;
      el<HTMLButtonElement>("jtsCopy").disabled = true;
      el<HTMLButtonElement>("jtsDownload").disabled = true;
    }
    const snapshot: Task = {
      revision,
      action,
      text: input.value,
      options: { ...options },
    };
    process(action === "analyze" ? "analyzing" : "generating");
    status(t.loading);
    if (workerFailed) {
      mainThread(snapshot);
      return;
    }
    try {
      worker = new Worker(new URL("./json-to-sql-worker.ts", import.meta.url), {
        type: "module",
      });
      worker.onmessage = (e) => {
        if (e.data.revision === snapshot.revision)
          receive(snapshot, e.data.result);
      };
      worker.onerror = (e) => {
        e.preventDefault();
        if (snapshot.revision !== revision) return;
        worker?.terminate();
        worker = undefined;
        workerFailed = true;
        degraded();
        mainThread(snapshot);
      };
      worker.postMessage(snapshot);
    } catch {
      workerFailed = true;
      degraded();
      mainThread(snapshot);
    }
  }
  function changed() {
    invalidate();
    if (input.value.trim())
      debounce = window.setTimeout(() => task("analyze"), 300);
  }
  input.addEventListener("input", changed);
  el("jtsGenerate").addEventListener("click", () => task("generate"));
  el("jtsClear").addEventListener("click", () => {
    input.value = "";
    invalidate();
    safeFocus(input);
  });
  el("jtsCancel").addEventListener("click", () => {
    invalidate();
    process("cancelled");
    status(t.cancelled);
  });
  for (const sample of root.querySelectorAll<HTMLButtonElement>(
    "[data-sample]",
  ))
    sample.addEventListener("click", () => {
      input.value = samples[sample.dataset.sample!];
      changed();
    });
  function readOptions() {
    const value = (id: string) =>
      el<HTMLInputElement | HTMLSelectElement>(id).value;
    options = {
      ...options,
      dialect: value("jtsDialect") as Options["dialect"],
      mode: value("jtsMode") as Options["mode"],
      table: value("jtsTable"),
      batchSize: Number(value("jtsBatch")),
      nested: value("jtsNested") as Options["nested"],
      mixed: value("jtsMixed") as Options["mixed"],
      dates: el<HTMLInputElement>("jtsDates").checked,
      includeCreate: el<HTMLInputElement>("jtsIncludeCreate").checked,
      primaryKey: value("jtsPrimaryKey"),
    };
    show(el("jtsBatchArea"), options.mode === "insert");
    show(el("jtsCreateArea"), options.mode === "insert");
  }
  panel.addEventListener("input", () => {
    readOptions();
    changed();
  });
  function toggleSettings() {
    if (!settingsOpen)
      settingsReturnToReveal = root.dataset.presentationState === "reveal";
    settingsOpen = !settingsOpen;
    if (!settingsOpen && !settingsReturnToReveal) {
      collapse();
      return;
    }
    setView(settingsOpen ? "settingsOpen" : "reveal");
    settingsToggle.closest(".jts-actions")?.scrollIntoView({
      block: settingsOpen ? "start" : "nearest",
    });
    if (settingsOpen) {
      safeFocus(el("jtsDialect"));
    } else {
      safeFocus(settingsToggle);
    }
  }
  settingsToggle.addEventListener("click", toggleSettings);
  el("jtsSettingsClose").addEventListener("click", toggleSettings);
  exit.addEventListener("click", (e) => {
    e.preventDefault();
    expand();
  });
  el("jtsLocate").addEventListener("click", () => {
    if (!error) return;
    if (error.field) {
      if (!settingsOpen) settingsReturnToReveal = true;
      settingsOpen = true;
      setView("settingsOpen");
      el(error.field).scrollIntoView({ block: "center" });
      safeFocus(el(error.field));
    } else if (error.offset !== undefined) {
      input.scrollIntoView({ block: "center" });
      safeFocus(input);
      input.setSelectionRange(error.offset, error.endOffset ?? error.offset);
    }
  });
  el("jtsCopy").addEventListener("click", async () => {
    if (!current) return;
    const rev = revision,
      sql = current.sql;
    try {
      await navigator.clipboard.writeText(sql);
      if (rev === revision) status(t.copied);
    } catch {
      if (rev !== revision) return;
      expand();
      show(el("jtsManualArea"), true);
      const manual = el<HTMLTextAreaElement>("jtsManual");
      manual.value = sql;
      safeFocus(manual);
      manual.select();
      status(t.manual);
    }
  });
  el("jtsDownload").addEventListener("click", () => {
    if (!current) return;
    let url: string | undefined;
    try {
      url = URL.createObjectURL(
        new Blob([current.sql], { type: "application/sql;charset=utf-8" }),
      );
      const link = document.createElement("a");
      link.href = url;
      link.download = `json-to-sql-${options.dialect}-${options.mode}.sql`;
      link.hidden = true;
      root.append(link);
      link.click();
      link.remove();
      status(t.downloadRequested);
    } catch {
      status(t.downloadFailed);
    } finally {
      if (url) {
        const release = url;
        window.setTimeout(() => URL.revokeObjectURL(release), 1000);
      }
    }
  });
  async function fullscreen() {
    if (document.fullscreenElement === root) {
      try {
        await document.exitFullscreen();
      } catch {
        fullscreenFailed = true;
        degraded();
        announce(t.fullscreenFallback);
      }
      return;
    }
    focusBeforeFullscreen = document.activeElement as HTMLElement;
    viewBeforeFullscreen = root.dataset.presentationState!;
    settingsBeforeFullscreen = settingsOpen;
    try {
      if (!root.requestFullscreen) throw new Error();
      await root.requestFullscreen();
      root.dataset.presentationMode = "fullscreen";
      collapse();
    } catch {
      fullscreenFailed = true;
      degraded();
      root.dataset.presentationMode = "fallback";
      announce(t.fullscreenFallback);
      if (["reveal", "settingsOpen"].includes(viewBeforeFullscreen)) {
        setView(viewBeforeFullscreen);
        if (focusBeforeFullscreen) safeFocus(focusBeforeFullscreen);
      } else collapse();
    }
  }
  el("jtsFullscreen").addEventListener("click", fullscreen);
  document.addEventListener("fullscreenchange", () => {
    if (document.fullscreenElement === root) {
      root.dataset.presentationMode = "fullscreen";
      collapse();
    } else {
      root.dataset.presentationMode = fullscreenFailed ? "fallback" : "inline";
      settingsOpen = settingsBeforeFullscreen;
      setView(viewBeforeFullscreen);
      if (focusBeforeFullscreen) {
        focusBeforeFullscreen.scrollIntoView({ block: "nearest" });
        safeFocus(focusBeforeFullscreen);
      }
    }
  });
  if (presentation.interaction.revealTriggers.includes("pointer"))
    document.addEventListener("pointermove", () => expand(), { passive: true });
  if (presentation.interaction.revealTriggers.includes("focus"))
    document.addEventListener("focusin", () => {
      if (!suppressFocus) expand();
    });
  document.addEventListener("keydown", (e) => {
    const combo = `${e.ctrlKey ? "Control+" : e.metaKey ? "Meta+" : ""}${e.key}`;
    const action = (
      presentation.interaction.shortcuts as Record<string, string>
    )[combo];
    if (action === "generate" && root.contains(e.target as Node)) {
      e.preventDefault();
      task("generate");
    } else if (action === "settings") {
      e.preventDefault();
      toggleSettings();
    } else if (action === "fullscreen") {
      e.preventDefault();
      void fullscreen();
    } else if (action === "exit") {
      e.preventDefault();
      collapse();
    } else if (
      presentation.interaction.revealTriggers.includes("keyboard") &&
      !["Shift", "Control", "Meta", "Alt"].includes(e.key)
    )
      expand();
  });
  window.addEventListener("pagehide", () => {
    stop();
    restoreInert();
    clearTimeout(hideTimer);
  });
  degraded();
  setView("primary");
}
