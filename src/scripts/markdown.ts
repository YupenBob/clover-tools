  import { byId, showStatus, hideStatus } from './toolkit';
  import { marked } from 'marked';
  import DOMPurify from 'dompurify';

  const DRAFT_KEY = 'ct-markdown-draft';
  const TIME_KEY = 'ct-markdown-writing-ms';
  const source = byId<HTMLTextAreaElement>('mdSource');
  const preview = byId<HTMLElement>('mdPreview');
  const body = byId<HTMLElement>('mdBody');
  const statsEl = byId<HTMLElement>('mdStats');
  const readingEl = byId<HTMLElement>('mdReading');
  const timeEl = byId<HTMLElement>('mdTime');
  const modal = byId<HTMLElement>('mdModal');
  const panel = document.querySelector<HTMLElement>('.tool-card-panel')!;
  const targetInput = byId<HTMLInputElement>('mdTarget');

  marked.setOptions({ gfm: true, breaks: true });

  // ── 草稿恢复 ──
  const saved = localStorage.getItem(DRAFT_KEY);
  if (saved !== null) {
    source.value = saved;
    if (saved.trim()) showStatus('mdStatus', 'info', '已恢复上次的编辑草稿');
  } else {
    source.value = '# CloverTools\n\n欢迎使用 **Markdown 编辑器**。\n\n- 实时预览，支持表格、任务列表、删除线\n- 使用工具栏或快捷键格式化\n- 内容自动保存为草稿';
  }

  // ── 统计与写作时长（持久化） ──
  let writingMs = Number(localStorage.getItem(TIME_KEY)) || 0;
  let lastTickAt = Date.now();

  function countWords(text: string): number {
    const zh = (text.match(/[\u4e00-\u9fa5]/g) || []).length;
    const en = (text.match(/[A-Za-z0-9]+/g) || []).length;
    return zh + en;
  }

  function updateStats() {
    const text = source.value;
    const chars = text.length;
    const words = countWords(text);
    const lines = text ? text.split('\n').length : 0;
    const paras = text.trim() ? text.trim().split(/\n\s*\n/).length : 0;
    const target = Number(targetInput.value) || 0;
    if (target > 0) {
      const pct = Math.min(100, Math.round((words / target) * 100));
      statsEl.textContent = `${chars} 字符 · ${words}/${target} 字 (${pct}%) · ${lines} 行 · ${paras} 段`;
      statsEl.style.color = words >= target ? 'var(--success)' : '';
    } else {
      statsEl.textContent = `${chars} 字符 · ${words} 字 · ${lines} 行 · ${paras} 段`;
      statsEl.style.color = '';
    }
    readingEl.textContent = words > 0 ? `阅读约 ${Math.max(1, Math.round(words / 400))} 分钟` : '阅读约 0 分钟';
  }

  function updateClock() {
    const now = Date.now();
    const delta = Math.min(now - lastTickAt, 3000);
    if (document.activeElement === source && !document.hidden) writingMs += delta;
    lastTickAt = now;
    localStorage.setItem(TIME_KEY, String(writingMs));
    const s = Math.floor(writingMs / 1000);
    timeEl.textContent = `写作 ${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`;
  }

  // ── 代码高亮 ──
  function escHtml(s: string): string {
    return s.replace(/&/g, '&amp;').replace(/</g, '&lt;').replace(/>/g, '&gt;');
  }

  const KW: Record<string, string[]> = {
    js: ['const', 'let', 'var', 'function', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'new', 'class', 'extends', 'super', 'import', 'export', 'from', 'default', 'async', 'await', 'try', 'catch', 'finally', 'throw', 'typeof', 'instanceof', 'this', 'in', 'of', 'yield', 'static', 'get', 'set', 'null', 'undefined', 'true', 'false', 'interface', 'type', 'enum', 'implements', 'public', 'private', 'readonly', 'abstract', 'declare', 'as', 'satisfies', 'keyof', 'never', 'unknown', 'any', 'string', 'number', 'boolean', 'symbol'],
    py: ['def', 'return', 'if', 'elif', 'else', 'for', 'while', 'import', 'from', 'as', 'class', 'try', 'except', 'finally', 'raise', 'with', 'lambda', 'pass', 'break', 'continue', 'None', 'True', 'False', 'and', 'or', 'not', 'in', 'is', 'yield', 'global', 'nonlocal', 'async', 'await', 'self', 'del', 'assert'],
    bash: ['if', 'then', 'else', 'elif', 'fi', 'for', 'while', 'do', 'done', 'case', 'esac', 'function', 'return', 'export', 'local', 'readonly', 'echo', 'exit', 'cd', 'set', 'shift', 'source'],
    sql: ['select', 'from', 'where', 'insert', 'into', 'values', 'update', 'set', 'delete', 'create', 'table', 'drop', 'alter', 'join', 'left', 'right', 'inner', 'outer', 'full', 'cross', 'on', 'as', 'group', 'by', 'order', 'having', 'limit', 'offset', 'union', 'all', 'distinct', 'and', 'or', 'not', 'in', 'exists', 'between', 'like', 'is', 'null', 'primary', 'key', 'foreign', 'references', 'index', 'view', 'procedure', 'begin', 'commit', 'rollback', 'case', 'when', 'then', 'else', 'end', 'default', 'constraint', 'unique', 'check', 'count', 'sum', 'avg', 'min', 'max'],
    css: ['@media', '@keyframes', '@import', '@font-face', '@supports', 'important'],
    html: ['html', 'head', 'body', 'div', 'span', 'p', 'a', 'img', 'ul', 'ol', 'li', 'table', 'tr', 'td', 'th', 'thead', 'tbody', 'script', 'style', 'link', 'meta', 'title', 'h1', 'h2', 'h3', 'h4', 'h5', 'h6', 'section', 'header', 'footer', 'nav', 'main', 'aside', 'form', 'input', 'button', 'select', 'option', 'textarea', 'label', 'iframe', 'pre', 'code', 'blockquote', 'strong', 'em', 'br', 'hr', 'svg', 'path', 'rect', 'circle', 'g'],
    java: ['public', 'private', 'protected', 'static', 'final', 'void', 'int', 'long', 'double', 'float', 'boolean', 'char', 'string', 'class', 'interface', 'extends', 'implements', 'new', 'return', 'if', 'else', 'for', 'while', 'do', 'switch', 'case', 'break', 'continue', 'try', 'catch', 'finally', 'throw', 'throws', 'package', 'import', 'this', 'super', 'null', 'true', 'false', 'synchronized', 'abstract', 'volatile', 'enum'],
    c: ['include', 'define', 'ifdef', 'ifndef', 'endif', 'if', 'else', 'for', 'while', 'do', 'return', 'void', 'int', 'long', 'short', 'char', 'float', 'double', 'unsigned', 'signed', 'struct', 'union', 'enum', 'typedef', 'const', 'static', 'extern', 'register', 'switch', 'case', 'break', 'continue', 'default', 'goto', 'sizeof', 'true', 'false', 'null', 'new', 'delete', 'class', 'public', 'private', 'protected', 'virtual', 'override', 'friend', 'template', 'namespace', 'using', 'try', 'catch', 'throw'],
    go: ['package', 'import', 'func', 'var', 'const', 'type', 'struct', 'interface', 'map', 'chan', 'go', 'defer', 'return', 'if', 'else', 'for', 'range', 'switch', 'case', 'break', 'continue', 'fallthrough', 'select', 'default', 'true', 'false', 'nil', 'make', 'new', 'len', 'cap', 'append', 'error'],
    rust: ['fn', 'let', 'mut', 'const', 'static', 'struct', 'enum', 'trait', 'impl', 'mod', 'use', 'pub', 'crate', 'self', 'super', 'match', 'if', 'else', 'for', 'while', 'loop', 'return', 'break', 'continue', 'async', 'await', 'dyn', 'where', 'ref', 'move', 'as', 'in', 'true', 'false', 'None', 'Some', 'Ok', 'Err'],
    yaml: ['true', 'false', 'null', 'yes', 'no', 'on', 'off'],
  };

  interface LangSpec {
    comment?: RegExp;
    string?: RegExp;
    keywords?: string[];
    number?: boolean;
    func?: boolean;
    tag?: boolean;
    attr?: boolean;
    prop?: boolean;
    ci?: boolean;
  }

  const JS_STR = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'|`(?:[^`\\\n]|\\.)*`/;
  const SIMPLE_STR = /"(?:[^"\\\n]|\\.)*"|'(?:[^'\\\n]|\\.)*'/;
  const C_COMMENT = /\/\/.*$|\/\*[\s\S]*?\*\//;
  const HASH_COMMENT = /#.*$/;
  const SQL_COMMENT = /--.*$|#.*$/;

  function langSpec(raw: string): LangSpec | null {
    const l = raw.toLowerCase().replace('++', 'pp').replace('#', 'sharp').replace('csharp', 'c');
    if (/^(js|javascript|jsx|tsx|mjs|cjs|node|ts|typescript)$/.test(l)) {
      return { comment: C_COMMENT, string: JS_STR, keywords: KW.js, number: true, func: true };
    }
    if (/^(py|python|python3)$/.test(l)) return { comment: HASH_COMMENT, string: SIMPLE_STR, keywords: KW.py, number: true, func: true };
    if (/^(bash|sh|shell|zsh|fish)$/.test(l)) return { comment: HASH_COMMENT, string: SIMPLE_STR, keywords: KW.bash, ci: true };
    if (/^(sql|mysql|postgres|postgresql|sqlite|plsql)$/.test(l)) return { comment: SQL_COMMENT, string: SIMPLE_STR, keywords: KW.sql, number: true, ci: true };
    if (/^(css|scss|less|sass)$/.test(l)) return { comment: /\/\*[\s\S]*?\*\//, string: SIMPLE_STR, keywords: KW.css, number: true, prop: true };
    if (/^(html|xml|svg)$/.test(l)) return { comment: /<!--[\s\S]*?-->/, string: SIMPLE_STR, keywords: KW.html, tag: true, attr: true, ci: true };
    if (/^java$/.test(l)) return { comment: C_COMMENT, string: SIMPLE_STR, keywords: KW.java, number: true, func: true };
    if (/^(c|cpp|cc|h|hpp)$/.test(l)) return { comment: C_COMMENT, string: SIMPLE_STR, keywords: KW.c, number: true, func: true };
    if (/^(go|golang)$/.test(l)) return { comment: C_COMMENT, string: SIMPLE_STR, keywords: KW.go, number: true, func: true };
    if (/^(rust|rs)$/.test(l)) return { comment: C_COMMENT, string: SIMPLE_STR, keywords: KW.rust, number: true, func: true };
    if (/^(yaml|yml)$/.test(l)) return { comment: HASH_COMMENT, string: SIMPLE_STR, keywords: KW.yaml };
    return null;
  }

  function highlightLine(line: string, spec: LangSpec): string {
    const parts: { t: string; re: RegExp }[] = [];
    if (spec.comment) parts.push({ t: 'cmt', re: spec.comment });
    if (spec.string) parts.push({ t: 'str', re: spec.string });
    if (spec.number) parts.push({ t: 'num', re: /\b(?:0x[\da-fA-F]+|\d+(?:\.\d+)?(?:[eE][+-]?\d+)?)\b/ });
    if (spec.keywords && spec.keywords.length) parts.push({ t: 'kw', re: new RegExp('\\b(?:' + spec.keywords.join('|') + ')\\b') });
    if (spec.tag) parts.push({ t: 'tag', re: /<\/?[A-Za-z][\w-]*/ });
    if (spec.attr) parts.push({ t: 'attr', re: /[A-Za-z-]+(?==)/ });
    if (spec.prop) parts.push({ t: 'prop', re: /[A-Za-z-]+(?=\s*:)/ });
    if (spec.func) parts.push({ t: 'fn', re: /[A-Za-z_$][\w$]*(?=\s*\()/ });
    if (!parts.length) return escHtml(line);

    const re = new RegExp(parts.map((p) => `(?<${p.t}>${p.re.source})`).join('|'), 'g' + (spec.ci ? 'i' : ''));
    let out = '';
    let last = 0;
    for (const m of line.matchAll(re)) {
      const full = m[0];
      const idx = m.index ?? 0;
      const type = parts.find((p) => m.groups?.[p.t] !== undefined)?.t;
      out += escHtml(line.slice(last, idx));
      out += type ? `<span class="hl-${type}">${escHtml(full)}</span>` : escHtml(full);
      last = idx + full.length;
    }
    out += escHtml(line.slice(last));
    return out;
  }

  function decorateCode(root: HTMLElement) {
    root.querySelectorAll('pre code').forEach((el) => {
      const m = (el.className || '').match(/language-([a-zA-Z0-9+#-]+)/);
      const spec = m ? langSpec(m[1]) : null;
      if (!spec) return;
      const raw = el.textContent || '';
      el.innerHTML = raw.split('\n').map((ln) => highlightLine(ln, spec)).join('\n');
    });
  }

  // 预览代码块一键复制（仅预览，导出不含按钮）
  function attachCodeCopy(root: HTMLElement) {
    root.querySelectorAll('pre').forEach((pre) => {
      if (pre.dataset.copySet) return;
      pre.dataset.copySet = '1';
      const btn = document.createElement('button');
      btn.type = 'button';
      btn.className = 'code-copy-btn';
      btn.title = '复制代码';
      btn.innerHTML = '<i class="bi bi-clipboard" aria-hidden="true"></i>';
      btn.addEventListener('click', (e) => {
        e.stopPropagation();
        window.CT.copy(pre.querySelector('code')?.textContent || '', btn);
      });
      pre.appendChild(btn);
    });
  }

  // ── 渲染 ──
  let renderTimer: ReturnType<typeof setTimeout>;
  function renderNow() {
    const html = marked.parse(source.value || '') as string;
    preview.innerHTML = DOMPurify.sanitize(html, { ADD_DATA_URI_TAGS: ['img'] });
    decorateCode(preview);
    attachCodeCopy(preview);
    if (tocOpen) buildToc();
    updateStats();
  }
  function render() {
    clearTimeout(renderTimer);
    renderTimer = setTimeout(renderNow, 120);
  }

  // ── 查找 / 替换 ──
  const findBar = byId<HTMLElement>('mdFindBar');
  const findInput = byId<HTMLInputElement>('mdFind');
  const replaceInput = byId<HTMLInputElement>('mdReplace');
  const findCountEl = byId<HTMLElement>('mdFindCount');
  let findCaseSensitive = false;

  function findAllMatches(query: string): number[] {
    const text = source.value;
    const out: number[] = [];
    if (!query) return out;
    const hay = findCaseSensitive ? text : text.toLowerCase();
    const q = findCaseSensitive ? query : query.toLowerCase();
    let i = 0;
    while (i < hay.length) {
      const at = hay.indexOf(q, i);
      if (at === -1) break;
      out.push(at);
      i = at + Math.max(1, q.length);
    }
    return out;
  }

  function refreshFindCount(): number[] {
    const matches = findAllMatches(findInput.value);
    findCountEl.textContent = matches.length ? `${matches.length} 个匹配` : '0 个匹配';
    return matches;
  }

  function goFind(direction: 1 | -1) {
    const q = findInput.value;
    const matches = findAllMatches(q);
    if (!matches.length) {
      findCountEl.textContent = '0 个匹配';
      return;
    }
    const pos = source.selectionStart;
    let idx: number;
    if (direction === 1) {
      idx = matches.findIndex((at) => at > pos || (at === pos && source.selectionEnd !== pos + q.length));
      if (idx === -1) idx = 0;
    } else {
      idx = matches.findLastIndex((at) => at < pos || (at === pos && source.selectionEnd !== pos + q.length));
      if (idx === -1) idx = matches.length - 1;
    }
    source.focus();
    source.setSelectionRange(matches[idx], matches[idx] + q.length);
    findCountEl.textContent = `${idx + 1}/${matches.length}`;
  }

  function replaceCurrent() {
    const q = findInput.value;
    if (!q) return;
    const sel = source.value.slice(source.selectionStart, source.selectionEnd);
    if (sel !== q) {
      goFind(1);
      return;
    }
    replaceRange(source.selectionStart, source.selectionEnd, replaceInput.value);
    goFind(1);
  }

  function replaceAllMatches() {
    const q = findInput.value;
    const matches = findAllMatches(q);
    if (!matches.length) {
      findCountEl.textContent = '0 个匹配';
      return;
    }
    if (matches.length > 100 && !window.confirm(`将替换全部 ${matches.length} 处，继续？`)) return;
    const repl = replaceInput.value;
    const text = source.value;
    let out = '';
    let last = 0;
    for (const at of matches) {
      out += text.slice(last, at) + repl;
      last = at + q.length;
    }
    out += text.slice(last);
    replaceRange(0, text.length, out);
    findCountEl.textContent = `已替换 ${matches.length} 处`;
  }

  function openFind() {
    findBar.hidden = false;
    findInput.focus();
    findInput.select();
    refreshFindCount();
  }

  function closeFind() {
    findBar.hidden = true;
  }

  findInput.addEventListener('input', refreshFindCount);
  findInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      goFind(e.shiftKey ? -1 : 1);
    }
  });
  replaceInput.addEventListener('keydown', (e) => {
    if (e.key === 'Enter') {
      e.preventDefault();
      replaceCurrent();
    }
  });
  byId<HTMLButtonElement>('mdFindPrev').addEventListener('click', () => goFind(-1));
  byId<HTMLButtonElement>('mdFindNext').addEventListener('click', () => goFind(1));
  byId<HTMLButtonElement>('mdReplaceOne').addEventListener('click', replaceCurrent);
  byId<HTMLButtonElement>('mdReplaceAll').addEventListener('click', replaceAllMatches);
  byId<HTMLButtonElement>('mdFindClose').addEventListener('click', closeFind);
  byId<HTMLButtonElement>('mdFindCase').addEventListener('click', (e) => {
    findCaseSensitive = !findCaseSensitive;
    e.currentTarget.classList.toggle('active', findCaseSensitive);
    findInput.focus();
    refreshFindCount();
  });

  // ── 字数目标 ──
  const TARGET_KEY = 'ct-markdown-target';
  const savedTarget = localStorage.getItem(TARGET_KEY);
  if (savedTarget) targetInput.value = savedTarget;
  targetInput.addEventListener('change', () => {
    localStorage.setItem(TARGET_KEY, targetInput.value);
    updateStats();
  });

  // ── 撤销 / 重做 ──
  // 思路：beforeinput 记录“编辑块”起始状态，停顿 500ms 或执行撤销时提交；
  // 连续键入合并为一个撤销步，整篇替换（选中全部后改写，如加载/清空）视为新文档并重置历史。
  const MAX_UNDO = 100;
  type Snap = { value: string; start: number; end: number };
  const undoStack: Snap[] = [];
  const redoStack: Snap[] = [];
  let restoring = false;
  let pendingPre: Snap | null = null;
  let chunkTimer: ReturnType<typeof setTimeout> | null = null;

  function commitChunk() {
    if (chunkTimer) {
      clearTimeout(chunkTimer);
      chunkTimer = null;
    }
    if (!pendingPre) return;
    const last = undoStack[undoStack.length - 1];
    if (!last || last.value !== pendingPre.value) {
      undoStack.push(pendingPre);
      if (undoStack.length > MAX_UNDO) undoStack.shift();
    }
    redoStack.length = 0;
    pendingPre = null;
  }

  function restoreSnapshot(s: Snap) {
    restoring = true;
    source.value = s.value;
    source.selectionStart = Math.min(s.start, s.value.length);
    source.selectionEnd = Math.min(s.end, s.value.length);
    restoring = false;
    localStorage.setItem(DRAFT_KEY, source.value);
    renderNow();
  }

  function undo() {
    commitChunk();
    const prev = undoStack.pop();
    if (!prev) return;
    redoStack.push({ value: source.value, start: source.selectionStart, end: source.selectionEnd });
    restoreSnapshot(prev);
  }

  function redo() {
    commitChunk();
    const next = redoStack.pop();
    if (!next) return;
    undoStack.push({ value: source.value, start: source.selectionStart, end: source.selectionEnd });
    restoreSnapshot(next);
  }

  function replaceRange(start: number, end: number, text: string) {
    if (!pendingPre) pendingPre = { value: source.value, start, end };
    source.focus();
    source.setSelectionRange(start, end);
    if (text === '') {
      // 空插入直接改值：execCommand('insertText', '', '') 在 Chromium 会吞掉下一次输入
      source.value = source.value.slice(0, start) + source.value.slice(end);
      source.dispatchEvent(new Event('input'));
    } else {
      const applied = document.execCommand('insertText', false, text);
      if (!applied) {
        source.value = source.value.slice(0, start) + text + source.value.slice(end);
        source.dispatchEvent(new Event('input'));
      }
    }
    if (chunkTimer) clearTimeout(chunkTimer);
    chunkTimer = setTimeout(commitChunk, 500);
  }

  source.addEventListener('beforeinput', () => {
    if (restoring) return;
    const fullReplace = source.selectionStart === 0 && source.selectionEnd === source.value.length;
    if (fullReplace) {
      commitChunk();
      undoStack.length = 0;
      redoStack.length = 0;
      return;
    }
    if (!pendingPre) {
      pendingPre = { value: source.value, start: source.selectionStart, end: source.selectionEnd };
    }
    if (chunkTimer) clearTimeout(chunkTimer);
    chunkTimer = setTimeout(commitChunk, 500);
  });

  source.addEventListener('input', () => {
    if (restoring) return;
    localStorage.setItem(DRAFT_KEY, source.value);
    render();
  });

  // ── 源码行号 ──
  const linesEl = byId<HTMLElement>('mdLines');
  let activeLine = 1;
  function renderLines() {
    const count = source.value.split('\n').length;
    let html = '';
    for (let i = 1; i <= count; i++) {
      html += `<span class="${i === activeLine ? 'md-line-active' : ''}">${i}</span>\n`;
    }
    linesEl.innerHTML = html;
  }
  function updateActiveLine() {
    const caret = source.selectionStart ?? 0;
    const line = source.value.slice(0, caret).split('\n').length;
    if (line === activeLine) return;
    activeLine = line;
    renderLines();
  }
  source.addEventListener('input', renderLines);
  source.addEventListener('click', updateActiveLine);
  source.addEventListener('keyup', updateActiveLine);
  source.addEventListener('keydown', (e) => {
    if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'Home', 'End', 'PageUp', 'PageDown'].includes(e.key)) {
      requestAnimationFrame(updateActiveLine);
    }
  });
  source.addEventListener('scroll', () => {
    linesEl.scrollTop = source.scrollTop;
  });
  // 行号栏高度跟随 textarea（含用户拉伸 resize）
  if (typeof ResizeObserver !== 'undefined') {
    new ResizeObserver(() => {
      linesEl.style.height = `${source.clientHeight}px`;
    }).observe(source);
  }
  linesEl.style.height = `${source.clientHeight}px`;
  renderLines();

  // ── 视图切换 ──
  for (const btn of document.querySelectorAll<HTMLButtonElement>('.md-view')) {
    btn.addEventListener('click', () => {
      const view = btn.dataset.view || 'split';
      body.className = `md-body ${view}`;
      for (const b of document.querySelectorAll<HTMLButtonElement>('.md-view')) {
        b.classList.toggle('active', b === btn);
      }
      if (view === 'edit') source.focus();
      if (view === 'preview' && source.value) renderNow();
    });
  }

  // ── 文本操作 ──
  function wrap(prefix: string, suffix: string, placeholder: string) {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const sel = source.value.slice(start, end);
    if (sel.startsWith(prefix) && sel.endsWith(suffix) && sel.length >= prefix.length + suffix.length) {
      const inner = sel.slice(prefix.length, sel.length - suffix.length);
      replaceRange(start, end, inner);
      source.selectionStart = start;
      source.selectionEnd = start + inner.length;
      return;
    }
    const content = sel || placeholder;
    replaceRange(start, end, prefix + content + suffix);
    source.selectionStart = start + prefix.length;
    source.selectionEnd = start + prefix.length + content.length;
  }

  function lineBounds(value: string, start: number, end: number): [number, number] {
    const lineStart = value.lastIndexOf('\n', Math.max(0, start - 1)) + 1;
    const nl = value.indexOf('\n', end);
    return [lineStart, nl === -1 ? value.length : nl];
  }

  function blockLine(prefix: string) {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const value = source.value;
    const [lineStart, lineEnd] = lineBounds(value, start, end);
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const marker = prefix.trim();
    const isHeading = /^#{1,6}$/.test(marker);
    const isOrdered = /^\d+[.)]$/.test(marker);
    const empty = (l: string) => !l.trim();

    let out: string[];
    if (isHeading) {
      const allExact = lines.every((l) => empty(l) || l.startsWith(prefix));
      if (allExact) {
        out = lines.map((l) => (l.startsWith(prefix) ? l.slice(prefix.length) : l));
      } else {
        out = lines.map((l) => {
          if (empty(l)) return l;
          const m = l.match(/^(#{1,6})\s+(.*)$/);
          return m ? prefix + m[2] : prefix + l;
        });
      }
    } else if (isOrdered) {
      const isNum = (l: string) => /^\d+[.)]\s+/.test(l);
      const allNum = lines.every((l) => empty(l) || isNum(l));
      if (allNum) {
        out = lines.map((l) => (isNum(l) ? l.replace(/^\d+[.)]\s+/, '') : l));
      } else {
        out = lines.map((l) => (empty(l) || isNum(l) ? l : prefix + l));
      }
    } else {
      const isMarked =
        prefix === '> ' ? (l: string) => l.startsWith('>') :
        prefix === '- [ ] ' ? (l: string) => /^[-*+]\s+\[\s*[xX ]?\s*\]\s+/.test(l) :
        (l: string) => /^[-*+]\s+/.test(l);
      const allMarked = lines.every((l) => empty(l) || isMarked(l));
      if (allMarked) {
        const strip =
          prefix === '> ' ? (l: string) => l.replace(/^>\s?/, '') :
          prefix === '- [ ] ' ? (l: string) => l.replace(/^[-*+]\s+\[\s*[xX ]?\s*\]\s+/, '') :
          (l: string) => l.replace(/^[-*+]\s+/, '');
        out = lines.map((l) => (empty(l) ? l : strip(l)));
      } else {
        out = lines.map((l) => (empty(l) || isMarked(l) ? l : prefix + l));
      }
    }

    const text = out.join('\n');
    replaceRange(lineStart, lineEnd, text);
    source.selectionStart = lineStart;
    source.selectionEnd = lineStart + text.length;
  }

  function indent(shift: boolean) {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    const value = source.value;
    const [lineStart, lineEnd] = lineBounds(value, start, end);
    const lines = value.slice(lineStart, lineEnd).split('\n');
    const out = lines.map((line) => (shift ? line.replace(/^ {1,2}/, '') : '  ' + line)).join('\n');
    replaceRange(lineStart, lineEnd, out);
    if (start === end) {
      const col = start - lineStart;
      const newCol = shift ? Math.max(0, col - 2) : col + 2;
      source.selectionStart = lineStart + newCol;
      source.selectionEnd = lineStart + newCol;
    } else {
      source.selectionStart = lineStart;
      source.selectionEnd = lineStart + out.length;
    }
  }

  // ── 图片粘贴 / 拖拽 ──
  function insertText(text: string) {
    const start = source.selectionStart;
    const end = source.selectionEnd;
    replaceRange(start, end, text);
  }

  function insertImageDataUrl(dataUrl: string) {
    insertText(`\n![图片](${dataUrl})\n`);
    showStatus('mdStatus', 'success', '已插入图片（Base64 内嵌）');
  }

  source.addEventListener('paste', (e) => {
    const items = e.clipboardData?.items || [];
    for (const item of items) {
      if (item.type.startsWith('image/')) {
        e.preventDefault();
        const file = item.getAsFile();
        if (!file) return;
        const reader = new FileReader();
        reader.onload = () => insertImageDataUrl(reader.result as string);
        reader.readAsDataURL(file);
        return;
      }
    }
  });

  source.addEventListener('drop', (e) => {
    const file = e.dataTransfer?.files?.[0];
    if (file && file.type.startsWith('image/')) {
      e.preventDefault();
      const reader = new FileReader();
      reader.onload = () => insertImageDataUrl(reader.result as string);
      reader.readAsDataURL(file);
    }
  });

  // ── 滚动同步（仅分屏） ──
  let syncingScroll = false;
  function syncScroll(from: HTMLElement, to: HTMLElement) {
    if (syncingScroll || !body.classList.contains('split')) return;
    syncingScroll = true;
    const maxFrom = from.scrollHeight - from.clientHeight;
    const maxTo = to.scrollHeight - to.clientHeight;
    if (maxFrom > 0 && maxTo > 0) {
      to.scrollTop = (from.scrollTop / maxFrom) * maxTo;
    }
    requestAnimationFrame(() => {
      syncingScroll = false;
    });
  }
  source.addEventListener('scroll', () => syncScroll(source, preview));
  preview.addEventListener('scroll', () => syncScroll(preview, source));

  // ── 全屏 ──
  function toggleFullscreen() {
    if (document.fullscreenElement) {
      document.exitFullscreen().catch(() => {});
    } else {
      panel.requestFullscreen().catch(() => showStatus('mdStatus', 'info', '当前环境不支持全屏'));
    }
  }

  // ── 帮助弹窗 ──
  function openHelp() {
    modal.hidden = false;
  }
  function closeHelp() {
    modal.hidden = true;
  }
  byId<HTMLButtonElement>('mdModalClose').addEventListener('click', closeHelp);
  modal.addEventListener('click', (e) => {
    if (e.target === modal) closeHelp();
  });

  // ── 目录大纲 ──
  const tocPanel = byId<HTMLElement>('mdToc');
  let tocOpen = false;

  function slugify(text: string): string {
    const s = text
      .trim()
      .toLowerCase()
      .replace(/[^\w\u4e00-\u9fa5-]+/g, '-')
      .replace(/-+/g, '-')
      .replace(/^-|-$/g, '');
    return s || 'section';
  }

  function buildToc() {
    tocPanel.innerHTML = '';
    const headings = Array.from(preview.querySelectorAll<HTMLElement>('h1, h2, h3, h4, h5, h6'));
    const used = new Map<string, number>();
    for (const h of headings) {
      let id = slugify(h.textContent || '');
      const n = used.get(id) || 0;
      used.set(id, n + 1);
      if (n > 0) id = `${id}-${n}`;
      h.id = id;
      const level = Number(h.tagName[1]);
      const a = document.createElement('a');
      a.href = `#${id}`;
      a.textContent = h.textContent || '';
      a.style.paddingLeft = `${8 + (level - 1) * 14}px`;
      a.addEventListener('click', (ev) => {
        ev.preventDefault();
        const top = h.getBoundingClientRect().top - preview.getBoundingClientRect().top + preview.scrollTop;
        preview.scrollTo({ top: Math.max(0, top - 12), behavior: 'smooth' });
      });
      tocPanel.appendChild(a);
    }
    updateTocActive();
  }

  function toggleToc() {
    tocOpen = !tocOpen;
    tocPanel.hidden = !tocOpen;
    if (tocOpen) buildToc();
  }

  // 目录高亮当前阅读章节
  function updateTocActive() {
    if (!tocOpen) return;
    const headings = Array.from(preview.querySelectorAll('h1, h2, h3, h4, h5, h6'));
    const previewTop = preview.getBoundingClientRect().top;
    let current = '';
    for (const h of headings) {
      if (h.getBoundingClientRect().top - previewTop <= 90) current = h.id;
      else break;
    }
    tocPanel.querySelectorAll('a').forEach((a) => {
      a.classList.toggle('active', a.getAttribute('href') === '#' + current);
    });
  }
  preview.addEventListener('scroll', updateTocActive);

  const COMMANDS: Record<string, () => void> = {
    h1: () => blockLine('# '),
    h2: () => blockLine('## '),
    h3: () => blockLine('### '),
    bold: () => wrap('**', '**', '加粗文本'),
    italic: () => wrap('*', '*', '斜体文本'),
    strike: () => wrap('~~', '~~', '删除线文本'),
    code: () => wrap('`', '`', 'code'),
    codeblock: () => {
      const start = source.selectionStart;
      const end = source.selectionEnd;
      const sel = source.value.slice(start, end) || '代码';
      const text = `\n\`\`\`\n${sel}\n\`\`\`\n`;
      replaceRange(start, end, text);
      source.selectionStart = start + 4;
      source.selectionEnd = start + 4 + sel.length;
    },
    quote: () => blockLine('> '),
    ul: () => blockLine('- '),
    ol: () => blockLine('1. '),
    task: () => blockLine('- [ ] '),
    link: () => {
      const start = source.selectionStart;
      const end = source.selectionEnd;
      const sel = source.value.slice(start, end) || '链接文字';
      replaceRange(start, end, `[${sel}](https://example.com)`);
      const urlStart = start + sel.length + 3;
      source.selectionStart = urlStart;
      source.selectionEnd = urlStart + 19;
    },
    image: () => {
      const start = source.selectionStart;
      const end = source.selectionEnd;
      const sel = source.value.slice(start, end) || '图片描述';
      replaceRange(start, end, `![${sel}](https://example.com/image.png)`);
      const urlStart = start + sel.length + 4;
      source.selectionStart = urlStart;
      source.selectionEnd = urlStart + 27;
    },
    table: () => {
      const t = '\n| 列1 | 列2 | 列3 |\n| --- | --- | --- |\n| 内容 | 内容 | 内容 |\n';
      const start = source.selectionStart;
      const end = source.selectionEnd;
      replaceRange(start, end, t);
      const cell = start + t.indexOf('内容');
      source.selectionStart = cell;
      source.selectionEnd = cell + 2;
    },
    hr: () => {
      const start = source.selectionStart;
      const end = source.selectionEnd;
      const text = '\n\n---\n\n';
      replaceRange(start, end, text);
      const pos = start + text.length;
      source.selectionStart = pos;
      source.selectionEnd = pos;
    },
    undo,
    redo,
    toc: toggleToc,
    fullscreen: toggleFullscreen,
    help: openHelp,
    draft: () => {
      if (window.confirm('清空全部内容与已保存的草稿？')) {
        replaceRange(0, source.value.length, '');
        localStorage.removeItem(DRAFT_KEY);
        localStorage.removeItem(TIME_KEY);
        writingMs = 0;
        hideStatus('mdStatus');
        showStatus('mdStatus', 'success', '已清空草稿');
      }
    },
  };

  for (const btn of document.querySelectorAll<HTMLButtonElement>('.md-tbtn')) {
    const cmd = btn.dataset.cmd || '';
    btn.addEventListener('click', () => {
      const fn = COMMANDS[cmd];
      if (fn) {
        fn();
        source.focus();
      }
    });
  }

  // ── 快捷键 ──
  function isInsideCodeFence(value: string, pos: number): boolean {
    let fences = 0;
    for (const line of value.slice(0, pos).split('\n')) {
      if (/^\s*```/.test(line)) fences++;
    }
    return fences % 2 === 1;
  }

  function handleEnter() {
    const value = source.value;
    const pos = source.selectionStart;
    if (isInsideCodeFence(value, pos)) return false;
    const lineStart = value.lastIndexOf('\n', Math.max(0, pos - 1)) + 1;
    // 只取当前行（到下一个换行符为止），避免把后续内容误判为列表项
    const lineEnd = value.indexOf('\n', pos);
    const line = value.slice(lineStart, lineEnd === -1 ? value.length : lineEnd);
    const m = line.match(/^(\s*)([-*+]\s+\[\s*[xX ]?\s*\]\s+|[-*+]\s+|\d+[.)]\s+|>\s?)/);
    if (!m) return false;
    const marker = m[1] + m[2];
    const rest = line.slice(marker.length);
    if (!rest.trim()) {
      // 空列表项：回车退出列表
      replaceRange(lineStart, lineStart + marker.length, '');
    } else {
      replaceRange(pos, pos, '\n' + marker);
    }
    return true;
  }

  source.addEventListener('keydown', (e) => {
    if (e.key === 'Tab') {
      e.preventDefault();
      indent(e.shiftKey);
      return;
    }
    if (e.key === 'Enter' && !e.ctrlKey && !e.metaKey) {
      if (handleEnter()) e.preventDefault();
      return;
    }
    if (e.key === 'Enter' && e.ctrlKey) {
      e.preventDefault();
      document.querySelector<HTMLButtonElement>('.md-view[data-view="preview"]')?.click();
      return;
    }
    if (!e.ctrlKey && !e.metaKey) return;
    const k = e.key.toLowerCase();
    if (k === 'f') {
      e.preventDefault();
      openFind();
      return;
    }
    if (e.shiftKey && k === 'delete') {
      e.preventDefault();
      COMMANDS.draft();
      return;
    }
    if (e.shiftKey && (k === 'z' || k === 'y')) {
      e.preventDefault();
      redo();
      return;
    }
    if (k === 'z' || k === 'y') {
      e.preventDefault();
      if (k === 'z') undo();
      else redo();
      return;
    }
    if (k === '1' || k === '2' || k === '3') {
      e.preventDefault();
      COMMANDS['h' + k]();
      return;
    }
    const withShift: Record<string, string> = { c: 'code', k: 'codeblock', q: 'quote' };
    const plain: Record<string, string> = { b: 'bold', i: 'italic', u: 'strike', k: 'link' };
    const cmd = e.shiftKey ? withShift[k] : plain[k];
    if (cmd) {
      e.preventDefault();
      COMMANDS[cmd]();
    }
  });

  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      closeHelp();
      closeFind();
    }
  });

  // ── 导出 ──
  function download(filename: string, content: string, mime: string) {
    const blob = new Blob([content], { type: mime });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = filename;
    document.body.appendChild(a);
    a.click();
    a.remove();
    URL.revokeObjectURL(url);
  }

  function renderedHtml(): string {
    const html = marked.parse(source.value) as string;
    const safe = DOMPurify.sanitize(html, { ADD_DATA_URI_TAGS: ['img'] });
    const tmp = document.createElement('div');
    tmp.innerHTML = safe;
    decorateCode(tmp);
    return tmp.innerHTML;
  }

  // 从首个一级标题提取导出文件名
  function exportTitle(): string {
    const m = source.value.match(/^#\s+(.+)$/m);
    const t = m ? m[1].trim() : '';
    return t.replace(/[\\/:*?"<>|]/g, '-').replace(/\s+/g, '-').slice(0, 40) || 'clover-notes';
  }

  const EXPORT_CSS = `body{font-family:-apple-system,'Segoe UI','PingFang SC','Microsoft YaHei',sans-serif;max-width:800px;margin:0 auto;padding:32px 20px;color:#1f2937;line-height:1.75;font-size:16px}h1,h2,h3,h4{line-height:1.3;margin:1.1em 0 .5em}h1{font-size:1.7em;border-bottom:1px solid #e5e7eb;padding-bottom:.3em}h2{font-size:1.4em;border-bottom:1px solid #e5e7eb;padding-bottom:.25em}code{font-family:ui-monospace,Consolas,monospace;font-size:.88em;background:#f3f4f6;padding:2px 6px;border-radius:4px}pre{background:#f9fafb;border:1px solid #e5e7eb;border-radius:8px;padding:16px;overflow-x:auto}pre code{background:none;padding:0}.hl-kw{color:#a16207;font-weight:600}.hl-str{color:#15803d}.hl-cmt{color:#9ca3af;font-style:italic}.hl-num{color:#2563eb}.hl-fn,.hl-prop,.hl-attr{color:#2563eb}.hl-tag{color:#a16207;font-weight:600}blockquote{border-left:3px solid #c9a96e;margin:1em 0;padding:2px 0 2px 14px;color:#4b5563}table{border-collapse:collapse;width:100%;margin:1em 0}th,td{border:1px solid #e5e7eb;padding:7px 12px;text-align:left}th{background:#f9fafb}img{max-width:100%;border-radius:8px}hr{border:none;border-top:1px solid #e5e7eb;margin:1.4em 0}input[type=checkbox]{accent-color:#c9a96e;margin-right:8px}ul,ol{padding-left:1.4em}li:has(> input[type=checkbox]){list-style:none;margin-left:-1.4em}`;

  function styledHtml(): string {
    return `<!doctype html><html lang="zh-CN"><head><meta charset="utf-8"><title>Markdown 导出</title><style>${EXPORT_CSS}</style></head><body>${renderedHtml()}</body></html>`;
  }

  byId<HTMLButtonElement>('mdCopyMd').addEventListener('click', (e) => {
    window.CT.copy(source.value, e.currentTarget as HTMLElement);
  });
  // 打开本地 .md 文件
  byId<HTMLButtonElement>('mdOpen').addEventListener('click', () => {
    byId<HTMLInputElement>('mdOpenFile').click();
  });
  byId<HTMLInputElement>('mdOpenFile').addEventListener('change', (e) => {
    const file = (e.target as HTMLInputElement).files?.[0];
    if (!file) return;
    const reader = new FileReader();
    reader.onload = () => {
      const text = String(reader.result || '');
      if (!text) return;
      if (window.confirm('打开文件将替换当前内容（可在撤销中恢复），继续？')) {
        replaceRange(0, source.value.length, text);
        showStatus('mdStatus', 'success', `已打开 ${file.name}`);
      }
    };
    reader.readAsText(file, 'utf-8');
    (e.target as HTMLInputElement).value = '';
  });
  byId<HTMLButtonElement>('mdCopyHtml').addEventListener('click', (e) => {
    window.CT.copy(renderedHtml(), e.currentTarget as HTMLElement);
  });
  byId<HTMLButtonElement>('mdCopyRich').addEventListener('click', async (e) => {
    const html = styledHtml();
    try {
      if (typeof ClipboardItem !== 'undefined' && navigator.clipboard?.write) {
        await navigator.clipboard.write([
          new ClipboardItem({
            'text/html': new Blob([html], { type: 'text/html' }),
            'text/plain': new Blob([source.value], { type: 'text/plain' }),
          }),
        ]);
        showStatus('mdStatus', 'success', '已复制富文本，可直接粘贴到 Word / 文档');
        return;
      }
    } catch {
      // 降级为 HTML 文本复制
    }
    window.CT.copy(html, e.currentTarget as HTMLElement);
  });
  byId<HTMLButtonElement>('mdDownloadMd').addEventListener('click', () => {
    download(`${exportTitle()}.md`, source.value, 'text/markdown;charset=utf-8');
  });
  byId<HTMLButtonElement>('mdDownloadHtml').addEventListener('click', () => {
    download(`${exportTitle()}.html`, styledHtml(), 'text/html;charset=utf-8');
  });

  // ── 初始化 ──
  render();
  updateStats();
  setInterval(updateClock, 1000);