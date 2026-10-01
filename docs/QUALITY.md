# 内容、路由与发布检查

## 配置与职责

| 位置 | 职责 |
| --- | --- |
| `config/site.mjs` | 品牌与默认域名、首页指南数量、政策类型与真实更新日期 |
| `.env` 的 `PUBLIC_SITE_URL` | 覆盖站点 origin；构建、页面、robots、检查与 IndexNow 共用 |
| `config/routes.mjs` | 语言前缀、浏览器识别、内容语言范围、收录语言与切换回退 |
| `config/quality.mjs` | 元信息长度与内容完整性阈值；阈值是项目约定 |
| `config/fps.mjs` / `docs/FPS-AIM-TRAINER.md` | FPS 参数、证据状态、训练策略、存储容量与模型验收 |
| `src/lib/guides.ts` | 指南内容、关联工具、来源、发布日期、更新日期与阅读时间 |
| `src/lib/tool-details.ts` | 工具步骤、示例、原理、误区、FAQ 与数据处理边界 |
| `src/lib/legal.ts` | 五语政策与联系文案；页面组件只负责展示 |
| `ToolGuide.astro` / `LanguagePreference.astro` | 深度说明展示 / 首次语言选择；不承担工具运算 |
| `scripts/lib/` | 构建环境读取、产物解析与可单独测试的 SEO 审计 |

`tw` 是内部 ID，公开路径始终是 `/zh-hant/`。增加语言需要同时提供词典、页面、政策文案及验证；不能只登记不存在的路径。增加仅部分语言存在的栏目时，先维护 `localizedSections`。

Astro 配置读取 `.env` 使用 Vite 的 `loadEnv`；页面使用 Astro 注入的 `import.meta.env.SITE`，避免维护两份域名。只接受 HTTP(S) origin，不接受子目录部署。参考：[Astro 环境变量说明](https://docs.astro.build/en/guides/environment-variables/)。构建检查使用同一环境模式；自定义模式的构建与检查应通过一致的 `NODE_ENV` 执行。

## 维护内容

1. 新指南必须指向已登记的工具，并维护对应深度说明及返回入口；禁止静默回退到首页掩盖错误关联。
2. 校对工具实际支持的功能、输入示例和输出；代码结果设置 `outputFormat: 'code'`，不把字面量 `\\n` 当作换行。
3. 来源使用官方文档、标准或原始研究；解释适用边界，避免将解码称为验签、编码称为加密或 BMI 称为诊断。
4. `published` 记录真实首次发布时间，`updated` 仅在内容修改时变更；构建时间不冒充内容更新时间。
5. 指南正文是可信本地 HTML，仅维护者可修改；不能将外部或用户输入直接写入 `set:html`。
6. 网络工具需要说明发送对象与数据；一般工具的本地处理说明不能覆盖 HTTP/IP 等例外。

## 验证命令

建议 Node 24，最低 Node 22.18；npm 至少 10.8.2，与已锁定依赖的运行要求一致。

```bash
npm ci
npm test                 # FPS 类型检查、纯函数与反例回归，不需要构建产物
npm run build            # 测试 → 构建 → 内容/链接/SEO/图标检查
npm run check            # 对当前 dist 单独复核
npm run check:all        # 完整构建验收的统一入口
npm run check:browser    # 自动启动临时预览并检查真实浏览器
```

浏览器检查复用 `playwright-core`：Windows 默认系统 Edge，CI 使用 Chromium。覆盖语言识别、参数保留、五语政策页、无翻译指南、指南与工具往返、JSON 精确结果、FAQ、深色模式和移动端溢出。FPS 场景接入同一检查，覆盖六项完整限时训练与暂停恢复、实际键鼠/开镜/换弹、五语、校准、设置保存与清除、锁定和 WebGL 故障、禁用存储及移动端提示。第三方广告/统计请求在测试中阻断以避免网络噪声；广告投放、地区同意提示与线上 API 的可用性仍需独立验证。

```bash
# 需要安装 Chromium 的环境
node node_modules/playwright-core/cli.js install --with-deps chromium
```

可通过 `PLAYWRIGHT_CHANNEL`、`TEST_BASE_URL`、`TEST_PORT`、`TEST_TIMEOUT_MS` 和 `TEST_STARTUP_TIMEOUT_MS` 配置浏览器与预览。未指定地址时临时服务使用空闲端口，测试结束自动关闭。截图保存在忽略目录 `output/playwright/`。

静态检查会拒绝缺失工具页、包含查询参数的失效资源、站内绝对地址失效、无效 canonical、虚构语言版本、收录策略与 noindex 冲突，以及 sitemap 遗漏/重复/包含非收录页。验证文件不参与页面结构检查。

## 发布

Cloudflare Pages 现有构建命令 `npm run build` 已包含静态质量检查，无需另开绕过检查的发布命令。GitHub Actions 在 push/PR 上运行完整构建和浏览器回归，并使用 `https://quality.example` 验证非生产域名配置。工作流本身不修改 Cloudflare 后台设置，也不替代线上部署状态确认。

发布顺序：完成修改 → 完整检查 → 更新 README/相关文档 → 提交 → 推送 → 检查远程工作流与部署状态。`npm run indexnow` 仅在部署确认后手动运行，不能为尚未上线的产物主动推送收录。

## 本轮验证基线（2026-10-01）

- FPS 类型检查和 21 个单元/反例测试通过；包含 13 项训练规则/统计/存储测试与 8 项站点检查。
- 71 个工具、21 份深度说明、16 篇指南通过内容关联检查。
- 417 个站点 HTML 页面通过链接及 SEO 检查；116 条 sitemap 地址与允许收录页面一致。
- 47 个真实浏览器场景通过；FPS 图表、靶场、深色主题及移动端截图已人工查看。

存储异常测试同时发现并修复全站主题读写在禁用 localStorage 时的未捕获错误。主题仍可切换，FPS 训练和报告仍可用。FPS 的来源核验不等于原游戏行为验证，证据状态与复现边界见 [FPS-AIM-TRAINER.md](FPS-AIM-TRAINER.md)。

这些数字描述当前版本的验证覆盖范围，不代表真实访问、搜索收录或收入。
