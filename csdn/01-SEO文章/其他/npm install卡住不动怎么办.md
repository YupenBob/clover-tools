# npm install卡住不动怎么办？超时/网络问题的6种解决方案

> npm install经常卡住不动是常见问题，通常是网络问题、镜像源不对、或权限问题。本文提供6种解决方案，从根源解决卡住问题。

## 6种解决方案

### 1. 切换国内镜像（最快）

```bash
npm config set registry https://registry.npmmirror.com
npm install
```

### 2. 清理缓存后重试

```bash
npm cache clean --force
npm install
```

### 3. 使用cnpm

```bash
npm install -g cnpm --registry=https://registry.npmmirror.com
cnpm install
```

### 4. 指定超时时间

```bash
npm install --fetch-timeout=120000
```

### 5. 查看详细日志

```bash
npm install --verbose 2>&1 | tee npm-debug.log
```

### 6. 删除node_modules后重装

```
rm -rf node_modules package-lock.json
npm install
```

## 检查网络

```
ping registry.npmjs.org
curl -v https://registry.npmjs.org
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
