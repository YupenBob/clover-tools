# JSON 转 SQL（json-to-sql）选题卡

## 用户与场景
后端/数据同学把 JSON 对象数组转成 INSERT/UPDATE/DDL，减少手写。与 `json-codegen`（TS/Go/Java/C#）互补，不做 ORM 代码。

## 核心功能
1. 输入 JSON 数组/单个对象；推断列名与类型（string/number/boolean/null/date-like）。
2. 输出：INSERT（多行）、UPDATE（按主键）、CREATE TABLE（可选）；方言 MySQL/PostgreSQL/SQLite（标识符引号/转义/布尔/日期差异）。
3. 表名/主键/批量大小可配置；嵌套对象/数组策略（JSON 字符串/展开/报错）。
4. 语法高亮或纯文本、复制/下载 .sql、示例、错误定位（行/列）。
5. 边界：空数组、混合类型、非法 JSON、超长、特殊字符/引号/反斜杠/Unicode、`null`；不执行 SQL。
6. 5 语言、移动端、深浅色、键盘。

## 数据与状态
`src/lib/json-to-sql.ts`：parse/infer/quote/emit；纯函数，独立单测。无网络、无存储（可选最近输入 localStorage，需清空）。

## 文件清单
`src/lib/json-to-sql.ts`、`src/lib/json-to-sql-i18n.ts`、`src/scripts/json-to-sql.ts`、`src/components/JsonToSql.astro`、5 薄路由、集成文件、单测、浏览器用例、`docs/JSON-TO-SQL.md`。

## 测试
单测：类型推断、转义（'、"、\、换行、Unicode）、null/布尔/日期、方言差异、嵌套策略、空/非法输入。浏览器：5 语言、示例、复制/下载、非法 JSON 错误、360px、深色、CSP。

## 验收/SEO
通用门禁；Reviewer ≥0.8；不新增依赖。SEO：JSON 转 SQL、JSON 生成 INSERT、JSON 转建表语句。与 json-codegen/json-convert 内链。
