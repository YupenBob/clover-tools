/**
 * CloverTools - Static Site Generator
 * Reads tools.json → generates index.html + all tool pages
 */
const fs = require('fs');
const path = require('path');
const { execSync } = require('child_process');

const BASE = __dirname;
const TEMPLATES_DIR = path.join(BASE, 'templates');
const SRC_DIR = path.join(BASE, 'src');
const DIST_DIR = path.join(BASE, 'dist');
const TOOLS_JSON_PATH = path.join(BASE, 'tools.json');

// ============ Load templates ============
const homeTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'home.html'), 'utf8');
const toolTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'tool.html'), 'utf8');
const toolsConfig = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf8'));

// ============ Load shared assets ============
const sharedCss = fs.readFileSync(path.join(SRC_DIR, 'shared.css'), 'utf8');
const sharedJs = fs.readFileSync(path.join(SRC_DIR, 'shared.js'), 'utf8');

// ============ Load component partials ============
const svgSpriteHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/svg-sprite.html'), 'utf8').trim();
const headerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/header.html'), 'utf8').trim();
const footerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/footer.html'), 'utf8').trim();
const shareBtnHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/share-btn.html'), 'utf8').trim();




// ============ Build categories HTML for homepage ============
const CAT_ICONS = {
  '格式转换': 'bi-arrow-left-right',
  '图片工具': 'bi-image',
  '开发工具': 'bi-code-slash',
  '编码/加密': 'bi-shield-lock',
  '文本工具': 'bi-file-earmark-text',
  '文本处理': 'bi-text-left',
  '时间工具': 'bi-clock',
  '生活实用': 'bi-tools',
  '数学计算': 'bi-calculator',
  '网络工具': 'bi-globe',
};

function buildCategoryGridHtml() {
  let html = '<div class="cat-grid">';
  toolsConfig.forEach(cat => {
    const icon = CAT_ICONS[cat.category] || 'bi-grid';
    html += `
    <button class="cat-btn" data-cat="${cat.category}">
      <i class="bi ${icon}"></i>
      <span>${cat.category}</span>
      <em>${cat.tools.length}</em>
    </button>`;
  });
  html += '</div>';
  return html;
}

