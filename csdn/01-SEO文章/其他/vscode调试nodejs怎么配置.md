# VSCode调试Node.js怎么配置？launch.json完整指南

> VSCode是Node.js开发的利器，但调试配置常让人困惑。本文详解launch.json的多种配置方式，从简单脚本到复杂项目全覆盖。

## 创建launch.json

```
1. VSCode侧边栏点击"运行和调试"
2. 点击"创建launch.json"
3. 选择"Node.js"模板
```

## 常用配置

```
{
  "version": "0.2.0",
  "configurations": [
    {
      "type": "node",
      "request": "launch",
      "name": "启动程序",
      "program": "${workspaceFolder}/index.js",
      "runtimeExecutable": "node"
    },
    {
      "type": "node",
      "request": "attach",
      "name": "附加到进程",
      "port": 9229
    }
  ]
}
```

## 调试Web应用

```
{
  "type": "node",
  "request": "launch",
  "name": "调试服务器",
  "program": "${workspaceFolder}/server.js",
  "env": { "NODE_ENV": "development" },
  "runtimeArgs": ["--inspect-brk"],
  "restart": true
}
```

## 断点调试技巧

- F9 设置断点
- F10 单步跳过
- F11 单步进入
- Shift+F11 跳出
- Variables面板查看变量值
- Watch面板添加表达式监控

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
