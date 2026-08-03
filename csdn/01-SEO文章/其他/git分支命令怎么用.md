# Git分支命令怎么用？创建/切换/合并/删除分支完整指南

> Git分支是团队协作的核心工具。本文讲解分支的创建、切换、合并、删除、重命名等常用操作，以及如何用分支模型管理团队协作流程。

## 查看和创建分支

```bash
# 查看本地分支（当前分支带*）
git branch

# 查看所有分支（包括远程）
git branch -a

# 创建新分支
git branch feature-login

# 创建并切换
git checkout -b feature-login
git switch -c feature-login  # 新语法
```

## 切换和删除分支

```bash
# 切换分支
git checkout main
git switch main  # 新语法

# 删除分支（已合并）
git branch -d feature-login

# 强制删除分支
git branch -D feature-login
```

## 合并分支

```bash
# 将feature合并到当前分支
git merge feature-login

# 遇到冲突时，手动解决后
git add resolved_file.js
git commit
```

## 重命名分支

```bash
# 重命名当前分支
git branch -m old-name new-name

# 重命名其他分支
git branch -m feature-old feature-new
```

## 推送和跟踪

```bash
# 推送分支到远程
git push -u origin feature-login

# 设置上游跟踪
git branch -u origin/feature-login

# 删除远程分支
git push origin --delete feature-login
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
