import {
  SOURCES,
  STORAGE_KEY,
  validateTimeResponse,
  estimateOffset,
  aggregateSamples,
  formatDelta,
  formatBeijing,
  formatNumber,
  parseHistory,
  serializeHistory,
  appendHistory,
  liveReference,
  roundReason,
  type Language,
  type Snapshot,
  type Reason,
} from "../lib/time-sync";
import type { TimeSyncCopy } from "../lib/time-sync-i18n";
const root = document.querySelector<HTMLElement>("#timeSync");
if (root) setup(root);
function setup(root: HTMLElement) {
  const lang = root.dataset.lang as Language,
    t = JSON.parse(root.querySelector("#tsCopy")!.textContent!) as TimeSyncCopy;
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>("#" + id)!;
  const text = (id: string, s: string) => {
    get(id).textContent = s;
  };
  const start = get<HTMLButtonElement>("tsStart"),
    cancel = get<HTMLButtonElement>("tsCancel"),
    copyCurrent = get<HTMLButtonElement>("tsCopyCurrent");
  let sequence = 0,
    controller: AbortController | null = null,
    current: Snapshot | null = null,
    records: Snapshot[] = [],
    blocked = false;
  let anchor: { networkMs: number; monoMs: number } | null = null,
    lastWall = Date.now(),
    lastMono = performance.now();
  const ms = (n: number | null) =>
    n === null ? "—" : `${formatNumber(n, lang, 2)} ms`;
  const date = (n: number | null) => {
    if (n === null) return "—";
    const d = formatBeijing(n, lang);
    return `${d.date} ${d.time} UTC+8`;
  };
  const reason = (r: Reason | null) =>
    r ? (t.errors[r] ?? t.errors["upstream-invalid"]) : "—";
  const state = (s: string, message?: string) => {
    root.dataset.state = s;
    text("tsStatus", message ?? (t[s as keyof TimeSyncCopy] as string));
  };
  function invalidate() {
    anchor = null;
    text("tsNetworkTime", "—");
    text("tsNetworkDate", t.expired);
    text("tsValidity", t.expired);
    if (root.dataset.state !== "loading") state("expired");
  }
  function tick() {
    const wall = Date.now(),
      mono = performance.now();
    const d = formatBeijing(wall, lang);
    text("tsDeviceTime", d.time);
    text("tsDeviceDate", d.date);
    if (anchor) {
      if (
        Math.abs(wall - lastWall - (mono - lastMono)) > 100 ||
        document.hidden
      ) {
        invalidate();
      } else {
        const n = liveReference(anchor, mono);
        if (n === null) invalidate();
        else {
          const c = formatBeijing(n, lang);
          text("tsNetworkTime", c.time);
          text("tsNetworkDate", c.date);
          text(
            "tsUncertainty",
            ms(current!.uncertaintyMs! + (mono - anchor.monoMs) * 0.0001),
          );
        }
      }
    }
    lastWall = wall;
    lastMono = mono;
    get("tsOffline").hidden = navigator.onLine !== false;
  }
  function reset() {
    anchor = null;
    current = null;
    copyCurrent.disabled = true;
    get("tsManualArea").hidden = true;
    get<HTMLTextAreaElement>("tsManual").value = "";
    text("tsClipboardStatus", "");
    text("tsNetworkTime", "—");
    text("tsNetworkDate", t.idle);
    for (const id of [
      "tsOffset",
      "tsUncertainty",
      "tsRtt",
      "tsMeasured",
      "tsRuntime",
    ])
      text(id, "—");
    text("tsValidity", t.idle);
    get("tsSourceTable").hidden = true;
    get("tsSourceEmpty").hidden = false;
  }
  function doneLoading() {
    controller = null;
    cancel.hidden = true;
    start.textContent = t.start;
    get("tsResults").setAttribute("aria-busy", "false");
  }
  function cancelRound(hidden = false) {
    sequence++;
    controller?.abort();
    doneLoading();
    reset();
    state(hidden ? "expired" : "idle");
    if (hidden) {
      text("tsNetworkDate", t.expired);
      text("tsValidity", t.expired);
    }
  }
  const labels = [
    t.source,
    t.offset,
    t.upstream,
    t.cache,
    t.age,
    t.uncertainty,
    t.participates,
    t.reason,
  ];
  function tableRows(body: HTMLElement, snapshot: Snapshot) {
    body.replaceChildren();
    for (const s of snapshot.sources) {
      const row = document.createElement("tr");
      const values = [
        s.source,
        s.offsetMs === null ? "—" : formatDelta(s.offsetMs, lang),
        ms(s.upstreamRttMs),
        s.cached === null ? "—" : s.cached ? t.cached : t.fresh,
        ms(s.sampleAgeMs),
        ms(s.uncertaintyMs),
        s.included && snapshot.offsetMs !== null ? t.yes : t.no,
        s.reason
          ? reason(s.reason)
          : s.upstreamRttMs === 2000
            ? t.highLatency
            : "—",
      ];
      values.forEach((v, i) => {
        const td = document.createElement("td");
        td.dataset.label = labels[i];
        td.textContent = v;
        row.append(td);
      });
      body.append(row);
    }
  }
  function sourceTable(snapshot: Snapshot) {
    const table = document.createElement("table");
    table.className = "ts-table";
    const caption = document.createElement("caption");
    caption.textContent = t.sources;
    table.append(caption);
    const head = document.createElement("thead"),
      tr = document.createElement("tr");
    labels.forEach((l) => {
      const th = document.createElement("th");
      th.scope = "col";
      th.textContent = l;
      tr.append(th);
    });
    head.append(tr);
    const body = document.createElement("tbody");
    table.append(head, body);
    tableRows(body, snapshot);
    return table;
  }
  function summary(s: Snapshot) {
    return [
      t.summary,
      `${t.measured}: ${date(s.deviceAtMs)}`,
      `${t.network}: ${date(s.networkAtMs)}`,
      `${t.validity}: ${t[s.status]}`,
      `${t.offset}: ${s.offsetMs === null ? "—" : formatDelta(s.offsetMs, lang)}`,
      `${t.uncertainty}: ${ms(s.uncertaintyMs)}`,
      `${t.rtt}: ${ms(s.browserRttMs)}`,
      `${t.runtime}: ${date(s.runtimeAtMs)}`,
      ...s.sources.map((a) =>
        [
          a.source,
          `${t.offset}: ${a.offsetMs === null ? "—" : formatDelta(a.offsetMs, lang)}`,
          `${t.uncertainty}: ${ms(a.uncertaintyMs)}`,
          `${t.upstream}: ${ms(a.upstreamRttMs)}`,
          `${t.age}: ${ms(a.sampleAgeMs)}`,
          `${t.cache}: ${a.cached === null ? "—" : a.cached ? t.cached : t.fresh}`,
          `${t.participates}: ${a.included && s.offsetMs !== null ? t.yes : t.no}`,
          `${t.reason}: ${reason(a.reason)}`,
        ].join("; "),
      ),
      t.disclaimer,
      t.limits,
    ].join("\n");
  }
  async function copy(s: Snapshot) {
    const value = summary(s);
    try {
      await navigator.clipboard.writeText(value);
      get("tsManualArea").hidden = true;
      text("tsClipboardStatus", t.copied);
    } catch {
      get("tsManualArea").hidden = false;
      const area = get<HTMLTextAreaElement>("tsManual");
      area.value = value;
      text("tsClipboardStatus", t.manual);
      area.focus();
      area.select();
    }
  }
  function svg(name: string, attrs: Record<string, string>) {
    const n = document.createElementNS("http://www.w3.org/2000/svg", name);
    Object.entries(attrs).forEach(([k, v]) => n.setAttribute(k, v));
    return n;
  }
  function history() {
    const list = get("tsHistory");
    list.replaceChildren();
    get("tsHistoryEmpty").hidden = records.length > 0;
    for (const s of records) {
      const li = document.createElement("li"),
        details = document.createElement("details"),
        head = document.createElement("summary");
      const time = document.createElement("span"),
        status = document.createElement("span");
      time.textContent = date(s.deviceAtMs);
      status.textContent = `${t[s.status]}${s.offsetMs === null ? "" : ` · ${formatDelta(s.offsetMs, lang)}`}`;
      head.append(time, status);
      details.append(head);
      const meta = document.createElement("p");
      meta.className = "ts-note";
      meta.textContent = `${t.detail} · ${t.rtt}: ${ms(s.browserRttMs)} · ${t.uncertainty}: ${ms(s.uncertaintyMs)}`;
      details.append(meta, sourceTable(s));
      const button = document.createElement("button");
      button.type = "button";
      button.className = "btn btn-secondary btn-sm";
      button.textContent = t.copy;
      button.addEventListener("click", () => void copy(s));
      details.append(button);
      li.append(details);
      list.append(li);
    }
    const chart = get("tsChart");
    chart.replaceChildren();
    get("tsTrend").hidden = !records.some((s) => s.offsetMs !== null);
    chart.append(
      svg("line", {
        x1: "24",
        y1: "70",
        x2: "616",
        y2: "70",
        class: "ts-zero",
      }),
    );
    const zero = svg("text", { x: "2", y: "74", class: "ts-chart-label" });
    zero.textContent = "0";
    chart.append(zero);
    const old = [...records].reverse(),
      scale = Math.max(1, ...old.map((s) => Math.abs(s.offsetMs ?? 0))),
      y = (n: number) => 70 - (n / scale) * 50,
      x = (i: number) =>
        old.length === 1 ? 320 : 30 + (i * 580) / (old.length - 1);
    let prior: { x: number; y: number } | null = null;
    old.forEach((s, i) => {
      if (s.offsetMs === null) {
        prior = null;
        return;
      }
      const p = { x: x(i), y: y(s.offsetMs) };
      if (prior)
        chart.append(
          svg("line", {
            x1: String(prior.x),
            y1: String(prior.y),
            x2: String(p.x),
            y2: String(p.y),
            class: "ts-line",
          }),
        );
      const point = svg("circle", {
          cx: String(p.x),
          cy: String(p.y),
          r: "4",
          class: "ts-point",
        }),
        title = svg("title", {});
      title.textContent = `${date(s.deviceAtMs)}: ${formatDelta(s.offsetMs, lang)}`;
      point.append(title);
      chart.append(point);
      prior = p;
    });
  }
  function notice(s: string) {
    get("tsStorageNotice").hidden = false;
    text("tsStorageNotice", s);
  }
  function restore(value?: string | null) {
    try {
      const parsed = parseHistory(
        value === undefined ? localStorage.getItem(STORAGE_KEY) : value,
      );
      records = parsed.records;
      blocked = parsed.blocked;
      get("tsStorageNotice").hidden = !parsed.error;
      if (parsed.error) notice(t.corrupt);
    } catch {
      records = [];
      blocked = true;
      notice(t.storage);
    }
    history();
  }
  function save(s: Snapshot) {
    records = appendHistory(records, s);
    history();
    if (blocked) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeHistory(records));
    } catch {
      notice(t.storage);
    }
  }
  async function readBody(response: Response, signal: AbortSignal) {
    if (!response.body) throw new Error("upstream-invalid");
    const reader = response.body.getReader();
    const abort = () => {
      void reader.cancel().catch(() => {});
    };
    signal.addEventListener("abort", abort, { once: true });
    let size = 0,
      value = "";
    const decoder = new TextDecoder();
    try {
      while (true) {
        signal.throwIfAborted();
        const part = await reader.read();
        signal.throwIfAborted();
        if (part.done) return value + decoder.decode();
        size += part.value.byteLength;
        if (size > 65536) {
          void reader.cancel().catch(() => {});
          throw new Error("upstream-too-large");
        }
        value += decoder.decode(part.value, { stream: true });
      }
    } finally {
      signal.removeEventListener("abort", abort);
      reader.releaseLock();
    }
  }
  async function measure() {
    const id = ++sequence;
    controller?.abort();
    const own = new AbortController();
    controller = own;
    reset();
    state("loading");
    start.textContent = t.restart;
    cancel.hidden = false;
    get("tsResults").setAttribute("aria-busy", "true");
    const w0 = Date.now(),
      p0 = performance.now();
    let timedOut = false;
    const timer = setTimeout(() => {
      timedOut = true;
      own.abort();
    }, 5000);
    let snapshot: Snapshot | null = null;
    try {
      const response = await fetch("/api/time-sync", {
        signal: own.signal,
        cache: "no-store",
        credentials: "omit",
      });
      const raw = await readBody(response, own.signal),
        w1 = Date.now(),
        p1 = performance.now();
      if (id !== sequence) return;
      let data: unknown;
      try {
        data = JSON.parse(raw);
      } catch {
        throw new Error("upstream-invalid");
      }
      const v = validateTimeResponse(data);
      if (!v.value) throw new Error("upstream-invalid");
      if (
        ![200, 502, 504].includes(response.status) ||
        (response.status === 200) !== v.value.ok
      )
        throw new Error("upstream-invalid");
      const anchors = { w0, w1, p0, p1 },
        samples = v.value.sources.map((s) => estimateOffset(s, anchors)),
        agg = aggregateSamples(samples),
        r = p1 - p0;
      snapshot = {
        id: `${id}-${p1}-${w1}`,
        deviceAtMs: w1,
        networkAtMs: agg.offsetMs === null ? null : w0 + r + agg.offsetMs,
        status: agg.status,
        offsetMs: agg.offsetMs,
        uncertaintyMs: agg.uncertaintyMs,
        browserRttMs: r < 0 || !Number.isFinite(r) ? null : r,
        runtimeAtMs: v.value.responseAtRuntimeMs,
        sources: samples,
      };
      if (snapshot.networkAtMs !== null) {
        anchor = { networkMs: snapshot.networkAtMs, monoMs: p1 };
        lastWall = w1;
        lastMono = p1;
      }
      const jump = roundReason(anchors);
      state(
        agg.status,
        jump ? `${t.unavailable} · ${reason(jump)}` : undefined,
      );
    } catch (error) {
      if (id !== sequence) return;
      if (own.signal.aborted && !timedOut) return;
      const code = timedOut
        ? "upstream-timeout"
        : error instanceof Error && error.message === "upstream-too-large"
          ? "upstream-too-large"
          : error instanceof TypeError
            ? "upstream-http"
            : "upstream-invalid";
      snapshot = {
        id: `${id}-${performance.now()}-${Date.now()}`,
        deviceAtMs: Date.now(),
        networkAtMs: null,
        status: "unavailable",
        offsetMs: null,
        uncertaintyMs: null,
        browserRttMs: Math.max(0, performance.now() - p0),
        runtimeAtMs: null,
        sources: SOURCES.map((source) => ({
          source,
          offsetMs: null,
          uncertaintyMs: null,
          upstreamRttMs: null,
          sampleAgeMs: null,
          cached: null,
          included: false,
          reason: code,
        })),
      };
      state("unavailable", `${t.unavailable} · ${t.errors[code]}`);
    } finally {
      clearTimeout(timer);
      if (id === sequence) {
        doneLoading();
        if (snapshot) {
          current = snapshot;
          copyCurrent.disabled = false;
          text(
            "tsOffset",
            snapshot.offsetMs === null
              ? "—"
              : formatDelta(snapshot.offsetMs, lang),
          );
          text("tsUncertainty", ms(snapshot.uncertaintyMs));
          text(
            "tsRtt",
            ms(snapshot.browserRttMs) +
              (snapshot.browserRttMs === 2000 ? ` · ${t.highLatency}` : ""),
          );
          text("tsMeasured", date(snapshot.deviceAtMs));
          text("tsRuntime", date(snapshot.runtimeAtMs));
          text("tsValidity", anchor ? t.valid : t[snapshot.status]);
          text("tsNetworkDate", anchor ? "—" : t[snapshot.status]);
          text(
            "tsCount",
            String(snapshot.sources.filter((s) => s.included).length),
          );
          get("tsSourceTable").hidden = false;
          get("tsSourceEmpty").hidden = true;
          tableRows(get("tsSourceRows"), snapshot);
          save(snapshot);
          tick();
        }
      }
    }
  }
  start.addEventListener("click", () => void measure());
  cancel.addEventListener("click", () => cancelRound());
  copyCurrent.addEventListener("click", () => {
    if (current) void copy(current);
  });
  root.addEventListener("keydown", (event) => {
    if (event.key === "Enter" && (event.ctrlKey || event.metaKey)) {
      event.preventDefault();
      void measure();
    }
  });
  get("tsClear").addEventListener("click", () => {
    get("tsClearConfirm").hidden = false;
    get("tsConfirmClear").focus();
  });
  get("tsKeepHistory").addEventListener("click", () => {
    get("tsClearConfirm").hidden = true;
    get("tsClear").focus();
  });
  get("tsConfirmClear").addEventListener("click", () => {
    try {
      localStorage.removeItem(STORAGE_KEY);
      records = [];
      blocked = false;
      get("tsStorageNotice").hidden = true;
      get("tsClearConfirm").hidden = true;
      history();
      get("tsClear").focus();
    } catch {
      notice(t.clearFailed);
    }
  });
  window.addEventListener("storage", (event) => {
    if (event.key === STORAGE_KEY || event.key === null)
      restore(event.newValue);
  });
  document.addEventListener("visibilitychange", () => {
    if (document.hidden) {
      if (controller) cancelRound(true);
      else if (current) invalidate();
    } else tick();
  });
  window.addEventListener("pagehide", () => {
    if (controller) cancelRound(true);
    else if (current) invalidate();
  });
  root.querySelector("[data-example=behind]")!.textContent = formatDelta(
    1200,
    lang,
  );
  root.querySelector("[data-example=ahead]")!.textContent = formatDelta(
    -800,
    lang,
  );
  restore();
  tick();
  setInterval(tick, 250);
}
