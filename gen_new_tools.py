#!/usr/bin/env python3
"""Patch generator.js with 8 new tools. Uses precise string replacement."""

import json

NEW_TOOLS = [
    {"name": "CSS 单位换算", "path": "code/css-unit.html", "desc": "在 px、em、rem、vw、vh 等 CSS 单位之间互转",
     "keywords": ["CSS单位换算","px转rem","em转px","CSS转换","前端工具","vw vh 转换","px em 互转","CSS unit converter","rem to px","responsive units"]},
    {"name": "斐波那契数列", "path": "math/fibonacci.html", "desc": "生成斐波那契数列，指定项数或上限值",
     "keywords": ["斐波那契数列","Fibonacci","黄金分割","数列生成","兔子问题","fibonacci sequence","golden ratio","math sequence"]},
    {"name": "罗马数字互转", "path": "math/roman-numeral.html", "desc": "阿拉伯数字与罗马数字互相转换",
     "keywords": ["罗马数字","Roman numeral","数字转换","古罗马数字","I II III","IV V VI","roman numerals converter","latin numbers"]},
    {"name": "完美数判定", "path": "math/perfect-number.html", "desc": "判断一个数是否为完美数（所有真因子之和等于它本身）",
     "keywords": ["完美数","完全数","Perfect number","水仙花数","完数","因子之和","欧几里得","数学判定","6 28 496"]},
    {"name": "二维码生成", "path": "encrypt/qrcode.html", "desc": "输入文本或链接，生成可扫描的 QR 二维码",
     "keywords": ["二维码生成","QR码","qrcode","二维码制作","扫码","qr code generator","matrix barcode","链接转二维码"]},
    {"name": "摩斯密码", "path": "encrypt/morse.html", "desc": "摩斯密码编码与解码，支持文字与摩斯码互转",
     "keywords": ["摩斯密码","Morse code","电报码","摩尔斯电码","点划线","morse encoder","morse decoder","摩斯编码","SOS"]},
    {"name": "BMI 计算器", "path": "life/bmi.html", "desc": "身体质量指数计算，评估体重是否健康",
     "keywords": ["BMI计算器","身体质量指数","体质指数","体重指数","BMI calculator","BMI值","健康指数","bmi check","BMI中文"]},
    {"name": "cURL 命令生成器", "path": "network/curl-gen.html", "desc": "输入 URL 和参数，生成可复制的 cURL 命令",
     "keywords": ["curl命令","curl generator","HTTP请求","API测试","命令行工具","网络请求","curl cmd","bash curl","HTTP headers"]},
]

HTML_TEMPLATES = {
    'code/css-unit': """<div class="tool-card">
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
      </div>""",

    'math/fibonacci': """<div class="tool-card">
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
      </div>""",

    'math/roman-numeral': """<div class="tool-card">
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
      </div>""",

    'math/perfect-number': """<div class="tool-card">
        <h3>输入数字</h3>
        <input type="number" id="inputNum" placeholder="输入正整数，如 28" min="1" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
        <button class="btn btn-primary" id="checkBtn" style="width:100%;">检查是否为完美数</button>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <div id="output" style="padding:1rem;font-size:1.1rem;font-weight:600;"></div>
        <div id="factors" style="padding:0.75rem;font-size:0.85rem;color:var(--text-secondary);margin-top:0.5rem;"></div>
      </div>""",

    'encrypt/qrcode': """<div class="tool-card">
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
      </div>""",

    'encrypt/morse': """<div class="tool-card">
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
      </div>""",

    'life/bmi': """<div class="tool-card">
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
      </div>""",

    'network/curl-gen': """<div class="tool-card">
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
      </div>""",
}

