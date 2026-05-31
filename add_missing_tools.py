#!/usr/bin/env python3
"""Add all 20 missing tools from today-tasks.json to tools.json"""
import json

with open('tools.json', 'r') as f:
    tools = json.load(f)

cat_map = {}
for c in tools:
    cat_map[c['category']] = c

def get_cat(name):
    if name not in cat_map:
        cat_map[name] = {'category': name, 'tools': []}
        tools.append(cat_map[name])
    return cat_map[name]

other_cat = get_cat('其他工具')
format_cat = get_cat('格式转换')
dev_cat = get_cat('开发工具')
life_cat = get_cat('生活实用')
encrypt_cat = get_cat('编码/加密')

# ---- t1: ASCII码对照表 ----
ascii_data = [{'dec': str(i), 'hex': f'{i:02X}', 'oct': f'{i:03o}', 'char': c, 'name': n}
    for i, c, n in [
        (0,'NUL','空字符'),(1,'SOH','标题开始'),(2,'STX','正文开始'),(3,'ETX','正文结束'),
        (4,'EOT','传输结束'),(5,'ENQ','询问'),(6,'ACK','确认'),(7,'BEL','响铃'),
        (8,'BS','退格'),(9,'TAB','水平制表'),(10,'LF','换行'),(11,'VT','垂直制表'),
        (12,'FF','换页'),(13,'CR','回车'),(14,'SO','移出'),(15,'SI','移入'),
        (16,'DLE','数据链路转义'),(17,'DC1','设备控制1'),(18,'DC2','设备控制2'),
        (19,'DC3','设备控制3'),(20,'DC4','设备控制4'),(21,'NAK','否定'),
        (22,'SYN','同步'),(23,'ETB','传输块结束'),(24,'CAN','取消'),
        (25,'EM','介质结束'),(26,'SUB','替换'),(27,'ESC','转义'),
        (28,'FS','文件分隔符'),(29,'GS','组分隔符'),(30,'RS','记录分隔符'),(31,'US','单元分隔符'),
        (32,'SP','空格'),(33,'!','感叹号'),(34,'"','双引号'),(35,'#','井号'),
        (36,'$','美元符'),(37,'%','百分号'),(38,'&','和号'),(39,"'","单引号"),
        (40,'(','左括号'),(41,')','右括号'),(42,'*','星号'),(43,'+','加号'),
        (44,',','逗号'),(45,'-','减号'),(46,'.','句号'),(47,'/','斜杠'),
        (48,'0','数字0'),(49,'1','数字1'),(50,'2','数字2'),(51,'3','数字3'),
        (52,'4','数字4'),(53,'5','数字5'),(54,'6','数字6'),(55,'7','数字7'),
        (56,'8','数字8'),(57,'9','数字9'),(58,':','冒号'),(59,';','分号'),
        (60,'<','小于号'),(61,'=','等号'),(62,'>','大于号'),(63,'?','问号'),
        (64,'@','艾特'),(65,'A','大写字母A'),(66,'B','大写字母B'),(67,'C','大写字母C'),
        (68,'D','大写字母D'),(69,'E','大写字母E'),(70,'F','大写字母F'),
        (71,'G','大写字母G'),(72,'H','大写字母H'),(73,'I','大写字母I'),
        (74,'J','大写字母J'),(75,'K','大写字母K'),(76,'L','大写字母L'),
        (77,'M','大写字母M'),(78,'N','大写字母N'),(79,'O','大写字母O'),
        (80,'P','大写字母P'),(81,'Q','大写字母Q'),(82,'R','大写字母R'),
        (83,'S','大写字母S'),(84,'T','大写字母T'),(85,'U','大写字母U'),
        (86,'V','大写字母V'),(87,'W','大写字母W'),(88,'X','大写字母X'),
        (89,'Y','大写字母Y'),(90,'Z','大写字母Z'),(91,'[','左方括号'),
        (92,'\\','反斜杠'),(93,']','右方括号'),(94,'^','脱字符'),
        (95,'_','下划线'),(96,'`','反引号'),(97,'a','小写字母a'),
        (98,'b','小写字母b'),(99,'c','小写字母c'),(100,'d','小写字母d'),
        (101,'e','小写字母e'),(102,'f','小写字母f'),(103,'g','小写字母g'),
        (104,'h','小写字母h'),(105,'i','小写字母i'),(106,'j','小写字母j'),
        (107,'k','小写字母k'),(108,'l','小写字母l'),(109,'m','小写字母m'),
        (110,'n','小写字母n'),(111,'o','小写字母o'),(112,'p','小写字母p'),
        (113,'q','小写字母q'),(114,'r','小写字母r'),(115,'s','小写字母s'),
        (116,'t','小写字母t'),(117,'u','小写字母u'),(118,'v','小写字母v'),
        (119,'w','小写字母w'),(120,'x','小写字母x'),(121,'y','小写字母y'),
        (122,'z','小写字母z'),(123,'{','左花括号'),(124,'|','竖线'),
        (125,'}','右花括号'),(126,'~','波浪号'),(127,'DEL','删除')
    ]]
