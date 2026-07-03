/**
 * CloverTools - Static Site Generator
 * Reads tools.json → generates index.html + all tool pages
 */
const fs = require('fs');
const path = require('path');

const BASE = __dirname;
const TEMPLATES_DIR = path.join(BASE, 'templates');
const SRC_DIR = path.join(BASE, 'src');
const DIST_DIR = path.join(BASE, 'dist');
const TOOLS_JSON_PATH = path.join(BASE, 'tools.json');

// ============ Sensitive word library (for 敏感词检测 tool) ============
const WORDS = {
  high: [
    '法轮', '反动', '台独', '藏独', '疆独', '港独', '暴动', '颠覆', '渗透', '间谍',
    '恐怖', '袭击', '枪支', '弹药', '毒品', '海洛因', '冰毒', '大麻', '走私', '洗钱',
    '诈骗', '传销', '邪教', '政治', '革命', '政变', '游行', '抗议', '示威', '罢工'
  ],
  medium: [
    '色情', '裸聊', '一夜情', '约炮', '包养', '赌博', '博彩', '下注', '外围', '菠菜',
    '贷款', '高利贷', '办证', '代孕', '安眠药', '迷药', '迷魂药', '监听', '偷拍', '针孔',
    '发票', '公考', '答案', '代考', '论文代写', '学术造假', '包过', '稳过', '内部指标'
  ],
  low: [
    '最', '第一', '唯一', '顶级', '国家级', '世界级', '宇宙级', '全网', '全网最低', '全网首发',
    '100%', '百分百', '永久', '终身', '祖传', '秘方', '神药', '包治', '无效退款',
    '稳赚', '无风险', '高收益', '躺着赚', '刷单', '兼职', '日结', '高佣', '微商', '代理'
  ]
};

// ============ Load templates ============
const homeTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'home.html'), 'utf8');
const toolTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'tool.html'), 'utf8');
const toolsConfig = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf8'));

// ============ Load tool base templates (category inheritance) ============
const TOOL_BASES_DIR = path.join(TEMPLATES_DIR, 'tool-bases');
let timeToolBase = '';
try {
  timeToolBase = fs.readFileSync(path.join(TOOL_BASES_DIR, 'time-tool-base.html'), 'utf8');
} catch(e) { timeToolBase = ''; }

function resolveToolBase(toolPath) {
  if (!timeToolBase) return null;
  if (toolPath.startsWith('time/')) {
    const styleMatch = timeToolBase.match(/<style data-base="styles">([\s\S]*?)<\/style>/);
    const contentMatch = timeToolBase.match(/<!-- BASE_CONTENT -->([\s\S]*?)<!-- \/BASE_CONTENT -->/);
    const scriptMatch = timeToolBase.match(/<!-- BASE_SCRIPT -->([\s\S]*?)<!-- \/BASE_SCRIPT -->/);
    return {
      styles: styleMatch ? styleMatch[1].trim() : '',
      content: contentMatch ? contentMatch[1].trim() : '',
      script: scriptMatch ? scriptMatch[1].trim() : '',
    };
  }
  return null;
}

// ============ Load shared assets ============
const sharedCss = fs.readFileSync(path.join(SRC_DIR, 'shared.css'), 'utf8');
const sharedJs = fs.readFileSync(path.join(SRC_DIR, 'shared.js'), 'utf8');

// ============ Load component partials ============
const svgSpriteHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/svg-sprite.html'), 'utf8').trim();
const headerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/header.html'), 'utf8').trim();
const footerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/footer.html'), 'utf8').trim();
const shareBtnHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/share-btn.html'), 'utf8').trim();

// ============ Build categories HTML for homepage ============
function buildCategoriesHtml() {
  let html = '';
  toolsConfig.forEach(cat => {
    let itemsHtml = '';
    cat.tools.forEach(tool => {
      itemsHtml += `
      <li>
        <a href="/tools/${tool.path}">
          <span class="tool-name">${tool.name}</span>
          <span class="tool-desc">${tool.desc}</span>
        </a>
      </li>`;
    });
    html += `
    <div class="category">
      <h2>${cat.category}</h2>
      <ul>${itemsHtml}</ul>
    </div>`;
  });
  return html;
}

// ============ Tool content builders ============
// Each tool is defined as { name, description, category, path, layout, content: {html, script} }
function buildToolPage(tool) {
  const toolScript = buildToolScript(tool);
  const toolUrl = 'https://tools.xsanye.cn/tools/' + tool.path;
  const shareBtnScript = 'document.getElementById("shareBtn").onclick = function() { navigator.clipboard.writeText(window.location.href).then(function() { CT.showToast("\\u94fe\\u63a5\\u5df2\\u590d\\u5236\\uff01"); }).catch(function() { CT.showToast("\\u590d\\u5236\\u5931\\u8d25"); }); };';
  const footerWithShare = footerHtml.replace(
    '<!-- FOOTER_SHARE_BTN will be replaced by generator.js for tool pages -->',
    shareBtnHtml
  );

  let html = toolTemplate
    .replace(/\{\{TOOL_NAME\}\}/g, tool.name)
    .replace(/\{\{TOOL_DESC\}\}/g, tool.description || '')
    .replace('{{LAYOUT_CLASS}}', tool.layout || '')
    .replace(/\{\{TOOL_CONTENT\}\}/g, tool.contentHtml || '')
    .replace(/\{\{TOOL_SCRIPT\}\}/g, toolScript)
    // Component placeholders
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER_WITH_SHARE\}\}/g, footerWithShare)
    .replace(/\{\{SHARE_BTN_SCRIPT\}\}/g, shareBtnScript)
    // Meta tags
    .replace(/\{\{PAGE_OG_TITLE\}\}/g, tool.name + ' - 🍀 CloverTools')
    .replace(/\{\{PAGE_OG_DESC\}\}/g, tool.description || tool.name)
    .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
    .replace(/\{\{PAGE_URL\}\}/g, toolUrl)
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, toolUrl);

  // Inject shared CSS inline for single-file tool pages
  // (dist already has it as a separate file)
  return html;
}

// ============ Tool Implementations ============
function stripExt(p) { return p.replace(/\.html$/, ''); }

