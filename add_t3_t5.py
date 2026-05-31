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

# --- t3: HTML转义字符对照表 ---
html_data = [
    {"entity": "&quot;", "char": '"', "decimal": "&#34;", "desc": "双引号"},
    {"entity": "&amp;", "char": "&", "decimal": "&#38;", "desc": "和号"},
    {"entity": "&lt;", "char": "<", "decimal": "&#60;", "desc": "小于号"},
    {"entity": "&gt;", "char": ">", "decimal": "&#62;", "desc": "大于号"},
    {"entity": "&nbsp;", "char": " ", "decimal": "&#160;", "desc": "不换行空格"},
    {"entity": "&iexcl;", "char": "\u00a1", "decimal": "&#161;", "desc": "反感叹号"},
    {"entity": "&cent;", "char": "\u00a2", "decimal": "&#162;", "desc": "分"},
    {"entity": "&pound;", "char": "\u00a3", "decimal": "&#163;", "desc": "英镑"},
    {"entity": "&curren;", "char": "\u00a4", "decimal": "&#164;", "desc": "货币"},
    {"entity": "&yen;", "char": "\u00a5", "decimal": "&#165;", "desc": "人民币"},
    {"entity": "&brvbar;", "char": "\u00a6", "decimal": "&#166;", "desc": "断竖线"},
    {"entity": "&sect;", "char": "\u00a7", "decimal": "&#167;", "desc": "章节"},
    {"entity": "&copy;", "char": "\u00a9", "decimal": "&#169;", "desc": "版权"},
    {"entity": "&laquo;", "char": "\u00ab", "decimal": "&#171;", "desc": "左双书名号"},
    {"entity": "&not;", "char": "\u00ac", "decimal": "&#172;", "desc": "逻辑非"},
    {"entity": "&shy;", "char": "\u00ad", "decimal": "&#173;", "desc": "软连字符"},
    {"entity": "&reg;", "char": "\u00ae", "decimal": "&#174;", "desc": "注册商标"},
    {"entity": "&deg;", "char": "\u00b0", "decimal": "&#176;", "desc": "度"},
    {"entity": "&plusmn;", "char": "\u00b1", "decimal": "&#177;", "desc": "正负号"},
    {"entity": "&sup2;", "char": "\u00b2", "decimal": "&#178;", "desc": "上标2"},
    {"entity": "&sup3;", "char": "\u00b3", "decimal": "&#179;", "desc": "上标3"},
    {"entity": "&micro;", "char": "\u00b5", "decimal": "&#181;", "desc": "微"},
    {"entity": "&para;", "char": "\u00b6", "decimal": "&#182;", "desc": "段落"},
    {"entity": "&middot;", "char": "\u00b7", "decimal": "&#183;", "desc": "中点"},
    {"entity": "&sup1;", "char": "\u00b9", "decimal": "&#185;", "desc": "上标1"},
    {"entity": "&raquo;", "char": "\u00bb", "decimal": "&#187;", "desc": "右双书名号"},
    {"entity": "&frac14;", "char": "\u00bc", "decimal": "&#188;", "desc": "四分之一"},
    {"entity": "&frac12;", "char": "\u00bd", "decimal": "&#189;", "desc": "二分之一"},
    {"entity": "&frac34;", "char": "\u00be", "decimal": "&#190;", "desc": "四分之三"},
    {"entity": "&times;", "char": "\u00d7", "decimal": "&#215;", "desc": "乘号"},
    {"entity": "&divide;", "char": "\u00f7", "decimal": "&#247;", "desc": "除号"},
    {"entity": "&ndash;", "char": "\u2013", "decimal": "&#8211;", "desc": "短破折号"},
    {"entity": "&mdash;", "char": "\u2014", "decimal": "&#8212;", "desc": "长破折号"},
    {"entity": "&lsquo;", "char": "\u2018", "decimal": "&#8216;", "desc": "左单引号"},
    {"entity": "&rsquo;", "char": "\u2019", "decimal": "&#8217;", "desc": "右单引号"},
    {"entity": "&ldquo;", "char": "\u201c", "decimal": "&#8220;", "desc": "左双引号"},
    {"entity": "&rdquo;", "char": "\u201d", "decimal": "&#8221;", "desc": "右双引号"},
    {"entity": "&bull;", "char": "\u2022", "decimal": "&#8226;", "desc": "圆点"},
    {"entity": "&hellip;", "char": "\u2026", "decimal": "&#8230;", "desc": "省略号"},
    {"entity": "&trade;", "char": "\u2122", "decimal": "&#8482;", "desc": "商标"},
    {"entity": "&larr;", "char": "\u2190", "decimal": "&#8592;", "desc": "左箭头"},
    {"entity": "&uarr;", "char": "\u2191", "decimal": "&#8593;", "desc": "上箭头"},
    {"entity": "&rarr;", "char": "\u2192", "decimal": "&#8594;", "desc": "右箭头"},
    {"entity": "&darr;", "char": "\u2193", "decimal": "&#8595;", "desc": "下箭头"},
    {"entity": "&harr;", "char": "\u2194", "decimal": "&#8596;", "desc": "双向箭头"},
]

