import json, sys

with open('tools.json', 'r') as f:
    tools = json.load(f)

cat_map = {}
for i, cat in enumerate(tools):
    cat_map[cat['category']] = i

def get_tools_list(name):
    if name in cat_map:
        return tools[cat_map[name]]['tools']
    else:
        new_cat = {'category': name, 'tools': []}
        tools.append(new_cat)
        cat_map[name] = len(tools) - 1
        return new_cat['tools']

other_tools = get_tools_list('其他工具')

# t7: special symbols
symbol_data = [
    {'symbol': '\u2605', 'name': '黑星', 'category': '符号', 'desc': '实心星形'},
    {'symbol': '\u2606', 'name': '白星', 'category': '符号', 'desc': '空心星形'},
    {'symbol': '\u2665', 'name': '红心', 'category': '符号', 'desc': '实心红心符号'},
    {'symbol': '\u2666', 'name': '方块', 'category': '符号', 'desc': '实心方块'},
    {'symbol': '\u2663', 'name': '黑桃', 'category': '符号', 'desc': '黑桃符号'},
    {'symbol': '\u2660', 'name': '黑心', 'category': '符号', 'desc': '黑心（黑桃色）'},
    {'symbol': '\u266a', 'name': '音符', 'category': '符号', 'desc': '八分音符'},
    {'symbol': '\u266b', 'name': '双音符', 'category': '符号', 'desc': '双八分音符'},
    {'symbol': '\u2600', 'name': '太阳', 'category': '符号', 'desc': '太阳符号'},
    {'symbol': '\u263a', 'name': '笑脸', 'category': '符号', 'desc': '白色笑脸'},
    {'symbol': '\u2639', 'name': '苦脸', 'category': '符号', 'desc': '白色苦脸'},
    {'symbol': '\u2603', 'name': '雪人', 'category': '符号', 'desc': '雪人符号'},
    {'symbol': '\u2602', 'name': '雨伞', 'category': '符号', 'desc': '雨伞符号'},
    {'symbol': '\u2618', 'name': '三叶草', 'category': '符号', 'desc': '四叶草符号'},
    {'symbol': '\u2691', 'name': '实心旗', 'category': '符号', 'desc': '黑色实心旗'},
    {'symbol': '\u2690', 'name': '空心旗', 'category': '符号', 'desc': '白色空心旗'},
    {'symbol': '\u2714', 'name': '勾', 'category': '符号', 'desc': '粗体对勾'},
    {'symbol': '\u2716', 'name': '叉', 'category': '符号', 'desc': '粗体叉号'},
    {'symbol': '\u2713', 'name': '勾选', 'category': '符号', 'desc': '对勾'},
    {'symbol': '\u2611', 'name': '方框勾', 'category': '符号', 'desc': '方框中对勾'},
    {'symbol': '\u2610', 'name': '方框', 'category': '符号', 'desc': '空心方框'},
    {'symbol': '\u25a0', 'name': '黑方块', 'category': '符号', 'desc': '实心黑色方块'},
    {'symbol': '\u25a1', 'name': '白方块', 'category': '符号', 'desc': '空心白色方块'},
    {'symbol': '\u25cf', 'name': '黑圆点', 'category': '符号', 'desc': '实心黑色圆'},
    {'symbol': '\u25cb', 'name': '白圆点', 'category': '符号', 'desc': '空心白色圆'},
    {'symbol': '\u25c6', 'name': '菱形', 'category': '符号', 'desc': '实心菱形'},
    {'symbol': '\u25c7', 'name': '白菱形', 'category': '符号', 'desc': '空心菱形'},
    {'symbol': '\u25b2', 'name': '黑三角', 'category': '符号', 'desc': '实心向上三角'},
    {'symbol': '\u25b6', 'name': '黑三角右', 'category': '符号', 'desc': '实心向右三角'},
    {'symbol': '\u25c0', 'name': '黑三角左', 'category': '符号', 'desc': '实心向左三角'},
    {'symbol': '\u25bc', 'name': '黑三角下', 'category': '符号', 'desc': '实心向下三角'},
    {'symbol': '\u2190', 'name': '左箭头', 'category': '箭头', 'desc': '向左箭头'},
    {'symbol': '\u2191', 'name': '上箭头', 'category': '箭头', 'desc': '向上箭头'},
    {'symbol': '\u2192', 'name': '右箭头', 'category': '箭头', 'desc': '向右箭头'},
    {'symbol': '\u2193', 'name': '下箭头', 'category': '箭头', 'desc': '向下箭头'},
    {'symbol': '\u2194', 'name': '双箭头', 'category': '箭头', 'desc': '左右双向箭头'},
    {'symbol': '\u2195', 'name': '上下箭头', 'category': '箭头', 'desc': '上下双向箭头'},
    {'symbol': '\u2196', 'name': '左上', 'category': '箭头', 'desc': '向左上箭头'},
    {'symbol': '\u2197', 'name': '右上', 'category': '箭头', 'desc': '向右上箭头'},
    {'symbol': '\u2198', 'name': '右下', 'category': '箭头', 'desc': '向右下箭头'},
    {'symbol': '\u2199', 'name': '左下', 'category': '箭头', 'desc': '向左下箭头'},
    {'symbol': '\u21a9', 'name': '左回', 'category': '箭头', 'desc': '向左弯曲返回箭头'},
    {'symbol': '\u21aa', 'name': '右回', 'category': '箭头', 'desc': '向右弯曲返回箭头'},
    {'symbol': '\u21b5', 'name': '左转', 'category': '箭头', 'desc': '左转回车箭头'},
    {'symbol': '\u00a9', 'name': '版权', 'category': '符号', 'desc': '版权符号'},
    {'symbol': '\u00ae', 'name': '注册', 'category': '符号', 'desc': '注册商标符号'},
    {'symbol': '\u2122', 'name': '商标', 'category': '符号', 'desc': '商标符号'},
    {'symbol': '\u00b0', 'name': '度', 'category': '符号', 'desc': '度数符号'},
    {'symbol': '\u00b1', 'name': '加减', 'category': '符号', 'desc': '正负号'},
    {'symbol': '\u00d7', 'name': '乘', 'category': '符号', 'desc': '乘号'},
    {'symbol': '\u00f7', 'name': '除', 'category': '符号', 'desc': '除号'},
    {'symbol': '\u2260', 'name': '不等于', 'category': '符号', 'desc': '不等于号'},
    {'symbol': '\u2264', 'name': '小于等于', 'category': '符号', 'desc': '小于等于号'},
    {'symbol': '\u2265', 'name': '大于等于', 'category': '符号', 'desc': '大于等于号'},
    {'symbol': '\u221e', 'name': '无穷', 'category': '符号', 'desc': '无穷大符号'},
    {'symbol': '\u03b1', 'name': 'alpha', 'category': '希腊字母', 'desc': '希腊字母α'},
    {'symbol': '\u03b2', 'name': 'beta', 'category': '希腊字母', 'desc': '希腊字母β'},
    {'symbol': '\u03b3', 'name': 'gamma', 'category': '希腊字母', 'desc': '希腊字母γ'},
    {'symbol': '\u03b4', 'name': 'delta', 'category': '希腊字母', 'desc': '希腊字母δ'},
    {'symbol': '\u03b5', 'name': 'epsilon', 'category': '希腊字母', 'desc': '希腊字母ε'},
    {'symbol': '\u03b6', 'name': 'zeta', 'category': '希腊字母', 'desc': '希腊字母ζ'},
    {'symbol': '\u03b7', 'name': 'eta', 'category': '希腊字母', 'desc': '希腊字母η'},
    {'symbol': '\u03b8', 'name': 'theta', 'category': '希腊字母', 'desc': '希腊字母θ'},
    {'symbol': '\u03bb', 'name': 'lambda', 'category': '希腊字母', 'desc': '希腊字母λ'},
    {'symbol': '\u03bc', 'name': 'mu', 'category': '希腊字母', 'desc': '希腊字母μ'},
    {'symbol': '\u03bd', 'name': 'nu', 'category': '希腊字母', 'desc': '希腊字母ν'},
    {'symbol': '\u03be', 'name': 'xi', 'category': '希腊字母', 'desc': '希腊字母ξ'},
    {'symbol': '\u03bf', 'name': 'omicron', 'category': '希腊字母', 'desc': '希腊字母ο'},
    {'symbol': '\u03c0', 'name': 'pi', 'category': '希腊字母', 'desc': '希腊字母π'},
    {'symbol': '\u03c1', 'name': 'rho', 'category': '希腊字母', 'desc': '希腊字母ρ'},
    {'symbol': '\u03c3', 'name': 'sigma', 'category': '希腊字母', 'desc': '希腊字母σ'},
    {'symbol': '\u03c4', 'name': 'tau', 'category': '希腊字母', 'desc': '希腊字母τ'},
    {'symbol': '\u03c5', 'name': 'upsilon', 'category': '希腊字母', 'desc': '希腊字母υ'},
    {'symbol': '\u03c6', 'name': 'phi', 'category': '希腊字母', 'desc': '希腊字母φ'},
    {'symbol': '\u03c7', 'name': 'chi', 'category': '希腊字母', 'desc': '希腊字母χ'},
    {'symbol': '\u03c8', 'name': 'psi', 'category': '希腊字母', 'desc': '希腊字母ψ'},
    {'symbol': '\u03c9', 'name': 'omega', 'category': '希腊字母', 'desc': '希腊字母ω'},
]
other_tools.append({'name': '特殊符号大全', 'path': 'other/特殊符号大全.html', 'category': '其他工具', 'type': 'query', 'desc': '收录各种特殊符号，包括星星、心形、箭头、数学符号、希腊字母等，支持按分类筛选与关键词搜索，一键复制使用。', 'keywords': ['特殊符号', '符号大全', '箭头符号', '数学符号', '希腊字母'], 'title': '特殊符号大全 - 符号查找与复制', 'description': '收录100+常用特殊符号，包括星星、心形、箭头、数学符号、希腊字母等，支持一键复制', 'icon': 'bi bi-arrow-up-right-square', 'searchable': True, 'data': symbol_data, 'renderFn': "function(data, search) { var rows = ''; if (!search || search.trim() === '') { rows = data.map(function(r) { return '<div class=\"col-4 col-md-3 col-lg-2 mb-2\"><button class=\"btn btn-light w-100 py-2 symbol-btn\" data-symbol=\"' + r.symbol + '\"><span class=\"fs-4\">' + r.symbol + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div><span class=\"badge bg-secondary mt-1\">' + r.category + '</span></button></div>'; }).join(''); } else { var s = search.toLowerCase(); var f = data.filter(function(r) { return r.name.includes(s) || r.category.includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>' + f.map(function(r) { return '<div class=\"col-4 col-md-3 col-lg-2 mb-2\"><button class=\"btn btn-light w-100 py-2 symbol-btn\" data-symbol=\"' + r.symbol + '\"><span class=\"fs-4\">' + r.symbol + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div><span class=\"badge bg-secondary mt-1\">' + r.category + '</span></button></div>'; }).join(''); } return '<div class=\"row\">' + rows + '</div>'; }"})
print("Added 特殊符号大全")

