# Dockerfile怎么写？Node.js/Python/Go应用的最佳实践

> Dockerfile是容器化应用的核心。本文讲解如何编写高效的Dockerfile，包括多阶段构建、层缓存优化、健康检查等高级技巧。

## 基础结构

```
FROM node:18-alpine
WORKDIR /app
COPY package*.json ./
RUN npm ci --only=production
COPY . .
EXPOSE 3000
CMD ["node", "index.js"]
```

## 多阶段构建（减小镜像）

```bash
# 阶段1：构建
FROM node:18 AS builder
WORKDIR /app
COPY . .
RUN npm ci && npm run build

# 阶段2：运行
FROM node:18-alpine
WORKDIR /app
COPY --from=builder /app/dist ./dist
COPY --from=builder /app/node_modules ./node_modules
CMD ["node", "dist/index.js"]
```

## 层缓存优化

```bash
# 频繁变化的文件放后面
COPY package*.json ./
RUN npm ci
COPY src ./src  # 源代码变化不影响依赖层
COPY public ./public
```

## 健康检查

```
HEALTHCHECK --interval=30s --timeout=10s --start-period=5s --retries=3
  CMD curl -f http://localhost:3000/health || exit 1
```

## .dockerignore

```
node_modules
.git
.env
*.log
dist
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
