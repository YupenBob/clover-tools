# ES6新特性有哪些？常用特性完全指南

> ES6（ECMAScript 2015）是现代JavaScript最重要的一次更新，引入类、模块、箭头函数、Promise等众多新特性。本文整理开发者最常用的ES6特性及实例。

## let/const 块级作用域

```javascript
const PI = 3.14159;
let count = 0;
count++; // 可以修改let声明的变量
```

## 箭头函数

```javascript
// 旧写法
const add = function(a, b) { return a + b; };
// ES6
const add = (a, b) => a + b;
// 单参数可省略括号
const double = x => x * 2;
```

## 模板字符串

```javascript
const name = "World";
const msg = `Hello, ${name}!`;  // 支持嵌入表达式
```

## 解构赋值

```javascript
const { name, age } = user;  // 对象解构
const [first, second] = arr;  // 数组解构
const { name: userName } = user;  // 重命名
```

## Promise

```javascript
const p = new Promise((resolve, reject) => {
  setTimeout(() => resolve(42), 1000);
});
p.then(val => console.log(val));
```

## async/await

```javascript
async function fetchData() {
  const res = await fetch(url);
  return await res.json();
}
```

## 类和模块

```javascript
class Animal {
  constructor(name) { this.name = name; }
  speak() { console.log(this.name + ' speaks'); }
}
export default Animal;
```

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
