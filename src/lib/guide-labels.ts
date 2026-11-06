/** 指南页面的本地化 UI 文案与分类名称。 */
import type { Lang } from './i18n';

export interface GuideLabels {
  /** 面包屑导航的 aria-label。 */
  breadcrumbAria: string;
  breadcrumbHome: string;
  breadcrumbGuides: string;
  /** 阅读时间单位；组件内以 `{readingMinutes} {minutesRead}` 渲染。 */
  minutesRead: string;
  published: string;
  updated: string;
  toc: string;
  focus: string;
  verify: string;
  local: string;
  focusFallback: string;
  faq: string;
  sources: string;
  backToTool: string;
  browseGuides: string;
  toolLinkPrefix: string;
  /** 图片链接的 aria-label（“查看大图”）。 */
  viewOriginal: string;
  clickEnlarge: string;
  /** 译文页跳转到简体原文的链接文字。 */
  readOriginal: string;
  translationNote: string;
  /** 生成“内容与验证”段落；返回可安全 set:html 的受信任本地 HTML。 */
  verifyText: (sources: number, date: string) => string;
  /** 指南列表页文案。 */
  indexTitle: string;
  indexDescription: string;
  indexJsonLdDescription: string;
  indexKeywords: string[];
  indexKicker: string;
  indexHeading: string;
  indexIntro: string;
  indexCount: (count: number) => string;
  indexUpdated: (date: string) => string;
  readGuide: string;
  openTool: string;
  indexListAria: string;
}

