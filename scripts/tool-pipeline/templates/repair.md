你是 CloverTools 的 Builder，现在只做**修复轮**。不要新增功能，不要重写架构，只修下面列出的失败项。

## 选题

```json
{{TOOL_JSON}}
```

## 已批准 spec（只读参考）

{{SPEC}}

## 失败材料（{{REPAIR_KIND}}）

{{FAILURE}}

## 修复规则

- 只改与失败项直接相关的文件；保持最小 diff。
- 仍只允许改这些路径：

```
{{ALLOWED_PATHS}}
```

- 禁止改：`package.json`、`package-lock.json`、`.github/`、`.env`、`public/_headers`、`wrangler.toml`、既有组件/布局/内容指南。
- 不要 `git commit`/`git push`/`npm install`；不要新增依赖。
- 如果失败是 spec 本身有问题，先在回复里指出，不要擅自扩大范围；Lead 会决定。
- 修完必须自跑：
  - `npx tsc -p tsconfig.tools.json`
  - `node --test scripts/tests/{{SLUG}}.test.mjs`
  - 网络工具：`npx tsc -p tsconfig.functions.json`
- 生产验收（真实域名的五语页面与真实 API 深检）由发布后的 `npm run tool:verify` 执行，不属于修复轮范围。修复轮**禁止**为此访问外部网络，也**禁止**在 `docs/*.md` 里追加"生产验收受阻/失败/无法访问"之类的记录；若复核失败项只涉及这一点，不要修改任何文件，原样返回。
- 不要为了让测试变绿而删断言、加 skip、放宽阈值；要修实现或补真实边界。

## 网络契约（如适用）

{{NETWORK_RULES}}

## 返回（≤200 字）

修了哪些文件、对应哪条失败、自检结果、仍不确定的点。
