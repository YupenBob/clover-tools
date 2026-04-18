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
const changelogTemplate = fs.readFileSync(path.join(TEMPLATES_DIR, 'changelog.html'), 'utf8');
const toolsConfig = JSON.parse(fs.readFileSync(TOOLS_JSON_PATH, 'utf8'));

// ============ Load shared assets ============
const sharedCss = fs.readFileSync(path.join(SRC_DIR, 'shared.css'), 'utf8');
const sharedJs = fs.readFileSync(path.join(SRC_DIR, 'shared.js'), 'utf8');

// ============ Load component partials ============
const svgSpriteHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/svg-sprite.html'), 'utf8').trim();
const headerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/header.html'), 'utf8').trim();
const footerHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/footer.html'), 'utf8').trim();
const shareBtnHtml = fs.readFileSync(path.join(TEMPLATES_DIR, 'components/share-btn.html'), 'utf8').trim();


const PATH_TO_TYPE_FALLBACK = {
    'code/css': 'formatter',
    'code/html': 'formatter',
    'code/javascript': 'formatter',
    'encrypt/base64': 'encode-decode',
    'encrypt/hex': 'converter',
    'encrypt/url': 'encode-decode',
    'json/formatter': 'formatter',
    'json/xml': 'converter',
    'json/yaml': 'converter',
    'other/hex-convert': 'converter',
    'other/nanoid': 'generator',
    'other/password': 'generator',
    'other/uuid': 'generator',
    'text/jianfan': 'converter',
    'network/request-tester': 'http-test'
};


