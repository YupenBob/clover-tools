# Git合并分支命令怎么用？merge/rebase cherry-pick 完整指南

> Git分支合并是团队协作的核心操作。本文讲解merge、rebase、cherry-pick三种合并方式的区别、适用场景，以及解决合并冲突的实战技巧。

## merge（合并提交）

```bash
# 将feature分支合并到main
git checkout main
git merge feature

# 合并后产生一个merge commit
# 保留完整历史，适合团队协作分支
```

## rebase（变基）

```bash
# 把当前分支"嫁接"到目标分支顶部
git checkout feature
git rebase main

# 产生线性历史，更干净
# 但会改写提交历史，**不要对已推送的分支执行**
```

## cherry-pick（挑拣提交）

```bash
# 把某个commit应用到当前分支
git cherry-pick abc1234

# 适用于：
# - 把hotfix从一个分支应用到其他分支
# - 回滚后的修复需要应用到main
```

## 解决合并冲突

```bash
# 1. 拉取最新代码
git pull --rebase origin main

# 2. 手动解决冲突文件
git add resolved_file.js

# 3. 继续rebase
git rebase --continue

# 或放弃rebase
git rebase --abort
```

## 合并vs变基选择

- 公共分支（main/dev）：用merge
- 个人功能分支：用rebase保持线性历史
- hotfix：用cherry-pick精确应用

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
