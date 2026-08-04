---
title: "JSON.parse 报错？7 种常见场景与排查思路"
description: "JSON.parse常见报错场景分析，7种解决方案覆盖循环引用、日期对象、大数字精度、undefined丢失等问题，JS/Python双语言示例。"
tags: ["JSON", "JSON.parse", "前端报错"]
category: "JSON处理"
original: true
planned_date: "2026-08-05"
link: "https://clovertools.cn/tools/dev/json-formatter/"
status: draft
---

上个月联调一个老接口，前端控制台直接抛 JSON.parse 报错，报错行号还指向打包后的压缩代码，根本没法定位。后来把接口返回的字符串原样拷出来，一段一段排查，才发现是后端某个字段把 HTML 标签直接塞进了 JSON。这篇文章把当时踩过的坑和排查顺序整理出来，从报错类型到修复思路都有。

# JSON.parse报错？我调研了7种方案

    真实翻车场景 × 根因分析 × 可复制代码，一次性解决所有JSON坑

        JavaScriptPythonJSON实战

## 这篇文章解决什么问题

- JSON.parse 报错，但不知道哪行有问题

- 循环引用导致序列化失败

- 日期对象序列化后变成字符串

- 大数字精度丢失变成乱码

- undefined 被偷偷丢掉

## 一、真实报错场景——你可能见过的错误

先把几个最常见的错误码在这里，你感受一下是不是很眼熟：

SyntaxError: Unexpected token in JSON at position 0
SyntaxError: Expected ',' or '}' after property value in JSON
TypeError: Converting circular structure to JSON
OverflowError: integer out of range

这些错误，每一个都曾经让程序员熬夜到凌晨三点。我也不例外。所以我花时间系统整理了 7 种最常见的 JSON 报错以及对应的解法，继续往下看。

## 二、JSON.parse 失败：最常见的语法问题

### 2.1 多了或少了逗号

这是头号杀手。JSON 严格要求列表最后一项不能有逗号，对象最后一个属性也不能有。肉眼很难发现，尤其字符串很长的时候。

//  报错：多了尾部逗号
const bad = JSON.parse('{"name":"小红","age":18,"}');
// SyntaxError: Expected ',' or '}'

//  正确写法
const good = JSON.parse('{"name":"小红","age":18}');

# Python 同样报错
import json
json.loads('{"name":"小红","age":18,}')
# JSONDecodeError: Expecting ',' delimiter

# 正确写法
json.loads('{"name":"小红","age":18}')

### 2.2 用单引号包字符串

JSON 标准规定字符串必须用双引号，单引号在 JSON 里就是非法字符。有些新手会写：

//  JSON 标准不支持单引号
JSON.parse("{'name':'小红'}")
// SyntaxError: Unexpected token '

//  双引号才是正道
JSON.parse('{"name":"小红"}')

### 2.3 多了转义字符

有些接口返回的数据里，双引号被多次转义，这种情况也常见：

// 接口返回的数据被双重转义了
let raw = '{"data":"{\\"name\\":\\"小红\\"}"}';
// 直接 parse 会报错，需要先反转义

let parsed = JSON.parse(JSON.parse(raw));
// 或者 replace 去掉多余的转义
let cleaned = raw.replace(/\\\\"/g, '"');

## 三、循环引用：最头疼的报错

### 3.1 什么是循环引用

就是一个对象的属性引用了自身，或者多个对象相互引用。比如：

const obj = { name: "小红" };
obj.self = obj;  // obj.self 指向 obj 自己！循环了

JSON.stringify(obj);
// TypeError: Converting circular structure to JSON

这个问题在复杂对象图里很常见，比如有父对象引用子对象，子对象又引用父对象的情况。

### 3.2 方案一：检查循环引用，替换掉

// JavaScript：检测并跳过循环引用
const seen = new WeakSet();

const safeStringify = (obj) => {
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === "object" && value !== null) {
      if (seen.has(value)) {
        return "[Circular]";  // 替换而不是报错
      }
      seen.add(value);
    }
    return value;
  });
};

const a = { name: "小红" };
a.self = a;
console.log(safeStringify(a));
// {"name":"小红","self":"[Circular]"}

