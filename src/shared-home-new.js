// shared-home-new.js - Search, filter, and random functionality for home-new.html
window.CT = window.CT || {};

CT.initTools = function() {
  var searchInput = document.getElementById('hero-search');
  if (searchInput) {
    searchInput.addEventListener('input', function(e) {
      if (e.key !== 'Enter') return;
      CT.performSearch();
    });
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
      var cat = btn.getAttribute('data-category') || btn.getAttribute('data-cat') || '';
      CT.filterByCategory(cat);
    });
  });

  var toolCards = document.querySelectorAll('.tool-card');
  toolCards.forEach(function(card) {
    card.addEventListener('click', function() {
      var href = card.getAttribute('href');
      if (href) location.href = href;
    });
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
  var msg = document.getElementById('searchMsg') || (function() {
    var el = document.createElement('div');
    el.id = 'searchMsg';
    el.style = 'text-align:center;padding:0.5rem;color:var(--text-secondary);font-size:.9rem;';
    var grid = document.querySelector('.tool-grid');
    if (grid) grid.parentNode.insertBefore(el, grid);
    return el;
  })();
  if (msg) msg.textContent = query ? '找到 ' + count + ' 个工具' : '';
};

CT.filterByCategory = function(cat) {
  var cards = document.querySelectorAll('.tool-card');
  var count = 0;
  cards.forEach(function(card) {
    var cardCat = card.getAttribute('data-category') || '';
    var visible = !cat || cardCat === cat;
    card.style.display = visible ? '' : 'none';
    if (visible) count++;
  });
  var msg = document.getElementById('catMsg') || (function() {
    var el = document.createElement('div');
    el.id = 'catMsg';
    el.style = 'text-align:center;padding:0.5rem;color:var(--text-secondary);font-size:.9rem;';
    var grid = document.querySelector('.tool-grid');
    if (grid) grid.parentNode.insertBefore(el, grid);
    return el;
  })();
  if (msg) msg.textContent = cat ? '分类: ' + cat + ' (' + count + ')' : '全部工具';
  document.querySelectorAll('.cat-btn').forEach(function(b) {
    b.style.opacity = (!cat || b.getAttribute('data-category') === cat || b.getAttribute('data-cat') === cat) ? '1' : '0.5';
  });
};

CT.goRandom = function() {
  var cards = Array.from(document.querySelectorAll('.tool-card')).filter(function(c) { return c.style.display !== 'none'; });
  if (!cards.length) return;
  var randomCard = cards[Math.floor(Math.random() * cards.length)];
  var href = randomCard.getAttribute('href');
  if (href) location.href = href;
};

CT.initCategory = function() {
  // Already handled by initTools
};

CT.initTheme = function() {
  // Theme is initialized in shared.js
};

// Auto-init when DOM ready
if (document.readyState === 'loading') {
  document.addEventListener('DOMContentLoaded', CT.initTools);
} else {
  CT.initTools();
}
