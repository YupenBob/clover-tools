import json

with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'r') as f:
    tools = json.load(f)

cat_map = {}
for i, cat in enumerate(tools):
    cat_map[cat['category']] = i

def get_or_create(name):
    if name in cat_map:
        return tools[cat_map[name]]['tools']
    new_cat = {'category': name, 'tools': []}
    tools.append(new_cat)
    cat_map[name] = len(tools) - 1
    return new_cat['tools']

other = get_or_create('其他工具')
fmt = get_or_create('格式转换')
life = get_or_create('生活实用')
dev = get_or_create('开发工具')

# --- t6: 常用浏览器User-Agent ---
ua_data = [
    {"browser": "Chrome (Windows)", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "platform": "Windows"},
    {"browser": "Chrome (macOS)", "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36", "platform": "macOS"},
    {"browser": "Firefox (Windows)", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0", "platform": "Windows"},
    {"browser": "Firefox (macOS)", "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0", "platform": "macOS"},
    {"browser": "Safari (macOS)", "ua": "Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Safari/605.1.15", "platform": "macOS"},
    {"browser": "Safari (iOS)", "ua": "Mozilla/5.0 (iPhone; CPU iPhone OS 17_2 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.2 Mobile/15E148 Safari/604.1", "platform": "iOS"},
    {"browser": "Edge (Windows)", "ua": "Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36 Edg/120.0.0.0", "platform": "Windows"},
    {"browser": "Chrome (Android)", "ua": "Mozilla/5.0 (Linux; Android 10; K) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Mobile Safari/537.36", "platform": "Android"},
    {"browser": "Googlebot", "ua": "Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)", "platform": "Bot"},
    {"browser": "Bingbot", "ua": "Mozilla/5.0 (compatible; bingbot/2.0; +http://www.bing.com/bingbot.htm)", "platform": "Bot"},
    {"browser": "百度爬虫", "ua": "Mozilla/5.0 (compatible; Baiduspider/2.0; +http://www.baidu.com/search/spider.html)", "platform": "Bot"},
    {"browser": "360搜索", "ua": "Mozilla/5.0 (compatible;360spider; +http://360.cn/se/spider.htm)", "platform": "Bot"},
    {"browser": "搜狗爬虫", "ua": "Mozilla/5.0 (compatible; Sogou web spider/4.0; +http://www.sogou.com/docs/help/web.htm)", "platform": "Bot"},
    {"browser": "微信内置浏览器", "ua": "Mozilla/5.0 (Linux; Android 10; diversito builds) AppleWebKit/537.36 (KHTML, like Gecko) Version/4.0 Chrome/87.0.4280.141 Mobile Safari/537.36 MicroMessenger/8.0.0(0x28000038) NetType/WIFI Language/zh_CN", "platform": "Mobile"},
]

rf_ua = "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { return '<tr><td><strong>' + r.browser + '</strong><br><span class=\"badge bg-secondary me-1\">' + r.platform + '</span></td><td class=\"font-monospace small text-break\">' + r.ua + '</td><td><button class=\"btn btn-sm btn-outline-primary copy-btn\" data-copy=\"' + r.ua.replace(/\"/g, '&quot;') + '\">复制</button></td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>浏览器</th><th>User-Agent</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.browser.toLowerCase().includes(s) || r.ua.toLowerCase().includes(s) || r.platform.toLowerCase().includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { return '<tr><td><strong>' + r.browser + '</strong><br><span class=\"badge bg-secondary me-1\">' + r.platform + '</span></td><td class=\"font-monospace small text-break\">' + r.ua + '</td><td><button class=\"btn btn-sm btn-outline-primary copy-btn\" data-copy=\"' + r.ua.replace(/\"/g, '&quot;') + '\">复制</button></td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>浏览器</th><th>User-Agent</th><th>操作</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"

other.append({"name": "常用浏览器User-Agent", "path": "other/常用浏览器User-Agent.html", "category": "其他工具", "type": "query", "desc": "收录常用浏览器、搜索引擎爬虫、移动端 WebView 的 User-Agent 字符串，方便开发调试、请求模拟与数据采集。", "keywords": ["User-Agent", "UA", "浏览器标识", "爬虫UA", "user agent"], "title": "常用浏览器User-Agent大全 - 开发调试必备", "description": "收录Chrome、Firefox、Safari、Edge及主流爬虫的User-Agent字符串，支持一键复制", "icon": "bi bi-browser-chrome", "searchable": True, "data": ua_data, "renderFn": rf_ua})
print("Added 常用浏览器User-Agent")

# --- t7: 特殊符号大全 ---
symbol_data = [
    {"symbol": "\u2605", "name": "黑星", "category": "符号", "desc": "实心星形"},
    {"symbol": "\u2665", "name": "红心", "category": "符号", "desc": "实心红心符号"},
    {"symbol": "\u2666", "name": "方块", "category": "符号", "desc": "实心方块"},
    {"symbol": "\u2663", "name": "黑桃", "category": "符号", "desc": "黑桃符号"},
    {"symbol": "\u2660", "name": "黑心", "category": "符号", "desc": "黑心（黑桃色）"},
    {"symbol": "\u266a", "name": "音符", "category": "符号", "desc": "八分音符"},
    {"symbol": "\u2600", "name": "太阳", "category": "符号", "desc": "太阳符号"},
    {"symbol": "\u263a", "name": "笑脸", "category": "符号", "desc": "白色笑脸"},
    {"symbol": "\u2639", "name": "苦脸", "category": "符号", "desc": "白色苦脸"},
    {"symbol": "\u2603", "name": "雪人", "category": "符号", "desc": "雪人符号"},
    {"symbol": "\u2714", "name": "勾", "category": "符号", "desc": "粗体对勾"},
    {"symbol": "\u2716", "name": "叉", "category": "符号", "desc": "粗体叉号"},
    {"symbol": "\u2713", "name": "勾选", "category": "符号", "desc": "对勾"},
    {"symbol": "\u25a0", "name": "黑方块", "category": "符号", "desc": "实心黑色方块"},
    {"symbol": "\u25a1", "name": "白方块", "category": "符号", "desc": "空心白色方块"},
    {"symbol": "\u25cf", "name": "黑圆点", "category": "符号", "desc": "实心黑色圆"},
    {"symbol": "\u25cb", "name": "白圆点", "category": "符号", "desc": "空心白色圆"},
    {"symbol": "\u25c6", "name": "菱形", "category": "符号", "desc": "实心菱形"},
    {"symbol": "\u25c7", "name": "白菱形", "category": "符号", "desc": "空心菱形"},
    {"symbol": "\u25b2", "name": "黑三角", "category": "符号", "desc": "实心向上三角"},
    {"symbol": "\u25b6", "name": "黑三角右", "category": "符号", "desc": "实心向右三角"},
    {"symbol": "\u25c0", "name": "黑三角左", "category": "符号", "desc": "实心向左三角"},
    {"symbol": "\u25bc", "name": "黑三角下", "category": "符号", "desc": "实心向下三角"},
    {"symbol": "\u2190", "name": "左箭头", "category": "箭头", "desc": "向左箭头"},
    {"symbol": "\u2191", "name": "上箭头", "category": "箭头", "desc": "向上箭头"},
    {"symbol": "\u2192", "name": "右箭头", "category": "箭头", "desc": "向右箭头"},
    {"symbol": "\u2193", "name": "下箭头", "category": "箭头", "desc": "向下箭头"},
    {"symbol": "\u2194", "name": "双箭头", "category": "箭头", "desc": "左右双向箭头"},
    {"symbol": "\u2195", "name": "上下箭头", "category": "箭头", "desc": "上下双向箭头"},
    {"symbol": "\u2196", "name": "左上", "category": "箭头", "desc": "向左上箭头"},
    {"symbol": "\u2197", "name": "右上", "category": "箭头", "desc": "向右上箭头"},
    {"symbol": "\u2198", "name": "右下", "category": "箭头", "desc": "向右下箭头"},
    {"symbol": "\u2199", "name": "左下", "category": "箭头", "desc": "向左下箭头"},
    {"symbol": "\u00a9", "name": "版权", "category": "符号", "desc": "版权符号"},
    {"symbol": "\u00ae", "name": "注册", "category": "符号", "desc": "注册商标符号"},
    {"symbol": "\u2122", "name": "商标", "category": "符号", "desc": "商标符号"},
    {"symbol": "\u00b0", "name": "度", "category": "符号", "desc": "度数符号"},
    {"symbol": "\u00b1", "name": "加减", "category": "符号", "desc": "正负号"},
    {"symbol": "\u00d7", "name": "乘", "category": "符号", "desc": "乘号"},
    {"symbol": "\u00f7", "name": "除", "category": "符号", "desc": "除号"},
    {"symbol": "\u2260", "name": "不等于", "category": "符号", "desc": "不等于号"},
    {"symbol": "\u2264", "name": "小于等于", "category": "符号", "desc": "小于等于号"},
    {"symbol": "\u2265", "name": "大于等于", "category": "符号", "desc": "大于等于号"},
    {"symbol": "\u221e", "name": "无穷", "category": "符号", "desc": "无穷大符号"},
    {"symbol": "\u03b1", "name": "alpha", "category": "希腊字母", "desc": "希腊字母α"},
    {"symbol": "\u03b2", "name": "beta", "category": "希腊字母", "desc": "希腊字母β"},
    {"symbol": "\u03b3", "name": "gamma", "category": "希腊字母", "desc": "希腊字母γ"},
    {"symbol": "\u03b4", "name": "delta", "category": "希腊字母", "desc": "希腊字母δ"},
    {"symbol": "\u03b5", "name": "epsilon", "category": "希腊字母", "desc": "希腊字母ε"},
    {"symbol": "\u03b8", "name": "theta", "category": "希腊字母", "desc": "希腊字母θ"},
    {"symbol": "\u03bb", "name": "lambda", "category": "希腊字母", "desc": "希腊字母λ"},
    {"symbol": "\u03bc", "name": "mu", "category": "希腊字母", "desc": "希腊字母μ"},
    {"symbol": "\u03bd", "name": "nu", "category": "希腊字母", "desc": "希腊字母ν"},
    {"symbol": "\u03be", "name": "xi", "category": "希腊字母", "desc": "希腊字母ξ"},
    {"symbol": "\u03c0", "name": "pi", "category": "希腊字母", "desc": "希腊字母π"},
    {"symbol": "\u03c3", "name": "sigma", "category": "希腊字母", "desc": "希腊字母σ"},
    {"symbol": "\u03c4", "name": "tau", "category": "希腊字母", "desc": "希腊字母τ"},
    {"symbol": "\u03c5", "name": "upsilon", "category": "希腊字母", "desc": "希腊字母υ"},
    {"symbol": "\u03c6", "name": "phi", "category": "希腊字母", "desc": "希腊字母φ"},
    {"symbol": "\u03c7", "name": "chi", "category": "希腊字母", "desc": "希腊字母χ"},
    {"symbol": "\u03c8", "name": "psi", "category": "希腊字母", "desc": "希腊字母ψ"},
    {"symbol": "\u03c9", "name": "omega", "category": "希腊字母", "desc": "希腊字母ω"},
]

rf_sym = "function(data, search) { var rows = ''; if (!search || search.trim() === '') { rows = data.map(function(r) { return '<div class=\"col-4 col-md-3 col-lg-2 mb-2\"><button class=\"btn btn-light w-100 py-2 symbol-btn\" data-symbol=\"' + r.symbol + '\"><span class=\"fs-4\">' + r.symbol + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div><span class=\"badge bg-secondary mt-1\">' + r.category + '</span></button></div>'; }).join(''); } else { var s = search.toLowerCase(); var f = data.filter(function(r) { return r.name.includes(s) || r.category.includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>' + f.map(function(r) { return '<div class=\"col-4 col-md-3 col-lg-2 mb-2\"><button class=\"btn btn-light w-100 py-2 symbol-btn\" data-symbol=\"' + r.symbol + '\"><span class=\"fs-4\">' + r.symbol + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div><span class=\"badge bg-secondary mt-1\">' + r.category + '</span></button></div>'; }).join(''); } return '<div class=\"row\">' + rows + '</div>'; }"

other.append({"name": "特殊符号大全", "path": "other/特殊符号大全.html", "category": "其他工具", "type": "query", "desc": "收录各种特殊符号，包括星星、心形、箭头、数学符号、希腊字母等，支持按分类筛选与关键词搜索，一键复制使用。", "keywords": ["特殊符号", "符号大全", "箭头符号", "数学符号", "希腊字母"], "title": "特殊符号大全 - 符号查找与复制", "description": "收录100+常用特殊符号，包括星星、心形、箭头、数学符号、希腊字母等，支持一键复制", "icon": "bi bi-arrow-up-right-square", "searchable": True, "data": symbol_data, "renderFn": rf_sym})
print("Added 特殊符号大全")

# --- t8: 键盘按键值大全 ---
key_data = [
    {"key": "Backspace", "code": "BackSpace", "keyCode": "8", "desc": "退格键"},
    {"key": "Tab", "code": "Tab", "keyCode": "9", "desc": "Tab 键"},
    {"key": "Enter", "code": "Enter", "keyCode": "13", "desc": "回车键"},
    {"key": "Shift", "code": "ShiftLeft / ShiftRight", "keyCode": "16", "desc": "Shift 键"},
    {"key": "Control", "code": "ControlLeft / ControlRight", "keyCode": "17", "desc": "Ctrl 键"},
    {"key": "Alt", "code": "AltLeft / AltRight", "keyCode": "18", "desc": "Alt 键"},
    {"key": "Escape", "code": "Escape", "keyCode": "27", "desc": "退出键"},
    {"key": "Space", "code": "Space", "keyCode": "32", "desc": "空格键"},
    {"key": "Page Up", "code": "PageUp", "keyCode": "33", "desc": "向上翻页"},
    {"key": "Page Down", "code": "PageDown", "keyCode": "34", "desc": "向下翻页"},
    {"key": "End", "code": "End", "keyCode": "35", "desc": "End 键"},
    {"key": "Home", "code": "Home", "keyCode": "36", "desc": "Home 键"},
    {"key": "Left Arrow", "code": "ArrowLeft", "keyCode": "37", "desc": "左方向键"},
    {"key": "Up Arrow", "code": "ArrowUp", "keyCode": "38", "desc": "上方向键"},
    {"key": "Right Arrow", "code": "ArrowRight", "keyCode": "39", "desc": "右方向键"},
    {"key": "Down Arrow", "code": "ArrowDown", "keyCode": "40", "desc": "下方向键"},
    {"key": "Insert", "code": "Insert", "keyCode": "45", "desc": "插入键"},
    {"key": "Delete", "code": "Delete", "keyCode": "46", "desc": "删除键"},
    {"key": "0", "code": "Digit0", "keyCode": "48", "desc": "数字 0"},
    {"key": "9", "code": "Digit9", "keyCode": "57", "desc": "数字 9"},
    {"key": "A", "code": "KeyA", "keyCode": "65", "desc": "字母 A"},
    {"key": "Z", "code": "KeyZ", "keyCode": "90", "desc": "字母 Z"},
    {"key": "Numpad 0", "code": "Numpad0", "keyCode": "96", "desc": "数字小键盘 0"},
    {"key": "Numpad 9", "code": "Numpad9", "keyCode": "105", "desc": "数字小键盘 9"},
    {"key": "Numpad *", "code": "NumpadMultiply", "keyCode": "106", "desc": "数字小键盘 *"},
    {"key": "Numpad +", "code": "NumpadAdd", "keyCode": "107", "desc": "数字小键盘 +"},
    {"key": "Numpad -", "code": "NumpadSubtract", "keyCode": "109", "desc": "数字小键盘 -"},
    {"key": "Numpad .", "code": "NumpadDecimal", "keyCode": "110", "desc": "数字小键盘 ."},
    {"key": "Numpad /", "code": "NumpadDivide", "keyCode": "111", "desc": "数字小键盘 /"},
    {"key": "F1", "code": "F1", "keyCode": "112", "desc": "功能键 F1"},
    {"key": "F12", "code": "F12", "keyCode": "123", "desc": "功能键 F12"},
    {"key": ";", "code": "Semicolon", "keyCode": "186", "desc": "分号键"},
    {"key": "=", "code": "Equal", "keyCode": "187", "desc": "等号键"},
    {"key": ",", "code": "Comma", "keyCode": "188", "desc": "逗号键"},
    {"key": "-", "code": "Minus", "keyCode": "189", "desc": "减号键"},
    {"key": ".", "code": "Period", "keyCode": "190", "desc": "句号键"},
    {"key": "/", "code": "Slash", "keyCode": "191", "desc": "斜杠键"},
    {"key": "`", "code": "Backquote", "keyCode": "192", "desc": "反引号键"},
    {"key": "[", "code": "BracketLeft", "keyCode": "219", "desc": "左方括号键"},
    {"key": "\\", "code": "Backslash", "keyCode": "220", "desc": "反斜杠键"},
    {"key": "]", "code": "BracketRight", "keyCode": "221", "desc": "右方括号键"},
    {"key": "'", "code": "Quote", "keyCode": "222", "desc": "单引号键"},
]

rf_key = "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\"><kbd>' + r.key + '</kbd></td><td class=\"font-monospace text-muted small\">' + r.code + '</td><td class=\"font-monospace text-muted\">' + r.keyCode + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>按键</th><th>code</th><th>keyCode</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.key.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.keyCode.includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\"><kbd>' + r.key + '</kbd></td><td class=\"font-monospace text-muted small\">' + r.code + '</td><td class=\"font-monospace text-muted\">' + r.keyCode + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>按键</th><th>code</th><th>keyCode</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"

other.append({"name": "键盘按键值大全", "path": "other/键盘按键值大全.html", "category": "其他工具", "type": "query", "desc": "完整的键盘按键 keyCode、code、key 对照表，涵盖字母、数字、功能键、方向键与小键盘，方便 JavaScript 事件监听开发。", "keywords": ["键盘按键", "keyCode", "key", "键盘事件", "JavaScript keyCode"], "title": "键盘按键值大全 - JavaScript 键盘事件参考", "description": "在线键盘按键值查询表，涵盖字母、数字、功能键、小键盘的keyCode、code对照，适用于JS开发", "icon": "bi bi-keyboard", "searchable": True, "data": key_data, "renderFn": rf_key})
print("Added 键盘按键值大全")

# --- t9: 图片转PDF ---
fmt.append({"name": "图片转PDF", "path": "format-conversion/图片转PDF.html", "category": "格式转换", "type": "format-convert", "desc": "将多张图片文件批量转换为 PDF 文档，支持 JPG、PNG、WebP、GIF 等常见格式，可自定义页面顺序与尺寸。", "keywords": ["图片转PDF", "PNG转PDF", "JPEG转PDF", "批量转PDF"], "title": "图片转PDF - 多图合并为PDF文档", "description": "在线将多张图片批量转换为PDF文档，支持JPG/PNG/WebP/GIF格式，可自定义页面顺序和尺寸", "icon": "bi bi-file-earmark-pdf-fill", "acceptTypes": "image/jpeg,image/jpg,image/png,image/webp,image/gif", "outputFormats": [{"value": "pdf", "label": "PDF"}]})
print("Added 图片转PDF")

# --- t10: 条形码生成器 ---
rf_barcode = "function(inputs) { var data = inputs.data || ''; var fmt = inputs.format || 'ean13'; var w = parseInt(inputs.width) || 200; var h = parseInt(inputs.height) || 100; if (!data) return '<div class=\"alert alert-warning\">请输入编码内容</div>'; var url = 'https://barcodeapi.org/api/' + fmt + '/' + encodeURIComponent(data); return '<div class=\"text-center\"><img src=\"' + url + '\" width=\"' + w + '\" height=\"' + h + '\" class=\"border rounded\" alt=\"barcode\"/><br><a href=\"' + url + '\" download=\"barcode.png\" class=\"btn btn-primary mt-2\">下载 PNG</a></div>'; }"

life.append({"name": "条形码生成器", "path": "life/条形码生成器.html", "category": "生活实用", "type": "generator", "desc": "在线生成各种规格的条形码，支持 EAN-13、EAN-8、UPC-A、Code 128、Code 39 等多种格式，一键下载 PNG 图片。", "keywords": ["条形码", "条形码生成", "barcode", "EAN", "UPC", "Code128"], "title": "条形码生成器 - 条形码制作工具", "description": "在线生成条形码，支持EAN-13/UPC-A/Code128/Code39等多种格式，一键下载PNG图片", "icon": "bi bi-barcode", "fields": [{"id": "data", "label": "内容/编码", "type": "text", "placeholder": "输入要编码的数据"}, {"id": "format", "label": "条形码格式", "type": "select", "options": [{"value": "ean13", "label": "EAN-13（商品条形码）"}, {"value": "ean8", "label": "EAN-8"}, {"value": "upca", "label": "UPC-A"}, {"value": "code128", "label": "Code 128"}, {"value": "code39", "label": "Code 39"}, {"value": "codabar", "label": "Codabar"}]}, {"id": "width", "label": "条形码宽度(px)", "type": "number", "placeholder": "200", "default": "200"}, {"id": "height", "label": "条形码高度(px)", "type": "number", "placeholder": "100", "default": "100"}], "btnLabel": "生成条形码", "generateFn": rf_barcode})
print("Added 条形码生成器")

# --- t11: 二维码生成 ---
rf_qr = "function(inputs) { var data = inputs.data || 'https://clover.tools'; var size = parseInt(inputs.size) || 200; var color = inputs.color || '#000000'; var bg = inputs.bgcolor || '#ffffff'; var level = inputs.level || 'M'; var url = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(data) + '&color=' + color.replace('#','') + '&bgcolor=' + bg.replace('#','') + '&ecc=' + level; return '<div class=\"text-center\"><img src=\"' + url + '\" width=\"' + size + '\" height=\"' + size + '\" class=\"border rounded\" alt=\"qrcode\"/><br><a href=\"' + url + '\" download=\"qrcode.png\" class=\"btn btn-primary mt-2\">下载 PNG</a></div>'; }"

life.append({"name": "二维码生成", "path": "life/二维码生成.html", "category": "生活实用", "type": "generator", "desc": "在线生成高清二维码，支持自定义尺寸、容错级别与颜色，可输入文本、URL、邮箱、电话等信息，一键下载 PNG。", "keywords": ["二维码", "QR码", "二维码生成", "QR code", "qrcode"], "title": "二维码生成器 - 在线制作二维码", "description": "在线生成二维码，支持自定义尺寸、颜色、容错级别，一键下载PNG图片", "icon": "bi bi-qr-code", "fields": [{"id": "data", "label": "内容", "type": "textarea", "placeholder": "输入二维码内容（文本、网址、电话等）"}, {"id": "size", "label": "尺寸(px)", "type": "number", "placeholder": "200", "default": "200"}, {"id": "color", "label": "前景色", "type": "text", "placeholder": "#000000", "default": "#000000"}, {"id": "bgcolor", "label": "背景色", "type": "text", "placeholder": "#ffffff", "default": "#ffffff"}, {"id": "level", "label": "容错级别", "type": "select", "options": [{"value": "L", "label": "L (7%)"}, {"value": "M", "label": "M (15%)"}, {"value": "Q", "label": "Q (25%)"}, {"value": "H", "label": "H (30%)"}], "default": "M"}], "btnLabel": "生成二维码", "generateFn": rf_qr})
print("Added 二维码生成")

with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)
print("Saved t6-t11")