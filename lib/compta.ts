import { supabase } from './supabase';
import { loadModels, MODELS, Model } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// Module Compta Modèle — fiches de facturation des créatrices.
//
// Le % agence n'est pas dupliqué ici : il vit dans crm_models.commission.
// La fiche le lit et l'écrit à cet endroit, pour éviter deux sources de
// vérité qui divergeraient (le module Management l'utilise déjà).
// ─────────────────────────────────────────────────────────────────────────────

export interface ModelBilling {
  modelId: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  hasCompany: boolean;
  companyName: string;
  companyType: string;
  companyAddress: string;
}

export function emptyBilling(modelId: string, fullName = ''): ModelBilling {
  const parts = fullName.trim().split(/\s+/);
  return {
    modelId,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    email: '',
    address: '',
    hasCompany: false,
    companyName: '',
    companyType: '',
    companyAddress: '',
  };
}

/** Suggestions du champ « type d'entreprise » — liste ouverte, pas un enum. */
export const COMPANY_TYPES = [
  'Auto-entrepreneur',
  'EI',
  'EURL',
  'SASU',
  'SARL',
  'SAS',
  'Ltd',
  'LLC',
  'FZ-LLC',
  'Sole trader',
  'Freelance',
];

/** Le nom qui doit apparaître sur une facture pour cette fiche. */
export function billingDisplayName(b: ModelBilling, fallback = ''): string {
  if (b.hasCompany && b.companyName.trim()) return b.companyName.trim();
  const person = `${b.firstName} ${b.lastName}`.trim();
  return person || fallback;
}

/** Champs manquants pour pouvoir émettre une facture propre. */
export function missingFields(b: ModelBilling): string[] {
  const missing: string[] = [];
  if (!b.firstName.trim()) missing.push('prénom');
  if (!b.lastName.trim()) missing.push('nom');
  if (!b.email.trim()) missing.push('email');
  if (!b.address.trim()) missing.push('adresse');
  if (b.hasCompany) {
    if (!b.companyName.trim()) missing.push("nom de l'entreprise");
    if (!b.companyType.trim()) missing.push("type d'entreprise");
    if (!b.companyAddress.trim()) missing.push("adresse de l'entreprise");
  }
  return missing;
}

// ─── Garde-fou réseau ────────────────────────────────────────────────────────
//
// Un appel Supabase injoignable peut rejeter — ou rester pendant sans jamais
// répondre — et le composant resterait bloqué sur son skeleton indéfiniment.
// Toutes les lectures passent par ici : en cas d'erreur ou de dépassement de
// délai, on retombe sur une valeur par défaut et l'interface s'affiche.

const READ_TIMEOUT_MS = 8000;

async function safeRead<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      run(),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), READ_TIMEOUT_MS)),
    ]);
  } catch {
    return fallback;
  }
}

export async function safeLoadModels(): Promise<Model[]> {
  return safeRead(loadModels, MODELS);
}

// ─── Mapping Supabase ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function rowToBilling(r: Row): ModelBilling {
  return {
    modelId: str(r.model_id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    email: str(r.email),
    address: str(r.address),
    hasCompany: r.has_company === true,
    companyName: str(r.company_name),
    companyType: str(r.company_type),
    companyAddress: str(r.company_address),
  };
}

function billingToRow(b: ModelBilling): Row {
  return {
    model_id: b.modelId,
    first_name: b.firstName.trim(),
    last_name: b.lastName.trim(),
    email: b.email.trim(),
    address: b.address.trim(),
    has_company: b.hasCompany,
    // Si la facturation société est décochée, on vide les champs société
    // plutôt que de garder des données fantômes qui réapparaîtraient.
    company_name: b.hasCompany ? b.companyName.trim() : '',
    company_type: b.hasCompany ? b.companyType.trim() : '',
    company_address: b.hasCompany ? b.companyAddress.trim() : '',
    updated_at: new Date().toISOString(),
  };
}

// ─── Accès données ───────────────────────────────────────────────────────────

export async function loadAllBilling(): Promise<Record<string, ModelBilling>> {
  return safeRead(async () => {
    const out: Record<string, ModelBilling> = {};
    const { data, error } = await supabase.from('crm_model_billing').select('*');
    if (!error && data) {
      (data as Row[]).forEach((r) => {
        const b = rowToBilling(r);
        if (b.modelId) out[b.modelId] = b;
      });
    }
    return out;
  }, {});
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveBilling(b: ModelBilling): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_model_billing')
      .upsert(billingToRow(b), { onConflict: 'model_id' });
    if (error) {
      if (error.code === '42P01') {
        return {
          ok: false,
          error: "La table crm_model_billing n'existe pas encore. Exécutez supabase/compta-fiches.sql dans le SQL Editor.",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/** Le % agence est stocké dans crm_models — source de vérité unique. */
export async function saveCommission(modelId: string, rate: number): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_models')
      .update({ commission: rate })
      .eq('id', modelId);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}
