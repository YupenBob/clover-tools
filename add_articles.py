import json

def make_article(keyword, slug, tool, intent, category, title, desc, content_text, faqs):
    return {
        "keyword": keyword,
        "slug": slug,
        "tool": tool,
        "intent": intent,
        "category": category,
        "title": title,
        "desc": desc,
        "content": content_text,
        "faqs": faqs
    }

ai_异常 = make_article(
    keyword="ai接口异常怎么处理",
    slug="ai接口异常怎么处理",
    tool="code/regex-tester.html",
    intent="error-fix",
    category="AI / API / GPT",
    title="AI接口异常怎么处理？常见错误排查与解决方案",
    desc="调用AI接口时遇到异常报错是常见问题。本文系统梳理了超时、401认证失败、429限流、500服务器错误等典型异常场景的排查思路和解决方法，帮你快速恢复服务。",
    content_text=r"""## AI接口异常处理的完整指南

调用AI接口时遇到异常报错是开发过程中最常见的问题之一。本文系统梳理了各类AI接口异常的处理方法，帮助你快速定位并解决问题。

### 一、常见异常类型快速识别

**1. 网络超时错误**
症状：请求长时间无响应，最终报错 `timeout` 或 `ECONNRESET`
解决：检查网络连接、增加超时时间配置、实现请求重试机制

```javascript
// 设置合理的超时时间
const response = await fetch(apiUrl, {
  method: 'POST',
  headers: { 'Content-Type': 'application/json' },
  body: JSON.stringify(data),
  signal: AbortSignal.timeout(30000) // 30秒超时
});
```

**2. 认证失败错误（401 Unauthorized）**
症状：返回 `{"error": {"code": "invalid_api_key", "message": "..."}}`
解决：
- 确认API Key拼写正确，无多余空格
- 检查Key是否已过期或被禁用
- 确认使用的是正确的API端点

**3. 请求频率限制（429 Too Many Requests）**
症状：返回 `429` 状态码，响应头包含 `Retry-After`
解决：
- 查看响应头中的 `Retry-After` 值，等指定秒数后重试
- 实现指数退避策略（1s → 2s → 4s → 8s...）
- 考虑使用批量接口或降级到更小的模型

**4. 服务器内部错误（500 Internal Server Error）**
症状：返回 `500` 或 `503` 错误
解决：
- 等待后重试，AI服务商通常有临时波动
- 检查请求格式是否符合API规范
- 查看服务商状态页面是否有已知故障

### 二、系统性排查流程

**Step 1：检查错误码和错误信息**
大多数AI API返回结构化的错误对象：
```json
{
  "error": {
    "code": "rate_limit_exceeded",
    "message": "请求频率超出限制",
    "param": null,
    "type": "requests"
  }
}
```

**Step 2：验证请求参数**
- `messages` 格式是否正确（role/content结构）
- `max_tokens` 是否超出模型上限
- `temperature` 范围是否合法（通常0-2）

**Step 3：检查网络层**
- DNS解析是否正常
- 防火墙/代理是否拦截了请求

### 三、防御性编程建议

```python
import time
import requests

def call_ai_with_retry(prompt, max_retries=3):
    for attempt in range(max_retries):
        try:
            response = requests.post(
                'https://api.example.com/v1/chat/completions',
                headers={'Authorization': f'Bearer {API_KEY}'},
                json={'model': 'gpt-3.5-turbo', 'messages': [{'role': 'user', 'content': prompt}]},
                timeout=30
            )
            if response.status_code == 200:
                return response.json()
            elif response.status_code == 429:
                retry_after = int(response.headers.get('Retry-After', 1))
                time.sleep(retry_after)
            else:
                response.raise_for_status()
        except requests.exceptions.RequestException as e:
            if attempt == max_retries - 1:
                raise
            time.sleep(2 ** attempt)
    return None
```

### 四、常用AI接口错误码对照表

| 错误码 | 含义 | 处理方式 |
|--------|------|----------|
| 401 | API Key无效 | 检查Key配置 |
| 403 | 无访问权限 | 确认账户权限 |
| 429 | 频率限制 | 等待后重试 |
| 500 | 服务器错误 | 稍后重试 |
| 503 | 服务不可用 | 查看状态页 |

遇到AI接口异常时，按照上述流程逐步排查，大多数问题都能在5分钟内定位并解决。""",
    faqs=[
        {"q": "AI接口返回timeout怎么办？", "a": "增加超时时间配置，同时检查网络连接。如果频繁超时，考虑使用异步请求并设置合理的重试机制。"},
        {"q": "遇到429错误要等多久？", "a": "查看响应头中的Retry-After字段指定秒数，或者使用指数退避策略从1秒开始逐步增加等待时间。"},
        {"q": "API Key无效但确认配置正确？", "a": "可能是Key被禁用、过期或账户欠费。登录服务商控制台检查Key状态和账户余额。"}
    ]
)