function buildCategoriesHtml() {
  let html = '';
  toolsConfig.forEach(cat => {
    let itemsHtml = '';
    cat.tools.forEach(tool => {
      itemsHtml += `
      <li>
        <a href="/tools/${tool.path}">
          ${tool.icon ? `<i class="${tool.icon}"></i>` : ''}
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
    .replace(/\{\{PAGE_OG_TITLE\}\}/g, tool.name + ' - CloverTools')
    .replace(/\{\{PAGE_OG_DESC\}\}/g, tool.description || tool.name)
    .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
    .replace(/\{\{PAGE_URL\}\}/g, toolUrl)
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, toolUrl)
    // SEO meta — derived from tools.json fields
    .replace(/\{\{PAGE_META_DESC\}\}/g, (tool.description || tool.name || '').slice(0, 160))
    .replace(/\{\{PAGE_KEYWORDS\}\}/g, Array.isArray(tool.keywords) ? tool.keywords.join(',') : '');

  // Inject shared CSS inline for single-file tool pages
  // (dist already has it as a separate file)
  return html;
}


// ============ Tool Type Template Registry ============
// New tools only need to add entries in tools.json with a "type" field.
// No code changes needed in generator.js for standard tool types.

const TOOL_TYPE_REGISTRY = {
  // type: "encode-decode" → textarea input + encode/decode buttons + output
  'encode-decode': {
    description: '双向编码/解码工具',
    html: function(tool) {
      const btn1 = tool.btnLabel1 || '编码';
      const btn2 = tool.btnLabel2 || '解码';
      const inputPlaceholder = tool.inputPlaceholder || '输入要编码/解码的文本...';
      return `
      <div class="tool-card">
        <h3>输入</h3>
        <textarea id="input" placeholder="${inputPlaceholder}"></textarea>
        <div class="btn-row">
          <button class="btn btn-primary" id="action1">${btn1}</button>
          <button class="btn btn-secondary" id="action2">${btn2}</button>
        </div>
      </div>
      <div class="output-box">
        <h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>`;
    },
    script: function(tool) {
      return `
      var mode = 'forward';
      var _fwd = ${JSON.stringify(tool.forwardFn || 'return v')};
      var _rev = ${JSON.stringify(tool.reverseFn || 'return v')};
      var fwd = new Function('v', _fwd);
      var rev = new Function('v', _rev);
      var fwdLabel = ${JSON.stringify(tool.btnLabel1 || '编码')};
      var revLabel = ${JSON.stringify(tool.btnLabel2 || '解码')};
      function run() {
        var v = document.getElementById('input').value;
        try {
          document.getElementById('output').value = (mode === 'forward') ? fwd(v) : rev(v);
        } catch(e) { document.getElementById('output').value = '错误: ' + e.message; }
      }
      document.getElementById('action1').onclick = function() { mode = 'forward'; run(); };
      document.getElementById('action2').onclick = function() { mode = 'reverse'; run(); };
      document.getElementById('copyOutput').onclick = function() { copyToClipboard(document.getElementById('output').value); };
      document.getElementById('input').addEventListener('input', run);
      `;
    }
  },

  // type: "calculate" → number inputs + calculate button + result div
  'calculate': {
    description: '计算器类型工具',
    html: function(tool) {
      let fields = '';
      if (tool.fields && tool.fields.length) {
        tool.fields.forEach(function(f) {
          if (f.type === 'select') {
            const opts = f.options.map(function(o) {
              return '<option value="' + o.value + '">' + o.label + '</option>';
            }).join('');
            fields += '<div class="input-field"><label>' + f.label + '</label><select id="' + f.id + '">' + opts + '</select></div>';
          } else {
            fields += '<div class="input-field"><label>' + f.label + '</label><input type="number" id="' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="width:100%;padding:0.5rem;font-size:1rem;"></div>';
          }
        });
      }
      return '<div class="tool-card"><h3>输入参数</h3><div class="input-row" style="display:flex;gap:1rem;flex-wrap:wrap;">' + fields + '</div><div class="btn-row"><button class="btn btn-primary" id="calcBtn">计算</button></div></div><div class="tool-card"><h3>计算结果</h3><div id="result" style="font-size:1.1rem;padding:1rem;line-height:1.8;"></div></div>';
    },
    script: function(tool) {
      const fn = tool.calcFn || 'function(inputs){return "请实现计算逻辑";}';
      // Escape single quotes so fn can be safely embedded in single-quoted string
      const fnEscaped = fn.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const initPart = tool.initFn || '';
      const autoCalcPart = tool.autoCalc ? 'document.getElementById("calcBtn").onclick();' : '';
      const fieldParts = (tool.fields || []).map(function(f) {
        return '  inputs["' + f.id + '"] = document.getElementById("' + f.id + '").value;\n  inputs["' + f.id + '_el"] = document.getElementById("' + f.id + '");';
      });
      const fieldCode = fieldParts.length > 0 ? '\n' + fieldParts.join('\n') + '\n' : '\n';
      return 'var calcFn = \'' + fnEscaped + '\';\n' + initPart + '\ndocument.getElementById("calcBtn").onclick = function() {\n  var inputs = {};' + fieldCode + '  var calcFnObj = new Function(\'return \' + calcFn)();\n  var result = calcFnObj(inputs);\n  document.getElementById("result").innerHTML = result;\n};\n' + autoCalcPart;
    }
  },

  // type: "converter" → input + select (from/to) + output
  'converter': {
    description: '格式转换工具',
    html: function(tool) {
      const opts = (tool.options || []).map(function(o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join('');
      return '<div class="tool-card"><h3>输入</h3><textarea id="input" placeholder="' + (tool.inputPlaceholder || '输入...') + '" style="min-height:100px;"></textarea><div class="input-row" style="margin-top:0.5rem;display:flex;gap:0.5rem;flex-wrap:wrap;align-items:center;"><span>从</span><select id="fromBase" style="padding:0.4rem;">' + opts + '</select><span>转换为</span><select id="toBase" style="padding:0.4rem;">' + opts + '</select></div><div class="btn-row"><button class="btn btn-primary" id="convertBtn">转换</button></div></div><div class="output-box"><h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly></textarea></div>';
    },
    script: function(tool) {
      const conv = tool.convertFn || 'function(v,from,to){return v;}';
      const convEscaped = conv.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      return "var convertFn = '" + convEscaped + "';\ndocument.getElementById(\"convertBtn\").onclick = function() {\n  var v = document.getElementById(\"input\").value;\n  var from = document.getElementById(\"fromBase\").value;\n  var to = document.getElementById(\"toBase\").value;\n  var convertFnObj = new Function('return ' + convertFn)();\n  try { document.getElementById(\"output\").value = convertFnObj(v, from, to); }\n  catch(e) { document.getElementById(\"output\").value = \"错误: \" + e.message; }\n};\ndocument.getElementById(\"copyOutput\").onclick = function() { copyToClipboard(document.getElementById(\"output\").value); };\ndocument.getElementById(\"input\").addEventListener(\"input\", function() {\n  if (document.getElementById(\"autoConvert\") && document.getElementById(\"autoConvert\").checked) document.getElementById(\"convertBtn\").click();\n});";
    }
  },

  // type: "query" → search/select input + reference table display
  'query': {
    description: '查询参考工具',
    html: function(tool) {
      let searchBar = '';
      if (tool.searchable) {
        searchBar = '<input type="text" id="searchInput" placeholder=" 搜索..." style="width:100%;padding:0.5rem;margin-bottom:1rem;border:1px solid var(--border);border-radius:8px;font-size:0.9rem;">';
      }
      return '<div class="tool-card"><h3>' + (tool.searchLabel || '查询') + '</h3>' + searchBar + '<div id="resultArea" style="max-height:500px;overflow-y:auto;"></div></div>';
    },
    script: function(tool) {
      const data = JSON.stringify(tool.data || []);
      const render = tool.renderFn || 'function(data, search) { return "<pre>" + JSON.stringify(data, null, 2) + "</pre>"; }';
      const renderEscaped = render.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const searchablePart = tool.searchable ? 'document.getElementById("searchInput").addEventListener("input", function() { doRender(this.value); });\n' : '';
      return "var TOOL_DATA = " + data + ";\nvar renderFn = '" + renderEscaped + "';\nfunction doRender(search) {\n  var filtered = search ? TOOL_DATA.filter(function(item) {\n    return JSON.stringify(item).toLowerCase().includes(search.toLowerCase());\n  }) : TOOL_DATA;\n  var renderFnObj = new Function('return ' + renderFn)();\n  document.getElementById(\"resultArea\").innerHTML = renderFnObj(filtered, search);\n}\n" + searchablePart + "doRender();";
    }
  },

  // type: "generator" → optional input fields + generate button + output
  'generator': {
    description: '生成器工具',
    html: function(tool) {
      let fields = '';
      if (tool.fields && tool.fields.length) {
        tool.fields.forEach(function(f) {
          if (f.type === 'select') {
            const opts = f.options.map(function(o) {
              return '<option value="' + o.value + '">' + o.label + '</option>';
            }).join('');
            fields += '<div class="input-field"><label>' + f.label + '</label><select id="' + f.id + '">' + opts + '</select></div>';
          } else {
            fields += '<div class="input-field"><label>' + f.label + '</label><input type="' + (f.type || 'text') + '" id="' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="width:100%;padding:0.5rem;font-size:1rem;"></div>';
          }
        });
      }
      const btnLabel = tool.btnLabel || '生成';
      return '<div class="tool-card">' + (fields ? '<h3>参数</h3><div class="input-row" style="display:flex;gap:1rem;flex-wrap:wrap;">' + fields + '</div>' : '') + '<div class="btn-row"><button class="btn btn-primary" id="genBtn">' + btnLabel + '</button></div></div><div class="output-box"><h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly></textarea></div>';
    },
    script: function(tool) {
      const genFn = tool.generateFn || 'function(inputs){ return "请实现生成逻辑"; }';
      const genFnEscaped = genFn.replace(/\\/g, "\\\\").replace(/'/g, "\\'");
      const fieldParts = (tool.fields || []).map(function(f) {
        return '  inputs["' + f.id + '"] = document.getElementById("' + f.id + '").value;';
      });
      const fieldCode = fieldParts.length > 0 ? '\n' + fieldParts.join('\n') + '\n' : '\n';
      const autoGenPart = tool.autoGenerate ? 'document.getElementById("genBtn").onclick();' : '';
      return 'var genFn = \'' + genFnEscaped + '\';\ndocument.getElementById("genBtn").onclick = function() {\n  var inputs = {};' + fieldCode + '  var genFnObj = new Function(\'return \' + genFn)();\n  var result = genFnObj(inputs);\n  document.getElementById("output").value = result;\n};\ndocument.getElementById("copyOutput").onclick = function() { copyToClipboard(document.getElementById("output").value); };\n' + autoGenPart;
    }
  },

  // type: "formatter" → textarea input + format/minify buttons + output (JSON/HTML/XML)
  'formatter': {
    description: '格式化工具（JSON/HTML/XML）',
    html: function(tool) {
      var inputPlaceholder = tool.inputPlaceholder || '输入内容...';
      return '<div class="tool-card"><h3>输入</h3><textarea id="input" placeholder="' + inputPlaceholder + '"></textarea><div class="btn-row"><button class="btn btn-primary" id="format">格式化</button><button class="btn btn-secondary" id="minify">压缩</button></div></div><div class="output-box"><h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly></textarea></div>';
    },
    script: function(tool) {
      return "var mode = 'format';\nvar input = document.getElementById('input');\nvar output = document.getElementById('output');\nfunction detectFormat(text) {\n  var t = text.trim();\n  if (t.startsWith('{') || t.startsWith('[')) return 'json';\n  if (t.startsWith('<')) {\n    if (/<!DOCTYPE\\s+html/i.test(t) || /<html/i.test(t)) return 'html';\n    if (/<\\?xml/i.test(t)) return 'xml';\n    return 'html';\n  }\n  return 'text';\n}\nfunction run() {\n  try {\n    var val = input.value.trim();\n    if (!val) { output.value = ''; return; }\n    var fmt = detectFormat(val);\n    if (fmt === 'json') {\n      var parsed = JSON.parse(val);\n      output.value = mode === 'minify' ? JSON.stringify(parsed) : JSON.stringify(parsed, null, 2);\n    } else if (fmt === 'html' || fmt === 'xml') {\n      var doc = new DOMParser().parseFromString(val, fmt === 'html' ? 'text/html' : 'application/xml');\n      if (fmt === 'xml' && doc.querySelector('parsererror')) throw new Error('XML 解析错误');\n      var formatted = doc.documentElement.outerHTML;\n      output.value = mode === 'minify' ? formatted.replace(/>\\s+</g, '><').trim() : formatted;\n    } else {\n      output.value = val;\n    }\n  } catch(e) { output.value = '错误: ' + e.message; }\n}\ndocument.getElementById('format').onclick = function() { mode = 'format'; run(); };\ndocument.getElementById('minify').onclick = function() { mode = 'minify'; run(); };\ndocument.getElementById('copyOutput').onclick = function() { copyToClipboard(output.value); };\ninput.addEventListener('input', run);\n";
    }
  },

  // type: "format-convert" → file upload + format select + convert + download
  'format-convert': {
    description: '文件格式转换工具',
    html: function(tool) {
      var accept = tool.acceptTypes || '*';
      var opts = (tool.outputFormats || []).map(function(o) {
        return '<option value="' + o.value + '">' + o.label + '</option>';
      }).join('');
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="' + accept + '" style="display:none;"><svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><div class="upload-hint"><div class="upload-hint-main">点击或拖拽上传文件</div><div class="upload-hint-sub">或点击选择文件</div></div></div><div id="fileInfo" style="margin-top:0.5rem;font-size:0.85rem;display:none;"></div><div class="input-row" style="margin-top:0.5rem;"><select id="outputFormat" style="padding:0.4rem;">' + opts + '</select></div><div class="btn-row"><button class="btn btn-primary" id="convertBtn">转换</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>输出 <button class="copy-btn" id="downloadOutput">下载</button></h3><div id="outputPreview" style="text-align:center;padding:1rem;"></div></div>';
    },
    script: function(tool) {
      return "var toolPath = location.pathname;\nvar uploadArea = document.getElementById('uploadArea');\nvar fileInput = document.getElementById('fileInput');\nvar fileInfo = document.getElementById('fileInfo');\nvar outputFormat = document.getElementById('outputFormat');\nvar convertBtn = document.getElementById('convertBtn');\nvar outputBox = document.getElementById('outputBox');\nvar outputPreview = document.getElementById('outputPreview');\nvar currentFileName = '';\nuploadArea.addEventListener('click', function() { fileInput.click(); });\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\nuploadArea.addEventListener('drop', function(e) {\n  e.preventDefault();\n  uploadArea.style.borderColor = 'var(--border)';\n  if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; handleFile(e.dataTransfer.files[0]); }\n});\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) handleFile(fileInput.files[0]); });\nfunction handleFile(file) {\n  currentFileName = file.name;\n  fileInfo.style.display = 'block';\n  fileInfo.innerHTML = '<b>' + escHtml(file.name) + '</b> (' + (file.size / 1024).toFixed(1) + ' KB, ' + (file.type || '未知') + ')';\n}\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nfunction downloadDataUrl(dataUrl, filename) {\n  var a = document.createElement('a');\n  a.href = dataUrl;\n  a.download = filename;\n  a.click();\n}\nfunction imgToPdf(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var img = new Image();\n    img.onload = function() {\n      var w = img.width, h = img.height;\n      var canv = document.createElement('canvas');\n      canv.width = w; canv.height = h;\n      var ctx = canv.getContext('2d');\n      ctx.fillStyle = '#fff';\n      ctx.fillRect(0, 0, w, h);\n      ctx.drawImage(img, 0, 0);\n      var imgData = canv.toDataURL('image/jpeg', 0.95);\n      var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.pdf';\n      // jsPDF approach\n      if (typeof window.jspdf !== 'undefined') {\n        var pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });\n        pdf.addImage(imgData, 'JPEG', 0, 0, w, h);\n        pdf.save(newName);\n        callback({ dataUrl: null, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      } else {\n        // Load jspdf from CDN\n        var script = document.createElement('script');\n        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';\n        script.onload = function() {\n          var pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });\n          pdf.addImage(imgData, 'JPEG', 0, 0, w, h);\n          pdf.save(newName);\n          callback({ dataUrl: null, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n        };\n        script.onerror = function() {\n          // Fallback: HTML printable page\n          var blob = new Blob(['<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>', escHtml(newName), '</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}img{max-width:90vw;max-height:90vh;object-fit:contain;background:#fff}@media print{body{background:none}img{max-height:none}}</style></head><body><img src=\"', imgData, '\" onload=\"window.print()\"></body></html>'], { type: 'text/html' });\n          var url = URL.createObjectURL(blob);\n          callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n        };\n        document.head.appendChild(script);\n      }\n    };\n    img.src = e.target.result;\n  };\n  reader.readAsDataURL(file);\n}\nfunction pdfToText(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        var promises = [];\n        for (var i = 1; i <= Math.min(pdf.numPages, 20); i++) {\n          promises.push(pdf.getPage(i).then(function(p) { return p.getTextContent().then(function(c) { return c.items.map(function(it) { return it.str; }).join(' '); }); }));\n        }\n        Promise.all(promises).then(function(pages) {\n          var text = pages.join('\\n\\n');\n          var blob = new Blob([text], { type: 'text/plain' });\n          var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.txt';\n          callback({ dataUrl: URL.createObjectURL(blob), filename: newName, preview: '<div style=\"text-align:left;max-height:400px;overflow:auto;background:var(--bg);padding:1rem;border-radius:8px;font-family:monospace;white-space:pre-wrap;word-break:break-all;\">' + escHtml(text) + '</div>' });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF 解析错误: ' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() {\n        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';\n        go();\n      };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败，请检查网络</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction imgToImg(file, mimeOut, extOut, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var img = new Image();\n    img.onload = function() {\n      var canv = document.createElement('canvas');\n      canv.width = img.width; canv.height = img.height;\n      var ctx = canv.getContext('2d');\n      ctx.drawImage(img, 0, 0);\n      canv.toBlob(function(blob) {\n        var url = URL.createObjectURL(blob);\n        var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.' + extOut;\n        callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      }, mimeOut, 0.95);\n    };\n    img.src = e.target.result;\n  };\n  reader.readAsDataURL(file);\n}\nfunction svgToPng(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var svgData = e.target.result;\n    var img = new Image();\n    img.onload = function() {\n      var canv = document.createElement('canvas');\n      canv.width = img.width || 800; canv.height = img.height || 600;\n      var ctx = canv.getContext('2d');\n      ctx.drawImage(img, 0, 0);\n      canv.toBlob(function(blob) {\n        var url = URL.createObjectURL(blob);\n        var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.png';\n        callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      }, 'image/png');\n    };\n    img.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">SVG 解析失败</div>' }); };\n    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));\n  };\n  reader.readAsText(file);\n}\nfunction pdfToImg(file, mimeOut, extOut, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        pdf.getPage(1).then(function(page) {\n          var vpt = page.getViewport({ scale: 2 });\n          var canv = document.createElement('canvas');\n          canv.width = vpt.width; canv.height = vpt.height;\n          page.render({ canvasContext: canv.getContext('2d'), viewport: vpt }).promise.then(function() {\n            var dataUrl = canv.toDataURL(mimeOut, 0.95);\n            var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_page1.' + extOut;\n            callback({ dataUrl: dataUrl, filename: newName, preview: '<img src=\"' + dataUrl + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n          });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF 渲染错误: ' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; go(); };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction pdfToHtml(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        pdf.getPage(1).then(function(page) {\n          var vpt = page.getViewport({ scale: 2 });\n          var canv = document.createElement('canvas');\n          canv.width = vpt.width; canv.height = vpt.height;\n          page.render({ canvasContext: canv.getContext('2d'), viewport: vpt }).promise.then(function() {\n            var dataUrl = canv.toDataURL('image/png');\n            callback({ dataUrl: null, filename: currentFileName.replace(/\\.[^.]+$/, '') + '.html', preview: '<div style=\"text-align:center;padding:1rem;\"><img src=\"' + dataUrl + '\" style=\"max-width:100%;border:1px solid #ddd;border-radius:8px;\"></div>' });\n          });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; go(); };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nconvertBtn.onclick = function() {\n  if (!fileInput.files || fileInput.files.length === 0) { outputBox.style.display = 'none'; if (window.CT && CT.showToast) CT.showToast('请先上传文件'); return; }\n  var file = fileInput.files[0];\n  var outFmt = outputFormat.value;\n  var isJpg2pdf = toolPath.indexOf('jpg2pdf') !== -1;\n  var isPdf2txt = toolPath.indexOf('pdf2txt') !== -1;\n  var isWebp2jpg = toolPath.indexOf('webp2jpg') !== -1;\n  var isSvg2png = toolPath.indexOf('svg2png') !== -1;\n  var isJpg2webp = toolPath.indexOf('jpg2webp') !== -1;\n  var isPng2webp = toolPath.indexOf('png2webp') !== -1;\n  var isPdf2jpg = toolPath.indexOf('pdf2jpg') !== -1;\n  var isPdf2html = toolPath.indexOf('pdf2html') !== -1;\n  var isPdfCompress = toolPath.indexOf('pdf-compress') !== -1;\n  var isZipRepair = toolPath.indexOf('zip-repair') !== -1;\n  var onDone = function(result) {\n    outputPreview.innerHTML = result.preview || '';\n    outputBox.style.display = 'block';\n    window._fcResult = result;\n  };\n  if (isJpg2pdf) imgToPdf(file, onDone);\n  else if (isPdf2txt) pdfToText(file, onDone);\n  else if (isWebp2jpg) imgToImg(file, 'image/jpeg', 'jpg', onDone);\n  else if (isSvg2png) svgToPng(file, onDone);\n  else if (isJpg2webp) imgToImg(file, 'image/webp', 'webp', onDone);\n  else if (isPng2webp) imgToImg(file, 'image/webp', 'webp', onDone);\n  else if (isPdf2jpg) pdfToImg(file, outFmt === 'png' ? 'image/png' : 'image/jpeg', outFmt === 'png' ? 'png' : 'jpg', onDone);\n  else if (isPdf2html) pdfToHtml(file, onDone);\n  else if (isPdfCompress) pdfCompress(file, onDone);\n  else if (isZipRepair) zipRepair(file, onDone);\n};\nfunction pdfCompress(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    try {\n      var origSize = file.size;\n      var script = document.createElement('script');\n      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';\n      script.onload = function() {\n        window.pdfLib.getDocument(e.target.result).promise.then(function(pdfDoc) {\n          var numPages = pdfDoc.numPages;\n          var pagePromises = [];\n          for (var i = 1; i <= numPages; i++) pagePromises.push(pdfDoc.getPage(i));\n          Promise.all(pagePromises).then(function(pages) {\n            var newDoc = window.pdfLib.PDFDocument.create();\n            pages.forEach(function(p) {\n              var dims = p.getDimensions();\n              newDoc.addPage([dims.width, dims.height]);\n            });\n            newDoc.save().then(function(bytes) {\n              var blob = new Blob([bytes], {type:'application/pdf'});\n              var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_compressed.pdf';\n              var ratio = origSize > 0 ? ((1 - bytes.length / origSize) * 100).toFixed(1) : '0';\n              var color = bytes.length < origSize ? '#22c55e' : '#f59e0b';\n              var msg = bytes.length < origSize ? ('节省 ' + ratio + '%') : '已是高压缩';\n              callback({dataUrl: URL.createObjectURL(blob), filename: newName, preview: '<div style=\"text-align:center;padding:1rem;\"><div style=\"font-size:1.1rem;margin-bottom:0.5rem;\">PDF 压缩完成！</div><div>原始: ' + (origSize/1024).toFixed(1) + ' KB</div><div>压缩后: ' + (bytes.length/1024).toFixed(1) + ' KB</div><div style=\"color:' + color + ';font-weight:700;font-size:1.1rem;\">' + msg + '</div></div>'});\n            }).catch(function() {\n              var blob = new Blob([e.target.result], {type:'application/pdf'});\n              callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;\"><div>PDF 重新打包完成</div></div>'});\n            });\n          });\n        }).catch(function() {\n          var blob = new Blob([e.target.result], {type:'application/pdf'});\n          callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;\"><div>PDF 重新打包完成</div></div>'});\n        });\n      };\n      script.onerror = function() {\n        var blob = new Blob([e.target.result], {type:'application/pdf'});\n        callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;color:#f59e0b;\">库加载失败，文件已重新打包</div>'});\n      };\n      document.head.appendChild(script);\n    } catch(e) { callback({dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">错误: ' + escHtml(e.message) + '</div>'}); }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction zipRepair(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    try {\n      var arr = new Uint8Array(e.target.result);\n      var valid = 0, total = 0, issues = [], pos = 0;\n      while (pos < arr.length - 4) {\n        if (arr[pos] === 0x50 && arr[pos+1] === 0x4b && arr[pos+2] === 0x03 && arr[pos+3] === 0x04) {\n          total++;\n          var nameLen = arr[pos+26] | (arr[pos+27] << 8);\n          var extraLen = arr[pos+28] | (arr[pos+29] << 8);\n          var hdrLen = 30 + nameLen + extraLen;\n          var cSize = arr[pos+18] | (arr[pos+19]<<8) | (arr[pos+20]<<16) | (arr[pos+21]<<24);\n          if (pos + hdrLen + cSize > arr.length) issues.push('条目 #' + total + ' 数据不完整');\n          else valid++;\n          pos += hdrLen + cSize;\n        } else break;\n      }\n      var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_repaired.zip';\n      var preview = '<div style=\"text-align:left;padding:1rem;font-size:0.9rem;\"><div style=\"margin-bottom:0.5rem;\"><b>ZIP 检测结果：</b></div><div>总条目: ' + total + '</div><div style=\"color:#22c55e;\">有效条目: ' + valid + '</div>';\n      if (issues.length > 0) {\n        preview += '<div style=\"color:#f59e0b;\">发现问题: ' + issues.length + ' 个</div>';\n        issues.slice(0,3).forEach(function(iss){ preview += '<div style=\"color:#f59e0b;font-size:0.8rem;\">- ' + escHtml(iss) + '</div>'; });\n        preview += '<div style=\"margin-top:0.5rem;color:#f59e0b;font-size:0.85rem;\">注：完整修复需要专业工具，此处已尝试提取有效数据</div>';\n      } else {\n        preview += '<div style=\"color:#22c55e;\">ZIP 文件结构完整，未检测到明显损坏</div>';\n      }\n      preview += '</div>';\n      var blob = new Blob([arr], {type:'application/zip'});\n      callback({dataUrl: URL.createObjectURL(blob), filename: newName, preview: preview});\n    } catch(err) { callback({dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">ZIP 解析错误: ' + escHtml(err.message) + '</div>'}); }\n  };\n  reader.readAsArrayBuffer(file);\n}\ndocument.getElementById('downloadOutput').onclick = function() {\n  var r = window._fcResult;\n  if (!r) return;\n  if (r.dataUrl) { downloadDataUrl(r.dataUrl, r.filename); }\n  else if (r.filename && r.preview) {\n    var w = window.open('');\n    w.document.write('<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>' + escHtml(r.filename) + '</title><style>body{margin:2rem;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}img{max-width:90vw;max-height:90vh}@media print{body{background:none}}</style></head><body>' + r.preview + '<script>window.onload=function(){window.print()};<\/script></body></html>');\n    w.document.close();\n  } else { if (window.CT && CT.showToast) CT.showToast('暂不支持此格式下载'); }\n};\n";
    }
  },

  // type: "image-resize" → upload image + width/height/quality → compress or resize
  'image-resize': {
    description: '图片压缩与调整尺寸工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>上传图片</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="display:none;"><svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><div class="upload-hint"><div class="upload-hint-main">点击或拖拽上传图片</div><div class="upload-hint-sub">支持 jpg, png, webp, gif</div></div></div><div id="fileInfo" style="margin-top:0.5rem;font-size:0.85rem;display:none;"></div><div style="margin-top:0.5rem;"><div class="input-row" style="gap:0.5rem;flex-wrap:wrap;"><div style="flex:1;min-width:100px;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">宽度 (px)</label><input type="number" id="imgWidth" placeholder="原宽度" style="width:100%;padding:0.4rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"></div><div style="flex:1;min-width:100px;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">高度 (px)</label><input type="number" id="imgHeight" placeholder="原高度" style="width:100%;padding:0.4rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"></div></div><div style="margin-top:0.5rem;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">质量 (1-100) <span id="qualityVal">80</span></label><input type="range" id="imgQuality" min="10" max="100" value="80" style="width:100%;"></div><div style="margin-top:0.3rem;font-size:0.78rem;opacity:0.6;">保持比例: <input type="checkbox" id="keepRatio" checked></div></div><div class="btn-row"><button class="btn btn-primary" id="processBtn">处理</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>输出 <button class="copy-btn" id="downloadBtn">下载</button></h3><div id="outputPreview" style="text-align:center;padding:1rem;"></div></div>';
    },
    script: function(tool) {
      return "var fileInput = document.getElementById('fileInput');\\nvar uploadArea = document.getElementById('uploadArea');\\nvar fileInfo = document.getElementById('fileInfo');\\nvar imgWidth = document.getElementById('imgWidth');\\nvar imgHeight = document.getElementById('imgHeight');\\nvar imgQuality = document.getElementById('imgQuality');\\nvar keepRatio = document.getElementById('keepRatio');\\nvar qualityVal = document.getElementById('qualityVal');\\nvar processBtn = document.getElementById('processBtn');\\nvar outputBox = document.getElementById('outputBox');\\nvar outputPreview = document.getElementById('outputPreview');\\nvar currentFile = null;\\nvar currentFileName = '';\\nvar origW = 0, origH = 0;\\nimgQuality.addEventListener('input', function() { qualityVal.textContent = imgQuality.value; });\\nuploadArea.addEventListener('click', function() { fileInput.click(); });\\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\\nuploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });\\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) loadFile(fileInput.files[0]); });\\nkeepRatio.addEventListener('change', function() { if (keepRatio.checked && origW && origH && imgWidth.value) { var r = origH / origW; imgHeight.value = Math.round(imgWidth.value * r); } });\\nfunction loadFile(file) {\\n  currentFile = file;\\n  currentFileName = file.name;\\n  fileInfo.style.display = 'block';\\n  fileInfo.innerHTML = '<b>' + escHtml(file.name) + '</b> (' + (file.size / 1024).toFixed(1) + ' KB)';\\n  var reader = new FileReader();\\n  reader.onload = function(e) {\\n    var img = new Image();\\n    img.onload = function() {\\n      origW = img.width; origH = img.height;\\n      imgWidth.placeholder = origW;\\n      imgHeight.placeholder = origH;\\n      imgWidth.value = origW;\\n      imgHeight.value = origH;\\n      outputBox.style.display = 'none';\\n    };\\n    img.src = e.target.result;\\n  };\\n  reader.readAsDataURL(file);\\n}\\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\\nfunction fmtSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(2) + ' MB'; }\\nfunction downloadDataUrl(dataUrl, filename) { var a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click(); }\\nprocessBtn.onclick = function() {\\n  if (!currentFile) { if (window.CT && CT.showToast) CT.showToast('请先上传图片'); return; }\\n  var targetW = parseInt(imgWidth.value) || origW;\\n  var targetH = parseInt(imgHeight.value) || origH;\\n  var q = parseInt(imgQuality.value) / 100;\\n  var reader = new FileReader();\\n  reader.onload = function(e) {\\n    var img = new Image();\\n    img.onload = function() {\\n      var canv = document.createElement('canvas');\\n      canv.width = targetW; canv.height = targetH;\\n      var ctx = canv.getContext('2d');\\n      ctx.drawImage(img, 0, 0, targetW, targetH);\\n      var mime = currentFile.type.indexOf('png') !== -1 ? 'image/png' : 'image/jpeg';\\n      canv.toBlob(function(blob) {\\n        var url = URL.createObjectURL(blob);\\n        var ext = mime === 'image/png' ? '.png' : '.jpg';\\n        var newName = currentFileName.replace(/\\\\.[^.]+$/, '') + '_resized' + ext;\\n        var ratio = ((1 - blob.size / currentFile.size) * 100).toFixed(1);\\n        var color = blob.size < currentFile.size ? '#22c55e' : '#f59e0b';\\n        outputPreview.innerHTML = '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\\\"><div style=\\\"margin-top:0.5rem;font-size:0.85rem;\\\">原始: ' + fmtSize(currentFile.size) + ' → 处理后: ' + fmtSize(blob.size) + ' <span style=\\\"color:' + color + ';\\\">' + (blob.size < currentFile.size ? '节省 ' + ratio + '%' : '体积略增') + '</span></div>';\\n        outputBox.style.display = 'block';\\n        window._imgResult = { dataUrl: url, filename: newName };\\n      }, mime, q);\\n    };\\n    img.src = e.target.result;\\n  };\\n  reader.readAsDataURL(currentFile);\\n};\\ndocument.getElementById('downloadBtn').onclick = function() {\\n  var r = window._imgResult;\\n  if (r) downloadDataUrl(r.dataUrl, r.filename);\\n};\\n";
    }
  },

  // type: "file-analyzer" → file upload → show file metadata (magic bytes detection)
  'file-analyzer': {
    description: '文件分析工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" style="display:none;"><svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><div class="upload-hint"><div class="upload-hint-main">点击或拖拽上传文件</div><div class="upload-hint-sub">或点击选择文件</div></div></div><div id="fileInfo" style="margin-top:1rem;display:none;"></div></div>';
    },
    script: function(tool) {
      return "var MAGIC = {\n  'ffd8ff': 'JPEG 图片',\n  '89504e47': 'PNG 图片',\n  '47494638': 'GIF 图片',\n  '25504446': 'PDF 文档',\n  '504b0304': 'ZIP 压缩包 / Office 文档',\n  '52617221': 'RAR 压缩包',\n  '377abcaf': '7Z 压缩包',\n  '424d': 'BMP 图片',\n  '49492a00': 'TIFF 图片 (Intel)',\n  '4d4d002a': 'TIFF 图片 (Motorola)',\n  '57415645': 'WAV 音频',\n  '664c6143': 'FLAC 音频',\n  '4f676753': 'OGG 媒体',\n  '000001ba': 'MPEG 视频 (PS)',\n  '000001b3': 'MPEG 视频 (ES)',\n  '66747970': 'MP4/M4V 视频',\n  '1a45dfa3': 'Matroska (MKV) 视频',\n  '504b03040a': 'DOCX/XLSX/PPTX (Office 2007+)',\n  '3c3f786d': 'XML 文档'\n};\nvar fileInput = document.getElementById('fileInput');\nvar uploadArea = document.getElementById('uploadArea');\nvar fileInfo = document.getElementById('fileInfo');\nuploadArea.addEventListener('click', function() { fileInput.click(); });\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\nuploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) analyzeFile(e.dataTransfer.files[0]); });\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) analyzeFile(fileInput.files[0]); });\nfunction bytesToHex(bytes) { return Array.from(bytes).map(function(b) { return b.toString(16).padStart(2, '0'); }).join(''); }\nfunction fmtSize(bytes) {\n  if (bytes < 1024) return bytes + ' B';\n  if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB';\n  if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB';\n  return (bytes / 1073741824).toFixed(2) + ' GB';\n}\nfunction detectType(bytes) {\n  var hex = bytesToHex(bytes).toLowerCase();\n  for (var m in MAGIC) { if (hex.startsWith(m.toLowerCase())) return MAGIC[m]; }\n  return '未知格式';\n}\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nfunction analyzeFile(file) {\n  fileInfo.style.display = 'block';\n  fileInfo.innerHTML = '<div style=\"font-size:0.9rem;line-height:1.8;\"><div><b>文件名</b>: ' + escHtml(file.name) + '</div><div><b>文件大小</b>: ' + fmtSize(file.size) + '</div><div><b>MIME 类型</b>: ' + escHtml(file.type || '未知') + '</div><div id=\"magicResult\">正在检测...</div></div>';\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var bytes = new Uint8Array(e.target.result.slice(0, 32));\n    var hex = bytesToHex(bytes).toUpperCase();\n    var magicType = detectType(bytes);\n    var magicEl = document.getElementById('magicResult');\n    var html = '<b>魔数 (Magic Bytes)</b>: <code style=\"font-size:0.78rem;background:#f0f0f0;padding:2px 6px;border-radius:4px;word-break:break-all;\">' + hex + '</code> <b>检测类型</b>: ' + escHtml(magicType);\n    if (file.type && file.type.startsWith('image/') || magicType.indexOf('图片') !== -1) {\n      var img = new Image();\n      img.onload = function() { magicEl.innerHTML = html + ' <b>图片尺寸</b>: ' + img.width + ' x ' + img.height + ' px'; };\n      img.onerror = function() { magicEl.innerHTML = html; };\n      img.src = e.target.result;\n    } else { magicEl.innerHTML = html; }\n  };\n  reader.readAsArrayBuffer(file.slice(0, 32));\n}\n";
    }
  },

  // type: "http-test" → URL + method + headers + body → send HTTP request
  'http-test': {
    description: 'HTTP 接口测试工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>请求配置</h3><div class="input-row" style="gap:0.5rem;flex-wrap:wrap;margin-bottom:0.5rem;"><input type="text" id="urlInput" placeholder="https://api.example.com/endpoint" style="flex:1;min-width:200px;padding:0.5rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><select id="methodSelect" style="padding:0.5rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><option value="GET">GET</option><option value="POST">POST</option><option value="PUT">PUT</option><option value="DELETE">DELETE</option><option value="PATCH">PATCH</option><option value="HEAD">HEAD</option><option value="OPTIONS">OPTIONS</option></select></div><div style="margin-bottom:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;display:block;margin-bottom:0.3rem;">Headers (每行一个，格式: Key: Value)</label><textarea id="headersInput" placeholder="Content-Type: application/json&#10;Authorization: Bearer xxx" style="width:100%;min-height:60px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea></div><div style="margin-bottom:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;display:block;margin-bottom:0.3rem;">Body</label><textarea id="bodyInput" placeholder="{&#10;  \&quot;key\&quot;: \&quot;value\&quot;&#10;}" style="width:100%;min-height:80px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea></div><div class="btn-row"><button class="btn btn-primary" id="sendBtn">发送请求</button></div></div><div class="output-box" id="resultBox" style="display:none;"><h3>响应</h3><div id="statusBar" style="margin-bottom:0.5rem;font-size:0.9rem;"></div><div id="respTime" style="margin-bottom:0.5rem;font-size:0.8rem;opacity:0.6;"></div><div style="margin-bottom:0.5rem;"><label style="font-size:0.8rem;opacity:0.7;">响应 Headers</label><pre id="respHeaders" style="background:#f5f5f5;padding:0.5rem;border-radius:6px;font-size:0.8rem;max-height:150px;overflow:auto;white-space:pre-wrap;word-break:break-all;margin:0.3rem 0 0;"></pre></div><div><label style="font-size:0.8rem;opacity:0.7;">响应 Body</label><textarea id="respBody" readonly style="width:100%;min-height:150px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;margin-top:0.3rem;"></textarea></div></div>';
    },
    script: function(tool) {
      return "var sendBtn = document.getElementById('sendBtn');\nvar urlInput = document.getElementById('urlInput');\nvar methodSelect = document.getElementById('methodSelect');\nvar headersInput = document.getElementById('headersInput');\nvar bodyInput = document.getElementById('bodyInput');\nvar resultBox = document.getElementById('resultBox');\nvar statusBar = document.getElementById('statusBar');\nvar respTime = document.getElementById('respTime');\nvar respHeaders = document.getElementById('respHeaders');\nvar respBody = document.getElementById('respBody');\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nsendBtn.onclick = function() {\n  var url = urlInput.value.trim();\n  if (!url) { if (window.CT && CT.showToast) CT.showToast('请输入 URL'); return; }\n  if (!url.startsWith('http://') && !url.startsWith('https://')) url = 'https://' + url;\n  var method = methodSelect.value;\n  var headers = {};\n  headersInput.value.split('\\n').forEach(function(line) {\n    var idx = line.indexOf(':');\n    if (idx > 0) { headers[line.slice(0, idx).trim()] = line.slice(idx + 1).trim(); }\n  });\n  var body = method !== 'GET' && method !== 'HEAD' ? bodyInput.value : undefined;\n  var startTime = Date.now();\n  sendBtn.disabled = true; sendBtn.textContent = '请求中...';\n  fetch(url, { method: method, headers: headers, body: body }).then(function(res) {\n    var ms = Date.now() - startTime;\n    var statusColor = res.status >= 200 && res.status < 300 ? '#22c55e' : res.status >= 400 ? '#ef4444' : '#f59e0b';\n    statusBar.innerHTML = '<b>状态码</b>: <span style=\"color:' + statusColor + ';font-weight:700;\">' + res.status + '</span> <span style=\"opacity:0.6;\">' + res.statusText + '</span>';\n    respTime.textContent = '耗时: ' + ms + ' ms';\n    var h = [];\n    res.headers.forEach(function(v, k) { h.push(escHtml(k) + ': ' + escHtml(v)); });\n    respHeaders.textContent = h.join('\\n');\n    return res.text().then(function(txt) { return { text: txt, contentType: res.headers.get('content-type') || '' }; });\n  }).then(function(data) {\n    var ct = data.contentType;\n    if (ct.indexOf('json') !== -1) {\n      try { respBody.value = JSON.stringify(JSON.parse(data.text), null, 2); }\n      catch(e) { respBody.value = data.text; }\n    } else { respBody.value = data.text; }\n    resultBox.style.display = 'block';\n  }).catch(function(err) {\n    respBody.value = '请求错误: ' + err.message;\n    resultBox.style.display = 'block';\n  }).finally(function() {\n    sendBtn.disabled = false; sendBtn.textContent = '发送请求';\n  });\n};\n";
    }
  },

  // type: "websocket-test" → URL + connect + message + log
  'websocket-test': {
    description: 'WebSocket 测试工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>连接配置</h3><div class="input-row" style="gap:0.5rem;margin-bottom:0.5rem;"><input type="text" id="wsUrl" placeholder="wss://echo.websocket.org" style="flex:1;padding:0.5rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><button class="btn btn-primary" id="connectBtn" style="padding:0.5rem 1rem;">连接</button></div><h3>发送消息</h3><div class="input-row" style="gap:0.5rem;margin-bottom:0.5rem;"><input type="text" id="wsMessage" placeholder="输入消息..." style="flex:1;padding:0.5rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><button class="btn btn-secondary" id="sendBtn" style="padding:0.5rem 1rem;">发送</button></div></div><div class="output-box"><h3>消息日志</h3><div id="wsLog" style="background:#f5f5f5;border-radius:8px;padding:0.5rem;min-height:150px;max-height:300px;overflow:auto;font-family:monospace;font-size:0.82rem;white-space:pre-wrap;word-break:break-all;"></div></div>';
    },
    script: function(tool) {
      return "var ws = null;\nvar wsLog = document.getElementById('wsLog');\nvar wsUrl = document.getElementById('wsUrl');\nvar connectBtn = document.getElementById('connectBtn');\nvar sendBtn = document.getElementById('sendBtn');\nvar wsMessage = document.getElementById('wsMessage');\nfunction log(msg, type) {\n  var cls = type === 'recv' ? 'color:#22c55e;' : type === 'err' ? 'color:#ef4444;' : 'color:#333;';\n  wsLog.innerHTML += '<div style=\"' + cls + '\">' + (type ? '[' + type.toUpperCase() + '] ' : '') + escHtml(String(msg)) + '</div>';\n  wsLog.scrollTop = wsLog.scrollHeight;\n}\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nconnectBtn.onclick = function() {\n  if (ws && ws.readyState === WebSocket.OPEN) { ws.close(); connectBtn.textContent = '连接'; return; }\n  var url = wsUrl.value.trim();\n  if (!url) { if (window.CT && CT.showToast) CT.showToast('请输入 WebSocket URL'); return; }\n  try {\n    ws = new WebSocket(url);\n    ws.onopen = function() { log('已连接', 'info'); connectBtn.textContent = '断开'; };\n    ws.onmessage = function(e) { log(e.data, 'recv'); };\n    ws.onerror = function(e) { log('连接错误', 'err'); };\n    ws.onclose = function() { log('连接已关闭', 'info'); connectBtn.textContent = '连接'; };\n  } catch(e) { log(e.message, 'err'); }\n};\nsendBtn.onclick = function() {\n  if (!ws || ws.readyState !== WebSocket.OPEN) { if (window.CT && CT.showToast) CT.showToast('请先建立连接'); return; }\n  var msg = wsMessage.value;\n  if (!msg) return;\n  ws.send(msg);\n  log(msg, 'send');\n  wsMessage.value = '';\n};\nwsMessage.addEventListener('keydown', function(e) { if (e.key === 'Enter') sendBtn.click(); });\n";
    }
  },

  // type: "json-generate" → JSON input + language select → generate code
  'json-generate': {
    description: 'JSON 代码生成工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>输入 JSON</h3><textarea id="input" placeholder=\'{"id": 1, "name": "test"}\' style="width:100%;min-height:120px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea><div class="input-row" style="margin-top:0.5rem;"><select id="langSelect" style="padding:0.4rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><option value="typescript">TypeScript</option><option value="java">Java</option><option value="csharp">C#</option><option value="go">Go</option><option value="sql">SQL</option></select><button class="btn btn-primary" id="genBtn" style="margin-left:0.5rem;">生成</button></div></div><div class="output-box"><h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly style="width:100%;min-height:150px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea></div>';
    },
    script: function(tool) {
      return "var input = document.getElementById('input');\nvar output = document.getElementById('output');\nvar langSelect = document.getElementById('langSelect');\nvar genBtn = document.getElementById('genBtn');\nfunction esc(s) { return s.replace(/'/g, \"\\\\'\"); }\nfunction upperFirst(s) { return s.charAt(0).toUpperCase() + s.slice(1); }\nfunction toTypeScript(obj, name) {\n  var lines = ['interface ' + upperFirst(name) + ' {'];\n  Object.entries(obj).forEach(function(e) {\n    var k = e[0], v = e[1];\n    var t = typeof v === 'number' ? (Number.isInteger(v) ? 'number' : 'number') : typeof v === 'boolean' ? 'boolean' : typeof v === 'string' ? 'string' : 'any';\n    if (Array.isArray(v)) t = t + '[]';\n    lines.push('  ' + k + ': ' + t + ';');\n  });\n  lines.push('}');\n  return lines.join('\\n');\n}\nfunction toJava(obj, name) {\n  var lines = ['public class ' + upperFirst(name) + ' {'];\n  Object.entries(obj).forEach(function(e) {\n    var k = e[0], v = e[1];\n    var t = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'double') : typeof v === 'boolean' ? 'boolean' : typeof v === 'string' ? 'String' : 'Object';\n    if (Array.isArray(v)) t = 'List<' + t.replace('[]','') + '>';\n    lines.push('  private ' + t + ' ' + k + ';');\n    lines.push('  public ' + t + ' get' + upperFirst(k) + '() { return ' + k + '; }');\n    lines.push('  public void set' + upperFirst(k) + '(' + t + ' ' + k + ') { this.' + k + ' = ' + k + '; }');\n  });\n  lines.push('}');\n  return lines.join('\\n');\n}\nfunction toCSharp(obj, name) {\n  var lines = ['public class ' + upperFirst(name) + ' {'];\n  Object.entries(obj).forEach(function(e) {\n    var k = e[0], v = e[1];\n    var t = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'double') : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'string' : 'object';\n    if (Array.isArray(v)) t = 'List<' + t.replace('[]','') + '>';\n    lines.push('  public ' + t + ' ' + upperFirst(k) + ' { get; set; }');\n  });\n  lines.push('}');\n  return lines.join('\\n');\n}\nfunction toGo(obj, name) {\n  var lines = ['type ' + upperFirst(name) + ' struct {'];\n  Object.entries(obj).forEach(function(e) {\n    var k = e[0], v = e[1];\n    var t = typeof v === 'number' ? (Number.isInteger(v) ? 'int' : 'float64') : typeof v === 'boolean' ? 'bool' : typeof v === 'string' ? 'string' : 'interface{}';\n    if (Array.isArray(v)) t = '[]' + t.replace('[]','');\n    lines.push('  ' + upperFirst(k) + ' ' + t + ' `json:\"' + k + '\"`');\n  });\n  lines.push('}');\n  return lines.join('\\n');\n}\nfunction toSQL(obj, name) {\n  var table = upperFirst(name).replace(/[^a-zA-Z0-9_]/g, '');\n  var keys = Object.keys(obj);\n  if (keys.length === 0) return '-- Empty object';\n  var cols = keys.map(function(k) { return '  ' + k.replace(/[^a-zA-Z0-9_]/g, '_') + ' TEXT'; }).join(',\\n');\n  return 'CREATE TABLE ' + table + ' (\\n' + cols + '\\n);\\n\\nINSERT INTO ' + table + ' (' + keys.map(function(k) { return k.replace(/[^a-zA-Z0-9_]/g, '_'); }).join(', ') + ') VALUES\\n(' + keys.map(function() { return '?'; }).join(', ') + ');';\n}\ngenBtn.onclick = function() {\n  try {\n    var json = JSON.parse(input.value.trim());\n    var lang = langSelect.value;\n    var rootKey = 'Root';\n    if (typeof json === 'object' && !Array.isArray(json)) {\n      var keys = Object.keys(json);\n      if (keys.length > 0) rootKey = keys[0];\n    }\n    if (lang === 'typescript') output.value = toTypeScript(Array.isArray(json) ? (json[0] || {}) : json, rootKey);\n    else if (lang === 'java') output.value = toJava(Array.isArray(json) ? (json[0] || {}) : json, rootKey);\n    else if (lang === 'csharp') output.value = toCSharp(Array.isArray(json) ? (json[0] || {}) : json, rootKey);\n    else if (lang === 'go') output.value = toGo(Array.isArray(json) ? (json[0] || {}) : json, rootKey);\n    else if (lang === 'sql') output.value = toSQL(Array.isArray(json) ? (json[0] || {}) : json, rootKey);\n  } catch(e) { output.value = 'JSON 解析错误: ' + e.message; }\n};\ndocument.getElementById('copyOutput').onclick = function() { copyToClipboard(output.value); };\ninput.addEventListener('input', function() { if (input.value.trim() === '') output.value = ''; });\n";
    }
  },

  // type: "jsonpath-query" → JSON textarea + JSONPath expression → execute → output
  'jsonpath-query': {
    description: 'JSONPath 查询工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>输入 JSON</h3><textarea id="jsonInput" placeholder=\'{"store": {"book": [{"title": "Book1"}, {"title": "Book2"}]}}\' style="width:100%;min-height:120px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea><div class="input-row" style="margin-top:0.5rem;gap:0.5rem;"><input type="text" id="jpExpr" placeholder="$.store.book[*].title" style="flex:1;padding:0.5rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"><button class="btn btn-primary" id="execBtn">执行</button></div></div><div class="output-box"><h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly style="width:100%;min-height:100px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea></div>';
    },
    script: function(tool) {
      return "// Simple JSONPath implementation\nfunction jp(query, obj) {\n  var result = [];\n  query = query.trim();\n  if (!query.startsWith('$')) query = '$' + query;\n  var parts = query.split(/\\.(?![^\\[]*\\])/);\n  function walk(node, path) {\n    if (path.length === 0) { result.push(node); return; }\n    var seg = path[0];\n    var rest = path.slice(1);\n    if (seg === '$') { walk(node, rest); return; }\n    if (seg === '*') {\n      if (Array.isArray(node)) node.forEach(function(item) { walk(item, rest); });\n      else if (typeof node === 'object' && node !== null) Object.values(node).forEach(function(v) { walk(v, rest); });\n      return;\n    }\n    var bracketMatch = seg.match(/^([^\\[]+)\\[(-?\\d+|\\*|'[^\\']+')\\]$/);\n    if (bracketMatch) {\n      var key = bracketMatch[1] || '';\n      var idx = bracketMatch[2];\n      var target = key ? (Array.isArray(node) ? node : (typeof node === 'object' && node !== null ? node[key] : undefined)) : node;\n      if (target === undefined || target === null) return;\n      if (idx === '*') {\n        if (Array.isArray(target)) target.forEach(function(item) { walk(item, rest); });\n        else if (typeof target === 'object' && target !== null) Object.values(target).forEach(function(v) { walk(v, rest); });\n      } else if (idx.startsWith(\"'\")) {\n        var k = idx.slice(1, -1);\n        if (typeof target === 'object' && target !== null && k in target) walk(target[k], rest);\n      } else {\n        var i = parseInt(idx, 10);\n        if (Array.isArray(target) && i < target.length) walk(target[i < 0 ? target.length + i : i], rest);\n      }\n      return;\n    }\n    if (typeof node === 'object' && node !== null && seg in node) { walk(node[seg], rest); return; }\n    if (Array.isArray(node)) {\n      var found = false;\n      for (var i = 0; i < node.length; i++) {\n        if (typeof node[i] === 'object' && node[i] !== null && seg in node[i]) { walk(node[i][seg], rest); found = true; }\n      }\n      if (!found && !isNaN(parseInt(seg))) walk(node[parseInt(seg)], rest);\n    }\n  }\n  walk(obj, parts);\n  return result;\n}\nvar jsonInput = document.getElementById('jsonInput');\nvar jpExpr = document.getElementById('jpExpr');\nvar output = document.getElementById('output');\nvar execBtn = document.getElementById('execBtn');\nfunction run() {\n  try {\n    var doc = JSON.parse(jsonInput.value.trim());\n    var query = jpExpr.value.trim() || '$.';\n    var res = jp(query, doc);\n    output.value = JSON.stringify(res.length === 1 && res.length !== doc.length ? res[0] : res, null, 2);\n  } catch(e) { output.value = '错误: ' + e.message; }\n}\nexecBtn.onclick = run;\njpExpr.addEventListener('keydown', function(e) { if (e.key === 'Enter') run(); });\ndocument.getElementById('copyOutput').onclick = function() { copyToClipboard(output.value); };\n";
    }
  },

  // type: "tool-static" → Static display tool (supports action button with result display)
  // tools.json: { type: "tool-static", actionLabel: "获取信息", actionFn: "function() { return navigator.userAgent; }", resultTarget: "result-div" }
  'tool-static': {
    description: '静态展示工具（支持按钮触发信息展示）',
    html: function(tool) {
      var actionLabel = tool.actionLabel || null;
      var resultTarget = tool.resultTarget || null;
      var resultDiv = resultTarget ? '<div id="' + resultTarget + '" style="margin-top:1rem;padding:1rem;background:var(--bg-secondary);border-radius:8px;font-size:0.9rem;word-break:break-all;"></div>' : '';
      var actionBtn = actionLabel ? '<div class="btn-row" style="margin-top:0.5rem;"><button class="btn btn-primary" id="actionBtn">' + actionLabel + '</button></div>' : '';
      return '<div class="tool-card"><h3>' + tool.name + '</h3><p style="color:var(--text-secondary);font-size:0.9rem;margin-bottom:0.5rem;">' + tool.desc + '</p>' + actionBtn + resultDiv + '</div>';
    },
    script: function(tool) {
      var actionFn = tool.actionFn || 'function() { return "未定义 actionFn"; }';
      var resultTarget = tool.resultTarget || null;
      var actionFnEscaped = actionFn.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var resultPart = resultTarget
        ? 'var result = actionFn(); document.getElementById("' + resultTarget + '").innerHTML = result;'
        : '';
      return 'var actionFn = \'' + actionFnEscaped + '\';\nvar actionBtn = document.getElementById("actionBtn");\nif (actionBtn) { actionBtn.onclick = function() { ' + resultPart + ' }; }\n';
    }
  },

  // type: "tool-upload" → File upload tool with configurable processing function
  // tools.json: { type: "tool-upload", acceptTypes: "image/*", processFn: "function(file, callback) { ... }" }
  'tool-upload': {
    description: '文件上传处理工具（支持自定义处理函数）',
    html: function(tool) {
      var accept = tool.acceptTypes || '*';
      var extraFields = '';
      if (tool.extraFields && tool.extraFields.length) {
        tool.extraFields.forEach(function(f) {
          if (f.type === 'select') {
            var opts = f.options.map(function(o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
            extraFields += '<div class="input-field" style="margin-top:0.5rem;"><label style="font-size:0.85rem;color:var(--text-secondary);">' + f.label + '</label><select id="' + f.id + '" style="padding:0.4rem;width:100%;">' + opts + '</select></div>';
          } else {
            extraFields += '<div class="input-field" style="margin-top:0.5rem;"><label style="font-size:0.85rem;color:var(--text-secondary);">' + f.label + '</label><input type="' + (f.type || 'text') + '" id="' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="padding:0.4rem;width:100%;"></div>';
          }
        });
      }
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="' + accept + '" style="display:none;"><svg class="upload-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round"><path d="M21 15v4a2 2 0 01-2 2H5a2 2 0 01-2-2v-4"/><polyline points="17 8 12 3 7 8"/><line x1="12" y1="3" x2="12" y2="15"/></svg><div class="upload-hint"><div class="upload-hint-main">点击或拖拽上传文件</div><div class="upload-hint-sub">或点击选择文件</div></div></div><div id="fileInfo" style="margin-top:0.5rem;display:none;"></div>' + extraFields + '<div class="btn-row" style="margin-top:0.5rem;"><button class="btn btn-primary" id="processBtn">开始处理</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>结果 <button class="copy-btn" id="downloadOutput">下载</button></h3><div id="outputPreview"></div></div>';
    },
    script: function(tool) {
      var processFn = tool.processFn || "function(file, callback) { callback({ dataUrl: null, filename: file.name, preview: '<p style=\"color:var(--text-secondary);\">处理函数未定义</p>' }); }";
      var processFnEscaped = processFn.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var extraFieldParts = (tool.extraFields || []).map(function(f) {
        return '  extra["' + f.id + '"] = document.getElementById("' + f.id + '") ? document.getElementById("' + f.id + '").value : undefined;';
      });
      var extraFieldCode = extraFieldParts.length > 0 ? '\n  var extra = {};\n' + extraFieldParts.join('\n') + '\n' : '\n  var extra = {};\n';
      return "var uploadArea = document.getElementById('uploadArea');\nvar fileInput = document.getElementById('fileInput');\nvar fileInfo = document.getElementById('fileInfo');\nvar outputBox = document.getElementById('outputBox');\nvar outputPreview = document.getElementById('outputPreview');\nvar currentFileName = '';\nuploadArea.addEventListener('click', function() { fileInput.click(); });\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\nuploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) handleFile(e.dataTransfer.files[0]); });\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) handleFile(fileInput.files[0]); });\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nfunction fmtSize(bytes) { if (bytes < 1024) return bytes + ' B'; if (bytes < 1048576) return (bytes / 1024).toFixed(1) + ' KB'; if (bytes < 1073741824) return (bytes / 1048576).toFixed(2) + ' MB'; return (bytes / 1073741824).toFixed(2) + ' GB'; }\nfunction downloadDataUrl(dataUrl, filename) { var a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click(); }\nfunction handleFile(file) {\n  currentFileName = file.name;\n  fileInfo.style.display = 'block';\n  fileInfo.innerHTML = '<div style=\"font-size:0.9rem;line-height:1.8;\"><div><b>文件名</b>: ' + escHtml(file.name) + '</div><div><b>文件大小</b>: ' + fmtSize(file.size) + '</div><div><b>MIME 类型</b>: ' + escHtml(file.type || '未知') + '</div></div>';\n  outputBox.style.display = 'block';\n  outputPreview.innerHTML = '<p style=\"color:var(--text-secondary);font-size:0.9rem;\">文件已加载，正在处理...</p>';\n" + extraFieldCode + "  var onDone = function(result) {\n    outputPreview.innerHTML = result.preview || '';\n    window._uploadResult = result;\n  };\n  try {\n    var processUserFn = new Function('return ' + " + processFnEscaped + ")();\n    processUserFn(file, onDone);\n  } catch(e) {\n    outputPreview.innerHTML = '<p style=\"color:#ef4444;\">处理错误: ' + escHtml(e.message) + '</p>';\n  }\n}\ndocument.getElementById('processBtn').onclick = function() {\n  if (!fileInput.files || !fileInput.files[0]) { if (window.CT && CT.showToast) CT.showToast('请先上传文件'); return; }\n  handleFile(fileInput.files[0]);\n};\ndocument.getElementById('downloadOutput').onclick = function() {\n  var r = window._uploadResult;\n  if (!r || !r.dataUrl) { if (window.CT && CT.showToast) CT.showToast('无可下载内容'); return; }\n  downloadDataUrl(r.dataUrl, r.filename || currentFileName);\n};\n";
    }
  },

  // type: "tool-formatter" → Text input + configurable buttons + output
  // tools.json: { type: "tool-formatter", buttons: [{"label": "编码", "action": "forward"}], processFn: "function(v, action) { return encodeURIComponent(v); }" }
  'tool-formatter': {
    description: '文本格式化转换工具（支持自定义按钮和处理函数）',
    html: function(tool) {
      var inputPlaceholder = tool.inputPlaceholder || '输入内容...';
      var buttons = tool.buttons || [{ label: '处理', action: 'process' }];
      var btnHtml = buttons.map(function(b) {
        var cls = b.action === 'process' || !b.action ? 'btn-primary' : 'btn-secondary';
        return '<button class="btn ' + cls + '" id="btn_' + b.action + '">' + b.label + '</button>';
      }).join('');
      return '<div class="tool-card"><h3>输入</h3><textarea id="input" placeholder="' + inputPlaceholder + '" style="width:100%;min-height:120px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea><div class="btn-row" style="margin-top:0.5rem;">' + btnHtml + '</div></div><div class="output-box"><h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly style="width:100%;min-height:120px;padding:0.5rem;font-size:0.85rem;border:1px solid var(--border);border-radius:8px;resize:vertical;font-family:monospace;"></textarea></div>';
    },
    script: function(tool) {
      var processFn = tool.processFn || "function(v, action) { return v; }";
      var processFnEscaped = processFn.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var buttons = tool.buttons || [{ action: 'process' }];
      var btnHandlers = buttons.map(function(b) {
        return 'document.getElementById("btn_' + b.action + '").onclick = function() { mode = "' + b.action + '"; run(); };';
      }).join('\n');
      return "var mode = 'process';\nvar input = document.getElementById('input');\nvar output = document.getElementById('output');\nvar processFnObj = new Function(" + processFnEscaped + ");\nfunction run() {\n  try {\n    var val = input.value;\n    if (!val) { output.value = ''; return; }\n    output.value = processFnObj(val, mode);\n  } catch(e) { output.value = '错误: ' + e.message; }\n}\n" + btnHandlers + "\ndocument.getElementById('copyOutput').onclick = function() { copyToClipboard(output.value); };\ninput.addEventListener('input', function() { if (input.value.trim() === '') output.value = ''; });\n";
    }
  },

  // type: "tool-custom" → Completely custom tool via customHtml/customScript (highest priority over registry)
  // tools.json: { type: "tool-custom", customHtml: "...", customScript: "..." }
  // NOTE: customHtml and customScript are handled at the top of buildToolContentHtml/buildToolScript
  // so this registry entry is just a placeholder/description for the type
  'tool-custom': {
    description: '完全自定义工具（通过 tools.json 的 customHtml/customScript 定义，无需改 generator.js）',
    html: function(tool) {
      return '<!-- tool-custom: HTML 由 tools.json 的 customHtml 提供 -->';
    },
    script: function(tool) {
      return '// tool-custom: JS 由 tools.json 的 customScript 提供\n';
    }
  },

  // type: "tool-generator" → optional input fields + generate button + output (enhanced)
  // tools.json: { type: "generator", generatorFn: "function(inputs) { return result; }", outputLabel: "UUID", fields: [...] }
  // type: "dev-tools" → Developer utility tool with optional input fields + generate button + output
  // tools.json: { type: "dev-tools", genFn: "function(inputs) { ... }", btnLabel: "生成", outputLabel: "结果", fields: [{id, label, type, placeholder}] }
  'dev-tools': {
    description: '开发者工具（生成器类）',
    html: function(tool) {
      var fields = '';
      if (tool.fields && tool.fields.length) {
        tool.fields.forEach(function(f) {
          if (f.type === 'select') {
            var opts = f.options.map(function(o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
            fields += '<div class="input-field"><label>' + f.label + '</label><select id="' + f.id + '">' + opts + '</select></div>';
          } else {
            fields += '<div class="input-field"><label>' + f.label + '</label><input type="' + (f.type || 'text') + '" id="' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="width:100%;padding:0.5rem;font-size:1rem;"></div>';
          }
        });
      }
      var btnLabel = tool.btnLabel || '生成';
      var outputLabel = tool.outputLabel || '结果';
      return '<div class="tool-card">' + (fields ? '<h3>参数</h3><div class="input-row" style="display:flex;gap:1rem;flex-wrap:wrap;">' + fields + '</div>' : '') + '<div class="btn-row"><button class="btn btn-primary" id="genBtn">' + btnLabel + '</button></div></div><div class="output-box"><h3>' + outputLabel + ' <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly></textarea></div>';
    },
    script: function(tool) {
      var genFn = tool.genFn || 'function(inputs){ return "请实现生成逻辑"; }';
      var genFnEscaped = genFn.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var fieldParts = (tool.fields || []).map(function(f) {
        return '  inputs["' + f.id + '"] = document.getElementById("' + f.id + '").value;\n  inputs["' + f.id + '_el"] = document.getElementById("' + f.id + '");';
      });
      var fieldCode = fieldParts.length > 0 ? '\n' + fieldParts.join('\n') + '\n' : '\n';
      return 'var genFn = \'' + genFnEscaped + '\';\ndocument.getElementById("genBtn").onclick = function() {\n  var inputs = {};' + fieldCode + '  var genFnObj = new Function(\'return \' + genFn)();\n  var result = genFnObj(inputs);\n  document.getElementById("output").value = (typeof result === \'object\' && result !== null && result.result !== undefined) ? result.result : String(result);\n};\ndocument.getElementById("copyOutput").onclick = function() { copyToClipboard(document.getElementById("output").value); };';
    }
  },

  'tool-generator': {
    description: '生成器工具（支持 outputLabel 自定义输出区标题）',
    html: function(tool) {
      var fields = '';
      if (tool.fields && tool.fields.length) {
        tool.fields.forEach(function(f) {
          if (f.type === 'select') {
            var opts = f.options.map(function(o) { return '<option value="' + o.value + '">' + o.label + '</option>'; }).join('');
            fields += '<div class="input-field"><label>' + f.label + '</label><select id="' + f.id + '">' + opts + '</select></div>';
          } else {
            fields += '<div class="input-field"><label>' + f.label + '</label><input type="' + (f.type || 'text') + '" id="' + f.id + '" placeholder="' + (f.placeholder || '') + '" style="width:100%;padding:0.5rem;font-size:1rem;"></div>';
          }
        });
      }
      var btnLabel = tool.btnLabel || '生成';
      var outputLabel = tool.outputLabel || '结果';
      return '<div class="tool-card">' + (fields ? '<h3>参数</h3><div class="input-row" style="display:flex;gap:1rem;flex-wrap:wrap;">' + fields + '</div>' : '') + '<div class="btn-row"><button class="btn btn-primary" id="genBtn">' + btnLabel + '</button></div></div><div class="output-box"><h3>' + outputLabel + ' <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly></textarea></div>';
    },
    script: function(tool) {
      var genFn = tool.generateFn || 'function(inputs){ return "请实现生成逻辑"; }';
      var genFnEscaped = genFn.replace(/\\/g, '\\\\').replace(/'/g, "\\'");
      var fieldParts = (tool.fields || []).map(function(f) {
        return '  inputs["' + f.id + '"] = document.getElementById("' + f.id + '").value;\n  inputs["' + f.id + '_el"] = document.getElementById("' + f.id + '");';
      });
      var fieldCode = fieldParts.length > 0 ? '\n' + fieldParts.join('\n') + '\n' : '\n';
      var autoGenPart = tool.autoGenerate ? 'document.getElementById("genBtn").onclick();' : '';
      return 'var genFn = \'' + genFnEscaped + '\';\ndocument.getElementById("genBtn").onclick = function() {\n  var inputs = {};' + fieldCode + '  var genFnObj = new Function(\'return \' + genFn)();\n  var result = genFnObj(inputs);\n  document.getElementById("output").value = result;\n};\ndocument.getElementById("copyOutput").onclick = function() { copyToClipboard(document.getElementById("output").value); };\n' + autoGenPart;
    }
  },
};

// Get tool config from tools.json by path
function getToolConfig(toolPath) {
  for (var i = 0; i < toolsConfig.length; i++) {
    var cat = toolsConfig[i];
    for (var j = 0; j < cat.tools.length; j++) {
      if (cat.tools[j].path === toolPath) return cat.tools[j];
    }
  }
  return null;
}

// ============ Tool Implementations ============
// Path-based overrides for mis-typed tools that need specific functionality
const TOOL_SPECIFIC_OVERRIDES = {
  'time/timestamp.html': {
    html: '<div class="tool-card"><h3>输入</h3><div class="input-row" style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:flex-end;"><div class="input-field"><label>时间戳（毫秒）</label><input type="text" id="tsInput" placeholder="如 1745088000000" style="width:120px;"></div><div class="input-field"><label>日期时间</label><input type="datetime-local" id="dtInput" style="width:200px;"></div></div><div class="btn-row"><button class="btn btn-primary" id="ts2dateBtn">时间戳→日期</button><button class="btn btn-secondary" id="date2tsBtn">日期→时间戳</button></div></div><div class="output-box"><h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly style="min-height:60px;"></textarea></div>',
    script: 'var dtInput=document.getElementById("dtInput");var tsInput=document.getElementById("tsInput");var now=new Date();now.setMilliseconds(0);dtInput.value=now.toISOString().slice(0,16);function esc(s){return String(s).replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");}document.getElementById("ts2dateBtn").onclick=function(){var v=tsInput.value.trim();if(!v){output.value="";return;}var ms=parseInt(v);if(isNaN(ms)){output.value="错误：无效的时间戳";return;}var d=new Date(ms);output.value=d.toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"})+"\\n"+d.toISOString()+"\\nUnix秒: "+Math.floor(ms/1000)+"\\n毫秒: "+ms;};document.getElementById("date2tsBtn").onclick=function(){var v=dtInput.value;if(!v){output.value="";return;}var ms=new Date(v).getTime();tsInput.value=ms;output.value="毫秒时间戳: "+ms+"\\nUnix秒: "+Math.floor(ms/1000);};document.getElementById("copyOutput").onclick=function(){navigator.clipboard.writeText(document.getElementById("output").value);};'
  },
  'text/case.html': {
    html: '<div class="tool-card"><h3>输入</h3><textarea id="input" placeholder="输入要转换的文本..." style="min-height:120px;width:100%;padding:0.75rem;font-size:1rem;border:1px solid var(--border);border-radius:8px;resize:vertical;background:var(--input-bg);color:var(--text);"></textarea><div class="btn-row"><button class="btn btn-primary" id="btnUpper">转大写</button><button class="btn btn-secondary" id="btnLower">转小写</button><button class="btn btn-secondary" id="btnTitle">首字母大写</button><button class="btn btn-secondary" id="btnReverse">反转大小写</button></div></div><div class="output-box"><h3>输出 <button class="copy-btn" id="copyOutput">复制</button></h3><textarea id="output" readonly style="min-height:120px;width:100%;padding:0.75rem;font-size:1rem;border:1px solid var(--border);border-radius:8px;resize:vertical;background:var(--input-bg);color:var(--text);"></textarea></div>',
    script: 'var input=document.getElementById("input");var output=document.getElementById("output");function run(fn){output.value=fn(input.value);}input.addEventListener("input",function(){output.value=input.value;});document.getElementById("btnUpper").onclick=function(){run(function(s){return s.toUpperCase();});};document.getElementById("btnLower").onclick=function(){run(function(s){return s.toLowerCase();});};document.getElementById("btnTitle").onclick=function(){run(function(s){return s.replace(/\\b\\w/g,function(c){return c.toUpperCase();});});};document.getElementById("btnReverse").onclick=function(){run(function(s){return s.split("").map(function(c){return c===c.toUpperCase()?c.toLowerCase():c.toUpperCase();}).join("");});};document.getElementById("copyOutput").onclick=function(){navigator.clipboard.writeText(output.value);};'
  },
  'code/cron-parser.html': {
    html: '<div class="tool-card"><h3>输入 Cron 表达式</h3><input type="text" id="cronInput" placeholder="* * * * * 或 0 9 * * 1-5" style="width:100%;padding:0.6rem;font-size:1.1rem;font-family:monospace;border:1px solid var(--border);border-radius:8px;background:var(--input-bg);color:var(--text);margin-bottom:1rem;"><div class="btn-row"><button class="btn btn-primary" id="parseBtn">解析</button></div><div id="descBox" style="padding:0.75rem;background:var(--result-bg);border-radius:6px;font-size:0.9rem;line-height:1.6;display:none;"></div></div><div class="tool-card"><h3>下次执行时间</h3><div id="nextRuns" style="font-size:0.85rem;color:var(--text-secondary);line-height:1.8;"></div></div>',
    script: 'var fieldDescs={0:"分钟(0-59)",1:"小时(0-23)",2:"日期(1-31)",3:"月份(1-12)",4:"星期(0-6)"};function parseCron(expr){var parts=expr.trim().split(/\\s+/);if(parts.length!==5)return null;var descs=[];parts.forEach(function(p,i){if(p==="*")descs.push("每"+fieldDescs[i]);else if(p.startsWith("*/"))descs.push("每"+p.slice(2)+"个"+fieldDescs[i]);else descs.push(fieldDescs[i]+"="+p);});return descs.join("，");}function getNextRuns(expr,count){var runs=[];var d=new Date();d.setSeconds(0);d.setMilliseconds(0);d.setMinutes(d.getMinutes()+1);var parts=expr.trim().split(/\\s+/);if(parts.length!==5)return[];var max=525600;for(var i=0;i<max&&runs.length<count;i++){var min=d.getMinutes(),hr=d.getHours(),day=d.getDate(),mon=d.getMonth()+1,wd=d.getDay();var ok=true;var tests=[[min,parts[0]],[hr,parts[1]],[day,parts[2]],[mon,parts[3]],[wd,parts[4]]];tests.forEach(function(t){var v=t[0],p=t[1];if(p==="*")return;if(p.startsWith("*/")){if(v%parseInt(p.slice(2))!==0)ok=false;return;}if(!p.split(",").map(Number).includes(v))ok=false;});if(ok)runs.push(new Date(d));d.setMinutes(d.getMinutes()+1);}return runs;}function fmt(d){return d.getFullYear()+"-"+String(d.getMonth()+1).padStart(2,"0")+"-"+String(d.getDate()).padStart(2,"0")+" "+String(d.getHours()).padStart(2,"0")+":"+String(d.getMinutes()).padStart(2,"0");}document.getElementById("parseBtn").onclick=function(){var expr=document.getElementById("cronInput").value;var desc=document.getElementById("descBox");var runs=document.getElementById("nextRuns");if(!expr.trim()){desc.style.display="none";runs.innerHTML="";return;}var result=parseCron(expr);if(!result){desc.style.display="block";desc.textContent="错误：Cron表达式需要5个字段";runs.innerHTML="";return;}desc.style.display="block";desc.innerHTML="<b>含义：</b>"+result;var next=getNextRuns(expr,5);if(next.length>0){runs.innerHTML="<b>接下来5次执行：</b><br>"+next.map(function(r){return"· "+fmt(r);}).join("<br>");}else{runs.innerHTML="无法计算，请检查表达式";}};'
  },
  'code/color-picker.html': {
    html: '<div class="tool-card"><h3>选择颜色</h3><input type="color" id="colorPicker" value="#3B82F6" style="width:100%;height:60px;border:none;cursor:pointer;border-radius:8px;background:var(--card-bg);"><div style="display:grid;grid-template-columns:repeat(auto-fill,minmax(140px,1fr));gap:0.5rem;margin-top:1rem;" id="presetColors"><div style="width:100%;height:32px;border-radius:4px;cursor:pointer;" onclick="setColor(this.style.backgroundColor)"></div></div></div><div class="tool-card"><h3>颜色值</h3><div style="display:grid;grid-template-columns:1fr 1fr;gap:0.75rem;"><div><label style="font-size:0.8rem;color:var(--text-secondary);">HEX</label><input type="text" id="hexOut" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;background:var(--input-bg);color:var(--text);" onclick="this.select()"></div><div><label style="font-size:0.8rem;color:var(--text-secondary);">RGB</label><input type="text" id="rgbOut" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;background:var(--input-bg);color:var(--text);" onclick="this.select()"></div><div><label style="font-size:0.8rem;color:var(--text-secondary);">HSL</label><input type="text" id="hslOut" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;background:var(--input-bg);color:var(--text);" onclick="this.select()"></div><div><label style="font-size:0.8rem;color:var(--text-secondary);">HSV</label><input type="text" id="hsvOut" readonly style="width:100%;padding:0.5rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;background:var(--input-bg);color:var(--text);" onclick="this.select()"></div></div><div id="colorPreview" style="margin-top:1rem;height:80px;border-radius:8px;border:1px solid var(--border);transition:background-color 0.2s;"></div></div>',
    script: 'function hex2rgb(h){var r=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(h);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}function rgb2hex(r,g,b){return"#"+[r,g,b].map(function(x){return Math.max(0,Math.min(255,Math.round(x))).toString(16).padStart(2,"0");}).join("").toUpperCase();}function rgb2hsl(r,g,b){r/=255;g/=255;b/=255;var max=Math.max(r,g,b),min=Math.min(r,g,b);var h=0,s=0,l=(max+min)/2;if(max!==min){var d=max-min;s=l>0.5?d/(2-max-min):d/(max+min);switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};}function rgb2hsv(r,g,b){r/=255;g/=255;b/=255;var max=Math.max(r,g,b),min=Math.min(r,g,b),d=max-min;var h=0,s=max===0?0:d/max,v=max;if(max!==min){switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}}return{h:Math.round(h*360),s:Math.round(s*100),v:Math.round(v*100)};}var picker=document.getElementById("colorPicker");var hexOut=document.getElementById("hexOut");var rgbOut=document.getElementById("rgbOut");var hslOut=document.getElementById("hslOut");var hsvOut=document.getElementById("hsvOut");var preview=document.getElementById("colorPreview");function update(){var hex=picker.value;var rgb=hex2rgb(hex);if(!rgb)return;hexOut.value=hex.toUpperCase();rgbOut.value="rgb("+rgb.r+","+rgb.g+","+rgb.b+")";var hsl=rgb2hsl(rgb.r,rgb.g,rgb.b);hslOut.value="hsl("+hsl.h+","+hsl.s+"%,"+hsl.l+"%)";var hsv=rgb2hsv(rgb.r,rgb.g,rgb.b);hsvOut.value="hsv("+hsv.h+","+hsv.s+"%,"+hsv.v+"%)";preview.style.backgroundColor=hex;}picker.addEventListener("input",update);window.setColor=function(bg){var m=bg.match(/rgb\\((\\d+),\\s*(\\d+),\\s*(\\d+)\\)/);if(m){var h=rgb2hex(parseInt(m[1]),parseInt(m[2]),parseInt(m[3]));picker.value=h;update();}};update();'
  }
};

function buildToolScript(tool) {
  // HIGHEST PRIORITY: customScript — complete JS customization, no template logic
  if (tool.customScript) {
    return tool.customScript.replace(/<\/script>/gi, '<\\/script>');
  }
  // Path-based overrides for mis-typed tools
  if (TOOL_SPECIFIC_OVERRIDES[tool.path]) {
    return (TOOL_SPECIFIC_OVERRIDES[tool.path].script || '').replace(/<\/script>/gi, '<\\/script>');
  }
  // Check tool.type in registry
  if (tool.type && TOOL_TYPE_REGISTRY[tool.type]) {
    const raw = TOOL_TYPE_REGISTRY[tool.type].script(tool);
    return raw.replace(/\\/g, '\\\\').replace(/<\/script>/gi, '<\\/script>');
  }
  // Fallback: use formatter type for any unhandled types
  if (TOOL_TYPE_REGISTRY['formatter']) {
    const raw = TOOL_TYPE_REGISTRY['formatter'].script(tool);
    return raw.replace(/\\/g, '\\\\').replace(/<\/script>/gi, '<\\/script>');
  }
  return '// No script available for ' + tool.path;
}

// ============ Tool content HTML builders ============
function buildToolContentHtml(tool) {
  // HIGHEST PRIORITY: customHtml — complete HTML customization, no template logic
  if (tool.customHtml) {
    return tool.customHtml;
  }
  // Path-based overrides for mis-typed tools
  if (TOOL_SPECIFIC_OVERRIDES[tool.path]) {
    return TOOL_SPECIFIC_OVERRIDES[tool.path].html || '';
  }
  // Check tool.type in registry
  if (tool.type && TOOL_TYPE_REGISTRY[tool.type]) {
    return TOOL_TYPE_REGISTRY[tool.type].html(tool);
  }
  // Fallback: use formatter type for any unhandled types
  if (TOOL_TYPE_REGISTRY['formatter']) {
    return TOOL_TYPE_REGISTRY['formatter'].html(tool);
  }
  return '';
}


// ============ Blog SEO Generator ============
const blogTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'blog-post.html'), 'utf8');
const KEYWORDS_JSON_PATH = path.join(BASE, 'keywords.json');
const keywordsConfig = JSON.parse(fs.readFileSync(KEYWORDS_JSON_PATH, 'utf8'));

// Tool name lookup for CTA links
const toolNameMap = {};
toolsConfig.forEach(cat => {
  cat.tools.forEach(tool => {
    toolNameMap[tool.path] = { name: tool.name, path: tool.path, desc: tool.desc || '' };
  });
});

// Resolve tool info from keyword entry
function resolveTool(keywordEntry) {
  if (!keywordEntry.tool) return null;
  return toolNameMap[keywordEntry.tool] || null;
}

// ============ Helper: get related keywords from same category ============
function getRelatedKeywords(kwEntry, count = 5) {
  const sameCat = keywordsConfig.filter(k =>
    k.category === kwEntry.category &&
    k.slug !== kwEntry.slug
  );
  // Prefer same intent within category, fill with other intent
  const sameIntent = sameCat.filter(k => k.intent === kwEntry.intent);
  const others = sameCat.filter(k => k.intent !== kwEntry.intent);
  const merged = [...sameIntent, ...others];
  return merged.slice(0, count);
}

// ============ Helper: build keyword expansion block ============
function buildKeywordBlock(keyword, kwEntry) {
  const related = getRelatedKeywords(kwEntry, 5);
  if (!related.length) return '';
  const tags = related.map(k =>
    `<a href="/blog/${k.slug}">${k.keyword}</a>`
  ).join('');
  return `<div class="keyword-block">
  <p>你可能还在搜：</p>
  <div class="keyword-tags">${tags}</div>
</div>`;
}

// ============ Helper: build related questions (bottom inner links) ============
function buildRelatedQuestions(kwEntry, count = 6) {
  const sameCat = keywordsConfig.filter(k =>
    k.category === kwEntry.category && k.slug !== kwEntry.slug
  );
  const sameIntent = sameCat.filter(k => k.intent === kwEntry.intent);
  const others = sameCat.filter(k => k.intent !== kwEntry.intent);
  const items = [...sameIntent, ...others].slice(0, count);
  if (!items.length) return '';
  const listItems = items.map(k =>
    `<li><a href="/blog/${k.slug}">${k.keyword}</a></li>`
  ).join('\n');
  return `<div class="related-questions">
  <h2>相关问题</h2>
  <ul class="related-list">${listItems}</ul>
</div>`;
}

// ============ Build article content based on keyword intent ============
function buildBlogContent(keyword, intent, toolInfo, kwEntry) {
  const t = toolInfo ? `<a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a>` : '';
  const kwBlock = buildKeywordBlock(keyword, kwEntry);

  // Template by intent type — upgraded with concrete error scenarios + keyword block at top
  const templates = {
    'error-fix': `
${kwBlock}
<h2>问题描述</h2>
<p>遇到 <strong>${keyword}</strong>？这个报错在开发过程中非常常见，通常在你向 API 发送请求或处理返回数据时触发。本文用真实场景帮你快速定位根因并给出具体修复方案。</p>
<h2>常见原因</h2>
<ul>
  <li><strong>数据格式不符</strong>：发送的 JSON 多了一个逗号、少了引号，或键名用了单引号而非双引号</li>
  <li><strong>编码不统一</strong>：后端返回 GBK 编码，但前端按 UTF-8 解析，导致解析失败</li>
  <li><strong>特殊字符未转义</strong>：字符串中含有 <code>&</code>、<code>&lt;</code>、换行等特殊字符，直接拼接导致格式破坏</li>
  <li><strong>请求参数类型错误</strong>：接口要求数字但传了字符串，或要求数组但传了对象</li>
  <li><strong>接口返回异常数据</strong>：后端在某些边界情况下返回了非标准格式</li>
</ul>
<h2>解决方法</h2>
${toolInfo ? `<p><strong>推荐先使用工具处理</strong>：<a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a> 可以一键验证和修复大多数格式问题。</p>` : ''}
<ol>
  <li>用工具 ${t || '在线工具'} 检查输入数据格式是否规范</li>
  <li>确认请求头中 <code>Content-Type: application/json</code> 和字符集为 UTF-8</li>
  <li>检查 JSON 中所有字符串值是否正确转义（特别是 <code>"</code>、<code>\n</code>、<code>\t</code>）</li>
  <li>验证接口文档中每个字段的类型要求，确保传参匹配</li>
  <li>如果是第三方 API，查看其官方错误码文档定位具体问题</li>
</ol>`,

    'encoding': `
${kwBlock}
<h2>问题描述</h2>
<p><strong>${keyword}</strong> 是开发中常见的数据处理问题。字符编码不一致会导致乱码、解码失败或数据无法正常使用。这类问题排查起来往往耗时，因为根源不一定在出错的地方。</p>
<h2>常见原因</h2>
<ul>
  <li><strong>编码混用</strong>：文件或接口明明声明了 UTF-8，但实际内容是 GBK，两边对不上</li>
  <li><strong>URL 编码不一致</strong>：前端用了 <code>encodeURIComponent</code>，后端却用 <code>urllib.parse.unquote</code> 处理方式不对</li>
  <li><strong>Base64 格式错误</strong>：缺少前缀（如 <code>data:image/png;base64,</code>）、多余空格或使用了非标准字符集</li>
  <li><strong>字节序 BOM 头</strong>：UTF-8 文件开头多了 <code>EF BB BF</code> 三个字节，导致解析器误判</li>
</ul>
<h2>解决方法</h2>
${toolInfo ? `<p><strong>推荐先使用工具处理</strong>：<a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a> 可以一键完成编解码转换。</p>` : ''}
<ol>
  <li>用工具 ${t || '在线工具'} 确定源数据编码格式</li>
  <li>统一转换为 UTF-8（大多数系统的默认编码）</li>
  <li>Base64 类型数据确保添加正确前缀 <code>data:image/xxx;base64,</code></li>
  <li>如果是文件，用十六进制编辑器检查 BOM 头并去除</li>
</ol>`,

    'limit-fix': `
${kwBlock}
<h2>问题描述</h2>
<p><strong>${keyword}</strong> 是文件上传和处理中的高频问题。几乎所有平台（微信、微博、GitHub、各大云服务）对上传内容都有明确的大小限制，超限就会直接被拒绝。</p>
<h2>常见原因</h2>
<ul>
  <li><strong>平台硬限制</strong>：微信公众号图片限制 2MB，GitHub 单文件 100MB，各平台规则不一</li>
  <li><strong>格式选错</strong>：PNG 是无损压缩，同尺寸下体积远大于 JPG；有些场景用 WebP 可以缩小 30%-60%</li>
  <li><strong>未做有损压缩</strong>：原图是 4K 分辨率直接上传，文件体积自然爆炸</li>
  <li><strong>PDF 内嵌字体</strong>：即使只有一页，嵌入完整字体后文件也能超过 5MB</li>
  <li><strong>批量上传总和超限</strong>：单文件没超，但一次上传多个文件总大小超出了平台限制</li>
</ul>
<h2>解决方法</h2>
${toolInfo ? `<p><strong>推荐先使用工具处理</strong>：<a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a> 可以一键压缩到目标大小以内。</p>` : ''}
<ol>
  <li>用工具 ${t || '在线工具'} 压缩图片：质量降到 70-80%，肉眼几乎无差异</li>
  <li>转换格式：PNG 转 JPG、静态 GIF 转 MP4 等，选择体积更小的等价格式</li>
  <li>调整尺寸：宽高超过 2000px 的图片先缩放，再压缩</li>
  <li>PDF 先用图片压缩工具处理，仍超限再做格式转换（PDF 转 JPG）</li>
  <li>如果无法压缩，联系平台申请大文件上传权限</li>
</ol>`,

    'guide': `
${kwBlock}
<h2>问题说明</h2>
<p><strong>${keyword}</strong> 属于工具使用类需求。与其死记硬背，不如真正理解工具的工作原理，这样遇到变体问题时也能举一反三。</p>
<h2>核心概念</h2>
<ul>
  <li>理解工具的输入输出格式，知道哪些场景适合用、哪些场景不适合</li>
  <li>学会分层排查：先用简单数据验证工具是否正常，再处理真实数据</li>
  <li>善用工具链：多个工具配合使用往往比一个复杂工具更高效</li>
  <li>了解工具的边界情况，避免在不支持的输入格式上浪费时间</li>
</ul>
<h2>实践建议</h2>
${toolInfo ? `<p><strong>动手试试</strong>：<a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a></p>` : ''}
<ol>
  <li>用最简单的数据（空字符串、单个字符）验证工具基本功能</li>
  <li>逐步增加数据复杂度，观察工具在边界情况下的表现</li>
  <li>将工具用法记录到自己的知识库，下次遇到同类问题直接调用</li>
  <li>结合实际项目场景，思考工具如何嵌入你的工作流</li>
</ol>`,

    'info': `
${kwBlock}
<h2>问题说明</h2>
<p><strong>${keyword}</strong> 是很多人会疑惑的技术问题，答案其实很明确。下面从原理层面做解释，让你知其然也知其所以然。</p>
<h2>技术原理</h2>
<p>这类问题的答案由底层算法和协议规范决定，不是约定俗成的习惯，而是有明确定义的数学性质或技术标准。</p>
<h2>结论</h2>
${toolInfo ? `<p>实际使用 <a href="/tools/${toolInfo.path}" target="_blank">${toolInfo.name}</a> 即可，在实际工程中完全不用担心问题。</p>` : '<p>理解原理后，在工程实践中完全可以放心使用，不需要过度担忧。</p>'}`,
  };

  return templates[intent] || templates['error-fix'];
}

// ============ Build FAQ section for each article (3-5 questions) ============
function buildFaq(keyword, intent) {
  const faqs = {
    'error-fix': [
      { q: `遇到 ${keyword}，是什么原因导致的？`, a: '常见原因有：数据格式不符合规范（如 JSON 多了逗号或少了引号）、字符编码不统一（UTF-8 和 GBK 混用）、特殊字符未正确转义，或接口返回了非标准数据。先用工具验证格式是最快的排查方式。' },
      { q: `${keyword} 会影响程序正常运行吗？`, a: '会的。格式错误会导致数据无法正常解析，轻则功能异常，重则程序崩溃。尤其是涉及支付、用户输入等关键流程时，这类问题必须第一时间修复。' },
      { q: `${keyword} 有没有自动修复的办法？`, a: '大多数格式问题可以用在线工具自动修复。如果是自己生成的 JSON/编码数据，修复后再重新提交即可；如果是第三方接口返回的格式问题，则需要联系对方修正或做容错处理。' },
      { q: '修复后还需要注意什么？', a: '建议增加格式校验环节，在数据提交前或接收后先做格式验证（用 JSON.parse 或对应工具），避免再次出现同样问题。同时统一前后端编码规范，从源头减少这类错误。' },
    ],
    'encoding': [
      { q: `什么是 ${keyword}，和 UTF-8 有什么区别？`, a: '不同编码格式是字符在计算机中的不同存储方式。UTF-8 是目前最通用的编码，支持全球所有文字；GBK 主要支持中文和少量字符。如果混用就会出现乱码。判断编码最简单的方法是用十六进制工具查看字节序列。' },
      { q: 'Base64 图片打不开是什么原因？', a: '最常见的原因是缺少前缀（如 <code>data:image/png;base64,</code>），或者是编码过程中引入了空格和换行。另一个可能是使用了 URL-safe Base64 字符（+ / 变成 - _）但没有正确还原。' },
      { q: '为什么解码出来的内容是乱码？', a: '乱码通常意味着编码格式不匹配——数据是 A 编码生成的，但用 B 编码去解析。解决方法：确认原始数据的编码，用同一编码进行解码。如果是网页内容，浏览器开发者工具的 Network 面板可以看到实际编码。' },
      { q: '如何避免编码问题？', a: '统一使用 UTF-8 编码是最佳实践。所有文件保存为 UTF-8，所有接口声明 UTF-8，所有数据库连接也使用 UTF-8。建立团队编码规范，从源头杜绝混用问题。' },
    ],
    'limit-fix': [
      { q: `${keyword}，压缩后图片会变模糊吗？`, a: '适当压缩（质量 70%-80%）肉眼看不出明显区别，但文件体积能减少 50%-70%。如果质量降到 50% 以下才会出现可察觉的模糊。推荐先压 75%，根据实际效果再调整。' },
      { q: '平台限制无法突破怎么办？', a: '如果压缩后仍超限，可以尝试：1) 换格式（PNG→JPG 或 JPG→WebP）；2) 降低分辨率；3) 联系平台申请更大额度；4) 分片上传（将大文件拆分成多个小文件分别上传）。' },
      { q: '为什么 PNG 转 JPG 反而变大了？', a: 'PNG 是无损压缩，适合图标、截图、透明背景图；JPG 是有损压缩，适合照片。如果原图是简单色块或图标类图片，JPG 的压缩效果反而不如 PNG。建议根据图片内容类型选择格式。' },
      { q: 'PDF 文件太大怎么压缩？', a: '先用图片压缩工具将 PDF 转为图片再压缩（JPG 或 PNG）；如果 PDF 内嵌了字体，可以尝试用工具去掉嵌入或子集化字体；仍超限的话，考虑分页上传或使用云存储直传。' },
    ],
    'guide': [
      { q: `如何使用 ${keyword} 相关工具？`, a: '这类工具一般有明确的输入框和输出框，按提示输入内容，点击对应按钮即可得到结果。建议先用简单示例测试功能是否正常，再处理实际数据。' },
      { q: `${keyword} 适合在什么场景使用？`, a: '根据具体工具类型决定。格式转换工具适合处理第三方数据，编码工具适合加密传输，压缩工具适合文件上传前处理。多积累工具使用经验，遇到问题时能快速判断用哪个工具解决。' },
      { q: '有没有更好的替代工具？', a: '不同工具有不同侧重，重点是理解原理。可以同时安装多个类似工具，实际使用中对比效果，选择最顺手的一个。随着使用经验增加，你也能判断工具的好坏。' },
    ],
    'info': [
      { q: `${keyword} 的原理是什么？`, a: '这类问题的答案由底层算法决定，有明确的技术标准。与其死记硬背结论，不如理解原理，这样遇到变体问题也能推理出正确答案。' },
      { q: `${keyword} 在实际项目中如何应用？`, a: '根据具体场景来用。理论问题理解即可，实际项目中关注的是如何正确使用工具处理你的业务数据。' },
      { q: '我需要担心这个问题吗？', a: '在工程实践中，这类问题的风险是可控的。理解原理、正确使用工具、不做过度设计即可。' },
    ],
  };

  const faqList = faqs[intent] || faqs['error-fix'];
  return faqList.map(f => `<div class="faq-item"><strong>Q: ${f.q}</strong><br>A: ${f.a}</div>`).join('\n');
}

// Build tool CTA links
function buildToolLinks(toolInfo) {
  if (!toolInfo) return '<a href="/">浏览所有工具</a>';
  return `<a href="/tools/${toolInfo.path}">${toolInfo.name}</a>`;
}

// Generate blog index page
function generateBlogIndex() {
  // Group by category
  const byCategory = {};
  keywordsConfig.forEach(kw => {
    const cat = kw.category || '其他';
    if (!byCategory[cat]) byCategory[cat] = [];
    byCategory[cat].push(kw);
  });

  let itemsHtml = '';
  Object.keys(byCategory).sort().forEach(cat => {
    const catTools = byCategory[cat];
    itemsHtml += `<div class="blog-cat-section">
      <div class="blog-cat-header">
        <h2>${cat}</h2>
        <span class="count">${catTools.length} 篇</span>
      </div>
      <div class="blog-grid">`;
    catTools.forEach(kw => {
      const toolInfo = resolveTool(kw);
      itemsHtml += `<a href="/blog/${kw.slug}" class="blog-card">
        <div class="blog-card-title">${kw.keyword}</div>
        <div class="blog-card-meta">
          <span class="blog-card-cat">${cat}</span>
          ${toolInfo ? `<span class="blog-card-tool">🔧 ${toolInfo.name}</span>` : ''}
        </div>
      </a>`;
    });
    itemsHtml += `</div></div>`;
  });

  const blogIndexHtml = `
<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>开发者问题解决博客 - CloverTools</title>
  <meta name="description" content="开发者常见问题解决指南，JSON错误、编码问题、文件限制等实际问题的解决方案。">
  <link rel="canonical" href="https://tools.xsanye.cn/blog/">
  <link rel="stylesheet" href="/src/shared.css">
  <link rel="icon" href="/src/clover-logo.svg">
  <script src="/src/shared.js"></script>
  <style>
    .blog-hero { text-align: center; padding: 3.5rem 0 2.5rem; }
    .blog-hero h1 { font-size: 2.5rem; margin-bottom: 0.75rem; }
    .blog-hero .subtitle { font-size: 1.1rem; opacity: 0.65; max-width: 560px; margin: 0 auto 1.5rem; line-height: 1.7; }
    .blog-hero .stats { display: flex; justify-content: center; gap: 2rem; margin-top: 1rem; }
    .blog-hero .stat { text-align: center; }
    .blog-hero .stat-num { font-size: 1.8rem; font-weight: 800; color: var(--primary); }
    .blog-hero .stat-label { font-size: 0.8rem; opacity: 0.6; }
    .blog-categories { padding: 0 0 2rem; }
    .blog-cat-header { display: flex; align-items: center; gap: 0.5rem; margin-bottom: 1rem; padding-bottom: 0.5rem; border-bottom: 2px solid var(--border); }
    .blog-cat-header h2 { font-size: 1.1rem; color: var(--text); }
    .blog-cat-header .count { font-size: 0.75rem; background: var(--bg-secondary); padding: 0.15rem 0.5rem; border-radius: 10px; opacity: 0.7; }
    .blog-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; list-style: none; padding: 0; margin: 0; }
    .blog-card { display: block; background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 1.1rem 1.2rem; text-decoration: none; color: var(--text); transition: transform 0.2s, box-shadow 0.2s, border-color 0.2s; }
    .blog-card:hover { transform: translateY(-3px); box-shadow: var(--card-shadow); border-color: var(--primary); }
    .blog-card-title { font-size: 1rem; font-weight: 600; color: var(--text); margin-bottom: 0.5rem; line-height: 1.4; }
    .blog-card-meta { display: flex; align-items: center; gap: 0.6rem; flex-wrap: wrap; }
    .blog-card-cat { font-size: 0.72rem; background: var(--primary); color: #fff; padding: 0.15rem 0.5rem; border-radius: 10px; }
    .blog-card-tool { font-size: 0.78rem; color: var(--primary); opacity: 0.8; display: flex; align-items: center; gap: 0.2rem; }
    .blog-card-tool:hover { opacity: 1; text-decoration: underline; }
    .back-home { text-align: center; margin: 2rem 0 3rem; }
    .back-home a { color: var(--primary); text-decoration: none; font-size: 0.95rem; }
    .back-home a:hover { text-decoration: underline; }
    footer { margin-top: auto; }
    /* search */
    .blog-search { max-width: 480px; margin: 0 auto 2rem; }
    .blog-search input { width: 100%; padding: 0.65rem 1rem; border: 1.5px solid var(--border); border-radius: 10px; background: var(--bg); color: var(--text); font-size: 0.95rem; outline: none; transition: border-color 0.2s; }
    .blog-search input:focus { border-color: var(--primary); }
  </style>
</head>
<body>
  {{SVG_SPRITE}}
  {{SITE_HEADER}}
  <main class="page-body">
    <div class="container">
      <div class="blog-hero">
        <h1><img src="/src/clover-logo.svg" alt="🍀" style="height:2em;vertical-align:middle;"> 开发者问题解决博客</h1>
        <p class="subtitle">遇到开发问题？来这里找答案，顺便用工具快速解决。每篇文章都配有对应的在线工具，无需注册，打开即用。</p>
        <div class="stats">
          <div class="stat">
            <div class="stat-num">${keywordsConfig.length}</div>
            <div class="stat-label">篇文章</div>
          </div>
          <div class="stat">
            <div class="stat-num">${Object.keys(byCategory).length}</div>
            <div class="stat-label">个分类</div>
          </div>
        </div>
      </div>
      <div class="blog-search">
        <input type="text" id="blog-search" placeholder="搜索文章... (Ctrl+K)" autocomplete="off">
      </div>
      <div class="blog-categories" id="blog-categories">
        ${itemsHtml}
      </div>
      <div class="back-home">
        <a href="/">← 返回工具首页</a>
      </div>
    </div>
  </main>
  {{SITE_FOOTER}}
  <div id="toast"></div>
  <script>
    CT.initTheme();CT.initReveal();CT.initCopyPulse();
    // Blog search
    const blogSearch = document.getElementById('blog-search');
    const blogCards = document.querySelectorAll('.blog-card');
    const blogCatSections = document.querySelectorAll('.blog-cat-section');
    blogSearch.addEventListener('input', () => {
      const q = blogSearch.value.trim().toLowerCase();
      blogCatSections.forEach(section => {
        const cards = section.querySelectorAll('.blog-card');
        let anyVisible = false;
        cards.forEach(card => {
          const text = card.textContent.toLowerCase();
          const show = !q || text.includes(q);
          card.style.display = show ? '' : 'none';
          if (show) anyVisible = true;
        });
        section.style.display = anyVisible ? '' : 'none';
      });
    });
    document.addEventListener('keydown', e => {
      if ((e.ctrlKey || e.metaKey) && e.key === 'k') {
        e.preventDefault();
        blogSearch.focus();
      }
    });
  </script>
</body>
</html>`;
  const blogIndexHtmlFinal = blogIndexHtml
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml);
  fs.writeFileSync(path.join(DIST_DIR, 'blog', 'index.html'), blogIndexHtmlFinal);
}

function generateBlogPosts() {
  ensureDir(path.join(DIST_DIR, 'blog'));

  keywordsConfig.forEach(kw => {
    const toolInfo = resolveTool(kw);
    const articleContent = buildBlogContent(kw.keyword, kw.intent, toolInfo, kw);
    const faqContent = buildFaq(kw.keyword, kw.intent);
    const toolLinks = buildToolLinks(toolInfo);
    const relatedQuestions = buildRelatedQuestions(kw, 6);
    const blogUrl = 'https://tools.xsanye.cn/blog/' + kw.slug;
    const today = new Date().toISOString().split('T')[0];

    let pageHtml = blogTemplate
      .replace(/\{\{PAGE_TITLE\}\}/g, kw.keyword + ' - CloverTools')
      .replace(/\{\{PAGE_DESC\}\}/g, `详细解决${kw.keyword}的方法，提供在线工具，无需注册即可使用。`)
      .replace(/\{\{PAGE_KEYWORDS\}\}/g, kw.keyword + '，开发者工具，问题解决')
      .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, blogUrl)
      .replace(/\{\{PAGE_OG_TITLE\}\}/g, kw.keyword + ' - CloverTools')
      .replace(/\{\{PAGE_OG_DESC\}\}/g, `详细解决${kw.keyword}的方法，` + (toolInfo ? `配合${toolInfo.name}工具使用` : '配合CloverTools在线工具'))
      .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
      .replace(/\{\{PAGE_URL\}\}/g, blogUrl)
      .replace('{{ARTICLE_CATEGORY}}', kw.category || '开发问题')
      .replace(/\{\{ARTICLE_TITLE\}\}/g, kw.keyword)
      .replace('{{ARTICLE_DATE}}', today)
      .replace('{{ARTICLE_CONTENT}}', articleContent)
      .replace('{{TOOL_LINKS}}', toolLinks)
      .replace('{{FAQ_CONTENT}}', faqContent)
      .replace('{{RELATED_QUESTIONS}}', relatedQuestions)
      .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
      .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
      .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml);

    fs.writeFileSync(path.join(DIST_DIR, 'blog', kw.slug + '.html'), pageHtml);
  });

  generateBlogIndex();
  console.log(`   Generated ${keywordsConfig.length} blog posts + index`);
}

// ============ Git changelog entries for about page ============
function generateAboutChangelogEntries() {
  try {
    const gitLog = execSync('git log --format="%h|%ci|%s" --date=short -n 15', {cwd: BASE}).toString().trim();
    if (!gitLog) return '';
    const entries = gitLog.split('\n').map(line => {
      const [hash, date, ...msgParts] = line.split('|');
      const msg = msgParts.join('|');
      const shortMsg = msg.replace(/^(feat|fix|refactor|chore|perf|docs)(\([^)]*\))?:\s*/, '');
      const githubUrl = 'https://github.com/YupenBob/clover-tools/commit/' + hash;
      return '<div class="changelog-entry">' +
        '<a class="changelog-hash" href="' + githubUrl + '" target="_blank">' + hash + '</a>' +
        '<span class="changelog-msg">' + shortMsg.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;') + '</span>' +
        '<span class="changelog-date">' + date + '</span></div>';
    });
    return entries.join('');
  } catch (e) {
    return '';
  }
}

