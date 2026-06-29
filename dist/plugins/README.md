# CloverTools 插件系统

通过插件机制，无需修改主代码即可扩展工具列表。

## 目录结构

```
plugins/
├── tools.json              # 插件工具注册表（需复制为 tools.json 生效）
├── tools.json.example      # 示例配置（参考模板）
├── README.md               # 本说明文件
└── templates/             # 自定义完整 HTML 页面
    └── {category}/         # 按分类组织，与 tools.json 中的 path 对应
        └── {tool}.html    # 完整 HTML 页面（覆盖内置模板）
```

## 安装插件

1. 将插件的 `tools.json` 内容复制到 `plugins/tools.json`
2. 如果插件包含自定义模板，将 `templates/` 目录下的文件放入 `plugins/templates/`
3. 运行 `node generator.js` 构建

## 添加自定义工具

编辑 `plugins/tools.json`：

```json
[
  {
    "category": "我的工具",
    "tools": [
      {
        "name": "我的工具",
        "desc": "工具描述",
        "path": "my-category/my-tool.html",
        "type": "encode-decode",
        "btnLabel1": "编码",
        "btnLabel2": "解码",
        "inputPlaceholder": "输入...",
        "forwardFn": "return v.toUpperCase()",
        "reverseFn": "return v.toLowerCase()",
        "keywords": ["关键词1", "关键词2"]
      }
    ]
  }
]
```

## 自定义完整页面

如果工具需要完全自定义的 HTML/JS，创建 `plugins/templates/my-category/my-tool.html`：

```html
<!DOCTYPE html>
<html>
<head>
  <title>自定义工具</title>
  <!-- 可引入外部资源 -->
</head>
<body>
  <h1>我的自定义工具</h1>
  <textarea id="input" placeholder="输入..."></textarea>
  <button id="btn">执行</button>
  <div id="output"></div>
  <script>
    document.getElementById('btn').onclick = function() {
      var v = document.getElementById('input').value;
      document.getElementById('output').textContent = v.toUpperCase();
    };
  </script>
</body>
</html>
```

## 内置工具类型

| type | 说明 |
|------|------|
| `encode-decode` | 编码/解码双向工具 |
| `calculate` | 计算器类型 |
| `life` | 生活计算工具 |
| `converter` | 格式转换工具 |
| `query` | 查询参考工具 |
| `generator` | 生成器工具 |
| `formatter` | 格式化工具 |
| `format-convert` | 文件格式转换 |
| `image-resize` | 图片压缩调整 |
| `dev-tools` | 开发者工具 |
| `tool-custom` | 完全自定义（通过 customHtml/customScript） |

## 优先级

插件工具会与主工具合并，**相同 path 时插件覆盖主工具**。

## 插件静态文件

`plugins/` 目录下的所有文件会在构建时复制到 `dist/plugins/`，可直接通过 `/plugins/...` 访问。
