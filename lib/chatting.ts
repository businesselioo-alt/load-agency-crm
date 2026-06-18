import { supabase } from './supabase';
import {
  OF_MODELS, MYM_MODELS,
  todayStr, yesterdayStr, weekStartStr, monthStartStr,
} from './performance-data';

export type ChattingPlatform = 'of' | 'mym';
export type ShiftKey = 'night' | 'morning' | 'afternoon' | 'evening';

export { OF_MODELS, MYM_MODELS };

export const CHAT_MODELS: Record<ChattingPlatform, string[]> = { of: OF_MODELS, mym: MYM_MODELS };

export interface ShiftConfig {
  key: ShiftKey;
  label: string;
  short: string;
  hours: string;
  color: string;
  bg: string;
  border: string;
}

export const SHIFTS: ShiftConfig[] = [
  { key: 'night',     label: 'Nuit',       short: 'N',  hours: '2h–5h',   color: '#93c5fd', bg: 'rgba(30,64,175,0.2)',  border: 'rgba(147,197,253,0.2)' },
  { key: 'morning',   label: 'Matin',      short: 'M',  hours: '5h–12h',  color: '#fcd34d', bg: 'rgba(146,64,14,0.2)',  border: 'rgba(252,211,77,0.2)' },
  { key: 'afternoon', label: 'Après-midi', short: 'AM', hours: '12h–19h', color: '#86efac', bg: 'rgba(21,128,61,0.2)',  border: 'rgba(134,239,172,0.2)' },
  { key: 'evening',   label: 'Soir',       short: 'S',  hours: '19h–2h',  color: '#c4b5fd', bg: 'rgba(91,33,182,0.2)', border: 'rgba(196,181,253,0.2)' },
];

export const SHIFT_MAP = Object.fromEntries(SHIFTS.map((s) => [s.key, s])) as Record<ShiftKey, ShiftConfig>;

// date -> model -> shift -> userId | null
export type WeekPlan = Record<string, Record<string, Partial<Record<ShiftKey, string | null>>>>;

export interface ShiftRecap {
  id: string;
  date: string;
  model: string;
  shift: ShiftKey;
  platform: ChattingPlatform;
  chatterId: string;
  chatterName: string;
  caNet: number;
  messages: number;
  note: string;
  submittedAt: string;
}

// ─── Supabase persistence ─────────────────────────────────────────────────────

export async function loadPlan(p: ChattingPlatform): Promise<WeekPlan> {
  const { data } = await supabase
    .from('chat_shift_plans')
    .select('*')
    .eq('platform', p);

  const plan: WeekPlan = {};
  (data ?? []).forEach((row) => {
    const d = row.date as string;
    const m = row.model_name as string;
    const s = row.shift as ShiftKey;
    if (!plan[d]) plan[d] = {};
    if (!plan[d][m]) plan[d][m] = {};
    plan[d][m][s] = row.chatter_id as string | null;
  });
  return plan;
}

export async function savePlanSlot(
  p: ChattingPlatform, date: string, model: string, shift: ShiftKey, chatterId: string | null
): Promise<void> {
  if (chatterId === null) {
    await supabase.from('chat_shift_plans')
      .delete()
      .eq('platform', p).eq('date', date).eq('model_name', model).eq('shift', shift);
  } else {
    await supabase.from('chat_shift_plans').upsert({
      platform: p, date, model_name: model, shift, chatter_id: chatterId,
    }, { onConflict: 'platform,date,model_name,shift' });
  }
}

// Keep savePlan for bulk operations (e.g. initial migration)
export async function savePlan(p: ChattingPlatform, plan: WeekPlan): Promise<void> {
  const rows: Array<{ platform: string; date: string; model_name: string; shift: string; chatter_id: string | null }> = [];
  Object.entries(plan).forEach(([date, models]) => {
    Object.entries(models).forEach(([model, shifts]) => {
      if (!shifts) return;
      Object.entries(shifts).forEach(([shift, chatterId]) => {
        if (chatterId !== undefined) {
          rows.push({ platform: p, date, model_name: model, shift, chatter_id: chatterId });
        }
      });
    });
  });
  if (rows.length > 0) {
    await supabase.from('chat_shift_plans').upsert(rows, { onConflict: 'platform,date,model_name,shift' });
  }
}

export async function loadRecaps(): Promise<ShiftRecap[]> {
  const { data } = await supabase.from('chat_recaps').select('*').order('date', { ascending: false });
  return (data ?? []).map((row) => ({
    id:          row.id as string,
    date:        row.date as string,
    model:       row.model_name as string,
    shift:       row.shift as ShiftKey,
    platform:    row.platform as ChattingPlatform,
    chatterId:   row.chatter_id as string,
    chatterName: row.chatter_name as string,
    caNet:       row.ca_net as number,
    messages:    row.messages as number,
    note:        row.note as string,
    submittedAt: row.submitted_at as string,
  }));
}

export async function saveRecap(recap: ShiftRecap): Promise<void> {
  await supabase.from('chat_recaps').upsert({
    id: recap.id, date: recap.date, model_name: recap.model,
    shift: recap.shift, platform: recap.platform,
    chatter_id: recap.chatterId, chatter_name: recap.chatterName,
    ca_net: recap.caNet, messages: recap.messages,
    note: recap.note, submitted_at: recap.submittedAt,
  });
}

