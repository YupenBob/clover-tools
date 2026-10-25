import type { Guide } from './guides.ts';
import captures from '../../public/article-images/2026-10/captures.json' with { type: 'json' };
import diagrams from '../../public/article-images/2026-10/diagrams.json' with { type: 'json' };

const imageRoot = '/article-images/2026-10/';
const escape = (value: string) => value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
const pre = (value: string) => `<pre><code>${escape(value)}</code></pre>`;
function figure(file: string, alt: string, caption: string) {
  const capture = captures.find(item => item.file === file);
  if (!capture || !('width' in capture) || !('height' in capture)) throw new Error(`Missing verified article image: ${file}`);
  return `<figure><a href="${imageRoot}${file}" target="_blank" rel="noopener" aria-label="查看大图：${alt}"><img src="${imageRoot}${file}" alt="${alt}" width="${capture.width}" height="${capture.height}" loading="lazy" decoding="async"></a><figcaption>${caption} 点击图片可查看原图。</figcaption></figure>`;
}
function diagram(file: string, alt: string, caption: string) {
  const item = diagrams.find(entry => entry.file === file);
  if (!item) throw new Error(`Missing verified diagram: ${file}`);
  return `<figure class="article-diagram"><a href="${imageRoot}${file}" target="_blank" rel="noopener" aria-label="查看大图：${alt}"><img src="${imageRoot}${file}" alt="${alt}" width="${item.width}" height="${item.height}" loading="lazy" decoding="async"></a><figcaption>${caption} 点击图片可查看原图。</figcaption></figure>`;
}
const table = (head: string[], rows: string[][]) => `<div class="article-table"><table><thead><tr>${head.map(cell => `<th scope="col">${cell}</th>`).join('')}</tr></thead><tbody>${rows.map(row => `<tr>${row.map(cell => `<td>${cell}</td>`).join('')}</tr>`).join('')}</tbody></table></div>`;
const reproduction = `<p>想在自己的电脑上核对？下载<a href="/article-assets/http-repro.mjs" download>本地 HTTP 复现脚本</a>，安装 Node.js 后运行 <code>node http-repro.mjs</code>，再打开 <code>http://127.0.0.1:8765</code>。脚本只监听本机的 8765、8766 两个端口，无须密钥；用完在终端按 Ctrl+C 关闭。</p>`;
function article(
  value: Omit<Guide, 'published' | 'updated' | 'faqs'> & Partial<Pick<Guide, 'published' | 'updated' | 'faqs'>>,
): Guide {
  return { published: '2026-10-16', updated: '2026-10-16', faqs: [], ...value };
}

