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