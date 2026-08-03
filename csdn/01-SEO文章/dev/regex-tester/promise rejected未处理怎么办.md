# Promise rejected未处理怎么办？JavaScript异步错误处理完整指南

> JavaScript中Promise rejection未被捕获会导致UnhandledPromiseRejection警告，严重时崩溃。本文讲解如何正确处理Promise拒绝，包括try/catch、.catch()、async/await最佳实践。

## 为什么Promise rejection很重要

Node.js 15+版本开始，默认情况下未处理的Promise rejection会自动终止进程。在浏览器中也会产生Unhandled Rejection警告。

## 正确处理方式

### 1. async/await + try/catch

```javascript
async function fetchData() {
  try {
    const res = await fetch(url);
    return await res.json();
  } catch(err) {
    console.error("请求失败:", err.message);
  }
}
```

### 2. Promise链式调用用.catch()

```
fetch(url)
  .then(res => res.json())
  .catch(err => console.error(err));
```

## 全局处理未捕获reject

```
process.on('unhandledRejection', (reason, promise) => {
  console.error("Unhandled Rejection:", reason);
});
```

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
