import { supabase } from './supabase';

export type PlanningModel = string;

export type SlotStatus = 'programmé' | 'en_attente' | 'annulé';

export interface SFSPlanningSlot {
  id: string;
  modelName: PlanningModel;
  date: string;   // YYYY-MM-DD
  time?: string;  // HH:MM
  partnerAgency: string;
  partnerModel: string;
  status: SlotStatus;
  createdAt: string;
}

export interface CustomModel {
  name: string;
  color: string; // hex, e.g. '#a855f7'
}

export const STATUS_CONFIG: Record<
  SlotStatus,
  { emoji: string; label: string; bg: string; text: string; border: string; ring: string }
> = {
  programmé: {
    emoji: '✅',
    label: 'Programmé',
    bg: 'bg-green-50',
    text: 'text-green-700',
    border: 'border-green-200',
    ring: 'ring-green-300',
  },
  en_attente: {
    emoji: '⏳',
    label: 'En attente',
    bg: 'bg-amber-50',
    text: 'text-amber-700',
    border: 'border-amber-200',
    ring: 'ring-amber-300',
  },
  annulé: {
    emoji: '❌',
    label: 'Annulé',
    bg: 'bg-red-50',
    text: 'text-red-600',
    border: 'border-red-200',
    ring: 'ring-red-300',
  },
};

// Palette proposée dans le formulaire d'ajout
export const COLOR_PALETTE = [
  '#a855f7', // violet (défaut)
  '#ec4899', // pink
  '#3b82f6', // blue
  '#10b981', // emerald
  '#f97316', // orange
  '#f43f5e', // rose
  '#6366f1', // indigo
  '#f59e0b', // amber
  '#14b8a6', // teal
  '#84cc16', // lime
];

export const DEFAULT_MODELS: CustomModel[] = [
  { name: 'Lou',    color: '#a855f7' },
  { name: 'Margot', color: '#ec4899' },
  { name: 'Jeanne', color: '#3b82f6' },
  { name: 'Lucie',  color: '#10b981' },
  { name: 'Lorie',  color: '#f97316' },
  { name: 'Élodie', color: '#f43f5e' },
  { name: 'Lilou',  color: '#6366f1' },
];

// ── Supabase-backed helpers (platform-based) ────────────────────────────────

export async function loadSlotsFromKey(platform: string): Promise<SFSPlanningSlot[]> {
  const { data } = await supabase
    .from('sfs_planning_slots')
    .select('*')
    .eq('platform', platform)
    .order('date');
  return (data ?? []).map((row) => ({
    id:            row.id as string,
    modelName:     row.model_name as string,
    date:          row.date as string,
    time:          row.time as string | undefined,
    partnerAgency: row.partner_agency as string,
    partnerModel:  row.partner_model as string,
    status:        row.status as SlotStatus,
    createdAt:     row.created_at as string,
  }));
}

export async function saveSlotsToKey(platform: string, slots: SFSPlanningSlot[]): Promise<void> {
  // Delete all slots for this platform then re-insert
  await supabase.from('sfs_planning_slots').delete().eq('platform', platform);
  if (slots.length > 0) {
    await supabase.from('sfs_planning_slots').insert(slots.map((s) => ({
      id:             s.id,
      platform,
      model_name:     s.modelName,
      date:           s.date,
      time:           s.time,
      partner_agency: s.partnerAgency,
      partner_model:  s.partnerModel,
      status:         s.status,
      created_at:     s.createdAt,
    })));
  }
}

export async function loadModelsFromKey(platform: string, defaults: CustomModel[]): Promise<CustomModel[]> {
  const { data } = await supabase
    .from('sfs_planning_models')
    .select('*')
    .eq('platform', platform)
    .order('sort_order');
  if (!data || data.length === 0) return defaults;
  return data.map((row) => ({ name: row.name as string, color: row.color as string }));
}

export async function saveModelsToKey(platform: string, models: CustomModel[]): Promise<void> {
  await supabase.from('sfs_planning_models').delete().eq('platform', platform);
  if (models.length > 0) {
    await supabase.from('sfs_planning_models').insert(
      models.map((m, i) => ({ platform, name: m.name, color: m.color, sort_order: i }))
    );
  }
}

// Aliases for backward compat
export const loadSlots = () => loadSlotsFromKey('of');
export const saveSlots = (slots: SFSPlanningSlot[]) => saveSlotsToKey('of', slots);
export const loadModels = () => loadModelsFromKey('of', DEFAULT_MODELS);
export const saveModels = (models: CustomModel[]) => saveModelsToKey('of', models);

// Keep these for any code that still references them
export const LS_KEY = 'crm_planning_sfs_v2';
export const MODELS_LS_KEY = 'crm_planning_models_v1';
export const INITIAL_SLOTS: SFSPlanningSlot[] = [];
