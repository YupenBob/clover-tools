import {
  parseInput,
  validateResponse,
  comparisonRows,
  filterRows,
  signalState,
  shareFragment,
  parseShare,
  appendHistory,
  parseHistory,
  serializeHistory,
  formatUtc,
  STORAGE_KEY,
  type Language,
  type Envelope,
  type Report,
  type Resolution,
  type Snapshot,
  type FieldId,
} from "../lib/ip-reputation";
import { ipReputationCopy } from "../lib/ip-reputation-i18n";
import type { ErrorCode } from "../../functions/lib/ip-reputation";
const mount = document.querySelector<HTMLElement>("#ipReputation");
if (mount) {
  const root = mount;
  const lang = root.dataset.lang as Language,
    { text: t, fields, errors } = ipReputationCopy(lang);
  const get = <T extends HTMLElement = HTMLElement>(id: string) =>
    root.querySelector<T>("#ipr" + id)!;
  const query = get<HTMLInputElement>("Query"),
    submit = get<HTMLButtonElement>("Submit"),
    cancel = get<HTMLButtonElement>("Cancel"),
    copy = get<HTMLButtonElement>("Copy"),
    share = get<HTMLButtonElement>("Share"),
    json = get<HTMLTextAreaElement>("Json");
  const el = <K extends keyof HTMLElementTagNameMap>(tag: K, text?: string) => {
    const e = document.createElement(tag);
    if (text !== undefined) e.textContent = text;
    return e;
  };
  let sequence = 0,
    controller: AbortController | null = null,
    operation = "",
    resolution: Resolution | null = null,
    current: Envelope | null = null,
    conditions = { q: "", ip: "" },
    hint = "",
    entries: Snapshot[] = [],
    persistent = true;
  const state = (value: string, message = t[value] ?? value) => {
    root.dataset.state = value;
    get("Status").textContent = message;
    const busy = value === "querying" || value === "resolving";
    get("Results").setAttribute("aria-busy", String(busy));
    cancel.disabled = !busy;
    submit.disabled = busy;
    get<HTMLButtonElement>("SelectedLookup").disabled = busy;
  };
  const updateSubmit = () => {
    const p = parseInput(query.value);
    submit.textContent = p.ok && p.kind === "domain" ? t.resolve : t.lookup;
  };
  function invalidate() {
    sequence++;
    controller?.abort();
    controller = null;
    operation = "";
    current = null;
    resolution = null;
    copy.disabled = true;
    share.disabled = true;
    json.value = "";
    get("Manual").hidden = true;
    get("ManualLabel").hidden = true;
    get("CopyStatus").textContent = "";
    get("Resolution").hidden = true;
    get("Candidates").replaceChildren(el("legend", t.candidates));
    get("DnsStatus").replaceChildren();
    get<HTMLTextAreaElement>("Manual").value = "";
    get("Summary").hidden = true;
    get("SnapshotBanner").hidden = true;
    get("Rows").replaceChildren();
    get("SourceHeaders").replaceChildren();
    get("SourceHeaders").hidden = true;
    get("Sources").replaceChildren();
    get("Indicators").replaceChildren();
    get("ExplanationTitle").textContent = t.fieldExplanation;
    get("ExplanationText").textContent = t.explanationEmpty;
    get("Empty").hidden = false;
    get("Empty").textContent = t.idle;
    state("idle");
    updateSubmit();
  }
  function persist() {
    if (!persistent) return;
    try {
      localStorage.setItem(STORAGE_KEY, serializeHistory(entries));
    } catch {
      persistent = false;
      get("StorageNotice").textContent = t.memory;
    }
  }
  function renderHistory() {
    get("HistoryEmpty").hidden = entries.length > 0;
    const list = get("History");
    list.replaceChildren();
    for (const s of entries) {
      const li = el("li");
      li.append(
        el("strong", s.query + " → " + s.selectedIp),
        el(
          "p",
          t.snapshot +
            " · " +
            t.mode +
            ": " +
            (s.report.data as Report).enhancement
              .replace("key-required", t.basic)
              .replace("enabled", t.enhanced),
        ),
      );
      for (const source of (s.report.data as Report).sources)
        if (source.fetchedAt)
          li.append(
            el("p", source.id + " · " + formatUtc(source.fetchedAt, lang)),
          );
      const view = el("button", t.view),
        rerun = el("button", t.rerun);
      view.type = rerun.type = "button";
      view.className = rerun.className = "btn btn-secondary btn-sm";
      view.addEventListener("click", () => {
        invalidate();
        query.value = s.query;
        updateSubmit();
        conditions = { q: s.query, ip: s.selectedIp };
        renderReport(s.report, 0, true);
      });
      rerun.addEventListener("click", () => {
        invalidate();
        query.value = s.query;
        hint = s.selectedIp;
        updateSubmit();
        void execute();
      });
      li.append(view, rerun);
      list.append(li);
    }
  }
  function renderResolution(value: Resolution) {
    resolution = value;
    get("Resolution").hidden = false;
    get("DnsStatus").replaceChildren();
    for (const f of value.families) {
      const text =
        f.type +
        " · " +
        (f.error
          ? errors[f.error.code]
          : f.status === "empty"
            ? errors["dns-no-address"]
            : t.success) +
        (f.fetchedAt ? " · " + formatUtc(f.fetchedAt, lang) : "") +
        " · " +
        (f.cacheHit ? t.cache + " " + f.cacheAgeMs + " ms" : t.fresh);
      get("DnsStatus").append(el("p", text));
    }
    const candidates = get("Candidates");
    candidates.replaceChildren(el("legend", t.candidates));
    const selected = value.addresses.some((a) => a.ip === hint)
      ? hint
      : value.addresses[0]?.ip;
    for (const a of value.addresses) {
      const label = el("label"),
        radio = el("input");
      radio.type = "radio";
      radio.name = "iprAddress";
      radio.value = a.ip;
      radio.checked = a.ip === selected;
      label.append(radio, el("span", a.ip + " · IPv" + a.ipVersion));
      candidates.append(label);
    }
    get("DnsNote").textContent =
      t.filtered +
      ": " +
      value.filteredCount +
      (value.truncated ? " · " + t.truncated : "");
    get<HTMLButtonElement>("SelectedLookup").disabled = !value.addresses.length;
    hint = "";
    share.disabled = !value.addresses.length;
    conditions = { q: value.query, ip: selected ?? "" };
  }
  function renderRows() {
    if (!current || current.kind !== "report") return;
    const report = current.data as Report,
      filter = root.querySelector<HTMLInputElement>(
        "input[name=iprFilter]:checked",
      )?.value as "all" | "differences" | "provided";
    const rows = filterRows(comparisonRows(report), filter ?? "all"),
      container = get("Rows");
    container.replaceChildren();
    get("Empty").hidden = rows.length > 0;
    get("Empty").textContent = t.noRows;
    for (const row of rows) {
      const section = el("section");
      section.className = "ipr-row";
      section.dataset.field = row.id;
      section.dataset.comparison = row.comparison;
      const head = el("div"),
        title = el("h3", fields[row.id].label);
      head.className = "ipr-row-heading";
      const badge = el("span", t[row.comparison]);
      badge.className = "ipr-badge";
      head.append(title, badge);
      section.append(head);
      const dl = el("dl");
      dl.className = "ipr-values";
      for (const cell of row.values) {
        const d = el("div"),
          value = cell.field.value,
          display =
            typeof value === "boolean"
              ? t[signalState(cell.field)]
              : (value ?? t[cell.field.reason ?? "not-provided"]);
        d.dataset.source = cell.source;
        d.append(el("dt", cell.source), el("dd", display));
        dl.append(d);
      }
      section.append(dl);
      const details = el("details");
      details.append(
        el("summary", fields[row.id].label + " · " + t.upstreamField),
        el("p", fields[row.id].explanation),
      );
      for (const cell of row.values)
        details.append(
          el(
            "p",
            cell.source +
              " · " +
              (cell.field.upstreamField ?? t.unsupported) +
              " · " +
              (cell.fetchedAt
                ? formatUtc(cell.fetchedAt, lang)
                : t["not-provided"]),
          ),
        );
      details.addEventListener("toggle", () => {
        if (details.open) {
          get("ExplanationTitle").textContent = fields[row.id].label;
          get("ExplanationText").textContent = fields[row.id].explanation;
        }
      });
      section.append(details);
      container.append(section);
    }
  }
  function renderReport(response: Envelope, elapsed: number, snapshot = false) {
    current = response;
    const report = response.data as Report;
    get("SnapshotBanner").hidden = !snapshot;
    const summary = get("Summary");
    summary.hidden = false;
    summary.replaceChildren();
    const summaryItems = [
      [t.target, report.ip + " · IPv" + report.ipVersion],
      [
        t.count,
        String(report.sources.filter((s) => s.status === "success").length) +
          " / " +
          report.sources.filter((s) => s.status !== "disabled").length +
          (report.sources.filter((s) => s.status === "success").length === 1
            ? " · " + t.single
            : ""),
      ],
      [t.enhancement, report.enhancement === "enabled" ? t.enabled : t.noKey],
      [
        t.responseAt,
        formatUtc(response.responseAt, lang) +
          (elapsed
            ? " · " + t.elapsed + ": " + Math.round(elapsed) + " ms"
            : ""),
      ],
    ];
    for (const [label, value] of summaryItems) {
      const d = el("div"),
        dl = el("dl");
      dl.append(el("dt", label), el("dd", value));
      d.append(dl);
      summary.append(d);
    }
    const headers = get("SourceHeaders"),
      sources = get("Sources");
    headers.hidden = false;
    headers.replaceChildren();
    sources.replaceChildren();
    get("Indicators").replaceChildren();
    get("ExplanationTitle").textContent = t.fieldExplanation;
    get("ExplanationText").textContent = t.explanationEmpty;
    for (const s of report.sources) {
      const h = el("div");
      h.append(
        el("strong", s.id),
        el(
          "small",
          s.fetchedAt ? formatUtc(s.fetchedAt, lang) : t["not-provided"],
        ),
        el(
          "small",
          s.cacheHit
            ? t.cache + " · " + t.age + ": " + s.cacheAgeMs + " ms"
            : s.status === "success"
              ? t.fresh
              : t[s.status],
        ),
      );
      headers.append(h);
      const source = el("section");
      source.className = "ipr-source";
      source.append(el("h3", s.id), el("p", t[s.status]));
      if (s.error)
        source.append(
          el(
            "p",
            errors[s.error.code] +
              (s.error.retryAfterSeconds !== undefined
                ? " · Retry-After: " + s.error.retryAfterSeconds + " s"
                : ""),
          ),
        );
      if (s.status === "disabled") source.append(el("p", t.noKey));
      if (s.fetchedAt) source.append(el("p", formatUtc(s.fetchedAt, lang)));
      if (s.id !== "ipapi.is")
        source.append(
          el("p", t.unsupported + ": VPN / Tor / " + fields.proxy.label),
        );
      sources.append(source);
      if (s.crawlerName)
        source.append(el("p", t.crawlerName + ": " + s.crawlerName));
      if (s.networkIndicators.length) {
        const details = el("details");
        details.append(el("summary", t.indicators));
        for (const n of s.networkIndicators)
          details.append(
            el(
              "p",
              (n.scope === "asn" ? t.asnScope : t.company) + " · " + n.raw,
            ),
          );
        get("Indicators").append(details);
      }
    }
    json.value = JSON.stringify(response, null, 2);
    copy.disabled = !response.ok;
    share.disabled = !response.ok;
    renderRows();
    state(
      snapshot ? "snapshot" : response.status,
      response.error
        ? errors[response.error.code]
        : t[snapshot ? "snapshot" : response.status],
    );
  }
  async function send(
    action: "lookup" | "resolve",
    target: string,
    original: string,
  ) {
    const op = action + ":" + target;
    if (operation === op) return;
    if (!navigator.onLine) {
      invalidate();
      get("Empty").textContent = errors.offline;
      state("unavailable", errors.offline);
      return;
    }
    sequence++;
    const requestId = sequence;
    controller?.abort();
    controller = new AbortController();
    const active = controller;
    operation = op;
    current = null;
    copy.disabled = true;
    share.disabled = true;
    get("Summary").hidden = true;
    get("Rows").replaceChildren();
    get("SourceHeaders").hidden = true;
    get("Sources").replaceChildren();
    get("Indicators").replaceChildren();
    get("ExplanationTitle").textContent = t.fieldExplanation;
    get("ExplanationText").textContent = t.explanationEmpty;
    get("Empty").hidden = false;
    get("Empty").textContent = action === "resolve" ? t.resolving : t.querying;
    get("Manual").hidden = true;
    get("ManualLabel").hidden = true;
    get("CopyStatus").textContent = "";
    json.value = "";
    get("SnapshotBanner").hidden = true;
    state(action === "resolve" ? "resolving" : "querying");
    const start = performance.now();
    let timer: ReturnType<typeof setTimeout> | undefined;
    try {
      const response = await Promise.race([
        fetch("/api/ip-reputation", {
          method: "POST",
          credentials: "omit",
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ action, query: target }),
          signal: active.signal,
        }).then(async (r) => {
          const text = await r.text();
          if (new TextEncoder().encode(text).length > 128 * 1024)
            throw new Error("invalid");
          return JSON.parse(text) as unknown;
        }),
        new Promise<never>((_, reject) => {
          timer = setTimeout(() => {
            active.abort();
            reject(new Error("timeout"));
          }, 5000);
        }),
      ]);
      if (requestId !== sequence) return;
      const value = validateResponse(response);
      if (!value) throw new Error("invalid");
      if (
        action === "resolve" &&
        value.kind === "resolution" &&
        (value.data as Resolution).query === target
      ) {
        renderResolution(value.data as Resolution);
        state(
          value.ok ? "selecting" : "unavailable",
          value.error ? errors[value.error.code] : t.selecting,
        );
      } else if (
        action === "lookup" &&
        value.kind === "report" &&
        (value.data as Report).ip === target
      ) {
        conditions = { q: original, ip: target };
        renderReport(value, performance.now() - start);
        if (value.ok) {
          entries = appendHistory(entries, {
            query: original,
            selectedIp: target,
            report: value,
          });
          persist();
          renderHistory();
        }
      } else if (value.kind === "error")
        state(
          value.status,
          value.error ? errors[value.error.code] : errors["upstream-invalid"],
        );
      else throw new Error("invalid");
    } catch (e) {
      if (requestId !== sequence) return;
      const code: ErrorCode = active.signal.aborted
        ? "upstream-timeout"
        : !navigator.onLine
          ? "offline"
          : e instanceof SyntaxError ||
              (e instanceof Error && e.message === "invalid")
            ? "upstream-invalid"
            : "upstream-http";
      state("unavailable", errors[code]);
      get("Empty").hidden = false;
      get("Empty").textContent = errors[code];
    } finally {
      if (timer) clearTimeout(timer);
      if (requestId === sequence) {
        operation = "";
        controller = null;
        cancel.disabled = true;
        submit.disabled = false;
        get<HTMLButtonElement>("SelectedLookup").disabled =
          !resolution?.addresses.length;
        get("Results").setAttribute("aria-busy", "false");
      }
    }
  }
  async function execute() {
    const p = parseInput(query.value);
    if (!p.ok) {
      invalidate();
      query.setAttribute("aria-invalid", "true");
      state("invalid", errors[p.code]);
      query.focus();
      return;
    }
    query.removeAttribute("aria-invalid");
    if (p.kind === "domain") {
      get("Resolution").hidden = true;
      resolution = null;
      await send("resolve", p.query, p.query);
    } else await send("lookup", p.query, p.query);
  }
  get("Form").addEventListener("submit", (e) => {
    e.preventDefault();
    void execute();
  });
  query.addEventListener("input", () => {
    hint = "";
    invalidate();
    query.removeAttribute("aria-invalid");
  });
  root.addEventListener("keydown", (e) => {
    if ((e.ctrlKey || e.metaKey) && e.key === "Enter") {
      e.preventDefault();
      if (resolution?.addresses.length) {
        get<HTMLButtonElement>("SelectedLookup").click();
      } else void execute();
    }
  });
  root.querySelectorAll<HTMLButtonElement>("[data-example]").forEach((button) =>
    button.addEventListener("click", () => {
      invalidate();
      hint = "";
      query.value = button.dataset.example!;
      updateSubmit();
      query.focus();
    }),
  );
  get("SelectedLookup").addEventListener("click", () => {
    const selected = root.querySelector<HTMLInputElement>(
      "input[name=iprAddress]:checked",
    )?.value;
    if (
      resolution &&
      selected &&
      resolution.addresses.some((a) => a.ip === selected)
    )
      void send("lookup", selected, resolution.query);
  });
  get("Candidates").addEventListener("change", () => {
    const q = resolution?.query,
      ip = root.querySelector<HTMLInputElement>(
        "input[name=iprAddress]:checked",
      )?.value;
    if (q && ip) {
      current = null;
      copy.disabled = true;
      json.value = "";
      get("Rows").replaceChildren();
      get("Summary").hidden = true;
      get("SnapshotBanner").hidden = true;
      sequence++;
      controller?.abort();
      controller = null;
      operation = "";
      conditions = { q, ip };
      get("SourceHeaders").hidden = true;
      get("Sources").replaceChildren();
      get("Indicators").replaceChildren();
      get("ExplanationTitle").textContent = t.fieldExplanation;
      get("ExplanationText").textContent = t.explanationEmpty;
      get("Empty").hidden = false;
      get("Empty").textContent = t.selecting;
      share.disabled = false;
      state("selecting");
    }
  });
  cancel.addEventListener("click", () => {
    invalidate();
    state("cancelled");
  });
  get("Clear").addEventListener("click", () => {
    invalidate();
    query.value = "";
    hint = "";
    updateSubmit();
    query.focus();
  });
  get("Filters").addEventListener("change", renderRows);
  async function clipboard(text: string) {
    try {
      await navigator.clipboard.writeText(text);
      get("CopyStatus").textContent = t.copied;
    } catch {
      get("CopyStatus").textContent = errors["clipboard-denied"];
      const manual = get<HTMLTextAreaElement>("Manual");
      manual.hidden = false;
      get("ManualLabel").hidden = false;
      manual.value = text;
      manual.focus();
      manual.select();
    }
  }
  copy.addEventListener("click", () => {
    if (current?.ok) void clipboard(json.value);
  });
  share.addEventListener("click", () => {
    const fragment = shareFragment(
      conditions.q,
      root.querySelector<HTMLInputElement>("input[name=iprAddress]:checked")
        ?.value ?? conditions.ip,
    );
    if (fragment)
      void clipboard(location.origin + location.pathname + fragment);
  });
  get("ClearHistory").addEventListener("click", () => {
    get("Confirm").hidden = false;
    get("ConfirmClear").focus();
  });
  get("Keep").addEventListener("click", () => {
    get("Confirm").hidden = true;
    get("ClearHistory").focus();
  });
  get("ConfirmClear").addEventListener("click", () => {
    entries = [];
    let cleared = true;
    try {
      localStorage.removeItem(STORAGE_KEY);
    } catch {
      try {
        localStorage.setItem(STORAGE_KEY, serializeHistory([]));
      } catch {
        cleared = false;
        persistent = false;
        get("StorageNotice").textContent = t.memory;
      }
    }
    if (cleared && persistent) get("StorageNotice").textContent = "";
    get("Confirm").hidden = true;
    renderHistory();
    get("CopyStatus").textContent = cleared ? t.cleared : t.clearFailed;
    get("ClearHistory").focus();
  });
  try {
    const stored = localStorage.getItem(STORAGE_KEY);
    if (stored) {
      const parsed = parseHistory(stored);
      entries = parsed.entries;
      if (parsed.error) get("StorageNotice").textContent = t.historyInvalid;
    }
  } catch {
    persistent = false;
    get("StorageNotice").textContent = t.memory;
  }
  renderHistory();
  function prefillShare() {
    const shared = parseShare(location.hash);
    if (!shared) return false;
    query.value = shared.q;
    hint = shared.ip ?? "";
    updateSubmit();
    return true;
  }
  window.addEventListener("hashchange", () => {
    if (!parseShare(location.hash)) return;
    invalidate();
    prefillShare();
  });
  if (!prefillShare() && entries.length) {
    const first = entries[0];
    query.value = first.query;
    conditions = { q: first.query, ip: first.selectedIp };
    updateSubmit();
    renderReport(first.report, 0, true);
  }
  window.addEventListener("offline", () => {
    if (controller) {
      invalidate();
      state("unavailable", errors.offline);
    }
  });
}
