import { supabase } from './supabase';

/**
 * Ressources — la bibliothèque de liens de l'agence.
 *
 * Guides, modèles de scripts, process internes, outils. Une seule liste
 * partagée : les créatrices y lisent, l'agence y écrit. Rien n'est propre à une
 * modèle — les liens qui la concernent (son Drive) vivent sur sa fiche.
 */

export interface Resource {
  id: string;
  title: string;
  url: string;
  description: string;
  /** Regroupement libre à l'affichage. Vide = « Divers ». */
  category: string;
  /** Visible par les créatrices. Sinon, réservé à l'agence. */
  forModels: boolean;
  sortOrder: number;
  createdBy: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

/** Suggestions du champ catégorie — liste ouverte, pas un enum. */
export const RESOURCE_CATEGORIES = [
  'Scripts',
  'Marketing',
  'Process',
  'Outils',
  'Formation',
  'Juridique',
];

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
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function rowToResource(r: Row): Resource {
  return {
    id: str(r.id),
    title: str(r.title),
    url: str(r.url),
    description: str(r.description),
    category: str(r.category),
    forModels: r.for_models !== false,
    sortOrder: typeof r.sort_order === 'number' ? r.sort_order : 0,
    createdBy: str(r.created_by),
  };
}

export async function loadResources(): Promise<Resource[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_resource')
      .select('*')
      .order('sort_order', { ascending: true })
      .order('title', { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(rowToResource);
  }, []);
}

export async function createResource(
  r: Omit<Resource, 'id'>,
): Promise<{ ok: true; resource: Resource } | { ok: false; error: string }> {
  const url = r.url.trim();
  if (!r.title.trim()) return { ok: false, error: 'Donne un titre à la ressource.' };
  if (!/^https?:\/\//i.test(url)) {
    return { ok: false, error: "L'adresse doit commencer par https://" };
  }
  try {
    const { data, error } = await supabase
      .from('crm_resource')
      .insert({
        title: r.title.trim(),
        url,
        description: r.description.trim(),
        category: r.category.trim(),
        for_models: r.forModels,
        sort_order: r.sortOrder,
        created_by: r.createdBy,
      })
      .select('*');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: 'Aucune ligne écrite — vérifie les policies RLS de crm_resource.' };
    }
    return { ok: true, resource: rowToResource(data[0] as Row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function updateResource(id: string, patch: Partial<Resource>): Promise<SaveResult> {
  try {
    const row: Row = {};
    if (patch.title !== undefined) row.title = patch.title.trim();
    if (patch.url !== undefined) row.url = patch.url.trim();
    if (patch.description !== undefined) row.description = patch.description.trim();
    if (patch.category !== undefined) row.category = patch.category.trim();
    if (patch.forModels !== undefined) row.for_models = patch.forModels;
    if (patch.sortOrder !== undefined) row.sort_order = patch.sortOrder;
    const { error } = await supabase.from('crm_resource').update(row).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function deleteResource(id: string): Promise<SaveResult> {
  try {
    const { error } = await supabase.from('crm_resource').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/** Regroupe par catégorie, « Divers » en dernier. */
export function groupByCategory(list: Resource[]): { category: string; items: Resource[] }[] {
  const map = new Map<string, Resource[]>();
  list.forEach((r) => {
    const k = r.category.trim() || 'Divers';
    map.set(k, [...(map.get(k) ?? []), r]);
  });
  return [...map.entries()]
    .map(([category, items]) => ({ category, items }))
    .sort((a, b) => {
      if (a.category === 'Divers') return 1;
      if (b.category === 'Divers') return -1;
      return a.category.localeCompare(b.category);
    });
}

/** Le domaine, pour situer un lien d'un coup d'œil. */
export function hostOf(url: string): string {
  try {
    return new URL(url).hostname.replace(/^www\./, '');
  } catch {
    return '';
  }
}