api_key_无效 = make_article(
    keyword="api key无效怎么办",
    slug="api-key无效怎么办",
    tool="code/regex-tester.html",
    intent="error-fix",
    category="AI / API / GPT",
    title="API Key无效怎么办？常见原因与解决方案详解",
    desc="API Key无效是最常见的集成错误之一。本文整理了Key无效的7种常见原因以及对应的解决方法，帮你快速恢复API调用。",
    content_text=r"""## API Key无效的完整排查指南

API Key无效是开发者在对接各种服务时最常遇到的问题。根据错误消息识别根本原因并采取正确措施，通常能在几分钟内解决问题。

### 一、快速诊断：错误消息对照

不同服务商返回的错误格式略有差异，但核心信息相似：

**OpenAI 格式：**
```json
{
  "error": {
    "code": "invalid_api_key",
    "type": "invalid_request_error",
    "message": "Invalid API key provided: sk-xxxxxx..."
  }
}
```

**其他服务商常见格式：**
- `"error": "invalid_api_key"`
- `"message": "API key is invalid"`
- `"error_description": "Invalid API key"`

### 二、七大常见原因及解决方案

#### 1. 格式错误（最常见）
**问题：** 复制粘贴时带入多余空格、换行或引号
```javascript
// 错误：多余的引号和空格
const apiKey = '"sk-xxxxxx  "';

// 正确：干净字符串
const apiKey = 'sk-xxxxxx';
```

#### 2. 前缀/后缀错误
部分Key有特定前缀要求：
- OpenAI: 必须以 `sk-` 开头
- Google AI: 必须以 `AIza` 开头
- Anthropic: 必须以 `sk-ant-` 开头

#### 3. 账户欠费/余额不足
即使Key格式正确，账户欠费也会导致"无效"：
- 登录服务商控制台
- 检查账户余额和账单状态
- 充值后重试

#### 4. 权限不足
Key可能有作用域限制：
- 检查Key是否仅限特定API调用
- 确认Key是否仅限特定IP或域名

#### 5. 环境混淆
测试环境和生产环境Key混用：
```javascript
const apiKey = process.env.NODE_ENV === 'production'
  ? 'sk-prod-xxxxxx'
  : 'sk-test-xxxxxx';
```

#### 6. Key过期或被撤销
- 登录控制台查看Key创建时间和有效期
- 如Key已过期，需生成新Key

#### 7. 并发请求超出限制
部分服务对单个Key有并发限制。

### 三、代码层面最佳实践

```python
import os
from dotenv import load_dotenv

load_dotenv()
api_key = os.getenv('OPENAI_API_KEY')

def validate_api_key(key: str) -> bool:
    if not key or len(key) < 20:
        return False
    if not key.startswith('sk-'):
        return False
    return True

if not validate_api_key(api_key):
    raise ValueError("Invalid API key format")
```

### 四、调试步骤清单

1. **复制粘贴正确？** → 重新从控制台复制
2. **前缀正确？** → 对照文档检查
3. **账户有钱？** → 检查余额
4. **Key没过期？** → 查看创建时间
5. **权限够吗？** → 检查作用域
6. **环境对了？** → 测试/生产Key分开
7. **试新建Key？** → 创建新Key测试

### 五、预防措施

- 使用 `.env` 文件管理敏感配置，永远不要提交Key到代码仓库
- 使用专业的密钥管理服务（AWS Secrets Manager、HashiCorp Vault等）
- 为开发和生产环境分别创建独立Key，便于管理和监控
- 定期轮换Key，减少泄露风险

API Key问题排查其实不复杂，90%的情况都是复制粘贴时的格式问题。先从这里查起！""",
    faqs=[
        {"q": "API Key显示无效但我确定没输错？", "a": "检查是否有多余的空格或换行，有时候从网页复制会带入不可见字符。直接在代码中打印Key长度来验证。"},
        {"q": "新创建的Key还是无效？", "a": "确认账户状态正常（未欠费、未被禁用），同时检查Key的前缀和格式是否符合要求。"},
        {"q": "测试环境和生产环境Key会混淆吗？", "a": "会的！确认你使用的是正确环境的Key，生产环境Key通常以sk-prod或类似标识区分。"}
    ]
)

