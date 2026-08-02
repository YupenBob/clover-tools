#!/usr/bin/env python3
import json

with open('tools.json') as f:
    data = json.load(f)

tools_by_path = {}
for cat in data:
    for t in cat['tools']:
        tools_by_path[t['path']] = t

def find(path):
    return tools_by_path.get(path)

def set_fn(path, key, val):
    t = find(path)
    if t:
        t[key] = val
        print(f'Set {path}: {key}')

# MD5/SHA
set_fn('encrypt/md5.html', 'reverseFn', 'function(v){return "MD5 是不可逆哈希算法，无法解密。若已知明文可尝试彩虹表查询。";}')
set_fn('encrypt/sha.html', 'reverseFn', 'function(v){return "SHA 是不可逆哈希算法，无法解密。若已知明文可尝试彩虹表查询。";}')

# LESS to CSS
set_fn('code/less-to-css.html', 'formatFn', '''function(v, opts) {
  if (opts && opts.minify) {
    return v.replace(/\\/\\*[\\s\\S]*?\\*\\//g, '').replace(/\\s+/g, ' ').replace(/\\s*([{}:;,])\\s*/g, '$1').trim();
  }
  var indent = 0;
  var lines = v.replace(/\\r\\n/g, '\\n').split('\\n');
  var result = [];
  for (var i = 0; i < lines.length; i++) {
    var line = lines[i].trim();
    if (!line || line.startsWith('//')) continue;
    if (line.startsWith('}')) indent = Math.max(0, indent - 1);
    result.push('  '.repeat(indent) + line);
    if (line.endsWith('{')) indent++;
  }
  return result.join('\\n');
}''')

# String sort
set_fn('text/string-sort.html', 'formatFn', '''function(v, opts) {
  var lines = v.split(/[\\n,]/).map(function(s){ return s.trim(); }).filter(function(s){ return s.length > 0; });
  var order = (opts && opts.order) || 'asc';
  if (order === 'desc') lines.sort(function(a,b){ return b.localeCompare(a, 'zh-CN'); });
  else lines.sort(function(a,b){ return a.localeCompare(b, 'zh-CN'); });
  return lines.join('\\n');
}''')

# Password generator
set_fn('other/password.html', 'generateFn', '''function(inputs) {
  var len = parseInt(inputs.length) || 16;
  var useUpper = inputs.useUpper !== '0';
  var useLower = inputs.useLower !== '0';
  var useNum = inputs.useNum !== '0';
  var useSpec = inputs.useSpec !== '0';
  var count = parseInt(inputs.count) || 1;
  var chars = '';
  if (useUpper) chars += 'ABCDEFGHIJKLMNOPQRSTUVWXYZ';
  if (useLower) chars += 'abcdefghijklmnopqrstuvwxyz';
  if (useNum) chars += '0123456789';
  if (useSpec) chars += '!@#$%^&*()_+-=[]{}|;:,.<>?';
  if (!chars) chars = 'abcdefghijklmnopqrstuvwxyzABCDEFGHIJKLMNOPQRSTUVWXYZ0123456789';
  var result = [];
  for (var c = 0; c < count; c++) {
    var pwd = '';
    for (var i = 0; i < len; i++) {
      pwd += chars[Math.floor(Math.random() * chars.length)];
    }
    result.push(pwd);
  }
  return result.join('\\n');
}''')

# Social insurance
t = find('life/insurance.html')
if t:
    t['fields'] = [{"id": "salary", "label": "税前工资(元)", "placeholder": "例如: 10000"}, {"id": "city", "label": "城市", "placeholder": "例如: 北京"}]
    t['calcFn'] = '''function(inputs) {
  var salary = parseFloat(inputs.salary) || 0;
  var pension = salary * 0.08;
  var medical = salary * 0.02;
  var unemployment = salary * 0.005;
  var housing = salary * 0.12;
  var total = pension + medical + unemployment + housing;
  var result = '<b>五险一金计算结果（' + (inputs.city||'某城市') + '）</b><br>';
  result += '税前工资: ' + salary.toFixed(2) + '元<br>';
  result += '养老保险(8%): ' + pension.toFixed(2) + '元<br>';
  result += '医疗保险(2%): ' + medical.toFixed(2) + '元<br>';
  result += '失业保险(0.5%): ' + unemployment.toFixed(2) + '元<br>';
  result += '公积金(12%): ' + housing.toFixed(2) + '元<br>';
  result += '<b>个人合计扣除: ' + total.toFixed(2) + '元</b><br>';
  result += '实际到手: ' + (salary - total).toFixed(2) + '元';
  return result;
}'''
    print('Set life/insurance.html: calcFn + fields')

