import { supabase } from './supabase';

export type UserRole = 'admin' | 'manager' | 'chatter' | 'compta' | 'marketing' | 'model';

export type ModuleKey =
  | 'dashboard'
  | 'models'
  | 'invoices'
  | 'marketing_mym'
  | 'marketing_of'
  | 'chatting'
  | 'calendar'
  | 'settings';

export interface CRMUser {
  id: string;
  firstName: string;
  lastName: string;
  name: string; // computed: firstName + ' ' + lastName
  email: string;
  password: string;
  role: UserRole;
  modules: ModuleKey[];
  status: 'active' | 'inactive';
  createdAt: string;
}

export const ROLE_LABELS: Record<UserRole, string> = {
  admin: 'Admin',
  manager: 'Manager',
  chatter: 'Chatter',
  compta: 'Comptable',
  marketing: 'Marketing',
  model: 'Model',
};

export const ROLE_COLORS: Record<UserRole, { bg: string; text: string; border: string }> = {
  admin:     { bg: 'bg-[#a855f7]/10', text: 'text-[#a855f7]',  border: 'border-[#a855f7]/20' },
  manager:   { bg: 'bg-blue-50',      text: 'text-blue-600',   border: 'border-blue-200' },
  chatter:   { bg: 'bg-emerald-50',   text: 'text-emerald-600',border: 'border-emerald-200' },
  compta:    { bg: 'bg-orange-50',    text: 'text-orange-600', border: 'border-orange-200' },
  marketing: { bg: 'bg-pink-50',      text: 'text-pink-600',   border: 'border-pink-200' },
  model:     { bg: 'bg-indigo-50',    text: 'text-indigo-600', border: 'border-indigo-200' },
};

export const MODULE_CONFIG: { key: ModuleKey; label: string; group?: string }[] = [
  { key: 'dashboard',      label: 'Dashboard' },
  { key: 'models',         label: 'Models' },
  { key: 'invoices',       label: 'Invoices' },
  { key: 'marketing_mym',  label: 'Marketing SFS MYM',  group: 'Marketing' },
  { key: 'marketing_of',   label: 'Marketing SFS OF',   group: 'Marketing' },
  { key: 'chatting',       label: 'Chatting' },
  { key: 'calendar',       label: 'Calendrier' },
  { key: 'settings',       label: 'Paramètres' },
];

export const ROLE_DEFAULT_MODULES: Record<UserRole, ModuleKey[]> = {
  admin:     ['dashboard', 'models', 'invoices', 'marketing_mym', 'marketing_of', 'chatting', 'calendar', 'settings'],
  manager:   ['dashboard', 'models', 'marketing_mym', 'marketing_of', 'calendar'],
  chatter:   ['dashboard', 'chatting'],
  compta:    ['dashboard', 'invoices'],
  marketing: ['dashboard', 'marketing_mym', 'marketing_of', 'calendar'],
  model:     ['dashboard', 'models'],
};

export const USERS_LS_KEY   = 'crm_users_v1';
export const SESSION_LS_KEY = 'crm_session_v1';

