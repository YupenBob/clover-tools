# CloverTools 扩充计划

**目标**：27 → 40 工具（+13 个）  
**优先级**：实用性 > 趣味性 > 完整性

---

## 📊 当前状态（27 工具）

| 分类 | 工具数 | 工具列表 |
|------|--------|----------|
| 编码转换 | 6 | base64, hex, md5, sha, unicode, url |
| JSON 相关 | 4 | formatter, ts, xml, yaml |
| 文本处理 | 6 | camel, case, count, diff, extract, pinyin |
| 时间工具 | 5 | age, countdown, interval, timestamp, world |
| 其他工具 | 4 | color, hex-convert, password, uuid |
| 代码工具 | 2 | css, html |

---

## 🎯 新增工具规划（13 个）

### P0 优先级（5 个）- 立即实现

#### 1. QR Code 生成/解析
- **位置**：`tools/other/qrcode.html`
- **功能**：生成二维码、解析二维码内容
- **依赖**：qrcode.js (CDN)
- **场景**：分享链接、WiFi 密码、联系方式

#### 2. 正则表达式测试
- **位置**：`tools/text/regex.html`
- **功能**：正则匹配测试、替换、提取
- **场景**：开发调试、数据清洗

#### 3. JWT 解码
- **位置**：`tools/encrypt/jwt.html`
- **功能**：JWT token 解码、验证
- **场景**：API 调试、身份验证

#### 4. Cron 表达式生成
- **位置**：`tools/time/cron.html`
- **功能**：可视化生成 cron 表达式
- **场景**：定时任务配置

#### 5. Markdown 预览
- **位置**：`tools/text/markdown.html`
- **功能**：Markdown 实时预览、导出 HTML
- **场景**：写文档、写博客

---

### P1 优先级（5 个）- 本周实现

#### 6. 图片压缩
- **位置**：`tools/other/image-compress.html`
- **功能**：本地压缩图片、调整尺寸
- **依赖**：browser-native Canvas API
- **场景**：上传前优化

#### 7. CSS 压缩/格式化
- **位置**：`tools/code/css-minify.html`
- **功能**：CSS 压缩、格式化、前缀添加
- **场景**：前端开发

#### 8. JS 压缩/格式化
- **位置**：`tools/code/js-minify.html`
- **功能**：JavaScript 压缩、格式化
- **场景**：前端开发

#### 9. 颜色提取器
- **位置**：`tools/other/color-picker.html`
- **功能**：从图片提取颜色、生成调色板
- **场景**：设计、配色

#### 10. Lorem Ipsum 生成
- **位置**：`tools/text/lorem.html`
- **功能**：生成占位文本（多语言）
- **场景**：设计稿填充

---

### P2 优先级（3 个）- 本月实现

#### 11. HTTP 请求测试
- **位置**：`tools/other/http-test.html`
- **功能**：发送 HTTP 请求、查看响应
- **限制**：浏览器 CORS 限制
- **场景**：API 快速测试

#### 12. 数据 Mock 生成
- **位置**：`tools/other/mock-data.html`
- **功能**：生成假数据（姓名、邮箱、地址等）
- **场景**：开发测试

#### 13. 时区转换器
- **位置**：`tools/time/timezone.html`
- **功能**：多时区时间对比、会议时间换算
- **场景**：跨时区协作

---

## 📝 开发优先级

### 第一周（P0）
- [ ] QR Code 生成/解析
- [ ] 正则表达式测试
- [ ] JWT 解码
- [ ] Cron 表达式生成
- [ ] Markdown 预览

**目标**：32 工具

### 第二周（P1）
- [ ] 图片压缩
- [ ] CSS 压缩/格式化
- [ ] JS 压缩/格式化
- [ ] 颜色提取器
- [ ] Lorem Ipsum 生成

**目标**：37 工具

### 第三周（P2）
- [ ] HTTP 请求测试
- [ ] 数据 Mock 生成
- [ ] 时区转换器

**目标**：40 工具 ✅

---

## 🎨 工具模板

```html
<!DOCTYPE html>
<html lang="zh-CN">
<head>
    <meta charset="UTF-8">
    <meta name="viewport" content="width=device-width, initial-scale=1.0">
    <title>工具名称 - CloverTools</title>
    <link rel="stylesheet" href="../../styles/main.css">
</head>
<body>
    <header>
        <a href="../../">🏠 CloverTools</a>
        <nav>...</nav>
    </header>
    
    <main>
        <h1>工具名称</h1>
        <p>工具描述</p>
        
        <div class="tool-container">
            <!-- 输入区域 -->
            <textarea id="input" placeholder="输入..."></textarea>
            
            <!-- 操作按钮 -->
            <button onclick="process()">处理</button>
            
            <!-- 输出区域 -->
            <textarea id="output" readonly></textarea>
        </div>
    </main>
    
    <script>
        function process() {
            const input = document.getElementById('input').value;
            const result = yourLogic(input);
            document.getElementById('output').value = result;
        }
    </script>
</body>
</html>
```

---

## 📊 进度追踪

| 日期 | 工具数 | 新增 | 备注 |
|------|--------|------|------|
| 2026-03-07 | 27 | - | 基准 |
| 2026-03-09 | 32 | +5 | P0 完成 |
| 2026-03-16 | 37 | +5 | P1 完成 |
| 2026-03-23 | 40 | +3 | P2 完成 ✅ |

---

## 🚀 长期目标（40+ 工具）

### 潜在方向
- AI 相关工具（调用 API）
- 批量处理工具
- 文件转换工具
- 开发者工具合集
- 设计工具合集

---

**创建时间**：2026-03-08 02:59  
**创建者**：小 C (Clover)  
**状态**：规划完成，待执行