# Salary
t = find('life/salary.html')
if t:
    t['fields'] = [{"id": "salary", "label": "税前工资(元)", "placeholder": "例如: 15000"}, {"id": "insurance", "label": "五险一金(元)", "placeholder": "例如: 2000"}]
    t['calcFn'] = '''function(inputs) {
  var salary = parseFloat(inputs.salary) || 0;
  var insurance = parseFloat(inputs.insurance) || 0;
  var taxable = salary - insurance - 5000;
  var tax = 0;
  if (taxable > 0) {
    if (taxable <= 36000) tax = taxable * 0.03;
    else if (taxable <= 144000) tax = taxable * 0.10 - 2520;
    else if (taxable <= 300000) tax = taxable * 0.20 - 16920;
    else if (taxable <= 420000) tax = taxable * 0.25 - 31920;
    else if (taxable <= 660000) tax = taxable * 0.30 - 52920;
    else if (taxable <= 960000) tax = taxable * 0.35 - 85920;
    else tax = taxable * 0.45 - 181920;
  }
  var net = salary - insurance - tax;
  var result = '<b>工资税务计算</b><br>';
  result += '税前工资: ' + salary.toFixed(2) + '元<br>';
  result += '五险一金: ' + insurance.toFixed(2) + '元<br>';
  result += '应纳税所得额: ' + Math.max(0, taxable).toFixed(2) + '元<br>';
  result += '个人所得税: ' + tax.toFixed(2) + '元<br>';
  result += '<b>税后工资: ' + net.toFixed(2) + '元</b>';
  return result;
}'''
    print('Set life/salary.html: calcFn + fields')

# HTTP tests
set_fn('code/http-test.html', 'config', {
    "method": {"type": "select", "label": "请求方法", "options": ["GET","POST","PUT","DELETE","PATCH"], "default": "GET"},
    "url": {"type": "input", "label": "URL", "placeholder": "https://api.example.com/endpoint"},
    "headers": {"type": "textarea", "label": "请求头 (JSON)", "placeholder": '{"Content-Type":"application/json"}'},
    "body": {"type": "textarea", "label": "请求体", "placeholder": '{"key":"value"}'},
    "timeout": {"type": "input", "label": "超时(ms)", "default": "10000"}
})
set_fn('network/request-tester.html', 'config', {
    "method": {"type": "select", "label": "请求方法", "options": ["GET","POST","PUT","DELETE","PATCH"], "default": "GET"},
    "url": {"type": "input", "label": "URL", "placeholder": "https://api.example.com"},
    "headers": {"type": "textarea", "label": "Headers (JSON)", "placeholder": '{"Content-Type":"application/json"}'},
    "body": {"type": "textarea", "label": "Body", "placeholder": '{}'},
    "timeout": {"type": "input", "label": "Timeout(ms)", "default": "10000"}
})

# WebSocket
set_fn('code/websocket-test.html', 'config', {
    "url": {"type": "input", "label": "WebSocket URL", "placeholder": "wss://echo.websocket.events"},
    "message": {"type": "input", "label": "发送消息", "placeholder": "Hello WebSocket"}
})

# JSON to C#
t = find('code/json2csharp.html')
if t:
    t['schema'] = {"type": "object", "additionalProperties": True}
    t['generateFn'] = '''function(inputs, schema) {
  try {
    var json = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    var className = inputs.className || 'RootModel';
    var result = 'public class ' + className + '\\n{\\n';
    function toPascal(s) { return s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, function(m){return m[1].toUpperCase();}); }
    function getType(val) {
      if (val === null) return 'object';
      if (Array.isArray(val)) return val.length > 0 ? toListType(val[0]) + '[]' : 'object[]';
      if (typeof val === 'boolean') return 'bool';
      if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'double';
      return 'string';
    }
    function toListType(v) {
      if (v === null) return 'object';
      if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'double';
      if (typeof v === 'string') return 'string';
      return 'object';
    }
    var obj = Array.isArray(json) ? json[0] : json;
    for (var key in obj) {
      result += '    public ' + getType(obj[key]) + ' ' + toPascal(key) + ' { get; set; }\\n';
    }
    result += '}\\n';
    return result;
  } catch(e) { return 'JSON Error: ' + e.message; }
}'''
    print('Set code/json2csharp.html: schema + generateFn')

