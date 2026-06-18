import { supabase } from './supabase';

// ─── Models ───────────────────────────────────────────────────────────────────

export const OF_MODELS  = ['Lou', 'Margot', 'Jeanne', 'Lucie', 'Lorie', 'Élodie', 'Lilou'];
export const MYM_MODELS = [
  'Lenajns', 'Manonvpa', 'Paulineqrt', 'Julievivi', 'Aliceqsd', 'Sarahjea',
  'Eloisetms', 'Chloebleue', 'Eliseroee', 'Loujtf', 'Milavpy', 'Emmacuty',
  'Lorienmp', 'Edenlou', 'Elodie', 'Chloelpm', 'Jeannebourgot', 'Ineshrg',
  'Violettehns', 'Lounarvp', 'Naiakds', 'Coletteflm',
];

// ─── Types ────────────────────────────────────────────────────────────────────

export interface DailyEntry {
  id: string;
  date: string;    // YYYY-MM-DD
  newSubs: number;
  revenue: number; // €
  note: string;
}

export interface ModelStats {
  totalSubs: number;
  subsLast30Days: number;
  entries: DailyEntry[];
}

export type PlatformData = Record<string, ModelStats>;

// ─── Storage ──────────────────────────────────────────────────────────────────

export type VGPlatform = 'of' | 'mym';

function emptyModel(): ModelStats {
  return { totalSubs: 0, subsLast30Days: 0, entries: [] };
}

export async function loadPlatformData(platform: VGPlatform, models: string[]): Promise<PlatformData> {
  const [statsRes, entriesRes] = await Promise.all([
    supabase.from('vg_model_stats').select('*').eq('platform', platform),
    supabase.from('vg_daily_entries').select('*').eq('platform', platform),
  ]);

  const result: PlatformData = {};
  models.forEach((m) => { result[m] = emptyModel(); });

  (statsRes.data ?? []).forEach((row) => {
    const m = row.model_name as string;
    if (result[m]) {
      result[m].totalSubs = row.total_subs as number;
      result[m].subsLast30Days = row.subs_last_30_days as number;
    }
  });

  (entriesRes.data ?? []).forEach((row) => {
    const m = row.model_name as string;
    if (result[m]) {
      result[m].entries.push({
        id: row.id as string,
        date: row.date as string,
        newSubs: row.new_subs as number,
        revenue: row.revenue as number,
        note: row.note as string,
      });
    }
  });

  return result;
}

export async function savePlatformData(platform: VGPlatform, data: PlatformData): Promise<void> {
  const statsRows = Object.entries(data).map(([modelName, stats]) => ({
    platform,
    model_name: modelName,
    total_subs: stats.totalSubs,
    subs_last_30_days: stats.subsLast30Days,
    updated_at: new Date().toISOString(),
  }));

  const entryRows = Object.entries(data).flatMap(([modelName, stats]) =>
    stats.entries.map((e) => ({
      id: e.id,
      platform,
      model_name: modelName,
      date: e.date,
      new_subs: e.newSubs,
      revenue: e.revenue,
      note: e.note,
    }))
  );

  await Promise.all([
    supabase.from('vg_model_stats').upsert(statsRows, { onConflict: 'platform,model_name' }),
    supabase.from('vg_daily_entries').upsert(entryRows, { onConflict: 'platform,model_name,date' }),
  ]);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function fmtDate(d: Date): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
export function todayStr()     { return fmtDate(new Date()); }
export function yesterdayStr() { const d = new Date(); d.setDate(d.getDate() - 1); return fmtDate(d); }
export function weekStartStr() {
  const d = new Date();
  d.setDate(d.getDate() - (d.getDay() === 0 ? 6 : d.getDay() - 1));
  return fmtDate(d);
}
export function monthStartStr() {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-01`;
}

// ─── Metrics ──────────────────────────────────────────────────────────────────

export interface PerfMetrics {
  caToday:       number;
  caYesterday:   number;
  caWeek:        number;
  caMonth:       number;
  subsToday:     number;
  subsYesterday: number;
  subsWeek:      number;
  subsMonth:     number;
}

export function calcMetrics(entries: DailyEntry[]): PerfMetrics {
  const today = todayStr(); const yesterday = yesterdayStr();
  const weekStart = weekStartStr(); const monthStart = monthStartStr();
  const sumCA   = (f: (e: DailyEntry) => boolean) => entries.filter(f).reduce((a, e) => a + e.revenue, 0);
  const sumSubs = (f: (e: DailyEntry) => boolean) => entries.filter(f).reduce((a, e) => a + e.newSubs, 0);
  return {
    caToday:       sumCA((e)   => e.date === today),
    caYesterday:   sumCA((e)   => e.date === yesterday),
    caWeek:        sumCA((e)   => e.date >= weekStart && e.date <= today),
    caMonth:       sumCA((e)   => e.date >= monthStart && e.date <= today),
    subsToday:     sumSubs((e) => e.date === today),
    subsYesterday: sumSubs((e) => e.date === yesterday),
    subsWeek:      sumSubs((e) => e.date >= weekStart && e.date <= today),
    subsMonth:     sumSubs((e) => e.date >= monthStart && e.date <= today),
  };
}

export interface ConsolidatedMetrics extends PerfMetrics {
  totalSubs: number;
  subsLast30Days: number;
}

export function calcConsolidated(data: PlatformData): ConsolidatedMetrics {
  const allEntries = Object.values(data).flatMap((m) => m.entries);
  return {
    ...calcMetrics(allEntries),
    totalSubs:      Object.values(data).reduce((s, m) => s + m.totalSubs, 0),
    subsLast30Days: Object.values(data).reduce((s, m) => s + m.subsLast30Days, 0),
  };
}

// ─── Chart ────────────────────────────────────────────────────────────────────

export interface ChartPoint { day: number; value: number }

export function getMonthChartData(entries: DailyEntry[]): ChartPoint[] {
  const now = new Date();
  const year = now.getFullYear(); const month = now.getMonth(); const today = now.getDate();
  return Array.from({ length: today }, (_, i) => {
    const day = i + 1;
    const dk = `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;
    return { day, value: entries.filter((e) => e.date === dk).reduce((a, e) => a + e.revenue, 0) };
  });
}

export function getConsolidatedChartData(data: PlatformData): ChartPoint[] {
  return getMonthChartData(Object.values(data).flatMap((m) => m.entries));
}
