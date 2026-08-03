# CSS布局方式有哪些？Flex/Grid/传统布局完全指南

> CSS布局是前端开发的核心技能。本文对比Flexbox、Grid、Float、Position四种布局方式，讲解各自的适用场景和常用技巧。

## Flexbox弹性布局

```
.container {
  display: flex;
  justify-content: space-between;  /* 主轴对齐 */
  align-items: center;  /* 交叉轴对齐
}
.item {
  flex: 1;  /* 占剩余空间 */
}
```

## CSS Grid网格布局

```
.container {
  display: grid;
  grid-template-columns: 1fr 2fr 1fr;  /* 三列布局 */
  gap: 20px;
}
.item:first-child {
  grid-column: 1 / 3;  /* 跨两列 */
}
```

## 传统布局：Float + Clearfix

```
.clearfix::after {
  content: '';
  display: table;
  clear: both;
}
```

## Position定位

```
.fixed { position: fixed; top: 0; }  /* 固定顶部 */
.sticky { position: sticky; top: 10px; }  /* 滚动吸附 */
```

## 布局选用建议

- 导航栏/卡片：Flexbox
- 整体页面结构：Grid
- 文字环绕：Float
- 覆盖层/固定元素：Position

---

## 相关工具推荐

**CSS 格式化与单位换算** — CSS 美化压缩，px/rem/em/vw 实时互转。

在线使用：[CSS 格式化与单位换算](https://clovertools.cn/tools/dev/css-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
