// shared-home-new.js - Search, filter, and random functionality for home-new.html
window.CT = window.CT || {};

CT.initTools = function() {
  var searchInput = document.getElementById('hero-search');
  if (searchInput) {
    // Live search as user types
    searchInput.addEventListener('input', function(e) {
      CT.performSearch();
    });
    // Also handle Enter for explicit search
    searchInput.addEventListener('keydown', function(e) {
      if (e.key === 'Enter') CT.performSearch();
    });
  }
  var searchBtn = document.querySelector('.hero-search-btn');
  if (searchBtn) searchBtn.addEventListener('click', CT.performSearch);

  var randomBtn = document.getElementById('randomBtn');
  if (randomBtn) randomBtn.addEventListener('click', CT.goRandom);

  var catBtns = document.querySelectorAll('.cat-btn');
  catBtns.forEach(function(btn) {
    btn.addEventListener('click', function(e) {
      // Prevent navigation if href is just "#" or no href
      var href = btn.getAttribute('href') || '';
      var cat = btn.getAttribute('data-category') || btn.getAttribute('data-cat') || '';
      
      // If clicking same category, clear filter
      if (btn.classList.contains('active')) {
        CT.filterByCategory('');
        btn.classList.remove('active');
        return;
      }
      
      // Filter to category
      CT.filterByCategory(cat);
      
      // Mark active button (clear others)
      catBtns.forEach(function(b) { b.classList.remove('active'); });
      btn.classList.add('active');
    });
  });

  var toolCards = document.querySelectorAll('.tool-card');
  toolCards.forEach(function(card) {
    card.style.cursor = 'pointer';
  });
};

CT.performSearch = function() {
  var input = document.getElementById('hero-search');
  if (!input) return;
  var query = input.value.trim().toLowerCase();
  var cards = document.querySelectorAll('.tool-card');
  var count = 0;
  cards.forEach(function(card) {
    var name = (card.getAttribute('data-name') || '').toLowerCase();
    var desc = (card.getAttribute('data-desc') || '').toLowerCase();
    var tags = (card.getAttribute('data-tags') || '').toLowerCase();
    var visible = !query || name.includes(query) || desc.includes(query) || tags.includes(query);
    card.style.display = visible ? '' : 'none';
    if (visible) count++;
  });
  
  // Remove any active category when searching
  document.querySelectorAll('.cat-btn.active').forEach(function(b) { b.classList.remove('active'); });
  
  var msg = document.getElementById('searchMsg');
  if (!msg) {
    msg = document.createElement('div');
    msg.id = 'searchMsg';
    msg.style = 'text-align:center;padding:0.5rem;color:var(--text-secondary);font-size:.9rem;';
    var grid = document.querySelector('.tools-grid');
    if (grid) grid.parentNode.insertBefore(msg, grid);
  }
  msg.textContent = query ? '找到 ' + count + ' 个工具' : '';
};

CT.filterByCategory = function(cat) {
  var cards = document.querySelectorAll('.tool-card');
  var count = 0;
  cards.forEach(function(card) {
    var cardCat = card.getAttribute('data-category') || '';
    // Match by data-category OR by data-cat (slug format like "开发工具")
    var visible = !cat || cardCat === cat;
    card.style.display = visible ? '' : 'none';
    if (visible) count++;
  });
  
  var msg = document.getElementById('searchMsg');
  if (msg) msg.textContent = '';
  
  var catMsg = document.getElementById('catMsg');
  if (!catMsg) {
    catMsg = document.createElement('div');
    catMsg.id = 'catMsg';
    catMsg.style = 'text-align:center;padding:0.5rem;color:var(--text-secondary);font-size:.9rem;';
    var grid = document.querySelector('.tools-grid');
    if (grid) grid.parentNode.insertBefore(catMsg, grid);
  }
  catMsg.textContent = cat ? cat + ' (' + count + ')' : '';
  
  // Update active state on category buttons
  document.querySelectorAll('.cat-btn').forEach(function(b) {
    var bCat = b.getAttribute('data-category') || b.getAttribute('data-cat') || '';
    b.classList.toggle('active', !cat || bCat === cat);
  });
};

CT.goRandom = function() {
  var cards = Array.from(document.querySelectorAll('.tool-card')).filter(function(c) { return c.style.display !== 'none'; });
  if (!cards.length) return;
  var randomCard = cards[Math.floor(Math.random() * cards.length)];
  var href = randomCard.getAttribute('href');
  if (href) location.href = href;
};