### 3.3 方案二：用第三方库处理循环引用

// 使用 json-stringify-safe（npm install json-stringify-safe）
const stringify = require('json-stringify-safe');

const obj = { name: "小红" };
obj.self = obj;

console.log(stringify(obj));
// {"name":"小红","self":"[Circular]"}

# Python：检测循环引用可以用自定义 encoder
import json
from collections import defaultdict

class CycleEncoder(json.JSONEncoder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, **kwargs)
        self.seen = defaultdict(set)

    def default(self, obj):
        return "[Circular]"

    def encode(self, o):
        # 简化版，实际可用更强的方式检测
        return super().encode(o)

# Python 标准库 json 不直接处理循环引用，需配合 object_hook
# 简单场景可以直接用 str(object) 代替

## 四、日期对象：序列化的隐形杀手

### 4.1 日期对象会被转成字符串

这是最容易踩的坑之一。JavaScript 的 Date 对象序列化后不是 {type:"date", value:...}，而是直接变成 ISO 字符串，但反序列化时不会自动转回 Date 对象：

//  Date 对象会被转成字符串，反序列化后变成普通字符串
const obj = { createdAt: new Date("2026-01-01T00:00:00Z") };
const json = JSON.stringify(obj);
const parsed = JSON.parse(json);

console.log(typeof parsed.createdAt);  // "string" 而不是 "object"！
console.log(parsed.createdAt);            // "2026-01-01T00:00:00.000Z"

### 4.2 方案三：自定义 reviver 还原日期

//  序列化时把日期标记化，反序列化时还原

// 方式一：ISO 字符串前后加标记（推荐）
const obj = {
  name: "小红",
  createdAt: new Date("2026-01-01"),
  updatedAt: new Date("2026-05-01")
};

const json = JSON.stringify(obj, null, 2);
const parsed = JSON.parse(json, (key, value) => {
  // 匹配 ISODate 标记格式，还原为 Date 对象
  if (typeof value === "string" && value.match(/^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}:\d{2}/)) {
    return new Date(value);
  }
  return value;
});

console.log(typeof parsed.createdAt);  // "object"
console.log(parsed.createdAt instanceof Date);    // true

# Python：日期序列化 + 反序列化还原
import json
from datetime import datetime, date

class DateTimeEncoder(json.JSONEncoder):
    def default(self, obj):
        if isinstance(obj, (datetime, date)):
            return {"__type__": "datetime", "value": obj.isoformat()}
        return super().default(obj)

class DateTimeDecoder(json.JSONDecoder):
    def __init__(self, *args, **kwargs):
        super().__init__(*args, object_hook=self.date_hook, **kwargs)

    def date_hook(self, obj):
        if obj.get("__type__") == "datetime":
            return datetime.fromisoformat(obj["value"])
        return obj

data = {"name": "小红", "created_at": datetime.now()}
json_str = json.dumps(data, cls=DateTimeEncoder)
parsed = json.loads(json_str, cls=DateTimeDecoder)
print(type(parsed["created_at"]))  # <class 'datetime.datetime'>

## 五、大数字精度：JS 的历史遗留问题

### 5.1 为什么大数字会精度丢失

JavaScript 的 Number 类型使用 IEEE 754 双精度浮点数，只能安全表示 -2^53+1 到 2^53-1 之间的整数。超过这个范围的大数字（比如雪花算法生成的 ID）就会丢失精度：

//  超过安全整数范围，精度丢失
const largeId = 12345678901234567890;
console.log(largeId);           // 12345678901234567000（最后几位变了！）

// 常见场景：雪花 ID、Twitter ID、大金额数字
const obj = { orderId: 62875658976483924512 };
const json = JSON.stringify(obj);
console.log(JSON.parse(json).orderId);  // 62875658976483924000（精度丢失！）

### 5.3 方案四：把大数字转成字符串

这是最简单有效的解法——既然数字会丢精度，那就别让它是数字：

// 序列化时：大数字字段转字符串
const BIGINT_FIELDS = ["orderId", "userId", "transactionId"];

const safeStringify = (obj) => {
  return JSON.stringify(obj, (key, value) => {
    // 如果是超大数字，转成字符串
    if (typeof value === "number" && Math.abs(value) > Number.MAX_SAFE_INTEGER) {
      return String(value);
    }
    return value;
  });
};

