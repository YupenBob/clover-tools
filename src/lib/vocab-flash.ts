import type { VocabBook, VocabWord } from './vocab-books';

export const VOCAB_STORAGE_KEY = 'clover-vocab-flash-progress-v1';
export const VOCAB_PREFS_KEY = 'clover-vocab-flash-prefs-v1';

export interface BookProgress {
  known: string[];
  wrong: string[];
  today: string;
  todayCount: number;
}

export type VocabProgress = Record<string, BookProgress>;

export type SessionMode = 'normal' | 'wrong';

export const EMPTY_BOOK_PROGRESS: BookProgress = {
  known: [],
  wrong: [],
  today: '',
  todayCount: 0,
};

export function localDateKey(date = new Date()): string {
  const year = date.getFullYear();
  const month = String(date.getMonth() + 1).padStart(2, '0');
  const day = String(date.getDate()).padStart(2, '0');
  return `${year}-${month}-${day}`;
}

export function getBookProgress(progress: VocabProgress, bookId: string): BookProgress {
  return progress[bookId] ?? EMPTY_BOOK_PROGRESS;
}

export function knownCount(progress: VocabProgress, book: VocabBook): number {
  return getBookProgress(progress, book.id).known.length;
}

export function wrongCount(progress: VocabProgress, book: VocabBook): number {
  return getBookProgress(progress, book.id).wrong.length;
}

export function totalKnown(books: VocabBook[], progress: VocabProgress): number {
  return books.reduce((sum, book) => sum + knownCount(progress, book), 0);
}

export function todayReviewed(books: VocabBook[], progress: VocabProgress, date: string): number {
  return books.reduce((sum, book) => {
    const entry = getBookProgress(progress, book.id);
    return sum + (entry.today === date ? entry.todayCount : 0);
  }, 0);
}

function validIds(book: VocabBook): Set<string> {
  return new Set(book.words.map((word) => word.w));
}

/** Accept only word ids that still exist in the shipped book; stale storage must not break a session. */
export function parseProgress(raw: string | null, books: VocabBook[]): VocabProgress {
  if (!raw) return {};
  let value: unknown;
  try {
    value = JSON.parse(raw);
  } catch {
    return {};
  }
  if (!value || typeof value !== 'object' || Array.isArray(value)) return {};

  const result: VocabProgress = {};
  for (const book of books) {
    const entry = (value as Record<string, unknown>)[book.id];
    if (!entry || typeof entry !== 'object' || Array.isArray(entry)) continue;
    const record = entry as Record<string, unknown>;
    const ids = validIds(book);
    const known = Array.isArray(record.known)
      ? [...new Set(record.known.filter((id): id is string => typeof id === 'string' && ids.has(id)))]
      : [];
    const knownSet = new Set(known);
    const wrong = Array.isArray(record.wrong)
      ? [...new Set(record.wrong.filter((id): id is string => typeof id === 'string' && ids.has(id) && !knownSet.has(id)))]
      : [];
    const today =
      typeof record.today === 'string' && /^\d{4}-\d{2}-\d{2}$/.test(record.today)
        ? record.today
        : '';
    const todayCount =
      typeof record.todayCount === 'number' && Number.isFinite(record.todayCount) && record.todayCount >= 0
        ? Math.floor(record.todayCount)
        : 0;
    if (known.length || wrong.length || todayCount) result[book.id] = { known, wrong, today, todayCount };
  }
  return result;
}

/** Record exactly one answer, keeping known and wrong mutually exclusive. */
export function recordAnswer(
  progress: VocabProgress,
  bookId: string,
  word: string,
  known: boolean,
  today = localDateKey(),
): VocabProgress {
  const entry = getBookProgress(progress, bookId);
  const knownSet = new Set(entry.known);
  const wrongSet = new Set(entry.wrong);
  if (known) {
    knownSet.add(word);
    wrongSet.delete(word);
  } else {
    wrongSet.add(word);
    knownSet.delete(word);
  }
  const todayCount = entry.today === today ? entry.todayCount + 1 : 1;
  return {
    ...progress,
    [bookId]: {
      known: [...knownSet],
      wrong: [...wrongSet],
      today,
      todayCount,
    },
  };
}

function shuffle<T>(items: T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i -= 1) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/**
 * A normal round prioritises unseen words, then previous mistakes, then known words.
 * `count = 0` means every word in the book.
 */
export function selectSessionWords(
  book: VocabBook,
  count: number,
  progress: VocabProgress,
  rng: () => number = Math.random,
): VocabWord[] {
  const entry = getBookProgress(progress, book.id);
  const known = new Set(entry.known);
  const wrong = new Set(entry.wrong);
  const unseen = book.words.filter((word) => !known.has(word.w) && !wrong.has(word.w));
  const mistakes = book.words.filter((word) => wrong.has(word.w));
  const mastered = book.words.filter((word) => known.has(word.w));
  const queue = [
    ...shuffle(unseen, rng),
    ...shuffle(mistakes, rng),
    ...shuffle(mastered, rng),
  ];
  const target = Number.isFinite(count) && count > 0 ? Math.min(Math.floor(count), queue.length) : queue.length;
  return queue.slice(0, target);
}

/** Review every word currently marked as a mistake in the selected book. */
export function selectWrongWords(
  book: VocabBook,
  progress: VocabProgress,
  rng: () => number = Math.random,
): VocabWord[] {
  const wrong = new Set(getBookProgress(progress, book.id).wrong);
  return shuffle(book.words.filter((word) => wrong.has(word.w)), rng);
}

export function formatDuration(seconds: number): string {
  const safe = Math.max(0, Math.round(seconds));
  const minutes = Math.floor(safe / 60);
  const rest = safe % 60;
  return `${minutes}:${String(rest).padStart(2, '0')}`;
}
