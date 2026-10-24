declare global {
  interface Window {
    CT: {
      showToast: (msg: string, type?: 'default' | 'success' | 'error' | 'info') => void;
      copy: (text: string, feedbackEl?: HTMLElement | null) => Promise<boolean>;
      escapeHtml: (value: string) => string;
    };
  }
}

let toastTimer: ReturnType<typeof setTimeout> | null = null;

function uiLang(): 'zh' | 'tw' | 'en' | 'ko' | 'ja' {
  const l = document.documentElement.lang;
  if (l === 'en') return 'en';
  if (l === 'ko') return 'ko';
  if (l === 'ja') return 'ja';
  if (l === 'zh-Hant') return 'tw';
  return 'zh';
}

const TOAST_TEXT = {
  zh: { copied: '已复制到剪贴板', copyFailed: '复制失败' },
  tw: { copied: '已複製到剪貼簿', copyFailed: '複製失敗' },
  ko: { copied: '클립보드에 복사됨', copyFailed: '복사 실패' },
  ja: { copied: 'クリップボードにコピーしました', copyFailed: 'コピーに失敗しました' },
  en: { copied: 'Copied to clipboard', copyFailed: 'Copy failed' },
};

export function showToast(
  msg: string,
  type: 'default' | 'success' | 'error' | 'info' = 'default',
): void {
  const el = document.getElementById('toast');
  if (!el) return;
  if (toastTimer) clearTimeout(toastTimer);
  el.className = `toast ${type}`;
  el.textContent = msg;
  el.classList.add('show');
  toastTimer = setTimeout(() => el.classList.remove('show'), 2200);
}

export async function copy(text: string, feedbackEl?: HTMLElement | null): Promise<boolean> {
  if (!text && (text as unknown) !== 0) return false;
  const value = String(text);
  try {
    await navigator.clipboard.writeText(value);
  } catch {
    const ta = document.createElement('textarea');
    ta.value = value;
    ta.style.position = 'fixed';
    ta.style.opacity = '0';
    document.body.appendChild(ta);
    ta.select();
    const ok = document.execCommand('copy');
    document.body.removeChild(ta);
    if (!ok) {
      showToast(TOAST_TEXT[uiLang()].copyFailed, 'error');
      return false;
    }
  }
  if (feedbackEl) {
    feedbackEl.classList.add('success');
    setTimeout(() => feedbackEl.classList.remove('success'), 800);
  }
  showToast(TOAST_TEXT[uiLang()].copied, 'success');
  return true;
}

export function escapeHtml(value: string): string {
  return value
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;')
    .replace(/'/g, '&#39;');
}

window.CT = { showToast, copy, escapeHtml };

/* ── Progressive enhancement: card reveal watchdog + pointer spotlight ── */
const cardGrids = Array.from(document.querySelectorAll<HTMLElement>('.tool-grid'));
if (cardGrids.length) {
  const hiddenCards = document.querySelectorAll<HTMLElement>('.tool-card:not(.revealed)');
  const revealAll = () => hiddenCards.forEach((card) => card.classList.add('revealed'));
  // Never leave cards invisible if the observer never fires (JS error, print,
  // full-page screenshots, very short viewports).
  window.setTimeout(revealAll, 1200);
  window.addEventListener('load', () => window.setTimeout(revealAll, 300));

  const finePointer = window.matchMedia('(hover: hover) and (pointer: fine)').matches;
  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (finePointer && !reduceMotion) {
    for (const grid of cardGrids) {
      let frame = 0;
      let active: HTMLElement | null = null;
      let lastX = 0;
      let lastY = 0;
      grid.addEventListener('pointermove', (event) => {
        const target = (event.target as Element | null)?.closest<HTMLElement>('.tool-card');
        if (!target) return;
        active = target;
        lastX = event.clientX;
        lastY = event.clientY;
        if (frame) return;
        frame = requestAnimationFrame(() => {
          frame = 0;
          if (!active) return;
          const rect = active.getBoundingClientRect();
          active.style.setProperty('--mx', `${lastX - rect.left}px`);
          active.style.setProperty('--my', `${lastY - rect.top}px`);
        });
      });
      grid.addEventListener('pointerleave', () => {
        active = null;
      });
    }
  }
}

