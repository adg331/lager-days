import { test } from 'node:test';
import assert from 'node:assert/strict';
import {
  emptyDiary,
  putEntry,
  deleteEntry,
  confirmRange,
  mergeDiaries,
  validateDiary,
  summarize,
  dateRange,
  yearEstimate,
  csvExport,
  countries,
  CHINA_PER_CAPITA_LITERS,
  type Entry,
} from './diary.ts';
const e = (id: string, date = '2026-08-01', ml = 500): Entry => ({
  id,
  date,
  time: '20:10',
  ml,
  source: 'can',
  brand: 'SAPPORO',
  note: '',
  updatedAt: '2026-08-01T12:00:00.000Z',
});
test('rapid adds and exact rollback retain other entries', () => {
  let d = emptyDiary();
  d = putEntry(d, e('a', undefined, 330));
  d = putEntry(d, e('b'));
  d = deleteEntry(d, 'a');
  assert.equal(summarize(d, '2026-08-01', '2026-08-31', '2026-09-05').ml, 500);
});
test('unrecorded is not dry; edits invalidate completeness', () => {
  let d = putEntry(emptyDiary(), e('a'));
  assert.equal(summarize(d, '2026-08-01', '2026-08-02').dryDays, 0);
  d = confirmRange(d, '2026-08-01', '2026-08-02');
  assert.equal(d.days['2026-08-02'].status, 'dry');
  d = putEntry(d, {
    ...e('a'),
    date: '2026-08-02',
    updatedAt: '2026-09-05T12:00:00Z',
  });
  assert.equal(d.days['2026-08-01'].status, 'unknown');
  assert.equal(d.days['2026-08-02'].status, 'unknown');
});
test('month year local calendar boundaries and leap year', () => {
  let d = putEntry(emptyDiary(), e('a', '2025-12-31', 330));
  d = putEntry(d, e('b', '2026-01-01', 500));
  assert.equal(summarize(d, '2026-01-01', '2026-12-31', '2026-09-05').ml, 500);
  assert.equal(dateRange('2024-02-01', '2024-02-29').length, 29);
  assert.throws(() => dateRange('2026-02-30', '2026-03-01'));
});
test('backup roundtrip, duplicate merge and tombstones', () => {
  const old = putEntry(emptyDiary(), e('a'));
  const newer = deleteEntry(old, 'a', '2026-09-01T12:00:00Z');
  assert.deepEqual(validateDiary(JSON.parse(JSON.stringify(newer))), newer);
  assert.equal(mergeDiaries(old, old).entries.length, 1);
  assert.equal(mergeDiaries(newer, old).entries[0].deleted, true);
  assert.equal(mergeDiaries(old, newer).entries[0].deleted, true);
});
test('latest edits win and invalid imports fail', () => {
  const d = putEntry(emptyDiary(), e('a'));
  const newer = putEntry(d, {
    ...e('a'),
    ml: 330,
    updatedAt: '2026-09-01T12:00:00Z',
  });
  assert.equal(mergeDiaries(d, newer).entries[0].ml, 330);
  assert.throws(() =>
    validateDiary({ ...d, entries: [{ ...e('a'), ml: -1 }] }),
  );
  assert.throws(() => validateDiary({ ...d, entries: [e('a'), e('a')] }));
  assert.throws(() => validateDiary({ version: 3 }));
});
test('estimate needs 30 continuous complete days and excludes today', () => {
  let d = putEntry(emptyDiary(), e('a'));
  assert.throws(() =>
    yearEstimate(d, '2026-08-01', '2026-08-31', '2026-09-05'),
  );
  d = confirmRange(d, '2026-08-01', '2026-08-31');
  const result = yearEstimate(d, '2026-08-01', '2026-08-31', '2026-09-05');
  assert.equal(result.days, 31);
  assert.equal(result.ml, (500 / 31) * 365);
  assert.throws(() =>
    yearEstimate(d, '2026-08-01', '2026-08-15', '2026-09-05'),
  );
  assert.throws(() =>
    yearEstimate(d, '2026-08-01', '2026-09-05', '2026-09-05'),
  );
});
test('CSV quotes multiline values and protects formulas', () => {
  const d = putEntry(emptyDiary(), {
    ...e('a'),
    brand: '=SUM(1,2)',
    note: 'a"b\nc',
  });
  const csv = csvExport(d);
  assert.ok(csv.includes("'=SUM"));
  assert.ok(csv.includes('a""b\nc'));
});
test('world consumption is descending and China is calculated from total and population', () => {
  assert.deepEqual(
    countries.map((c) => c.name),
    ['捷克', '德国', '英国', '美国', '韩国', '日本', '中国'],
  );
  assert.equal(Number(CHINA_PER_CAPITA_LITERS.toFixed(1)), 28.8);
});
