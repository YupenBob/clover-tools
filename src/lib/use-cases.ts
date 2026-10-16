export const USE_CASES = [
  {
    slug: "clover-bead-pattern",
    toolSlug: "perler-beads",
    title: "把一张四叶草小图做成可照着拼的图纸",
    description:
      "从原创 32×32 透明像素图开始，生成带坐标和色号的拼豆图纸，逐色核对 512 颗豆子的用量，并下载源图、图纸与清单复现。",
    summary: "32×32 网格 · 4 色 · 512 颗",
    toolHref: "/tools/fun/perler-beads/",
    image: "/examples/clover-chart.png",
    imageAlt: "实际导出的四叶草拼豆图纸，含网格坐标、色号和用量",
    downloads: [
      ["clover-source.png", "下载原始像素图（PNG）"],
      ["clover-chart.png", "下载编号图纸（PNG）"],
      ["clover-materials.csv", "下载逐色用量（CSV）"],
    ],
    steps: [
      "打开拼豆工具，点击“示例”恢复内置四叶草；也可上传本页的原始像素图。",
      "把最长边设为 32 豆，使用自动取色，颜色上限设为 8。源图只有四种非透明颜色，因此结果为 4 色。",
      "确认总数为 512，打开编号后下载图纸；对照清单准备豆子，再按坐标逐格拼放。",
    ],
    limits: [
      "编号 01–04 只属于这张图，不是任何品牌的商品色号。请把 HEX 色块与实际豆色核对。",
      "透明区域不放豆，屏幕颜色与实物会有差别。这份样例只核对了图纸和用量，熨烫方式请按豆子品牌的说明操作。",
      "照片和细线素材缩小到 32 格后会损失细节；先观察主体轮廓，再决定增加格数还是手动简化。",
    ],
  },
  {
    slug: "repeatable-avatar",
    toolSlug: "avatar-generator",
    title: "做一个下次还能生成相同结果的机器人头像",
    description:
      "使用固定种子 Clover 和公开配色生成原创机器人头像，下载 512 像素 PNG 与矢量 SVG，了解可复现、透明背景与不同画风的边界。",
    summary: "固定种子 Clover · PNG 与 SVG",
    toolHref: "/tools/fun/avatar-generator/",
    image: "/examples/clover-avatar.png",
    imageAlt: "种子 Clover、暖金配色与圆形外框实际生成的机器人头像",
    downloads: [
      ["clover-avatar.png", "下载 512×512 头像（PNG）"],
      ["clover-avatar.svg", "下载矢量头像（SVG）"],
    ],
    steps: [
      "打开头像工具，点“重置”，将种子设为 Clover，选择机器人画风。",
      "角色色为 #E6AD62，背景为 #F6EDDD，外框选圆形；关闭透明背景，导出尺寸选 512。",
      "对照本页预览，分别下载 PNG 和 SVG；把种子与这组设置一起保存，下次按同样设置恢复。",
    ],
    limits: [
      "相同种子只有在画风、颜色、外框和实现版本相同时才保证相同结果；种子本身不包含整套设置。",
      "选择透明背景后，下载的是另一版头像，不会与本页带底色样例逐像素相同。",
      "图案由本站几何绘图规则生成，不使用知名动画角色素材；它不是商标查重或独占权证明。",
    ],
  },
  {
    slug: "nested-json-to-csv",
    toolSlug: "json-convert",
    title: "把带嵌套字段的订单样例导成不会错列的 CSV",
    description:
      "用两条自建订单样例复现 JSON 到 CSV 的导出，检查缺失字段、嵌套对象、中文与逗号转义，并对照可下载的输入和实际输出。",
    summary: "2 条演示记录 · 5 列 · 嵌套值保留",
    toolHref: "/tools/dev/json-convert/?example=nested-orders",
    image: null,
    imageAlt: "",
    downloads: [
      ["nested-orders.json", "下载演示输入（JSON）"],
      ["nested-orders.csv", "下载实际导出（CSV）"],
    ],
    steps: [
      "通过“载入示例并打开工具”进入，输入框会填入本页两条演示记录；数据不是实际客户订单。",
      "保持逗号 CSV 和首行表头选项，点击“生成表格”。两条记录合并得到 order、item、quantity、profile、note 五列。",
      "下载 CSV 后，在表格软件中用 UTF-8 导入，并将 order 列指定为文本，以保留 000123 这样的前导零。",
    ],
    limits: [
      "profile 不会自动展开为 profile.city，它作为 JSON 文本保留在一个单元格里。需要拆列时应先整理源数据。",
      "第一条记录没有 note，第二条没有 profile，缺失的位置应为空，不能让后续字段左移。",
      "工具导出 CSV 或 TSV，不输出 XLSX。CSV 没有强制列类型的机制，Excel 自动识别仍可能改变编号。",
    ],
  },
] as const;

export function caseForTool(slug: string) {
  return USE_CASES.find((item) => item.toolSlug === slug);
}
