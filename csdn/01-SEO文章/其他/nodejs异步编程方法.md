# Node.js异步编程方法？Promise/async await/EventEmitter完整指南

> Node.js是异步驱动的事件循环语言。本文讲解回调函数、Promise、async/await三种异步编程方式的区别，以及EventEmitter事件驱动的使用方法。

## 回调函数（Callback）

```javascript
// 传统Node.js回调风格
fs.readFile('file.txt', 'utf8', (err, data) => {
  if (err) {
    console.error('Error:', err);
    return;
  }
  console.log(data);
});
```

## Promise

```
// Promise链式调用
fetch(url)
  .then(res => res.json())
  .then(data => process(data))
  .catch(err => console.error(err))
  .finally(() => cleanup());
```

## async/await

```javascript
// async/await - 最简洁的异步写法
async function fetchData() {
  try {
    const res = await fetch(url);
    const data = await res.json();
    return data;
  } catch (err) {
    console.error('Fetch error:', err);
  }
}

// 并行执行
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);
```

## EventEmitter（事件驱动）

```javascript
const { EventEmitter } = require('events');
const emitter = new EventEmitter();

emitter.on('data', (chunk) => {
  console.log('Received:', chunk);
});

emitter.emit('data', 'Hello');
```

## 并行vs串行

```javascript
// 串行：一个完成后才开始下一个（慢）
const a = await fetchA();
const b = await fetchB();

// 并行：同时开始（快）
const [a, b] = await Promise.all([fetchA(), fetchB()]);
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