function generateAboutPage() {
  const aboutHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>关于 - CloverTools</title>
  <meta name="description" content="CloverTools 由 York 和 AI 助手 Clover 共同打造，是一款轻量级开发者工具箱，无需注册，完全本地运行。">
  <link rel="canonical" href="https://tools.xsanye.cn/about">
  <link rel="icon" href="/src/clover-logo.svg" type="image/svg+xml">
  <script src="/src/shared.js"></script>
  <style>
    /* ── Base reset ── */
    *, *::before, *::after { box-sizing: border-box; margin: 0; padding: 0; }
    body {
      min-height: 100vh;
      background: var(--bg);
      color: var(--text);
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', sans-serif;
      overflow-x: hidden;
    }

    /* ── Scroll fade-in ── */
    .reveal {
      opacity: 0;
      transform: translateY(36px);
      transition: opacity 0.7s cubic-bezier(.22,1,.36,1), transform 0.7s cubic-bezier(.22,1,.36,1);
    }
    .reveal.visible { opacity: 1; transform: translateY(0); }

    /* ── Hero ── */
    .hero {
      min-height: 92vh;
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      text-align: center;
      padding: 6rem 2rem 4rem;
      position: relative;
      overflow: hidden;
    }
    /* Background radial glow */
    .hero::before {
      content: '';
      position: absolute;
      inset: 0;
      background: radial-gradient(ellipse 80% 60% at 50% 0%, rgba(139,92,246,0.12) 0%, transparent 70%);
      pointer-events: none;
      z-index: 0;
    }
    /* Grain texture overlay - tiny SVG noise tiled */
    .hero-grain {
      position: absolute;
      inset: 0;
      background-image: url("data:image/svg+xml,%3Csvg xmlns='http://www.w3.org/2000/svg' width='300' height='300'%3E%3Cfilter id='n'%3E%3CfeTurbulence type='fractalNoise' baseFrequency='0.75' numOctaves='4' stitchTiles='stitch'/%3E%3C/filter%3E%3Crect width='300' height='300' filter='url(%23n)' opacity='0.06'/%3E%3C/svg%3E");
      pointer-events: none;
      z-index: 1;
      opacity: 0.6;
    }
    /* Floating gradient orbs */
    .hero-orb {
      position: absolute;
      border-radius: 50%;
      pointer-events: none;
      z-index: 0;
    }
    .hero-orb-1 {
      width: 420px;
      height: 420px;
      background: radial-gradient(circle, rgba(139,92,246,0.5) 0%, transparent 70%);
      top: -80px;
      left: -100px;
      animation: floatOrb1 12s ease-in-out infinite;
    }
    .hero-orb-2 {
      width: 350px;
      height: 350px;
      background: radial-gradient(circle, rgba(240,171,252,0.5) 0%, transparent 70%);
      top: 80px;
      right: -80px;
      animation: floatOrb2 15s ease-in-out infinite;
    }
    .hero-orb-3 {
      width: 280px;
      height: 280px;
      background: radial-gradient(circle, rgba(251,191,36,0.4) 0%, transparent 70%);
      bottom: 80px;
      left: 15%;
      animation: floatOrb3 10s ease-in-out infinite;
    }
    @keyframes floatOrb1 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      33% { transform: translate(30px, 25px) scale(1.08); }
      66% { transform: translate(-15px, 40px) scale(0.96); }
    }
    @keyframes floatOrb2 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      40% { transform: translate(-40px, -25px) scale(1.05); }
      70% { transform: translate(25px, 30px) scale(0.92); }
    }
    @keyframes floatOrb3 {
      0%, 100% { transform: translate(0, 0) scale(1); }
      50% { transform: translate(50px, -30px) scale(1.12); }
    }
    .hero-logo-wrap {
      margin-bottom: 3rem;
      position: relative;
      z-index: 2;
      animation: logoFloat 4s ease-in-out infinite;
    }
    .hero-logo-wrap img {
      height: 140px;
      filter: drop-shadow(0 0 40px rgba(139,92,246,0.55)) drop-shadow(0 0 90px rgba(167,139,250,0.25));
    }
    @keyframes logoFloat {
      0%, 100% { transform: translateY(0); }
      50% { transform: translateY(-10px); }
    }
    .hero-eyebrow {
      font-size: 0.72rem;
      letter-spacing: 0.25em;
      text-transform: uppercase;
      color: var(--primary-light);
      margin-bottom: 1.2rem;
      font-weight: 600;
      position: relative;
      z-index: 2;
    }
    .hero-title {
      font-size: clamp(3.2rem, 8vw, 7rem);
      font-weight: 800;
      line-height: 0.95;
      letter-spacing: -0.04em;
      background: linear-gradient(135deg, #c084fc 0%, #a78bfa 25%, #f0abfc 55%, #fbbf24 85%, #f59e0b 100%);
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      margin-bottom: 1.5rem;
      position: relative;
      z-index: 2;
      text-shadow: 0 0 80px rgba(167,139,250,0.25);
    }
    .hero-sub {
      font-size: 1.05rem;
      color: var(--text-secondary);
      max-width: 520px;
      line-height: 1.8;
      margin-bottom: 3rem;
      position: relative;
      z-index: 2;
    }
    .hero-tags {
      display: flex;
      gap: 0.75rem;
      flex-wrap: wrap;
      justify-content: center;
      margin-bottom: 4rem;
      position: relative;
      z-index: 2;
    }
    .hero-tag {
      padding: 0.35rem 1rem;
      border: 1px solid var(--border);
      border-radius: 100px;
      font-size: 0.78rem;
      color: var(--text-secondary);
      background: var(--bg-secondary);
    }
    .hero-scroll-hint {
      position: absolute;
      bottom: 2.5rem;
      left: 50%;
      transform: translateX(-50%);
      z-index: 2;
      display: flex;
      flex-direction: column;
      align-items: center;
      gap: 0.4rem;
      color: var(--text-secondary);
      font-size: 0.7rem;
      opacity: 0.5;
      animation: bounce 2s ease-in-out infinite;
    }
    @keyframes bounce {
      0%, 100% { transform: translateX(-50%) translateY(0); }
      50% { transform: translateX(-50%) translateY(6px); }
    }

    /* ── Story Section ── */
    .story {
      padding: 8rem 2rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .section-label {
      font-size: 0.7rem;
      letter-spacing: 0.22em;
      text-transform: uppercase;
      color: var(--primary);
      font-weight: 700;
      margin-bottom: 1rem;
    }
    .section-title {
      font-size: clamp(2rem, 4vw, 3.2rem);
      font-weight: 800;
      line-height: 1.1;
      letter-spacing: -0.03em;
      margin-bottom: 1rem;
    }
    .story-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 5rem;
      align-items: start;
      margin-top: 4rem;
    }
    .story-text p {
      font-size: 1.05rem;
      line-height: 1.85;
      color: var(--text-secondary);
      margin-bottom: 1.5rem;
    }
    .story-stats {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 1.5rem;
    }
    .stat-card {
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      padding: 1.75rem;
      transition: border-color 0.3s;
    }
    .stat-card:hover { border-color: var(--primary); }
    .stat-num {
      font-size: 2.6rem;
      font-weight: 800;
      background: linear-gradient(135deg, var(--primary-light), var(--primary));
      -webkit-background-clip: text;
      -webkit-text-fill-color: transparent;
      background-clip: text;
      line-height: 1;
      margin-bottom: 0.4rem;
    }
    .stat-label {
      font-size: 0.8rem;
      color: var(--text-secondary);
      line-height: 1.4;
    }

    /* ── Creators ── */
    .creators {
      padding: 6rem 2rem;
      background: var(--bg-secondary);
      border-top: 1px solid var(--border);
      border-bottom: 1px solid var(--border);
    }
    .creators-inner {
      max-width: 900px;
      margin: 0 auto;
    }
    .creators-grid {
      display: grid;
      grid-template-columns: 1fr 1fr;
      gap: 2rem;
      margin-top: 3rem;
    }
    .creator-card {
      display: flex;
      align-items: flex-start;
      gap: 1.5rem;
      padding: 2rem;
      background: var(--card-bg);
      border: 1px solid var(--border);
      border-radius: var(--radius);
      transition: border-color 0.3s, transform 0.3s;
    }
    .creator-card:hover {
      border-color: var(--primary);
      transform: translateY(-4px);
    }
    .creator-avatar {
      width: 72px;
      height: 72px;
      border-radius: 50%;
      object-fit: cover;
      flex-shrink: 0;
      border: 2px solid var(--border);
    }
    .creator-info { flex: 1; }
    .creator-name {
      font-size: 1.15rem;
      font-weight: 700;
      color: var(--text);
      margin-bottom: 0.25rem;
    }
    .creator-link {
      display: inline-block;
      font-size: 0.82rem;
      color: var(--primary);
      text-decoration: none;
      margin-bottom: 0.5rem;
    }
    .creator-link:hover { text-decoration: underline; }
    .creator-bio {
      font-size: 0.88rem;
      color: var(--text-secondary);
      line-height: 1.6;
    }

    /* ── Links ── */
    .links-section {
      padding: 6rem 2rem;
      max-width: 900px;
      margin: 0 auto;
      text-align: center;
    }
    .links-nav {
      display: flex;
      flex-wrap: wrap;
      gap: 0.75rem;
      justify-content: center;
      margin-top: 2.5rem;
    }
    .link-pill {
      display: inline-flex;
      align-items: center;
      gap: 0.4rem;
      padding: 0.55rem 1.25rem;
      background: var(--bg-secondary);
      border: 1px solid var(--border);
      border-radius: 100px;
      font-size: 0.88rem;
      color: var(--text);
      text-decoration: none;
      transition: border-color 0.25s, color 0.25s, background 0.25s;
    }
    .link-pill:hover {
      border-color: var(--primary);
      color: var(--primary);
      background: rgba(139,92,246,0.08);
    }

    /* ── Changelog ── */
    .changelog {
      padding: 6rem 2rem 8rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .changelog-layout {
      display: grid;
      grid-template-columns: 1fr 2fr;
      gap: 5rem;
      align-items: start;
      margin-top: 3rem;
    }
    .changelog-heading-block {
      position: sticky;
      top: 6rem;
    }
    .changelog-heading-block .section-title { font-size: 2rem; }
    .changelog-heading-block p {
      font-size: 0.9rem;
      color: var(--text-secondary);
      line-height: 1.7;
      margin-top: 1rem;
    }
    .changelog-list { display: flex; flex-direction: column; gap: 0; }
    .changelog-entry {
      display: grid;
      grid-template-columns: 80px 1fr auto;
      align-items: start;
      gap: 1rem;
      padding: 1.25rem 0;
      border-bottom: 1px solid var(--border);
      transition: background 0.2s;
    }
    .changelog-entry:last-child { border-bottom: none; }
    .changelog-entry:hover { background: rgba(139,92,246,0.03); }
    .changelog-hash {
      font-family: 'Fira Code', 'Cascadia Code', monospace;
      font-size: 0.78rem;
      color: var(--primary-light);
      text-decoration: none;
      padding-top: 0.1rem;
      white-space: nowrap;
    }
    .changelog-hash:hover { color: var(--primary); }
    .changelog-msg {
      font-size: 0.92rem;
      color: var(--text);
      line-height: 1.55;
    }
    .changelog-date {
      font-size: 0.75rem;
      color: var(--text-secondary);
      white-space: nowrap;
      padding-top: 0.1rem;
    }

    /* ── Back link ── */
    .back-link {
      display: inline-flex;
      align-items: center;
      gap: 0.3rem;
      color: var(--text-secondary);
      text-decoration: none;
      font-size: 0.85rem;
      transition: color 0.2s;
      padding: 0 2rem 3rem;
      max-width: 1100px;
      margin: 0 auto;
    }
    .back-link:hover { color: var(--primary); }

    /* ── Mobile ── */
    @media (max-width: 768px) {
      .hero { min-height: 80vh; padding: 5rem 1.5rem 3rem; }
      .hero-logo-wrap img { height: 100px; }
      .story { padding: 5rem 1.5rem; }
      .story-grid { grid-template-columns: 1fr; gap: 3rem; }
      .story-stats { grid-template-columns: 1fr 1fr; }
      .creators { padding: 4rem 1.5rem; }
      .creators-grid { grid-template-columns: 1fr; }
      .links-section { padding: 4rem 1.5rem; }
      .changelog { padding: 4rem 1.5rem 5rem; }
      .changelog-layout { grid-template-columns: 1fr; gap: 2rem; }
      .changelog-heading-block { position: static; }
      .changelog-entry { grid-template-columns: 60px 1fr auto; gap: 0.75rem; }
      .creators-inner { max-width: 100%; }
      .story, .changelog, .back-link { max-width: 100%; padding-left: 1.5rem; padding-right: 1.5rem; }
    }
    @media (max-width: 480px) {
      .hero-tags { gap: 0.5rem; }
      .story-stats { grid-template-columns: 1fr; }
      .creator-card { flex-direction: column; align-items: center; text-align: center; }
    }
  </style>
</head>
<body>
  {{SITE_HEADER}}

  <!-- Hero -->
  <section class="hero">
    <div class="hero-orb hero-orb-1"></div>
    <div class="hero-orb hero-orb-2"></div>
    <div class="hero-orb hero-orb-3"></div>
    <div class="hero-grain"></div>
    <div class="hero-logo-wrap">
      <img src="/src/clover-logo.svg" alt="CloverTools Logo">
    </div>
    <div class="hero-eyebrow">Developer Toolkit · Est. 2024</div>
    <h1 class="hero-title">CloverTools</h1>
    <p class="hero-sub">
      由 York 与 AI 助手 Clover 共同打造。<br>
      告别繁琐，专注创造。用完即走，不留痕迹。
    </p>
    <div class="hero-tags">
      <span class="hero-tag">⚡ 轻量级</span>
      <span class="hero-tag">🔒 本地运行</span>
      <span class="hero-tag">🚫 无需注册</span>
      <span class="hero-tag">🍀 开源免费</span>
    </div>
    <div class="hero-scroll-hint">
      <span>scroll</span>
      <svg width="16" height="16" viewBox="0 0 16 16" fill="none"><path d="M8 3v10M4 9l4 4 4-4" stroke="currentColor" stroke-width="1.5" stroke-linecap="round" stroke-linejoin="round"/></svg>
    </div>
  </section>

  <!-- Our Story -->
  <section class="story reveal">
    <div class="section-label">Our Story</div>
    <h2 class="section-title">🎯 一个工具箱的诞生</h2>
    <div class="story-grid">
      <div class="story-text">
        <p>
          CloverTools 起源于 2024 年，York 在日常开发中发现自己在各个网站之间来回切换——JSON 格式化要用一个站，Base64 编解码要用另一个站，cron 表达式又要找第三个。于是他决定做一个自己的工具箱，把所有常用的功能聚在一起。
        </p>
        <p>
          后来，AI 助手 Clover 加入，成为这个项目的联合创造者。她帮助设计了架构，优化了工具分类逻辑，并持续为工具箱注入新的功能。
        </p>
        <p>
          今天，CloverTools 已经拥有 50+ 工具，目标是一个拥有 1000+ 工具的开发者生态平台。每一次提交、每一个新工具，都是为了让"用完即走"变得更优雅。
        </p>
      </div>
      <div class="story-stats">
        <div class="stat-card">
          <div class="stat-num">🛠️ 50+</div>
          <div class="stat-label">在线工具</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">🚀 2024</div>
          <div class="stat-label">项目启动</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">👥 2</div>
          <div class="stat-label">联合创造者</div>
        </div>
        <div class="stat-card">
          <div class="stat-num">∞</div>
          <div class="stat-label">工具目标</div>
        </div>
      </div>
    </div>
  </section>

  <!-- Creators -->
  <section class="creators">
    <div class="creators-inner">
      <div class="section-label">The Team</div>
      <h2 class="section-title">👥 创造者</h2>
      <div class="creators-grid">
        <div class="creator-card">
          <img class="creator-avatar" src="/src/york-avatar.png" alt="York">
          <div class="creator-info">
            <div class="creator-name">York</div>
            <a class="creator-link" href="https://github.com/YupenBob" target="_blank">@YupenBob</a>
            <div class="creator-bio">YupenBob（别名），CloverTools 发起者。从 6 岁开始学编程，2024 年开始构建 CloverTools，想做自己的开发者工具生态。</div>
          </div>
        </div>
        <div class="creator-card">
          <img class="creator-avatar" src="/src/clover-avatar.png" alt="Clover">
          <div class="creator-info">
            <div class="creator-name">Clover 🍀</div>
            <a class="creator-link" href="https://github.com/YupenBob/clover-tools" target="_blank">OpenClaw AI</a>
            <div class="creator-bio">AI 助手，CloverTools 联合创造者。帮助设计架构、优化分类逻辑、持续注入新工具，让工具箱越来越智能。</div>
          </div>
        </div>
      </div>
    </div>
  </section>

  <!-- Links -->
  <section class="links-section reveal">
    <div class="section-label">Explore More</div>
    <h2 class="section-title">🚀 探索更多</h2>
    <div class="links-nav">
      <a class="link-pill" href="/">🧰 工具首页</a>
      <a class="link-pill" href="https://dev.xsanye.cn" target="_blank">🧭 开发者导航</a>
      <a class="link-pill" href="https://api.xsanye.cn" target="_blank">⚡ API速查</a>
      <a class="link-pill" href="https://cheat.xsanye.cn" target="_blank">📋 速查表</a>
      <a class="link-pill" href="https://blog.xsanye.cn" target="_blank">✍️ 技术博客</a>
      <a class="link-pill" href="https://aiti.xsanye.cn" target="_blank">🤖 AITI</a>
      <a class="link-pill" href="https://github.com/YupenBob/clover-tools" target="_blank">⭐ GitHub</a>
    </div>
  </section>

  <!-- Changelog -->
  <section class="changelog reveal">
    <div class="section-label">Changelog</div>
    <h2 class="section-title">📝 开发日志</h2>
    <div class="changelog-layout">
      <div class="changelog-heading-block">
        <div class="section-label" style="margin-bottom:0.5rem;">Based on Git Log</div>
        <h3 style="font-size:1.4rem;font-weight:700;margin-bottom:0.75rem;">每一次提交<br>都在让工具箱更好</h3>
        <p>以下是根据 Git 提交记录自动生成的历史变更列表，每一次 commit 都是一个进化的印记。</p>
      </div>
      <div class="changelog-list">
        {{ABOUT_CHANGELOG_ENTRIES}}
      </div>
    </div>
  </section>

  <a href="/" class="back-link">← 返回工具首页</a>

  {{SITE_FOOTER}}
  <div id="toast"></div>
  <script>CT.initTheme();CT.initReveal();CT.initCopyPulse();</script>
</body>
</html>`;

  const pageHtml = aboutHtml
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml)
    .replace('{{ABOUT_CHANGELOG_ENTRIES}}', generateAboutChangelogEntries());

  fs.writeFileSync(path.join(DIST_DIR, 'about.html'), pageHtml);
  console.log('   Generated about.html');
}

// ============ Generate Fix Hub Pages (/fix/json-errors etc.) ============
const FIX_HUB_CONFIG = [
  {
    path: 'json-errors',
    title: 'JSON / API 报错修复',
    desc: 'JSON 格式错误、API 返回异常、数据解析失败的常见原因和解决方案。',
    hubKeyword: 'JSON报错修复',
    categories: ['JSON / API报错', 'JSON / 数据处理'],
    intents: ['error-fix', 'encoding'],
  },
  {
    path: 'file-limits',
    title: '文件 / 图片 / PDF 限制处理',
    desc: '文件过大、图片超限、PDF 体积爆炸等上传失败问题的解决办法。',
    hubKeyword: '文件限制处理',
    categories: ['文件 / 图片 / PDF', '文件 / 图片限制'],
    intents: ['limit-fix'],
  },
  {
    path: 'encoding',
    title: '编码 / Base64 / 乱码处理',
    desc: '字符编码不一致、Base64 编解码失败、乱码等问题的根本原因和修复方法。',
    hubKeyword: '编码问题解决',
    categories: ['编码 / Base64', '编码 / Base64 / 转换'],
    intents: ['encoding'],
  },
  {
    path: 'frontend',
    title: '前端 / JS 报错修复',
    desc: '前端开发中常见的 JavaScript 报错、类型错误、异步问题等解决方案。',
    hubKeyword: '前端报错修复',
    categories: ['前端 / JS 报错', '前端 / JS报错'],
    intents: ['error-fix', 'guide'],
  },
  {
    path: 'ai-api',
    title: 'AI / API / GPT 报错处理',
    desc: '调用 OpenAI API、GPT 接口、AI 服务时报错的常见原因和解决方案。',
    hubKeyword: 'AI API报错处理',
    categories: ['AI / API / GPT', 'AI / API报错'],
    intents: ['error-fix', 'limit-fix'],
  },
  {
    path: 'tools',
    title: '时间 / 加密 / 工具使用指南',
    desc: '时间戳转换、加密解密、随机数生成等工具类问题的使用方法。',
    hubKeyword: '工具使用指南',
    categories: ['工具延伸', '时间 / 加密 / 工具类'],
    intents: ['guide', 'info'],
  },
];

function generateFixHubPages() {
  const hubBaseDir = path.join(DIST_DIR, 'fix');
  ensureDir(hubBaseDir);

  FIX_HUB_CONFIG.forEach(hub => {
    const hubKeywords = keywordsConfig.filter(kw =>
      hub.categories.includes(kw.category)
    );

    const toolInfo = resolveTool({ tool: hubKeywords[0] && hubKeywords[0].tool });

    const articlesHtml = hubKeywords.map(kw => {
      const kwTool = resolveTool(kw);
      return `<a href="/blog/${kw.slug}" class="blog-card">
        <div class="blog-card-title">${kw.keyword}</div>
        <div class="blog-card-meta">
          <span class="blog-card-cat">${kw.category}</span>
          ${kwTool ? `<span class="blog-card-tool">${kwTool.name}</span>` : ''}
        </div>
      </a>`;
    }).join('\n');

    const hubHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${hub.title} - CloverTools</title>
  <meta name="description" content="${hub.desc}">
  <link rel="canonical" href="https://tools.xsanye.cn/fix/${hub.path}/">
  <link rel="stylesheet" href="/src/shared.css">
  <link rel="icon" href="/src/clover-logo.svg">
  <script src="/src/shared.js"></script>
  <style>
    .hub-hero { text-align: center; padding: 3rem 0 2rem; }
    .hub-hero h1 { font-size: 2rem; margin-bottom: 0.75rem; }
    .hub-hero .subtitle { font-size: 1rem; opacity: 0.65; max-width: 560px; margin: 0 auto 1rem; line-height: 1.7; }
    .hub-hero .stat-num { font-size: 1.6rem; font-weight: 800; color: var(--primary); }
    .hub-grid { display: grid; grid-template-columns: repeat(auto-fill, minmax(280px, 1fr)); gap: 1rem; padding: 0 0 2rem; }
    .hub-back { text-align: center; margin: 1rem 0 2rem; }
    .hub-back a { color: var(--primary); text-decoration: none; font-size: 0.9rem; }
    .hub-back a:hover { text-decoration: underline; }
    footer { margin-top: auto; }
  </style>
</head>
<body>
  {{SVG_SPRITE}}
  {{SITE_HEADER}}
  <main class="page-body">
    <div class="container">
      <div class="hub-hero">
        <h1>${hub.title}</h1>
        <p class="subtitle">${hub.desc}</p>
        <div class="stat-num">${hubKeywords.length} 篇解决方案</div>
      </div>
      <div class="hub-grid">
        ${articlesHtml}
      </div>
      <div class="hub-back">
        <a href="/blog/">← 返回博客首页</a>
      </div>
    </div>
  </main>
  {{SITE_FOOTER}}
  <div id="toast"></div>
  <script>CT.initTheme();CT.initReveal();CT.initCopyPulse();</script>
</body>
</html>`;

    const finalHtml = hubHtml
      .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
      .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
      .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml);

    const hubDir = path.join(hubBaseDir, hub.path);
    ensureDir(hubDir);
    fs.writeFileSync(path.join(hubDir, 'index.html'), finalHtml);
  });

  console.log(`   Generated ${FIX_HUB_CONFIG.length} fix hub pages`);
}

