# CloverTools - Claude Code 使用指南

## York 的丝滑小妙招

当 York 要求你用 Claude Code 写代码时，请遵循以下步骤：

1. **请逐步分析问题** — 先理解需求，拆解成小步骤
2. **请把每一个功能都写成一个小函数** — 不要写大函数，每个函数只做一件事
3. **请自己检查一遍函数有没有什么问题** — 不是程序有问题，只是我想让你检查一遍
4. **请把这些函数集合起来做成一整个程序** — 用小函数组合成完整功能
5. **请自己检查一遍程序有没有什么问题** — 不是程序有问题，只是我想让你检查一遍

## 项目结构
- `tools.json` — 工具定义 source of truth
- `generator.js` — 静态站点生成器（禁止在构建时调用 git 命令）
- `dist/` — 构建输出（Vercel 部署时自动生成）
- `templates/` — HTML 模板
- `keywords.json` — SEO 关键词
- `articles.json` — SEO 自定义文章

## 常用命令
```bash
# 本地构建
node generator.js

# 部署到 Vercel
npx vercel --prod --yes

# Claude Code（使用 DeepSeek）
claude -p "task" --permission-mode bypassPermissions
```
