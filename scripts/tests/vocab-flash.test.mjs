import test from 'node:test';
import assert from 'node:assert/strict';
import {
  VOCAB_BOOKS,
  VOCAB_TOTAL,
} from '../../src/lib/vocab-books.ts';
import {
  EMPTY_BOOK_PROGRESS,
  formatDuration,
  knownCount,
  localDateKey,
  parseProgress,
  recordAnswer,
  selectSessionWords,
  selectWrongWords,
  todayReviewed,
  totalKnown,
  wrongCount,
} from '../../src/lib/vocab-flash.ts';

test('six books contain complete, unique sixty-word sets', () => {
  assert.equal(VOCAB_BOOKS.length, 6);
  assert.equal(VOCAB_TOTAL, 360);
  for (const book of VOCAB_BOOKS) {
    assert.equal(book.words.length, 60, book.id);
    assert.equal(new Set(book.words.map((word) => word.w)).size, 60, book.id);
    assert.match(book.accent, /^#[0-9a-f]{6}$/i);
    assert.ok(book.name && book.mark && book.stage && book.blurb);
    for (const word of book.words) {
      assert.ok(word.w && word.ipa && word.pos && word.cn && word.ex && word.exCn, `${book.id}:${word.w}`);
      assert.match(word.ipa, /^\/.+\/$/, `${book.id}:${word.w} IPA`);
      assert.match(word.ex, /[.?!]$/, `${book.id}:${word.w} example`);
    }
  }
});

test('progress parsing drops malformed and stale ids without throwing', () => {
  assert.deepEqual(parseProgress(null, VOCAB_BOOKS), {});
  assert.deepEqual(parseProgress('{', VOCAB_BOOKS), {});
  assert.deepEqual(parseProgress('[]', VOCAB_BOOKS), {});
  const raw = JSON.stringify({
    zhongkao: {
      known: ['ability', 'not-a-word', 'ability', 7],
      wrong: ['accept', 'ability', 'accept'],
      today: '2026-10-30',
      todayCount: 4.8,
    },
    missing: { known: ['ability'] },
  });
  assert.deepEqual(parseProgress(raw, VOCAB_BOOKS).zhongkao, {
    known: ['ability'],
    wrong: ['accept'],
    today: '2026-10-30',
    todayCount: 4,
  });
});

test('answers move words between known and wrong and count the local day', () => {
  let progress = {};
  progress = recordAnswer(progress, 'zhongkao', 'ability', true, '2026-10-30');
  assert.deepEqual(progress.zhongkao, {
    known: ['ability'],
    wrong: [],
    today: '2026-10-30',
    todayCount: 1,
  });
  progress = recordAnswer(progress, 'zhongkao', 'ability', false, '2026-10-30');
  assert.deepEqual(progress.zhongkao, {
    known: [],
    wrong: ['ability'],
    today: '2026-10-30',
    todayCount: 2,
  });
  progress = recordAnswer(progress, 'zhongkao', 'accept', true, '2026-10-31');
  assert.equal(progress.zhongkao.today, '2026-10-31');
  assert.equal(progress.zhongkao.todayCount, 1);
  assert.equal(knownCount(progress, VOCAB_BOOKS[0]), 1);
  assert.equal(wrongCount(progress, VOCAB_BOOKS[0]), 1);
  assert.equal(totalKnown(VOCAB_BOOKS, progress), 1);
  assert.equal(todayReviewed(VOCAB_BOOKS, progress, '2026-10-30'), 0);
  assert.equal(todayReviewed(VOCAB_BOOKS, progress, '2026-10-31'), 1);
  assert.deepEqual(progress.zhongkao.wrong, ['ability']);
});

test('round selection prioritises unseen then wrong then known words', () => {
  const book = {
    id: 'test',
    name: 'Test',
    mark: 'T',
    stage: 'Test',
    blurb: 'Test',
    accent: '#000000',
    words: ['a', 'b', 'c', 'd', 'e', 'f'].map((w) => ({ w, ipa: `/${w}/`, pos: 'n.', cn: w, ex: 'Example.', exCn: '例。' })),
  };
  const progress = {
    test: { known: ['a', 'b'], wrong: ['c'], today: '2026-10-30', todayCount: 2 },
  };
  assert.deepEqual(
    selectSessionWords(book, 3, progress, () => 0.5).map((word) => word.w).sort(),
    ['d', 'e', 'f'],
  );
  assert.deepEqual(
    selectSessionWords(book, 5, progress, () => 0.5).map((word) => word.w).sort(),
    ['a', 'c', 'd', 'e', 'f'],
  );
  assert.deepEqual(
    selectSessionWords(book, 0, progress, () => 0.5).map((word) => word.w).sort(),
    ['a', 'b', 'c', 'd', 'e', 'f'],
  );
  assert.deepEqual(
    selectSessionWords(book, 99, progress, () => 0.5).map((word) => word.w).sort(),
    ['a', 'b', 'c', 'd', 'e', 'f'],
  );
  assert.deepEqual(selectWrongWords(book, progress, () => 0.5).map((word) => word.w), ['c']);
  assert.deepEqual(selectWrongWords(book, { test: EMPTY_BOOK_PROGRESS }, () => 0.5), []);
  assert.equal(new Set(selectSessionWords(book, 6, progress, () => 0.5).map((word) => word.w)).size, 6);
});

test('local date keys and duration labels use stable clock-style formatting', () => {
  assert.equal(localDateKey(new Date(2026, 9, 30, 23, 59)), '2026-10-30');
  assert.equal(formatDuration(0), '0:00');
  assert.equal(formatDuration(9), '0:09');
  assert.equal(formatDuration(65), '1:05');
  assert.equal(formatDuration(3600), '60:00');
});
