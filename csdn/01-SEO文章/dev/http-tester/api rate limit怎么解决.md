# api rate limit怎么解决 - CloverTools

> API 一直返回 429 Too Many Requests？5分钟排查限流原因，3种方案从临时破解到彻底解决，附重试策略完整实现。

## API Rate Limit怎么解决？

API Rate Limit（接口速率限制）是服务提供商为防止资源被耗尽，对客户端在一定时间内发起的请求次数进行限制。当触发限制时，接口会返回429状态码。以下是系统化的应对方案。

## 理解Rate Limit的工作机制

大多数API的Rate Limit通过响应头告知客户端限制规则：

- X-RateLimit-Limit：时间窗口内的最大请求数
- X-RateLimit-Remaining：当前剩余可用请求数
- X-RateLimit-Reset：限制重置的时间戳（Unix秒级）
- Retry-After：触发限制后需要等待的秒数

```javascript
fetch('/api/data')
  .then(r => {
    const limit = r.headers.get('X-RateLimit-Limit');
    const remaining = r.headers.get('X-RateLimit-Remaining');
    console.log(`Limit: ${limit}, Remaining: ${remaining}`);
    return r;
  })
  .then(r => r.json());
```

## 策略一：请求限流（Throttling）

```javascript
class Throttler {
  constructor(maxPerSecond) {
    this.maxPerSecond = maxPerSecond;
    this.lastRequest = 0;
  }

  async waitForSlot() {
    const now = Date.now();
    const minInterval = 1000 / this.maxPerSecond;
    const elapsed = now - this.lastRequest;
    if (elapsed < minInterval) {
      await new Promise(r => setTimeout(r, minInterval - elapsed));
    }
    this.lastRequest = Date.now();
  }
}

const throttler = new Throttler(10);
async function throttledFetch(url) {
  await throttler.waitForSlot();
  return fetch(url);
}
```

## 策略二：指数退避重试

```javascript
async function fetchWithBackoff(url, maxRetries = 5) {
  for (let i = 0; i < maxRetries; i++) {
    const res = await fetch(url);
    if (res.status === 429) {
      const retryAfter = res.headers.get('Retry-After') || Math.pow(2, i);
      console.log(`Rate limited. Waiting ${retryAfter}s before retry ${i+1}/${maxRetries}`);
      await new Promise(r => setTimeout(r, parseInt(retryAfter) * 1000));
      continue;
    }
    return res;
  }
  throw new Error('Max retries exceeded');
}
```

## 策略三：请求合并（Batching）

```javascript
async function batchGetUsers(userIds) {
  const res = await fetch(`/api/users?ids=${userIds.join(',')}`);
  return res.json();
}

const allUsers = await batchGetUsers([101, 102, 103]);
```

## 策略四：本地缓存减少请求

```javascript
const cache = new Map();
const TTL = 60000;

function cachedFetch(url) {
  const cached = cache.get(url);
  if (cached && Date.now() - cached.timestamp < TTL) {
    return Promise.resolve(cached.data);
  }
  return fetch(url)
    .then(r => r.json())
    .then(data => {
      cache.set(url, { data, timestamp: Date.now() });
      return data;
    });
}
```

## 预防措施

- 在开发阶段就了解API的Rate Limit规则
- 实现请求队列，统一管理请求发送节奏
- 对于关键数据实现多级缓存
- 与API提供商沟通企业级配额

## 常见问题 FAQ

Q: Rate Limit是按IP还是按用户计算？
A: 取决于API设计。公共API通常按IP，企业API通常按用户/应用Token。

Q: 可以通过代理隐藏IP绕过限制吗？
A: 不推荐。大量代理IP很快会被封禁，且可能违反服务条款。

Q: 遇到429应该等多久再重试？
A: 优先遵循Retry-After头。如果没有，使用指数退避：1s→2s→4s→8s。

---

## 相关工具推荐

**HTTP 接口测试** — 构造请求调试接口，查看响应与耗时。

在线使用：[HTTP 接口测试](https://clovertools.cn/tools/dev/http-tester/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
