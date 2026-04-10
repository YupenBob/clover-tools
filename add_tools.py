#!/usr/bin/env python3
"""Add all new tool entries to generator.js"""

with open('generator.js', 'r') as f:
    content = f.read()
    lines = content.split('\n')

# Find insertion points
# buildToolScript closes with: "  };" at line ~1620 and "return scripts[key]" after
# buildToolContentHtml closes with: "  };" at line ~2388 and "return contents[key]" after

# Find the last entry in scripts (before "  };")
# Look for pattern: backtick-comma-newline-newline-spaces-spaces-spaces-spaces };
script_end_idx = None
for i, line in enumerate(lines):
    if line.strip() == '};' and i > 1500 and i < 1630:
        # Check if previous lines contain template literal ending
        if i > 0 and lines[i-1].strip().startswith('`,'):
            script_end_idx = i
            break

print(f"Found script_end_idx at line {script_end_idx}: {lines[script_end_idx-2][:60]}...")

# Find the last entry in contents (before "  };")
content_end_idx = None
for i, line in enumerate(lines):
    if line.strip() == '};' and i > 2350 and i < 2400:
        if i > 0 and lines[i-1].strip().startswith('`,'):
            content_end_idx = i
            break

print(f"Found content_end_idx at line {content_end_idx}: {lines[content_end_idx-2][:60]}...")

