# CSS选择器优先级怎么算？ specificity计算规则与!important注意事项

> CSS优先级（specificity）是前端面试必考题。本文详解选择器权重计算规则、!important的坑，以及如何避免优先级冲突导致的样式问题。

## 优先级计算规则

CSS优先级用一个四元组(A,B,C,D)表示：

- A: ID选择器 (#id)
- B: 类选择器、属性选择器、伪类 (.class/[attr]:hover)
- C: 标签选择器、伪元素 (div, ::before)
- D: 通配符、组合器、否定伪类 (*, >, +)

## 计算示例

```bash
#header .nav li:first-child  // (1, 1, 2, 1)
                                    // ID=1, 类=1, 标签=2

.header .nav .active            // (0, 3, 0, 0)

div#header #nav                // (2, 0, 1, 0)
```

## 优先级排序

```
(1,0,0,0) > (0,10,0,0) > (0,0,10,0) > (0,0,0,10)

#id > .class > tag > *
```

## !important的坑

```
// !important 优先级最高，会覆盖一切
.bad { color: red !important; }

// 多个!important按普通优先级规则比较
// 强烈建议不要用!important，它会破坏样式表的可维护性
```

## 内联样式 vs ID

```
<div style="color: red;"></div>  // 内联优先级 = (1,0,0,0)
// 内联 > ID选择器
```

---

## 相关工具推荐

**CSS 格式化与单位换算** — CSS 美化压缩，px/rem/em/vw 实时互转。

在线使用：[CSS 格式化与单位换算](https://clovertools.cn/tools/dev/css-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
