/**
 * CloverTools - Shared JavaScript (site-wide utilities)
 * Exposed as window.CT for use across all pages.
 */
(function () {
  'use strict';

  // ---- Toast ----
  function showToast(msg) {
    var t = document.getElementById('toast');
    if (!t) return;
    t.textContent = msg;
    t.classList.add('show');
    setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  // ---- Clipboard ----
  function copyToClipboard(text) {
    if (!text) return;
    navigator.clipboard.writeText(text).then(function () {
      showToast('\u590d\u5236\u6210\u529f\uff01');
    }).catch(function () {
      showToast('\u590d\u5236\u5931\u8d25');
    });
  }

  // ---- Theme ----
  function applyTheme(theme) {
    document.documentElement.setAttribute('data-theme', theme);
    localStorage.setItem('clover-theme', theme);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      var sunIcon = btn.querySelector('.icon-sun');
      var moonIcon = btn.querySelector('.icon-moon');
      if (sunIcon && moonIcon) {
        sunIcon.style.display = theme === 'dark' ? 'none' : '';
        moonIcon.style.display = theme === 'dark' ? '' : 'none';
      }
      btn.setAttribute('title', theme === 'dark' ? '切换到亮色模式' : '切换到暗黑模式');
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    applyTheme(current === 'dark' ? 'light' : 'dark');
  }

  function initTheme() {
    var saved = localStorage.getItem('clover-theme') || 'light';
    applyTheme(saved);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  }

  // ---- Global keyboard shortcuts (Escape to dismiss toast) ----
  function initKeyboardShortcuts() {
    document.addEventListener('keydown', function (e) {
      var tag = e.target.tagName;
      if (tag === 'INPUT' || tag === 'TEXTAREA' || tag === 'SELECT') return;
      if (e.key === 'Escape') {
        var t = document.getElementById('toast');
        if (t) t.classList.remove('show');
      }
    });
  }

  // ---- Share button init ----
  function initShare() {
    var btn = document.getElementById('shareBtn');
    if (!btn) return;
    btn.addEventListener('click', function () {
      navigator.clipboard.writeText(window.location.href).then(function () {
        showToast('\u94fe\u63a5\u5df2\u590d\u5236\uff01');
      }).catch(function () {
        showToast('\u590d\u5236\u5931\u8d25');
      });
    });
  }

  // ---- Scroll-triggered reveal observer ---
  function initReveal() {
    if (!('IntersectionObserver' in window)) {
      // Fallback: make all visible immediately
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

  // ---- Copy button success pulse ---
  function initCopyPulse() {
    document.querySelectorAll('.copy-btn').forEach(function (btn) {
      btn.addEventListener('click', function () {
        btn.classList.add('success');
        setTimeout(function () { btn.classList.remove('success'); }, 300);
      });
    });
  }

  // ---- Expose as window.CT ----
  window.CT = {
    showToast: showToast,
    copyToClipboard: copyToClipboard,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme,
    initKeyboardShortcuts: initKeyboardShortcuts,
    initShare: initShare,
    initReveal: initReveal,
    initCopyPulse: initCopyPulse
  };

  // ---- Global aliases (so tool scripts can call showToast() directly) ----
  window.showToast = showToast;
  window.copyToClipboard = copyToClipboard;

  // Auto-init theme on page load (before body renders)
  (function () {
    var saved = localStorage.getItem('clover-theme');
    if (saved === 'dark') {
      document.documentElement.setAttribute('data-theme', 'dark');
    }
  })();
})();
