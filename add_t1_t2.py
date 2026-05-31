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

# --- t1: ASCII码对照表 ---
ascii_chars = ['NUL','SOH','STX','ETX','EOT','ENQ','ACK','BEL','BS','TAB','LF','VT','FF','CR','SO','SI','DLE','DC1','DC2','DC3','DC4','NAK','SYN','ETB','CAN','EM','SUB','ESC','FS','GS','RS','US','Space','!','"','#','$','%','&',"'",'(',')','*','+',',','-','.','/','0','1','2','3','4','5','6','7','8','9',':',';','<','=','>','?','@','A','B','C','D','E','F','G','H','I','J','K','L','M','N','O','P','Q','R','S','T','U','V','W','X','Y','Z','[','\\',']','^','_','`','a','b','c','d','e','f','g','h','i','j','k','l','m','n','o','p','q','r','s','t','u','v','w','x','y','z','{','|','}','~','DEL']
descs = ['空字符','标题开始','正文开始','正文结束','传输结束','询问','确认','响铃','退格','水平制表','换行','垂直制表','换页','回车','移出','移入','数据链路转义','设备控制1','设备控制2','设备控制3','设备控制4','否定','同步','传输块结束','取消','媒体结束','替换','转义','文件分隔符','组分隔符','记录分隔符','单元分隔符','空格','感叹号','双引号','井号','美元符号','百分号','和号','单引号','左括号','右括号','星号','加号','逗号','连字符','句号','斜杠','数字0','数字1','数字2','数字3','数字4','数字5','数字6','数字7','数字8','数字9','冒号','分号','小于号','等号','大于号','问号','艾特符号','大写字母A','大写字母B','大写字母C','大写字母D','大写字母E','大写字母F','大写字母G','大写字母H','大写字母I','大写字母J','大写字母K','大写字母L','大写字母M','大写字母N','大写字母O','大写字母P','大写字母Q','大写字母R','大写字母S','大写字母T','大写字母U','大写字母V','大写字母W','大写字母X','大写字母Y','大写字母Z','左方括号','反斜杠','右方括号','脱字符','下划线','反引号','小写字母a','小写字母b','小写字母c','小写字母d','小写字母e','小写字母f','小写字母g','小写字母h','小写字母i','小写字母j','小写字母k','小写字母l','小写字母m','小写字母n','小写字母o','小写字母p','小写字母q','小写字母r','小写字母s','小写字母t','小写字母u','小写字母v','小写字母w','小写字母x','小写字母y','小写字母z','左花括号','竖线','右花括号','波浪号','删除']

ascii_data = []
for i, c in enumerate(ascii_chars):
    d = i
    ascii_data.append({
        'char': c,
        'dec': str(d),
        'hex': f'{d:02X}',
        'oct': f'{d:03o}',
        'html': f'&#{d};' if d > 31 else f'&#{d};',
        'desc': descs[i] if i < len(descs) else ''
    })

rf_ascii = "function(data, search) { if (!search || search.trim() === '') { var rows = data.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\">' + r.char + '</td><td class=\"font-monospace\">' + r.dec + '</td><td class=\"font-monospace text-muted\">' + r.hex + '</td><td class=\"font-monospace text-muted\">' + r.oct + '</td><td class=\"font-monospace\">' + r.html + '</td><td>' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>字符</th><th>十进制</th><th>十六进制</th><th>八进制</th><th>HTML实体</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; } var s = search.toLowerCase(); var f = data.filter(function(r) { return r.char.toLowerCase().includes(s) || r.dec.includes(s) || r.hex.toLowerCase().includes(s) || r.desc.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; var rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>'; rows += f.map(function(r) { return '<tr><td class=\"font-monospace fw-bold\">' + r.char + '</td><td class=\"font-monospace\">' + r.dec + '</td><td class=\"font-monospace text-muted\">' + r.hex + '</td><td class=\"font-monospace text-muted\">' + r.oct + '</td><td class=\"font-monospace\">' + r.html + '</td><td>' + r.desc + '</td></tr>'; }).join(''); return '<table class=\"table table-sm table-striped\"><thead><tr><th>字符</th><th>十进制</th><th>十六进制</th><th>八进制</th><th>HTML实体</th><th>说明</th></tr></thead><tbody>' + rows + '</tbody></table>'; }"

