# SQL增删改查语法？SELECT/INSERT/UPDATE/DELETE完整指南

> SQL是后端开发必备技能。本文讲解最常用的SELECT、INSERT、UPDATE、DELETE语句，包含JOIN、WHERE、GROUP BY等高阶用法和实战示例。

## 查询（SELECT）

```sql
SELECT id, name, email
FROM users
WHERE age >= 18
ORDER BY created_at DESC
LIMIT 10 OFFSET 0;
```

## INSERT插入

```
-- 插入单条
INSERT INTO users (name, email, age)
VALUES ('Tom', 'tom@example.com', 20);

-- 批量插入
INSERT INTO users (name, email)
VALUES ('Tom', 'tom@example.com'),
       ('Jerry', 'jerry@example.com');
```

## UPDATE更新

```sql
UPDATE users
SET email = 'new@example.com', age = 21
WHERE id = 1;

-- 批量更新（低版本MySQL）
UPDATE users SET age = age + 1
WHERE id IN (1, 2, 3);
```

## DELETE删除

```
-- 删除单条
DELETE FROM users WHERE id = 1;

-- 清理表（保留结构）
TRUNCATE TABLE users;
```

## JOIN连接

```
-- 左连接
SELECT u.name, o.order_id
FROM users u
LEFT JOIN orders o ON u.id = o.user_id
WHERE o.deleted_at IS NULL;
```

## 聚合统计

```sql
SELECT
  department,
  COUNT(*) as count,
  AVG(salary) as avg_salary
FROM employees
GROUP BY department
HAVING AVG(salary) > 5000;
```

---

## 相关工具推荐

**SQL 格式化** — SQL 语句美化缩进，支持多种方言。

在线使用：[SQL 格式化](https://clovertools.cn/tools/dev/sql-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
