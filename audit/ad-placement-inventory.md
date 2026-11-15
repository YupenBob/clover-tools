# 广告位实证清单

审计日期2026-11-15。代码基线 `2de17e5`，原始文件保存在 `evidence/source-baseline/`（清单及SHA见 `source-baseline.json`）；线上取证06:00 UTC起，截图时间逐张记录于 `evidence/browser-results.json`。并行实现者正在改首页，下面是**审计基线中的定义**，不承诺最终源码仍有相同调用点。

**历史广告位：未知（用户已忘记，交接包明确不得臆造）。** 下表只证明当前代码具备的调用位置，不证明它们以前开启过、填充过或产生过曝光。交接包§5.2未来布局建议不是历史证据。

## 开关与公共行为

- `src/lib/ads.ts:12`：只有构建变量 `PUBLIC_ADS_ENABLED === 'true'` 才开启；`canServeAds` 剥离en/ko/ja/zh-hant前缀，排除404、privacy、terms、contact、about及子路径。当前默认false。
- `getAdSlot` 排除空字符串与 `PLACEHOLDER_`；`AdUnit.astro` 在slotId为null时连外框也不输出。不是隐藏空白框。
- `BaseLayout.astro` 的 `serveAds = ads && canServeAds(path)` 控制全局脚本；meta `google-adsense-account` 与 `ads.txt` 独立保留，不等于广告展示。即使无有效slot，未来开启全局开关仍可能加载脚本，自动广告设置必须另查后台。
- AdUnit有本地语言标签、`ins.adsbygoogle`、`data-full-width-responsive=true`，宽度100%。框体默认最小100px、rectangle最小250px、vertical最小600px，垂直margin `var(--space-5)`；没有保证实际创意高度/CLS的固定广告尺寸。
- 推送逻辑在当前帧/加载/IntersectionObserver触发前检查可见性和宽度，最多重试30帧；不能称为“仅接近视口才加载”，全局脚本与首次schedule不是严格懒加载。

## 按slot逐项登记

| slot / 页面类型 | 调用组件、选择器与位置 | 显示条件 | 尺寸及移动行为 | 与核心操作区距离 | 当前线上 |
| --- | --- | --- | --- | --- | --- |
| `home_top` 首页五语 | 基线`src/pages/index.astro:99`及四语言同类页，`AdUnit` `.ad-slot.ad-slot--horizontal`；搜索/分类标签后，分类网格前 | 公共开关+非排除页+有效ID；目前`PLACEHOLDER_HOME_TOP` | 自适应全宽，最小100px；无专用移动媒体查询 | DOM位于搜索之后、网格之前；不在搜索控件内部。实际像素距离待真实广告启用测量 | 首页curl/DOM均0；无框、无脚本 |
| `category_top` 工具分类五语 | `src/pages/tools/[category]/index.astro:68`及译文页，`AdUnit`同上；tool-hero后、工具网格前 | 目前`PLACEHOLDER_CATEGORY_TOP`，故即使开关true也无框 | 全宽最小100px；移动自然占行 | 目录导航与网格之间，非工具输入区；实际像素待测 | 源码默认不输出；本轮首页/工具/指南实证不能替代每个分类页网络检查 |
| `tool_sidebar` 工具五语 | `src/layouts/ToolLayout.astro:138`，`.tool-layout > .tool-discovery > .ad-slot`；相关工具面板下方 | 唯一非空真实ID `9174056084`；仍须公共开关true | `layout=sidebar`为rectangle最小250px，否则horizontal最小100px。默认layout是wide，不应一概称为桌面侧栏广告；宽屏sidebar布局在workspace CSS≥960px为240px栏，窄屏堆叠；global CSS另有≥900px260px规则，需考虑层叠 | 操作区在兄弟`.tool-workspace`；移动在整个操作区和相关工具后，宽屏sidebar在操作区旁。布局gap32px，**不是实际按钮到广告的测量值/政策安全保证** | JSON、Base64、计算器、反应和M3U8样本无容器/请求；没有真实广告几何可量 |
| `tool_bottom` 工具五语 | `ToolLayout.astro:142`，tool-layout之后、tool-about与ToolGuide之前；`AdUnit`horizontal | 目前`PLACEHOLDER_TOOL_BOTTOM` | 全宽最小100px；移动仍在操作区后 | DOM位于完整操作区和相关工具后、说明前；未穿插输入与操作按钮，像素距离待测 | 样本0容器，placeholder不渲染 |
| `grid_filler` 首页/分类五语 | `GridAdFiller` `.tool-grid > .grid-filler[data-grid-filler]`；末行空列补齐 | 配置为空字符串，当前禁用。若未来有效ID，还须开关true且多列网格、可见卡片数不整除列数 | 动态span剩余列、匹配末卡高度；单列/整行时hidden。窗口/字体/卡片class变化会重算 | 会与可点击工具卡片同排，未来启用需重点防混淆；目前无需量距 | 无DOM；应继续保持禁用，避免卡片与广告混排 |
| 指南页 | `GuideArticle.astro`没有AdUnit/GridAdFiller，没有“articleMidContent”等slot定义 | 当前全局脚本也因开关关闭不输出；未来自动广告后台未知 | 无当前广告尺寸/移动位置 | 无当前广告，无距离可量 | 抽样指南curl/DOM与请求均0 |

