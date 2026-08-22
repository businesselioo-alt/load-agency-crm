import { supabase } from './supabase';

// ─── Models ───────────────────────────────────────────────────────────────────

/**
 * Les créatrices OnlyFans, sous le nom de leur fiche.
 *
 * Cette liste servait de filtre : toute ligne dont le nom n'y figurait pas
 * était écartée sans un mot. Elle ne contenait que sept surnoms hérités, si
 * bien qu'une créatrice ajoutée au CRM restait invisible du dashboard sans
 * qu'aucune erreur ne le signale.
 *
 * Elle n'a plus qu'un rôle d'amorce : afficher une créatrice connue même
 * quand elle n'a encore aucune donnée. Le chargement, lui, ne jette plus rien.
 */
export const OF_MODELS  = [
  'Charlotte Grace Mcknight',
  'Emily Georgia Bourne',
  'Isabelle Marie Martin',
  'Kenzi Rex',
  'Lucy Bennett',
  'Kazia Simpson',
  'Imogen Grace Margaret Bushby',
  'Annie Broadbent',
  'Katie Lynn Schafer',
  'Lucie Jaid McConnell',
  'Clara',
];
export const MYM_MODELS = [
  'Lenajns', 'Manonvpa', 'Paulineqrt', 'Julievivi', 'Aliceqsd', 'Sarahjea',
  'Eloisetms', 'Chloebleue', 'Eliseroee', 'Loujtf', 'Milavpy', 'Emmacuty',
  'Lorienmp', 'Edenlou', 'Elodie', 'Chloelpm', 'Jeannebourgot', 'Ineshrg',
  'Violettehns', 'Lounarvp', 'Naiakds', 'Coletteflm',
];

/**
 * Le pseudo OnlyFans de chaque créatrice, indexé par le nom de sa fiche.
 *
 * Les données sont stockées sous le nom civil — c'est lui qui relie le chiffre
 * d'affaires, la facturation et l'identité Infloww. Mais à l'écran, le pseudo
 * est ce qu'on reconnaît d'un coup d'œil. On affiche donc l'un et on continue
 * de calculer sur l'autre.
 *
 * Une créatrice sans pseudo renseigné garde son nom : mieux vaut un nom civil
 * qu'une ligne vide.
 */
export async function loadOfUsernames(): Promise<Record<string, string>> {
  const out: Record<string, string> = {};
  try {
    const [{ data: models }, { data: billing }] = await Promise.all([
      supabase.from('crm_models').select('id, name'),
      supabase.from('crm_model_billing').select('model_id, usernames'),
    ]);

    const byId = new Map<string, string>();
    (billing ?? []).forEach((b) => {
      const u = b.usernames as Record<string, string> | null;
      const of = (u?.OF ?? '').trim();
      if (of) byId.set(b.model_id as string, of);
    });

    (models ?? []).forEach((m) => {
      const name = String(m.name ?? '').trim();
      const of = byId.get(m.id as string);
      if (name && of) out[name] = of;
    });
  } catch {
    // Sans correspondance, l'écran retombe sur les noms de fiches.
  }
  return out;
}

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

  // Une ligne dont le nom n'est pas dans la liste d'amorce est accueillie, pas
  // jetée. C'est ce `if` manquant qui a vidé le dashboard après un renommage :
  // les données étaient intactes en base, simplement filtrées à l'affichage, et
  // rien ne le disait. Une créatrice inconnue de la liste vaut toujours mieux
  // qu'un écran vide.
  (statsRes.data ?? []).forEach((row) => {
    const m = row.model_name as string;
    if (!m) return;
    if (!result[m]) result[m] = emptyModel();
    result[m].totalSubs = row.total_subs as number;
    result[m].subsLast30Days = row.subs_last_30_days as number;
  });

  (entriesRes.data ?? []).forEach((row) => {
    const m = row.model_name as string;
    if (!m) return;
    if (!result[m]) result[m] = emptyModel();
    result[m].entries.push({
      id: row.id as string,
      date: row.date as string,
      newSubs: row.new_subs as number,
      revenue: row.revenue as number,
      note: row.note as string,
    });
  });

  return result;
}

export async function savePlatformData(
  platform: VGPlatform,
  data: PlatformData,
): Promise<{ success: boolean; error?: string }> {
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

  // Stats upsert first — this is the one most likely to fail due to missing RLS policy
  const statsRes = await supabase
    .from('vg_model_stats')
    .upsert(statsRows, { onConflict: 'platform,model_name' });

  if (statsRes.error) {
    console.error('[savePlatformData] vg_model_stats upsert failed:',
      statsRes.error.code, statsRes.error.message,
      statsRes.error.hint ?? '', statsRes.error.details ?? '');
    return { success: false, error: `vg_model_stats (${statsRes.error.code}): ${statsRes.error.message}` };
  }

  if (entryRows.length > 0) {
    const entriesRes = await supabase
      .from('vg_daily_entries')
      .upsert(entryRows, { onConflict: 'platform,model_name,date' });

    if (entriesRes.error) {
      console.error('[savePlatformData] vg_daily_entries upsert failed:',
        entriesRes.error.code, entriesRes.error.message,
        entriesRes.error.hint ?? '', entriesRes.error.details ?? '');
      return { success: false, error: `vg_daily_entries (${entriesRes.error.code}): ${entriesRes.error.message}` };
    }
  }

  return { success: true };
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
