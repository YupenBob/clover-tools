# Git暂存区是什么？工作区/暂存区/仓库区完整解析

> Git的暂存区（Stage）是很多新手容易困惑的概念。本文从文件生命周期出发，详解工作区、暂存区、版本库的关系，以及HEAD指针和分支的工作原理。

## Git三个工作区域

Git项目有3个主要区域：工作区（Working Directory）、暂存区（Stage/Index）、Git仓库（Repository）

```
工作区  →  git add  →  暂存区  →  git commit  →  仓库

.git/              # Git仓库（版本库）
  ├── index         # 暂存区
  └── objects/      # 对象存储
```

## 文件生命周期

```bash
# 1. 修改文件（工作区）
vim app.js  # 修改后文件是"已修改"状态

# 2. git add（加入暂存区）
git add app.js  # 文件变成"已暂存"状态

# 3. git commit（提交到仓库）
git commit -m "update app"  # 变成"已提交"状态
```

## 暂存区的实际内容

```bash
# 查看暂存区内容
git ls-files --stage

# 查看暂存区与HEAD的差异
git diff --cached

# 撤销暂存（不丢修改）
git reset HEAD app.js

# 撤销暂存并丢弃修改（危险）
git checkout -- app.js
```

## HEAD指针

```
HEAD是指向当前分支最新提交的指针
每次commit，HEAD会带着分支指针一起向前移动

cat .git/HEAD
# ref: refs/heads/main

cat .git/refs/heads/main
# abc123...（提交hash）
```

## 常见误解

- 暂存区不是临时文件夹，是Git内部的一个索引文件
- git add只是复制文件到.git/objects，不删除原文件
- commit只是把暂存区的快照写入仓库，不联网

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