other_cat['tools'].append({
    'name': 'ASCII码对照表', 'path': 'other/ASCII码对照表.html', 'category': '其他工具',
    'tech': '静态JSON/HTML数据表', 'type': 'query',
    'desc': '完整的 ASCII 码对照表，涵盖 0-127 范围内的十进制、十六进制、八进制字符编码及其含义描述，方便程序员查询和参考。',
    'keywords': ['ASCII码', 'ASCII对照表', 'ASCII编码', '字符编码', 'ASCII表', '字符集', 'ASCII码查询'],
    'title': 'ASCII码对照表 - 字符编码速查表',
    'description': '在线ASCII码对照表，包含十进制、十六进制、八进制、字符对照，支持搜索，快速查询ASCII编码',
    'icon': 'bi bi-code-square', 'searchable': True, 'data': ascii_data,
    'renderFn': "function(data, search) { var html = '<table style=\"width:100%;border-collapse:collapse;font-size:14px;\"><thead><tr style=\"background:#161b22;\"><th style=\"padding:10px;border:1px solid #30363d;\">十进制</th><th style=\"padding:10px;border:1px solid #30363d;\">十六进制</th><th style=\"padding:10px;border:1px solid #30363d;\">八进制</th><th style=\"padding:10px;border:1px solid #30363d;\">字符</th><th style=\"padding:10px;border:1px solid #30363d;\">名称</th></tr></thead><tbody>'; data.forEach(function(row) { var hl = false; if (search) { var s = search.toLowerCase(); if (row.dec.includes(s) || row.hex.toLowerCase().includes(s) || row.char.toLowerCase().includes(s) || row.name.toLowerCase().includes(s)) hl = true; } var bg = hl ? 'background:rgba(201,169,110,0.15);' : ''; html += '<tr style=\"' + bg + '\"><td style=\"padding:8px;border:1px solid #30363d;font-family:monospace;\">' + row.dec + '</td><td style=\"padding:8px;border:1px solid #30363d;font-family:monospace;\">' + row.hex + '</td><td style=\"padding:8px;border:1px solid #30363d;font-family:monospace;\">' + row.oct + '</td><td style=\"padding:8px;border:1px solid #30363d;font-family:monospace;font-size:1.1em;\">' + row.char + '</td><td style=\"padding:8px;border:1px solid #30363d;color:#8b949e;\">' + row.name + '</td></tr>'; }); html += '</tbody></table>'; return html; }"
})
print("Added t1: ASCII码对照表")

