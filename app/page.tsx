'use client';
import { useEffect, useRef, useState } from 'react';
import {
  Beer,
  Settings,
  Plus,
  BarChart3,
  Globe2,
  ChevronLeft,
  ChevronRight,
  ArrowUpRight,
  Check,
  Download,
  Upload,
  FileSpreadsheet,
  Pencil,
  Trash2,
  Leaf,
  X,
  CalendarDays,
  ShieldCheck,
  Share2,
} from 'lucide-react';
import { Tabs, TabsList, TabsTrigger, TabsContent } from '@/components/ui/tabs';
import {
  Dialog,
  DialogContent,
  DialogTitle,
  DialogDescription,
  DialogClose,
} from '@/components/ui/dialog';
import {
  AlertDialog,
  AlertDialogContent,
  AlertDialogTitle,
  AlertDialogDescription,
  AlertDialogCancel,
  AlertDialogAction,
} from '@/components/ui/alert-dialog';
import { RadioGroup, RadioGroupItem } from '@/components/ui/radio-group';
import { Switch } from '@/components/ui/switch';
import { Toaster, toast } from '@/components/ui/toast';
import {
  emptyDiary,
  localDate,
  localTime,
  validDate,
  liveEntries,
  volume,
  displayVolume,
  validateDiary,
  validateEntry,
  mergeDiaries,
  putEntry,
  deleteEntry,
  confirmRange,
  summarize,
  dateRange,
  csvExport,
  countries,
  WORLD_SOURCE,
  CHINA_POPULATION_SOURCE,
  STORAGE_KEY,
  type Diary,
  type Entry,
} from '@/lib/diary';
const stamp = () => new Date().toISOString();
const compact = (ml: number) => {
  const v = displayVolume(ml);
  return `${v.number} ${v.unit}`;
};
const dayLabel = (date: string) =>
  new Date(date + 'T12:00:00').toLocaleDateString('zh-CN', {
    month: 'long',
    day: 'numeric',
    weekday: 'long',
  });
