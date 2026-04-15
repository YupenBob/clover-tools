#!/usr/bin/env python3
import re

generator_path = '/root/.openclaw/workspace/projects/clover-tools-v2/generator.js'

with open(generator_path, 'r') as f:
    content = f.read()

# ======== NEW HTML CONTENT TEMPLATES ========
new_html_entries = '''
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
        <input type="text" id="regexInput" placeholder="输入正则表达式，如：\\d+" style="width:100%;padding:0.75rem;border-radius:10px;border:1px solid var(--border);font-size:1rem;font-family:monospace;background:var(--bg-secondary);color:var(--text);margin-bottom:0.5rem;" />
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
'''

# ======== NEW SCRIPT TEMPLATES ========
new_script_entries = '''
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
        return [parseInt(full.substr(0, 2), 16), parseInt(full.substr(2, 2), 16), parseInt(full.substr(4, 2), 16)];
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
'''

# ======== Insert into scripts object (before "return scripts[key]") ========
scripts_marker = "\n  };\n\n  return scripts[key]"
if scripts_marker in content:
    content = content.replace(scripts_marker, "\n" + new_script_entries.strip() + "\n  };\n\n  return scripts[key]")
    print("scripts inserted OK")
else:
    print("scripts marker not found, trying alternate...")
    pattern = r"\n  \};\s*\n\s*return scripts\[key\]"
    if re.search(pattern, content):
        content = re.sub(pattern, "\n" + new_script_entries.strip() + "\n  };\n\n  return scripts[key]", content)
        print("scripts inserted (alternate)")
    else:
        print("ERROR: Could not find scripts insertion point")

# ======== Insert into contents object (before "return contents[key]") ========
contents_marker = "\n  };\n\n  return contents[key]"
if contents_marker in content:
    content = content.replace(contents_marker, "\n" + new_html_entries.strip() + "\n  };\n\n  return contents[key]")
    print("contents inserted OK")
else:
    print("contents marker not found, trying alternate...")
    pattern = r"\n  \};\s*\n\s*return contents\[key\]"
    if re.search(pattern, content):
        content = re.sub(pattern, "\n" + new_html_entries.strip() + "\n  };\n\n  return contents[key]", content)
        print("contents inserted (alternate)")
    else:
        print("ERROR: Could not find contents insertion point")

with open(generator_path, 'w') as f:
    f.write(content)

print("Done")