export const GUIDE_LABELS: Record<Lang, GuideLabels> = {
  zh: {
    breadcrumbAria: '面包屑',
    breadcrumbHome: '首页',
    breadcrumbGuides: '实用指南',
    minutesRead: '分钟阅读',
    published: '发布于',
    updated: '更新于',
    toc: '文章目录',
    focus: '本页重点',
    verify: '内容与验证',
    local: '输入内容在浏览器本地处理。请勿把真实密码、令牌或个人敏感信息当作示例提交。',
    focusFallback: '先看示例，再把步骤带回工具。结果用于生产系统前，请结合项目文档和测试环境复核。',
    faq: '常见问题',
    sources: '参考来源',
    backToTool: '返回工具',
    browseGuides: '浏览全部指南',
    toolLinkPrefix: '立即打开',
    viewOriginal: '查看大图',
    clickEnlarge: '点击图片可查看原图。',
    readOriginal: '查看简体原文',
    translationNote: '',
    verifyText: (sources, date) =>
      `本文按<a href="/editorial/">编辑与验证流程</a>维护：AI 辅助起草，经独立复核与自动化检查后发布；来源 ${sources} 条，最后验证日期 ${date}。发现错误可在联系页反馈。`,
    indexTitle: '实用指南',
    indexDescription:
      '围绕开发、日常和数据处理场景整理的在线工具使用指南，包含输入示例、排错步骤、适用边界与参考来源，读完可直接回到工具操作。',
    indexJsonLdDescription: '围绕开发、日常和数据处理场景整理的在线工具使用指南。',
    indexKeywords: ['在线工具教程', '开发工具指南', 'JSON教程', '时间戳教程'],
    indexKicker: 'CloverTools / KNOWLEDGE BASE',
    indexHeading: '把工具用明白',
    indexIntro: '从一个具体问题出发，解释输入、结果、限制和排错路径。每篇指南都对应一个可以立即使用的工具。',
    indexCount: (count) => `${count} 篇使用与排错说明`,
    indexUpdated: (date) => `最近内容更新 ${date}`,
    readGuide: '阅读指南',
    openTool: '打开工具',
    indexListAria: '指南列表',
  },
  tw: {
    breadcrumbAria: '麵包屑',
    breadcrumbHome: '首頁',
    breadcrumbGuides: '實用指南',
    minutesRead: '分鐘閱讀',
    published: '發佈於',
    updated: '更新於',
    toc: '文章目錄',
    focus: '本頁重點',
    verify: '內容與驗證',
    local: '輸入內容在瀏覽器本地處理。請勿把真實密碼、權杖或個人敏感資訊當作範例提交。',
    focusFallback: '先看範例，再把步驟帶回工具。結果用於生產系統前，請結合專案文件與測試環境複核。',
    faq: '常見問題',
    sources: '參考來源',
    backToTool: '返回工具',
    browseGuides: '瀏覽全部指南',
    toolLinkPrefix: '立即開啟',
    viewOriginal: '檢視大圖',
    clickEnlarge: '點擊圖片可檢視原圖。',
    readOriginal: '查看簡體原文',
    translationNote: '本頁為簡體中文原文的繁體轉換，內容以簡體原文為準。',
    verifyText: (sources, date) =>
      `本文按<a href="/editorial/">編輯與驗證流程</a>維護：AI 輔助起草，經獨立複核與自動化檢查後發佈；來源 ${sources} 條，最後驗證日期 ${date}。發現錯誤可在聯絡頁回饋。`,
    indexTitle: '實用指南',
    indexDescription:
      '圍繞開發、日常和資料處理情境整理的線上工具使用指南，包含輸入範例、排錯步驟、適用邊界與參考來源，讀完可直接回到工具操作。',
    indexJsonLdDescription: '圍繞開發、日常和資料處理情境整理的線上工具使用指南。',
    indexKeywords: ['線上工具教學', '開發工具指南', 'JSON 教學', '時間戳教學'],
    indexKicker: 'CloverTools / KNOWLEDGE BASE',
    indexHeading: '把工具用明白',
    indexIntro: '從一個具體問題出發，解釋輸入、結果、限制和排錯路徑。每篇指南都對應一個可以立即使用的工具。',
    indexCount: (count) => `${count} 篇使用與排錯說明`,
    indexUpdated: (date) => `最近內容更新 ${date}`,
    readGuide: '閱讀指南',
    openTool: '開啟工具',
    indexListAria: '指南列表',
  },
  en: {
    breadcrumbAria: 'Breadcrumb',
    breadcrumbHome: 'Home',
    breadcrumbGuides: 'Practical guides',
    minutesRead: 'min read',
    published: 'Published',
    updated: 'Updated',
    toc: 'On this page',
    focus: 'Key points',
    verify: 'Content & verification',
    local: 'Input is processed locally in your browser. Do not submit real passwords, tokens, or personal data as examples.',
    focusFallback:
      'Try the example first, then take the steps back to the tool. Before using results in a production system, cross-check with your project documentation and a test environment.',
    faq: 'FAQ',
    sources: 'Sources',
    backToTool: 'Back to tool',
    browseGuides: 'Browse all guides',
    toolLinkPrefix: 'Open',
    viewOriginal: 'View full image',
    clickEnlarge: 'Click the image to view the original.',
    readOriginal: 'View the Simplified Chinese original',
    translationNote: 'This page is an automated translation of the Simplified Chinese original; the Chinese version is authoritative.',
    verifyText: (sources, date) =>
      `This article is maintained through our <a href="/editorial/">editorial and verification process</a>: AI-assisted drafting, independent review, and automated checks before publishing; ${sources} sources, last verified ${date}. Report errors on the contact page.`,
    indexTitle: 'Practical guides',
    indexDescription:
      'Practical online tool guides for development, everyday tasks and data handling, with examples, troubleshooting steps, limits and sources.',
    indexJsonLdDescription: 'Online tool guides for development, everyday tasks, and data handling.',
    indexKeywords: ['online tool tutorials', 'developer tool guides', 'JSON tutorial', 'timestamp tutorial'],
    indexKicker: 'CloverTools / KNOWLEDGE BASE',
    indexHeading: 'Get the most out of each tool',
    indexIntro:
      'Start from a concrete problem and see the inputs, results, limits, and troubleshooting path. Every guide maps to a tool you can use right away.',
    indexCount: (count) => `${count} guides and troubleshooting notes`,
    indexUpdated: (date) => `Last content update ${date}`,
    readGuide: 'Read guide',
    openTool: 'Open tool',
    indexListAria: 'Guide list',
  },
  ko: {
    breadcrumbAria: '현재 위치',
    breadcrumbHome: '홈',
    breadcrumbGuides: '실용 가이드',
    minutesRead: '분 읽기',
    published: '게시일',
    updated: '업데이트',
    toc: '목차',
    focus: '이 페이지의 핵심',
    verify: '내용 및 검증',
    local: '입력 내용은 브라우저에서 로컬로 처리됩니다. 실제 비밀번호, 토큰, 개인정보를 예시로 입력하지 마세요.',
    focusFallback:
      '먼저 예시를 확인한 뒤 그 단계를 도구로 가져가 보세요. 결과를 운영 시스템에 적용하기 전에 프로젝트 문서와 테스트 환경에서 다시 확인하세요.',
    faq: '자주 묻는 질문',
    sources: '참고 자료',
    backToTool: '도구로 돌아가기',
    browseGuides: '전체 가이드 보기',
    toolLinkPrefix: '지금 열기',
    viewOriginal: '큰 이미지 보기',
    clickEnlarge: '이미지를 클릭하면 원본을 볼 수 있습니다.',
    readOriginal: '중국어 원문 보기',
    translationNote: '이 페이지는 중국어 간체 원문을 자동 번역한 것입니다. 중국어 원문이 기준입니다.',
    verifyText: (sources, date) =>
      `이 글은 <a href="/editorial/">편집 및 검증 절차</a>에 따라 유지됩니다. AI 보조 초안을 독립적으로 검토하고 자동 검사를 거쳐 게시하며, 출처 ${sources}개, 마지막 검증일 ${date}입니다. 오류가 있으면 문의 페이지에서 알려 주세요.`,
    indexTitle: '실용 가이드',
    indexDescription:
      '개발, 일상, 데이터 처리 상황을 위한 온라인 도구 사용 가이드입니다. 입력 예시, 문제 해결 단계, 적용 한계, 참고 자료를 담아 읽고 바로 도구로 돌아갈 수 있습니다.',
    indexJsonLdDescription: '개발, 일상, 데이터 처리 상황을 위한 온라인 도구 사용 가이드입니다.',
    indexKeywords: ['온라인 도구 사용법', '개발 도구 가이드', 'JSON 사용법', '타임스탬프 사용법'],
    indexKicker: 'CloverTools / KNOWLEDGE BASE',
    indexHeading: '도구를 제대로 활용하기',
    indexIntro: '구체적인 문제에서 시작해 입력, 결과, 한계, 문제 해결 경로를 설명합니다. 모든 가이드는 바로 사용할 수 있는 도구와 연결됩니다.',
    indexCount: (count) => `${count}개의 사용 및 문제 해결 안내`,
    indexUpdated: (date) => `최근 콘텐츠 업데이트 ${date}`,
    readGuide: '가이드 읽기',
    openTool: '도구 열기',
    indexListAria: '가이드 목록',
  },
  ja: {
    breadcrumbAria: 'パンくずリスト',
    breadcrumbHome: 'ホーム',
    breadcrumbGuides: '実用ガイド',
    minutesRead: '分で読めます',
    published: '公開日',
    updated: '更新日',
    toc: '目次',
    focus: 'このページの要点',
    verify: '内容と検証',
    local: '入力内容はブラウザ内でローカルに処理されます。実際のパスワード、トークン、個人情報を例として入力しないでください。',
    focusFallback:
      'まず例を確認し、その手順をツールに戻して試してください。本番環境で結果を使う前に、プロジェクトのドキュメントとテスト環境で再確認してください。',
    faq: 'よくある質問',
    sources: '参考資料',
    backToTool: 'ツールに戻る',
    browseGuides: 'すべてのガイドを見る',
    toolLinkPrefix: '今すぐ開く',
    viewOriginal: '大きな画像を見る',
    clickEnlarge: '画像をクリックすると原図を表示します。',
    readOriginal: '簡体字の原文を見る',
    translationNote: 'このページは簡体字中国語の原文を自動翻訳したものです。中国語の原文が正式な内容です。',
    verifyText: (sources, date) =>
      `この記事は<a href="/editorial/">編集と検証のプロセス</a>に沿って維持されています。AI 支援で下書きし、独立したレビューと自動チェックを経て公開しています。出典は ${sources} 件、最終検証日は ${date} です。誤りがあればお問い合わせページからご連絡ください。`,
    indexTitle: '実用ガイド',
    indexDescription:
      '開発、日常、データ処理の場面に向けたオンラインツールの使い方ガイドです。入力例、トラブルシューティング手順、適用範囲、参考資料をまとめ、読んだあとすぐツールに戻れます。',
    indexJsonLdDescription: '開発、日常、データ処理の場面に向けたオンラインツールの使い方ガイドです。',
    indexKeywords: ['オンラインツール 使い方', '開発ツール ガイド', 'JSON チュートリアル', 'タイムスタンプ チュートリアル'],
    indexKicker: 'CloverTools / KNOWLEDGE BASE',
    indexHeading: 'ツールを使いこなす',
    indexIntro:
      '具体的な課題から始め、入力、結果、制限、トラブルシューティングの道筋を説明します。どのガイドも、すぐに使えるツールに対応しています。',
    indexCount: (count) => `${count} 件の使い方とトラブルシューティング`,
    indexUpdated: (date) => `最終コンテンツ更新 ${date}`,
    readGuide: 'ガイドを読む',
    openTool: 'ツールを開く',
    indexListAria: 'ガイド一覧',
  },
};