SCRIPT_TEMPLATES = {
    'code/css-unit': """
      const inputNum = document.getElementById('inputNum');
      const fromUnit = document.getElementById('fromUnit');
      const output = document.getElementById('output');
      const TO_PX = { px: 1, em: 16, rem: 16, vw: 192, vh: 108, pt: 96/72, in: 96, cm: 37.8, mm: 3.78 };
      const FROM_PX = { px: 1, em: 1/16, rem: 1/16, vw: 1/192, vh: 1/108, pt: 72/96, in: 1/96, cm: 1/37.8, mm: 1/3.78 };
      function calc() {
        const val = parseFloat(inputNum.value);
        const from = fromUnit.value;
        if (isNaN(val)) { output.textContent = '请输入有效数值'; return; }
        const px = val * TO_PX[from];
        const results = Object.keys(FROM_PX).map(u => u + ': ' + (px * FROM_PX[u]).toFixed(4)).join('\\n');
        output.textContent = results;
      }
      document.getElementById('calcBtn').addEventListener('click', calc);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    """,

    'math/fibonacci': """
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
    """,

    'math/roman-numeral': """
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
    """,

    'math/perfect-number': """
      const inputNum = document.getElementById('inputNum');
      const output = document.getElementById('output');
      const factors = document.getElementById('factors');
      function check() {
        const v = parseInt(inputNum.value);
        if (isNaN(v) || v < 1) { output.textContent = '请输入正整数'; output.style.color = 'var(--text)'; factors.textContent = ''; return; }
        const divs = [];
        for (let i = 1; i <= Math.floor(v/2); i++) if (v % i === 0) divs.push(i);
        const perfect = divs.reduce((a,b) => a+b, 0) === v;
        output.textContent = perfect ? '是完美数 \\u2713' : '不是完美数 \\u2717';
        output.style.color = perfect ? '#22c55e' : '#ef4444';
        factors.textContent = '因子: ' + divs.join(', ');
      }
      inputNum.addEventListener('input', check);
      document.getElementById('checkBtn').addEventListener('click', check);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    """,

    'encrypt/qrcode': """
      const inputText = document.getElementById('inputText');
      const qrcodeDiv = document.getElementById('qrcode');
      function genQR(text) {
        if (!text) { qrcodeDiv.innerHTML = ''; return; }
        qrcodeDiv.innerHTML = '<img src="https://api.qrserver.com/v1/create-qr-code/?size=200x200&data=' + encodeURIComponent(text) + '" style="display:block;margin:0 auto;" alt="QR Code" />';
      }
      document.getElementById('genBtn').addEventListener('click', () => genQR(inputText.value));
      document.getElementById('clearBtn').addEventListener('click', () => { inputText.value = ''; qrcodeDiv.innerHTML = ''; });
      document.getElementById('copyOutput').addEventListener('click', () => { const img = qrcodeDiv.querySelector('img'); if (img) copyToClipboard(img.src); });
    """,

    'encrypt/morse': """
      const inputText = document.getElementById('inputText');
      const output = document.getElementById('output');
      const MAP = {A:'.--',B:'-...',C:'-.-.',D:'-..',E:'.',F:'..-.',G:'--.',H:'....',I:'..',J:'.---',K:'-.-',L:'.-..',M:'--',N:'-.',O:'---',P:'.--.',Q:'--.-',R:'.-.',S:'...',T:'-',U:'..-',V:'...-',W:'.--',X:'-..-',Y:'-.--',Z:'--..',0:'-----',1:'.----',2:'..---',3:'...--',4:'....-',5:'.....',6:'-....',7:'--...',8:'---..',9:'----.'};
      function encode(text) { return text.toUpperCase().split('').map(c => MAP[c] || '').filter(Boolean).join(' '); }
      function decode(morse) { const rev = {}; Object.entries(MAP).forEach(([k,v]) => rev[v] = k); return morse.split(' ').map(m => rev[m] || '').join(''); }
      function isMorse(s) { return /^[.\\-\\s]+$/.test(s.trim()); }
      function run() { const v = inputText.value; if (!v) { output.textContent = ''; return; } output.textContent = isMorse(v.trim()) ? decode(v.trim()) : encode(v); }
      document.getElementById('encodeBtn').addEventListener('click', () => { if (!isMorse(inputText.value.trim())) run(); });
      document.getElementById('decodeBtn').addEventListener('click', () => { if (isMorse(inputText.value.trim())) run(); });
      inputText.addEventListener('input', run);
      document.getElementById('copyOutput').addEventListener('click', () => copyToClipboard(output.textContent));
    """,

    'life/bmi': """
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
    """,

    'network/curl-gen': """
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
    """,
}

# ===================== tools.json =====================
tools_path = '/root/.openclaw/workspace/projects/clover-tools-v2/tools.json'
with open(tools_path, 'r', encoding='utf-8') as f:
    tools_config = json.load(f)

cat_map = {"开发工具": [], "数学计算": [], "编码/加密": [], "生活实用": [], "时间工具": []}
for t in NEW_TOOLS:
    p = t['path']
    if p.startswith('code/'): cat_map["开发工具"].append(t)
    elif p.startswith('math/'): cat_map["数学计算"].append(t)
    elif p.startswith('encrypt/'): cat_map["编码/加密"].append(t)
    elif p.startswith('life/'): cat_map["生活实用"].append(t)
    elif p.startswith('network/'): cat_map["时间工具"].append(t)

for cat in tools_config:
    cn = cat['category']
    if cn in cat_map and cat_map[cn]:
        cat['tools'].extend(cat_map[cn])

with open(tools_path, 'w', encoding='utf-8') as f:
    json.dump(tools_config, f, ensure_ascii=False, indent=2)
print("tools.json updated")

# ===================== generator.js =====================
gen_path = '/root/.openclaw/workspace/projects/clover-tools-v2/generator.js'
with open(gen_path, 'r', encoding='utf-8') as f:
    content = f.read()

# Build script block - each entry is a separate line
script_lines = []
for k, v in SCRIPT_TEMPLATES.items():
    script_lines.append("    '%s': `%s`," % (k, v))
script_block = "\n".join(script_lines)

# Build HTML block - each entry is a separate line
html_lines = []
for k, v in HTML_TEMPLATES.items():
    html_lines.append("    '%s': `%s`," % (k, v))
html_block = "\n".join(html_lines)

# SCRIPTS: Find the unique marker that ends the scripts object contents
# Pattern: after the last entry's backtick, we have: `,\n  };\n\n  return scripts[key] ||
# We replace the `,\n  };\n\n  return scripts[key] || with our entries, then the closing
old_scripts_end = "    `,\n  };\n\n  return scripts[key] || `// TODO: implement ${tool.path}`;"
if old_scripts_end in content:
    new_scripts_end = "    `,\n" + script_block + "\n  };\n\n  return scripts[key] || `// TODO: implement ${tool.path}`;"
    content = content.replace(old_scripts_end, new_scripts_end)
    print("Scripts inserted OK")
else:
    print("ERROR: Could not find scripts end marker")
    print("Trying to find partial marker...")
    if "    `,\n  };\n" in content:
        print("Found partial marker")
    else:
        print("Partial marker not found either")

# HTML: Find the unique marker that ends the contents object contents
old_contents_end = "    `,\n  };\n\n  return contents[key] || '';"
if old_contents_end in content:
    new_contents_end = "    `,\n" + html_block + "\n  };\n\n  return contents[key] || '';"
    content = content.replace(old_contents_end, new_contents_end)
    print("HTML inserted OK")
else:
    print("ERROR: Could not find contents end marker")

with open(gen_path, 'w', encoding='utf-8') as f:
    f.write(content)

print("generator.js patched")
print("Tools:", list(HTML_TEMPLATES.keys()))