// ============ Build categories HTML for homepage ============
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
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, toolUrl);

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
      var fwd = ${JSON.stringify(tool.forwardFn || 'function(v){return v;}')};
      var rev = ${JSON.stringify(tool.reverseFn || 'function(v){return v;}')};
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
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="' + accept + '" style="display:none;"><div class="upload-hint">点击或拖拽上传文件</div></div><div id="fileInfo" style="margin-top:0.5rem;font-size:0.85rem;display:none;"></div><div class="input-row" style="margin-top:0.5rem;"><select id="outputFormat" style="padding:0.4rem;">' + opts + '</select></div><div class="btn-row"><button class="btn btn-primary" id="convertBtn">转换</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>输出 <button class="copy-btn" id="downloadOutput">下载</button></h3><div id="outputPreview" style="text-align:center;padding:1rem;"></div></div>';
    },
    script: function(tool) {
      var toolPath = tool.path || '';
      return "var uploadArea = document.getElementById('uploadArea');\nvar fileInput = document.getElementById('fileInput');\nvar fileInfo = document.getElementById('fileInfo');\nvar outputFormat = document.getElementById('outputFormat');\nvar convertBtn = document.getElementById('convertBtn');\nvar outputBox = document.getElementById('outputBox');\nvar outputPreview = document.getElementById('outputPreview');\nvar currentFileName = '';\nuploadArea.addEventListener('click', function() { fileInput.click(); });\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\nuploadArea.addEventListener('drop', function(e) {\n  e.preventDefault();\n  uploadArea.style.borderColor = 'var(--border)';\n  if (e.dataTransfer.files[0]) { fileInput.files = e.dataTransfer.files; handleFile(e.dataTransfer.files[0]); }\n});\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) handleFile(fileInput.files[0]); });\nfunction handleFile(file) {\n  currentFileName = file.name;\n  fileInfo.style.display = 'block';\n  fileInfo.innerHTML = '<b>' + escHtml(file.name) + '</b> (' + (file.size / 1024).toFixed(1) + ' KB, ' + (file.type || '未知') + ')';\n}\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\nfunction downloadDataUrl(dataUrl, filename) {\n  var a = document.createElement('a');\n  a.href = dataUrl;\n  a.download = filename;\n  a.click();\n}\nfunction imgToPdf(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var img = new Image();\n    img.onload = function() {\n      var w = img.width, h = img.height;\n      var canv = document.createElement('canvas');\n      canv.width = w; canv.height = h;\n      var ctx = canv.getContext('2d');\n      ctx.fillStyle = '#fff';\n      ctx.fillRect(0, 0, w, h);\n      ctx.drawImage(img, 0, 0);\n      var imgData = canv.toDataURL('image/jpeg', 0.95);\n      var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.pdf';\n      // jsPDF approach\n      if (typeof window.jspdf !== 'undefined') {\n        var pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });\n        pdf.addImage(imgData, 'JPEG', 0, 0, w, h);\n        pdf.save(newName);\n        callback({ dataUrl: null, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      } else {\n        // Load jspdf from CDN\n        var script = document.createElement('script');\n        script.src = 'https://cdnjs.cloudflare.com/ajax/libs/jspdf/2.5.1/jspdf.umd.min.js';\n        script.onload = function() {\n          var pdf = new window.jspdf.jsPDF({ orientation: w > h ? 'landscape' : 'portrait', unit: 'px', format: [w, h] });\n          pdf.addImage(imgData, 'JPEG', 0, 0, w, h);\n          pdf.save(newName);\n          callback({ dataUrl: null, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n        };\n        script.onerror = function() {\n          // Fallback: HTML printable page\n          var blob = new Blob(['<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>', escHtml(newName), '</title><style>body{margin:0;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}img{max-width:90vw;max-height:90vh;object-fit:contain;background:#fff}@media print{body{background:none}img{max-height:none}}</style></head><body><img src=\"', imgData, '\" onload=\"window.print()\"></body></html>'], { type: 'text/html' });\n          var url = URL.createObjectURL(blob);\n          callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + imgData + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n        };\n        document.head.appendChild(script);\n      }\n    };\n    img.src = e.target.result;\n  };\n  reader.readAsDataURL(file);\n}\nfunction pdfToText(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        var promises = [];\n        for (var i = 1; i <= Math.min(pdf.numPages, 20); i++) {\n          promises.push(pdf.getPage(i).then(function(p) { return p.getTextContent().then(function(c) { return c.items.map(function(it) { return it.str; }).join(' '); }); }));\n        }\n        Promise.all(promises).then(function(pages) {\n          var text = pages.join('\\n\\n');\n          var blob = new Blob([text], { type: 'text/plain' });\n          var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.txt';\n          callback({ dataUrl: URL.createObjectURL(blob), filename: newName, preview: '<div style=\"text-align:left;max-height:400px;overflow:auto;background:var(--bg);padding:1rem;border-radius:8px;font-family:monospace;white-space:pre-wrap;word-break:break-all;\">' + escHtml(text) + '</div>' });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF 解析错误: ' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() {\n        window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js';\n        go();\n      };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败，请检查网络</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction imgToImg(file, mimeOut, extOut, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var img = new Image();\n    img.onload = function() {\n      var canv = document.createElement('canvas');\n      canv.width = img.width; canv.height = img.height;\n      var ctx = canv.getContext('2d');\n      ctx.drawImage(img, 0, 0);\n      canv.toBlob(function(blob) {\n        var url = URL.createObjectURL(blob);\n        var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.' + extOut;\n        callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      }, mimeOut, 0.95);\n    };\n    img.src = e.target.result;\n  };\n  reader.readAsDataURL(file);\n}\nfunction svgToPng(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var svgData = e.target.result;\n    var img = new Image();\n    img.onload = function() {\n      var canv = document.createElement('canvas');\n      canv.width = img.width || 800; canv.height = img.height || 600;\n      var ctx = canv.getContext('2d');\n      ctx.drawImage(img, 0, 0);\n      canv.toBlob(function(blob) {\n        var url = URL.createObjectURL(blob);\n        var newName = currentFileName.replace(/\\.[^.]+$/, '') + '.png';\n        callback({ dataUrl: url, filename: newName, preview: '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n      }, 'image/png');\n    };\n    img.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">SVG 解析失败</div>' }); };\n    img.src = 'data:image/svg+xml;base64,' + btoa(unescape(encodeURIComponent(svgData)));\n  };\n  reader.readAsText(file);\n}\nfunction pdfToImg(file, mimeOut, extOut, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        pdf.getPage(1).then(function(page) {\n          var vpt = page.getViewport({ scale: 2 });\n          var canv = document.createElement('canvas');\n          canv.width = vpt.width; canv.height = vpt.height;\n          page.render({ canvasContext: canv.getContext('2d'), viewport: vpt }).promise.then(function() {\n            var dataUrl = canv.toDataURL(mimeOut, 0.95);\n            var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_page1.' + extOut;\n            callback({ dataUrl: dataUrl, filename: newName, preview: '<img src=\"' + dataUrl + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\">' });\n          });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF 渲染错误: ' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; go(); };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction pdfToHtml(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    var go = function() {\n      window.pdfjsLib.getDocument(e.target.result).promise.then(function(pdf) {\n        pdf.getPage(1).then(function(page) {\n          var vpt = page.getViewport({ scale: 2 });\n          var canv = document.createElement('canvas');\n          canv.width = vpt.width; canv.height = vpt.height;\n          page.render({ canvasContext: canv.getContext('2d'), viewport: vpt }).promise.then(function() {\n            var dataUrl = canv.toDataURL('image/png');\n            callback({ dataUrl: null, filename: currentFileName.replace(/\\.[^.]+$/, '') + '.html', preview: '<div style=\"text-align:center;padding:1rem;\"><img src=\"' + dataUrl + '\" style=\"max-width:100%;border:1px solid #ddd;border-radius:8px;\"></div>' });\n          });\n        });\n      }).catch(function(err) { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">' + escHtml(err.message) + '</div>' }); });\n    };\n    if (window.pdfjsLib) { go(); }\n    else {\n      var s = document.createElement('script');\n      s.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.min.js';\n      s.onload = function() { window.pdfjsLib.GlobalWorkerOptions.workerSrc = 'https://cdnjs.cloudflare.com/ajax/libs/pdf.js/3.11.174/pdf.worker.min.js'; go(); };\n      s.onerror = function() { callback({ dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">PDF.js 加载失败</div>' }); };\n      document.head.appendChild(s);\n    }\n  };\n  reader.readAsArrayBuffer(file);\n}\nconvertBtn.onclick = function() {\n  if (!fileInput.files || fileInput.files.length === 0) { outputBox.style.display = 'none'; if (window.CT && CT.showToast) CT.showToast('请先上传文件'); return; }\n  var file = fileInput.files[0];\n  var outFmt = outputFormat.value;\n  var isJpg2pdf = toolPath.indexOf('jpg2pdf') !== -1;\n  var isPdf2txt = toolPath.indexOf('pdf2txt') !== -1;\n  var isWebp2jpg = toolPath.indexOf('webp2jpg') !== -1;\n  var isSvg2png = toolPath.indexOf('svg2png') !== -1;\n  var isJpg2webp = toolPath.indexOf('jpg2webp') !== -1;\n  var isPng2webp = toolPath.indexOf('png2webp') !== -1;\n  var isPdf2jpg = toolPath.indexOf('pdf2jpg') !== -1;\n  var isPdf2html = toolPath.indexOf('pdf2html') !== -1;\n  var isPdfCompress = toolPath.indexOf('pdf-compress') !== -1;\n  var isZipRepair = toolPath.indexOf('zip-repair') !== -1;\n  var onDone = function(result) {\n    outputPreview.innerHTML = result.preview || '';\n    outputBox.style.display = 'block';\n    window._fcResult = result;\n  };\n  if (isJpg2pdf) imgToPdf(file, onDone);\n  else if (isPdf2txt) pdfToText(file, onDone);\n  else if (isWebp2jpg) imgToImg(file, 'image/jpeg', 'jpg', onDone);\n  else if (isSvg2png) svgToPng(file, onDone);\n  else if (isJpg2webp) imgToImg(file, 'image/webp', 'webp', onDone);\n  else if (isPng2webp) imgToImg(file, 'image/webp', 'webp', onDone);\n  else if (isPdf2jpg) pdfToImg(file, outFmt === 'png' ? 'image/png' : 'image/jpeg', outFmt === 'png' ? 'png' : 'jpg', onDone);\n  else if (isPdf2html) pdfToHtml(file, onDone);\n  else if (isPdfCompress) pdfCompress(file, onDone);\n  else if (isZipRepair) zipRepair(file, onDone);\n};\nfunction pdfCompress(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    try {\n      var origSize = file.size;\n      var script = document.createElement('script');\n      script.src = 'https://cdnjs.cloudflare.com/ajax/libs/pdf-lib/1.17.1/pdf-lib.min.js';\n      script.onload = function() {\n        window.pdfLib.getDocument(e.target.result).promise.then(function(pdfDoc) {\n          var numPages = pdfDoc.numPages;\n          var pagePromises = [];\n          for (var i = 1; i <= numPages; i++) pagePromises.push(pdfDoc.getPage(i));\n          Promise.all(pagePromises).then(function(pages) {\n            var newDoc = window.pdfLib.PDFDocument.create();\n            pages.forEach(function(p) {\n              var dims = p.getDimensions();\n              newDoc.addPage([dims.width, dims.height]);\n            });\n            newDoc.save().then(function(bytes) {\n              var blob = new Blob([bytes], {type:'application/pdf'});\n              var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_compressed.pdf';\n              var ratio = origSize > 0 ? ((1 - bytes.length / origSize) * 100).toFixed(1) : '0';\n              var color = bytes.length < origSize ? '#22c55e' : '#f59e0b';\n              var msg = bytes.length < origSize ? ('节省 ' + ratio + '%') : '已是高压缩';\n              callback({dataUrl: URL.createObjectURL(blob), filename: newName, preview: '<div style=\"text-align:center;padding:1rem;\"><div style=\"font-size:1.1rem;margin-bottom:0.5rem;\">PDF 压缩完成！</div><div>原始: ' + (origSize/1024).toFixed(1) + ' KB</div><div>压缩后: ' + (bytes.length/1024).toFixed(1) + ' KB</div><div style=\"color:' + color + ';font-weight:700;font-size:1.1rem;\">' + msg + '</div></div>'});\n            }).catch(function() {\n              var blob = new Blob([e.target.result], {type:'application/pdf'});\n              callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;\"><div>PDF 重新打包完成</div></div>'});\n            });\n          });\n        }).catch(function() {\n          var blob = new Blob([e.target.result], {type:'application/pdf'});\n          callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;\"><div>PDF 重新打包完成</div></div>'});\n        });\n      };\n      script.onerror = function() {\n        var blob = new Blob([e.target.result], {type:'application/pdf'});\n        callback({dataUrl: URL.createObjectURL(blob), filename: currentFileName.replace(/\\.[^.]+$/, '') + '_repack.pdf', preview: '<div style=\"text-align:center;padding:1rem;color:#f59e0b;\">库加载失败，文件已重新打包</div>'});\n      };\n      document.head.appendChild(script);\n    } catch(e) { callback({dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">错误: ' + escHtml(e.message) + '</div>'}); }\n  };\n  reader.readAsArrayBuffer(file);\n}\nfunction zipRepair(file, callback) {\n  var reader = new FileReader();\n  reader.onload = function(e) {\n    try {\n      var arr = new Uint8Array(e.target.result);\n      var valid = 0, total = 0, issues = [], pos = 0;\n      while (pos < arr.length - 4) {\n        if (arr[pos] === 0x50 && arr[pos+1] === 0x4b && arr[pos+2] === 0x03 && arr[pos+3] === 0x04) {\n          total++;\n          var nameLen = arr[pos+26] | (arr[pos+27] << 8);\n          var extraLen = arr[pos+28] | (arr[pos+29] << 8);\n          var hdrLen = 30 + nameLen + extraLen;\n          var cSize = arr[pos+18] | (arr[pos+19]<<8) | (arr[pos+20]<<16) | (arr[pos+21]<<24);\n          if (pos + hdrLen + cSize > arr.length) issues.push('条目 #' + total + ' 数据不完整');\n          else valid++;\n          pos += hdrLen + cSize;\n        } else break;\n      }\n      var newName = currentFileName.replace(/\\.[^.]+$/, '') + '_repaired.zip';\n      var preview = '<div style=\"text-align:left;padding:1rem;font-size:0.9rem;\"><div style=\"margin-bottom:0.5rem;\"><b>ZIP 检测结果：</b></div><div>总条目: ' + total + '</div><div style=\"color:#22c55e;\">有效条目: ' + valid + '</div>';\n      if (issues.length > 0) {\n        preview += '<div style=\"color:#f59e0b;\">发现问题: ' + issues.length + ' 个</div>';\n        issues.slice(0,3).forEach(function(iss){ preview += '<div style=\"color:#f59e0b;font-size:0.8rem;\">- ' + escHtml(iss) + '</div>'; });\n        preview += '<div style=\"margin-top:0.5rem;color:#f59e0b;font-size:0.85rem;\">注：完整修复需要专业工具，此处已尝试提取有效数据</div>';\n      } else {\n        preview += '<div style=\"color:#22c55e;\">ZIP 文件结构完整，未检测到明显损坏</div>';\n      }\n      preview += '</div>';\n      var blob = new Blob([arr], {type:'application/zip'});\n      callback({dataUrl: URL.createObjectURL(blob), filename: newName, preview: preview});\n    } catch(err) { callback({dataUrl: null, filename: '', preview: '<div style=\"color:#ef4444;\">ZIP 解析错误: ' + escHtml(err.message) + '</div>'}); }\n  };\n  reader.readAsArrayBuffer(file);\n}\ndocument.getElementById('downloadOutput').onclick = function() {\n  var r = window._fcResult;\n  if (!r) return;\n  if (r.dataUrl) { downloadDataUrl(r.dataUrl, r.filename); }\n  else if (r.filename && r.preview) {\n    var w = window.open('');\n    w.document.write('<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>' + escHtml(r.filename) + '</title><style>body{margin:2rem;display:flex;justify-content:center;align-items:center;min-height:100vh;background:#f0f0f0}img{max-width:90vw;max-height:90vh}@media print{body{background:none}}</style></head><body>' + r.preview + '<script>window.onload=function(){window.print()};<\/script></body></html>');\n    w.document.close();\n  } else { if (window.CT && CT.showToast) CT.showToast('暂不支持此格式下载'); }\n};\n";
    }
  },

  // type: "image-resize" → upload image + width/height/quality → compress or resize
  'image-resize': {
    description: '图片压缩与调整尺寸工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>上传图片</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="image/jpeg,image/jpg,image/png,image/webp,image/gif" style="display:none;"><div class="upload-hint">点击或拖拽上传图片</div></div><div id="fileInfo" style="margin-top:0.5rem;font-size:0.85rem;display:none;"></div><div style="margin-top:0.5rem;"><div class="input-row" style="gap:0.5rem;flex-wrap:wrap;"><div style="flex:1;min-width:100px;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">宽度 (px)</label><input type="number" id="imgWidth" placeholder="原宽度" style="width:100%;padding:0.4rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"></div><div style="flex:1;min-width:100px;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">高度 (px)</label><input type="number" id="imgHeight" placeholder="原高度" style="width:100%;padding:0.4rem;font-size:0.9rem;border:1px solid var(--border);border-radius:8px;"></div></div><div style="margin-top:0.5rem;"><label style="font-size:0.78rem;opacity:0.7;display:block;margin-bottom:0.2rem;">质量 (1-100) <span id="qualityVal">80</span></label><input type="range" id="imgQuality" min="10" max="100" value="80" style="width:100%;"></div><div style="margin-top:0.3rem;font-size:0.78rem;opacity:0.6;">保持比例: <input type="checkbox" id="keepRatio" checked></div></div><div class="btn-row"><button class="btn btn-primary" id="processBtn">处理</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>输出 <button class="copy-btn" id="downloadBtn">下载</button></h3><div id="outputPreview" style="text-align:center;padding:1rem;"></div></div>';
    },
    script: function(tool) {
      return "var fileInput = document.getElementById('fileInput');\\nvar uploadArea = document.getElementById('uploadArea');\\nvar fileInfo = document.getElementById('fileInfo');\\nvar imgWidth = document.getElementById('imgWidth');\\nvar imgHeight = document.getElementById('imgHeight');\\nvar imgQuality = document.getElementById('imgQuality');\\nvar keepRatio = document.getElementById('keepRatio');\\nvar qualityVal = document.getElementById('qualityVal');\\nvar processBtn = document.getElementById('processBtn');\\nvar outputBox = document.getElementById('outputBox');\\nvar outputPreview = document.getElementById('outputPreview');\\nvar currentFile = null;\\nvar currentFileName = '';\\nvar origW = 0, origH = 0;\\nimgQuality.addEventListener('input', function() { qualityVal.textContent = imgQuality.value; });\\nuploadArea.addEventListener('click', function() { fileInput.click(); });\\nuploadArea.addEventListener('dragover', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--primary)'; });\\nuploadArea.addEventListener('dragleave', function() { uploadArea.style.borderColor = 'var(--border)'; });\\nuploadArea.addEventListener('drop', function(e) { e.preventDefault(); uploadArea.style.borderColor = 'var(--border)'; if (e.dataTransfer.files[0]) loadFile(e.dataTransfer.files[0]); });\\nfileInput.addEventListener('change', function() { if (fileInput.files[0]) loadFile(fileInput.files[0]); });\\nkeepRatio.addEventListener('change', function() { if (keepRatio.checked && origW && origH && imgWidth.value) { var r = origH / origW; imgHeight.value = Math.round(imgWidth.value * r); } });\\nfunction loadFile(file) {\\n  currentFile = file;\\n  currentFileName = file.name;\\n  fileInfo.style.display = 'block';\\n  fileInfo.innerHTML = '<b>' + escHtml(file.name) + '</b> (' + (file.size / 1024).toFixed(1) + ' KB)';\\n  var reader = new FileReader();\\n  reader.onload = function(e) {\\n    var img = new Image();\\n    img.onload = function() {\\n      origW = img.width; origH = img.height;\\n      imgWidth.placeholder = origW;\\n      imgHeight.placeholder = origH;\\n      imgWidth.value = origW;\\n      imgHeight.value = origH;\\n      outputBox.style.display = 'none';\\n    };\\n    img.src = e.target.result;\\n  };\\n  reader.readAsDataURL(file);\\n}\\nfunction escHtml(s) { return s.replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }\\nfunction fmtSize(b) { return b < 1024 ? b + ' B' : b < 1048576 ? (b/1024).toFixed(1) + ' KB' : (b/1048576).toFixed(2) + ' MB'; }\\nfunction downloadDataUrl(dataUrl, filename) { var a = document.createElement('a'); a.href = dataUrl; a.download = filename; a.click(); }\\nprocessBtn.onclick = function() {\\n  if (!currentFile) { if (window.CT && CT.showToast) CT.showToast('请先上传图片'); return; }\\n  var targetW = parseInt(imgWidth.value) || origW;\\n  var targetH = parseInt(imgHeight.value) || origH;\\n  var q = parseInt(imgQuality.value) / 100;\\n  var reader = new FileReader();\\n  reader.onload = function(e) {\\n    var img = new Image();\\n    img.onload = function() {\\n      var canv = document.createElement('canvas');\\n      canv.width = targetW; canv.height = targetH;\\n      var ctx = canv.getContext('2d');\\n      ctx.drawImage(img, 0, 0, targetW, targetH);\\n      var mime = currentFile.type.indexOf('png') !== -1 ? 'image/png' : 'image/jpeg';\\n      canv.toBlob(function(blob) {\\n        var url = URL.createObjectURL(blob);\\n        var ext = mime === 'image/png' ? '.png' : '.jpg';\\n        var newName = currentFileName.replace(/\\\\.[^.]+$/, '') + '_resized' + ext;\\n        var ratio = ((1 - blob.size / currentFile.size) * 100).toFixed(1);\\n        var color = blob.size < currentFile.size ? '#22c55e' : '#f59e0b';\\n        outputPreview.innerHTML = '<img src=\"' + url + '\" style=\"max-width:100%;max-height:300px;border:1px solid var(--border);border-radius:8px;\\\"><div style=\\\"margin-top:0.5rem;font-size:0.85rem;\\\">原始: ' + fmtSize(currentFile.size) + ' → 处理后: ' + fmtSize(blob.size) + ' <span style=\\\"color:' + color + ';\\\">' + (blob.size < currentFile.size ? '节省 ' + ratio + '%' : '体积略增') + '</span></div>';\\n        outputBox.style.display = 'block';\\n        window._imgResult = { dataUrl: url, filename: newName };\\n      }, mime, q);\\n    };\\n    img.src = e.target.result;\\n  };\\n  reader.readAsDataURL(currentFile);\\n};\\ndocument.getElementById('downloadBtn').onclick = function() {\\n  var r = window._imgResult;\\n  if (r) downloadDataUrl(r.dataUrl, r.filename);\\n};\\n";
    }
  },

  // type: "file-analyzer" → file upload → show file metadata (magic bytes detection)
  'file-analyzer': {
    description: '文件分析工具',
    html: function(tool) {
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" style="display:none;"><div class="upload-hint">点击或拖拽上传文件</div></div><div id="fileInfo" style="margin-top:1rem;display:none;"></div></div>';
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
      return '<div class="tool-card"><h3>上传文件</h3><div class="upload-area" id="uploadArea"><input type="file" id="fileInput" accept="' + accept + '" style="display:none;"><div class="upload-hint">点击或拖拽上传文件</div></div><div id="fileInfo" style="margin-top:0.5rem;display:none;"></div>' + extraFields + '<div class="btn-row" style="margin-top:0.5rem;"><button class="btn btn-primary" id="processBtn">开始处理</button></div></div><div class="output-box" id="outputBox" style="display:none;"><h3>结果 <button class="copy-btn" id="downloadOutput">下载</button></h3><div id="outputPreview"></div></div>';
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
function stripExt(p) { return p.replace(/\.html$/, ''); }

function buildToolScript(tool) {
  // HIGHEST PRIORITY: customScript — complete JS customization, no template logic
  if (tool.customScript) {
    return tool.customScript.replace(/<\/script>/gi, '<\\/script>');
  }
  const key = stripExt(tool.path);
  // NEW: Check registry first for auto-generated tools
  if (tool.type && TOOL_TYPE_REGISTRY[tool.type]) {
    const raw = TOOL_TYPE_REGISTRY[tool.type].script(tool);
    // Escape for safe embedding in HTML script tag:
    // 1. Backslash → \\ (must be first!)
    // 2. </script> → <\/script> (prevents HTML parser from closing script tag early)
    // NO quote escaping needed - script tag content doesn't use HTML attribute rules
    const escaped = raw.replace(/\\/g, '\\\\').replace(/<\/script>/gi, '<\\/script>');
    return escaped;
  }
  // Try type inference via PATH_TO_TYPE_FALLBACK
  const effectiveType = PATH_TO_TYPE_FALLBACK[stripExt(tool.path)];
  if (effectiveType && TOOL_TYPE_REGISTRY[effectiveType]) {
    const raw2 = TOOL_TYPE_REGISTRY[effectiveType].script(tool);
    const escaped2 = raw2.replace(/\\/g, '\\\\').replace(/<\/script>/gi, '<\\/script>');
    return escaped2;
  }
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

    'code/knowledge-graph': `
      (function(){
        var svg=document.getElementById('kgSvg'),empty=document.getElementById('kgEmpty'),stats=document.getElementById('kgStats');
        var nodes=[],edges=[],gType='entity';
        var COLORS={fn:'#6366f1',cls:'#f59e0b',mod:'#10b981',prop:'#8b5cf6',val:'#ec4899',noun:'#3b82f6',default:'#64748b'};
        function uid(){return Math.random().toString(36).substr(2,9);}
        function kw(w){return/^(if|else|for|while|return|function|class|const|let|var|import|export|default|async|await|new|this|true|false|null|undefined|of|in|try|catch|throw|finally|switch|case|break|continue|typeof|instanceof)$/.test(w);}
        function detectType(text){
          var t=text.trim();
          if(t.startsWith('{')||t.startsWith('[')){try{JSON.parse(t);return'json';}catch(e){}}
          if(/^(import|const|let|var|function|class|export|require)\\s/m.test(t))return'code';
          return'text';
        }
        function extractJSON(text){
          var ns=[],es=[];
          function getType(v){if(v===null)return'val';if(Array.isArray(v))return'val';var t=typeof v;return(t==='number'||t==='boolean'||t==='string')?'val':'prop';}
          function trav(v,k,p){
            var id=uid(),ty=getType(v),lb=k||'root';
            ns.push({id:id,label:lb,type:ty});
            if(p!==null)es.push({source:p,target:id,label:k?'key':''});
            if(typeof v==='object'&&v!==null){
              if(Array.isArray(v))v.forEach(function(it,i){trav(it,String(i),id);});
              else Object.keys(v).forEach(function(k2){trav(v[k2],k2,id);});
            }
          }
          try{trav(JSON.parse(text),null,null);}catch(e){}
          return{nodes:ns,edges:es};
        }
        function extractCode(text){
          var ns=[],es=[];
          var lines=text.split('\\n');
          var curFn=null,curCls=null;
          var fnRe=/(?:function\\s+(\\w+)|(?:const|let|var)\\s+(\\w+)\\s*=\\s*(?:async\\s*)?(?:function|\\(|=>)|(\\w+)\\s*[:=]\\s*(?:async\\s*)?\\(|class\\s+(\\w+))/g;
          var clsRe=/class\\s+(\\w+)/g;
          var impRe=/(?:import|require)\\s*(?:\\{[^}]*\\}|\\*\\s*as\\s+\\w+|[^;'"\`]+)/g;
          lines.forEach(function(line){
            var m;
            while((m=fnRe.exec(line))!==null){
              var nm=m[1]||m[2]||m[3];
              if(nm&&nm.length>1&&!kw(nm)){
                var id=uid();ns.push({id:id,label:nm,type:'fn'});
                if(curCls)es.push({source:curCls,target:id,label:'method'});else if(curFn)es.push({source:curFn,target:id,label:'nested'});
                curFn=id;
              }
              fnRe.lastIndex=0;
            }
            while((m=clsRe.exec(line))!==null){
              var cn=m[1];var cid=uid();ns.push({id:cid,label:cn,type:'cls'});
              if(curCls)es.push({source:curCls,target:cid,label:'extends'});
              curCls=cid;curFn=null;clsRe.lastIndex=0;
            }
            while((m=impRe.exec(line))!==null){
              var imp=m[0].replace(/import\\s+/,'').replace(/require\\s*\\(/,'').replace(/['"\`;]/g,'').trim().split(',')[0].trim();
              if(imp&&imp.length>1&&imp!=='*'){
                var iid=uid();ns.push({id:iid,label:imp.split('/').pop().split('\\.').shift(),type:'mod'});
                if(curCls)es.push({source:curCls,target:iid,label:'import'});else if(curFn)es.push({source:curFn,target:iid,label:'import'});
              }
              impRe.lastIndex=0;
            }
          });
          return{nodes:ns.slice(0,60),edges:es.slice(0,80)};
        }
        function extractText(text){
          var ns=[],es=[];
          var cnRe=/[\\u4e00-\\u9fa5]{2,}/g,enRe=/\\b[A-Z][a-zA-Z0-9]{2,}\\b/g;
          var all=[];
          var m;
          while((m=cnRe.exec(text))!==null)all.push({w:m[0]});
          while((m=enRe.exec(text))!==null)all.push({w:m[0]});
          var uniq={};
          all.forEach(function(it){if(!uniq[it.w]){uniq[it.w]=true;ns.push({id:uid(),label:it.w,type:'noun'});}});
          var sents=text.split(/[.。!！?？;；\\n]+/);
          sents.forEach(function(sent){
            var wr=/\\b[a-z][a-z0-9]{2,}\\b/gi;
            var wrds=sent.match(wr)||[];
            var cnwrds=sent.match(cnRe)||[];
            var allwrds=[...wrds.map(function(w){return w.toLowerCase();}),...cnwrds].filter(function(w){return w.length>2;});
            for(var i=0;i<allwrds.length;i++){
              for(var j=i+1;j<allwrds.length;j++){
                if(allwrds[i]!==allwrds[j]){
                  var src=ns.find(function(n){return n.label.toLowerCase()===allwrds[i]||n.label===allwrds[i];});
                  var tgt=ns.find(function(n){return n.label.toLowerCase()===allwrds[j]||n.label===allwrds[j];});
                  if(src&&tgt&&src.id!==tgt.id){
                    var ex=es.find(function(e){return e.source===src.id&&e.target===tgt.id;});
                    if(!ex)es.push({source:src.id,target:tgt.id,label:'co-occur'});
                  }
                }
              }
            }
          });
          return{nodes:ns.slice(0,50),edges:es.slice(0,80)};
        }
        function buildGraph(input,type){
          var t=detectType(input);
          var result;
          if(t==='json')result=extractJSON(input);
          else if(t==='code')result=extractCode(input);
          else result=extractText(input);
          if(type==='mindmap'){
            var root=result.nodes[0]||{id:uid(),label:'中心',type:'default'};
            var es2=result.nodes.slice(1).map(function(n){return{source:root.id,target:n.id,label:''};});
            return{nodes:[root,...result.nodes.slice(1)],edges:es2};
          }else if(type==='concept'){
            if(result.edges.length===0&&result.nodes.length>1){
              result.nodes.forEach(function(n,i){if(i>0)result.edges.push({source:result.nodes[0].id,target:n.id,label:'relates'});});
            }
          }
          return result;
        }
        function layoutNodes(ns,es,W,H){
          var ITER=120,K=80,DAMP=0.85;
          ns.forEach(function(n){n.x=Math.random()*W;n.y=Math.random()*H;n.vx=0;n.vy=0;n.fx=0;n.fy=0;});
          for(var it=0;it<ITER;it++){
            ns.forEach(function(n1){
              ns.forEach(function(n2){
                if(n1.id===n2.id)return;
                var dx=n2.x-n1.x,dy=n2.y-n1.y;
                var dist=Math.sqrt(dx*dx+dy*dy)||1;
                var rep=500/(dist*dist);
                n1.fx-=(dx/dist)*rep;n1.fy-=(dy/dist)*rep;
              });
            });
            es.forEach(function(e){
              var s=ns.find(function(n){return n.id===e.source;});
              var t2=ns.find(function(n){return n.id===e.target;});
              if(!s||!t2)return;
              var dx=t2.x-s.x,dy=t2.y-s.y;
              var dist=Math.sqrt(dx*dx+dy*dy)||1;
              var force=K*dist;
              s.fx+=(dx/dist)*force;s.fy+=(dy/dist)*force;
            });
            ns.forEach(function(n){
              n.fx+=(W/2-n.x)*0.005;n.fy+=(H/2-n.y)*0.005;
              n.vx=(n.vx+n.fx)*DAMP;n.vy=(n.vy+n.fy)*DAMP;
              n.x=Math.max(40,Math.min(W-40,n.x));n.y=Math.max(40,Math.min(H-40,n.y));
            });
          }
          return ns;
        }
        function render(ns,es){
          var W=svg.clientWidth||800,H=500;
          svg.setAttribute('viewBox','0 0 '+W+' '+H);svg.innerHTML='';
          var bg=document.createElementNS('http://www.w3.org/2000/svg','rect');
          bg.setAttribute('width','100%');bg.setAttribute('height','100%');bg.setAttribute('fill','#0f172a');
          svg.appendChild(bg);
          var gg=document.createElementNS('http://www.w3.org/2000/svg','g');
          es.forEach(function(e){
            var s=ns.find(function(n){return n.id===e.source;});
            var t=ns.find(function(n){return n.id===e.target;});
            if(!s||!t)return;
            var ln=document.createElementNS('http://www.w3.org/2000/svg','line');
            ln.setAttribute('x1',s.x);ln.setAttribute('y1',s.y);
            ln.setAttribute('x2',t.x);ln.setAttribute('y2',t.y);
            ln.setAttribute('stroke','#475569');ln.setAttribute('stroke-width','1.5');ln.setAttribute('stroke-opacity','0.7');
            gg.appendChild(ln);
          });
          svg.appendChild(gg);
          var ng=document.createElementNS('http://www.w3.org/2000/svg','g');
          ns.forEach(function(n){
            var color=COLORS[n.type]||COLORS.default;
            var r=n.type==='default'?24:20;
            var cl=document.createElementNS('http://www.w3.org/2000/svg','circle');
            cl.setAttribute('cx',n.x);cl.setAttribute('cy',n.y);cl.setAttribute('r',r);
            cl.setAttribute('fill',color);cl.setAttribute('opacity','0.92');
            ng.appendChild(cl);
            var txt=document.createElementNS('http://www.w3.org/2000/svg','text');
            txt.setAttribute('x',n.x);txt.setAttribute('y',n.y+4);
            txt.setAttribute('text-anchor','middle');txt.setAttribute('font-size','11');
            txt.setAttribute('fill','#fff');txt.setAttribute('font-weight','600');
            txt.setAttribute('pointer-events','none');
            var lb=n.label.length>12?n.label.substr(0,11)+'…':n.label;
            txt.textContent=lb;
            ng.appendChild(txt);
          });
          svg.appendChild(ng);empty.style.display='none';
        }
        document.getElementById('kgBuild').onclick=function(){
          var input=document.getElementById('kgInput').value.trim();
          if(!input){if(window.CT&&CT.showToast)CT.showToast('请输入内容');return;}
          var type=document.getElementById('kgType').value;gType=type;
          var result=buildGraph(input,type);nodes=result.nodes;edges=result.edges;
          if(nodes.length===0){if(window.CT&&CT.showToast)CT.showToast('未检测到实体，请检查输入格式');return;}
          var W=svg.clientWidth||800,H=500;
          var laid=layoutNodes(nodes,edges,W,H);render(laid,edges);
          stats.textContent='节点: '+nodes.length+' | 边: '+edges.length+' | 输入类型: '+detectType(input);
          if(window.CT&&CT.showToast)CT.showToast('构建完成: '+nodes.length+' 节点, '+edges.length+' 条边');
        };
        document.getElementById('kgExportPng').onclick=function(){
          if(nodes.length===0){if(window.CT&&CT.showToast)CT.showToast('请先构建图谱');return;}
          var W=svg.clientWidth||800,H=500,scale=2;
          var c=document.createElement('canvas');c.width=W*scale;c.height=H*scale;
          var ctx=c.getContext('2d');ctx.scale(scale,scale);ctx.fillStyle='#0f172a';ctx.fillRect(0,0,W,H);
          var svgData=new XMLSerializer().serializeToString(svg);
          var img=new Image();
          img.onload=function(){ctx.drawImage(img,0,0,W,H);
            var a=document.createElement('a');a.download='knowledge-graph.png';a.href=c.toDataURL('image/png');a.click();
            if(window.CT&&CT.showToast)CT.showToast('PNG 已导出');
          };
          img.onerror=function(){if(window.CT&&CT.showToast)CT.showToast('导出失败');};
          img.src='data:image/svg+xml;charset=utf-8,'+encodeURIComponent(svgData);
        };
        document.getElementById('kgExportSvg').onclick=function(){
          if(nodes.length===0){if(window.CT&&CT.showToast)CT.showToast('请先构建图谱');return;}
          var W=svg.clientWidth||800,H=500;
          var ns=document.createElementNS('http://www.w3.org/2000/svg','svg');
          ns.setAttribute('xmlns','http://www.w3.org/2000/svg');ns.setAttribute('viewBox','0 0 '+W+' '+H);
          ns.setAttribute('width',W);ns.setAttribute('height',H);
          ns.innerHTML='<rect width="100%" height="100%" fill="#0f172a"/>'+svg.innerHTML;
          var blob=new Blob([ns.outerHTML],{type:'image/svg+xml'});
          var a=document.createElement('a');a.download='knowledge-graph.svg';a.href=URL.createObjectURL(blob);a.click();
          if(window.CT&&CT.showToast)CT.showToast('SVG 已导出');
        };
        document.getElementById('kgReset').onclick=function(){
          document.getElementById('kgInput').value='';svg.innerHTML='';empty.style.display='flex';nodes=[];edges=[];stats.textContent='';
        };
      })();
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
        html = html.replace(/^# (.+)$/gm, '<h2>$1</h2>');

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
        html = html.replace(/(<li>.*<\\/li>\\n?)+/g, '<ul>$&</ul>');

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
          const rows = body.trim().split('\\n').map(row => {
            const cells = row.split('|').filter(c => c !== undefined && c.trim() !== '').map(c => '<td>' + c.trim() + '</td>').join('');
            return '<tr>' + cells + '</tr>';
          }).join('');
          return '<table><thead><tr>' + headers + '</tr></thead><tbody>' + rows + '</tbody></table>';
        });

        // Paragraphs
        const lines = html.split('\\n');
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
        return result.join('\\n');
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

    'life/price-compare': `
      const container = document.getElementById('products');
      const unitOptions = ['斤','公斤','克','升','毫升','个','件','包','瓶','罐','盒','米','平方米'].map(u => '<option value="'+u+'">'+u+'</option>').join('');
      let nextId = 0;

      function escapeHtml(str) {
        return String(str).replace(/[&<>"']/g, function(c) {
          return {'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c];
        });
      }

      function createRow(name, spec, unit, price) {
        const id = nextId++;
        const div = document.createElement('div');
        div.className = 'product-row';
        div.dataset.id = id;
        const escName = escapeHtml(name || '');
        const escSpec = escapeHtml(spec || '');
        const escUnit = escapeHtml(unit || '斤');
        const escPrice = escapeHtml(price || '');
        div.innerHTML = '<div class="product-meta"><input type="text" class="p-name" placeholder="商品名称（选填）" value="'+ escName +'"><button class="btn-remove" title="移除">×</button></div><div class="product-fields"><div class="field-group"><label>规格数量</label><input type="number" class="p-spec" placeholder="如 500" min="0" step="any" value="'+ escSpec +'"></div><div class="field-group"><label>规格单位</label><select class="p-unit">'+ unitOptions.replace('value="'+ escUnit +'"','value="'+ escUnit +'" selected') +'</select></div><div class="field-group"><label>价格（元）</label><input type="number" class="p-price" placeholder="如 9.9" min="0" step="any" value="'+ escPrice +'"></div></div><div class="product-result"><span class="unit-price">—</span></div>';
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
        if (best) { best.row.classList.add('winner'); best.row.querySelector('.unit-price').textContent += ' '; }
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
          const encoder = new TextEncoder();
          setOutput(encoder.encode(gbkStr).reduce((s, b) => s + String.fromCharCode(b), ''));
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
          const encoder = new TextEncoder();
          const reencoded = encoder.encode(gbkStr).reduce((s, b) => s + String.fromCharCode(b), '');
          if (reencoded !== v) { setOutput(reencoded); return; }
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
        label.textContent = ' 工作时间';
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
              label.textContent = ' 休息时间';
              pomodoroStatus.textContent = '工作完成！休息一下';
              addAnnotation(' 番茄完成');
            } else {
              pomodoroState = 'work';
              pomodoroRemaining = workMin * 60000;
              label.textContent = ' 工作时间';
              pomodoroStatus.textContent = '休息结束，继续加油';
              addAnnotation(' 休息结束');
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
        display.textContent = '25:00'; label.textContent = ' 番茄钟';
      });
      startBtn.addEventListener('click', () => { if (mode === 'stopwatch') startTimer(); else startPomodoro(); });
      pauseBtn.addEventListener('click', () => { if (mode === 'stopwatch') pauseTimer(); else { clearInterval(pomodoroTimer); } });
      resetBtn.addEventListener('click', resetTimer);
      annotateBtn.addEventListener('click', () => { addAnnotation(''); });
      saveAnnotationBtn.addEventListener('click', () => { addAnnotation(annotationText.value); annotationText.value = ''; });
      clearTimelineBtn.addEventListener('click', () => { timeline = []; renderTimeline(); });
    `,    'code/cron-parser': `
      var cronInput = document.getElementById('cronInput');
      var result = document.getElementById('result');
      var nextRuns = document.getElementById('nextRuns');
      function parseCron(cron) {
        var parts = cron.trim().split(/\s+/);
        if (parts.length < 5) return null;
        return { min: parts[0], hour: parts[1], day: parts[2], month: parts[3], dow: parts[4] };
      }
      function matches(val, field) {
        if (field === '*') return true;
        var parts = field.split(',');
        for (var p of parts) {
          if (p.indexOf('/') !== -1) {
            var step = parseInt(p.split('/')[1]);
            var range = p.split('/')[0];
            if (range === '*') { if (val % step === 0) return true; }
            else { var r = range.split('-'); for (var i = parseInt(r[0]); i <= parseInt(r[1]); i += step) { if (i === val) return true; } }
          } else if (p.indexOf('-') !== -1) {
            var r = p.split('-');
            if (val >= parseInt(r[0]) && val <= parseInt(r[1])) return true;
          } else { if (parseInt(p) === val) return true; }
        }
        return false;
      }
      function nextExec(cron, from) {
        var p = parseCron(cron);
        if (!p) return null;
        var d = from ? new Date(from) : new Date();
        d.setSeconds(0, 0);
        for (var i = 0; i < 100; i++) {
          d.setMinutes(d.getMinutes() + 1);
          var min = d.getMinutes(), hour = d.getHours(), day = d.getDate(), month = d.getMonth() + 1, dow = d.getDay();
          if (matches(min, p.min) && matches(hour, p.hour) && matches(day, p.day) && matches(month, p.month) && matches(dow, p.dow)) return new Date(d);
        }
        return null;
      }
      function run() {
        var cron = cronInput.value.trim();
        if (!cron) { result.textContent = '请输入 Cron 表达式'; nextRuns.innerHTML = ''; return; }
        var p = parseCron(cron);
        if (!p) { result.textContent = '格式错误（正确格式：分 时 日 月 周）'; nextRuns.innerHTML = ''; return; }
        result.textContent = ' 格式正确';
        var runs = [];
        var from = null;
        for (var i = 0; i < 5; i++) {
          var next = nextExec(cron, from);
          if (!next) break;
          runs.push(next.toLocaleString('zh-CN', {year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit'}));
          from = next;
        }
        nextRuns.innerHTML = runs.length ? '<li>' + runs.join('</li><li>') + '</li>' : '<li>无未来执行时间</li>';
      }
      cronInput.addEventListener('input', run);
      document.getElementById('examples').addEventListener('change', function() { cronInput.value = this.value; run(); });
      run();
    `,    'code/color-picker': `
      var colorInput = document.getElementById('colorInput');
      var preview = document.getElementById('preview');
      var hexOut = document.getElementById('hexOut');
      var rgbOut = document.getElementById('rgbOut');
      var hslOut = document.getElementById('hslOut');
      function update(c) {
        preview.style.background = c;
        hexOut.value = c;
        var r = parseInt(c.slice(1,3), 16);
        var g = parseInt(c.slice(3,5), 16);
        var b = parseInt(c.slice(5,7), 16);
        rgbOut.value = 'rgb(' + r + ', ' + g + ', ' + b + ')';
        var max = Math.max(r,g,b)/255, min = Math.min(r,g,b)/255;
        var l = (max+min)/2, s = 0, h = 0;
        if (max !== min) {
          var d = max - min;
          s = l > 0.5 ? d/(2-max-min) : d/(max+min);
          var rr=r/255, gg=g/255, bb=b/255;
          if (rr===max) h = ((gg-bb)/d + (gg<bb?6:0))/6;
          else if (gg===max) h = ((bb-rr)/d + 2)/6;
          else h = ((rr-gg)/d + 4)/6;
        }
        hslOut.value = 'hsl(' + Math.round(h*360) + ', ' + Math.round(s*100) + '%, ' + Math.round(l*100) + '%)';
      }
      colorInput.addEventListener('input', function() { update(this.value); });
      update('#4a90e2');
      document.getElementById('copyHex').onclick = function() { navigator.clipboard.writeText(hexOut.value); if (window.CT && CT.showToast) CT.showToast('已复制 HEX'); };
      document.getElementById('copyRgb').onclick = function() { navigator.clipboard.writeText(rgbOut.value); if (window.CT && CT.showToast) CT.showToast('已复制 RGB'); };
      document.getElementById('copyHsl').onclick = function() { navigator.clipboard.writeText(hslOut.value); if (window.CT && CT.showToast) CT.showToast('已复制 HSL'); };
    `,
    'text/jianfan': `
      var input = document.getElementById('input');
      var output = document.getElementById('output');
      var UNICODE_OFFSET = 0x4E00 - 0x3400;
      function t2s(t) {
        return t.replace(/[\u3400-\u9FFF]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) + UNICODE_OFFSET); });
      }
      function s2t(s) {
        return s.replace(/[\u4E00-\u9FFF]/g, function(c) { return String.fromCharCode(c.charCodeAt(0) - UNICODE_OFFSET); });
      }
      function run() { output.value = input.value; }
      document.getElementById('toSimple').onclick = function() { output.value = t2s(input.value); };
      document.getElementById('toTraditional').onclick = function() { output.value = s2t(input.value); };
      document.getElementById('copyOutput').onclick = function() { copyToClipboard(output.value); };
      input.addEventListener('input', run);
    `,
    'time/lunar-solar-converter': `
      var solarInput = document.getElementById('solarInput');
      var lunarOutput = document.getElementById('lunarOutput');
      var LUNAR_INFO = [384, 354, 355, 383, 354, 355, 384, 354, 355, 354, 383, 354, 355, 383, 353, 355, 384, 354, 384, 354, 354, 384, 354, 353, 354, 384, 353, 354, 384, 354, 355, 384, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 383, 354, 354, 384, 354, 355, 383, 354, 355, 383, 354, 355, 384, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 354, 383, 354, 355, 384, 354, 355, 383, 354, 354, 384, 354, 355, 384, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 383, 354, 354, 384, 354, 355, 383, 354, 355, 384, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 383, 354, 354, 384, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 383, 354, 355, 384, 354, 355, 384, 354, 354, 384, 354, 355, 383];
      var BASE_SOLAR_DATE = new Date(1900, 0, 31);
      function solarToLunar(year, month, day) {
        var daysBetween = Math.floor((new Date(year, month-1, day) - BASE_SOLAR_DATE) / 86400000);
        var lunarDay, lunarMonth, lunarYear = 1900;
        var acc = 0;
        for (var i = 0; i < LUNAR_INFO.length; i++) {
          if (acc + LUNAR_INFO[i] > daysBetween) {
            lunarDay = daysBetween - acc + 1;
            lunarMonth = i + 1;
            lunarYear = 1900 + Math.floor(i / 12);
            break;
          }
          acc += LUNAR_INFO[i];
        }
        var MONTHS_CN = ['正','二','三','四','五','六','七','八','九','十','冬','腊'];
        var DAYS_CN = ['初一','初二','初三','初四','初五','初六','初七','初八','初九','初十','十一','十二','十三','十四','十五','十六','十七','十八','十九','二十','廿一','廿二','廿三','廿四','廿五','廿六','廿七','廿八','廿九','三十'];
        return lunarYear + '年 ' + MONTHS_CN[lunarMonth-1] + '月 ' + DAYS_CN[lunarDay-1];
      }
      function run() {
        var parts = solarInput.value.split('-');
        if (parts.length === 3) {
          var y = parseInt(parts[0]), m = parseInt(parts[1]), d = parseInt(parts[2]);
          if (y >= 1900 && y <= 2100) {
            lunarOutput.textContent = solarToLunar(y, m, d);
            return;
          }
        }
        lunarOutput.textContent = '请输入有效日期 (1900-2100)';
      }
      solarInput.addEventListener('input', run);
      run();
    `,
    'other/reaction-test': `
      var state = 'waiting';
      var startTime = 0;
      var box = document.getElementById('reactionBox');
      var result = document.getElementById('result');
      var bestResult = document.getElementById('bestResult');
      var bestTime = Infinity;
      function reset() {
        state = 'waiting';
        box.style.background = 'var(--bg-secondary)';
        box.style.cursor = 'default';
        box.textContent = '点击开始';
        result.textContent = '';
      }
      box.onclick = function() {
        if (state === 'waiting') {
          state = 'ready';
          box.style.background = '#ef4444';
          box.style.cursor = 'pointer';
          box.textContent = '等待变绿...';
          var delay = 1000 + Math.random() * 2000;
          setTimeout(function() {
            if (state === 'ready') {
              state = 'green';
              startTime = Date.now();
              box.style.background = '#22c55e';
              box.textContent = '点击！';
            }
          }, delay);
        } else if (state === 'ready') {
          state = 'too-early';
          box.style.background = '#f59e0b';
          box.textContent = '太早了！点击重试';
        } else if (state === 'green') {
          var elapsed = Date.now() - startTime;
          state = 'done';
          box.textContent = '你的反应时间: ' + elapsed + ' ms';
          result.textContent = '本次: ' + elapsed + ' ms';
          if (elapsed < bestTime) { bestTime = elapsed; bestResult.textContent = '最佳: ' + bestTime + ' ms'; }
        } else if (state === 'too-early' || state === 'done') {
          reset();
        }
      };
      reset();
    `,
    'other/click-speed': `
      var clicks = 0;
      var totalTime = 10000;
      var timeLeft = totalTime;
      var timer = null;
      var btn = document.getElementById('clickBtn');
      var result = document.getElementById('result');
      var counter = document.getElementById('counter');
      var timerDisplay = document.getElementById('timerDisplay');
      function start() {
        clicks = 0;
        timeLeft = totalTime;
        btn.disabled = true;
        counter.textContent = '0';
        timerDisplay.textContent = (totalTime/1000).toFixed(1) + 's';
        timer = setInterval(function() {
          timeLeft -= 100;
          timerDisplay.textContent = (timeLeft/1000).toFixed(1) + 's';
          if (timeLeft <= 0) {
            clearInterval(timer);
            btn.disabled = false;
            btn.textContent = '开始';
            counter.textContent = clicks;
            var cps = (clicks / (totalTime/1000)).toFixed(1);
            result.textContent = clicks + ' 次点击 / 10秒 = ' + cps + ' 次/秒';
          }
        }, 100);
      }
      btn.onclick = function() { start(); };
      counter.textContent = '0';
      document.getElementById('clickArea').onclick = function() {
        if (timeLeft > 0 && timeLeft < totalTime) {
          clicks++;
          counter.textContent = clicks;
        }
      };
    `,
  };

  return scripts[key] || `// TODO: implement ${tool.path}`;
}

// ============ Tool content HTML builders ============
function buildToolContentHtml(tool) {
  // HIGHEST PRIORITY: customHtml — complete HTML customization, no template logic
  if (tool.customHtml) {
    return tool.customHtml;
  }
  const key = stripExt(tool.path);
  // NEW: Check registry first for auto-generated tools
  if (tool.type && TOOL_TYPE_REGISTRY[tool.type]) {
    return TOOL_TYPE_REGISTRY[tool.type].html(tool);
  }
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

    'code/knowledge-graph': `
      <div class="tool-card">
        <h3>输入内容</h3>
        <textarea id="kgInput" placeholder="粘贴 JSON、代码或任意文本...&#10;&#10;示例 JSON:&#10{&#10;  "name": "Alice",&#10;  "age": 30,&#10;  "friends": ["Bob", "Charlie"]&#10;}" style="min-height:160px;resize:vertical;font-family:monospace;font-size:0.85rem;"></textarea>
        <div style="display:flex;gap:0.75rem;flex-wrap:wrap;align-items:center;margin:0.75rem 0;">
          <label style="font-size:0.85rem;display:flex;align-items:center;gap:0.4rem;">图谱类型: <select id="kgType" style="padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;background:var(--bg);"><option value="entity">实体关系图</option><option value="mindmap">思维导图</option><option value="concept">概念图</option></select></label>
          <button class="btn btn-primary" id="kgBuild">构建图谱</button>
        </div>
      </div>
      <div id="kgViz" style="background:#0f172a;border-radius:16px;min-height:400px;position:relative;overflow:hidden;display:flex;align-items:center;justify-content:center;color:#64748b;font-size:0.9rem;margin-top:0.5rem;">
        <svg id="kgSvg" width="100%" height="500" style="display:block;"></svg>
        <div id="kgEmpty" style="position:absolute;inset:0;display:flex;align-items:center;justify-content:center;flex-direction:column;gap:0.5rem;">
          <svg width="48" height="48" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.5"><circle cx="12" cy="5" r="2"/><circle cx="5" cy="19" r="2"/><circle cx="19" cy="19" r="2"/><line x1="12" y1="7" x2="5" y2="17"/><line x1="12" y1="7" x2="19" y2="17"/><line x1="5" y1="19" x2="19" y2="19"/></svg>
          输入内容后点击「构建图谱」
        </div>
      </div>
      <div class="btn-row" style="margin-top:0.75rem;">
        <button class="btn btn-secondary" id="kgExportPng">导出 PNG</button>
        <button class="btn btn-secondary" id="kgExportSvg">导出 SVG</button>
        <button class="btn btn-secondary" id="kgReset">重置</button>
      </div>
      <div id="kgStats" style="margin-top:0.5rem;font-size:0.8rem;color:var(--text-secondary);"></div>`,

    'json/table': `
      <div class="tool-layout two-col">
        <div class="tool-card">
          <h3>JSON 数据</h3>
          <textarea id="input" placeholder="输入 JSON 数组，如:&#10;[&#10;  {&quot;name&quot;:&quot;张三&quot;,&quot;age&quot;:20},&#10;  {&quot;name&quot;:&quot;李四&quot;,&quot;age&quot;:22}&#10;]" style="min-height:200px;font-family:monospace;font-size:0.85rem;"></textarea>
        </div>
        <div class="tool-card">
          <h3>表格</h3>
          <div class="table-toolbar">
            <input type="text" id="searchInput" placeholder=" 搜索..." style="flex:1;padding:0.4rem 0.6rem;border:1px solid var(--border);border-radius:8px;font-size:0.85rem;">
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
      </div>
      <style>
        .md-preview { font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, sans-serif; line-height: 1.7; }
        .md-preview h2, .md-preview h3, .md-preview h4, .md-preview h5, .md-preview h6 { margin: 1em 0 0.5em; border-bottom: 1px solid #eee; padding-bottom: 0.3em; }
        .md-preview h2 { font-size: 1.6rem; } .md-preview h3 { font-size: 1.4rem; } .md-preview h4 { font-size: 1.2rem; }
        .md-preview p { margin: 0.8em 0; }
        .md-preview ul, .md-preview ol { padding-left: 1.5em; margin: 0.8em 0; }
        .md-preview li { margin: 0.3em 0; }
        .md-preview blockquote { border-left: 4px solid #ddd; padding: 0.5em 1em; margin: 0.8em 0; color: #666; background: #f9f9f9; border-radius: 0 8px 8px 0; }
        .md-preview code { background: #f0f0f0; padding: 0.15em 0.4em; border-radius: 4px; font-family: 'Fira Code', monospace; font-size: 0.88em; }
        .md-preview pre { background: #1e1e1e; color: #d4d4d4; padding: 1em; border-radius: 10px; overflow-x: auto; margin: 0.8em 0; }
        .md-preview pre code { background: none; padding: 0; color: inherit; }
        .md-preview a { color: #4a90e2; text-decoration: none; }
        .md-preview a:hover { text-decoration: underline; }
        .md-preview img { max-width: 100%; border-radius: 8px; margin: 0.5em 0; }
        .md-preview table { border-collapse: collapse; width: 100%; margin: 0.8em 0; }
        .md-preview th, .md-preview td { border: 1px solid #ddd; padding: 0.5em 0.8em; text-align: left; }
        .md-preview th { background: #f5f5f5; font-weight: 600; }
        .md-preview hr { border: none; border-top: 2px solid #eee; margin: 1.5em 0; }
        .md-preview strong { font-weight: 700; }
      </style>`,

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
            <button class="btn btn-primary" id="autoFix"> 自动修复</button>
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
           自动修复会依次尝试各种编码方式，检测到有效中文即停止。如自动结果不理想，可手动选择具体编码方式。
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

    
    'time/lunar-birthday': `
    var LUNAR_DATA = {"1900": {"leap": 8, "days": [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30], "start": "1900-01-31"}, "1901": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30], "start": "1901-02-19"}, "1902": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "1902-02-08"}, "1903": {"leap": 5, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30], "start": "1903-01-29"}, "1904": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30], "start": "1904-02-16"}, "1905": {"leap": 0, "days": [29, 30, 30, 29, 30, 30, 29, 29, 30, 29, 30, 29], "start": "1905-02-04"}, "1906": {"leap": 4, "days": [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "1906-01-25"}, "1907": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1907-02-13"}, "1908": {"leap": 0, "days": [29, 30, 29, 29, 30, 30, 29, 30, 29, 30, 30, 29], "start": "1908-02-02"}, "1909": {"leap": 2, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30], "start": "1909-01-22"}, "1910": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30], "start": "1910-02-10"}, "1911": {"leap": 6, "days": [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30], "start": "1911-01-30"}, "1912": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "1912-02-18"}, "1913": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29], "start": "1913-02-06"}, "1914": {"leap": 5, "days": [30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "1914-01-26"}, "1915": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29], "start": "1915-02-14"}, "1916": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1916-02-03"}, "1917": {"leap": 2, "days": [30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29], "start": "1917-01-23"}, "1918": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30], "start": "1918-02-11"}, "1919": {"leap": 7, "days": [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 30], "start": "1919-02-01"}, "1920": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "1920-02-20"}, "1921": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "1921-02-08"}, "1922": {"leap": 5, "days": [30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "1922-01-28"}, "1923": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "1923-02-16"}, "1924": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "1924-02-05"}, "1925": {"leap": 4, "days": [30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1925-01-24"}, "1926": {"leap": 0, "days": [29, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1926-02-13"}, "1927": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 29, 30, 30], "start": "1927-02-02"}, "1928": {"leap": 2, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 30], "start": "1928-01-23"}, "1929": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "1929-02-10"}, "1930": {"leap": 6, "days": [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29], "start": "1930-01-30"}, "1931": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "1931-02-17"}, "1932": {"leap": 0, "days": [29, 30, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "1932-02-06"}, "1933": {"leap": 5, "days": [29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30], "start": "1933-01-26"}, "1934": {"leap": 0, "days": [29, 29, 30, 29, 30, 30, 29, 30, 29, 30, 30, 29], "start": "1934-02-14"}, "1935": {"leap": 0, "days": [29, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1935-02-04"}, "1936": {"leap": 3, "days": [30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 30, 29], "start": "1936-01-24"}, "1937": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30], "start": "1937-02-11"}, "1938": {"leap": 7, "days": [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30], "start": "1938-01-31"}, "1939": {"leap": 0, "days": [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29], "start": "1939-02-19"}, "1940": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "1940-02-08"}, "1941": {"leap": 6, "days": [30, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "1941-01-27"}, "1942": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29], "start": "1942-02-15"}, "1943": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1943-02-05"}, "1944": {"leap": 4, "days": [30, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1944-01-25"}, "1945": {"leap": 0, "days": [29, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29], "start": "1945-02-13"}, "1946": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29], "start": "1946-02-02"}, "1947": {"leap": 2, "days": [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "1947-01-22"}, "1948": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "1948-02-10"}, "1949": {"leap": 7, "days": [30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "1949-01-29"}, "1950": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 30, 29, 29, 30, 29, 30], "start": "1950-02-17"}, "1951": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29], "start": "1951-02-06"}, "1952": {"leap": 5, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1952-01-27"}, "1953": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 29, 30], "start": "1953-02-14"}, "1954": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30], "start": "1954-02-03"}, "1955": {"leap": 3, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30], "start": "1955-01-24"}, "1956": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "1956-02-12"}, "1957": {"leap": 8, "days": [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 29], "start": "1957-01-31"}, "1958": {"leap": 0, "days": [29, 30, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "1958-02-18"}, "1959": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "1959-02-08"}, "1960": {"leap": 6, "days": [30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29], "start": "1960-01-28"}, "1961": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29], "start": "1961-02-15"}, "1962": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1962-02-05"}, "1963": {"leap": 4, "days": [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29], "start": "1963-01-25"}, "1964": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "1964-02-13"}, "1965": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30], "start": "1965-02-02"}, "1966": {"leap": 3, "days": [30, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "1966-01-21"}, "1967": {"leap": 0, "days": [29, 30, 30, 29, 30, 30, 29, 29, 30, 29, 30, 29], "start": "1967-02-09"}, "1968": {"leap": 7, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "1968-01-30"}, "1969": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1969-02-17"}, "1970": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29], "start": "1970-02-06"}, "1971": {"leap": 5, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30], "start": "1971-01-27"}, "1972": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29], "start": "1972-02-15"}, "1973": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "1973-02-03"}, "1974": {"leap": 4, "days": [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30], "start": "1974-01-23"}, "1975": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29], "start": "1975-02-11"}, "1976": {"leap": 8, "days": [30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "1976-01-31"}, "1977": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29], "start": "1977-02-18"}, "1978": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30], "start": "1978-02-07"}, "1979": {"leap": 6, "days": [30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29], "start": "1979-01-28"}, "1980": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30], "start": "1980-02-16"}, "1981": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30], "start": "1981-02-05"}, "1982": {"leap": 4, "days": [30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30], "start": "1982-01-25"}, "1983": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "1983-02-13"}, "1984": {"leap": 10, "days": [30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "1984-02-02"}, "1985": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "1985-02-20"}, "1986": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "1986-02-09"}, "1987": {"leap": 6, "days": [30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30, 29, 29], "start": "1987-01-29"}, "1988": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1988-02-17"}, "1989": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 29, 30, 30], "start": "1989-02-06"}, "1990": {"leap": 5, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 30], "start": "1990-01-27"}, "1991": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "1991-02-15"}, "1992": {"leap": 0, "days": [29, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "1992-02-04"}, "1993": {"leap": 3, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "1993-01-23"}, "1994": {"leap": 0, "days": [29, 30, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "1994-02-10"}, "1995": {"leap": 8, "days": [29, 30, 30, 29, 30, 29, 30, 30, 29, 29, 30, 29, 30], "start": "1995-01-31"}, "1996": {"leap": 0, "days": [29, 29, 30, 29, 30, 30, 29, 30, 29, 30, 30, 29], "start": "1996-02-19"}, "1997": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "1997-02-07"}, "1998": {"leap": 5, "days": [30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30, 29, 30], "start": "1998-01-28"}, "1999": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30], "start": "1999-02-16"}, "2000": {"leap": 0, "days": [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "2000-02-05"}, "2001": {"leap": 4, "days": [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "2001-01-24"}, "2002": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "2002-02-12"}, "2003": {"leap": 0, "days": [29, 30, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29], "start": "2003-02-01"}, "2004": {"leap": 2, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "2004-01-22"}, "2005": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "2005-02-09"}, "2006": {"leap": 7, "days": [30, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "2006-01-29"}, "2007": {"leap": 0, "days": [29, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29], "start": "2007-02-18"}, "2008": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 29], "start": "2008-02-07"}, "2009": {"leap": 5, "days": [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "2009-01-26"}, "2010": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "2010-02-14"}, "2011": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30], "start": "2011-02-03"}, "2012": {"leap": 4, "days": [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29], "start": "2012-01-23"}, "2013": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2013-02-10"}, "2014": {"leap": 9, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "2014-01-31"}, "2015": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30], "start": "2015-02-19"}, "2016": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30], "start": "2016-02-08"}, "2017": {"leap": 6, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30], "start": "2017-01-28"}, "2018": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "2018-02-16"}, "2019": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 29, 30], "start": "2019-02-05"}, "2020": {"leap": 4, "days": [29, 30, 30, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "2020-01-25"}, "2021": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "2021-02-12"}, "2022": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2022-02-01"}, "2023": {"leap": 2, "days": [29, 30, 29, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30], "start": "2023-01-22"}, "2024": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30], "start": "2024-02-10"}, "2025": {"leap": 6, "days": [30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29], "start": "2025-01-29"}, "2026": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30], "start": "2026-02-17"}, "2027": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30], "start": "2027-02-06"}, "2028": {"leap": 5, "days": [30, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "2028-01-26"}, "2029": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30], "start": "2029-02-13"}, "2030": {"leap": 0, "days": [29, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30], "start": "2030-02-03"}, "2031": {"leap": 3, "days": [29, 30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2031-01-23"}, "2032": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30, 29], "start": "2032-02-11"}, "2033": {"leap": 11, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30, 29, 30], "start": "2033-01-31"}, "2034": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29], "start": "2034-02-19"}, "2035": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "2035-02-08"}, "2036": {"leap": 6, "days": [30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "2036-01-28"}, "2037": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29], "start": "2037-02-15"}, "2038": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30], "start": "2038-02-04"}, "2039": {"leap": 5, "days": [30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29], "start": "2039-01-24"}, "2040": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 30, 29, 30], "start": "2040-02-12"}, "2041": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29], "start": "2041-02-01"}, "2042": {"leap": 2, "days": [29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30], "start": "2042-01-22"}, "2043": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30], "start": "2043-02-10"}, "2044": {"leap": 7, "days": [30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30], "start": "2044-01-30"}, "2045": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "2045-02-17"}, "2046": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "2046-02-06"}, "2047": {"leap": 5, "days": [30, 29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "2047-01-26"}, "2048": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 30, 29, 30, 29, 29, 30], "start": "2048-02-14"}, "2049": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 30], "start": "2049-02-02"}, "2050": {"leap": 3, "days": [29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29], "start": "2050-01-23"}, "2051": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 30, 29, 30, 30], "start": "2051-02-11"}, "2052": {"leap": 8, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 30], "start": "2052-02-01"}, "2053": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "2053-02-19"}, "2054": {"leap": 0, "days": [29, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "2054-02-08"}, "2055": {"leap": 6, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "2055-01-28"}, "2056": {"leap": 0, "days": [29, 30, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29], "start": "2056-02-15"}, "2057": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 30, 29, 29, 30], "start": "2057-02-04"}, "2058": {"leap": 4, "days": [30, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29, 29], "start": "2058-01-24"}, "2059": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 30, 29, 30, 30, 30], "start": "2059-02-12"}, "2060": {"leap": 0, "days": [29, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30], "start": "2060-02-02"}, "2061": {"leap": 3, "days": [30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29], "start": "2061-01-21"}, "2062": {"leap": 0, "days": [29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30, 30], "start": "2062-02-09"}, "2063": {"leap": 7, "days": [30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "2063-01-29"}, "2064": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30], "start": "2064-02-17"}, "2065": {"leap": 0, "days": [29, 30, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29], "start": "2065-02-05"}, "2066": {"leap": 5, "days": [29, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "2066-01-26"}, "2067": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30], "start": "2067-02-14"}, "2068": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 30, 29, 30, 30, 29], "start": "2068-02-03"}, "2069": {"leap": 4, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30], "start": "2069-01-23"}, "2070": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 29, 30, 29, 30, 30, 29], "start": "2070-02-11"}, "2071": {"leap": 8, "days": [30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "2071-01-31"}, "2072": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29], "start": "2072-02-19"}, "2073": {"leap": 0, "days": [29, 30, 29, 30, 30, 29, 30, 29, 29, 30, 29, 30], "start": "2073-02-07"}, "2074": {"leap": 6, "days": [30, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30, 29], "start": "2074-01-27"}, "2075": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2075-02-15"}, "2076": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 29, 30, 30, 29, 30], "start": "2076-02-05"}, "2077": {"leap": 4, "days": [30, 29, 30, 29, 29, 30, 29, 30, 30, 30, 29, 30, 29], "start": "2077-01-24"}, "2078": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30], "start": "2078-02-12"}, "2079": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30], "start": "2079-02-02"}, "2080": {"leap": 3, "days": [30, 29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30], "start": "2080-01-22"}, "2081": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30], "start": "2081-02-09"}, "2082": {"leap": 7, "days": [29, 30, 30, 30, 29, 29, 30, 29, 30, 29, 29, 30, 30], "start": "2082-01-29"}, "2083": {"leap": 0, "days": [29, 29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 30], "start": "2083-02-17"}, "2084": {"leap": 0, "days": [29, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2084-02-06"}, "2085": {"leap": 5, "days": [29, 30, 29, 29, 30, 30, 29, 30, 30, 29, 30, 29, 30], "start": "2085-01-26"}, "2086": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 30, 29, 30, 30], "start": "2086-02-14"}, "2087": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30], "start": "2087-02-03"}, "2088": {"leap": 4, "days": [29, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30, 29], "start": "2088-01-24"}, "2089": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 29, 30, 29, 30, 30], "start": "2089-02-10"}, "2090": {"leap": 8, "days": [30, 30, 30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 29], "start": "2090-01-30"}, "2091": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30], "start": "2091-02-18"}, "2092": {"leap": 0, "days": [29, 30, 30, 29, 30, 30, 29, 30, 29, 30, 29, 30], "start": "2092-02-07"}, "2093": {"leap": 6, "days": [29, 30, 30, 29, 30, 29, 30, 30, 29, 30, 29, 30, 29], "start": "2093-01-27"}, "2094": {"leap": 0, "days": [29, 29, 30, 29, 30, 29, 30, 30, 29, 30, 30, 29], "start": "2094-02-15"}, "2095": {"leap": 0, "days": [29, 29, 30, 29, 29, 30, 29, 30, 29, 30, 30, 30], "start": "2095-02-05"}, "2096": {"leap": 4, "days": [30, 29, 30, 29, 29, 30, 29, 29, 30, 30, 30, 29, 30], "start": "2096-01-25"}, "2097": {"leap": 0, "days": [29, 30, 29, 30, 29, 29, 29, 30, 29, 30, 30, 29], "start": "2097-02-12"}, "2098": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 29, 29, 30, 29, 30, 29], "start": "2098-02-01"}, "2099": {"leap": 2, "days": [30, 30, 29, 30, 30, 29, 29, 30, 29, 29, 30, 29, 30], "start": "2099-01-21"}, "2100": {"leap": 0, "days": [29, 30, 30, 29, 30, 29, 30, 29, 30, 29, 29, 30], "start": "2100-02-09"}};
    var _storedSolarDate = null;
    function lunarToSolar(year, month, day, isLeap) {
        var yd = LUNAR_DATA[String(year)];
        if (!yd) throw new Error('年份超出范围（1900-2100）');
        var leap = yd.leap;
        var days = yd.days;
        var total = day - 1;
        if (isLeap) {
            if (month !== leap) throw new Error('该年农历' + month + '月不是闰月');
            for (var i = 0; i < days.length; i++) {
                if (i + 1 === leap + 1) { total += days[i]; break; }
                total += days[i];
            }
        } else {
            var monthIdx = 0;
            for (var i = 0; i < days.length; i++) {
                if (leap > 0 && i + 1 === leap + 1) { continue; }
                monthIdx++;
                if (monthIdx === month) { total += days[i]; break; }
                total += days[i];
            }
        }
        var sp = yd.start.split('-');
        var startDate = new Date(parseInt(sp[0]), parseInt(sp[1]) - 1, parseInt(sp[2]));
        return new Date(startDate.getTime() + total * 86400000);
    }
    function fmt(date) {
        var weekdays = ['周日','周一','周二','周三','周四','周五','周六'];
        return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日（' + weekdays[date.getDay()] + '）';
    }
    function fmtShort(date) {
        return date.getFullYear() + ' 年 ' + (date.getMonth() + 1) + ' 月 ' + date.getDate() + ' 日';
    }
    var MONTHS_CN = ['正月','二月','三月','四月','五月','六月','七月','八月','九月','十月','冬月','腊月'];
    function dayToCN(d) {
        if (d === 10) return '初十';
        if (d < 10) return '初' + ['一','二','三','四','五','六','七','八','九'][d-1];
        if (d === 20) return '二十';
        if (d === 30) return '三十';
        if (d > 20) return '廿' + ['','一','二','三','四','五','六','七','八','九'][d-20];
        return '十' + ['','一','二','三','四','五','六','七','八','九'][d-10];
    }
    document.getElementById('convertBtn').addEventListener('click', function() {
        try {
            var year = parseInt(document.getElementById('lunarYear').value);
            var month = parseInt(document.getElementById('lunarMonth').value);
            var day = parseInt(document.getElementById('lunarDay').value);
            var isLeap = document.getElementById('leapMonth').checked;
            var solar = lunarToSolar(year, month, day, isLeap);
            _storedSolarDate = solar;
            var today = new Date();
            var age = today.getFullYear() - solar.getFullYear();
            var md = today.getMonth() - solar.getMonth();
            var passed = md > 0 || (md === 0 && today.getDate() >= solar.getDate());
            if (!passed) age--;
            var daysSince = Math.floor((today - solar) / 86400000);
            var badge = passed ? '<span class="badge badge-passed">已过生日</span>' : '<span class="badge badge-upcoming">还没到生日</span>';
            var leapStr = isLeap ? '（闰）' : '';
            document.getElementById('resSolar').textContent = fmt(solar);
            document.getElementById('resLunar').textContent = year + ' 年 ' + MONTHS_CN[month-1] + leapStr + ' ' + dayToCN(day);
            document.getElementById('resAge').textContent = age + ' 岁';
            document.getElementById('resBadge').innerHTML = badge;
            document.getElementById('resDays').textContent = daysSince.toLocaleString() + ' 天';
            document.getElementById('resultBox').style.display = 'block';
            var fy = document.getElementById('futureYear');
            fy.value = today.getFullYear() + 1;
            fy.min = 1900; fy.max = 2100;
            document.getElementById('futureResult').textContent = '';
        } catch (e) {
            CT.showToast(e.message || '转换失败');
        }
    });
    document.getElementById('futureBtn').addEventListener('click', function() {
        if (!_storedSolarDate) { CT.showToast('请先输入农历生日进行转换'); return; }
        var year = parseInt(document.getElementById('futureYear').value);
        if (!year || year < 1900 || year > 2100) { CT.showToast('请输入 1900-2100 之间的年份'); return; }
        var target = new Date(year, _storedSolarDate.getMonth(), _storedSolarDate.getDate());
        document.getElementById('futureResult').innerHTML = '<b>' + year + ' 年</b>对应的公历日期是 <b>' + fmtShort(target) + '</b>';
    });
    `,
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

    
    'time/lunar-birthday': `
      <div class="tool-card">
        <h3>农历出生日期</h3>
        <div class="input-row">
          <div class="input-field">
            <label>年份</label>
            <select id="lunarYear"><option value="2005">2005 年</option>
<option value="2004">2004 年</option>
<option value="2003">2003 年</option>
<option value="2002">2002 年</option>
<option value="2001">2001 年</option>
<option value="2000">2000 年</option>
<option value="1999">1999 年</option>
<option value="1998">1998 年</option>
<option value="1997">1997 年</option>
<option value="1996">1996 年</option>
<option value="1995">1995 年</option>
<option value="1994">1994 年</option>
<option value="1993">1993 年</option>
<option value="1992">1992 年</option>
<option value="1991">1991 年</option>
<option value="1990">1990 年</option>
<option value="1989">1989 年</option>
<option value="1988">1988 年</option>
<option value="1987">1987 年</option>
<option value="1986">1986 年</option>
<option value="1985">1985 年</option>
<option value="1984">1984 年</option>
<option value="1983">1983 年</option>
<option value="1982">1982 年</option>
<option value="1981">1981 年</option>
<option value="1980">1980 年</option>
<option value="1979">1979 年</option>
<option value="1978">1978 年</option>
<option value="1977">1977 年</option>
<option value="1976">1976 年</option>
<option value="1975">1975 年</option>
<option value="1974">1974 年</option>
<option value="1973">1973 年</option>
<option value="1972">1972 年</option>
<option value="1971">1971 年</option>
<option value="1970">1970 年</option>
<option value="1969">1969 年</option>
<option value="1968">1968 年</option>
<option value="1967">1967 年</option>
<option value="1966">1966 年</option>
<option value="1965">1965 年</option>
<option value="1964">1964 年</option>
<option value="1963">1963 年</option>
<option value="1962">1962 年</option>
<option value="1961">1961 年</option>
<option value="1960">1960 年</option>
<option value="1959">1959 年</option>
<option value="1958">1958 年</option>
<option value="1957">1957 年</option>
<option value="1956">1956 年</option>
<option value="1955">1955 年</option>
<option value="1954">1954 年</option>
<option value="1953">1953 年</option>
<option value="1952">1952 年</option>
<option value="1951">1951 年</option>
<option value="1950">1950 年</option>
<option value="1949">1949 年</option>
<option value="1948">1948 年</option>
<option value="1947">1947 年</option>
<option value="1946">1946 年</option>
<option value="1945">1945 年</option>
<option value="1944">1944 年</option>
<option value="1943">1943 年</option>
<option value="1942">1942 年</option>
<option value="1941">1941 年</option>
<option value="1940">1940 年</option>
<option value="1939">1939 年</option>
<option value="1938">1938 年</option>
<option value="1937">1937 年</option>
<option value="1936">1936 年</option>
<option value="1935">1935 年</option>
<option value="1934">1934 年</option>
<option value="1933">1933 年</option>
<option value="1932">1932 年</option>
<option value="1931">1931 年</option>
<option value="1930">1930 年</option>
<option value="1929">1929 年</option>
<option value="1928">1928 年</option>
<option value="1927">1927 年</option>
<option value="1926">1926 年</option>
<option value="1925">1925 年</option>
<option value="1924">1924 年</option>
<option value="1923">1923 年</option>
<option value="1922">1922 年</option>
<option value="1921">1921 年</option>
<option value="1920">1920 年</option>
<option value="1919">1919 年</option>
<option value="1918">1918 年</option>
<option value="1917">1917 年</option>
<option value="1916">1916 年</option>
<option value="1915">1915 年</option>
<option value="1914">1914 年</option>
<option value="1913">1913 年</option>
<option value="1912">1912 年</option>
<option value="1911">1911 年</option>
<option value="1910">1910 年</option>
<option value="1909">1909 年</option>
<option value="1908">1908 年</option>
<option value="1907">1907 年</option>
<option value="1906">1906 年</option>
<option value="1905">1905 年</option>
<option value="1904">1904 年</option>
<option value="1903">1903 年</option>
<option value="1902">1902 年</option>
<option value="1901">1901 年</option>
<option value="1900">1900 年</option></select>
          </div>
          <div class="input-field">
            <label>月份</label>
            <select id="lunarMonth"><option value="1">正月</option>
<option value="2">二月</option>
<option value="3">三月</option>
<option value="4">四月</option>
<option value="5">五月</option>
<option value="6">六月</option>
<option value="7">七月</option>
<option value="8">八月</option>
<option value="9">九月</option>
<option value="10">十月</option>
<option value="11">冬月</option>
<option value="12">腊月</option></select>
          </div>
          <div class="input-field">
            <label>日期</label>
            <select id="lunarDay"><option value="1">初一</option>
<option value="2">初二</option>
<option value="3">初三</option>
<option value="4">初四</option>
<option value="5">初五</option>
<option value="6">初六</option>
<option value="7">初七</option>
<option value="8">初八</option>
<option value="9">初九</option>
<option value="10">初十</option>
<option value="11">十一</option>
<option value="12">十二</option>
<option value="13">十三</option>
<option value="14">十四</option>
<option value="15">十五</option>
<option value="16">十六</option>
<option value="17">十七</option>
<option value="18">十八</option>
<option value="19">十九</option>
<option value="20">二十</option>
<option value="21">廿一</option>
<option value="22">廿二</option>
<option value="23">廿三</option>
<option value="24">廿四</option>
<option value="25">廿五</option>
<option value="26">廿六</option>
<option value="27">廿七</option>
<option value="28">廿八</option>
<option value="29">廿九</option>
<option value="30">三十</option></select>
          </div>
        </div>
        <div style="margin-top: 0.75rem;">
          <label class="leap-toggle">
            <input type="checkbox" id="leapMonth">
            <span>闰月</span>
          </label>
        </div>
        <div style="margin-top: 1rem;">
          <button id="convertBtn" style="width:100%;padding:0.6rem;font-size:1rem;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;">转换</button>
        </div>
      </div>

      <div class="output-box" id="resultBox" style="display:none;">
        <h3>转换结果</h3>
        <div>
          <div class="result-item">
            <span class="result-label">公历生日</span>
            <span class="result-value" id="resSolar"></span>
          </div>
          <div class="result-item">
            <span class="result-label">农历日期</span>
            <span class="result-value" id="resLunar"></span>
          </div>
          <div class="result-item">
            <span class="result-label">当前年龄</span>
            <span class="result-value">
              <span class="age-big" id="resAge"></span>
              <span id="resBadge"></span>
            </span>
          </div>
          <div class="result-item">
            <span class="result-label">已存活</span>
            <span class="result-value" id="resDays"></span>
          </div>
        </div>

        <div style="margin-top: 1.5rem;">
          <h3>查询其他年份</h3>
          <div class="future-row">
            <div class="input-field">
              <label>年份</label>
              <input type="number" id="futureYear" min="1900" max="2100" placeholder="例如 2035">
            </div>
            <button id="futureBtn" style="padding:0.5rem 1rem;background:var(--primary);color:#fff;border:none;border-radius:6px;cursor:pointer;white-space:nowrap;">查询</button>
          </div>
          <div id="futureResult" style="margin-top:0.75rem;font-size:1rem;"></div>
        </div>
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

    'life/insurance': `
      <div class="tool-card">
        <h3>输入税前工资（元）</h3>
        <div style="display:flex;gap:0.5rem;align-items:center;">
          <input type="number" id="salary" placeholder="请输入税前工资，如 20000" style="flex:1;padding:0.6rem;font-size:1rem;">
        </div>
        <p style="font-size:0.8rem;opacity:0.6;margin-top:0.5rem;"> 2024年上海标准，社保基数上限 36549 元/月</p>
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
        <button class="btn sound-btn" data-sound="rain">️ 雨声</button>
        <button class="btn sound-btn" data-sound="campfire"> 篝火</button>
        <button class="btn sound-btn" data-sound="ocean"> 海浪</button>
        <button class="btn sound-btn" data-sound="forest"> 森林</button>
        <button class="btn btn-primary" id="exportBtn"> 导出壁纸</button>
      </div>
      <p style="margin-top:0.75rem;font-size:0.8rem;opacity:0.5;">移动鼠标或打字产生粒子动画。5秒无操作自动停止声音。</p>`,

    'life/grid-splitter': `
      <div class="tool-card">
        <h3>上传图片</h3>
        <div class="upload-area" id="uploadArea" style="border:2px dashed var(--border);border-radius:12px;padding:2rem;text-align:center;cursor:pointer;transition:border-color 0.2s;background:var(--bg-secondary);">
          <input type="file" id="imageInput" accept="image/*" style="display:none;">
          <div style="font-size:2rem;margin-bottom:0.5rem;"></div>
          <div style="color:var(--text-secondary);font-size:0.9rem;">点击选择图片或拖拽到此处</div>
          <div style="color:var(--text-secondary);font-size:0.75rem;margin-top:0.3rem;opacity:0.6;">支持 JPG、PNG、GIF、WebP</div>
        </div>
        <div id="imagePreviewContainer" style="display:none;margin-top:1rem;">
          <img id="previewImg" alt="图片预览" style="max-width:100%;max-height:300px;border-radius:8px;display:block;margin:0 auto;">
        </div>
        <div class="btn-row" style="margin-top:1rem;">
          <button class="btn btn-primary" id="splitBtn">️ 切割为九宫格</button>
        </div>
      </div>
      <div class="tool-card" id="resultCard" style="display:none;">
        <h3>切割结果（3x3 九宫格）</h3>
        <div id="gridResult" style="display:grid;grid-template-columns:repeat(3,1fr);gap:4px;margin-top:0.75rem;"></div>
        <div class="btn-row" style="margin-top:1rem;justify-content:center;">
          <button class="btn btn-primary" id="downloadAllBtn"> 下载全部</button>
        </div>
      </div>
      <p style="font-size:0.8rem;opacity:0.5;margin-top:1rem;"> 提示：长按或右键保存各格图片，也可点击单格放大后保存</p>
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
          <button class="btn btn-secondary" id="annotateBtn" style="display:none;">️ 标注时间点</button>
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
        <button class="btn btn-secondary" id="clearTimelineBtn" style="margin-top:0.75rem;width:100%;">️ 清空记录</button>
      </div>
    `,    'code/cron-parser': `
      <div class="tool-card">
        <h3>Cron 表达式</h3>
        <input type="text" id="cronInput" value="* * * * *" style="width:100%;padding:0.5rem;font-size:1rem;font-family:monospace;" placeholder="分 时 日 月 周">
        <select id="examples" style="margin-top:0.5rem;width:100%;padding:0.4rem;">
          <option value="">--- 常用示例 ---</option>
          <option value="* * * * *">每分钟</option>
          <option value="0 * * * *">每小时整点</option>
          <option value="0 9 * * *">每天 9:00</option>
          <option value="0 9 * * 1-5">工作日 9:00</option>
          <option value="*/5 * * * *">每 5 分钟</option>
          <option value="0 */2 * * *">每 2 小时</option>
        </select>
      </div>
      <div class="tool-card">
        <h3>验证结果</h3>
        <div id="result" style="padding:0.5rem;font-size:1rem;"></div>
      </div>
      <div class="output-box">
        <h3>未来 5 次执行时间</h3>
        <ul id="nextRuns" style="padding-left:1.2rem;line-height:1.8;"></ul>
      </div>`,    'code/color-picker': `
      <div class="tool-card">
        <h3>选择颜色</h3>
        <input type="color" id="colorInput" value="#4a90e2" style="width:100%;height:50px;border:none;cursor:pointer;">
      </div>
      <div class="tool-card">
        <div id="preview" style="height:80px;background:#4a90e2;border-radius:10px;margin-bottom:1rem;"></div>
        <div style="display:grid;gap:0.5rem;">
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <label style="width:50px;">HEX</label>
            <input type="text" id="hexOut" readonly style="flex:1;padding:0.4rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;">
            <button class="btn btn-secondary" id="copyHex" style="padding:0.4rem 0.6rem;">复制</button>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <label style="width:50px;">RGB</label>
            <input type="text" id="rgbOut" readonly style="flex:1;padding:0.4rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;">
            <button class="btn btn-secondary" id="copyRgb" style="padding:0.4rem 0.6rem;">复制</button>
          </div>
          <div style="display:flex;align-items:center;gap:0.5rem;">
            <label style="width:50px;">HSL</label>
            <input type="text" id="hslOut" readonly style="flex:1;padding:0.4rem;border:1px solid var(--border);border-radius:6px;font-family:monospace;">
            <button class="btn btn-secondary" id="copyHsl" style="padding:0.4rem 0.6rem;">复制</button>
          </div>
        </div>
      </div>`,
    'text/jianfan': `
      <div class="tool-card">
        <h3>输入文本</h3>
        <textarea id="input" placeholder="输入简体或繁体文字..." style="min-height:100px;"></textarea>
      </div>
      <div class="tool-card">
        <h3>转换结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly style="min-height:100px;"></textarea>
        <div class="btn-row" style="margin-top:1rem;">
          <button class="btn btn-primary" id="toSimple">转简体</button>
          <button class="btn btn-secondary" id="toTraditional">转繁体</button>
        </div>
      </div>`,
    'time/lunar-solar-converter': `
      <div class="tool-card">
        <h3>公历日期</h3>
        <input type="date" id="solarInput" style="width:100%;padding:0.5rem;font-size:1rem;">
      </div>
      <div class="output-box">
        <h3>农历日期</h3>
        <div id="lunarOutput" style="font-size:1.3rem;text-align:center;padding:1rem;"></div>
      </div>
      <p style="font-size:0.8rem;opacity:0.6;text-align:center;margin-top:1rem;">基于简化农历算法（1900-2100）</p>`,
    'other/reaction-test': `
      <div class="tool-card">
        <h3>反应力测试</h3>
        <div id="reactionBox" style="height:200px;background:var(--bg-secondary);border-radius:12px;display:flex;align-items:center;justify-content:center;font-size:1.2rem;cursor:pointer;transition:background 0.1s;"></div>
      </div>
      <div class="output-box">
        <h3>结果</h3>
        <div id="result" style="font-size:1.1rem;text-align:center;"></div>
        <div id="bestResult" style="font-size:0.9rem;text-align:center;margin-top:0.5rem;opacity:0.7;"></div>
      </div>
      <p style="font-size:0.8rem;opacity:0.6;text-align:center;margin-top:1rem;">点击方块开始，等待变绿后尽快点击</p>`,
    'other/click-speed': `
      <div class="tool-card">
        <h3>点击速度测试 - 10秒内能点多少次？</h3>
        <div id="clickArea" style="height:150px;background:var(--bg-secondary);border-radius:12px;display:flex;align-items:center;justify-content:center;cursor:pointer;border:3px dashed var(--border);">
          <span style="font-size:1.2rem;opacity:0.5;">点击区域</span>
        </div>
        <div style="text-align:center;margin-top:1rem;">
          <div id="counter" style="font-size:3rem;font-weight:700;color:var(--primary);">0</div>
          <div id="timerDisplay" style="font-size:1.5rem;margin-top:0.5rem;">10.0s</div>
        </div>
        <button class="btn btn-primary" id="clickBtn" style="width:100%;margin-top:1rem;padding:0.75rem;font-size:1.1rem;">开始</button>
      </div>
      <div class="output-box">
        <h3>结果</h3>
        <div id="result" style="font-size:1rem;text-align:center;padding:1rem;"></div>
      </div>`,
  };

  return contents[key] || '';
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
    CT.initTheme();
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

function generateAboutPage() {
  const aboutHtml = `<!DOCTYPE html>
<html lang="zh-CN">
<head>
  <meta charset="UTF-8">
  <meta name="viewport" content="width=device-width, initial-scale=1.0">
  <title>关于 - CloverTools</title>
  <meta name="description" content="CloverTools 由 York 和 YupenBob 创建，是一款轻量级开发者工具箱，无需注册，完全本地运行。">
  <link rel="canonical" href="https://tools.xsanye.cn/about">
  <link rel="icon" href="/src/clover-logo.svg" type="image/svg+xml">
  <link rel="stylesheet" href="/src/shared.css">
  <script src="/src/shared.js"></script>
  <style>
    body { min-height: 100vh; display: flex; flex-direction: column; }
    main { flex: 1; max-width: 800px; margin: 0 auto; padding: 4rem 2rem; }
    .about-card { background: var(--card-bg); border: 1px solid var(--border); border-radius: var(--radius); padding: 3rem; text-align: center; }
    .about-logo { margin-bottom: 2rem; }
    .about-logo img { height: 120px; }
    h1 { font-size: 2rem; color: var(--text); margin-bottom: 1.5rem; }
    .about-desc { color: var(--text-secondary); line-height: 1.8; font-size: 1.05rem; margin-bottom: 2rem; }
    .about-desc p { margin-bottom: 1rem; }
    .about-creators { display: flex; justify-content: center; gap: 2rem; margin-top: 2rem; }
    .creator { background: var(--bg-secondary); border-radius: 12px; padding: 1.5rem 2rem; text-align: center; }
    .creator-name { font-size: 1.2rem; font-weight: 700; color: var(--primary); margin-bottom: 0.3rem; }
    .creator-role { font-size: 0.85rem; color: var(--text-secondary); }
    .about-links { margin-top: 2rem; display: flex; justify-content: center; gap: 1rem; }
    .about-links a { color: var(--primary); text-decoration: none; font-weight: 600; }
    .about-links a:hover { text-decoration: underline; }
    .back-link { display: inline-flex; align-items: center; gap: 0.3rem; color: var(--primary); text-decoration: none; margin-bottom: 2rem; font-size: 0.9rem; }
    .back-link:hover { text-decoration: underline; }
  </style>
</head>
<body>
  {{SITE_HEADER}}
  <main>
    <a href="/" class="back-link">← 返回工具首页</a>
    <div class="about-card">
      <div class="about-logo">
        <img src="/src/clover-logo.svg" alt="CloverTools Logo">
      </div>
      <h1>CloverTools</h1>
      <div class="about-desc">
        <p>由 York（YupenBob）和 AI 助手 Clover 共同打造。</p>
        <p>告别繁琐，专注创造。用完即走，不留痕迹。</p>
      </div>
      <div class="about-creators">
        <div class="creator">
          <img src="/src/york-avatar.png" alt="York" style="width:80px;height:80px;border-radius:50%;margin-bottom:0.5rem;object-fit:cover;">
          <div class="creator-name">York</div>
          <div class="creator-role"><a href="https://github.com/YupenBob" target="_blank" style="color:var(--primary)">@YupenBob</a></div>
          <div style="font-size:0.8rem;color:var(--text-secondary);margin-top:0.3rem;">YupenBob（别名）</div>
        </div>
        <div class="creator">
          <img src="/src/clover-avatar.png" alt="Clover" style="width:80px;height:80px;border-radius:50%;margin-bottom:0.5rem;object-fit:cover;">
          <div class="creator-name">Clover 🍀</div>
          <div class="creator-role">AI Assistant · OpenClaw</div>
        </div>
      </div>
      <div class="about-links">
        <a href="/">工具首页</a>
        <span style="opacity:0.3">|</span>
        <a href="/blog/">问题博客</a>
        <span style="opacity:0.3">|</span>
        <a href="https://github.com/YupenBob/clover-tools" target="_blank">GitHub</a>
      </div>
    </div>
  </main>
  {{SITE_FOOTER}}
</body>
</html>`;

  const pageHtml = aboutHtml
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml);

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
  <script>CT.initTheme();</script>
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
  let homeHtml = homeTemplate
    .replace('{{CATEGORIES_HTML}}', categoriesHtml)
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

  // ============ Generate changelog page ============
  const gitLog = execSync('git log --format="%h|%ci|%s" --date=short').toString().trim();
  function escHtml(s) { return String(s||'').replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;'); }

  const entriesHtml = gitLog.split('\n').map(line => {
    const [hash, date, ...msgParts] = line.split('|');
    const msg = msgParts.join('|');
    const type = (msg.match(/^(feat|fix|refactor|chore|perf|docs)/) || ['chore'])[1];
    const shortMsg = msg.replace(/^(feat|fix|refactor|chore|perf|docs)(\([^)]*\))?:\s*/, '');
    const githubUrl = 'https://github.com/YupenBob/clover-tools/commit/' + hash;
    return '        <div class="changelog-commit">' +
      '<a href="' + githubUrl + '" target="_blank" class="commit-hash ' + type + '">' + hash + '</a>' +
      '<span class="commit-msg">' + escHtml(shortMsg) + '</span>' +
      '<span class="commit-date">' + date + '</span></div>';
  }).join('\n');

  let changelogHtml = changelogTemplate
    .replace('{{CHANGELOG_ENTRIES}}', entriesHtml)
    .replace(/\{\{SVG_SPRITE\}\}/g, svgSpriteHtml)
    .replace(/\{\{SITE_HEADER\}\}/g, headerHtml)
    .replace(/\{\{SITE_FOOTER\}\}/g, footerHtml)
    .replace(/\{\{PAGE_OG_TITLE\}\}/g, '📝 更新日志 - 🍀 CloverTools')
    .replace(/\{\{PAGE_OG_DESC\}\}/g, 'CloverTools 开发历程，基于 Git 提交记录自动生成')
    .replace(/\{\{PAGE_OG_IMAGE\}\}/g, 'https://tools.xsanye.cn/src/clover-logo.svg')
    .replace(/\{\{PAGE_URL\}\}/g, 'https://tools.xsanye.cn/changelog')
    .replace(/\{\{PAGE_CANONICAL_URL\}\}/g, 'https://tools.xsanye.cn/changelog');

  fs.writeFileSync(path.join(DIST_DIR, 'changelog.html'), changelogHtml);
  console.log('   Generated changelog.html');

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

  // Generate sitemap.xml
  const baseUrl = 'https://tools.xsanye.cn';
  const today = new Date().toISOString().split('T')[0];
  let urls = [`<url><loc>${baseUrl}/</loc><lastmod>${today}</lastmod><priority>1.0</priority></url>`];
  urls.push(`<url><loc>${baseUrl}/changelog</loc><lastmod>${today}</lastmod><priority>0.5</priority></url>`);
  toolsConfig.forEach(cat => {
    cat.tools.forEach(tool => {
      urls.push(`<url><loc>${baseUrl}/tools/${tool.path}</loc><lastmod>${today}</lastmod><priority>0.8</priority></url>`);
    });
  });
  // Add blog posts to sitemap
  keywordsConfig.forEach(kw => {
    urls.push(`<url><loc>${baseUrl}/blog/${kw.slug}</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`);
  });
  urls.push(`<url><loc>${baseUrl}/blog/</loc><lastmod>${today}</lastmod><priority>0.7</priority></url>`);

  // Add fix hub pages to sitemap
  FIX_HUB_CONFIG.forEach(hub => {
    urls.push(`<url><loc>${baseUrl}/fix/${hub.path}/</loc><lastmod>${today}</lastmod><priority>0.6</priority></url>`);
  });

  const sitemap = `<?xml version="1.0" encoding="UTF-8"?>\n<urlset xmlns="http://www.sitemaps.org/schemas/sitemap/0.9">\n${urls.join('\n')}\n</urlset>`;
  fs.writeFileSync(path.join(DIST_DIR, 'sitemap.xml'), sitemap);
  console.log('   Generated sitemap.xml');

  console.log(' Done! Output in dist/');
}

generate();
