# JavaScript数组方法有哪些？map/filter/reduce/flat完整指南

> 现代JavaScript数组方法让你的代码更简洁、更函数式。本文详解forEach/map/filter/reduce/find/findIndex/flat/sort等方法的用法和性能注意事项。

## 遍历类

```javascript
const arr = [1, 2, 3];

arr.forEach((item, index) => console.log(item));
// 无返回值，不链式调用
```

## 转换类

```javascript
// map - 逐一转换，返回新数组
const doubled = [1, 2, 3].map(x => x * 2);  // [2, 4, 6]

// flat - 扁平化嵌套数组
const flat = [1, [2, [3]]].flat(2);  // [1, 2, 3]

// flatMap - 先map再flat
const fm = [1, 2, 3].flatMap(x => [x, x * 2]);  // [1, 2, 2, 4, 3, 6]
```

## 过滤类

```javascript
// filter - 过滤条件
const evens = [1, 2, 3, 4].filter(x => x % 2 === 0);  // [2, 4]

// find/findIndex - 找第一个匹配
const found = [1, 2, 3].find(x => x > 1);  // 2
const idx = [1, 2, 3].findIndex(x => x > 1);  // 1

// includes/some/every
[1, 2, 3].includes(2);  // true
[1, 2, 3].some(x => x > 2);  // true
[1, 2, 3].every(x => x > 0);  // true
```

## 聚合类

```javascript
// reduce - 汇总操作
const sum = [1, 2, 3].reduce((acc, x) => acc + x, 0);  // 6

// 统计出现次数
const count = ['a', 'b', 'a'].reduce((acc, x) => {
  acc[x] = (acc[x] || 0) + 1;
  return acc;
}, {});  // { a: 2, b: 1 }
```

## 排序反转

```
// sort - 排序（默认Unicode编码）
[3, 1, 2].sort((a, b) => a - b);  // [1, 2, 3]

// reverse - 反转
[1, 2, 3].reverse();  // [3, 2, 1]
```

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