json_key重复 = make_article(
    keyword="json key重复会怎样",
    slug="json-key重复会怎样",
    tool="json/formatter.html",
    intent="error-fix",
    category="JSON / 数据处理",
    title="JSON key重复会怎样？解析行为与正确处理方案",
    desc="JSON中存在重复的key是一个容易被忽视但可能导致隐蔽Bug的问题。本文深入解析不同编程语言对重复key的处理方式，以及如何正确检测和修复重复key。",
    content_text=r"""## JSON Key重复的完整解析

JSON规范明确指出对象中的key应该是唯一的，但实际开发中由于数据来源不可控或拼接错误，重复key的情况并不罕见。了解不同语言的处理方式，可以避免因此产生的隐蔽Bug。

### 一、JSON规范怎么说

根据RFC 8259规范，对象中的key应该是唯一的。规范使用的是"SHOULD"而非"MUST"，因此部分解析器对重复key较为宽容。

### 二、不同语言的处理方式

**JavaScript（V8引擎）：**
```javascript
const jsonStr = '{"name": "Alice", "name": "Bob"}';
const obj = JSON.parse(jsonStr);
console.log(obj.name); // "Bob" — 后面的值覆盖前面的
```
结论：**后面的key-value对会覆盖前面的**，只保留最后一个值。

**Python（json库）：**
```python
import json
json_str = '{"name": "Alice", "name": "Bob"}'
obj = json.loads(json_str)
print(obj)  # {'name': 'Bob'} — 同样保留最后一个
```

**Go（encoding/json）：**
```go
var result map[string]interface{}
err := json.Unmarshal([]byte(`{"name":"Alice","name":"Bob"}`), &result)
fmt.Println(result["name"]) // Bob
```

**Java（Gson）：**
```java
String json = "{\"name\":\"Alice\",\"name\":\"Bob\"}";
Gson gson = new Gson();
Map<String, Object> map = gson.fromJson(json, Map.class);
System.out.println(map.get("name")); // Bob
```

### 三、为什么重复Key很危险

**1. 不可预测的行为**
不同库、不同版本处理方式可能不同。

**2. 隐式的状态覆盖**
```javascript
const userData = '{"role": "user", "permissions": ["read"], "role": "admin"}';
// 本意是添加admin角色，但实际role变成"admin"，"user"角色丢失！
```

**3. 序列化不一致**
```javascript
const obj = {"name": "Alice"};
obj.name = "Bob";
obj["name"] = "Charlie";
JSON.stringify(obj); // '{"name":"Charlie"}' — 丢失了中间状态
```

### 四、如何检测和修复重复Key

**Python检测脚本：**
```python
import json
from collections import Counter

def find_duplicate_keys(json_str: str):
    data = json.loads(json_str)
    keys = []
    
    def flatten_keys(obj, path=""):
        if isinstance(obj, dict):
            for k, v in obj.items():
                full_path = f"{path}.{k}" if path else k
                keys.append(full_path)
                flatten_keys(v, full_path)
        elif isinstance(obj, list):
            for i, item in enumerate(obj):
                flatten_keys(item, f"{path}[{i}]")
    
    flatten_keys(data)
    counts = Counter(keys)
    return [(k, c) for k, c in counts.items() if c > 1]

duplicates = find_duplicate_keys('{"name":"A","name":"B","data":{"x":1,"x":2}}')
print(duplicates)  # [('name', 2), ('data.x', 2)]
```

**自动修复重复Key：**
```javascript
function removeDuplicateKeys(obj) {
    if (Array.isArray(obj)) {
        return obj.map(removeDuplicateKeys);
    } else if (typeof obj === 'object' && obj !== null) {
        return Object.fromEntries(
            Object.entries(obj).map(([k, v]) => [k, removeDuplicateKeys(v)])
        );
    }
    return obj;
}
```

### 五、最佳实践

1. **数据源验证**：从API或文件读取JSON时，先用验证器检查key唯一性
2. **Schema验证**：使用JSON Schema的 `additionalProperties: false` 防止未知key
3. **日志警告**：解析时发现重复key主动记录警告日志
4. **数据清洗**：ETL流程中加入重复key检测步骤

重复key问题虽小，但可能造成严重的数据错误，建议在CI流程中加入JSON校验步骤！""",
    faqs=[
        {"q": "JSON重复key会导致解析失败吗？", "a": "大多数现代解析器不会失败，只是后者覆盖前者。但严格模式或部分旧版库可能抛出异常。"},
        {"q": "如何快速检查JSON是否有重复key？", "a": "使用CloverTools的JSON格式化工具，打开重复检测功能即可。也可以用Python的json库配合Counter来统计。"},
        {"q": "重复key时保留哪个值？", "a": "几乎所有语言都采用\"后面覆盖前面\"的原则。建议在数据源头就避免重复key，而非依赖解析器行为。"}
    ]
)

