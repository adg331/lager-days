export type Entry = {
  id: string;
  date: string;
  time: string;
  ml: number;
  source: 'can' | 'tap';
  brand: string;
  note: string;
  updatedAt: string;
  deleted?: boolean;
};
export type DayMark = {
  status: 'dry' | 'complete' | 'unknown';
  updatedAt: string;
};
export type Diary = {
  schema: 'lager-diary';
  version: 1;
  entries: Entry[];
  days: Record<string, DayMark>;
  prefs: { source: 'can' | 'tap'; motion: boolean };
  lastBackup: string | null;
};
export const STORAGE_KEY = 'lager-diary.v1';
export function emptyDiary(): Diary {
  return {
    schema: 'lager-diary',
    version: 1,
    entries: [],
    days: {},
    prefs: { source: 'can', motion: true },
    lastBackup: null,
  };
}
export function localDate(d = new Date()) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function localTime(d = new Date()) {
  return `${String(d.getHours()).padStart(2, '0')}:${String(d.getMinutes()).padStart(2, '0')}`;
}
export function validDate(s: unknown): s is string {
  if (
    typeof s !== 'string' ||
    !/^\d{4}-\d{2}-\d{2}$/.test(s) ||
    s < '1900-01-01' ||
    s > '2200-12-31'
  )
    return false;
  const d = new Date(s + 'T12:00:00');
  return !isNaN(+d) && localDate(d) === s;
}
export function dateRange(start: string, end: string) {
  if (!validDate(start) || !validDate(end) || start > end)
    throw Error('请选择有效的日期范围');
  const out: string[] = [];
  const d = new Date(start + 'T12:00:00');
  while (localDate(d) <= end) {
    out.push(localDate(d));
    d.setDate(d.getDate() + 1);
    if (out.length > 110000) throw Error('日期范围过大');
  }
  return out;
}
export const liveEntries = (d: Diary) => d.entries.filter((e) => !e.deleted);
export const volume = (entries: Entry[]) =>
  entries.reduce((n, e) => n + e.ml, 0);