// Keep saveRecaps for compatibility
export async function saveRecaps(recaps: ShiftRecap[]): Promise<void> {
  if (recaps.length === 0) return;
  const rows = recaps.map((r) => ({
    id: r.id, date: r.date, model_name: r.model,
    shift: r.shift, platform: r.platform,
    chatter_id: r.chatterId, chatter_name: r.chatterName,
    ca_net: r.caNet, messages: r.messages,
    note: r.note, submitted_at: r.submittedAt,
  }));
  await supabase.from('chat_recaps').upsert(rows);
}

// ─── Date helpers ─────────────────────────────────────────────────────────────

export function getWeekDates(anchor = todayStr()): string[] {
  const d = new Date(anchor + 'T12:00:00');
  const dow = d.getDay();
  const mon = new Date(d);
  mon.setDate(d.getDate() - (dow === 0 ? 6 : dow - 1));
  return Array.from({ length: 7 }, (_, i) => {
    const dd = new Date(mon);
    dd.setDate(mon.getDate() + i);
    return dd.toISOString().slice(0, 10);
  });
}

export function addWeeks(dateStr: string, n: number): string {
  const d = new Date(dateStr + 'T12:00:00');
  d.setDate(d.getDate() + n * 7);
  return d.toISOString().slice(0, 10);
}

export function fmtWeekRange(dates: string[]): string {
  const first = new Date(dates[0] + 'T12:00:00');
  const last  = new Date(dates[6] + 'T12:00:00');
  return `${first.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })} – ${last.toLocaleDateString('fr-FR', { day: 'numeric', month: 'short', year: 'numeric' })}`;
}

export function fmtDayCol(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric' });
}

export function fmtDayFull(dateStr: string): string {
  const d = new Date(dateStr + 'T12:00:00');
  return d.toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long' });
}

export { todayStr };

// ─── CA metrics ───────────────────────────────────────────────────────────────

export interface ModelCAMetrics {
  caToday: number; caYesterday: number; caWeek: number; caMonth: number;
}

const ZERO: ModelCAMetrics = { caToday: 0, caYesterday: 0, caWeek: 0, caMonth: 0 };

export function calcModelCA(recaps: ShiftRecap[], model: string, platform: ChattingPlatform): ModelCAMetrics {
  const r = recaps.filter((x) => x.model === model && x.platform === platform);
  const t = todayStr(); const y = yesterdayStr(); const ws = weekStartStr(); const ms = monthStartStr();
  return {
    caToday:     r.filter((x) => x.date === t).reduce((s, x) => s + x.caNet, 0),
    caYesterday: r.filter((x) => x.date === y).reduce((s, x) => s + x.caNet, 0),
    caWeek:      r.filter((x) => x.date >= ws && x.date <= t).reduce((s, x) => s + x.caNet, 0),
    caMonth:     r.filter((x) => x.date >= ms && x.date <= t).reduce((s, x) => s + x.caNet, 0),
  };
}

export function calcPlatformCA(recaps: ShiftRecap[], models: string[], platform: ChattingPlatform): ModelCAMetrics {
  return models.reduce(
    (acc, m) => {
      const c = calcModelCA(recaps, m, platform);
      return { caToday: acc.caToday + c.caToday, caYesterday: acc.caYesterday + c.caYesterday, caWeek: acc.caWeek + c.caWeek, caMonth: acc.caMonth + c.caMonth };
    },
    { ...ZERO },
  );
}

export function uid(): string { return Math.random().toString(36).slice(2); }

// ─── Chatter profiles (planning-specific, separate from CRM users) ────────────

export interface ChatterProfile {
  id: string;
  name: string;
  platforms: ChattingPlatform[];
  status: 'active' | 'inactive';
}

const DEFAULT_CHATTERS: ChatterProfile[] = [
  { id: 'cp-marc', name: 'Marc', platforms: ['of', 'mym'], status: 'active' },
  { id: 'cp-fana', name: 'Fana', platforms: ['of', 'mym'], status: 'active' },
];

export async function loadChatters(): Promise<ChatterProfile[]> {
  const { data } = await supabase.from('chat_chatters').select('*');
  if (!data || data.length === 0) return DEFAULT_CHATTERS;
  return data.map((row) => ({
    id:        row.id as string,
    name:      row.name as string,
    platforms: row.platforms as ChattingPlatform[],
    status:    row.status as 'active' | 'inactive',
  }));
}

export async function saveChatters(chatters: ChatterProfile[]): Promise<void> {
  // Delete all and re-insert for simplicity
  await supabase.from('chat_chatters').delete().neq('id', '___never___');
  if (chatters.length > 0) {
    await supabase.from('chat_chatters').insert(chatters.map((c) => ({
      id: c.id, name: c.name, platforms: c.platforms, status: c.status,
    })));
  }
}

export async function saveChatter(c: ChatterProfile): Promise<void> {
  await supabase.from('chat_chatters').upsert({ id: c.id, name: c.name, platforms: c.platforms, status: c.status });
}

export async function deleteChatter(id: string): Promise<void> {
  await supabase.from('chat_chatters').delete().eq('id', id);
}

export async function loadPlanModels(p: ChattingPlatform): Promise<string[]> {
  const { data } = await supabase
    .from('chat_plan_models')
    .select('name')
    .eq('platform', p)
    .order('sort_order');
  if (!data || data.length === 0) return CHAT_MODELS[p];
  return data.map((r) => r.name as string);
}

export async function savePlanModels(p: ChattingPlatform, models: string[]): Promise<void> {
  await supabase.from('chat_plan_models').delete().eq('platform', p);
  if (models.length > 0) {
    await supabase.from('chat_plan_models').insert(
      models.map((name, i) => ({ platform: p, name, sort_order: i }))
    );
  }
}
