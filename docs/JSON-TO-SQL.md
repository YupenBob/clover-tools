# JSON 转 SQL

五语入口：`/tools/dev/json-to-sql/`、`/zh-hant/tools/dev/json-to-sql/`、`/en/tools/dev/json-to-sql/`、`/ko/tools/dev/json-to-sql/`、`/ja/tools/dev/json-to-sql/`。

本工具将单个 JSON 对象或非空对象数组映射到一张表，生成可审查的 INSERT、UPDATE 或 CREATE TABLE。它不生成程序类型定义（json-codegen）、表格文本（json-convert），也不负责整理已有 SQL（sql-formatter）或只做 JSON 排版（json-formatter）。操作展开区提供同语言的定向内链。

## 操作与状态

SSR 首屏为空输入、`JSON` 标签、`-- SQL` 加本地化零语句注释，以及右上角无文字展开入口。无示例预填、自动生成或工具数据恢复。内联 critical CSS 在 JavaScript 执行前隐藏站点外壳；唯一 h1 保留在 SSR 中，展开后恢复。禁用 JavaScript 时原生锚点可展开静态说明。

移动指针、用户聚焦或键盘操作展开辅助区。八秒闲置后收起；设置打开、辅助控件持有焦点和运行任务期间保持展开。Esc 主动收起，保留输入和成功结果。F2 开关设置，F10 请求全屏，Ctrl/Cmd + Enter 在工具内生成。普通 Enter 保持原生文本域或按钮行为。

输入或任何生成选项变化立即清除 SQL、手动复制内容和导出资格，300ms 后分析字段。每个任务带 revision；旧结果及异步剪贴板提示无法提交到新版本。新任务、取消或清空终止旧 Worker。清空仅清除当前工具内存，保留本次访问设置。

视图状态为 firstLoad、primary、reveal、settingsOpen、degraded、fullscreen；处理状态为 empty、analyzing、ready、generating、success、error、cancelled。主视图契约在 `data/tool-presentation/json-to-sql.json`，运行脚本和 SSR 直接读取配置。字号阈值、命中范围、快捷键与闲置时长由该契约提供，深色配色复用站点语义变量。

## 生成规则

默认 PostgreSQL、表名 records、INSERT、每批 100 行、嵌套 JSON 文本、关闭日期识别、不选择主键。表名整体视为一个标识符；例如 schema.table 不拆段。

- INSERT 按字段首次出现顺序合并显式列清单，并按输入顺序分批。缺失和 null 都输出 NULL，但检查表分别统计。
- UPDATE 必须明确选择一个完整、非 null、唯一且类型一致的字符串或整数键。每行一条语句；主键只进入 WHERE，缺失不进入 SET，显式 null 进入 SET。无可更新字段时整次失败。整数按精确数值去重，字符串按原始码点比较；目标库类型和排序规则仍须人工复核。
- CREATE TABLE 使用全部样本推断类型和可空性。全空列为文本并警告；完整非空列为 NOT NULL。所选主键独立校验并生成表级 PRIMARY KEY。MySQL 字符串主键为 VARCHAR(255)，限制 255 个 Unicode 码点，表字符集为 utf8mb4。INSERT 可附加建表；UPDATE 不附加。
- 不生成 DROP、IF NOT EXISTS、自动递增、索引、外键、默认值、UPSERT 或迁移脚本。

嵌套策略为紧凑 JSON 文本、展开非空对象、拒绝任何嵌套。数组不会按下标展开。展开列 profile.city 整体引用；原始点号键碰撞、ASCII 大小写碰撞、同一路径对象/标量冲突、空对象都会失败。对象路径上的 null 为已有后代提供显式 null；缺失继续保留为缺失。

整数和小数可合并；其他混合默认报错。明确选择降级后只将冲突列转文本，原字符串保持不变，数字用精确规范形式，布尔值用 true/false，容器用 JSON 文本，空值保持 NULL。

## 精确值、方言与日期

解析器保存数字词元、键顺序和每个节点的 UTF-16 范围，不依赖浏览器 JSON.parse 的错误文案。JSON.parse 只用于已扫描的字符串词元解码。重复键按解码后的名称判断；Map 存储字段，原型名称作为普通数据。

