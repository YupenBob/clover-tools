/**
 * 工具页公共交互内核：状态提示、字符统计、复制/清空/示例、快捷键、下载。
 */
export function byId<T extends HTMLElement>(id: string): T {
  const el = document.getElementById(id);
  if (!el) throw new Error(`element #${id} not found`);
  return el as T;
}

export function showStatus(id: string, type: 'success' | 'error' | 'info', msg: string): void {
  const el = byId<HTMLElement>(id);
  el.className = `status-msg show ${type}`;
  el.textContent = msg;
}

export function hideStatus(id: string): void {
  byId<HTMLElement>(id).className = 'status-msg';
}

export function setStats(id: string, text: string): void {
  byId<HTMLElement>(id).textContent = text;
}

export function bindCount(inputId: string, statsId: string): void {
  const input = byId<HTMLTextAreaElement | HTMLInputElement>(inputId);
  const update = () => setStats(statsId, `${input.value.length} 字符`);
  input.addEventListener('input', update);
  update();
}

export function bindCopyBtn(btnId: string, getText: () => string): void {
  byId<HTMLButtonElement>(btnId).addEventListener('click', (e) => {
    window.CT.copy(getText(), e.currentTarget as HTMLElement);
  });
}

export function bindSample(btnId: string, inputId: string, text: string): void {
  byId<HTMLButtonElement>(btnId).addEventListener('click', () => {
    const input = byId<HTMLTextAreaElement | HTMLInputElement>(inputId);
    input.value = text;
    input.dispatchEvent(new Event('input'));
  });
}

export function bindClear(
  btnId: string,
  inputIds: string[],
  outputIds: string[],
  statusId?: string,
): void {
  byId<HTMLButtonElement>(btnId).addEventListener('click', () => {
    for (const id of inputIds) byId<HTMLTextAreaElement | HTMLInputElement>(id).value = '';
    for (const id of outputIds) byId<HTMLTextAreaElement | HTMLInputElement>(id).value = '';
    if (statusId) hideStatus(statusId);
  });
}

export function bindCtrlEnter(inputId: string, fn: () => void): void {
  byId<HTMLTextAreaElement | HTMLInputElement>(inputId).addEventListener('keydown', (e) => {
    if (e.ctrlKey && e.key === 'Enter') {
      e.preventDefault();
      fn();
    }
  });
}

export function download(filename: string, content: string, mime = 'text/plain'): void {
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

export function debounce(fn: () => void, ms: number): () => void {
  let timer: ReturnType<typeof setTimeout>;
  return () => {
    clearTimeout(timer);
    timer = setTimeout(fn, ms);
  };
}
