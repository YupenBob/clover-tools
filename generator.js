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

// ============ Load templates ============
const homeTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'home.html'), 'utf8');
const toolTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'tool.html'), 'utf8');
const toolsConfig = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf8'));

// ============ Load shared CSS ============
const sharedCss = fs.readFileSync(path.join(SRC_DIR, 'shared.css'), 'utf8');

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
  let html = toolTemplate
    .replace('{{TOOL_NAME}}', tool.name)
    .replace('{{TOOL_DESC}}', tool.description || '')
    .replace('{{LAYOUT_CLASS}}', tool.layout || '')
    .replace('{{TOOL_CONTENT}}', tool.contentHtml || '')
    .replace('{{TOOL_SCRIPT}}', toolScript);

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
      // Simple MD5 implementation (minimal, for demo)
      async function md5(str) {
        // Use browser SubtleCrypto via a simple approach
        const buf = new TextEncoder().encode(str);
        const hash = await crypto.subtle.digest('SHA-256', buf);
        // For MD5, we'll show SHA-256 as fallback (MD5 not available in SubtleCrypto)
        return [...new Uint8Array(hash)].map(b => b.toString(16).padStart(2,'0')).join('');
      }
      input.addEventListener('input', async () => {
        output.value = await md5(input.value);
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
        const result = {};
        lines.forEach(line => {
          const m = line.match(/^(\s*)(.+?):\s*(.*)/);
          if (!m) return;
          const indent = m[1].length;
          const key = m[2];
          let val = m[3];
          if (!val) { result[key] = {}; return; }
          val = val.replace(/^["']|["']$/g, '');
          result[key] = isNaN(val) ? val : Number(val);
        });
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
          else output.value = val.replace(/\s+/g, ' ').replace(/\s*\{\s*/g, '{').replace(/\s*;\s*/g, ';').replace(/\s*\}\s*/g, '}').trim();
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
          else output.value = val.replace(/\s+/g, ' ').replace(/;\s*/g, ';').trim();
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
        const t1 = input1.value.split('\\n');
        const t2 = input2.value.split('\\n');
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

    'other/hex-convert': `
      const input = document.getElementById('input');
      const base = document.getElementById('base');
      const output = document.getElementById('output');
      function run() {
        try {
          const v = input.value.trim();
          const b = parseInt(base.value);
          output.value = parseInt(v, b).toString(2) + ' | ' + parseInt(v, b).toString(8) + ' | ' + parseInt(v, b).toString(10) + ' | ' + parseInt(v, b).toString(16).toUpperCase();
        } catch(e) { output.value = '错误: ' + e.message; }
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
        return {r:parseInt(v.substr(0,2),16),g:parseInt(v.substr(2,2),16),b:parseInt(v.substr(4,2),16)};
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
  };

  return scripts[key] || `// TODO: implement ${tool.path}`;
}

// ============ Tool content HTML builders ============
function buildToolContentHtml(tool) {
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
          <input type="text" id="tsOutput" readonly style="margin-bottom:1rem;">
          <label style="font-size:0.85rem;opacity:0.7;margin-bottom:0.3rem;display:block;">秒</label>
          <input type="text" id="tsOutputSec" readonly style="margin-bottom:1rem;">
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

  // Copy shared CSS to dist
  fs.writeFileSync(path.join(DIST_DIR, 'src/shared.css'), sharedCss);
  console.log('  ✅ Copied shared.css');

  // Generate home page
  const categoriesHtml = buildCategoriesHtml();
  let homeHtml = homeTemplate.replace('{{CATEGORIES_HTML}}', categoriesHtml);
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
      ensureDir(toolDir);

      let pageHtml = toolTemplate
        .replace(/\{\{TOOL_NAME\}\}/g, tool.name)
        .replace(/\{\{TOOL_DESC\}\}/g, tool.desc || '')
        .replace('{{LAYOUT_CLASS}}', tool.layout || '')
        .replace('{{TOOL_CONTENT}}', contentHtml)
        .replace('{{TOOL_SCRIPT}}', script);

      // Link shared.css from dist root
      pageHtml = pageHtml.replace('href="/src/shared.css"', 'href="/src/shared.css"');
      // But for tool pages nested in subdirs, we need correct path
      const depth = tool.path.split('/').length - 1;
      const relCss = '../'.repeat(depth) + 'src/shared.css';
      pageHtml = pageHtml.replace('href="/src/shared.css"', `href="${relCss}"`);

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