数字通过字符串运算及 BigInt 规范化指数和负零，精度上限 38、小数位上限 18。64 位内整数使用 BIGINT（SQLite 为 INTEGER）；更大的整数在 MySQL/PostgreSQL 使用 DECIMAL/NUMERIC，SQLite 拒绝并建议写为 JSON 字符串。SQLite 小数输出 REAL，检查表提示浮点存储限制。

PostgreSQL 使用 E 字符串，双写单引号和反斜杠，明确编码控制字符。SQLite 双写单引号，保留反斜杠及合法换行。MySQL 普通字符串双写单引号；存在反斜杠或控制字符时使用 UTF-8 十六进制 `CONVERT(X'…' USING utf8mb4)`。三种方言均拒绝解码后的 NUL 和孤立代理项。标识符整体引用并双写内部引用字符，禁止空名、首尾空白、控制字符、孤立代理项和超过 63 UTF-8 字节的名称。

日期识别默认关闭，仅提示特征。启用后识别真实公历 YYYY-MM-DD 和 YYYY-MM-DDTHH:mm:ss[.SSS]Z，年份 1000–9999，小数秒 1–3 位，输出统一三位。MySQL DATETIME 文本约定为 UTC，PostgreSQL 保留 UTC 含义，SQLite 保留规范 ISO 文本；本地时间及偏移时间保持字符串。合法日期和其他字符串混合退回文本并警告。逻辑不读取当前时间或设备时区。

## 确定输出示例

默认设置，合成输入：

```json
{"id":1,"active":true}
```

```sql
-- SQL
INSERT INTO "records" ("id", "active") VALUES
  (1, TRUE);
```

UPDATE、主键 id，合成输入：

```json
[{"id":1,"name":"A","n":1},{"id":2,"n":2},{"id":3,"name":null}]
```

```sql
-- SQL
UPDATE "records" SET "name" = E'A', "n" = 1 WHERE "id" = 1;

UPDATE "records" SET "n" = 2 WHERE "id" = 2;

UPDATE "records" SET "name" = NULL WHERE "id" = 3;
```

第二行不清空 name；第三行明确清空 name。生成脚本不会验证目标表的既有约束、权限、排序规则和容量。

## 资源、错误与降级

| 项目 | 上限 |
| --- | --- |
| 输入 UTF-8 字节 | 1,048,576 |
| 行 / 列 / 行列乘积 | 5,000 / 200 / 100,000 |
| JSON 深度 / 节点 | 32 / 200,000 |
| 数字词元字符 | 256 |
| 输出 UTF-8 字节 | 8,388,608 |
| INSERT 批量 | 1–1000 的整数 |

任何限制、类型或主键错误都会使整次生成失败，无部分脚本可导出。输入错误带稳定 code、offset/endOffset、1 开始行列和 JSON Pointer。CRLF 计一个换行，独立 CR/LF 也换行，列和 offset 按 UTF-16 计数。定位选择原文范围；缺失字段定位所属记录；设置错误聚焦对应控件，不伪造输入坐标。重复键还显示第一次位置。

本地模块 Worker 不可用时主线程按相同限制处理，并在展开区说明。主线程同步计算期间，取消只能在浏览器再次处理事件时响应；大输入建议保留 Worker 能力。剪贴板拒绝提供可聚焦、完整选中的只读 SQL；下载只报告已请求浏览器处理，不声称已保存。下载 MIME 为 application/sql;charset=utf-8，无 BOM，文件名仅由固定前缀、方言、模式组成，及时撤销对象 URL。全屏拒绝保留页面内工作区并报告 fallback。

## 隐私与边界

本工具无账号、密钥、API、数据库连接和运行时新增依赖。输入、分析、生成在当前浏览器；Worker 为打包的同源静态脚本。处理过程不调用 fetch、XHR、WebSocket、EventSource 或 Beacon。复制与本地 Blob 下载仅由用户操作触发，不将用户输入拼入 URL 或文件名。