# t8: keyboard key data
key_data = [
    {'key': 'Backspace', 'code': 'BackSpace', 'keyCode': '8', 'desc': '退格键'},
    {'key': 'Tab', 'code': 'Tab', 'keyCode': '9', 'desc': 'Tab 键'},
    {'key': 'Enter', 'code': 'Enter', 'keyCode': '13', 'desc': '回车键'},
    {'key': 'Shift', 'code': 'ShiftLeft / ShiftRight', 'keyCode': '16', 'desc': 'Shift 键'},
    {'key': 'Control', 'code': 'ControlLeft / ControlRight', 'keyCode': '17', 'desc': 'Ctrl 键'},
    {'key': 'Alt', 'code': 'AltLeft / AltRight', 'keyCode': '18', 'desc': 'Alt 键'},
    {'key': 'Pause/Break', 'code': 'Pause', 'keyCode': '19', 'desc': '暂停键'},
    {'key': 'Caps Lock', 'code': 'CapsLock', 'keyCode': '20', 'desc': '大写锁定键'},
    {'key': 'Escape', 'code': 'Escape', 'keyCode': '27', 'desc': '退出键'},
    {'key': 'Space', 'code': 'Space', 'keyCode': '32', 'desc': '空格键'},
    {'key': 'Page Up', 'code': 'PageUp', 'keyCode': '33', 'desc': '向上翻页'},
    {'key': 'Page Down', 'code': 'PageDown', 'keyCode': '34', 'desc': '向下翻页'},
    {'key': 'End', 'code': 'End', 'keyCode': '35', 'desc': 'End 键'},
    {'key': 'Home', 'code': 'Home', 'keyCode': '36', 'desc': 'Home 键'},
    {'key': 'Left Arrow', 'code': 'ArrowLeft', 'keyCode': '37', 'desc': '左方向键'},
    {'key': 'Up Arrow', 'code': 'ArrowUp', 'keyCode': '38', 'desc': '上方向键'},
    {'key': 'Right Arrow', 'code': 'ArrowRight', 'keyCode': '39', 'desc': '右方向键'},
    {'key': 'Down Arrow', 'code': 'ArrowDown', 'keyCode': '40', 'desc': '下方向键'},
    {'key': 'Print Screen', 'code': 'PrintScreen', 'keyCode': '42', 'desc': '截图键'},
    {'key': 'Insert', 'code': 'Insert', 'keyCode': '45', 'desc': '插入键'},
    {'key': 'Delete', 'code': 'Delete', 'keyCode': '46', 'desc': '删除键'},
    {'key': '0', 'code': 'Digit0', 'keyCode': '48', 'desc': '数字 0'},
    {'key': '1', 'code': 'Digit1', 'keyCode': '49', 'desc': '数字 1'},
    {'key': '2', 'code': 'Digit2', 'keyCode': '50', 'desc': '数字 2'},
    {'key': '3', 'code': 'Digit3', 'keyCode': '51', 'desc': '数字 3'},
    {'key': '4', 'code': 'Digit4', 'keyCode': '52', 'desc': '数字 4'},
    {'key': '5', 'code': 'Digit5', 'keyCode': '53', 'desc': '数字 5'},
    {'key': '6', 'code': 'Digit6', 'keyCode': '54', 'desc': '数字 6'},
    {'key': '7', 'code': 'Digit7', 'keyCode': '55', 'desc': '数字 7'},
    {'key': '8', 'code': 'Digit8', 'keyCode': '56', 'desc': '数字 8'},
    {'key': '9', 'code': 'Digit9', 'keyCode': '57', 'desc': '数字 9'},
    {'key': 'A', 'code': 'KeyA', 'keyCode': '65', 'desc': '字母 A'},
    {'key': 'B', 'code': 'KeyB', 'keyCode': '66', 'desc': '字母 B'},
    {'key': 'C', 'code': 'KeyC', 'keyCode': '67', 'desc': '字母 C'},
    {'key': 'D', 'code': 'KeyD', 'keyCode': '68', 'desc': '字母 D'},
    {'key': 'E', 'code': 'KeyE', 'keyCode': '69', 'desc': '字母 E'},
    {'key': 'F', 'code': 'KeyF', 'keyCode': '70', 'desc': '字母 F'},
    {'key': 'G', 'code': 'KeyG', 'keyCode': '71', 'desc': '字母 G'},
    {'key': 'H', 'code': 'KeyH', 'keyCode': '72', 'desc': '字母 H'},
    {'key': 'I', 'code': 'KeyI', 'keyCode': '73', 'desc': '字母 I'},
    {'key': 'J', 'code': 'KeyJ', 'keyCode': '74', 'desc': '字母 J'},
    {'key': 'K', 'code': 'KeyK', 'keyCode': '75', 'desc': '字母 K'},
    {'key': 'L', 'code': 'KeyL', 'keyCode': '76', 'desc': '字母 L'},
    {'key': 'M', 'code': 'KeyM', 'keyCode': '77', 'desc': '字母 M'},
    {'key': 'N', 'code': 'KeyN', 'keyCode': '78', 'desc': '字母 N'},
    {'key': 'O', 'code': 'KeyO', 'keyCode': '79', 'desc': '字母 O'},
    {'key': 'P', 'code': 'KeyP', 'keyCode': '80', 'desc': '字母 P'},
    {'key': 'Q', 'code': 'KeyQ', 'keyCode': '81', 'desc': '字母 Q'},
    {'key': 'R', 'code': 'KeyR', 'keyCode': '82', 'desc': '字母 R'},
    {'key': 'S', 'code': 'KeyS', 'keyCode': '83', 'desc': '字母 S'},
    {'key': 'T', 'code': 'KeyT', 'keyCode': '84', 'desc': '字母 T'},
    {'key': 'U', 'code': 'KeyU', 'keyCode': '85', 'desc': '字母 U'},
    {'key': 'V', 'code': 'KeyV', 'keyCode': '86', 'desc': '字母 V'},
    {'key': 'W', 'code': 'KeyW', 'keyCode': '87', 'desc': '字母 W'},
    {'key': 'X', 'code': 'KeyX', 'keyCode': '88', 'desc': '字母 X'},
    {'key': 'Y', 'code': 'KeyY', 'keyCode': '89', 'desc': '字母 Y'},
    {'key': 'Z', 'code': 'KeyZ', 'keyCode': '90', 'desc': '字母 Z'},
    {'key': 'Left Windows', 'code': 'MetaLeft', 'keyCode': '91', 'desc': '左 Windows 键'},
    {'key': 'Right Windows', 'code': 'MetaRight', 'keyCode': '92', 'desc': '右 Windows 键'},
    {'key': 'Numpad 0', 'code': 'Numpad0', 'keyCode': '96', 'desc': '数字小键盘 0'},
    {'key': 'Numpad 1', 'code': 'Numpad1', 'keyCode': '97', 'desc': '数字小键盘 1'},
    {'key': 'Numpad 2', 'code': 'Numpad2', 'keyCode': '98', 'desc': '数字小键盘 2'},
    {'key': 'Numpad 3', 'code': 'Numpad3', 'keyCode': '99', 'desc': '数字小键盘 3'},
    {'key': 'Numpad 4', 'code': 'Numpad4', 'keyCode': '100', 'desc': '数字小键盘 4'},
    {'key': 'Numpad 5', 'code': 'Numpad5', 'keyCode': '101', 'desc': '数字小键盘 5'},
    {'key': 'Numpad 6', 'code': 'Numpad6', 'keyCode': '102', 'desc': '数字小键盘 6'},
    {'key': 'Numpad 7', 'code': 'Numpad7', 'keyCode': '103', 'desc': '数字小键盘 7'},
    {'key': 'Numpad 8', 'code': 'Numpad8', 'keyCode': '104', 'desc': '数字小键盘 8'},
    {'key': 'Numpad 9', 'code': 'Numpad9', 'keyCode': '105', 'desc': '数字小键盘 9'},
    {'key': 'Numpad *', 'code': 'NumpadMultiply', 'keyCode': '106', 'desc': '数字小键盘 *'},
    {'key': 'Numpad +', 'code': 'NumpadAdd', 'keyCode': '107', 'desc': '数字小键盘 +'},
    {'key': 'Numpad -', 'code': 'NumpadSubtract', 'keyCode': '109', 'desc': '数字小键盘 -'},
    {'key': 'Numpad .', 'code': 'NumpadDecimal', 'keyCode': '110', 'desc': '数字小键盘 .'},
    {'key': 'Numpad /', 'code': 'NumpadDivide', 'keyCode': '111', 'desc': '数字小键盘 /'},
    {'key': 'F1', 'code': 'F1', 'keyCode': '112', 'desc': '功能键 F1'},
    {'key': 'F2', 'code': 'F2', 'keyCode': '113', 'desc': '功能键 F2'},
    {'key': 'F3', 'code': 'F3', 'keyCode': '114', 'desc': '功能键 F3'},
    {'key': 'F4', 'code': 'F4', 'keyCode': '115', 'desc': '功能键 F4'},
    {'key': 'F5', 'code': 'F5', 'keyCode': '116', 'desc': '功能键 F5'},
    {'key': 'F6', 'code': 'F6', 'keyCode': '117', 'desc': '功能键 F6'},
    {'key': 'F7', 'code': 'F7', 'keyCode': '118', 'desc': '功能键 F7'},
    {'key': 'F8', 'code': 'F8', 'keyCode': '119', 'desc': '功能键 F8'},
    {'key': 'F9', 'code': 'F9', 'keyCode': '120', 'desc': '功能键 F9'},
    {'key': 'F10', 'code': 'F10', 'keyCode': '121', 'desc': '功能键 F10'},
    {'key': 'F11', 'code': 'F11', 'keyCode': '122', 'desc': '功能键 F11'},
    {'key': 'F12', 'code': 'F12', 'keyCode': '123', 'desc': '功能键 F12'},
    {'key': 'Num Lock', 'code': 'NumLock', 'keyCode': '144', 'desc': '数字锁定键'},
    {'key': 'Scroll Lock', 'code': 'ScrollLock', 'keyCode': '145', 'desc': '滚动锁定键'},
    {'key': ';', 'code': 'Semicolon', 'keyCode': '186', 'desc': '分号键'},
    {'key': '=', 'code': 'Equal', 'keyCode': '187', 'desc': '等号键'},
    {'key': ',', 'code': 'Comma', 'keyCode': '188', 'desc': '逗号键'},
    {'key': '-', 'code': 'Minus', 'keyCode': '189', 'desc': '减号键'},
    {'key': '.', 'code': 'Period', 'keyCode': '190', 'desc': '句号键'},
    {'key': '/', 'code': 'Slash', 'keyCode': '191', 'desc': '斜杠键'},
    {'key': '`', 'code': 'Backquote', 'keyCode': '192', 'desc': '反引号键'},
    {'key': '[', 'code': 'BracketLeft', 'keyCode': '219', 'desc': '左方括号键'},
    {'key': '\\', 'code': 'Backslash', 'keyCode': '220', 'desc': '反斜杠键'},
    {'key': ']', 'code': 'BracketRight', 'keyCode': '221', 'desc': '右方括号键'},
    {"key": "'", 'code': 'Quote', 'keyCode': '222', 'desc': '单引号键'},
]
other_tools.append({'name': '键盘按键值大全', 'path': 'other/键盘按键值大全.html', 'category': '其他工具', 'type': 'query', 'desc': '完整的键盘按键 keyCode、code、key 对照表，涵盖字母、数字、功能键、方向键与小键盘，方便 JavaScript 事件监听开发。', 'keywords': ['键盘按键', 'keyCode', 'key', '键盘事件', 'JavaScript keyCode'], 'title': '键盘按键值大全 - JavaScript 键盘事件参考', 'description': '在线键盘按键值查询表，涵盖字母、数字、功能键、小键盘的keyCode、code对照，适用于JS开发', 'icon': 'bi bi-keyboard', 'searchable': True, 'data': key_data, 'renderFn': "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\"><kbd>' + r.key + '</kbd></td><td class=\"font-monospace text-muted small\">' + r.code + '</td><td class=\"font-monospace text-muted\">' + r.keyCode + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>按键</th><th>code</th><th>keyCode</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.key.toLowerCase().includes(s) || r.code.toLowerCase().includes(s) || r.keyCode.includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\"><kbd>' + r.key + '</kbd></td><td class=\"font-monospace text-muted small\">' + r.code + '</td><td class=\"font-monospace text-muted\">' + r.keyCode + '</td><td class=\"text-muted small\">' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>按键</th><th>code</th><th>keyCode</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"})
print("Added 键盘按键值大全")