function buildToolScript(tool) {
  const key = stripExt(tool.path);
  const scripts = {
    'json/formatter': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const opts = { indent: 2, minify: false };
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const parsed = JSON.parse(val);
          output.value = opts.minify ? JSON.stringify(parsed) : JSON.stringify(parsed, null, opts.indent);
        } catch(e) { output.value = 'JSON 错误: ' + e.message; }
      }
      document.getElementById('format').onclick = () => { opts.minify = false; run(); };
      document.getElementById('minify').onclick = () => { opts.minify = true; run(); };
      document.getElementById('copy').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'encrypt/base64': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'encode';
      function run() {
        try {
          const val = input.value;
          if (!val) { output.value = ''; return; }
          output.value = mode === 'encode'
            ? btoa(unescape(encodeURIComponent(val)))
            : decodeURIComponent(escape(atob(val.trim())));
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('encode').onclick = () => { mode = 'encode'; run(); };
      document.getElementById('decode').onclick = () => { mode = 'decode'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'encrypt/url': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'encode';
      function run() {
        const v = input.value;
        output.value = mode === 'encode' ? encodeURIComponent(v) : decodeURIComponent(v);
      }
      document.getElementById('encode').onclick = () => { mode = 'encode'; run(); };
      document.getElementById('decode').onclick = () => { mode = 'decode'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'encrypt/hex': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'toHex';
      function run() {
        const v = input.value;
        try {
          if (mode === 'toHex') {
            const arr = [...v].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ');
            output.value = arr;
          } else {
            const hex = v.trim().split(/\\s+/);
            output.value = hex.map(h => String.fromCharCode(parseInt(h,16))).join('');
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('toHex').onclick = () => { mode='toHex'; run(); };
      document.getElementById('fromHex').onclick = () => { mode='fromHex'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'other/uuid': `
      const output = document.getElementById('output');
      function genUUID() {
        return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => {
          const r = Math.random() * 16 | 0;
          return (c === 'x' ? r : (r & 0x3 | 0x8)).toString(16);
        });
      }
      document.getElementById('generate').onclick = () => { output.value = genUUID(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      output.value = genUUID();
    `,

    'other/nanoid': `
      const output = document.getElementById('output');
      const lenInput = document.getElementById('length');
      const alphabet = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
      function gen(size = 21) {
        let id = '';
        const bytes = crypto.getRandomValues(new Uint8Array(size));
        for (let i = 0; i < size; i++) id += alphabet[bytes[i] % alphabet.length];
        return id;
      }
      document.getElementById('generate').onclick = () => { output.value = gen(parseInt(lenInput.value) || 21); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      output.value = gen();
    `,

    'other/password': `
      const output = document.getElementById('output');
      const lenInput = document.getElementById('length');
      const includeSpecial = document.getElementById('special');
      function gen() {
        const len = parseInt(lenInput.value) || 16;
        let chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZabcdefghijklmnopqrstuvwxyz0123456789';
        if (includeSpecial.checked) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
        const arr = crypto.getRandomValues(new Uint8Array(len));
        return [...arr].map(b => chars[b % chars.length]).join('');
      }
      document.getElementById('generate').onclick = () => { output.value = gen(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      output.value = gen();
    `,

    'time/timestamp': `
      const tsInput = document.getElementById('tsInput');
      const dateInput = document.getElementById('dateInput');
      const nowOutput = document.getElementById('nowOutput');
      const tsOutput = document.getElementById('tsOutput');
      const dateOutput = document.getElementById('dateOutput');

      function updateNow() {
        const now = Date.now();
        nowOutput.value = now + ' ms';
        tsOutput.value = Math.floor(now / 1000) + ' s';
        dateOutput.value = new Date(now).toLocaleString('zh-CN');
      }

      document.getElementById('toDate').onclick = () => {
        const v = tsInput.value.trim();
        if (!v) return;
        const ms = v.length === 10 ? parseInt(v)*1000 : parseInt(v);
        dateInput.value = new Date(ms).toLocaleString('zh-CN');
      };
      document.getElementById('toTs').onclick = () => {
        const d = new Date(dateInput.value);
        if (isNaN(d)) return;
        tsInput.value = d.getTime();
      };
      document.getElementById('copyNow').onclick = () => copyToClipboard(nowOutput.value);
      document.getElementById('copyTs').onclick = () => copyToClipboard(tsOutput.value);
      updateNow();
      setInterval(updateNow, 1000);
    `,

    'encrypt/md5': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      input.addEventListener('input', async () => {
        if (!input.value) { output.value = ''; return; }
        const buf = new TextEncoder().encode(input.value);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        output.value = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
      });
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'text/case': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'upper';
      function run() {
        const v = input.value;
        if (mode === 'upper') output.value = v.toUpperCase();
        else if (mode === 'lower') output.value = v.toLowerCase();
        else if (mode === 'title') output.value = v.replace(/\\b\\w/g, c => c.toUpperCase());
        else if (mode === 'swap') output.value = v.split('').map(c => c === c.toUpperCase() ? c.toLowerCase() : c.toUpperCase()).join('');
      }
      document.getElementById('upper').onclick = () => { mode='upper'; run(); };
      document.getElementById('lower').onclick = () => { mode='lower'; run(); };
      document.getElementById('title').onclick = () => { mode='title'; run(); };
      document.getElementById('swap').onclick = () => { mode='swap'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'text/count': `
      const input = document.getElementById('input');
      const result = document.getElementById('result');
      function count() {
        const v = input.value;
        result.innerHTML = '<b>字符数（含空格）</b>: ' + v.length + '<br><b>字符数（不含空格）</b>: ' + v.replace(/\\s/g,'').length + '<br><b>单词数</b>: ' + v.trim().split(/\\s+/).filter(Boolean).length + '<br><b>中文数</b>: ' + (v.match(/[\\u4e00-\\u9fa5]/g)||[]).length + '<br><b>行数</b>: ' + (v.split('\\n').length);
      }
      input.addEventListener('input', count);
      count();
    `,

    'text/camel': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'toCamel';
      function run() {
        const v = input.value.trim();
        if (mode === 'toCamel') output.value = v.replace(/[_\\-\\s]+(.)?/g, (_,c) => c ? c.toUpperCase() : '');
        else output.value = v.replace(/[A-Z]+/g, m => '_' + m[0].toLowerCase()).replace(/^_/, '').toLowerCase();
      }
      document.getElementById('toCamel').onclick = () => { mode='toCamel'; run(); };
      document.getElementById('fromCamel').onclick = () => { mode='fromCamel'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'json/yaml': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'toYaml';
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          if (mode === 'toYaml') {
            const obj = JSON.parse(val);
            output.value = toYaml(obj, 0);
          } else {
            output.value = JSON.stringify(parseYaml(val), null, 2);
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      function toYaml(obj, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) return pad + (typeof obj === 'string' ? '"' + obj + '"' : obj);
        if (Array.isArray(obj)) return obj.map(v => pad + '- ' + (typeof v === 'object' ? '\n' + toYaml(v, indent+1) : (typeof v === 'string' ? '"' + v + '"' : v))).join('\n');
        return Object.entries(obj).map(([k,v]) => {
          if (typeof v === 'object' && v !== null) return pad + k + ':\n' + toYaml(v, indent+1);
          return pad + k + ': ' + (typeof v === 'string' ? '"' + v + '"' : v);
        }).join('\n');
      }
      function parseYaml(yaml) {
        const lines = yaml.split('\n');
        let idx = 0;
        function skipBlank() { while (idx < lines.length && !lines[idx].trim()) idx++; }
        function parseNode(indent) {
          skipBlank();
          if (idx >= lines.length) return null;
          const line = lines[idx];
          if (!line.slice(indent).trim()) { skipBlank(); return null; }
          // Array item
          if (line.match(/^(\s*)-\s+/)) {
            const arr = [];
            while (idx < lines.length) {
              const cur = lines[idx];
              const curIndent = cur.match(/^(\s*)/)[1].length;
              if (cur.match(/^\s*-\s+/) && (curIndent === indent || curIndent === indent + 2)) {
                idx++;
                const val = cur.replace(/^\s*-\s+/, '');
                if (val.trim()) arr.push(parseValue(val.trim(), indent + 2));
                else arr.push(parseNode(indent + 2));
              } else break;
            }
            return arr;
          }
          // Key-value
          const m = line.match(/^(\s*)(.+?):\s*(.*)/);
          if (m) {
            const key = m[2].trim();
            const rest = m[3].trim();
            idx++;
            if (!rest) return { key, value: parseNode(indent + 2) };
            return { key, value: parseValue(rest, indent) };
          }
          idx++;
          return null;
        }
        function parseValue(str, baseIndent) {
          if (!str || str === '' || str === '{}' || str === '[]') return str;
          if (str.startsWith('{') || str.startsWith('[')) {
            try { return JSON.parse(str.replace(/'/g, '"')); } catch(e) {}
          }
          if ((str.startsWith('"') && str.endsWith('"')) || (str.startsWith("'") && str.endsWith("'"))) {
            return str.slice(1, -1);
          }
          if (str === 'true') return true;
          if (str === 'false') return false;
          if (str === 'null' || str === '~') return null;
          if (!isNaN(str) && str !== '') return Number(str);
          return str;
        }
        const result = {};
        skipBlank();
        while (idx < lines.length) {
          const m = lines[idx].match(/^(\s*)(.+?):\s*(.*)/);
          if (m) {
            const key = m[2].trim();
            const rest = m[3].trim();
            idx++;
            if (!rest) {
              const nested = parseNode(0);
              if (Array.isArray(nested)) result[key] = nested;
              else if (nested && typeof nested === 'object) result[key] = nested;
              else result[key] = {};
            } else {
              result[key] = parseValue(rest, 0);
            }
          } else idx++;
        }
        return result;
      }
      document.getElementById('toYaml').onclick = () => { mode='toYaml'; run(); };
      document.getElementById('toJson').onclick = () => { mode='toJson'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'json/xml': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'toXml';
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          if (mode === 'toXml') {
            const obj = JSON.parse(val);
            output.value = jsonToXml(obj, 'root');
          } else {
            const doc = new DOMParser().parseFromString(val, 'text/xml');
            output.value = JSON.stringify(xmlToJson(doc.documentElement), null, 2);
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      function jsonToXml(obj, name) {
        if (typeof obj !== 'object' || obj === null) return '<' + name + '>' + obj + '</' + name + '>';
        if (Array.isArray(obj)) return obj.map(v => jsonToXml(v, name)).join('');
        let s = '<' + name + '>';
        Object.entries(obj).forEach(([k,v]) => s += jsonToXml(v, k));
        return s + '</' + name + '>';
      }
      function xmlToJson(node) {
        if (node.nodeType === 3) return node.textContent;
        const obj = {};
        node.childNodes.forEach(child => {
          if (child.nodeType === 3 && !child.textContent.trim()) return;
          const val = child.childNodes.length === 1 && child.firstChild.nodeType === 3 ? child.textContent : xmlToJson(child);
          const key = child.nodeName;
          if (obj[key]) { if (!Array.isArray(obj[key])) obj[key] = [obj[key]]; obj[key].push(val); }
          else obj[key] = val;
        });
        return obj;
      }
      document.getElementById('toXml').onclick = () => { mode='toXml'; run(); };
      document.getElementById('toJson').onclick = () => { mode='toJson'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'json/table': `
      const input = document.getElementById('input');
      const tableContainer = document.getElementById('tableContainer');
      const searchInput = document.getElementById('searchInput');
      const pageInfo = document.getElementById('pageInfo');
      const prevBtn = document.getElementById('prevPage');
      const nextBtn = document.getElementById('nextPage');

      const PAGE_SIZE = 20;
      let allData = [];
      let filteredData = [];
      let currentPage = 1;
      let sortCol = null;
      let sortAsc = true;

      function parseJson() {
        const val = input.value.trim();
        if (!val) { allData = []; filteredData = []; renderTable(); return; }
        try {
          let data = JSON.parse(val);
          if (!Array.isArray(data)) data = [data];
          allData = data;
          filteredData = [...allData];
          if (sortCol !== null) applySort();
          currentPage = 1;
          renderTable();
        } catch(e) {
          tableContainer.innerHTML = '<div style="color:#ef4444;padding:1rem;">JSON 解析错误: ' + e.message + '</div>';
        }
      }

      function applySort() {
        if (sortCol === null) return;
        filteredData.sort((a, b) => {
          const va = a[sortCol] ?? '';
          const vb = b[sortCol] ?? '';
          if (va < vb) return sortAsc ? -1 : 1;
          if (va > vb) return sortAsc ? 1 : -1;
          return 0;
        });
      }

      function renderTable() {
        if (filteredData.length === 0) {
          tableContainer.innerHTML = '<div style="color:#888;padding:1rem;text-align:center;">暂无数据，请在左侧输入 JSON 数组</div>';
          pageInfo.textContent = '0 / 0';
          return;
        }
        const cols = [...new Set(filteredData.flatMap(row => Object.keys(row)))];
        const totalPages = Math.max(1, Math.ceil(filteredData.length / PAGE_SIZE));
        if (currentPage > totalPages) currentPage = totalPages;
        const start = (currentPage - 1) * PAGE_SIZE;
        const pageRows = filteredData.slice(start, start + PAGE_SIZE);

        const sortIcon = col => {
          if (sortCol !== col) return '';
          return sortAsc ? ' ↑' : ' ↓';
        };

        let html = '<table class="json-table"><thead><tr>';
        cols.forEach(col => {
html += '<th onclick="sortBy(\'' + col + '\')" style="cursor:pointer;user-select:none;">' + escHtml(col) + sortIcon(col) + '</th>';
        });
        html += '</tr></thead><tbody>';
        pageRows.forEach(row => {
          html += '<tr>';
          cols.forEach(col => {
            const val = row[col];
            const display = val === null || val === undefined ? '<span style="opacity:0.4;">null</span>' : escHtml(String(val));
            html += '<td>' + display + '</td>';
          });
          html += '</tr>';
        });
        html += '</tbody></table>';
        tableContainer.innerHTML = html;
        pageInfo.textContent = filteredData.length > 0 ? currentPage + ' / ' + totalPages : '0 / 0';
      }

      function sortBy(col) {
        if (sortCol === col) sortAsc = !sortAsc;
        else { sortCol = col; sortAsc = true; }
        applySort();
        currentPage = 1;
        renderTable();
      }
      window.sortBy = sortBy;

      function filterData() {
        const q = searchInput.value.toLowerCase();
        if (!q) {
          filteredData = [...allData];
        } else {
          filteredData = allData.filter(row =>
            Object.values(row).some(v => String(v).toLowerCase().includes(q))
          );
        }
        currentPage = 1;
        renderTable();
      }

      function escHtml(s) {
        return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;').replace(/"/g,'&quot;');
      }

      function copyTableHtml() {
        const q = searchInput.value.toLowerCase();
        const data = q ? allData.filter(row => Object.values(row).some(v => String(v).toLowerCase().includes(q))) : allData;
        if (data.length === 0) { alert('表格无数据'); return; }
        const cols = [...new Set(data.flatMap(row => Object.keys(row)))];
        let html = '<table border="1" cellpadding="5" cellspacing="0">';
        html += '<thead><tr>' + cols.map(c => '<th>' + escHtml(c) + '</th>').join('') + '</tr></thead>';
        html += '<tbody>';
        data.forEach(row => {
          html += '<tr>' + cols.map(c => {
            const val = row[c];
            return '<td>' + (val === null || val === undefined ? '' : escHtml(String(val))) + '</td>';
          }).join('') + '</tr>';
        });
        html += '</tbody></table>';
        copyToClipboard(html);
      }

      input.addEventListener('input', parseJson);
      searchInput.addEventListener('input', filterData);
      prevBtn.addEventListener('click', () => { currentPage = Math.max(1, currentPage - 1); renderTable(); });
      nextBtn.addEventListener('click', () => { const total = Math.ceil(filteredData.length / PAGE_SIZE); currentPage = Math.min(total, currentPage + 1); renderTable(); });
      document.getElementById('copyTable').addEventListener('click', copyTableHtml);

      // Demo data
      input.value = JSON.stringify([
        {"name":"张三","age":28,"city":"北京","score":92},
        {"name":"李四","age":22,"city":"上海","score":85},
        {"name":"王五","age":35,"city":"广州","score":78},
        {"name":"赵六","age":30,"city":"深圳","score":95},
        {"name":"钱七","age":26,"city":"杭州","score":88}
      ], null, 2);
      parseJson();
    `,

    'code/html': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'format';
      function run() {
        try {
          const val = input.value;
          const doc = new DOMParser().parseFromString(val, 'text/html');
          output.value = mode === 'format' ? doc.documentElement.outerHTML : doc.documentElement.outerHTML.replace(/>\s+</g, '><').trim();
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('format').onclick = () => { mode='format'; run(); };
      document.getElementById('minify').onclick = () => { mode='minify'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'code/css': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'format';
      function run() {
        try {
          const val = input.value;
          if (mode === 'format') output.value = val.replace(/\{/g, ' {\n  ').replace(/;/g, ';\n  ').replace(/\}/g, '\n}\n').replace(/^\s+}/gm, '}');
          else output.value = val.replace(/\\s+/g, ' ').replace(/\\s*\{\\s*/g, '{').replace(/\\s*;\\s*/g, ';').replace(/\\s*\}\\s*/g, '}').trim();
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('format').onclick = () => { mode='format'; run(); };
      document.getElementById('minify').onclick = () => { mode='minify'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'code/javascript': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'format';
      function run() {
        try {
          const val = input.value;
          if (mode === 'format') output.value = val.replace(/\{/g, ' {\n  ').replace(/;/g, ';\n  ').replace(/\}/g, '\n}');
          else output.value = val.replace(/\\s+/g, ' ').replace(/;\\s*/g, ';').trim();
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('format').onclick = () => { mode='format'; run(); };
      document.getElementById('minify').onclick = () => { mode='minify'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'encrypt/sha': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const algo = document.getElementById('algo');
      input.addEventListener('input', async () => {
        if (!input.value) { output.value = ''; return; }
        const buf = new TextEncoder().encode(input.value);
        const hash = await crypto.subtle.digest(algo.value, buf);
        output.value = [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
      });
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'encrypt/Shake加密': `
      // Pure JS implementation of SHAKE128 / SHAKE256 (FIPS 202)
      // Keccak-f[1600] permutation with configurable rate.

      // Round constants for Keccak (iota step)
      const RC = [0x0000000000000001n, 0x0000000000008082n, 0x800000000000808an, 0x8000000080008000n, 0x000000000000808bn, 0x0000000080000001n, 0x8000000080008081n, 0x8000000000008009n, 0x000000000000008an, 0x0000000000000088n, 0x0000000080008009n, 0x000000008000000an, 0x000000008000808bn, 0x800000000000008bn, 0x8000000000008089n, 0x8000000000008003n, 0x8000000000008002n, 0x8000000000000080n, 0x000000000000800an, 0x800000008000000an, 0x8000000080008081n, 0x8000000000008080n, 0x0000000080000001n, 0x8000000080008008n];

      // Rotation offsets (rho step)
      const R = [
        [0n, 36n, 3n, 41n, 18n],
        [1n, 44n, 10n, 45n, 2n],
        [62n, 6n, 43n, 15n, 61n],
        [28n, 55n, 25n, 21n, 56n],
        [27n, 20n, 39n, 8n, 14n]
      ];

      function rotl(x, n) { n = BigInt(n); return ((x << n) | (x >> (64n - n))) & 0xffffffffffffffffn; }

      function keccakF1600(state) {
        for (let round = 0; round < 24; round++) {
          // Theta
          const C = [0n,0n,0n,0n,0n];
          for (let x = 0; x < 5; x++) C[x] = state[x] ^ state[x+5] ^ state[x+10] ^ state[x+15] ^ state[x+20];
          const D = [0n,0n,0n,0n,0n];
          for (let x = 0; x < 5; x++) D[x] = C[(x+4)%5] ^ rotl(C[(x+1)%5], 1n);
          for (let i = 0; i < 25; i++) state[i] ^= D[i % 5];

          // Rho and Pi
          const B = new Array(25).fill(0n);
          for (let x = 0; x < 5; x++) {
            for (let y = 0; y < 5; y++) {
              B[y + ((2*x + 3*y) % 5) * 5] = rotl(state[x + 5*y], R[x][y]);
            }
          }

          // Chi
          for (let y = 0; y < 5; y++) {
            for (let x = 0; x < 5; x++) {
              state[x + 5*y] = B[x + 5*y] ^ ((~B[((x+1)%5) + 5*y]) & B[((x+2)%5) + 5*y] & 0xffffffffffffffffn);
            }
          }

          // Iota
          state[0] ^= RC[round];
        }
      }

      // SHAKE: rate 168 bytes for SHAKE128, 136 bytes for SHAKE256 (in bits: 1344 / 1088)
      function shake(input, outBytes, bits) {
        const rateBytes = bits === 128 ? 168 : 136;
        const data = new TextEncoder().encode(input);
        // State: 25 x 64-bit lanes
        let state = new Array(25).fill(0n);

        // Absorbing phase
        const blockWords = rateBytes / 8; // 21 for shake128, 17 for shake256
        let offset = 0;
        while (data.length - offset >= rateBytes) {
          for (let i = 0; i < blockWords; i++) {
            let w = 0n;
            for (let b = 0; b < 8; b++) w = (w << 8n) | BigInt(data[offset + i*8 + b]);
            state[i] ^= w;
          }
          keccakF1600(state);
          offset += rateBytes;
        }

        // Last block with padding
        const last = data.slice(offset);
        const lastWords = blockWords;
        const pad = new Uint8Array(rateBytes);
        pad.set(last);
        pad[last.length] = 0x1F; // SHAKE padding byte (different from SHA-3 which uses 0x06)
        pad[rateBytes - 1] |= 0x80;
        for (let i = 0; i < lastWords; i++) {
          let w = 0n;
          for (let b = 0; b < 8; b++) w = (w << 8n) | BigInt(pad[i*8 + b]);
          state[i] ^= w;
        }
        keccakF1600(state);

        // Squeezing phase
        const out = new Uint8Array(outBytes);
        let outOff = 0;
        while (outOff < outBytes) {
          for (let i = 0; i < blockWords && outOff < outBytes; i++) {
            let w = state[i];
            for (let b = 7; b >= 0 && outOff < outBytes; b--) {
              out[outOff++] = Number((w >> BigInt(b * 8)) & 0xffn);
            }
          }
          if (outOff < outBytes) keccakF1600(state);
        }
        return out;
      }

      function bytesToHex(bytes) {
        return [...bytes].map(b => b.toString(16).padStart(2, '0')).join('');
      }

      function bytesToBase64(bytes) {
        let s = '';
        for (let i = 0; i < bytes.length; i++) s += String.fromCharCode(bytes[i]);
        return btoa(s);
      }

      const input = document.getElementById('input');
      const algo = document.getElementById('algo');
      const outLen = document.getElementById('outLen');
      const hexOut = document.getElementById('hexOut');
      const b64Out = document.getElementById('b64Out');
      const meta = document.getElementById('meta');

      function run() {
        const v = input.value;
        if (!v) { hexOut.value = ''; b64Out.value = ''; meta.textContent = ''; return; }
        try {
          const bits = algo.value === 'SHAKE128' ? 128 : 256;
          const bytes = parseInt(outLen.value) || 32;
          if (bytes < 1 || bytes > 1024) {
            hexOut.value = '';
            b64Out.value = '';
            meta.textContent = '字节数必须在 1-1024 之间';
            return;
          }
          const t0 = performance.now();
          const hash = shake(v, bytes, bits);
          const t1 = performance.now();
          hexOut.value = bytesToHex(hash);
          b64Out.value = bytesToBase64(hash);
          meta.textContent = algo.value + ' · ' + bytes + ' 字节 (' + (bytes*8) + ' bit) · 耗时 ' + (t1-t0).toFixed(2) + ' ms';
        } catch(e) {
          hexOut.value = '';
          b64Out.value = '';
          meta.textContent = '错误: ' + e.message;
        }
      }

      input.addEventListener('input', run);
      algo.addEventListener('change', run);
      outLen.addEventListener('input', run);
      document.getElementById('copyHex').onclick = () => copyToClipboard(hexOut.value);
      document.getElementById('copyB64').onclick = () => copyToClipboard(b64Out.value);
      run();
    `,

    'code/markdown': `
      const input = document.getElementById('input');
      const preview = document.getElementById('preview');
      const htmlOutput = document.getElementById('htmlOutput');

      // Simple Markdown parser
      function parseMarkdown(text) {
        if (!text) return '';
        let html = text;

        // Escape HTML
        html = html.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');

        // Code blocks (\`\`\`...\`\`\`)
        html = html.replace(/\`\`\`([\\s\\S]*?)\`\`\`/g, (_, code) => '<pre><code>' + code.replace(/\`/g, '&#96;') + '</code></pre>');
        // Inline code
        html = html.replace(/\`([^\`]+)\`/g, '<code>$1</code>');

        // Headers
        html = html.replace(/^###### (.+)$/gm, '<h6>$1</h6>');
        html = html.replace(/^##### (.+)$/gm, '<h5>$1</h5>');
        html = html.replace(/^#### (.+)$/gm, '<h4>$1</h4>');
        html = html.replace(/^### (.+)$/gm, '<h3>$1</h3>');
        html = html.replace(/^## (.+)$/gm, '<h2>$1</h2>');
        html = html.replace(/^# (.+)$/gm, '<h1>$1</h1>');

        // Bold & Italic
        html = html.replace(/\*\*\*(.+?)\*\*\*/g, '<strong><em>$1</em></strong>');
        html = html.replace(/\*\*(.+?)\*\*/g, '<strong>$1</strong>');
        html = html.replace(/\*(.+?)\*/g, '<em>$1</em>');
        html = html.replace(/___(.+?)___/g, '<strong><em>$1</em></strong>');
        html = html.replace(/__(.+?)__/g, '<strong>$1</strong>');
        html = html.replace(/_(.+?)_/g, '<em>$1</em>');

        // Blockquote
        html = html.replace(/^&gt; (.+)$/gm, '<blockquote>$1</blockquote>');

        // Unordered list
        html = html.replace(/^[\\-*+] (.+)$/gm, '<li>$1</li>');
        html = html.replace(/(<li>.*?<\\/li>\\n?)+/g, '<ul>$&</ul>');

        // Ordered list
        html = html.replace(/^\\d+\\. (.+)$/gm, '<li>$1</li>');

        // Links
        html = html.replace(/\\[([^\\]]+)\\]\\(([^)]+)\\)/g, '<a href="$2" target="_blank" rel="noopener">$1</a>');

        // Images
        html = html.replace(/!\\[([^\\]]*)\\]\\(([^)]+)\\)/g, '<img src="$2" alt="$1" style="max-width:100%;border-radius:8px;">');

        // Horizontal rule
        html = html.replace(/^---$/gm, '<hr>');
        html = html.replace(/^\\*\\*\\*$/gm, '<hr>');

        // Tables (simple)
        const tableRegex = /^\\|(.+)\\|\\n\\|[\\|:- \\|]+\\|\\n((?:\\|.+\\|\\n?)+)/gm;
        html = html.replace(tableRegex, (_, header, body) => {
          const headers = header.split('|').filter(h => h.trim()).map(h => '<th>' + h.trim() + '</th>').join('');
          const rows = body.trim().split('\n').map(row => {
            const cells = row.split('|').filter(c => c !== undefined && c.trim() !== '').map(c => '<td>' + c.trim() + '</td>').join('');
            return '<tr>' + cells + '</tr>';
          }).join('');
          return '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table>';
        });

        // Paragraphs
          const lines = html.split('\n');
        const result = [];
        let inBlock = false;
        for (const line of lines) {
          const trimmed = line.trim();
          if (!trimmed) { if (inBlock) { result.push('</p>'); inBlock = false; } continue; }
          if (trimmed.startsWith('<h') || trimmed.startsWith('<ul') || trimmed.startsWith('<ol') || trimmed.startsWith('<blockquote') || trimmed.startsWith('<pre') || trimmed.startsWith('<table') || trimmed.startsWith('<hr')) {
            if (inBlock) { result.push('</p>'); inBlock = false; }
            result.push(trimmed);
          } else if (trimmed.startsWith('</')) {
            result.push(trimmed);
          } else {
            if (!inBlock) { result.push('<p>' + trimmed); inBlock = true; }
            else result.push(trimmed);
          }
        }
        if (inBlock) result.push('</p>');
          return result.join('\n');
      }

      function update() {
        const md = input.value;
        const html = parseMarkdown(md);
        preview.innerHTML = html;
        htmlOutput.value = html;
      }

      input.addEventListener('input', update);
      document.getElementById('copyHtml').addEventListener('click', () => copyToClipboard(htmlOutput.value));
      update();
    `,

    'encrypt/unicode': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'toUnicode';
      function run() {
        const v = input.value;
        output.value = mode === 'toUnicode' ? [...v].map(c => '\\u' + c.charCodeAt(0).toString(16).padStart(4,'0')).join('') : v.replace(/\\u([0-9a-f]{4})/gi, m => String.fromCharCode(parseInt(m.slice(2),16)));
      }
      document.getElementById('toUnicode').onclick = () => { mode='toUnicode'; run(); };
      document.getElementById('fromUnicode').onclick = () => { mode='fromUnicode'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'text/diff': `
      const input1 = document.getElementById('input1');
      const input2 = document.getElementById('input2');
      const output = document.getElementById('output');
      function run() {
        const t1 = input1.value.split('\n');
        const t2 = input2.value.split('\n');
        let html = '';
        const max = Math.max(t1.length, t2.length);
        for (let i = 0; i < max; i++) {
          const l1 = t1[i] || '', l2 = t2[i] || '';
          if (l1 === l2) html += '<div class="diff-line diff-same">' + escHtml(l1) + '</div>';
          else { if (l1) html += '<div class="diff-line diff-del">- ' + escHtml(l1) + '</div>'; if (l2) html += '<div class="diff-line diff-add">+ ' + escHtml(l2) + '</div>'; }
        }
        output.innerHTML = '<style>.diff-line{padding:2px 8px;font-family:monospace;font-size:13px;white-space:pre-wrap}.diff-same{background:#f0f0f0}.diff-del{background:#ffe0e0;color:#c00}.diff-add{background:#e0ffe0;color:#0a0}</style>' + html;
      }
      function escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }
      input1.addEventListener('input', run);
      input2.addEventListener('input', run);
    `,

    'time/countdown': `
      const targetInput = document.getElementById('target');
      const result = document.getElementById('result');
      let interval;
      function startCountdown() {
        clearInterval(interval);
        const target = new Date(targetInput.value);
        if (isNaN(target)) { result.textContent = '请输入有效日期时间'; return; }
        interval = setInterval(() => {
          const diff = target - Date.now();
          if (diff <= 0) { result.textContent = '时间到！'; clearInterval(interval); return; }
          const d = Math.floor(diff/86400000);
          const h = Math.floor(diff%86400000/3600000);
          const m = Math.floor(diff%3600000/60000);
          const s = Math.floor(diff%60000/1000);
          result.innerHTML = '<b>' + d + '</b>天 <b>' + h + '</b>时 <b>' + m + '</b>分 <b>' + s + '</b>秒';
        }, 1000);
      }
      document.getElementById('start').onclick = startCountdown;
    `,

    'time/interval': `
      const startInput = document.getElementById('start');
      const endInput = document.getElementById('end');
      const result = document.getElementById('result');
      function calc() {
        const s = new Date(startInput.value);
        const e = new Date(endInput.value);
        if (isNaN(s) || isNaN(e)) { result.textContent = '请选择两个日期'; return; }
        const diff = Math.abs(e - s);
        const days = Math.floor(diff/86400000);
        const hours = Math.floor(diff%86400000/3600000);
        const mins = Math.floor(diff%3600000/60000);
        result.innerHTML = '<b>' + days + '</b>天 <b>' + hours + '</b>小时 <b>' + mins + '</b>分钟<br><b>' + (diff/86400000).toFixed(2) + '</b> 天总计';
      }
      startInput.addEventListener('change', calc);
      endInput.addEventListener('change', calc);
    `,

    'time/age': `
      const birthInput = document.getElementById('birth');
      const result = document.getElementById('result');
      function calc() {
        const birth = new Date(birthInput.value);
        if (isNaN(birth)) { result.textContent = '请输入生日'; return; }
        const now = new Date();
        let age = now.getFullYear() - birth.getFullYear();
        const m = now.getMonth() - birth.getMonth();
        if (m < 0 || (m === 0 && now.getDate() < birth.getDate())) age--;
        const daysSinceBirth = Math.floor((now - birth)/86400000);
        result.innerHTML = '<b>' + age + '</b> 岁<br>活了 <b>' + daysSinceBirth + '</b> 天';
      }
      birthInput.addEventListener('change', calc);
    `,

    'time/world': `
      const zones = [
        {name:'北京',offset:8},{name:'东京',offset:9},{name:'首尔',offset:9},{name:'新加坡',offset:8},
        {name:'迪拜',offset:4},{name:'莫斯科',offset:3},{name:'伦敦',offset:0},{name:'巴黎',offset:1},
        {name:'纽约',offset:-5},{name:'洛杉矶',offset:-8},{name:'悉尼',offset:10},{name:'东京',offset:9}
      ];
      const container = document.getElementById('zones');
      function showTimes() {
        const now = new Date();
        container.innerHTML = zones.map(z => {
          const t = new Date(now.getTime() + (z.offset - 8) * 3600000);
          return '<div class="zone-card"><b>' + z.name + '</b><span>' + t.toLocaleTimeString('zh-CN',{hour:'2-digit',minute:'2-digit',second:'2-digit'}) + '</span></div>';
        }).join('');
      }
      showTimes();
      setInterval(showTimes, 1000);
    `,

    'time/world-clock': `
      const clockZones = [
        { city: '北京', offset: 8, flag: '🇨🇳' },
        { city: '东京', offset: 9, flag: '🇯🇵' },
        { city: '首尔', offset: 9, flag: '🇰🇷' },
        { city: '新加坡', offset: 8, flag: '🇸🇬' },
        { city: '迪拜', offset: 4, flag: '🇦🇪' },
        { city: '莫斯科', offset: 3, flag: '🇷🇺' },
        { city: '伦敦', offset: 0, flag: '🇬🇧' },
        { city: '巴黎', offset: 1, flag: '🇫🇷' },
        { city: '纽约', offset: -5, flag: '🇺🇸' },
        { city: '洛杉矶', offset: -8, flag: '🇺🇸' },
        { city: '旧金山', offset: -8, flag: '🇺🇸' },
        { city: '悉尼', offset: 10, flag: '🇦🇺' },
        { city: '曼谷', offset: 7, flag: '🇹🇭' },
        { city: '孟买', offset: 5.5, flag: '🇮🇳' },
        { city: '法兰克福', offset: 1, flag: '🇩🇪' },
        { city: '多伦多', offset: -5, flag: '🇨🇦' },
      ];

      const convCities = [
        { city: '北京时间', offset: 8 },
        { city: '东京时间', offset: 9 },
        { city: '伦敦时间', offset: 0 },
        { city: '纽约时间', offset: -5 },
        { city: '迪拜时间', offset: 4 },
        { city: '悉尼时间', offset: 10 },
      ];

      const WEEKDAY = ['日', '一', '二', '三', '四', '五', '六'];
      const ntpDot = document.getElementById('ntpDot');
      const ntpLabel = document.getElementById('ntpLabel');
      const ntpDetail = document.getElementById('ntpDetail');
      const timeMain = document.getElementById('timeMain');
      const timeMeta = document.getElementById('timeMeta');
      const convTime = document.getElementById('convTime');
      const convFromZone = document.getElementById('convFromZone');
      const convResults = document.getElementById('convResults');
      const clockGrid = document.getElementById('clockGrid');

      // NTP simulation (browser can't do real NTP easily)
      let ntpOnline = false;
      let ntpOffset = 0;

      function checkNTP() {
        ntpDot.className = 'ntp-status-dot online';
        ntpLabel.textContent = 'NTP 已同步 (网络时间)';
        ntpDetail.textContent = '同步状态：已连接 | 精度：±50ms（网络校准）';
        ntpOnline = true;
      }

      // Try to get network time via a lightweight fetch to a time API
      async function tryNTP() {
        try {
          const controller = new AbortController();
          const timeout = setTimeout(() => controller.abort(), 3000);
          const start = Date.now();
          // Use worldtimeapi as it's free and supports CORS
          const res = await fetch('https://worldtimeapi.org/api/ip', { signal: controller.signal });
          clearTimeout(timeout);
          const data = await res.json();
          const roundTrip = Date.now() - start;
          const serverTime = new Date(data.datetime).getTime();
          // Estimate one-way offset
          ntpOffset = serverTime - Date.now() - roundTrip / 2;
          ntpOnline = true;
          ntpDot.className = 'ntp-status-dot online';
          ntpLabel.textContent = 'NTP 已同步 (worldtimeapi.org)';
          ntpDetail.textContent = '同步状态：已连接 | 往返延迟：' + roundTrip + 'ms | 系统偏移：' + (ntpOffset >= 0 ? '+' : '') + ntpOffset + 'ms';
        } catch (e) {
          ntpOnline = false;
          ntpDot.className = 'ntp-status-dot offline';
          ntpLabel.textContent = 'NTP 不可用（显示本地时间）';
          ntpDetail.textContent = '本地时间精度：±1秒 | 建议：确保网络连接以校准标准时间';
        }
      }

      function zeroPad(n) { return String(n).padStart(2, '0'); }

      function getAdjustedNow() {
        return new Date(Date.now() + (ntpOnline ? ntpOffset : 0));
      }

      function updateLocalTime() {
        const now = getAdjustedNow();
        const h = zeroPad(now.getHours());
        const m = zeroPad(now.getMinutes());
        const s = zeroPad(now.getSeconds());
        const Y = now.getFullYear();
        const Mo = zeroPad(now.getMonth() + 1);
        const D = zeroPad(now.getDate());
        const wd = WEEKDAY[now.getDay()];
        timeMain.textContent = h + ':' + m + ':' + s;
        timeMeta.textContent = Y + '年' + Mo + '月' + D + '日 星期' + wd;
      }

      function updateWorldClock() {
        const now = getAdjustedNow();
        clockGrid.innerHTML = clockZones.map(z => {
          const localMs = now.getTime();
          const zMs = localMs + (z.offset - 8) * 3600000;
          const zDate = new Date(zMs);
          const nextDay = zDate.getDate() !== now.getDate();
          const h = zeroPad(zDate.getHours());
          const m = zeroPad(zDate.getMinutes());
          const s = zeroPad(zDate.getSeconds());
          const offsetStr = z.offset >= 0 ? 'UTC+' + z.offset : 'UTC' + z.offset;
          return '<div class="clock-card"><div class="city">' + z.flag + ' ' + z.city + '</div><div class="time">' + h + ':' + m + ':' + s + '</div><div class="offset">' + offsetStr + '</div></div>';
        }).join('');
      }

      function updateConversion() {
        const timeVal = convTime.value;
        const fromOffset = parseFloat(convFromZone.value);
        if (!timeVal) return;
        const [th, tm, ts] = timeVal.split(':').map(Number);
        // Build a date using local date but the input time
        const now = new Date();
        const base = new Date(now.getFullYear(), now.getMonth(), now.getDate(), th, tm, ts);
        // Convert from source timezone to UTC, then to local
        const asUTC = base.getTime() - fromOffset * 3600000;
        convResults.innerHTML = convCities.map(c => {
          const t = new Date(asUTC + c.offset * 3600000);
          const h = zeroPad(t.getHours());
          const m = zeroPad(t.getMinutes());
          const s = zeroPad(t.getSeconds());
          const diff = c.offset - fromOffset;
          const diffStr = diff >= 0 ? '+' + diff + 'h' : diff + 'h';
          return '<div class="conv-result-card"><div class="city">' + c.city + '</div><div class="result-time">' + h + ':' + m + ':' + s + '</div><div class="result-offset">时差 ' + diffStr + '</div></div>';
        }).join('');
      }

      convTime.addEventListener('input', updateConversion);
      convFromZone.addEventListener('change', updateConversion);

      tryNTP();
      updateLocalTime();
      updateWorldClock();
      updateConversion();
      setInterval(updateLocalTime, 1000);
      setInterval(updateWorldClock, 1000);
    `,

    'other/hex-convert': `
      const input = document.getElementById('input');
      const base = document.getElementById('base');
      const output = document.getElementById('output');
      function run() {
        try {
          const v = input.value.trim();
          const b = parseInt(base.value);
          output.textContent = parseInt(v, b).toString(2) + ' | ' + parseInt(v, b).toString(8) + ' | ' + parseInt(v, b).toString(10) + ' | ' + parseInt(v, b).toString(16).toUpperCase();
        } catch(e) { output.textContent = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      base.addEventListener('change', run);
    `,

    'other/color': `
      const hex = document.getElementById('hex');
      const rgb = document.getElementById('rgb');
      const picker = document.getElementById('picker');
      const preview = document.getElementById('preview');
      function toRgb(h) {
        const v = h.replace('#','');
        return {r:parseInt(v.substring(0,2),16),g:parseInt(v.substring(2,4),16),b:parseInt(v.substring(4,6),16)};
      }
      function toHex(r,g,b) { return '#' + [r,g,b].map(x => x.toString(16).padStart(2,'0')).join(''); }
      hex.addEventListener('input', () => {
        const {r,g,b} = toRgb(hex.value);
        rgb.value = r+','+g+','+b;
        preview.style.background = hex.value;
      });
      rgb.addEventListener('input', () => {
        const [r,g,b] = rgb.value.split(',').map(Number);
        hex.value = toHex(r,g,b);
        preview.style.background = toHex(r,g,b);
      });
      picker.addEventListener('input', () => {
        hex.value = picker.value;
        const {r,g,b} = toRgb(picker.value);
        rgb.value = r+','+g+','+b;
        preview.style.background = picker.value;
      });
    `,

    'other/regex': `
      const pattern = document.getElementById('pattern');
      const flags = document.getElementById('flags');
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function run() {
        try {
          const re = new RegExp(pattern.value, flags.value);
          if (!input.value) { output.innerHTML = ''; return; }
          const matches = input.value.match(re);
          if (!matches) { output.textContent = '无匹配'; return; }
          output.innerHTML = '匹配 <b>' + matches.length + '</b> 次<br>' + matches.map(m => '<code>' + m + '</code>').join('<br>');
        } catch(e) { output.textContent = '正则错误: ' + e.message; }
      }
      pattern.addEventListener('input', run);
      flags.addEventListener('input', run);
      input.addEventListener('input', run);
    `,

    'other/键盘按键值大全': `
// 键盘按键值数据 - 92 entries
const KEYS_DATA = [
  // Letters A-Z
  { key: 'A', code: 'KeyA', keyCode: 65, category: 'letter' },
  { key: 'B', code: 'KeyB', keyCode: 66, category: 'letter' },
  { key: 'C', code: 'KeyC', keyCode: 67, category: 'letter' },
  { key: 'D', code: 'KeyD', keyCode: 68, category: 'letter' },
  { key: 'E', code: 'KeyE', keyCode: 69, category: 'letter' },
  { key: 'F', code: 'KeyF', keyCode: 70, category: 'letter' },
  { key: 'G', code: 'KeyG', keyCode: 71, category: 'letter' },
  { key: 'H', code: 'KeyH', keyCode: 72, category: 'letter' },
  { key: 'I', code: 'KeyI', keyCode: 73, category: 'letter' },
  { key: 'J', code: 'KeyJ', keyCode: 74, category: 'letter' },
  { key: 'K', code: 'KeyK', keyCode: 75, category: 'letter' },
  { key: 'L', code: 'KeyL', keyCode: 76, category: 'letter' },
  { key: 'M', code: 'KeyM', keyCode: 77, category: 'letter' },
  { key: 'N', code: 'KeyN', keyCode: 78, category: 'letter' },
  { key: 'O', code: 'KeyO', keyCode: 79, category: 'letter' },
  { key: 'P', code: 'KeyP', keyCode: 80, category: 'letter' },
  { key: 'Q', code: 'KeyQ', keyCode: 81, category: 'letter' },
  { key: 'R', code: 'KeyR', keyCode: 82, category: 'letter' },
  { key: 'S', code: 'KeyS', keyCode: 83, category: 'letter' },
  { key: 'T', code: 'KeyT', keyCode: 84, category: 'letter' },
  { key: 'U', code: 'KeyU', keyCode: 85, category: 'letter' },
  { key: 'V', code: 'KeyV', keyCode: 86, category: 'letter' },
  { key: 'W', code: 'KeyW', keyCode: 87, category: 'letter' },
  { key: 'X', code: 'KeyX', keyCode: 88, category: 'letter' },
  { key: 'Y', code: 'KeyY', keyCode: 89, category: 'letter' },
  { key: 'Z', code: 'KeyZ', keyCode: 90, category: 'letter' },
  // Digits 0-9
  { key: '0', code: 'Digit0', keyCode: 48, category: 'digit' },
  { key: '1', code: 'Digit1', keyCode: 49, category: 'digit' },
  { key: '2', code: 'Digit2', keyCode: 50, category: 'digit' },
  { key: '3', code: 'Digit3', keyCode: 51, category: 'digit' },
  { key: '4', code: 'Digit4', keyCode: 52, category: 'digit' },
  { key: '5', code: 'Digit5', keyCode: 53, category: 'digit' },
  { key: '6', code: 'Digit6', keyCode: 54, category: 'digit' },
  { key: '7', code: 'Digit7', keyCode: 55, category: 'digit' },
  { key: '8', code: 'Digit8', keyCode: 56, category: 'digit' },
  { key: '9', code: 'Digit9', keyCode: 57, category: 'digit' },
  // Function keys F1-F12
  { key: 'F1', code: 'F1', keyCode: 112, category: 'function' },
  { key: 'F2', code: 'F2', keyCode: 113, category: 'function' },
  { key: 'F3', code: 'F3', keyCode: 114, category: 'function' },
  { key: 'F4', code: 'F4', keyCode: 115, category: 'function' },
  { key: 'F5', code: 'F5', keyCode: 116, category: 'function' },
  { key: 'F6', code: 'F6', keyCode: 117, category: 'function' },
  { key: 'F7', code: 'F7', keyCode: 118, category: 'function' },
  { key: 'F8', code: 'F8', keyCode: 119, category: 'function' },
  { key: 'F9', code: 'F9', keyCode: 120, category: 'function' },
  { key: 'F10', code: 'F10', keyCode: 121, category: 'function' },
  { key: 'F11', code: 'F11', keyCode: 122, category: 'function' },
  { key: 'F12', code: 'F12', keyCode: 123, category: 'function' },
  // Control keys
  { key: 'Enter', code: 'Enter', keyCode: 13, category: 'control' },
  { key: 'Tab', code: 'Tab', keyCode: 9, category: 'control' },
  { key: 'Escape', code: 'Escape', keyCode: 27, category: 'control' },
  { key: ' ', code: 'Space', keyCode: 32, category: 'control' },
  { key: 'Backspace', code: 'Backspace', keyCode: 8, category: 'control' },
  { key: 'Delete', code: 'Delete', keyCode: 46, category: 'control' },
  { key: 'Insert', code: 'Insert', keyCode: 45, category: 'control' },
  { key: 'ContextMenu', code: 'ContextMenu', keyCode: 93, category: 'control' },
  // Arrow keys
  { key: 'ArrowUp', code: 'ArrowUp', keyCode: 38, category: 'arrow' },
  { key: 'ArrowDown', code: 'ArrowDown', keyCode: 40, category: 'arrow' },
  { key: 'ArrowLeft', code: 'ArrowLeft', keyCode: 37, category: 'arrow' },
  { key: 'ArrowRight', code: 'ArrowRight', keyCode: 39, category: 'arrow' },
  { key: 'Home', code: 'Home', keyCode: 36, category: 'arrow' },
  { key: 'End', code: 'End', keyCode: 35, category: 'arrow' },
  { key: 'PageUp', code: 'PageUp', keyCode: 33, category: 'arrow' },
  { key: 'PageDown', code: 'PageDown', keyCode: 34, category: 'arrow' },
  // Modifier keys
  { key: 'Shift', code: 'ShiftLeft', keyCode: 16, category: 'modifier' },
  { key: 'Shift', code: 'ShiftRight', keyCode: 16, category: 'modifier' },
  { key: 'Control', code: 'ControlLeft', keyCode: 17, category: 'modifier' },
  { key: 'Control', code: 'ControlRight', keyCode: 17, category: 'modifier' },
  { key: 'Alt', code: 'AltLeft', keyCode: 18, category: 'modifier' },
  { key: 'Alt', code: 'AltRight', keyCode: 18, category: 'modifier' },
  { key: 'Meta', code: 'MetaLeft', keyCode: 91, category: 'modifier' },
  { key: 'Meta', code: 'MetaRight', keyCode: 92, category: 'modifier' },
  { key: 'CapsLock', code: 'CapsLock', keyCode: 20, category: 'modifier' },
  { key: 'NumLock', code: 'NumLock', keyCode: 144, category: 'modifier' },
  { key: 'ScrollLock', code: 'ScrollLock', keyCode: 145, category: 'modifier' },
  { key: 'ContextMenu', code: 'ContextMenu', keyCode: 93, category: 'modifier' },
  // Numpad
  { key: '0', code: 'Numpad0', keyCode: 96, category: 'numpad' },
  { key: '1', code: 'Numpad1', keyCode: 97, category: 'numpad' },
  { key: '2', code: 'Numpad2', keyCode: 98, category: 'numpad' },
  { key: '3', code: 'Numpad3', keyCode: 99, category: 'numpad' },
  { key: '4', code: 'Numpad4', keyCode: 100, category: 'numpad' },
  { key: '5', code: 'Numpad5', keyCode: 101, category: 'numpad' },
  { key: '6', code: 'Numpad6', keyCode: 102, category: 'numpad' },
  { key: '7', code: 'Numpad7', keyCode: 103, category: 'numpad' },
  { key: '8', code: 'Numpad8', keyCode: 104, category: 'numpad' },
  { key: '9', code: 'Numpad9', keyCode: 105, category: 'numpad' },
  { key: '+', code: 'NumpadAdd', keyCode: 107, category: 'numpad' },
  { key: '-', code: 'NumpadSubtract', keyCode: 109, category: 'numpad' },
  { key: '*', code: 'NumpadMultiply', keyCode: 106, category: 'numpad' },
  { key: '/', code: 'NumpadDivide', keyCode: 111, category: 'numpad' },
  { key: 'Enter', code: 'NumpadEnter', keyCode: 13, category: 'numpad' },
  { key: '.', code: 'NumpadDecimal', keyCode: 110, category: 'numpad' },
];

const CAT_LABEL = {
  letter: '字母',
  digit: '数字',
  function: '功能键',
  control: '控制键',
  arrow: '方向键',
  modifier: '修饰键',
  numpad: '小键盘',
};

const CAT_ORDER = ['letter', 'digit', 'function', 'control', 'arrow', 'modifier', 'numpad'];

function copyToClipboard(text) {
  if (navigator.clipboard && navigator.clipboard.writeText) {
    return navigator.clipboard.writeText(text);
  }
  // Fallback
  const ta = document.createElement('textarea');
  ta.value = text;
  ta.style.position = 'fixed';
  ta.style.opacity = '0';
  document.body.appendChild(ta);
  ta.select();
  try { document.execCommand('copy'); } catch (e) {}
  document.body.removeChild(ta);
  return Promise.resolve();
}

function escapeHtml(s) {
  return String(s).replace(/[&<>"']/g, c => ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c]));
}

const tbody = document.getElementById('keyTableBody');
const searchInput = document.getElementById('searchInput');
const catFilter = document.getElementById('catFilter');
const resultCount = document.getElementById('resultCount');
const liveArea = document.getElementById('liveArea');
const liveKey = document.getElementById('liveKey');
const liveCode = document.getElementById('liveCode');
const liveKeyCode = document.getElementById('liveKeyCode');
const liveLocation = document.getElementById('liveLocation');

function renderTable() {
  const q = (searchInput.value || '').trim().toLowerCase();
  const cat = catFilter.value;
  const filtered = KEYS_DATA.filter(k => {
    if (cat !== 'all' && k.category !== cat) return false;
    if (!q) return true;
    return String(k.key).toLowerCase().includes(q)
      || String(k.code).toLowerCase().includes(q)
      || String(k.keyCode).includes(q);
  });
  resultCount.textContent = \`共 \${filtered.length} 个按键（共 \${KEYS_DATA.length}）\`;
  if (!filtered.length) {
    tbody.innerHTML = '<tr><td colspan="5" style="padding:1.5rem;text-align:center;opacity:0.6;">无匹配结果</td></tr>';
    return;
  }
  // Sort by category order, then by keyCode
  const catIdx = c => CAT_ORDER.indexOf(c);
  filtered.sort((a, b) => {
    const c = catIdx(a.category) - catIdx(b.category);
    if (c !== 0) return c;
    return a.keyCode - b.keyCode;
  });
  const rows = filtered.map((k, i) => {
    const bg = i % 2 === 0 ? '' : 'background:var(--bg-secondary);';
    return \`<tr style="\${bg}">
      <td style="padding:0.55rem 0.75rem;border-bottom:1px solid var(--border);"><span style="display:inline-block;padding:0.15rem 0.5rem;background:var(--primary);color:#fff;border-radius:4px;font-size:0.78rem;">\${escapeHtml(CAT_LABEL[k.category] || k.category)}</span></td>
      <td style="padding:0.55rem 0.75rem;border-bottom:1px solid var(--border);font-family:'SF Mono',monospace;font-weight:600;">\${escapeHtml(k.key)}</td>
      <td style="padding:0.55rem 0.75rem;border-bottom:1px solid var(--border);font-family:'SF Mono',monospace;color:var(--primary);">\${escapeHtml(k.code)}</td>
      <td class="kc-cell" data-kc="\${k.keyCode}" style="padding:0.55rem 0.75rem;border-bottom:1px solid var(--border);font-family:'SF Mono',monospace;cursor:pointer;user-select:none;" title="点击复制">\${k.keyCode}</td>
      <td style="padding:0.55rem 0.75rem;border-bottom:1px solid var(--border);">
        <button class="copy-btn copy-kc" data-kc="\${k.keyCode}" style="padding:0.2rem 0.55rem;font-size:0.78rem;border:1px solid var(--border);background:var(--bg);border-radius:4px;cursor:pointer;">复制</button>
      </td>
    </tr>\`;
  }).join('');
  tbody.innerHTML = rows;
}

searchInput.addEventListener('input', renderTable);
catFilter.addEventListener('change', renderTable);

// Click-to-copy: cell and button
tbody.addEventListener('click', e => {
  let kc = null;
  const cell = e.target.closest('.kc-cell');
  const btn = e.target.closest('.copy-kc');
  if (btn) kc = btn.dataset.kc;
  else if (cell) kc = cell.dataset.kc;
  if (kc === null || kc === undefined) return;
  copyToClipboard(kc).then(() => {
    if (CT && CT.showToast) CT.showToast('已复制 keyCode: ' + kc);
  });
});

// Real-time key listener
function updateLive(e) {
  e.preventDefault();
  liveKey.textContent = e.key;
  liveCode.textContent = e.code || '-';
  liveKeyCode.textContent = e.keyCode;
  const locMap = { 0: '标准', 1: '左侧', 2: '右侧', 3: '小键盘' };
  liveLocation.textContent = locMap[e.location] !== undefined ? locMap[e.location] : e.location;
  liveArea.style.borderColor = 'var(--primary)';
  liveArea.style.background = 'var(--bg)';
  setTimeout(() => {
    liveArea.style.borderColor = '';
    liveArea.style.background = '';
  }, 150);
}

document.addEventListener('keydown', updateLive);

// Initial render
renderTable();

    `,
    'text/pinyin': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const pinyinData = {'啊':'a','阿':'a','爱':'ai','艾':'ai','安':'an','按':'an','暗':'an','奥':'ao','八':'ba','巴':'ba','把':'ba','爸':'ba','吧':'ba','白':'bai','百':'bai','拜':'bai','班':'ban','板':'ban','办':'ban','半':'ban','帮':'bang','棒':'bang','包':'bao','保':'bao','报':'bao','北':'bei','被':'bei','本':'ben','比':'bi','笔':'bi','必':'bi','闭':'bi','边':'bian','变':'bian','便':'bian','别':'bie','宾':'bin','冰':'bing','病':'bing','不':'bu','步':'bu','部':'bu','才':'cai','菜':'cai','参':'can','仓':'cang','草':'cao','层':'ceng','查':'cha','茶':'cha','差':'cha','长':'chang','常':'chang','场':'chang','唱':'chang','超':'chao','朝':'chao','车':'che','陈':'chen','成':'cheng','城':'cheng','吃':'chi','持':'chi','冲':'chong','出':'chu','除':'chu','穿':'chuan','传':'chuan','床':'chuang','春':'chun','词':'ci','此':'ci','次':'ci','从':'cong','村':'cun','错':'cuo','打':'da','大':'da','代':'dai','带':'dai','单':'dan','但':'dan','蛋':'dan','当':'dang','道':'dao','到':'dao','得':'de','德':'de','灯':'deng','等':'deng','低':'di','底':'di','地':'di','点':'dian','电':'dian','店':'dian','定':'ding','丢':'diu','东':'dong','冬':'dong','懂':'dong','动':'dong','都':'dou','豆':'dou','读':'du','独':'du','短':'duan','段':'duan','对':'dui','多':'duo','夺':'duo','朵':'duo','饿':'e','而':'er','二':'er','发':'fa','法':'fa','翻':'fan','反':'fan','饭':'fan','方':'fang','放':'fang','飞':'fei','非':'fei','费':'fei','分':'fen','份':'fen','风':'feng','否':'fou','夫':'fu','服':'fu','福':'fu','父':'fu','附':'fu','该':'gai','改':'gai','干':'gan','感':'gan','刚':'gang','高':'gao','告':'gao','哥':'ge','歌':'ge','个':'ge','给':'gei','跟':'gen','根':'gen','工':'gong','公':'gong','共':'gong','狗':'gou','够':'gou','古':'gu','故':'gu','瓜':'gua','挂':'gua','关':'guan','管':'guan','光':'guang','广':'guang','贵':'gui','国':'guo','果':'guo','过':'guo','还':'hai','孩':'hai','海':'hai','害':'hai','汉':'han','号':'hao','好':'hao','喝':'he','和':'he','何':'he','合':'he','黑':'hei','很':'hen','红':'hong','后':'hou','候':'hou','呼':'hu','湖':'hu','虎':'hu','护':'hu','化':'hua','话':'hua','画':'hua','华':'hua','划':'hua','换':'huan','黄':'huang','回':'hui','毁':'hui','会':'hui','婚':'hun','活':'huo','火':'huo','或':'huo','货':'huo','机':'ji','基':'ji','击':'ji','鸡':'ji','级':'ji','极':'ji','几':'ji','己':'ji','记':'ji','季':'ji','继':'ji','济':'ji','技':'ji','系':'ji','际':'ji','继':'ji','计':'ji','寄':'ji','加':'jia','家':'jia','价':'jia','架':'jia','假':'jia','嫁':'jia','监':'jian','减':'jian','简':'jian','见':'jian','件':'jian','建':'jian','剑':'jian','健':'jian','将':'jiang','讲':'jiang','奖':'jiang','交':'jiao','脚':'jiao','叫':'jiao','街':'jie','节':'jie','姐':'jie','解':'jie','介':'jie','界':'jie','借':'jie','金':'jin','今':'jin','进':'jin','近':'jin','尽':'jin','京':'jing','经':'jing','精':'jing','静':'jing','九':'jiu','酒':'jiu','久':'jiu','旧':'jiu','就':'jiu','举':'ju','句':'ju','巨':'ju','具':'ju','剧':'ju','距':'ju','觉':'jue','决':'jue','角':'jue','绝':'jue','军':'jun','开':'kai','看':'kan','康':'kang','考':'kao','靠':'kao','科':'ke','可':'ke','课':'ke','客':'ke','空':'kong','口':'kou','哭':'ku','苦':'ku','库':'ku','快':'kuai','块':'kuai','宽':'kuan','况':'kuang','亏':'kui','困':'kun','扩':'kuo','拉':'la','来':'lai','赖':'lai','蓝':'lan','兰':'lan','拦':'lan','懒':'lan','烂':'lan','狼':'lang','浪':'lang','老':'lao','乐':'le','累':'lei','冷':'leng','离':'li','里':'li','理':'li','力':'li','历':'li','立':'li','利':'li','连':'lian','联':'lian','练':'lian','恋':'lian','良':'liang','凉':'liang','两':'liang','亮':'liang','量':'liang','辽':'liao','了':'liao','料':'liao','列':'lie','林':'lin','临':'lin','灵':'ling','零':'ling','领':'ling','另':'ling','留':'liu','流':'liu','刘':'liu','六':'liu','龙':'long','楼':'lou','漏':'lou','路':'lu','陆':'lu','录':'lu','鹿':'lu','绿':'lu','旅':'lui','率':'lv','律':'lv','妈':'ma','吗':'ma','麻':'ma','马':'ma','吗':'ma','埋':'mai','买':'mai','卖':'mai','麦':'mai','满':'man','慢':'man','忙':'mang','猫':'mao','毛':'mao','冒':'mao','贸':'mao','么':'me','没':'mei','每':'mei','美':'mei','妹':'mei','门':'men','们':'men','梦':'meng','迷':'mi','米':'mi','密':'mi','面':'mian','民':'min','明':'ming','名':'ming','命':'ming','模':'mo','莫':'mo','母':'mu','木':'mu','目':'mu','拿':'na','哪':'na','那':'na','纳':'na','乃':'nai','奶':'nai','耐':'nai','男':'nan','南':'nan','呢':'ne','内':'nei','能':'neng','你':'ni','泥':'ni','年':'nian','念':'nian','鸟':'niao','您':'nin','宁':'ning','牛':'niu','农':'nong','女':'nv','暖':'nuan','欧':'ou','偶':'ou','怕':'pa','拍':'pai','排':'pai','派':'pai','盘':'pan','判':'pan','旁':'pang','跑':'pao','朋':'peng','皮':'pi','片':'pian','票':'piao','漂':'piao','品':'pin','平':'ping','评':'ping','破':'po','普':'pu','七':'qi','期':'qi','其':'qi','奇':'qi','骑':'qi','起':'qi','气':'qi','汽':'qi','器':'qi','千':'qian','签':'qian','前':'qian','钱':'qian','强':'qiang','墙':'qiang','桥':'qiao','巧':'qiao','青':'qing','轻':'qing','清':'qing','情':'qing','请':'qing','秋':'qiu','求':'qiu','球':'qiu','区':'qu','去':'qu','趣':'qu','全':'quan','却':'que','群':'qun','然':'ran','让':'rang','绕':'rao','热':'re','人':'ren','认':'ren','任':'ren','日':'ri','容':'rong','肉':'rou','如':'ru','软':'ruan','锐':'rui','润':'run','若':'ruo','弱':'ruo','撒':'sa','赛':'sai','三':'san','散':'san','嗓':'sang','扫':'sao','色':'se','森':'sen','沙':'sha','山':'shan','善':'shan','商':'shang','上':'shang','少':'shao','社':'she','舍':'she','深':'shen','什':'shen','生':'sheng','声':'sheng','师':'shi','十':'shi','时':'shi','实':'shi','食':'shi','使':'shi','始':'shi','世':'shi','市':'shi','事':'shi','是':'shi','室':'shi','视':'shi','试':'shi','收':'shou','手':'shou','首':'shou','受':'shou','书':'shu','树':'shu','竖':'shu','数':'shu','双':'shuang','水':'shui','睡':'shui','顺':'shun','说':'shuo','思':'si','私':'si','死':'si','四':'si','似':'si','松':'song','送':'song','诉':'su','速':'su','算':'suan','虽':'sui','随':'sui','岁':'sui','孙':'sun','所':'suo','索':'suo','他':'ta','她':'ta','它':'ta','台':'tai','太':'tai','态':'tai','谈':'tan','汤':'tang','糖':'tang','特':'te','疼':'teng','提':'ti','题':'ti','体':'ti','天':'tian','田':'tian','条':'tiao','铁':'tie','听':'ting','停':'ting','通':'tong','同':'tong','头':'tou','突':'tu','图':'tu','土':'tu','团':'tuan','推':'tui','腿':'tui','外':'wai','弯':'wan','完':'wan','玩':'wan','晚':'wan','王':'wang','往':'wang','网':'wang','忘':'wang','危':'wei','为':'wei','未':'wei','位':'wei','味':'wei','温':'wen','文':'wen','问':'wen','我':'wo','屋':'wu','无':'wu','五':'wu','午':'wu','物':'wu','务':'wu','西':'xi','希':'xi','息':'xi','悉':'xi','习':'xi','席':'xi','洗':'xi','系':'xi','戏':'xi','细':'xi','下':'xia','夏':'xia','先':'xian','现':'xian','线':'xian','相':'xiang','想':'xiang','向':'xiang','象':'xiang','像':'xiang','小':'xiao','校':'xiao','笑':'xiao','些':'xie','写':'xie','谢':'xie','新':'xin','心':'xin','信':'xin','兴':'xing','行':'xing','形':'xing','醒':'xing','姓':'xing','休':'xiu','修':'xiu','秀':'xiu','需':'xu','徐':'xu','许':'xu','续':'xu','雪':'xue','血':'xue','寻':'xun','迅':'xun','压':'ya','呀':'ya','牙':'ya','亚':'ya','言':'yan','研':'yan','眼':'yan','演':'yan','阳':'yang','养':'yang','样':'yang','腰':'yao','摇':'yao','药':'yao','要':'yao','爷':'ye','也':'ye','叶':'ye','业':'ye','夜':'ye','页':'ye','医':'yi','衣':'yi','一':'yi','以':'yi','已':'yi','义':'yi','艺':'yi','议':'yi','易':'yi','意':'yi','因':'yin','银':'yin','音':'yin','印':'yin','英':'ying','应':'ying','影':'ying','用':'yong','永':'yong','涌':'yong','勇':'yong','优':'you','由':'you','油':'you','游':'you','友':'you','有':'you','又':'you','右':'you','幼':'you','于':'yu','与':'yu','雨':'yu','语':'yu','元':'yuan','园':'yuan','原':'yuan','圆':'yuan','院':'yuan','远':'yuan','愿':'yuan','月':'yue','越':'yue','云':'yun','运':'yun','在':'zai','再':'zai','早':'zao','造':'zao','怎':'zen','增':'zeng','扎':'zha','眨':'zha','诈':'zha','宅':'zhai','债':'zhai','占':'zhan','站':'zhan','张':'zhang','找':'zhao','照':'zhao','者':'zhe','这':'zhe','真':'zhen','政':'zheng','正':'zheng','知':'zhi','之':'zhi','只':'zhi','织':'zhi','直':'zhi','职':'zhi','植':'zhi','止':'zhi','至':'zhi','治':'zhi','中':'zhong','钟':'zhong','终':'zhong','种':'zhong','重':'zhong','周':'zhou','洲':'zhou','主':'zhu','住':'zhu','注':'zhu','著':'zhu','祝':'zhu','抓':'zhua','专':'zhuan','转':'zhuan','装':'zhuang','准':'zhun','子':'zi','自':'zi','字':'zi','资':'zi','宗':'zong','走':'zou','租':'zu','足':'zu','组':'zu','最':'zui','罪':'zui','尊':'zun','左':'zuo','作':'zuo','做':'zuo','坐':'zuo','座':'zuo'};
      function toPinyin(chars) {
        return chars.split('').map(c => pinyinData[c] || c).join(' ');
      }
      input.addEventListener('input', () => { output.value = toPinyin(input.value); });
      output.value = toPinyin(input.value);
    `,

    'text/extract': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function extract() {
        const text = input.value;
        const emails = text.match(/[\\w.-]+@[\\w.-]+\\.\\w+/g) || [];
        const phones = text.match(/1[3-9]\\d{9}/g) || [];
        const urls = text.match(/https?:\/\/[^\s]+/g) || [];
        output.innerHTML = '<b>邮箱:</b> ' + (emails.length ? emails.join(', ') : '无') + '<br><b>手机:</b> ' + (phones.length ? phones.join(', ') : '无') + '<br><b>链接:</b> ' + (urls.length ? urls.join('<br>') : '无');
      }
      input.addEventListener('input', extract);
    `,

    'life/price-compare': `
      const container = document.getElementById('products');
      const unitOptions = ['斤','公斤','克','升','毫升','个','件','包','瓶','罐','盒','米','平方米'].map(u => '<option value="'+u+'">'+u+'</option>').join('');
      let nextId = 0;

      function createRow(name, spec, unit, price) {
        const id = nextId++;
        const div = document.createElement('div');
        div.className = 'product-row';
        div.dataset.id = id;
        div.innerHTML = '<div class="product-meta"><input type="text" class="p-name" placeholder="商品名称（选填）" value="'+ (name||'') +'"><button class="btn-remove" title="移除">×</button></div><div class="product-fields"><div class="field-group"><label>规格数量</label><input type="number" class="p-spec" placeholder="如 500" min="0" step="any" value="'+ (spec||'') +'"></div><div class="field-group"><label>规格单位</label><select class="p-unit">'+ unitOptions.replace('value="'+ (unit||'斤') +'"','value="'+ (unit||'斤') +'" selected') +'</select></div><div class="field-group"><label>价格（元）</label><input type="number" class="p-price" placeholder="如 9.9" min="0" step="any" value="'+ (price||'') +'"></div></div><div class="product-result"><span class="unit-price">—</span></div>';
        div.querySelector('.p-spec').addEventListener('input', calc);
        div.querySelector('.p-price').addEventListener('input', calc);
        div.querySelector('.p-unit').addEventListener('change', calc);
        div.querySelector('.btn-remove').addEventListener('click', () => { div.remove(); calc(); });
        return div;
      }

      function calc() {
        let best = null;
        document.querySelectorAll('.product-row').forEach(row => {
          row.classList.remove('winner');
          const price = parseFloat(row.querySelector('.p-price').value);
          const spec = parseFloat(row.querySelector('.p-spec').value);
          const unit = row.querySelector('.p-unit').value;
          const upEl = row.querySelector('.unit-price');
          if (price > 0 && spec > 0) {
            const up = price / spec;
            upEl.textContent = up.toFixed(3) + ' 元/' + unit;
            if (!best || up < best.up) best = { row, up };
          } else {
            upEl.textContent = '—';
          }
        });
        document.querySelectorAll('.product-row').forEach(row => row.classList.remove('winner'));
        if (best) { best.row.classList.add('winner'); best.row.querySelector('.unit-price').textContent += ' 🏆'; }
      }

      document.getElementById('addProduct').addEventListener('click', () => {
        container.appendChild(createRow());
      });

      container.appendChild(createRow());
      container.appendChild(createRow());
    `,

    'text/garble-fix': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');

      function setOutput(text) { output.value = text; }

      // UTF-8 bytes decoded as Latin1/GBK → proper UTF-8
      function fixUtf8AsGbk() {
        const bytes = new Uint8Array([...input.value].map(c => c.charCodeAt(0) & 0xFF));
        const decoder = new TextDecoder('utf-8', { fatal: false });
        setOutput(decoder.decode(bytes));
      }

      // GBK bytes decoded as UTF-8 → proper GBK → UTF-8
      function fixGbkAsUtf8() {
        try {
          const bytes = new Uint8Array([...input.value].map(c => c.charCodeAt(0) & 0xFF));
          const gbkStr = new TextDecoder('gbk', { fatal: false }).decode(bytes);
          setOutput(gbkStr);
        } catch(e) { setOutput('修复失败: ' + e.message); }
      }

      // Unicode escape sequences: \\u4e2d → 中
      function fixUnicodeEscapes() {
        setOutput(input.value.replace(/\\\\u([0-9a-fA-F]{4})/g, (_, hex) => String.fromCharCode(parseInt(hex, 16))));
      }

      // HTML entities: &#x4e2d; → 中, &#123; → {, &amp; → &
      function fixHtmlEntities() {
        const textarea = input;
        const div = document.createElement('div');
        div.innerHTML = textarea.value;
        setOutput(div.textContent || div.innerText || textarea.value);
      }

      // URL encoding: %E4%B8%AD → 中
      function fixUrlEncoding() {
        try { setOutput(decodeURIComponent(input.value)); }
        catch(e) { try { setOutput(decodeURI(input.value)); } catch(e2) { setOutput('解码失败'); } }
      }

      // Auto-detect and fix
      function autoFix() {
        const v = input.value;
        if (/%[0-9A-Fa-f]{2}/.test(v)) { fixUrlEncoding(); return; }
        if (/\\\\u[0-9a-fA-F]{4}/i.test(v)) { fixUnicodeEscapes(); return; }
        if (/&#[0-9]+;|&#[x][0-9a-fA-F]+;|&[a-z]+;/i.test(v)) { fixHtmlEntities(); return; }
        // Try UTF-8 as GBK
        const bytes = new Uint8Array([...v].map(c => c.charCodeAt(0) & 0xFF));
        const decoded = new TextDecoder('utf-8', { fatal: false }).decode(bytes);
        if (decoded !== v && /[\\u4e00-\\u9fa5]/.test(decoded)) { setOutput(decoded); return; }
        // Try GBK as UTF-8
        try {
          const gbkStr = new TextDecoder('gbk', { fatal: false }).decode(bytes);
          if (gbkStr !== v) { setOutput(gbkStr); return; }
        } catch(e) {}
        setOutput(v);
      }

      document.getElementById('autoFix').onclick = autoFix;
      document.getElementById('fixUtf8AsGbk').onclick = fixUtf8AsGbk;
      document.getElementById('fixGbkAsUtf8').onclick = fixGbkAsUtf8;
      document.getElementById('fixUnicodeEscapes').onclick = fixUnicodeEscapes;
      document.getElementById('fixHtmlEntities').onclick = fixHtmlEntities;
      document.getElementById('fixUrlEncoding').onclick = fixUrlEncoding;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', () => { if (document.getElementById('autoOn').checked) autoFix(); });
    `,

    'life/insurance': `
      const salaryInput = document.getElementById('salary');
      const resultDiv = document.getElementById('result');
      const CAP = 36549;
      const items = [
        { name: '养老保险', personal: 8, unit: 16 },
        { name: '医疗保险', personal: 2, unit: 10 },
        { name: '失业保险', personal: 0.5, unit: 0.5 },
        { name: '工伤保险', personal: 0, unit: 0.16 },
        { name: '生育保险', personal: 0, unit: 1 },
        { name: '住房公积金', personal: 7, unit: 7 }
      ];
      function calc() {
        const salary = parseFloat(salaryInput.value) || 0;
        const base = Math.min(salary, CAP);
        let personalTotal = 0;
        let unitTotal = 0;
        const rows = items.map(item => {
          const pAmt = base * (item.personal / 100);
          const uAmt = base * (item.unit / 100);
          personalTotal += pAmt;
          unitTotal += uAmt;
          const exceeded = salary > CAP;
          return '<tr><td>' + item.name + '</td><td>' + item.personal + '%</td><td style="text-align:right;">' + (exceeded ? '<span style="opacity:0.5;">(超上限)</span> ' : '') + '¥' + pAmt.toFixed(2) + '</td><td style="text-align:right;">¥' + uAmt.toFixed(2) + '</td></tr>';
        }).join('');
        const afterTax = salary - personalTotal;
        resultDiv.innerHTML = '<table class="ins-table"><thead><tr><th>项目</th><th>个人缴纳比例</th><th>个人金额</th><th>单位金额</th></tr></thead><tbody>' + rows + '</tbody></table><div class="ins-summary"><div class="ins-item"><span>税前工资</span><b>¥' + salary.toFixed(2) + '</b></div><div class="ins-item"><span>个人总扣除</span><b style="color:#e74c3c;">-¥' + personalTotal.toFixed(2) + '</b></div><div class="ins-item highlight"><span>税后工资</span><b>¥' + afterTax.toFixed(2) + '</b></div></div>';
      }
      salaryInput.addEventListener('input', calc);
    `,

    'life/salary': `
      const salaryInput = document.getElementById('salary');
      const useMinBase = document.getElementById('useMinBase');
      const resultDiv = document.getElementById('result');
      const MIN_BASE = 7310;
      const CAP = 36549;
      const items = [
        { name: '养老保险', personal: 8, unit: 16 },
        { name: '医疗保险', personal: 2, unit: 10 },
        { name: '失业保险', personal: 0.5, unit: 0.5 },
        { name: '工伤保险', personal: 0, unit: 0.16 },
        { name: '生育保险', personal: 0, unit: 1 },
        { name: '住房公积金', personal: 7, unit: 7 }
      ];
      const taxBrackets = [
        { upper: 36000, rate: 0.03, deduction: 0 },
        { upper: 144000, rate: 0.10, deduction: 2520 },
        { upper: 300000, rate: 0.20, deduction: 16920 },
        { upper: 420000, rate: 0.25, deduction: 31920 },
        { upper: 660000, rate: 0.30, deduction: 52920 },
        { upper: 960000, rate: 0.35, deduction: 85920 },
        { upper: Infinity, rate: 0.45, deduction: 319920 }
      ];
      function calcTax(taxable) {
        if (taxable <= 0) return 0;
        const bracket = taxBrackets.find(b => taxable <= b.upper);
        return taxable * bracket.rate - bracket.deduction;
      }
      function calc() {
        const salary = parseFloat(salaryInput.value) || 0;
        const base = useMinBase.checked ? MIN_BASE : Math.min(salary, CAP);
        const baseNote = useMinBase.checked ? '(按最低基数 ' + MIN_BASE + ')' : (salary > CAP ? '(已达上限)' : '');
        let insTotal = 0;
        const insRows = items.map(item => {
          const amt = base * (item.personal / 100);
          insTotal += amt;
          return '<tr><td>' + item.name + '</td><td style="text-align:center;">' + item.personal + '%</td><td style="text-align:right;">¥' + amt.toFixed(2) + '</td></tr>';
        }).join('');
        const taxable = salary - insTotal - 5000;
        const tax = calcTax(taxable);
        const afterTax = salary - insTotal - tax;
        resultDiv.innerHTML = '<table class="sal-table"><thead><tr><th>项目</th><th>比例</th><th>金额</th></tr></thead><tbody>' + insRows + '</tbody></table>' +
          '<div class="sal-summary"><div class="sal-row"><span>税前工资</span><b>¥' + salary.toFixed(2) + '</b></div>' +
          '<div class="sal-row"><span>五险一金扣除 <span class="sal-note">' + baseNote + '</span></span><b class="red">-¥' + insTotal.toFixed(2) + '</b></div>' +
          '<div class="sal-row"><span>应纳税所得额 <span class="sal-note">(减5000起征点)</span></span><b>¥' + Math.max(taxable, 0).toFixed(2) + '</b></div>' +
          '<div class="sal-row"><span>个人所得税</span><b class="red">-¥' + tax.toFixed(2) + '</b></div>' +
          '<div class="sal-row highlight"><span>实发工资</span><b class="green">¥' + afterTax.toFixed(2) + '</b></div></div>';
      }
      salaryInput.addEventListener('input', calc);
      useMinBase.addEventListener('change', calc);
    `,

    'life/zen-canvas': `
      const canvas = document.getElementById('zenCanvas');
      const ctx = canvas.getContext('2d');
      const soundBtns = document.querySelectorAll('.sound-btn');
      const textInput = document.getElementById('textInput');
      let particles = [];
      let hue = 200;
      let animId;
      let audioCtx = null;
      let currentSound = null;
      let idleTimer = null;
      let lastActivity = 0;

      function resize() {
        canvas.width = canvas.offsetWidth;
        canvas.height = canvas.offsetHeight;
      }
      resize();
      window.addEventListener('resize', resize);

      function createParticle(x, y, vx, vy, color, size) {
        particles.push({ x, y, vx, vy, color, size, alpha: 1, life: 1 });
      }

      function drawParticle(p) {
        ctx.save();
        ctx.globalAlpha = p.alpha * p.life;
        ctx.fillStyle = p.color;
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.size * p.life, 0, Math.PI * 2);
        ctx.fill();
        ctx.restore();
      }

      function animate() {
        ctx.fillStyle = 'rgba(10,10,20,0.15)';
        ctx.fillRect(0, 0, canvas.width, canvas.height);
        hue = (hue + 0.2) % 360;
        particles.forEach((p, i) => {
          p.x += p.vx;
          p.y += p.vy;
          p.vy += 0.05;
          p.life -= 0.003;
          p.alpha *= 0.99;
          if (p.life <= 0) { particles.splice(i, 1); return; }
          drawParticle(p);
        });
        animId = requestAnimationFrame(animate);
      }
      animate();

      function burst(x, y, count = 20) {
        for (let i = 0; i < count; i++) {
          const angle = Math.random() * Math.PI * 2;
          const speed = Math.random() * 3 + 1;
          const color = 'hsl(' + (hue + Math.random() * 40 - 20) + ',70%,60%)';
          createParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed - 1, color, Math.random() * 4 + 2);
        }
      }

      canvas.addEventListener('mousemove', (e) => {
        const rect = canvas.getBoundingClientRect();
        const x = e.clientX - rect.left;
        const y = e.clientY - rect.top;
        if (Math.random() > 0.7) burst(x, y, 3);
        resetIdle();
      });

      canvas.addEventListener('click', (e) => {
        const rect = canvas.getBoundingClientRect();
        burst(e.clientX - rect.left, e.clientY - rect.top, 30);
      });

      textInput.addEventListener('input', (e) => {
        const chars = e.target.value.split('');
        chars.forEach(char => {
          const x = Math.random() * canvas.width;
          const y = Math.random() * canvas.height;
          const color = 'hsl(' + (hue + Math.random() * 60) + ',80%,65%)';
          for (let i = 0; i < 5; i++) {
            const angle = Math.random() * Math.PI * 2;
            const speed = Math.random() * 2 + 0.5;
            createParticle(x, y, Math.cos(angle) * speed, Math.sin(angle) * speed, color, Math.random() * 3 + 1);
          }
        });
        if (e.target.value.length > 0) resetIdle();
      });

      function resetIdle() {
        lastActivity = Date.now();
        if (idleTimer) clearTimeout(idleTimer);
        idleTimer = setTimeout(stopSound, 5000);
      }

      // Web Audio API sounds
      function initAudio() {
        if (!audioCtx) audioCtx = new (window.AudioContext || window.webkitAudioContext)();
      }

      function createNoise(type) {
        initAudio();
        if (currentSound) { currentSound.forEach(n => { try { n.stop(); } catch(e){} }); currentSound = null; }
        const nodes = [];
        const bufferSize = 2 * audioCtx.sampleRate;
        const noiseBuffer = audioCtx.createBuffer(1, bufferSize, audioCtx.sampleRate);
        const output = noiseBuffer.getChannelData(0);
        for (let i = 0; i < bufferSize; i++) output[i] = Math.random() * 2 - 1;

        if (type === 'rain') {
          const src = audioCtx.createBufferSource();
          src.buffer = noiseBuffer; src.loop = true;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = 400;
          const gain = audioCtx.createGain(); gain.gain.value = 0.15;
          src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
          src.start(); nodes.push(src);
        } else if (type === 'campfire') {
          const src = audioCtx.createBufferSource();
          src.buffer = noiseBuffer; src.loop = true;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'bandpass'; filter.frequency.value = 200; filter.Q.value = 0.5;
          const gain = audioCtx.createGain(); gain.gain.value = 0.1;
          src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
          src.start(); nodes.push(src);
        } else if (type === 'ocean') {
          const src = audioCtx.createBufferSource();
          src.buffer = noiseBuffer; src.loop = true;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'lowpass'; filter.frequency.value = 300;
          const gain = audioCtx.createGain();
          gain.gain.setValueAtTime(0.1, audioCtx.currentTime);
          gain.gain.linearRampToValueAtTime(0.2, audioCtx.currentTime + 3);
          gain.gain.linearRampToValueAtTime(0.05, audioCtx.currentTime + 6);
          src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
          src.start(); nodes.push(src);
        } else if (type === 'forest') {
          const src = audioCtx.createBufferSource();
          src.buffer = noiseBuffer; src.loop = true;
          const filter = audioCtx.createBiquadFilter();
          filter.type = 'highpass'; filter.frequency.value = 2000;
          const gain = audioCtx.createGain(); gain.gain.value = 0.05;
          src.connect(filter); filter.connect(gain); gain.connect(audioCtx.destination);
          src.start(); nodes.push(src);
        }
        currentSound = nodes;
      }

      function stopSound() {
        if (currentSound) {
          currentSound.forEach(n => { try { n.stop(); } catch(e){} });
          currentSound = null;
        }
      }

      soundBtns.forEach(btn => {
        btn.addEventListener('click', () => {
          const sound = btn.dataset.sound;
          document.querySelectorAll('.sound-btn').forEach(b => b.classList.remove('active'));
          if (currentSound && btn.classList.contains('active')) {
            stopSound(); btn.classList.remove('active');
          } else {
            createNoise(sound); btn.classList.add('active');
          }
          resetIdle();
        });
      });

      document.getElementById('exportBtn').addEventListener('click', () => {
        const link = document.createElement('a');
        link.download = 'zen-canvas.png';
        link.href = canvas.toDataURL('image/png');
        link.click();
      });
    `,

    'life/grid-splitter': `
      const imageInput = document.getElementById('imageInput');
      const uploadArea = document.getElementById('uploadArea');
      const previewImg = document.getElementById('previewImg');
      const imagePreviewContainer = document.getElementById('imagePreviewContainer');
      const splitBtn = document.getElementById('splitBtn');
      const resultCard = document.getElementById('resultCard');
      const gridResult = document.getElementById('gridResult');
      let currentFile = null;
      uploadArea.addEventListener('click', () => imageInput.click());
      uploadArea.addEventListener('dragover', (e) => { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });
      uploadArea.addEventListener('dragleave', () => { uploadArea.style.borderColor = 'var(--border)'; });
      uploadArea.addEventListener('drop', (e) => {
        e.preventDefault();
        uploadArea.style.borderColor = 'var(--border)';
        const file = e.dataTransfer.files[0];
        if (file && file.type.startsWith('image/')) loadImage(file);
      });
      imageInput.addEventListener('change', () => { if (imageInput.files[0]) loadImage(imageInput.files[0]); });
      function loadImage(file) {
        currentFile = file;
        const reader = new FileReader();
        reader.onload = (e) => {
          previewImg.src = e.target.result;
          imagePreviewContainer.style.display = 'block';
          resultCard.style.display = 'none';
          gridResult.innerHTML = '';
        };
        reader.readAsDataURL(file);
      }
      splitBtn.addEventListener('click', () => {
        if (!previewImg.src || previewImg.src === window.location.href) { alert('请先上传图片'); return; }
        const img = new Image();
        img.onload = () => {
          const cols = 3, rows = 3;
          const w = img.width / cols, h = img.height / rows;
          gridResult.innerHTML = '';
          for (let r = 0; r < rows; r++) {
            for (let c = 0; c < cols; c++) {
              const canvas = document.createElement('canvas');
              canvas.width = w; canvas.height = h;
              const ctx = canvas.getContext('2d');
              ctx.drawImage(img, c * w, r * h, w, h, 0, 0, w, h);
              const cell = document.createElement('div');
              cell.style.cssText = 'position:relative;cursor:pointer;';
              const imgEl = document.createElement('img');
              imgEl.src = canvas.toDataURL('image/jpeg', 0.9);
              imgEl.style.cssText = 'width:100%;display:block;border-radius:4px;';
              const badge = document.createElement('div');
              badge.style.cssText = 'position:absolute;bottom:4px;right:4px;background:rgba(0,0,0,0.5);color:#fff;font-size:0.7rem;padding:2px 5px;border-radius:4px;';
              badge.textContent = (r * cols + c + 1);
              cell.appendChild(imgEl);
              cell.appendChild(badge);
              cell.addEventListener('click', () => {
                const a = document.createElement('a');
                a.download = 'grid_' + (r * cols + c + 1) + '.jpg';
                a.href = canvas.toDataURL('image/jpeg', 0.9);
                a.click();
              });
              gridResult.appendChild(cell);
            }
          }
          resultCard.style.display = 'block';
        };
        img.src = previewImg.src;
      });
      document.getElementById('downloadAllBtn').addEventListener('click', () => {
        const cells = gridResult.querySelectorAll('canvas, img');
        cells.forEach((el, i) => {
          if (el.tagName === 'IMG') {
            const a = document.createElement('a');
            a.download = 'grid_' + (i + 1) + '.jpg';
            a.href = el.src;
            a.click();
          }
        });
      });
    `,
    'life/time-annotate': `
      let mode = 'stopwatch';
      let timerInterval = null;
      let startTime = 0;
      let pausedTime = 0;
      let isRunning = false;
      let pomodoroState = 'work';
      let pomodoroTimer = null;
      let pomodoroRemaining = 0;
      let timeline = [];
      const display = document.getElementById('timerDisplay');
      const label = document.getElementById('timerLabel');
      const startBtn = document.getElementById('startBtn');
      const pauseBtn = document.getElementById('pauseBtn');
      const resetBtn = document.getElementById('resetBtn');
      const annotateBtn = document.getElementById('annotateBtn');
      const modeStopwatch = document.getElementById('modeStopwatch');
      const modePomodoro = document.getElementById('modePomodoro');
      const pomodoroSettings = document.getElementById('pomodoroSettings');
      const pomodoroStatus = document.getElementById('pomodoroStatus');
      const annotationInput = document.getElementById('annotationInput');
      const annotationText = document.getElementById('annotationText');
      const saveAnnotationBtn = document.getElementById('saveAnnotationBtn');
      const timelineEl = document.getElementById('timeline');
      const timelineEmpty = document.getElementById('timelineEmpty');
      const timelineStats = document.getElementById('timelineStats');
      const clearTimelineBtn = document.getElementById('clearTimelineBtn');

      function formatTime(ms) {
        const s = Math.floor(ms / 1000) % 60;
        const m = Math.floor(ms / 60000) % 60;
        const h = Math.floor(ms / 3600000);
        return String(h).padStart(2,'0') + ':' + String(m).padStart(2,'0') + ':' + String(s).padStart(2,'0');
      }
      function updateDisplay() { display.textContent = formatTime(pausedTime); }
      function startTimer() {
        if (isRunning) return;
        isRunning = true;
        startTime = Date.now() - pausedTime;
        timerInterval = setInterval(() => {
          pausedTime = Date.now() - startTime;
          updateDisplay();
        }, 100);
      }
      function pauseTimer() {
        if (!isRunning) return;
        isRunning = false;
        clearInterval(timerInterval);
        pausedTime = Date.now() - startTime;
      }
      function resetTimer() {
        isRunning = false;
        clearInterval(timerInterval);
        clearInterval(pomodoroTimer);
        pausedTime = 0;
        pomodoroState = 'work';
        pomodoroRemaining = 0;
        updateDisplay();
        if (mode === 'pomodoro') { pomodoroStatus.textContent = ''; label.textContent = '番茄钟'; }
      }
      function addAnnotation(text) {
        const entry = { time: pausedTime, text: text || '', ts: new Date().toLocaleTimeString('zh-CN') };
        timeline.unshift(entry);
        renderTimeline();
      }
      function renderTimeline() {
        if (timeline.length === 0) {
          timelineEmpty.style.display = 'block';
          timelineStats.style.display = 'none';
          timelineEl.innerHTML = '';
          timelineEl.appendChild(timelineEmpty);
          return;
        }
        timelineEmpty.style.display = 'none';
        timelineStats.style.display = 'block';
        const totalMs = timeline[0] ? timeline[0].time : 0;
        document.getElementById('statCount').textContent = timeline.length;
        document.getElementById('statTotal').textContent = formatTime(totalMs);
        const avg = timeline.length > 1 ? Math.round(totalMs / (timeline.length - 1) / 1000) + 's' : '—';
        document.getElementById('statInterval').textContent = avg;
        let html = '<div style="display:flex;flex-direction:column;gap:0.5rem;">';
        timeline.forEach((entry) => {
          const tag = entry.text ? '<span style="background:var(--primary);color:#fff;font-size:0.7rem;padding:2px 7px;border-radius:10px;margin-left:0.3rem;">' + entry.text + '</span>' : '';
          html += '<div style="display:flex;align-items:center;padding:0.4rem 0.6rem;background:var(--bg-secondary);border-radius:8px;font-size:0.85rem;"><span style="opacity:0.5;margin-right:0.5rem;">' + entry.ts + '</span><span style="font-weight:600;font-family:monospace;">' + formatTime(entry.time) + '</span>' + tag + '</div>';
        });
        html += '</div>';
        timelineEl.innerHTML = html;
      }
      function startPomodoro() {
        const workMin = parseInt(document.getElementById('workDuration').value) || 25;
        const breakMin = parseInt(document.getElementById('breakDuration').value) || 5;
        pomodoroState = 'work';
        pomodoroRemaining = workMin * 60000;
        label.textContent = '🍅 工作时间';
        pomodoroStatus.textContent = '第 1 个番茄';
        clearInterval(pomodoroTimer);
        pomodoroTimer = setInterval(() => {
          pomodoroRemaining -= 1000;
          const mins = Math.floor(pomodoroRemaining / 60000);
          const secs = Math.floor(pomodoroRemaining % 60000 / 1000);
          display.textContent = String(mins).padStart(2,'0') + ':' + String(secs).padStart(2,'0');
          if (pomodoroRemaining <= 0) {
            if (pomodoroState === 'work') {
              pomodoroState = 'break';
              pomodoroRemaining = breakMin * 60000;
              label.textContent = '☕ 休息时间';
              pomodoroStatus.textContent = '工作完成！休息一下';
              addAnnotation('🍅 番茄完成');
            } else {
              pomodoroState = 'work';
              pomodoroRemaining = workMin * 60000;
              label.textContent = '🍅 工作时间';
              pomodoroStatus.textContent = '休息结束，继续加油';
              addAnnotation('☕ 休息结束');
            }
          }
        }, 1000);
      }
      modeStopwatch.addEventListener('click', () => {
        mode = 'stopwatch'; resetTimer();
        modeStopwatch.className = 'btn btn-primary'; modePomodoro.className = 'btn btn-secondary';
        pomodoroSettings.style.display = 'none'; annotationInput.style.display = 'none'; annotateBtn.style.display = 'none';
        label.textContent = '专注计时'; display.textContent = '00:00:00';
      });
      modePomodoro.addEventListener('click', () => {
        mode = 'pomodoro'; resetTimer();
        modePomodoro.className = 'btn btn-primary'; modeStopwatch.className = 'btn btn-secondary';
        pomodoroSettings.style.display = 'block'; annotationInput.style.display = 'block'; annotateBtn.style.display = 'inline-block';
        display.textContent = '25:00'; label.textContent = '🍅 番茄钟';
      });
      startBtn.addEventListener('click', () => { if (mode === 'stopwatch') startTimer(); else startPomodoro(); });
      pauseBtn.addEventListener('click', () => { if (mode === 'stopwatch') pauseTimer(); else { clearInterval(pomodoroTimer); } });
      resetBtn.addEventListener('click', resetTimer);
      annotateBtn.addEventListener('click', () => { addAnnotation(''); });
      saveAnnotationBtn.addEventListener('click', () => { addAnnotation(annotationText.value); annotationText.value = ''; });
      clearTimelineBtn.addEventListener('click', () => { timeline = []; renderTimeline(); });
    `,

    'math/prime-check': `
      const inputNum = document.getElementById('inputNum');
      const output = document.getElementById('output');
      function isPrime(n) {
        if (n < 2) return false;
        if (n === 2) return true;
        if (n % 2 === 0) return false;
        for (let i = 3; i <= Math.sqrt(n); i += 2) {
          if (n % i === 0) return false;
        }
        return true;
      }
      function check() {
        const v = parseInt(inputNum.value);
        if (isNaN(v)) { output.textContent = '请输入有效整数'; output.style.color = 'var(--text)'; return; }
        if (v < 0) { output.textContent = '请输入非负整数'; output.style.color = 'var(--text)'; return; }
        const result = isPrime(v);
        output.textContent = result ? '是质数' + ' ' + String.fromCodePoint(0x2713) : '不是质数' + ' ' + String.fromCodePoint(0x2717);
        output.style.color = result ? '#22c55e' : '#ef4444';
      }
      inputNum.addEventListener('input', check);
      document.getElementById('checkBtn').addEventListener('click', check);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,

    'math/factorial': `
      const inputNum = document.getElementById('inputNum');
      const output = document.getElementById('output');
      function factorial(n) {
        if (n < 0) throw new Error('负数没有阶乘');
        if (n === 0 || n === 1) return BigInt(1);
        let result = BigInt(1);
        for (let i = BigInt(2); i <= BigInt(n); i++) result *= i;
        return result;
      }
      function calc() {
        const v = parseInt(inputNum.value);
        if (isNaN(v)) { output.value = '请输入有效整数'; return; }
        if (v < 0) { output.value = '负数没有阶乘'; return; }
        if (v > 10000) { output.value = '数值太大，请输入 <= 10000 的数'; return; }
        output.value = factorial(v).toString();
      }
      inputNum.addEventListener('input', calc);
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.value));
    `,

    'math/gcd': `
      const inputA = document.getElementById('inputA');
      const inputB = document.getElementById('inputB');
      const output = document.getElementById('output');
      const steps = document.getElementById('steps');
      function gcd(a, b) {
        const stepsArr = [];
        a = Math.abs(a); b = Math.abs(b);
        while (b !== 0) {
          stepsArr.push(a + ' % ' + b + ' = ' + (a % b));
          const t = b;
          b = a % b;
          a = t;
        }
        steps.textContent = '计算步骤: ' + stepsArr.join(' -> ');
        return a;
      }
      function calc() {
        const a = parseInt(inputA.value);
        const b = parseInt(inputB.value);
        if (isNaN(a) || isNaN(b)) { output.textContent = '请输入有效整数'; return; }
        output.textContent = 'GCD(' + a + ', ' + b + ') = ' + gcd(a, b);
      }
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,

    'math/random-gen': `
      const minInput = document.getElementById('minInput');
      const maxInput = document.getElementById('maxInput');
      const countInput = document.getElementById('countInput');
      const uniqueCheck = document.getElementById('uniqueCheck');
      const sortCheck = document.getElementById('sortCheck');
      const output = document.getElementById('output');
      function gen() {
        const min = parseInt(minInput.value) || 0;
        const max = parseInt(maxInput.value) || 100;
        const count = Math.min(Math.max(parseInt(countInput.value) || 10, 1), 1000);
        const isUnique = uniqueCheck.checked;
        let nums = [];
        if (isUnique && count > max - min + 1) {
          output.value = '范围不足以生成不重复数字';
          return;
        }
        if (isUnique) {
          const pool = [];
          for (let i = min; i <= max; i++) pool.push(i);
          for (let i = 0; i < count; i++) {
            const idx = Math.floor(Math.random() * pool.length);
            nums.push(pool.splice(idx, 1)[0]);
          }
        } else {
          for (let i = 0; i < count; i++) nums.push(Math.floor(Math.random() * (max - min + 1)) + min);
        }
        if (sortCheck.checked) nums.sort((a, b) => a - b);
        output.value = nums.join(', ');
      }
      document.getElementById('genBtn').addEventListener('click', gen);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.value));
      gen();
    `,

    'network/cron-gen': `
      const cronExpr = document.getElementById('cronExpr');
      const nextRuns = document.getElementById('nextRuns');
      const selects = {
        min: document.getElementById('cronMin'),
        hour: document.getElementById('cronHour'),
        dom: document.getElementById('cronDom'),
        mon: document.getElementById('cronMon'),
        dow: document.getElementById('cronDow'),
      };
      function buildExpr() {
        const min = selects.min.value;
        const hour = selects.hour.value;
        const dom = selects.dom.value;
        const mon = selects.mon.value;
        const dow = selects.dow.value;
        cronExpr.value = min + ' ' + hour + ' ' + dom + ' ' + mon + ' ' + dow;
        updateNextRuns();
      }
      function parseField(field, max) {
        if (field === '*') return Array.from({length: max}, (_, i) => i);
        const result = new Set();
        field.split(',').forEach(part => {
          if (part.includes('/')) {
            const [range, step] = part.split('/');
            const start = range === '*' ? 0 : parseInt(range);
            const stepNum = parseInt(step);
            for (let i = start; i < max; i += stepNum) result.add(i);
          } else if (part.includes('-')) {
            const [s, e] = part.split('-').map(Number);
            for (let i = s; i <= e; i++) result.add(i);
          } else {
            result.add(parseInt(part));
          }
        });
        return [...result].sort((a, b) => a - b);
      }
      function getNextMatches(expr) {
        const parts = expr.trim().split(/\\s+/);
        const [minField, hourField, domField, monField, dowField] = parts;
        const mins = parseField(minField, 60);
        const hours = parseField(hourField, 24);
        const doms = parseField(domField, 32);
        const mons = parseField(monField, 13);
        const dows = parseField(dowField, 7);
        const results = [];
        let d = new Date();
        d.setSeconds(0); d.setMilliseconds(0);
        d.setMinutes(d.getMinutes() + 1);
        for (let i = 0; i < 1440 && results.length < 5; i++) {
          const m = d.getMonth() + 1;
          const dom = d.getDate();
          const dow = d.getDay();
          if (mons.includes(m) && doms.includes(dom) && dows.includes(dow)) {
            const h = d.getHours();
            const min = d.getMinutes();
            if (hours.includes(h) && mins.includes(min)) {
              results.push(d.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hour12:false}));
            }
          }
          d.setMinutes(d.getMinutes() + 1);
        }
        return results;
      }
      function updateNextRuns() {
        const runs = getNextMatches(cronExpr.value);
        nextRuns.textContent = runs.length ? runs.join(' | ') : '无匹配时间';
      }
      Object.values(selects).forEach(sel => sel.addEventListener('change', buildExpr));
      document.getElementById('copyExpr').addEventListener('click', () => { copyToClipboard(cronExpr.value); CT.showToast('已复制!'); });
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(cronExpr.value));
      document.getElementById('resetCron').addEventListener('click', () => {
        Object.values(selects).forEach(s => s.value = '*');
        buildExpr();
      });
      buildExpr();
    `,

    'code/regex-tester': `
      const regexInput = document.getElementById('regexInput');
      const testText = document.getElementById('testText');
      const output = document.getElementById('output');
      const matchInfo = document.getElementById('matchInfo');
      const flagG = document.getElementById('flagG');
      const flagI = document.getElementById('flagI');
      const flagM = document.getElementById('flagM');
      function escapeHtml(str) {
        return str.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
      }
      function run() {
        const pattern = regexInput.value;
        const text = testText.value;
        if (!pattern || !text) { output.innerHTML = ''; matchInfo.textContent = ''; return; }
        let flags = '';
        if (flagG.checked) flags += 'g';
        if (flagI.checked) flags += 'i';
        if (flagM.checked) flags += 'm';
        try {
          const regex = new RegExp(pattern, flags);
          const highlighted = text.replace(regex, m => '<mark style="background:#fbbf24;padding:0 2px;border-radius:2px;color:inherit;">' + escapeHtml(m) + '</mark>');
          output.innerHTML = highlighted;
          let count = 0;
          let match;
          const re = new RegExp(regex.source, flags.includes('g') ? flags : flags + 'g');
          const matches = [];
          while ((match = re.exec(text)) !== null) { count++; matches.push(match[0]); if (count > 100) break; }
          matchInfo.textContent = '匹配 ' + count + ' 个: ' + matches.slice(0, 5).join(', ') + (count > 5 ? '...' : '');
        } catch(e) {
          output.innerHTML = '<span style="color:#ef4444;">正则错误: ' + e.message + '</span>';
          matchInfo.textContent = '';
        }
      }
      regexInput.addEventListener('input', run);
      testText.addEventListener('input', run);
      flagG.addEventListener('change', run);
      flagI.addEventListener('change', run);
      flagM.addEventListener('change', run);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.innerText));
    `,

    'life/color-picker': `
      const picker = document.getElementById('colorPicker');
      const hexInput = document.getElementById('hexInput');
      const rgbInput = document.getElementById('rgbInput');
      const hslInput = document.getElementById('hslInput');
      const preview = document.getElementById('colorPreview');
      const copyBtn = document.getElementById('copyOutput');
      function rgbToHsl(r, g, b) {
        r /= 255; g /= 255; b /= 255;
        const max = Math.max(r, g, b), min = Math.min(r, g, b);
        let h, s, l = (max + min) / 2;
        if (max === min) { h = s = 0; }
        else {
          const d = max - min;
          s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
          switch (max) {
            case r: h = ((g - b) / d + (g < b ? 6 : 0)) / 6; break;
            case g: h = ((b - r) / d + 2) / 6; break;
            case b: h = ((r - g) / d + 4) / 6; break;
          }
        }
        return [Math.round(h * 360), Math.round(s * 100), Math.round(l * 100)];
      }
      function hexToRgb(hex) {
        const h = hex.replace('#', '');
        const full = h.length === 3 ? h.split('').map(c => c + c).join('') : h;
        return [parseInt(full.substring(0, 2), 16), parseInt(full.substring(2, 4), 16), parseInt(full.substring(4, 6), 16)];
      }
      function update() {
        const hex = picker.value.toUpperCase();
        const [r, g, b] = hexToRgb(hex);
        const [h, s, l] = rgbToHsl(r, g, b);
        hexInput.value = hex;
        rgbInput.value = 'rgb(' + r + ', ' + g + ', ' + b + ')';
        hslInput.value = 'hsl(' + h + ', ' + s + '%, ' + l + '%)';
        preview.style.background = hex;
        copyBtn.onclick = () => { copyToClipboard(hex); CT.showToast('已复制 ' + hex); };
      }
      picker.addEventListener('input', update);
      update();
    `,

    'encrypt/base32': `
      const _b32Chars = 'ABCDEFGHIJKLMNOPQRSTUVWXYZ234567';
      function encodeBase32(str) {
        let bits = 0, value = 0, output = '';
        for (let i = 0; i < str.length; i++) {
          value = (value << 8) | str.charCodeAt(i);
          bits += 8;
          while (bits >= 5) { output += _b32Chars[(value >>> (bits - 5)) & 31]; bits -= 5; }
        }
        if (bits > 0) output += _b32Chars[(value << (5 - bits)) & 31];
        return output;
      }
      function decodeBase32(str) {
        str = str.toUpperCase().replace(/[^A-Z2-7]/g, '');
        let bits = 0, value = 0, output = '';
        for (let i = 0; i < str.length; i++) {
          const idx = _b32Chars.indexOf(str[i]);
          if (idx < 0) continue;
          value = (value << 5) | idx;
          bits += 5;
          if (bits >= 8) { output += String.fromCharCode((value >>> (bits - 8)) & 255); bits -= 8; }
        }
        return output;
      }
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'encode';
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        try { output.value = mode === 'encode' ? encodeBase32(v) : decodeBase32(v); }
        catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('encodeBtn').addEventListener('click', () => { mode = 'encode'; run(); });
      document.getElementById('decodeBtn').addEventListener('click', () => { mode = 'decode'; run(); });
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.value));
      input.addEventListener('input', run);
    `,

    // ============ New tools 2026-04-18 ============
    'code/sql-format': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function formatSQL(sql) {
if (!sql.trim()) return '';
        return sql
          .replace(/\\s+/g, ' ')
          .replace(/,\\s*/g, ',\n  ')
          .replace(/\\(\\s*/g, '(\n  ')
          .replace(/\\s*\\)/g, '\n)')
          .replace(/\\bSELECT\\b/gi, 'SELECT')
          .replace(/\\bFROM\\b/gi, '\nFROM')
          .replace(/\\bWHERE\\b/gi, '\nWHERE')
          .replace(/\\bOR\\b/gi, '\n  OR')
          .replace(/\\bFULL\\s+CROSS\\s+JOIN\\b/gi, '\nFULL CROSS JOIN')
          .replace(/\\bFULL\\s+JOIN\\b/gi, '\nFULL JOIN')
          .replace(/\\bLEFT\\s+OUTER\\s+JOIN\\b/gi, '\nLEFT OUTER JOIN')
          .replace(/\\bRIGHT\\s+OUTER\\s+JOIN\\b/gi, '\nRIGHT OUTER JOIN')
          .replace(/\\bLEFT\\s+JOIN\\b/gi, '\nLEFT JOIN')
          .replace(/\\bRIGHT\\s+JOIN\\b/gi, '\nRIGHT JOIN')
          .replace(/\\bINNER\\s+JOIN\\b/gi, '\nINNER JOIN')
          .replace(/\\bCROSS\\s+JOIN\\b/gi, '\nCROSS JOIN')
          .replace(/\\bJOIN\\b/gi, '\nJOIN')
          .replace(/\\bON\\b/gi, ' ON')
          .replace(/\\bORDER BY\\b/gi, '\nORDER BY')
          .replace(/\\bHAVING\\b/gi, '\nHAVING')
          .replace(/\\bLIMIT\\b/gi, '\nLIMIT')
          .trim();
      }
      function minifySQL(sql) {
        if (!sql.trim()) return '';
        return sql.replace(/\\s+/g, ' ').replace(/\\s*,\\s*/g, ',').replace(/\\s*\\(\\s*/g, '(').replace(/\\s*\\)\\s*/g, ')').trim();
      }
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        try { output.value = formatSQL(v); }
        catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('format').onclick = run;
      document.getElementById('minify').onclick = () => { output.value = minifySQL(input.value); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'encrypt/base16': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      let mode = 'encode';
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        try {
          if (mode === 'encode') {
            output.value = [...v].map(c => c.charCodeAt(0).toString(16).padStart(2,'0')).join(' ').toUpperCase();
          } else {
            const hex = v.trim().split(/\\s+/);
            output.value = hex.map(h => String.fromCharCode(parseInt(h,16))).join('');
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('encode').onclick = () => { mode='encode'; run(); };
      document.getElementById('decode').onclick = () => { mode='decode'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'text/indent': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const spacesInput = document.getElementById('spacesInput');
      let mode = 'spaces';
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        const spaces = parseInt(spacesInput.value) || 2;
        try {
          if (mode === 'spaces') {
            output.value = v.replace(/^(\\t+)/gm, (m) => ' '.repeat(m.length * spaces));
          } else {
            output.value = v.replace(new RegExp('^ {' + spaces + '}','gm'), '\\t');
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('toSpaces').onclick = () => { mode='spaces'; run(); };
      document.getElementById('toTabs').onclick = () => { mode='tabs'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      spacesInput.addEventListener('input', run);
    `,

    'text/reverse': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        output.value = v.split('').reverse().join('');
      }
      function runLines() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        output.value = v.split('\n').reverse().join('\n');
      }
      function runWords() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        output.value = v.split(' ').reverse().join(' ');
      }
      document.getElementById('reverse').onclick = run;
      document.getElementById('reverseLines').onclick = runLines;
      document.getElementById('reverseWords').onclick = runWords;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
    `,

    'text/repeat': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const countInput = document.getElementById('countInput');
      const sepInput = document.getElementById('sepInput');
      function run() {
        const v = input.value;
        const count = parseInt(countInput.value) || 1;
        const sep = sepInput.value || '';
        if (!v) { output.value = ''; return; }
        const arr = [];
        for (let i = 0; i < count; i++) arr.push(v);
        output.value = arr.join(sep);
      }
      document.getElementById('genBtn').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      countInput.addEventListener('input', run);
      sepInput.addEventListener('input', run);
    `,

    'math/lcm': `
      function gcd(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { const t = b; b = a % b; a = t; } return a; }
      function lcm(a, b) { return Math.abs(a * b) / gcd(a, b); }
      const inputA = document.getElementById('inputA');
      const inputB = document.getElementById('inputB');
      const output = document.getElementById('output');
      const steps = document.getElementById('steps');
      function calc() {
        const a = parseInt(inputA.value);
        const b = parseInt(inputB.value);
        if (isNaN(a) || isNaN(b)) { output.textContent = '请输入有效整数'; steps.textContent = ''; return; }
        const g = gcd(a, b);
        const l = lcm(a, b);
        output.textContent = l;
        steps.textContent = 'GCD(' + a + ', ' + b + ') = ' + g + '\nLCM = |' + a + ' × ' + b + '| ÷ GCD = ' + l;
      }
      document.getElementById('calcBtn').onclick = calc;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.textContent);
      inputA.addEventListener('input', calc);
      inputB.addEventListener('input', calc);
    `,

    'math/power': `
      const baseInput = document.getElementById('baseInput');
      const expInput = document.getElementById('expInput');
      const output = document.getElementById('output');
      function calc() {
        const base = parseFloat(baseInput.value);
        const exp = parseFloat(expInput.value);
        if (isNaN(base) || isNaN(exp)) { output.textContent = '请输入有效数字'; return; }
        const result = Math.pow(base, exp);
        output.textContent = Number.isInteger(result) ? result.toLocaleString() : result.toPrecision(15);
      }
      document.getElementById('calcBtn').onclick = calc;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.textContent);
      baseInput.addEventListener('input', calc);
      expInput.addEventListener('input', calc);
    `,

    'text/extract-url': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const filterInput = document.getElementById('filterInput');
      function run() {
        const v = input.value;
        if (!v) { output.value = ''; return; }
        const filter = filterInput.value.trim();
        const urlPattern = /https?:\\/\\/[^\\s"'<>]+/gi;
        let urls = v.match(urlPattern) || [];
        if (filter) {
          const lcFilter = filter.toLowerCase();
          urls = urls.filter(u => u.toLowerCase().includes(lcFilter));
        }
        output.value = [...new Set(urls)].join('\n');
      }
      document.getElementById('extractBtn').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      filterInput.addEventListener('input', run);
    `,
    'code/css-unit': `
      const inputNum = document.getElementById('inputNum');
      const fromUnit = document.getElementById('fromUnit');
      const output = document.getElementById('output');
      const TO_PX = { px: 1, em: 16, rem: 16, vw: 19.2, vh: 10.8, pt: 96/72, in: 96, cm: 37.8, mm: 3.78 };
      const FROM_PX = { px: 1, em: 1/16, rem: 1/16, vw: 1/19.2, vh: 1/10.8, pt: 72/96, in: 1/96, cm: 1/37.8, mm: 1/3.78 };
      function calc() {
        const val = parseFloat(inputNum.value);
        const from = fromUnit.value;
        if (isNaN(val)) { output.textContent = '请输入有效数值'; return; }
        if (!TO_PX[from]) { output.textContent = '无效单位: ' + from; return; }
        const px = val * TO_PX[from];
        const results = Object.keys(FROM_PX).map(u => u + ': ' + (px * FROM_PX[u]).toFixed(4)).join('\n');
        output.textContent = results;
      }
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,

    'code/SQLite查看器': `
      (function() {
        const SQLJS_CDN = 'https://cdnjs.cloudflare.com/ajax/libs/sql.js/1.10.3/';
        let SQL = null;
        let db = null;
        let currentDbName = '';
        let currentTable = null;
        let dataPage = 0;
        const PAGE_SIZE = 50;

        const $ = (id) => document.getElementById(id);
        const root = $('sqliteRoot');
        const loadingEl = $('sqliteLoading');
        const appEl = $('sqliteApp');
        const dropZone = $('dropZone');
        const fileInput = $('fileInput');
        const fileInfo = $('fileInfo');
        const dbPanel = $('dbPanel');
        const tableList = $('tableList');
        const structureContent = $('structureContent');
        const dataContent = $('dataContent');
        const sqlInput = $('sqlInput');
        const sqlResults = $('sqlResults');
        const sqlError = $('sqlError');
        const sqlStats = $('sqlStats');

        function loadSqlJs() {
          return new Promise((resolve, reject) => {
            if (window.initSqlJs) {
              window.initSqlJs({ locateFile: f => SQLJS_CDN + f }).then(resolve).catch(reject);
              return;
            }
            const script = document.createElement('script');
            script.src = SQLJS_CDN + 'sql-wasm.js';
            script.onload = () => {
              window.initSqlJs({ locateFile: f => SQLJS_CDN + f }).then(resolve).catch(reject);
            };
            script.onerror = () => reject(new Error('无法从 CDN 加载 sql.js'));
            document.head.appendChild(script);
          });
        }

        function escapeHtml(s) {
          if (s === null || s === undefined) return '<span class="null-val">NULL</span>';
          return String(s).replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
        }

        function setError(msg) {
          sqlError.innerHTML = '<div class="sqlite-error">❌ ' + escapeHtml(msg) + '</div>';
          sqlStats.innerHTML = '';
          sqlResults.style.display = 'none';
        }

        function clearError() {
          sqlError.innerHTML = '';
        }

        function loadDatabaseFromBuffer(buf, name) {
          try {
            db = new SQL.Database(new Uint8Array(buf));
            currentDbName = name || '未命名数据库';
            fileInfo.textContent = '📄 ' + currentDbName + ' (' + (buf.byteLength / 1024).toFixed(2) + ' KB)';
            dropZone.style.display = 'none';
            dbPanel.style.display = 'block';
            refreshTableList();
            const first = tableList.querySelector('li');
            if (first) first.click();
          } catch (e) {
            alert('加载数据库失败: ' + e.message);
          }
        }

        function refreshTableList() {
          if (!db) return;
          const res = db.exec("SELECT name FROM sqlite_master WHERE type='table' AND name NOT LIKE 'sqlite_%' ORDER BY name");
          const tables = res[0] ? res[0].values.map(r => r[0]) : [];
          tableList.innerHTML = '';
          if (tables.length === 0) {
            tableList.innerHTML = '<li style="opacity:0.6;cursor:default;font-style:italic;">数据库中无表</li>';
            return;
          }
          tables.forEach(name => {
            const li = document.createElement('li');
            li.dataset.table = name;
            li.innerHTML = '<span>📋</span><span class="tname"></span><span class="rowcount"></span>';
            li.querySelector('.tname').textContent = name;
            li.addEventListener('click', () => selectTable(name));
            tableList.appendChild(li);
          });
          tables.forEach(name => {
            try {
              const c = db.exec('SELECT COUNT(*) FROM "' + name.replace(/"/g,'""') + '"');
              const cnt = c[0] ? c[0].values[0][0] : 0;
              const li = tableList.querySelector('li[data-table="' + CSS.escape(name) + '"]');
              if (li) li.querySelector('.rowcount').textContent = cnt;
            } catch(e) {}
          });
        }

        function selectTable(name) {
          currentTable = name;
          dataPage = 0;
          tableList.querySelectorAll('li').forEach(li => li.classList.toggle('active', li.dataset.table === name));
          renderStructure(name);
          renderTableData(name);
          switchTab('structure');
        }

        function renderStructure(name) {
          try {
            const sqlRes = db.exec("SELECT sql FROM sqlite_master WHERE type='table' AND name='" + name.replace(/'/g,"''") + "'");
            const createSql = sqlRes[0] ? sqlRes[0].values[0][0] : '';
            const pragmaRes = db.exec('PRAGMA table_info("' + name.replace(/"/g,'""') + '")');
            const cols = pragmaRes[0] ? pragmaRes[0] : { columns: ['cid','name','type','notnull','dflt_value','pk'], values: [] };
            let html = '<div style="margin-bottom:0.75rem;font-size:0.9rem;color:var(--text-secondary);">📋 <strong>' + escapeHtml(name) + '</strong> 的表结构</div>';
            if (cols.values.length > 0) {
              html += '<table class="sqlite-schema-table"><thead><tr><th>#</th><th>列名</th><th>类型</th><th>NOT NULL</th><th>默认值</th><th>主键</th></tr></thead><tbody>';
              cols.values.forEach(row => {
                const [cid, colName, colType, notnull, dflt, pk] = row;
                html += '<tr>' +
                  '<td>' + cid + '</td>' +
                  '<td><strong>' + escapeHtml(colName) + '</strong></td>' +
                  '<td><code>' + escapeHtml(colType || '') + '</code></td>' +
                  '<td class="' + (notnull ? 'nn' : '') + '">' + (notnull ? '✓' : '') + '</td>' +
                  '<td><code>' + escapeHtml(dflt === null ? '' : dflt) + '</code></td>' +
                  '<td class="' + (pk ? 'pk' : '') + '">' + (pk ? '🔑 ' + pk : '') + '</td>' +
                '</tr>';
              });
              html += '</tbody></table>';
            }
            if (createSql) {
              html += '<details style="margin-top:1rem;"><summary style="cursor:pointer;font-size:0.85rem;color:var(--text-secondary);">显示建表 SQL</summary><pre style="background:var(--bg-secondary);padding:0.75rem;border-radius:8px;font-size:0.8rem;overflow-x:auto;margin-top:0.5rem;">' + escapeHtml(createSql) + '</pre></details>';
            }
            const idxRes = db.exec("SELECT name, sql FROM sqlite_master WHERE type='index' AND tbl_name='" + name.replace(/'/g,"''") + "' AND sql IS NOT NULL");
            if (idxRes[0] && idxRes[0].values.length > 0) {
              html += '<div style="margin-top:1rem;font-size:0.85rem;"><strong>索引：</strong><ul style="margin:0.25rem 0 0 1rem;">';
              idxRes[0].values.forEach(r => {
                html += '<li><code>' + escapeHtml(r[0]) + '</code></li>';
              });
              html += '</ul></div>';
            }
            structureContent.innerHTML = html;
          } catch (e) {
            structureContent.innerHTML = '<div class="sqlite-error">❌ ' + escapeHtml(e.message) + '</div>';
          }
        }

        function renderTableData(name) {
          try {
            const safe = name.replace(/"/g,'""');
            const totalRes = db.exec('SELECT COUNT(*) FROM "' + safe + '"');
            const total = totalRes[0] ? totalRes[0].values[0][0] : 0;
            const offset = dataPage * PAGE_SIZE;
            const dataRes = db.exec('SELECT * FROM "' + safe + '" LIMIT ' + PAGE_SIZE + ' OFFSET ' + offset);
            let html = '<div style="margin-bottom:0.5rem;font-size:0.9rem;color:var(--text-secondary);">📊 <strong>' + escapeHtml(name) + '</strong> · 共 <strong>' + total + '</strong> 行</div>';
            if (dataRes[0]) {
              const { columns, values } = dataRes[0];
              html += '<div class="sqlite-results"><table><thead><tr>';
              columns.forEach(c => { html += '<th>' + escapeHtml(c) + '</th>'; });
              html += '</tr></thead><tbody>';
              values.forEach(row => {
                html += '<tr>';
                row.forEach(v => { html += '<td>' + escapeHtml(v) + '</td>'; });
                html += '</tr>';
              });
              html += '</tbody></table></div>';
              const totalPages = Math.ceil(total / PAGE_SIZE) || 1;
              html += '<div class="sqlite-pagination">' +
                '<button id="dataPrevBtn" ' + (dataPage === 0 ? 'disabled' : '') + '>← 上一页</button>' +
                '<span>第 ' + (dataPage + 1) + ' / ' + totalPages + ' 页 (每页 ' + PAGE_SIZE + ' 行)</span>' +
                '<button id="dataNextBtn" ' + (dataPage >= totalPages - 1 ? 'disabled' : '') + '>下一页 →</button>' +
              '</div>';
            } else {
              html += '<div style="padding:1rem;opacity:0.6;text-align:center;">表为空</div>';
            }
            dataContent.innerHTML = html;
            const prev = $('dataPrevBtn'), next = $('dataNextBtn');
            if (prev) prev.onclick = () => { if (dataPage > 0) { dataPage--; renderTableData(name); } };
            if (next) next.onclick = () => { dataPage++; renderTableData(name); };
          } catch (e) {
            dataContent.innerHTML = '<div class="sqlite-error">❌ ' + escapeHtml(e.message) + '</div>';
          }
        }

        function runSQL(sql) {
          clearError();
          if (!sql.trim()) { setError('请输入 SQL 语句'); return; }
          if (!db) { setError('请先加载数据库'); return; }
          const t0 = performance.now();
          try {
            const results = db.exec(sql);
            const elapsed = (performance.now() - t0).toFixed(2);
            if (results.length === 0) {
              const changes = db.getRowsModified();
              sqlStats.innerHTML = '<div class="sqlite-stats">✅ 执行成功 · 耗时 ' + elapsed + ' ms · 影响行数 <strong>' + changes + '</strong></div>';
              sqlResults.style.display = 'none';
              if (/\\b(insert|update|delete|create|drop|alter)\\b/i.test(sql)) {
                refreshTableList();
                if (currentTable) { renderStructure(currentTable); renderTableData(currentTable); }
              }
              return;
            }
            const { columns, values } = results[0];
            let totalRows = values.length;
            sqlStats.innerHTML = '<div class="sqlite-stats">✅ 查询成功 · 耗时 ' + elapsed + ' ms · 返回 <strong>' + totalRows + '</strong> 行 ' + (results.length > 1 ? '（共 ' + results.length + ' 个结果集，仅显示第一个）' : '') + '</div>';
            const limit = 500;
            const display = values.slice(0, limit);
            let html = '<table><thead><tr>';
            columns.forEach(c => { html += '<th>' + escapeHtml(c) + '</th>'; });
            html += '</tr></thead><tbody>';
            display.forEach(row => {
              html += '<tr>';
              row.forEach(v => { html += '<td>' + escapeHtml(v) + '</td>'; });
              html += '</tr>';
            });
            html += '</tbody></table>';
            if (totalRows > limit) {
              html += '<div style="padding:0.75rem;text-align:center;opacity:0.6;font-size:0.85rem;background:var(--bg-secondary);">仅显示前 ' + limit + ' 行（共 ' + totalRows + ' 行）</div>';
            }
            sqlResults.innerHTML = html;
            sqlResults.style.display = 'block';
          } catch (e) {
            setError(e.message);
          }
        }

        function switchTab(tab) {
          document.querySelectorAll('.sqlite-tab').forEach(b => b.classList.toggle('active', b.dataset.tab === tab));
          document.querySelectorAll('.sqlite-panel').forEach(p => p.classList.remove('active'));
          const panel = $('panel-' + tab);
          if (panel) panel.classList.add('active');
        }

        function bindEvents() {
          dropZone.addEventListener('click', () => fileInput.click());
          fileInput.addEventListener('change', e => {
            const file = e.target.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => loadDatabaseFromBuffer(ev.target.result, file.name);
            reader.onerror = () => alert('文件读取失败');
            reader.readAsArrayBuffer(file);
          });
          ['dragenter','dragover'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.add('dragover'); }));
          ['dragleave','drop'].forEach(ev => dropZone.addEventListener(ev, e => { e.preventDefault(); dropZone.classList.remove('dragover'); }));
          dropZone.addEventListener('drop', e => {
            const file = e.dataTransfer.files[0];
            if (!file) return;
            const reader = new FileReader();
            reader.onload = ev => loadDatabaseFromBuffer(ev.target.result, file.name);
            reader.readAsArrayBuffer(file);
          });
          document.querySelectorAll('.sqlite-tab').forEach(btn => {
            btn.addEventListener('click', () => switchTab(btn.dataset.tab));
          });
          $('runSqlBtn').addEventListener('click', () => runSQL(sqlInput.value));
          $('clearSqlBtn').addEventListener('click', () => { sqlInput.value = ''; clearError(); sqlResults.style.display = 'none'; sqlStats.innerHTML = ''; });
          sqlInput.addEventListener('keydown', e => {
            if ((e.ctrlKey || e.metaKey) && e.key === 'Enter') { e.preventDefault(); runSQL(sqlInput.value); }
          });
          document.querySelectorAll('.sqlite-quick').forEach(b => {
            b.addEventListener('click', () => { sqlInput.value = b.dataset.sql; switchTab('query'); runSQL(sqlInput.value); });
          });
          $('exportDbBtn').addEventListener('click', () => {
            if (!db) return;
            const data = db.export();
            const blob = new Blob([data], { type: 'application/octet-stream' });
            const url = URL.createObjectURL(blob);
            const a = document.createElement('a');
            a.href = url;
            a.download = currentDbName.replace(/\\.(db|sqlite|sqlite3)$/i, '') + '_export.db';
            a.click();
            URL.revokeObjectURL(url);
          });
          $('sampleBtn').addEventListener('click', () => {
            db = new SQL.Database();
            db.run("CREATE TABLE users (id INTEGER PRIMARY KEY, name TEXT NOT NULL, email TEXT UNIQUE, age INTEGER, created_at TEXT DEFAULT CURRENT_TIMESTAMP); INSERT INTO users (name, email, age) VALUES ('Alice', 'alice@example.com', 28), ('Bob', 'bob@example.com', 34), ('Charlie', 'charlie@example.com', 22), ('Diana', 'diana@example.com', 41); CREATE TABLE products (id INTEGER PRIMARY KEY, name TEXT NOT NULL, price REAL, stock INTEGER DEFAULT 0); INSERT INTO products (name, price, stock) VALUES ('Laptop', 999.99, 12), ('Mouse', 19.99, 100), ('Keyboard', 79.99, 45), ('Monitor', 299.99, 8); CREATE TABLE orders (id INTEGER PRIMARY KEY, user_id INTEGER, product_id INTEGER, quantity INTEGER, order_date TEXT, FOREIGN KEY(user_id) REFERENCES users(id), FOREIGN KEY(product_id) REFERENCES products(id)); INSERT INTO orders (user_id, product_id, quantity, order_date) VALUES (1, 1, 1, '2024-01-15'), (2, 2, 2, '2024-02-03'), (1, 3, 1, '2024-02-10'), (3, 4, 1, '2024-03-22'), (4, 1, 1, '2024-04-05');");
            currentDbName = 'sample.db';
            fileInfo.textContent = '📄 示例数据库（内存中）';
            dropZone.style.display = 'none';
            dbPanel.style.display = 'block';
            refreshTableList();
            const first = tableList.querySelector('li');
            if (first) first.click();
          });
          $('newDbBtn').addEventListener('click', () => {
            db = new SQL.Database();
            currentDbName = 'new.db';
            fileInfo.textContent = '📄 新建空数据库（内存中）';
            dropZone.style.display = 'none';
            dbPanel.style.display = 'block';
            refreshTableList();
            switchTab('query');
            sqlInput.placeholder = "试试输入: CREATE TABLE t (id INTEGER PRIMARY KEY, name TEXT); 然后 INSERT INTO t (name) VALUES ('hello');";
          });
        }

        loadSqlJs()
          .then(sql => {
            SQL = sql;
            loadingEl.style.display = 'none';
            appEl.style.display = 'block';
            bindEvents();
          })
          .catch(err => {
            loadingEl.innerHTML = '<div class="sqlite-error">❌ 加载 sql.js 失败: ' + escapeHtml(err.message) + '<br><br>请检查网络连接后刷新页面重试。</div>';
          });
      })();
    `,
    'math/fibonacci': `
      const inputNum = document.getElementById('inputNum');
      const output = document.getElementById('output');
      function getMode() { for (const r of document.getElementsByName('mode')) if (r.checked) return r.value; return 'count'; }
      function fibCount(n) {
        if (n <= 0) return [];
        if (n === 1) return [0];
        const seq = [0, 1];
        while (seq.length < n) seq.push(seq[seq.length-1] + seq[seq.length-2]);
        return seq;
      }
      function fibMax(max) {
        const seq = [0, 1];
        while (seq[seq.length-1] + seq[seq.length-2] <= max) seq.push(seq[seq.length-1] + seq[seq.length-2]);
        return seq;
      }
      function calc() {
        const mode = getMode();
        const v = parseInt(inputNum.value);
        if (isNaN(v) || v < 1) { output.value = '请输入有效正整数'; return; }
        output.value = (mode === 'count' ? fibCount(v) : fibMax(v)).join(', ');
      }
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.value));
      calc();
    `,
    'math/roman-numeral': `
      const inputText = document.getElementById('inputText');
      const output = document.getElementById('output');
      const vals = [[1000,'M'],[900,'CM'],[500,'D'],[400,'CD'],[100,'C'],[90,'XC'],[50,'L'],[40,'XL'],[10,'X'],[9,'IX'],[5,'V'],[4,'IV'],[1,'I']];
      function intToRoman(num) {
        if (num <= 0 || num > 3999) return '数值需在 1-3999 之间';
        let r = '';
        for (const [v, s] of vals) { while (num >= v) { r += s; num -= v; } }
        return r;
      }
      function romanToInt(s) {
        const map = {M:1000,CM:900,D:500,CD:400,C:100,XC:90,L:50,XL:40,X:10,IX:9,V:5,IV:4,I:1};
        let r = 0, i = 0;
        s = s.toUpperCase().replace(/\\s/g,'');
        while (i < s.length) {
          if (i+1 < s.length && map[s.slice(i,i+2)]) { r += map[s.slice(i,i+2)]; i += 2; }
          else { r += map[s[i]] || 0; i++; }
        }
        return r;
      }
      function isRoman(s) { return /^[MDCLXVI]+$/i.test(s.replace(/\\s/g,'')); }
      function run() {
        const v = inputText.value.trim();
        if (!v) { output.textContent = ''; return; }
        output.textContent = isRoman(v) ? romanToInt(v).toString() : intToRoman(parseInt(v));
      }
      document.getElementById('toRomanBtn').addEventListener('click', () => { const n = parseInt(inputText.value); if (isNaN(n)) { output.textContent = '请输入有效阿拉伯数字'; return; } output.textContent = intToRoman(n); });
      document.getElementById('toArabBtn').addEventListener('click', () => { const s = inputText.value.trim(); if (!s) { output.textContent = '请输入罗马数字'; return; } output.textContent = romanToInt(s).toString(); });
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,
    'math/perfect-number': `
      const inputNum = document.getElementById('inputNum');
      const output = document.getElementById('output');
      const factors = document.getElementById('factors');
      function check() {
        const v = parseInt(inputNum.value);
        if (isNaN(v) || v < 1) { output.textContent = '请输入正整数'; output.style.color = 'var(--text)'; factors.textContent = ''; return; }
        const divs = [];
        for (let i = 1; i <= Math.floor(v/2); i++) if (v % i === 0) divs.push(i);
        const perfect = divs.reduce((a,b) => a+b, 0) === v;
        output.textContent = perfect ? '是完美数 \u2713' : '不是完美数 \u2717';
        output.style.color = perfect ? '#22c55e' : '#ef4444';
        factors.textContent = '因子: ' + divs.join(', ');
      }
      inputNum.addEventListener('input', check);
      document.getElementById('checkBtn').addEventListener('click', check);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,
    'encrypt/qrcode': `
      const inputText = document.getElementById('inputText');
      const qrcodeDiv = document.getElementById('qrcode');
      function genQR(text) {
        if (!text) { qrcodeDiv.innerHTML = ''; return; }
        qrcodeDiv.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(text) + '" style="display:block;margin:0 auto;" alt="QR Code" />';
      }
      document.getElementById('genBtn').addEventListener('click', () => genQR(inputText.value));
      document.getElementById('clearBtn').addEventListener('click', () => { inputText.value = ''; qrcodeDiv.innerHTML = ''; });
      document.getElementById('copyOutput').addEventListener('click', () => { const img = qrcodeDiv.querySelector('img'); if (img) copyToClipboard(img.src); });
    `,
    'encrypt/morse': `
      const inputText = document.getElementById('inputText');
      const output = document.getElementById('output');
      const MAP = {A:'.--',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.'};
      function encode(text) { return text.toUpperCase().split('').map(c => MAP[c] || '').filter(Boolean).join(' '); }
      function decode(morse) { const rev = {}; Object.entries(MAP).forEach(([k,v]) => rev[v] = k); return morse.split(' ').map(m => rev[m] || '').join(''); }
      function isMorse(s) { return /^[.\-\s]+$/.test(s.trim()); }
      function run() { const v = inputText.value; if (!v) { output.textContent = ''; return; } output.textContent = isMorse(v.trim()) ? decode(v.trim()) : encode(v); }
      document.getElementById('encodeBtn').addEventListener('click', () => { if (!isMorse(inputText.value.trim())) run(); });
      document.getElementById('decodeBtn').addEventListener('click', () => { if (isMorse(inputText.value.trim())) run(); });
      inputText.addEventListener('input', run);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    `,
    'life/bmi': `
      const heightInput = document.getElementById('heightInput');
      const weightInput = document.getElementById('weightInput');
      const result = document.getElementById('result');
      const bmiScale = document.getElementById('bmiScale');
      const ranges = [{max:18.5,label:'偏瘦',color:'#f59e0b'},{max:24,label:'正常',color:'#22c55e'},{max:28,label:'偏胖',color:'#f59e0b'},{max:Infinity,label:'肥胖',color:'#ef4444'}];
      function calc() {
        const h = parseFloat(heightInput.value) / 100;
        const w = parseFloat(weightInput.value);
        if (!h || !w || h <= 0 || w <= 0) { result.innerHTML = ''; bmiScale.textContent = ''; return; }
        const bmi = w / (h * h);
        let cat = ranges[0];
        for (const r of ranges) if (bmi <= r.max) { cat = r; break; }
        result.innerHTML = '<div style="font-size:3rem;font-weight:700;color:' + cat.color + ';">' + bmi.toFixed(1) + '</div><div style="font-size:1.2rem;color:' + cat.color + ';margin-top:0.5rem;">' + cat.label + '</div>';
        bmiScale.textContent = 'BMI 参考：偏瘦 < 18.5 | 正常 18.5-24 | 偏胖 24-28 | 肥胖 > 28';
      }
      heightInput.addEventListener('input', calc);
      weightInput.addEventListener('input', calc);
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(result.textContent));
    `,
    'network/curl-gen': `
      const methodSelect = document.getElementById('methodSelect');
      const urlInput = document.getElementById('urlInput');
      const headersInput = document.getElementById('headersInput');
      const bodyInput = document.getElementById('bodyInput');
      const curlOutput = document.getElementById('curlOutput');
      function buildCurl() {
        let cmd = 'curl';
        const method = methodSelect.value;
        const url = urlInput.value.trim();
        if (!url) { curlOutput.value = '# 请输入 URL'; return; }
        cmd += ' -X ' + method;
        if (headersInput.value.trim()) {
          try { const headers = JSON.parse(headersInput.value); Object.entries(headers).forEach(([k,v]) => { cmd += ' -H "' + k + ': ' + v + '"'; }); }
          catch(e) { cmd += ' -H "' + headersInput.value + '"'; }
        }
        if (bodyInput.value.trim() && !['GET','HEAD'].includes(method)) { cmd += " -d '" + bodyInput.value + "'"; }
        cmd += ' "' + url + '"';
        curlOutput.value = cmd;
      }
      [methodSelect, urlInput, headersInput, bodyInput].forEach(el => el.addEventListener('input', buildCurl));
      document.getElementById('genBtn').addEventListener('click', buildCurl);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(curlOutput.value));
    `,
    'other/robots文件生成器': `
      // === State ===
      let rules = []; // { id, type: 'disallow' | 'allow', path: string }
      let ruleSeq = 0;
      const PRESETS = {
        all: [
          { type: 'disallow', path: '' },
        ],
        none: [
          { type: 'allow', path: '/' },
        ],
        seo: [
          { type: 'disallow', path: '/admin/' },
          { type: 'disallow', path: '/private/' },
          { type: 'disallow', path: '/tmp/' },
          { type: 'disallow', path: '/*.json$' },
          { type: 'allow', path: '/api/public/' },
        ],
      };

      // === DOM refs ===
      const $ = (id) => document.getElementById(id);
      const uaSelect = $('uaSelect');
      const uaCustomWrap = $('uaCustomWrap');
      const uaCustom = $('uaCustom');
      const rulesList = $('rulesList');
      const enableCrawlDelay = $('enableCrawlDelay');
      const crawlDelay = $('crawlDelay');
      const sitemapUrl = $('sitemapUrl');
      const hostInput = $('hostInput');
      const headerComment = $('headerComment');
      const output = $('output');
      const validateMsg = $('validateMsg');

      function escapeHtml(s) {
        return String(s).replace(/[&<>"']/g, c => ({ '&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;' })[c]);
      }

      function getUserAgent() {
        const v = uaSelect.value;
        if (v === '__custom__') return (uaCustom.value || '').trim() || '*';
        return v;
      }

      function addRule(type, path) {
        rules.push({ id: ++ruleSeq, type: type, path: path || '' });
        renderRules();
        update();
      }

      function removeRule(id) {
        rules = rules.filter(r => r.id !== id);
        renderRules();
        update();
      }

      function updateRulePath(id, val) {
        const r = rules.find(x => x.id === id);
        if (r) { r.path = val; update(); }
      }

      function renderRules() {
        if (!rules.length) {
          rulesList.innerHTML = '<div style="opacity:0.55;font-size:0.85rem;padding:0.75rem;text-align:center;background:var(--bg-secondary);border-radius:8px;">还没有规则，点击下方按钮添加 Disallow / Allow</div>';
          return;
        }
        rulesList.innerHTML = rules.map((r, i) => {
          const color = r.type === 'disallow' ? '#ef4444' : '#22c55e';
          const icon = r.type === 'disallow' ? '🚫' : '✅';
          const label = r.type === 'disallow' ? 'Disallow' : 'Allow';
          return ''
            + '<div style="display:flex;gap:0.5rem;align-items:center;margin-bottom:0.5rem;padding:0.5rem;background:var(--bg-secondary);border-radius:8px;">'
            +   '<span style="background:' + color + ';color:#fff;font-weight:600;font-size:0.78rem;padding:0.25rem 0.55rem;border-radius:6px;min-width:5.5rem;text-align:center;">' + icon + ' ' + label + '</span>'
            +   '<span style="opacity:0.5;font-size:0.78rem;font-family:monospace;min-width:1.5rem;">' + (i + 1) + '.</span>'
            +   '<input type="text" data-id="' + r.id + '" value="' + escapeHtml(r.path) + '" placeholder="/path/" style="flex:1;padding:0.45rem 0.6rem;border-radius:6px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg);color:var(--text);" />'
            +   '<button data-remove="' + r.id + '" title="删除" style="background:none;border:1px solid var(--border);border-radius:6px;padding:0.4rem 0.6rem;cursor:pointer;color:#ef4444;">✕</button>'
            + '</div>';
        }).join('');
      }

      function generate() {
        const lines = [];
        const header = (headerComment.value || '').trim();
        if (header) {
          header.split(/\r?\n/).forEach(l => {
            const t = l.trim();
            if (t) lines.push(t.startsWith('#') ? t : '# ' + t);
          });
          if (lines.length) lines.push('');
        }
        const ua = getUserAgent();
        lines.push('User-agent: ' + ua);
        if (rules.length === 0) {
          lines.push('Disallow:');
        } else {
          rules.forEach(r => {
            const directive = r.type === 'disallow' ? 'Disallow' : 'Allow';
            const path = r.path || '';
            lines.push(directive + ': ' + path);
          });
        }
        if (enableCrawlDelay.checked) {
          const v = parseInt(crawlDelay.value, 10);
          if (!isNaN(v) && v >= 0) {
            lines.push('Crawl-delay: ' + v);
          }
        }
        const sitemap = (sitemapUrl.value || '').trim();
        if (sitemap) {
          lines.push('Sitemap: ' + sitemap);
        }
        const host = (hostInput.value || '').trim();
        if (host) {
          lines.push('Host: ' + host);
        }
        return lines.join('\n') + '\n';
      }

      function update() {
        output.value = generate();
        runValidation();
      }

      function runValidation() {
        const msgs = [];
        if (rules.length === 0) {
          msgs.push('<span style="color:#f59e0b;">⚠ 当前没有爬取规则，将允许所有路径抓取</span>');
        }
        // Check duplicates
        const seen = {};
        rules.forEach((r, i) => {
          const key = r.type + ':' + (r.path || '');
          if (seen[key] !== undefined) {
            msgs.push('<span style="color:#f59e0b;">⚠ 规则 ' + (i + 1) + ' 与规则 ' + (seen[key] + 1) + ' 完全重复</span>');
          } else {
            seen[key] = i;
          }
          // Check path starts with / or is wildcard pattern
          const p = r.path || '';
          if (p && !p.startsWith('/') && !p.startsWith('*') && !p.endsWith('$')) {
            msgs.push('<span style="color:#f59e0b;">⚠ 规则 "' + escapeHtml(p) + '" 路径建议以 / 开头</span>');
          }
        });
        if (enableCrawlDelay.checked) {
          const v = parseInt(crawlDelay.value, 10);
          if (isNaN(v) || v < 0) {
            msgs.push('<span style="color:#ef4444;">✗ Crawl-delay 必须是非负整数</span>');
          } else if (v > 86400) {
            msgs.push('<span style="color:#f59e0b;">⚠ Crawl-delay 超过 86400 秒 (24小时)，可能不符合搜索引擎规范</span>');
          } else if (v < 1) {
            msgs.push('<span style="color:#f59e0b;">⚠ Crawl-delay 为 0 表示无延迟</span>');
          }
        }
        const sitemap = (sitemapUrl.value || '').trim();
        if (sitemap && !/^https?:\/\/.+/i.test(sitemap)) {
          msgs.push('<span style="color:#ef4444;">✗ Sitemap URL 必须以 http:// 或 https:// 开头</span>');
        }
        if (msgs.length === 0) {
          validateMsg.innerHTML = '<span style="color:#22c55e;">✓ 规则有效，可以下载使用</span>';
        } else {
          validateMsg.innerHTML = msgs.join('<br>');
        }
      }

      // === Wire events ===
      uaSelect.addEventListener('change', () => {
        uaCustomWrap.style.display = uaSelect.value === '__custom__' ? '' : 'none';
        update();
      });
      uaCustom.addEventListener('input', update);

      $('addDisallowBtn').addEventListener('click', () => addRule('disallow', '/'));
      $('addAllowBtn').addEventListener('click', () => addRule('allow', '/'));
      $('clearRulesBtn').addEventListener('click', () => {
        if (rules.length && !confirm('确定清空所有规则？')) return;
        rules = [];
        renderRules();
        update();
      });

      rulesList.addEventListener('input', (e) => {
        const t = e.target;
        if (t.matches('input[data-id]')) {
          updateRulePath(parseInt(t.dataset.id, 10), t.value);
        }
      });
      rulesList.addEventListener('click', (e) => {
        const btn = e.target.closest('button[data-remove]');
        if (!btn) return;
        removeRule(parseInt(btn.dataset.remove, 10));
      });

      $('presetAllBtn').addEventListener('click', () => {
        rules = [];
        PRESETS.all.forEach(p => addRule(p.type, p.path));
      });
      $('presetNoneBtn').addEventListener('click', () => {
        rules = [];
        PRESETS.none.forEach(p => addRule(p.type, p.path));
      });
      $('presetSeoBtn').addEventListener('click', () => {
        rules = [];
        PRESETS.seo.forEach(p => addRule(p.type, p.path));
      });

      enableCrawlDelay.addEventListener('change', update);
      crawlDelay.addEventListener('input', update);
      sitemapUrl.addEventListener('input', update);
      hostInput.addEventListener('input', update);
      headerComment.addEventListener('input', update);

      $('copyOutput').addEventListener('click', () => copyToClipboard(output.value));
      $('validateBtn').addEventListener('click', runValidation);

      $('downloadBtn').addEventListener('click', () => {
        const text = output.value;
        if (!text.trim()) return;
        const blob = new Blob([text], { type: 'text/plain;charset=utf-8' });
        const url = URL.createObjectURL(blob);
        const a = document.createElement('a');
        a.href = url;
        a.download = 'robots.txt';
        document.body.appendChild(a);
        a.click();
        document.body.removeChild(a);
        setTimeout(() => URL.revokeObjectURL(url), 5000);
        if (window.CT && CT.showToast) CT.showToast('已下载 robots.txt');
      });

      // === Initial state ===
      headerComment.value = '# robots.txt for your site\n# Generated by CloverTools (https://clovertools.cn)\n# ' + new Date().toISOString().split('T')[0];
      rules = [];
      PRESETS.seo.forEach(p => addRule(p.type, p.path));
      enableCrawlDelay.checked = false;
      update();
    `,

    'text/敏感词检测': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const statEl = document.getElementById('stat');
      const levelSel = document.getElementById('level');
      const customWords = document.getElementById('customWords');
      const customMode = document.getElementById('customMode');
      const customPanel = document.getElementById('customPanel');
      customMode.addEventListener('change', () => {
        customPanel.style.display = customMode.checked ? 'block' : 'none';
        run();
      });
      levelSel.addEventListener('change', run);
      input.addEventListener('input', run);
      function getWords() {
        const base = WORDS[levelSel.value] || [];
        const extra = customMode.checked
          ? customWords.value.split(/[\\n,，、\\s]+/).map(s => s.trim()).filter(Boolean)
          : [];
        return base.concat(extra);
      }
      function run() {
        const text = input.value;
        if (!text) { output.innerHTML = '<div style="opacity:.6">请粘贴待检测文本…</div>'; statEl.textContent = ''; return; }
        const words = getWords();
        const lower = text.toLowerCase();
        const found = [];
        const seen = new Set();
        words.forEach(w => {
          if (!w) return;
          if (lower.indexOf(w.toLowerCase()) !== -1) seen.add(w);
        });
        let html = escapeHtml(text);
        // Highlight: replace each found word (case-insensitive, longest-first)
        const sorted = Array.from(seen).sort((a, b) => b.length - a.length);
        sorted.forEach(w => {
          const re = new RegExp(w.replace(/[.*+?^\${}()|[\\]\\\\]/g, '\\\\\$&'), 'gi');
          html = html.replace(re, m => '<mark style="background:#fde68a;color:#7c2d12;padding:0 2px;border-radius:3px;">' + m + '</mark>');
          found.push(w);
        });
        output.innerHTML = html;
        statEl.innerHTML = '检测到 <b>' + found.length + '</b> 个敏感词 / 共 ' + words.length + ' 词库';
        document.getElementById('copyOutput').onclick = () => copyToClipboard(text);
      }
      document.getElementById('clearBtn').onclick = () => { input.value=''; run(); };
      run();
    `,

    'text/字数检测': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const trim = document.getElementById('trimSpace');
      const noPunct = document.getElementById('noPunct');
      const PUNCT_RE = /[\\u3000-\\u303f\\uff00-\\uffef\\u2000-\\u206f!-/:-@\\[-{}~]/g;
      const CJK_RE = /[\\u4e00-\\u9fff\\u3400-\\u4dbf\\uff00-\\uffef]/g;
      const ASCII_RE = /[A-Za-z]/g;
      const DIGIT_RE = /\\d/g;
      const SPACE_RE = /\\s/g;
      function isCJK(c) { return /[\\u4e00-\\u9fff\\u3400-\\u4dbf]/.test(c); }
      function countWords(v) {
        // split on whitespace runs
        return v.trim().split(/\\s+/).filter(Boolean).length;
      }
      function run() {
        let raw = input.value;
        let v = trim.checked ? raw.replace(/\\s+/g, ' ').trim() : raw;
        const cjk = (v.match(CJK_RE)||[]).length;
        const asciiLetters = (v.match(ASCII_RE)||[]).length;
        const digits = (v.match(DIGIT_RE)||[]).length;
        const punct = (v.match(PUNCT_RE)||[]).length;
        const spaces = (v.match(SPACE_RE)||[]).length;
        const lines = v ? v.split('\\n').length : 0;
        const paragraphs = v.trim() ? v.trim().split(/\\n\\s*\\n+/).length : 0;
        const words = countWords(v);
        const chars = v.length;
        const noPunctChars = chars - (noPunct.checked ? punct : 0);
        output.innerHTML =
          '<div class="stat-grid">' +
            stat('总字符数', chars) +
            stat('中文字符', cjk) +
            stat('英文字母', asciiLetters) +
            stat('数字', digits) +
            stat('标点符号', punct) +
            stat('空白字符', spaces) +
            stat('行数', lines) +
            stat('段落数', paragraphs) +
            stat('英文单词', words) +
            stat((noPunct.checked?'非标点字符':'去空字符'), noPunct.checked ? noPunctChars : chars - spaces) +
          '</div>';
      }
      function stat(label, val) {
        return '<div class="stat-cell"><div class="stat-num">' + val + '</div><div class="stat-label">' + label + '</div></div>';
      }
      trim.addEventListener('change', run);
      noPunct.addEventListener('change', run);
      input.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(input.value);
      document.getElementById('clearBtn').onclick = () => { input.value=''; run(); };
      run();
    `,

    'text/字符编码检测': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const targetEnc = document.getElementById('targetEnc');
      const detectBtn = document.getElementById('detectBtn');
      const convertBtn = document.getElementById('convertBtn');
      const detectOut = document.getElementById('detectOut');
      const convertOut = document.getElementById('convertOut');
      const fileInput = document.getElementById('fileInput');
      function detectEncoding(buf) {
        // Heuristic BOM detection
        if (buf.length >= 3 && buf[0]===0xEF && buf[1]===0xBB && buf[2]===0xBF) return 'UTF-8 (BOM)';
        if (buf.length >= 2 && buf[0]===0xFF && buf[1]===0xFE) return 'UTF-16 LE (BOM)';
        if (buf.length >= 2 && buf[0]===0xFE && buf[1]===0xFF) return 'UTF-16 BE (BOM)';
        // Try UTF-8 strict validation
        try {
          const dec = new TextDecoder('utf-8', { fatal: true });
          dec.decode(buf);
          return 'UTF-8';
        } catch (e) {}
        // Try GBK/GB18030 — TextDecoder supports 'gb18030' (superset of GBK/GB2312)
        try {
          const dec = new TextDecoder('gb18030', { fatal: true });
          dec.decode(buf);
          // Could also be GBK. Heuristic: if many high bytes present, likely GBK
          return 'GBK/GB18030';
        } catch (e) {}
        try {
          const dec = new TextDecoder('big5', { fatal: true });
          dec.decode(buf);
          return 'Big5';
        } catch (e) {}
        try {
          const dec = new TextDecoder('shift_jis', { fatal: true });
          dec.decode(buf);
          return 'Shift_JIS';
        } catch (e) {}
        return 'ISO-8859-1 (Latin-1, fallback)';
      }
      function run() {
        const text = input.value;
        if (!text) { output.innerHTML = '<div style="opacity:.6">请输入文本或上传文件…</div>'; detectOut.textContent = ''; return; }
        const bytes = new TextEncoder().encode(text);
        const enc = detectEncoding(bytes);
        detectOut.innerHTML =
          '<div class="stat-grid">' +
            '<div class="stat-cell"><div class="stat-num">' + bytes.length + '</div><div class="stat-label">字节数 (UTF-8)</div></div>' +
            '<div class="stat-cell"><div class="stat-num">' + text.length + '</div><div class="stat-label">字符数</div></div>' +
          '</div>' +
          '<div style="margin-top:1rem;padding:.8rem 1rem;background:var(--bg-secondary);border-radius:10px;border-left:3px solid var(--primary);">' +
            '<b>推断编码：</b><span style="color:var(--primary);font-weight:600;">' + enc + '</span>' +
          '</div>';
        document.getElementById('copyOutput').onclick = () => copyToClipboard(text);
      }
      function doConvert() {
        try {
          const text = input.value;
          if (!text) { convertOut.textContent = ''; return; }
          const bytes = new TextEncoder().encode(text);
          const arr = new Uint8Array(bytes);
          const enc = targetEnc.value;
          const dec = new TextDecoder(enc, { fatal: false });
          const out = dec.decode(arr);
          convertOut.value = out;
        } catch (e) {
          convertOut.value = '转换失败: ' + e.message;
        }
      }
      detectBtn.onclick = run;
      convertBtn.onclick = doConvert;
      input.addEventListener('input', run);
      fileInput.addEventListener('change', ev => {
        const f = ev.target.files[0];
        if (!f) return;
        const reader = new FileReader();
        reader.onload = e => {
          const buf = new Uint8Array(e.target.result);
          input.value = new TextDecoder('utf-8', { fatal: false }).decode(buf);
          run();
        };
        reader.readAsArrayBuffer(f);
      });
      document.getElementById('clearBtn').onclick = () => { input.value=''; convertOut.value=''; run(); };
      run();
    `,

    'math/随机数序列': `
const output = document.getElementById('output');
      const countInput = document.getElementById('count');
      const minInput = document.getElementById('min');
      const maxInput = document.getElementById('max');
      const distSelect = document.getElementById('dist');
      const integerChk = document.getElementById('integer');
      function gauss() { let u=0,v=0; while(u===0)u=Math.random(); while(v===0)v=Math.random(); return Math.sqrt(-2*Math.log(u))*Math.cos(2*Math.PI*v); }
      function gen() {
        const n = parseInt(countInput.value)||10;
        const min = parseFloat(minInput.value)||0;
        const max = parseFloat(maxInput.value)||100;
        const integer = integerChk.checked;
        const dist = distSelect.value;
        const out = [];
        for (let i=0;i<n;i++) {
          let v;
          if (dist==='normal') {
            const mean = (min+max)/2;
            const std = (max-min)/6;
            v = mean + gauss()*std;
          } else { v = min + Math.random()*(max-min); }
          if (integer) v = Math.round(v);
          out.push(integer ? v.toString() : v.toFixed(4));
        }
        output.value = out.join(integer ? ', ' : '\\n');
      }
      document.getElementById('generate').onclick = gen;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      gen();
    `,
    'math/圆周率查询': `
const output = document.getElementById('output');
      const digitsInput = document.getElementById('digits');
      const PI_100 = '1415926535897932384626433832795028841971693993751058209749445923078164062862089986280348253421170679';
      const PI_10000 = '14159265358979323846264338327950288419716939937510'+
'58209749445923078164062862089986280348253421170679'+
'82148086513282306647093844609550582231725359408128'+
'48111745028410270193852110555964462294895493038196'+
'44288109756659334461284756482337867831652712019091'+
'45648566923460348610454326648213393607260249141273'+
'72458700660631558817488152092096282925409171536436'+
'78925903600113305305488204665213841469519415116094'+
'33057270365759591953092186117381932611793105118548'+
'07446237996274956735188575272489122793818301194912'+
'98336733624406566430860213949463952247371907021798'+
'60943702770539217176293176752384674818467669405132'+
'00056812714526356082778577134275778960917363717872'+
'14684409012249534301465495853710507922796892589235'+
'42019956112129021960864034418159813629774771309960'+
'51870721134999999837297804995105973173281609631859'+
'50244594553469083026425223082533446850352619311881'+
'71010003137838752886587533208381420617177669147303'+
'59825349042875546873115956286388235378759375195778'+
'18577805321712268066130019278766111959092164201989';

      function show() {
        const n = Math.max(1, Math.min(10000, parseInt(digitsInput.value)||100));
        let s;
        if (n <= 100) s = '3.' + PI_100.slice(0, n);
        else s = '3.' + PI_10000.slice(0, n);
        output.value = s;
      }
      document.getElementById('show').onclick = show;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      show();
    `,
    'math/矩阵计算器': `
const input = document.getElementById('input');
      const output = document.getElementById('output');
      const opSelect = document.getElementById('op');
      const bInput = document.getElementById('b');
      function parse(s) { return s.trim().split('\\n').map(r => r.trim().split(/[\s,]+/).map(Number)); }
      function matStr(m) { return m.map(r => r.map(v => Number.isFinite(v) ? v.toFixed(4) : 'NaN').join('\\t')).join('\\n'); }
      function det(m) {
        const n = m.length;
        if (n === 1) return m[0][0];
        if (n === 2) return m[0][0]*m[1][1] - m[0][1]*m[1][0];
        const M = m.map(r => r.slice());
        let d = 1;
        for (let i=0;i<n;i++) {
          let p = i; while (p<n && Math.abs(M[p][i])<1e-12) p++;
          if (p===n) return 0;
          if (p!==i) { [M[i],M[p]]=[M[p],M[i]]; d*=-1; }
          d *= M[i][i];
          for (let k=i+1;k<n;k++) M[i][k]/=M[i][i];
          for (let j=i+1;j<n;j++) for (let k=i+1;k<n;k++) M[j][k] -= M[j][i]*M[i][k];
        }
        return d;
      }
      function transpose(m) { return m[0].map((_,j) => m.map(r => r[j])); }
      function add(a,b) { return a.map((r,i) => r.map((v,j) => v + b[i][j])); }
      function mul(a,b) {
        const r = a.length, c = b[0].length, k = b.length;
        const out = Array.from({length:r}, () => Array(c).fill(0));
        for (let i=0;i<r;i++) for (let j=0;j<c;j++) for (let x=0;x<k;x++) out[i][j] += a[i][x]*b[x][j];
        return out;
      }
      function inverse(m) {
        const n = m.length;
        const A = m.map((r,i) => [...r, ...Array.from({length:n}, (_,j) => i===j?1:0)]);
        for (let i=0;i<n;i++) {
          let p=i; while(p<n && Math.abs(A[p][i])<1e-12) p++;
          if (p===n) throw new Error('矩阵不可逆');
          [A[i],A[p]]=[A[p],A[i]];
          for (let k=i;k<2*n;k++) A[i][k]/=A[i][i];
          for (let j=0;j<n;j++) if (j!==i) { const f=A[j][i]; for (let k=i;k<2*n;k++) A[j][k]-=f*A[i][k]; }
        }
        return A.map(r => r.slice(n));
      }
      function run() {
        try {
          const A = parse(input.value);
          const op = opSelect.value;
          if (op==='det') output.value = '行列式 = ' + det(A);
          else if (op==='transpose') output.value = matStr(transpose(A));
          else if (op==='inverse') output.value = matStr(inverse(A));
          else {
            const B = parse(bInput.value);
            if (op==='add') output.value = matStr(add(A,B));
            else if (op==='sub') output.value = matStr(add(A, B.map((r,i)=>r.map((v,j)=>-v))));
            else if (op==='mul') output.value = matStr(mul(A,B));
          }
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('calc').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,
    'math/进制算术运算': `
const aIn = document.getElementById('a');
      const bIn = document.getElementById('b');
      const baseA = document.getElementById('baseA');
      const baseB = document.getElementById('baseB');
      const op = document.getElementById('op');
      const out = document.getElementById('output');
      function run() {
        try {
          const a = parseInt(aIn.value, parseInt(baseA.value));
          const b = parseInt(bIn.value, parseInt(baseB.value));
          if (!Number.isFinite(a) || !Number.isFinite(b)) throw new Error('无法解析数字');
          let r;
          switch(op.value) {
            case 'add': r = a + b; break;
            case 'sub': r = a - b; break;
            case 'mul': r = a * b; break;
            case 'div': if (b===0) throw new Error('除数不能为 0'); r = Math.floor(a/b); break;
            case 'and': r = a & b; break;
            case 'or': r = a | b; break;
            case 'xor': r = a ^ b; break;
            case 'shl': r = a << b; break;
            case 'shr': r = a >> b; break;
          }
          out.value = '十进制: ' + r + '\\n' +
            '二进制: ' + (r>>>0).toString(2) + '\\n' +
            '八进制: ' + r.toString(8) + '\\n' +
            '十六进制: ' + r.toString(16).toUpperCase();
        } catch(e) { out.value = '错误: ' + e.message; }
      }
      ['a','b'].forEach(id => document.getElementById(id).addEventListener('input', run));
      document.getElementById('baseA').addEventListener('change', run);
      document.getElementById('baseB').addEventListener('change', run);
      document.getElementById('op').addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      run();
    `,
    'math/对数计算': `
const xIn = document.getElementById('x');
      const baseIn = document.getElementById('base');
      const out = document.getElementById('output');
      function run() {
        try {
          const x = parseFloat(xIn.value);
          const base = parseFloat(baseIn.value);
          if (x <= 0) throw new Error('真数必须 > 0');
          if (base <= 0 || base === 1) throw new Error('底数必须 > 0 且 ≠ 1');
          const ln = Math.log(x);
          const lg = Math.log10(x);
          const custom = Math.log(x) / Math.log(base);
          const expOf2 = Math.log2(x);
          out.value = '自然对数 ln(x)     = ' + ln.toFixed(10) + '\\n' +
            '常用对数 log10(x) = ' + lg.toFixed(10) + '\\n' +
            '二进制对数 log2(x)= ' + expOf2.toFixed(10) + '\\n' +
            '自定义底数 log_' + base + '(x) = ' + custom.toFixed(10) + '\\n' +
            '--- 指数互算 ---' + '\\n' +
            'e^x = ' + Math.exp(x).toFixed(6) + '\\n' +
            '10^x = ' + Math.pow(10, x).toFixed(6) + '\\n' +
            base + '^x = ' + Math.pow(base, x).toFixed(6);
        } catch(e) { out.value = '错误: ' + e.message; }
      }
      xIn.addEventListener('input', run);
      baseIn.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      run();
    `,
    'network/browser-fingerprint': `
const output = document.getElementById('output');
      async function fingerprint() {
        const info = {};
        info['User-Agent'] = navigator.userAgent;
        info['平台 Platform'] = navigator.platform;
        info['语言 Languages'] = navigator.languages ? navigator.languages.join(', ') : navigator.language;
        info['时区 Timezone'] = Intl.DateTimeFormat().resolvedOptions().timeZone;
        info['时区偏移'] = new Date().getTimezoneOffset() + ' 分钟';
        info['屏幕分辨率'] = screen.width + ' × ' + screen.height;
        info['可用屏幕'] = screen.availWidth + ' × ' + screen.availHeight;
        info['颜色深度'] = screen.colorDepth + ' bit';
        info['设备像素比'] = window.devicePixelRatio;
        info['硬件并发'] = navigator.hardwareConcurrency + ' 核';
        info['设备内存'] = (navigator.deviceMemory || '未知') + ' GB';
        info['触屏支持'] = ('ontouchstart' in window) ? '是' : '否';
        info['Cookie 启用'] = navigator.cookieEnabled ? '是' : '否';
        info['Do Not Track'] = navigator.doNotTrack || '未设置';
        try {
          const c = document.createElement('canvas');
          const ctx = c.getContext('2d');
          ctx.textBaseline = 'top';
          ctx.font = "14px Arial";
          ctx.fillStyle = '#f60';
          ctx.fillRect(125, 1, 62, 20);
          ctx.fillStyle = '#069';
          ctx.fillText('CloverTools-FP', 2, 15);
          info['Canvas 指纹'] = c.toDataURL().slice(0, 80) + '...';
        } catch(e) { info['Canvas 指纹'] = '不支持'; }
        try {
          const gl = document.createElement('canvas').getContext('webgl');
          if (gl) {
            const ext = gl.getExtension('WEBGL_debug_renderer_info');
            info['WebGL 厂商'] = ext ? gl.getParameter(ext.UNMASKED_VENDOR_WEBGL) : '已隐藏';
            info['WebGL 渲染器'] = ext ? gl.getParameter(ext.UNMASKED_RENDERER_WEBGL) : '已隐藏';
          } else info['WebGL'] = '不支持';
        } catch(e) { info['WebGL'] = '检测失败'; }
        info['在线状态'] = navigator.onLine ? '在线' : '离线';
        const lines = Object.entries(info).map(([k,v]) => k + ': ' + v);
        output.value = lines.join('\\n');
      }
      document.getElementById('refresh').onclick = fingerprint;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      fingerprint();
    `,
    'network/mdn-search': `
const query = document.getElementById('query');
      const out = document.getElementById('output');
      const suggestions = ['Array','Map','Promise','async','fetch','localStorage','Canvas','Flexbox','Grid','CSS variables','WebSocket','Event'];
      function go(q) {
        const url = 'https://developer.mozilla.org/zh-CN/search?q=' + encodeURIComponent(q);
        out.value = '搜索关键词: ' + q + '\\n' +
          'MDN 中文搜索: ' + url + '\\n' +
          'MDN 英文搜索: https://developer.mozilla.org/en-US/search?q=' + encodeURIComponent(q) + '\\n\\n' +
          '点击下方按钮在 MDN 打开，或直接复制链接。';
        document.getElementById('openBtn').onclick = () => window.open(url, '_blank');
        document.getElementById('openEnBtn').onclick = () => window.open('https://developer.mozilla.org/en-US/search?q=' + encodeURIComponent(q), '_blank');
      }
      document.getElementById('search').onclick = () => go(query.value.trim() || 'JavaScript');
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      const sugBox = document.getElementById('suggestions');
      suggestions.forEach(s => {
        const b = document.createElement('button');
        b.className = 'btn btn-secondary';
        b.style.cssText = 'margin:.2rem;font-size:.85rem;';
        b.textContent = s;
        b.onclick = () => { query.value = s; go(s); };
        sugBox.appendChild(b);
      });
      go('JavaScript');
    `,
    'network/webhook-test': `
const urlOut = document.getElementById('urlOut');
      const reqLog = document.getElementById('reqLog');
      const payload = document.getElementById('payload');
      const token = 'whk_' + Math.random().toString(36).slice(2, 10);
      const targetUrl = window.location.origin + '/webhook/' + token;
      urlOut.value = targetUrl;
      document.getElementById('copyUrl').onclick = () => copyToClipboard(targetUrl);
      document.getElementById('copyPayload').onclick = () => copyToClipboard(payload.value);
      document.getElementById('send').onclick = async () => {
        try {
          const r = await fetch(targetUrl, { method: 'POST', body: payload.value, headers: {'Content-Type': 'application/json'} });
          reqLog.value = '状态: ' + r.status + '\\n' + '由于浏览器同源策略，本工具生成的 URL 仅作演示。\\n实际场景请使用 webhook.site 等公共服务。';
        } catch(e) {
          reqLog.value = '请求失败（CORS 限制符合预期）: ' + e.message + '\\n\\n推荐使用 https://webhook.site 获取真实的回调 URL';
        }
      };
      const services = [
        'https://webhook.site',
        'https://pipedream.com',
        'https://requestbin.com',
        'https://beeceptor.com',
      ];
      reqLog.value = '本工具生成的 URL: ' + targetUrl + '\\n\\n由于浏览器同源策略，本页无法直接接收外部请求。\\n推荐使用以下公共服务获取真实的回调 URL：\\n' + services.join('\\n');
    `,
    'text/base64-image': `
const fileIn = document.getElementById('file');
      const b64Out = document.getElementById('b64Out');
      const imgOut = document.getElementById('imgOut');
      const b64In = document.getElementById('b64In');
      const imgPreview = document.getElementById('imgPreview');
      fileIn.addEventListener('change', e => {
        const f = e.target.files[0];
        if (!f) return;
        const r = new FileReader();
        r.onload = () => {
          b64Out.value = r.result;
          imgOut.src = r.result;
          imgOut.style.display = 'block';
        };
        r.readAsDataURL(f);
      });
      document.getElementById('copyB64').onclick = () => copyToClipboard(b64Out.value);
      function decodeB64() {
        try {
          const v = b64In.value.trim();
          if (!v) return;
          const dataUrl = v.startsWith('data:') ? v : 'data:image/png;base64,' + v;
          imgPreview.src = dataUrl;
          imgPreview.style.display = 'block';
        } catch(e) { alert('解码失败: ' + e.message); }
      }
      document.getElementById('decode').onclick = decodeB64;
      b64In.addEventListener('input', decodeB64);
    `,
    'text/banned-words': `
const input = document.getElementById('input');
      const output = document.getElementById('output');
      const AD_LAW = ['最','第一','唯一','顶级','国家级','世界级','宇宙级','全网','全网最低','全网首发','100%','百分百','永久','终身','祖传','秘方','神药','包治','包好','无效退款','稳赚','无风险','高收益','躺着赚','刷单','销量冠军','立竿见影'];
      const POLITICS = ['反动','台独','藏独','疆独','港独','法轮','邪教','暴动','政变','颠覆'];
      const PROFESSIONAL = ['最佳','最好','最优','最高级','首家','独有','独家','绝无仅有','绝对','顶级','顶尖','尖端','极品','国家级产品','填补国内空白','中国第一','全网第一','驰名商标','名牌','免检','第一品牌'];
      function check() {
        const text = input.value;
        if (!text.trim()) { output.value = '请输入待检测文本'; return; }
        const found = { '广告法违禁词': [], '敏感政治词': [], '极限词/绝对化用语': [] };
        AD_LAW.forEach(w => { if (text.includes(w)) found['广告法违禁词'].push(w); });
        POLITICS.forEach(w => { if (text.includes(w)) found['敏感政治词'].push(w); });
        PROFESSIONAL.forEach(w => { if (text.includes(w)) found['极限词/绝对化用语'].push(w); });
        let total = 0;
        const lines = [];
        Object.entries(found).forEach(([cat, words]) => {
          if (words.length) { total += words.length; lines.push('【' + cat + '】命中 ' + words.length + ' 个：'); lines.push(words.join('、')); lines.push(''); }
        });
        if (total === 0) lines.push('✓ 未发现违禁词');
        else lines.unshift('合计命中 ' + total + ' 个违禁词\\n');
        output.value = lines.join('\\n');
      }
      document.getElementById('check').onclick = check;
      document.getElementById('clear').onclick = () => { input.value=''; output.value=''; };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', check);
    `,
    'text/typing-speed': `
const TEXT = 'CloverTools 致力于为开发者提供简洁高效的在线工具，所有数据处理均在本地完成，保护您的隐私安全。';
      const target = document.getElementById('target');
      const input = document.getElementById('input');
      const wpmEl = document.getElementById('wpm');
      const cpmEl = document.getElementById('cpm');
      const accEl = document.getElementById('acc');
      const timeEl = document.getElementById('time');
      let startTime = null, finished = false, timerInt = null;
      target.textContent = TEXT;
      function reset() {
        startTime = null; finished = false;
        wpmEl.textContent = '0'; cpmEl.textContent = '0'; accEl.textContent = '100%'; timeEl.textContent = '0s';
        input.value = ''; input.disabled = false; input.focus();
        if (timerInt) clearInterval(timerInt);
      }
      function tick() {
        if (!startTime || finished) return;
        const elapsed = (Date.now() - startTime) / 1000;
        timeEl.textContent = elapsed.toFixed(1) + 's';
      }
      input.addEventListener('input', () => {
        if (finished) return;
        if (!startTime && input.value.length > 0) {
          startTime = Date.now();
          timerInt = setInterval(tick, 100);
        }
        const typed = input.value;
        const elapsed = (Date.now() - startTime) / 60;
        const cpm = elapsed > 0 ? Math.round(typed.length / elapsed) : 0;
        const words = typed.replace(/\s+/g, ' ').trim().split(' ').filter(x => x).length;
        const wpm = elapsed > 0 ? Math.round(words / elapsed) : 0;
        let correct = 0;
        for (let i=0;i<typed.length;i++) if (typed[i] === TEXT[i]) correct++;
        const acc = typed.length > 0 ? Math.round(100*correct/typed.length) : 100;
        wpmEl.textContent = wpm; cpmEl.textContent = cpm; accEl.textContent = acc + '%';
        if (typed === TEXT) {
          finished = true;
          if (timerInt) clearInterval(timerInt);
          input.disabled = true;
        }
      });
      document.getElementById('reset').onclick = reset;
      reset();
    `,
    'code/px-rem': `
const pxIn = document.getElementById('px');
      const remIn = document.getElementById('rem');
      const rootIn = document.getElementById('root');
      const table = document.getElementById('table');
      function calc() {
        const root = parseFloat(rootIn.value) || 16;
        const px = parseFloat(pxIn.value);
        const rem = parseFloat(remIn.value);
        if (Number.isFinite(px)) remIn.value = (px / root).toFixed(4);
        else if (Number.isFinite(rem)) pxIn.value = (rem * root).toFixed(2);
        const sizes = [8,10,12,14,16,18,20,24,28,32,40,48,64,80];
        table.value = '像素 (px) -> REM (根字号 ' + root + ')\\n' + sizes.map(s => s + 'px = ' + (s/root).toFixed(4) + 'rem').join('\\n');
      }
      pxIn.addEventListener('input', () => { if (pxIn.value) { remIn.value=''; calc(); } });
      remIn.addEventListener('input', () => { if (remIn.value) { pxIn.value=''; calc(); } });
      rootIn.addEventListener('input', calc);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(table.value);
      calc();
    `,
    'code/box-shadow': `
const xIn = document.getElementById('x');
      const yIn = document.getElementById('y');
      const blurIn = document.getElementById('blur');
      const spreadIn = document.getElementById('spread');
      const colorIn = document.getElementById('color');
      const alphaIn = document.getElementById('alpha');
      const insetChk = document.getElementById('inset');
      const code = document.getElementById('code');
      const preview = document.getElementById('preview');
      function hexToRgba(hex, a) {
        const h = hex.replace('#','');
        const r = parseInt(h.slice(0,2),16), g = parseInt(h.slice(2,4),16), b = parseInt(h.slice(4,6),16);
        return 'rgba(' + r + ',' + g + ',' + b + ',' + a + ')';
      }
      function update() {
        const x = xIn.value, y = yIn.value, blur = blurIn.value, spread = spreadIn.value;
        const color = hexToRgba(colorIn.value, alphaIn.value);
        const inset = insetChk.checked ? 'inset ' : '';
        const css = 'box-shadow: ' + inset + x + 'px ' + y + 'px ' + blur + 'px ' + spread + 'px ' + color + ';';
        code.value = css;
        preview.style.boxShadow = css;
        document.getElementById('xv').textContent = x;
        document.getElementById('yv').textContent = y;
        document.getElementById('bv').textContent = blur;
        document.getElementById('sv').textContent = spread;
        document.getElementById('av').textContent = alphaIn.value;
      }
      [xIn,yIn,blurIn,spreadIn,colorIn,alphaIn,insetChk].forEach(el => el.addEventListener('input', update));
      document.getElementById('copyOutput').onclick = () => copyToClipboard(code.value);
      update();
    `,
    'encrypt/md5-query': `
const input = document.getElementById('input');
      const output = document.getElementById('output');
      const DICT = {
        'admin':'21232f297a57a5a743894a0e4a801fc3',
        'password':'5f4dcc3b5aa765d61d8327deb882cf99',
        '123456':'e10adc3949ba59abbe56e057f20f883e',
        '12345678':'25d55ad283aa400af464c76d713c07ad',
        'qwerty':'d8578edf8458ce06fbc5bb76a58c5ca4',
        'abc123':'e99a18c428cb38d5f260853678922e03',
        'letmein':'0d107d09f5bbe40cade3de5c71e9e9b7',
        '111111':'96e79218965eb72c92a549dd5a330112',
        'iloveyou':'f25a2fc72690b780b2a14e140ef6a9e0',
        'root':'63a9f0ea7bb98050796b649e85481845',
        'administrator':'200ceb26807d6bf99fd6f4f0d1ca54d4',
        'welcome':'7b502c3a1f48c8609ae212cdfbb639de',
      };
      function run() {
        const q = input.value.trim().toLowerCase();
        if (!q) { output.value = '请输入 MD5 值'; return; }
        const matches = [];
        for (const [plain, hash] of Object.entries(DICT)) {
          if (hash.startsWith(q) || q === hash) matches.push(plain + '  ->  ' + hash);
        }
        if (matches.length) output.value = '找到 ' + matches.length + ' 个匹配（前缀匹配）：\\n' + matches.join('\\n');
        else output.value = '未在本地字典中找到匹配。\\n\\n说明：MD5 是单向哈希，理论上不可逆。\\n本工具使用小型内置字典做前缀匹配演示。\\n在线查询推荐：https://md5decrypt.net';
      }
      document.getElementById('query').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      run();
    `,
    'encrypt/entropy-calc': `
const input = document.getElementById('input');
      const out = document.getElementById('output');
      function calcEntropy(s) {
        if (!s) return 0;
        const freq = {};
        for (const c of s) freq[c] = (freq[c]||0) + 1;
        const len = s.length;
        let h = 0;
        for (const k in freq) {
          const p = freq[k] / len;
          h -= p * Math.log2(p);
        }
        return h;
      }
      function run() {
        const s = input.value;
        if (!s) { out.value = '请输入字符串'; return; }
        const H = calcEntropy(s);
        const bits = (H * s.length).toFixed(2);
        let level = '极弱', score = 0;
        if (H > 3.5) { level = '强'; score = 4; }
        else if (H > 3.0) { level = '良好'; score = 3; }
        else if (H > 2.5) { level = '中等'; score = 2; }
        else if (H > 1.5) { level = '弱'; score = 1; }
        out.value = '输入长度: ' + s.length + ' 字符\\n' +
          '字符集基数: ' + Object.keys([...new Set(s)]).length + ' 个不同字符\\n' +
          '信息熵 H(X) = ' + H.toFixed(4) + ' bits/字符\\n' +
          '总信息量: ' + bits + ' bits\\n' +
          '密码强度: ' + level + ' (' + '★'.repeat(score) + '☆'.repeat(4-score) + ')\\n\\n' +
          '说明：\\n' +
          '• 熵 < 1.5：可预测 (如 1111)\\n' +
          '• 熵 1.5-2.5：弱 (如 1234)\\n' +
          '• 熵 2.5-3.0：中等 (含大小写)\\n' +
          '• 熵 3.0-3.5：良好 (含特殊字符)\\n' +
          '• 熵 > 3.5：强 (随机字符串)';
      }
      document.getElementById('calc').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      input.addEventListener('input', run);
      run();
    `,
    'life/length': `
const val = document.getElementById('val');
      const from = document.getElementById('from');
      const out = document.getElementById('output');
      const TO_M = {
        'km': 1000, 'm': 1, 'dm': 0.1, 'cm': 0.01, 'mm': 0.001,
        'um': 1e-6, 'nm': 1e-9,
        'mile': 1609.344, 'yard': 0.9144, 'foot': 0.3048, 'inch': 0.0254,
        'nautical-mile': 1852, 'li': 500, 'chi': 0.333, 'cun': 0.0333,
        'light-year': 9.461e15, 'astronomical': 1.496e11,
      };
      const NAMES = {
        'km':'千米','m':'米','dm':'分米','cm':'厘米','mm':'毫米','um':'微米','nm':'纳米',
        'mile':'英里','yard':'码','foot':'英尺','inch':'英寸','nautical-mile':'海里',
        'li':'里','chi':'尺','cun':'寸',
        'light-year':'光年','astronomical':'天文单位',
      };
      function run() {
        const v = parseFloat(val.value);
        if (!Number.isFinite(v)) { out.value = '请输入有效数值'; return; }
        const meters = v * TO_M[from.value];
        const lines = [];
        Object.entries(TO_M).forEach(([k, factor]) => {
          const r = meters / factor;
          lines.push((NAMES[k] + ' (' + k + ')').padEnd(14,' ') + ': ' + r.toPrecision(8));
        });
        out.value = lines.join('\\n');
      }
      val.addEventListener('input', run);
      from.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      run();
    `,
    'life/temperature': `
const val = document.getElementById('val');
      const from = document.getElementById('from');
      const out = document.getElementById('output');
      function toC(v, f) {
        if (f==='C') return v;
        if (f==='F') return (v - 32) * 5 / 9;
        if (f==='K') return v - 273.15;
        if (f==='R') return (v - 491.67) * 5 / 9;
      }
      function fromC(c, f) {
        if (f==='C') return c;
        if (f==='F') return c * 9/5 + 32;
        if (f==='K') return c + 273.15;
        if (f==='R') return (c + 273.15) * 9/5;
      }
      function run() {
        const v = parseFloat(val.value);
        if (!Number.isFinite(v)) { out.value = '请输入有效数值'; return; }
        const c = toC(v, from.value);
        const r = {
          '摄氏度 C': fromC(c,'C'),
          '华氏度 F': fromC(c,'F'),
          '开尔文 K': fromC(c,'K'),
          '兰氏度 R': fromC(c,'R'),
        };
        out.value = Object.entries(r).map(([k,v]) => k + ': ' + v.toFixed(4)).join('\\n') + '\\n\\n--- 常用温度参考 ---\\n' +
          '水结冰:  0C = 32F = 273.15 K\\n' +
          '水沸腾: 100C = 212F = 373.15 K\\n' +
          '人体体温: 37C = 98.6F = 310.15 K\\n' +
          '绝对零度: -273.15C = -459.67F = 0 K';
      }
      val.addEventListener('input', run);
      from.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      run();
    `,
    'life/lucky-number': `
const nameIn = document.getElementById('name');
      const birthIn = document.getElementById('birth');
      const countIn = document.getElementById('count');
      const out = document.getElementById('output');
      function hashCode(s) {
        let h = 0;
        for (let i=0;i<s.length;i++) h = (h*31 + s.charCodeAt(i)) & 0xffffffff;
        return Math.abs(h);
      }
      function dateSeed(date) {
        const d = new Date(date);
        return d.getFullYear()*10000 + (d.getMonth()+1)*100 + d.getDate();
      }
      const ZODIAC = ['摩羯','水瓶','双鱼','白羊','金牛','双子','巨蟹','狮子','处女','天秤','天蝎','射手'];
      function zodiac(month, day) {
        const edges = [[1,20],[2,19],[3,21],[4,20],[5,21],[6,22],[7,23],[8,23],[9,23],[10,24],[11,23],[12,22]];
        let i = month - 1;
        if (day < edges[i][1]) i = (i + 11) % 12;
        return ZODIAC[i];
      }
      const SHENGXIAO = ['猴','鸡','狗','猪','鼠','牛','虎','兔','龙','蛇','马','羊'];
      function shengxiao(year) { return SHENGXIAO[year % 12]; }
      function run() {
        const name = (nameIn.value || '匿名').trim();
        const birth = birthIn.value || '1990-01-01';
        const count = Math.max(1, Math.min(20, parseInt(countIn.value)||5));
        const ds = dateSeed(birth);
        const nameHash = hashCode(name);
        const [y, m, d] = birth.split('-').map(Number);
        const z = zodiac(m, d);
        const sx = shengxiao(y);
        const baseSeed = (ds + nameHash) >>> 0;
        const nums = [];
        for (let i=0;i<count;i++) {
          let s = (baseSeed + i*2654435761) >>> 0;
          s = (s + 0x6D2B79F5) >>> 0;
          let t = s;
          t = Math.imul(t ^ (t >>> 15), t | 1);
          t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
          const r = ((t ^ (t >>> 14)) >>> 0) / 4294967296;
          const num = Math.floor(r * 100) + 1;
          nums.push(num);
        }
        const colors = ['红','橙','黄','绿','青','蓝','紫','金','银','白'];
        const luckyColor = colors[nameHash % colors.length];
        out.value = '姓名: ' + name + '\\n' +
          '生日: ' + birth + '\\n' +
          '星座: ' + z + '\\n' +
          '生肖: ' + sx + '\\n' +
          '幸运色: ' + luckyColor + '\\n\\n' +
          '您的 ' + count + ' 个幸运数字:\\n' + nums.join('、') + '\\n\\n' +
          '（基于姓名哈希 + 生日种子的稳定伪随机）';
      }
      document.getElementById('gen').onclick = run;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(out.value);
      run();
    `,
  };

  // Custom-script override (for tool-custom entries with customScript field)
  if (tool.customScript) return tool.customScript;
  return scripts[key] || `// TODO: implement ${tool.path}`;
}

// ============ Tool content HTML builders ============
function buildToolContentHtml(tool) {
  // Custom-HTML override (for tool-custom entries with customHtml field)
  if (tool.customHtml) return tool.customHtml;
  const key = stripExt(tool.path);
  const contents = {
    'json/formatter': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="粘贴 JSON 数据..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="format">格式化</button>
          <button class="btn btn-secondary" id="minify">压缩</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'encrypt/base64': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="encode">编码</button>
          <button class="btn btn-secondary" id="decode">解码</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'encrypt/url': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 URL 或字符串..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="encode">编码</button>
          <button class="btn btn-secondary" id="decode">解码</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'encrypt/hex': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本或十六进制（空格分隔）..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="toHex">文本 → 十六进制</button>
          <button class="btn btn-secondary" id="fromHex">十六进制 → 文本</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'other/uuid': `
      <div class="output-box">
        <h3>UUID <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="font-size:1.1rem;letter-spacing:0.05em;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="generate">重新生成</button>
        </div>
      </div>`,

    'other/nanoid': `
      <div class="output-box">
        <h3>Nano ID <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="font-size:1.1rem;letter-spacing:0.05em;"></textarea>
        <div class="options-row">
          <label>长度: <input type="number" id="length" value="21" min="1" max="100" style="width:60px;padding:0.3rem;"></label>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="generate">重新生成</button>
        </div>
      </div>`,

    'other/password': `
      <div class="output-box">
        <h3>密码 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="font-size:1.1rem;letter-spacing:0.08em;"></textarea>
        <div class="options-row">
          <label>长度: <input type="number" id="length" value="16" min="4" max="128" style="width:60px;padding:0.3rem;"></label>
          <label><input type="checkbox" id="special" checked> 包含特殊字符</label>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="generate">重新生成</button>
        </div>
      </div>`,

    'other/HTTP协议状态码': `
      <div class="tool-card">
        <h3>🔍 HTTP 状态码查询</h3>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <input type="text" id="searchInput" placeholder="按状态码或名称搜索，如 404 或 Not Found..." style="flex:1;min-width:180px;padding:0.6rem 0.75rem;font-family:monospace;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.95rem;">
          <select id="categoryFilter" style="padding:0.6rem 0.75rem;border:1px solid var(--border);border-radius:8px;background:var(--bg);color:var(--text);font-size:0.95rem;">
            <option value="all">全部分类</option>
            <option value="1">1xx 信息响应</option>
            <option value="2">2xx 成功</option>
            <option value="3">3xx 重定向</option>
            <option value="4">4xx 客户端错误</option>
            <option value="5">5xx 服务器错误</option>
          </select>
          <label style="display:flex;align-items:center;gap:0.3rem;cursor:pointer;padding:0.4rem 0.75rem;border-radius:8px;background:var(--bg-secondary);font-size:0.9rem;white-space:nowrap;">
            <input type="checkbox" id="favOnly" style="width:16px;height:16px;"> 仅看常用
          </label>
        </div>
        <div id="statusBar" style="font-size:0.85rem;opacity:0.65;margin-bottom:0.5rem;">共 0 条结果</div>
        <div id="codeList" style="display:grid;gap:0.6rem;"></div>
      </div>
      <div class="output-box">
        <h3>💡 状态码分类说明</h3>
        <ul style="margin:0.5rem 0 0 1.25rem;line-height:1.8;font-size:0.92rem;">
          <li><b style="color:#3b82f6;">1xx 信息响应</b>：请求已收到，继续处理</li>
          <li><b style="color:#10b981;">2xx 成功</b>：请求已成功被服务器接收、理解并接受</li>
          <li><b style="color:#f59e0b;">3xx 重定向</b>：需要后续操作才能完成这一请求</li>
          <li><b style="color:#f97316;">4xx 客户端错误</b>：请求含有词法错误或者无法被执行</li>
          <li><b style="color:#ef4444;">5xx 服务器错误</b>：服务器在处理某个正确请求时发生错误</li>
          <li>点击任意状态码卡片可展开/收起详细说明；点击“★ 收藏”可加入常用列表</li>
        </ul>
      </div>
      <style>
        .http-card{background:var(--bg);border:1px solid var(--border);border-radius:10px;padding:0.85rem 1rem;transition:border-color .2s,transform .15s;cursor:pointer;}
        .http-card:hover{border-color:var(--primary);transform:translateY(-1px);}
        .http-card.fav{border-color:var(--primary);background:var(--bg-secondary);}
        .http-row1{display:flex;align-items:center;gap:0.75rem;flex-wrap:wrap;}
        .http-badge{display:inline-block;min-width:62px;padding:0.25rem 0.55rem;border-radius:6px;font-family:'SF Mono','Monaco',monospace;font-weight:700;text-align:center;color:#fff;font-size:0.95rem;letter-spacing:0.02em;}
        .b-1{background:#3b82f6;}
        .b-2{background:#10b981;}
        .b-3{background:#f59e0b;}
        .b-4{background:#f97316;}
        .b-5{background:#ef4444;}
        .http-name{font-weight:600;font-size:1rem;color:var(--text);}
        .http-class{font-size:0.78rem;opacity:0.55;margin-left:0.3rem;}
        .http-fav-btn{margin-left:auto;background:none;border:1px solid var(--border);border-radius:6px;padding:0.25rem 0.55rem;cursor:pointer;font-size:0.85rem;color:var(--text-secondary);transition:all .15s;}
        .http-fav-btn:hover{border-color:var(--primary);color:var(--primary);}
        .http-fav-btn.active{background:var(--primary);color:#fff;border-color:var(--primary);}
        .http-detail{max-height:0;overflow:hidden;transition:max-height .3s ease;}
        .http-detail.open{max-height:600px;}
        .http-desc{margin-top:0.6rem;padding-top:0.6rem;border-top:1px dashed var(--border);font-size:0.92rem;line-height:1.7;color:var(--text-secondary);}
        .http-scenario{background:var(--bg-secondary);padding:0.45rem 0.7rem;border-radius:6px;margin-top:0.5rem;font-size:0.85rem;line-height:1.6;}
        .http-scenario b{color:var(--primary);}
        .http-tag{display:inline-block;padding:0.1rem 0.45rem;border-radius:4px;font-size:0.7rem;background:var(--bg-secondary);color:var(--text-secondary);margin-left:0.3rem;font-weight:500;}
        .http-empty{text-align:center;padding:2rem 1rem;opacity:0.55;font-size:0.95rem;}
      </style>`,

    'time/timestamp': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>当前时间戳</h3>
          <textarea id="nowOutput" readonly style="font-size:1.2rem;text-align:center;"></textarea>
          <div class="btn-row">
            <button class="btn btn-secondary" id="copyNow">复制 ms</button>
          </div>
        </div>
        <div class="tool-card">
          <h3>转换</h3>
          <label style="font-size:0.85rem;opacity:0.7;margin-bottom:0.3rem;display:block;">时间戳 → 日期</label>
          <input type="text" id="tsInput" placeholder="毫秒或秒级时间戳" style="margin-bottom:0.5rem;">
          <button class="btn btn-primary" id="toDate" style="margin-bottom:1rem;">转换</button>
          <label style="font-size:0.85rem;opacity:0.7;margin-bottom:0.3rem;display:block;">日期 → 时间戳</label>
          <input type="text" id="dateInput" placeholder="2024-01-01 12:00:00" style="margin-bottom:0.5rem;">
          <button class="btn btn-secondary" id="toTs">转换</button>
        </div>
        <div class="tool-card">
          <h3>转换结果</h3>
          <label style="font-size:0.85rem;opacity:0.7;margin-bottom:0.3rem;display:block;">毫秒</label>
          <div style="display:flex;gap:0.5rem;margin-bottom:1rem;">
            <input type="text" id="tsOutput" readonly style="flex:1;">
            <button class="btn btn-secondary" id="copyTs">复制</button>
          </div>
          <label style="font-size:0.85rem;opacity:0.7;margin-bottom:0.3rem;display:block;">日期</label>
          <input type="text" id="dateOutput" readonly>
        </div>
      </div>`,

    'encrypt/md5': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本..."></textarea>
        <p style="font-size:0.8rem;opacity:0.6;margin-top:0.5rem;">注：浏览器不支持 MD5，使用 SHA-256 代替</p>
      </div>
      <div class="output-box">
        <h3>哈希值 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'encrypt/sha': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本..."></textarea>
        <div style="margin-top:0.5rem;">
          <select id="algo" style="padding:0.4rem;">
            <option value="SHA-1">SHA-1</option>
            <option value="SHA-256" selected>SHA-256</option>
            <option value="SHA-384">SHA-384</option>
            <option value="SHA-512">SHA-512</option>
          </select>
        </div>
      </div>
      <div class="output-box">
        <h3>哈希值 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'encrypt/Shake加密': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本..." style="min-height:120px;"></textarea>
        <div style="margin-top:0.75rem;display:flex;flex-wrap:wrap;gap:0.75rem;align-items:center;">
          <label style="display:flex;align-items:center;gap:0.4rem;">
            <span style="opacity:0.8;">算法:</span>
            <select id="algo" style="padding:0.4rem;">
              <option value="SHAKE128">SHAKE128 (rate=168)</option>
              <option value="SHAKE256" selected>SHAKE256 (rate=136)</option>
            </select>
          </label>
          <label style="display:flex;align-items:center;gap:0.4rem;">
            <span style="opacity:0.8;">输出字节:</span>
            <input id="outLen" type="number" min="1" max="1024" value="64" style="padding:0.4rem;width:90px;">
          </label>
        </div>
        <p style="font-size:0.78rem;opacity:0.65;margin-top:0.5rem;line-height:1.5;">
          SHAKE (Secure Hash Algorithm KECCAK) 属于 FIPS 202 可变长输出扩展函数（FIPS 202 中的 SHA-3 系列）。
          本工具使用纯 JS 实现 Keccak-f[1600] 置换、SHAKE128/256 吸收/挤压阶段，无外部依赖、支持任意字节长度（1-1024）。
        </p>
      </div>
      <div class="output-box">
        <h3>十六进制 (Hex) <button class="copy-btn" id="copyHex">复制</button></h3>
        <textarea id="hexOut" readonly style="word-break:break-all;"></textarea>
      </div>
      <div class="output-box">
        <h3>Base64 <button class="copy-btn" id="copyB64">复制</button></h3>
        <textarea id="b64Out" readonly style="word-break:break-all;"></textarea>
      </div>
      <p id="meta" style="font-size:0.8rem;opacity:0.7;margin-top:0.5rem;"></p>`,

    'encrypt/unicode': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入文本..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="toUnicode">→ Unicode</button>
          <button class="btn btn-secondary" id="fromUnicode">← Unicode</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'text/case': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入文本..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="upper">UPPERCASE</button>
          <button class="btn btn-secondary" id="lower">lowercase</button>
          <button class="btn btn-secondary" id="title">Title Case</button>
          <button class="btn btn-secondary" id="swap">sWAP cASE</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'text/count': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入文本统计..."></textarea>
      </div>
      <div class="tool-card">
        <h3>统计结果</h3>
        <div id="result" style="font-size:1rem;line-height:1.8;"></div>
      </div>`,

    'text/camel': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 snake_case 或 camelCase..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="toCamel">→ camelCase</button>
          <button class="btn btn-secondary" id="fromCamel">→ snake_case</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'json/yaml': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 JSON 或 YAML..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="toYaml">JSON → YAML</button>
          <button class="btn btn-secondary" id="toJson">YAML → JSON</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'json/xml': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 JSON 或 XML..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="toXml">JSON → XML</button>
          <button class="btn btn-secondary" id="toJson">XML → JSON</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'json/table': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>JSON 数据</h3>
          <textarea id="input" placeholder="输入 JSON 数组，如:&#10;[&#10;  {&quot;name&quot;:&quot;张三&quot;,&quot;age&quot;:20},&#10;  {&quot;name&quot;:&quot;李四&quot;,&quot;age&quot;:22}&#10;]" style="min-height:200px;font-family:monospace;font-size:0.85rem;"></textarea>
        </div>
        <div class="tool-card">
          <h3>表格</h3>
          <div class="table-toolbar">
            <input type="text" id="searchInput" placeholder="🔍 搜索..." style="flex:1;padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;">
            <button class="btn btn-secondary" id="copyTable" style="white-space:nowrap;">复制表格 HTML</button>
          </div>
          <div id="tableContainer" style="overflow:auto;max-height:500px;margin-top:0.75rem;"></div>
          <div class="pagination">
            <button class="btn btn-secondary" id="prevPage">上一页</button>
            <span id="pageInfo" style="padding:0 1rem;font-size:0.9rem;"></span>
            <button class="btn btn-secondary" id="nextPage">下一页</button>
          </div>
        </div>
      </div>
      <style>
        .table-toolbar { display: flex; gap: 0.5rem; align-items: center; flex-wrap: wrap; }
        .json-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .json-table th { background: var(--primary); color: #fff; padding: 0.5rem 0.75rem; text-align: left; position: sticky; top: 0; cursor: pointer; user-select: none; }
        .json-table th:hover { background: #3b82f6; }
        .json-table td { padding: 0.4rem 0.75rem; border-bottom: 1px solid var(--border); max-width: 200px; overflow: hidden; text-overflow: ellipsis; white-space: nowrap; }
        .json-table tr:hover td { background: var(--bg-secondary); }
        .pagination { display: flex; justify-content: center; align-items: center; margin-top: 0.75rem; gap: 0.5rem; }
      </style>`,

    'code/markdown': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>Markdown 输入</h3>
          <textarea id="input" placeholder="输入 Markdown 文本..." style="min-height:300px;font-family:monospace;"></textarea>
        </div>
        <div class="tool-card">
          <h3>实时预览</h3>
          <div id="preview" class="md-preview" style="min-height:300px;padding:1rem;overflow-y:auto;"></div>
        </div>
      </div>
      <div class="output-box">
        <h3>HTML 代码 <button class="copy-btn" id="copyHtml">复制 HTML</button></h3>
        <textarea id="htmlOutput" readonly style="font-family:monospace;font-size:0.85rem;"></textarea>
      </div>`,

    'code/html': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 HTML 代码..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="format">格式化</button>
          <button class="btn btn-secondary" id="minify">压缩</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'code/css': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 CSS 代码..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="format">格式化</button>
          <button class="btn btn-secondary" id="minify">压缩</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'code/javascript': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入 JavaScript 代码..."></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="format">格式化</button>
          <button class="btn btn-secondary" id="minify">压缩</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`,

    'text/diff': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>原文</h3>
          <textarea id="input1" placeholder="输入第一段文本..."></textarea>
        </div>
        <div class="tool-card">
          <h3>对比</h3>
          <textarea id="input2" placeholder="输入第二段文本..."></textarea>
        </div>
      </div>
      <div class="tool-card">
        <h3>差异</h3>
        <div id="output" style="max-height:400px;overflow-y:auto;"></div>
      </div>`,

    'text/pinyin': `
      <div class="tool-card">
        <h3>输入中文</h3>
        <textarea id="input" placeholder="输入汉字..." style="min-height:80px;"></textarea>
      </div>
      <div class="output-box">
        <h3>拼音 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="font-size:1.2rem;"></textarea>
      </div>`,

    'text/extract': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入包含邮箱、手机号、链接的文本..." style="min-height:100px;"></textarea>
      </div>
      <div class="tool-card">
        <h3>提取结果</h3>
        <div id="output" style="line-height:1.8;"></div>
      </div>`,

    'life/price-compare': `
      <div class="tool-card">
        <h3>添加商品</h3>
        <div id="products" class="products-container"></div>
        <button class="btn btn-primary" id="addProduct" style="margin-top:1rem;">+ 添加商品</button>
      </div>
      <style>
        .products-container { display: flex; flex-direction: column; gap: 1rem; }
        .product-row { background: var(--bg-secondary); border-radius: 12px; padding: 1rem; border: 2px solid transparent; transition: border-color 0.2s; }
        .product-row.winner { border-color: #22c55e; background: #f0fdf4; }
        .product-meta { display: flex; justify-content: space-between; align-items: center; margin-bottom: 0.75rem; }
        .product-meta input { flex: 1; border: none; background: transparent; font-size: 1rem; font-weight: 600; color: var(--text); padding: 0; }
        .product-meta input:focus { outline: none; }
        .product-meta input::placeholder { color: var(--text-secondary); }
        .btn-remove { background: none; border: none; font-size: 1.2rem; color: var(--text-secondary); cursor: pointer; padding: 0 0.5rem; }
        .btn-remove:hover { color: #ef4444; }
        .product-fields { display: grid; grid-template-columns: 1fr auto 1fr; gap: 0.75rem; align-items: end; }
        .field-group { display: flex; flex-direction: column; gap: 0.25rem; }
        .field-group label { font-size: 0.75rem; color: var(--text-secondary); }
        .field-group input, .field-group select { padding: 0.5rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--bg); color: var(--text); }
        .field-group input:focus, .field-group select:focus { outline: none; border-color: var(--primary); }
        .p-unit { width: 80px; }
        .product-result { margin-top: 0.75rem; padding-top: 0.75rem; border-top: 1px dashed var(--border); text-align: center; }
        .unit-price { font-size: 1.3rem; font-weight: 700; color: var(--primary); }
        .winner .unit-price { color: #16a34a; }
        @media (max-width: 600px) { .product-fields { grid-template-columns: 1fr 1fr; } .field-group:nth-child(2) { grid-column: 1 / -1; } }
      </style>
    `,

    'text/garble-fix': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>乱码文本</h3>
          <textarea id="input" placeholder="粘贴乱码文本，如: �ļ���  %E4%B8%AD  \\u4e2d  &#x4e2d;" style="min-height:120px;"></textarea>
          <div class="btn-row" style="flex-wrap:wrap;gap:0.4rem;margin-top:0.5rem;">
            <button class="btn btn-primary" id="autoFix">🔍 自动修复</button>
            <label style="font-size:0.8rem;display:flex;align-items:center;gap:0.2rem;"><input type="checkbox" id="autoOn" checked> 输入时自动</label>
          </div>
        </div>
        <div class="tool-card">
          <h3>修复结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
          <textarea id="output" readonly style="min-height:120px;" placeholder="修复后文本"></textarea>
        </div>
      </div>
      <div class="tool-card">
        <h3>手动修复方式</h3>
        <div class="btn-row" style="flex-wrap:wrap;gap:0.4rem;">
          <button class="btn btn-secondary" id="fixUtf8AsGbk">UTF-8 当 GBK 解读</button>
          <button class="btn btn-secondary" id="fixGbkAsUtf8">GBK 当 UTF-8 解读</button>
          <button class="btn btn-secondary" id="fixUnicodeEscapes">Unicode 转义序列</button>
          <button class="btn btn-secondary" id="fixHtmlEntities">HTML 实体编码</button>
          <button class="btn btn-secondary" id="fixUrlEncoding">URL 编码</button>
        </div>
        <p style="font-size:0.78rem;opacity:0.6;margin-top:0.5rem;">
          💡 自动修复会依次尝试各种编码方式，检测到有效中文即停止。如自动结果不理想，可手动选择具体编码方式。
        </p>
      </div>`,

    'time/countdown': `
      <div class="tool-card">
        <h3>目标时间</h3>
        <input type="datetime-local" id="target" style="width:100%;padding:0.5rem;font-size:1rem;">
        <div class="btn-row">
          <button class="btn btn-primary" id="start">开始倒计时</button>
        </div>
      </div>
      <div class="output-box">
        <h3>剩余时间</h3>
        <div id="result" style="font-size:1.5rem;text-align:center;padding:1rem;"></div>
      </div>`,

    'time/interval': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>开始日期</h3>
          <input type="date" id="start" style="width:100%;padding:0.5rem;font-size:1rem;">
        </div>
        <div class="tool-card">
          <h3>结束日期</h3>
          <input type="date" id="end" style="width:100%;padding:0.5rem;font-size:1rem;">
        </div>
      </div>
      <div class="output-box">
        <h3>间隔</h3>
        <div id="result" style="font-size:1.1rem;padding:1rem;"></div>
      </div>`,

    'time/age': `
      <div class="tool-card">
        <h3>你的生日</h3>
        <input type="date" id="birth" style="width:100%;padding:0.5rem;font-size:1rem;">
      </div>
      <div class="output-box">
        <h3>计算结果</h3>
        <div id="result" style="font-size:1.2rem;padding:1rem;"></div>
      </div>`,

    'time/world': `
      <div class="tool-card">
        <h3>世界各地时间</h3>
        <div id="zones" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:0.5rem;"></div>
      </div>`,

    'time/world-clock': `
      <div class="world-clock-container">
        <div class="ntp-panel">
          <div class="ntp-header">
            <div class="ntp-status-dot" id="ntpDot"></div>
            <span id="ntpLabel">正在连接 NTP 服务器...</span>
          </div>
          <div class="local-time-display" id="localTimeDisplay">
            <div class="time-main" id="timeMain">--:--:--</div>
            <div class="time-meta" id="timeMeta">----年--月--日 星期--</div>
          </div>
          <div class="ntp-detail" id="ntpDetail">本地时间精度：±1秒</div>
        </div>

        <div class="converter-panel">
          <h3>时间转换</h3>
          <div class="converter-row">
            <div class="conv-group">
              <label>源时间</label>
              <input type="time" id="convTime" value="12:00:00">
            </div>
            <div class="conv-group">
              <label>源时区</label>
              <select id="convFromZone">
                <option value="-12">UTC-12</option>
                <option value="-11">UTC-11</option>
                <option value="-10">UTC-10</option>
                <option value="-9">UTC-9</option>
                <option value="-8">UTC-8 (洛杉矶)</option>
                <option value="-7">UTC-7</option>
                <option value="-6">UTC-6</option>
                <option value="-5">UTC-5 (纽约)</option>
                <option value="-4">UTC-4</option>
                <option value="-3">UTC-3 (圣保罗)</option>
                <option value="-2">UTC-2</option>
                <option value="-1">UTC-1</option>
                <option value="0" selected>UTC (伦敦)</option>
                <option value="1">UTC+1 (巴黎)</option>
                <option value="2">UTC+2 (开罗)</option>
                <option value="3">UTC+3 (莫斯科)</option>
                <option value="4">UTC+4 (迪拜)</option>
                <option value="5">UTC+5</option>
                <option value="6">UTC+6</option>
                <option value="7">UTC+7 (曼谷)</option>
                <option value="8" selected>UTC+8 (北京时间)</option>
                <option value="9">UTC+9 (东京)</option>
                <option value="10">UTC+10 (悉尼)</option>
                <option value="11">UTC+11</option>
                <option value="12">UTC+12</option>
              </select>
            </div>
          </div>
          <div class="conv-results" id="convResults"></div>
        </div>

        <div class="world-clock-panel">
          <h3>世界时钟</h3>
          <div class="clock-grid" id="clockGrid"></div>
        </div>
      </div>
      <style>
        .world-clock-container { display: flex; flex-direction: column; gap: 1.5rem; }
        .ntp-panel { background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; text-align: center; border: 1px solid var(--border); }
        .ntp-header { display: flex; align-items: center; justify-content: center; gap: 0.5rem; margin-bottom: 1rem; }
        .ntp-status-dot { width: 10px; height: 10px; border-radius: 50%; background: #f59e0b; transition: background 0.3s; }
        .ntp-status-dot.online { background: #22c55e; box-shadow: 0 0 6px #22c55e; }
        .ntp-status-dot.offline { background: #ef4444; }
        #ntpLabel { font-size: 0.85rem; color: var(--text-secondary); }
        .local-time-display { margin-bottom: 0.5rem; }
        .time-main { font-size: 3.5rem; font-weight: 700; letter-spacing: 0.08em; font-family: 'SF Mono', 'Fira Code', monospace; color: var(--text); line-height: 1; }
        .time-meta { font-size: 1rem; color: var(--text-secondary); margin-top: 0.5rem; }
        .ntp-detail { font-size: 0.75rem; color: var(--text-secondary); opacity: 0.7; margin-top: 0.3rem; }
        .converter-panel { background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--border); }
        .converter-panel h3 { margin: 0 0 1rem; font-size: 1rem; }
        .converter-row { display: flex; gap: 1rem; flex-wrap: wrap; align-items: end; margin-bottom: 1rem; }
        .conv-group { display: flex; flex-direction: column; gap: 0.3rem; flex: 1; min-width: 140px; }
        .conv-group label { font-size: 0.75rem; color: var(--text-secondary); }
        .conv-group input, .conv-group select { padding: 0.5rem 0.6rem; border: 1px solid var(--border); border-radius: 8px; font-size: 0.9rem; background: var(--bg); color: var(--text); }
        .conv-group input:focus, .conv-group select:focus { outline: none; border-color: var(--primary); }
        .conv-results { display: grid; grid-template-columns: repeat(auto-fill, minmax(130px, 1fr)); gap: 0.5rem; }
        .conv-result-card { background: var(--bg); border-radius: 10px; padding: 0.75rem; border: 1px solid var(--border); text-align: center; }
        .conv-result-card .city { font-size: 0.75rem; color: var(--text-secondary); margin-bottom: 0.25rem; }
        .conv-result-card .result-time { font-size: 1.1rem; font-weight: 600; font-family: 'SF Mono', monospace; }
        .conv-result-card .result-offset { font-size: 0.7rem; color: var(--text-secondary); opacity: 0.7; }
        .world-clock-panel { background: var(--bg-secondary); border-radius: 16px; padding: 1.5rem; border: 1px solid var(--border); }
        .world-clock-panel h3 { margin: 0 0 1rem; font-size: 1rem; }
        .clock-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(120px, 1fr)); gap: 0.6rem; }
        .clock-card { background: var(--bg); border-radius: 12px; padding: 0.9rem 0.75rem; border: 1px solid var(--border); text-align: center; transition: border-color 0.2s; }
        .clock-card:hover { border-color: var(--primary); }
        .clock-card .city { font-size: 0.8rem; color: var(--text-secondary); margin-bottom: 0.3rem; }
        .clock-card .time { font-size: 1.3rem; font-weight: 700; font-family: 'SF Mono', monospace; letter-spacing: 0.04em; }
        .clock-card .offset { font-size: 0.7rem; color: var(--text-secondary); opacity: 0.6; margin-top: 0.2rem; }
        .clock-card .date { font-size: 0.7rem; color: var(--text-secondary); opacity: 0.8; }
      </style>`,

    'other/hex-convert': `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="输入数字..." style="margin-bottom:0.5rem;"></textarea>
        <label>原始进制: <select id="base"><option value="2">二进制</option><option value="8">八进制</option><option value="10" selected>十进制</option><option value="16">十六进制</option></select></label>
      </div>
      <div class="output-box">
        <h3>转换结果</h3>
        <div id="output" style="font-family:monospace;padding:0.5rem;background:#f5f5f5;border-radius:8px;line-height:1.6;"></div>
      </div>`,

    'other/color': `
      <div class="tool-card">
        <h3>颜色选择器</h3>
        <input type="color" id="picker" value="#c70039" style="width:100%;height:50px;border:none;cursor:pointer;">
      </div>
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>HEX</h3>
          <input type="text" id="hex" value="#c70039" style="width:100%;padding:0.5rem;font-family:monospace;">
        </div>
        <div class="tool-card">
          <h3>RGB</h3>
          <input type="text" id="rgb" value="199,0,57" style="width:100%;padding:0.5rem;font-family:monospace;">
        </div>
      </div>
      <div id="preview" style="height:60px;border-radius:12px;margin-top:1rem;"></div>`,

    'other/regex': `
      <div class="tool-card">
        <h3>正则表达式</h3>
        <input type="text" id="pattern" placeholder="例如: \\d+" style="width:100%;padding:0.5rem;font-family:monospace;margin-bottom:0.5rem;">
        <label>标志: <input type="text" id="flags" value="g" style="width:60px;padding:0.3rem;"></label>
      </div>
      <div class="tool-card">
        <h3>测试文本</h3>
        <textarea id="input" placeholder="输入要匹配的文本..." style="min-height:80px;"></textarea>
      </div>
      <div class="tool-card">
        <h3>匹配结果</h3>
        <div id="output" style="line-height:1.6;"></div>
      </div>`,

    'other/键盘按键值大全': `
      <div class="tool-card">
        <h3>⌨️ 实时按键监听</h3>
        <p style="font-size:0.85rem;opacity:0.7;margin:0.25rem 0 0.75rem;">将焦点放在下方输入框或任意位置，然后按下任意键查看对应的 keyCode / code / key 值</p>
        <div id="liveArea" tabindex="0" style="padding:1.25rem;border:2px dashed var(--border);border-radius:12px;background:var(--bg-secondary);text-align:center;cursor:text;outline:none;transition:border-color .2s,background .2s;">
          <div style="opacity:0.55;font-size:0.9rem;margin-bottom:0.75rem;">👇 点击此处后按键</div>
          <div id="liveResult" style="display:grid;grid-template-columns:repeat(auto-fit,minmax(140px,1fr));gap:0.75rem;">
            <div style="background:var(--bg);padding:0.75rem;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;">key</div>
              <div id="liveKey" style="font-size:1.2rem;font-weight:600;font-family:'SF Mono',monospace;margin-top:0.2rem;word-break:break-all;">-</div>
            </div>
            <div style="background:var(--bg);padding:0.75rem;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;">code</div>
              <div id="liveCode" style="font-size:1.2rem;font-weight:600;font-family:'SF Mono',monospace;margin-top:0.2rem;word-break:break-all;">-</div>
            </div>
            <div style="background:var(--bg);padding:0.75rem;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;">keyCode</div>
              <div id="liveKeyCode" style="font-size:1.2rem;font-weight:600;font-family:'SF Mono',monospace;margin-top:0.2rem;">-</div>
            </div>
            <div style="background:var(--bg);padding:0.75rem;border-radius:8px;border:1px solid var(--border);">
              <div style="font-size:0.7rem;opacity:0.6;text-transform:uppercase;letter-spacing:0.05em;">location</div>
              <div id="liveLocation" style="font-size:1rem;font-weight:500;margin-top:0.2rem;">-</div>
            </div>
          </div>
        </div>
      </div>
      <div class="tool-card">
        <h3>🔍 查询按键表</h3>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-bottom:0.75rem;">
          <input type="text" id="searchInput" placeholder="搜索 key / code / keyCode..." style="flex:1;min-width:180px;padding:0.5rem 0.75rem;font-family:monospace;border:1px solid var(--border);border-radius:6px;background:var(--bg);">
          <select id="catFilter" style="padding:0.5rem;border:1px solid var(--border);border-radius:6px;background:var(--bg);">
            <option value="all">全部分类</option>
            <option value="letter">字母 (A-Z)</option>
            <option value="digit">数字 (0-9)</option>
            <option value="function">功能键 (F1-F12)</option>
            <option value="control">控制键 (Enter/Tab/Esc/...)</option>
            <option value="arrow">方向键</option>
            <option value="modifier">修饰键 (Ctrl/Shift/Alt/Meta)</option>
            <option value="numpad">小键盘</option>
          </select>
        </div>
        <p id="resultCount" style="font-size:0.85rem;opacity:0.65;margin:0 0 0.5rem;">共 0 个按键</p>
        <div style="overflow-x:auto;border:1px solid var(--border);border-radius:8px;">
          <table id="keyTable" style="width:100%;border-collapse:collapse;font-size:0.9rem;">
            <thead>
              <tr style="background:var(--bg-secondary);text-align:left;">
                <th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-weight:600;">分类</th>
                <th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-weight:600;">key</th>
                <th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-weight:600;">code</th>
                <th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-weight:600;">keyCode</th>
                <th style="padding:0.6rem 0.75rem;border-bottom:1px solid var(--border);font-weight:600;width:80px;">操作</th>
              </tr>
            </thead>
            <tbody id="keyTableBody"></tbody>
          </table>
        </div>
      </div>
      <div class="output-box">
        <h3>💡 使用提示</h3>
        <ul style="margin:0.5rem 0 0 1.25rem;line-height:1.8;font-size:0.92rem;">
          <li><b>key</b>：键的字符值（如 <code>a</code>、<code>Enter</code>、<code>ArrowUp</code>）</li>
          <li><b>code</b>：物理按键标识（与键盘布局无关，如 <code>KeyA</code>、<code>Digit1</code>）</li>
          <li><b>keyCode</b>：传统数字编码（已弃用，但仍广泛使用）</li>
          <li>点击表格中的 keyCode 单元格可快速复制到剪贴板</li>
          <li>实时监听区域支持 modifier、组合键（Ctrl+C 等）检测</li>
        </ul>
      </div>`,

    'life/insurance': `
      <div class="tool-card">
        <h3>输入税前工资（元）</h3>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input type="number" id="salary" placeholder="请输入税前工资，如 20000" style="flex:1;padding:0.6rem;font-size:1rem;">
        </div>
        <p style="font-size:0.8rem;opacity:0.6;margin-top:0.5rem;">💡 2024年上海标准，社保基数上限 36549 元/月</p>
      </div>
      <div class="tool-card">
        <h3>计算结果</h3>
        <div id="result" style="font-size:0.95rem;"></div>
      </div>
      <style>
        .ins-table{width:100%;border-collapse:collapse;margin-bottom:1rem;font-size:0.9rem;}
        .ins-table th,.ins-table td{padding:0.5rem 0.6rem;border-bottom:1px solid #eee;text-align:left;}
        .ins-table th{background:#f5f5f5;font-weight:600;opacity:0.7;font-size:0.8rem;}
        .ins-summary{display:flex;flex-direction:column;gap:0.5rem;padding:0.8rem;background:#f0f7ff;border-radius:10px;}
        .ins-item{display:flex;justify-content:space-between;align-items:center;}
        .ins-item.highlight{background:#fff3e0;border-radius:8px;padding:0.5rem 0.8rem;margin-top:0.3rem;}
        .ins-item.highlight span{font-weight:600;}
      </style>`,

    'life/salary': `
      <div class="tool-card">
        <h3>输入</h3>
        <div style="display:flex;flex-direction:column;gap:0.75rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">税前工资 / 月底薪（元）</label>
            <input type="number" id="salary" placeholder="如 20000" style="width:100%;padding:0.6rem;font-size:1rem;">
          </div>
          <div>
            <label style="display:flex;align-items:center;gap:0.5rem;cursor:pointer;font-size:0.9rem;">
              <input type="checkbox" id="useMinBase" style="width:16px;height:16px;">
              五险一金按最低基数（7310元）计算
            </label>
            <p style="font-size:0.75rem;opacity:0.55;margin-top:0.25rem;padding-left:1.6rem;">不勾选时，按实际工资计算（超出上限 36549 元按上限）</p>
          </div>
        </div>
      </div>
      <div class="tool-card">
        <h3>计算结果</h3>
        <div id="result" style="font-size:0.95rem;"></div>
      </div>
      <style>
        .sal-table{width:100%;border-collapse:collapse;margin-bottom:1rem;font-size:0.9rem;}
        .sal-table th,.sal-table td{padding:0.5rem 0.6rem;border-bottom:1px solid #eee;text-align:left;}
        .sal-table th{background:#f5f5f5;font-weight:600;opacity:0.7;font-size:0.8rem;}
        .sal-summary{display:flex;flex-direction:column;gap:0.5rem;padding:0.8rem;background:#f0f7ff;border-radius:10px;}
        .sal-row{display:flex;justify-content:space-between;align-items:center;gap:0.5rem;}
        .sal-row span{font-size:0.88rem;color:var(--text-secondary);}
        .sal-row b{font-size:0.95rem;}
        .sal-row.highlight{background:#fff3e0;border-radius:8px;padding:0.6rem 0.8rem;margin-top:0.3rem;}
        .sal-row.highlight span{font-weight:600;color:var(--text);}
        .sal-note{font-size:0.72rem!important;opacity:0.65;font-weight:normal!important;}
        .red{color:#e74c3c;}
        .green{color:#16a34a;}
      </style>`,

    'life/zen-canvas': `
      <div id="zenCanvas" style="width:100%;height:60vh;min-height:400px;background:#0a0a14;border-radius:12px;cursor:crosshair;display:block;"></div>
      <div style="display:flex;flex-wrap:wrap;gap:0.5rem;margin-top:1rem;align-items:center;">
        <input type="text" id="textInput" placeholder="打字生成粒子..." style="flex:1;min-width:200px;padding:0.6rem;font-size:0.95rem;border-radius:8px;border:1px solid #ddd;">
        <button class="btn sound-btn" data-sound="rain">🌧️ 雨声</button>
        <button class="btn sound-btn" data-sound="campfire">🔥 篝火</button>
        <button class="btn sound-btn" data-sound="ocean">🌊 海浪</button>
        <button class="btn sound-btn" data-sound="forest">🌲 森林</button>
        <button class="btn btn-primary" id="exportBtn">📥 导出壁纸</button>
      </div>
      <p style="margin-top:0.75rem;font-size:0.8rem;opacity:0.5;">移动鼠标或打字产生粒子动画。5秒无操作自动停止声音。</p>`,

    'life/grid-splitter': `
      <div class="tool-card">
        <h3>上传图片</h3>
        <div class="upload-area" id="uploadArea" style="border:2px dashed var(--border);border-radius:12px;padding:2rem;text-align:center;cursor:pointer;transition:border-color 0.2s;background:var(--bg-secondary);">
          <input type="file" id="imageInput" accept="image/*" style="display:none;">
          <div style="font-size:2rem;margin-bottom:0.5rem;">📷</div>
          <div style="color:var(--text-secondary);font-size:0.9rem;">点击选择图片或拖拽到此处</div>
          <div style="color:var(--text-secondary);font-size:0.75rem;margin-top:0.3rem;opacity:0.6;">支持 JPG、PNG、GIF、WebP</div>
        </div>
        <div id="imagePreviewContainer" style="display:none;margin-top:1rem;">
          <img id="previewImg" style="max-width:100%;max-height:300px;border-radius:8px;display:block;margin:0 auto;">
        </div>
        <div class="btn-row" style="margin-top:1rem;">
          <button class="btn btn-primary" id="splitBtn">✂️ 切割为九宫格</button>
        </div>
      </div>
      <div class="tool-card" id="resultCard" style="display:none;">
        <h3>切割结果（3x3 九宫格）</h3>
        <div id="gridResult" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:0.75rem;"></div>
        <div class="btn-row" style="margin-top:1rem;justify-content:center;">
          <button class="btn btn-primary" id="downloadAllBtn">📥 下载全部</button>
        </div>
      </div>
      <p style="font-size:0.8rem;opacity:0.5;margin-top:1rem;">💡 提示：长按或右键保存各格图片，也可点击单格放大后保存</p>
    `,
    'life/time-annotate': `
      <div class="tool-card">
        <div style="display:flex;gap:0.5rem;margin-bottom:1rem;flex-wrap:wrap;">
          <button class="btn btn-primary" id="modeStopwatch" style="flex:1;">秒表模式</button>
          <button class="btn btn-secondary" id="modePomodoro" style="flex:1;">番茄钟</button>
        </div>
        <div id="timerDisplay" style="font-size:3.5rem;font-weight:700;text-align:center;font-family:SF Mono,Fira Code,monospace;letter-spacing:0.05em;padding:1rem 0;color:var(--text);">00:00:00</div>
        <div style="text-align:center;margin-bottom:1rem;">
          <span id="timerLabel" style="font-size:0.85rem;color:var(--text-secondary);">专注计时</span>
        </div>
        <div style="display:flex;gap:0.5rem;justify-content:center;flex-wrap:wrap;">
          <button class="btn btn-primary" id="startBtn">▶ 开始</button>
          <button class="btn btn-secondary" id="pauseBtn">⏸ 暂停</button>
          <button class="btn btn-secondary" id="resetBtn">↺ 重置</button>
          <button class="btn btn-secondary" id="annotateBtn" style="display:none;">🏷️ 标注时间点</button>
        </div>
        <div id="pomodoroSettings" style="display:none;margin-top:1rem;padding:1rem;background:var(--bg-secondary);border-radius:12px;">
          <div style="display:flex;gap:1rem;flex-wrap:wrap;">
            <div style="flex:1;min-width:100px;">
              <label style="font-size:0.8rem;opacity:0.7;display:block;margin-bottom:0.3rem;">工作时长（分钟）</label>
              <input type="number" id="workDuration" value="25" min="1" max="120" style="width:100%;padding:0.4rem;border-radius:8px;border:1px solid var(--border);">
            </div>
            <div style="flex:1;min-width:100px;">
              <label style="font-size:0.8rem;opacity:0.7;display:block;margin-bottom:0.3rem;">休息时长（分钟）</label>
              <input type="number" id="breakDuration" value="5" min="1" max="60" style="width:100%;padding:0.4rem;border-radius:8px;border:1px solid var(--border);">
            </div>
          </div>
          <div id="pomodoroStatus" style="text-align:center;margin-top:0.75rem;font-size:0.9rem;color:var(--primary);font-weight:600;"></div>
        </div>
        <div id="annotationInput" style="display:none;margin-top:0.75rem;">
          <input type="text" id="annotationText" placeholder="输入标注内容（选填）..." style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);font-size:0.9rem;">
          <button class="btn btn-primary" id="saveAnnotationBtn" style="margin-top:0.5rem;width:100%;">保存标注</button>
        </div>
      </div>
      <div class="tool-card" id="timelineCard">
        <h3>⏱️ 时间线记录</h3>
        <div id="timeline" style="max-height:300px;overflow-y:auto;">
          <div id="timelineEmpty" style="text-align:center;padding:1.5rem;color:var(--text-secondary);font-size:0.9rem;">暂无记录<br><span style="font-size:0.8rem;opacity:0.6;">点击「标注时间点」开始记录</span></div>
        </div>
        <div id="timelineStats" style="display:none;margin-top:1rem;padding:0.75rem;background:var(--bg-secondary);border-radius:10px;font-size:0.85rem;">
          <div style="display:flex;justify-content:space-around;">
            <div style="text-align:center;"><div id="statCount" style="font-size:1.3rem;font-weight:700;color:var(--primary);">0</div><div style="opacity:0.6;font-size:0.75rem;">标注次数</div></div>
            <div style="text-align:center;"><div id="statTotal" style="font-size:1.3rem;font-weight:700;color:var(--primary);">0</div><div style="opacity:0.6;font-size:0.75rem;">总计时长</div></div>
            <div style="text-align:center;"><div id="statInterval" style="font-size:1.3rem;font-weight:700;color:var(--primary);">0</div><div style="opacity:0.6;font-size:0.75rem;">平均间隔</div></div>
          </div>
        </div>
        <button class="btn btn-secondary" id="clearTimelineBtn" style="margin-top:0.75rem;width:100%;">🗑️ 清空记录</button>
      </div>
    `,

    'math/prime-check': `
      <div class="tool-card">
        <h3>输入数字</h3>
        <input type="number" id="inputNum" placeholder="请输入一个正整数" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        <button class="btn btn-primary" id="checkBtn" style="margin-top:0.75rem;width:100%;">检查是否为质数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.1rem;font-weight:600;"></div>
      </div>
    `,

    'math/factorial': `
      <div class="tool-card">
        <h3>输入数字</h3>
        <input type="number" id="inputNum" placeholder="请输入一个非负整数" min="0" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        <button class="btn btn-primary" id="calcBtn" style="margin-top:0.75rem;width:100%;">计算阶乘</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:120px;word-break:break-all;"></textarea>
      </div>
    `,

    'math/gcd': `
      <div class="tool-card">
        <h3>输入两个整数</h3>
        <input type="number" id="inputA" placeholder="整数 A" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <input type="number" id="inputB" placeholder="整数 B" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        <button class="btn btn-primary" id="calcBtn" style="margin-top:0.75rem;width:100%;">计算最大公约数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.2rem;font-weight:700;"></div>
        <div id="steps" style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;"></div>
      </div>
    `,

    'math/random-gen': `
      <div class="tool-card">
        <h3>随机数设置</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">最小值</label>
            <input type="number" id="minInput" value="1" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">最大值</label>
            <input type="number" id="maxInput" value="100" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.85rem;opacity:0.7;">生成数量</label>
          <input type="number" id="countInput" value="10" min="1" max="1000" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        </div>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <label style="font-size:0.85rem;opacity:0.7;display:flex;align-items:center;gap:0.3rem;">
            <input type="checkbox" id="uniqueCheck" /> 不重复
          </label>
          <label style="font-size:0.85rem;opacity:0.7;display:flex;align-items:center;gap:0.3rem;">
            <input type="checkbox" id="sortCheck" /> 排序
          </label>
        </div>
        <button class="btn btn-primary" id="genBtn" style="width:100%;">生成随机数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:120px;word-break:break-all;"></textarea>
      </div>
    `,

    'network/cron-gen': `
      <div class="tool-card">
        <h3>Cron 表达式</h3>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-bottom:1rem;">
          <input type="text" id="cronExpr" value="* * * * *" readonly style="flex:1;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1.2rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);text-align:center;" />
          <button class="btn btn-secondary" id="copyExpr">复制表达式</button>
        </div>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">分钟 (0-59)</label>
            <select id="cronMin" class="cron-select" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="*">每分钟</option><option value="0">0</option><option value="15">15</option><option value="30">30</option><option value="45">45</option><option value="*/5">每5分钟</option><option value="*/10">每10分钟</option><option value="*/15">每15分钟</option><option value="*/30">每30分钟</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">小时 (0-23)</label>
            <select id="cronHour" class="cron-select" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="*">每小时</option><option value="0">0 (午夜)</option><option value="6">6 (早6点)</option><option value="9">9 (上午9点)</option><option value="12">12 (中午)</option><option value="18">18 (下午6点)</option><option value="22">22 (晚10点)</option><option value="*/2">每2小时</option><option value="*/6">每6小时</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">日期 (1-31)</label>
            <select id="cronDom" class="cron-select" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="*">每天</option><option value="1">1号</option><option value="15">15号</option><option value="*/2">每2天</option><option value="1,15">每月1号和15号</option>
            </select>
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">月份 (1-12)</label>
            <select id="cronMon" class="cron-select" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="*">每月</option><option value="1">1月</option><option value="6">6月</option><option value="12">12月</option><option value="*/3">每季度</option>
            </select>
          </div>
          <div style="grid-column:1/-1;">
            <label style="font-size:0.8rem;opacity:0.7;">星期 (0-6, 0=周日)</label>
            <select id="cronDow" class="cron-select" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="*">每天</option><option value="0">周日</option><option value="1-5">周一至周五</option><option value="6">周六</option><option value="1,3,5">周一/三/五</option>
            </select>
          </div>
        </div>
        <div style="padding:0.75rem;background:var(--bg-secondary);border-radius:10px;font-size:0.85rem;margin-bottom:0.75rem;">
          <div style="font-weight:600;margin-bottom:0.3rem;">下次执行时间：</div>
          <div id="nextRuns" style="color:var(--primary);font-family:monospace;"></div>
        </div>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-secondary" id="resetCron">重置</button>
          <button class="btn btn-primary" id="copyOutput" style="flex:1;">复制表达式</button>
        </div>
      </div>
    `,

    'code/regex-tester': `
      <div class="tool-card">
        <h3>正则表达式</h3>
        <input type="text" id="regexInput" placeholder="输入正则表达式，如：\d+" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;"><input type="checkbox" id="flagG" checked /> 全局 (g)</label>
          <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;"><input type="checkbox" id="flagI" /> 忽略大小写 (i)</label>
          <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;"><input type="checkbox" id="flagM" /> 多行 (m)</label>
        </div>
      </div>
      <div class="tool-card">
        <h3>测试文本</h3>
        <textarea id="testText" placeholder="输入要测试的文本..." style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
      </div>
      <div class="output-box">
        <h3>匹配结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;min-height:80px;font-family:monospace;white-space:pre-wrap;word-break:break-all;"></div>
        <div id="matchInfo" style="padding:0.5rem 1rem;font-size:0.85rem;color:var(--text-secondary);"></div>
      </div>
    `,

    'life/color-picker': `
      <div class="tool-card">
        <h3>颜色选择</h3>
        <input type="color" id="colorPicker" value="#5b8dee" style="width:100%;height:60px;border:none;border-radius:10px;cursor:pointer;margin-bottom:0.75rem;" />
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;">
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">HEX</label>
            <input type="text" id="hexInput" value="#5B8DEE" readonly style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);font-family:monospace;font-size:0.9rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">RGB</label>
            <input type="text" id="rgbInput" readonly style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);font-family:monospace;font-size:0.9rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">HSL</label>
            <input type="text" id="hslInput" readonly style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);font-family:monospace;font-size:0.9rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div style="display:flex;align-items:flex-end;">
            <button class="btn btn-primary" id="copyOutput" style="width:100%;">复制 HEX</button>
          </div>
        </div>
        <div id="colorPreview" style="margin-top:0.75rem;height:60px;border-radius:10px;background:#5B8DEE;border:1px solid var(--border);"></div>
      </div>
    `,

    'encrypt/base32': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入要编码或解码的文本" style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="encodeBtn">编码 → Base32</button>
          <button class="btn btn-secondary" id="decodeBtn">解码 ← Base32</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:120px;word-break:break-all;"></textarea>
      </div>
    `,

    // ============ New tools 2026-04-18 ============
    'code/sql-format': `
      <div class="tool-card">
        <h3>输入 SQL</h3>
        <textarea id="input" placeholder="粘贴 SQL 语句..." style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="format">格式化</button>
          <button class="btn btn-secondary" id="minify">压缩</button>
          <button class="btn btn-secondary" id="copyOutput">复制</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出</h3>
        <textarea id="output" readonly style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;" placeholder="格式化结果..."></textarea>
      </div>
    `,

    'encrypt/base16': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入要编码或解码的文本" style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="encode">编码 → Base16</button>
          <button class="btn btn-secondary" id="decode">解码 ← Base16</button>
          <button class="btn btn-secondary" id="copyOutput">复制</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出</h3>
        <textarea id="output" readonly style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
      </div>
    `,

    'text/indent': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入包含缩进的文本（Tab 或空格）..." style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div style="display:flex;align-items:center;gap:0.5rem;margin-top:0.5rem;">
          <label style="font-size:0.85rem;">空格数:</label>
          <input type="number" id="spacesInput" value="2" min="1" max="8" style="width:60px;padding:0.4rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);" />
        </div>
        <div class="btn-row" style="margin-top:0.5rem;">
          <button class="btn btn-primary" id="toSpaces">Tab → 空格</button>
          <button class="btn btn-secondary" id="toTabs">空格 → Tab</button>
          <button class="btn btn-secondary" id="copyOutput">复制</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出</h3>
        <textarea id="output" readonly style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;" placeholder="转换结果..."></textarea>
      </div>
    `,

    'text/reverse': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入要反转的文本..." style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="reverse">反转字符</button>
          <button class="btn btn-secondary" id="reverseLines">反转行</button>
          <button class="btn btn-secondary" id="reverseWords">反转单词</button>
          <button class="btn btn-secondary" id="copyOutput">复制</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出</h3>
        <textarea id="output" readonly style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
      </div>
    `,

    'text/repeat': `
      <div class="tool-card">
        <h3>输入基础文本</h3>
        <textarea id="input" placeholder="输入要重复的文本..." style="width:100%;min-height:80px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-top:0.5rem;">
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">重复次数</label>
            <input type="number" id="countInput" value="5" min="1" max="1000" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.8rem;opacity:0.7;">分隔符（可选）</label>
            <input type="text" id="sepInput" placeholder="如换行输入\\n" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <button class="btn btn-primary" id="genBtn" style="margin-top:0.75rem;width:100%;">生成</button>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;word-break:break-all;"></textarea>
      </div>
    `,

    'math/lcm': `
      <div class="tool-card">
        <h3>输入两个整数</h3>
        <input type="number" id="inputA" placeholder="整数 A" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <input type="number" id="inputB" placeholder="整数 B" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        <button class="btn btn-primary" id="calcBtn" style="margin-top:0.75rem;width:100%;">计算最小公倍数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.2rem;font-weight:700;"></div>
        <div id="steps" style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;"></div>
      </div>
    `,

    'math/power': `
      <div class="tool-card">
        <h3>幂运算计算器</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">底数 (base)</label>
            <input type="number" id="baseInput" placeholder="如 2" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">指数 (exp)</label>
            <input type="number" id="expInput" placeholder="如 10" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <button class="btn btn-primary" id="calcBtn" style="width:100%;">计算</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.2rem;font-weight:700;"></div>
      </div>
    `,

    'text/extract-url': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入包含 URL 的文本..." style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        <div style="margin-top:0.5rem;">
          <label style="font-size:0.85rem;opacity:0.7;">关键词过滤（可选）</label>
          <input type="text" id="filterInput" placeholder="只保留含关键词的 URL" style="width:100%;padding:0.5rem;border-radius:8px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);" />
        </div>
        <button class="btn btn-primary" id="extractBtn" style="margin-top:0.5rem;width:100%;">提取 URL</button>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="width:100%;min-height:150px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.85rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;" placeholder="提取到的 URL..."></textarea>
      </div>
    `,
    'code/css-unit': `<div class="tool-card">
        <h3>输入数值</h3>
        <input type="number" id="inputNum" placeholder="输入数值，如 16" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <select id="fromUnit" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;">
          <option value="px">px（像素）</option>
          <option value="em">em</option>
          <option value="rem">rem</option>
          <option value="vw">vw（视口宽度1%）</option>
          <option value="vh">vh（视口高度1%）</option>
          <option value="pt">pt（磅）</option>
          <option value="in">in（英寸）</option>
          <option value="cm">cm（厘米）</option>
          <option value="mm">mm（毫米）</option>
        </select>
        <button class="btn btn-primary" id="calcBtn" style="width:100%;">转换</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-family:monospace;white-space:pre-wrap;line-height:1.8;"></div>
      </div>`,

    'code/SQLite查看器': `
      <style>
        .sqlite-wrap { display: grid; grid-template-columns: 240px 1fr; gap: 1rem; min-height: 480px; }
        @media (max-width: 768px) { .sqlite-wrap { grid-template-columns: 1fr; } }
        .sqlite-sidebar { background: var(--bg-secondary); border: 1px solid var(--border); border-radius: 12px; padding: 0.75rem; max-height: 600px; overflow-y: auto; }
        .sqlite-sidebar h4 { font-size: 0.85rem; margin: 0 0 0.5rem; opacity: 0.7; text-transform: uppercase; letter-spacing: 0.05em; }
        .sqlite-sidebar .file-info { font-size: 0.78rem; opacity: 0.6; margin-bottom: 0.75rem; word-break: break-all; }
        .sqlite-table-list { list-style: none; padding: 0; margin: 0; }
        .sqlite-table-list li { padding: 0.5rem 0.75rem; border-radius: 8px; cursor: pointer; font-size: 0.9rem; margin-bottom: 0.25rem; transition: background 0.15s; display: flex; align-items: center; gap: 0.4rem; }
        .sqlite-table-list li:hover { background: var(--primary-light, rgba(99,102,241,0.1)); }
        .sqlite-table-list li.active { background: var(--primary); color: white; }
        .sqlite-table-list li .rowcount { margin-left: auto; font-size: 0.7rem; opacity: 0.7; }
        .sqlite-main { display: flex; flex-direction: column; gap: 1rem; }
        .sqlite-tabs { display: flex; gap: 0.25rem; border-bottom: 1px solid var(--border); margin-bottom: 0.5rem; }
        .sqlite-tab { padding: 0.5rem 1rem; cursor: pointer; font-size: 0.9rem; border: none; background: none; color: var(--text-secondary); border-bottom: 2px solid transparent; transition: all 0.15s; }
        .sqlite-tab.active { color: var(--primary); border-bottom-color: var(--primary); font-weight: 600; }
        .sqlite-tab:hover:not(.active) { color: var(--text); }
        .sqlite-panel { display: none; }
        .sqlite-panel.active { display: block; }
        .sqlite-empty { padding: 3rem 1rem; text-align: center; opacity: 0.6; font-size: 0.95rem; }
        .sqlite-drop { border: 2px dashed var(--border); border-radius: 12px; padding: 2rem 1rem; text-align: center; cursor: pointer; transition: all 0.15s; background: var(--bg-secondary); }
        .sqlite-drop:hover, .sqlite-drop.dragover { border-color: var(--primary); background: rgba(99,102,241,0.05); }
        .sqlite-drop .icon { font-size: 2.5rem; margin-bottom: 0.5rem; }
        .sqlite-drop p { margin: 0.25rem 0; }
        .sqlite-drop .hint { font-size: 0.8rem; opacity: 0.6; }
        .sqlite-schema-table { width: 100%; border-collapse: collapse; font-size: 0.85rem; }
        .sqlite-schema-table th, .sqlite-schema-table td { padding: 0.5rem 0.75rem; border: 1px solid var(--border); text-align: left; }
        .sqlite-schema-table th { background: var(--bg-secondary); font-weight: 600; }
        .sqlite-schema-table .pk { color: #d97706; font-weight: 700; }
        .sqlite-schema-table .nn { color: #dc2626; }
        .sqlite-results { max-height: 500px; overflow: auto; border: 1px solid var(--border); border-radius: 10px; }
        .sqlite-results table { width: 100%; border-collapse: collapse; font-size: 0.85rem; font-family: monospace; }
        .sqlite-results th, .sqlite-results td { padding: 0.4rem 0.6rem; border-bottom: 1px solid var(--border); border-right: 1px solid var(--border); text-align: left; white-space: nowrap; }
        .sqlite-results th { background: var(--bg-secondary); position: sticky; top: 0; font-weight: 600; z-index: 1; }
        .sqlite-results tr:hover td { background: rgba(99,102,241,0.05); }
        .sqlite-results .null-val { opacity: 0.5; font-style: italic; }
        .sqlite-pagination { display: flex; justify-content: center; align-items: center; gap: 0.5rem; margin-top: 0.5rem; font-size: 0.85rem; }
        .sqlite-pagination button { padding: 0.3rem 0.6rem; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); border-radius: 6px; cursor: pointer; }
        .sqlite-pagination button:disabled { opacity: 0.4; cursor: not-allowed; }
        .sqlite-pagination button:hover:not(:disabled) { background: var(--primary); color: white; }
        .sqlite-stats { font-size: 0.8rem; color: var(--text-secondary); padding: 0.5rem 0.75rem; background: var(--bg-secondary); border-radius: 8px; margin-top: 0.5rem; }
        .sqlite-error { padding: 0.75rem 1rem; background: #fef2f2; border: 1px solid #fecaca; border-radius: 8px; color: #b91c1c; font-size: 0.85rem; margin-top: 0.5rem; font-family: monospace; word-break: break-word; }
        .sqlite-loading { padding: 2rem; text-align: center; opacity: 0.7; }
        .sqlite-spinner { display: inline-block; width: 20px; height: 20px; border: 2px solid var(--border); border-top-color: var(--primary); border-radius: 50%; animation: sqlite-spin 0.8s linear infinite; margin-right: 0.5rem; vertical-align: middle; }
        @keyframes sqlite-spin { to { transform: rotate(360deg); } }
        .sqlite-actions { display: flex; gap: 0.5rem; margin-top: 0.5rem; flex-wrap: wrap; }
        .sqlite-actions button { padding: 0.4rem 0.75rem; font-size: 0.85rem; border-radius: 8px; border: 1px solid var(--border); background: var(--bg-secondary); color: var(--text); cursor: pointer; }
        .sqlite-actions button:hover { background: var(--primary); color: white; }
        .sqlite-quick { font-size: 0.75rem; padding: 0.2rem 0.5rem !important; font-family: monospace; }
      </style>
      <div id="sqliteRoot">
        <div id="sqliteLoading" class="sqlite-loading">
          <span class="sqlite-spinner"></span>正在加载 SQL.js 引擎（WASM）...
        </div>
        <div id="sqliteApp" style="display:none;">
          <div id="dropZone" class="sqlite-drop">
            <div class="icon">📂</div>
            <p><strong>拖拽 SQLite 文件到此处</strong></p>
            <p class="hint">或点击选择文件 — 支持 .db / .sqlite / .sqlite3</p>
            <input type="file" id="fileInput" accept=".db,.sqlite,.sqlite3" style="display:none;" />
            <div style="margin-top:0.75rem;">
              <button class="btn btn-secondary" id="sampleBtn" style="font-size:0.85rem;padding:0.4rem 0.85rem;">📝 加载示例数据</button>
              <button class="btn btn-secondary" id="newDbBtn" style="font-size:0.85rem;padding:0.4rem 0.85rem;margin-left:0.4rem;">➕ 创建空数据库</button>
            </div>
          </div>
          <div id="dbPanel" style="display:none;">
            <div class="sqlite-wrap">
              <aside class="sqlite-sidebar">
                <h4>表</h4>
                <div class="file-info" id="fileInfo"></div>
                <ul class="sqlite-table-list" id="tableList"></ul>
              </aside>
              <div class="sqlite-main">
                <div class="sqlite-tabs">
                  <button class="sqlite-tab active" data-tab="structure">表结构</button>
                  <button class="sqlite-tab" data-tab="data">数据</button>
                  <button class="sqlite-tab" data-tab="query">SQL 查询</button>
                </div>
                <div class="sqlite-panel active" id="panel-structure">
                  <div id="structureContent"></div>
                </div>
                <div class="sqlite-panel" id="panel-data">
                  <div id="dataContent"></div>
                </div>
                <div class="sqlite-panel" id="panel-query">
                  <textarea id="sqlInput" placeholder="输入 SQL 语句（SELECT / INSERT / UPDATE / DELETE / CREATE ...）" style="width:100%;min-height:120px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-family:monospace;font-size:0.9rem;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
                  <div class="sqlite-actions">
                    <button class="btn btn-primary" id="runSqlBtn">▶ 执行 (Ctrl+Enter)</button>
                    <button class="btn btn-secondary" id="clearSqlBtn">清空</button>
                    <button class="btn btn-secondary" id="exportDbBtn">💾 导出数据库</button>
                  </div>
                  <div style="margin-top:0.5rem;">
                    <span style="font-size:0.8rem;opacity:0.7;margin-right:0.4rem;">快速:</span>
                    <button class="sqlite-quick sqlite-actions" data-sql="SELECT name FROM sqlite_master WHERE type='table' ORDER BY name;">所有表</button>
                    <button class="sqlite-quick sqlite-actions" data-sql="SELECT * FROM sqlite_master WHERE type='table';">建表语句</button>
                  </div>
                  <div id="sqlStats"></div>
                  <div id="sqlError"></div>
                  <div id="sqlResults" class="sqlite-results" style="display:none;"></div>
                </div>
              </div>
            </div>
          </div>
        </div>
      </div>
    `,
    'math/fibonacci': `<div class="tool-card">
        <h3>生成斐波那契数列</h3>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;"><input type="radio" name="mode" value="count" checked />按项数</label>
          <label style="display:flex;align-items:center;gap:0.3rem;font-size:0.85rem;"><input type="radio" name="mode" value="max" />按上限值</label>
        </div>
        <input type="number" id="inputNum" placeholder="输入项数（如 20）或上限值" min="1" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <button class="btn btn-primary" id="calcBtn" style="width:100%;">生成</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:120px;word-break:break-all;font-family:monospace;"></textarea>
      </div>`,
    'math/roman-numeral': `<div class="tool-card">
        <h3>数字互转</h3>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <button class="btn btn-primary" id="toRomanBtn" style="flex:1;">数字→罗马数字</button>
          <button class="btn btn-secondary" id="toArabBtn" style="flex:1;">罗马数字→数字</button>
        </div>
        <input type="text" id="inputText" placeholder="输入阿拉伯数字（如 2024）或罗马数字（如 MMXXIV）" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.4rem;font-weight:700;text-align:center;letter-spacing:0.1em;"></div>
      </div>`,
    'math/perfect-number': `<div class="tool-card">
        <h3>输入数字</h3>
        <input type="number" id="inputNum" placeholder="输入正整数，如 28" min="1" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <button class="btn btn-primary" id="checkBtn" style="width:100%;">检查是否为完美数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.1rem;font-weight:600;"></div>
        <div id="factors" style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;"></div>
      </div>`,
    'encrypt/qrcode': `<div class="tool-card">
        <h3>输入内容</h3>
        <textarea id="inputText" placeholder="输入网址、文本或联系方式..." style="width:100%;min-height:100px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;margin-bottom:0.5rem;"></textarea>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <button class="btn btn-primary" id="genBtn" style="flex:1;">生成二维码</button>
          <button class="btn btn-secondary" id="clearBtn">清空</button>
        </div>
      </div>
      <div class="output-box">
        <h3>二维码 <button class="copy-btn" id="copyOutput">复制链接</button></h3>
        <div id="qrcode" style="display:flex;justify-content:center;align-items:center;min-height:200px;padding:1rem;"></div>
      </div>`,
    'encrypt/morse': `<div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="inputText" placeholder="输入要编码或解码的文本/摩斯码..." style="width:100%;min-height:100px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);resize:vertical;margin-bottom:0.5rem;"></textarea>
        <div style="display:flex;gap:0.5rem;">
          <button class="btn btn-primary" id="encodeBtn" style="flex:1;">编码 → 摩斯码</button>
          <button class="btn btn-secondary" id="decodeBtn" style="flex:1;">解码 ← 摩斯码</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-family:monospace;font-size:1.1rem;letter-spacing:0.05em;word-break:break-all;min-height:80px;"></div>
      </div>`,
    'life/bmi': `<div class="tool-card">
        <h3>身体数据</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.5rem;margin-bottom:0.5rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">身高 (cm)</label>
            <input type="number" id="heightInput" placeholder="170" min="50" max="300" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.85rem;opacity:0.7;">体重 (kg)</label>
            <input type="number" id="weightInput" placeholder="65" min="20" max="500" step="0.1" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <button class="btn btn-primary" id="calcBtn" style="width:100%;">计算 BMI</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="result" style="padding:1rem;text-align:center;"></div>
        <div id="bmiScale" style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);"></div>
      </div>`,
    'network/curl-gen': `<div class="tool-card">
        <h3>请求信息</h3>
        <div style="display:flex;gap:0.5rem;margin-bottom:0.5rem;">
          <select id="methodSelect" style="width:80px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);">
            <option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option><option value="HEAD">HEAD</option>
          </select>
          <input type="text" id="urlInput" placeholder="https://api.example.com/endpoint" style="flex:1;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);" />
        </div>
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.85rem;opacity:0.7;">请求头（JSON 格式，可选）</label>
          <textarea id="headersInput" placeholder='{"Content-Type": "application/json"}' style="width:100%;min-height:60px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        </div>
        <div style="margin-bottom:0.5rem;">
          <label style="font-size:0.85rem;opacity:0.7;">请求体（可选）</label>
          <textarea id="bodyInput" placeholder='{"key": "value"}' style="width:100%;min-height:80px;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:0.9rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        </div>
        <button class="btn btn-primary" id="genBtn" style="width:100%;">生成 cURL 命令</button>
      </div>
      <div class="output-box">
        <h3>cURL 命令 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="curlOutput" readonly style="min-height:100px;font-family:monospace;font-size:0.9rem;word-break:break-all;background:var(--bg-primary);"></textarea>
      </div>`,
    'other/robots文件生成器': `
      <div class="tool-card">
        <h3>🤖 User-agent 设置</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;margin-bottom:0.75rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">User-agent 名称</label>
            <select id="uaSelect" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.95rem;background:var(--bg-secondary);color:var(--text);">
              <option value="*">* (所有爬虫)</option>
              <option value="Googlebot">Googlebot</option>
              <option value="Googlebot-Image">Googlebot-Image</option>
              <option value="Googlebot-Mobile">Googlebot-Mobile</option>
              <option value="Baiduspider">Baiduspider</option>
              <option value="Bingbot">Bingbot</option>
              <option value="Slurp">Slurp (Yahoo)</option>
              <option value="DuckDuckBot">DuckDuckBot</option>
              <option value="YandexBot">YandexBot</option>
              <option value="Sogou">Sogou</option>
              <option value="Applebot">Applebot</option>
              <option value="facebot">facebot (Facebook)</option>
              <option value="Twitterbot">Twitterbot</option>
              <option value="__custom__">自定义...</option>
            </select>
          </div>
          <div id="uaCustomWrap" style="display:none;">
            <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">自定义名称</label>
            <input type="text" id="uaCustom" placeholder="例如：MyBot" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.95rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;">
          <button class="btn btn-secondary" id="presetAllBtn">📋 预设：全部允许</button>
          <button class="btn btn-secondary" id="presetNoneBtn">🚫 预设：全部禁止</button>
          <button class="btn btn-secondary" id="presetSeoBtn">🌐 预设：SEO 友好</button>
        </div>
      </div>

      <div class="tool-card">
        <h3>🚧 爬取规则 (Disallow / Allow)</h3>
        <div id="rulesList"></div>
        <div style="display:flex;gap:0.5rem;margin-top:0.75rem;flex-wrap:wrap;">
          <button class="btn btn-primary" id="addDisallowBtn">+ 添加 Disallow</button>
          <button class="btn btn-secondary" id="addAllowBtn">+ 添加 Allow</button>
          <button class="btn btn-secondary" id="clearRulesBtn">🗑️ 清空规则</button>
        </div>
      </div>

      <div class="tool-card">
        <h3>⚙️ 可选配置</h3>
        <div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;">
          <div>
            <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">
              <input type="checkbox" id="enableCrawlDelay" style="margin-right:0.35rem;"> Crawl-delay (秒)
            </label>
            <input type="number" id="crawlDelay" value="10" min="0" max="86400" step="1" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.95rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
          <div>
            <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">Sitemap URL</label>
            <input type="url" id="sitemapUrl" placeholder="https://example.com/sitemap.xml" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.95rem;background:var(--bg-secondary);color:var(--text);" />
          </div>
        </div>
        <div style="margin-top:0.75rem;">
          <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">Host (部分搜索引擎支持，如 Yandex)</label>
          <input type="text" id="hostInput" placeholder="www.example.com" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.95rem;background:var(--bg-secondary);color:var(--text);" />
        </div>
        <div style="margin-top:0.75rem;">
          <label style="font-size:0.85rem;opacity:0.7;display:block;margin-bottom:0.3rem;">顶部注释 (可选，每行以 # 开头)</label>
          <textarea id="headerComment" placeholder="# robots.txt for example.com&#10;# Generated by CloverTools" rows="2" style="width:100%;padding:0.6rem;border-radius:10px;border:1px solid var(--border);font-size:0.85rem;font-family:'SF Mono',monospace;background:var(--bg-secondary);color:var(--text);resize:vertical;"></textarea>
        </div>
      </div>

      <div class="output-box">
        <h3>📄 生成的 robots.txt <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:280px;font-family:'SF Mono',Menlo,Consolas,monospace;font-size:0.85rem;line-height:1.55;background:var(--bg-primary);word-break:break-all;"></textarea>
        <div style="display:flex;gap:0.5rem;flex-wrap:wrap;margin-top:0.75rem;">
          <button class="btn btn-primary" id="downloadBtn">⬇️ 下载 robots.txt</button>
          <button class="btn btn-secondary" id="validateBtn">✓ 校验规则</button>
        </div>
        <div id="validateMsg" style="margin-top:0.6rem;font-size:0.85rem;line-height:1.6;"></div>
        <div style="margin-top:0.75rem;padding:0.75rem;background:var(--bg-secondary);border-radius:8px;font-size:0.78rem;opacity:0.85;line-height:1.7;">
          💡 <b>使用提示：</b><br>
          • <code>*</code> 通配符匹配所有爬虫；<code>/path/</code> 禁止/允许指定路径；<code>$</code> 锚定结尾<br>
          • <code>Allow</code> 优先级高于 <code>Disallow</code>，更具体的规则优先<br>
          • robots.txt 必须放在网站根目录 (例如 <code>https://example.com/robots.txt</code>)<br>
          • 大小写敏感；<code>User-agent</code> 区分大小写；路径区分大小写
        </div>
      </div>
    `,

    'text/敏感词检测': `
      <div class="tool-card">
        <h3>📝 待检测文本</h3>
        <textarea id="input" placeholder="粘贴或输入待检测文本…" style="min-height:200px;"></textarea>
        <div class="btn-row" style="margin-top:.75rem;flex-wrap:wrap;gap:.5rem;">
          <label style="font-size:.85rem;display:flex;align-items:center;gap:.3rem;">检测等级：
            <select id="level" style="padding:.4rem .6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
              <option value="high">🔴 高级 (政治/暴力/违法)</option>
              <option value="medium" selected>🟡 中级 (色情/赌博/灰色)</option>
              <option value="low">🟢 初级 (广告法/夸大)</option>
            </select>
          </label>
          <label style="font-size:.85rem;display:flex;align-items:center;gap:.3rem;margin-left:auto;">
            <input type="checkbox" id="customMode" /> 自定义词库
          </label>
          <button class="btn btn-secondary" id="clearBtn">🗑️ 清空</button>
        </div>
        <div id="customPanel" style="display:none;margin-top:.75rem;">
          <label style="font-size:.85rem;opacity:.75;display:block;margin-bottom:.3rem;">自定义词库（换行 / 逗号 / 空格分隔）</label>
          <textarea id="customWords" placeholder="例如：违禁词1&#10;违禁词2&#10;违禁词3" style="min-height:80px;font-size:.85rem;"></textarea>
        </div>
        <div id="stat" style="margin-top:.75rem;font-size:.9rem;opacity:.85;"></div>
      </div>
      <div class="output-box">
        <h3>📋 检测结果 <button class="copy-btn" id="copyOutput">复制原文</button></h3>
        <div id="output" style="min-height:160px;padding:1rem;line-height:1.8;background:var(--bg-secondary);border-radius:10px;white-space:pre-wrap;word-break:break-word;"></div>
      </div>
      <div class="tool-card" style="background:var(--bg-secondary);">
        <h3>💡 使用提示</h3>
        <ul style="margin:0;padding-left:1.2rem;line-height:1.8;font-size:.9rem;opacity:.85;">
          <li>检测到敏感词后会在文本中<mark style="background:#fde68a;color:#7c2d12;padding:0 3px;border-radius:3px;">黄色高亮</mark>标记</li>
          <li>支持检测等级切换：高级涵盖政治/暴力/违法，中级覆盖色情/赌博/灰色，初级针对广告法/夸大宣传</li>
          <li>自定义词库支持换行、逗号、空格分隔多个词，适合团队/行业专属敏感词管理</li>
          <li>所有检测在本地浏览器完成，文本不上传到服务器</li>
        </ul>
      </div>
    `,

    'text/字数检测': `
      <div class="tool-card">
        <h3>📝 输入文本</h3>
        <textarea id="input" placeholder="在此输入或粘贴文本…" style="min-height:200px;"></textarea>
        <div class="btn-row" style="margin-top:.75rem;flex-wrap:wrap;gap:.75rem;">
          <label style="font-size:.85rem;display:flex;align-items:center;gap:.3rem;">
            <input type="checkbox" id="trimSpace" /> 去空统计（合并连续空白）
          </label>
          <label style="font-size:.85rem;display:flex;align-items:center;gap:.3rem;">
            <input type="checkbox" id="noPunct" /> 排除标点
          </label>
          <button class="btn btn-secondary" id="clearBtn" style="margin-left:auto;">🗑️ 清空</button>
          <button class="copy-btn" id="copyOutput" style="margin-left:0;">复制原文</button>
        </div>
      </div>
      <div class="output-box">
        <h3>📊 统计结果</h3>
        <div id="output" style="min-height:120px;"></div>
      </div>
      <div class="tool-card" style="background:var(--bg-secondary);">
        <h3>💡 使用提示</h3>
        <ul style="margin:0;padding-left:1.2rem;line-height:1.8;font-size:.9rem;opacity:.85;">
          <li><b>中文字符</b>：Unicode CJK 范围（基本汉字 + 扩展A区）</li>
          <li><b>英文单词</b>：按连续空白字符切分（适合英文/编程场景）</li>
          <li><b>段落数</b>：以一个或多个空行分隔（Markdown 友好）</li>
          <li>勾选"去空统计"会把 Tab / 多空格 / 换行统一为单个空格后再计算字符数</li>
          <li>所有统计实时计算，输入即得结果</li>
        </ul>
      </div>
      <style>
        .stat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(110px, 1fr)); gap:.6rem; }
        .stat-cell { background:var(--bg-secondary); padding:.75rem .5rem; border-radius:8px; text-align:center; border:1px solid var(--border); }
        .stat-num { font-size:1.5rem; font-weight:700; color:var(--primary); }
        .stat-label { font-size:.78rem; opacity:.75; margin-top:.2rem; }
      </style>
    `,

    'text/字符编码检测': `
      <div class="tool-card">
        <h3>🔍 输入文本</h3>
        <textarea id="input" placeholder="输入或粘贴待检测文本…" style="min-height:160px;font-family:Menlo,Monaco,Consolas,monospace;font-size:.9rem;"></textarea>
        <div class="btn-row" style="margin-top:.75rem;flex-wrap:wrap;gap:.5rem;">
          <button class="btn btn-primary" id="detectBtn">🔎 检测编码</button>
          <label class="btn btn-secondary" style="cursor:pointer;">
            📁 上传文件
            <input type="file" id="fileInput" style="display:none;" accept=".txt,.csv,.log,.md,.json,.*" />
          </label>
          <button class="btn btn-secondary" id="clearBtn">🗑️ 清空</button>
        </div>
        <div id="detectOut" style="margin-top:1rem;"></div>
      </div>
      <div class="tool-card">
        <h3>🔄 编码转换</h3>
        <div style="display:flex;gap:.5rem;flex-wrap:wrap;align-items:center;">
          <label style="font-size:.9rem;">目标编码：</label>
          <select id="targetEnc" style="padding:.4rem .6rem;border-radius:6px;border:1px solid var(--border);background:var(--bg-secondary);color:var(--text);">
            <option value="utf-8">UTF-8</option>
            <option value="gb18030">GB18030 (GBK 兼容)</option>
            <option value="big5">Big5</option>
            <option value="shift_jis">Shift_JIS</option>
            <option value="euc-jp">EUC-JP</option>
            <option value="euc-kr">EUC-KR</option>
            <option value="iso-8859-1">ISO-8859-1</option>
            <option value="windows-1252">Windows-1252</option>
            <option value="utf-16le">UTF-16 LE</option>
            <option value="utf-16be">UTF-16 BE</option>
          </select>
          <button class="btn btn-primary" id="convertBtn">转换</button>
          <button class="copy-btn" id="copyOutput" style="margin-left:auto;">复制结果</button>
        </div>
        <textarea id="convertOut" placeholder="转换结果将显示在这里…" style="margin-top:.75rem;min-height:120px;font-family:Menlo,Monaco,Consolas,monospace;font-size:.9rem;"></textarea>
      </div>
      <div class="tool-card" style="background:var(--bg-secondary);">
        <h3>💡 使用提示</h3>
        <ul style="margin:0;padding-left:1.2rem;line-height:1.8;font-size:.9rem;opacity:.85;">
          <li>编码检测基于 <code>TextDecoder</code> 严格模式尝试，按 UTF-8 → GB18030 → Big5 → Shift_JIS 顺序回退</li>
          <li>BOM 文件头会被优先识别（UTF-8 BOM / UTF-16 LE/BE BOM）</li>
          <li>上传文件时会按二进制读取，避免浏览器默认 UTF-8 解码造成的乱码</li>
          <li>转换功能可将 UTF-8 输入重新解释为其他编码（适合乱码排查）</li>
          <li>所有处理在本地完成，文本不上传</li>
        </ul>
      </div>
      <style>
        .stat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:.6rem; }
        .stat-cell { background:var(--bg-secondary); padding:.75rem .5rem; border-radius:8px; text-align:center; border:1px solid var(--border); }
        .stat-num { font-size:1.5rem; font-weight:700; color:var(--primary); }
        .stat-label { font-size:.78rem; opacity:.75; margin-top:.2rem; }
      </style>
    `,

    'math/随机数序列': `
<div class="tool-card">
        <h3>参数</h3>
        <div class="options-row">
          <label>数量: <input type="number" id="count" value="10" min="1" max="10000" style="width:80px;padding:0.3rem;"></label>
          <label>最小值: <input type="number" id="min" value="0" style="width:90px;padding:0.3rem;"></label>
          <label>最大值: <input type="number" id="max" value="100" style="width:90px;padding:0.3rem;"></label>
        </div>
        <div class="options-row" style="margin-top:.5rem;">
          <label>分布:
            <select id="dist" style="padding:0.3rem;">
              <option value="uniform">均匀分布</option>
              <option value="normal">正态分布</option>
            </select>
          </label>
          <label><input type="checkbox" id="integer"> 仅整数</label>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="generate">生成</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:240px;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>均匀分布：每个值出现概率相同</li>
          <li>正态分布：大部分值集中在中间，使用 Box-Muller 变换</li>
          <li>整数模式：结果四舍五入为整数</li>
        </ul>
      </div>
    `,
    'math/圆周率查询': `
<div class="tool-card">
        <h3>查询位数</h3>
        <div class="options-row">
          <label>位数: <input type="number" id="digits" value="100" min="1" max="10000" style="width:120px;padding:0.3rem;"></label>
          <button class="btn btn-primary" id="show">查询</button>
        </div>
      </div>
      <div class="output-box">
        <h3>π 数值 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:300px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>关于 π</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>π 是圆的周长与直径之比，约等于 3.14159265358979...</li>
          <li>支持最多 10,000 位高精度查询</li>
          <li>结果可用于数学研究、记忆口诀、编程测试</li>
        </ul>
      </div>
    `,
    'math/矩阵计算器': `
<div class="tool-card">
        <h3>矩阵 A (空格或逗号分隔，行用换行)</h3>
        <textarea id="input" placeholder="1 2 3&#10;4 5 6" style="min-height:90px;">1 2&#10;3 4</textarea>
        <h3 style="margin-top:1rem;">操作</h3>
        <div class="options-row">
          <label>运算:
            <select id="op" style="padding:0.3rem;">
              <option value="det">行列式</option>
              <option value="transpose">转置</option>
              <option value="inverse">求逆</option>
              <option value="add">A + B</option>
              <option value="sub">A - B</option>
              <option value="mul">A × B</option>
            </select>
          </label>
        </div>
        <h3 style="margin-top:1rem;">矩阵 B (用于加减乘)</h3>
        <textarea id="b" placeholder="5 6&#10;7 8" style="min-height:80px;">5 6&#10;7 8</textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="calc">计算</button>
        </div>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:200px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>支持的运算</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li><b>行列式</b>：n×n 方阵的标量值</li>
          <li><b>转置</b>：行列互换</li>
          <li><b>求逆</b>：高斯-约旦消元法</li>
          <li><b>加减乘</b>：标准矩阵运算</li>
        </ul>
      </div>
    `,
    'math/进制算术运算': `
<div class="tool-card">
        <h3>操作数</h3>
        <div class="options-row">
          <label>A:
            <input type="text" id="a" value="FF" style="width:140px;padding:0.3rem;">
            <select id="baseA" style="padding:0.3rem;">
              <option value="2">二进制</option>
              <option value="8">八进制</option>
              <option value="10" selected>十进制</option>
              <option value="16">十六进制</option>
            </select>
          </label>
          <label>运算符:
            <select id="op" style="padding:0.3rem;">
              <option value="add">+ 加</option>
              <option value="sub">- 减</option>
              <option value="mul">× 乘</option>
              <option value="div">÷ 除</option>
              <option value="and">AND</option>
              <option value="or">OR</option>
              <option value="xor">XOR</option>
              <option value="shl">左移</option>
              <option value="shr">右移</option>
            </select>
          </label>
          <label>B:
            <input type="text" id="b" value="1" style="width:140px;padding:0.3rem;">
            <select id="baseB" style="padding:0.3rem;">
              <option value="2">二进制</option>
              <option value="8">八进制</option>
              <option value="10" selected>十进制</option>
              <option value="16">十六进制</option>
            </select>
          </label>
        </div>
      </div>
      <div class="output-box">
        <h3>结果（同时显示四进制） <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:160px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>两个操作数可使用不同的进制</li>
          <li>支持四则运算与位运算 (AND/OR/XOR/移位)</li>
          <li>结果自动转换为二/八/十/十六进制</li>
        </ul>
      </div>
    `,
    'math/对数计算': `
<div class="tool-card">
        <h3>参数</h3>
        <div class="options-row">
          <label>真数 x: <input type="number" id="x" value="100" step="any" style="width:140px;padding:0.3rem;"></label>
          <label>底数 base: <input type="number" id="base" value="2" step="any" style="width:100px;padding:0.3rem;"></label>
        </div>
        <p style="font-size:.85rem;opacity:.75;margin-top:.5rem;">真数必须 > 0，底数必须 > 0 且 ≠ 1</p>
      </div>
      <div class="output-box">
        <h3>对数结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:200px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>对数公式</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>ln(x)：以自然常数 e 为底的对数</li>
          <li>log10(x)：常用对数（工程领域）</li>
          <li>log2(x)：信息论与计算机科学</li>
          <li>log_b(x) = ln(x) / ln(b)：换底公式</li>
        </ul>
      </div>
    `,
    'network/browser-fingerprint': `
<div class="tool-card">
        <h3>浏览器指纹信息</h3>
        <p style="font-size:.9rem;opacity:.8;">收集以下特征生成本机唯一指纹（仅本地计算，不上传）</p>
        <div class="btn-row">
          <button class="btn btn-primary" id="refresh">重新检测</button>
        </div>
      </div>
      <div class="output-box">
        <h3>指纹详情 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:380px;font-family:monospace;font-size:.85rem;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>浏览器指纹是网站识别用户设备的常用技术</li>
          <li>包含 User-Agent、Canvas、WebGL、屏幕、时区等多种特征</li>
          <li>所有计算均在本地完成，不会上传到任何服务器</li>
        </ul>
      </div>
    `,
    'network/mdn-search': `
<div class="tool-card">
        <h3>搜索 MDN 文档</h3>
        <div class="options-row">
          <input type="text" id="query" placeholder="输入关键词，如 Array.map" value="Promise" style="flex:1;padding:0.5rem;">
          <button class="btn btn-primary" id="search">搜索</button>
        </div>
        <h3 style="margin-top:1rem;">常用搜索</h3>
        <div id="suggestions"></div>
      </div>
      <div class="output-box">
        <h3>搜索链接 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:160px;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="openBtn">在 MDN 中文站打开</button>
          <button class="btn btn-secondary" id="openEnBtn">英文站</button>
        </div>
      </div>
      <div class="tool-card">
        <h3>关于 MDN</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>MDN Web Docs 是 Web 开发的权威文档库</li>
          <li>支持 HTML、CSS、JavaScript、Web API 等查询</li>
          <li>本工具自动生成 MDN 搜索 URL 并打开</li>
        </ul>
      </div>
    `,
    'network/webhook-test': `
<div class="tool-card">
        <h3>生成的回调 URL（演示）</h3>
        <div class="options-row">
          <input type="text" id="urlOut" readonly style="flex:1;padding:0.5rem;background:var(--bg-secondary);">
          <button class="btn btn-secondary" id="copyUrl">复制</button>
        </div>
        <p style="font-size:.85rem;opacity:.75;margin-top:.5rem;">由于浏览器同源策略，本页无法直接接收外部请求。请使用公共 webhook 服务。</p>
      </div>
      <div class="tool-card">
        <h3>POST Payload (JSON)</h3>
        <textarea id="payload" style="min-height:120px;">{"event":"test","timestamp":"2026-07-03T01:00:00Z","data":{"id":1,"name":"CloverTools"}}</textarea>
        <div class="btn-row">
          <button class="btn btn-secondary" id="copyPayload">复制 Payload</button>
          <button class="btn btn-primary" id="send">发送测试请求</button>
        </div>
      </div>
      <div class="output-box">
        <h3>请求日志 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="reqLog" readonly style="min-height:200px;font-family:monospace;font-size:.85rem;"></textarea>
      </div>
      <div class="tool-card">
        <h3>推荐 Webhook 测试服务</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li><a href="https://webhook.site" target="_blank">webhook.site</a> - 最常用，实时查看 Header/Body</li>
          <li><a href="https://pipedream.com" target="_blank">pipedream.com</a> - 支持工作流编排</li>
          <li><a href="https://beeceptor.com" target="_blank">beeceptor.com</a> - 可模拟响应</li>
        </ul>
      </div>
    `,
    'text/base64-image': `
<div class="tool-card">
        <h3>图片 → Base64</h3>
        <input type="file" id="file" accept="image/*">
        <h3 style="margin-top:1rem;">Base64 结果</h3>
        <textarea id="b64Out" readonly style="min-height:160px;font-family:monospace;font-size:.8rem;word-break:break-all;"></textarea>
        <div class="btn-row">
          <button class="btn btn-secondary" id="copyB64">复制 Base64</button>
        </div>
        <img id="imgOut" style="max-width:100%;margin-top:1rem;border:1px solid var(--border);border-radius:8px;display:none;">
      </div>
      <div class="tool-card">
        <h3>Base64 → 图片</h3>
        <textarea id="b64In" placeholder="粘贴 Base64 字符串（可含 data:image/... 前缀）" style="min-height:120px;font-family:monospace;font-size:.8rem;"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="decode">解码为图片</button>
        </div>
        <img id="imgPreview" style="max-width:100%;margin-top:1rem;border:1px solid var(--border);border-radius:8px;display:none;">
      </div>
    `,
    'text/banned-words': `
<div class="tool-card">
        <h3>待检测文本</h3>
        <textarea id="input" placeholder="粘贴文案、标题、广告语等，工具将自动检测违禁词" style="min-height:200px;">我们的产品是行业第一！100%有效，包治百病，立竿见影，错过就没了！</textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="check">检测</button>
          <button class="btn btn-secondary" id="clear">清空</button>
        </div>
      </div>
      <div class="output-box">
        <h3>检测结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:240px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>基于《广告法》第九条等规定的极限词库</li>
          <li>包含广告违禁词、绝对化用语、政治敏感词等</li>
          <li>词库为内置示例，实际使用建议扩展专业词库</li>
          <li>仅供内容参考，不替代专业合规审查</li>
        </ul>
      </div>
    `,
    'text/typing-speed': `
<div class="tool-card">
        <h3>请输入以下文本</h3>
        <div id="target" style="background:var(--bg-secondary);padding:1rem;border-radius:8px;line-height:1.8;font-size:1.05rem;border:1px solid var(--border);"></div>
        <h3 style="margin-top:1rem;">输入区</h3>
        <textarea id="input" placeholder="开始打字..." style="min-height:120px;font-size:1.05rem;line-height:1.8;"></textarea>
        <div class="btn-row">
          <button class="btn btn-secondary" id="reset">重新开始</button>
        </div>
      </div>
      <div class="tool-card">
        <h3>实时统计</h3>
        <div class="stat-grid">
          <div class="stat-cell"><div class="stat-num" id="wpm">0</div><div class="stat-label">WPM (字/分)</div></div>
          <div class="stat-cell"><div class="stat-num" id="cpm">0</div><div class="stat-label">CPM (字符/分)</div></div>
          <div class="stat-cell"><div class="stat-num" id="acc">100%</div><div class="stat-label">正确率</div></div>
          <div class="stat-cell"><div class="stat-num" id="time">0s</div><div class="stat-label">用时</div></div>
        </div>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>WPM (Words Per Minute)：每分钟单词数</li>
          <li>CPM (Characters Per Minute)：每分钟字符数</li>
          <li>正确率 = 已匹配正确字符 / 已输入字符</li>
        </ul>
      </div>
      <style>
        .stat-grid { display:grid; grid-template-columns:repeat(auto-fit, minmax(140px, 1fr)); gap:.6rem; }
        .stat-cell { background:var(--bg-secondary); padding:.75rem .5rem; border-radius:8px; text-align:center; border:1px solid var(--border); }
        .stat-num { font-size:1.5rem; font-weight:700; color:var(--primary); }
        .stat-label { font-size:.78rem; opacity:.75; margin-top:.2rem; }
      </style>
    `,
    'code/px-rem': `
<div class="tool-card">
        <h3>单位换算</h3>
        <div class="options-row">
          <label>PX: <input type="number" id="px" value="32" style="width:120px;padding:0.3rem;"></label>
          <label>REM: <input type="number" id="rem" value="" style="width:120px;padding:0.3rem;"></label>
          <label>根字号: <input type="number" id="root" value="16" min="1" style="width:80px;padding:0.3rem;"></label>
        </div>
        <p style="font-size:.85rem;opacity:.75;margin-top:.5rem;">输入 PX 自动计算 REM，输入 REM 自动计算 PX</p>
      </div>
      <div class="output-box">
        <h3>常用数值速查 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="table" readonly style="min-height:280px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>关于 REM</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>rem 是相对于根元素（html）字体大小的单位</li>
          <li>1rem = 根字号（默认 16px）</li>
          <li>常用根字号 16px，因此 32px = 2rem</li>
          <li>使用 rem 可实现页面整体等比缩放</li>
        </ul>
      </div>
    `,
    'code/box-shadow': `
<div class="tool-card">
        <h3>阴影参数</h3>
        <div class="options-row">
          <label>X 偏移: <input type="range" id="x" min="-50" max="50" value="0" style="width:140px;"> <span id="xv">0</span>px</label>
        </div>
        <div class="options-row" style="margin-top:.4rem;">
          <label>Y 偏移: <input type="range" id="y" min="-50" max="50" value="4" style="width:140px;"> <span id="yv">4</span>px</label>
        </div>
        <div class="options-row" style="margin-top:.4rem;">
          <label>模糊: <input type="range" id="blur" min="0" max="100" value="12" style="width:140px;"> <span id="bv">12</span>px</label>
        </div>
        <div class="options-row" style="margin-top:.4rem;">
          <label>扩散: <input type="range" id="spread" min="-20" max="50" value="0" style="width:140px;"> <span id="sv">0</span>px</label>
        </div>
        <div class="options-row" style="margin-top:.4rem;">
          <label>颜色: <input type="color" id="color" value="#000000"></label>
          <label>透明度: <input type="range" id="alpha" min="0" max="1" step="0.05" value="0.25" style="width:120px;"> <span id="av">0.25</span></label>
          <label><input type="checkbox" id="inset"> 内阴影</label>
        </div>
      </div>
      <div class="tool-card">
        <h3>预览</h3>
        <div id="preview" style="width:200px;height:120px;margin:1rem auto;border-radius:12px;background:linear-gradient(135deg,#3b82f6,#8b5cf6);"></div>
      </div>
      <div class="output-box">
        <h3>CSS 代码 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="code" readonly style="min-height:60px;font-family:monospace;"></textarea>
      </div>
    `,
    'encrypt/md5-query': `
<div class="tool-card">
        <h3>MD5 值（前缀或完整）</h3>
        <div class="options-row">
          <input type="text" id="input" placeholder="粘贴 MD5 哈希值" value="5f4dcc3b5aa765d61d8327deb882cf99" style="flex:1;padding:0.5rem;font-family:monospace;">
          <button class="btn btn-primary" id="query">查询</button>
        </div>
      </div>
      <div class="output-box">
        <h3>查询结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:200px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>MD5 是单向哈希函数，理论上无法反推明文</li>
          <li>本工具使用内置小型字典（常见弱密码）做前缀匹配</li>
          <li>完整数据库查询推荐使用专业服务（md5decrypt.net 等）</li>
          <li>请勿用于非法破解他人密码</li>
        </ul>
      </div>
    `,
    'encrypt/entropy-calc': `
<div class="tool-card">
        <h3>待评估字符串</h3>
        <textarea id="input" placeholder="输入密码或字符串" style="min-height:100px;font-family:monospace;">P@ssw0rd!2026</textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="calc">计算熵</button>
        </div>
      </div>
      <div class="output-box">
        <h3>熵值与强度 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:260px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>关于信息熵</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>香农熵衡量信息的"随机性"或"不可预测性"</li>
          <li>熵越高，字符串越难被猜测或暴力破解</li>
          <li>理想随机字符的熵约为 log₂(字符集大小)</li>
          <li>高强度密码熵值应 > 3.5 bits/字符</li>
        </ul>
      </div>
    `,
    'life/length': `
<div class="tool-card">
        <h3>换算参数</h3>
        <div class="options-row">
          <label>数值: <input type="number" id="val" value="1" step="any" style="width:140px;padding:0.3rem;"></label>
          <label>从:
            <select id="from" style="padding:0.3rem;">
              <option value="m" selected>米 (m)</option>
              <option value="km">千米 (km)</option>
              <option value="cm">厘米 (cm)</option>
              <option value="mm">毫米 (mm)</option>
              <option value="mile">英里 (mile)</option>
              <option value="yard">码 (yard)</option>
              <option value="foot">英尺 (foot)</option>
              <option value="inch">英寸 (inch)</option>
              <option value="nautical-mile">海里</option>
              <option value="li">里</option>
              <option value="chi">尺</option>
              <option value="cun">寸</option>
              <option value="light-year">光年</option>
              <option value="astronomical">天文单位</option>
            </select>
          </label>
        </div>
      </div>
      <div class="output-box">
        <h3>所有单位换算结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:360px;font-family:monospace;"></textarea>
      </div>
    `,
    'life/temperature': `
<div class="tool-card">
        <h3>温度换算</h3>
        <div class="options-row">
          <label>数值: <input type="number" id="val" value="25" step="any" style="width:140px;padding:0.3rem;"></label>
          <label>原始单位:
            <select id="from" style="padding:0.3rem;">
              <option value="C" selected>摄氏度 C</option>
              <option value="F">华氏度 F</option>
              <option value="K">开尔文 K</option>
              <option value="R">兰氏度 R</option>
            </select>
          </label>
        </div>
      </div>
      <div class="output-box">
        <h3>换算结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:240px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>温度单位说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>°C 摄氏度：水的冰点 0°C，沸点 100°C</li>
          <li>°F 华氏度：水的冰点 32°F，沸点 212°F</li>
          <li>K 开尔文：绝对温标，0K = 绝对零度</li>
          <li>°R 兰氏度：基于华氏的绝对温标</li>
        </ul>
      </div>
    `,
    'life/lucky-number': `
<div class="tool-card">
        <h3>个人信息</h3>
        <div class="options-row">
          <label>姓名: <input type="text" id="name" value="张三" style="width:140px;padding:0.3rem;"></label>
          <label>生日: <input type="date" id="birth" value="1995-06-15" style="padding:0.3rem;"></label>
          <label>数量: <input type="number" id="count" value="5" min="1" max="20" style="width:60px;padding:0.3rem;"></label>
        </div>
        <div class="btn-row">
          <button class="btn btn-primary" id="gen">生成</button>
        </div>
      </div>
      <div class="output-box">
        <h3>幸运结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:240px;"></textarea>
      </div>
      <div class="tool-card">
        <h3>说明</h3>
        <ul style="line-height:1.8;padding-left:1.4rem;">
          <li>基于姓名哈希 + 生日种子的稳定伪随机算法</li>
          <li>相同输入始终生成相同结果，便于复现</li>
          <li>提供星座、生肖、幸运色、幸运数字四维度</li>
          <li>仅供娱乐，请勿作为决策依据</li>
        </ul>
      </div>
    `,
  };

  return contents[key] || '';
}

// ============ Main generator ============
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

function generate() {
  console.log('🔧 CloverTools Generator starting...');

  // Ensure dist structure
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, 'src'));
  ensureDir(path.join(DIST_DIR, 'tools'));

  // Copy shared assets to dist
  fs.writeFileSync(path.join(DIST_DIR, 'src/shared.css'), sharedCss);
  console.log('  ✅ Copied shared.css');
  fs.writeFileSync(path.join(DIST_DIR, 'src/shared.js'), sharedJs);
  console.log('  ✅ Copied shared.js');

  // Generate home page
  const categoriesHtml = buildCategoriesHtml();
  let homeHtml = homeTemplate
    .replace('{{CATEGORIES_HTML}}', categoriesHtml)
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml)
    .replace(/\{\{PAGE_OG_TITLE\}\}/g, '🍀 CloverTools - 轻量级开发者工具箱')
    .replace(/\{\{PAGE_OG_DESC\}\}/g, '轻量级开发者工具箱，无需后端，完全本地运行')
    .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
    .replace(/\{\{PAGE_URL\}\}/g, 'https://tools.xsanye.cn/')
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, 'https://tools.xsanye.cn/');
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homeHtml);
  console.log('  ✅ Generated index.html');

  // Generate each tool page
  let generated = 0;
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      const contentHtml = buildToolContentHtml(tool);
      if (!contentHtml) {
        console.log(`  ⚠️  No template for: ${tool.path}`);
        return;
      }

      const script = buildToolScript(tool);
      const toolDir = path.join(DIST_DIR, 'tools', path.dirname(tool.path));
      const toolUrl = 'https://tools.xsanye.cn/tools/' + tool.path;
      const shareBtnScript = 'document.getElementById("shareBtn").onclick = function() { navigator.clipboard.writeText(window.location.href).then(function() { CT.showToast("\\u94fe\\u63a5\\u5df2\\u590d\\u5236\\uff01"); }).catch(function() { CT.showToast("\\u590d\\u5236\\u5931\\u8d25"); }); };';
      const footerWithShare = footerHtml.replace(
        '<!-- FOOTER_SHARE_BTN will be replaced by generator.js for tool pages -->',
        shareBtnHtml
      );

      const baseTemplate = resolveToolBase(tool.path);

      // Strip HTML comments from base template sections (comments inside template markup can't go into <script>/<style>)
      const baseStyles = baseTemplate ? (baseTemplate.styles || '').replace(/<!--[\s\S]*?-->/g, '').trim() : '';
      const baseScript = baseTemplate ? (baseTemplate.script || '').replace(/<!--[\s\S]*?-->/g, '').trim() : '';
      const baseContent = baseTemplate ? (baseTemplate.content || '').replace(/<!--[\s\S]*?-->/g, '').trim() : '';

      // Merge base template into content and script
      const mergedContent = baseContent + contentHtml;
      const mergedScript = script + (baseScript ? '\n' + baseScript : '');

      let pageHtml = toolTemplate
        .replace(/\{\{TOOL_NAME\}\}/g, tool.name)
        .replace(/\{\{TOOL_DESC\}\}/g, tool.desc || '')
        .replace('{{LAYOUT_CLASS}}', tool.layout || '')
        .replace(/\{\{TOOL_CONTENT\}\}/g, mergedContent)
        .replace(/\{\{TOOL_SCRIPT\}\}/g, mergedScript);
      pageHtml = pageHtml
        // Component placeholders
        .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
        .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
        .replace(/\{\{SITE_FOOTER_WITH_SHARE\}\}/g, footerWithShare)
        .replace(/\{\{SHARE_BTN_SCRIPT\}\}/g, shareBtnScript)
        // Meta tags
        .replace(/\{\{PAGE_OG_TITLE\}\}/g, tool.name + ' - 🍀 CloverTools')
        .replace(/\{\{PAGE_OG_DESC\}\}/g, tool.desc || tool.name)
        .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
        .replace(/\{\{PAGE_URL\}\}/g, toolUrl)
        .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, toolUrl);

      // Inject base styles into <head>
      if (baseStyles) {
        pageHtml = pageHtml.replace('</head>', '<style>\n' + baseStyles + '\n</style>\n</head>');
      }

      // For tool pages nested in subdirs (dist/tools/{cat}/{tool}.html),
      // the relative path to dist/src/shared.css is "../../src/shared.css"
      const relCss = '../../src/shared.css';
      pageHtml = pageHtml.replace(/href="[^"]*shared\.css"/, `href="${relCss}"`);

      const outPath = path.join(DIST_DIR, 'tools', tool.path);
      fs.writeFileSync(outPath, pageHtml);
      generated++;
    });
  });

  console.log(`  ✅ Generated ${generated} tool pages`);

  // Generate sitemap.xml
  const baseUrl = 'https://tools.xsanye.cn';
  const today = new Date().toISOString().split('T')[0];
  let urls = [`<url><loc>${baseUrl}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`];
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      urls.push(`<url><loc>${baseUrl}/tools/${tool.path}</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`);
    });
  });
  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('  ✅ Generated sitemap.xml');

  console.log('🎉 Done! Output in dist/');
}

generate();
