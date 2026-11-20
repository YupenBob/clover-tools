import type { Language, FieldId } from "./ip-reputation.ts";
import type { ErrorCode } from "../../functions/lib/ip-reputation.ts";
// @ts-ignore CJS package already used by the site.
import chineseS2t from "chinese-s2t";
export type Copy = {
  text: Record<string, string>;
  fields: Record<FieldId, { label: string; explanation: string }>;
  errors: Record<ErrorCode, string>;
};
const COPY: Record<"zh" | "en" | "ko" | "ja", Copy> = {
  zh: {
    text: {
      title: "IP 风险与纯净度查询",
      lead: "核对来源、标记和缺失原因，不生成综合风险分。",
      input: "公网 IP 或域名",
      hint: "仅一个地址或域名，不接受 URL、端口或 CIDR。Ctrl/Cmd + Enter 执行。",
      lookup: "查询来源信息",
      resolve: "解析域名",
      selectedLookup: "查询所选 IP",
      cancel: "取消",
      clear: "清空输入",
      examples: "填入示例（不自动查询）",
      candidates: "选择一个公网地址",
      domainNote: "本次结果仅对应所选地址，不能代表整个域名。",
      filtered: "已过滤特殊用途地址",
      truncated: "候选已截断为前八个地址。",
      fieldExplanation: "字段解释",
      explanationEmpty: "展开字段名称查看含义、上游字段与局限。",
      sourceDocs: "来源文档",
      summary: "查询摘要",
      target: "目标 IP",
      count: "有效来源",
      elapsed: "浏览器请求耗时",
      responseAt: "响应时间",
      enhancement: "增强能力",
      "key-required": "需配置密钥",
      enabled: "增强来源已启用，逐项查看实际覆盖。",
      noKey: "仅基础信息：本站未配置 API 密钥，增强标记不可用。",
      comparison: "来源对照",
      filter: "展示字段",
      all: "全部字段",
      differences: "仅看差异",
      provided: "仅看已提供",
      sources: "来源状态与数据覆盖",
      observation: "时间为本站获取时间，并非数据库更新时间。",
      cache: "服务器缓存",
      fresh: "本次获取",
      age: "缓存年龄",
      upstreamField: "上游字段",
      same: "已提供值一致",
      different: "来源不同",
      "name-different": "名称不同",
      single: "单一来源，无法交叉核对",
      missing: "没有可比较值；见各来源缺失原因",
      flagged: "已标记",
      "not-flagged": "未标记",
      "not-provided": "未提供",
      unsupported: "该来源不提供",
      unavailable: "暂不可用",
      success: "成功",
      timeout: "超时",
      "rate-limited": "限流",
      "auth-failed": "鉴权失败",
      invalid: "响应无效",
      failed: "请求失败",
      disabled: "未启用",
      crawlerName: "爬虫名称（上游原文）",
      indicators: "原始网络指标（不是当前 IP 的滥用概率）",
      company: "组织网络范围",
      asnScope: "ASN 范围",
      snapshot: "历史快照",
      json: "JSON 快照",
      copy: "复制 JSON",
      share: "复制分享链接",
      copied: "已复制",
      manual: "复制失败；可手动选择以下文本。",
      history: "最近十条查询",
      localNotice: "查询历史保存在此浏览器，可清空。",
      memory: "存储不可用；历史仅保存在内存，刷新后不保留。",
      historyInvalid: "无法恢复历史：数据损坏、版本未知或结构超限；可清空。",
      emptyHistory: "尚无保存的查询",
      view: "查看快照",
      rerun: "重新查询",
      clearHistory: "清空历史",
      confirmText: "清空此浏览器中本工具的全部历史？",
      confirm: "确认清空",
      clearFailed:
        "本次访问中的历史已清空，但浏览器拒绝删除已存记录；刷新后可能再次出现。",
      cleared: "历史已清空",
      mode: "查询模式",
      basic: "基础信息",
      enhanced: "含增强来源",
      noRows: "此筛选没有可展示字段。",
      idle: "输入一个公网 IP 或域名，主动提交后开始查询。",
      resolving: "正在并行解析 A 与 AAAA…",
      selecting: "解析完成，请选择地址后再次提交。",
      querying: "正在并行查询已启用的数据库…",
      complete: "已完成；逐项查看来源及数据覆盖。",
      partial: "部分结果可用；请核对失败来源。",
      cancelled: "查询已取消，可重新提交。",
      related: "相关工具",
      ipLookup: "IP 查询：子网、进制与本机地址",
      httpTester: "HTTP 测试",
      uaParser: "User-Agent 解析",
      noscript: "交互查询需要 JavaScript；下方保留用途、来源及隐私说明。",
      privacy:
        "提交后，本站服务器会把所选公网 IP 发送给页面列出的数据库；域名先交给 Cloudflare DNS 解析。本工具应用代码不记录访客 IP，不转发访客请求头。查询结果在服务器短暂缓存，最近十条历史保存在此浏览器，可随时清空。托管平台仍处理连接信息，上游可按其政策处理收到的查询。",
      disclaimer:
        "结果是数据库在所示时间返回的记录，可能缺失、延迟或存在误判。未标记不代表不存在相关行为，已标记也不代表当前使用者实施滥用。归属地不是个人位置，网络或 ASN 指标不是当前 IP 的欺诈概率。",
    },
    fields: {
      country: {
        label: "国家/地区",
        explanation: "按来源保留地名；名称差异不等于位置冲突。",
      },
      countryCode: {
        label: "国家代码",
        explanation: "来源返回的两位代码，统一为大写。",
      },
      city: {
        label: "城市",
        explanation: "数据库记录的城市，不代表个人位置。",
      },
      asn: {
        label: "ASN",
        explanation: "归一化为 AS 加整数；缺失时不猜测。",
      },
      asnOrg: {
        label: "ASN 组织",
        explanation: "各来源记录的 ASN 组织，不用注册组织替代。",
      },
      registeredOrg: {
        label: "注册组织",
        explanation: "增强来源的 company.name；基础来源不提供。",
      },
      hosting: {
        label: "机房标记",
        explanation: "托管、云或相关网络分类，不表示恶意。",
      },
      vpn: {
        label: "VPN 标记",
        explanation: "收录为 VPN 节点或服务器，不证明当前流量使用 VPN。",
      },
      proxy: {
        label: "开放代理标记",
        explanation: "已知开放代理记录，不能覆盖所有住宅或移动代理。",
      },
      tor: {
        label: "Tor 节点标记",
        explanation: "可能为出口或其他中继，不统一称为出口。",
      },
      crawler: {
        label: "爬虫标记",
        explanation: "保留爬虫名称；爬虫身份不等于滥用。",
      },
      abuser: {
        label: "滥用标记",
        explanation: "上游近期记录，不提供用户身份或具体行为结论。",
      },
    },
    errors: {
      "empty-input": "请输入一个公网 IP 或域名。",
      "input-too-long": "输入不能超过 256 个字符。",
      "invalid-input":
        "格式不受支持：仅接受一个严格格式 IP 或域名，不接受 URL、端口、CIDR 或内部空白。",
      "special-address": "特殊用途地址，本工具不查询；未发送给数据库。",
      "invalid-domain": "域名必须为合法的多标签名称。",
      "internal-domain": "不接受内部域名。",
      "method-not-allowed": "请求方法不受支持。",
      "invalid-body": "请求参数无效。",
      "unsupported-media": "请求需要 JSON 格式。",
      "body-too-large": "请求体过大。",
      "origin-rejected": "请求来源不受支持。",
      "upstream-timeout": "请求超时，可再次提交。",
      "upstream-http": "上游请求失败，其他来源仍独立展示。",
      "upstream-invalid": "响应结构或目标 IP 不匹配，未采用该来源。",
      "upstream-too-large": "上游响应超过大小限制。",
      "upstream-redirect": "上游重定向已拒绝。",
      "rate-limited": "上游额度或请求频率受限，请稍后重试。",
      "auth-failed": "来源鉴权或访问权限失败；请核对站点服务配置。",
      "dns-failed": "DNS 服务失败，不能据此判断域名不存在。",
      "dns-no-address":
        "未获得可查询公网地址，可能没有记录或仅有特殊用途地址。",
      "dns-invalid": "DNS 答案截断、关联无效或链路不受支持，未采用。",
      "upstreams-unavailable": "所有已启用来源均不可用，可重新查询。",
      offline: "当前离线；仍可查看本机历史。",
      cancelled: "查询已取消。",
      "clipboard-denied": "剪贴板不可用，可手动复制。",
      "storage-unavailable": "存储不可用，刷新后不保留历史。",
      "history-invalid": "历史损坏、版本未知或超限。",
    },
  },
  en: {
    text: {
      title: "IP Reputation Lookup",
      lead: "Compare database records, detection flags and missing data. No combined risk score.",
      input: "Public IP or domain",
      hint: "Enter one address or domain without a URL, port or CIDR. Ctrl/Cmd + Enter to submit.",
      lookup: "Look up source records",
      resolve: "Resolve domain",
      selectedLookup: "Look up selected IP",
      cancel: "Cancel",
      clear: "Clear input",
      examples: "Fill an example (no request)",
      candidates: "Select one public address",
      domainNote:
        "Results apply only to the selected address, not the entire domain.",
      filtered: "Special-purpose addresses filtered",
      truncated: "Candidates limited to the first eight addresses.",
      fieldExplanation: "Field explanation",
      explanationEmpty:
        "Expand a field name to inspect its meaning, upstream field and limits.",
      sourceDocs: "Source documentation",
      summary: "Query summary",
      target: "Target IP",
      count: "Available sources",
      elapsed: "Browser request time",
      responseAt: "Response time",
      enhancement: "Enhanced signals",
      "key-required": "Site key required",
      enabled: "Enhanced source enabled; check individual field coverage.",
      noKey:
        "Enhanced signals are unavailable because this site has no API key configured.",
      comparison: "Source comparison",
      filter: "Fields to display",
      all: "All fields",
      differences: "Differences only",
      provided: "Provided values only",
      sources: "Source status and coverage",
      observation: "Times record retrieval by this site, not database updates.",
      cache: "Server cache",
      fresh: "Fetched for this request",
      age: "Cache age",
      upstreamField: "Upstream field",
      same: "Provided values match",
      different: "Sources differ",
      "name-different": "Names differ",
      single: "Single source; no cross-check available",
      missing: "No comparable values; see missing-data reasons",
      flagged: "Flagged",
      "not-flagged": "Not flagged",
      "not-provided": "Not provided",
      unsupported: "Not supported by this source",
      unavailable: "Unavailable",
      success: "Success",
      timeout: "Timed out",
      "rate-limited": "Rate limited",
      "auth-failed": "Authentication failed",
      invalid: "Invalid response",
      failed: "Request failed",
      disabled: "Not enabled",
      crawlerName: "Crawler name (original)",
      indicators:
        "Raw network indicators (not an abuse probability for this IP)",
      company: "Company network scope",
      asnScope: "ASN scope",
      snapshot: "Saved snapshot",
      json: "JSON snapshot",
      copy: "Copy JSON",
      share: "Copy query link",
      copied: "Copied",
      manual: "Copy failed; select the text below to copy manually.",
      history: "Last ten queries",
      localNotice: "Query history is saved in this browser and can be cleared.",
      memory:
        "Storage unavailable. History is kept in memory and lost on refresh.",
      historyInvalid:
        "History could not be restored: invalid, unknown version or oversized data. You can clear it.",
      emptyHistory: "No saved queries",
      view: "View snapshot",
      rerun: "Query again",
      clearHistory: "Clear history",
      confirmText: "Clear all history for this tool in this browser?",
      confirm: "Confirm clear",
      clearFailed:
        "History cleared for this visit, but the browser could not delete saved records. They may return after a refresh.",
      cleared: "History cleared",
      mode: "Query mode",
      basic: "Basic records",
      enhanced: "Enhanced source enabled",
      noRows: "No fields match this filter.",
      idle: "Enter a public IP or domain, then submit to start.",
      resolving: "Resolving A and AAAA records…",
      selecting: "Resolution finished. Choose an address and submit again.",
      querying: "Querying enabled databases…",
      complete: "Complete. Review sources and field coverage.",
      partial: "Partial results available. Review failed sources.",
      cancelled: "Query cancelled. You can submit again.",
      related: "Related tools",
      ipLookup: "IP Lookup: subnets, number formats and your address",
      httpTester: "HTTP Tester",
      uaParser: "User-Agent Parser",
      noscript:
        "Interactive queries require JavaScript. Purpose, sources and privacy information remain available.",
      privacy:
        "After submission, this site sends the selected public IP to the listed databases. Domains go to Cloudflare DNS first. Application code does not log visitor IPs or forward visitor request headers. Results are briefly cached on the server; the last ten queries stay in this browser and can be cleared. The hosting platform processes connection information, and upstream providers may process queries under their policies.",
      disclaimer:
        "Records may be missing, delayed or incorrect. Not flagged does not rule out activity; flagged does not establish abuse by the current user. Geolocation is not a personal location. Network or ASN indicators are not a fraud probability for this IP.",
    },
    fields: {
      country: {
        label: "Country / region",
        explanation:
          "Preserve each source’s name; different names do not establish a location conflict.",
      },
      countryCode: {
        label: "Country code",
        explanation: "Two-letter source code, normalized to uppercase.",
      },
      city: {
        label: "City",
        explanation: "Database city record, not a person’s location.",
      },
      asn: {
        label: "ASN",
        explanation:
          "Normalized as AS followed by an integer; never inferred when missing.",
      },
      asnOrg: {
        label: "ASN organization",
        explanation:
          "Each source’s ASN organization; never replaced with the registered organization.",
      },
      registeredOrg: {
        label: "Registered organization",
        explanation:
          "company.name from the enhanced source; not provided by basic sources.",
      },
      hosting: {
        label: "Hosting flag",
        explanation:
          "Hosting, cloud or related network classification; does not imply malicious activity.",
      },
      vpn: {
        label: "VPN flag",
        explanation:
          "Listed as a VPN node or server; does not prove current traffic uses a VPN.",
      },
      proxy: {
        label: "Open proxy flag",
        explanation:
          "Known open proxy record; cannot cover every residential or mobile proxy.",
      },
      tor: {
        label: "Tor node flag",
        explanation:
          "May indicate an exit or another relay; not necessarily an exit node.",
      },
      crawler: {
        label: "Crawler flag",
        explanation:
          "Preserve the crawler name; a crawler identity does not imply abuse.",
      },
      abuser: {
        label: "Abuse flag",
        explanation:
          "Recent upstream record; does not identify a user or establish specific behavior.",
      },
    },
    errors: {
      "empty-input": "Enter a public IP or domain.",
      "input-too-long": "Input must not exceed 256 characters.",
      "invalid-input":
        "Unsupported input. Use one strict IP address or domain without a URL, port, CIDR or internal whitespace.",
      "special-address":
        "Special-purpose address. This tool does not query it or send it to databases.",
      "invalid-domain": "Use a valid domain with multiple labels.",
      "internal-domain": "Internal domain names are not supported.",
      "method-not-allowed": "Request method not supported.",
      "invalid-body": "Invalid request parameters.",
      "unsupported-media": "The request requires JSON.",
      "body-too-large": "Request body too large.",
      "origin-rejected": "Request origin rejected.",
      "upstream-timeout": "Request timed out. You can try again.",
      "upstream-http":
        "Upstream request failed. Other sources remain independent.",
      "upstream-invalid":
        "Invalid response or mismatched IP. This source was excluded.",
      "upstream-too-large": "Upstream response exceeded the size limit.",
      "upstream-redirect": "Upstream redirect rejected.",
      "rate-limited": "Upstream quota or rate limit reached. Try again later.",
      "auth-failed":
        "Upstream authentication failed. This is a site configuration issue.",
      "dns-failed":
        "DNS service failed. This does not establish that the domain does not exist.",
      "dns-no-address":
        "No queryable public address found. Records may be absent or special-purpose only.",
      "dns-invalid":
        "DNS answer was truncated, unrelated or had an unsupported chain, and was excluded.",
      "upstreams-unavailable":
        "All enabled sources are unavailable. You can try again.",
      offline: "You are offline. Saved snapshots remain available.",
      cancelled: "Query cancelled.",
      "clipboard-denied": "Clipboard unavailable. Copy manually.",
      "storage-unavailable":
        "Storage unavailable. History will be lost on refresh.",
      "history-invalid":
        "History is invalid, oversized or uses an unknown version.",
    },
  },
  ko: {
    text: {
      title: "IP 평판 조회",
      lead: "데이터베이스 기록, 표시 및 누락 이유를 비교합니다. 종합 위험 점수는 계산하지 않습니다.",
      input: "공인 IP 또는 도메인",
      hint: "URL, 포트, CIDR 없이 주소 또는 도메인 하나를 입력하세요. Ctrl/Cmd + Enter로 실행합니다.",
      lookup: "출처 정보 조회",
      resolve: "도메인 확인",
      selectedLookup: "선택한 IP 조회",
      cancel: "취소",
      clear: "입력 지우기",
      examples: "예시 입력 (자동 조회 없음)",
      candidates: "공인 주소 하나 선택",
      domainNote:
        "결과는 선택한 주소에만 해당하며 도메인 전체를 대표하지 않습니다.",
      filtered: "제외된 특수 용도 주소",
      truncated: "후보를 처음 8개 주소로 제한했습니다.",
      fieldExplanation: "항목 설명",
      explanationEmpty:
        "항목 이름을 펼치면 의미, 원본 필드 및 한계를 볼 수 있습니다.",
      sourceDocs: "출처 문서",
      summary: "조회 요약",
      target: "대상 IP",
      count: "사용 가능한 출처",
      elapsed: "브라우저 요청 소요 시간",
      responseAt: "응답 시각",
      enhancement: "확장 신호",
      "key-required": "사이트 키 설정 필요",
      enabled:
        "확장 출처가 활성화되어 있습니다. 항목별 실제 제공 여부를 확인하세요.",
      noKey:
        "이 사이트에 API 키가 설정되지 않아 확장 신호를 제공할 수 없습니다. 기본 정보는 조회할 수 있습니다.",
      comparison: "출처별 비교",
      filter: "표시할 항목",
      all: "모든 항목",
      differences: "차이만 보기",
      provided: "제공된 값만 보기",
      sources: "출처 상태 및 제공 범위",
      observation:
        "표시 시각은 이 사이트가 데이터를 받은 시각이며 데이터베이스 갱신 시각이 아닙니다.",
      cache: "서버 캐시",
      fresh: "이번 요청에서 수신",
      age: "캐시 경과 시간",
      upstreamField: "원본 필드",
      same: "제공된 값 일치",
      different: "출처별 값 다름",
      "name-different": "명칭 다름",
      single: "단일 출처이므로 교차 확인할 수 없습니다",
      missing: "비교할 값이 없습니다. 출처별 누락 이유를 확인하세요",
      flagged: "표시됨",
      "not-flagged": "표시 없음",
      "not-provided": "제공되지 않음",
      unsupported: "이 출처에서 제공하지 않음",
      unavailable: "현재 이용 불가",
      success: "성공",
      timeout: "시간 초과",
      "rate-limited": "요청 한도 초과",
      "auth-failed": "인증 실패",
      invalid: "잘못된 응답",
      failed: "요청 실패",
      disabled: "활성화되지 않음",
      crawlerName: "크롤러 이름 (원문)",
      indicators: "원본 네트워크 지표 (현재 IP의 악용 확률이 아님)",
      company: "조직 네트워크 범위",
      asnScope: "ASN 범위",
      snapshot: "저장된 조회 결과",
      json: "JSON 조회 결과",
      copy: "JSON 복사",
      share: "조회 링크 복사",
      copied: "복사했습니다",
      manual: "복사하지 못했습니다. 아래 텍스트를 직접 선택해 복사하세요.",
      history: "최근 조회 10개",
      localNotice: "조회 기록은 이 브라우저에 저장되며 삭제할 수 있습니다.",
      memory:
        "저장소를 사용할 수 없습니다. 기록은 메모리에만 보관되며 새로고침하면 사라집니다.",
      historyInvalid:
        "기록이 손상되었거나 버전을 알 수 없거나 크기 제한을 초과하여 복원할 수 없습니다. 삭제할 수 있습니다.",
      emptyHistory: "저장된 조회가 없습니다",
      view: "저장된 결과 보기",
      rerun: "다시 조회",
      clearHistory: "기록 삭제",
      confirmText: "이 브라우저에 저장된 이 도구의 기록을 모두 삭제할까요?",
      confirm: "삭제 확인",
      clearFailed:
        "이번 방문의 기록은 지웠지만 브라우저가 저장된 기록의 삭제를 거부했습니다. 새로고침 후 다시 나타날 수 있습니다.",
      cleared: "기록을 삭제했습니다",
      mode: "조회 방식",
      basic: "기본 정보",
      enhanced: "확장 출처 포함",
      noRows: "이 필터에 해당하는 항목이 없습니다.",
      idle: "공인 IP 또는 도메인을 입력한 후 실행하세요.",
      resolving: "A 및 AAAA 레코드를 확인하고 있습니다…",
      selecting: "주소 확인을 마쳤습니다. 주소를 선택한 후 다시 실행하세요.",
      querying: "활성화된 데이터베이스를 조회하고 있습니다…",
      complete: "완료했습니다. 출처와 항목별 제공 범위를 확인하세요.",
      partial: "일부 결과를 확인할 수 있습니다. 실패한 출처를 확인하세요.",
      cancelled: "조회를 취소했습니다. 다시 실행할 수 있습니다.",
      related: "관련 도구",
      ipLookup: "IP 조회: 서브넷, 진법 및 내 주소",
      httpTester: "HTTP 테스트",
      uaParser: "User-Agent 분석",
      noscript:
        "조회 기능을 사용하려면 JavaScript가 필요합니다. 용도, 출처 및 개인정보 안내는 아래에서 확인할 수 있습니다.",
      privacy:
        "실행하면 이 사이트의 서버가 선택한 공인 IP를 아래 데이터베이스로 전송합니다. 도메인은 먼저 Cloudflare DNS로 전송됩니다. 도구 코드는 방문자 IP를 기록하거나 방문자 요청 헤더를 전달하지 않습니다. 결과는 서버에 잠시 캐시되며 최근 조회 10개는 이 브라우저에 저장되고 삭제할 수 있습니다. 호스팅 플랫폼은 연결 정보를 처리하며 외부 제공자는 자체 정책에 따라 조회를 처리할 수 있습니다.",
      disclaimer:
        "기록이 누락되거나 지연되거나 잘못될 수 있습니다. 표시 없음은 관련 행위가 없다는 뜻이 아니며, 표시됨도 현재 사용자의 악용을 입증하지 않습니다. 위치 정보는 개인의 위치가 아닙니다. 네트워크 및 ASN 지표는 현재 IP의 사기 확률이 아닙니다.",
    },
    fields: {
      country: {
        label: "국가/지역",
        explanation:
          "출처별 명칭을 보존합니다. 명칭 차이가 위치 충돌을 의미하지는 않습니다.",
      },
      countryCode: {
        label: "국가 코드",
        explanation: "출처의 두 글자 코드를 대문자로 정규화합니다.",
      },
      city: {
        label: "도시",
        explanation: "데이터베이스에 기록된 도시이며 개인의 위치가 아닙니다.",
      },
      asn: {
        label: "ASN",
        explanation: "AS와 정수로 정규화하며 누락된 값은 추정하지 않습니다.",
      },
      asnOrg: {
        label: "ASN 조직",
        explanation: "출처별 ASN 조직이며 등록 조직으로 대체하지 않습니다.",
      },
      registeredOrg: {
        label: "등록 조직",
        explanation:
          "확장 출처의 company.name이며 기본 출처는 제공하지 않습니다.",
      },
      hosting: {
        label: "데이터센터 표시",
        explanation:
          "호스팅, 클라우드 또는 관련 네트워크 분류이며 악의를 뜻하지 않습니다.",
      },
      vpn: {
        label: "VPN 표시",
        explanation:
          "VPN 노드 또는 서버로 등록된 기록이며 현재 트래픽의 VPN 사용을 입증하지 않습니다.",
      },
      proxy: {
        label: "개방형 프록시 표시",
        explanation:
          "알려진 개방형 프록시 기록이며 모든 주거용 또는 모바일 프록시를 포괄하지 않습니다.",
      },
      tor: {
        label: "Tor 노드 표시",
        explanation:
          "출구 또는 다른 중계 노드일 수 있으며 반드시 출구 노드인 것은 아닙니다.",
      },
      crawler: {
        label: "크롤러 표시",
        explanation:
          "크롤러 이름을 보존합니다. 크롤러라는 사실이 악용을 의미하지는 않습니다.",
      },
      abuser: {
        label: "악용 표시",
        explanation:
          "외부 제공자의 최근 기록이며 사용자 신원이나 특정 행위에 대한 결론을 제공하지 않습니다.",
      },
    },
    errors: {
      "empty-input": "공인 IP 또는 도메인을 입력하세요.",
      "input-too-long": "입력은 256자를 초과할 수 없습니다.",
      "invalid-input":
        "올바른 IP 또는 도메인 하나만 입력하세요. URL, 포트, CIDR, 내부 공백은 허용되지 않습니다.",
      "special-address":
        "특수 용도 주소는 조회하지 않으며 데이터베이스에 전송하지 않습니다.",
      "invalid-domain": "유효한 여러 레이블로 구성된 도메인을 입력하세요.",
      "internal-domain": "내부 도메인은 사용할 수 없습니다.",
      "method-not-allowed": "지원하지 않는 요청 방식입니다.",
      "invalid-body": "요청 매개변수가 올바르지 않습니다.",
      "unsupported-media": "JSON 형식이 필요합니다.",
      "body-too-large": "요청 본문이 너무 큽니다.",
      "origin-rejected": "허용되지 않은 요청 출처입니다.",
      "upstream-timeout":
        "요청 시간이 초과되었습니다. 다시 실행할 수 있습니다.",
      "upstream-http":
        "외부 요청에 실패했습니다. 다른 출처는 별도로 표시됩니다.",
      "upstream-invalid":
        "응답 구조 또는 IP가 일치하지 않아 해당 출처를 제외했습니다.",
      "upstream-too-large": "외부 응답이 크기 제한을 초과했습니다.",
      "upstream-redirect": "외부 리디렉션을 거부했습니다.",
      "rate-limited":
        "외부 서비스의 할당량 또는 요청 한도에 도달했습니다. 나중에 다시 시도하세요.",
      "auth-failed": "외부 서비스 인증에 실패했습니다. 사이트 설정 문제입니다.",
      "dns-failed":
        "DNS 서비스에 실패했습니다. 도메인이 없다고 판단할 수는 없습니다.",
      "dns-no-address":
        "조회 가능한 공인 주소가 없습니다. 레코드가 없거나 특수 용도 주소만 있을 수 있습니다.",
      "dns-invalid":
        "DNS 응답이 잘렸거나 관련이 없거나 지원하지 않는 체인이어서 제외했습니다.",
      "upstreams-unavailable":
        "활성화된 모든 출처를 이용할 수 없습니다. 다시 조회할 수 있습니다.",
      offline: "현재 오프라인입니다. 저장된 결과는 볼 수 있습니다.",
      cancelled: "조회를 취소했습니다.",
      "clipboard-denied": "클립보드를 사용할 수 없습니다. 직접 복사하세요.",
      "storage-unavailable":
        "저장소를 사용할 수 없습니다. 새로고침하면 기록이 사라집니다.",
      "history-invalid":
        "기록이 손상되었거나 크기 제한을 초과했거나 버전을 알 수 없습니다.",
    },
  },
  ja: {
    text: {
      title: "IP レピュテーション照会",
      lead: "データベースの記録、検出項目、欠落理由を比較します。総合リスクスコアは算出しません。",
      input: "公開 IP アドレスまたはドメイン",
      hint: "URL・ポート・CIDR を含めず、1 件入力してください。Ctrl/Cmd + Enter で実行します。",
      lookup: "情報源を照会",
      resolve: "ドメインを名前解決",
      selectedLookup: "選択した IP を照会",
      cancel: "キャンセル",
      clear: "入力を消去",
      examples: "入力例（自動照会なし）",
      candidates: "公開アドレスを 1 件選択",
      domainNote:
        "結果は選択したアドレスのみを対象とし、ドメイン全体を表しません。",
      filtered: "除外した特別用途アドレス",
      truncated: "候補は先頭 8 件に制限されています。",
      fieldExplanation: "項目の説明",
      explanationEmpty:
        "項目名を展開すると意味、上流フィールド、制約を確認できます。",
      sourceDocs: "情報源の文書",
      summary: "照会の概要",
      target: "対象 IP",
      count: "利用可能な情報源",
      elapsed: "ブラウザーのリクエスト時間",
      responseAt: "応答時刻",
      enhancement: "拡張検出項目",
      "key-required": "サイトのキー設定が必要",
      enabled: "拡張情報源は有効です。各項目の提供状況を確認してください。",
      noKey:
        "このサイトに API キーが設定されていないため、拡張検出項目は利用できません。基本情報は照会できます。",
      comparison: "情報源の比較",
      filter: "表示する項目",
      all: "すべての項目",
      differences: "相違のみ",
      provided: "提供済みのみ",
      sources: "情報源の状態と提供範囲",
      observation:
        "時刻は当サイトの取得時刻であり、データベースの更新時刻ではありません。",
      cache: "サーバーキャッシュ",
      fresh: "今回取得",
      age: "キャッシュ経過時間",
      upstreamField: "上流フィールド",
      same: "提供値は一致",
      different: "情報源間で相違あり",
      "name-different": "名称が異なる",
      single: "単一の情報源のため照合できません",
      missing: "比較できる値がありません。各情報源の欠落理由を確認してください",
      flagged: "検出あり",
      "not-flagged": "検出なし",
      "not-provided": "情報なし",
      unsupported: "この情報源では提供なし",
      unavailable: "現在利用不可",
      success: "成功",
      timeout: "タイムアウト",
      "rate-limited": "リクエスト制限",
      "auth-failed": "認証失敗",
      invalid: "無効な応答",
      failed: "リクエスト失敗",
      disabled: "未有効化",
      crawlerName: "クローラー名（原文）",
      indicators:
        "ネットワークの原指標（この IP の不正利用確率ではありません）",
      company: "組織ネットワークの範囲",
      asnScope: "ASN の範囲",
      snapshot: "保存済みの照会結果",
      json: "JSON スナップショット",
      copy: "JSON をコピー",
      share: "照会リンクをコピー",
      copied: "コピーしました",
      manual:
        "コピーできませんでした。以下のテキストを選択してコピーできます。",
      history: "最近の照会 10 件",
      localNotice: "照会履歴はこのブラウザーに保存され、消去できます。",
      memory:
        "保存領域を利用できません。履歴はメモリー内のみで、再読み込みすると失われます。",
      historyInvalid:
        "履歴を復元できません。破損、未対応のバージョン、またはサイズ超過です。消去できます。",
      emptyHistory: "保存された照会はありません",
      view: "保存結果を表示",
      rerun: "再照会",
      clearHistory: "履歴を消去",
      confirmText: "このブラウザーにある本ツールの履歴をすべて消去しますか？",
      confirm: "消去を確定",
      clearFailed:
        "今回の表示履歴は消去しましたが、ブラウザーが保存済み記録の削除を拒否しました。再読み込み後に再表示される場合があります。",
      cleared: "履歴を消去しました",
      mode: "照会モード",
      basic: "基本情報",
      enhanced: "拡張情報源あり",
      noRows: "この条件に該当する項目はありません。",
      idle: "公開 IP またはドメインを入力し、送信すると照会します。",
      resolving: "A・AAAA レコードを名前解決中…",
      selecting:
        "名前解決が完了しました。アドレスを選択し、もう一度送信してください。",
      querying: "有効なデータベースを照会中…",
      complete: "完了しました。情報源と項目ごとの提供範囲を確認してください。",
      partial: "一部の結果を取得しました。失敗した情報源を確認してください。",
      cancelled: "照会をキャンセルしました。再送信できます。",
      related: "関連ツール",
      ipLookup: "IP 照会：サブネット・基数変換・端末のアドレス",
      httpTester: "HTTP テスター",
      uaParser: "User-Agent 解析",
      noscript:
        "照会の操作には JavaScript が必要です。用途・情報源・プライバシーの説明は下に表示されます。",
      privacy:
        "送信後、当サイトのサーバーが選択した公開 IP を記載のデータベースに送ります。ドメインは先に Cloudflare DNS で名前解決します。ツールのコードは訪問者の IP を記録せず、訪問者のリクエストヘッダーも転送しません。結果はサーバーに短時間キャッシュされ、最近 10 件の履歴はこのブラウザーに保存され、消去できます。ホスティング基盤は接続情報を処理し、上流サービスは各自の方針で照会を処理する場合があります。",
      disclaimer:
        "記録には欠落・遅延・誤判定があり得ます。「検出なし」は関連する行為の不存在を、「検出あり」は現在の利用者による不正行為を示すものではありません。地理情報は個人の所在地ではなく、ネットワークや ASN の指標はこの IP の詐欺確率ではありません。",
    },
    fields: {
      country: {
        label: "国・地域",
        explanation:
          "情報源ごとの名称を保持します。名称の相違だけでは所在地の矛盾とは判断しません。",
      },
      countryCode: {
        label: "国コード",
        explanation: "情報源の 2 文字コードを大文字に統一します。",
      },
      city: {
        label: "都市",
        explanation: "データベース上の都市であり、個人の所在地ではありません。",
      },
      asn: {
        label: "ASN",
        explanation: "AS と整数に統一します。欠落時に推測しません。",
      },
      asnOrg: {
        label: "ASN の組織",
        explanation: "情報源ごとの ASN 組織です。登録組織で代用しません。",
      },
      registeredOrg: {
        label: "登録組織",
        explanation:
          "拡張情報源の company.name です。基本情報源では提供しません。",
      },
      hosting: {
        label: "データセンター判定",
        explanation: "ホスティング・クラウド等の分類であり、悪意を示しません。",
      },
      vpn: {
        label: "VPN 判定",
        explanation:
          "VPN ノードやサーバーの記録であり、現在の通信が VPN 経由であることを証明しません。",
      },
      proxy: {
        label: "公開プロキシ判定",
        explanation:
          "既知の公開プロキシの記録です。住宅・モバイルのすべてのプロキシを網羅しません。",
      },
      tor: {
        label: "Tor ノード判定",
        explanation:
          "出口または他の中継ノードの場合があり、出口ノードとは限りません。",
      },
      crawler: {
        label: "クローラー判定",
        explanation:
          "クローラー名を保持します。クローラーであることは不正利用を意味しません。",
      },
      abuser: {
        label: "不正利用の記録",
        explanation:
          "上流の最近の記録であり、利用者の身元や具体的な行為を断定しません。",
      },
    },
    errors: {
      "empty-input": "公開 IP またはドメインを入力してください。",
      "input-too-long": "入力は 256 文字以内にしてください。",
      "invalid-input":
        "正しい形式の IP またはドメインを 1 件入力してください。URL・ポート・CIDR・内部の空白は使用できません。",
      "special-address":
        "特別用途アドレスは照会せず、データベースに送信しません。",
      "invalid-domain": "有効な複数ラベルのドメインを入力してください。",
      "internal-domain": "内部ドメインは使用できません。",
      "method-not-allowed": "このリクエストメソッドには対応していません。",
      "invalid-body": "リクエストのパラメーターが無効です。",
      "unsupported-media": "JSON 形式が必要です。",
      "body-too-large": "リクエスト本文が大きすぎます。",
      "origin-rejected": "リクエスト元が許可されていません。",
      "upstream-timeout": "リクエストがタイムアウトしました。再試行できます。",
      "upstream-http":
        "上流へのリクエストが失敗しました。他の情報源は個別に表示します。",
      "upstream-invalid":
        "応答の形式または IP が一致しないため、この情報源を採用しませんでした。",
      "upstream-too-large": "上流の応答がサイズ制限を超えました。",
      "upstream-redirect": "上流のリダイレクトを拒否しました。",
      "rate-limited":
        "上流の利用枠またはリクエスト制限に達しました。時間を置いて再試行してください。",
      "auth-failed":
        "上流サービスの認証に失敗しました。サイト側の設定の問題です。",
      "dns-failed":
        "DNS サービスが失敗しました。ドメインが存在しないとは判断できません。",
      "dns-no-address":
        "照会可能な公開アドレスを取得できませんでした。レコードがないか、特別用途アドレスのみの可能性があります。",
      "dns-invalid":
        "DNS 応答の切り詰め、関連付けの不備、または未対応のチェーンにより採用しませんでした。",
      "upstreams-unavailable":
        "有効な情報源をすべて利用できません。再照会できます。",
      offline: "オフラインです。保存済みの結果は表示できます。",
      cancelled: "照会をキャンセルしました。",
      "clipboard-denied":
        "クリップボードを利用できません。手動でコピーしてください。",
      "storage-unavailable":
        "保存領域を利用できません。再読み込みすると履歴が失われます。",
      "history-invalid":
        "履歴が破損、サイズ超過、または未対応のバージョンです。",
    },
  },
};
const tw = JSON.parse(
  chineseS2t
    .s2t(JSON.stringify(COPY.zh))
    .replaceAll("機房標記", "資料中心標記")
    .replaceAll("純凈度", "純淨度")
    .replaceAll("剪貼板", "剪貼簿")
    .replaceAll("記錄", "紀錄"),
) as Copy;
export function ipReputationCopy(lang: Language): Copy {
  return lang === "tw" ? tw : COPY[lang];
}