# JSON to Go
t = find('code/json2go.html')
if t:
    t['schema'] = {"type": "object", "additionalProperties": True}
    t['generateFn'] = '''function(inputs, schema) {
  try {
    var json = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    var typeName = inputs.typeName || 'Root';
    var result = 'type ' + typeName + ' struct {\\n';
    function toPascal(s) { return s.charAt(0).toUpperCase() + s.slice(1).replace(/_([a-z])/g, function(m){return m[1].toUpperCase();}); }
    function getType(val) {
      if (val === null) return 'interface{}';
      if (Array.isArray(val)) return '[]' + (val.length > 0 ? goType(val[0]) : 'interface{}');
      if (typeof val === 'boolean') return 'bool';
      if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'float64';
      if (typeof val === 'string') return 'string';
      return 'interface{}';
    }
    function goType(v) {
      if (v === null) return 'interface{}';
      if (typeof v === 'number') return Number.isInteger(v) ? 'int' : 'float64';
      if (typeof v === 'string') return 'string';
      return 'interface{}';
    }
    var obj = Array.isArray(json) ? json[0] : json;
    for (var key in obj) {
      result += '    ' + toPascal(key) + ' ' + getType(obj[key]) + ' `json:"' + key + '"`\\n';
    }
    result += '}\\n';
    return result;
  } catch(e) { return 'JSON Error: ' + e.message; }
}'''
    print('Set code/json2go.html: schema + generateFn')

# JSON to Java
t = find('code/json2java.html')
if t:
    t['schema'] = {"type": "object", "additionalProperties": True}
    t['generateFn'] = '''function(inputs, schema) {
  try {
    var json = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    var className = inputs.className || 'RootModel';
    var result = 'public class ' + className + ' {\\n\\n';
    function toCamel(s) { return s.charAt(0).toLowerCase() + s.slice(1).replace(/_([a-z])/g, function(m){return m[1].toUpperCase();}); }
    function getType(val) {
      if (val === null) return 'Object';
      if (Array.isArray(val)) return val.length > 0 ? 'List<' + javaType(val[0]) + '>' : 'List<Object>';
      if (typeof val === 'boolean') return 'boolean';
      if (typeof val === 'number') return Number.isInteger(val) ? 'int' : 'double';
      if (typeof val === 'string') return 'String';
      return 'Object';
    }
    function javaType(v) {
      if (v === null) return 'Object';
      if (typeof v === 'number') return Number.isInteger(v) ? 'Integer' : 'Double';
      if (typeof v === 'string') return 'String';
      return 'Object';
    }
    var obj = Array.isArray(json) ? json[0] : json;
    for (var key in obj) {
      var fn = toCamel(key);
      result += '    private ' + getType(obj[key]) + ' ' + fn + ';\\n';
    }
    result += '\\n';
    for (var key in obj) {
      var fn = toCamel(key);
      var mn = fn.charAt(0).toUpperCase() + fn.slice(1);
      result += '    public ' + getType(obj[key]) + ' get' + mn + '() { return ' + fn + '; }\\n';
      result += '    public void set' + mn + '(' + getType(obj[key]) + ' ' + fn + ') { this.' + fn + ' = ' + fn + '; }\\n';
    }
    result += '}\\n';
    return result;
  } catch(e) { return 'JSON Error: ' + e.message; }
}'''
    print('Set code/json2java.html: schema + generateFn')

