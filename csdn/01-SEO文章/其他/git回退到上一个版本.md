# Git回退到上一个版本？reset/revert/ checkout的区别与正确用法

> Git版本回退有三种方式：reset、revert和checkout，各有不同的使用场景。本文讲解三种方式的工作原理、区别及如何选择。

## 三种回退方式对比

| 方式 | 作用 | 是否改历史 | 适用场景 |
| --- | --- | --- | --- |
| reset | 移动HEAD指针 | 是（危险） | 本地未推送 |
| revert | 创建新提交 | 否（安全） | 已推送 |
| checkout | 切换分支 | 否 | 临时查看 |

## reset（本地回退）

```bash
# 软回退（保留工作区更改）
git reset --soft HEAD~1

# 硬回退（丢弃所有更改）
git reset --hard HEAD~1

# 混合回退（保留修改但清空暂存区）
git reset --mixed HEAD~1
```

## revert（安全回退，已推送）

```bash
# 创建一个新提交来撤销指定提交
git revert HEAD

# 撤销并保留修改
git revert -n HEAD
# 然后手动处理冲突
```

## checkout（临时查看）

```bash
# 临时查看旧版本（不在分支上）
git checkout HEAD~1

# 回到当前分支
git checkout -
```

## 危险操作恢复

```bash
# reflog查看所有操作历史
git reflog
# 找到误操作之前的commit，恢复
git reset --hard HEAD@{n}
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