`src/styles/fun-workspaces.css:1210`起为拼豆打印媒体隐藏 `.adsbygoogle` 与 `.tool-discovery` 等，不是网页屏幕广告位，也不是当前广告开启证据。`global.css:923`与`tool-workspace.css:65,376`解释布局行为。无固定遮挡式广告代码在本次相关搜索中检出；未获后台自动广告配置，不能断言历史从未有自动广告。

## 线上HTML与浏览器证据

复现：`python3 audit/tools/fetch-live.py && python3 audit/tools/summarize.py`。脚本对每个URL使用 `curl -sS -L --max-time 35 -D audit/evidence/<name>.headers -o audit/evidence/<name>.html -w '%{json}' URL`，保存响应、状态、时间及最终URL。

可直接核查：

```bash
rg -n 'adsbygoogle|class="[^"]*ad-slot|data-grid-filler|pagead2.googlesyndication' audit/evidence/home.html audit/evidence/tool.html audit/evidence/guide.html
cat audit/evidence/ads.html
```

第一条0匹配（rg退出1表示无匹配）；三页分别为 `https://clovertools.cn/`、`https://clovertools.cn/tools/dev/json-formatter/`、`https://clovertools.cn/guides/json-unexpected-token-html/`，均200。指南URL在已保存sitemap中。`ads.txt` 200，内容 `google.com, pub-2739960879713370, DIRECT, f08c47fec0942fa0` 与public文件逐字节一致。

浏览器桌面1280×900、移动390×844，无广告扩展、真实线上HTTPS；首页/JSON工具/JSON指南六张截图按视口精确输出1280×900与390×844；其他补充截图为fullPage（PNG高度随内容增长）。`browser-results.json`记录每张URL、UTC、状态、`.adsbygoogle,.ad-slot,[data-grid-filler]`数量与广告网络请求；当前成功样本均0，支持“**线上目前不加载广告、无可见占位**”这一抽样结论。未人为启用PUBLIC_ADS_ENABLED，不伪造填充广告来宣称通过视觉验收。

| 页面 | 桌面 | 移动 |
| --- | --- | --- |
| 首页 | [线上首页桌面](screenshots/live-home-desktop.png) | [线上首页移动](screenshots/live-home-mobile.png) |
| JSON工具 | [线上工具桌面](screenshots/live-tool-desktop.png) | [线上工具移动](screenshots/live-tool-mobile.png) |
| JSON指南 | [线上指南桌面](screenshots/live-guide-desktop.png) | [线上指南移动](screenshots/live-guide-mobile.png) |

另有五种工具、五种指南抽样截图，见 `screenshots/` 与 `content-quality-notes.md`。本轮未改产品、未迁移slot；复审继续保持广告及可见空框关闭。未来启用前应逐页测量真实广告与输入/下载/游戏区距离、移动CLS、广告标签和后台自动广告排除，不将当前无广告截图当作启用后的合规证明。[Google广告位置政策](https://support.google.com/adsense/answer/1346295?hl=zh-Hans)明确提醒附近下载/播放/应用控件可能引发误点击；没有可套用于所有工具的统一安全距离。