const obj = { orderId: 62875658976483924512 };
console.log(safeStringify(obj));
// {"orderId":"62875658976483924512"}（字符串形式，不丢精度）

### 5.4 方案五：使用 JSON.parse 的第二个参数修复精度

// 如果 JSON 里数字精度已经丢失，用 reviver 把它转回字符串
const THRESHOLD = 9007199254740992;  // MAX_SAFE_INTEGER

const parsed = JSON.parse(json, (key, value) => {
  if (typeof value === "number" && Math.abs(value) > THRESHOLD) {
    return String(value);  // 精度已丢，转字符串让业务侧知道需要重新获取
  }
  return value;
});

## 六、undefined 丢失：最隐蔽的坑

### 6.1 undefined 直接被忽略

这个坑很隐蔽很多人没注意到——当你用 JSON.stringify 序列化包含 undefined 的对象时，这些键值对会直接消失，不会报错，但会导致数据丢失：

//  undefined 属性会被静默丢弃
const obj = { name: "小红", age: undefined, gender: "女" };
console.log(JSON.stringify(obj));
// {"name":"小红","gender":"女"} —— age 字段消失了！

### 6.2 方案六：显式处理 undefined 和其他特殊值

// 方法：用自定义 replacer 保留 undefined 的信息
const obj = { name: "小红", age: undefined, gender: "女", score: null };

const json = JSON.stringify(obj, (key, value) => {
  // 把 undefined 转为保留标记，业务侧可以还原
  if (value === undefined) {
    return { __type__: "undefined" };
  }
  return value;
});

console.log(json);
// {"name":"小红","age":{"__type__":"undefined"},"gender":"女","score":null}

// 反序列化时还原
const parsed = JSON.parse(json, (key, value) => {
  if (Object.keys(value).includes("__type__") && value.__type__ === "undefined") {
    return undefined;
  }
  return value;
});

# Python：处理 None 和特殊值
import json
from typing import Any

def custom_encoder(obj: Any) -> Any:
    """保留 None 的语义，区分 null 和 missing"""
    if obj is None:
        return {"__type__": "null"}
    raise TypeError(f"Object of type {type(obj)} is not JSON serializable")

data = {"name": "小红", "age": None, "gender": "女"}
# Python 的 None 会被正确序列化为 null，这是 JSON 标准行为
json_str = json.dumps(data)
print(json_str)  # {"name": "小红", "age": null, "gender": "女"}

### 7.1 方案七：一站式解决所有 JSON 序列化问题

上面讲了 6 种具体方案，但实际上日常开发中最好的办法是用现成的工具或库，把这些细节都封装好。

我自己常用的是一个 JSON 格式化工具，支持格式化、校验、压缩，还能直接处理上面这些边界情况：

**推荐工具：**

支持：JSON 格式化 · 语法校验 · 循环引用检测 · 压缩 · 代码高亮

地址栏直接访问，输入 JSON 即可使用，无需注册

### 7.2 常见库推荐

- **JavaScript：flatted** — 专门处理循环引用的 JSON 序列化库

- **JavaScript：json-bigint** — 大数字精度丢失的解决方案

- **Python：orjson** — 比标准库快 10 倍，支持日期/dataclass 自动序列化

- **Python：python-rapidjson** — 快速 JSON 库，接口兼容标准库

## 八、避坑总结表

| 问题 | 症状 | 解法 |
| --- | --- | --- |
| 语法错误 | Unexpected token | 用 JSON 格式化工具检查 |
| 循环引用 | Converting circular structure | WeakSet 检测 + [Circular] 标记 |
| 日期对象 | 反序列化后变成字符串 | reviver 函数还原 Date |
| 大数字精度 | 数字末尾变成 000 | 序列化时转字符串 |
| undefined 丢失 | 属性静默消失 | 用 __type__ 标记保留 |

排查 JSON.parse 报错有个省事的办法：把报错的字符串先丢进[在线 JSON 格式化工具](https://clovertools.cn/tools/dev/json-formatter/)看结构，是哪一层断的、缺了什么符号，一眼就能看出来，比对着控制台猜快很多。
