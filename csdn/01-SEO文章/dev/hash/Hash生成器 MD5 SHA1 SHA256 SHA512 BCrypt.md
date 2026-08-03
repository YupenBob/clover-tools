# Hash生成器完全指南 - MD5/SHA/BCrypt 算法详解

> 在线生成 Hash 散列值，支持 MD5、SHA-1、SHA-256、SHA-512、BCrypt。详解各算法特点和使用场景。

## Hash 是什么？

Hash（散列）是把任意长度数据映射为固定长度字符串的函数。相同输入必定产生相同输出，不同输入极大概率产生不同输出。不可逆（无法从 Hash 反推原始数据）。

## 常见 Hash 算法

### MD5

128位（16字节）输出，已不建议用于安全场景，但仍广泛用于数据校验（如文件完整性验证）。速度极快，容易被暴力破解。

### SHA-1

160位输出，已被证实存在碰撞漏洞。Git 用 SHA-1 做提交签名，浏览器证书签名逐步废弃中。

### SHA-256 / SHA-512

SHA-2 系列，256位和512位输出。SHA-256 是目前最广泛使用的安全 Hash 算法（TLS证书、比特币等）。

### BCrypt

专为密码存储设计，内置盐值（salt）和可配置的工作因子（cost），会自动加盐防彩虹表攻击。工作因子越高，破解成本指数级上升。

## 代码示例

```javascript
// Node.js 计算 SHA-256
const crypto = require('crypto');
const hash = crypto.createHash('sha256').update('Hello').digest('hex');
console.log(hash); // 185f8db3...

// Python 计算 MD5
import hashlib
print(hashlib.md5(b'Hello').hexdigest())

// BCrypt 密码哈希（Node.js）
const bcrypt = require('bcrypt');
const hash = await bcrypt.hash('password', 10);
```

## 使用场景

- 文件校验：下载文件后计算 MD5/SHA-256 与官网比对，防止篡改
- 密码存储：用 BCrypt 存密码（永远不要存明文）
- 数字签名：非对称加密的摘要算法
- 区块链：工作量证明（Proof of Work）

## 常见问题

Q: MD5 还能用吗？
可以用于文件校验等非安全场景，但密码存储绝对不要用 MD5。

Q: BCrypt 的 cost 应该设多少？
建议 10-12，在可接受的速度（100-500ms）和安全性之间平衡。

Q: 相同密码会产生相同的 Hash 吗？
BCrypt 会随机加盐，每次不同；MD5/SHA 会相同（所以要加盐）。

## 在线生成

使用 CloverTools Hash 生成器 在线生成各种算法的 Hash 值，无需安装任何依赖。

---

## 相关工具推荐

**Hash 生成器** — MD5、SHA 系列、Keccak 与文件哈希计算。

在线使用：[Hash 生成器](https://clovertools.cn/tools/dev/hash/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
