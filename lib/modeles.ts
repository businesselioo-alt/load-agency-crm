import { supabase } from './supabase';
import { MODELS, Model, ModelStatus, Platform } from './data';

/**
 * Gestion des créatrices — la fiche d'identité, pas la facturation.
 *
 * `crm_models` est la source de vérité partagée par tous les modules : compta,
 * suivi contenu, marketing. Les informations de facturation (adresse, société,
 * devise) vivent à côté, dans `crm_model_billing`.
 */

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export const MODEL_STATUS_LABELS: Record<ModelStatus, string> = {
  active: 'Active',
  inactive: 'Inactive',
  suspended: 'Suspendue',
};

export const MODEL_STATUS_STYLES: Record<ModelStatus, { text: string; bg: string; border: string }> = {
  active: { text: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
  inactive: { text: '#888888', bg: 'rgba(136,136,136,0.10)', border: 'rgba(136,136,136,0.25)' },
  suspended: { text: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
};

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

type Row = Record<string, unknown>;

function rowToModel(r: Row): Model {
  return {
    id: r.id as string,
    name: (r.name as string) ?? '',
    pseudo: (r.pseudo as string) ?? '',
    platforms: Array.isArray(r.platforms) ? (r.platforms as Platform[]) : [],
    username: (r.username as string) ?? '',
    manager: (r.manager as string) ?? '',
    commission: typeof r.commission === 'number' ? r.commission : 20,
    status: (['active', 'inactive', 'suspended'] as string[]).includes(r.status as string)
      ? (r.status as ModelStatus)
      : 'active',
    driveLink: (r.drive_link as string) ?? undefined,
    notionLink: (r.notion_link as string) ?? undefined,
    avatar: (r.avatar as string) ?? undefined,
  };
}

export function modelToRow(m: Model, sortOrder: number): Row {
  return {
    id: m.id,
    name: m.name.trim(),
    pseudo: m.pseudo.trim(),
    platforms: m.platforms,
    username: m.username.trim(),
    manager: m.manager.trim(),
    commission: m.commission,
    status: m.status,
    drive_link: m.driveLink?.trim() || null,
    notion_link: m.notionLink?.trim() || null,
    avatar: m.avatar ?? null,
    sort_order: sortOrder,
  };
}

/**
 * Charge la liste et dit d'où elle vient.
 *
 * `crm_models` peut être vide : l'app retombe alors sur la liste en dur du
 * code. C'est un piège à connaître — enregistrer une seule créatrice dans ce
 * cas ferait disparaître toutes les autres au rechargement, puisque la table
 * cesserait d'être vide. `fromDatabase` permet à l'écran de proposer l'import
 * complet avant toute modification.
 */
export async function loadModelSource(): Promise<{ models: Model[]; fromDatabase: boolean }> {
  return safeRead(
    async () => {
      const { data, error } = await supabase.from('crm_models').select('*').order('sort_order');
      if (error || !data || data.length === 0) {
        return { models: MODELS, fromDatabase: false };
      }
      return { models: (data as Row[]).map(rowToModel), fromDatabase: true };
    },
    { models: MODELS, fromDatabase: false },
  );
}

/** Recopie la liste du code dans la base, une fois pour toutes. */
export async function seedModels(models: Model[]): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_models')
      .upsert(models.map((m, i) => modelToRow(m, i)), { onConflict: 'id' });
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/**
 * Enregistre une fiche.
 *
 * `previousName` sert au renommage : le chiffre d'affaires quotidien est stocké
 * dans `vg_daily_entries` sous le NOM de la créatrice, pas son identifiant.
 * Renommer une fiche sans toucher à l'historique le rendrait orphelin — le
 * dashboard afficherait un trou sous le nouveau nom et des données fantômes
 * sous l'ancien. On renomme donc les deux d'un seul geste.
 */
export async function saveModel(
  m: Model,
  sortOrder: number,
  previousName?: string,
): Promise<SaveResult> {
  if (!m.name.trim()) return { ok: false, error: 'Le nom est obligatoire.' };
  try {
    const { data, error } = await supabase
      .from('crm_models')
      .upsert(modelToRow(m, sortOrder), { onConflict: 'id' })
      .select('id');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: 'Aucune ligne écrite — vérifie les policies RLS de crm_models.' };
    }

    const before = (previousName ?? '').trim();
    if (before && before !== m.name.trim()) {
      await supabase
        .from('vg_daily_entries')
        .update({ model_name: m.name.trim() })
        .eq('model_name', before);
    }

    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function deleteModel(id: string): Promise<SaveResult> {
  try {
    const { error } = await supabase.from('crm_models').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/**
 * Identifiant de la prochaine créatrice.
 *
 * On reste sur la série « m1, m2… » du code plutôt que sur un UUID : cet
 * identifiant est référencé en texte par les factures, les déclarations et le
 * journal de contenu. Changer de format n'apporterait rien et casserait la
 * lisibilité des données existantes.
 */
export function nextModelId(existing: Model[]): string {
  const max = existing.reduce((acc, m) => {
    const n = Number(/^m(\d+)$/.exec(m.id)?.[1] ?? 0);
    return n > acc ? n : acc;
  }, 0);
  return `m${max + 1}`;
}

export function emptyModel(existing: Model[]): Model {
  return {
    id: nextModelId(existing),
    name: '',
    pseudo: '',
    platforms: ['MYM'],
    username: '',
    manager: '',
    commission: 20,
    status: 'active',
    driveLink: '',
    notionLink: '',
  };
}

/** Les managers déjà saisis, pour proposer une liste plutôt qu'un champ vide. */
export function managersOf(models: Model[]): string[] {
  return [...new Set(models.map((m) => m.manager.trim()).filter(Boolean))].sort();
}