# New script entries
new_scripts = '''
    // ---- JSON 工具 ----
    'json/validator': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function validate() {
        const val = input.value.trim();
        if (!val) { output.value = ''; return; }
        try {
          const parsed = JSON.parse(val);
          output.value = '✅ JSON 格式正确\\n\\n解析结果：\\n' + JSON.stringify(parsed, null, 2);
        } catch(e) {
          const msg = e.message;
          const pos = msg.match(/position (\\d+)/);
          if (pos) {
            const p = parseInt(pos[1]);
            const lines = val.split('\\\\n');
            let lineNo = 1, col = p;
            for (const l of lines) {
              if (col <= l.length) break;
              col -= l.length + 1;
              lineNo++;
            }
            output.value = '❌ JSON 错误：' + msg + '\\\\n位置：第 ' + lineNo + ' 行，第 ' + col + ' 列';
          } else {
            output.value = '❌ JSON 错误：' + msg;
          }
        }
      }
      input.addEventListener('input', validate);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      validate();
    `,

    'json/to-csv': `
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
              return v.includes(',') || v.includes('"') || v.includes('\\\\n') ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(','))
          ].join('\\\\n');
          output.value = csv;
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      function fromCsv() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const lines = val.split('\\\\n');
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
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', toCsv);
      document.getElementById('toCsv').onclick = toCsv;
      document.getElementById('fromCsv').onclick = fromCsv;
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'json/to-toml': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toToml(obj, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) return pad + (typeof obj === 'string' ? '"' + obj + '"' : obj);
        if (Array.isArray(obj)) {
          return obj.map(v => {
            const s = toToml(v, indent + 1);
            return pad + '- ' + (typeof v === 'object' && v !== null ? '\\\\n' + s : s.trim());
          }).join('\\\\n');
        }
        return Object.entries(obj).map(([k,v]) => {
          if (typeof v !== 'object' || v === null) return pad + k + ' = ' + (typeof v === 'string' ? '"' + v + '"' : v);
          return pad + '[' + k + ']\\\\n' + toToml(v, indent + 1);
        }).join('\\\\n');
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          output.value = toToml(obj);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'json/to-ts': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
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
        let result = 'interface ' + name + ' {\\\\n';
        for (const [k, v] of entries) {
          const optional = k.startsWith('_') ? '?' : '';
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : '\\"' + k + '\\"';
          result += pad + '  ' + safeKey + optional + ': ' + toTs(v, '', indent + 1).trim() + ';\\\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = document.getElementById('typeName').value || 'Root';
          output.value = 'export ' + toTs(obj, name);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true,address:{city:"北京",zip:"100000"},tags:["a","b"]}, null, 2);
      run();
    `,

    'json/to-go': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
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
        let result = 'type ' + name + ' struct {\\\\n';
        for (const [k, v] of Object.entries(obj)) {
          const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : '\\"' + k + '\\"';
          const tag = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? ' \\`json:\\"' + k + '\\"\`' : '';
          result += pad + '  ' + safeKey + ' ' + toGo(v, '', indent + 1).trim() + tag + '\\\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = document.getElementById('typeName').value || 'Root';
          output.value = 'package main\\\\n\\\\n' + toGo(obj, name);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true,address:{city:"北京",zip:"100000"}}, null, 2);
      run();
    `,

    'json/to-rust': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
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
        let result = '#[derive(Debug, Serialize, Deserialize)]\\\\n' + pad + 'pub struct ' + name + ' {\\\\n';
        for (const [k, v] of Object.entries(obj)) {
          const safeKey = /^[a-z_][a-z0-9_]*$/.test(k) ? k : k;
          result += pad + '  pub ' + safeKey + ': ' + toRust(v, '', indent + 1).trim() + ',\\\\n';
        }
        result += pad + '}';
        return result;
      }
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const name = document.getElementById('typeName').value || 'Root';
          output.value = 'use serde::{Serialize, Deserialize};\\\\n\\\\n' + toRust(obj, name);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true}, null, 2);
      run();
    `,

    'json/json-path': `
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
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      pathInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({"store":{"book":[{"category":" fiction","author":"鲁迅","title":"呐喊","price":9.99},{"category":" fiction","author":"老舍","title":"骆驼祥子","price":12.99}],"bicycle":{"color":"red","price":399}},"home":{"rooms":3,"address":"北京"}}, null, 2);
      run();
    `,

    'json/merge': `
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
            for (const key of Object.keys(b)) {
              result[key] = merge(a[key], b[key], true);
            }
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
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input1.addEventListener('input', run);
      input2.addEventListener('input', run);
      deepCheck.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input1.value = JSON.stringify({a:1,b:{c:2}}, null, 2);
      input2.value = JSON.stringify({b:{d:3},e:4}, null, 2);
      run();
    `,

    'json/generator': `
      const templateInput = document.getElementById('template');
      const countInput = document.getElementById('count');
      const output = document.getElementById('output');
      function randInt(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
      function randFloat(min, max, dec) { return (Math.random() * (max - min) + min).toFixed(dec || 2); }
      function randStr(len) { return Array.from({length: len || randInt(5,12)}, () => String.fromCharCode(randInt(97,122))).join(''); }
      function randBool() { return Math.random() > 0.5; }
      const firstNames = ['张','李','王','刘','陈','杨','赵','黄','周','吴'];
      const lastNames = ['伟','芳','娜','秀英','敏','静','丽','强','磊','军'];
      const cities = ['北京','上海','广州','深圳','杭州','成都','武汉','西安'];
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
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      templateInput.addEventListener('input', run);
      countInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      templateInput.value = JSON.stringify({id:"{{integer(1,1000)}}",name:"{{name}}",email:"{{email}}",age:"{{integer(18,80)}}",city:"{{city}}",active:"{{boolean}}",created:"{{date}}"}, null, 2);
      run();
    `,

    'json/sort': `
      const input = document.getElementById('input');
      const keyInput = document.getElementById('sortKey');
      const output = document.getElementById('output');
      function run() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const data = JSON.parse(val);
          if (!Array.isArray(data)) { output.value = JSON.stringify(data, null, 2); return; }
          const key = keyInput.value.trim();
          const sorted = [...data].sort((a, b) => {
            const va = key ? (a[key] ?? '') : a;
            const vb = key ? (b[key] ?? '') : b;
            if (va < vb) return -1; if (va > vb) return 1; return 0;
          });
          output.value = JSON.stringify(sorted, null, 2);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      keyInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify([{name:"张三",age:28},{name:"李四",age:22},{name:"王五",age:35}], null, 2);
      run();
    `,

    'json/search': `
      const input = document.getElementById('input');
      const searchInput = document.getElementById('searchInput');
      const output = document.getElementById('output');
      const caseSensitive = document.getElementById('caseSensitive');
      function searchIn(obj, query, cs) {
        const results = [];
        function traverse(o, path) {
          if (typeof o === 'object' && o !== null) {
            const entries = Object.entries(o);
            entries.forEach(([k, v]) => traverse(v, path ? path + '.' + k : k));
          } else {
            const s = String(o);
            const q = cs ? s : s.toLowerCase();
            const m = cs ? query : query.toLowerCase();
            if (q.includes(m)) results.push({ path, value: o, type: typeof o });
          }
        }
        traverse(obj, '');
        return results;
      }
      function run() {
        try {
          const val = input.value.trim();
          const q = searchInput.value;
          if (!val || !q) { output.value = ''; return; }
          const obj = JSON.parse(val);
          const results = searchIn(obj, q, caseSensitive.checked);
          if (results.length === 0) { output.value = '未找到匹配结果'; return; }
          output.value = '找到 ' + results.length + ' 个匹配：\\\\n\\\\n' +
            results.map(r => '路径: ' + r.path + '\\\\n值: ' + JSON.stringify(r.value) + '\\\\n类型: ' + r.type).join('\\\\n\\\\n---\\\\n\\\\n');
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      searchInput.addEventListener('input', run);
      caseSensitive.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({name:"张三",age:30,city:"北京",items:[{name:"苹果",price:5},{name:"香蕉",price:3}]}, null, 2);
      run();
    `,

    'json/schema': `
      const jsonInput = document.getElementById('jsonInput');
      const schemaInput = document.getElementById('schemaInput');
      const output = document.getElementById('output');
      function validate(data, schema, path = '') {
        const errors = [];
        if (schema.type) {
          const typeMap = { string: 'string', number: 'number', integer: 'number', boolean: 'boolean', array: 'array', object: 'object', null: 'null' };
          const actualType = data === null ? 'null' : Array.isArray(data) ? 'array' : typeof data;
          if (!typeMap[schema.type] || actualType !== typeMap[schema.type]) {
            errors.push(path + ': 期望类型 ' + schema.type + '，实际类型 ' + actualType);
            return errors;
          }
        }
        if (schema.type === 'string' && schema.minLength !== undefined && data.length < schema.minLength) errors.push(path + ': 字符串长度不足，最小 ' + schema.minLength);
        if (schema.type === 'string' && schema.maxLength !== undefined && data.length > schema.maxLength) errors.push(path + ': 字符串长度超出，最大 ' + schema.maxLength);
        if (schema.type === 'string' && schema.pattern && !new RegExp(schema.pattern).test(data)) errors.push(path + ': 不符合 pattern: ' + schema.pattern);
        if (schema.type === 'number' || schema.type === 'integer') {
          if (schema.minimum !== undefined && data < schema.minimum) errors.push(path + ': 小于最小值 ' + schema.minimum);
          if (schema.maximum !== undefined && data > schema.maximum) errors.push(path + ': 大于最大值 ' + schema.maximum);
        }
        if (schema.type === 'array' && schema.items) {
          data.forEach((item, i) => { errors.push(...validate(item, schema.items, path + '[' + i + ']')); });
        }
        if (schema.type === 'object' && schema.properties) {
          Object.entries(schema.properties).forEach(([k, v]) => {
            if (data[k] !== undefined) errors.push(...validate(data[k], v, path ? path + '.' + k : k));
          });
          if (schema.required) schema.required.forEach(k => { if (!(k in data)) errors.push(path + '.' + k + ': 缺少必需字段'); });
        }
        return errors;
      }
      function run() {
        try {
          const jsonVal = jsonInput.value.trim();
          const schemaVal = schemaInput.value.trim();
          if (!jsonVal || !schemaVal) { output.value = ''; return; }
          const data = JSON.parse(jsonVal);
          const schema = JSON.parse(schemaVal);
          const errors = validate(data, schema);
          if (errors.length === 0) output.value = '✅ JSON 数据符合 Schema 定义';
          else output.value = '❌ 验证失败 (' + errors.length + ' 个错误)：\\\\n\\\\n' + errors.join('\\\\n');
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      jsonInput.addEventListener('input', run);
      schemaInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      jsonInput.value = JSON.stringify({name:"张三",age:25,email:"zhang@example.com"}, null, 2);
      schemaInput.value = JSON.stringify({type:"object",required:["name","age"],properties:{name:{type:"string"},age:{type:"integer",minimum:0}}});
      run();
    `,

    // ---- 编码/加密工具 ----
    'encrypt/aes': `
      const input = document.getElementById('input');
      const keyInput = document.getElementById('keyInput');
      const ivInput = document.getElementById('ivInput');
      const output = document.getElementById('output');
      const modeSelect = document.getElementById('modeSelect');
      let mode = 'encrypt';
      async function aes_encrypt(text, key, iv) {
        const encoder = new TextEncoder();
        const k = await crypto.subtle.importKey('raw', encoder.encode(key.padEnd(32,'0').slice(0,32)), {name:'AES-CBC'}, false, ['encrypt']);
        const ivBytes = encoder.encode(iv || '').slice(0,16);
        const encrypted = await crypto.subtle.encrypt({name:'AES-CBC', iv: ivBytes}, k, encoder.encode(text));
        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      }
      async function aes_decrypt(text, key, iv) {
        try {
          const encoder = new TextEncoder();
          const k = await crypto.subtle.importKey('raw', encoder.encode(key.padEnd(32,'0').slice(0,32)), {name:'AES-CBC'}, false, ['decrypt']);
          const ivBytes = encoder.encode(iv || '').slice(0,16);
          const data = Uint8Array.from(atob(text.trim()), c => c.charCodeAt(0));
          const decrypted = await crypto.subtle.decrypt({name:'AES-CBC', iv: ivBytes}, k, data);
          return new TextDecoder().decode(decrypted);
        } catch(e) { throw new Error('解密失败: ' + e.message); }
      }
      async function run() {
        try {
          const text = input.value;
          const key = keyInput.value || 'defaultpassword123456';
          const iv = ivInput.value || 'randomiv123456789';
          if (!text) { output.value = ''; return; }
          output.value = mode === 'encrypt' ? await aes_encrypt(text, key, iv) : await aes_decrypt(text, key, iv);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      document.getElementById('encrypt').onclick = () => { mode='encrypt'; run(); };
      document.getElementById('decrypt').onclick = () => { mode='decrypt'; run(); };
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.addEventListener('input', run);
      keyInput.addEventListener('input', run);
    `,

    'encrypt/des': `
      const input = document.getElementById('input');
      const keyInput = document.getElementById('keyInput');
      const output = document.getElementById('output');
      let mode = 'encrypt';
      // DES implementation using simple lookup tables
      const IP = [58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
      const FP = [40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26];
      function strToBits(s) { const b=[]; for(let i=0;i<s.length;i++) for(let j=7;j>=0;j--) b.push((s.charCodeAt(i)>>j)&1); return b; }
      function bitsToStr(b) { let s=''; for(let i=0;i<b.length;i+=8) { let v=0; for(let j=0;j<8;j++) v=v*2+(b[i+j]||0); s+=