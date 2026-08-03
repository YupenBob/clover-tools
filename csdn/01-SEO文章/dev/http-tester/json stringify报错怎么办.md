# json stringify报错怎么办 - CloverTools

> JSON.stringify 报错 serialization error？5分钟搞清楚循环引用、undefined、函数等常见踩坑点，附真实报错场景和修复代码。

## JSON.stringify报错的原因与解决方案

JSON.stringify()看似简单，但在处理特殊JavaScript值时经常抛出异常或返回意外结果。以下系统整理了各种报错场景及解决方案。

## 报错类型一：循环引用

```javascript
// ❌ 循环引用会导致TypeError
const obj = {name: '张三'};
obj.self = obj;
JSON.stringify(obj);  // TypeError: Converting circular structure to JSON

// ✅ 解决方案：使用replacer过滤
const safeStringify = (obj) => {
  const seen = new WeakSet();
  return JSON.stringify(obj, (key, value) => {
    if (typeof value === 'object' && value !== null) {
      if (seen.has(value)) return undefined;
      seen.add(value);
    }
    return value;
  });
};
safeStringify(obj);
```

## 报错类型二：BigInt不支持

```javascript
// ❌ BigInt无法序列化
JSON.stringify(123n);  // TypeError

// ✅ 转换为字符串
const bigNum = 123n;
JSON.stringify({ big: bigNum.toString() });  // {"big":"123"}
```

## 报错类型三：undefined和函数被忽略

```javascript
const obj = { name: '张三', age: undefined, sayHi: () => {} };
JSON.stringify(obj);  // {"name":"张三"}

// 如果需要保留undefined
const replacer = (k, v) => v === undefined ? null : v;
JSON.stringify(obj, replacer);  // {"name":"张三","age":null}
```

## 报错类型四：Set/Map/RegExp等特殊对象

```javascript
const set = new Set([1, 2, 3]);
const map = new Map([['a', 1]]);
JSON.stringify({ set, map });  // {"set":{},"map":{}}

const serializeSpecial = (obj) => JSON.stringify(obj, (k, v) => {
  if (v instanceof Set) return { __type: 'Set', values: [...v] };
  if (v instanceof Map) return { __type: 'Map', entries: [...v] };
  if (v instanceof RegExp) return v.source;
  return v;
});
```

## 常见问题 FAQ

Q: 为什么JSON.stringify({a:1}, null, 2)结果不对？
A: 第二个参数是replacer函数，如果返回undefined则跳过该属性。

Q: 如何输出美观的格式化JSON？
A: JSON.stringify(obj, null, 2)使用2空格缩进。

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
