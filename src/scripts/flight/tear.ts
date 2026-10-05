import { tearProgress } from "../../lib/flight-experience";

/** A cancelled gesture never boards. Pointer and keyboard share the same commit. */
export function boardingTear(options: {
  ticket: HTMLElement;
  stub: HTMLButtonElement;
  dialog: HTMLDialogElement;
  onProgress: (progress: number) => void;
  onCommit: () => Promise<boolean>;
  onDepart: () => void;
}) {
  const { ticket, stub, dialog } = options;
  let generation = 0,
    committed = false,
    pointer: number | null = null;
  let start = 0,
    progress = 0,
    moved = false,
    suppressClick = false;
  const mobile = () => matchMedia("(max-width:760px)").matches;
  function paint(p: number) {
    progress = p;
    ticket.style.setProperty("--tear", String(p));
    ticket.style.setProperty("--drag", p * 62 + "px");
    ticket.style.setProperty("--tilt", -p * 28 + "deg");
    ticket.dataset.progress = String(p);
    options.onProgress(p);
  }
  function reset() {
    generation++;
    committed = false;
    pointer = null;
    moved = false;
    suppressClick = false;
    stub.disabled = false;
    ticket.dataset.torn = "false";
    ticket.dataset.returning = "false";
    paint(0);
  }
  function cancel() {
    if (committed) return;
    generation++;
    pointer = null;
    suppressClick = moved;
    ticket.dataset.returning = "true";
    paint(0);
  }
  async function commit(token: number) {
    if (committed || token !== generation || !dialog.open) return;
    committed = true;
    pointer = null;
    stub.disabled = true;
    paint(1);
    if (!(await options.onCommit())) {
      dialog.close();
      return;
    }
    ticket.dataset.torn = "true";
    setTimeout(
      () => {
        if (token === generation) options.onDepart();
      },
      matchMedia("(prefers-reduced-motion:reduce)").matches ? 80 : 760,
    );
  }
  stub.addEventListener("pointerdown", (event) => {
    if (committed || event.button !== 0) return;
    generation++;
    pointer = event.pointerId;
    start = mobile() ? event.clientY : event.clientX;
    moved = false;
    suppressClick = false;
    ticket.dataset.returning = "false";
    stub.setPointerCapture(event.pointerId);
  });
  stub.addEventListener("pointermove", (event) => {
    if (event.pointerId !== pointer || committed) return;
    const distance = (mobile() ? event.clientY : event.clientX) - start;
    moved ||= Math.abs(distance) > 3;
    paint(tearProgress(distance, mobile() ? 96 : 112));
    if (progress >= 1) {
      suppressClick = true;
      void commit(generation);
    }
  });
  stub.addEventListener("pointerup", (event) => {
    if (event.pointerId !== pointer) return;
    if (moved) {
      suppressClick = true;
      cancel();
    } else pointer = null;
  });
  stub.addEventListener("pointercancel", cancel);
  stub.addEventListener("lostpointercapture", () => {
    if (pointer !== null) cancel();
  });
  stub.addEventListener("click", (event) => {
    if (suppressClick && event.detail !== 0) {
      suppressClick = false;
      return;
    }
    suppressClick = false;
    if (committed) return;
    const token = ++generation,
      started = performance.now();
    ticket.dataset.returning = "false";
    const animate = (now: number) => {
      if (token !== generation || !dialog.open) return;
      const p = matchMedia("(prefers-reduced-motion:reduce)").matches
        ? 1
        : Math.min(1, (now - started) / 620);
      paint(p * p);
      if (p === 1) void commit(token);
      else requestAnimationFrame(animate);
    };
    requestAnimationFrame(animate);
  });
  window.addEventListener("blur", cancel);
  window.addEventListener("orientationchange", cancel);
  dialog.addEventListener("cancel", (event) => {
    if (committed) event.preventDefault();
    else cancel();
  });
  dialog.addEventListener("close", () => {
    if (!committed) cancel();
  });
  return { reset, cancel };
}