other.append({'name': 'ASCII码对照表', 'path': 'other/ASCII码对照表.html', 'category': '其他工具', 'type': 'query', 'desc': '完整的ASCII字符编码对照表，涵盖可打印字符、控制字符及对应的十进制、十六进制、八进制、HTML实体编码。', 'keywords': ['ASCII', 'ASCII码', '字符编码', 'ASCII对照表', 'ASCII码表'], 'title': 'ASCII码对照表 - 字符编码参考表', 'description': '在线ASCII码对照表查询，涵盖可打印字符、控制字符的十进制、十六进制、HTML实体编码', 'icon': 'bi bi-code-square', 'searchable': True, 'data': ascii_data, 'renderFn': rf_ascii})
print("Added ASCII码对照表")

# --- t2: Emoji表情大全 ---
emoji_data = [
    {'emoji': '\U0001F600', 'name': '大笑', 'keywords': 'face happy smile grin'},
    {'emoji': '\U0001F603', 'name': '大笑2', 'keywords': 'face happy smile open'},
    {'emoji': '\U0001F604', 'name': '欢笑', 'keywords': 'face happy laugh'},
    {'emoji': '\U0001F601', 'name': '微笑', 'keywords': 'face grin smile'},
    {'emoji': '\U0001F606', 'name': '笑哭', 'keywords': 'face laugh cry'},
    {'emoji': '\U0001F605', 'name': '苦笑', 'keywords': 'face sweat smile'},
    {'emoji': '\U0001F602', 'name': '笑到哭', 'keywords': 'face tears joy'},
    {'emoji': '\U0001F923', 'name': '笑到打滚', 'keywords': 'face roll laugh'},
    {'emoji': '\U0001F60A', 'name': '微笑脸', 'keywords': 'face blush smile'},
    {'emoji': '\U0001F607', 'name': '天使', 'keywords': 'face halo smile'},
    {'emoji': '\U0001F642', 'name': '嘴角上扬', 'keywords': 'face slight smile'},
    {'emoji': '\U0001F609', 'name': '眨眼', 'keywords': 'face wink'},
    {'emoji': '\U0001F60D', 'name': '花痴', 'keywords': 'face love heart eyes'},
    {'emoji': '\U0001F970', 'name': '爱心脸', 'keywords': 'face love hearts'},
    {'emoji': '\U0001F618', 'name': '飞吻', 'keywords': 'face kiss love'},
    {'emoji': '\U0001F60B', 'name': '舔嘴', 'keywords': 'face yum delicious'},
    {'emoji': '\U0001F61C', 'name': '调皮', 'keywords': 'face tongue wink'},
    {'emoji': '\U0001F92A', 'name': '疯子', 'keywords': 'face crazy'},
    {'emoji': '\U0001F61D', 'name': '鬼脸', 'keywords': 'face tongue eyes'},
    {'emoji': '\U0001F911', 'name': '发财', 'keywords': 'face money mouth'},
    {'emoji': '\U0001F917', 'name': '拥抱', 'keywords': 'face hug'},
    {'emoji': '\U0001F914', 'name': '思考', 'keywords': 'face think'},
    {'emoji': '\U0001F92B', 'name': '嘘', 'keywords': 'face shush'},
    {'emoji': '\U0001F92D', 'name': '捂嘴笑', 'keywords': 'face hand mouth'},
    {'emoji': '\U0001F925', 'name': '怀疑', 'keywords': 'face liar'},
    {'emoji': '\U0001F636', 'name': '闭嘴', 'keywords': 'face silent'},
    {'emoji': '\U0001F60F', 'name': '坏笑', 'keywords': 'face smirk'},
    {'emoji': '\U0001F612', 'name': '无奈', 'keywords': 'face unamused'},
    {'emoji': '\U0001F614', 'name': '失落', 'keywords': 'face pensive'},
    {'emoji': '\U0001F634', 'name': '睡着', 'keywords': 'face sleep'},
    {'emoji': '\U0001F924', 'name': '流口水', 'keywords': 'face drool'},
    {'emoji': '\U0001F637', 'name': '生病', 'keywords': 'face mask sick'},
    {'emoji': '\U0001F912', 'name': '发烧', 'keywords': 'face fever'},
    {'emoji': '\U0001F915', 'name': '受伤', 'keywords': 'face injury'},
    {'emoji': '\U0001F635', 'name': '眩晕', 'keywords': 'face dizzy'},
    {'emoji': '\U0001F974', 'name': '醉酒', 'keywords': 'face woozy'},
    {'emoji': '\U0001F60E', 'name': '墨镜', 'keywords': 'face cool sunglasses'},
    {'emoji': '\U0001F913', 'name': '书呆子', 'keywords': 'face nerd'},
    {'emoji': '\U0001F9D0', 'name': '放大镜', 'keywords': 'face monocle'},
    {'emoji': '\U0001F920', 'name': '牛仔帽', 'keywords': 'face cowboy'},
    {'emoji': '\U0001F973', 'name': '派对', 'keywords': 'face party'},
    {'emoji': '\U0001F97A', 'name': '求求了', 'keywords': 'face pleading'},
    {'emoji': '\U0001F62D', 'name': '大哭', 'keywords': 'face cry sob'},
    {'emoji': '\U0001F624', 'name': '生气', 'keywords': 'face angry steam'},
    {'emoji': '\U0001F620', 'name': '愤怒', 'keywords': 'face angry'},
    {'emoji': '\U0001F621', 'name': '暴怒', 'keywords': 'face rage'},
    {'emoji': '\U0001F92C', 'name': '骂人', 'keywords': 'face censor'},
    {'emoji': '\U0001F608', 'name': '小恶魔', 'keywords': 'face devil horns'},
    {'emoji': '\U0001F47F', 'name': '恶魔', 'keywords': 'face imp'},
    {'emoji': '\U0001F480', 'name': '骷髅', 'keywords': 'face skull death'},
    {'emoji': '\U0001F47B', 'name': '鬼', 'keywords': 'face ghost'},
    {'emoji': '\U0001F4A9', 'name': '便便', 'keywords': 'face poo'},
    {'emoji': '\U0001F921', 'name': '小丑', 'keywords': 'face clown'},
    {'emoji': '\U0001F44D', 'name': '点赞', 'keywords': 'hand thumb up like'},
    {'emoji': '\U0001F44E', 'name': '踩', 'keywords': 'hand thumb down dislike'},
    {'emoji': '\U0001F44F', 'name': '鼓掌', 'keywords': 'hand clap'},
    {'emoji': '\U0001F64C', 'name': '双手举高', 'keywords': 'hand raise celebration'},
    {'emoji': '\U0001F91D', 'name': '握手', 'keywords': 'hand shake agreement'},
    {'emoji': '\U0001F64F', 'name': '双手合十', 'keywords': 'hand pray thanks'},
    {'emoji': '\U0001F4AA', 'name': '肌肉', 'keywords': 'hand muscle strong'},
    {'emoji': '\U0001F49F', 'name': '红心', 'keywords': 'heart red love'},
    {'emoji': '\U0001F9E1', 'name': '橙心', 'keywords': 'heart orange'},
    {'emoji': '\U0001F49B', 'name': '黄心', 'keywords': 'heart yellow'},
    {'emoji': '\U0001F49A', 'name': '绿心', 'keywords': 'heart green'},
    {'emoji': '\U0001F499', 'name': '蓝心', 'keywords': 'heart blue'},
    {'emoji': '\U0001F49C', 'name': '紫心', 'keywords': 'heart purple'},
    {'emoji': '\U0001F5A4', 'name': '黑心', 'keywords': 'heart black'},
    {'emoji': '\U0001F494', 'name': '心碎', 'keywords': 'heart break broken'},
    {'emoji': '\U0001F495', 'name': '双心', 'keywords': 'heart two love'},
    {'emoji': '\U0001F49E', 'name': '旋转心', 'keywords': 'heart spinning'},
    {'emoji': '\U0001F493', 'name': '心跳', 'keywords': 'heart beat'},
    {'emoji': '\U0001F497', 'name': '增长的心', 'keywords': 'heart growing'},
    {'emoji': '\U0001F496', 'name': '闪亮的心', 'keywords': 'heart sparkle'},
    {'emoji': '\U0001F498', 'name': '丘比特心', 'keywords': 'heart cupid arrow'},
    {'emoji': '\U0001F49D', 'name': '丝带心', 'keywords': 'heart gift ribbon'},
    {'emoji': '\U0001F339', 'name': '红玫瑰', 'keywords': 'flower rose red'},
    {'emoji': '\U0001F338', 'name': '樱花', 'keywords': 'flower cherry blossom'},
    {'emoji': '\U0001F33A', 'name': '芙蓉', 'keywords': 'flower hibiscus'},
    {'emoji': '\U0001F33B', 'name': '向日葵', 'keywords': 'flower sunflower'},
    {'emoji': '\U0001F33C', 'name': '小花', 'keywords': 'flower blossom'},
    {'emoji': '\U0001F337', 'name': '郁金香', 'keywords': 'flower tulip'},
    {'emoji': '\U0001F331', 'name': '幼苗', 'keywords': 'plant seed sprout'},
    {'emoji': '\U0001F332', 'name': '大树', 'keywords': 'plant tree evergreen'},
    {'emoji': '\U0001F333', 'name': '落叶树', 'keywords': 'plant tree deciduous'},
    {'emoji': '\U0001F334', 'name': '棕榈树', 'keywords': 'plant palm tree'},
    {'emoji': '\U0001F335', 'name': '仙人掌', 'keywords': 'plant cactus'},
    {'emoji': '\U0001F33E', 'name': '稻穗', 'keywords': 'plant rice wheat'},
    {'emoji': '\U0001F33F', 'name': '小草', 'keywords': 'plant herb leaf'},
    {'emoji': '\U00002618', 'name': '三叶草', 'keywords': 'plant clover shamrock'},
    {'emoji': '\U0001F340', 'name': '四叶草', 'keywords': 'plant clover four leaf lucky'},
    {'emoji': '\U0001F341', 'name': '枫叶', 'keywords': 'plant maple leaf'},
    {'emoji': '\U0001F342', 'name': '落叶', 'keywords': 'plant leaf fallen'},
    {'emoji': '\U0001F343', 'name': '绿叶', 'keywords': 'plant leaf fluttering'},
    {'emoji': '\U0001F344', 'name': '蘑菇', 'keywords': 'mushroom fungus'},
    {'emoji': '\U0001F330', 'name': '栗子', 'keywords': 'chestnut acorn'},
    {'emoji': '\U0001F980', 'name': '螃蟹', 'keywords': 'crab crustacean'},
    {'emoji': '\U0001F990', 'name': '虾', 'keywords': 'shrimp prawn seafood'},
    {'emoji': '\U0001F991', 'name': '鱿鱼', 'keywords': 'squid octopus sea'},
    {'emoji': '\U0001F41F', 'name': '鱼', 'keywords': 'fish tropical'},
    {'emoji': '\U0001F420', 'name': '热带鱼', 'keywords': 'fish tropical'},
    {'emoji': '\U0001F421', 'name': '河豚', 'keywords': 'fish blowfish'},
    {'emoji': '\U0001F42C', 'name': '海豚', 'keywords': 'dolphin sea'},
    {'emoji': '\U0001F433', 'name': '鲸鱼', 'keywords': 'whale spout'},
    {'emoji': '\U0001F988', 'name': '鲨鱼', 'keywords': 'shark fish'},
    {'emoji': '\U0001F40A', 'name': '鳄鱼', 'keywords': 'crocodile alligator'},
    {'emoji': '\U0001F405', 'name': '老虎', 'keywords': 'tiger cat'},
    {'emoji': '\U0001F981', 'name': '狮子', 'keywords': 'lion cat'},
    {'emoji': '\U0001F43B', 'name': '熊', 'keywords': 'bear'},
    {'emoji': '\U0001F43C', 'name': '熊猫', 'keywords': 'panda bear'},
    {'emoji': '\U0001F428', 'name': '考拉', 'keywords': 'koala bear'},
    {'emoji': '\U0001F42F', 'name': '豹子', 'keywords': 'leopard cat'},
    {'emoji': '\U0001F98A', 'name': '狐狸', 'keywords': 'fox'},
    {'emoji': '\U0001F430', 'name': '兔子', 'keywords': 'rabbit bunny'},
    {'emoji': '\U0001F436', 'name': '小狗', 'keywords': 'dog puppy pet'},
    {'emoji': '\U0001F431', 'name': '小猫', 'keywords': 'cat kitten pet'},
    {'emoji': '\U0001F42D', 'name': '老鼠', 'keywords': 'mouse rat'},
    {'emoji': '\U0001F439', 'name': '仓鼠', 'keywords': 'hamster pet'},
    {'emoji': '\U0001F437', 'name': '猪', 'keywords': 'pig piglet'},
    {'emoji': '\U0001F438', 'name': '青蛙', 'keywords': 'frog'},
    {'emoji': '\U0001F98B', 'name': '蝴蝶', 'keywords': 'butterfly insect'},
    {'emoji': '\U0001F41D', 'name': '蜜蜂', 'keywords': 'bee honey insect'},
    {'emoji': '\U0001F41E', 'name': '瓢虫', 'keywords': 'ladybug insect'},
    {'emoji': '\U0001F997', 'name': '蟋蟀', 'keywords': 'cricket insect'},
    {'emoji': '\U0001F40C', 'name': '蜗牛', 'keywords': 'snail slug'},
    {'emoji': '\U0001F34E', 'name': '红苹果', 'keywords': 'fruit apple red'},
    {'emoji': '\U0001F34F', 'name': '青苹果', 'keywords': 'fruit apple green'},
    {'emoji': '\U0001F34A', 'name': '橘子', 'keywords': 'fruit tangerine'},
    {'emoji': '\U0001F34B', 'name': '柠檬', 'keywords': 'fruit lemon'},
    {'emoji': '\U0001F34C', 'name': '香蕉', 'keywords': 'fruit banana'},
    {'emoji': '\U0001F349', 'name': '西瓜', 'keywords': 'fruit watermelon'},
    {'emoji': '\U0001F347', 'name': '葡萄', 'keywords': 'fruit grape'},
    {'emoji': '\U0001F353', 'name': '草莓', 'keywords': 'fruit strawberry'},
    {'emoji': '\U0001F352', 'name': '樱桃', 'keywords': 'fruit cherry'},
    {'emoji': '\U0001F351', 'name': '桃子', 'keywords': 'fruit peach'},
    {'emoji': '\U0001F96D', 'name': '芒果', 'keywords': 'fruit mango'},
    {'emoji': '\U0001F345', 'name': '番茄', 'keywords': 'vegetable tomato'},
    {'emoji': '\U0001F951', 'name': '牛油果', 'keywords': 'vegetable avocado'},
    {'emoji': '\U0001F355', 'name': '披萨', 'keywords': 'food pizza'},
    {'emoji': '\U0001F354', 'name': '汉堡', 'keywords': 'food burger hamburger'},
    {'emoji': '\U0001F35F', 'name': '薯条', 'keywords': 'food fries'},
    {'emoji': '\U0001F32D', 'name': '热狗', 'keywords': 'food hotdog'},
    {'emoji': '\U0001F37F', 'name': '爆米花', 'keywords': 'food popcorn'},
    {'emoji': '\U0001F369', 'name': '甜甜圈', 'keywords': 'food donut'},
    {'emoji': '\U0001F36A', 'name': '饼干', 'keywords': 'food cookie'},
    {'emoji': '\U0001F382', 'name': '蛋糕', 'keywords': 'food cake birthday'},
    {'emoji': '\U0001F370', 'name': '切块蛋糕', 'keywords': 'food cake slice'},
    {'emoji': '\U0001F36B', 'name': '巧克力', 'keywords': 'food chocolate'},
    {'emoji': '\U0001F36C', 'name': '糖果', 'keywords': 'food candy sweets'},
    {'emoji': '\U0001F36D', 'name': '棒棒糖', 'keywords': 'food lollipop'},
    {'emoji': '\U0001F37A', 'name': '啤酒', 'keywords': 'drink beer mug'},
    {'emoji': '\U0001F37B', 'name': '干杯', 'keywords': 'drink beer cheers'},
    {'emoji': '\U0001F377', 'name': '葡萄酒', 'keywords': 'drink wine glass'},
    {'emoji': '\U0001F942', 'name': '香槟', 'keywords': 'drink champagne glass'},
    {'emoji': '\U00002615', 'name': '咖啡', 'keywords': 'drink coffee hot'},
    {'emoji': '\U0001F9CB', 'name': '奶茶', 'keywords': 'drink bubble tea milk tea'},
    {'emoji': '\U0001F9C3', 'name': '果汁', 'keywords': 'drink juice box'},
    {'emoji': '\U0001F964', 'name': '饮料', 'keywords': 'drink cup straw'},
    {'emoji': '\U0001F9C1', 'name': '纸杯蛋糕', 'keywords': 'food cupcake pastry'},
    {'emoji': '\U0001F950', 'name': '牛角面包', 'keywords': 'food croissant'},
    {'emoji': '\U0001F96F', 'name': '贝果', 'keywords': 'food bagel'},
    {'emoji': '\U0001F35E', 'name': '面包', 'keywords': 'food bread loaf'},
    {'emoji': '\U0001F956', 'name': '法棍', 'keywords': 'food baguette'},
    {'emoji': '\U0001F957', 'name': '沙拉', 'keywords': 'food salad healthy'},
    {'emoji': '\U0001F32E', 'name': '墨西哥卷饼', 'keywords': 'food taco'},
    {'emoji': '\U0001F32F', 'name': '卷饼', 'keywords': 'food burrito'},
    {'emoji': '\U0001F96B', 'name': '罐头', 'keywords': 'food can'},
    {'emoji': '\U0001F35D', 'name': '意大利面', 'keywords': 'food pasta spaghetti'},
    {'emoji': '\U0001F35C', 'name': '拉面', 'keywords': 'food ramen noodle'},
    {'emoji': '\U0001F372', 'name': '火锅', 'keywords': 'food hotpot stew'},
    {'emoji': '\U0001F35B', 'name': '咖喱', 'keywords': 'food curry rice'},
    {'emoji': '\U0001F363', 'name': '寿司', 'keywords': 'food sushi'},
    {'emoji': '\U0001F371', 'name': '便当', 'keywords': 'food bento'},
    {'emoji': '\U0001F95F', 'name': '饺子', 'keywords': 'food dumpling'},
    {'emoji': '\U0001F960', 'name': '汤圆', 'keywords': 'food tangyuan'},
    {'emoji': '\U0001F961', 'name': '外卖', 'keywords': 'food takeout box'},
    {'emoji': '\U0001F3AF', 'name': '靶心', 'keywords': 'target bullseye'},
    {'emoji': '\U0001F3B3', 'name': '保龄球', 'keywords': 'bowling ball'},
    {'emoji': '\U0001F3AE', 'name': '游戏', 'keywords': 'video game controller'},
    {'emoji': '\U0001F3B0', 'name': '老虎机', 'keywords': 'slot machine gambling'},
    {'emoji': '\U0001F3B2', 'name': '骰子', 'keywords': 'dice game'},
    {'emoji': '\U0001F9E9', 'name': '拼图', 'keywords': 'puzzle piece'},
    {'emoji': '\U0001F9F8', 'name': '玩具熊', 'keywords': 'teddy bear toy'},
    {'emoji': '\U0001F3C6', 'name': '奖杯', 'keywords': 'trophy cup winner'},
    {'emoji': '\U0001F947', 'name': '金牌', 'keywords': 'medal gold first'},
    {'emoji': '\U0001F948', 'name': '银牌', 'keywords': 'medal silver second'},
    {'emoji': '\U0001F949', 'name': '铜牌', 'keywords': 'medal bronze third'},
    {'emoji': '\U0001F3C5', 'name': '奖牌', 'keywords': 'medal sports'},
    {'emoji': '\U0001F3AB', 'name': '票', 'keywords': 'ticket'},
    {'emoji': '\U0001F3AA', 'name': '马戏团', 'keywords': 'circus tent'},
    {'emoji': '\U0001F3AD', 'name': '剧院', 'keywords': 'performing arts theater'},
    {'emoji': '\U0001F3A4', 'name': 'KTV', 'keywords': 'microphone karaoke'},
    {'emoji': '\U0001F3B8', 'name': '吉他', 'keywords': 'guitar music instrument'},
    {'emoji': '\U0001F3B5', 'name': '音符', 'keywords': 'music note'},
    {'emoji': '\U0001F3B6', 'name': '音符2', 'keywords': 'music notes'},
]

