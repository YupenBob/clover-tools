export interface ToolContent {
  usage: string;
  features: { icon: string; text: string }[];
}

/**
 * 每个工具页「使用说明」区的手写内容（事实性、非宣传、无 emoji）。
 * 约定：工具 UI 定稿后，tools.ts 元数据与本文件内容必须同批更新。
 */
export const TOOL_CONTENT: Record<string, ToolContent> = {
  'json-formatter': {
    usage:
      '在线 JSON 格式化与校验工具：粘贴 JSON 后自动美化排版，支持压缩输出与缩进自定义；语法错误会定位到具体行号，方便快速排查接口返回与配置文件问题。所有处理都在浏览器本地完成，数据不会上传。',
    features: [
      { icon: 'bi-braces', text: '一键格式化与压缩' },
      { icon: 'bi-bug', text: '语法错误定位到行号' },
      { icon: 'bi-sliders', text: '缩进宽度自定义' },
      { icon: 'bi-shield-lock', text: '纯浏览器处理，不泄露数据' },
    ],
  },
  'json-convert': {
    usage:
      '把 JSON 数组快速转为 CSV 或 Excel 表格，常用于接口数据导出、报表整理与数据迁移。支持自定义表头与字段顺序，生成结果可直接下载或复制，转换全程在浏览器本地完成。',
    features: [
      { icon: 'bi-table', text: 'JSON 数组转 CSV / Excel' },
      { icon: 'bi-arrow-down-up', text: '表头与字段顺序可定制' },
      { icon: 'bi-download', text: '结果一键下载' },
      { icon: 'bi-shield-lock', text: '本地转换，数据不出浏览器' },
    ],
  },
  'json-codegen': {
    usage:
      '根据一段 JSON 示例数据自动生成 TypeScript 接口、Go Struct、Java 实体类与 C# 模型，减少手写类型定义的工作量，适合前后端联调时快速对齐数据结构。',
    features: [
      { icon: 'bi-file-code', text: '支持 TS / Go / Java / C#' },
      { icon: 'bi-diagram-3', text: '嵌套对象自动递归生成' },
      { icon: 'bi-type', text: '字段命名风格可配置' },
      { icon: 'bi-clipboard-check', text: '一键复制生成结果' },
    ],
  },
  'json-xml-yaml': {
    usage:
      'JSON、XML、YAML 三种数据格式相互转换，适合接口数据迁移、配置文件转换与文档整理。转换保留原有结构与层次，支持缩进自定义，全部在浏览器本地完成。',
    features: [
      { icon: 'bi-arrow-left-right', text: 'JSON / XML / YAML 三向互转' },
      { icon: 'bi-stack', text: '结构层次完整保留' },
      { icon: 'bi-sliders', text: '缩进与格式可配置' },
      { icon: 'bi-shield-lock', text: '本地转换，数据安全' },
    ],
  },
  jsonpath: {
    usage:
      '在线 JSONPath 表达式测试器：输入 JSON 数据与表达式，实时高亮匹配结果，支持 $、点号、数组下标、通配符与过滤条件等常见语法，是接口调试与数据提取的常用辅助工具。',
    features: [
      { icon: 'bi-search', text: '表达式实时匹配高亮' },
      { icon: 'bi-collection', text: '支持常见 JSONPath 语法' },
      { icon: 'bi-list-check', text: '匹配数量与结果统计' },
      { icon: 'bi-shield-lock', text: '数据仅在本地解析' },
    ],
  },
  diff: {
    usage:
      '两段文本逐行差异对比工具，适合配置、代码与 JSON 内容比对。差异以行内高亮展示，并统计增删改数量，帮助在合并冲突或内容审查时快速定位变化。',
    features: [
      { icon: 'bi-file-diff', text: '逐行差异对比' },
      { icon: 'bi-highlighter', text: '行内级别高亮' },
      { icon: 'bi-bar-chart', text: '增删改数量统计' },
      { icon: 'bi-shield-lock', text: '本地对比，内容不上传' },
    ],
  },
  base64: {
    usage:
      'Base64 编码与解码工具：正确处理 UTF-8 中文，支持 URL 安全模式与图片转 Base64 数据。适合处理接口 token、图片嵌入与简单文本转换，编解码全程在浏览器本地完成。',
    features: [
      { icon: 'bi-arrow-repeat', text: '编码与解码双向转换' },
      { icon: 'bi-globe2', text: 'UTF-8 中文与 URL 安全模式' },
      { icon: 'bi-image', text: '图片转 Base64 数据' },
      { icon: 'bi-shield-lock', text: '本地处理，不上传内容' },
    ],
  },
  'url-encode': {
    usage:
      'URL 编码与解码工具：正确处理中文与特殊字符，避免中文链接在请求中乱码。支持完整组件与查询参数两种模式，适合接口调用、前端开发与参数调试。',
    features: [
      { icon: 'bi-link-45deg', text: 'URL 编码与解码' },
      { icon: 'bi-globe2', text: '中文与特殊字符正确处理' },
      { icon: 'bi-input-cursor', text: '完整组件 / 查询参数双模式' },
      { icon: 'bi-arrow-repeat', text: '实时双向转换' },
    ],
  },
  'html-formatter': {
    usage:
      'HTML 格式化与压缩工具，附带 HTML 实体编码解码，适合邮件模板、富文本内容与页面源码的处理。粘贴源码即可一键整理缩进或压缩体积。',
    features: [
      { icon: 'bi-code-slash', text: '格式化与压缩切换' },
      { icon: 'bi-filetype-html', text: 'HTML 实体编码解码' },
      { icon: 'bi-arrows-collapse', text: '压缩体积便于传输' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'css-formatter': {
    usage:
      'CSS 格式化与压缩工具，附带 px、rem、em、vw 等常用单位换算，前端开发时调整样式、适配移动端或压缩样式文件更方便。',
    features: [
      { icon: 'bi-brush', text: '格式化与压缩' },
      { icon: 'bi-filetype-css', text: 'CSS 语法友好' },
      { icon: 'bi-rulers', text: 'px / rem / em / vw 换算' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'js-formatter': {
    usage:
      'JavaScript 代码格式化与压缩工具：支持 ES 现代语法与常用配置项，粘贴即可整理缩进、统一分号，快速得到可读性更好的代码。',
    features: [
      { icon: 'bi-filetype-js', text: '格式化与压缩' },
      { icon: 'bi-braces', text: '支持 ES 现代语法' },
      { icon: 'bi-gear', text: '常用配置项可调' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'sql-formatter': {
    usage:
      'SQL 格式化工具：支持 MySQL、PostgreSQL、SQL Server 等常见方言，把冗长的 SQL 整理成层次清晰的语句，方便阅读、审查与排查问题。',
    features: [
      { icon: 'bi-filetype-sql', text: '多数据库方言支持' },
      { icon: 'bi-database', text: '关键字与子句缩进对齐' },
      { icon: 'bi-list-ol', text: '语句层次一目了然' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'xml-formatter': {
    usage:
      'XML 格式化、压缩与校验工具：错误提示清晰，适合接口报文与配置文件的处理，帮助快速定位标签结构与转义问题。',
    features: [
      { icon: 'bi-filetype-xml', text: '格式化与压缩' },
      { icon: 'bi-check2-circle', text: '结构完整性校验' },
      { icon: 'bi-bug', text: '错误位置提示' },
      { icon: 'bi-shield-lock', text: '本地处理，内容安全' },
    ],
  },
  markdown: {
    usage:
      '成熟的 Markdown 在线编辑器：工具栏一键插入常用语法，分屏实时预览渲染效果，支持目录大纲、复制富文本与导出 Markdown/HTML，草稿自动保存在浏览器本地，刷新不丢失。',
    features: [
      { icon: 'bi-markdown', text: '工具栏快捷语法' },
      { icon: 'bi-layout-text-window', text: '分屏实时预览' },
      { icon: 'bi-card-list', text: '目录大纲导航' },
      { icon: 'bi-clipboard2-heart', text: '复制富文本到文档' },
      { icon: 'bi-save', text: '草稿自动本地保存' },
    ],
  },
  'regex-tester': {
    usage:
      '正则表达式在线测试器：输入表达式与待匹配文本，实时高亮所有匹配结果并展示捕获组，内置常用正则示例库，调试复杂表达式更直观。',
    features: [
      { icon: 'bi-search', text: '匹配结果实时高亮' },
      { icon: 'bi-collection', text: '捕获组完整展示' },
      { icon: 'bi-lightning-charge', text: '内置常用示例库' },
      { icon: 'bi-shield-lock', text: '文本仅在本地处理' },
    ],
  },
  'text-transform': {
    usage:
      '文本转换工具：大小写转换、驼峰与下划线互转、全角半角转换等，支持批量处理，粘贴即用，适合变量命名、文案整理与代码片段处理。',
    features: [
      { icon: 'bi-text-left', text: '大小写一键转换' },
      { icon: 'bi-arrow-repeat', text: '驼峰 / 下划线 / 连字符互转' },
      { icon: 'bi-fonts', text: '全角半角转换' },
      { icon: 'bi-magic', text: '批量处理粘贴即用' },
    ],
  },
  'text-toolbox': {
    usage:
      '文本批量处理工具箱：去重、排序、反转、去除空行、统计行数等常用操作，适合日志、名单与列表数据的快速清洗整理，全部在浏览器本地完成。',
    features: [
      { icon: 'bi-list-check', text: '按行去重与排序' },
      { icon: 'bi-trash', text: '去除空行与空白' },
      { icon: 'bi-bar-chart', text: '行数与字符统计' },
      { icon: 'bi-shield-lock', text: '本地处理，不上传内容' },
    ],
  },
  jianfan: {
    usage:
      '简体中文与繁体中文互转工具：正确处理多音字与地区用词差异，适合内容本地化、文档转换与繁体阅读场景，转换在浏览器本地即时完成。',
    features: [
      { icon: 'bi-arrow-left-right', text: '简繁双向互转' },
      { icon: 'bi-globe2', text: '多音字与地区用词处理' },
      { icon: 'bi-text-left', text: '整段文本批量转换' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  pinyin: {
    usage:
      '汉字转拼音工具：支持全拼、声调、首字母等多种输出模式，可用于搜索索引、URL 生成与姓名拼音转换，转换在浏览器本地完成。',
    features: [
      { icon: 'bi-type', text: '全拼 / 声调 / 首字母输出' },
      { icon: 'bi-keyboard', text: '多音字按语境选音' },
      { icon: 'bi-list-ol', text: '分隔符与大小写可配' },
      { icon: 'bi-shield-lock', text: '本地转换，数据安全' },
    ],
  },
  cron: {
    usage:
      'Cron 表达式解析与生成工具：实时展示下一次执行时间与调度日历，支持 5/6/7 段格式与常见特殊符号，是定时任务配置与调试的辅助工具。',
    features: [
      { icon: 'bi-clock-history', text: '解析并展示最近执行时间' },
      { icon: 'bi-calendar-week', text: '调度日历可视化' },
      { icon: 'bi-arrow-repeat', text: '5 / 6 / 7 段格式支持' },
      { icon: 'bi-terminal', text: '常用特殊符号提示' },
    ],
  },
  'base-converter': {
    usage:
      '数字进制互转工具：支持二进制、八进制、十进制、十六进制与补码表示，输入即时换算，附带常用进制对照，适合编程与网络学习场景。',
    features: [
      { icon: 'bi-calculator', text: '二 / 八 / 十 / 十六进制互转' },
      { icon: 'bi-grid', text: '补码与有符号表示' },
      { icon: 'bi-arrow-left-right', text: '输入即时换算' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'unicode-converter': {
    usage:
      'Unicode 与 ASCII 转换工具：中文转 \\u 编码、ASCII 码表查询与字符互转，适合 JSON 转义、字符编码调试与国际化开发。',
    features: [
      { icon: 'bi-arrow-repeat', text: '中文与 \\u 编码互转' },
      { icon: 'bi-list-ol', text: 'ASCII 码表查询' },
      { icon: 'bi-keyboard', text: '字符与编码双向转换' },
      { icon: 'bi-shield-lock', text: '本地处理，内容安全' },
    ],
  },
  hash: {
    usage:
      '在线 Hash 计算工具：支持 MD5、SHA-1、SHA-256、SHA-512、Keccak 以及文件哈希，全部在浏览器本地完成，文件内容不会上传到任何服务器。',
    features: [
      { icon: 'bi-hash', text: 'MD5 / SHA 系列 / Keccak' },
      { icon: 'bi-file-earmark', text: '文本与文件哈希' },
      { icon: 'bi-lightning-charge', text: '结果实时计算' },
      { icon: 'bi-shield-lock', text: '文件不出本地' },
    ],
  },
  'symmetric-encrypt': {
    usage:
      'AES、DES、RC4、Rabbit 等对称加密算法的加解密工具：支持多种填充模式与输出格式，适合本地验证加解密流程与调试接口数据，密钥与内容均在浏览器处理。',
    features: [
      { icon: 'bi-lock', text: 'AES / DES / RC4 / Rabbit' },
      { icon: 'bi-key', text: '密钥与 IV 可配置' },
      { icon: 'bi-sliders', text: '填充模式与输出格式可选' },
      { icon: 'bi-shield-check', text: '加解密均在本地' },
    ],
  },
  'rsa-encrypt': {
    usage:
      'RSA 密钥对生成与加解密工具：支持签名验签与 PEM 格式导入导出，可在浏览器本地生成密钥、加密解密文本，适合理解非对称加密原理与联调验证。',
    features: [
      { icon: 'bi-key-fill', text: '密钥对一键生成' },
      { icon: 'bi-lock-fill', text: '公钥加密 / 私钥解密' },
      { icon: 'bi-patch-check', text: '签名与验签' },
      { icon: 'bi-file-earmark-arrow-up', text: 'PEM 格式导入导出' },
    ],
  },
  bcrypt: {
    usage:
      'Bcrypt 密码哈希生成与校验工具：支持自定义轮数（cost factor），常用于后端密码存储与登录校验的联调验证，全部在浏览器本地计算，密码不会上传。',
    features: [
      { icon: 'bi-shield-lock', text: '密码哈希生成' },
      { icon: 'bi-check2-circle', text: '哈希与明文校验' },
      { icon: 'bi-sliders', text: 'cost 轮数可调' },
      { icon: 'bi-shield-check', text: '本地计算，密码安全' },
    ],
  },
  'jwt-decoder': {
    usage:
      'JWT 在线解码工具：解析 Header 与 Payload 并美化展示，支持 HS256 签名验签，适合调试登录态、接口鉴权与排查 token 问题。',
    features: [
      { icon: 'bi-window-stack', text: 'Header / Payload 分区解析' },
      { icon: 'bi-shield-check', text: 'HS256 签名验签' },
      { icon: 'bi-clock', text: '过期时间与签发时间提示' },
      { icon: 'bi-shield-lock', text: '本地解析，token 不泄露' },
    ],
  },
  'password-strength': {
    usage:
      '密码强度检测工具：从长度、字符组合、常见密码库等多维度评分，并给出改进建议，帮助设置更安全的密码，检测在浏览器本地完成。',
    features: [
      { icon: 'bi-shield-exclamation', text: '多维度强度评分' },
      { icon: 'bi-bar-chart', text: '常见弱密码库比对' },
      { icon: 'bi-lightbulb', text: '针对性改进建议' },
      { icon: 'bi-shield-lock', text: '本地检测，密码不上传' },
    ],
  },
  'password-generator': {
    usage:
      '随机密码生成器：可配置长度与字符集，基于密码学安全随机源生成强密码，支持排除易混淆字符，一键复制使用。',
    features: [
      { icon: 'bi-key', text: '长度与字符集可配置' },
      { icon: 'bi-dice-5', text: '密码学安全随机源' },
      { icon: 'bi-shuffle', text: '排除易混淆字符' },
      { icon: 'bi-clipboard-check', text: '一键复制' },
    ],
  },
  'uuid-generator': {
    usage:
      'UUID v4、v7 与 NanoID 批量生成工具：支持数量、大小写与分隔符设置，适合生成数据库主键、请求 ID 与唯一标识。',
    features: [
      { icon: 'bi-hash', text: 'UUID v4 / v7 / NanoID' },
      { icon: 'bi-collection', text: '批量生成多条' },
      { icon: 'bi-arrow-repeat', text: '大小写与分隔符设置' },
      { icon: 'bi-clipboard-check', text: '一键复制全部' },
    ],
  },
  qrcode: {
    usage:
      '在线二维码与条形码生成器：支持容错级别、颜色定制与 PNG 下载，可生成链接、文本、WiFi 信息等二维码，全部在浏览器本地生成。',
    features: [
      { icon: 'bi-qr-code', text: '二维码与条形码生成' },
      { icon: 'bi-sliders', text: '容错级别可调' },
      { icon: 'bi-palette', text: '颜色与尺寸定制' },
      { icon: 'bi-download', text: 'PNG 图片下载' },
    ],
  },
  'http-tester': {
    usage:
      'HTTP 接口测试工具：支持常用请求方法、请求头与 Body 配置，实时展示状态码、响应头与耗时，无需安装客户端即可调试接口。',
    features: [
      { icon: 'bi-send', text: 'GET / POST 等常用方法' },
      { icon: 'bi-arrow-left-right', text: '请求头与 Body 配置' },
      { icon: 'bi-activity', text: '状态码与耗时展示' },
      { icon: 'bi-speedometer2', text: '响应结果格式化' },
    ],
  },
  'ip-lookup': {
    usage:
      'IP 地址查询与解析工具：本机 IP 使用 Cloudflare 边缘信息实时获取；输入任意 IPv4/IPv6 可在线查询国家、运营商与经纬度，同时在本地计算地址分类、二进制/十六进制与 CIDR 网段。',
    features: [
      { icon: 'bi-globe2', text: '本机 IP 与任意 IP 查询' },
      { icon: 'bi-diagram-3', text: 'IPv4 / IPv6 统一解析' },
      { icon: 'bi-geo-alt', text: '属地、运营商与经纬度' },
      { icon: 'bi-rulers', text: 'CIDR 网段与进制计算' },
    ],
  },
  'ua-parser': {
    usage:
      'User-Agent 解析工具：从 UA 字符串中识别浏览器、操作系统与设备类型，适合排查访问日志、判断客户端环境与开发调试。',
    features: [
      { icon: 'bi-browser-chrome', text: '浏览器与版本识别' },
      { icon: 'bi-display', text: '操作系统识别' },
      { icon: 'bi-phone', text: '桌面 / 移动设备判断' },
      { icon: 'bi-shield-lock', text: '本地解析，无需上传' },
    ],
  },
  'url-parse': {
    usage:
      'URL 结构解析工具：拆分协议、域名、路径、查询参数与锚点，参数以表格清晰展示，适合前端调试、抓包分析与参数处理。',
    features: [
      { icon: 'bi-link-45deg', text: 'URL 各结构自动拆分' },
      { icon: 'bi-table', text: '查询参数表格化展示' },
      { icon: 'bi-arrow-left-right', text: '参数编码解码辅助' },
      { icon: 'bi-braces', text: '可生成查询字符串' },
    ],
  },
  'color-convert': {
    usage:
      '颜色格式转换工具：支持 HEX、RGB、HSL 互转与屏幕取色，实时预览色值与对比度，设计稿还原与前端开发配色更顺手。',
    features: [
      { icon: 'bi-eyedropper', text: 'HEX / RGB / HSL 互转' },
      { icon: 'bi-palette', text: '色值与预览实时同步' },
      { icon: 'bi-circle-half', text: '文本对比度参考' },
      { icon: 'bi-clipboard-check', text: '一键复制任意格式' },
    ],
  },
  'image-to-base64': {
    usage:
      '本地图片转 Base64 数据工具：支持压缩选项与多种输出格式，方便把图片嵌入代码、邮件与接口报文，图片全程在浏览器本地处理，不会上传。',
    features: [
      { icon: 'bi-image', text: '本地图片直接转换' },
      { icon: 'bi-sliders', text: '压缩质量可调' },
      { icon: 'bi-file-earmark-code', text: '多种输出格式' },
      { icon: 'bi-shield-lock', text: '图片不出本地' },
    ],
  },
  calendar: {
    usage:
      '在线万年历：公历农历对照展示，支持二十四节气、法定节假日与黄历信息查询，点击任意日期可查看当日宜忌、生肖、星座与五行，适合日常择日与时间规划。',
    features: [
      { icon: 'bi-calendar3', text: '公历农历对照日历' },
      { icon: 'bi-cloud-sun', text: '二十四节气与节假日' },
      { icon: 'bi-star', text: '黄历宜忌查询' },
      { icon: 'bi-keyboard', text: '方向键快捷翻月' },
    ],
  },
  'lunar-converter': {
    usage:
      '公历农历日期互转工具：支持农历闰月，可快速换算生日、纪念日与节假日对应的农历日期，转换在浏览器本地即时完成。',
    features: [
      { icon: 'bi-moon-stars', text: '公历转农历' },
      { icon: 'bi-sun', text: '农历转公历' },
      { icon: 'bi-calendar-event', text: '闰月正确换算' },
      { icon: 'bi-arrow-left-right', text: '双向即时转换' },
    ],
  },
  'world-clock': {
    usage:
      '世界时钟与时区转换工具：多城市时间对照、任意时区换算，出差协作、跨国会议与远程办公排期更清晰。',
    features: [
      { icon: 'bi-globe2', text: '多城市时间对照' },
      { icon: 'bi-clock', text: '任意时区换算' },
      { icon: 'bi-hourglass-split', text: '时差一键计算' },
      { icon: 'bi-shield-lock', text: '本地时间，隐私安全' },
    ],
  },
  'date-diff': {
    usage:
      '日期间隔计算工具：计算两个日期相差的天数、周数与月数，支持日期加减指定天数，适合合同期限、项目排期与倒计时规划。',
    features: [
      { icon: 'bi-calendar-range', text: '天数 / 周数 / 月数统计' },
      { icon: 'bi-arrow-left-right', text: '日期加减天数' },
      { icon: 'bi-check2-circle', text: '结果即时计算' },
      { icon: 'bi-shield-lock', text: '本地处理，无网络依赖' },
    ],
  },
  timestamp: {
    usage:
      'Unix 时间戳与日期时间互转工具：自动识别秒与毫秒，支持实时时钟与批量转换，是后端联调、日志排查与时间计算的常用工具。',
    features: [
      { icon: 'bi-clock-history', text: '时间戳与日期双向互转' },
      { icon: 'bi-stopwatch', text: '秒 / 毫秒自动识别' },
      { icon: 'bi-collection', text: '批量时间戳转换' },
      { icon: 'bi-arrow-left-right', text: '实时时钟对照' },
    ],
  },
  workday: {
    usage:
      '工作日计算器：排除周末与法定节假日，统计两个日期之间的实际工作日，附带调休安排，适合考勤、排班与项目工期计算。',
    features: [
      { icon: 'bi-calendar-check', text: '法定节假日数据' },
      { icon: 'bi-briefcase', text: '调休安排处理' },
      { icon: 'bi-bar-chart', text: '工作日与休息日统计' },
      { icon: 'bi-shield-lock', text: '本地计算，即时结果' },
    ],
  },
  'age-calculator': {
    usage:
      '年龄计算器：从出生日期精确计算周岁、虚岁与出生天数，支持实时更新，适合办理证件、报名登记与日常查询。',
    features: [
      { icon: 'bi-person', text: '周岁与虚岁计算' },
      { icon: 'bi-calendar-event', text: '出生天数统计' },
      { icon: 'bi-hourglass', text: '距离生日的天数提示' },
      { icon: 'bi-check2-circle', text: '结果实时刷新' },
    ],
  },
  timer: {
    usage:
      '在线倒计时与秒表工具：支持自定义时长、计时结束提醒与开始暂停，适合专注工作、运动训练与活动倒计时。',
    features: [
      { icon: 'bi-stopwatch', text: '倒计时与秒表切换' },
      { icon: 'bi-hourglass-split', text: '自定义时长' },
      { icon: 'bi-bell', text: '结束提醒' },
      { icon: 'bi-play-circle', text: '开始 / 暂停 / 重置' },
    ],
  },
  bmi: {
    usage:
      'BMI 体重指数计算器：根据身高体重计算指数并对照健康区间给出参考，附带体重范围建议，帮助了解自身体重状况。',
    features: [
      { icon: 'bi-heart-pulse', text: 'BMI 指数计算' },
      { icon: 'bi-graph-up', text: '健康区间对照' },
      { icon: 'bi-rulers', text: '单位切换（cm / m）' },
      { icon: 'bi-check2-circle', text: '参考建议说明' },
    ],
  },
  salary: {
    usage:
      '税后工资计算器：包含五险一金、个税明细，按城市比例配置，收入构成一目了然，适合求职谈薪与月度收入规划。',
    features: [
      { icon: 'bi-cash-stack', text: '税前税后双向计算' },
      { icon: 'bi-bank', text: '五险一金明细' },
      { icon: 'bi-calculator', text: '个税与专项附加' },
      { icon: 'bi-pie-chart', text: '收入构成可视化' },
    ],
  },
  finance: {
    usage:
      '理财计算器：支持贷款月供、复利收益与百分比计算，输入参数即可得到参考结果，适合购房贷款与理财收益的粗略测算。',
    features: [
      { icon: 'bi-graph-up', text: '贷款月供测算' },
      { icon: 'bi-piggy-bank', text: '复利收益计算' },
      { icon: 'bi-percent', text: '百分比与增长计算' },
      { icon: 'bi-bank', text: '利率与期限可配' },
    ],
  },
  calculator: {
    usage:
      '多功能计算器：支持四则运算、阶乘、幂、开方、质数判定与数列求和等常用数学函数，满足日常计算与学习需求。',
    features: [
      { icon: 'bi-calculator', text: '四则混合运算' },
      { icon: 'bi-123', text: '幂、开方与阶乘' },
      { icon: 'bi-arrow-repeat', text: '质数判定与数列求和' },
      { icon: 'bi-keyboard', text: '键盘输入支持' },
    ],
  },
  'unit-converter': {
    usage:
      '单位换算工具：覆盖长度、重量、温度、数据存储与时间等常用单位，转换精确即时，适合学习、设计与数据处理。',
    features: [
      { icon: 'bi-rulers', text: '长度 / 重量 / 温度' },
      { icon: 'bi-hdd', text: '数据存储单位' },
      { icon: 'bi-clock', text: '时间单位换算' },
      { icon: 'bi-arrow-left-right', text: '输入即时换算' },
    ],
  },
  'rmb-uppercase': {
    usage:
      '人民币金额大写转换工具：数字金额转换为中文大写，支持角分与负数处理，适合财务单据、合同与报销凭证填写。',
    features: [
      { icon: 'bi-currency-yen', text: '数字转中文大写' },
      { icon: 'bi-cash-coin', text: '角分正确处理' },
      { icon: 'bi-check2-circle', text: '负数与大写校验' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  fuel: {
    usage:
      '车辆油耗计算器：输入加油金额、油价与行驶里程，计算百公里油耗与每公里成本，帮助了解车辆油耗水平与出行成本。',
    features: [
      { icon: 'bi-fuel-pump', text: '百公里油耗计算' },
      { icon: 'bi-speedometer2', text: '每公里成本统计' },
      { icon: 'bi-car-front', text: '多段记录累计' },
      { icon: 'bi-cash', text: '金额与油量换算' },
    ],
  },
  expiry: {
    usage:
      '保质期计算工具：输入生产日期与保质期天数，自动计算到期日期并给出剩余天数，适合食品、药品与用品效期管理。',
    features: [
      { icon: 'bi-calendar-x', text: '到期日期自动计算' },
      { icon: 'bi-hourglass-bottom', text: '剩余天数实时提示' },
      { icon: 'bi-exclamation-triangle', text: '临期自动提醒' },
      { icon: 'bi-check2-circle', text: '结果即时刷新' },
    ],
  },
  'keyboard-test': {
    usage:
      '键盘按键测试工具：实时显示按键名称与编码，支持组合键检测，可快速排查键盘故障与按键冲突问题。',
    features: [
      { icon: 'bi-keyboard', text: '按键实时高亮' },
      { icon: 'bi-keyboard', text: '键名与编码显示' },
      { icon: 'bi-mouse', text: '组合键检测' },
      { icon: 'bi-exclamation-circle', text: '故障排查辅助' },
    ],
  },
  'grid-splitter': {
    usage:
      '九宫格切图工具：把一张图片按 3x3 网格切分并导出，适合朋友圈九宫格、社交媒体排版与素材切分，图片全程在浏览器本地处理。',
    features: [
      { icon: 'bi-grid-3x3', text: '3x3 九宫格切分' },
      { icon: 'bi-images', text: '单张与全部导出' },
      { icon: 'bi-scissors', text: '边缘裁剪微调' },
      { icon: 'bi-shield-lock', text: '图片不出本地' },
    ],
  },
  'sensitive-check': {
    usage:
      '敏感词检测工具：内置常用词库并支持自定义添加，命中位置高亮显示，适合内容发布前的自查与文本审核辅助，检测在浏览器本地完成。',
    features: [
      { icon: 'bi-shield-check', text: '内置常用词库' },
      { icon: 'bi-plus-lg', text: '自定义词库扩展' },
      { icon: 'bi-highlighter', text: '命中位置高亮' },
      { icon: 'bi-shield-lock', text: '本地检测，内容安全' },
    ],
  },
  zodiac: {
    usage:
      '生肖星座查询工具：输入出生日期查询生肖、星座、五行与守护信息，附带年份对照，适合趣味查询与个人资料填写。',
    features: [
      { icon: 'bi-stars', text: '生肖查询' },
      { icon: 'bi-moon', text: '星座查询' },
      { icon: 'bi-gem', text: '五行与守护信息' },
      { icon: 'bi-calendar3', text: '年份对照表' },
    ],
  },
  'ascii-art': {
    usage:
      'ASCII 艺术字生成器：三种生成方式——21 种 FIGlet 英文字体生成大字 Banner、中文与任意字符逐字采样生成像素画、上传图片转为字符画，支持 ANSI 终端彩色输出，全部在浏览器本地处理。',
    features: [
      { icon: 'bi-fonts', text: '21 种 FIGlet 英文字体' },
      { icon: 'bi-grid-3x3', text: '中文与任意字符像素画' },
      { icon: 'bi-image', text: '图片转字符画' },
      { icon: 'bi-terminal', text: 'ANSI 终端彩色输出' },
      { icon: 'bi-shield-lock', text: '全程本地处理' },
    ],
  },
  'click-speed': {
    usage:
      '点击速度测试工具：10 秒手速挑战，实时统计点击次数与 APM，结束后给出评级反馈，适合趣味比拼与鼠标手感测试。',
    features: [
      { icon: 'bi-cursor', text: '10 秒点击挑战' },
      { icon: 'bi-mouse', text: '次数与 APM 实时统计' },
      { icon: 'bi-trophy', text: '结束评级反馈' },
      { icon: 'bi-lightning-charge', text: '重试一键再来' },
    ],
  },
  'reaction-test': {
    usage:
      '反应力测试工具：等待颜色变化后尽快点击，测量反应时间毫秒值，支持多次测试取平均成绩，适合趣味自测与反应训练。',
    features: [
      { icon: 'bi-lightning-charge', text: '反应时间毫秒计时' },
      { icon: 'bi-stopwatch', text: '多次测试记录' },
      { icon: 'bi-graph-up', text: '平均成绩统计' },
      { icon: 'bi-trophy', text: '成绩评级' },
    ],
  },
  lottery: {
    usage:
      '年会抽奖转盘工具：支持导入名单、设置奖项数量与滚动抽奖，转轮运动经过精确规划，停点公平随机，适合年会、活动与课堂随机点名。',
    features: [
      { icon: 'bi-people', text: '名单批量导入' },
      { icon: 'bi-trophy', text: '奖项与数量设置' },
      { icon: 'bi-shuffle', text: '滚动抽奖动效' },
      { icon: 'bi-dice-5', text: '停点公平随机' },
    ],
  },
  'meme-generator': {
    usage:
      '表情包生成器：上传本地图片添加上下文字，支持字体与颜色调整后下载，图片全程本地处理，可快速制作分享用的表情包。',
    features: [
      { icon: 'bi-image', text: '本地图片上传' },
      { icon: 'bi-type', text: '上下文字添加' },
      { icon: 'bi-palette', text: '字体与颜色调整' },
      { icon: 'bi-download', text: '一键下载图片' },
    ],
  },
  'nickname-text': {
    usage:
      '个性昵称创意文字生成器：火星文、花体、斜体、粗体、空心体、德文花体、圈字、方块圈、上下标、镜像等 20 余种 Unicode 风格一键转换，适合游戏昵称、情侣网名与个性签名，纯浏览器本地生成。',
    features: [
      { icon: 'bi-stars', text: '20+ 种 Unicode 风格' },
      { icon: 'bi-type', text: '实时预览效果' },
      { icon: 'bi-magic', text: '一键复制转换' },
      { icon: 'bi-shield-lock', text: '本地生成，隐私安全' },
    ],
  },
  'random-number': {
    usage:
      '随机数生成工具：自定义最小值、最大值与数量，支持去重抽取，适合抽签、分组、游戏与测试数据生成，结果在浏览器本地随机生成。',
    features: [
      { icon: 'bi-shuffle', text: '范围与数量自定义' },
      { icon: 'bi-dice-6', text: '去重抽取' },
      { icon: 'bi-list-ol', text: '结果排序输出' },
      { icon: 'bi-clipboard-check', text: '一键复制结果' },
    ],
  },
  'palette-generator': {
    usage:
      '色板生成器：基于色彩理论自动生成和谐配色方案，支持复制色值与导出，适合设计选色、PPT 与界面配色参考。',
    features: [
      { icon: 'bi-palette', text: '自动生成和谐配色' },
      { icon: 'bi-eyedropper', text: '色值一键复制' },
      { icon: 'bi-grid', text: '多套方案切换' },
      { icon: 'bi-download', text: '导出色板' },
    ],
  },
  'browser-info': {
    usage:
      '浏览器信息检测工具：展示浏览器版本、操作系统、屏幕分辨率与设备信息，用于兼容性排查、数据上报与前端调试。',
    features: [
      { icon: 'bi-browser-chrome', text: '浏览器与版本识别' },
      { icon: 'bi-display', text: '操作系统信息' },
      { icon: 'bi-phone', text: '屏幕分辨率与设备' },
      { icon: 'bi-info-circle', text: '本地获取即时展示' },
    ],
  },
  'image-filter': {
    usage:
      '图片滤镜工具：上传图片应用灰度、模糊、复古、色相旋转等滤镜效果并下载，图片全程本地处理，适合快速处理分享图片。',
    features: [
      { icon: 'bi-brush', text: '多种滤镜效果' },
      { icon: 'bi-image', text: '实时预览对比' },
      { icon: 'bi-sliders', text: '强度参数可调' },
      { icon: 'bi-download', text: '一键下载成品' },
    ],
  },
  morse: {
    usage:
      '摩斯密码编解码工具：支持中英文与数字，实时翻译并附摩斯电码表，适合学习摩斯电码、趣味密文交流与通信原理演示。',
    features: [
      { icon: 'bi-broadcast', text: '文字与摩斯互转' },
      { icon: 'bi-keyboard', text: '中英文与数字支持' },
      { icon: 'bi-soundwave', text: '实时翻译预览' },
      { icon: 'bi-lightbulb', text: '摩斯电码表参考' },
    ],
  },
};
