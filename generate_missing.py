#!/usr/bin/env python3
"""Generate standalone HTML files for all tools listed in tools.json."""

import os
import re
import json
from pathlib import Path

BASE = Path('/home/yock/clover-tools-v2')
SRC_TOOLS = BASE / 'dist' / 'tools'
os.makedirs(SRC_TOOLS, exist_ok=True)

# Load tools.json
with open(BASE / 'tools.json') as f:
    tools_data = json.load(f)

# Load generator.js to find already-implemented tools
with open(BASE / 'generator.js') as f:
    gen_content = f.read()

# Find which tool keys are already in buildToolScript
# Pattern: 'tool/path': `...`
buildscripts = re.search(
    r'function buildToolScript\(tool\) \{([\s\S]*?)^\}',
    gen_content, re.MULTILINE
)
existing_script_keys = set()
if buildscripts:
    body = buildscripts.group(1)
    existing_script_keys = set(re.findall(r"'([^']+)':", body))

buildcontents = re.search(
    r'function buildToolContentHtml\(tool\) \{([\s\S]*?)^\}',
    gen_content, re.MULTILINE
)
existing_content_keys = set()
if buildcontents:
    body = buildcontents.group(1)
    existing_content_keys = set(re.findall(r"'([^']+)':", body))

print(f"Already implemented scripts: {len(existing_script_keys)}")
print(f"Already implemented contents: {len(existing_content_keys)}")

# Load component templates
with open(BASE / 'templates' / 'components' / 'svg-sprite.html') as f:
    SVG_SPRITE = f.read().strip()

with open(BASE / 'templates' / 'components' / 'header.html') as f:
    HEADER_HTML = f.read().strip()
    # The header.html includes FOOTER_SHARE_BTN placeholder - keep it for tool pages
    HEADER_FOR_TOOL = HEADER_HTML

with open(BASE / 'templates' / 'components' / 'footer.html') as f:
    FOOTER_HTML = f.read().strip()
    FOOTER_FOR_TOOL = FOOTER_HTML.replace(
        '<!-- FOOTER_SHARE_BTN will be replaced by generator.js for tool pages -->',
        '<button class="share-btn" id="shareBtn" style="background:var(--primary);color:#fff;border:none;padding:0.5rem 1rem;border-radius:8px;cursor:pointer;font-size:0.9rem;">📋 分享工具</button>'
    )

SHARE_BTN_SCRIPT = r'''document.getElementById("shareBtn").onclick = function() { navigator.clipboard.writeText(window.location.href).then(function() { CT.showToast("\u94fe\u63a5\u5df2\u590d\u5236\uff01"); }).catch(function() { CT.showToast("\u590d\u5236\u5931\u8d25"); }); };'''

# =============================================================================
# TOOL IMPLEMENTATIONS
# Each tool has: html (content HTML) and script (JS code)
# =============================================================================