# JSON to SQL
t = find('code/json2sql.html')
if t:
    t['schema'] = {"type": "object", "additionalProperties": True}
    t['generateFn'] = '''function(inputs, schema) {
  try {
    var json = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    if (!Array.isArray(json)) json = [json];
    if (json.length === 0) return '-- No data';
    var tableName = inputs.tableName || 'my_table';
    var columns = Object.keys(json[0]);
    var colDefs = columns.map(function(c){ return '  ' + c + ' TEXT'; }).join(',\\n');
    var createSQL = 'CREATE TABLE ' + tableName + ' (\\n' + colDefs + '\\n);\\n\\n';
    var insertSQL = json.map(function(row) {
      var vals = columns.map(function(c){ return esc(row[c]); });
      return 'INSERT INTO ' + tableName + ' (' + columns.join(', ') + ') VALUES (' + vals.join(', ') + ');';
    }).join('\\n');
    return createSQL + insertSQL;
  } catch(e) { return 'JSON Error: ' + e.message; }
  function esc(v) {
    if (v === null || v === undefined) return 'NULL';
    return "'" + String(v).replace(/'/g, "''") + "'";
  }
}'''
    print('Set code/json2sql.html: schema + generateFn')

# JSON to TypeScript
t = find('code/json2ts.html')
if t:
    t['schema'] = {"type": "object", "additionalProperties": True}
    t['generateFn'] = '''function(inputs, schema) {
  try {
    var json = typeof inputs === 'string' ? JSON.parse(inputs) : inputs;
    var typeName = inputs.typeName || 'Root';
    function getType(v) {
      if (v === null) return 'null';
      if (Array.isArray(v)) return v.length > 0 ? getType(v[0]) + '[]' : 'any[]';
      if (typeof v === 'boolean') return 'boolean';
      if (typeof v === 'number') return 'number';
      if (typeof v === 'string') return 'string';
      return 'any';
    }
    var obj = Array.isArray(json) ? json[0] : json;
    var props = [];
    for (var key in obj) {
      props.push('  ' + key + '?: ' + getType(obj[key]) + ';');
    }
    return 'export interface ' + typeName + ' {\\n' + props.join('\\n') + '\\n}\\n';
  } catch(e) { return 'JSON Error: ' + e.message; }
}'''
    print('Set code/json2ts.html: schema + generateFn')

# Timestamp converter
set_fn('time/timestamp.html', 'customHtml',
    '<div class="tool-card"><div class="breadcrumb">首页 / 时间工具 / 时间戳转换</div><h1>时间戳转换</h1><p>在 Unix 时间戳与日期时间之间相互转换</p><div style="display:flex;gap:.5rem;margin-bottom:1rem"><button id="btnNow" class="btn btn-primary">当前时间戳</button><button id="btnRefresh" class="btn btn-secondary">刷新</button></div><div class="tool-card"><h3>输入时间戳或日期</h3><textarea id="input" placeholder="输入时间戳(毫秒): 1714320000000 或日期: 2024-04-29 12:00:00" style="min-height:100px;width:100%;padding:.75rem;font-size:.9rem;border:1px solid var(--border);border-radius:8px;resize:vertical;background:var(--input-bg);color:var(--text);font-family:monospace;box-sizing:border-box"></textarea><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.5rem"><button id="btnMsToDate" class="btn btn-primary">毫秒→日期</button><button id="btnSecToDate" class="btn btn-primary">秒→日期</button><button id="btnDateToMs" class="btn btn-primary">日期→毫秒</button><button id="btnDateToSec" class="btn btn-primary">日期→秒</button></div><h3 style="margin-top:1rem">结果</h3><div id="result" style="background:var(--output-bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;min-height:80px;font-family:monospace;white-space:pre-wrap;word-break:break-all;color:var(--text)"></div></div></div><script>document.getElementById("btnNow").onclick=function(){var n=Date.now();document.getElementById("input").value=n+"\\n(秒:"+Math.floor(n/1000)+")";};document.getElementById("btnRefresh").onclick=function(){var n=Date.now();document.getElementById("result").textContent="当前时间:"+new Date().toLocaleString("zh-CN")+"\\n毫秒:"+n+"\\n秒:"+Math.floor(n/1000);};document.getElementById("btnMsToDate").onclick=function(){var v=document.getElementById("input").value.trim().split(/\\n/)[0];var ms=parseInt(v);if(isNaN(ms)){document.getElementById("result").textContent="请输入有效时间戳";return;}if(ms<1e12)ms*=1000;document.getElementById("result").textContent=new Date(ms).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"});};document.getElementById("btnSecToDate").onclick=function(){var v=document.getElementById("input").value.trim().split(/\\n/)[0];var s=parseInt(v);if(isNaN(s)){document.getElementById("result").textContent="请输入有效时间戳";return;}document.getElementById("result").textContent=new Date(s*1000).toLocaleString("zh-CN",{timeZone:"Asia/Shanghai"});};document.getElementById("btnDateToMs").onclick=function(){var v=document.getElementById("input").value.trim();var d=new Date(v);if(isNaN(d.getTime())){document.getElementById("result").textContent="请输入有效日期格式";return;}document.getElementById("result").textContent="毫秒:"+d.getTime()+"\\n秒:"+Math.floor(d.getTime()/1000);};document.getElementById("btnDateToSec").onclick=function(){var v=document.getElementById("input").value.trim();var d=new Date(v);if(isNaN(d.getTime())){document.getElementById("result").textContent="请输入有效日期格式";return;}document.getElementById("result").textContent="秒:"+Math.floor(d.getTime()/1000)+"\\n毫秒:"+d.getTime();};</script>')