# ---- t2: Emoji表情大全 ----
emoji_data = [
    {'emoji':'😀','name':'笑脸','category':'表情'},{'emoji':'😃','name':'大笑','category':'表情'},
    {'emoji':'😄','name':'微笑','category':'表情'},{'emoji':'😁','name':'露齿笑','category':'表情'},
    {'emoji':'😆','name':'大笑脸','category':'表情'},{'emoji':'😅','name':'苦笑','category':'表情'},
    {'emoji':'🤣','name':'笑到哭','category':'表情'},{'emoji':'😂','name':'笑哭','category':'表情'},
    {'emoji':'🙂','name':'微笑脸','category':'表情'},{'emoji':'🙃','name':'倒脸','category':'表情'},
    {'emoji':'😉','name':'眨眼','category':'表情'},{'emoji':'😊','name':'脸红微笑','category':'表情'},
    {'emoji':'😇','name':'天使','category':'表情'},{'emoji':'🥰','name':'心形眼','category':'表情'},
    {'emoji':'😍','name':'花痴','category':'表情'},{'emoji':'🤩','name':'星星眼','category':'表情'},
    {'emoji':'😘','name':'飞吻','category':'表情'},{'emoji':'😗','name':'亲亲','category':'表情'},
    {'emoji':'😚','name':'闭眼亲','category':'表情'},{'emoji':'😙','name':'笑脸亲','category':'表情'},
    {'emoji':'🥲','name':'含泪笑','category':'表情'},{'emoji':'😋','name':'流口水','category':'表情'},
    {'emoji':'😛','name':'吐舌','category':'表情'},{'emoji':'😜','name':'单眼吐舌','category':'表情'},
    {'emoji':'🤪','name':'疯狂','category':'表情'},{'emoji':'😝','name':'闭眼吐舌','category':'表情'},
    {'emoji':'🤑','name':'财迷','category':'表情'},{'emoji':'🤗','name':'拥抱','category':'表情'},
    {'emoji':'🤭','name':'脸红','category':'表情'},{'emoji':'🤫','name':'安静','category':'表情'},
    {'emoji':'🤔','name':'思考','category':'表情'},{'emoji':'🤐','name':'闭嘴','category':'表情'},
    {'emoji':'🤨','name':'质疑','category':'表情'},{'emoji':'😐','name':'面无表情','category':'表情'},
    {'emoji':'😑','name':'无表情','category':'表情'},{'emoji':'😶','name':'闭嘴脸','category':'表情'},
    {'emoji':'😏','name':'坏笑','category':'表情'},{'emoji':'😒','name':'不悦','category':'表情'},
    {'emoji':'🙄','name':'白眼','category':'表情'},{'emoji':'😬','name':'尴尬','category':'表情'},
    {'emoji':'🤥','name':'骗子','category':'表情'},{'emoji':'😌','name':'释然','category':'表情'},
    {'emoji':'😔','name':'失落','category':'表情'},{'emoji':'😪','name':'困倦','category':'表情'},
    {'emoji':'🤤','name':'流口水2','category':'表情'},{'emoji':'😴','name':'睡着','category':'表情'},
    {'emoji':'😷','name':'戴口罩','category':'表情'},{'emoji':'🤒','name':'生病','category':'表情'},
    {'emoji':'🤕','name':'受伤','category':'表情'},{'emoji':'🤢','name':'恶心','category':'表情'},
    {'emoji':'🤮','name':'呕吐','category':'表情'},{'emoji':'🤧','name':'感冒','category':'表情'},
    {'emoji':'🥵','name':'发热','category':'表情'},{'emoji':'🥶','name':'发冷','category':'表情'},
    {'emoji':'🥴','name':'晕菜','category':'表情'},{'emoji':'😵','name':'眩晕','category':'表情'},
    {'emoji':'🤯','name':'头炸','category':'表情'},{'emoji':'🤠','name':'牛仔','category':'表情'},
    {'emoji':'🥳','name':'派对','category':'表情'},{'emoji':'🥸','name':'假胡子','category':'表情'},
    {'emoji':'😎','name':'太阳镜笑','category':'表情'},{'emoji':'🤓','name':'书呆子','category':'表情'},
    {'emoji':'🧐','name':'放大镜','category':'表情'},{'emoji':'😕','name':'困惑','category':'表情'},
    {'emoji':'😟','name':'担心','category':'表情'},{'emoji':'🙁','name':'小沮丧','category':'表情'},
    {'emoji':'😮','name':'惊讶','category':'表情'},{'emoji':'😯','name':'安静惊讶','category':'表情'},
    {'emoji':'😲','name':'震惊','category':'表情'},{'emoji':'😳','name':'脸红震惊','category':'表情'},
    {'emoji':'🥺','name':'恳求','category':'表情'},{'emoji':'😦','name':'皱眉','category':'表情'},
    {'emoji':'😧','name':'焦虑','category':'表情'},{'emoji':'😨','name':'害怕','category':'表情'},
    {'emoji':'😰','name':'冷汗','category':'表情'},{'emoji':'😥','name':'失望','category':'表情'},
    {'emoji':'😢','name':'哭泣','category':'表情'},{'emoji':'😭','name':'大哭','category':'表情'},
    {'emoji':'😱','name':'惊恐','category':'表情'},{'emoji':'😖','name':'苦恼','category':'表情'},
    {'emoji':'😣','name':'痛苦','category':'表情'},{'emoji':'😞','name':'沮丧','category':'表情'},
    {'emoji':'😓','name':'累','category':'表情'},{'emoji':'😩','name':'疲倦','category':'表情'},
    {'emoji':'😫','name':'精疲力竭','category':'表情'},{'emoji':'🥱','name':'打哈欠','category':'表情'},
    {'emoji':'😤','name':'愤怒','category':'表情'},{'emoji':'😡','name':'愤怒脸','category':'表情'},
    {'emoji':'😠','name':'烦躁','category':'表情'},{'emoji':'🤬','name':'咒骂','category':'表情'},
    {'emoji':'😈','name':'恶魔笑','category':'表情'},{'emoji':'👿','name':'恶魔','category':'表情'},
    {'emoji':'💀','name':'骷髅','category':'表情'},{'emoji':'☠️','name':'骷髅头','category':'表情'},
    {'emoji':'💩','name':'便便','category':'表情'},{'emoji':'🤡','name':'小丑','category':'表情'},
    {'emoji':'👹','name':'妖怪','category':'表情'},{'emoji':'👺','name':'天狗','category':'表情'},
    {'emoji':'👻','name':'鬼','category':'表情'},{'emoji':'👽️','name':'外星人','category':'表情'},
    {'emoji':'👾','name':'外星人怪物','category':'表情'},{'emoji':'🤖','name':'机器人','category':'表情'},
    {'emoji':'😺','name':'猫笑脸','category':'动物'},{'emoji':'😸','name':'猫大笑','category':'动物'},
    {'emoji':'😹','name':'猫笑哭','category':'动物'},{'emoji':'😻','name':'猫心形眼','category':'动物'},
    {'emoji':'😼','name':'猫坏笑','category':'动物'},{'emoji':'😽','name':'猫亲亲','category':'动物'},
    {'emoji':'🙀','name':'猫尖叫','category':'动物'},{'emoji':'😿','name':'猫哭泣','category':'动物'},
    {'emoji':'😾','name':'猫生气','category':'动物'},{'emoji':'🙈','name':'非礼勿视','category':'手势'},
    {'emoji':'🙉','name':'非礼勿听','category':'手势'},{'emoji':'🙊','name':'非礼勿言','category':'手势'},
    {'emoji':'💋','name':'唇印','category':'物品'},{'emoji':'💌','name':'情书','category':'物品'},
    {'emoji':'💘','name':'心箭','category':'物品'},{'emoji':'💝','name':'心丝带','category':'物品'},
    {'emoji':'💖','name':'闪烁心','category':'物品'},{'emoji':'💗','name':'心跳','category':'物品'},
    {'emoji':'💓','name':'心跳2','category':'物品'},{'emoji':'💞','name':'旋转心','category':'物品'},
    {'emoji':'💕','name':'双心','category':'物品'},{'emoji':'💟','name':'心装饰','category':'物品'},
    {'emoji':'❣️','name':'重感叹心','category':'物品'},{'emoji':'💔','name':'心碎','category':'物品'},
    {'emoji':'❤️','name':'红心','category':'物品'},{'emoji':'🧡','name':'橙心','category':'物品'},
    {'emoji':'💛','name':'黄心','category':'物品'},{'emoji':'💚','name':'绿心','category':'物品'},
    {'emoji':'💙','name':'蓝心','category':'物品'},{'emoji':'💜','name':'紫心','category':'物品'},
    {'emoji':'🤍','name':'白心','category':'物品'},{'emoji':'🤎','name':'棕心','category':'物品'},
    {'emoji':'💯','name':'百分号','category':'物品'},{'emoji':'🔴','name':'红球','category':'物品'},
    {'emoji':'🟠','name':'橙球','category':'物品'},{'emoji':'🟡','name':'黄球','category':'物品'},
    {'emoji':'🟢','name':'绿球','category':'物品'},{'emoji':'🔵','name':'蓝球','category':'物品'},
    {'emoji':'🟣','name':'紫球','category':'物品'},{'emoji':'⚫','name':'黑球','category':'物品'},
    {'emoji':'⚪','name':'白球','category':'物品'},{'emoji':'🟤','name':'棕球','category':'物品'},
]
other_cat['tools'].append({
    'name': 'Emoji表情大全', 'path': 'other/Emoji表情大全.html', 'category': '其他工具',
    'tech': '静态JSON/HTML数据表', 'type': 'query',
    'desc': '收录所有常用 Emoji 表情符号，支持按分类浏览和关键词搜索，可快速复制单个表情用于社交媒体聊天和内容创作。',
    'keywords': ['Emoji', '表情符号', 'Emoji大全', '表情复制', 'emoji查询', 'emoji搜索', 'emoji列表', 'emoji复制'],
    'title': 'Emoji表情大全 - 表情符号速查与复制',
    'description': '在线Emoji表情大全，收录各分类表情符号，支持搜索和点击复制，社交媒体聊天必备',
    'icon': 'bi bi-emoji-smile', 'searchable': True, 'data': emoji_data,
    'renderFn': "function(data, search) { var html = '<div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(120px,1fr));gap:8px;\">'; data.forEach(function(row) { var hl = false; if (search) { var s = search.toLowerCase(); if (row.name.toLowerCase().includes(s) || row.category.toLowerCase().includes(s) || row.emoji.includes(s)) hl = true; } var op = (search && !hl) ? 'opacity:0.3;' : ''; html += '<div onclick=\"navigator.clipboard.writeText(\\'' + row.emoji + '\\').then(function(){if(window.CT)CT.showToast(\\xe6\\x8f\\x9d\\xe5\\x8f\\x91\\xe5\\xb7\\xa6\\xe5\\x88\\xb0\\xe5\\x89\\x94\\xe8\\xb4\\xb4\\xe6\\x89\\x95\\xe6\\x9d\\xbf!\\');})\" style=\"padding:12px 8px;text-align:center;cursor:pointer;background:#161b22;border-radius:8px;border:1px solid #30363d;transition:all 0.2s;' + op + '\"><div style=\"font-size:28px;margin-bottom:4px;\">' + row.emoji + '</div><div style=\"font-size:11px;color:#8b949e;\">' + row.name + '</div><div style=\"font-size:10px;color:#484f58;\">' + row.category + '</div></div>'; }); html += '</div>'; return html; }"
})
print("Added t2: Emoji表情大全")

