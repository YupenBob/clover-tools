# JavaScript异步处理方法？Promise.all/async/await完整指南

> JavaScript异步编程是现代前端开发的核心。本文讲解Promise、async/await的错误处理、并行执行、顺序执行等实战场景，以及如何避免回调地狱。

## async/await错误处理

```javascript
async function fetchData() {
  try {
    const res = await fetch(url);
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return await res.json();
  } catch (err) {
    console.error('Fetch failed:', err);
    throw err;
  }
}
```

## 并行执行

```javascript
// Promise.all - 全部成功才算成功
const [users, posts] = await Promise.all([
  fetchUsers(),
  fetchPosts()
]);

// Promise.allSettled - 不管成功失败
const results = await Promise.allSettled([
  fetchUsers(),
  fetchPosts()
]);
results.forEach((r, i) => {
  if (r.status === 'fulfilled') console.log(i, r.value);
  else console.error(i, r.reason);
});
```

## 顺序执行

```javascript
// 逐个等待（慢）
for (const url of urls) {
  const data = await fetch(url);
  results.push(data);
}

// 并发 + 限制数量
async function fetchWithLimit(urls, limit) {
  const queue = [...urls];
  const workers = Array(limit).fill().map(async () => {
    while (queue.length) {
      const url = queue.shift();
      results.push(await fetch(url));
    }
  });
  await Promise.all(workers);
}
```

## 避免回调地狱

```javascript
// 回调地狱
fetchUser(id, (err, user) => {
  fetchPosts(user.id, (err, posts) => {
    fetchComments(posts[0].id, (err, comments) => {
      // 嵌套太深
    });
  });
});

// async/await解决方案
const user = await fetchUser(id);
const posts = await fetchPosts(user.id);
const comments = await fetchComments(posts[0].id);
```

## 超时处理

```javascript
const withTimeout = (promise, ms) => {
  return Promise.race([
    promise,
    new Promise((_, reject) =>
      setTimeout(() => reject(new Error('Timeout')), ms)
    )
  ]);
};
```

---

## 相关工具推荐

**正则表达式测试** — 实时匹配高亮，附带常用表达式库。

在线使用：[正则表达式测试](https://clovertools.cn/tools/dev/regex-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