/** Reviewed against actual browser interactions; capture provenance is kept with the images. */
export const EDITORIAL_GUIDES: Guide[] = [
  article({
    slug: 'focus-flight-first-session',
    title: '专注航班怎么用：给一件小事留出一段完整时间',
    description: '从选择机场、写下任务到撕票登机、暂停恢复和保存抵达卡，完整走一遍专注航班，并说明后台计时与本地记录的边界。',
    category: '专注与练习', toolSlug: 'focus-flight', readingMinutes: 5,
    image: imageRoot + 'flight-cabin.jpg',
    focus: '先选一件能说清楚的小事。领到登机牌时还没开始计时，完整撕下副票才会出发。',
    notice: '任务和日志留在当前浏览器，不做跨设备同步。倒计时完成代表时间走完，工具不判断你是否始终专注，也不能保证关页后的提示音。',
    content: `<p>如果打开计时器以后，仍然在想“这一段到底做什么”，可以先把目标写小一点。比如把“整理资料”换成“给三份资料写好文件名”，或者像这次演示一样，写下“把周末骑行清单写完”。</p>
    <p><a href="/tools/fun/focus-flight/">专注航班</a>把这段时间放进一次虚拟旅程里：选机场、领票、撕下副票，再进入客舱。航线只是陪伴计时的场景，你选的 25 分钟不会因为上海到东京的真实距离而变长。</p>
    <h2>第一次先用一分钟走一遍</h2>
    <ol><li>在候机页面选择出发和到达机场。预设航线可以直接选，也可以自由组合；两个机场不能相同。</li><li>写下一件具体的事，时长先填 1 分钟。当前可填写 1–180 的整数分钟。</li><li>决定是否勾选“有声登机”。安静环境下可以取消，稍后仍能在客舱设置里调整。</li><li>领取登机牌，确认任务和分钟数。此时还没有计时，不必急着关掉其他准备页面。</li><li>沿齿孔撕下副票。电脑向外拖，手机向下拖；也可以单击，或聚焦后按 Enter / Space。</li></ol>
    ${figure('flight-boarding.jpg', '专注航班的真实登机牌，上海 PVG 至东京 HND，任务为骑行清单，时长一分钟', '本次实际演示的登机牌，2026-10-16。航班、座位和票面属于工具的虚拟体验，不是真实航空公司的客票。')}
    <h2>撕完票，才开始这一段时间</h2>
    <p>拖到一半松手，副票会回去；完整撕下后才建立本次航程并开始倒计时。起飞、巡航和下降都包含在所选时长中，不会在计时结束后再加一段动画。</p>
    <p>进入客舱后可以看舷窗，也可以切换航图。航图用机场位置和地理底图展示旅程，没有接入真实航班位置或实时天气。晴空、日落、夜航是视觉氛围选项。</p>
    ${figure('flight-cabin.jpg', '专注航班实际运行中的舷窗、机翼和倒计时，底部有暂停与设置入口', '一分钟演示中的实际客舱画面。截图使用工具自身的 SVG 场景，没有另做一张效果图替代界面。')}
    <h2>控制按钮淡出以后，怎样找回来</h2>
    <p>巡航时静置一会儿，计时和控制会淡出，留下窗外。轻触画面、按 Tab，或者把鼠标移到底边，都可以唤回。暂停或打开设置后，控件会保持显示，方便操作。</p>
    <p>沉浸模式和浏览器全屏是两件事：沉浸用于收起站点周围的内容，全屏由浏览器决定是否允许。需要退出时用画面上的入口或 Esc；有弹窗或设置面板时，Esc 会先关闭当前面板。</p>
    <h2>临时离开，要不要按暂停</h2>
    <p>想把离开的时间排除在这一段之外，就先暂停。暂停后会保存剩余时间；继续时再从剩余时间出发。</p>
    <p>没有暂停就切到后台、让设备休眠或关闭页面，时间仍会按截止时间推进。重新打开同一浏览器的同一站点，可以尝试恢复当前航程。手动修改系统时间会影响结果；清理本地数据、换设备或浏览器，则不能指望找回之前的记录。</p>
    <p>提示音需要浏览器允许音频。关闭或冻结页面后，不能保证准点响铃；需要严格提醒的工作，可以同时使用设备自身的闹钟。</p>
    <h2>抵达以后，留下什么</h2>
    <p>这次演示实际等完了一分钟，才保存下面这张抵达卡。工具导出的是 1080 × 900 PNG，包含航线、填写的任务和本次时间。</p>
    ${figure('flight-arrival.png', '专注航班完整计时后直接导出的抵达留念卡，上海至东京，一分钟', '工具原始 PNG 导出。演示实际走完计时，未加速系统时钟；卡片记录时间完成，不证明现实中的任务一定完成。')}
    <p>完整结束的航程会进入最近 20 条本地日志；提前结束需要确认，不按一次完整抵达记录。今天累计时间按设备的本地日期统计，清理浏览器站点数据也会影响这些记录。</p>
    <p>试过一次流程以后，再换成适合当前任务的时长。把计时当作一个清楚的开始和结束即可，航班里没有替你监控工作内容的评分。</p>`,
    sources: [
      { title: 'CloverTools：专注航班', url: 'https://clovertools.cn/tools/fun/focus-flight/' },
      { title: 'MDN：后台标签页与 Page Visibility API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Page_Visibility_API' },
      { title: '专注航班地理数据来源与许可', url: 'https://clovertools.cn/focus-flight/geography.json' },
    ],
  }),
  article({
    slug: 'fps-aim-training-settings',
    title: '浏览器 FPS 练枪：先调顺手，再选一种动作练',
    description: '从原生鼠标锁定、灵敏度和 cm/360 开始，区分小球、Bot、急停和预瞄训练，读懂指标并避免把近似模拟当作原游戏还原。',
    category: '专注与练习', toolSlug: 'fps-aim-trainer', readingMinutes: 6,
    image: imageRoot + 'fps-range.jpg',
    focus: '每轮固定设置，只练一种动作。命中率、首发与有效回合各有分母，换设置后的成绩不宜直接混比。',
    notice: '使用电脑键鼠。移动、后坐力和命中盒属于浏览器近似模拟；本文没有提供训练效果提升的数据，也不承诺能完整复刻 CS2 或瓦洛兰特。',
    content: `<p>进入靶场后，先别急着追求最快击杀。鼠标转得是否顺手、目标距离是否一致、这一轮究竟练什么，都会影响结果。一次命中率高，可能只是换了更容易的设置。</p>
    <p><a href="/tools/fun/fps-aim-trainer/">FPS 练枪</a>提供 CS2、瓦洛兰特的游戏配置，以及 AK-47、M4A1-S、Vandal、Phantom 四把步枪。场景和枪械是工具自己的几何模型；移动和后坐力保留近似模拟的限制，不能当作原游戏的等价训练环境。</p>
    <h2>第一次进入，先走这几个步骤</h2>
    <ol><li>使用有鼠标和键盘的电脑，选择对应游戏与枪械。手机可以查看设置，但不适合这套第一人称操作。</li><li>先点“Bot 热身”预设。当前预设是 12 个静止 Bot、12 米、正前方区域、无限子弹、仅爆头。</li><li>点击进入靶场，等待准备面板出现；再主动点击“开始并锁定鼠标”。进入画面和开始训练是两个步骤。</li><li>左右移动鼠标确认转向，再试 WASD、左键射击、R 换弹。Esc 解锁并暂停。</li></ol>
    ${figure('fps-range.jpg', '实际 WebGL 靶场中的十二个 Bot、中央准星、步枪与运行状态', '工具实际运行截图，2026-10-16，Chromium、流畅画质。已取得原生鼠标锁定；图中没有用演示成绩冒充训练效果。')}
    <h2>灵敏度相同，手感仍然不一样？</h2>
    <p>游戏内的数值不能单独描述浏览器里的鼠标移动。DPI、系统加速、原始输入支持、视野和宽高比都会影响手感。可以先在原游戏量一下转一整圈需要移动多少厘米，再把 cm/360 和 DPI 填到高级设置里。</p>
    <p>工具也提供校准流程：进入校准、主动锁定鼠标后，沿水平方向移动当前流程要求的 10 cm，再左键确认。桌面留好空间，不要把“在屏幕上移动了多少像素”当成鼠标在桌面上的距离。改变设备、浏览器或系统加速后，应重新核对。</p>
    <p>浏览器不支持原始输入时，会回退普通鼠标输入并提示校准。即使成功请求原始输入，也不能据此断言与原游戏已经一致；最终仍以实际测量和操作感受为准。先固定一套设置，再比较自己的多轮记录。</p>
    <h2>这次练哪一种动作</h2>
    ${table(['目标', '选什么', '先看什么'], [
      ['练鼠标落点与目标切换', '小球点击', '准确率、首次命中与切换时间；本模式关闭散布和后坐力。'],
      ['做自由热身', 'Bot 自由热身', '设置目标区域、数量和是否移动，确认仅爆头开关符合自己的目的。'],
      ['练松键或反向急停后的首发', '横移急停', '先完成指示横移，再停稳首发；提前开枪会单独计数。'],
      ['练掩体边缘的预瞄', '掩体预瞄', '按提示探头、首发、回安全区。没有完成回位，下一轮不会成立。'],
      ['观察短连发与后坐力补偿', '短连发与压枪', '弹着角度分布和命中率；不要把近似模型当成原游戏弹道图。'],
    ])}
    <p>还可以选择点射微调、移动跟枪和多目标切换。选项多并不意味着每轮都要换一个；先针对一个动作保持同样的时长、距离和难度，记录才容易解释。</p>
    <h2>为什么打中了，回合仍然不成功</h2>
    <p>急停和预瞄有自己的回合规则。比如还没完成要求的横移就开枪，会记为提前开枪；移动中的首发即使碰到头部，也不算停稳首发成功。预瞄完成一侧后，还要真正回到中央安全区并满足遮挡和停留条件，不能留在外面连续刷靶。</p>
    <p>总命中率统计实际射击，有效首发和成功回合则有各自条件。看报告时同时看分母与“提前开枪”，不要只挑最高的百分比。限时结束和中途结束也应分开理解。</p>
    <h2>掉帧或切出页面，先暂停</h2>
    <p>失焦、隐藏标签页、丢失鼠标锁定或较长渲染停顿时，训练会暂停，恢复需要再次主动点击。如果经常提示画面停顿，可以选择流畅画质、关闭不必要的页面，再重新开始；硬撑着运行会让反馈失去参考价值。</p>
    <p>声音和全屏受浏览器许可限制。没有声音时先检查页面音量、静音状态和浏览器设置，不要为了排查音频反复改变灵敏度。</p>
    <h2>记录怎么用才有意义</h2>
    <p>记录保存在当前浏览器，不是账号排行榜。比较时保留模式、距离、目标大小、时长和灵敏度一致，并留意配置版本变化。若要判断是否对原游戏有帮助，需要在原游戏中另外观察，不能从浏览器分数直接推导。</p>`,
    sources: [
      { title: 'MDN：Pointer Lock API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Pointer_Lock_API' },
      { title: 'CloverTools：FPS 练枪', url: 'https://clovertools.cn/tools/fun/fps-aim-trainer/' },
      { title: '本工具声音素材来源与还原边界', url: 'https://clovertools.cn/fps/audio/CREDITS.md' },
    ],
  }),
  article({
    slug: 'm3u8-download-mp4-gaps',
    title: 'M3U8 下载成 MP4：先看分片，再看导出与缺口',
    description: '用自行生成的八秒 HLS 样本走完下载和 MP4 封装，说明普通导出、边下载边保存、缺失分片报告和 CORS 的真实限制。',
    category: '媒体处理', toolSlug: 'm3u8-downloader', readingMinutes: 7,
    image: imageRoot + 'hls-complete.jpg',
    focus: 'M3U8 是列表，下载成功的分片还要按顺序封装。跳过缺片能让任务继续，但不能恢复缺失的画面。',
    notice: '仅处理你有权下载的内容。媒体请求发往资源源站，分片和导出在浏览器处理；本工具没有绕过 DRM、登录授权或 CORS 的代理。',
    content: `<p>拿到一个 M3U8 地址，不等于拿到了一整个视频文件。它通常是一张播放列表，里面指向一段段媒体；主列表还可能先列出不同清晰度。下载器要读取列表、取得分片，再按顺序把可用内容封装成输出。</p>
    <p>所以排查时可以分两步看：分片有没有完整取得，取得之后有没有成功封装。只看到进度到了 100%，还不能说明画面完整、音轨正常。</p>
    <h2>先用一段可核对的短样本</h2>
    <p>这里的演示是自行用 FFmpeg 生成的 8 秒测试图与 440 Hz 音频，包含四个两秒分片，没有登录或 DRM。你可以把下面这个本站样本地址粘到<a href="/tools/daily/m3u8-downloader/">M3U8 下载器</a>里复现，不必拿第三方视频试错。</p>
    ${pre('https://clovertools.cn/article-assets/hls-sample/index.m3u8')}
    <ol><li>粘贴播放列表地址，导出格式先保留 MP4，不勾选特大视频模式。</li><li>点击“解析链接”。如果出现清晰度选择，先选一项，再载入对应媒体列表。</li><li>检查分片数量和范围。本例应显示 4 个分片、00:08。</li><li>点击下载并导出，等待浏览器完成封装。首次处理需要加载约 31 MiB 的本地引擎，可能比下载这段短视频本身更久。</li><li>保存后播放，检查视频时长、声音、开头与结尾，而不只看文件是否出现。</li></ol>
    ${figure('hls-complete.jpg', '四个分片全部成功、零跳过，并已生成八秒 MP4 的实际下载器界面', '本地构建实际操作截图，2026-10-16。源是自行生成的测试媒体；四个分片下载成功，MP4 时长 8 秒，并通过完整解码检查。')}
    <h2>出现缺片，输出会怎样</h2>
    <p>当前工具对 404、410 和列表中明确声明的缺口会跳过；其他分片故障会在设置次数内重试，仍失败才标记跳过。任务可以继续，但被跳过的画面不会凭空恢复。</p>
    <p>成功片段会按原顺序接续，导出时不保留缺失片段对应的时间空洞。这会缩短成片时长。若缺口后的画面依赖前面丢失的帧，仍可能到下一个关键帧才恢复正常，不能把“导出成功”理解为修好了所有损坏。</p>
    <p>有跳过时，下载缺失报告查看序号、原时间范围、状态和尝试次数。报告可能包含带令牌的资源地址，分享前应检查。密钥、初始化片段、存储或封装出现系统性问题时，工具会暂停，而不是把整条视频静默当成缺片处理。</p>
    <h2>普通导出和特大模式怎么选</h2>
    ${table(['情况', '模式', '实际边界'], [
      ['短片或大小可控，想保存常规 MP4 / TS', '普通导出', '选中媒体单次导出上限 384 MiB；手机或内存不足时可能更低。'],
      ['较大媒体，希望逐片写入文件', '特大视频：边下载边保存', '需要支持文件选择与写入的浏览器和安全上下文，优先 Chrome / Edge。'],
      ['浏览器不支持流式文件保存', '保留普通导出', '不能仅靠勾选一个选项获得系统不提供的文件能力。'],
    ])}
    <p>特大模式先准备流式保存，再由你点击选择文件并开始。原格式按媒体实际封装确定扩展名；选择 MP4 时输出的是 fragmented MP4，较老的播放器未必支持。</p>
    <p>它降低了整文件装进内存的需要，但不取消单片大小、缓存配额和磁盘限制。源分片缓存、浏览器临时写入文件、最终文件可能同时占空间。</p>
    <h2>刷新之前，先知道哪些东西还没落盘</h2>
    <p>普通模式在当前浏览器缓存成功分片，刷新后重新解析相同列表与范围可尝试复用；播放列表变化或清理站点数据会影响缓存匹配。</p>
    <p>流式模式会保留任务快照，恢复时重新申请文件权限，并从缓存按顺序重建。浏览器的写入流通常要关闭才提交最终文件，刷新或关闭页面不能保证自动提交当前部分。需要先留住已完成内容时，用“保存当前部分”，再决定是否离开。</p>
    <h2>这些限制，增加并发也解决不了</h2>
    <ul><li><strong>CORS：</strong>源站必须允许浏览器读取列表、密钥与分片。工具不能伪造 Origin / Referer，也没有替你绕过限制的服务端代理。</li><li><strong>音轨：</strong>当前不合并独立外置音轨和字幕，检测到相关外置音轨配置会明确拒绝，避免导出一份看似成功的无声视频。</li><li><strong>加密：</strong>支持标准 AES-128 的相应列表处理，不支持 SAMPLE-AES / DRM；支持某种加密格式也不等于获得内容访问权。</li><li><strong>直播：</strong>解析的是当时的列表快照，不是持续直播录制器。</li></ul>
    <p>并发越高未必越快，还可能触发源站限流。遇到明确的 429，可以参考<a href="/guides/http-429-retry-after/">限流与重试的排查</a>。先保留缓存和错误报告，再针对失败原因处理，通常比不断清空重来省事。</p>`,
    sources: [
      { title: 'RFC 8216：HTTP Live Streaming', url: 'https://www.rfc-editor.org/rfc/rfc8216' },
      { title: 'Chrome：File System Access API', url: 'https://developer.chrome.com/docs/capabilities/web-apis/file-system-access' },
      { title: 'FFmpeg：concat demuxer', url: 'https://ffmpeg.org/ffmpeg-formats.html#concat' },
    ],
  }),
  article({
    slug: 'base-converter-large-integers',
    title: '进制转换别先转成 Number：大整数、负数和补码怎么区分',
    description: '实际转换 9007199254740993，核对 BigInt 的整数结果，并区分十六进制前缀、非法数字、负号表示与固定宽度补码。',
    category: '开发实用', toolSlug: 'base-converter', readingMinutes: 5,
    image: imageRoot + 'base-bigint.jpg',
    focus: '先确定原进制，再输入原始数字文本。这个工具转换整数的数值表示，不推断字节宽度、编码或有符号补码。',
    notice: '数值在当前浏览器处理。支持大整数不代表无限资源；极长输入仍会受到设备内存与计算时间限制。',
    content: `<p>把十六进制 <code>ff</code> 转成十进制很直观，结果是 255。真正容易踩坑的是长编号：如果先经过 JavaScript 的 Number，再交给转换器，数字可能已经在上一步被舍入，后面再精准也找不回原值。</p>
    <h2>用一个刚超过安全整数范围的数试试</h2>
    <p>打开<a href="/tools/dev/base-converter/">进制转换器</a>，原进制选十进制，目标进制选十六进制，直接粘贴字符串 <code>9007199254740993</code>，点击转换。</p>
    ${figure('base-bigint.jpg', '十进制 9007199254740993 实际转换为十六进制 20000000000001', '工具实际操作截图，2026-10-16。输入来自原始数字文本，没有先经过 Number。')}
    <p>结果应为 <code>20000000000001</code>。可以把这个结果放回输入框，原进制改成十六进制、目标改成十进制，确认回到原值。</p>
    ${pre("Number('9007199254740993')        // 9007199254740992\nBigInt('9007199254740993').toString(16) // '20000000000001'")}
    <p>Number 的安全整数上限是 <code>9007199254740991</code>。超出后并非每一个整数都无法表示，而是不能保证相邻整数都能精确区分。当前工具逐位累积 BigInt，因此应从文件、响应或文档里复制原始数字文本，避免先在会丢精度的环节绕一圈。</p>
    <h2>输入只放数字，进制在下拉框选</h2>
    <p>当前提供二、八、十、十六、三十二进制，支持整数和前面的负号，不处理小数。十六进制字母不区分大小写。工具不自动剥掉 <code>0x</code>、<code>0b</code> 前缀，也不接受千位分隔符、内部空格或科学计数法。</p>
    ${table(['输入与原进制', '应得到什么', '原因'], [
      ['255，十进制 → 十六进制', 'ff', '普通整数转换。'],
      ['FF，十六进制 → 十进制', '255', '十六进制字母不区分大小写。'],
      ['-255，十进制 → 十六进制', '-ff', '保留负号，不推断固定字节宽度。'],
      ['102，二进制', '字符错误提示', '二进制只能使用 0 和 1。'],
      ['0xff，十六进制', '字符错误提示', '先去掉前缀，输入 ff。'],
    ])}
    <h2>-ff 与 ff01 不是同一个约定</h2>
    <p>这个转换器把负数显示为负号加绝对值。例如 -255 到十六进制是 -ff。它没有让你指定 8、16 或 32 位，因此不会猜测“我要看哪种宽度的二进制补码”。</p>
    <p>如果你看到设备协议中的 <code>ff01</code>，必须先查协议如何规定字节顺序、总位数和有符号解释。按无符号十六进制转换，它是 65281；按 16 位二进制补码解释，则可以表示 -255。这是两种解释，不能只靠换进制按钮决定。</p>
    <h2>遇到错误，先核对原进制</h2>
    <p>报“字符不是该进制数字”，通常不是计算失败，而是输入与原进制不匹配。检查前缀、数字里的字母、复制来的空格和标点，再确认有没有把指数写法误当成长整数。</p>
    <p>导出的结果不会保留为存储宽度补齐的前导零。如果需要报文中固定两位或四位的字节表示，应在协议明确宽度后另做填充，不能把数值转换结果直接当作完整报文字节布局。</p>`,
    sources: [
      { title: 'MDN：Number.MAX_SAFE_INTEGER', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Number/MAX_SAFE_INTEGER' },
      { title: 'MDN：BigInt', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/BigInt' },
    ],
  }),
  article({
    slug: 'keyboard-test-key-code',
    title: '键盘在线测试能查什么：按键记录、左右 Ctrl 和连发的区别',
    description: '用浏览器实际键盘事件认识 key 与 code，按顺序排查单键、修饰键和长按，并说明在线测试无法单独判断轴体、延迟和硬件连击。',
    category: '日常排查', toolSlug: 'keyboard-test', readingMinutes: 5,
    image: imageRoot + 'keyboard-events.jpg',
    focus: '它记录当前网页实际收到的 keydown。先确认页面焦点，再逐键测试；网页没收到某个键，不能立刻断定键盘坏了。',
    notice: '截图由浏览器自动化输入产生，用来说明字段和界面，不是物理键盘的硬件检测报告。工具没有读取后台或其他应用的按键。',
    content: `<p>某个键偶尔没反应，先弄清“电脑没识别”，还是“当前程序没处理”。<a href="/tools/daily/keyboard-test/">键盘测试器</a>能显示这张网页收到的键盘事件，适合快速核对按键名称、物理位置代码和修饰键；它不能直接检查键盘内部电路。</p>
    <h2>先点页面，再一颗一颗按</h2>
    <ol><li>用电脑打开测试器，点击“请按下任意键”所在的区域，让焦点回到网页。</li><li>先短按几个普通字母，观察大字显示和下面的 code，再看最近记录。</li><li>分别短按左、右 Ctrl 或 Shift，核对物理位置代码。</li><li>最后再尝试长按和组合键，把现象分开记录，别一开始同时按很多键。</li></ol>
    ${figure('keyboard-events.jpg', '键盘测试器实际收到 A、Shift+A、方向键和左 Ctrl 的事件记录', '工具实际界面，2026-10-16。此图使用浏览器自动化发送键盘输入，展示事件字段，不代表某台实体键盘已通过检测。')}
    <h2>为什么大字都叫 Ctrl，下面却不同</h2>
    <p><code>key</code> 表示这次按键的逻辑含义，会受到键盘布局和修饰键影响；<code>code</code> 更接近键在键盘上的物理位置。例如左 Ctrl 和右 Ctrl 的 key 都可以是 Control，但 code 分别是 <code>ControlLeft</code> 与 <code>ControlRight</code>。</p>
    <p>工具为了便于阅读，会把单个字母显示为大写。所以按 A 和 Shift+A，大字都可能是 A；要区分它们，应看下方有没有 Shift 修饰信息。非英文布局下，KeyA 也不一定输入字符 a，不能只看 code 判断输出文本。</p>
    <h2>长按出现很多条，算连击吗</h2>
    <p>操作系统通常会在长按后重复发送 keydown，因此记录连续增加本身并不证明轴体有问题。当前工具主要展示 keydown，最多保留最近 20 条，没有把 repeat 标记、每次 keyup 和间隔统计做成硬件诊断。</p>
    <p>怀疑短按触发两次时，可以连续做几次独立短按，同时在系统记事本或另一个应用里观察。若多个应用都稳定复现，再排查驱动、连接和键盘本身；不要从一张长按记录截图就下结论。</p>
    <h2>某些组合键没有显示，先看谁拿走了它</h2>
    <p>浏览器和操作系统会保留一些快捷键，比如切换应用、地址栏、系统功能键。网页即使阻止默认行为，也不保证能截获所有组合。笔记本的 Fn 键往往在硬件或固件层处理，也未必向网页发出独立事件。</p>
    <p>如果光标在地址栏、输入法候选栏或别的窗口，测试页就没有焦点。输入框和文本区里的按键也会被当前工具忽略，避免干扰输入。测试普通按键前，先回到页面区域。</p>
    <h2>它适合做初筛，不能替代这些检测</h2>
    <ul><li><strong>当前按住的全部键：</strong>页面显示最近事件，不提供完整的按下/松开状态图。</li><li><strong>全键无冲：</strong>没有某次事件，可能与网页、系统快捷键或键盘矩阵有关，单次结果不足以归因。</li><li><strong>延迟、回报率与轴体寿命：</strong>本工具没有测量这些硬件参数。</li><li><strong>物理故障：</strong>不能只靠网页记录判断接触不良、热插拔座或轴体损坏。</li></ul>
    <p>比较可靠的排查顺序是：网页确认字段和基本响应，换应用复核，再换 USB 接口、连接方式或另一台设备。把“在哪些环境下会出现”记清楚，比一句“在线测试没过”更方便定位。</p>`,
    sources: [
      { title: 'MDN：KeyboardEvent.key', url: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/key' },
      { title: 'MDN：KeyboardEvent.code', url: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/code' },
      { title: 'MDN：KeyboardEvent.repeat', url: 'https://developer.mozilla.org/en-US/docs/Web/API/KeyboardEvent/repeat' },
    ],
  }),
  article({
    slug: 'perler-beads-pattern-materials',
    title: '图片转拼豆图纸：先控制格数，再核对手里的豆子',
    description: '用四叶草演示走完图片转拼豆、限制颜色、查看编号和导出材料表的过程，解释透明背景、实物色差与图纸编号的边界。',
    category: '手作与图像', toolSlug: 'perler-beads', readingMinutes: 6,
    image: imageRoot + 'beads-settings.jpg',
    focus: '先让轮廓在小网格里看得清，再决定颜色。图纸编号用于找位置，HEX 用于对照颜色，两者都不等于厂商实物色号。',
    notice: '图片在当前浏览器处理。本文使用工具自带的原创四叶草，没有上传个人照片；生成图纸不能替代实物色卡和制作时的安全说明。',
    content: `<p>图片转成拼豆图纸后，最先要看的不是细节够不够多，而是缩小以后还能不能认出它。一张带渐变和阴影的照片，如果直接铺到很多格里，会得到大量近似色，买豆和摆放都更费力。</p>
    <p>可以先从轮廓清楚、背景简单的图案开始。这篇用工具自带的四叶草走一遍：它没有照片隐私，也方便你打开工具后逐项对照。</p>
    <h2>先做一张 32 格的图纸</h2>
    <ol><li>打开<a href="/tools/fun/perler-beads/">拼豆图纸生成器</a>，点击“试试四叶草示例”。上传自己的图时，支持 PNG、JPG、WebP，当前文件上限为 12 MB。</li><li>把“最长边豆数”设为 32。正方形示例得到 32 × 32 网格；长方形图片会按比例计算另一边，最长边不是固定的宽度。</li><li>把色板来源切到“使用手头的豆色”，填入下方五个 HEX 值。</li><li>保留“显示颜色编号”，检查叶片轮廓与中心的小方块，再看用量清单。</li></ol>
    ${pre('#254B39, #4C956C, #A8C88A, #F2C66D, #FFFCF5')}
    ${figure('beads-settings.jpg', '32×32 四叶草拼豆预览、自定义五色输入与实际材料数量', '工具实际操作截图，2026-10-16。候选色板有五色，最后图案只使用了四色，合计 512 颗豆子。')}
    <h2>为什么五色输入，最后只剩四色？</h2>
    <p>自定义色板规定工具可以选哪些颜色，不要求每种颜色都出现。图案中的像素会匹配到候选色，未被使用的颜色不会进入最终材料表。这次四叶草外围是透明的，浅白候选色没有被用到。</p>
    ${table(['图纸编号', 'HEX', '本次用量'], [['01', '#254B39', '220'], ['02', '#4C956C', '240'], ['03', '#A8C88A', '36'], ['04', '#F2C66D', '16']])}
    <p>四项相加是 512。32 × 32 一共有 1024 个位置，透明区域留空，因此不用买满 1024 颗。这些数字只对应这里的演示和设置，换图或改格数后应重新看材料表。</p>
    <h2>先调格数，再减颜色</h2>
    <p>如果预览看起来像一团色块，先判断是格数太少，还是原图背景干扰太多。给小头像增加一点格数，往往比加很多颜色更有帮助；但小字、发丝和很细的线在低分辨率下仍然容易消失。</p>
    <p>自动取色适合先看大致效果，“最多使用颜色”控制上限，实际颜色可能更少。手里已经有豆子时，改用自定义色板更容易估算材料。它接受 2–32 个不同的六位 HEX 色值；当前版本没有内置厂商品牌色卡，也没有在工具里提供画笔逐格修改。</p>
    <h2>图纸编号，不是商品编号</h2>
    <p>图纸里的 01、02 只在当前图纸中有意义。改动图片、格数或色板后，编号可能重新分配。买豆时不要把“01”直接当成某个品牌的色号，要把 HEX、实物色卡和自己的库存放在一起比对。</p>
    <p>屏幕亮度、显示器和豆子的材质都会带来色差。需要严格配色的作品，建议先摆一小块对照，满意后再展开，而不是只凭预览一次买齐。</p>
    ${figure('beads-chart.png', '拼豆工具直接导出的编号图纸，含行列坐标、四种颜色及材料表', '上面这组设置的原始 PNG 导出，未重新绘制；底部保留用量和编号说明。')}
    <h2>透明边缘要单独看一眼</h2>
    <p>当前算法把透明度低于 128/255 的像素留空；其余半透明像素先与白色合成，再做颜色匹配。所以有柔边的透明 PNG，边缘可能出现浅色。如果原图背景本来就是白色而非透明，白色区域也可能变成需要摆豆的位置。</p>
    <p>生成器不会自动识别主体或替你抠图。原图有复杂背景时，先裁剪和清理背景通常比反复增加颜色有效。</p>
    <h2>导出前核对三处</h2>
    <ul><li><strong>图案：</strong>放大看轮廓、孤立色点，以及左右是否需要镜像；当前工具不自动镜像。</li><li><strong>清单：</strong>核对每色数量与总数，按自己的损耗和备用需求备料。</li><li><strong>交接：</strong>PNG 编号图纸用于找位置，<a href="/article-assets/beads-materials.csv" download>本次导出的 CSV</a>便于整理库存；两份应来自同一组设置。</li></ul>
    <p>打印会打开专门的图纸页面，但不同打印机的缩放会改变纸上大小。图纸不承诺按某种豆板的实物间距 1:1 输出；摆放时仍应以网格坐标和自己的底板为准。</p>`,
    sources: [
      { title: 'CloverTools：拼豆图纸实际使用入口', url: 'https://clovertools.cn/tools/fun/perler-beads/' },
      { title: 'MDN：ImageData 像素数据', url: 'https://developer.mozilla.org/en-US/docs/Web/API/ImageData/data' },
    ],
  }),
  article({
    slug: 'avatar-seed-transparent-export',
    title: '做一个能重现的头像：种子、配色和透明导出怎么留',
    description: '从固定种子生成几何头像，实际导出透明 PNG 与 SVG，说明怎样保存完整设置、选择尺寸，以及为什么种子不等于账号身份。',
    category: '手作与图像', toolSlug: 'avatar-generator', readingMinutes: 5,
    image: imageRoot + 'avatar-settings.jpg',
    focus: '想以后找回同一个头像，要保存种子和全部外观设置。PNG 尺寸影响像素数量，SVG 适合继续缩放和排版。',
    notice: '头像在当前浏览器生成，不调用人脸服务。种子只是生成输入，不能当作密码、身份证明或保证全球唯一的标识。',
    content: `<p>随机到一个喜欢的头像，过几天却找不回来，通常是只留了图片，没有留下生成它的设置。CloverTools 的头像由种子和外观选项一起决定；保留这些信息，比反复点击随机按钮更容易做出一套一致的头像。</p>
    <p>这里使用一个普通字符串 <code>Clover-Workshop</code>，不需要填真实姓名，也不需要上传照片。</p>
    <h2>先固定一个版本</h2>
    <ol><li>打开<a href="/tools/fun/avatar-generator/">头像生成器</a>，在“昵称或生成种子”输入 <code>Clover-Workshop</code>。</li><li>画风选“轨道机器人”，保留默认金色角色和浅色背景，外框选圆形。</li><li>PNG 尺寸选 512 × 512，勾选“透明背景”。</li><li>点击“复制生成设置”，把复制的内容存到自己的笔记，再分别下载 PNG 和 SVG。</li></ol>
    ${figure('avatar-settings.jpg', 'Clover-Workshop 种子对应的机器人头像，已选择 512×512 透明背景', '工具实际操作截图，2026-10-16。棋盘格用于预览透明区域，不会被画进导出的 PNG。')}
    <h2>哪些设置会改变头像</h2>
    <p>种子影响几何图形的细节；画风决定使用机器人、像素小怪兽还是几何印记。角色色、背景色、外框形状和透明开关也属于外观设置。只记住种子，却换了画风或颜色，当然会得到不同画面。</p>
    <p>“看看其他小伙伴”展示的是相关变体，点选后种子会改变。找到喜欢的一版后，再复制一次完整设置。随机按钮也会替换种子，不是给原图增加一个临时滤镜。</p>
    <p>本次核对时，先把种子改成另一个字符串，再恢复 <code>Clover-Workshop</code>，在其余设置不变的情况下得到相同 SVG。这个结论针对当前生成实现；想长期保存一个版本，仍应把导出文件一同留存，未来算法调整未必维持相同外观。</p>
    <h2>透明了，为什么角色里还有颜色？</h2>
    <p>透明开关移除的是背景底板，不会把机器人的脸、描边或造型中的装饰也清掉。下图是工具直接导出的透明 PNG；放在深色或浅色页面上，透明区域会露出页面自身的背景。</p>
    ${figure('avatar-transparent.png', '工具原始导出的 512×512 机器人透明 PNG，四角没有背景底板', '原始 PNG 导出，512 × 512，未抠图或重画；角色自身的色块和装饰仍然保留。')}
    <h2>PNG 和 SVG 怎么选</h2>
    ${table(['用途', '建议格式', '需要留意'], [
      ['聊天头像、表单上传、普通社交平台', 'PNG', '平台可能再次缩放或裁成圆形，上传后看一眼边缘和留白。'],
      ['文档排版、网页图标、继续调整矢量图', 'SVG', '保持矢量缩放；并非所有平台接受 SVG 上传。'],
      ['需要较大的位图素材', '1024 × 1024 PNG', '选择尺寸后重新导出，放大已有的 256px 图片不会补回细节。'],
    ])}
    <p>当前 PNG 提供 256、512、1024 三档。SVG 保存的是矢量图形，不依赖 PNG 尺寸选择获得清晰度。两种文件都可保留，避免以后为了换场景重新生成。</p>
    <h2>一组头像怎样保持协调</h2>
    <p>如果为一个小项目准备几位角色，可以固定画风、角色色和外框，再只改变种子。先把几个导出放在同一背景上看，检查留白、边缘和小尺寸时的识别度。</p>
    <p>种子到图形不是身份验证协议，也不保证不同输入永远生成不同图案。不要用“头像一样”判断账号是同一个人。工具能帮你留下统一的视觉风格，账号身份仍需要自己的账号体系负责。</p>`,
    sources: [
      { title: 'CloverTools：头像生成器', url: 'https://clovertools.cn/tools/fun/avatar-generator/' },
      { title: 'MDN：SVG', url: 'https://developer.mozilla.org/en-US/docs/Web/SVG' },
    ],
  }),
  article({
    slug: 'markdown-checklist-export',
    title: '用 Markdown 写一份清单：预览、草稿和导出各管什么',
    description: '以骑行清单为例，写任务列表、表格和代码块，再核对 .md、HTML 与富文本的区别，说明本地草稿和外链图片的限制。',
    category: '写作与文档', toolSlug: 'markdown', readingMinutes: 5,
    image: imageRoot + 'markdown-split.jpg',
    focus: '.md 保留写作源码，HTML 保留渲染后的文档。自动草稿用于继续写，正式内容仍要另存文件。',
    notice: '编辑和草稿保存在当前浏览器。正文里的外链图片可能向图片所在网站发送请求；导出的 HTML 也不会自动打包外链资源。',
    content: `<p>Markdown 适合把内容先写清楚，再决定放到哪里。它不需要你先挑字体和调边距，但也不是 Word 文件：源码、预览和导出后的文档，是三种不同的东西。</p>
    <p>下面用一份周末骑行清单试一遍。路线和距离是写作演示，不是实际出行建议。</p>
    <h2>从这段源码开始</h2>
    <p>打开<a href="/tools/dev/markdown/">Markdown 编辑器</a>，将下面内容粘到左侧。右侧会出现标题、勾选清单和表格。也可以下载<a href="/article-assets/cycling-checklist.md" download>完整示例 .md</a>，用“打开 .md”载入。</p>
    ${pre('# 周末骑行清单\n\n出发前先看天气，再决定走哪一条路线。\n\n## 随身物品\n\n- [x] 头盔\n- [ ] 备用内胎\n- [ ] 饮水\n\n## 两条备选路线\n\n| 路线 | 距离 | 路面 |\n| --- | --- | --- |\n| 河堤往返 | 18 km | 铺装路 |\n| 公园环线 | 9 km | 铺装路 |')}
    ${figure('markdown-split.jpg', 'Markdown 左侧源码与右侧骑行清单预览，含任务列表、两行表格和代码块', '工具实际操作截图，2026-10-16。截图中的路线和距离为演示数据，表格实际渲染为两条记录。')}
    <h2>三个经常让预览不对的地方</h2>
    <p>标题的 <code>#</code> 后面要留空格。无序列表用减号和空格，任务列表再接 <code>[ ]</code> 或 <code>[x]</code>。如果只是想让正文分段，用空行比不断按一次回车更可靠；不同 Markdown 渲染器对单个换行的处理可能不同。</p>
    <p>表格需要表头下面那一行分隔符。代码块则用三枚反引号包起来，后面可以写语言名，比如 <code>js</code>。代码块里的符号应作为代码显示，不要为了让它“看起来像代码”手工塞很多空格。</p>
    <p>如果预览里有一大片内容意外变成代码，往前找有没有漏掉闭合的三枚反引号。排查时先缩小到出问题的一小段，再恢复整篇，比逐个乱改标点更容易定位。</p>
    <h2>写长一点以后，再用这些功能</h2>
    <p>分屏适合边写边看；编辑视图留给连续输入；预览视图用于交付前通读。目录大纲按照标题组织内容，先把标题层级写好，跳转才有意义。</p>
    <p>需要修改重复词语时可打开查找替换，先确认匹配数量，再决定单处替换还是全部替换。工具栏的加粗、链接、表格等按钮会插入相应语法，最后仍能看到和保存源码。</p>
    <h2>交给别人之前，选对出口</h2>
    ${table(['按钮', '得到什么', '适合做什么'], [
      ['下载 .md / 复制源码', '带 Markdown 标记的原始文本', '继续编辑、放进代码仓库、交给支持 Markdown 的系统。'],
      ['下载 .html', '含基础排版样式的 HTML 文档', '在浏览器打开阅读；当前导出不会把外链图片下载进文件。'],
      ['复制 HTML', '渲染后的 HTML 片段', '粘到接受 HTML 的编辑系统；不是完整的网站部署。'],
      ['复制富文本', '提供给剪贴板的富文本内容', '尝试粘到文档软件；目标软件可能改样式，不支持时会降级。'],
    ])}
    <p>本次示例已实际下载 .md 和 .html，导出的 HTML 能读到“周末骑行清单”和表格。要交付给别人时，最好用对方会使用的软件再打开一次，而不是只看在线预览。</p>
    <h2>自动草稿，留在这台浏览器里</h2>
    <p>编辑器会把草稿写到当前站点的浏览器本地存储，正常刷新可以继续写。它不是跨设备同步，也不是版本历史。换浏览器、用隐私模式、清理站点数据，都会影响这份草稿；重要内容请及时下载 .md。</p>
    <p>文中使用外链图片时，还要考虑链接过期和离线阅读。下载 HTML 不等于把图片资源一并保存；需要长期归档的文档，应同时保存自己有权使用的素材，并在目标环境核对引用。</p>`,
    sources: [
      { title: 'GitHub Flavored Markdown 规范', url: 'https://github.github.com/gfm/' },
      { title: 'MDN：Window.localStorage', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Window/localStorage' },
    ],
  }),
  article({
    slug: 'fetch-failed-to-fetch',
    title: 'Failed to fetch 怎么排查：先分清请求没出去，还是响应读不到',
    description: '浏览器提示 Failed to fetch 时，从 Network、CORS、混合内容和取消请求逐项定位；附能在本机运行的跨源复现样例。',
    category: '接口排错', toolSlug: 'http-tester', readingMinutes: 7,
    image: imageRoot + 'fetch-cors.jpg',
    focus: '先找到失败的那条请求，再看浏览器给出的阻止原因。404、429、500 和 CORS 拦截需要走不同的处理路径。',
    notice: 'HTTP 测试器会从你的浏览器向目标地址发送请求，受 CORS 和浏览器权限限制。请用测试接口，分享截图前删掉令牌与个人数据。',
    content: `<p>看到 <code>TypeError: Failed to fetch</code>，先别急着改 JSON 或增加重试次数。这句话表示浏览器没有向这次 <code>fetch()</code> 提供可读取的响应，单凭它还不能判断是服务器宕机、网络不通，还是浏览器拦住了结果。</p>
    <p>一个容易误判的地方是：<strong>服务器返回了 200，页面仍然可能报 Failed to fetch。</strong> 跨源响应没有通过 CORS 检查时就是如此。反过来，接口返回 404、429 或 500，只要响应可读，<code>fetch()</code> 通常仍会正常返回 Response，需要代码自己检查状态码。</p>
    <h2>先做一次最小复现</h2>
    ${reproduction}
    <p>打开样例后，点击“跨源请求：未允许 CORS”。页面从 8765 端口请求 8766 端口，后者确实返回 JSON，却故意没有提供 <code>Access-Control-Allow-Origin</code>。两个地址只差端口，也属于不同源。</p>
    ${figure('fetch-cors.jpg', '本地跨源请求实际产生 TypeError: Failed to fetch，脚本无法读取响应', '本地复现实拍，2026-10-16，Chromium。截图是样例页面的真实请求结果；它不是 Chrome 开发者工具界面。')}
    <h2>回到你的项目，按这个顺序看</h2>
    <ol><li>打开开发者工具的 Network，选 Fetch/XHR，清空记录后只操作一次。用完整 URL 找到对应请求，注意不要漏掉它前面的 OPTIONS。</li><li>同时看 Console。CORS、Mixed Content、证书、连接失败的提示比页面上的一句“请求失败”更接近原因。</li><li>检查 Request URL、方法、重定向后的地址和状态。路径少了 <code>/api</code>，或者开发代理只在本机启用，都会让线上请求走到错误的位置。</li><li>如果是偶发故障，保留时间、状态与浏览器错误，和服务端日志对照。不要把浏览器看不到响应直接解释成“服务器没收到请求”。</li></ol>
    ${table(['看见什么', '先检查哪里', '接下来怎么做'], [
      ['Console 明确提示 CORS', '允许的 Origin、方法、请求头；OPTIONS 是否通过', '在接口或你可控制的网关上配置许可，再用实际页面来源重试。'],
      ['Mixed Content', 'HTTPS 页面是否请求了 HTTP 地址', '为接口提供可用的 HTTPS 地址，同时检查重定向是否又落到 HTTP。'],
      ['ERR_NAME_NOT_RESOLVED / 连接或证书错误', '域名、DNS、TLS 证书和服务监听', '先恢复网络连通性；页面内的 JSON 代码解决不了连接问题。'],
      ['AbortError / 自己实现的超时', 'AbortController、页面切换、超时时间', '检查是谁取消了请求。不同浏览器或封装层的错误文案可能不同。'],
      ['明确的 401、403、429 或 500', '认证、授权、限流或服务端错误', '响应已到达时按具体状态处理，保留响应体中的错误代码。'],
    ])}
    <h2>CORS 该改哪一边？</h2>
    <p>许可由被访问的服务器返回。给前端的请求头硬加一个 <code>Access-Control-Allow-Origin</code> 不会授予权限，反而可能让请求多一次预检。允许哪些来源、方法和请求头，要与实际请求对应。</p>
    <p>例如页面在 <code>https://app.example.com</code>，接口在另一个域名；接口可以针对可信页面返回 <code>Access-Control-Allow-Origin: https://app.example.com</code>。如果还要携带 Cookie，前端凭据选项、服务端凭据许可、Cookie 的 SameSite / Secure 属性和浏览器的第三方 Cookie 策略都要满足。携带凭据的许可不能简单写成通配符 <code>*</code>。</p>
    <p>预检失败时，浏览器往往不会继续发送实际请求。简单跨源请求则可能已经到达服务器，随后才因为响应许可不足而读不到结果。涉及创建订单、扣款等动作时，尤其不要因页面报错就直接重复提交。</p>
    <h2>两个看似省事的办法，常常让问题更难查</h2>
    <p>把请求改成 <code>mode: 'no-cors'</code>，得到的通常是 opaque 响应，脚本读不到正常状态、响应头和正文。这不能替代接口授权，也不能让原本要读取 JSON 的代码继续工作。</p>
    <p>另一种是把请求搬到公共代理。它会改变数据经过的位置，可能暴露令牌，也不保证解决上游认证。若接口由你维护，更稳妥的做法是在自己的同源后端或受控网关调用上游，并在服务端保护密钥。</p>
    <h2>HTTP 测试器在这里能帮什么</h2>
    <p><a href="/tools/dev/http-tester/">HTTP 测试器</a>适合向允许浏览器调用的测试接口发送请求，查看状态、可读取的响应头和正文。它仍然运行在浏览器里，没有替你绕过 CORS 的服务器代理。某个接口在 curl 能通、在工具里失败，只能说明两个调用环境不同，不能直接证明接口故障。</p>
    <p>如果拿到的响应是 HTML，再看<a href="/guides/json-unexpected-token-html/">Unexpected token '&lt;' 的排查步骤</a>；如果有明确的 429，接着检查<a href="/guides/http-429-retry-after/">限流与 Retry-After</a>。每一步都让新证据决定下一步。</p>`,
    sources: [
      { title: 'MDN：Using the Fetch API', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Fetch_API/Using_Fetch' },
      { title: 'MDN：Cross-Origin Resource Sharing（CORS）', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Guides/CORS' },
      { title: 'MDN：Mixed content', url: 'https://developer.mozilla.org/en-US/docs/Web/Security/Mixed_content' },
    ],
  }),
  article({
    slug: 'json-unexpected-token-html',
    title: "Unexpected token '<'：JSON 接口为什么返回了 HTML？",
    description: '用一个实际返回 HTML 的接口复现 JSON 解析失败，按状态码、Content-Type、重定向和响应正文定位登录页、路径错误与代理错误。',
    category: '接口排错', toolSlug: 'json-formatter', readingMinutes: 6,
    image: imageRoot + 'json-html.jpg',
    focus: '先确认响应是什么，再修解析代码。报错里第一个字符是 < 时，优先查看原始正文是否为 HTML。',
    notice: '本文的登录页来自可下载的本地演示。排查真实接口时，分享响应前请移除 Cookie、令牌、邮箱等个人信息。',
    content: `<p><code>Unexpected token '&lt;'</code> 出现在 <code>JSON.parse()</code> 或 <code>response.json()</code> 附近，最常见的情况是：代码期待 JSON，实际读到的内容却以 <code>&lt;!doctype html&gt;</code> 或 <code>&lt;html&gt;</code> 开头。这里该追查的是响应从哪里来，而不是把尖括号删掉。</p>
    <p>错误措辞会随浏览器版本改变，有时还会显示 “is not valid JSON”。先看响应正文才能下结论：字符 <code>&lt;</code> 是线索，并不能单独证明返回的一定是登录页。</p>
    <h2>200 也可能是一张登录页面</h2>
    ${reproduction}
    <p>在本地样例里点击“把 HTML 当作 JSON 读取”。<code>/api/profile</code> 返回状态 200、类型 <code>text/html</code>，正文是一段演示登录页。页面把同一份文本交给 <code>JSON.parse()</code>，就会看到下面的错误。</p>
    ${figure('json-html.jpg', 'HTTP 200 返回 text/html 登录页，JSON.parse 对同一段正文报 SyntaxError', '本地复现实拍，2026-10-16。状态、响应头、HTML 正文与解析错误均来自实际请求；此页不是开发者工具截图。')}
    <p>这个例子提醒我们，<code>response.ok</code> 只能检查 2xx 状态，不能保证正文符合接口契约。页面和 API 可能共用一个站点，错误路由恰好返回了前端首页，或者认证系统跳转到登录页面，最终都可能得到 200。</p>
    <h2>在 Network 里记下四样东西</h2>
    <ol><li><strong>实际 URL。</strong> 核对域名、路径和查询参数；有重定向时，检查跳转链以及最终地址。fetch 默认会跟随重定向。</li><li><strong>状态码。</strong> 404 优先查路由，401/403 查身份与权限，502/503 查上游；200 则继续看类型与正文。</li><li><strong>Content-Type。</strong> <code>text/html</code> 与 <code>application/json</code> 明显不同；有些 API 使用以 <code>+json</code> 结尾的媒体类型。</li><li><strong>原始正文的开头。</strong> 是你的网站首页、登录表单，还是代理服务生成的错误页？不要只看经过前端包装后的“解析失败”。</li></ol>
    ${table(['响应长什么样', '常见原因', '修复落点'], [
      ['你自己网站的完整首页', 'API 路径未命中，被 SPA 回退规则接管', '让 /api 路由在页面回退之前匹配，并核对生产环境 API 基址。'],
      ['登录页面或认证提示', '会话失效、Cookie 未携带、认证重定向', '按服务的认证流程修复；API 最好用明确的 401/403 和约定的错误格式。'],
      ['带网关或服务商标记的错误页', '上游失败、超时或访问规则触发', '根据状态和请求 ID 查网关/源站日志，不要用 JSON 格式化器“修复”HTML。'],
      ['正文为空', '204 No Content，或服务端没有返回正文', '按接口约定处理空响应；直接解析空字符串通常会得到另一类语法错误。'],
    ])}
    <h2>给读取代码留一个能看懂的出口</h2>
    <p>与其把所有错误都交给 <code>response.json()</code>，可以先检查状态和媒体类型。下面这段适合约定必须返回 JSON 的接口；如果你的接口合法返回 204，应在业务层单独处理。</p>
    ${pre(`async function readJson(response) {
  const type = (response.headers.get('content-type') || '')
    .split(';')[0].trim().toLowerCase();
  const text = await response.text();

  if (!response.ok) {
    throw new Error('HTTP ' + response.status);
  }
  if (type !== 'application/json' && !type.endsWith('+json')) {
    throw new Error('Expected JSON, received ' + (type || 'unknown type'));
  }
  return JSON.parse(text);
}

const response = await fetch('/api/profile');
const data = await readJson(response);`)}
    <p>响应体通常只能消费一次。上面的代码先 <code>text()</code>，再解析保存下来的文本；不要紧接着又对同一个 Response 调用 <code>json()</code>。若确实需要两份独立读取，应在第一次读取前使用 <code>response.clone()</code>，并考虑大响应的内存成本。</p>
    <p>媒体类型检查能给出清楚的提示，但它也不是语法校验。服务器即使写了 JSON 响应头，正文仍可能损坏，所以最后的解析错误仍需保留。</p>
    <h2>格式化器应该放在排查的哪一步</h2>
    <p>确认拿到的确实是 JSON 文本之后，再用<a href="/tools/dev/json-formatter/">JSON 格式化器</a>检查引号、逗号和嵌套层级。它能验证已有文本，不能修复错误的接口地址，也不能替过期会话重新登录。</p>
    <p>如果 Network 根本读不到响应，而 Console 提示 CORS，则回到<a href="/guides/fetch-failed-to-fetch/">Failed to fetch 的排查</a>。先拿到正确响应，再讨论 JSON 的格式，通常能少走一圈。</p>`,
    sources: [
      { title: 'MDN：Response.json()', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Response/json' },
      { title: 'MDN：Response.redirected', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Response/redirected' },
      { title: 'RFC 8259：JSON 格式', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
    ],
  }),
  article({
    slug: 'http-429-retry-after',
    title: '接口返回 429 怎么办：限流、配额和重试失败分开处理',
    description: '读取 429 的响应体与 Retry-After，区分频率限制、额度不足和重试耗尽，并为可重试请求设置等待、次数上限与幂等保护。',
    category: '接口排错', toolSlug: 'http-tester', readingMinutes: 7,
    image: imageRoot + 'http-429.jpg',
    focus: '先看服务端的错误代码和等待要求，再决定重试。exceeded retry limit 只是重试已用完，不能反推出根因一定是 429。',
    notice: '不要把带有 API 密钥的请求转发给陌生代理。排查时使用测试凭据，记录状态、请求 ID 和响应中的错误代码即可。',
    content: `<p><code>429 Too Many Requests</code> 表示服务端正在限制这一类请求。最有用的下一步是读取响应头和错误正文，弄清限制作用于账号、IP、接口还是并发任务，以及多久后才允许继续。</p>
    <p>如果你只看到了 <code>exceeded retry limit</code>，先找它前面的原始错误。它表示调用方把允许的尝试次数用完了，之前可能是 429、503、超时或连接失败。不同 SDK 的包装方式不同，不能把这句话直接翻译成“额度不足”。</p>
    <h2>先看一份完整的 429</h2>
    ${reproduction}
    <p>样例中的第三个按钮会请求一个真实返回 429 的本地接口。响应头写着 <code>Retry-After: 3</code>，正文给出 <code>rate_limited</code>。fetch 会取得这个响应，并不会仅因为状态为 429 就抛出网络异常。</p>
    ${figure('http-429.jpg', '本地接口实际返回 HTTP 429、Retry-After: 3 和 rate_limited 错误正文', '本地复现实拍，2026-10-16。3 秒是这个演示接口返回的等待值，不是所有服务通用的限制。')}
    <h2>四种情况，处理方法不一样</h2>
    ${table(['证据', '可能的原因', '处理方式'], [
      ['短时间调用过密，稍后恢复', '每秒/每分钟请求数限制', '遵守 Retry-After，降低请求速率，给同类请求排队。'],
      ['多个任务一齐开始时失败', '并发数限制', '限制同时进行的任务数，避免每个标签页、Worker 都各自满速重试。'],
      ['正文明确提示余额或配额耗尽', '账号额度、套餐或预算限制', '查看服务后台和计费说明。重复请求通常不会自动补充额度。'],
      ['SDK 只给出 retry limit，或最后一次是超时/503', '重试耗尽，根因尚未确定', '记录每次尝试的原始状态和错误，再针对网络、服务或限流处理。'],
    ])}
    <p>上表是排查方向，具体以服务文档为准。有些厂商把不同错误都放进 429；也有厂商用其他状态表达配额限制。不要只凭一个数字决定要不要充值。</p>
    <h2>Retry-After 有两种写法</h2>
    <p>它可以是秒数，例如 <code>Retry-After: 3</code>；也可以是 HTTP 日期。下面的函数把两种形式换算为等待毫秒，无法识别时返回 null。</p>
    ${pre(`function retryAfterMs(value, now = Date.now()) {
  if (!value) return null;
  const raw = value.trim();
  if (/^\\d+$/.test(raw)) {
    const ms = Number(raw) * 1000;
    return Number.isFinite(ms) ? ms : null;
  }
  const time = Date.parse(raw);
  return Number.isFinite(time) ? Math.max(0, time - now) : null;
}`)}
    <p>拿到等待值后，至少等到它要求的时间再尝试。如果超出了你的任务总时限，就停止并提示稍后继续，不能把很长的等待值截短后立刻打回去。浏览器跨源调用还需要服务端通过 <code>Access-Control-Expose-Headers</code> 暴露 Retry-After，否则 Network 看得见，脚本也可能读不到。</p>
    <h2>没有等待值时，也别立即连发</h2>
    <p>对于服务文档允许重试的请求，可以使用带随机扰动的指数退避。比如等待窗口逐次从 1 秒增长到 2 秒、4 秒，并设最大窗口；在窗口内选一个随机等待值，减少很多客户端同时醒来的冲击。这些数值是客户端策略示例，服务端的明确要求应优先。</p>
    <ol><li>为任务设置总时限和最大尝试次数。日志写清“第几次请求”和原始原因，不要层层封装后只剩“失败”。</li><li>暂停重复点击、轮询和多个客户端的叠加重试；先把总请求量降下来。</li><li>只对允许重试的错误执行策略。认证失败、参数错误、明确的配额耗尽通常需要其他处理。</li><li>等待期间允许取消。超出预算后退出，保留 request ID 和错误代码供后续查询。</li></ol>
    <h2>创建订单这类请求，要先想清楚能不能重发</h2>
    <p>一次超时不代表服务器没有执行动作。对创建订单、发送短信或写入数据的请求，直接重试可能产生重复结果。先查服务是否提供幂等键、操作状态查询或明确的去重机制，再按约定重试。仅把 POST 改成重试三次并不能提供幂等保证。</p>
    <p><a href="/tools/dev/http-tester/">HTTP 测试器</a>可以帮助查看允许跨源访问的测试接口响应，不提供自动限流队列，也不会替你处理计费和幂等。如果连状态都拿不到，请先查<a href="/guides/fetch-failed-to-fetch/">浏览器请求失败的原因</a>。</p>`,
    sources: [
      { title: 'RFC 6585 §4：429 Too Many Requests', url: 'https://www.rfc-editor.org/rfc/rfc6585#section-4' },
      { title: 'MDN：Retry-After', url: 'https://developer.mozilla.org/en-US/docs/Web/HTTP/Reference/Headers/Retry-After' },
      { title: 'RFC 9110 §9.2.2：幂等方法与自动重试', url: 'https://www.rfc-editor.org/rfc/rfc9110#section-9.2.2' },
    ],
  }),
  article({
    slug: 'personality-test-four-axes',
    title: '24 道题之后：人格风格测试的四个维度怎么读',
    description: '24 道原创情境题怎么变成四个字母和四条百分比，X 代表什么，结果能保存成什么，以及它不能回答的问题。',
    category: '趣味工具', toolSlug: 'personality-test', readingMinutes: 6,
    image: imageRoot + 'quiz-result.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先看四条轴的百分比，再看字母。58/42 与 92/8 的差别，比字母本身更能说明这次作答。',
    notice: '答案只保留在当前页面，刷新即丢；结果用于娱乐与自我观察，不是官方 MBTI 测评，也不适合作为招聘或临床依据。',
    content: `<p>做完 24 道题，结果页先给出四个字母，下面还有四条轴。这次演示的作答落在 ENFJ：社交能量 E 58%、信息关注 N 58%、决定侧重 F 58%、生活节奏 J 58%。四个数字都只比一半多一点，字母是组合结果，不是四个标签的叠加。</p>
    <h2>24 道题怎么变成四个字母</h2>
    <p>题库固定 24 题，社交能量、信息关注、决定侧重、生活节奏各 6 题。每题五档，分别记 2、1、0、−1、−2 分，其中一半题目是反向计分。某个维度先累加 6 题得分，再换算成左右两侧的百分比：得分大于 0 取左侧字母，小于 0 取右侧字母，正好为 0 记 X。</p>
    ${table(['维度', '左侧', '右侧', '题目数'], [['社交能量', 'E 向外', 'I 向内', '6'], ['信息关注', 'S 具体', 'N 可能', '6'], ['决定侧重', 'T 逻辑', 'F 感受', '6'], ['生活节奏', 'J 计划', 'P 灵活', '6']])}
    <p>所以百分比描述的是这 6 道题里的作答倾向，不是能力评分。58% 只说明这次略微偏左；换一组情境，完全可能反过来。</p>
    <h2>全部选同一档，为什么得到 XXXX</h2>
    <p>每个维度的 6 道题里，正向和反向各 3 道。从头到尾都选“非常符合”，或者都选“很不符合”，正负正好抵消，四个维度都停在 0，结果就是 XXXX。这不是页面坏了，也不是“没有性格”，而是这套题在极端一致的作答下没有拉开差距。</p>
    <h2>结果页上的四条轴</h2>
    <p>每条轴左边是左侧百分比，右边是右侧百分比，两边相加为 100，中间有一条 50% 的竖线。字母下方的 X 表示该维度持平，描述区会换用另一段文字，而不是硬塞一个字母。百分比接近中间时，别急着把它读成“偏向”，先看差了多少。</p>
    <h2>保存与重测</h2>
    <p>“保存分享卡片”生成一张 1000×1340 的 PNG；“复制偏好地图”把结果码和四条百分比复制成文字；“回看我的答案”会带着已选项从第一题重走，“重新探索”会清空答案。答案只存在当前页面的内存里，刷新或关闭后不会恢复，换设备也不会同步。</p>
    <h2>它不做什么</h2>
    <p>这不是官方 MBTI 测评，没有常模、信效度报告或临床解释。四个字母不能说明岗位匹配、学习能力或关系质量；同一分数在不同情境下的行为也可能不同。把它当成一次可复盘的自我描述，比当成结论更合适。</p>
    ${figure('quiz-question.jpg', '第 5 题的作答界面，顶部显示 05 / 24、已回答 4 / 24，五个选项和上一题按钮都是真实状态', '2026-10-25 实际操作截图：按顺序作答到第 5 题。')}
    ${figure('quiz-result.jpg', '结果页显示 ENFJ、四条轴的百分比、维度描述和保存按钮', '同一次作答的结果页。百分比来自 24 道题的累加，不是随机数。')}
    ${diagram('flow-personality-test-four-axes.svg', '人格测试的作答、计分、结果与保存流程', '作答流程：24 题五档计分，四个维度分别累加，最后得到字母与百分比。')}
    <p>想换一种轻量的自我记录，可以打开<a href="/tools/fun/personality-test/">人格风格测试</a>；如果只想生成一张可复现的分享图，<a href="/guides/avatar-seed-transparent-export/">头像生成器</a>的种子机制更直接。</p>`,
    faqs: [
      { q: '为什么四个维度都是 X？', a: '每个维度有 3 道正向题和 3 道反向题。同一档从头选到尾会正负抵消，四个维度都停在 0，结果就是 XXXX。' },
      { q: '刷新页面后答案还在吗？', a: '不在。答案只保留在当前页面内存里，没有本地存储或账号同步。' },
      { q: '百分比越高，代表这方面能力越强吗？', a: '不。百分比只表示这次作答偏向左侧或右侧的程度，不是能力、熟练度或准确率。' },
    ],
    sources: [
      { title: 'American Psychological Association：Personality', url: 'https://www.apa.org/topics/personality' },
      { title: 'Wikipedia：Myers–Briggs Type Indicator', url: 'https://en.wikipedia.org/wiki/Myers%E2%80%93Briggs_Type_Indicator' },
    ],
  }),
  article({
    slug: 'image-filter-local-canvas',
    title: '图片滤镜在本地做了什么：9 种效果、PNG 导出与画质',
    description: '九个滤镜选项分别对应什么参数，Canvas 为什么要画两遍，导出 PNG 会丢掉什么，以及大图处理的内存边界。',
    category: '手作与图像', toolSlug: 'image-filter', readingMinutes: 5,
    image: imageRoot + 'filter-sepia.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '预览和下载都来自同一块与原图等大的 canvas，所以看到的效果和保存的文件一致。',
    notice: '图片只在浏览器里解码、处理和编码，不会上传；导出 PNG 不保留拍摄信息。',
    content: `<p>把一张 1200×630 的示例图放进去，选“复古棕褐”，点“应用滤镜”，预览仍是 1200×630；再点“下载 PNG”，文件也是这个尺寸。整个过程中没有网络请求把图片发出去，处理发生在 canvas 上。</p>
    <h2>九个选项对应什么参数</h2>
    <p>滤镜值直接写进 canvas 上下文的 <code>filter</code> 属性，不是预渲染的 LUT，也没有强度滑杆。实际参数如下：</p>
    ${table(['选项', '实际参数'], [['灰度', 'grayscale(1)'], ['复古棕褐', 'sepia(0.85)'], ['反色', 'invert(1)'], ['模糊', 'blur(6px)'], ['提亮', 'brightness(1.35)'], ['压暗', 'brightness(0.65)'], ['高对比', 'contrast(1.5)'], ['色相旋转', 'hue-rotate(120deg)'], ['高饱和', 'saturate(2.2)']])}
    <p>“原图”选项跳过第二次绘制，直接把原图放在 canvas 上。其余选项的模糊半径、色相角度都是固定值，不能在这里调。</p>
    <h2>Canvas 上画了两遍</h2>
    <p>代码按原图的自然宽高创建 canvas，先把原图画一遍，再把 <code>ctx.filter</code> 设成对应值画第二遍。预览用 <code>toDataURL()</code> 生成 PNG，下载复用的也是这个结果。预览容器只有 480px 宽，但 canvas 没有被缩小，下载的仍然是原尺寸。</p>
    <h2>导出的 PNG 丢了什么</h2>
    <p>浏览器解码原图后重新编码为 PNG，拍摄时间、相机型号、GPS 等 EXIF 不会写回；如果原图是 JPEG，导出文件可能更大，因为 PNG 是无损格式。带透明背景的 PNG 会保留 alpha 通道，除非滤镜本身改变了像素。色彩配置也可能被重新解释，重要图片请先备份原文件。</p>
    <h2>大图的内存账</h2>
    <p>canvas 每个像素占 4 字节。1200×630 约 3 MB，4000×3000 约 48 MB，手机浏览器还要留出解码和合成的空间。处理超大图时页面卡住，通常不是滤镜算法慢，而是内存和主线程被占满；必要时先在其他工具里缩小图片。</p>
    <h2>它不做什么</h2>
    <p>不做裁剪、旋转、批量处理，也不提供强度滑杆；HEIC、RAW 是否可读取决于浏览器解码能力；处理完不会自动下载，需要再点一次按钮。</p>
    ${figure('filter-settings.jpg', '上传示例图并选择复古棕褐后的实际设置区，状态显示滤镜已应用', '2026-10-25 实际操作截图：选择复古棕褐并应用。')}
    ${figure('filter-sepia.jpg', '复古棕褐滤镜在 1200×630 示例图上的实际预览', '同一张图的滤镜预览。预览与原图同尺寸，没有二次缩放。')}
    ${diagram('flow-image-filter-local-canvas.svg', '选择图片、选择滤镜、Canvas 处理、预览与下载的流程', '处理流程：选图、选滤镜、在 Canvas 上按原图尺寸应用、预览后下载 PNG。')}
    <p>如果要做的是裁切和拼图，<a href="/guides/grid-splitter-center-crop/">九宫格切图</a>处理的是另一类需求；需要可复现的图片生成，可以看<a href="/tools/fun/avatar-generator/">头像生成器</a>。</p>`,
    faqs: [
      { q: '为什么导出的 PNG 比原 JPEG 还大？', a: 'PNG 是无损编码，照片类画面通常比 JPEG 大。需要更小的文件时，先用其他工具转成 JPEG。' },
      { q: '透明背景会保留吗？', a: '源 PNG 的 alpha 通道会保留，滤镜只改变颜色或模糊；但二次编码后边缘像素可能有细微变化。' },
      { q: '为什么预览容器只有 480px 宽？', a: '只是页面展示宽度，canvas 仍按原图自然尺寸创建，下载的图不会被缩到 480px。' },
    ],
    sources: [
      { title: 'MDN：CanvasRenderingContext2D.filter', url: 'https://developer.mozilla.org/en-US/docs/Web/API/CanvasRenderingContext2D/filter' },
      { title: 'Wikipedia：Exif', url: 'https://en.wikipedia.org/wiki/Exif' },
    ],
  }),
  article({
    slug: 'lottery-draw-without-repeat',
    title: '抽奖不重复：名单、中奖人数和浏览器随机的边界',
    description: '六人名单抽两位的实际过程，重复姓名为什么不会被自动合并，Math.random 能保证什么，以及结果怎么留存。',
    category: '趣味工具', toolSlug: 'lottery', readingMinutes: 5,
    image: imageRoot + 'lottery-winners.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先清理名单里的重复姓名，再设置中奖人数；工具只按位置抽取，不替你去重。',
    notice: '随机数来自浏览器的 Math.random，不提供可审计的随机源；需要对外证明公平的抽奖不要只用这个页面。',
    content: `<p>六个人的名单，抽两位，老虎机停下后出现“1. 李四 2. 张三”。名单里如果重复写了同一个名字，页面只会提示“重复”，不会替你去重；两个位置都可能被抽中。</p>
    <h2>先看名单和人数</h2>
    <p>名单每行一个姓名，最多 200 行；中奖人数 1–50，且不能超过名单人数。名单下方的统计会显示总人数；出现重复时会标出“张三×2”这样的提示，但不会删除任何一行。人数超过上限时只取前 200 行。</p>
    <h2>抽取过程</h2>
    <p>点击开始后，脚本把名单复制成一个池子，每次用 <code>Math.random()</code> 取一个下标，抽中后从池子里删掉，再抽下一位。位置不会重复，但姓名可以重复——如果“张三”在名单里出现两次，这两行都可能被抽中。</p>
    <h2>两种展示</h2>
    <p>沉浸式老虎机和拟物拉杆两种模式，音效可以关闭，也支持浏览器全屏。结果在覆盖层里逐个揭晓，结束后可以复制“幸运儿（2 人）：1. 李四 2. 张三”这样的文本，或再抽一次。名单、人数和模式会保存在本机 localStorage，中奖结果不会。</p>
    <h2>能不能当公证抽奖</h2>
    <p>不能。<code>Math.random()</code> 不承诺密码学强度，也没有可复现的种子或审计记录；同一份名单再抽一次会得到不同结果。需要对外证明公平的场合，应使用可验证的随机源、现场录像或第三方公证流程，并把名单和抽奖规则提前固定下来。</p>
    <h2>它不做什么</h2>
    <p>不合并重复姓名、不导入 Excel、不设置权重、不记录历史中奖、不生成海报。结果只存在于当前页面，关闭后需要重新抽；要留存请先复制文本或截图。</p>
    ${figure('lottery-setup.jpg', '六人名单、抽取两位的设置区，人数统计显示共 6 人', '2026-10-25 实际操作截图：输入六人名单并设置抽两位。')}
    ${figure('lottery-winners.jpg', '老虎机揭晓两位中奖者的实际结果页，下方有复制结果和再抽一次', '同一次抽奖的结果。中奖者由 Math.random 逐个抽出，位置不重复。')}
    ${diagram('flow-lottery-draw-without-repeat.svg', '名单检查、随机抽取、揭晓与复制的流程', '抽取流程：检查人数与重复，按位置逐个抽取，揭晓后复制结果。')}
    <p>名单需要先生成或清洗，可以用<a href="/tools/dev/text-toolbox/">文本处理工具</a>去空行和重复；如果只是抽一个随机数，<a href="/guides/random-number-fairness/">随机数生成器</a>的边界更简单。</p>`,
    faqs: [
      { q: '中奖者会重复吗？', a: '位置不会重复，但姓名可能重复。名单里同一个名字出现两次，两行都可能被抽中，先清理名单再抽。' },
      { q: '刷新后名单还在吗？', a: '名单、人数和模式保存在本机 localStorage；中奖结果不保存，刷新后需要重新抽。' },
      { q: '能一次抽 100 人吗？', a: '中奖人数上限是 50，且不能超过名单人数；名单最多 200 行。' },
    ],
    sources: [
      { title: 'MDN：Math.random()', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Math/random' },
      { title: 'MDN：Crypto.getRandomValues()', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Crypto/getRandomValues' },
    ],
  }),

  article({
    slug: 'large-json-in-browser',
    title: '大 JSON 粘进浏览器就卡：先校验，再分段',
    description: '一份 35 万字符的 JSON 实际格式化用了多久，语法错误怎么定位到行列，为什么体积翻倍后等待时间不是翻倍。',
    category: '接口排错', toolSlug: 'json-formatter', readingMinutes: 6,
    image: imageRoot + 'json-large-input.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先点“仅校验”看行列号，再决定要不要格式化；几十万字符的文本不要连续点按钮。',
    notice: '解析和格式化都在浏览器主线程完成，数据不上传；超大文件请优先用命令行工具处理。',
    content: `<p>这次粘贴的 JSON 有 354,708 个字符。从粘贴到点“格式化”、状态栏出现完成，整段约 3.8 秒，输出变成 1,034,726 个字符。测试环境是无头 Chromium，换一台电脑数字会不同，但变化趋势一样：输入越大，等待越不像线性增长。</p>
    <h2>先看字符数</h2>
    <p>输入框右下角实时显示字符数。超过十万字符时，先想清楚这次要解决的是语法还是排版：只是确认能不能解析，点“仅校验”就够了；已经确定合法，再格式化或压缩。</p>
    <h2>语法错误先定位</h2>
    <p>下面这段多了一个尾部逗号：</p>
    ${pre(`{"name":"Clover","tools":99,}`)}
    <p>点“格式化”后状态栏给出“第 1 行，第 29 列：Expected double-quoted property name in JSON at position 28 (line 1 column 29)”。行列号来自 <code>JSON.parse</code> 报错里的 position，前面的文本按换行切分后换算得到，能直接跳到大致的出错位置。真实文件里先看报错位置前一个字段，通常是逗号、引号或括号没闭合。</p>
    <h2>为什么越大越慢</h2>
    <p>格式化在主线程上做三件事：<code>JSON.parse</code> 解析、<code>JSON.stringify</code> 重新序列化、把结果写回 textarea。体积翻倍时，字符串分配、垃圾回收和文本控件的排版都会一起变重，耗时不是简单的两倍。同一环境下把同样结构加到 71 万字符，点击后等了约 15 秒，期间页面无法响应。</p>
    <h2>大文件怎么处理</h2>
    <ol><li>能拿到原始文件就用 <code>jq</code> 或 Node 处理，不要先粘进浏览器。</li><li>只有一段文本时，按数组元素或顶层 key 切成小块，分别校验，别反复整段重试。</li><li>确认语法后再格式化；需要保留原文时先复制一份，避免输出覆盖工作区。</li><li>移动端内存更紧，超过几 MB 就不要在手机上试。</li></ol>
    <h2>它不做什么</h2>
    <p>不做流式解析，不校验 JSON Schema，不自动修复，也不会替你判断字段的业务含义。勾选“按键排序”会按字典序重排对象键，数组顺序不变；缩进只影响输出排版，不改变数据。</p>
    ${figure('json-large-input.jpg', '35 万字符的 JSON 粘贴后显示字符统计，状态栏为格式化完成', '2026-10-25 实际操作截图：输入 354,708 字符，格式化后 1,034,726 字符。')}
    ${figure('json-error-location.jpg', '尾部逗号导致的报错，状态栏显示第 1 行第 29 列和原始错误', '同一次操作中的错误定位。行列号由 JSON.parse 的 position 换算。')}
    ${diagram('flow-large-json-in-browser.svg', '大 JSON 的解析判断、错误定位、修复与格式化流程', '处理流程：先判断能否一次解析，失败按行列号定位并分段修复，成功后再格式化或压缩。')}
    <p>如果报错是从接口拿到的 HTML 而不是 JSON，先看<a href="/guides/json-unexpected-token-html/">Unexpected token 的排查步骤</a>；日常格式化与字段检查见<a href="/guides/json-formatting-validation/">JSON 格式化与校验</a>。</p>`,
    faqs: [
      { q: '能处理 10 MB 的 JSON 吗？', a: '不建议在浏览器里直接试。解析和序列化会长时间占住主线程，页面可能卡死；用 jq 或 Node 更稳。' },
      { q: '数据会上传到服务器吗？', a: '不会。解析、格式化和复制都在当前页面完成，没有网络请求。' },
      { q: '“按键排序”会改变数组顺序吗？', a: '不会。对象键按字典序重排，数组元素保持原顺序。' },
    ],
    sources: [
      { title: 'MDN：JSON.parse()', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/JSON/parse' },
      { title: 'RFC 8259：The JavaScript Object Notation Data Interchange Format', url: 'https://www.rfc-editor.org/rfc/rfc8259' },
    ],
  }),
  article({
    slug: 'sql-format-is-not-parser',
    title: 'SQL 格式化只改排版：注释、字符串和方言它不会替你修',
    description: '一条单行 SQL 格式化前后的实际差异，注释里出现关键字会发生什么，以及执行前必须自己做的三项检查。',
    category: '开发实用', toolSlug: 'sql-formatter', readingMinutes: 6,
    image: imageRoot + 'sql-after.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '格式化只调整空白和关键字大小写，不改语义；含注释的语句先备份再试。',
    notice: '格式化成功不等于 SQL 能执行。方言、函数、注释和权限都要在测试库另行确认。',
    content: `<p>一条 216 字符的单行 SQL：<code>select u.id, u.name, count(o.id) as orders from users u left join orders o on u.id = o.user_id where u.status = 'active' and u.name like 'A%' group by u.id, u.name having count(o.id) &gt; 2 order by orders desc limit 10</code>。格式化后 230 字符，SELECT、FROM、WHERE 各占一行，字符串 <code>'active'</code> 没有被改写。</p>
    <h2>它只做三件事</h2>
    <p>先按引号、括号、逗号和空白切成 token；把能识别的单个关键字转成大写；在 SELECT、FROM、WHERE、HAVING、LIMIT 等单个关键字前换行，并按括号层级缩进。逗号在 SELECT 列表中换行，在别处保留空格。</p>
    <p>多词关键字不在识别范围：GROUP BY、ORDER BY、LEFT JOIN、UNION ALL 会被当成几个普通单词，保留原来的大小写和位置。括号也会被拆开：左括号前加一个空格，右括号另起一行。下面的实际输出里能看到这两点，所以格式化完仍要人工通读。</p>
    <h2>注释的边界</h2>
    <p>格式化器不识别注释。下面这条语句的行注释里出现了 <code>from</code>：</p>
    ${pre(`select id, name from users -- fallback from cache
where status = 'from-active' and id > 10`)}
    <p>输出会把注释里的 <code>from</code> 当成子句关键字换行，<code>cache</code> 落到注释外，语句结构被改掉。含行注释的 SQL 先备份，或者先把注释移到单独的块注释/去掉，再格式化。这不是格式化器该猜的地方，它只是一个 token 重排工具。</p>
    <h2>字符串与方言</h2>
    <p>单引号、双引号和反引号里的内容会作为整体保留，不会被大写，也不会被拆开。它不理解 MySQL、PostgreSQL 或 SQL Server 的方言差异，不校验函数名、类型转换、CTE 和存储过程；格式化成功只说明文本被重排了，不说明数据库能执行。</p>
    <h2>执行前的三个检查</h2>
    <ol><li>把原文和结果做一次 diff，重点看注释、字符串和跨行位置。</li><li>在测试库执行，确认权限、方言和函数都可用。</li><li>保留原始版本或提交记录，出问题能回滚，不要只留格式化后的文本。</li></ol>
    <h2>它不做什么</h2>
    <p>不解析语法、不识别多词关键字、不检查表名和字段、不按列宽折行、不格式化注释、不处理 <code>DELIMITER</code> 与存储过程。需要真正的 SQL 解析时，用数据库自带的客户端或格式化插件。</p>
    ${figure('sql-before.jpg', '单行 SQL 的实际输入，包含字符串、JOIN、聚合和 LIMIT', '2026-10-25 实际操作截图：216 字符的单行语句。')}
    ${figure('sql-after.jpg', '同一语句格式化后的输出，关键字大写、子句换行、字符串保持原样', '格式化结果 230 字符。只调整了空白和关键字大小写。')}
    ${diagram('flow-sql-format-is-not-parser.svg', 'SQL 备份、格式化、差异对比与执行确认的流程', '处理流程：先备份，再格式化，对比注释与方言差异，最后在测试库执行。')}
    <p>如果语句本身报错，先把原始错误和数据库版本记下来；接口返回的错误正文可以配合<a href="/guides/http-429-retry-after/">HTTP 状态排查</a>一起看。</p>`,
    faqs: [
      { q: '格式化后为什么不能直接执行？', a: '它只重排空白和关键字大小写，不解析注释和方言。含行注释或特殊语法的语句可能被改结构，执行前要对比并在测试库确认。' },
      { q: '会改变关键字大小写吗？', a: '未加引号的关键字会转成大写，引号里的字符串和标识符保持原样。' },
      { q: '支持存储过程吗？', a: '不支持。它没有 SQL 解析器，只按 token 重排，存储过程和 DELIMITER 不在处理范围内。' },
    ],
    sources: [
      { title: 'PostgreSQL：Lexical Structure（注释与字符串）', url: 'https://www.postgresql.org/docs/current/sql-syntax-lexical.html' },
      { title: 'MySQL 8.4 Reference Manual：Comments', url: 'https://dev.mysql.com/doc/refman/8.4/en/comments.html' },
    ],
  }),
  article({
    slug: 'jsonpath-supported-subset',
    title: 'JSONPath 取不到值：先看根、递归和过滤写法',
    description: 'JSONPath 支持的路径与过滤子集，结果为空的三类原因，以及和 JSON Pointer 的区别。',
    category: '开发实用', toolSlug: 'jsonpath', readingMinutes: 5,
    image: imageRoot + 'jsonpath-query.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先确认表达式从 $ 开始，再逐段加路径；过滤器只支持 @.key 与简单比较。',
    notice: '查询结果只读，不修改原 JSON；过滤器不会执行任意代码，也不支持函数和嵌套路径。',
    content: `<p>用示例数据执行 <code>$.store.book[?(@.price &lt; 10)].title</code>，结果区返回两行：<code>"Sayings"</code> 和 <code>"Moby Dick"</code>。把表达式改成 <code>book[0]</code>，状态栏直接报 <code>JSONPath must start with $</code>——根符号不是可选项。</p>
    <h2>它支持的写法</h2>
    ${table(['写法', '含义'], [['$', '根节点'], ['.key', '取子属性'], ["['key']", '带引号的键'], ['..key', '递归查找所有同名属性'], ['..*', '递归展开所有节点'], ['[*]', '数组或对象的所有成员'], ['[0]', '数组下标'], ['[?(@.price &lt; 10)]', '过滤数组元素']])}
    <p>属性名允许字母、数字、下划线和短横线；带空格或特殊字符的键用 <code>['key']</code>。递归下降 <code>..</code> 会同时尝试当前节点和所有后代，结果里可能出现重复。</p>
    <h2>过滤器的边界</h2>
    <p>过滤器只作用在数组上，条件只支持 <code>@.key</code> 与数字、布尔、null、引号字符串的简单比较，运算符是 <code>==</code>、<code>!=</code>、<code>&lt;</code>、<code>&gt;</code>、<code>&lt;=</code>、<code>&gt;=</code>。不支持 <code>@.a.b</code> 这样的嵌套路径，不支持函数、算术、正则，也不支持拿另一个路径当比较值。写 <code>$..book[?(@.price &lt; $.expensive)]</code> 会直接报不支持，而不是返回空数组。</p>
    <h2>结果为空，先查三件事</h2>
    <ol><li>根和拼写：表达式是否从 <code>$</code> 开始，属性名大小写是否一致。</li><li>节点类型：<code>[*]</code> 和过滤器只对相应结构生效，对象上写数组下标不会命中。</li><li>过滤条件：比较值类型是否一致，比如价格是数字，条件里却写了带引号的 <code>"10"</code>。</li></ol>
    <h2>输出与复制</h2>
    <p>结果区不是 JSON 数组：每个匹配单独做 <code>JSON.stringify</code>，多个匹配之间用一行 <code>---</code> 分隔；字符串结果会带引号。复制按钮复制整段文本，查询只读，不会修改原 JSON，也没有保存查询历史。</p>
    <h2>它不做什么</h2>
    <p>不支持 JSON Pointer、脚本表达式、自定义函数和路径联合（<code>[0,1]</code>）；不能修改值，也不能生成新对象。复杂提取请把结果复制到脚本里继续处理。</p>
    ${figure('jsonpath-query.jpg', '价格过滤表达式在示例数据上的实际结果，返回两个书名', '2026-10-25 实际操作截图：过滤条件与结果。')}
    ${figure('jsonpath-error.jpg', '表达式缺少根符号时的实际错误提示', '同一次操作中的错误状态：JSONPath 必须以 $ 开始。')}
    ${diagram('flow-jsonpath-supported-subset.svg', 'JSONPath 的根、路径、数组、过滤与空结果排查流程', '查询流程：确认根，逐段加路径，结果为空时回到类型、路径和过滤语法检查。')}
    <p>只想展开和校验 JSON 结构，用<a href="/guides/json-formatting-validation/">JSON 格式化与校验</a>；需要把结果转成表格，可以接着看<a href="/tools/dev/json-convert/">JSON 转 CSV</a>。</p>`,
    faqs: [
      { q: '支持 $..* 吗？', a: '支持。它会递归展开所有节点，结果可能很多，也可能包含重复节点。' },
      { q: '能用另一个路径做过滤比较吗？', a: '不能。过滤器右侧只接受数字、布尔、null 或引号字符串，不支持 $.expensive 这类路径。' },
      { q: '可以修改 JSON 的值吗？', a: '不可以。这里只做查询和复制，修改要在编辑器或代码里完成。' },
    ],
    sources: [
      { title: 'RFC 9535：JSONPath', url: 'https://www.rfc-editor.org/rfc/rfc9535' },
      { title: 'Wikipedia：JSONPath', url: 'https://en.wikipedia.org/wiki/JSONPath' },
    ],
  }),

  article({
    slug: 'salary-simplified-model',
    title: '税前工资到手多少：这个计算器算了什么，没算什么',
    description: '用税前 15000、公积金 7% 走一遍五险一金和个税的计算，说明固定比例、起征点、预扣率，以及它没有覆盖的项目。',
    category: '日常实用', toolSlug: 'salary', readingMinutes: 6,
    image: imageRoot + 'salary-result.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先分清“估算”和“工资条”：这里的比例和起征点是固定的，专项附加扣除和城市差异都不在计算里。',
    notice: '结果是简化估算，不构成税务或劳动合同依据；实际缴纳以当地社保基数和单位申报为准。',
    content: `<p>输入税前 15000，公积金选 7%，结果页给出：养老 1200、医疗 300、失业 75、公积金 1050、五险一金合计 2625、应纳税所得额 7375、个税 527.50、税后 11847.50。数字是按固定公式算出来的，不涉及账号或工资条上传。</p>
    <h2>计算顺序</h2>
    <p>五险一金 = 15000×8% + 15000×2% + 15000×0.5% + 15000×7% = 2625。应纳税所得额 = 15000 − 5000 − 2625 = 7375。按 10% 档减去速算扣除数 210，个税 = 7375×10% − 210 = 527.50。税后 = 15000 − 2625 − 527.50 = 11847.50。</p>
    <h2>比例是固定的</h2>
    <p>养老 8%、医疗 2%、失业 0.5% 写死在计算里；公积金可以在 5%、7%、12% 三档中选择。没有社保缴费基数的上下限，也没有单位缴纳部分，所以结果只覆盖个人到手的一侧。</p>
    <h2>个税按月度预扣率</h2>
    <p>使用工资薪金所得预扣率表：不超过 3000 元的部分 3%；3000–12000 元 10%，速算扣除 210；12000–25000 元 20%，扣除 1410；再往上还有 25%、30%、35%、45% 四档。这里算的是单月预扣，不是年度汇算清缴，也不会自动累计前几个月的收入。</p>
    <h2>它没算什么</h2>
    <ul><li>城市差异：城市下拉当前不参与计算，比例以你选的公积金档位为准。</li><li>社保基数上下限、补充公积金、企业年金。</li><li>专项附加扣除：子女教育、房贷利息、赡养老人等都没有输入项。</li><li>年终奖、股权、劳务报酬、经营所得和跨地区缴纳。</li></ul>
    <p>所以工资条可能比这个结果更高，也可能更低：专项附加扣除会减少个税，基数上限会减少社保扣款，而单位代扣的其他项目又会增加扣除。这个页面适合做量级估算，不适合核对工资条。</p>
    <h2>怎么用这个数</h2>
    <p>比较两个 offer 的税后差距、做月度预算、判断公积金档位的影响，都是合理用法。谈薪时把税前、公积金比例和城市一起写清楚，比只报一个“到手”数字更不容易误解。</p>
    ${figure('salary-form.jpg', '税前 15000、公积金 7% 的实际输入区，按钮和提示为真实状态', '2026-10-25 实际操作截图：输入税前工资并选择公积金档位。')}
    ${figure('salary-result.jpg', '五险一金、应纳税所得额、个税和税后到手的实际明细', '同一次计算的结果：税后 11847.50 元/月。')}
    ${diagram('flow-salary-simplified-model.svg', '税前工资、五险一金、起征点、预扣率与税后到手的流程', '估算流程：先扣五险一金，再减 5000 起征点，按预扣率表算个税，最后得到税后金额。')}
    <p>金额需要写成中文大写报销时，用<a href="/tools/daily/rmb-uppercase/">人民币大写转换</a>；日期相关的计算见<a href="/guides/date-difference-rules/">日期差规则</a>。</p>`,
    faqs: [
      { q: '为什么和工资条对不上？', a: '这里使用固定比例和单月预扣，不含社保基数上下限、专项附加扣除、年终奖和单位代扣项目。工资条以单位申报和当地基数为准。' },
      { q: '切换城市为什么结果不变？', a: '当前版本的城市选项不参与计算，比例以公积金档位为准；不同城市的社保基数需要另行核算。' },
      { q: '能算年终奖的税吗？', a: '不能。页面只处理工资薪金的月度估算，年终奖、股权和劳务报酬都不在范围内。' },
    ],
    sources: [
      { title: '国家税务总局：个人所得税扣缴申报管理办法（试行）', url: 'https://shanghai.chinatax.gov.cn/zcfw/zcfgk/grsds/201812/t443216.html' },
      { title: '中华人民共和国个人所得税法（2018 修正）', url: 'https://guangxi.chinatax.gov.cn/xxgk/zfxxgk_22500/fdzdgknr/zcfg_22514/zcwj_22515/201809/t20180914_295115.html' },
    ],
  }),
  article({
    slug: 'expiry-date-boundaries',
    title: '保质期到底算到哪天：加天数、剩余天数和 0 天的边界',
    description: '生产日期加 45 天得到什么，剩余天数怎么取整，30 天和 0 天两个阈值分别意味着什么。',
    category: '日常排查', toolSlug: 'expiry', readingMinutes: 5,
    image: imageRoot + 'expiry-result.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先确认包装上写的是“保质期几天”还是“保质期至某日”，两种写法的算法不一样。',
    notice: '结果只做日期推算，不判断食品是否变质；实际能不能用请以包装说明和储存条件为准。',
    content: `<p>生产日期填 2026-09-25，保质期 45 天，页面给出到期日 2026-11-09、剩余 15 天，状态“即将到期，请尽快食用/使用”。这个结果由日期加天数直接得到，不是按“一个半月”估算。</p>
    <h2>加的是天数</h2>
    <p>脚本把生产日期解析成本地零点，再用 <code>setDate(date + 45)</code> 往后推。跨月、跨年、闰年都由 Date 处理：2026-09-25 加 45 天会经过 10 月 31 天，落在 2026-11-09。如果你习惯按“几个月”记，先把月数换算成天数，或者直接看包装上的“保质期至”。</p>
    <h2>三个状态</h2>
    ${table(['剩余天数', '状态'], [['大于 30 天', '充足'], ['1–30 天', '即将到期'], ['0 天及以下', '已过期']])}
    <p>剩余 0 天显示“已过期”。如果包装写的是“保质期至 2026-11-09”，当天用这个工具会得到 0 天和已过期；这是两种写法的边界差异，不是日期算错。需要当天仍视为可用的场景，请以包装或监管说明为准。</p>
    <h2>剩余天数怎么算</h2>
    <p>到期日减今天，按毫秒差除以 86400000 后四舍五入。今天也取本地零点，所以白天打开和晚上打开结果一致。中国时区没有夏令时；换到有夏令时的时区，切换日可能出现 23 或 25 小时的一天，剩余天数可能差一天。</p>
    <h2>它不做什么</h2>
    <p>只接受天数，不解析“12 个月”“180 天”这类文本；不区分未开封和已开封；不做提醒；不判断食品是否安全。保质期是厂家的品质承诺，不是打开后的无菌保证。</p>
    <h2>实际用法</h2>
    <p>把家里一批食品、药品或护肤品的生产日期和天数逐个算一遍，记下最近到期的那几个，截图放在冰箱或药盒旁边。批量登记可以用表格，算完再回填，不必每次重算。</p>
    ${figure('expiry-form.jpg', '生产日期 2026-09-25、保质期 45 天的实际输入区', '2026-10-25 实际操作截图：输入生产日期与天数。')}
    ${figure('expiry-result.jpg', '到期日 2026-11-09、剩余 15 天、状态即将到期的实际结果', '同一次计算的结果。剩余 0 天会显示已过期。')}
    ${diagram('flow-expiry-date-boundaries.svg', '生产日期、加天数、距今天数与三个状态的判断流程', '判断流程：生产日期加保质期天数得到到期日，再与今天比较，分出充足、即将到期和已过期。')}
    <p>需要算两个日期之间差多少天，用<a href="/guides/date-difference-rules/">日期差规则</a>；按工作日排期，用<a href="/tools/daily/workday/">工作日计算器</a>。</p>`,
    faqs: [
      { q: '保质期 12 个月怎么填？', a: '这个工具只接受天数。可以按包装上的“保质期至”直接对照，或把月数换算成天数后填写；换算可能因月份长短差一两天。' },
      { q: '到期当天算过期吗？', a: '工具的剩余 0 天显示“已过期”。包装写“保质期至某日”时，当天是否可用请以包装说明和储存条件为准。' },
      { q: '为什么和包装上的日期差一天？', a: '常见原因是把“保质期几个月”按 30 天估算、时区差异，或把生产日当天算作第 1 天。这里按日期加天数计算，不从生产日当天计数。' },
    ],
    sources: [
      { title: 'Wikipedia：Shelf life', url: 'https://en.wikipedia.org/wiki/Shelf_life' },
      { title: 'MDN：Date', url: 'https://developer.mozilla.org/en-US/docs/Web/JavaScript/Reference/Global_Objects/Date' },
    ],
  }),
  article({
    slug: 'grid-splitter-center-crop',
    title: '九宫格切图：为什么先裁中心正方形，九张图怎么排',
    description: '1200×630 的图片怎么变成九张 210×210，编号顺序、下载方式和画质边界分别是什么。',
    category: '手作与图像', toolSlug: 'grid-splitter', readingMinutes: 5,
    image: imageRoot + 'grid-preview.jpg', published: '2026-10-25', updated: '2026-10-25',
    focus: '先看预览里被裁掉的部分，再决定要不要换一张更接近正方形的原图。',
    notice: '图片只在浏览器本地切分和编码，不上传；九张图是独立 PNG，不是压缩包。',
    content: `<p>1200×630 的原图放进去，状态栏显示“取中心 630×630”，预览是九张 210×210 的小图，编号 1–9 从左到右、从上到下。横图两侧各被裁掉 285px，这是为了得到九个正方形。</p>
    <h2>为什么先裁正方形</h2>
    <p>3×3 等分要保证每一格都是正方形，只能以短边为准，从中心裁出一个正方形再切。横图裁掉左右，竖图裁掉上下；裁掉的部分不会出现在任何一格，也拼不回原图。预览里能直接看到哪些内容被舍弃，选图时优先用主体居中的正方形图。</p>
    <h2>九张图的顺序</h2>
    <p>按行优先编号：第一行 1、2、3，第二行 4、5、6，第三行 7、8、9。预览每格左上角有编号，下载文件名是 九宫格_1.png 到 九宫格_9.png。发九宫格时按这个顺序上传，画面才连贯。</p>
    <h2>下载</h2>
    <p>点“下载全部”会触发九次独立下载，不是 zip 包。部分浏览器会询问是否允许一次下载多个文件；手机浏览器可能只保存其中几张，建议分次保存或换桌面浏览器。切分完成但还没点下载时，结果只在内存里。</p>
    <h2>画质</h2>
    <p>每张图由 canvas 重新编码为 PNG，边长是中心正方形边长的三分之一。1200×630 得到 210×210，放大到朋友圈尺寸会糊；想要更清晰，先用更大的正方形原图。PNG 是无损编码，但源图若是 JPEG，细节已经被压缩过一次，切分不会恢复。EXIF 不会保留。</p>
    <h2>它不做什么</h2>
    <p>固定 3×3，不能切成 2×2 或 4×4；没有间距、描边、圆角和背景色选项；动图只取第一帧；不提供九宫格预览拼接图。</p>
    ${figure('grid-preview.jpg', '1200×630 原图取中心 630×630 后的九格预览，每格带编号', '2026-10-25 实际操作截图：中心裁切后的九格与编号。')}
    ${figure('grid-download.jpg', '上传图片并切分后点击下载全部的实际状态提示', '同一次操作：九张 PNG 分别触发下载，不是压缩包。')}
    ${diagram('flow-grid-splitter-center-crop.svg', '上传、中心裁切、3×3 切分、编号与导出的流程', '处理流程：按短边取中心正方形，等分九格，按行列编号后逐张下载。')}
    <p>如果只想调整颜色而不是裁切，用<a href="/guides/image-filter-local-canvas/">图片滤镜</a>；需要可复现的头像或图标，可以看<a href="/tools/fun/avatar-generator/">头像生成器</a>。</p>`,
    faqs: [
      { q: '为什么切出来都是正方形？', a: '3×3 等分需要每格等宽等高，工具按短边从中心裁出正方形后再切；横图或竖图多出来的部分会被裁掉。' },
      { q: '能一次下载成 zip 吗？', a: '不能。当前实现是九次独立 PNG 下载，部分浏览器会要求允许一次下载多个文件。' },
      { q: '动图会怎样？', a: '只取第一帧切分，动画不会保留。' },
    ],
    sources: [
      { title: 'MDN：Using images（Canvas）', url: 'https://developer.mozilla.org/en-US/docs/Web/API/Canvas_API/Tutorial/Using_images' },
      { title: 'MDN：HTMLCanvasElement.toDataURL()', url: 'https://developer.mozilla.org/en-US/docs/Web/API/HTMLCanvasElement/toDataURL' },
    ],
  }),

];