# ---- t3: HTML转义字符对照表 ----
html_escape_data = [
    {'char':'&nbsp;','name':'不换行空格','desc':'HTML中表示不换行的空格'},
    {'char':'&amp;','name':'&符号','desc':'表示HTML中的&符号'},
    {'char':'&lt;','name':'小于号','desc':'HTML标签的左尖括号'},
    {'char':'&gt;','name':'大于号','desc':'HTML标签的右尖括号'},
    {'char':'&quot;','name':'双引号','desc':'HTML属性中的双引号'},
    {'char':'&apos;','name':'单引号','desc':'HTML属性中的单引号'},
    {'char':'&copy;','name':'版权符号','desc':'表示版权符号'},
    {'char':'&reg;','name':'注册商标','desc':'表示注册商标符号'},
    {'char':'&trade;','name':'商标符号','desc':'表示商标符号'},
    {'char':'&ensp;','name':'半角空格','desc':'一个半角字符宽度的空格'},
    {'char':'&emsp;','name':'全角空格','desc':'一个全角字符宽度的空格'},
    {'char':'&times;','name':'乘号','desc':'表示数学中的乘号'},
    {'char':'&divide;','name':'除号','desc':'表示数学中的除号'},
    {'char':'&cent;','name':'美分','desc':'美分符号'},
    {'char':'&pound;','name':'英镑','desc':'英镑符号'},
    {'char':'&euro;','name':'欧元','desc':'欧元符号'},
    {'char':'&yen;','name':'日元','desc':'日元符号'},
    {'char':'&sect;','name':'章节符','desc':'章节符号'},
    {'char':'&para;','name':'段落符','desc':'段落符号'},
    {'char':'&bull;','name':'项目符号','desc':'列表项目符号'},
    {'char':'&hellip;','name':'省略号','desc':'三个点的省略号'},
    {'char':'&prime;','name':'单引号','desc':'上标单引号/分钟符号'},
    {'char':'&Prime;','name':'双引号','desc':'双上标引号/秒符号'},
    {'char':'&larr;','name':'左箭头','desc':'向左的箭头'},
    {'char':'&rarr;','name':'右箭头','desc':'向右的箭头'},
    {'char':'&uarr;','name':'上箭头','desc':'向上的箭头'},
    {'char':'&darr;','name':'下箭头','desc':'向下的箭头'},
    {'char':'&harr;','name':'双头箭头','desc':'左右双向箭头'},
]
other_cat['tools'].append({
    'name': 'HTML转义字符对照表', 'path': 'other/HTML转义字符对照表.html', 'category': '其他工具',
    'tech': '静态JSON/HTML数据表', 'type': 'query',
    'desc': '完整的 HTML 转义字符对照表，涵盖常用实体字符、符号、数学运算符等，一键复制方便网页开发。',
    'keywords': ['HTML转义', 'HTML实体', 'HTML特殊字符', 'HTML符号', '实体字符', 'HTML编码', '转义字符'],
    'title': 'HTML转义字符对照表 - 常用HTML实体字符速查',
    'description': '在线HTML转义字符对照表，包含常用HTML实体、符号、数学运算符，支持一键复制',
    'icon': 'bi bi-code', 'searchable': True, 'data': html_escape_data,
    'renderFn': "function(data, search) { var html = '<table style=\"width:100%;border-collapse:collapse;font-size:14px;\"><thead><tr style=\"background:#161b22;\"><th style=\"padding:10px;border:1px solid #30363d;\">字符</th><th style=\"padding:10px;border:1px solid #30363d;\">名称</th><th style=\"padding:10px;border:1px solid #30363d;\">说明</th><th style=\"padding:10px;border:1px solid #30363d;\">操作</th></tr></thead><tbody>'; data.forEach(function(row) { var hl = false; if (search) { var s = search.toLowerCase(); if (row.char.includes(s) || row.name.includes(s) || row.desc.includes(s)) hl = true; } var bg = hl ? 'background:rgba(201,169,110,0.15);' : ''; var chr = row.char.replace(/'/g, \"\\\\'\"); html += '<tr style=\"' + bg + '\"><td style=\"padding:8px;border:1px solid #30363d;font-family:monospace;font-size:1.1em;\">' + row.char + '</td><td style=\"padding:8px;border:1px solid #30363d;color:#c9a96e;\">' + row.name + '</td><td style=\"padding:8px;border:1px solid #30363d;color:#8b949e;\">' + row.desc + '</td><td style=\"padding:8px;border:1px solid #30363d;\"><button onclick=\"navigator.clipboard.writeText(\\'' + chr + '\\');if(window.CT)CT.showToast(\\xe5\\xb7\\xa6\\xe5\\x88\\xb0\\xe5\\x89\\x94\\xe8\\xb4\\xb4\\xb6\\x89!\\');\" style=\"padding:4px 12px;background:#c9a96e;color:#0d1117;border:none;border-radius:4px;cursor:pointer;font-size:12px;\">复制</button></td></tr>'; }); html += '</tbody></table>'; return html; }"
})
print("Added t3: HTML转义字符对照表")