# Case converter
set_fn('text/case.html', 'customHtml',
    '<div class="tool-card"><div class="breadcrumb">首页 / 文本工具 / 大小写转换</div><h1>大小写转换</h1><p>文本转大写、小写、首字母大写、驼峰等格式</p><div class="tool-card"><h3>输入文本</h3><textarea id="input" placeholder="输入需要转换的文本..." style="min-height:120px;width:100%;padding:.75rem;font-size:.9rem;border:1px solid var(--border);border-radius:8px;resize:vertical;background:var(--input-bg);color:var(--text);font-family:monospace;box-sizing:border-box"></textarea><div style="display:flex;gap:.5rem;flex-wrap:wrap;margin-top:.75rem"><button id="btnUpper" class="btn btn-primary">大写 UPPER</button><button id="btnLower" class="btn btn-primary">小写 lower</button><button id="btnTitle" class="btn btn-primary">首字母大写</button><button id="btnCamel" class="btn btn-primary">camelCase</button><button id="btnPascal" class="btn btn-primary">PascalCase</button><button id="btnSnake" class="btn btn-primary">snake_case</button><button id="btnKebab" class="btn btn-primary">kebab-case</button></div><h3 style="margin-top:1rem">结果</h3><div id="result" style="background:var(--output-bg);border:1px solid var(--border);border-radius:8px;padding:.75rem;min-height:80px;font-family:monospace;white-space:pre-wrap;word-break:break-all;color:var(--text)"></div></div></div><script>function convert(fn){document.getElementById("result").textContent=fn(document.getElementById("input").value);}function toTitle(s){return s.replace(/\\b\\w/g,function(c){return c.toUpperCase();});}function toCamel(s){var w=s.trim().split(/[_\\-\\s]+/);return w[0].toLowerCase()+w.slice(1).map(function(x){return x.charAt(0).toUpperCase()+x.slice(1).toLowerCase();}).join("");}function toPascal(s){return s.trim().split(/[_\\-\\s]+/).map(function(x){return x.charAt(0).toUpperCase()+x.slice(1).toLowerCase();}).join("");}function toSnake(s){return s.trim().replace(/[_\\-\\s]+/g,"_").replace(/([a-z])([A-Z])/g,"$1_$2").toLowerCase();}function toKebab(s){return s.trim().replace(/[_\\-\\s]+/g,"-").replace(/([a-z])([A-Z])/g,"$1-$2").toLowerCase();}document.getElementById("btnUpper").onclick=function(){convert(function(s){return s.toUpperCase();});};document.getElementById("btnLower").onclick=function(){convert(function(s){return s.toLowerCase();});};document.getElementById("btnTitle").onclick=function(){convert(toTitle);};document.getElementById("btnCamel").onclick=function(){convert(toCamel);};document.getElementById("btnPascal").onclick=function(){convert(toPascal);};document.getElementById("btnSnake").onclick=function(){convert(toSnake);};document.getElementById("btnKebab").onclick=function(){convert(toKebab);};</script>')