export function displayVolume(ml: number) {
  return ml >= 1000
    ? {
        number: Number((ml / 1000).toFixed(2)).toLocaleString('zh-CN'),
        unit: 'L',
      }
    : { number: Math.round(ml).toLocaleString('zh-CN'), unit: 'mL' };
}
export function validateEntry(v: unknown): Entry {
  const e = v as Entry;
  if (
    !e ||
    typeof e !== 'object' ||
    typeof e.id !== 'string' ||
    !e.id ||
    e.id.length > 120 ||
    !validDate(e.date) ||
    !/^([01]\d|2[0-3]):[0-5]\d$/.test(e.time) ||
    !Number.isInteger(e.ml) ||
    e.ml <= 0 ||
    e.ml > 10000 ||
    !['can', 'tap'].includes(e.source) ||
    typeof e.brand !== 'string' ||
    e.brand.length > 80 ||
    typeof e.note !== 'string' ||
    e.note.length > 500 ||
    typeof e.updatedAt !== 'string' ||
    isNaN(Date.parse(e.updatedAt)) ||
    (e.deleted !== undefined && typeof e.deleted !== 'boolean')
  )
    throw Error('记录格式无效，请检查日期、容量和备份文件');
  return {
    id: e.id,
    date: e.date,
    time: e.time,
    ml: e.ml,
    source: e.source,
    brand: e.brand,
    note: e.note,
    updatedAt: e.updatedAt,
    ...(e.deleted ? { deleted: true } : {}),
  };
}
export function validateDiary(raw: unknown): Diary {
  const x = raw as Diary;
  if (
    !x ||
    x.schema !== 'lager-diary' ||
    x.version !== 1 ||
    !Array.isArray(x.entries) ||
    x.entries.length > 30000 ||
    !x.days ||
    typeof x.days !== 'object' ||
    Array.isArray(x.days)
  )
    throw Error('不是有效的拉格日记 v1 备份');
  const entries = x.entries.map(validateEntry);
  if (new Set(entries.map((e) => e.id)).size !== entries.length)
    throw Error('备份包含重复的记录编号');
  const days: Record<string, DayMark> = {};
  if (Object.keys(x.days).length > 110000) throw Error('备份日期数量过多');
  for (const [date, m] of Object.entries(x.days)) {
    if (
      !validDate(date) ||
      !m ||
      !['dry', 'complete', 'unknown'].includes(m.status) ||
      typeof m.updatedAt !== 'string' ||
      isNaN(Date.parse(m.updatedAt))
    )
      throw Error('备份的日期状态无效');
    days[date] = { status: m.status, updatedAt: m.updatedAt };
  }
  const d: Diary = {
    schema: 'lager-diary',
    version: 1,
    entries,
    days,
    prefs: {
      source: x.prefs?.source === 'tap' ? 'tap' : 'can',
      motion: x.prefs?.motion !== false,
    },
    lastBackup:
      typeof x.lastBackup === 'string' && !isNaN(Date.parse(x.lastBackup))
        ? x.lastBackup
        : null,
  };
  return reconcile(d);
}
function reconcile(d: Diary) {
  const occupied = new Set(liveEntries(d).map((e) => e.date));
  for (const [date, m] of Object.entries(d.days)) {
    if (m.status === 'dry' && occupied.has(date))
      d.days[date] = { ...m, status: 'unknown' };
    if (m.status === 'complete' && !occupied.has(date))
      d.days[date] = { ...m, status: 'unknown' };
  }
  return d;
}
export function mergeDiaries(current: Diary, incoming: Diary): Diary {
  const map = new Map(current.entries.map((e) => [e.id, e]));
  for (const e of incoming.entries) {
    const old = map.get(e.id);
    if (!old || Date.parse(e.updatedAt) > Date.parse(old.updatedAt))
      map.set(e.id, e);
  }
  const days = { ...current.days };
  for (const [date, m] of Object.entries(incoming.days)) {
    if (
      !days[date] ||
      Date.parse(m.updatedAt) > Date.parse(days[date].updatedAt)
    )
      days[date] = m;
  }
  return reconcile({ ...current, entries: [...map.values()], days });
}
export function putEntry(d: Diary, entry: Entry) {
  const e = validateEntry(entry);
  const old = d.entries.find((x) => x.id === e.id);
  const days = {
    ...d.days,
    [e.date]: { status: 'unknown' as const, updatedAt: e.updatedAt },
  };
  if (old && old.date !== e.date)
    days[old.date] = { status: 'unknown', updatedAt: e.updatedAt };
  return {
    ...d,
    entries: [...d.entries.filter((x) => x.id !== e.id), e],
    days,
  };
}
export function deleteEntry(
  d: Diary,
  id: string,
  stamp = new Date().toISOString(),
) {
  const e = d.entries.find((x) => x.id === id);
  if (!e) return d;
  return {
    ...d,
    entries: d.entries.map((x) =>
      x.id === id ? { ...x, deleted: true, updatedAt: stamp } : x,
    ),
    days: {
      ...d.days,
      [e.date]: { status: 'unknown' as const, updatedAt: stamp },
    },
  };
}
export function confirmRange(
  d: Diary,
  start: string,
  end: string,
  today = localDate(),
) {
  if (end > today) throw Error('不能确认未来日期');
  const dates = dateRange(start, end);
  const occupied = new Set(liveEntries(d).map((e) => e.date));
  const days = { ...d.days },
    updatedAt = new Date().toISOString();
  for (const date of dates)
    days[date] = { status: occupied.has(date) ? 'complete' : 'dry', updatedAt };
  return { ...d, days };
}
export function summarize(
  d: Diary,
  start: string,
  end: string,
  today = localDate(),
) {
  const dates =
    start > today ? [] : dateRange(start, end < today ? end : today);
  const dateSet = new Set(dates);
  const entries = liveEntries(d).filter((e) => dateSet.has(e.date));
  const ml = volume(entries);
  const drinkingDays = new Set(entries.map((e) => e.date)).size;
  const confirmed = dates.filter((date) =>
    ['complete', 'dry'].includes(d.days[date]?.status),
  );
  const dryDays = dates.filter((date) => d.days[date]?.status === 'dry').length;
  return {
    ml,
    entries: entries.length,
    drinkingDays,
    dryDays,
    calendarDays: dates.length,
    confirmedDays: confirmed.length,
    missingDays: dates.length - confirmed.length,
    calendarAverage: dates.length ? ml / dates.length : 0,
    drinkingAverage: drinkingDays ? ml / drinkingDays : 0,
  };
}
export function yearEstimate(
  d: Diary,
  start: string,
  end: string,
  today = localDate(),
) {
  if (end >= today) throw Error('估算区间请选择昨天或更早的日期');
  const dates = dateRange(start, end);
  if (dates.length < 30) throw Error('至少需要 30 个连续、已确认完整的日期');
  if (dates.some((date) => !['complete', 'dry'].includes(d.days[date]?.status)))
    throw Error('该区间仍有未确认完整的日期');
  const amount = volume(
    liveEntries(d).filter((e) => e.date >= start && e.date <= end),
  );
  const year = Number(end.slice(0, 4)),
    daysInYear = dateRange(`${year}-01-01`, `${year}-12-31`).length;
  return {
    ml: (amount / dates.length) * daysInYear,
    days: dates.length,
    total: amount,
    daysInYear,
  };
}
export function csvExport(d: Diary) {
  const safe = (v: unknown) => {
    let s = String(v);
    if (/^[\s]*[=+@-]/.test(s)) s = "'" + s;
    return '"' + s.replaceAll('"', '""') + '"';
  };
  return (
    '\uFEFF' +
    [
      ['日期', '时间', '容量(mL)', '来源', '品牌', '备注', '记录编号'],
      ...liveEntries(d)
        .sort((a, b) => (a.date + a.time).localeCompare(b.date + b.time))
        .map((e) => [
          e.date,
          e.time,
          e.ml,
          e.source === 'can' ? '易拉罐' : '桶装打酒',
          e.brand,
          e.note,
          e.id,
        ]),
    ]
      .map((r) => r.map(safe).join(','))
      .join('\r\n')
  );
}
export const WORLD_SOURCE =
  'https://www.kirinholdings.com/en/newsroom/release/2025/1222_01.html';
