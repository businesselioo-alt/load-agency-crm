import { supabase } from './supabase';

export type Platform = 'MYM' | 'OF' | 'Reveal';
export type ModelStatus = 'active' | 'inactive' | 'suspended';
export type ContentStatus = 'fait' | 'manquant' | 'en_retard';
export type Currency = 'EUR' | 'GBP' | 'USD';
export type UserRole = 'admin' | 'model' | 'manager' | 'chatter' | 'compta' | 'marketing';

export interface Model {
  id: string;
  name: string;
  pseudo: string;
  platforms: Platform[];
  username: string;
  manager: string;
  commission: number;
  status: ModelStatus;
  driveLink?: string;
  notionLink?: string;
  avatar?: string;
}

export interface ContentTracking {
  modelId: string;
  week: string;
  photos: ContentStatus;
  videos: ContentStatus;
  stories: ContentStatus;
  reels: ContentStatus;
}

export interface Invoice {
  id: string;
  modelId: string;
  amount: number;
  platform: Platform;
  currency: Currency;
  date: string;
  notes?: string;
  period: string;
}

export interface ScheduleEntry {
  id: string;
  modelId: string;
  date: string;
  title: string;
  description?: string;
  platform: Platform;
  type: 'post' | 'live' | 'story' | 'announcement';
}

export interface AuthUser {
  id: string;
  username: string;
  password: string;
  name: string;
  role: UserRole;
  modelId?: string;
}

export const DEMO_USERS: AuthUser[] = [
  { id: 'u1', username: 'admin', password: 'admin123', name: 'Admin', role: 'admin' },
  { id: 'u2', username: 'sadie', password: 'sadie123', name: 'Sadie', role: 'manager' },
  { id: 'u3', username: 'kate', password: 'kate123', name: 'Kate', role: 'manager' },
  { id: 'u4', username: 'charlotte', password: 'model123', name: 'Charlotte Grace', role: 'model', modelId: 'm1' },
  { id: 'u5', username: 'chatter', password: 'chatter123', name: 'Chatter 1', role: 'chatter' },
  { id: 'u6', username: 'compta', password: 'compta123', name: 'Comptable', role: 'compta' },
  { id: 'u7', username: 'marketing', password: 'mkt123', name: 'Marketing', role: 'marketing' },
];