# Color picker
set_fn('code/color-picker.html', 'customHtml',
    '<div class="tool-card"><div class="breadcrumb">首页 / 开发工具 / 颜色选择器</div><h1>可视化颜色选择器</h1><p>选择颜色并获取 HEX、RGB、HSL 等格式代码</p><div class="tool-card"><div style="display:flex;gap:1rem;flex-wrap:wrap"><div><h3>拾取颜色</h3><input type="color" id="colorPicker" value="#6366f1" style="width:120px;height:120px;border:none;cursor:pointer;border-radius:8px"></div><div style="flex:1"><h3>颜色预览</h3><div id="colorPreview" style="width:100%;height:80px;border-radius:8px;background:#6366f1;border:1px solid var(--border);display:flex;align-items:center;justify-content:center;color:white;font-weight:bold;font-size:1.2rem;text-shadow:0 1px 3px rgba(0,0,0,0.5)">#6366f1</div></div></div><div style="display:grid;grid-template-columns:1fr 1fr;gap:.75rem;margin-top:1rem"><div><label style="font-size:.85rem;color:var(--text-secondary)">HEX</label><input id="outHex" readonly style="width:100%;padding:.5rem;border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);font-family:monospace;font-size:.85rem;box-sizing:border-box" value="#6366f1"></div><div><label style="font-size:.85rem;color:var(--text-secondary)">RGB</label><input id="outRgb" readonly style="width:100%;padding:.5rem;border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);font-family:monospace;font-size:.85rem;box-sizing:border-box" value="rgb(99, 102, 241)"></div><div><label style="font-size:.85rem;color:var(--text-secondary)">RGBA</label><input id="outRgba" readonly style="width:100%;padding:.5rem;border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);font-family:monospace;font-size:.85rem;box-sizing:border-box" value="rgba(99, 102, 241, 1)"></div><div><label style="font-size:.85rem;color:var(--text-secondary)">HSL</label><input id="outHsl" readonly style="width:100%;padding:.5rem;border:1px solid var(--border);border-radius:6px;background:var(--input-bg);color:var(--text);font-family:monospace;font-size:.85rem;box-sizing:border-box" value="hsl(239, 84%, 67%)"></div></div><button id="btnCopy" class="btn btn-primary" style="margin-top:1rem">复制 HEX</button></div></div><script>function hexToRgb(hex){var r=/^#?([a-f\\d]{2})([a-f\\d]{2})([a-f\\d]{2})$/i.exec(hex);return r?{r:parseInt(r[1],16),g:parseInt(r[2],16),b:parseInt(r[3],16)}:null;}function rgbToHsl(r,g,b){r/=255;g/=255;b/=255;var max=Math.max(r,g,b),min=Math.min(r,g,b),h,s,l=(max+min)/2;if(max===min){h=s=0;}else{var d=max-min;s=l>.5?d/(2-max-min):d/(max+min);switch(max){case r:h=((g-b)/d+(g<b?6:0))/6;break;case g:h=((b-r)/d+2)/6;break;case b:h=((r-g)/d+4)/6;break;}h/=6;}return{h:Math.round(h*360),s:Math.round(s*100),l:Math.round(l*100)};}function updateColor(hex){var rgb=hexToRgb(hex);if(!rgb)return;var hsl=rgbToHsl(rgb.r,rgb.g,rgb.b);var pv=document.getElementById("colorPreview");pv.style.background=hex;pv.textContent=hex;document.getElementById("outHex").value=hex;document.getElementById("outRgb").value="rgb("+rgb.r+", "+rgb.g+", "+rgb.b+")";document.getElementById("outRgba").value="rgba("+rgb.r+", "+rgb.g+", "+rgb.b+", 1)";document.getElementById("outHsl").value="hsl("+hsl.h+", "+hsl.s+"%, "+hsl.l+"%)";pv.style.color=(hsl.l>50)?"#000":"#fff";}document.getElementById("colorPicker").oninput=function(){updateColor(this.value);};document.getElementById("btnCopy").onclick=function(){navigator.clipboard.writeText(document.getElementById("outHex").value);};</script>')

# Cron parser
with open('extra_custom.json') as f:
    extra = json.load(f)
set_fn('code/cron-parser.html', 'customHtml', extra['cron-parser'])

# Save
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(data, f, ensure_ascii=False, indent=2)
print('\nAll fixes applied and saved!')
