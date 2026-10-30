import type { VocabBook, VocabWord } from '../lib/vocab-books';
import {
  VOCAB_PREFS_KEY,
  VOCAB_STORAGE_KEY,
  knownCount,
  localDateKey,
  parseProgress,
  recordAnswer,
  selectSessionWords,
  selectWrongWords,
  todayReviewed,
  totalKnown,
  wrongCount,
  type SessionMode,
  type VocabProgress,
} from '../lib/vocab-flash';

type Copy = Record<string, string>;
type ViewName = 'setup' | 'study' | 'result';

interface Session {
  words: VocabWord[];
  index: number;
  known: number;
  wrong: VocabWord[];
  mode: SessionMode;
  startedAt: number;
  revealed: boolean;
  awaitingNext: boolean;
}

const root = document.getElementById('vbApp');
if (root) init(root);

function init(app: HTMLElement) {
  const books = JSON.parse(document.getElementById('vbBooks')?.textContent || '[]') as VocabBook[];
  const copy = JSON.parse(document.getElementById('vbCopy')?.textContent || '{}') as Copy;
  if (!books.length) return;

  const $ = <T extends HTMLElement>(id: string): T => {
    const element = document.getElementById(id);
    if (!element) throw new Error(`Missing element #${id}`);
    return element as T;
  };

  const bookButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('.vb-book[data-book]'));
  const sizeButtons = Array.from(document.querySelectorAll<HTMLButtonElement>('[data-size]'));
  const setupView = document.querySelector<HTMLElement>('[data-view="setup"]')!;
  const studyView = document.querySelector<HTMLElement>('[data-view="study"]')!;
  const resultView = document.querySelector<HTMLElement>('[data-view="result"]')!;
  const knownTotalEl = document.querySelector<HTMLElement>('[data-known-total]')!;
  const todayTotalEl = document.querySelector<HTMLElement>('[data-today-total]')!;
  const coverMark = document.querySelector<HTMLElement>('[data-cover-mark]')!;
  const coverName = document.querySelector<HTMLElement>('[data-cover-name]')!;
  const coverCount = document.querySelector<HTMLElement>('[data-cover-count]')!;
  const configName = document.querySelector<HTMLElement>('[data-config-name]')!;
  const configBlurb = document.querySelector<HTMLElement>('[data-config-blurb]')!;
  const configKnown = document.querySelector<HTMLElement>('[data-config-known]')!;
  const configTotal = document.querySelector<HTMLElement>('[data-config-total]')!;
  const allTotal = document.querySelector<HTMLElement>('[data-all-total]')!;
  const knownMeter = document.getElementById('vbKnownMeter')!;
  const startBtn = $<HTMLButtonElement>('vbStart');
  const backBtn = $<HTMLButtonElement>('vbBack');
  const card = $<HTMLElement>('vbCard');
  const rail = $<HTMLElement>('vbRail');
  const currentEl = document.querySelector<HTMLElement>('[data-current]')!;
  const totalEl = document.querySelector<HTMLElement>('[data-total]')!;
  const studyBook = document.querySelector<HTMLElement>('[data-study-book]')!;
  const studyMode = document.querySelector<HTMLElement>('[data-study-mode]')!;
  const posEl = document.querySelector<HTMLElement>('[data-pos]')!;
  const wordEl = $<HTMLElement>('vbWord');
  const ipaEl = $<HTMLElement>('vbIpa');
  const revealEl = $<HTMLElement>('vbReveal');
  const meaningEl = $<HTMLElement>('vbMeaning');
  const exampleEl = $<HTMLElement>('vbExample');
  const exampleCnEl = $<HTMLElement>('vbExampleCn');
  const promptBtn = $<HTMLButtonElement>('vbPrompt');
  const promptText = $<HTMLElement>('vbPromptText');
  const cardIndex = $<HTMLElement>('vbCardIndex');
  const actions = $<HTMLElement>('vbActions');
  const nextRow = $<HTMLElement>('vbNextRow');
  const nextBtn = $<HTMLButtonElement>('vbNext');
  const unknownBtn = $<HTMLButtonElement>('vbUnknown');
  const knownBtn = $<HTMLButtonElement>('vbKnown');
  const soundBtn = $<HTMLButtonElement>('vbSound');
  const announce = $<HTMLElement>('vbAnnounce');
  const resultTitle = $<HTMLElement>('vbResultTitle');
  const accuracyEl = document.querySelector<HTMLElement>('[data-accuracy]')!;
  const resultMeta = document.querySelector<HTMLElement>('[data-result-meta]')!;
  const resultKnown = document.querySelector<HTMLElement>('[data-result-known]')!;
  const resultWrong = document.querySelector<HTMLElement>('[data-result-wrong]')!;
  const resultMastered = document.querySelector<HTMLElement>('[data-result-mastered]')!;
  const wrongBadge = document.querySelector<HTMLElement>('[data-wrong-badge]')!;
  const wrongList = $<HTMLElement>('vbWrongList');
  const wrongEmpty = $<HTMLElement>('vbWrongEmpty');
  const wrongAgain = $<HTMLButtonElement>('vbWrongAgain');
  const wrongAgainCount = document.querySelector<HTMLElement>('[data-wrong-again-count]')!;
  const againBtn = $<HTMLButtonElement>('vbAgain');
  const changeBtn = $<HTMLButtonElement>('vbChange');
  const ring = $<HTMLElement>('vbRing');

  const reduceMotion = window.matchMedia('(prefers-reduced-motion: reduce)').matches;

  let activeBook = books[0];
  let size = 20;
  let progress: VocabProgress = parseProgress(readStorage(VOCAB_STORAGE_KEY), books);
  let session: Session | null = null;
  let view: ViewName = 'setup';
  let locked = false;

  restorePreferences();

  faceBook(activeBook.id);
  faceSize(size);
  renderSetup();
  switchView('setup');

  bookButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (view !== 'setup') return;
      const nextBook = books.find((book) => book.id === button.dataset.book);
      if (!nextBook || nextBook.id === activeBook.id) return;
      activeBook = nextBook;
      faceBook(activeBook.id);
      renderSetup();
      savePreferences();
    });
  });

  sizeButtons.forEach((button) => {
    button.addEventListener('click', () => {
      if (view !== 'setup') return;
      const next = Number(button.dataset.size);
      if (!Number.isFinite(next) || next < 0) return;
      size = next;
      faceSize(size);
      savePreferences();
    });
  });

  startBtn.addEventListener('click', () => startSession('normal'));
  wrongAgain.addEventListener('click', () => startSession('wrong'));
  againBtn.addEventListener('click', () => startSession('normal'));
  changeBtn.addEventListener('click', () => showSetup(true));
  backBtn.addEventListener('click', () => showSetup(true));
  nextBtn.addEventListener('click', () => advance('unknown'));
  unknownBtn.addEventListener('click', () => answer(false));
  knownBtn.addEventListener('click', () => answer(true));

  promptBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    reveal();
  });

  card.addEventListener('click', (event) => {
    if ((event.target as Element | null)?.closest('button')) return;
    if (session?.awaitingNext) return;
    reveal();
  });

  soundBtn.addEventListener('click', (event) => {
    event.stopPropagation();
    speak();
  });

  document.addEventListener('keydown', (event) => {
    if (view === 'study') {
      if (event.key === 'Escape') {
        event.preventDefault();
        showSetup(true);
        return;
      }
      const target = event.target as HTMLElement | null;
      const interactive = Boolean(target?.closest('button, a, input, textarea, select, [contenteditable="true"]'));
      if (event.key === ' ' && interactive) return;
      if (event.key === ' ' || event.key === 'Spacebar') {
        event.preventDefault();
        if (session?.awaitingNext) advance('unknown');
        else reveal();
        return;
      }
      if (event.key === 'ArrowRight') {
        event.preventDefault();
        if (session?.awaitingNext) advance('known');
        else answer(true);
        return;
      }
      if (event.key === 'ArrowLeft') {
        event.preventDefault();
        if (session?.awaitingNext) advance('unknown');
        else answer(false);
        return;
      }
      if (event.key === 'Enter' && !interactive && session?.awaitingNext) {
        event.preventDefault();
        advance('unknown');
      }
      return;
    }
    if (view === 'result' && event.key === 'Escape') {
      event.preventDefault();
      showSetup(true);
    }
  });

  /* ── Setup ── */

  function renderSetup() {
    app.style.setProperty('--book-accent', activeBook.accent);
    coverMark.textContent = activeBook.mark;
    coverName.textContent = activeBook.name;
    coverCount.textContent = String(activeBook.words.length);
    configName.textContent = activeBook.name;
    configBlurb.textContent = activeBook.blurb;
    configTotal.textContent = String(activeBook.words.length);
    allTotal.textContent = String(activeBook.words.length);
    knownTotalEl.textContent = String(totalKnown(books, progress));
    todayTotalEl.textContent = String(todayReviewed(books, progress, localDateKey()));

    bookButtons.forEach((button) => {
      const book = books.find((item) => item.id === button.dataset.book);
      if (!book) return;
      const active = book.id === activeBook.id;
      button.classList.toggle('is-active', active);
      button.setAttribute('aria-pressed', String(active));
      const bar = button.querySelector<HTMLElement>('[data-book-bar]');
      if (bar) bar.style.width = `${(knownCount(progress, book) / book.words.length) * 100}%`;
    });

    const known = knownCount(progress, activeBook);
    configKnown.textContent = String(known);
    knownMeter.style.width = `${(known / activeBook.words.length) * 100}%`;
  }

  function faceBook(id: string) {
    const found = books.find((book) => book.id === id);
    if (found) activeBook = found;
  }

  function faceSize(value: number) {
    const supported = sizeButtons.some((button) => Number(button.dataset.size) === value);
    if (!supported) size = 20;
    sizeButtons.forEach((button) => {
      button.setAttribute('aria-pressed', String(Number(button.dataset.size) === size));
    });
  }

  function savePreferences() {
    writeStorage(VOCAB_PREFS_KEY, JSON.stringify({ book: activeBook.id, size }));
  }

  function restorePreferences() {
    const raw = readStorage(VOCAB_PREFS_KEY);
    if (!raw) return;
    try {
      const value = JSON.parse(raw) as { book?: unknown; size?: unknown };
      if (typeof value.book === 'string') faceBook(value.book);
      if (typeof value.size === 'number') {
        size = value.size;
      }
    } catch {
      /* Ignore malformed preferences. */
    }
  }

  /* ── Session ── */

  function startSession(mode: SessionMode) {
    if (locked) return;
    const words =
      mode === 'wrong'
        ? selectWrongWords(activeBook, progress)
        : selectSessionWords(activeBook, size, progress);
    if (!words.length) return;

    session = {
      words,
      index: 0,
      known: 0,
      wrong: [],
      mode,
      startedAt: performance.now(),
      revealed: false,
      awaitingNext: false,
    };
    locked = false;
    switchView('study', true);
    studyBook.textContent = activeBook.name;
    studyMode.textContent = mode === 'wrong' ? copy.modeWrong : copy.modeNormal;
    renderCard();
  }

  function renderCard() {
    if (!session) return;
    const word = session.words[session.index];
    if (!word) return;

    session.revealed = false;
    session.awaitingNext = false;
    locked = false;

    wordEl.textContent = word.w;
    ipaEl.textContent = word.ipa;
    posEl.textContent = word.pos;
    meaningEl.textContent = word.cn;
    exampleEl.textContent = word.ex;
    exampleCnEl.textContent = word.exCn;
    revealEl.hidden = true;
    promptBtn.hidden = false;
    promptText.hidden = true;
    actions.hidden = false;
    nextRow.hidden = true;
    card.classList.remove('is-revealed');

    currentEl.textContent = String(session.index + 1);
    totalEl.textContent = String(session.words.length);
    cardIndex.textContent = String(session.index + 1).padStart(2, '0');
    rail.style.width = `${((session.index + 1) / session.words.length) * 100}%`;
    card.setAttribute('aria-label', `${copy.cardLabel}: ${word.w}`);
    announce.textContent = `${session.index + 1} / ${session.words.length} · ${word.w}`;

    stopSpeech();
    if (!reduceMotion) {
      card.animate(
        [
          { opacity: 0, transform: 'translateY(10px) scale(0.994)' },
          { opacity: 1, transform: 'translateY(0) scale(1)' },
        ],
        { duration: 260, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
    promptBtn.focus({ preventScroll: true });
  }

  function reveal() {
    if (!session || session.revealed || locked) return;
    session.revealed = true;
    revealEl.hidden = false;
    promptBtn.hidden = true;
    promptText.hidden = false;
    card.classList.add('is-revealed');
    if (!reduceMotion) {
      revealEl.animate(
        [
          { opacity: 0, transform: 'translateY(8px)' },
          { opacity: 1, transform: 'translateY(0)' },
        ],
        { duration: 220, easing: 'cubic-bezier(0.2, 0.8, 0.2, 1)' },
      );
    }
  }

  function answer(known: boolean) {
    if (!session || locked || session.awaitingNext) return;
    const word = session.words[session.index];
    if (!word) return;
    locked = true;

    progress = recordAnswer(progress, activeBook.id, word.w, known);
    writeStorage(VOCAB_STORAGE_KEY, JSON.stringify(progress));
    if (known) session.known += 1;
    else session.wrong.push(word);
    renderSetup();

    if (!known && !session.revealed) {
      locked = false;
      reveal();
      session.awaitingNext = true;
      actions.hidden = true;
      nextRow.hidden = false;
      locked = false;
      nextBtn.focus({ preventScroll: true });
      return;
    }
    advance(known ? 'known' : 'unknown');
  }

  async function advance(direction: 'known' | 'unknown') {
    if (!session) return;
    if (!locked) locked = true;
    if (!reduceMotion) {
      try {
        const animation = card.animate(
          [
            { opacity: 1, transform: 'translateX(0)' },
            {
              opacity: 0,
              transform: `translateX(${direction === 'known' ? 26 : -26}px)`,
            },
          ],
          { duration: 160, easing: 'cubic-bezier(0.4, 0, 1, 1)' },
        );
        await animation.finished;
      } catch {
        /* A replaced animation must not block the next card. */
      }
    }

    session.index += 1;
    if (session.index >= session.words.length) {
      finishSession();
      return;
    }
    renderCard();
  }

  function finishSession() {
    if (!session) return;
    locked = false;
    session.awaitingNext = false;
    const total = session.words.length;
    const known = session.known;
    const wrong = session.words.length - known;
    const accuracy = total ? Math.round((known / total) * 100) : 0;
    const seconds = Math.max(1, Math.round((performance.now() - session.startedAt) / 1000));

    accuracyEl.textContent = String(accuracy);
    ring.style.setProperty('--p', '0');
    resultMeta.textContent = `${total} ${copy.wordsUnit} · ${copy.timeLabel} ${durationText(seconds)}`;
    resultKnown.textContent = String(known);
    resultWrong.textContent = String(wrong);
    resultMastered.textContent = `${knownCount(progress, activeBook)}/${activeBook.words.length}`;
    wrongBadge.textContent = String(session.wrong.length);

    wrongList.replaceChildren();
    if (session.wrong.length) {
      const fragment = document.createDocumentFragment();
      for (const word of session.wrong) {
        const chip = document.createElement('span');
        chip.className = 'vb-wrong-chip';
        const strong = document.createElement('strong');
        strong.lang = 'en';
        strong.textContent = word.w;
        const meaning = document.createElement('span');
        meaning.textContent = word.cn;
        chip.append(strong, meaning);
        fragment.append(chip);
      }
      wrongList.append(fragment);
      wrongEmpty.hidden = true;
    } else {
      wrongEmpty.hidden = false;
    }

    const remainingWrong = wrongCount(progress, activeBook);
    wrongAgain.hidden = remainingWrong === 0;
    wrongAgainCount.textContent = String(remainingWrong);

    switchView('result', true);
    renderSetup();
    requestAnimationFrame(() => {
      requestAnimationFrame(() => ring.style.setProperty('--p', String(accuracy)));
    });
    resultTitle.focus({ preventScroll: true });
  }

  function showSetup(focusBook = false) {
    session = null;
    locked = false;
    stopSpeech();
    switchView('setup', true);
    renderSetup();
    if (focusBook) {
      bookButtons.find((button) => button.dataset.book === activeBook.id)?.focus({ preventScroll: true });
    }
  }

  function switchView(next: ViewName, scroll = false) {
    view = next;
    app.dataset.state = next;
    setupView.hidden = next !== 'setup';
    studyView.hidden = next !== 'study';
    resultView.hidden = next !== 'result';
    if (scroll) {
      requestAnimationFrame(() => {
        app.scrollIntoView({
          behavior: reduceMotion ? 'auto' : 'smooth',
          block: 'start',
        });
      });
    }
  }

  function durationText(seconds: number): string {
    const minutes = Math.floor(seconds / 60);
    const rest = seconds % 60;
    if (minutes === 0) return `${rest} ${copy.seconds}`;
    return `${minutes} ${copy.minutes} ${rest} ${copy.seconds}`;
  }

  /* ── Audio ── */

  const canSpeak = 'speechSynthesis' in window && 'SpeechSynthesisUtterance' in window;
  if (!canSpeak) soundBtn.hidden = true;

  function speak() {
    if (!canSpeak || !session) return;
    const word = session.words[session.index];
    if (!word) return;
    window.speechSynthesis.cancel();
    const utterance = new SpeechSynthesisUtterance(word.w);
    utterance.lang = 'en-US';
    utterance.rate = 0.88;
    utterance.pitch = 1;
    soundBtn.classList.add('is-speaking');
    utterance.onend = () => soundBtn.classList.remove('is-speaking');
    utterance.onerror = () => soundBtn.classList.remove('is-speaking');
    window.speechSynthesis.speak(utterance);
  }

  function stopSpeech() {
    if (!canSpeak) return;
    window.speechSynthesis.cancel();
    soundBtn.classList.remove('is-speaking');
  }
}

function readStorage(key: string): string | null {
  try {
    return window.localStorage.getItem(key);
  } catch {
    return null;
  }
}

function writeStorage(key: string, value: string): void {
  try {
    window.localStorage.setItem(key, value);
  } catch {
    /* Private mode or a full quota must not stop the current round. */
  }
}
