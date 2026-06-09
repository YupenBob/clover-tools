/**
 * CloverTools — Shared JavaScript (site-wide utilities)
 * Exposed as window.CT for use across all pages.
 * v2 — Enhanced design system utilities
 */
(function () {
  'use strict';

  // ═══════════════════════════════════════════
  // Toast (enhanced: typed variants + queue)
  // ═══════════════════════════════════════════
  var toastTimer = null;

  function showToast(msg, type) {
    type = type || 'default';
    var t = document.getElementById('toast');
    if (!t) return;
    if (toastTimer) clearTimeout(toastTimer);
    // Remove all type classes
    t.className = 'toast-' + type;
    t.textContent = msg;
    // Force reflow for animation restart
    t.classList.remove('show');
    void t.offsetWidth;
    t.classList.add('show');
    toastTimer = setTimeout(function () { t.classList.remove('show'); }, 2500);
  }

  // ═══════════════════════════════════════════
  // Clipboard (enhanced: visual feedback on target element)
  // ═══════════════════════════════════════════
  function copyToClipboard(text, feedbackEl) {
    if (!text && text !== 0) return;
    var txt = typeof text === 'string' ? text : String(text);
    navigator.clipboard.writeText(txt).then(function () {
      showToast('✔ 复制成功', 'success');
      if (feedbackEl) {
        feedbackEl.classList.add('success');
        setTimeout(function () { feedbackEl.classList.remove('success'); }, 800);
      }
    }).catch(function () {
      // Fallback for older browsers
      var ta = document.createElement('textarea');
      ta.value = txt;
      ta.style.position = 'fixed';
      ta.style.opacity = '0';
      document.body.appendChild(ta);
      ta.select();
      try {
        document.execCommand('copy');
        showToast('✔ 复制成功', 'success');
        if (feedbackEl) {
          feedbackEl.classList.add('success');
          setTimeout(function () { feedbackEl.classList.remove('success'); }, 800);
        }
      } catch (e) {
        showToast('✖ 复制失败', 'error');
      }
      document.body.removeChild(ta);
    });
  }

  // ═══════════════════════════════════════════
  // Theme
  // ═══════════════════════════════════════════
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('clover-theme', theme);
    updateThemeToggleUI(theme);
  }

  function updateThemeToggleUI(theme) {
    var btns = document.querySelectorAll('.theme-toggle');
    btns.forEach(function (btn) {
      var sunIcon = btn.querySelector('.icon-sun');
      var moonIcon = btn.querySelector('.icon-moon');
      if (sunIcon) sunIcon.style.display = theme === 'dark' ? 'none' : '';
      if (moonIcon) moonIcon.style.display = theme === 'dark' ? '' : 'none';
      btn.setAttribute('title', theme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式');
    });
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    var saved = localStorage.getItem('clover-theme') || 'light';
    applyTheme(saved);
    document.querySelectorAll('.theme-toggle').forEach(function (btn) {
      btn.addEventListener('click', toggleTheme);
    });
  }

  // ═══════════════════════════════════════════
  // Keyboard Shortcuts
  // ═══════════════════════════════════════════
  var _shortcuts = {};

  function registerShortcut(keyCombo, fn, description) {
    var key = keyCombo.toLowerCase();
    _shortcuts[key] = { fn: fn, desc: description || '' };
  }

  function unregisterShortcut(keyCombo) {
    delete _shortcuts[keyCombo.toLowerCase()];
  }

  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT' || e.target.isContentEditable) {
        // Still allow Escape in inputs
        if (e.key !== 'Escape') return;
      }
      // Build combo string
      var combo = '';
      if (e.ctrlKey || e.metaKey) combo += 'ctrl+';
      if (e.shiftKey) combo += 'shift+';
      if (e.altKey) combo += 'alt+';
      combo += e.key.toLowerCase();

      // Global defaults
      if (e.key === 'Escape') {
        var t = document.getElementById('toast');
        if (t) t.classList.remove('show');
        closeModal();
      }

      // Registered shortcuts
      var shortcut = _shortcuts[combo];
      if (shortcut) {
        e.preventDefault();
        shortcut.fn(e);
      }
    });
  }

  // ═══════════════════════════════════════════
  // Modal Manager
  // ═══════════════════════════════════════════
  var _activeModal = null;

  function openModal(opts) {
    closeModal(); // close any existing modal first
    opts = opts || {};
    var overlay = document.createElement('div');
    overlay.className = 'modal-overlay';
    overlay.id = 'ctModal';

    var titleHtml = opts.title ? '<div class="modal-header"><h3>' + escapeHtml(opts.title) + '</h3><button class="modal-close" id="ctModalClose">&times;</button></div>' : '';
    var bodyHtml = '<div class="modal-body">' + (opts.body || '') + '</div>';
    var footerHtml = opts.footer ? '<div class="modal-footer">' + opts.footer + '</div>' : '';

    overlay.innerHTML = '<div class="modal-panel">' + titleHtml + bodyHtml + footerHtml + '</div>';

    overlay.addEventListener('click', function (e) {
      if (e.target === overlay && opts.closeOnOverlay !== false) closeModal();
    });

    document.body.appendChild(overlay);
    document.body.style.overflow = 'hidden';
    _activeModal = overlay;

    var closeBtn = document.getElementById('ctModalClose');
    if (closeBtn) closeBtn.addEventListener('click', closeModal);

    return overlay;
  }

  function closeModal() {
    if (_activeModal) {
      document.body.removeChild(_activeModal);
      _activeModal = null;
      document.body.style.overflow = '';
    }
  }

  function getActiveModal() { return _activeModal; }

  // ═══════════════════════════════════════════
  // Loading State Manager
  // ═══════════════════════════════════════════
  function setLoading(el, loadingText) {
    if (!el) return;
    el.classList.add('loading');
    el.disabled = true;
    if (loadingText) el.setAttribute('data-original-text', el.textContent);
    el.textContent = loadingText || '处理中...';
  }

  function clearLoading(el) {
    if (!el) return;
    el.classList.remove('loading');
    el.disabled = false;
    var orig = el.getAttribute('data-original-text');
    if (orig) el.textContent = orig;
  }

  // ═══════════════════════════════════════════
  // Share button init
  // ═══════════════════════════════════════════
  function initShare() {
    var btn = document.getElementById('shareBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      copyToClipboard(window.location.href, btn);
    });
  }

  // ═══════════════════════════════════════════
  // Scroll-triggered reveal observer
  // ═══════════════════════════════════════════
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      document.querySelectorAll('.reveal').forEach(function (el) {
        el.classList.add('visible');
      });
      return;
    }
    var obs = new IntersectionObserver(function (entries) {
      entries.forEach(function (entry) {
        if (entry.isIntersecting) {
          entry.target.classList.add('visible');
          obs.unobserve(entry.target);
        }
      });
    }, { threshold: 0.1, rootMargin: '0px 0px -40px 0px' });
    document.querySelectorAll('.reveal').forEach(function (el) { obs.observe(el); });
  }

  // ═══════════════════════════════════════════
  // Copy button success pulse
  // ═══════════════════════════════════════════
  function initCopyPulse() {
    document.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.classList.add('success');
        setTimeout(function () { btn.classList.remove('success'); }, 300);
      });
    });
  }

  // ═══════════════════════════════════════════
  // Debounce utility
  // ═══════════════════════════════════════════
  function debounce(fn, delay) {
    delay = delay || 300;
    var timer;
    return function () {
      var ctx = this, args = arguments;
      clearTimeout(timer);
      timer = setTimeout(function () { fn.apply(ctx, args); }, delay);
    };
  }

  // ═══════════════════════════════════════════
  // Throttle utility
  // ═══════════════════════════════════════════
  function throttle(fn, limit) {
    limit = limit || 300;
    var inThrottle = false;
    return function () {
      if (!inThrottle) {
        fn.apply(this, arguments);
        inThrottle = true;
        setTimeout(function () { inThrottle = false; }, limit);
      }
    };
  }

  // ═══════════════════════════════════════════
  // Format utilities
  // ═══════════════════════════════════════════
  function formatBytes(bytes) {
    if (bytes === 0) return '0 B';
    var k = 1024;
    var sizes = ['B', 'KB', 'MB', 'GB'];
    var i = Math.floor(Math.log(bytes) / Math.log(k));
    return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
  }

  function formatNumber(n) {
    return n.toString().replace(/\B(?=(\d{3})+(?!\d))/g, ',');
  }

  function formatDuration(ms) {
    if (ms < 1000) return ms + 'ms';
    if (ms < 60000) return (ms / 1000).toFixed(1) + 's';
    var m = Math.floor(ms / 60000);
    var s = ((ms % 60000) / 1000).toFixed(0);
    return m + 'm ' + s + 's';
  }

  // ═══════════════════════════════════════════
  // DOM helpers
  // ═══════════════════════════════════════════
  function $(selector) { return document.querySelector(selector); }
  function $$(selector) { return document.querySelectorAll(selector); }

  function escapeHtml(str) {
    var div = document.createElement('div');
    div.textContent = str;
    return div.innerHTML;
  }

  // ═══════════════════════════════════════════
  // Id generation
  // ═══════════════════════════════════════════
  function uid() {
    return 'ct-' + Math.random().toString(36).slice(2, 9);
  }

  // ═══════════════════════════════════════════
  // Expose as window.CT
  // ═══════════════════════════════════════════
  window.CT = {
    // Toast
    showToast: showToast,
    toast: showToast,

    // Clipboard
    copyToClipboard: copyToClipboard,
    copy: copyToClipboard,

    // Theme
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme,

    // Keyboard
    initKeyboardShortcuts: initKeyboardShortcuts,
    registerShortcut: registerShortcut,
    unregisterShortcut: unregisterShortcut,
    shortcut: {
      register: registerShortcut,
      unregister: unregisterShortcut
    },

    // Modal
    openModal: openModal,
    closeModal: closeModal,
    getActiveModal: getActiveModal,
    modal: {
      open: openModal,
      close: closeModal,
      active: getActiveModal
    },

    // Loading
    setLoading: setLoading,
    clearLoading: clearLoading,
    loading: {
      show: setLoading,
      hide: clearLoading
    },

    // Share
    initShare: initShare,

    // Reveal
    initReveal: initReveal,
    initCopyPulse: initCopyPulse,

    // Utilities
    debounce: debounce,
    throttle: throttle,
    format: {
      bytes: formatBytes,
      number: formatNumber,
      duration: formatDuration
    },

    // DOM
    $: $,
    $$: $$,
    escapeHtml: escapeHtml,
    uid: uid
  };

  // ═══════════════════════════════════════════
  // Global aliases (backward compat)
  // ═══════════════════════════════════════════
  window.showToast = showToast;
  window.copyToClipboard = copyToClipboard;

  // ═══════════════════════════════════════════
  // Auto-init theme on page load (before body renders)
  // ═══════════════════════════════════════════
  (function () {
    var saved = localStorage.getItem('clover-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
})();