rf_html = "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { return '<tr><td class=\"font-monospace\"><button class=\"btn btn-sm btn-outline-primary copy-btn\" data-copy=\"' + r.entity + '\">' + r.entity + '</button></td><td class=\"font-monospace fs-5\">' + r.char + '</td><td class=\"font-monospace text-muted\">' + r.decimal + '</td><td>' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>实体</th><th>字符</th><th>十进制</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.entity.includes(s) || r.char.includes(s) || r.desc.includes(s) || r.decimal.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { return '<tr><td class=\"font-monospace\"><button class=\"btn btn-sm btn-outline-primary copy-btn\" data-copy=\"' + r.entity + '\">' + r.entity + '</button></td><td class=\"font-monospace fs-5\">' + r.char + '</td><td class=\"font-monospace text-muted\">' + r.decimal + '</td><td>' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>实体</th><th>字符</th><th>十进制</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"

other.append({"name": "HTML转义字符对照表", "path": "other/HTML转义字符对照表.html", "category": "其他工具", "type": "query", "desc": "完整的 HTML 特殊字符转义对照表，包含符号、箭头、数学符号、希腊字母等，支持搜索，方便网页开发与内容编辑。", "keywords": ["HTML转义", "HTML实体", "转义字符", "HTML编码", "特殊字符"], "title": "HTML转义字符对照表 - 网页开发必备", "description": "在线HTML转义字符对照表，涵盖常用符号、箭头、数学符号、希腊字母等，支持搜索复制", "icon": "bi bi-code-slash", "searchable": True, "data": html_data, "renderFn": rf_html})
print("Added HTML转义字符对照表")

# --- t4: HTTP协议状态码 ---
http_data = [
    {"code": "100", "name": "Continue", "desc": "继续。客户端应继续其请求"},
    {"code": "101", "name": "Switching Protocols", "desc": "切换协议。服务器根据客户端的请求切换协议"},
    {"code": "200", "name": "OK", "desc": "请求成功。一般用于GET与POST请求"},
    {"code": "201", "name": "Created", "desc": "已创建。成功请求并创建了新的资源"},
    {"code": "202", "name": "Accepted", "desc": "已接受。已经接受请求，但未处理完成"},
    {"code": "204", "name": "No Content", "desc": "无内容。服务器成功处理，但未返回内容"},
    {"code": "301", "name": "Moved Permanently", "desc": "永久移动。请求的资源已永久移动到新位置"},
    {"code": "302", "name": "Found", "desc": "临时移动。资源暂时被移动，客户端继续使用原有URI"},
    {"code": "304", "name": "Not Modified", "desc": "未修改。自从上次请求后，请求的资源未修改"},
    {"code": "400", "name": "Bad Request", "desc": "客户端请求的语法错误，服务器无法理解"},
    {"code": "401", "name": "Unauthorized", "desc": "请求要求用户的身份认证"},
    {"code": "403", "name": "Forbidden", "desc": "服务器理解请求，但拒绝执行它"},
    {"code": "404", "name": "Not Found", "desc": "服务器无法根据客户端的请求找到资源"},
    {"code": "405", "name": "Method Not Allowed", "desc": "请求方法不被允许"},
    {"code": "500", "name": "Internal Server Error", "desc": "服务器内部错误，无法完成请求"},
    {"code": "501", "name": "Not Implemented", "desc": "服务器不支持请求的功能，无法完成请求"},
    {"code": "502", "name": "Bad Gateway", "desc": "作为网关或代理的服务器尝试执行请求时收到无效响应"},
    {"code": "503", "name": "Service Unavailable", "desc": "服务器由于临时的超载或维护无法处理请求"},
    {"code": "504", "name": "Gateway Time-out", "desc": "网关或代理服务器未能及时收到上游服务器的请求"},
]

