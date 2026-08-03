# Unexpected token JSON错误怎么解决？完整排查指南

> Unexpected token in JSON是前端开发中最常见的JSON解析错误。本文详细讲解该错误的7种常见原因、精确定位方法，以及修复示例，帮你快速解决解析问题。

## Unexpected token in JSON 错误完全指南

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

遇到 `Unexpected token` 错误时，先复制完整错误消息，特别是 `at position X` 部分，它能直接告诉你问题在哪！

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
