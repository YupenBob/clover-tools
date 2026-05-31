import json

with open('tools.json', 'r') as f:
    tools = json.load(f)

# Find category indices
cat_map = {}
for i, cat in enumerate(tools):
    cat_map[cat['category']] = i

# Create 其他工具 category first
other_cat = {
    'category': '其他工具',
    'tools': []
}

# Define new tools to add to 其他工具
ascii_tool = {
    'name': 'ASCII码对照表',
    'path': 'other/ASCII码对照表.html',
    'category': '其他工具',
    'type': 'query',
    'desc': '完整的ASCII字符编码对照表，涵盖可打印字符、控制字符及对应的十进制、十六进制、八进制、HTML实体编码。',
    'keywords': ['ASCII', 'ASCII码', '字符编码', 'ASCII对照表', 'ASCII码表'],
    'title': 'ASCII码对照表 - 字符编码参考表',
    'description': '在线ASCII码对照表查询，涵盖可打印字符、控制字符的十进制、十六进制、HTML实体编码',
    'icon': 'bi bi-code-square',
    'searchable': True,
    'data': [
        {'char': 'NUL', 'dec': '0', 'hex': '00', 'oct': '000', 'html': '&#0;', 'desc': '空字符'},
        {'char': 'SOH', 'dec': '1', 'hex': '01', 'oct': '001', 'html': '&#1;', 'desc': '标题开始'},
        {'char': 'STX', 'dec': '2', 'hex': '02', 'oct': '002', 'html': '&#2;', 'desc': '正文开始'},
        {'char': 'ETX', 'dec': '3', 'hex': '03', 'oct': '003', 'html': '&#3;', 'desc': '正文结束'},
        {'char': 'EOT', 'dec': '4', 'hex': '04', 'oct': '004', 'html': '&#4;', 'desc': '传输结束'},
        {'char': 'ENQ', 'dec': '5', 'hex': '05', 'oct': '005', 'html': '&#5;', 'desc': '询问'},
        {'char': 'ACK', 'dec': '6', 'hex': '06', 'oct': '006', 'html': '&#6;', 'desc': '确认'},
        {'char': 'BEL', 'dec': '7', 'hex': '07', 'oct': '007', 'html': '&#7;', 'desc': '响铃'},
        {'char': 'BS', 'dec': '8', 'hex': '08', 'oct': '010', 'html': '&#8;', 'desc': '退格'},
        {'char': 'TAB', 'dec': '9', 'hex': '09', 'oct': '011', 'html': '&#9;', 'desc': '水平制表'},
        {'char': 'LF', 'dec': '10', 'hex': '0A', 'oct': '012', 'html': '&#10;', 'desc': '换行'},
        {'char': 'VT', 'dec': '11', 'hex': '0B', 'oct': '013', 'html': '&#11;', 'desc': '垂直制表'},
        {'char': 'FF', 'dec': '12', 'hex': '0C', 'oct': '014', 'html': '&#12;', 'desc': '换页'},
        {'char': 'CR', 'dec': '13', 'hex': '0D', 'oct': '015', 'html': '&#13;', 'desc': '回车'},
        {'char': 'SO', 'dec': '14', 'hex': '0E', 'oct': '016', 'html': '&#14;', 'desc': '移出'},
        {'char': 'SI', 'dec': '15', 'hex': '0F', 'oct': '017', 'html': '&#15;', 'desc': '移入'},
        {'char': 'DLE', 'dec': '16', 'hex': '10', 'oct': '020', 'html': '&#16;', 'desc': '数据链路转义'},
        {'char': 'DC1', 'dec': '17', 'hex': '11', 'oct': '021', 'html': '&#17;', 'desc': '设备控制1'},
        {'char': 'DC2', 'dec': '18', 'hex': '12', 'oct': '022', 'html': '&#18;', 'desc': '设备控制2'},
        {'char': 'DC3', 'dec': '19', 'hex': '13', 'oct': '023', 'html': '&#19;', 'desc': '设备控制3'},
        {'char': 'DC4', 'dec': '20', 'hex': '14', 'oct': '024', 'html': '&#20;', 'desc': '设备控制4'},
        {'char': 'NAK', 'dec': '21', 'hex': '15', 'oct': '025', 'html': '&#21;', 'desc': '否定'},
        {'char': 'SYN', 'dec': '22', 'hex': '16', 'oct': '026', 'html': '&#22;', 'desc': '同步'},
        {'char': 'ETB', 'dec': '23', 'hex': '17', 'oct': '027', 'html': '&#23;', 'desc': '传输块结束'},
        {'char': 'CAN', 'dec': '24', 'hex': '18', 'oct': '030', 'html': '&#24;', 'desc': '取消'},
        {'char': 'EM', 'dec': '25', 'hex': '19', 'oct': '031', 'html': '&#25;', 'desc': '媒体结束'},
        {'char': 'SUB', 'dec': '26', 'hex': '1A', 'oct': '032', 'html': '&#26;', 'desc': '替换'},
        {'char': 'ESC', 'dec': '27', 'hex': '1B', 'oct': '033', 'html': '&#27;', 'desc': '转义'},
        {'char': 'FS', 'dec': '28', 'hex': '1C', 'oct': '034', 'html': '&#28;', 'desc': '文件分隔符'},
        {'char': 'GS', 'dec': '29', 'hex': '1D', 'oct': '035', 'html': '&#29;', 'desc': '组分隔符'},
        {'char': 'RS', 'dec': '30', 'hex': '1E', 'oct': '036', 'html': '&#30;', 'desc': '记录分隔符'},
        {'char': 'US', 'dec': '31', 'hex': '1F', 'oct': '037', 'html': '&#31;', 'desc': '单元分隔符'},
        {'char': 'Space', 'dec': '32', 'hex': '20', 'oct': '040', 'html': '&#32;', 'desc': '空格'},
        {'char': '!', 'dec': '33', 'hex': '21', 'oct': '041', 'html': '&#33;', 'desc': '感叹号'},
        {'char': '"', 'dec': '34', 'hex': '22', 'oct': '042', 'html': '&#34;', 'desc': '双引号'},
        {'char': '#', 'dec': '35', 'hex': '23', 'oct': '043', 'html': '&#35;', 'desc': '井号'},
        {'char': '$', 'dec': '36', 'hex': '24', 'oct': '044', 'html': '&#36;', 'desc': '美元符号'},
        {'char': '%', 'dec': '37', 'hex': '25', 'oct': '045', 'html': '&#37;', 'desc': '百分号'},
        {'char': '&', 'dec': '38', 'hex': '26', 'oct': '046', 'html': '&#38;', 'desc': '和号'},
        {"char": "'", 'dec': '39', 'hex': '27', 'oct': '047', 'html': '&#39;', 'desc': '单引号'},
        {'char': '(', 'dec': '40', 'hex': '28', 'oct': '050', 'html': '&#40;', 'desc': '左括号'},
        {'char': ')', 'dec': '41', 'hex': '29', 'oct': '051', 'html': '&#41;', 'desc': '右括号'},
        {'char': '*', 'dec': '42', 'hex': '2A', 'oct': '052', 'html': '&#42;', 'desc': '星号'},
        {'char': '+', 'dec': '43', 'hex': '2B', 'oct': '053', 'html': '&#43;', 'desc': '加号'},
        {'char': ',', 'dec': '44', 'hex': '2C', 'oct': '054', 'html': '&#44;', 'desc': '逗号'},
        {'char': '-', 'dec': '45', 'hex': '2D', 'oct': '055', 'html': '&#45;', 'desc': '连字符'},
        {'char': '.', 'dec': '46', 'hex': '2E', 'oct': '056', 'html': '&#46;', 'desc': '句号'},
        {'char': '/', 'dec': '47', 'hex': '2F', 'oct': '057', 'html': '&#47;', 'desc': '斜杠'},
        {'char': '0', 'dec': '48', 'hex': '30', 'oct': '060', 'html': '&#48;', 'desc': '数字0'},
        {'char': '1', 'dec': '49', 'hex': '31', 'oct': '061', 'html': '&#49;', 'desc': '数字1'},
        {'char': '2', 'dec': '50', 'hex': '32', 'oct': '062', 'html': '&#50;', 'desc': '数字2'},
        {'char': '3', 'dec': '51', 'hex': '33', 'oct': '063', 'html': '&#51;', 'desc': '数字3'},
        {'char': '4', 'dec': '52', 'hex': '34', 'oct': '064', 'html': '&#52;', 'desc': '数字4'},
        {'char': '5', 'dec': '53', 'hex': '35', 'oct': '065', 'html': '&#53;', 'desc': '数字5'},
        {'char': '6', 'dec': '54', 'hex': '36', 'oct': '066', 'html': '&#54;', 'desc': '数字6'},
        {'char': '7', 'dec': '55', 'hex': '37', 'oct': '067', 'html': '&#55;', 'desc': '数字7'},
        {'char': '8', 'dec': '56', 'hex': '38', 'oct': '070', 'html': '&#56;', 'desc': '数字8'},
        {'char': '9', 'dec': '57', 'hex': '39', 'oct': '071', 'html': '&#57;', 'desc': '数字9'},
        {'char': ':', 'dec': '58', 'hex': '3A', 'oct': '072', 'html': '&#58;', 'desc': '冒号'},
        {'char': ';', 'dec': '59', 'hex': '3B', 'oct': '073', 'html': '&#59;', 'desc': '分号'},
        {'char': '<', 'dec': '60', 'hex': '3C', 'oct': '074', 'html': '&#60;', 'desc': '小于号'},
        {'char': '=', 'dec': '61', 'hex': '3D', 'oct': '075', 'html': '&#61;', 'desc': '等号'},
        {'char': '>', 'dec': '62', 'hex': '3E', 'oct': '076', 'html': '&#62;', 'desc': '大于号'},
        {'char': '?', 'dec': '63', 'hex': '3F', 'oct': '077', 'html': '&#63;', 'desc': '问号'},
        {'char': '@', 'dec': '64', 'hex': '40', 'oct': '100', 'html': '&#64;', 'desc': '艾特符号'},
        {'char': 'A', 'dec': '65', 'hex': '41', 'oct': '101', 'html': '&#65;', 'desc': '大写字母A'},
        {'char': 'B', 'dec': '66', 'hex': '42', 'oct': '102', 'html': '&#66;', 'desc': '大写字母B'},
        {'char': 'C', 'dec': '67', 'hex': '43', 'oct': '103', 'html': '&#67;', 'desc': '大写字母C'},
        {'char': 'D', 'dec': '68', 'hex': '44', 'oct': '104', 'html': '&#68;', 'desc': '大写字母D'},
        {'char': 'E', 'dec': '69', 'hex': '45', 'oct': '105', 'html': '&#69;', 'desc': '大写字母E'},
        {'char': 'F', 'dec': '70', 'hex': '46', 'oct': '106', 'html': '&#70;', 'desc': '大写字母F'},
        {'char': 'G', 'dec': '71', 'hex': '47', 'oct': '107', 'html': '&#71;', 'desc': '大写字母G'},
        {'char': 'H', 'dec': '72', 'hex': '48', 'oct': '110', 'html': '&#72;', 'desc': '大写字母H'},
        {'char': 'I', 'dec': '73', 'hex': '49', 'oct': '111', 'html': '&#73;', 'desc': '大写字母I'},
        {'char': 'J', 'dec': '74', 'hex': '4A', 'oct': '112', 'html': '&#74;', 'desc': '大写字母J'},
        {'char': 'K', 'dec': '75', 'hex': '4B', 'oct': '113', 'html': '&#75;', 'desc': '大写字母K'},
        {'char': 'L', 'dec': '76', 'hex': '4C', 'oct': '114', 'html': '&#76;', 'desc': '大写字母L'},
        {'char': 'M', 'dec': '77', 'hex': '4D', 'oct': '115', 'html': '&#77;', 'desc': '大写字母M'},
        {'char': 'N', 'dec': '78', 'hex': '4E', 'oct': '116', 'html': '&#78;', 'desc': '大写字母N'},
        {'char': 'O', 'dec': '79', 'hex': '4F', 'oct': '117', 'html': '&#79;', 'desc': '大写字母O'},
        {'char': 'P', 'dec': '80', 'hex': '50', 'oct': '120', 'html': '&#80;', 'desc': '大写字母P'},
        {'char': 'Q', 'dec': '81', 'hex': '51', 'oct': '121', 'html': '&#81;', 'desc': '大写字母Q'},
        {'char': 'R', 'dec': '82', 'hex': '52', 'oct': '122', 'html': '&#82;', 'desc': '大写字母R'},
        {'char': 'S', 'dec': '83', 'hex': '53', 'oct': '123', 'html': '&#83;', 'desc': '大写字母S'},
        {'char': 'T', 'dec': '84', 'hex': '54', 'oct': '124', 'html': '&#84;', 'desc': '大写字母T'},
        {'char': 'U', 'dec': '85', 'hex': '55', 'oct': '125', 'html': '&#85;', 'desc': '大写字母U'},
        {'char': 'V', 'dec': '86', 'hex': '56', 'oct': '126', 'html': '&#86;', 'desc': '大写字母V'},
        {'char': 'W', 'dec': '87', 'hex': '57', 'oct': '127', 'html': '&#87;', 'desc': '大写字母W'},
        {'char': 'X', 'dec': '88', 'hex': '58', 'oct': '130', 'html': '&#88;', 'desc': '大写字母X'},
        {'char': 'Y', 'dec': '89', 'hex': '59', 'oct': '131', 'html': '&#89;', 'desc': '大写字母Y'},
        {'char': 'Z', 'dec': '90', 'hex': '5A', 'oct': '132', 'html': '&#90;', 'desc': '大写字母Z'},
        {'char': '[', 'dec': '91', 'hex': '5B', 'oct': '133', 'html': '&#91;', 'desc': '左方括号'},
        {'char': '\\', 'dec': '92', 'hex': '5C', 'oct': '134', 'html': '&#92;', 'desc': '反斜杠'},
        {'char': ']', 'dec': '93', 'hex': '5D', 'oct': '135', 'html': '&#93;', 'desc': '右方括号'},
        {'char': '^', 'dec': '94', 'hex': '5E', 'oct': '136', 'html': '&#136;', 'desc': '脱字符'},
        {'char': '_', 'dec': '95', 'hex': '5F', 'oct': '137', 'html': '&#95;', 'desc': '下划线'},
        {'char': '`', 'dec': '96', 'hex': '60', 'oct': '140', 'html': '&#96;', 'desc': '反引号'},
        {'char': 'a', 'dec': '97', 'hex': '61', 'oct': '141', 'html': '&#97;', 'desc': '小写字母a'},
        {'char': 'b', 'dec': '98', 'hex': '62', 'oct': '142', 'html': '&#98;', 'desc': '小写字母b'},
        {'char': 'c', 'dec': '99', 'hex': '63', 'oct': '143', 'html': '&#99;', 'desc': '小写字母c'},
        {'char': 'd', 'dec': '100', 'hex': '64', 'oct': '144', 'html': '&#100;', 'desc': '小写字母d'},
        {'char': 'e', 'dec': '101', 'hex': '65', 'oct': '145', 'html': '&#101;', 'desc': '小写字母e'},
        {'char': 'f', 'dec': '102', 'hex': '66', 'oct': '146', 'html': '&#102;', 'desc': '小写字母f'},
        {'char': 'g', 'dec': '103', 'hex': '67', 'oct': '147', 'html': '&#103;', 'desc': '小写字母g'},
        {'char': 'h', 'dec': '104', 'hex': '68', 'oct': '150', 'html': '&#104;', 'desc': '小写字母h'},
        {'char': 'i', 'dec': '105', 'hex': '69', 'oct': '151', 'html': '&#105;', 'desc': '小写字母i'},
        {'char': 'j', 'dec': '106', 'hex': '6A', 'oct': '152', 'html': '&#106;', 'desc': '小写字母j'},
        {'char': 'k', 'dec': '107', 'hex': '6B', 'oct': '153', 'html': '&#107;', 'desc': '小写字母k'},
        {'char': 'l', 'dec': '108', 'hex': '6C', 'oct': '154', 'html': '&#108;', 'desc': '小写字母l'},
        {'char': 'm', 'dec': '109', 'hex': '6D', 'oct': '155', 'html': '&#109;', 'desc': '小写字母m'},
        {'char': 'n', 'dec': '110', 'hex': '6E', 'oct': '156', 'html': '&#110;', 'desc': '小写字母n'},
        {'char': 'o', 'dec': '111', 'hex': '6F', 'oct': '157', 'html': '&#111;', 'desc': '小写字母o'},
        {'char': 'p', 'dec': '112', 'hex': '70', 'oct': '160', 'html': '&#112;', 'desc': '小写字母p'},
        {'char': 'q', 'dec': '113', 'hex': '71', 'oct': '161', 'html': '&#113;', 'desc': '小写字母q'},
        {'char': 'r', 'dec': '114', 'hex': '72', 'oct': '162', 'html': '&#114;', 'desc': '小写字母r'},
        {'char': 's', 'dec': '115', 'hex': '73', 'oct': '163', 'html': '&#115;', 'desc': '小写字母s'},
        {'char': 't', 'dec': '116', 'hex': '74', 'oct': '164', 'html': '&#116;', 'desc': '小写字母t'},
        {'char': 'u', 'dec': '117', 'hex': '75', 'oct': '165', 'html': '&#117;', 'desc': '小写字母u'},
        {'char': 'v', 'dec': '118', 'hex': '76', 'oct': '166', 'html': '&#118;', 'desc': '小写字母v'},
        {'char': 'w', 'dec': '119', 'hex': '77', 'oct': '167', 'html': '&#119;', 'desc': '小写字母w'},
        {'char': 'x', 'dec': '120', 'hex': '78', 'oct': '170', 'html': '&#120;', 'desc': '小写字母x'},
        {'char': 'y', 'dec': '121', 'hex': '79', 'oct': '171', 'html': '&#121;', 'desc': '小写字母y'},
        {'char': 'z', 'dec': '122', 'hex': '7A', 'oct': '172', 'html': '&#122;', 'desc': '小写字母z'},
        {'char': '{', 'dec': '123', 'hex': '7B', 'oct': '173', 'html': '&#123;', 'desc': '左花括号'},
        {'char': '|', 'dec': '124', 'hex': '7C', 'oct': '174', 'html': '&#124;', 'desc': '竖线'},
        {'char': '}', 'dec': '125', 'hex': '7D', 'oct': '175', 'html': '&#125;', 'desc': '右花括号'},
        {'char': '~', 'dec': '126', 'hex': '7E', 'oct': '176', 'html': '&#126;', 'desc': '波浪号'},
        {'char': 'DEL', 'dec': '127', 'hex': '7F', 'oct': '177', 'html': '&#127;', 'desc': '删除'}
    ],
    'renderFn': '''function(data, search) {
        if (!search || search.trim() === "") {
            return `<table class="table table-sm table-striped"><thead><tr><th>字符</th><th>十进制</th><th>十六进制</th><th>八进制</th><th>HTML实体</th><th>说明</th></tr></thead><tbody>${data.map(row => `<tr><td class="font-monospace fw-bold">${row.char}</td><td class="font-monospace">${row.dec}</td><td class="font-monospace text-muted">${row.hex}</td><td class="font-monospace text-muted">${row.oct}</td><td class="font-monospace">${row.html}</td><td>${row.desc}</td></tr>`).join('')}</tbody></table>`;
        }
        const s = search.toLowerCase();
        const filtered = data.filter(row => row.char.toLowerCase().includes(s) || row.dec.includes(s) || row.hex.toLowerCase().includes(s) || row.desc.includes(s));
        if (filtered.length === 0) return '<div class="text-muted">未找到匹配结果</div>';
        return `<div class="mb-2 text-muted small">找到 ${filtered.length} 条结果</div><table class="table table-sm table-striped"><thead><tr><th>字符</th><th>十进制</th><th>十六进制</th><th>八进制</th><th>HTML实体</th><th>说明</th></tr></thead><tbody>${filtered.map(row => `<tr><td class="font-monospace fw-bold">${row.char}</td><td class="font-monospace">${row.dec}</td><td class="font-monospace text-muted">${row.hex}</td><td class="font-monospace text-muted">${row.oct}</td><td class="font-monospace">${row.html}</td><td>${row.desc}</td></tr>`).join('')}</tbody></table>`;
    }'''
}

other_cat['tools'].append(ascii_tool)
print(f"Added {ascii_tool['name']}")

# Write back
with open('tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)

print("Step 1 done - Added ASCII tool, 其他工具 category created")