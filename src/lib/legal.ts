import { LEGAL } from '../../config/site.mjs';
import type { Lang } from './i18n';

export type LegalKind = 'privacy' | 'terms' | 'contact';

export function getLegalContent(kind: LegalKind, lang: Lang) {
  const privacyCopy = {
    zh: {
      title: '隐私政策',
      desc: '了解 CloverTools 的浏览器本地处理、网络请求、技术日志和第三方广告服务，以及清空输入和反馈隐私问题的方式。',
      lead: 'CloverTools 尽量让工具在你的浏览器中完成工作。本文说明站点页面、工具输入和第三方资源的处理边界。',
      sections: [
        [
          '本地工具处理',
          'JSON、文本、图片、编码和计算类工具默认在当前浏览器中运行。输入内容不会因为使用工具而写入 CloverTools 的业务数据库；下载文件由浏览器直接保存到你的设备。',
        ],
        [
          '必要的技术信息',
          '为提供页面、缓存、错误排查和安全防护，托管服务可能处理请求时间、IP、浏览器类型和响应状态等技术日志。我们不通过工具输入建立个人画像。',
        ],
        [
          '第三方服务',
          '站点可能加载 Google AdSense、Cloudflare 或字体等第三方资源。第三方服务会按其自己的隐私政策处理请求；广告和地区同意设置以页面实际提示为准。',
        ],
        [
          '你的选择',
          '你可以关闭页面、清空输入、阻止第三方 Cookie 或停止使用站点。需要报告数据处理问题时，请通过联系我们页面提交说明。',
        ],
      ],
    },
    en: {
      title: 'Privacy policy',
      desc: 'Learn how CloverTools handles local input, network requests, technical logs and third-party services, and how to report privacy concerns.',
      lead: 'CloverTools is designed to do most tool work in your browser. This page explains the boundaries for page requests, tool input, and third-party resources.',
      sections: [
        [
          'Local processing',
          'JSON, text, image, encoding, and calculator tools normally run in your current browser. Tool input is not written to a CloverTools business database because you used a tool; downloaded files are saved by your browser.',
        ],
        [
          'Technical information',
          'Hosting and security services may process request time, IP address, browser type, and response status for delivery, caching, debugging, and abuse prevention. We do not build a profile from tool input.',
        ],
        [
          'Third-party services',
          'Pages may load Google AdSense, Cloudflare, fonts, or other third-party resources. Those services process requests under their own policies; consent and advertising settings depend on the notice shown to you.',
        ],
        [
          'Your choices',
          'You can close a page, clear input, block third-party cookies, or stop using the site. Use the contact page to report a privacy concern.',
        ],
      ],
    },
    tw: {
      title: '隱私政策',
      desc: '了解 CloverTools 的瀏覽器本地處理、網路請求、技術日誌與第三方廣告服務，以及清空輸入和回報隱私問題的方式。',
      lead: 'CloverTools 儘量讓工具在你的瀏覽器中完成工作。本文說明頁面請求、工具輸入與第三方資源的處理界線。',
      sections: [
        [
          '本地工具處理',
          'JSON、文字、圖片、編碼與計算類工具預設在目前瀏覽器中執行。輸入內容不會因使用工具而寫入 CloverTools 業務資料庫；下載檔案由瀏覽器直接儲存。',
        ],
        [
          '必要技術資訊',
          '託管與安全服務可能處理請求時間、IP、瀏覽器類型與回應狀態，用於提供頁面、快取、除錯與防濫用。我們不依工具輸入建立個人輪廓。',
        ],
        [
          '第三方服務',
          '頁面可能載入 Google AdSense、Cloudflare 或字型等第三方資源，相關請求依其隱私政策處理。',
        ],
        [
          '你的選擇',
          '你可以關閉頁面、清除輸入或停止使用本站；隱私問題可透過聯絡頁面回報。',
        ],
      ],
    },
    ko: {
      title: '개인정보처리방침',
      desc: 'CloverTools의 브라우저 입력 처리, 네트워크 요청, 기술 로그와 제3자 서비스를 알아보고 개인정보 문제를 신고하는 방법을 확인하세요.',
      lead: 'CloverTools는 대부분의 도구 작업을 브라우저에서 처리하도록 설계되었습니다.',
      sections: [
        [
          '브라우저 내 처리',
          'JSON, 텍스트, 이미지, 인코딩 및 계산 도구는 일반적으로 현재 브라우저에서 실행됩니다. 도구 입력을 CloverTools 업무 데이터베이스에 저장하지 않습니다.',
        ],
        [
          '기술 정보',
          '호스팅 및 보안 서비스는 페이지 제공과 보안을 위해 요청 시간, IP, 브라우저 종류와 상태를 처리할 수 있습니다.',
        ],
        [
          '제3자 서비스',
          'Google AdSense, Cloudflare, 글꼴 등 제3자 리소스가 로드될 수 있으며 각 서비스의 정책이 적용됩니다.',
        ],
        [
          '사용자 선택',
          '페이지를 닫거나 입력을 삭제할 수 있습니다. 개인정보 문의는 연락처 페이지를 이용해 주세요.',
        ],
      ],
    },
    ja: {
      title: 'プライバシーポリシー',
      desc: 'CloverTools のブラウザ内入力処理、ネットワーク通信、技術ログ、第三者サービスと、プライバシーの問題を連絡する方法を説明します。',
      lead: 'CloverTools は多くの処理をブラウザ内で行うよう設計されています。',
      sections: [
        [
          'ブラウザ内処理',
          'JSON、テキスト、画像、エンコード、計算ツールは通常ブラウザ内で動作します。入力内容を業務データベースに保存しません。',
        ],
        [
          '技術情報',
          '配信、キャッシュ、障害対応と安全対策のため、ホスティングサービスがリクエスト時刻、IP、ブラウザ種類、状態を処理する場合があります。',
        ],
        [
          '第三者サービス',
          'Google AdSense、Cloudflare、フォントなどが読み込まれることがあります。各サービスのポリシーが適用されます。',
        ],
        [
          '選択肢',
          'ページを閉じる、入力を消去する、利用を停止することができます。プライバシーに関する連絡はお問い合わせページからお願いします。',
        ],
      ],
    },
  }[lang];

  const genericCopy = {
    zh: {
      title: '使用条款',
      desc: '了解 CloverTools 在线工具的服务范围、合理使用规则、结果复核要求和内容署名约定，使用前请确认工具适合你的场景。',
      lead: '使用 CloverTools 即表示你理解并同意以下使用边界。工具提供的是一般信息和计算结果，不构成专业建议。',
      sections: [
        [
          '服务范围',
          'CloverTools 提供免费的浏览器工具和配套说明，功能可能随浏览器、输入格式和站点维护而变化。',
        ],
        [
          '合理使用',
          '请遵守适用法律和第三方服务规则，不要利用工具进行未授权访问、欺诈、骚扰或处理你无权处理的数据。',
        ],
        [
          '免责声明',
          '工具结果应由你自行复核。涉及财务、健康、安全、合规或生产系统的决定，必须以专业人士、正式文档和测试环境为准。',
        ],
        [
          '知识产权',
          '站点代码、品牌和原创内容受适用法律保护。引用或再利用内容时请保留来源，并不要误导他人认为其来自你的原创。',
        ],
      ],
    },
    tw: {
      title: '使用條款',
      desc: '了解 CloverTools 線上工具的服務範圍、合理使用規則、結果複核要求與內容署名約定，使用前請確認工具適合你的情境。',
      lead: '使用 CloverTools 即表示你理解並同意以下使用界線。工具結果不構成專業建議。',
      sections: [
        [
          '服務範圍',
          'CloverTools 提供免費瀏覽器工具與說明，功能可能因瀏覽器、輸入格式與維護而變動。',
        ],
        [
          '合理使用',
          '請遵守適用法律與第三方規則，不要用於未授權存取、欺詐、騷擾或處理無權處理的資料。',
        ],
        [
          '免責聲明',
          '工具結果需由你自行複核；財務、健康、安全與合規決定應依專業人士與正式文件。',
        ],
        [
          '智慧財產',
          '本站程式碼、品牌與原創內容受法律保護，引用時請保留來源。',
        ],
      ],
    },
    en: {
      title: 'Terms of use',
      desc: 'Read the service scope, acceptable use, result review requirements and attribution rules for CloverTools browser tools and original content.',
      lead: 'By using CloverTools, you agree to these boundaries. Tool output is general information and is not professional advice.',
      sections: [
        [
          'Service scope',
          'CloverTools provides free browser tools and supporting explanations. Features may change with browsers, input formats, and maintenance.',
        ],
        [
          'Acceptable use',
          'Follow applicable law and third-party rules. Do not use the site for unauthorized access, fraud, harassment, or data you do not have the right to process.',
        ],
        [
          'Disclaimer',
          'Review results yourself. Decisions involving finance, health, safety, compliance, or production systems require qualified advice, formal documentation, and testing.',
        ],
        [
          'Intellectual property',
          'Site code, branding, and original content are protected by applicable law. Preserve attribution when reusing content.',
        ],
      ],
    },
    ko: {
      title: '이용약관',
      desc: 'CloverTools 브라우저 도구와 원본 콘텐츠의 서비스 범위, 올바른 사용 규칙, 결과 검토 및 출처 표기 안내를 확인하세요.',
      lead: 'CloverTools를 사용하면 다음 이용 범위를 이해하고 동의한 것으로 봅니다. 도구 결과는 전문적인 조언이 아닙니다.',
      sections: [
        [
          '서비스 범위',
          'CloverTools는 무료 브라우저 도구와 설명을 제공합니다. 브라우저와 입력 형식에 따라 기능이 달라질 수 있습니다.',
        ],
        [
          '합리적 사용',
          '관련 법률과 제3자 규칙을 준수하고 무단 접근, 사기, 괴롭힘 또는 권한 없는 데이터 처리에 사용하지 마세요.',
        ],
        [
          '면책',
          '결과는 직접 검토해야 하며 금융, 건강, 안전, 규제 및 운영 결정은 전문가와 공식 문서를 따르세요.',
        ],
        [
          '지식재산',
          '사이트 코드, 브랜드와 원본 콘텐츠는 법의 보호를 받습니다. 재사용 시 출처를 남겨 주세요.',
        ],
      ],
    },
    ja: {
      title: '利用規約',
      desc: 'CloverTools のブラウザツールと独自コンテンツについて、サービスの範囲、適正利用、結果の確認と出典表記の案内を確認できます。',
      lead: 'CloverTools を利用することで、以下の範囲に同意したものとします。結果は専門的助言ではありません。',
      sections: [
        [
          'サービス範囲',
          'CloverTools は無料のブラウザツールと説明を提供します。ブラウザや入力形式により動作が変わる場合があります。',
        ],
        [
          '適正利用',
          '適用される法律と第三者の規則を守り、無断アクセス、詐欺、嫌がらせ、権限のないデータ処理に利用しないでください。',
        ],
        [
          '免責',
          '結果はご自身で確認してください。金融、健康、安全、法令、運用に関する判断は専門家と公式資料を優先してください。',
        ],
        [
          '知的財産',
          'コード、ブランド、オリジナルコンテンツは法令で保護されています。再利用時は出典を残してください。',
        ],
      ],
    },
  }[lang];

  const contactCopy = {
    zh: {
      title: '联系我们',
      desc: '向 CloverTools 反馈工具错误、内容建议和隐私问题，了解应提供的页面地址、复现步骤和脱敏信息，以及公开反馈的处理方式。',
      lead: '发现工具错误、内容问题或隐私疑问时，请提供可以复现问题的最少信息。不要提交真实密码、令牌或个人敏感数据。',
      sections: [
        [
          '反馈内容',
          '建议包含页面地址、浏览器和设备、输入类型（请脱敏）以及实际结果与预期结果。涉及安全问题时，请先隐藏可识别信息。',
        ],
        [
          '响应方式',
          'CloverTools 通过公开 GitHub Issues 接收一般反馈。问题会按可复现性、影响范围和维护时间安排处理，不承诺固定响应时限。',
        ],
      ],
    },
    tw: {
      title: '聯絡我們',
      desc: '向 CloverTools 回報工具錯誤、內容建議與隱私問題，了解應提供的頁面網址、重現步驟和去識別資訊，以及公開回饋的處理方式。',
      lead: '發現工具錯誤、內容問題或隱私疑問時，請提供可重現問題的最少資訊，並勿提交真實密碼或權杖。',
      sections: [
        [
          '回饋內容',
          '建議包含頁面網址、瀏覽器與裝置、已脫敏的輸入類型，以及實際與預期結果。',
        ],
        [
          '回應方式',
          'CloverTools 透過公開 GitHub Issues 接收一般回饋，依可重現性與影響範圍安排處理。',
        ],
      ],
    },
    en: {
      title: 'Contact us',
      desc: 'Report CloverTools bugs, content issues or privacy concerns through GitHub Issues with page URLs, reproduction steps and redacted examples.',
      lead: 'When reporting a problem, include the minimum reproducible details. Never submit real passwords, tokens, or sensitive personal data.',
      sections: [
        [
          'What to include',
          'Share the page URL, browser and device, a redacted input type, and actual versus expected results. Remove identifying information from security reports.',
        ],
        [
          'Response',
          'CloverTools accepts general feedback through public GitHub Issues. Triage depends on reproducibility, impact, and available maintenance time.',
        ],
      ],
    },
    ko: {
      title: '문의하기',
      desc: 'CloverTools의 도구 오류, 콘텐츠 제안과 개인정보 문제를 신고할 때 필요한 페이지 주소, 재현 단계 및 비식별 정보 안내를 확인하세요.',
      lead: '문제를 신고할 때 재현에 필요한 최소 정보만 제공하세요. 실제 비밀번호, 토큰 또는 민감한 개인정보를 보내지 마세요.',
      sections: [
        [
          '포함할 정보',
          '페이지 URL, 브라우저와 기기, 비식별화된 입력 유형, 실제 결과와 예상 결과를 적어 주세요.',
        ],
        [
          '응답',
          '일반 문의는 공개 GitHub Issues로 받으며 재현성, 영향도와 유지보수 여건에 따라 처리합니다.',
        ],
      ],
    },
    ja: {
      title: 'お問い合わせ',
      desc: 'CloverTools の不具合、コンテンツの提案やプライバシー問題を報告する際に必要なページ URL、再現手順と匿名化情報を案内します。',
      lead: '問題を報告するときは再現に必要な最小限の情報を記載してください。実際のパスワードやトークンは送らないでください。',
      sections: [
        [
          '記載する情報',
          'ページ URL、ブラウザと端末、匿名化した入力種別、実際の結果と期待結果を記載してください。',
        ],
        [
          '対応',
          '一般的な連絡は公開 GitHub Issues で受け付け、再現性と影響範囲に応じて対応します。',
        ],
      ],
    },
  }[lang];

  const copy =
    kind === 'privacy'
      ? privacyCopy
      : kind === 'terms'
        ? genericCopy
        : contactCopy;

  const labels = {
    zh: {
      updated: `最后更新：${LEGAL.updated}`,
      back: '返回首页',
      contact: '联系我们',
      github: 'GitHub Issues',
      email:
        '建议通过 GitHub Issues 提交问题，避免在公开内容中提交密码、令牌或个人信息。',
    },
    tw: {
      updated: `最後更新：${LEGAL.updated}`,
      back: '返回首頁',
      contact: '聯絡我們',
      github: 'GitHub Issues',
      email:
        '建議透過 GitHub Issues 提交問題，請勿在公開內容中提交密碼、權杖或個人資料。',
    },
    en: {
      updated: `Last updated: ${LEGAL.updated}`,
      back: 'Back to home',
      contact: 'Contact us',
      github: 'GitHub Issues',
      email:
        'Use GitHub Issues for reports. Do not include passwords, tokens, or personal information in public issues.',
    },
    ko: {
      updated: `최종 업데이트: ${LEGAL.updated}`,
      back: '홈으로',
      contact: '문의하기',
      github: 'GitHub Issues',
      email:
        'GitHub Issues로 문의해 주세요. 공개 이슈에 비밀번호, 토큰 또는 개인정보를 포함하지 마세요.',
    },
    ja: {
      updated: `最終更新：${LEGAL.updated}`,
      back: 'ホームへ戻る',
      contact: 'お問い合わせ',
      github: 'GitHub Issues',
      email:
        '報告は GitHub Issues を利用してください。公開内容にパスワード、トークン、個人情報を含めないでください。',
    },
  }[lang];

  const networkCopy = {
    zh: [
      '网络请求工具',
      'IP 查询和 HTTP 测试等功能需要发送网络请求。HTTP 测试会把请求地址、请求头和请求体发送到你指定的服务器；目标服务器及其日志处理方式由该服务提供方决定。浏览器会保存语言与主题选择，你可以在浏览器设置中清除站点数据。',
    ],
    tw: [
      '網路請求工具',
      'IP 查詢和 HTTP 測試等功能需要發送網路請求。HTTP 測試會將請求網址、標頭和內容傳送到你指定的伺服器；該服務提供方決定其日誌處理方式。瀏覽器會保存語言與主題選擇，你可以清除網站資料。',
    ],
    en: [
      'Network tools',
      'IP lookup and HTTP testing send network requests. HTTP testing sends the URL, headers and body to the server you specify, which controls its own logs. Your browser stores language and theme preferences; clear site data in browser settings to remove them.',
    ],
    ko: [
      '네트워크 도구',
      'IP 조회와 HTTP 테스트는 네트워크 요청을 보냅니다. HTTP 테스트는 지정한 서버로 URL, 헤더와 본문을 보내며 해당 서비스가 로그를 관리합니다. 브라우저는 언어와 테마 설정을 저장하며 사이트 데이터를 삭제하여 지울 수 있습니다.',
    ],
    ja: [
      'ネットワークツール',
      'IP 検索と HTTP テストは通信を行います。HTTP テストは指定されたサーバーに URL、ヘッダーと本文を送信し、そのサービスがログを管理します。言語とテーマの設定はブラウザに保存され、サイトデータの削除で消去できます。',
    ],
  };
  return {
    copy: {
      ...copy,
      sections:
        kind === 'privacy'
          ? [...copy.sections, networkCopy[lang]]
          : copy.sections,
    },
    labels,
  };
}