# t9: 图片转PDF (format-conversion category)
fmt_tools = get_tools_list('格式转换')
fmt_tools.append({'name': '图片转PDF', 'path': 'format-conversion/图片转PDF.html', 'category': '格式转换', 'type': 'format-convert', 'desc': '将多张图片文件批量转换为 PDF 文档，支持 JPG、PNG、WebP、GIF 等常见格式，可自定义页面顺序与尺寸。', 'keywords': ['图片转PDF', '图片转PDF', 'PNG转PDF', 'JPEG转PDF', '批量转PDF'], 'title': '图片转PDF - 多图合并为PDF文档', 'description': '在线将多张图片批量转换为PDF文档，支持JPG/PNG/WebP/GIF格式，可自定义页面顺序和尺寸', 'icon': 'bi bi-file-earmark-pdf-fill', 'acceptTypes': 'image/jpeg,image/jpg,image/png,image/webp,image/gif', 'outputFormats': [{'value': 'pdf', 'label': 'PDF'}]})
print("Added 图片转PDF")

# t10: 条形码生成器
life_tools = get_tools_list('生活实用')
life_tools.append({'name': '条形码生成器', 'path': 'life/条形码生成器.html', 'category': '生活实用', 'type': 'generator', 'desc': '在线生成各种规格的条形码，支持 EAN-13、EAN-8、UPC-A、Code 128、Code 39 等多种格式，一键下载 PNG 图片。', 'keywords': ['条形码', '条形码生成', 'barcode', 'EAN', 'UPC', 'Code128'], 'title': '条形码生成器 - 条形码制作工具', 'description': '在线生成条形码，支持EAN-13/UPC-A/Code128/Code39等多种格式，一键下载PNG图片', 'icon': 'bi bi-barcode', 'fields': [{'id': 'data', 'label': '内容/编码', 'type': 'text', 'placeholder': '输入要编码的数据'}, {'id': 'format', 'label': '条形码格式', 'type': 'select', 'options': [{'value': 'ean13', 'label': 'EAN-13（商品条形码）'}, {'value': 'ean8', 'label': 'EAN-8'}, {'value': 'upca', 'label': 'UPC-A'}, {'value': 'code128', 'label': 'Code 128'}, {'value': 'code39', 'label': 'Code 39'}, {'value': 'codabar', 'label': 'Codabar'}]}, {'id': 'width', 'label': '条形码宽度(px)', 'type': 'number', 'placeholder': '200', 'default': '200'}, {'id': 'height', 'label': '条形码高度(px)', 'type': 'number', 'placeholder': '100', 'default': '100'}], 'btnLabel': '生成条形码', 'generateFn': "function(inputs) { var data = inputs.data || ''; var fmt = inputs.format || 'ean13'; var w = parseInt(inputs.width) || 200; var h = parseInt(inputs.height) || 100; if (!data) return '<div class=\"alert alert-warning\">请输入编码内容</div>'; var url = 'https://barcodeapi.org/api/' + fmt + '/' + encodeURIComponent(data); return '<div class=\"text-center\"><img src=\"' + url + '\" width=\"' + w + '\" height=\"' + h + '\" class=\"border rounded\" alt=\"barcode\"/><br><a href=\"' + url + '\" download=\"barcode.png\" class=\"btn btn-primary mt-2\">下载 PNG</a></div>'; }"})
print("Added 条形码生成器")