/** 现有 9 个中文分类的本地化名称；未知分类回退原文。 */
export const CATEGORY_LABELS: Record<Lang, Record<string, string>> = {
  zh: {
    开发实用: '开发实用',
    日常实用: '日常实用',
    趣味工具: '趣味工具',
    接口排错: '接口排错',
    手作与图像: '手作与图像',
    日常排查: '日常排查',
    专注与练习: '专注与练习',
    媒体处理: '媒体处理',
    写作与文档: '写作与文档',
  },
  tw: {
    开发实用: '開發實用',
    日常实用: '日常實用',
    趣味工具: '趣味工具',
    接口排错: '介面排錯',
    手作与图像: '手作與圖像',
    日常排查: '日常排查',
    专注与练习: '專注與練習',
    媒体处理: '媒體處理',
    写作与文档: '寫作與文件',
  },
  en: {
    开发实用: 'Development',
    日常实用: 'Everyday',
    趣味工具: 'Fun',
    接口排错: 'API debugging',
    手作与图像: 'Crafts & images',
    日常排查: 'Everyday troubleshooting',
    专注与练习: 'Focus & practice',
    媒体处理: 'Media',
    写作与文档: 'Writing & docs',
  },
  ko: {
    开发实用: '개발',
    日常实用: '일상',
    趣味工具: '재미',
    接口排错: 'API 문제 해결',
    手作与图像: '공예와 이미지',
    日常排查: '일상 문제 해결',
    专注与练习: '집중과 연습',
    媒体处理: '미디어 처리',
    写作与文档: '글쓰기와 문서',
  },
  ja: {
    开发实用: '開発',
    日常实用: '日常',
    趣味工具: 'お楽しみ',
    接口排错: 'API トラブルシューティング',
    手作与图像: '工作と画像',
    日常排查: '日常のトラブルシューティング',
    专注与练习: '集中と練習',
    媒体处理: 'メディア処理',
    写作与文档: '文章とドキュメント',
  },
};

/** 把现有中文分类名映射到目标语言；缺失时保留原文。 */
export function categoryLabel(category: string, lang: Lang): string {
  return CATEGORY_LABELS[lang]?.[category] ?? category;
}