# ---- t4: HTTP协议状态码 ----
http_status_data = [
    {'code':'200','name':'OK','desc':'请求成功，已正常处理'},
    {'code':'201','name':'Created','desc':'请求已创建新资源'},
    {'code':'204','name':'No Content','desc':'请求成功，无返回内容'},
    {'code':'301','name':'Moved Permanently','desc':'永久重定向到新URL'},
    {'code':'302','name':'Found','desc':'临时重定向到新URL'},
    {'code':'304','name':'Not Modified','desc':'资源未修改，使用缓存'},
    {'code':'400','name':'Bad Request','desc':'请求语法错误或参数错误'},
    {'code':'401','name':'Unauthorized','desc':'需要身份认证或认证失败'},
    {'code':'403','name':'Forbidden','desc':'服务器拒绝访问，无权限'},
    {'code':'404','name':'Not Found','desc':'请求资源不存在'},
    {'code':'405','name':'Method Not Allowed','desc':'请求方法不允许'},
    {'code':'408','name':'Request Timeout','desc':'请求超时'},
    {'code':'409','name':'Conflict','desc':'请求冲突（如数据版本冲突）'},
    {'code':'413','name':'Payload Too Large','desc':'请求体过大'},
    {'code':'414','name':'URI Too Long','desc':'请求URI过长'},
    {'code':'429','name':'Too Many Requests','desc':'请求过于频繁，限流'},
    {'code':'500','name':'Internal Server Error','desc':'服务器内部错误'},
    {'code':'502','name':'Bad Gateway','desc':'网关错误，上游服务器无效'},
    {'code':'503','name':'Service Unavailable','desc':'服务暂时不可用'},
    {'code':'504','name':'Gateway Timeout','desc':'网关超时，上游服务器响应超时'},
]
other_cat['tools'].append({
    'name': 'HTTP协议状态码', 'path': 'other/HTTP协议状态码.html', 'category': '其他工具',
    'tech': '静态JSON/HTML数据表', 'type': 'query',
    'desc': '完整的 HTTP 状态码对照表，按 1xx/2xx/3xx/4xx/5xx 分类，描述每个状态码的含义和使用场景。',
    'keywords': ['HTTP状态码', 'HTTP状态', '状态码', 'HTTP响应码', 'HTTP错误码', 'HTTP状态对照', 'HTTP Code'],
    'title': 'HTTP协议状态码 - HTTP响应状态码对照表',
    'description': '在线HTTP状态码对照表，涵盖1xx-5xx所有状态码，分类清晰说明详细，开发者必备参考',
    'icon': 'bi bi-globe', 'searchable': True, 'data': http_status_data,
    'renderFn': "function(data, search) { var html = '<div style=\"display:grid;grid-template-columns:repeat(auto-fill,minmax(280px,1fr));gap:12px;\">'; data.forEach(function(row) { var cls = row.code.startsWith('2') ? '#3fb950' : row.code.startsWith('3') ? '#58a6ff' : row.code.startsWith('4') ? '#f59e0b' : '#f85149'; var hl = false; if (search) { var s = search.toLowerCase(); if (row.code.includes(s) || row.name.toLowerCase().includes(s) || row.desc.toLowerCase().includes(s)) hl = true; } var bg = hl ? 'background:rgba(201,169,110,0.15);' : 'background:#161b22;'; html += '<div style=\"padding:16px;border-radius:8px;border:1px solid #30363d;' + bg + '\"><div style=\"display:flex;align-items:center;gap:12px;margin-bottom:8px;\"><span style=\"font-size:1.4rem;font-weight:700;color:' + cls + ';font-family:monospace;\">' + row.code + '</span><span style=\"font-size:14px;font-weight:600;color:#e0e0e0;\">' + row.name + '</span></div><div style=\"font-size:13px;color:#8b949e;line-height:1.5;\">' + row.desc + '</div></div>'; }); html += '</div>'; return html; }"
})
print("Added t4: HTTP协议状态码")