export const CHINA_POPULATION_SOURCE =
  'https://www.stats.gov.cn/english/PressRelease/202502/t20250228_1958822.html';
export const CHINA_TOTAL_BEER_THOUSAND_KL = 40534;
export const CHINA_POPULATION = 1408280000;
export const CHINA_PER_CAPITA_LITERS =
  (CHINA_TOTAL_BEER_THOUSAND_KL * 1_000_000) / CHINA_POPULATION;
export const countries = [
  {
    name: '捷克',
    en: 'CZECHIA',
    flag: '🇨🇿',
    liters: 148.8,
    method: 'Kirin 人均表',
  },
  {
    name: '德国',
    en: 'GERMANY',
    flag: '🇩🇪',
    liters: 86.9,
    method: 'Kirin 人均表',
  },
  {
    name: '英国',
    en: 'UNITED KINGDOM',
    flag: '🇬🇧',
    liters: 66.3,
    method: 'Kirin 人均表',
  },
  {
    name: '美国',
    en: 'UNITED STATES',
    flag: '🇺🇸',
    liters: 65.4,
    method: 'Kirin 人均表',
  },
  {
    name: '韩国',
    en: 'SOUTH KOREA',
    flag: '🇰🇷',
    liters: 44.6,
    method: 'Kirin 人均表',
  },
  {
    name: '日本',
    en: 'JAPAN',
    flag: '🇯🇵',
    liters: 33.7,
    method: 'Kirin 人均表',
  },
  {
    name: '中国',
    en: 'CHINA',
    flag: '🇨🇳',
    liters: CHINA_PER_CAPITA_LITERS,
    method: '4,053.4 万千升 ÷ 14.0828 亿人',
  },
].sort((a, b) => b.liters - a.liters);
