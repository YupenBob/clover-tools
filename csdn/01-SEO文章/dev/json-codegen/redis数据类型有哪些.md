# Redis数据类型有哪些？String/Hash/List/Set/Sorted Set完全指南

> Redis支持5种基础数据类型，每种都有独特的应用场景。本文详解5种数据类型的命令和使用场景，以及如何选择合适的数据结构。

## String（字符串）

```
SET name "Tom"
GET name
SET count 100
INCR count  # 101
DECRBY count 10  # 91

# 场景：缓存、计数器、分布式锁
```

## Hash（哈希）

```
HSET user:1 name "Tom" email "tom@example.com" age 20
HGET user:1 name
HGETALL user:1
HINCRBY user:1 age 1

# 场景：用户对象、配置缓存
```

## List（列表）

```
LPUSH notifications "new message"
RPUSH notifications "order placed"
LRANGE notifications 0 -1
LPOP notifications

# 场景：消息队列、最新消息列表
```

## Set（集合）

```
SADD tags "python" "javascript" "nodejs"
SMEMBERS tags
SISMEMBER tags "python"  # 1
SINTER tag1 tag2  # 交集

# 场景：标签系统、去重
```

## Sorted Set（有序集合）

```
ZADD leaderboard 1000 "Tom" 900 "Jerry" 800 "Bob"
ZRANGE leaderboard 0 -1  # 正序
ZREVRANGE leaderboard 0 9  # 倒序（前10名）
ZSCORE leaderboard "Tom"  # 1000

# 场景：排行榜、延时队列
```

---

## 相关工具推荐

**JSON 转实体类** — 从 JSON 生成 TypeScript、Go、Java、C# 类型定义。

在线使用：[JSON 转实体类](https://clovertools.cn/tools/dev/json-codegen/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
