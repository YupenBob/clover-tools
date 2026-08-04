  import figlet from 'figlet';
  import Standard from '../assets/figlet/Standard.flf?raw';
  import Slant from '../assets/figlet/Slant.flf?raw';
  import Banner from '../assets/figlet/Banner.flf?raw';
  import Big from '../assets/figlet/Big.flf?raw';
  import Block from '../assets/figlet/Block.flf?raw';
  import Small from '../assets/figlet/Small.flf?raw';
  import Mini from '../assets/figlet/Mini.flf?raw';
  import CalvinS from '../assets/figlet/Calvin S.flf?raw';
  import ANSIShadow from '../assets/figlet/ANSI Shadow.flf?raw';
  import Speed from '../assets/figlet/Speed.flf?raw';
  import Doom from '../assets/figlet/Doom.flf?raw';
  import Bloody from '../assets/figlet/Bloody.flf?raw';
  import Epic from '../assets/figlet/Epic.flf?raw';
  import StarWars from '../assets/figlet/Star Wars.flf?raw';
  import Poison from '../assets/figlet/Poison.flf?raw';
  import ASCII3D from '../assets/figlet/3D-ASCII.flf?raw';
  import Larry3D from '../assets/figlet/Larry 3D.flf?raw';
  import BigMoney from '../assets/figlet/Big Money-ne.flf?raw';
  import Crawford from '../assets/figlet/Crawford.flf?raw';
  import Bubble from '../assets/figlet/Bubble.flf?raw';
  import Graffiti from '../assets/figlet/Graffiti.flf?raw';
  import Ogre from '../assets/figlet/Ogre.flf?raw';

  type FontDef = { name: string; label: string; desc: string };

  const FONT_GROUPS: Array<{ id: string; label: string; fonts: FontDef[] }> = [
    {
      id: 'classic',
      label: '经典字体',
      fonts: [
        { name: 'Standard', label: '标准体', desc: '最经典的 FIGlet 字体，干净耐看' },
        { name: 'Slant', label: '斜体', desc: '向右倾斜，README 标题常用' },
        { name: 'Banner', label: '横幅体', desc: '宽扁醒目的大字横幅' },
        { name: 'Big', label: '大号体', desc: '厚重醒目的大块字' },
        { name: 'Block', label: '方块体', desc: '方正稳重的方块字' },
        { name: 'Small', label: '小号体', desc: '紧凑小巧，适合长文本' },
        { name: 'Mini', label: '迷你体', desc: '超矮身形，适合注释和短句' },
        { name: 'Calvin S', label: '卡通体', desc: '圆润俏皮的卡通风格' },
      ],
    },
    {
      id: 'cool',
      label: '炫酷字体',
      fonts: [
        { name: 'ANSI Shadow', label: '星战阴影', desc: 'Star Wars 风格阴影字，辨识度极高' },
        { name: 'Speed', label: '疾速体', desc: '倾斜动感，代码注释首选' },
        { name: 'Doom', label: '毁灭体', desc: '像素风硬朗大字' },
        { name: 'Bloody', label: '血字体', desc: '滴血惊悚风格' },
        { name: 'Epic', label: '史诗体', desc: '紧凑霸气的双线大写' },
        { name: 'Star Wars', label: '星球大战', desc: '电影片头字幕风格' },
        { name: 'Poison', label: '毒液体', desc: '液态滴落效果' },
      ],
    },
    {
      id: '3d',
      label: '立体字体',
      fonts: [
        { name: '3D-ASCII', label: '立体 3D', desc: '富有景深的立体字' },
        { name: 'Larry 3D', label: '拉里 3D', desc: '圆润光滑的 3D 字' },
        { name: 'Big Money-ne', label: '大富豪', desc: '钞票质感的 3D 字' },
        { name: 'Crawford', label: '克劳福德', desc: '复古 3D 大写' },
      ],
    },
    {
      id: 'decor',
      label: '装饰字体',
      fonts: [
        { name: 'Bubble', label: '气泡体', desc: '字母外套上气泡' },
        { name: 'Graffiti', label: '涂鸦体', desc: '街头涂鸦风格' },
        { name: 'Ogre', label: '食人魔', desc: '粗犷厚边的字体' },
      ],
    },
  ];

  const FONT_MODS: Record<string, string> = {
    Standard,
    Slant,
    Banner,
    Big,
    Block,
    Small,
    Mini,
    'Calvin S': CalvinS,
    'ANSI Shadow': ANSIShadow,
    Speed,
    Doom,
    Bloody,
    Epic,
    'Star Wars': StarWars,
    Poison,
    '3D-ASCII': ASCII3D,
    'Larry 3D': Larry3D,
    'Big Money-ne': BigMoney,
    Crawford,
    Bubble,
    Graffiti,
    Ogre,
  };

  for (const [name, data] of Object.entries(FONT_MODS)) {
    figlet.parseFont(name, data);
  }
  figlet.defaults({ fetchFontIfMissing: false });

  const CHARSETS: Record<'gray' | 'block' | 'binary', string> = {
    gray: ' .:-=+*#%@',
    block: ' ░▒▓█',
    binary: ' #',
  };

  const CJK_RE =
    /[\u1100-\u115F\u2E80-\u9FFF\uA960-\uA97F\uAC00-\uD7A3\uF900-\uFAFF\uFE30-\uFE4F\uFF00-\uFF60\uFFE0-\uFFE6]/;

  const $ = <T extends HTMLElement>(id: string): T => document.getElementById(id) as T;

  const figletInput = $<HTMLTextAreaElement>('figletInput');
  const cjkInput = $<HTMLTextAreaElement>('cjkInput');
  const termBody = $<HTMLElement>('asciiOutput');
  const stats = $<HTMLElement>('asciiStats');
  const status = $<HTMLElement>('asciiStatus');
  const fontSelect = $<HTMLSelectElement>('figletFont');
  const fontHint = $<HTMLElement>('figletFontHint');

  let currentMode: 'figlet' | 'cjk' | 'image' = 'figlet';
  let currentImg: HTMLImageElement | null = null;
  let currentImgName = '';
  let plainOutput = '';
  let lastImgRows: Array<Array<{ ch: string; r: number; g: number; b: number }>> | null = null;
  let pendingInfo = '';

  function setStatus(type: 'success' | 'error' | 'info', msg: string): void {
    status.className = `status-msg show ${type}`;
    status.textContent = msg;
  }

  function clearStatus(): void {
    status.className = 'status-msg';
    status.textContent = '';
  }

  function updateStats(text: string): void {
    if (!text) {
      stats.textContent = '0 行 · 0 字符';
      return;
    }
    const lines = text.split('\n');
    const maxWidth = Math.max(...lines.map((l) => l.length));
    stats.textContent = `${lines.length} 行 · ${text.length} 字符 · 最大宽度 ${maxWidth}`;
  }

  /* ── 模式切换 ── */

  function setMode(mode: 'figlet' | 'cjk' | 'image'): void {
    currentMode = mode;
    document.querySelectorAll<HTMLButtonElement>('.seg-btn').forEach((btn) => {
      const active = btn.dataset.mode === mode;
      btn.classList.toggle('active', active);
      btn.setAttribute('aria-pressed', String(active));
    });
    document.querySelectorAll<HTMLElement>('[data-mode-panel]').forEach((panel) => {
      panel.hidden = panel.dataset.modePanel !== mode;
    });
    if (mode !== 'image' || currentImg) render();
  }

  $<HTMLElement>('asciiMode').addEventListener('click', (e) => {
    const btn = (e.target as HTMLElement).closest<HTMLButtonElement>('.seg-btn');
    if (!btn) return;
    setMode(btn.dataset.mode as 'figlet' | 'cjk' | 'image');
  });

  /* ── FIGlet 渲染 ── */

  function populateFonts(): void {
    const frag = document.createDocumentFragment();
    for (const group of FONT_GROUPS) {
      const optgroup = document.createElement('optgroup');
      optgroup.label = group.label;
      for (const f of group.fonts) {
        const opt = document.createElement('option');
        opt.value = f.name;
        opt.textContent = `${f.label}（${f.name}）`;
        optgroup.appendChild(opt);
      }
      frag.appendChild(optgroup);
    }
    fontSelect.appendChild(frag);
    fontSelect.value = 'Standard';
  }

  function fontMeta(): FontDef | undefined {
    for (const group of FONT_GROUPS) {
      const f = group.fonts.find((x) => x.name === fontSelect.value);
      if (f) return f;
    }
    return undefined;
  }

  function updateFontHint(): void {
    const f = fontMeta();
    if (!f) return;
    figlet.metadata(f.name)
      .then(([opts]) => {
        fontHint.textContent = `${f.label} · ${f.desc} · 字形 ${opts.maxLength}×${opts.height}`;
      })
      .catch(() => {
        fontHint.textContent = `${f.label} · ${f.desc}`;
      });
  }

  function renderFiglet(): string | null {
    const text = figletInput.value;
    if (!text.trim()) return null;
    const width = Number($<HTMLSelectElement>('figletWidth').value);

    if (CJK_RE.test(text)) {
      pendingInfo = '检测到中文/全角字符，已自动使用「中文像素画」方式渲染，可在对应模式下调节清晰度';
      return renderCjkInner(text, 8, width, false, CHARSETS.gray);
    }

    try {
      pendingInfo = '';
      const result = figlet.textSync(text, {
        font: fontSelect.value,
        horizontalLayout: $<HTMLSelectElement>('figletLayout').value,
        verticalLayout: 'default',
        width,
        whitespaceBreak: true,
      });
      return result;
    } catch {
      setStatus('error', '渲染失败：输入包含该字体不支持的字符，请检查后重试');
      return null;
    }
  }

  /* ── 中文 / 任意字符像素画 ── */

  function renderCjkInner(
    text: string,
    rowsPerChar: number,
    widthLimit: number,
    invert: boolean,
    charset: string,
  ): string {
    const stepX = 2;
    const stepY = 4;
    const fontPx = rowsPerChar * stepY;
    const maxPx = widthLimit * stepX;
    const canvas = document.createElement('canvas');
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const font = `bold ${fontPx}px "Noto Sans SC","Microsoft YaHei","PingFang SC","Hiragino Sans GB",sans-serif`;

    const inputLines = text.split('\n');
    const blocks: string[] = [];

    for (const inputLine of inputLines) {
      const chars = [...inputLine];
      if (chars.length === 0) {
        blocks.push('');
        continue;
      }

      // 换行：按实际像素宽度累积
      const wrapped: string[][] = [];
      let cur: string[] = [];
      let curW = 0;
      ctx.font = font;
      for (const ch of chars) {
        const w = ctx.measureText(ch).width;
        if (cur.length > 0 && curW + w > maxPx) {
          wrapped.push(cur);
          cur = [];
          curW = 0;
        }
        cur.push(ch);
        curW += w;
      }
      if (cur.length) wrapped.push(cur);

      const lineBlocks: string[] = [];
      for (const lineChars of wrapped) {
        ctx.font = font;
        const widths = lineChars.map((ch) => ctx.measureText(ch).width);
        const linePx = Math.max(2, Math.ceil(widths.reduce((a, b) => a + b, 0) / stepX) * stepX);
        canvas.width = linePx;
        canvas.height = fontPx;
        ctx.font = font;
        ctx.fillStyle = '#000';
        ctx.textBaseline = 'top';
        let x = 0;
        lineChars.forEach((ch, i) => {
          ctx.fillText(ch, x, 0);
          x += widths[i];
        });

        const image = ctx.getImageData(0, 0, canvas.width, canvas.height);
        const data = image.data;
        const rows = Math.ceil(canvas.height / stepY);
        const cols = Math.ceil(canvas.width / stepX);
        const grid: number[][] = [];

        for (let r = 0; r < rows; r++) {
          const row: number[] = [];
          for (let c = 0; c < cols; c++) {
            let sum = 0;
            let n = 0;
            for (let yy = r * stepY; yy < Math.min((r + 1) * stepY, canvas.height); yy++) {
              for (let xx = c * stepX; xx < Math.min((c + 1) * stepX, canvas.width); xx++) {
                const i4 = (yy * canvas.width + xx) * 4;
                const a = data[i4 + 3] / 255;
                const lum = 0.299 * data[i4] + 0.587 * data[i4 + 1] + 0.114 * data[i4 + 2];
                sum += lum * a + 255 * (1 - a);
                n++;
              }
            }
            const avg = sum / n;
            // 非反色：笔画越黑越浓；反色：背景越亮越浓
            let ink = invert ? avg : 255 - avg;
            // 伽马曲线增强笔画对比，避免细笔画过淡
            ink = 255 * Math.pow(ink / 255, 0.65);
            const idx = Math.min(charset.length - 1, Math.floor((ink / 256) * charset.length));
            row.push(idx);
          }
          grid.push(row);
        }

        // 裁掉上下空行
        let first = 0;
        let last = grid.length - 1;
        while (first < grid.length && grid[first].every((v) => v === 0)) first++;
        while (last >= first && grid[last].every((v) => v === 0)) last--;
        if (first >= grid.length) {
          lineBlocks.push('');
          continue;
        }
        const linesOut = grid.slice(first, last + 1).map((row) =>
          row.map((v) => charset[v]).join('').replace(/\s+$/, ''),
        );
        lineBlocks.push(linesOut.join('\n'));
      }
      blocks.push(lineBlocks.join('\n'));
    }

    return blocks.join('\n').replace(/\n{3,}/g, '\n\n').trimEnd();
  }

  function renderCjk(): string | null {
    const text = cjkInput.value;
    if (!text.trim()) return null;
    const res = Number($<HTMLSelectElement>('cjkRes').value);
    const width = Number($<HTMLSelectElement>('cjkWidth').value);
    const invert = $<HTMLInputElement>('cjkInvert').checked;
    const charset = CHARSETS[$<HTMLSelectElement>('cjkCharset').value as keyof typeof CHARSETS];
    return renderCjkInner(text, res, width, invert, charset);
  }

  /* ── 图片转字符画 ── */

  async function loadImageFile(file: File): Promise<void> {
    if (!file.type.startsWith('image/')) {
      setStatus('error', '请选择图片文件（PNG / JPG / GIF / WebP）');
      return;
    }
    const url = URL.createObjectURL(file);
    const img = new Image();
    img.onload = () => {
      currentImg = img;
      currentImgName = file.name;
      $<HTMLElement>('imgPreviewWrap').hidden = false;
      $<HTMLElement>('imgDrop').hidden = true;
      $<HTMLImageElement>('imgPreview').src = url;
      $<HTMLElement>('imgFileName').textContent = `${file.name} · ${img.naturalWidth}×${img.naturalHeight}`;
      $<HTMLElement>('imgFileSize').textContent = formatSize(file.size);
      render();
    };
    img.onerror = () => {
      URL.revokeObjectURL(url);
      setStatus('error', '图片加载失败，请更换文件重试');
    };
    img.src = url;
  }

  function formatSize(bytes: number): string {
    if (bytes < 1024) return `${bytes} B`;
    if (bytes < 1024 * 1024) return `${(bytes / 1024).toFixed(1)} KB`;
    return `${(bytes / 1024 / 1024).toFixed(2)} MB`;
  }

  function renderImage(): string | null {
    if (!currentImg) return null;
    const cols = Number($<HTMLSelectElement>('imgWidth').value);
    const rows = Math.max(1, Math.round(cols * (currentImg.height / currentImg.width)));
    const stepX = 2;
    const stepY = 4;
    const cw = cols * stepX;
    const ch = rows * stepY;
    const contrast = Number($<HTMLSelectElement>('imgContrast').value) / 100;
    const invert = $<HTMLInputElement>('imgInvert').checked;
    const charset = CHARSETS[$<HTMLSelectElement>('imgCharset').value as keyof typeof CHARSETS];

    const canvas = document.createElement('canvas');
    canvas.width = cw;
    canvas.height = ch;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    ctx.drawImage(currentImg, 0, 0, cw, ch);
    const data = ctx.getImageData(0, 0, cw, ch).data;

    const outRows: Array<Array<{ ch: string; r: number; g: number; b: number }>> = [];
    for (let r = 0; r < rows; r++) {
      const row: Array<{ ch: string; r: number; g: number; b: number }> = [];
      for (let c = 0; c < cols; c++) {
        let rSum = 0;
        let gSum = 0;
        let bSum = 0;
        let n = 0;
        for (let yy = r * stepY; yy < Math.min((r + 1) * stepY, ch); yy++) {
          for (let xx = c * stepX; xx < Math.min((c + 1) * stepX, cw); xx++) {
            const i4 = (yy * cw + xx) * 4;
            rSum += data[i4];
            gSum += data[i4 + 1];
            bSum += data[i4 + 2];
            n++;
          }
        }
        const ar = rSum / n;
        const ag = gSum / n;
        const ab = bSum / n;
        let lum = 0.299 * ar + 0.587 * ag + 0.114 * ab;
        lum = Math.max(0, Math.min(255, (lum - 128) * contrast + 128));
        const darkness = invert ? lum : 255 - lum;
        const idx = Math.min(charset.length - 1, Math.floor((darkness / 256) * charset.length));
        row.push({ ch: charset[idx], r: Math.round(ar), g: Math.round(ag), b: Math.round(ab) });
      }
      outRows.push(row);
    }
    lastImgRows = outRows;
    return outRows.map((row) => row.map((cell) => cell.ch).join('').replace(/\s+$/, '')).join('\n');
  }

  /* ── 统一渲染 ── */

  function clearOutput(): void {
    plainOutput = '';
    updateStats('');
    renderTerminal('', false);
  }

  function cursorEl(): HTMLSpanElement {
    const c = document.createElement('span');
    c.className = 'term-cursor';
    c.setAttribute('aria-hidden', 'true');
    return c;
  }

  function buildCommand(): string {
    const q = (s: string) => `"${s.replace(/\\/g, '\\\\').replace(/"/g, '\\"')}"`;
    if (currentMode === 'figlet') {
      const input = figletInput.value.trim();
      const width = $<HTMLSelectElement>('figletWidth').value;
      if (CJK_RE.test(figletInput.value)) {
        return `clover-ascii ${q(input.slice(0, 24))} -res 8 -w ${width}`;
      }
      return `figlet -f ${fontSelect.value} -l ${$<HTMLSelectElement>('figletLayout').value} -w ${width} ${q(input)}`;
    }
    if (currentMode === 'cjk') {
      const res = $<HTMLSelectElement>('cjkRes').value;
      const charset = $<HTMLSelectElement>('cjkCharset').value;
      const width = $<HTMLSelectElement>('cjkWidth').value;
      const invert = $<HTMLInputElement>('cjkInvert').checked;
      return `clover-ascii ${q(cjkInput.value.trim().slice(0, 24))} -res ${res} -charset ${charset} -w ${width}${invert ? ' -invert' : ''}`;
    }
    const width = $<HTMLSelectElement>('imgWidth').value;
    const charset = $<HTMLSelectElement>('imgCharset').value;
    const contrast = Number($<HTMLSelectElement>('imgContrast').value);
    const invert = $<HTMLInputElement>('imgInvert').checked;
    return `img2txt ${q(currentImgName || 'image')} -w ${width} -charset ${charset}${contrast !== 100 ? ` -c ${contrast}` : ''}${invert ? ' -invert' : ''}`;
  }

  function appendAnsi(parent: HTMLElement, text: string): void {
    const ANSI_RE = /\x1b\[([0-9;]*)m/g;
    const stack: string[] = [];
    let last = 0;
    let m: RegExpExecArray | null;
    const pushText = (t: string) => {
      if (!t) return;
      if (stack.length === 0) {
        parent.appendChild(document.createTextNode(t));
        return;
      }
      const span = document.createElement('span');
      span.style.color = stack[stack.length - 1];
      span.textContent = t;
      parent.appendChild(span);
    };
    while ((m = ANSI_RE.exec(text)) !== null) {
      pushText(text.slice(last, m.index));
      const code = m[1];
      if (code.startsWith('38;2;')) {
        const [r, g, b] = code.split(';').slice(2).map(Number);
        stack.push(`rgb(${r}, ${g}, ${b})`);
      } else if (code === '0' || code === '') {
        stack.length = 0;
      }
      last = m.index + m[0].length;
    }
    pushText(text.slice(last));
  }

  function promptLine(extraCmd?: string): HTMLDivElement {
    const line = document.createElement('div');
    line.className = 'term-line';
    const user = document.createElement('span');
    user.className = 'term-user';
    user.textContent = 'clover';
    line.appendChild(user);
    line.appendChild(document.createTextNode('@'));
    const host = document.createElement('span');
    host.className = 'term-host';
    host.textContent = 'tools';
    line.appendChild(host);
    line.appendChild(document.createTextNode(':'));
    const path = document.createElement('span');
    path.className = 'term-path';
    path.textContent = `~/ascii-${currentMode}`;
    line.appendChild(path);
    const dollar = document.createElement('span');
    dollar.className = 'term-dollar';
    dollar.textContent = '$';
    line.appendChild(dollar);
    if (extraCmd !== undefined) {
      line.appendChild(document.createTextNode(' '));
      const cmd = document.createElement('span');
      cmd.className = 'term-cmd';
      cmd.textContent = extraCmd;
      line.appendChild(cmd);
    }
    return line;
  }

  function updateTermMeta(text: string): void {
    const clean = text.replace(/\x1b\[[0-9;]*m/g, '');
    if (!clean) {
      $<HTMLElement>('termMeta').textContent = '80×24';
      return;
    }
    const lines = clean.split('\n');
    const maxW = Math.max(...lines.map((l) => l.length));
    $<HTMLElement>('termMeta').textContent = `${maxW}×${lines.length}`;
  }

  function renderTerminal(text: string, withAnsi: boolean): void {
    termBody.textContent = '';
    termBody.appendChild(promptLine(buildCommand()));

    if (!text) {
      const hint = document.createElement('div');
      hint.className = 'term-hint';
      hint.textContent = '# 输入内容后点击「生成字符画」，结果会显示在这里';
      termBody.appendChild(hint);
      const fresh = promptLine();
      fresh.appendChild(cursorEl());
      termBody.appendChild(fresh);
      updateTermMeta('');
      return;
    }

    const pre = document.createElement('pre');
    pre.className = 'term-pre';
    if (withAnsi) {
      appendAnsi(pre, text);
    } else {
      pre.textContent = text;
    }
    termBody.appendChild(pre);
    const fresh = promptLine();
    fresh.appendChild(cursorEl());
    termBody.appendChild(fresh);
    updateTermMeta(text);
  }

  function render(): void {
    clearStatus();
    pendingInfo = '';
    let result: string | null = null;

    if (currentMode === 'figlet') {
      result = renderFiglet();
      if (!result) {
        if (!figletInput.value.trim()) {
          clearOutput();
          setStatus('info', '请输入英文或数字');
        }
        return;
      }
    } else if (currentMode === 'cjk') {
      result = renderCjk();
      if (!result) {
        if (!cjkInput.value.trim()) {
          clearOutput();
          setStatus('info', '请输入要转换的文字');
        }
        return;
      }
    } else {
      result = renderImage();
      if (!result) {
        clearOutput();
        setStatus('info', '请先选择一张图片');
        return;
      }
    }

    plainOutput = result;
    updateStats(result);
    const withAnsi = $<HTMLInputElement>('ansiColor').checked;
    const display =
      currentMode === 'image' && withAnsi ? ansiImage() : withAnsi ? ansiText(result) : result;
    renderTerminal(display, withAnsi);
    if (pendingInfo) {
      setStatus('info', pendingInfo);
      pendingInfo = '';
    } else {
      setStatus('success', '生成完成');
    }
  }

  /* ── ANSI 彩色 ── */

  function hsl2rgb(h: number, s: number, l: number): [number, number, number] {
    const f = (n: number) => {
      const k = (n + h * 12) % 12;
      const a = s * Math.min(l, 1 - l);
      return l - a * Math.max(-1, Math.min(k - 3, Math.min(9 - k, 1)));
    };
    return [Math.round(f(0) * 255), Math.round(f(8) * 255), Math.round(f(4) * 255)];
  }

  function ansiText(text: string): string {
    const lines = text.split('\n');
    const n = Math.max(1, lines.length - 1);
    return lines
      .map((line, i) => {
        const hue = 40 + (i / n) * 260;
        const [r, g, b] = hsl2rgb(hue / 360, 0.85, 0.55);
        return `\x1b[38;2;${r};${g};${b}m${line}\x1b[0m`;
      })
      .join('\n');
  }

  function ansiImage(): string {
    if (!lastImgRows) return plainOutput;
    return lastImgRows
      .map((row) => {
        let line = '';
        for (const cell of row) {
          line += `\x1b[38;2;${cell.r};${cell.g};${cell.b}m${cell.ch}`;
        }
        return line + '\x1b[0m';
      })
      .join('\n');
  }

  function copyText(): void {
    if (!plainOutput) {
      setStatus('error', '没有可复制的内容，请先生成字符画');
      return;
    }
    const withAnsi = $<HTMLInputElement>('ansiColor').checked;
    const text =
      currentMode === 'image' && withAnsi
        ? ansiImage()
        : withAnsi
          ? ansiText(plainOutput)
          : plainOutput;
    window.CT.copy(text, $<HTMLButtonElement>('asciiCopy'));
  }

  function downloadText(): void {
    if (!plainOutput) {
      setStatus('error', '没有可下载的内容，请先生成字符画');
      return;
    }
    const blob = new Blob([plainOutput], { type: 'text/plain;charset=utf-8' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    const d = new Date();
    const stamp = `${d.getFullYear()}${String(d.getMonth() + 1).padStart(2, '0')}${String(d.getDate()).padStart(2, '0')}`;
    a.download = `clover-ascii-art-${stamp}.txt`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    URL.revokeObjectURL(url);
    window.CT.showToast('已开始下载');
  }

  /* ── 事件绑定 ── */

  let timer: ReturnType<typeof setTimeout> | null = null;
  function scheduleRender(): void {
    if (timer) clearTimeout(timer);
    timer = setTimeout(render, 250);
  }

  $<HTMLButtonElement>('asciiRender').addEventListener('click', render);
  $<HTMLButtonElement>('asciiCopy').addEventListener('click', copyText);
  $<HTMLButtonElement>('asciiDownload').addEventListener('click', downloadText);

  $<HTMLButtonElement>('figletSample').addEventListener('click', () => {
    figletInput.value = 'CLOVER TOOLS';
    render();
  });
  $<HTMLButtonElement>('figletClear').addEventListener('click', () => {
    figletInput.value = '';
    clearOutput();
    clearStatus();
  });
  figletInput.addEventListener('input', scheduleRender);
  figletInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      render();
    }
  });

  $<HTMLButtonElement>('cjkSample').addEventListener('click', () => {
    cjkInput.value = '三叶草工具箱\nCloverTools';
    render();
  });
  $<HTMLButtonElement>('cjkClear').addEventListener('click', () => {
    cjkInput.value = '';
    clearOutput();
    clearStatus();
  });
  cjkInput.addEventListener('input', scheduleRender);
  cjkInput.addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      render();
    }
  });

  fontSelect.addEventListener('change', () => {
    updateFontHint();
    render();
  });
  $<HTMLSelectElement>('figletLayout').addEventListener('change', render);
  $<HTMLSelectElement>('figletWidth').addEventListener('change', render);
  $<HTMLSelectElement>('cjkRes').addEventListener('change', render);
  $<HTMLSelectElement>('cjkCharset').addEventListener('change', render);
  $<HTMLSelectElement>('cjkWidth').addEventListener('change', render);
  $<HTMLInputElement>('cjkInvert').addEventListener('change', render);
  $<HTMLSelectElement>('imgWidth').addEventListener('change', render);
  $<HTMLSelectElement>('imgCharset').addEventListener('change', render);
  $<HTMLSelectElement>('imgContrast').addEventListener('input', () => {
    const val = Number($<HTMLSelectElement>('imgContrast').value);
    $<HTMLElement>('imgContrastVal').textContent = `${val}%`;
    render();
  });
  $<HTMLInputElement>('imgInvert').addEventListener('change', render);

  const imgFile = $<HTMLInputElement>('imgFile');
  const drop = $<HTMLElement>('imgDrop');
  drop.addEventListener('click', () => imgFile.click());
  drop.addEventListener('keydown', (e) => {
    if (e.key === 'Enter' || e.key === ' ') {
      e.preventDefault();
      imgFile.click();
    }
  });
  drop.addEventListener('dragover', (e) => {
    e.preventDefault();
    drop.classList.add('dragover');
  });
  drop.addEventListener('dragleave', () => drop.classList.remove('dragover'));
  drop.addEventListener('drop', (e) => {
    e.preventDefault();
    drop.classList.remove('dragover');
    const file = e.dataTransfer?.files?.[0];
    if (file) void loadImageFile(file);
  });
  imgFile.addEventListener('change', () => {
    const file = imgFile.files?.[0];
    if (file) void loadImageFile(file);
  });
  $<HTMLButtonElement>('imgReplace').addEventListener('click', () => imgFile.click());
  $<HTMLButtonElement>('imgRemove').addEventListener('click', () => {
    currentImg = null;
    lastImgRows = null;
    currentImgName = '';
    imgFile.value = '';
    $<HTMLElement>('imgDrop').hidden = false;
    $<HTMLElement>('imgPreviewWrap').hidden = true;
    $<HTMLImageElement>('imgPreview').src = '';
    clearOutput();
    clearStatus();
  });

  $<HTMLInputElement>('ansiColor').addEventListener('change', () => {
    if (plainOutput) {
      const withAnsi = $<HTMLInputElement>('ansiColor').checked;
      const display =
        currentMode === 'image' && withAnsi
          ? ansiImage()
          : withAnsi
            ? ansiText(plainOutput)
            : plainOutput;
      renderTerminal(display, withAnsi);
    }
  });

  /* ── 初始化 ── */

  populateFonts();
  updateFontHint();
  setMode('figlet');