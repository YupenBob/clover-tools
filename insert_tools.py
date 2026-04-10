#!/usr/bin/env python3
"""Insert all new tool entries into generator.js"""
import re

with open('generator.js', 'r') as f:
    content = f.read()

# ============================================================
# NEW SCRIPT ENTRIES (for buildToolScript function)
# ============================================================
new_scripts = """
    // ---- JSON 工具 ----
    'json/validator': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function validate() {
        const val = input.value.trim();
        if (!val) { output.value = ''; return; }
        try {
          const parsed = JSON.parse(val);
          output.value = '✅ JSON 格式正确\\n解析结果：\\n' + JSON.stringify(parsed, null, 2);
        } catch(e) {
          const msg = e.message;
          const pos = msg.match(/position (\\d+)/);
          if (pos) {
            const p = parseInt(pos[1]);
            const lines = val.split('\\n');
            let lineNo = 1, col = p;
            for (const l of lines) {
              if (col <= l.length) break;
              col -= l.length + 1; lineNo++;
            }
            output.value = '❌ JSON 错误：' + msg + '\\n位置：第 ' + lineNo + ' 行，第 ' + col + ' 列';
          } else { output.value = '❌ JSON 错误：' + msg; }
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
              return v.includes(',') || v.includes('"') || v.includes('\\n') ? '"' + v.replace(/"/g, '""') + '"' : v;
            }).join(','))
          ].join('\\n');
          output.value = csv;
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      function fromCsv() {
        try {
          const val = input.value.trim();
          if (!val) { output.value = ''; return; }
          const lines = val.split('\\n');
          const headers = lines[0].split(',').map(h => h.trim().replace(/^"|"$/g, ''));
          const arr = lines.slice(1).filter(l => l.trim()).map(line => {
            const vals = [], inQuote = false, cur = '';
            let i = 0;
            while (i < line.length) {
              const c = line[i];
              if (c === '"') {
                if (inQuote && line[i+1] === '"') { cur += '"'; i += 2; }
                else { inQuote = !inQuote; i++; }
              } else if (c === ',' && !inQuote) { vals.push(cur.trim()); cur = ''; i++; }
              else { cur += c; i++; }
            }
            vals.push(cur.trim());
            const obj = {}; headers.forEach((h, idx) => { obj[h] = vals[idx] || ''; });
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
        if (Array.isArray(obj)) return obj.map(v => { const s = toToml(v, indent+1); return pad + '- ' + (typeof v === 'object' && v !== null ? '\\n' + s : s.trim()); }).join('\\n');
        return Object.entries(obj).map(([k,v]) => { if (typeof v !== 'object' || v === null) return pad + k + ' = ' + (typeof v === 'string' ? '"' + v + '"' : v); return pad + '[' + k + ']\\n' + toToml(v, indent+1); }).join('\\n');
      }
      function run() {
        try { const val = input.value.trim(); if (!val) { output.value = ''; return; } output.value = toToml(JSON.parse(val)); } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
    `,

    'json/to-ts': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toTs(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) { const t = {string:'string',number:'number',boolean:'boolean'}; return pad + (t[typeof obj] || 'unknown'); }
        if (Array.isArray(obj)) { if (obj.length === 0) return pad + 'unknown[]'; const types = [...new Set(obj.map(item => toTs(item,'',indent+1).trim()))]; return pad + (types.length === 1 ? types[0] + '[]' : '(' + types.join(' | ') + ')[]'); }
        const entries = Object.entries(obj);
        if (entries.length === 0) return pad + 'Record<string, unknown>';
        let result = 'interface ' + name + ' {\\n';
        for (const [k, v] of entries) {
          const optional = k.startsWith('_') ? '?' : '';
          const safeKey = /^[a-zA-Z_$][a-zA-Z0-9_$]*$/.test(k) ? k : '\\"' + k + '\\"';
          result += pad + '  ' + safeKey + optional + ': ' + toTs(v, '', indent+1).trim() + ';\\n';
        }
        result += pad + '}'; return result;
      }
      function run() {
        try { const val = input.value.trim(); if (!val) { output.value = ''; return; } const name = document.getElementById('typeName').value || 'Root'; output.value = 'export ' + toTs(JSON.parse(val), name); } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true,address:{city:"北京",zip:"100000"},tags:["a","b"]}, null, 2); run();
    `,

    'json/to-go': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toGo(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) { const t = {string:'string',number:'float64',boolean:'bool'}; return pad + (t[typeof obj] || 'interface{}'); }
        if (Array.isArray(obj)) { if (obj.length === 0) return pad + '[]interface{}'; const types = [...new Set(obj.map(item => toGo(item,'',indent+1).trim()))]; return pad + '[]' + types[0].replace(/^\\*/,''); }
        let result = 'type ' + name + ' struct {\\n';
        for (const [k, v] of Object.entries(obj)) {
          const safeKey = /^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? k : '\\"' + k + '\\"';
          const tag = !/^[a-zA-Z_][a-zA-Z0-9_]*$/.test(k) ? ' `json:\\"' + k + '\\"`' : '';
          result += pad + '  ' + safeKey + ' ' + toGo(v,'',indent+1).trim() + tag + '\\n';
        }
        result += pad + '}'; return result;
      }
      function run() {
        try { const val = input.value.trim(); if (!val) { output.value = ''; return; } const name = document.getElementById('typeName').value || 'Root'; output.value = 'package main\\n\\n' + toGo(JSON.parse(val), name); } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true,address:{city:"北京",zip:"100000"}}, null, 2); run();
    `,

    'json/to-rust': `
      const input = document.getElementById('input');
      const output = document.getElementById('output');
      function toRust(obj, name, indent = 0) {
        const pad = '  '.repeat(indent);
        if (typeof obj !== 'object' || obj === null) { const t = {string:'String',number:'f64',boolean:'bool'}; return pad + (t[typeof obj] || 'serde_json::Value'); }
        if (Array.isArray(obj)) { if (obj.length === 0) return pad + 'Vec<serde_json::Value>'; const types = [...new Set(obj.map(item => toRust(item,'',indent+1).trim()))]; return pad + 'Vec<' + types[0].replace(/^\\*/,'') + '>'; }
        return '#[derive(Debug, Serialize, Deserialize)]\\n' + pad + 'pub struct ' + name + ' {\\n' + Object.entries(obj).map(([k,v]) => pad + '  pub ' + (/^[a-z_][a-z0-9_]*$/.test(k)?k:k) + ': ' + toRust(v,'',indent+1).trim() + ',').join('\\n') + '\\n' + pad + '}';
      }
      function run() {
        try { const val = input.value.trim(); if (!val) { output.value = ''; return; } const name = document.getElementById('typeName').value || 'Root'; output.value = 'use serde::{Serialize, Deserialize};\\n\\n' + toRust(JSON.parse(val), name); } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      document.getElementById('typeName').addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({id:1,name:"test",age:30,active:true}, null, 2); run();
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
          if (token === '$' || token === '') continue;
          const next = [];
          if (token === '*') { current.forEach(c => { if (Array.isArray(c)) next.push(...c); else if (typeof c === 'object' && c !== null) next.push(...Object.values(c)); }); }
          else if (/^\\d+$/.test(token)) { const idx = parseInt(token); current.forEach(c => { if (Array.isArray(c) && c[idx] !== undefined) next.push(c[idx]); }); }
          else if (token.startsWith('[') && token.endsWith(']')) { const idx = token.slice(1,-1); if (/^\\d+$/.test(idx)) current.forEach(c => { if (Array.isArray(c) && c[parseInt(idx)] !== undefined) next.push(c[parseInt(idx)]); }); }
          else { current.forEach(c => { if (c && typeof c === 'object' && token in c) next.push(c[token]); }); }
          current = next;
        }
        return current;
      }
      function run() {
        try { const val = input.value.trim(), path = pathInput.value.trim() || '$.'; if (!val) { output.value = ''; return; } output.value = JSON.stringify(jsonPath(JSON.parse(val), path), null, 2); } catch(e) { output.value = '错误: ' + e.message; }
      }
      input.addEventListener('input', run);
      pathInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value = JSON.stringify({"store":{"book":[{"author":"鲁迅","title":"呐喊","price":9.99},{"author":"老舍","title":"骆驼祥子","price":12.99}],"bicycle":{"color":"red","price":399}}}, null, 2); run();
    `,

    'json/merge': `
      const input1 = document.getElementById('input1');
      const input2 = document.getElementById('input2');
      const output = document.getElementById('output');
      const deepCheck = document.getElementById('deepMerge');
      function merge(a, b, deep) {
        if (deep && typeof a === 'object' && typeof b === 'object' && a !== null && b !== null) {
          if (Array.isArray(a) !== Array.isArray(b)) return Array.isArray(b) ? b : a;
          if (Array.isArray(a)) return [...a, ...b];
          const result = {...a}; for (const key of Object.keys(b)) result[key] = merge(a[key], b[key], true); return result;
        }
        return b !== undefined ? b : a;
      }
      function run() {
        try {
          const v1 = input1.value.trim(), v2 = input2.value.trim();
          if (!v1 && !v2) { output.value = ''; return; }
          const o1 = v1 ? JSON.parse(v1) : (Array.isArray(JSON.parse(v2||'{}')) ? [] : {});
          const o2 = v2 ? JSON.parse(v2) : {};
          output.value = JSON.stringify(merge(o1, o2, deepCheck.checked), null, 2);
        } catch(e) { output.value = '错误: ' + e.message; }
      }
      input1.addEventListener('input', run);
      input2.addEventListener('input', run);
      deepCheck.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input1.value = JSON.stringify({a:1,b:{c:2}}, null, 2);
      input2.value = JSON.stringify({b:{d:3},e:4}, null, 2); run();
    `,

    'json/generator': `
      const templateInput = document.getElementById('template');
      const countInput = document.getElementById('count');
      const output = document.getElementById('output');
      function ri(min, max) { return Math.floor(Math.random() * (max - min + 1)) + min; }
      function rf(min, max, d) { return (Math.random() * (max - min) + min).toFixed(d||2); }
      function rs(len) { return Array.from({length: len||ri(5,12)}, () => String.fromCharCode(ri(97,122))).join(''); }
      const FN=['张','李','王','刘','陈','杨','赵','黄','周','吴'], LN=['伟','芳','娜','秀英','敏','静','丽','强','磊','军'];
      const CT=['北京','上海','广州','深圳','杭州','成都'];
      function gen(t) {
        if (t === null || t === undefined) return null;
        if (typeof t === 'string') {
          if (t === '{{firstName}}') return FN[ri(0,FN.length-1)];
          if (t === '{{lastName}}') return LN[ri(0,LN.length-1)];
          if (t === '{{name}}') return FN[ri(0,FN.length-1)] + LN[ri(0,LN.length-1)];
          if (t === '{{city}}') return CT[ri(0,CT.length-1)];
          if (t === '{{integer}}') return ri(1,1000);
          if (t === '{{float}}') return parseFloat(rf(0,1000));
          if (t === '{{boolean}}') return Math.random()>0.5;
          if (t === '{{uuid}}') return 'xxxxxxxx-xxxx-4xxx-yxxx-xxxxxxxxxxxx'.replace(/[xy]/g, c => { const r=Math.random()*16|0; return (c==='x'?r:(r&0x3|0x8)).toString(16); });
          if (t === '{{date}}') return new Date(Date.now()-ri(0,365*3)*86400000).toISOString().split('T')[0];
          if (t === '{{email}}') return rs(8)+'@example.com';
          if (t === '{{phone}}') return '1'+ri(3,9)+String(ri(0,999999999)).padStart(9,'0');
          if (t.startsWith('{{integer(')) { const m=t.match(/\\d+/g).map(Number); return ri(m[0],m[1]); }
          if (t.startsWith('{{float(')) { const m=t.match(/[\\d.]+/g).map(Number); return parseFloat(rf(m[0],m[1],m[2]||2)); }
          if (t.startsWith('{{random(')) { const opts=t.match(/\\[(.*?)\\]/)[1].split(','); return opts[ri(0,opts.length-1)].trim(); }
          return t;
        }
        if (Array.isArray(t)) return t.map(gen);
        if (typeof t === 'object') { const r={}; for (const k of Object.keys(t)) r[k]=gen(t[k]); return r; }
        return t;
      }
      function run() {
        try { const tpl=templateInput.value.trim(); if (!tpl) { output.value=''; return; } const count=Math.min(parseInt(countInput.value)||1,100); const results=[]; for(let i=0;i<count;i++) results.push(gen(JSON.parse(tpl))); output.value=JSON.stringify(count===1?results[0]:results,null,2); } catch(e) { output.value='错误: '+e.message; }
      }
      templateInput.addEventListener('input', run);
      countInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      templateInput.value=JSON.stringify({id:"{{integer(1,1000)}}",name:"{{name}}",email:"{{email}}",age:"{{integer(18,80)}}",city:"{{city}}",active:"{{boolean}}"},null,2); run();
    `,

    'json/sort': `
      const input = document.getElementById('input');
      const keyInput = document.getElementById('sortKey');
      const output = document.getElementById('output');
      function run() {
        try {
          const val=input.value.trim(); if(!val){output.value='';return;}
          const data=JSON.parse(val);
          if(!Array.isArray(data)){output.value=JSON.stringify(data,null,2);return;}
          const key=keyInput.value.trim();
          const sorted=[...data].sort((a,b) => { const va=key?(a[key]??''):a, vb=key?(b[key]??''):b; if(va<vb)return-1;if(va>vb)return 1;return 0; });
          output.value=JSON.stringify(sorted,null,2);
        } catch(e){output.value='错误: '+e.message;}
      }
      input.addEventListener('input', run);
      keyInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value=JSON.stringify([{name:"张三",age:28},{name:"李四",age:22},{name:"王五",age:35}],null,2); run();
    `,

    'json/search': `
      const input = document.getElementById('input');
      const searchInput = document.getElementById('searchInput');
      const output = document.getElementById('output');
      const caseSensitive=document.getElementById('caseSensitive');
      function searchIn(obj, query, cs) {
        const results=[];
        function traverse(o, path) {
          if(typeof o==='object'&&o!==null){Object.entries(o).forEach(([k,v])=>traverse(v,path?path+'.'+k:k));}
          else{const s=String(o),q=cs?s:s.toLowerCase(),m=cs?query:query.toLowerCase();if(q.includes(m))results.push({path,value:o,type:typeof o});}
        }
        traverse(obj,''); return results;
      }
      function run() {
        try {
          const val=input.value.trim(), q=searchInput.value;
          if(!val||!q){output.value='';return;}
          const results=searchIn(JSON.parse(val),q,caseSensitive.checked);
          if(results.length===0){output.value='未找到匹配结果';return;}
          output.value='找到 '+results.length+' 个匹配：\\n\\n'+results.map(r=>'路径: '+r.path+'\\n值: '+JSON.stringify(r.value)+'\\n类型: '+r.type).join('\\n\\n---\\n\\n');
        } catch(e){output.value='错误: '+e.message;}
      }
      input.addEventListener('input', run);
      searchInput.addEventListener('input', run);
      caseSensitive.addEventListener('change', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      input.value=JSON.stringify({name:"张三",age:30,city:"北京",items:[{name:"苹果",price:5},{name:"香蕉",price:3}]},null,2); run();
    `,

    'json/schema': `
      const jsonInput=document.getElementById('jsonInput');
      const schemaInput=document.getElementById('schemaInput');
      const output=document.getElementById('output');
      function validate(data, schema, path) {
        const errors=[];
        if(schema.type){
          const typeMap={string:'string',number:'number',integer:'number',boolean:'boolean',array:'array',object:'object',null:'null'};
          const actualType=data===null?'null':Array.isArray(data)?'array':typeof data;
          if(actualType!==typeMap[schema.type]){errors.push(path+': 期望类型 '+schema.type+'，实际类型 '+actualType);return errors;}
        }
        if((schema.type==='string')){if(schema.minLength!==undefined&&data.length<schema.minLength)errors.push(path+': 字符串长度不足');if(schema.maxLength!==undefined&&data.length>schema.maxLength)errors.push(path+': 字符串长度超出');if(schema.pattern&&!new RegExp(schema.pattern).test(data))errors.push(path+': 不符合pattern');}
        if((schema.type==='number'||schema.type==='integer')){if(schema.minimum!==undefined&&data<schema.minimum)errors.push(path+': 小于最小值 '+schema.minimum);if(schema.maximum!==undefined&&data>schema.maximum)errors.push(path+': 大于最大值 '+schema.maximum);}
        if(schema.type==='array'&&schema.items)data.forEach((item,i)=>errors.push(...validate(item,schema.items,path+'['+i+']')));
        if(schema.type==='object'&&schema.properties){Object.entries(schema.properties).forEach(([k,v])=>{if(data[k]!==undefined)errors.push(...validate(data[k],v,path?path+'.'+k:k));});if(schema.required)schema.required.forEach(k=>{if(!(k in data))errors.push(path+'.'+k+': 缺少必需字段');});}
        return errors;
      }
      function run() {
        try{const j=jsonInput.value.trim(),s=schemaInput.value.trim();if(!j||!s){output.value='';return;}const errors=validate(JSON.parse(j),JSON.parse(s),'');output.value=errors.length===0?'✅ JSON 数据符合 Schema 定义':'❌ 验证失败 ('+errors.length+' 个错误)：\\n\\n'+errors.join('\\n');}catch(e){output.value='错误: '+e.message;}
      }
      jsonInput.addEventListener('input', run);
      schemaInput.addEventListener('input', run);
      document.getElementById('copyOutput').onclick = () => copyToClipboard(output.value);
      jsonInput.value=JSON.stringify({name:"张三",age:25},null,2);
      schemaInput.value=JSON.stringify({type:"object",required:["name","age"],properties:{name:{type:"string"},age:{type:"integer",minimum:0}}}); run();
    `,

    // ---- 编码/加密工具 ----
    'encrypt/aes': `
      const input=document.getElementById('input');
      const keyInput=document.getElementById('keyInput');
      const ivInput=document.getElementById('ivInput');
      const output=document.getElementById('output');
      let mode='encrypt';
      async function aes_encrypt(text,key,iv){
        const encoder=new TextEncoder();
        const k=await crypto.subtle.importKey('raw',encoder.encode(key.padEnd(32,'0').slice(0,32)),{name:'AES-CBC'},false,['encrypt']);
        const ivBytes=encoder.encode(iv.slice(0,16));
        const encrypted=await crypto.subtle.encrypt({name:'AES-CBC',iv:ivBytes},k,encoder.encode(text));
        return btoa(String.fromCharCode(...new Uint8Array(encrypted)));
      }
      async function aes_decrypt(text,key,iv){
        const encoder=new TextEncoder();
        const k=await crypto.subtle.importKey('raw',encoder.encode(key.padEnd(32,'0').slice(0,32)),{name:'AES-CBC'},false,['decrypt']);
        const ivBytes=encoder.encode(iv.slice(0,16));
        const data=Uint8Array.from(atob(text.trim()),c=>c.charCodeAt(0));
        return new TextDecoder().decode(await crypto.subtle.decrypt({name:'AES-CBC',iv:ivBytes},k,data));
      }
      async function run(){
        try{
          const text=input.value,key=keyInput.value||'defaultpassword123456',iv=ivInput.value||'randomiv123456789';
          if(!text){output.value='';return;}
          output.value=mode==='encrypt'?await aes_encrypt(text,key,iv):await aes_decrypt(text,key,iv);
        }catch(e){output.value='错误: '+e.message;}
      }
      document.getElementById('encryptBtn').onclick=()=>{mode='encrypt';run();};
      document.getElementById('decryptBtn').onclick=()=>{mode='decrypt';run();};
      document.getElementById('copyOutput').onclick=()=>copyToClipboard(output.value);
      input.addEventListener('input',run); keyInput.addEventListener('input',run);
    `,

    'encrypt/des': `
      const input=document.getElementById('input');
      const keyInput=document.getElementById('keyInput');
      const output=document.getElementById('output');
      let mode='encrypt';
      function strToBytes(s){const b=[];for(let i=0;i<s.length;i++)b.push(s.charCodeAt(i)&0xFF);return b;}
      function bytesToStr(b){return String.fromCharCode(...b.map(v=>v&0xFF));}
      function padPKCS7(d){const p=8-d.length%8;return [...d,...Array(p).fill(p)];}
      function unpadPKCS7(d){return d.slice(0,d.length-d[d.length-1]);}
      function xorBytes(a,b){return a.map((v,i)=>v^b[i]);}
      function permute(data,table){return table.map(i=>data[i-1]);}
      function leftShift(data,n){return [...data.slice(n),...data.slice(0,n)];}
      const IP=[58,50,42,34,26,18,10,2,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,64,56,48,40,32,24,16,8,57,49,41,33,25,17,9,1,59,51,43,35,27,19,11,3,61,53,45,37,29,21,13,5,63,55,47,39,31,23,15,7];
      const FP=[40,8,48,16,56,24,64,32,39,7,47,15,55,23,63,31,38,6,46,14,54,22,62,30,37,5,45,13,53,21,61,29,36,4,44,12,52,20,60,28,35,3,43,11,51,19,59,27,34,2,42,10,50,18,58,26];
      const PC1=[57,49,41,33,25,17,9,1,58,50,42,34,26,18,10,2,59,51,43,35,27,19,11,3,60,52,44,36,28,20,12,4,62,54,46,38,30,22,14,6,63,55,47,39,31,23,15,7];
      const PC2=[14,17,11,24,1,5,3,28,15,6,21,10,23,19,12,4,26,8,16,7,27,20,13,2,41,52,31,37,47,55,30,40,51,45,33,48,44,49,39,56,34,53,46,42,50,36,29,32];
      const SBOX=[[0xe,0x0,0x4,0xf,0xd,0x7,0x1,0x4,0x2,0xe,0xf,0x2,0xb,0xd,0x6,0x8,0x1,0x2,0x9,0xf,0x3,0x0,0xb,0x0,0xe,0xf,0x4,0x3,0x2,0xc,0x7,0x1,0xa,0xd,0x0,0x6,0x9,0xf,0xe,0x3,0x1,0x4,0xa,0xc,0x2,0x7,0x8,0x5,0xb,0xc,0x4,0xb,0x2,0xf,0x2,0xc,0x1,0xa,0x7,0x6,0x8,0x0,0xd,0x3,0x4,0xf,0xe,0x9,0xb,0x3,0xf,0x0,0x4,0xe,0x7,0xa,0x9,0x8,0x6,0xd,0x1,0x3,0xe,0x5,0x2,0x9,0xb,0xc,0x5,0x7,0x8,0xb,0xe,0xf,0xc,0x3,0x7,0x0,0x4,0xa,0x6,0x1,0xd,0xc,0xb,0x8,0x5,0x2,0x0,0xe,0xa,0xd,0x3,0x6,0xf,0x9,0x5,0x1,0x3,0xe,0x7,0x8,0x4,0xf,0x1,0xc,0x8,0xa,0x7,0x6,0x0,0xf,0x3,0x0,0x6,0x2,0x5,0xb,0xd,0x8,0xc,0x4,0xb,0x9,0x3,0xe,0x5,0xa,0x0,0x2,0xd,0xf,0x7,0x1,0x4,0x8,0x1,0xf,0xd,0x0,0xa,0x3,0xe,0x4,0x2,0x8,0x5,0xc,0x7,0x6,0xb,0x5,0x0,0xf,0x3,0x5,0x6,0x2,0xa,0xc,0xf,0x9,0xd,0x8,0xb,0x4,0x7,0x1,0x9,0xc,0x3,0x7,0xe,0xb,0x0,0x5,0x2,0xf,0x6,0x8,0x0,0xd,0xb,0x4,0x1,0x2,0x9,0x7,0xf,0x5,0xa,0xd,0xe,0x4,0x0,0x9,0x1,0x8,0xd,0xa,0x3,0xc,0x6,0x7,0xb,0x5,0x2,0x0,0xf,0x4,0x2,0x8,0x6,0xc,0xa,0xf,0x5,0x0,0xe,0x3,0xb,0x9,0x7,0xd,0x1,0xb,0x5,0xf,0x0,0x3,0