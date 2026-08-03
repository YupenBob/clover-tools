# UUID生成原理是什么？5种UUID版本与选用指南

> UUID是开发中常用的唯一标识符，但很多人不清楚UUID有多个版本，各有优缺点。本文详解5种UUID版本的生成原理和选用场景。

## UUID格式

UUID是128位的唯一标识符，格式为8-4-4-4-12的十六进制字符串：
例：550e8400-e29b-41d4-a716-446655440000

## 5种UUID版本

### UUID v1 - 时间戳+MAC地址

使用当前时间戳和计算机MAC地址生成。优点：包含时间信息、全球唯一；缺点：能追溯生成时间和机器。

### UUID v4 - 随机生成

完全随机生成，隐私性最好。随机重复概率极低（2^122分之一）。最常用的版本。

```javascript
// Node.js生成v4
const { v4: uuidv4 } = require('uuid');
console.log(uuidv4());
```

### UUID v3/v5 - 命名空间哈希

基于MD5(v3)或SHA-1(v5)哈希生成。相同命名空间+相同名字永远生成相同UUID，适合固定ID。

## 版本选用建议

- Web应用内部ID：用v4（无信息泄露）
- 数据库主键：用v4（随机写入性能好）
- 需要重现的ID：用v5（确定性）
- 旧系统兼容：保持原有版本

---

## 相关工具推荐

**UUID/NanoID 生成** — 批量生成 UUID v4/v7 与 NanoID。

在线使用：[UUID/NanoID 生成](https://clovertools.cn/tools/dev/uuid-generator/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
