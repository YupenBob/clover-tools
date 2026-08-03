# GitHub Actions部署失败怎么排查？从日志到修复的完整指南

> GitHub Actions部署失败是常见问题。本文从Actions日志分析、常见错误原因、到修复方法提供系统性排查指南。

## 查看Actions日志

```
1. 进入GitHub仓库 -> Actions -> 点击失败的workflow
2. 点击具体job -> 查看step输出
3. 搜索error关键词快速定位问题
```

## 常见错误与修复

### 1. 权限问题（Permission denied）

```bash
# 添加deploy key或使用secrets
- name: Deploy
  uses: peaceiris/actions-gh-pages@v3
  with:
    github_token: ${{ secrets.GITHUB_TOKEN }}
```

### 2. Node版本不匹配

```
jobs:
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v3
      - uses: actions/setup-node@v3
        with:
          node-version: '18'
```

### 3. 构建命令不存在

```bash
# 检查package.json的scripts是否正确
# 确保step顺序：checkout -> setup -> install -> build -> deploy
```

### 4. 超时问题

```
timeout-minutes: 10  # 增加超时时间
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