function Choice({
  value,
  onChange,
  id,
}: {
  value: 'can' | 'tap';
  onChange: (v: 'can' | 'tap') => void;
  id: string;
}) {
  return (
    <RadioGroup
      className="source-choice"
      value={value}
      onValueChange={(v) => onChange(v as 'can' | 'tap')}
      aria-label="啤酒来源"
    >
      <label className={value === 'can' ? 'chosen' : ''}>
        <RadioGroupItem id={id + 'can'} value="can" />
        易拉罐
      </label>
      <label className={value === 'tap' ? 'chosen' : ''}>
        <RadioGroupItem id={id + 'tap'} value="tap" />
        桶装打酒
      </label>
    </RadioGroup>
  );
}
function Metric({
  label,
  value,
  unit,
}: {
  label: string;
  value: string | number;
  unit?: string;
}) {
  return (
    <div className="metric">
      <span>{label}</span>
      <p>
        {value}
        <small>{unit}</small>
      </p>
    </div>
  );
}
function AnimatedNumber({
  value,
  enabled,
}: {
  value: number;
  enabled: boolean;
}) {
  const [n, setN] = useState(value);
  const last = useRef(value);
  useEffect(() => {
    if (!enabled || matchMedia('(prefers-reduced-motion: reduce)').matches) {
      setN(value);
      last.current = value;
      return;
    }
    const start = performance.now(),
      from = last.current;
    let frame = 0;
    const tick = (time: number) => {
      const t = Math.min((time - start) / 350, 1);
      const next = from + (value - from) * (1 - (1 - t) ** 3);
      setN(next);
      if (t < 1) frame = requestAnimationFrame(tick);
      else last.current = value;
    };
    frame = requestAnimationFrame(tick);
    return () => cancelAnimationFrame(frame);
  }, [value, enabled]);
  const formatted = displayVolume(n);
  return (
    <>
      {formatted.number}
      <span>{formatted.unit}</span>
    </>
  );
}
export default function Home() {
  const [data, setData] = useState<Diary>(emptyDiary);
  const ref = useRef(data);
  const [ready, setReady] = useState(false);
  const [blocked, setBlocked] = useState('');
  const rawBad = useRef('');
  const [today, setToday] = useState('');
  const [date, setDate] = useState('');
  const [tab, setTab] = useState('today');
  const [settings, setSettings] = useState(false);
  const [form, setForm] = useState<Entry | null>(null);
  const [formError, setFormError] = useState('');
  const [pulse, setPulse] = useState(0);
  const [month, setMonth] = useState('');
  const [period, setPeriod] = useState('month');
  const [year, setYear] = useState(new Date().getFullYear());
  const [pending, setPending] = useState<Diary | null>(null);
  const [replace, setReplace] = useState(false);
  const [confirm, setConfirm] = useState<{ start: string; end: string } | null>(
    null,
  );
  const fileRef = useRef<HTMLInputElement>(null);
  function report(error: unknown) {
    toast.add({
      title: error instanceof Error ? error.message : '操作未完成，请重试',
      type: 'error',
      timeout: 6000,
    });
  }
  function commit(transform: (d: Diary) => Diary, allowBlocked = false) {
    if (!ready || (blocked && !allowBlocked))
      throw Error('本机数据尚未就绪，请先处理保存提示');
    const next = transform(ref.current);
    try {
      localStorage.setItem(STORAGE_KEY, JSON.stringify(next));
    } catch {
      throw Error('无法保存到本机，请检查浏览器存储空间；本次操作未保存');
    }
    ref.current = next;
    setData(next);
    return next;
  }
  function act(transform: (d: Diary) => Diary, message?: string) {
    try {
      const d = commit(transform);
      if (message)
        toast.add({ title: message, type: 'success', timeout: 3500 });
      return d;
    } catch (e) {
      report(e);
      return null;
    }
  }
  useEffect(() => {
    const now = localDate();
    setToday(now);
    setDate(now);
    setMonth(now.slice(0, 7));
    try {
      const raw = localStorage.getItem(STORAGE_KEY);
      if (raw) {
        try {
          const d = validateDiary(JSON.parse(raw));
          ref.current = d;
          setData(d);
        } catch {
          rawBad.current = raw;
          setBlocked(
            '现有数据无法读取。请先在设置中导出原始数据，再导入有效备份。',
          );
        }
      }
    } catch {
      setBlocked('浏览器未允许本机存储。请使用 Safari 普通浏览模式重新打开。');
    }
    setReady(true);
    const sync = () => {
      const t = localDate();
      setToday((old) => {
        if (old !== t) setDate((current) => (current === old ? t : current));
        return t;
      });
      document.documentElement.dataset.hidden = String(document.hidden);
    };
    const timer = setInterval(sync, 30000);
    document.addEventListener('visibilitychange', sync);
    window.addEventListener('focus', sync);
    const listener = (event: StorageEvent) => {
      if (event.key === STORAGE_KEY && event.newValue) {
        try {
          const d = validateDiary(JSON.parse(event.newValue));
          ref.current = d;
          setData(d);
        } catch {
          setBlocked('另一页面保存的数据无法读取，请先导出备份。');
        }
      }
    };
    window.addEventListener('storage', listener);
    return () => {
      clearInterval(timer);
      document.removeEventListener('visibilitychange', sync);
      window.removeEventListener('focus', sync);
      window.removeEventListener('storage', listener);
    };
  }, []);
  useEffect(() => {
    document.documentElement.dataset.motion = String(data.prefs.motion);
  }, [data.prefs.motion]);
  // A read-only tool completes the same date-summary journey as the statistics view.
  useEffect(() => {
    if (!ready) return;
    const context = (
      document as Document & {
        modelContext?: {
          registerTool: (
            tool: unknown,
            options: unknown,
          ) => Promise<void> | void;
        };
      }
    ).modelContext;
    if (!context?.registerTool) return;
    const lifecycle = new AbortController();
    try {
      Promise.resolve(
        context.registerTool(
          {
            name: 'get_lager_summary',
            title: '查看啤酒记录统计',
            description:
              '读取本机日记在指定日期范围内的容量、记录完整度和饮酒天数。不会修改记录。',
            inputSchema: {
              type: 'object',
              properties: {
                start: { type: 'string' },
                end: { type: 'string' },
              },
              required: ['start', 'end'],
              additionalProperties: false,
            },
            annotations: { readOnlyHint: true, untrustedContentHint: false },
            execute: (input: unknown) => {
              const i = input as { start: string; end: string };
              if (blocked) throw Error('日记数据无法读取');
              if (
                !i ||
                !validDate(i.start) ||
                !validDate(i.end) ||
                i.start > i.end
              )
                throw Error('无效日期范围');
              return summarize(ref.current, i.start, i.end, localDate());
            },
          },
          { signal: lifecycle.signal },
        ),
      ).catch(() => {});
    } catch {}
    return () => lifecycle.abort();
  }, [ready, blocked]);
  const entries = liveEntries(data);
  const dayEntries = entries
    .filter((e) => e.date === date)
    .sort(
      (a, b) =>
        b.time.localeCompare(a.time) || b.updatedAt.localeCompare(a.updatedAt),
    );
  const total = volume(dayEntries);
  const source = data.prefs.source;
  const dayStatus = data.days[date]?.status;
  const usable = ready && !blocked;
  function add(ml: number) {
    if (!validDate(date) || date > localDate()) return;
    const now = new Date();
    const target = date === today ? localDate(now) : date;
    const entry: Entry = {
      id: crypto.randomUUID(),
      date: target,
      time: localTime(now),
      ml,
      source: ref.current.prefs.source,
      brand: '',
      note: '',
      updatedAt: stamp(),
    };
    if (act((d) => putEntry(d, entry))) {
      setPulse((x) => x + 1);
      toast.add({
        title: `已记录 ${ml} mL`,
        description: target === localDate() ? '保存在此设备' : target,
        timeout: 6000,
        type: 'success',
        actionProps: {
          children: '撤销',
          onClick: () => {
            act((d) => deleteEntry(d, entry.id), '已撤销这笔记录');
          },
        },
      });
    }
  }
  function openForm(entry?: Entry) {
    setFormError('');
    setForm(
      entry
        ? { ...entry }
        : {
            id: crypto.randomUUID(),
            date: date || localDate(),
            time: localTime(),
            ml: 500,
            source,
            brand: '',
            note: '',
            updatedAt: stamp(),
          },
    );
  }
  function saveForm(event: React.FormEvent) {
    event.preventDefault();
    if (!form) return;
    try {
      const entry = validateEntry({ ...form, updatedAt: stamp() });
      if (entry.date > localDate()) throw Error('不能记录未来日期');
      const existed = ref.current.entries.find((e) => e.id === entry.id);
      commit((d) => ({
        ...putEntry(d, entry),
        prefs: { ...d.prefs, source: entry.source },
      }));
      setForm(null);
      setDate(entry.date);
      setPulse((x) => x + 1);
      toast.add({
        title: existed ? '记录已更新' : '记录已保存',
        type: 'success',
        timeout: 5000,
      });
    } catch (e) {
      setFormError(e instanceof Error ? e.message : '无法保存');
    }
  }
  function remove(entry: Entry) {
    if (act((d) => deleteEntry(d, entry.id))) {
      setForm(null);
      toast.add({
        title: '记录已删除',
        type: 'success',
        timeout: 7000,
        actionProps: {
          children: '撤销',
          onClick: () =>
            act(
              (d) => putEntry(d, { ...entry, updatedAt: stamp() }),
              '已恢复记录',
            ),
        },
      });
    }
  }
  function markDry() {
    if (dayEntries.length) return;
    if (dayStatus === 'dry') {
      act(
        (d) => ({
          ...d,
          days: {
            ...d.days,
            [date]: { status: 'unknown', updatedAt: stamp() },
          },
        }),
        '已恢复为未记录',
      );
    } else act((d) => confirmRange(d, date, date), '已标记未饮酒');
  }
  function download(text: string, name: string, type: string) {
    const blob = new Blob([text], { type }),
      url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
    setTimeout(() => URL.revokeObjectURL(url), 60000);
  }
  function backup() {
    try {
      const next = { ...ref.current, lastBackup: stamp() };
      download(
        JSON.stringify(next, null, 2),
        `喝了么-备份-${localDate()}.json`,
        'application/json',
      );
      commit(() => next);
      toast.add({
        title: '备份已导出',
        description: '请保存到“文件”或 iCloud Drive。',
        type: 'success',
      });
    } catch (e) {
      report(e);
    }
  }
  async function importFile(file?: File) {
    if (!file) return;
    try {
      if (file.size > 8 * 1024 * 1024) throw Error('备份文件不能超过 8 MB');
      const d = validateDiary(JSON.parse(await file.text()));
      setPending(d);
      setReplace(false);
    } catch (e) {
      report(e);
    }
    if (fileRef.current) fileRef.current.value = '';
  }
  function restore(overwrite: boolean) {
    if (!pending) return;
    try {
      commit(
        (d) =>
          overwrite
            ? { ...pending, lastBackup: d.lastBackup }
            : mergeDiaries(d, pending),
        overwrite,
      );
      setBlocked('');
      setPending(null);
      setReplace(false);
      toast.add({
        title: overwrite ? '备份已恢复' : '备份已合并，重复记录不会增加',
        type: 'success',
      });
    } catch (e) {
      report(e);
    }
  }
  async function shareYearReview() {
    try {
      const canvas = document.createElement('canvas');
      canvas.width = 1320;
      canvas.height = 2868;
      const ctx = canvas.getContext('2d');
      if (!ctx) throw Error('当前浏览器无法生成分享图片');
      const image = new Image();
      image.src = '/beer-illustration-v2.jpg';
      await image.decode();
      const actualLiters = yStats.ml / 1000;
      ctx.fillStyle = '#f3efe3';
      ctx.fillRect(0, 0, canvas.width, canvas.height);
      const scale = Math.max(1320 / image.width, 1180 / image.height);
      const drawWidth = image.width * scale;
      const drawHeight = image.height * scale;
      ctx.drawImage(image, (1320 - drawWidth) / 2, -120, drawWidth, drawHeight);
      const gradient = ctx.createLinearGradient(0, 680, 0, 1120);
      gradient.addColorStop(0, 'rgba(38,35,27,0.05)');
      gradient.addColorStop(1, '#f3efe3');
      ctx.fillStyle = gradient;
      ctx.fillRect(0, 620, 1320, 520);
      ctx.fillStyle = '#f3efe3';
      ctx.fillRect(0, 1080, 1320, 1788);
      ctx.fillStyle = 'rgba(37,34,26,.72)';
      ctx.fillRect(82, 210, 1156, 96);
      ctx.fillStyle = '#f8f2df';
      ctx.font = '600 32px sans-serif';
      ctx.fillText('LAGER DAYS  ·  YEARLY JOURNAL', 118, 272);
      ctx.fillStyle = '#302f28';
      ctx.font = '700 92px serif';
      ctx.fillText(`${year} 年拉格回顾`, 88, 1235);
      ctx.fillStyle = '#776a53';
      ctx.font = '34px sans-serif';
      ctx.fillText('一杯一记，把这一年的金色时光收藏起来。', 90, 1308);
      const card = (
        x: number,
        y: number,
        width: number,
        height: number,
        color: string,
      ) => {
        ctx.beginPath();
        ctx.roundRect(x, y, width, height, 34);
        ctx.fillStyle = color;
        ctx.fill();
      };
      card(80, 1390, 360, 270, '#fffaf0');
      card(480, 1390, 360, 270, '#fffaf0');
      card(880, 1390, 360, 270, '#e8ecd9');
      ctx.fillStyle = '#756b56';
      ctx.font = '30px sans-serif';
      ctx.fillText('饮酒日', 120, 1470);
      ctx.fillText('饮酒次', 520, 1470);
      ctx.fillText('500 mL 标准罐', 920, 1470);
      ctx.fillStyle = '#7b5318';
      ctx.font = '700 92px Georgia, serif';
      ctx.fillText(String(yStats.drinkingDays), 120, 1590);
      ctx.fillText(String(yStats.entries), 520, 1590);
      ctx.fillStyle = '#61703e';
      ctx.fillText((yStats.ml / 500).toFixed(1), 920, 1590);
      ctx.fillStyle = '#302f28';
      ctx.font = '600 40px sans-serif';
      ctx.fillText('年度实际消耗与国家人均对比', 90, 1785);
      const china = countries.find((country) => country.name === '中国');
      const referenceRows = [
        ...countries.slice(0, 3).map((country) => ({
          label: country.name,
          value: country.liters,
          color: '#c6ad78',
        })),
        { label: '中国', value: china?.liters ?? 28.8, color: '#ad9470' },
        { label: '我的实际', value: actualLiters, color: '#6f7c49' },
      ];
      const referenceMax = Math.max(
        ...referenceRows.map((row) => row.value),
        1,
      );
      referenceRows.forEach((row, index) => {
        const y = 1900 + index * 130;
        ctx.fillStyle = '#786d5a';
        ctx.font = '30px sans-serif';
        ctx.fillText(row.label, 90, y);
        ctx.fillStyle = '#ded7c8';
        ctx.fillRect(300, y - 24, 760, 20);
        ctx.fillStyle = row.color;
        ctx.fillRect(300, y - 24, (row.value / referenceMax) * 760, 20);
        ctx.fillStyle = '#524939';
        ctx.textAlign = 'right';
        ctx.fillText(`${row.value.toFixed(1)} L`, 1230, y);
        ctx.textAlign = 'left';
      });
      ctx.fillStyle = '#988b75';
      ctx.font = '25px sans-serif';
      ctx.fillText('国家数据：Kirin 2024 · 我的实际：喝了么本机记录', 90, 2735);
      const blob = await new Promise<Blob | null>((resolve) =>
        canvas.toBlob(resolve, 'image/png'),
      );
      if (!blob) throw Error('打卡图片生成失败');
      const file = new File([blob], `喝了么-${year}-年度回顾.png`, {
        type: 'image/png',
      });
      if (navigator.share && navigator.canShare?.({ files: [file] })) {
        await navigator.share({
          files: [file],
          title: '喝了么',
          text: `${year} 年记录了 ${yStats.drinkingDays} 个饮酒日、${yStats.entries} 次，合计 ${(yStats.ml / 500).toFixed(1)} 个 500 mL 标准罐。`,
        });
      } else {
        const url = URL.createObjectURL(blob);
        const anchor = document.createElement('a');
        anchor.href = url;
        anchor.download = file.name;
        anchor.click();
        setTimeout(() => URL.revokeObjectURL(url), 60_000);
        toast.add({
          title: '打卡图片已生成',
          description: '请保存后分享。',
          type: 'success',
        });
      }
    } catch (error) {
      if (error instanceof DOMException && error.name === 'AbortError') return;
      report(error);
    }
  }
  const monthStart = month ? month + '-01' : localDate().slice(0, 7) + '-01';
  const monthEnd = localDate(
    new Date(Number(monthStart.slice(0, 4)), Number(monthStart.slice(5, 7)), 0),
  );
  const start = period === 'year' ? `${year}-01-01` : monthStart;
  const end = period === 'year' ? `${year}-12-31` : monthEnd;
  const stats = summarize(data, start, end, today || localDate());
  const calendarDates = dateRange(monthStart, monthEnd);
  const yStats = summarize(
    data,
    `${year}-01-01`,
    `${year}-12-31`,
    today || localDate(),
  );
  const selectedYearDays = dateRange(`${year}-01-01`, `${year}-12-31`).length;
  const projectedYearMl = yStats.calendarDays
    ? (yStats.ml / yStats.calendarDays) * selectedYearDays
    : 0;
  const daysByVolume = new Map<string, number>();
  for (const e of entries)
    daysByVolume.set(e.date, (daysByVolume.get(e.date) || 0) + e.ml);
  const graph =
    period === 'year'
      ? Array.from({ length: 12 }, (_, i) => {
          const prefix = `${year}-${String(i + 1).padStart(2, '0')}`;
          return {
            label: String(i + 1),
            ml: volume(entries.filter((e) => e.date.startsWith(prefix))),
            future: prefix > (today || localDate()).slice(0, 7),
          };
        })
      : calendarDates.map((d) => ({
          label: String(Number(d.slice(8))),
          ml: daysByVolume.get(d) || 0,
          future: d > (today || localDate()),
        }));
  const graphMax = Math.max(500, ...graph.map((x) => x.ml));
  const comparisonRows = [
    ...countries.map((country) => ({ ...country, kind: 'country' as const })),
    {
      name: '我 · 全年估算',
      en: `${year} PROJECTED`,
      flag: '🍺',
      liters: projectedYearMl / 1000,
      method: `实际累计 ÷ ${yStats.calendarDays} 个已过日历日 × ${selectedYearDays} 天`,
      kind: 'personal' as const,
    },
    {
      name: '我 · 当前实际',
      en: `${year} ACTUAL`,
      flag: '🍺',
      liters: yStats.ml / 1000,
      method: `${year} 年截至当前日期的实际记录`,
      kind: 'personal' as const,
    },
  ].sort((a, b) => b.liters - a.liters);
  const worldMax = Math.max(1, ...comparisonRows.map((row) => row.liters));
  const importDates = pending
    ? [
        ...liveEntries(pending).map((e) => e.date),
        ...Object.keys(pending.days),
      ].sort()
    : [];
  const newCount = pending
    ? pending.entries.filter(
        (e) => !e.deleted && !data.entries.some((old) => old.id === e.id),
      ).length
    : 0;
  function shiftMonth(direction: number) {
    const [y, m] = month.split('-').map(Number);
    const next = new Date(y, m - 1 + direction, 1);
    if (localDate(next).slice(0, 7) > localDate().slice(0, 7)) return;
    setMonth(localDate(next).slice(0, 7));
  }
  if (!ready)
    return (
      <main className="shell">
        <header className="header">
          <div className="brand">
            <span className="seal">麦</span>
            <h1>喝了么</h1>
          </div>
        </header>
        <p>正在打开本机日记…</p>
      </main>
    );
  return (
    <Toaster>
      <main className="shell">
        <header className="header">
          <div className="brand">
            <span className="seal" aria-hidden="true">
              麦
            </span>
            <div>
              <h1>喝了么</h1>
              <small>LAGER DAYS</small>
            </div>
          </div>
          <div className="header-right">
            <span className="local-badge">
              <span />
              本机日记
            </span>
            <button
              className="icon-button"
              aria-label="设置与备份"
              onClick={() => setSettings(true)}
            >
              <Settings size={20} />
            </button>
          </div>
        </header>
        {blocked && (
          <div role="alert" className="error-banner">
            {blocked}
            <button onClick={() => setSettings(true)}>打开设置</button>
          </div>
        )}
        <Tabs
          value={tab}
          onValueChange={(v) => setTab(String(v))}
          className="app-tabs"
        >
          <TabsContent value="today">
            <div className="date-line">
              <span>
                {date === today ? '今天' : date} · {dayLabel(date)}
              </span>
              <label className="date-control">
                <CalendarDays size={16} />
                <span>选日期</span>
                <input
                  aria-label="查看记录日期"
                  type="date"
                  value={date}
                  max={today}
                  min="1900-01-01"
                  onInput={(e) => {
                    const v = e.currentTarget.value;
                    if (validDate(v) && v <= today) setDate(v);
                  }}
                  onChange={(e) => {
                    if (validDate(e.target.value) && e.target.value <= today)
                      setDate(e.target.value);
                  }}
                />
              </label>
            </div>
            <section
              className={`today-hero ${pulse ? 'has-record' : ''} ${data.prefs.motion ? '' : 'motion-off'}`}
            >
              <img
                className="beer-photo"
                src="/beer-illustration-v2.jpg"
                alt="原创手绘的金色拉格酒杯、白色泡沫与自然侧光"
              />
              <div className="hero-copy">
                <span className="eyebrow">日々の一杯</span>
                <h2>
                  一杯一记，
                  <br />
                  留住好时光。
                </h2>
                <p>{date === today ? '今日' : '当日'}已记录</p>
                <div className="hero-number" aria-label={`${total} 毫升`}>
                  <AnimatedNumber value={total} enabled={data.prefs.motion} />
                </div>
                <span className="hero-meta">
                  {dayEntries.length
                    ? `${dayEntries.length} 次 · ${(total / 500).toFixed(2).replace(/\.00$/, '')} 标准罐`
                    : dayStatus === 'dry'
                      ? '今天留白，也有记录'
                      : '从记下第一杯开始'}
                </span>
              </div>
              <div className="sparkles" aria-hidden="true">
                {Array.from({ length: 9 }, (_, i) => (
                  <i
                    key={i}
                    style={{
                      left: `${i * 10 + 5}%`,
                      animationDelay: `${i * -0.7}s`,
                      animationDuration: `${3 + (i % 3)}s`,
                    }}
                  />
                ))}
              </div>
              <div
                key={pulse}
                className={pulse ? 'pour-flash' : ''}
                aria-hidden="true"
              />
              <span className="photo-caption">JAPANESE LAGER / 生ビール</span>
            </section>
            <section className="quick-panel">
              <div className="section-line">
                <h2>{date === today ? '记下一杯' : '补记这一天'}</h2>
                <Choice
                  id="quick-"
                  value={source}
                  onChange={(v) =>
                    act((d) => ({ ...d, prefs: { ...d.prefs, source: v } }))
                  }
                />
              </div>
              <div className="quick-buttons">
                <button
                  aria-label="记录 330 毫升"
                  disabled={!usable}
                  onClick={() => add(330)}
                >
                  <Plus size={18} />
                  <strong>330</strong>
                  <span>mL</span>
                </button>
                <button
                  aria-label="记录 500 毫升"
                  disabled={!usable}
                  onClick={() => add(500)}
                >
                  <Plus size={18} />
                  <strong>500</strong>
                  <span>mL</span>
                </button>
                <button disabled={!usable} onClick={() => openForm()}>
                  <Plus size={20} />
                  <span>自定义</span>
                </button>
              </div>
              <p className="under-note">
                {source === 'tap'
                  ? '按杯记录实际喝掉的容量，10 L 为酒桶规格。'
                  : '点击立即保存 · 可撤销 · 品牌可稍后补充'}
              </p>
            </section>
            <section className="entries-section">
              <div className="section-line">
                <h2>
                  {date === today ? '今日记录' : '当日记录'}
                  <span className="count">{dayEntries.length}</span>
                </h2>
                <button
                  className="text-button"
                  onClick={() => openForm()}
                  disabled={!usable}
                >
                  <Plus size={16} />
                  补充记录
                </button>
              </div>
              {dayEntries.length === 0 ? (
                <div className="empty-state">
                  <Leaf size={22} />
                  <p>
                    {dayStatus === 'dry'
                      ? '已记录：这一天未饮酒'
                      : '这一天还没有饮用记录'}
                  </p>
                  <span>
                    {dayStatus === 'dry'
                      ? '统计会把这一天计入明确未饮酒。'
                      : '未记录不会自动算作未饮酒。'}
                  </span>
                  <button
                    className="soft-button"
                    onClick={markDry}
                    disabled={!usable}
                  >
                    {dayStatus === 'dry' ? '取消未饮酒标记' : '标记这天未饮酒'}
                  </button>
                </div>
              ) : (
                <>
                  <div className="entry-list">
                    {dayEntries.map((e) => (
                      <button
                        className="entry-row"
                        key={e.id}
                        onClick={() => openForm(e)}
                      >
                        <span className="entry-icon">
                          <Beer size={20} />
                        </span>
                        <span className="entry-text">
                          <strong>{e.brand || '拉格啤酒'}</strong>
                          <small>
                            {e.time} ·{' '}
                            {e.source === 'can' ? '易拉罐' : '桶装打酒'}
                            {e.note ? ' · ' + e.note : ''}
                          </small>
                        </span>
                        <span className="entry-amount">
                          {e.ml}
                          <small> mL</small>
                        </span>
                        <Pencil size={15} />
                      </button>
                    ))}
                  </div>
                  <div className="complete-line">
                    <span>
                      <span
                        className={
                          'status-dot ' +
                          (dayStatus === 'complete' ? 'done' : '')
                        }
                      />
                      {dayStatus === 'complete'
                        ? '这一天已确认记录完整'
                        : '是否还有遗漏的记录？'}
                    </span>
                    <button
                      className="text-button"
                      disabled={!usable}
                      onClick={() =>
                        dayStatus === 'complete'
                          ? act(
                              (d) => ({
                                ...d,
                                days: {
                                  ...d.days,
                                  [date]: {
                                    status: 'unknown',
                                    updatedAt: stamp(),
                                  },
                                },
                              }),
                              '已取消完整标记',
                            )
                          : setConfirm({ start: date, end: date })
                      }
                    >
                      {dayStatus === 'complete' ? '取消确认' : '确认完整'}
                      <Check size={14} />
                    </button>
                  </div>
                </>
              )}
            </section>
            <div className="quiet-footer">
              <span>麦芽、泡沫，与日常。</span>
              <span>LAGER DAYS</span>
            </div>
          </TabsContent>
          <TabsContent value="stats">
            <div className="page-title">
              <span className="eyebrow">YOUR BEER JOURNAL</span>
              <h2>每一杯，都有迹可循。</h2>
            </div>
            <Tabs value={period} onValueChange={(v) => setPeriod(String(v))}>
              <TabsList className="period-tabs">
                <TabsTrigger value="month">按月</TabsTrigger>
                <TabsTrigger value="year">按年</TabsTrigger>
              </TabsList>
            </Tabs>
            <div className="period-picker">
              {period === 'month' ? (
                <>
                  <button
                    className="icon-button"
                    aria-label="上个月"
                    onClick={() => shiftMonth(-1)}
                  >
                    <ChevronLeft />
                  </button>
                  <input
                    aria-label="统计月份"
                    type="month"
                    value={month}
                    max={today.slice(0, 7)}
                    min="1900-01"
                    onInput={(e) => {
                      const v = e.currentTarget.value;
                      if (
                        /^\d{4}-\d{2}$/.test(v) &&
                        validDate(v + '-01') &&
                        v <= today.slice(0, 7)
                      )
                        setMonth(v);
                    }}
                    onChange={(e) => {
                      if (
                        /^\d{4}-\d{2}$/.test(e.target.value) &&
                        e.target.value <= today.slice(0, 7)
                      )
                        setMonth(e.target.value);
                    }}
                  />
                  <button
                    className="icon-button"
                    aria-label="下个月"
                    disabled={month >= today.slice(0, 7)}
                    onClick={() => shiftMonth(1)}
                  >
                    <ChevronRight />
                  </button>
                </>
              ) : (
                <label className="year-field">
                  统计年份
                  <input
                    aria-label="统计年份"
                    type="number"
                    min="1900"
                    max={Number(today.slice(0, 4))}
                    value={year}
                    onChange={(e) => {
                      const n = Number(e.target.value);
                      if (n >= 1900 && n <= Number(today.slice(0, 4)))
                        setYear(n);
                    }}
                  />
                </label>
              )}
            </div>
            <section className="stat-total">
              <span>{period === 'month' ? '本月' : '本年'}累计容量</span>
              <p>
                {displayVolume(stats.ml).number}
                <small>{displayVolume(stats.ml).unit}</small>
              </p>
              <div>
                相当于 <strong>{(stats.ml / 500).toFixed(1)}</strong> 罐 500 mL
                啤酒
              </div>
            </section>
            {period === 'year' && (
              <section className="stat-projection">
                <div>
                  <span>按当前饮用量估算全年</span>
                  <strong>{(projectedYearMl / 1000).toFixed(1)} L / 年</strong>
                </div>
                <p>
                  实际累计 ÷ {yStats.calendarDays} 个已过日历日 ×{' '}
                  {selectedYearDays} 天。
                  {yStats.missingDays
                    ? `还有 ${yStats.missingDays} 天未确认完整，估算可能偏低。`
                    : '已过日期均已确认完整。'}
                </p>
              </section>
            )}
            <div className="metrics-grid">
              <Metric label="饮酒天数" value={stats.drinkingDays} unit="天" />
              <Metric label="明确未饮酒" value={stats.dryDays} unit="天" />
              <Metric label="饮酒次数" value={stats.entries} unit="次" />
            </div>
            <section className="panel">
              <div className="section-line">
                <h3>{period === 'month' ? '每日容量' : '每月容量'}</h3>
                <span>单位：L</span>
              </div>
              <div
                className="chart"
                role="img"
                aria-label={graph
                  .map(
                    (x) =>
                      `${x.label}${period === 'year' ? '月' : '日'} ${x.ml} 毫升`,
                  )
                  .join('，')}
              >
                <div className="chart-scale">
                  <span>{(graphMax / 1000).toFixed(1)}</span>
                  <span>0</span>
                </div>
                <div className="chart-bars">
                  {graph.map((x, i) => (
                    <div className="chart-column" key={i}>
                      <div className="bar-track">
                        <div
                          className={x.future ? 'bar future' : 'bar'}
                          title={`${x.label}: ${compact(x.ml)}`}
                          style={{
                            height: `${(x.ml / graphMax) * 100}%`,
                            minHeight: x.ml ? 3 : 0,
                          }}
                        />
                      </div>
                      <span>
                        {period === 'year' ||
                        i % 5 === 0 ||
                        i === graph.length - 1
                          ? x.label
                          : ''}
                      </span>
                    </div>
                  ))}
                </div>
              </div>
              {stats.ml === 0 && (
                <p className="under-note">所选期间暂无饮用容量记录。</p>
              )}
            </section>
            {period === 'month' && (
              <section className="panel">
                <div className="section-line">
                  <h3>日历里的每一杯</h3>
                  <span>点击日期查看或补记</span>
                </div>
                <div className="calendar">
                  {['一', '二', '三', '四', '五', '六', '日'].map((x) => (
                    <span className="weekday" key={x}>
                      {x}
                    </span>
                  ))}
                  {Array.from(
                    {
                      length:
                        (new Date(monthStart + 'T12:00:00').getDay() + 6) % 7,
                    },
                    (_, i) => (
                      <span key={'blank' + i} />
                    ),
                  )}
                  {calendarDates.map((d) => {
                    const ml = daysByVolume.get(d) || 0,
                      status = data.days[d]?.status;
                    return (
                      <button
                        key={d}
                        disabled={d > today}
                        aria-label={`${d} ${ml ? `${ml} 毫升` : status === 'dry' ? '未饮酒' : '未记录'}`}
                        className={`day-cell ${ml ? (ml <= 500 ? 'heat1' : ml <= 1000 ? 'heat2' : 'heat3') : status === 'dry' ? 'dry' : ''} ${d === today ? 'today' : ''}`}
                        onClick={() => {
                          setDate(d);
                          setTab('today');
                        }}
                      >
                        {Number(d.slice(8))}
                        <small>
                          {ml
                            ? ml >= 1000
                              ? `${Number((ml / 1000).toFixed(2))}L`
                              : ml
                            : status === 'dry'
                              ? '休'
                              : '·'}
                        </small>
                      </button>
                    );
                  })}
                </div>
                <div className="calendar-legend">
                  <span>
                    <i />
                    未记录
                  </span>
                  <span>
                    <i className="dry" />
                    未饮酒
                  </span>
                  <span>
                    <i className="heat1" />
                    ≤500
                  </span>
                  <span>
                    <i className="heat2" />
                    ≤1000
                  </span>
                  <span>
                    <i className="heat3" />
                    &gt;1000 mL
                  </span>
                </div>
              </section>
            )}
            <section className="panel">
              <h3>记录完整度</h3>
              <p className="body-note">
                {stats.confirmedDays} / {stats.calendarDays}{' '}
                个已过日历日已确认完整。
                {stats.missingDays
                  ? `还有 ${stats.missingDays} 天未确认，以下平均值可能偏低。`
                  : '这个期间的记录已完整。'}
              </p>
              <div className="averages">
                <div>
                  <span>按日历天数日均</span>
                  <strong>{compact(stats.calendarAverage)}</strong>
                  <small>总量 ÷ {stats.calendarDays} 个已过日历日</small>
                </div>
                <div>
                  <span>按饮酒天数日均</span>
                  <strong>{compact(stats.drinkingAverage)}</strong>
                  <small>总量 ÷ {stats.drinkingDays} 个饮酒日</small>
                </div>
              </div>
              <button
                className="soft-button full"
                disabled={!usable || !stats.calendarDays}
                onClick={() =>
                  setConfirm({ start, end: end < today ? end : today })
                }
              >
                确认这一期间已记录完整
              </button>
            </section>
            <section className="review-card">
              <span className="eyebrow">
                {period === 'month' ? 'MONTHLY' : 'YEARLY'} RECAP
              </span>
              <h3>
                {period === 'month'
                  ? `${Number(month.slice(5))} 月`
                  : `${year} 年`}
                ，你的“喝了么”记录
              </h3>
              <p>
                记下了 {stats.entries} 次，合计 {compact(stats.ml)}。<br />
                其中易拉罐{' '}
                {compact(
                  volume(
                    entries.filter(
                      (e) =>
                        e.date >= start && e.date <= end && e.source === 'can',
                    ),
                  ),
                )}
                ，桶装打酒{' '}
                {compact(
                  volume(
                    entries.filter(
                      (e) =>
                        e.date >= start && e.date <= end && e.source === 'tap',
                    ),
                  ),
                )}
                。
              </p>
              <span className="meta">
                {stats.missingDays
                  ? '回顾仅汇总已有记录。'
                  : '这一段日常，已完整收藏。'}
              </span>
            </section>
          </TabsContent>
          <TabsContent value="world">
            <div className="page-title">
              <span className="eyebrow">A WORLD OF BEER</span>
              <h2>把一杯，放进世界里。</h2>
              <p>看看不同地方的啤酒日常。</p>
            </div>
            <section className="world-year-picker">
              <label className="year-field">
                对比与分享年份
                <input
                  aria-label="对比年份"
                  type="number"
                  min="1900"
                  max={Number(today.slice(0, 4))}
                  value={year}
                  onChange={(e) => {
                    const n = Number(e.target.value);
                    if (n >= 1900 && n <= Number(today.slice(0, 4))) setYear(n);
                  }}
                />
              </label>
            </section>
            <section className="annual-share-card">
              <img
                src="/beer-illustration-v2.jpg"
                alt="原创手绘的金色拉格酒杯"
              />
              <div className="annual-share-overlay" />
              <div className="annual-share-content">
                <span>LAGER DAYS · YEARLY JOURNAL</span>
                <h3>{year} 年拉格回顾</h3>
                <div className="annual-share-numbers">
                  <div>
                    <small>饮酒日</small>
                    <strong>{yStats.drinkingDays}</strong>
                  </div>
                  <div>
                    <small>饮酒次</small>
                    <strong>{yStats.entries}</strong>
                  </div>
                  <div>
                    <small>500 mL 标准罐</small>
                    <strong>{(yStats.ml / 500).toFixed(1)}</strong>
                  </div>
                </div>
                <button onClick={shareYearReview}>
                  <Share2 size={18} />
                  生成并分享年度回顾
                </button>
              </div>
            </section>
            <section className="panel world-chart">
              <div className="section-line">
                <h3>各国人均啤酒消费量</h3>
                <span>2024 · L / 人 / 年</span>
              </div>
              {comparisonRows.map((c, index) => (
                <div
                  className={`country ${c.name === '日本' ? 'japan' : ''} ${c.kind === 'personal' ? 'personal' : ''}`}
                  key={c.name}
                >
                  <div className="country-label">
                    <span>
                      <span className="rank">{index + 1}</span>
                      <span className="flag">{c.flag}</span>
                      <strong>{c.name}</strong>
                      <small>{c.en}</small>
                    </span>
                    <b>
                      {c.liters.toFixed(1)}
                      <small> L</small>
                    </b>
                  </div>
                  <div className="country-track">
                    <div style={{ width: `${(c.liters / worldMax) * 100}%` }} />
                  </div>
                  {(c.name === '中国' || c.kind === 'personal') && (
                    <p className="country-method">{c.method}</p>
                  )}
                </div>
              ))}
              <div className="source-note">
                <a href={WORLD_SOURCE} target="_blank" rel="noreferrer">
                  来源：Kirin 全球啤酒消费报告 <ArrowUpRight size={14} />
                </a>
                <p>
                  统计期：2024
                  年；发布：2025-12-22。榜单按人均量从高到低排列。除中国外均来自
                  Kirin 人均表；中国以 Kirin 总消费量 4,053.4
                  万千升除以国家统计局 2024 年末大陆人口 14.0828 亿计算，约 28.8
                  L/人/年。
                </p>
                <a
                  href={CHINA_POPULATION_SOURCE}
                  target="_blank"
                  rel="noreferrer"
                >
                  中国人口来源：国家统计局 <ArrowUpRight size={14} />
                </a>
                <p>
                  各国数据按总人口计算，包含非饮酒者；日本包括啤酒、发泡酒及新类型酒类。跨年份仅供背景参考，不是建议饮用量。
                </p>
              </div>
            </section>
          </TabsContent>
          <TabsList className="bottom-nav" aria-label="主导航">
            <TabsTrigger value="today">
              <Beer />
              今天
            </TabsTrigger>
            <TabsTrigger value="stats">
              <BarChart3 />
              统计
            </TabsTrigger>
            <TabsTrigger value="world">
              <Globe2 />
              世界
            </TabsTrigger>
          </TabsList>
        </Tabs>
        <Dialog
          open={!!form}
          onOpenChange={(open) => {
            if (!open) setForm(null);
          }}
        >
          <DialogContent className="app-dialog" showCloseButton={false}>
            <div className="dialog-heading">
              <DialogTitle>
                {form && data.entries.some((e) => e.id === form.id)
                  ? '编辑记录'
                  : '记下一杯'}
              </DialogTitle>
              <DialogClose className="icon-button" aria-label="关闭记录表单">
                <X size={19} />
              </DialogClose>
            </div>
            <DialogDescription>
              记录实际饮用的容量，品牌与备注可以留空。
            </DialogDescription>
            {form && (
              <form onSubmit={saveForm} className="record-form">
                <div className="two-fields">
                  <label>
                    日期
                    <input
                      aria-label="记录日期"
                      type="date"
                      required
                      min="1900-01-01"
                      max={today}
                      value={form.date}
                      onInput={(e) => {
                        const value = e.currentTarget.value;
                        setForm((f) => (f ? { ...f, date: value } : null));
                      }}
                      onBlur={(e) => {
                        const value = e.currentTarget.value;
                        setForm((f) => (f ? { ...f, date: value } : null));
                      }}
                      onChange={(e) =>
                        setForm({ ...form, date: e.target.value })
                      }
                    />
                  </label>
                  <label>
                    时间
                    <input
                      aria-label="记录时间"
                      type="time"
                      required
                      value={form.time}
                      onChange={(e) =>
                        setForm({ ...form, time: e.target.value })
                      }
                    />
                  </label>
                </div>
                <label>
                  饮用容量（mL）
                  <input
                    aria-label="饮用容量"
                    type="number"
                    inputMode="numeric"
                    min="1"
                    max="10000"
                    step="1"
                    required
                    value={form.ml || ''}
                    onChange={(e) =>
                      setForm({ ...form, ml: Number(e.target.value) })
                    }
                  />
                </label>
                <Choice
                  id="form-"
                  value={form.source}
                  onChange={(v) => setForm({ ...form, source: v })}
                />
                <label>
                  品牌 <span className="optional">选填</span>
                  <input
                    aria-label="品牌"
                    maxLength={80}
                    value={form.brand}
                    placeholder="如 SAPPORO、KIRIN、Asahi"
                    onChange={(e) =>
                      setForm({ ...form, brand: e.target.value })
                    }
                  />
                </label>
                <label>
                  备注 <span className="optional">选填</span>
                  <textarea
                    aria-label="备注"
                    maxLength={500}
                    rows={2}
                    value={form.note}
                    placeholder="酒款、地点，或今天的心情"
                    onChange={(e) => setForm({ ...form, note: e.target.value })}
                  />
                </label>
                {formError && (
                  <p role="alert" className="field-error">
                    {formError}
                  </p>
                )}
                <button
                  className="gold-button full"
                  disabled={!usable}
                  type="submit"
                >
                  保存记录 <Check size={18} />
                </button>
                {data.entries.some((e) => e.id === form.id) && (
                  <button
                    type="button"
                    className="text-button danger centered"
                    onClick={() => remove(form)}
                  >
                    <Trash2 size={16} />
                    删除这笔记录
                  </button>
                )}
              </form>
            )}
          </DialogContent>
        </Dialog>
        {settings && (
          <div
            className="settings-modal-layer"
            role="presentation"
            onMouseDown={(event) => {
              if (event.target === event.currentTarget) setSettings(false);
            }}
          >
            <section
              className="app-dialog settings-dialog"
              role="dialog"
              aria-modal="true"
              aria-labelledby="settings-title"
            >
              <div className="dialog-heading">
                <h2 id="settings-title">设置与备份</h2>
                <button
                  type="button"
                  className="icon-button"
                  aria-label="关闭设置"
                  onPointerDown={(event) => {
                    event.preventDefault();
                    event.stopPropagation();
                    setSettings(false);
                  }}
                  onClick={() => setSettings(false)}
                >
                  <X size={19} />
                </button>
              </div>
              <p className="settings-description">
                你的日记保存在当前设备与浏览器中。
              </p>
              <div className="settings-section">
                <div className="setting-row">
                  <div>
                    <strong>酒杯动效</strong>
                    <p>
                      当前：{data.prefs.motion ? '开启' : '关闭'}
                      ；同时遵循系统“减少动态效果”设置
                    </p>
                  </div>
                  <Switch
                    aria-label="酒杯动效"
                    checked={data.prefs.motion}
                    onCheckedChange={(v) => {
                      const enabled = Boolean(v);
                      act(
                        (d) => ({
                          ...d,
                          prefs: { ...d.prefs, motion: enabled },
                        }),
                        enabled ? '酒杯动效已开启' : '酒杯动效已关闭',
                      );
                    }}
                  />
                </div>
              </div>
              <section className="settings-section">
                <h3>备份你的日常</h3>
                <p className="body-note">
                  最近导出：
                  {data.lastBackup
                    ? new Date(data.lastBackup).toLocaleString('zh-CN')
                    : '尚未导出'}
                </p>
                <button
                  className="gold-button full"
                  onClick={backup}
                  disabled={!usable}
                >
                  <Download size={18} />
                  导出完整备份（JSON）
                </button>
                <button
                  className="soft-button full"
                  onClick={() => fileRef.current?.click()}
                >
                  <Upload size={18} />
                  导入备份并恢复
                </button>
                <input
                  ref={fileRef}
                  className="sr-only"
                  aria-label="选择备份文件"
                  type="file"
                  accept=".json,application/json"
                  onChange={(e) => importFile(e.target.files?.[0])}
                />
                <button
                  className="soft-button full"
                  onClick={() =>
                    download(
                      csvExport(data),
                      `喝了么-记录-${today}.csv`,
                      'text/csv;charset=utf-8',
                    )
                  }
                  disabled={!usable}
                >
                  <FileSpreadsheet size={18} />
                  导出记录表（CSV）
                </button>
                {rawBad.current && (
                  <button
                    className="soft-button full"
                    onClick={() =>
                      download(
                        rawBad.current,
                        '喝了么-原始数据.json',
                        'application/json',
                      )
                    }
                  >
                    导出无法读取的原始数据
                  </button>
                )}
                <p className="body-note">
                  将 JSON 备份保存到“文件”或 iCloud
                  Drive，换手机后在这里导入。CSV
                  用于查看记录，不用于完整恢复。导出时间不代表文件已保存，请检查“文件”中的备份。
                </p>
              </section>
              <section className="settings-section">
                <h3>
                  <ShieldCheck size={18} />
                  关于本机保存
                </h3>
                <p className="body-note">
                  清除浏览器数据、卸载主屏幕应用或更换网址可能使本机记录不可用。Safari
                  与主屏幕应用的存储可能独立，建议固定一种打开方式并定期备份。无账号、无自动云同步。
                </p>
              </section>
              <section className="settings-section">
                <h3>放到 iPhone 主屏幕</h3>
                <p className="body-note">
                  在 Safari 打开网站 → 分享 → 添加到主屏幕。日常从同一入口记录。
                </p>
              </section>
              <p className="settings-signature">
                喝了么 · LAGER DAYS <span>v1.0</span>
              </p>
            </section>
          </div>
        )}
        <Dialog
          open={!!pending && !replace}
          onOpenChange={(open) => {
            if (!open) setPending(null);
          }}
        >
          <DialogContent className="app-dialog" showCloseButton={false}>
            <DialogTitle>检查这份备份</DialogTitle>
            <DialogDescription>
              导入前请确认记录范围。默认合并，同一编号按较新的修改时间保留。
            </DialogDescription>
            <div className="import-summary">
              <p>
                有效记录{' '}
                <strong>{pending ? liveEntries(pending).length : 0} 笔</strong>
              </p>
              <p>
                新增记录 <strong>{newCount} 笔</strong>
              </p>
              <p>
                日期范围{' '}
                <strong>
                  {importDates.length
                    ? `${importDates[0]} ～ ${importDates.at(-1)}`
                    : '空备份'}
                </strong>
              </p>
              <p>
                完整日期标记{' '}
                <strong>
                  {pending
                    ? Object.values(pending.days).filter(
                        (d) => d.status !== 'unknown',
                      ).length
                    : 0}{' '}
                  天
                </strong>
              </p>
            </div>
            <button
              className="gold-button full"
              disabled={!!blocked}
              onClick={() => restore(false)}
            >
              合并导入
            </button>
            <button
              className="soft-button full"
              onClick={() => setReplace(true)}
            >
              用备份替换本机日记…
            </button>
            <DialogClose className="text-button centered">取消</DialogClose>
          </DialogContent>
        </Dialog>
        <AlertDialog
          open={replace}
          onOpenChange={(v) => {
            setReplace(v);
            if (!v) setPending(null);
          }}
        >
          <AlertDialogContent className="app-dialog">
            <AlertDialogTitle>替换当前设备的日记？</AlertDialogTitle>
            <AlertDialogDescription>
              现有记录会被这份备份替换。建议先导出当前日记；未备份的记录将无法恢复。
            </AlertDialogDescription>
            <AlertDialogCancel>取消</AlertDialogCancel>
            <AlertDialogAction
              className="gold-button"
              onClick={() => restore(true)}
            >
              确认替换并恢复
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
        <AlertDialog
          open={!!confirm}
          onOpenChange={(open) => {
            if (!open) setConfirm(null);
          }}
        >
          <AlertDialogContent className="app-dialog">
            <AlertDialogTitle>确认这段记录完整？</AlertDialogTitle>
            <AlertDialogDescription>
              {confirm?.start} 至 {confirm?.end}
              。已有饮用记录的日期将标记完整，没有记录的日期将明确标记为未饮酒。请确认没有遗漏。
            </AlertDialogDescription>
            <AlertDialogCancel>暂不确认</AlertDialogCancel>
            <AlertDialogAction
              className="gold-button"
              onClick={() => {
                if (
                  confirm &&
                  act(
                    (d) => confirmRange(d, confirm.start, confirm.end),
                    '这段日期已确认完整',
                  )
                )
                  setConfirm(null);
              }}
            >
              确认没有遗漏
            </AlertDialogAction>
          </AlertDialogContent>
        </AlertDialog>
      </main>
    </Toaster>
  );
}