zip_打不开 = make_article(
    keyword="zip文件打不开怎么办",
    slug="zip文件打不开怎么办",
    tool="format-conversion/file-analyzer.html",
    intent="error-fix",
    category="文件 / 图片 / PDF",
    title="zip文件打不开怎么办？7种原因及修复方法详解",
    desc="zip文件打不开是常见问题，可能由文件损坏、格式不兼容、密码保护等原因导致。本文介绍7种常见原因及其对应的修复方案，帮你挽回宝贵数据。",
    content_text=r"""## ZIP文件打不开的完整解决方案

ZIP是最常用的压缩格式之一，但文件打不开的情况并不少见。原因可能是文件损坏、格式不兼容、密码保护，甚至是病毒伪装。

### 一、确认文件真实格式

有时候扩展名欺骗了你：
```bash
# 查看文件真实类型
file example.zip
# 正常ZIP应该以 PK (50 4B 03 04) 开头
```

### 二、七种常见原因及解决方案

#### 原因1：文件传输损坏
下载中断、复制中断是最常见的损坏原因。

**修复方法：**
```bash
# Linux用zip命令修复
zip -FF broken.zip --out fixed.zip

# Windows用7-Zip
7z t broken.zip  # 测试完整性
7z x broken.zip  # 尝试解压
```

#### 原因2：压缩格式不兼容
用WinRAR创建的文件在某些解压工具中无法识别。

**解决方案：** 尝试用7-Zip打开（兼容性最强），或尝试不同解压工具（WinRAR、Bandizip、PeaZip等）。

#### 原因3：密码保护但不知道密码
加密ZIP需要密码才能解压。

**尝试方法：**
```bash
# 使用fcrackzip暴力破解（简单密码）
fcrackzip -b -c 'aA1!' -l 1-8 -u protected.zip
```

#### 原因4：文件被分割
大型ZIP可能被分成多个 part。

**解决：** 确认所有分卷在同一目录，按顺序重命名后使用原始分卷压缩工具解压。

#### 原因5：文件名编码问题
中文文件名在不同系统编码下可能乱码。

**解决：**
```bash
# Linux解决中文文件名乱码
unzip -O gbk corrupted.zip
```

#### 原因6：压缩包嵌套损坏
ZIP中包含损坏的子文件。

**解决：** 跳过损坏文件继续解压：
```bash
unzip -o corrupted.zip -d output
```

#### 原因7：磁盘空间不足
解压时磁盘写满导致中断。

**解决：** 清理空间或解压到其他磁盘。

### 三、紧急恢复方案

**使用WinRAR修复模式：**
1. 打开WinRAR
2. 工具 → 修复压缩文件
3. 选择"把损坏的压缩文件当作ZIP"
4. 修复后尝试打开

**Python深度修复脚本：**
```python
import zipfile

def extract_ignore_errors(zip_path, output_dir):
    with zipfile.ZipFile(zip_path, 'r') as zf:
        for info in zf.infolist():
            try:
                zf.extract(info, output_dir)
                print(f"OK {info.filename}")
            except Exception as e:
                print(f"FAIL {info.filename}: {e}")

extract_ignore_errors('corrupted.zip', './output')
```

### 四、预防措施

1. **完整性校验**：压缩后用 `zip -t file.zip` 测试
2. **保留原文件**：重要数据永远保留未压缩备份
3. **分卷压缩大文件**：避免单文件过大导致传输问题
4. **使用新版工具**：旧版可能不支持新压缩算法
5. **云盘特殊处理**：某些云盘会修改ZIP结构，下载后重新校验

### 五、工具推荐

| 工具 | 平台 | 特色 |
|------|------|------|
| 7-Zip | 全平台 | 格式兼容性最强 |
| WinRAR | Windows | 修复功能强大 |
| Bandizip | Windows | 轻量快速 |
| The Unarchiver | Mac | Mac最佳选择 |
| PeaZip | 全平台 | 开源免费 |

遇到打不开的ZIP文件，不要急着删除！先用7-Zip尝试打开，同时运行修复功能，大部分损坏文件都能恢复。""",
    faqs=[
        {"q": "ZIP文件损坏了能完全恢复吗？", "a": "取决于损坏程度。轻微损坏（下载中断）可以修复；严重损坏（磁盘坏道）只能部分恢复。重要文件务必保留备份。"},
        {"q": "为什么明明有密码却打不开？", "a": "可能是加密格式不兼容。某些ZIP用AES-256加密，普通工具可能不支持。尝试用7-Zip或专门解密工具。"},
        {"q": "文件扩展名是.zip但不是ZIP格式？", "a": "可能是其他格式被误改了扩展名。用file命令查看真实格式，或用7-Zip直接尝试打开。"}
    ]
)