rf_emoji = "function(data, search) { var rows = ''; if (!search || search.trim() === '') { rows = data.map(function(r) { return '<div class=\"col-2 col-md-1 mb-2\"><button class=\"btn btn-outline-secondary btn-sm w-100 py-2 emoji-btn\" data-emoji=\"' + r.emoji + '\"><span class=\"fs-5\">' + r.emoji + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div></button></div>'; }).join(''); } else { var s = search.toLowerCase(); var f = data.filter(function(r) { return r.name.includes(s) || r.keywords.includes(s) || r.emoji.includes(s); }); if (f.length === 0) return '<div class=\"text-muted\">未找到匹配结果</div>'; rows = '<div class=\"mb-2 text-muted small\">找到 ' + f.length + ' 条结果</div>' + f.map(function(r) { return '<div class=\"col-2 col-md-1 mb-2\"><button class=\"btn btn-outline-secondary btn-sm w-100 py-2 emoji-btn\" data-emoji=\"' + r.emoji + '\"><span class=\"fs-5\">' + r.emoji + '</span><div class=\"small text-muted mt-1\">' + r.name + '</div></button></div>'; }).join(''); } return '<div class=\"row\">' + rows + '</div>'; }"
other.append({'name': 'Emoji表情大全', 'path': 'other/Emoji表情大全.html', 'category': '其他工具', 'type': 'query', 'desc': '收录全平台常用 Emoji 表情符号，涵盖 smile、heart、动物、食物、旗帜等分类，支持按关键词搜索，方便复制使用。', 'keywords': ['Emoji', 'emoji表情', '表情符号', '颜文字', 'emoji大全'], 'title': 'Emoji表情大全 - 在线 Emoji 查询与复制', 'description': '收录2000+常用Emoji表情符号，支持分类查看、关键词搜索、一键复制，适用于社交媒体与聊天', 'icon': 'bi bi-emoji-smile', 'searchable': True, 'data': emoji_data, 'renderFn': rf_emoji})
print("Added Emoji表情大全")

# Save progress
with open('/root/.openclaw/workspace/projects/clover-tools-v2/tools.json', 'w', encoding='utf-8') as f:
    json.dump(tools, f, ensure_ascii=False, indent=2)
print("Saved step 1 (ASCII + Emoji)")