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

function uiLang(): 'zh' | 'en' {
  return document.documentElement.lang === 'en' ? 'en' : 'zh';
}

const TOAST_TEXT = {
  zh: { copied: '已复制到剪贴板', copyFailed: '复制失败' },
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
  if (!text && text !== 0) return false;
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