CT.initSearchOverlay = function() {
  var searchInput = document.getElementById('hero-search');
  var overlay = document.getElementById('searchOverlay');
  var resultsPanel = document.getElementById('searchResultsPanel');
  var searchWrap = document.querySelector('.hero .search-wrap');

  if (!searchInput || !overlay || !resultsPanel || !searchWrap) return;

  var isOpen = false;
  var floatingBar = null;
  var clickGuard = false; // prevents close right after open

  function openOverlay() {
    if (isOpen) return;
    isOpen = true;
    clickGuard = true; // ignore clicks for 200ms

    // Create floating search bar at top
    floatingBar = document.createElement('div');
    floatingBar.id = 'floatingSearchBar';
    floatingBar.innerHTML = '<div class="floating-search-inner"><input type="text" id="floatingSearchInput" placeholder="搜索工具..." autocomplete="off"/><button id="closeSearchBtn">×</button></div>';
    floatingBar.style.cssText = 'position:fixed;top:0;left:0;right:0;z-index:9999;padding:12px 16px;background:var(--bg);border-bottom:1px solid var(--border);box-shadow:0 2px 12px rgba(0,0,0,0.15);transition:opacity 0.2s,transform 0.2s;';
    document.body.appendChild(floatingBar);
    // Fade in
    requestAnimationFrame(function() {
      floatingBar.style.opacity = '1';
      floatingBar.style.transform = 'translateY(0)';
    });

    // Position results panel right below floating bar
    resultsPanel.style.position = 'fixed';
    resultsPanel.style.top = '64px';
    resultsPanel.style.left = '50%';
    resultsPanel.style.transform = 'translateX(-50%)';
    resultsPanel.style.width = '600px';
    resultsPanel.style.maxWidth = '90vw';
    resultsPanel.style.zIndex = '9998';
    resultsPanel.style.opacity = '0';
    resultsPanel.style.transition = 'opacity 0.2s';
    requestAnimationFrame(function() {
      resultsPanel.classList.add('active');
      requestAnimationFrame(function() { resultsPanel.style.opacity = '1'; });
    });

    var floatingInput = document.getElementById('floatingSearchInput');
    floatingInput.value = searchInput.value;
    floatingInput.focus();

    floatingInput.addEventListener('input', function() {
      searchInput.value = floatingInput.value;
      updateResults();
    });

    document.getElementById('closeSearchBtn').addEventListener('click', closeOverlay);

    updateResults();

    setTimeout(function() { clickGuard = false; }, 200);
  }

  function closeOverlay() {
    if (!isOpen) return;
    isOpen = false;

    if (floatingBar) {
      floatingBar.style.opacity = '0';
      floatingBar.style.transform = 'translateY(-10px)';
      setTimeout(function() {
        if (floatingBar && floatingBar.parentNode) floatingBar.parentNode.removeChild(floatingBar);
        floatingBar = null;
      }, 200);
    }

    resultsPanel.classList.remove('active');
    resultsPanel.style.opacity = '';
    resultsPanel.style.top = '';
    resultsPanel.style.left = '';
    resultsPanel.style.transform = '';
    resultsPanel.style.width = '';
    resultsPanel.style.zIndex = '';
    resultsPanel.innerHTML = '';
    searchInput.value = '';
    searchInput.blur();
  }

  function updateResults() {
    var query = searchInput.value.trim().toLowerCase();
    var cards = document.querySelectorAll('.tool-card');
    var matches = [];

    cards.forEach(function(card) {
      var name = (card.getAttribute('data-name') || '').toLowerCase();
      var desc = (card.getAttribute('data-desc') || '').toLowerCase();
      var tags = (card.getAttribute('data-tags') || '').toLowerCase();
      var cat = card.getAttribute('data-category') || '';
      var icon = card.querySelector('.t-icon');
      var iconClass = icon ? 'bi ' + icon.className.split(' ').filter(function(c) { return c.startsWith('bi-'); }).join(' ') : 'bi bi-tools';
      var href = card.getAttribute('href') || '#';

      if (!query || name.includes(query) || desc.includes(query) || tags.includes(query)) {
        matches.push({
          name: card.getAttribute('data-name'),
          desc: card.getAttribute('data-desc'),
          cat: cat,
          icon: iconClass,
          href: href
        });
      }
    });

    if (query && matches.length > 0) {
      var html = '';
      var limit = Math.min(matches.length, 8);
      for (var i = 0; i < limit; i++) {
        var m = matches[i];
        html += '<a class="search-result-item" href="' + m.href + '">' +
          '<i class="' + m.icon + ' sr-icon"></i>' +
          '<div class="sr-info"><div class="sr-name">' + m.name + '</div><div class="sr-desc">' + m.desc + '</div></div>' +
          '<span class="sr-tag">' + m.cat + '</span>' +
          '</a>';
      }
      if (matches.length > 8) {
        html += '<div class="search-results-empty">还有 ' + (matches.length - 8) + ' 个结果，继续输入以精确查找</div>';
      }
      resultsPanel.innerHTML = html;
    } else if (query) {
      resultsPanel.innerHTML = '<div class="search-results-empty">未找到匹配的工具</div>';
    } else {
      resultsPanel.innerHTML = '';
    }
  }

  // Focus on search → open overlay
  searchInput.addEventListener('focus', function() {
    openOverlay();
  });

  // ESC key → close
  document.addEventListener('keydown', function(e) {
    if (e.key === 'Escape' && isOpen) {
      closeOverlay();
    }
  });

  // Click outside floating bar + results → close
  document.addEventListener('click', function(e) {
    if (!isOpen || clickGuard) return;
    var floatingBarEl = document.getElementById('floatingSearchBar');
    var floatingInput = document.getElementById('floatingSearchInput');
    if (!floatingBarEl || !floatingInput) return;
    var clickedOnFloating = floatingBarEl.contains(e.target) || floatingInput.contains(e.target);
    var clickedOnResults = resultsPanel.contains(e.target);
    var clickedOnOriginalSearch = searchWrap.contains(e.target);
    if (!clickedOnFloating && !clickedOnResults && !clickedOnOriginalSearch) {
      closeOverlay();
    }
  });
};

CT.initCategory = function() {
  // Already handled by initTools
};

CT.initTheme = function() {
  // Theme is initialized in shared.js
};

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', function() {
    CT.initTools();
    CT.initSearchOverlay();
  });
} else {
  CT.initTools();
  CT.initSearchOverlay();
}