export const DEMO_USERS: CRMUser[] = [
  { id: 'u1', firstName: 'Admin',     lastName: '',       name: 'Admin',          email: 'admin@loadagency.com',     password: 'admin123',   role: 'admin',     modules: ['dashboard','models','invoices','marketing_mym','marketing_of','chatting','calendar','settings'], status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u2', firstName: 'Sadie',     lastName: '',       name: 'Sadie',          email: 'sadie@loadagency.com',     password: 'sadie123',   role: 'manager',   modules: ['dashboard','models','marketing_mym','marketing_of','calendar'],                                 status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u3', firstName: 'Kate',      lastName: '',       name: 'Kate',           email: 'kate@loadagency.com',      password: 'kate123',    role: 'manager',   modules: ['dashboard','models','marketing_mym','marketing_of','calendar'],                                 status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u4', firstName: 'Charlotte', lastName: 'Grace',  name: 'Charlotte Grace',email: 'charlotte@loadagency.com', password: 'model123',   role: 'model',     modules: ['dashboard','models'],                                                                         status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u5', firstName: 'Chatter',   lastName: '',       name: 'Chatter',        email: 'chatter@loadagency.com',   password: 'chatter123', role: 'chatter',   modules: ['dashboard','chatting'],                                                                       status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u6', firstName: 'Comptable', lastName: '',       name: 'Comptable',      email: 'compta@loadagency.com',    password: 'compta123',  role: 'compta',    modules: ['dashboard','invoices'],                                                                       status: 'active', createdAt: '2026-01-01T00:00:00Z' },
  { id: 'u7', firstName: 'Marketing', lastName: '',       name: 'Marketing',      email: 'marketing@loadagency.com', password: 'mkt123',     role: 'marketing', modules: ['dashboard','marketing_mym','marketing_of','calendar'],                                        status: 'active', createdAt: '2026-01-01T00:00:00Z' },
];

function rowToUser(row: Record<string, unknown>): CRMUser {
  return {
    id:        row.id as string,
    firstName: row.first_name as string,
    lastName:  row.last_name as string,
    name:      row.name as string,
    email:     row.email as string,
    password:  row.password as string,
    role:      row.role as UserRole,
    modules:   (row.modules as string[]) as ModuleKey[],
    status:    row.status as 'active' | 'inactive',
    createdAt: row.created_at as string,
  };
}

export async function loadUsers(): Promise<CRMUser[]> {
  const { data, error } = await supabase
    .from('crm_users')
    .select('*')
    .order('created_at');

  if (error) return DEMO_USERS;

  // Table vide → seed avec les comptes par défaut
  if (!data || data.length === 0) {
    await supabase.from('crm_users').upsert(
      DEMO_USERS.map((u) => ({
        id: u.id, first_name: u.firstName, last_name: u.lastName,
        name: u.name, email: u.email, password: u.password,
        role: u.role, modules: u.modules, status: u.status,
        created_at: u.createdAt,
      })),
      { onConflict: 'id' }
    );
    return DEMO_USERS;
  }

  return data.map(rowToUser);
}

// Authentification : Supabase en priorité, fallback sur DEMO_USERS si connexion impossible
export async function authenticateWithSupabase(email: string, password: string): Promise<CRMUser | null> {
  try {
    const { data, error } = await supabase
      .from('crm_users')
      .select('*')
      .ilike('email', email.trim())
      .eq('password', password)
      .eq('status', 'active')
      .maybeSingle();

    // Si Supabase répond correctement (même avec 0 résultat)
    if (!error) {
      return data ? rowToUser(data as Record<string, unknown>) : null;
    }
  } catch {
    // Supabase inaccessible — fallback ci-dessous
  }

  // Fallback : comptes hardcodés si Supabase est indisponible
  const normalized = email.trim().toLowerCase();
  return DEMO_USERS.find(
    (u) => u.email.toLowerCase() === normalized && u.password === password && u.status === 'active'
  ) ?? null;
}

// Migration des utilisateurs depuis localStorage vers Supabase
export async function migrateLocalStorageToSupabase(): Promise<void> {
  if (typeof window === 'undefined') return;
  const raw = localStorage.getItem(USERS_LS_KEY);
  if (!raw) return;
  try {
    const arr = JSON.parse(raw) as CRMUser[];
    if (!Array.isArray(arr) || arr.length === 0) return;
    await Promise.all(arr.map(saveUser));
    localStorage.removeItem(USERS_LS_KEY);
  } catch { /* ignore */ }
}

export async function saveUser(user: CRMUser): Promise<void> {
  await supabase.from('crm_users').upsert({
    id:         user.id,
    first_name: user.firstName,
    last_name:  user.lastName,
    name:       user.name,
    email:      user.email,
    password:   user.password,
    role:       user.role,
    modules:    user.modules,
    status:     user.status,
    created_at: user.createdAt,
  });
}

export async function deleteUserById(id: string): Promise<void> {
  await supabase.from('crm_users').delete().eq('id', id);
}

export function authenticateUser(email: string, password: string, users: CRMUser[]): CRMUser | null {
  return users.find(
    (u) => u.email.toLowerCase() === email.toLowerCase() && u.password === password && u.status === 'active'
  ) ?? null;
}

export function makeUser(data: Omit<CRMUser, 'id' | 'name' | 'createdAt'>): CRMUser {
  return {
    ...data,
    id: `u_${Date.now()}_${Math.random().toString(36).slice(2, 6)}`,
    name: `${data.firstName} ${data.lastName}`.trim(),
    createdAt: new Date().toISOString(),
  };
}
