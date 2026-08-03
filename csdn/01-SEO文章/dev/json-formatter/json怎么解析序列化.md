# JSON解析与序列化完全指南

> JSON.parse/JSON.stringify的完整指南，含深拷贝、循环引用、日期对象、大数字精度等高级场景，7种常见错误解决方案。

## JSON解析与序列化完全指南

JSON（JavaScript Object Notation）是现代Web开发中最常用的数据交换格式。本文系统讲解JSON的解析和序列化，以及各种边界情况的处理方法。

## 基础序列化：JavaScript对象转JSON字符串

```javascript
const obj = { name: '张三', age: 16, isStudent: true };

// 基本序列化
const jsonStr = JSON.stringify(obj);

// 美化输出（格式化）
const prettyJson = JSON.stringify(obj, null, 2);

// 指定序列化属性（过滤）
const filtered = JSON.stringify(obj, ['name', 'age']);
```

## 基础解析：JSON字符串转JavaScript对象

```javascript
const jsonStr = '{"name":"张三","age":16}';
const obj = JSON.parse(jsonStr);

// 安全解析（捕获异常）
try {
  const result = JSON.parse(jsonStr);
} catch (e) {
  console.error('JSON解析失败:', e.message);
}
```

## 处理特殊JavaScript值

```javascript
const data = { name: '李四', age: undefined, sayHi: () => {} };
JSON.stringify(data);  // {"name":"李四"}，undefined和函数被忽略

// 如果需要保留undefined
const replacer = (k, v) => v === undefined ? null : v;
JSON.stringify(data, replacer);
```

## 处理BigInt

```
JSON.stringify(123n);  // TypeError!

// 解决方案：转换为字符串
JSON.stringify({ id: 9007199254741001n.toString() });
```

## JSON Schema校验

```javascript
import Ajv from 'ajv';
const ajv = new Ajv();

const schema = {
  type: 'object',
  properties: {
    name: { type: 'string' },
    age: { type: 'number', minimum: 0 }
  },
  required: ['name']
};

const validate = ajv.compile(schema);
validate({ name: '王五', age: 25 });
```

## 常见问题 FAQ

Q: JSON中能否使用注释？
A: 不能。标准JSON不支持注释。

Q: 如何解析超大的JSON字符串避免内存溢出？
A: 使用流式JSON解析库如clarinet（Node.js）。

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