# ---- t5: robots文件生成器 ----
other_cat['tools'].append({
    'name': 'robots文件生成器', 'path': 'other/robots文件生成器.html', 'category': '其他工具',
    'tech': '原生JS', 'type': 'generator',
    'desc': '快速生成符合标准的 robots.txt 配置文件，支持指定允许和禁止访问的路径，以及网站地图位置。',
    'keywords': ['robots.txt', 'robots文件', '搜索引擎爬虫', '网站收录', 'SEO优化', '爬虫规则', '网站地图'],
    'title': 'robots文件生成器 - 自动生成robots.txt配置',
    'description': '在线生成robots.txt文件，支持自定义允许/禁止爬虫访问的路径，配置网站地图位置',
    'icon': 'bi bi-robot',
    'fields': [
        {'id': 'sitemap', 'label': '网站地图URL', 'type': 'text', 'placeholder': 'https://example.com/sitemap.xml'},
        {'id': 'disallow', 'label': '禁止访问的路径（每行一个）', 'type': 'textarea', 'placeholder': '/admin\n/private\n/test'},
        {'id': 'allow', 'label': '允许访问的路径（每行一个）', 'type': 'textarea', 'placeholder': '/public\n/static'},
        {'id': 'ua', 'label': '针对爬虫 User-Agent（留空则对所有）', 'type': 'text', 'placeholder': 'Googlebot'}
    ],
    'btnLabel': '生成robots.txt',
    'generateFn': "function(inputs) { var lines = ['User-agent: ' + (inputs.ua || '*'), '']; if (inputs.allow && inputs.allow.trim()) { inputs.allow.trim().split('\\n').forEach(function(p) { p = p.trim(); if (p) lines.push('Allow: ' + p); }); } if (inputs.disallow && inputs.disallow.trim()) { inputs.disallow.trim().split('\\n').forEach(function(p) { p = p.trim(); if (p) lines.push('Disallow: ' + p); }); } if (inputs.sitemap && inputs.sitemap.trim()) { lines.push(''); lines.push('Sitemap: ' + inputs.sitemap.trim()); } return '# Generated by CloverTools\\n' + lines.join('\\n'); }"
})
print("Added t5: robots文件生成器")