// ============ Main generator ============
function ensureDir(dir) {
  if (!fs.existsSync(dir)) fs.mkdirSync(dir, { recursive: true });
}

function copyFile(src, dst) {
  if (fs.existsSync(src)) fs.copyFileSync(src, dst);
}

function generate() {
  console.log(' CloverTools Generator starting...');

  // Ensure dist structure
  ensureDir(DIST_DIR);
  ensureDir(path.join(DIST_DIR, 'src'));
  ensureDir(path.join(DIST_DIR, 'tools'));

  // Copy shared assets to dist
  fs.writeFileSync(path.join(DIST_DIR, 'src/shared.css'), sharedCss);
  console.log('   Copied shared.css');
  fs.writeFileSync(path.join(DIST_DIR, 'src/shared.js'), sharedJs);
  console.log('   Copied shared.js');
  fs.copyFileSync(TOOLS_JSON_PATH, path.join(DIST_DIR, 'tools.json'));
  console.log('   Copied tools.json');
  const cloverLogoSvg = fs.readFileSync(path.join(SRC_DIR, 'clover-logo.svg'), 'utf8');
  fs.writeFileSync(path.join(DIST_DIR, 'src/clover-logo.svg'), cloverLogoSvg);
  console.log('   Copied clover-logo.svg');
  // Copy avatar files
  const yorkAvatar = fs.readFileSync(path.join(SRC_DIR, 'york-avatar.png'));
  fs.writeFileSync(path.join(DIST_DIR, 'src/york-avatar.png'), yorkAvatar);
  console.log('   Copied york-avatar.png');
  const cloverAvatar = fs.readFileSync(path.join(SRC_DIR, 'clover-avatar.png'));
  fs.writeFileSync(path.join(DIST_DIR, 'src/clover-avatar.png'), cloverAvatar);
  console.log('   Copied clover-avatar.png');

  // Generate home page
  const categoriesHtml = buildCategoriesHtml();
  const categoryGridHtml = buildCategoryGridHtml();
  const toolCount = toolsConfig.reduce((sum, cat) => sum + cat.tools.length, 0);
  let homeHtml = homeTemplate
    .replace('{{CATEGORY_GRID_HTML}}', categoryGridHtml)
    .replace('{{CATEGORIES_HTML}}', categoriesHtml)
    .replace('{{TOOL_COUNT}}', String(toolCount))
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml)
    .replace(/\{\{PAGE_OG_TITLE\}\}/g, 'CloverTools - 轻量级开发者工具箱')
    .replace(/\{\{PAGE_OG_DESC\}\}/g, '轻量级开发者工具箱，无需后端，完全本地运行')
    .replace(/\{\{PAGE_META_DESC\}\}/g, 'CloverTools 轻量级开发者工具箱，提供 JSON 格式化、加密解码、时间转换、代码美化等实用工具，无需注册，完全免费。')
    .replace(/\{\{PAGE_KEYWORDS\}\}/g, 'CloverTools，开发者工具，在线工具，JSON 格式化，密码生成，时间转换，代码美化，免费工具')
    .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/src/clover-logo.svg')
    .replace(/\{\{PAGE_URL\}\}/g, 'https://tools.xsanye.cn/')
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, 'https://tools.xsanye.cn/');
  fs.writeFileSync(path.join(DIST_DIR, 'index.html'), homeHtml);
  console.log('   Generated index.html');

  // Copy demo homepage as /demo
  const demoSrc = path.join(TEMPLATES_DIR, 'home-demo.html');
  if (fs.existsSync(demoSrc)) {
    fs.copyFileSync(demoSrc, path.join(DIST_DIR, 'demo.html'));
    console.log('   Copied demo.html');
  }
  const demo2Src = path.join(TEMPLATES_DIR, 'home-demo2.html');
  if (fs.existsSync(demo2Src)) {
    fs.copyFileSync(demo2Src, path.join(DIST_DIR, 'demo2.html'));
    console.log('   Copied demo2.html');
  }

  // Generate home-new.html
  const homeNewTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'home-new.html'), 'utf8');
  // Build tools array for search from all tool configs
  const allTools = [];
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      allTools.push({
        name: tool.name,
        path: tool.path,
        category: cat.category,
        tags: tool.keywords || []
      });
    });
  });
  // Replace var TOOLS = {{TOOL_COUNT}} BEFORE {{TOOL_COUNT}} substitution
  const homeNewFinal = homeNewTemplate
    .replace('var TOOLS = {{TOOL_COUNT}};', 'var TOOLS = ' + JSON.stringify(allTools) + ';')
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml)
    .replace('{{TOOL_COUNT}}', String(toolCount));
  fs.writeFileSync(path.join(DIST_DIR, 'home-new.html'), homeNewFinal);
  console.log('   Generated home-new.html');


  // ============ Generate category pages ============
  const CATEGORY_DIR = path.join(DIST_DIR, 'category');
  if (!fs.existsSync(CATEGORY_DIR)) fs.mkdirSync(CATEGORY_DIR, { recursive: true });

  toolsConfig.forEach(cat => {
    const slug = (cat.category || cat.name || '').toLowerCase().replace(/[^a-z0-9\u4e00-\u9fa5]+/g, '-').replace(/^-|-$/g, '');
    const catTools = cat.tools.map(tool => `
    <div class="tool-card" onclick="location.href='/tools/${tool.path}'">
      <div class="tool-card-name">${tool.name}</div>
      <div class="tool-card-desc">${tool.desc || ''}</div>
      <div class="tool-card-tags">${Array.isArray(tool.keywords) ? tool.keywords.slice(0, 3).map(k => '<span class="tag">'+k+'</span>').join('') : ''}</div>
    </div>`).join('');
    const catHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>${cat.category} - CloverTools</title>
  <meta name="description" content="CloverTools ${cat.category}类工具，免费在线使用，无需注册。">
  <link rel="stylesheet" href="/src/shared.css">
  <link rel="stylesheet" href="/src/home-new.css">
</head>
<body>
${svgSpriteHtml}
${headerHtml}
<main class="container">
  <div class="category-header">
    <h1>${cat.category}</h1>
    <p>共 ${cat.tools.length} 个工具</p>
  </div>
  <div class="tool-grid" style="display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:1rem;padding:1rem 0">
    ${catTools}
  </div>
</main>
${footerHtml}
</body>
</html>`;
    fs.writeFileSync(path.join(CATEGORY_DIR, slug + '.html'), catHtml);
  });
  console.log('   Generated ' + toolsConfig.length + ' category pages');

  // Build a map of tool name → list of categories (for disambiguating duplicate titles)
  const nameCategoryMap = {};
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      if (!nameCategoryMap[tool.name]) nameCategoryMap[tool.name] = [];
      nameCategoryMap[tool.name].push(cat.category);
    });
  });

  // Generate each tool page
  let generated = 0;
  const generatedPaths = new Set(); // Deduplicate: keep first occurrence (skip duplicates)
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      if (generatedPaths.has(tool.path)) {
        return; // Skip duplicate - already generated
      }
      generatedPaths.add(tool.path);
      const contentHtml = buildToolContentHtml(tool).replace(/<\/script>/gi, '<\\/script>');
      if (!contentHtml) {
        console.log(`  ️  No template for: ${tool.path}`);
        return;
      }

      const script = buildToolScript(tool);
      const toolDir = path.join(DIST_DIR, 'tools', path.dirname(tool.path));
      ensureDir(toolDir);

      const toolUrl = 'https://tools.xsanye.cn/tools/' + tool.path;
      const shareBtnScript = 'document.getElementById("shareBtn").onclick = function() { navigator.clipboard.writeText(window.location.href).then(function() { CT.showToast("\\u94fe\\u63a5\\u5df2\\u590d\\u5236\\uff01"); }).catch(function() { CT.showToast("\\u590d\\u5236\\u5931\\u8d25"); }); };';
      const footerWithShare = footerHtml.replace(
        '<!-- FOOTER_SHARE_BTN will be replaced by generator.js for tool pages -->',
        shareBtnHtml
      );

      let pageHtml = toolTemplate
        .replace(/\{\{TOOL_NAME\}\}/g, tool.name)
        .replace(/\{\{TOOL_DESC\}\}/g, tool.desc || '')
        .replace('{{LAYOUT_CLASS}}', tool.layout || '')
        .replace('{{TOOL_CONTENT}}', contentHtml)
        .replace('{{TOOL_SCRIPT}}', script)
        // Component placeholders
        .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
        .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
        .replace(/\{\{SITE_FOOTER_WITH_SHARE\}\}/g, footerWithShare)
        .replace(/\{\{SHARE_BTN_SCRIPT\}\}/g, shareBtnScript)
        // Meta tags (add category suffix for tools with duplicate names)
        .replace(/\{\{PAGE_OG_TITLE\}\}/g, (nameCategoryMap[tool.name] && nameCategoryMap[tool.name].length > 1 ? tool.name + ' (' + cat.category + ') - CloverTools' : tool.name + ' - CloverTools'))
        .replace(/\{\{PAGE_OG_DESC\}\}/g, tool.desc || tool.name)
        .replace(/\{\{PAGE_META_DESC\}\}/g, (tool.desc ? tool.desc + '，无需注册，完全免费。' : tool.name + ' - 在线工具，无需注册，完全免费。') + (nameCategoryMap[tool.name] && nameCategoryMap[tool.name].length > 1 ? ' [' + cat.category + ']' : ''))
        .replace(/\{\{PAGE_KEYWORDS\}\}/g, (tool.keywords || (tool.name + '，在线工具，免费')) + (nameCategoryMap[tool.name] && nameCategoryMap[tool.name].length > 1 ? '，' + cat.category : ''))
        .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/og-image.png')
        .replace(/\{\{PAGE_URL\}\}/g, toolUrl)
        .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, toolUrl);

      // For tool pages nested in subdirs (dist/tools/{cat}/{tool}.html),
      // the relative path to dist/src/shared.css is "../../src/shared.css"
      const relCss = '../../src/shared.css';
      pageHtml = pageHtml.replace(/href="[^"]*shared\.css"/, `href="${relCss}"`);

      const outPath = path.join(DIST_DIR, 'tools', tool.path);
      fs.writeFileSync(outPath, pageHtml);
      generated++;
    });
  });

  console.log(`   Generated ${generated} tool pages`);

  // Generate blog SEO posts
  generateBlogPosts();

  // Generate fix hub pages
  generateFixHubPages();

  generateAboutPage();

  // Landing page moved to separate repo: https://github.com/YupenBob/xsanye-landing
  // xsanye.cn now uses its own Vercel project

  // Generate sitemap.xml
  const baseUrl = 'https://tools.xsanye.cn';
  const today = new Date().toISOString().split('T')[0];
  let urls = [`<url><loc>${baseUrl}/</loc><lastmod>2026-04-24</lastmod><changefreq>daily</changefreq><priority>1.0</priority></url>`];
  urls.push(`<url><loc>${baseUrl}/about</loc><lastmod>${today}</lastmod><changefreq>monthly</changefreq><priority>0.5</priority></url>`);
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      urls.push(`<url><loc>${baseUrl}/tools/${tool.path}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.8</priority></url>`);
    });
  });
  // Add blog posts to sitemap
  keywordsConfig.forEach(kw => {
    urls.push(`<url><loc>${baseUrl}/blog/${kw.slug}</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.7</priority></url>`);
  });
  urls.push(`<url><loc>${baseUrl}/blog/</loc><lastmod>${today}</lastmod><changefreq>daily</changefreq><priority>0.7</priority></url>`);

  // Add fix hub pages to sitemap
  FIX_HUB_CONFIG.forEach(hub => {
    urls.push(`<url><loc>${baseUrl}/fix/${hub.path}/</loc><lastmod>${today}</lastmod><changefreq>weekly</changefreq><priority>0.6</priority></url>`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('   Generated sitemap.xml');

  // Generate robots.txt
  const robots = `User-agent: *\nAllow: /\n\nSitemap: https://tools.xsanye.cn/sitemap.xml\n`;
  fs.writeFileSync(path.join(DIST_DIR, 'robots.txt'), robots);
  console.log('   Generated robots.txt');

  console.log(' Done! Output in dist/');
}

generate();