export const MODELS: Model[] = [
  {
    id: 'm1',
    name: 'Charlotte Grace',
    pseudo: 'loujtf',
    platforms: ['MYM', 'OF'],
    username: 'charlottegrace',
    manager: 'Sadie',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm2',
    name: 'Maisie H. Ward',
    pseudo: 'miapka',
    platforms: ['MYM'],
    username: 'maisiehward',
    manager: 'Sadie',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm3',
    name: 'Katy Blackham',
    pseudo: 'eloisetms',
    platforms: ['MYM'],
    username: 'katyblackham',
    manager: 'Sadie',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm4',
    name: 'Tiahne Davis',
    pseudo: 'sarahjea',
    platforms: ['MYM', 'Reveal'],
    username: 'tiahnedavis',
    manager: 'Kate',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm5',
    name: 'Kiara Sanders',
    pseudo: 'chloebleue',
    platforms: ['MYM', 'OF'],
    username: 'kiarasanders',
    manager: 'Kate',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm6',
    name: 'Jazz',
    pseudo: 'lenajns',
    platforms: ['MYM'],
    username: 'jazz',
    manager: 'Sadie',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
  {
    id: 'm7',
    name: 'Georgia',
    pseudo: 'manonvpa',
    platforms: ['MYM'],
    username: 'georgia',
    manager: 'Sadie',
    commission: 20,
    status: 'active',
    driveLink: 'https://drive.google.com',
    notionLink: 'https://notion.so',
  },
];

export const CONTENT_TRACKING: ContentTracking[] = [
  { modelId: 'm1', week: '2026-W23', photos: 'fait', videos: 'fait', stories: 'en_retard', reels: 'fait' },
  { modelId: 'm2', week: '2026-W23', photos: 'fait', videos: 'manquant', stories: 'fait', reels: 'manquant' },
  { modelId: 'm3', week: '2026-W23', photos: 'en_retard', videos: 'fait', stories: 'fait', reels: 'fait' },
  { modelId: 'm4', week: '2026-W23', photos: 'fait', videos: 'fait', stories: 'fait', reels: 'fait' },
  { modelId: 'm5', week: '2026-W23', photos: 'manquant', videos: 'manquant', stories: 'fait', reels: 'en_retard' },
  { modelId: 'm6', week: '2026-W23', photos: 'fait', videos: 'fait', stories: 'fait', reels: 'fait' },
  { modelId: 'm7', week: '2026-W23', photos: 'fait', videos: 'en_retard', stories: 'manquant', reels: 'fait' },
];

export const INVOICES: Invoice[] = [
  { id: 'inv1', modelId: 'm1', amount: 3200, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv2', modelId: 'm1', amount: 1800, platform: 'OF', currency: 'GBP', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv3', modelId: 'm2', amount: 2400, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv4', modelId: 'm3', amount: 1900, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv5', modelId: 'm4', amount: 2100, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv6', modelId: 'm4', amount: 950, platform: 'Reveal', currency: 'USD', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv7', modelId: 'm5', amount: 2800, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv8', modelId: 'm5', amount: 1500, platform: 'OF', currency: 'GBP', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv9', modelId: 'm6', amount: 1600, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
  { id: 'inv10', modelId: 'm7', amount: 1750, platform: 'MYM', currency: 'EUR', date: '2026-05-31', period: 'Mai 2026' },
];

export const SCHEDULE: ScheduleEntry[] = [
  { id: 's1', modelId: 'm1', date: '2026-06-12', title: 'Shooting photos', description: 'Session shooting studio', platform: 'MYM', type: 'post' },
  { id: 's2', modelId: 'm2', date: '2026-06-13', title: 'Live session', description: 'Live Q&A avec fans', platform: 'MYM', type: 'live' },
  { id: 's3', modelId: 'm4', date: '2026-06-14', title: 'Reveal exclusive', description: 'Contenu exclusif Reveal', platform: 'Reveal', type: 'announcement' },
  { id: 's4', modelId: 'm5', date: '2026-06-15', title: 'OF update', description: 'Nouveau contenu OF', platform: 'OF', type: 'post' },
  { id: 's5', modelId: 'm3', date: '2026-06-16', title: 'MYM story', description: 'Story engagement', platform: 'MYM', type: 'story' },
  { id: 's6', modelId: 'm6', date: '2026-06-17', title: 'Annonce spéciale', description: 'Collaboration annonce', platform: 'MYM', type: 'announcement' },
  { id: 's7', modelId: 'm7', date: '2026-06-18', title: 'Reels créatifs', description: 'Contenu créatif', platform: 'MYM', type: 'post' },
  { id: 's8', modelId: 'm1', date: '2026-06-19', title: 'OF Exclusive', description: 'Contenu premium', platform: 'OF', type: 'post' },
  { id: 's9', modelId: 'm4', date: '2026-06-20', title: 'Live Reveal', description: 'Session live', platform: 'Reveal', type: 'live' },
];

export const PLATFORM_COLORS: Record<Platform, string> = {
  MYM: 'bg-purple-100 text-purple-700',
  OF: 'bg-blue-100 text-blue-700',
  Reveal: 'bg-emerald-100 text-emerald-700',
};

export const STATUS_COLORS: Record<ModelStatus, string> = {
  active: 'bg-green-100 text-green-700',
  inactive: 'bg-gray-100 text-gray-600',
  suspended: 'bg-red-100 text-red-700',
};

export const CONTENT_STATUS_COLORS: Record<ContentStatus, string> = {
  fait: 'bg-green-100 text-green-700',
  manquant: 'bg-red-100 text-red-700',
  en_retard: 'bg-orange-100 text-orange-700',
};

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  model: 'Model',
  manager: 'Manager',
  chatter: 'Chatter',
  compta: 'Comptable',
  marketing: 'Marketing',
};

// ─── Supabase persistence ─────────────────────────────────────────────────────

export async function loadModels(): Promise<Model[]> {
  const { data } = await supabase.from('crm_models').select('*').order('sort_order');
  if (!data || data.length === 0) return MODELS;
  return data.map((row) => ({
    id:          row.id as string,
    name:        row.name as string,
    pseudo:      row.pseudo as string,
    platforms:   row.platforms as Platform[],
    username:    row.username as string,
    manager:     row.manager as string,
    commission:  row.commission as number,
    status:      row.status as ModelStatus,
    driveLink:   row.drive_link as string | undefined,
    notionLink:  row.notion_link as string | undefined,
    avatar:      row.avatar as string | undefined,
  }));
}

export async function loadInvoices(): Promise<Invoice[]> {
  const { data } = await supabase.from('crm_invoices').select('*').order('date', { ascending: false });
  if (!data || data.length === 0) return INVOICES;
  return data.map((row) => ({
    id:       row.id as string,
    modelId:  row.model_id as string,
    amount:   row.amount as number,
    platform: row.platform as Platform,
    currency: row.currency as Currency,
    date:     row.date as string,
    notes:    row.notes as string | undefined,
    period:   row.period as string,
  }));
}

export async function loadContentTracking(): Promise<ContentTracking[]> {
  const { data } = await supabase.from('crm_content_tracking').select('*');
  if (!data || data.length === 0) return CONTENT_TRACKING;
  return data.map((row) => ({
    modelId: row.model_id as string,
    week:    row.week as string,
    photos:  row.photos as ContentStatus,
    videos:  row.videos as ContentStatus,
    stories: row.stories as ContentStatus,
    reels:   row.reels as ContentStatus,
  }));
}

export async function saveContentTracking(ct: ContentTracking): Promise<void> {
  await supabase.from('crm_content_tracking').upsert({
    model_id: ct.modelId, week: ct.week,
    photos: ct.photos, videos: ct.videos, stories: ct.stories, reels: ct.reels,
  }, { onConflict: 'model_id,week' });
}
