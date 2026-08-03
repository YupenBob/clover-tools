# Git提交规范怎么写？Conventional Commits完整指南

> 规范的Git提交信息让团队协作更清晰。本文讲解Angular风格的Conventional Commits规范，以及如何配置commitlint和自动生成CHANGELOG。

## 格式结构

```
<type>(<scope>): <subject>

body（可选）

footer（可选）
```

## type类型

- feat：新功能
- fix：修复bug
- docs：文档更新
- style：格式调整（不影响代码）
- refactor：重构
- perf：性能优化
- test：测试相关
- chore：构建/工具

## 示例

```
feat(auth): add OAuth2 login support

Add Google and GitHub OAuth2 authentication.
Implements login, logout, and session management.

Closes #123
```

## scope（范围）

```
feat(ui): add new button component
fix(api): resolve user login timeout
refactor(db): optimize query performance
```

## 配置commitlint

```bash
npm install --save-dev @commitlint/config-conventional @commitlint/cli

# commitlint.config.js
module.exports = {
  extends: ['@commitlint/config-conventional']
};
```

## 自动生成CHANGELOG

```bash
npm install --save-dev conventional-changelog-cli

# package.json scripts
{
  "scripts": {
    "changelog": "conventional-changelog -p angular -i CHANGELOG.md -s"
  }
}
```

---

## 相关工具推荐

**CloverTools** — 开发、日常、趣味三合一的在线工具箱，全部工具纯浏览器处理、即开即用、无需注册，数据不出本地。

立即体验：[https://clovertools.cn](https://clovertools.cn)