rf_http = "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { var cls = r.code.startsWith('2') ? 'table-success' : r.code.startsWith('3') ? 'table-warning' : r.code.startsWith('4') || r.code.startsWith('5') ? 'table-danger' : 'table-info'; return '<tr class=\"' + cls + '\"><td class=\"font-monospace fw-bold\">' + r.code + '</td><td>' + r.name + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm\"><thead><tr><th>状态码</th><th>名称</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.code.includes(s) || r.name.toLowerCase().includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { var cls = r.code.startsWith('2') ? 'table-success' : r.code.startsWith('3') ? 'table-warning' : r.code.startsWith('4') || r.code.startsWith('5') ? 'table-danger' : 'table-info'; return '<tr class=\"' + cls + '\"><td class=\"font-monospace fw-bold\">' + r.code + '</td><td>' + r.name + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm\"><thead><tr><th>状态码</th><th>名称</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"

other.append({"name": "HTTP协议状态码", "path": "other/HTTP协议状态码.html", "category": "其他工具", "type": "query", "desc": "完整的 HTTP 状态码参考表，涵盖 1xx-5xx 所有常用状态码，附带详细说明与使用场景，是 Web 开发与 API 调试的必备工具。", "keywords": ["HTTP状态码", "HTTP状态", "状态码", "HTTP响应码", "HTTP code"], "title": "HTTP协议状态码 - HTTP Response Code Reference", "description": "在线HTTP协议状态码对照表，涵盖1xx-5xx所有常用状态码及详细说明", "icon": "bi bi-globe2", "searchable": True, "data": http_data, "renderFn": rf_http})
print("Added HTTP协议状态码")

# --- t5: robots文件生成器 ---
rf_robots = "function(inputs) { var lines = ['User-agent: ' + (inputs.userAgent || '*'), '']; if (inputs.crawlDelay) lines.push('Crawl-delay: ' + inputs.crawlDelay); lines.push(''); if (inputs.sitemap) lines.push('Sitemap: ' + inputs.sitemap); lines.push(''); if (inputs.allowPaths) { var allows = inputs.allowPaths.split('\\n').filter(function(p) { return p.trim(); }); allows.forEach(function(p) { lines.push('Allow: ' + p.trim()); }); lines.push(''); } if (inputs.disallowPaths) { var disallows = inputs.disallowPaths.split('\\n').filter(function(p) { return p.trim(); }); disallows.forEach(function(p) { lines.push('Disallow: ' + p.trim()); }); } return '# robots.txt generated by CloverTools\\n' + lines.join('\\n'); }"

other.append({"name": "robots文件生成器", "path": "other/robots文件生成器.html", "category": "其他工具", "type": "generator", "desc": "可视化生成 robots.txt 配置文件，支持自定义允许/禁止规则、sitemap 路径、Crawl-delay 等参数，一键复制即用。", "keywords": ["robots.txt", "robots生成器", "搜索引擎爬虫", "网站规则"], "title": "robots.txt 文件生成器 - SEO必备工具", "description": "在线生成robots.txt配置文件，支持自定义爬虫规则，允许/禁止路径，sitemap地址等", "icon": "bi bi-robot", "fields": [{"id": "domain", "label": "网站域名", "type": "text", "placeholder": "https://example.com"}, {"id": "allowPaths", "label": "允许爬取的路径（一行一个）", "type": "textarea", "placeholder": "/public\\n/css\\n/js"}, {"id": "disallowPaths", "label": "禁止爬取的路径（一行一个）", "type": "textarea", "placeholder": "/admin\\n/private\\n*.php"}, {"id": "sitemap", "label": "Sitemap 地址", "type": "text", "placeholder": "https://example.com/sitemap.xml"}, {"id": "crawlDelay", "label": "爬取延迟（秒）", "type": "number", "placeholder": "10"}, {"id": "userAgent", "label": "指定爬虫（留空表示所有）", "type": "text", "placeholder": "Googlebot"}], "btnLabel": "生成 robots.txt", "generateFn": rf_robots})
print("Added robots文件生成器")

with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)
print("Saved t3-t5")