# ---- t6: 常用浏览器User-Agent ----
ua_data = [
    {'ua':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','browser':'Chrome 120 (Windows)','os':'Windows 10/11'},
    {'ua':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 Chrome/120.0.0.0 Safari/537.36','browser':'Chrome 120 (Mac)','os':'macOS'},
    {'ua':'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 Mobile Safari/537.36','browser':'Safari (iPhone)','os':'iOS 17'},
    {'ua':'Mozilla/5.0 (Linux; Android 14) AppleWebKit/537.36 Chrome/120.0.0.0 Mobile Safari/537.36','browser':'Chrome (Android)','os':'Android 14'},
    {'ua':'Mozilla/5.0 (Windows NT 10.0; Win64; x64; rv:121.0) Gecko/20100101 Firefox/121.0','browser':'Firefox 121','os':'Windows'},
    {'ua':'Mozilla/5.0 (Macintosh; Intel Mac OS X 10.15; rv:121.0) Gecko/20100101 Firefox/121.0','browser':'Firefox 121 (Mac)','os':'macOS'},
    {'ua':'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Edge/120.0.0.0','browser':'Edge 120','os':'Windows'},
    {'ua':'Mozilla/5.0 (compatible; Googlebot/2.1; +http://www.google.com/bot.html)','browser':'Googlebot','os':'服务器'},
    {'ua':'Mozilla/5.0 (compatible; Bingbot/2.0; +http://www.bing.com/bingbot.htm)','browser':'Bingbot','os':'服务器'},
    {'ua':'Mozilla/5.0