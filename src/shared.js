/**
 * CloverTools - Shared JavaScript (site-wide utilities)
 * Exposed as window.CT for use across all pages.
 */
(function () {
  'use strict';

  // ---- Toast ----
  function showToast(msg, icon) {
    var t = document.getElementById('toast');
    if (!t) return;
    if (icon) {
      t.innerHTML = '<span class="toast-icon">' + icon + '</span><span>' + msg + '</span>';
    } else {
      t.innerHTML = '<span>' + msg + '</span>';
    }
    t.classList.add('show');
    clearTimeout(t._timeout);
    t._timeout = setTimeout(function () { t.classList.remove('show'); }, 2000);
  }

  // ---- Clipboard ----
  function copyToClipboard(text) {
    if (!text) return;
    var checkSvg = '<svg width="16" height="16" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="3" stroke-linecap="round" stroke-linejoin="round"><polyline points="20 6 9 17 4 12"/></svg>';
    navigator.clipboard.writeText(text).then(function () {
      showToast('\u590d\u5236\u6210\u529f\uff01', checkSvg);
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
      btn.textContent = theme === 'dark' ? '\ud83c\udf19' : '\u2600\ufe0f';
      btn.setAttribute('title', theme === 'dark' ? '\u5207\u6362\u5230\u4eae\u8272\u6a21\u5f0f' : '\u5207\u6362\u5230\u6697\u9ed1\u6a21\u5f0f');
    }
  }

  function toggleTheme() {
    var current = document.documentElement.getAttribute('data-theme') || 'light';
    var next = current === 'dark' ? 'light' : 'dark';
    document.documentElement.classList.add('theme-transitioning');
    applyTheme(next);
    setTimeout(function () {
      document.documentElement.classList.remove('theme-transitioning');
    }, 450);
  }

  function initTheme() {
    var saved = localStorage.getItem('clover-theme') || 'light';
    applyTheme(saved);
    var btn = document.getElementById('themeToggle');
    if (btn) {
      btn.addEventListener('click', toggleTheme);
    }
  }

  // ---- Scroll header effect ----
function initScrollHeader() {
  var header = document.querySelector('.site-header');
  if (!header) return;
  window.addEventListener('scroll', function() {
    if (window.scrollY > 10) {
      header.classList.add('scrolled');
    } else {
      header.classList.remove('scrolled');
    }
  }, { passive: true });
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

  // ---- Expose as window.CT ----
  window.CT = {
    showToast: showToast,
    copyToClipboard: copyToClipboard,
    applyTheme: applyTheme,
    toggleTheme: toggleTheme,
    initTheme: initTheme,
    initKeyboardShortcuts: initKeyboardShortcuts,
    initShare: initShare,
    initScrollHeader: initScrollHeader
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
