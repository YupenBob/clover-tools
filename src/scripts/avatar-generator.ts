import { createAvatar, type AvatarOptions } from "../lib/avatar";
import { byId, bindCopyBtn, hideStatus, showStatus } from "./toolkit";
import { getFunData, setText, saveBlob, canvasBlob } from "./fun-ui";

const { copy } = getFunData("avatar");
const t = copy.avatar;
let current: AvatarOptions | null = null;
let svg = "";
let revision = 0;
let saving = false;
const dataUrl = (content: string) =>
  "data:image/svg+xml;charset=utf-8," + encodeURIComponent(content);
function exportsState(): void {
  byId<HTMLButtonElement>("avPng").disabled = !current || saving;
  ["avSvg", "avCopy"].forEach((id) => {
    byId<HTMLButtonElement>(id).disabled = !current;
  });
}
function options(): AvatarOptions {
  return {
    seed: byId<HTMLInputElement>("avSeed").value,
    style: document.querySelector<HTMLInputElement>(
      'input[name="avStyle"]:checked',
    )!.value as AvatarOptions["style"],
    accent: byId<HTMLInputElement>("avAccent").value,
    background: byId<HTMLInputElement>("avBackground").value,
    shape: byId<HTMLSelectElement>("avShape").value as AvatarOptions["shape"],
    transparent: byId<HTMLInputElement>("avTransparent").checked,
  };
}
function renderGallery(): void {
  if (!current) return;
  const buttons = Array.from({ length: 6 }, (_, i) => {
    const seed = `Clover / ${i + 1}`;
    const button = document.createElement("button");
    button.type = "button";
    button.className = "avatar-variant";
    button.dataset.seed = seed;
    button.setAttribute(
      "aria-label",
      t.variant.replace("{number}", String(i + 1)),
    );
    button.setAttribute(
      "aria-pressed",
      current!.seed === seed ? "true" : "false",
    );
    const image = document.createElement("img");
    image.width = image.height = 96;
    image.alt = "";
    image.src = dataUrl(createAvatar({ ...current!, seed }));
    button.append(image);
    return button;
  });
  byId<HTMLElement>("avGallery").replaceChildren(...buttons);
}
function update(): void {
  revision++;
  hideStatus("avStatus");
  const seed = byId<HTMLInputElement>("avSeed");
  seed.removeAttribute("aria-invalid");
  try {
    const value = options();
    svg = createAvatar(value);
    current = value;
    byId<HTMLImageElement>("avImage").src = dataUrl(svg);
    byId<HTMLImageElement>("avImage").hidden = false;
    byId<HTMLImageElement>("avMiniImage").src = dataUrl(svg);
    byId<HTMLImageElement>("avMiniImage").hidden = false;
    byId<HTMLElement>("avMiniPreview").dataset.transparent = String(
      value.transparent,
    );
    byId<HTMLElement>("avPortrait").dataset.transparent = String(
      value.transparent,
    );
    byId<HTMLElement>("avStage").style.setProperty(
      "--avatar-mood",
      value.background,
    );
    const size = byId<HTMLSelectElement>("avSize").value;
    setText("avEdition", `${size} × ${size}`);
    byId<HTMLInputElement>("avBackground").disabled = value.transparent;
    document
      .querySelectorAll<HTMLButtonElement>(".avatar-mood")
      .forEach((button) =>
        button.setAttribute(
          "aria-pressed",
          String(
            button.dataset.accent?.toLowerCase() ===
              value.accent.toLowerCase() &&
              button.dataset.background?.toLowerCase() ===
                value.background.toLowerCase(),
          ),
        ),
      );
    renderGallery();
  } catch {
    current = null;
    svg = "";
    byId<HTMLImageElement>("avImage").hidden = true;
    byId<HTMLImageElement>("avMiniImage").hidden = true;
    byId<HTMLElement>("avGallery").replaceChildren();
    seed.setAttribute("aria-invalid", "true");
    showStatus("avStatus", "error", t.invalid);
  }
  exportsState();
}
byId<HTMLFormElement>("avForm").addEventListener("input", update);
byId<HTMLFormElement>("avForm").addEventListener("change", update);
byId<HTMLFormElement>("avForm").addEventListener("submit", (event) => {
  event.preventDefault();
  update();
});
byId<HTMLInputElement>("avSeed").addEventListener("keydown", (event) => {
  if ((event.ctrlKey || event.metaKey) && event.key === "Enter") {
    event.preventDefault();
    update();
  }
});
byId<HTMLButtonElement>("avRandom").addEventListener("click", () => {
  const random = crypto.getRandomValues(new Uint32Array(2));
  byId<HTMLInputElement>("avSeed").value = Array.from(random, (value) =>
    value.toString(16).padStart(8, "0"),
  ).join("-");
  update();
});
byId<HTMLButtonElement>("avReset").addEventListener("click", () => {
  byId<HTMLFormElement>("avForm").reset();
  update();
});
byId<HTMLElement>("avGallery").addEventListener("click", (event) => {
  const button = (event.target as HTMLElement).closest<HTMLButtonElement>(
    ".avatar-variant",
  );
  if (button?.dataset.seed) {
    byId<HTMLInputElement>("avSeed").value = button.dataset.seed;
    update();
  }
});
document.querySelectorAll<HTMLButtonElement>(".avatar-mood").forEach((button) =>
  button.addEventListener("click", () => {
    byId<HTMLInputElement>("avAccent").value = button.dataset.accent!;
    byId<HTMLInputElement>("avBackground").value = button.dataset.background!;
    update();
  }),
);
byId<HTMLButtonElement>("avSvg").addEventListener("click", () => {
  if (current)
    saveBlob(
      "clover-avatar.svg",
      new Blob([svg], { type: "image/svg+xml;charset=utf-8" }),
    );
});
byId<HTMLButtonElement>("avPng").addEventListener("click", async () => {
  if (!current || saving) return;
  const version = revision,
    snapshot = svg;
  const size = Number(byId<HTMLSelectElement>("avSize").value);
  if (![256, 512, 1024].includes(size)) return;
  saving = true;
  exportsState();
  const url = URL.createObjectURL(
    new Blob([snapshot], { type: "image/svg+xml" }),
  );
  try {
    const image = new Image();
    await new Promise<void>((resolve, reject) => {
      image.onload = () => resolve();
      image.onerror = () => reject(new Error("image"));
      image.src = url;
    });
    if (version !== revision) return;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    canvas.getContext("2d")!.drawImage(image, 0, 0, size, size);
    const blob = await canvasBlob(canvas);
    if (version === revision) saveBlob("clover-avatar.png", blob);
  } catch {
    if (version === revision) showStatus("avStatus", "error", copy.exportError);
  } finally {
    URL.revokeObjectURL(url);
    saving = false;
    exportsState();
  }
});
bindCopyBtn("avCopy", () => (current ? JSON.stringify(current, null, 2) : ""));
update();