# t11: 二维码生成
life_tools.append({'name': '二维码生成', 'path': 'life/二维码生成.html', 'category': '生活实用', 'type': 'generator', 'desc': '在线生成高清二维码，支持自定义尺寸、容错级别与颜色，可输入文本、URL、邮箱、电话等信息，一键下载 PNG。', 'keywords': ['二维码', 'QR码', '二维码生成', 'QR code, 'qrcode'], 'title': '二维码生成器 - 在线制作二维码', 'description': '在线生成二维码，支持自定义尺寸、颜色、容错级别，一键下载PNG图片', 'icon': 'bi bi-qr-code', 'fields': [{'id': 'data', 'label': '内容', 'type': 'textarea', 'placeholder': '输入二维码内容（文本、网址、电话等）'}, {'id': 'size', 'label': '尺寸(px)', 'type': 'number', 'placeholder': '200', 'default': '200'}, {'id': 'color', 'label': '前景色', 'type': 'text', 'placeholder': '#000000', 'default': '#000000'}, {'id': 'bgcolor', 'label': '背景色', 'type': 'text', 'placeholder': '#ffffff', 'default': '#ffffff'}, {'id': 'level', 'label': '容错级别', 'type': 'select', 'options': [{'value': 'L', 'label': 'L (7%)'}, {'value': 'M', 'label': 'M (15%)'}, {'value': 'Q', 'label': 'Q (25%)'}, {'value': 'H', 'label': 'H (30%)'}], 'default': 'M'}], 'btnLabel': '生成二维码', 'generateFn': "function(inputs) { var data = inputs.data || 'https://clover.tools'; var size = parseInt(inputs.size) || 200; var color = inputs.color || '#000000'; var bg = inputs.bgcolor || '#ffffff'; var level = inputs.level || 'M'; var url = 'https://api.qrserver.com/v1/create-qr-code/?size=' + size + 'x' + size + '&data=' + encodeURIComponent(data) + '&color=' + color.replace('#','') + '&bgcolor=' + bg.replace('#','') + '&ecc=' + level; return '<div class=\"text-center\"><img src=\"' + url + '\" width=\"' + size + '\" height=\"' + size + '\" class=\"border rounded\" alt=\"qrcode\"/><br><a href=\"' + url + '\" download=\"qrcode.png\" class=\"btn btn-primary mt-2\">下载 PNG</a></div>'; }"})
print("Added 二维码生成")

# t15: Markdown编辑器 (开发工具)
dev_tools = get_tools_list('开发工具')
dev_tools.append({'name': 'Markdown编辑器', 'path': 'dev-tools/Markdown编辑器.html', 'category': '开发工具', 'type': 'tool-custom', 'desc': '在线 Markdown 编辑器，支持实时预览、分栏布局、语法高亮，可导出 HTML 或复制为富文本，适合写作与文档整理。', 'keywords': ['Markdown', 'Markdown编辑器', 'Markdown预览', 'MD编辑器', '写作工具'], 'title': 'Markdown编辑器 - 实时预览写作工具', 'description': '在线Markdown编辑器，支持实时预览、语法高亮、分栏布局，可导出HTML，适合写作与文档整理', 'icon': 'bi bi-markdown', 'customHtml': '<div class="row"><div class="col-md-6 mb-3"><textarea id="md-editor" class="form-control font-monospace" style="min-height:400px" placeholder="# 标题\n\n开始写作..."></textarea></div><div class="col-md-6 mb-3"><div id="md-preview" class="border rounded p-3 bg-white" style="min-height:400px;overflow-y:auto"></div></div></div><div class="mt-2"><button id="md-html-btn" class="btn btn-primary me-2">导出HTML</button><button id="md-copy-btn" class="btn btn-outline-secondary">复制HTML</button></div>', 'customScript': "document.getElementById('md-editor').addEventListener('input', function(e) { var md = e.target.value; var html = ''; var lines = md.split('\\n'); var inList = false; for (var i = 0; i < lines.length; i++) { var line = lines[i]; if (line.match(/^#{1,6}\\s/)) { var level = line.match(/^#+ /)[0].length - 1; var text = line.replace(/^#+ /, ''); html += '<h' + level + '>' + text + '</h' + level + '>'; } else if (line.match(/^\\*\\s/)) { if (!inList) { html += '<ul>'; inList = true; } html += '<li>' + line.replace(/^\\*\\s/, '') + '</li>'; } else if (line.match(/^\\d+\\.\\s/)) { if (!inList) { html += '<ol>'; inList = true; } html += '<li>' + line.replace(/^\\d+\\.\\s/, '') + '</li>'; } else { if (inList) { html += '</ul>'; inList = false; } if (line.trim() === '') { html += '<br>'; } else { line = line.replace(/\\*\\*(.+?)\\*\\*/g, '<strong>$1</strong>'); line = line.replace(/\\*(.+?)\\*/g, '<em>$1</em>'); line = line.replace(/`(.+?)`/g, '<code>$1</code>'); line = line.replace(/\\[(.+?)\\]\\((.+?)\\)/g, '<a href="$2">$1</a>'); html += '<p>' + line + '</p>'; } } } document.getElementById('md-preview').innerHTML = html; }); document.getElementById('md-html-btn').addEventListener('click', function() { var html = '<!DOCTYPE html><html><head><meta charset=\"utf-8\"><title>Markdown Export</title><style>body{font-family:sans-serif;max-width:800px;margin:2rem auto;padding:0 1rem;}code{background:#f4f4f4;padding:2px 4px;border-radius:3px;}pre{background:#f4f4f4;padding:1rem;border-radius:5px;overflow-x:auto;}</style></head><body>' + document.getElementById('md-preview').innerHTML + '</body></html>'; var blob = new Blob([html], {type: 'text/html'}); var a = document.createElement('a'); a.href = URL.createObjectURL(blob); a.download = 'markdown-export.html'; a.click(); }); document.getElementById('md-copy-btn').addEventListener('click', function() { navigator.clipboard.writeText(document.getElementById('md-preview').innerHTML); alert('HTML已复制'); });"})
print("Added Markdown编辑器")

# t16: SQLite查看器
dev_tools.append({'name': 'SQLite查看器', 'path': 'dev-tools/SQLite查看器.html', 'category': '开发工具', 'type': 'tool-custom', 'desc': '在线浏览 SQLite 数据库文件，无需安装任何软件。打开 .db/.sqlite/.sqlite3 文件，自动解析表结构与数据，支持查看表数据与执行 SQL 查询。', 'keywords': ['SQLite', 'SQLite查看器', 'db文件', 'sqlite浏览器', '数据库查看'], 'title': 'SQLite数据库查看器 - 在线浏览SQLite文件', 'description': '在线打开和浏览SQLite数据库文件，无需安装，查看表结构和数据', 'icon': 'bi bi-database', 'customHtml': '<div class="mb-3"><input type="file" id="sqlite-file" accept=".db,.sqlite,.sqlite3" class="form-control"></div><div id="sqlite-tables" class="mb-3"></div><div id="sqlite-content"></div>', 'customScript': "document.getElementById('sqlite-file').addEventListener('change', async function(e) { var file = e.target.files[0]; if (!file) return; var reader = new FileReader(); reader.onload = function(e) { try { var data = new Uint8Array(e.target.result); initSqlJs({ locateFile: function() { return 'https://sql.js.org/dist/sql-wasm.wasm'; } }).then(function(SQL) { var db = new SQL.Database(data); var res = db.exec(\"SELECT name FROM sqlite_master WHERE type=\\'table\\'\"); var tables = res.length > 0 ? res[0].values.map(function(r) { return r[0]; }) : []; var html = '<h6>Tables:</h6><div class=\"list-group\">'; tables.forEach(function(t) { html += '<button class=\"list-group-item list-group-item-action\" onclick=\"loadTable(\\'' + t + '\\')\">' + t + '</button>'; }); html += '</div>'; document.getElementById('sqlite-tables').innerHTML = html; window.currentDb = db; window.loadTable = function(name) { var res = window.currentDb.exec('SELECT * FROM ' + name + ' LIMIT 100'); if (res.length === 0) { document.getElementById('sqlite-content').innerHTML = '<div class=\"text-muted\">表为空</div>'; return; } var cols = res[0].columns; var rows = res[0].values; var tableHtml = '<table class=\"table table-sm table-striped table-bordered\"><thead><tr>'; cols.forEach(function(c) { tableHtml += '<th>' + c + '</th>'; }); tableHtml += '</tr></thead><tbody>'; rows.forEach(function(r) { tableHtml += '<tr>'; r.forEach(function(v) { tableHtml += '<td>' + (v !== null ? v : '<span class=text-muted>NULL</span>') + '</td>'; }); tableHtml += '</tr>'; }); tableHtml += '</tbody></table>'; tableHtml += '<div class="text-muted small mt-2">显示前 ' + rows.length + ' 条</div>'; document.getElementById('sqlite-content').innerHTML = tableHtml; }; }).catch(function(err) { document.getElementById('sqlite-tables').innerHTML = '<div class="alert alert-danger">加载失败: ' + err.message + '</div>'; }); } catch(err) { document.getElementById('sqlite-tables').innerHTML = '<div class="alert alert-danger">错误: ' + err.message + '</div>'; } }; reader.readAsArrayBuffer(file); });"})
print("Added SQLite查看器")

# t17: Javascript格式化
dev_tools.append({'name': 'Javascript格式化', 'path': 'dev-tools/Javascript格式化.html', 'category': '开发工具', 'type': 'formatter', 'desc': '在线格式化/压缩 JavaScript 代码，支持一键美化（Pretty Print）与混淆压缩（Minify），并可自定义缩进空格数。', 'keywords': ['JS格式化', 'JavaScript格式化', 'JS压缩', 'JavaScript压缩', 'JSON格式化'], 'title': 'JavaScript格式化/压缩工具', 'description': '在线格式化（美化）或压缩（混淆）JavaScript代码，支持自定义缩进', 'icon': 'bi bi-braces', 'inputPlaceholder': '输入要格式化的 JS 代码...'})
print("Added Javascript格式化")

# Save
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)
print("All done! tools.json saved")
