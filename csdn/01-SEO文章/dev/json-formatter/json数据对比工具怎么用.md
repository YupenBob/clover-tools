# JSON数据对比工具怎么用？快速找出两个JSON文件差异的方法

> JSON数据对比是开发调试中的常见需求。本文介绍如何使用CloverTools JSON对比工具快速找出两个JSON文件的差异，并附代码实现方法。

## 什么时候需要JSON对比

- API返回数据与预期不符，需要找差异
- 配置文件修改后忘记改了什么
- 前后端数据格式不匹配，需要排查哪里不同

## 在线工具使用方法

使用CloverTools JSON对比工具：打开工具 - 支持左右两栏粘贴、语法高亮、一键找出差异。

## 命令行对比（jq）

```bash
# 安装jq
apt install jq

# 对比两个JSON文件
diff <(jq -S . a.json) <(jq -S . b.json)
```

## Node.js代码对比

```javascript
const fs = require('fs');

function diffJson(obj1, obj2, path = '') {
  const result = {};

  if (typeof obj1 !== typeof obj2) {
    result[path] = { type: 'type', a: typeof obj1, b: typeof obj2 };
    return result;
  }

  if (typeof obj1 !== 'object' || obj1 === null) {
    if (obj1 !== obj2) {
      result[path] = { a: obj1, b: obj2 };
    }
    return result;
  }

  const keys = new Set([...Object.keys(obj1||{}), ...Object.keys(obj2||{})]);
  keys.forEach(key => {
    const subResult = diffJson(obj1?.[key], obj2?.[key], path ? path + '.' + key : key);
    Object.assign(result, subResult);
  });

  return result;
}
```

## 快速diff算法

如果只需要知道是否相同，不需要知道差异：JSON.stringify(a) === JSON.stringify(b)（注意属性顺序会影响结果）。

---

## 相关工具推荐

**JSON 格式化与校验** — 格式化、压缩、校验 JSON，实时定位语法错误。

在线使用：[JSON 格式化与校验](https://clovertools.cn/tools/dev/json-formatter/)

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