unexpected_token = make_article(
    keyword="unexpected token json错误怎么解决",
    slug="unexpected-token-json错误怎么解决",
    tool="json/formatter.html",
    intent="error-fix",
    category="JSON / 数据处理",
    title="Unexpected token JSON错误怎么解决？完整排查指南",
    desc="Unexpected token in JSON是前端开发中最常见的JSON解析错误。本文详细讲解该错误的7种常见原因、精确定位方法，以及修复示例，帮你快速解决解析问题。",
    content_text=r"""## Unexpected token in JSON 错误完全指南

`Unexpected token` 是JavaScript解析JSON时最常见的错误之一。这个错误意味着JSON字符串中有无法识别的字符。

### 一、错误本质解读

```javascript
JSON.parse('{"name": "Alice"}');
// 正常：解析成功

JSON.parse('{"name": "Alice"}extra');
// Error: Unexpected token 'e' at position 20
```

错误消息中的 `position` 就是问题字符的位置索引。

### 二、七大常见原因及修复

#### 原因1：多余的逗号（最常见）
```javascript
// 错误：数组或对象末尾多了逗号
JSON.parse('{"name": "Alice",}');
JSON.parse('["a", "b",]');

// 正确
JSON.parse('{"name": "Alice"}');
JSON.parse('["a", "b"]');
```

#### 原因2：单引号而非双引号
```javascript
// 错误：JavaScript字符串用单引号
JSON.parse("{'name': 'Alice'}");

// 正确：JSON规范要求双引号
JSON.parse('{"name": "Alice"}');
```

**修复：** 转换单引号为双引号：
```javascript
const fixed = str.replace(/'/g, '"');
JSON.parse(fixed);
```

#### 原因3：控制字符未转义
换行符未转义会导致解析失败。
**修复：** 转义：
```javascript
const text = rawText.replace(/\n/g, '\\n');
```

#### 原因4：BOM头（UTF-8 BOM）
文件以 `\uFEFF` 开头导致解析失败：
```javascript
// 错误：文件开头有BOM
JSON.parse('\uFEFF{"name": "Alice"}');

// 正确：去掉BOM
const clean = text.replace(/^\uFEFF/, '');
JSON.parse(clean);
```

#### 原因5：非ASCII字符未正确编码
某些旧环境不支持emoji等字符。使用JSON.stringify确保正确编码。

#### 原因6：来自后端的问题
后端返回的不是有效JSON（HTML错误页面、空字符串等）。

#### 原因7：数字精度丢失
JavaScript Number最大安全整数：2^53-1 = 9007199254740991。极大数字会精度丢失。

### 三、精确定位技巧

**利用错误位置：**
```javascript
function findProblemChar(jsonStr, position) {
    const before = jsonStr.substring(Math.max(0, position - 20), position);
    const problem = jsonStr.substring(position, position + 5);
    const after = jsonStr.substring(position + 5, position + 25);
    return before + '[' + problem + ']' + after;
}

try {
    JSON.parse(badJson);
} catch (e) {
    if (e.message.includes('at position')) {
        const pos = parseInt(e.message.match(/at position (\d+)/)[1]);
        console.log(findProblemChar(badJson, pos));
    }
}
```

**逐行排查：**
```javascript
function locateJsonError(jsonStr) {
    const lines = jsonStr.split('\n');
    let charCount = 0;
    
    for (let i = 0; i < lines.length; i++) {
        const lineChars = lines[i].length + 1;
        charCount += lineChars;
        
        try {
            JSON.parse(jsonStr.substring(0, charCount));
        } catch (e) {
            console.log(`问题在第 ${i + 1} 行附近`);
            break;
        }
    }
}
```

### 四、防御性解析代码

```javascript
function safeJsonParse(str, fallback = null) {
    if (!str || typeof str !== 'string') {
        return fallback;
    }
    
    let cleaned = str.trim();
    
    // 移除BOM
    if (cleaned.charCodeAt(0) === 0xFEFF) {
        cleaned = cleaned.slice(1);
    }
    
    try {
        return JSON.parse(cleaned);
    } catch (e) {
        console.error('JSON Parse Error:', {
            message: e.message,
            at: e.message.match(/position (\d+)/)?.[1],
        });
        return fallback;
    }
}
```

### 五、快速修复工具

```bash
# 用jq验证和格式化
echo '{"name": "Alice",}' | jq .

# Python格式化（自动修复尾逗号）
python3 -c "import json; print(json.dumps(json.loads(input())))"
```

遇到 `Unexpected token` 错误时，先复制完整错误消息，特别是 `at position X` 部分，它能直接告诉你问题在哪！""",
    faqs=[
        {"q": "Unexpected token错误怎么快速定位？", "a": "错误消息中的position数字就是字符位置。用substring(pos-20, pos+20)查看问题周围的上下文。"},
        {"q": "后端返回的JSON前端解析失败怎么办？", "a": "先在控制台console.log(response)看看实际返回的是什么。常见情况：后端返回了HTML错误页面、空字符串、或者非UTF8编码。"},
        {"q": "如何避免JSON解析错误？", "a": "1) 使用JSON.stringify()生成而非手写字符串；2) 后端返回前用库验证；3) 前端用try-catch包裹并给出友好提示；4) 接口返回非JSON时也要有降级处理。"}
    ]
)

new_articles = [ai_异常, api_key_无效, json_key重复, zip_打不开, unexpected_token]

with open('articles.json', 'r', encoding='utf-8') as f:
    arts = json.load(f)

arts['articles'].extend(new_articles)

with open('articles.json', 'w', encoding='utf-8') as f:
    json.dump(arts, f, ensure_ascii=False, indent=2)

print(f'Added {len(new_articles)} articles. Total now: {len(arts["articles"])}')