TOOL_DEFS = {

    # ---- JSON 工具 ----
    'json/validator': {
        'html': '''
      <div class="tool-card">
        <h3>输入 JSON</h3>
        <textarea id="input" placeholder="粘贴 JSON 数据..."></textarea>
      </div>
      <div class="output-box">
        <h3>结果 <button class="copy-btn" id="copyOutput">复制</button></h3>
        <textarea id="output" readonly></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function validate() {
        const val = input.value.trim();
        if (!val) { output.value = ''; return; }
        try {
          const parsed = JSON.parse(val);
          output.value = '\\u2705 JSON \\u683c\\u5f0f\\u6b63\\u786e\\n\\n\\u89e3\\u6790\\u7ed3\\u679c\\uff1a\n' + JSON.stringify(parsed, null, 2);
        } catch(e) {
          const msg = e.message;
          const pos = msg.match(/position (\\d+)/);
          if (pos) {
            const p = parseInt(pos[1]);
            const lines = val.split('\\n');
            let lineNo = 1, col = p;
            for (const l of lines) {
              if (col <= l.length) break;
              col -= l.length + 1;
              lineNo++;
            }
            output.value = '\\u274c JSON \\u9519\\u8bef\\uff1a' + msg + '\\n\\u4f4d\\u7f6e\\uff1a\\u7b2c ' + lineNo + ' \\u884c\\uff0c\\u7b2c ' + col + ' \\u5217';
          } else {
            output.value = '\\u274c JSON \\u9519\\u8bef\\uff1a' + msg;
          }
        }
      }
      input.addEventListener('input', validate);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      validate();
    '''
    },

    'json/to-csv': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON \\u6570\\u7ec4\\uff0c\\u5982 [{\\"name\\":\\"\\u5f20\\u4e09\\",\\"age\\":30}]" style="min-height:120px;font-family:monospace;"></textarea>
        <div class="btn-row" style="margin-top:0.5rem;">
          <button class="btn btn-primary" id="toCsv">JSON \\u2192 CSV</button>
          <button class="btn btn-secondary" id="fromCsv">CSV \\u2192 JSON</button>
        </div>
      </div>
      <div class="output-box">
        <h3>\\u8f93\\u51fa <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toCsv() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const data = JSON.parse(val);
          const arr = Array.isArray(data) ? data : [data];
          if (arr.length === 0) { output.value = ''; return; }
          const headers = [...new Set(arr.flatMap(o => Object.keys(o)))];
          const csv = [headers.join(','),
            ...arr.map(row => headers.map(h => {
              const v = row[h] === undefined || row[h] === null ? '' : String(row[h]);
              return v.includes(',') || v.includes('"') || v.includes('\\n') ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(','))
          ].join('\\n');
          output.value = csv;
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      function fromCsv() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const lines = val.split('\\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const arr = lines.slice(1).filter(l => l.trim()).map(line => {
            const vals = [];
            let inQuote = false, cur = '', i = 0;
            while (i < line.length) {
              const c = line[i];
              if (c === '"') {
                if (inQuote && line[i+1] === '"') { cur += '"'; i += 2; }
                else { inQuote = !inQuote; i++; }
              } else if (c === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; i++; }
              else { cur += c; i++; }
            }
            vals.push(cur.trim());
            const obj = {};
            headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
            return obj;
          });
          output.value = JSON.stringify(arr.length === 1 ? arr[0] : arr, null, 2);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', toCsv);
      document.getElementById('toCsv').onclick = toCsv;
      document.getElementById('fromCsv').onclick = fromCsv;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/to-toml': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON..." style="min-height:120px;font-family:monospace;"></textarea>
      </div>
      <div class="output-box">
        <h3>TOML \\u8f93\\u51fa <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toToml(obj, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) return pad + (typeof obj === 'string' ? '"' + obj + '"' : obj);
        if (Array.isArray(obj)) {
          return obj.map(v => {
            const s = toToml(v, indent + 1);
            return pad + '- ' + (typeof v === 'object' && v !== null ? '\\n' + s : s.trim());
          }).join('\\n');
        }
        return Object.entries(obj).map(([k,v]) => {
          if (typeof v !== 'object' || v === null) return pad + k + ' = ' + (typeof v === 'string' ? '"' + v + '"' : v);
          return pad + '[' + k + ']\\n' + toToml(v, indent + 1);
        }).join('\\n');
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          output.value = toToml(obj);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/to-ts': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON..." style="min-height:120px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>\\u7c7b\\u578b\\u540d\\u79f0: <input type="text" id="typeName" value="Root" style="padding:0.4rem;border-radius:8px;border:1px solid var(--border);"></label>
        </div>
      </div>
      <div class="output-box">
        <h3>TypeScript \\u8f93\\u51fa <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const typeNameInput = document.getElementById('typeName');
      function toTs(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) {
          const typeMap = { string: 'string', number: 'number', boolean: 'boolean' };
          return pad + (typeMap[typeof obj] || 'unknown');
        }
        if (Array.isArray(obj)) {
          if (obj.length === 0) return pad + 'unknown[]';
          const types = [...new Set(obj.map(item => toTs(item, '', indent + 1).trim()))];
          return pad + (types.length === 1 ? types[0] + '[]' : '(' + types.join(' | ') + ')[]');
        }
        const entries = Object.entries(obj);
        if (entries.length === 0) return pad + 'Record<string, unknown>';
        let result = 'interface ' + name + ' {\\n';
        for (const [k, v] of entries) {
          const optional = k.startsWith('_') ? '?' : '';
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : '\\'' + k + '\\'';
          result += pad + '  ' + safeKey + optional + ': ' + toTs(v, '', indent + 1).trim() + ';\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = typeNameInput.value || 'Root';
          output.value = 'export ' + toTs(obj, name);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', run);
      typeNameInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/to-go': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON..." style="min-height:120px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>\\u7c7b\\u578b\\u540d\\u79f0: <input type="text" id="typeName" value="Root" style="padding:0.4rem;border-radius:8px;border:1px solid var(--border);"></label>
        </div>
      </div>
      <div class="output-box">
        <h3>Go Struct \\u8f93\\u51fa <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const typeNameInput = document.getElementById('typeName');
      function toGo(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) {
          const typeMap = { string: 'string', number: 'float64', boolean: 'bool' };
          return pad + (typeMap[typeof obj] || 'interface{}');
        }
        if (Array.isArray(obj)) {
          if (obj.length === 0) return pad + '[]interface{}';
          const types = [...new Set(obj.map(item => toGo(item, '', indent + 1).trim()))];
          if (types.length === 1) return pad + '[]' + types[0].replace(/^\\*/, '');
          return pad + '[]interface{}';
        }
        let result = 'type ' + name + ' struct {\\n';
        for (const [k, v] of Object.entries(obj)) {
          const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : '\\'' + k + '\\'';
          const tag = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? ' `json:"' + k + '"`' : '';
          result += pad + '  ' + safeKey + ' ' + toGo(v, '', indent + 1).trim() + tag + '\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = typeNameInput.value || 'Root';
          output.value = 'package main\\n\\n' + toGo(obj, name);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', run);
      typeNameInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/to-rust': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON..." style="min-height:120px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>\\u7c7b\\u578b\\u540d\\u79f0: <input type="text" id="typeName" value="Root" style="padding:0.4rem;border-radius:8px;border:1px solid var(--border);"></label>
        </div>
      </div>
      <div class="output-box">
        <h3>Rust Struct \\u8f93\\u51fa <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      const typeNameInput = document.getElementById('typeName');
      function toRust(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) {
          const typeMap = { string: 'String', number: 'f64', boolean: 'bool' };
          return pad + (typeMap[typeof obj] || 'serde_json::Value');
        }
        if (Array.isArray(obj)) {
          if (obj.length === 0) return pad + 'Vec<serde_json::Value>';
          const types = [...new Set(obj.map(item => toRust(item, '', indent + 1).trim()))];
          if (types.length === 1) return pad + 'Vec<' + types[0].replace(/^\\*/, '') + '>';
          return pad + 'Vec<serde_json::Value>';
        }
        let result = '#[derive(Debug, Serialize, Deserialize)]\\n' + pad + 'pub struct ' + name + ' {\\n';
        for (const [k, v] of Object.entries(obj)) {
          const safeKey = /^[a-z_][a-z0-9_]*$/.test(k) ? k : k;
          result += pad + '  pub ' + safeKey + ': ' + toRust(v, '', indent + 1).trim() + ',\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = typeNameInput.value || 'Root';
          output.value = 'use serde::{Serialize, Deserialize};\\n\\n' + toRust(obj, name);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', run);
      typeNameInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/json-path': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u636e</h3>
        <textarea id="input" placeholder="\\u8f93\\u5165 JSON..." style="min-height:120px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>JSONPath \\u8def\\u5f84: <input type="text" id="pathInput" value="$." placeholder="$.store.book[0].title" style="padding:0.4rem;border-radius:8px;border:1px solid var(--border);width:60%;"></label>
        </div>
      </div>
      <div class="output-box">
        <h3>\\u67e5\\u8be2\\u7ed3\\u679c <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:120px;"></textarea>
      </div>''',
        'script': '''
      const input = document.getElementById('input');
      const pathInput = document.getElementById('pathInput');
      const output = document.getElementById('output');
      function jsonPath(obj, path) {
        if (!path.startsWith('$')) path = '$' + path;
        const tokens = path.split(/\\.(?![^\\[\\]]*\\])|(?<![^\\[\\]]*\\])\\[/).filter(Boolean);
        let current = [obj];
        for (const token of tokens) {
          if (token === '$') continue;
          const next = [];
          if (token === '*') { current.forEach(c => { if (Array.isArray(c)) next.push(...c); else if (typeof c === 'object' && c !== null) next.push(...Object.values(c)); }); }
          else if (/^\\d+$/.test(token)) { const idx = parseInt(token); current.forEach(c => { if (Array.isArray(c) && c[idx] !== undefined) next.push(c[idx]); }); }
          else if (token.startsWith('[') && token.endsWith(']')) {
            const indices = token.slice(1,-1).split(',').map(s => s.trim());
            indices.forEach(idx => {
              if (/^\\d+$/.test(idx)) current.forEach(c => { if (Array.isArray(c) && c[parseInt(idx)] !== undefined) next.push(c[parseInt(idx)]); });
            });
          } else {
            current.forEach(c => { if (c && typeof c === 'object' && token in c) next.push(c[token]); });
          }
          current = next;
        }
        return current;
      }
      function run() {
        try {
          const val = input.value.trim();
          const path = pathInput.value.trim() || '$.';
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const results = jsonPath(obj, path);
          output.value = JSON.stringify(results, null, 2);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input.addEventListener('input', run);
      pathInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/merge': {
        'html': '''
      <div class="tool-card">
        <h3>JSON 1</h3>
        <textarea id="input1" placeholder="\\u7b2c\\u4e00\\u4e2a JSON \\u5bf9\\u8c61..." style="min-height:100px;font-family:monospace;"></textarea>
      </div>
      <div class="tool-card">
        <h3>JSON 2</h3>
        <textarea id="input2" placeholder="\\u7b2c\\u4e8c\\u4e2a JSON \\u5bf9\\u8c61..." style="min-height:100px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label><input type="checkbox" id="deepMerge"> \\u6df1\\u5ea6\\u5408\\u5e76</label>
        </div>
      </div>
      <div class="output-box">
        <h3>\\u5408\\u5e76\\u7ed3\\u679c <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:100px;"></textarea>
      </div>''',
        'script': '''
      const input1 = document.getElementById('input1');
      const input2 = document.getElementById('input2');
      const output = document.getElementById('output');
      const deepCheck = document.getElementById('deepMerge');
      function merge(a, b, deep) {
        if (deep) {
          if (typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
            if (Array.isArray(a) !== Array.isArray(b)) return Array.isArray(b) ? b : a;
            if (Array.isArray(a)) return [...a, ...b];
            const result = { ...a };
            for (const key of Object.keys(b)) { result[key] = merge(a[key], b[key], true); }
            return result;
          }
          return b !== undefined ? b : a;
        }
        return { ...a, ...b };
      }
      function run() {
        try {
          const v1 = input1.value.trim();
          const v2 = input2.value.trim();
          if (!v1 && !v2) { output.value = ''; return; }
          const o1 = v1 ? JSON.parse(v1) : (Array.isArray(JSON.parse(v2||'{}')) ? [] : {});
          const o2 = v2 ? JSON.parse(v2) : {};
          const result = merge(o1, o2, deepCheck.checked);
          output.value = JSON.stringify(result, null, 2);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      input1.addEventListener('input', run);
      input2.addEventListener('input', run);
      deepCheck.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/generator': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6a21\\u677f</h3>
        <textarea id="template" placeholder="{\\"name\\":\\"{{name}}\\",\\"age\\":{{integer(18,80)}}}" style="min-height:100px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>\\u751f\\u6210\\u6570\\u91cf: <input type="number" id="count" value="1" min="1" max="100" style="padding:0.4rem;border-radius:8px;border:1px solid var(--border);width:80px;"></label>
          <span style="font-size:0.8rem;opacity:0.6;margin-left:0.5rem;">\\u652f\\u6301 {{name}} {{integer(1,100)}} {{float(0,100)}} {{boolean}} {{email}} {{date}} {{uuid}}</span>
        </div>
      </div>
      <div class="output-box">
        <h3>\\u751f\\u6210\\u7ed3\\u679c <button class="copy-btn" id="copyOutput">\\u590d\\u5236</button></h3>
        <textarea id="output" readonly style="font-family:monospace;min-height:100px;"></textarea>
      </div>''',
        'script': '''
      const templateInput = document.getElementById('template');
      const countInput = document.getElementById('count');
      const output = document.getElementById('output');
      function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
      function randFloat(min, max, dec) { return (Math.random() * (max - min) + min).toFixed(dec || 2); }
      function randStr(len) { return Array.from({length: len || randInt(5,12)}, () => String.fromCharCode(randInt(97,122))).join(''); }
      function randBool() { return Math.random() > 0.5; }
      const firstNames = ['\\u5f20','\\u674e','\\u738b','\\u5218','\\u9648','\\u6768','\\u8d75','\\u9ec4','\\u5468','\\u5434'];
      const lastNames = ['\\u4f1f','\\u82b3','\\u5a1c','\\u79c0\\u82f1','\\u654f','\\u9759','\\u4e3d','\\u5f3a','\\u7825','\\u519b'];
      const cities = ['\\u5317\\u4eac','\\u4e0a\\u6d77','\\u5e7f\\u5dde','\\u6df1\\u5733','\\u676d\\u5dde','\\u6210\\u90fd','\\u6b66\\u6c49','\\u897f\\u5b89'];
      function generate(template) {
        if (template === null || template === undefined) return null;
        if (typeof template === 'string') {
          if (template === '{{firstName}}') return firstNames[randInt(0, firstNames.length-1)];
          if (template === '{{lastName}}') return lastNames[randInt(0, lastNames.length-1)];
          if (template === '{{name}}') return firstNames[randInt(0, firstNames.length-1)] + lastNames[randInt(0, lastNames.length-1)];
          if (template === '{{city}}') return cities[randInt(0, cities.length-1)];
          if (template === '{{integer}}') return randInt(1, 1000);
          if (template === '{{float}}') return parseFloat(randFloat(0, 1000));
          if (template === '{{boolean}}') return randBool();
          if (template === '{{guid}}' || template === '{{uuid}}') return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r = Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); });
          if (template === '{{date}}') return new Date(Date.now() - randInt(0,365*3)*86400000).toISOString().split('T')[0];
          if (template === '{{email}}') return randStr(8) + '@example.com';
          if (template === '{{phone}}') return '1' + randInt(3,9) + Array.from({length:9}, () => randInt(0,9)).join('');
          if (template.startsWith('{{integer(')) { const m = template.match(/\\d+/g).map(Number); return randInt(m[0], m[1]); }
          if (template.startsWith('{{float(')) { const m = template.match(/[\\d.]+/g).map(Number); return parseFloat(randFloat(m[0], m[1], m[2]||2)); }
          if (template.startsWith('{{random(')) { const opts = template.match(/\\[(.*?)\\]/)[1].split(','); return opts[randInt(0,opts.length-1)].trim(); }
          return template;
        }
        if (Array.isArray(template)) return template.map(item => generate(item));
        if (typeof template === 'object') {
          const result = {};
          for (const key of Object.keys(template)) result[key] = generate(template[key]);
          return result;
        }
        return template;
      }
      function run() {
        try {
          const tpl = templateInput.value.trim();
          if (!tpl) { output.value = ''; return; }
          const count = parseInt(countInput.value) || 1;
          const template = JSON.parse(tpl);
          const results = [];
          for (let i = 0; i < Math.min(count, 100); i++) results.push(generate(template));
          output.value = JSON.stringify(count === 1 ? results[0] : results, null, 2);
        } catch(e) { output.value = '\\u9519\\u8bef: ' + e.message; }
      }
      templateInput.addEventListener('input', run);
      countInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    '''
    },

    'json/sort': {
        'html': '''
      <div class="tool-card">
        <h3>JSON \\u6570\\u7ec4</h3>
        <textarea id="input" placeholder="[{\\"name\\":\\"\\u5f20\\u4e09\\",\\"age\\":28}]" style="min-height:100px;font-family:monospace;"></textarea>
        <div style="margin-top:0.5rem;">
          <label>\\u6392\\u5e8f\\u5b57\\