不使用 localStorage、sessionStorage、IndexedDB、URL 参数、历史、结果缓存或数据恢复；不把输入、SQL、字段名、主键值和错误片段写入控制台或遥测。只用 value/textContent 渲染，不用 innerHTML、eval 或 Function。站点静态资源加载及既有语言/主题偏好不在上述工具数据边界内。页面和脚本加载完成后的离线转换可用，不承诺首次离线打开。

## 本次文件清单

新增：

- `src/pages/tools/dev/json-to-sql.astro`
- `src/pages/en/tools/dev/json-to-sql.astro`
- `src/pages/ja/tools/dev/json-to-sql.astro`
- `src/pages/ko/tools/dev/json-to-sql.astro`
- `src/pages/zh-hant/tools/dev/json-to-sql.astro`
- `src/components/JsonToSql.astro`
- `src/lib/json-to-sql.ts`
- `src/lib/json-to-sql-parser.ts`
- `src/lib/json-to-sql-i18n.ts`
- `src/scripts/json-to-sql.ts`
- `src/scripts/json-to-sql-worker.ts`
- `src/styles/json-to-sql.css`
- `data/tool-presentation/json-to-sql.json`
- `scripts/tests/json-to-sql.test.mjs`
- `scripts/tests/json-to-sql-presentation.test.mjs`
- `scripts/tests/json-to-sql-i18n.test.mjs`
- `scripts/lib/tool-cases/json-to-sql.mjs`
- `docs/JSON-TO-SQL.md`

修改：`src/lib/tools.ts`、`src/lib/tool-seo/dev.ts`、`src/lib/tool-content.ts`、`src/lib/tool-details.ts`、`src/lib/i18n/en.json`、`src/lib/i18n/ja.json`、`src/lib/i18n/ko.json`、`scripts/gen-search-index.mjs`、`tsconfig.tools.json`、`README.md`（只加入口）。

生成更新：`data/i18n-tool-pages.json`、`public/search-index.json`、`public/en/search-index.json`、`public/ja/search-index.json`、`public/ko/search-index.json`、`public/zh-hant/search-index.json`。

## 验证记录

本次已实际执行：

- `npx tsc -p tsconfig.tools.json`：通过。
- `node --test scripts/tests/json-to-sql.test.mjs`：通过；入口包含 20 个逻辑用例及 4 个 presentation/i18n 用例，未设置 skip/todo。
- `node scripts/gen-search-index.mjs`：已生成五语索引，简体/繁体各 82 项；英文/韩文/日文各 81 项（既有 vocab-flash 缺少这三语路由）。
- `node scripts/editorial/build-tool-locales.mjs`：已生成登记表，82 个工具；本工具五语齐全。
- `git diff --check`：通过。

逻辑测试包含三方言三模式确定输出、201 行分批、转义、精确整数、十进制范围、DDL 可空性、主键错误、三种嵌套、路径碰撞、混合类型、原型名称、CRLF/代理对定位、日期时区稳定及全部资源限制。presentation 测试调用仓库 schema/策略校验器，并禁止放宽主态文字和交互；还通过 Astro 编译器在内存中校验共享组件语法，此检查不替代完整构建。

浏览器用例在 `scripts/lib/tool-cases/json-to-sql.mjs`，由既有 runner 自动发现；包含五语核心流程、CSP、复制/下载、错误定位、移动端/深色、能力拒绝、迟到结果、取消、闲置/焦点、离线、三时区与跨午夜。处理中截图用例显式控制 Worker 回包，以检查实际加载 UI；不代表性能测量。截图只由 runner 真正执行时写入 artifacts。

依照本轮运行限制，未执行构建、smoke、全站浏览器门禁或数据库执行验证，也未生成截图、Reviewer 评分或发布结论。README 数量未手工修改，等待流水线确定性更新。Lead 后续运行：

```sh
node --test scripts/tests/json-to-sql*.test.mjs
npm run build
node scripts/smoke-tool.mjs --slug json-to-sql --category dev
npm run check:browser
node scripts/tool-pipeline/update-tool-counts.mjs --check
```
