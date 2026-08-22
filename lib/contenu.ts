import { supabase } from './supabase';
import { Model } from './data';

/**
 * Suivi Contenu — journal des livrables déposés sur le Drive.
 *
 * Le Drive reste la source du fichier. Le CRM ne stocke pas le contenu, il
 * enregistre le fait qu'il a été déposé : quelle catégorie, quel numéro, quand,
 * par qui. C'est ce journal qui déclenche l'alerte côté agence.
 *
 * La numérotation est continue par (modèle, catégorie) : Script 1, Script 2…
 * Elle ne repart pas de zéro chaque mois — c'est le numéro du dossier Drive.
 */

/**
 * Une catégorie est un dossier du Drive.
 *
 * Le CRM n'impose plus sa propre liste : il recopie l'arborescence réelle de
 * chaque créatrice, découverte par le script de synchronisation. Une modèle qui
 * a un dossier « 9- ASMR » le voit apparaître sans que personne ne touche au
 * code. La clé est l'identifiant Drive du dossier, stable même si la modèle le
 * renomme.
 *
 * Tant qu'aucune synchronisation n'a eu lieu, on retombe sur l'arborescence
 * type de l'agence, pour que l'écran ne soit pas vide.
 */
export type ContentCategory = string;

export interface FolderDef {
  /** Identifiant Drive du dossier, ou clé par défaut avant synchronisation. */
  key: string;
  /** Libellé affiché, ex. « 4 · Nude pics ». */
  label: string;
  /** Singulier, utilisé pour « Nude pic 12 ». */
  unit: string;
  /** Chiffre de tête du dossier : sert d'ordre et de correspondance entre modèles. */
  position: number;
}

/** Dossier réellement présent sur le Drive d'une créatrice. */
export interface ModelFolder {
  modelId: string;
  folderId: string;
  name: string;
  position: number;
}

/** Catégorie fourre-tout des livraisons répondant à une demande hors dossier. */
export const CUSTOM_KEY = 'custom';

export const CUSTOM_FOLDER: FolderDef = {
  key: CUSTOM_KEY,
  label: 'Demandes personnalisées',
  unit: 'Livraison',
  position: 999,
};

export const DEFAULT_FOLDERS: FolderDef[] = [
  { key: 'scripts', label: '1 · Scripts', unit: 'Script', position: 1 },
  { key: 'feed', label: '2 · Feed posts', unit: 'Feed post', position: 2 },
  { key: 'dressed_pics', label: '3 · Dressed pics', unit: 'Dressed pic', position: 3 },
  { key: 'nude_pics', label: '4 · Nude pics', unit: 'Nude pic', position: 4 },
  { key: 'nude_vids', label: '5 · Nude vids', unit: 'Nude vid', position: 5 },
  { key: 'collab', label: '6 · Collab / Anal', unit: 'Collab', position: 6 },
  { key: 'feet', label: '7 · Feet content', unit: 'Feet', position: 7 },
  { key: 'marketing', label: '8 · Marketing clips', unit: 'Marketing clip', position: 8 },
];

/** « 4- NUDE PICS » → « 4 · Nude pics ». */
function prettyLabel(name: string, position: number): string {
  const bare = name.replace(/^\s*\d+\s*[-–—._)]*\s*/, '').trim();
  const cased = bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase();
  return position < 999 ? `${position} · ${cased}` : cased;
}

/** « NUDE PICS » → « Nude pic ». Le pluriel naïf suffit pour numéroter. */
function singular(name: string): string {
  const bare = name.replace(/^\s*\d+\s*[-–—._)]*\s*/, '').trim();
  const cased = bare.charAt(0).toUpperCase() + bare.slice(1).toLowerCase();
  return cased.endsWith('s') ? cased.slice(0, -1) : cased;
}

export function folderToDef(f: ModelFolder): FolderDef {
  return {
    key: f.folderId,
    label: prettyLabel(f.name, f.position),
    unit: singular(f.name),
    position: f.position,
  };
}

/**
 * Les catégories d'une créatrice : ses dossiers Drive s'ils sont connus, sinon
 * l'arborescence type. La catégorie « personnalisée » n'apparaît que si des
 * livraisons y ont réellement atterri.
 */
export function foldersFor(
  modelId: string,
  all: ModelFolder[],
  entries: ContentEntry[] = [],
): FolderDef[] {
  const mine = all.filter((f) => f.modelId === modelId);
  const base =
    mine.length > 0
      ? mine.slice().sort((a, b) => a.position - b.position || a.name.localeCompare(b.name)).map(folderToDef)
      : DEFAULT_FOLDERS;

  const known = new Set(base.map((f) => f.key));
  const extras: FolderDef[] = [];

  if (entries.some((e) => e.modelId === modelId && e.category === CUSTOM_KEY)) {
    extras.push(CUSTOM_FOLDER);
  }
  // Dépôts rattachés à un dossier disparu : on les montre plutôt que de les
  // faire s'évaporer silencieusement.
  entries
    .filter((e) => e.modelId === modelId && !known.has(e.category) && e.category !== CUSTOM_KEY)
    .forEach((e) => {
      if (extras.some((x) => x.key === e.category)) return;
      extras.push({ key: e.category, label: 'Dossier archivé', unit: 'Contenu', position: 998 });
    });

  return [...base, ...extras];
}

export function defByKey(folders: FolderDef[], key: string): FolderDef {
  return (
    folders.find((f) => f.key === key) ?? {
      key,
      label: 'Dossier inconnu',
      unit: 'Contenu',
      position: 997,
    }
  );
}

export interface ContentEntry {
  id: string;
  modelId: string;
  category: ContentCategory;
  seq: number;
  label: string;
  /** AAAA-MM-JJ */
  addedAt: string;
  addedBy: string;
  /** Faux tant que l'agence n'a pas ouvert la nouveauté. */
  seen: boolean;
  /**
   * Demande à laquelle ce dépôt répond, vide s'il est spontané.
   * C'est ce lien — et non un rapprochement par date — qui fait avancer la
   * barre de progression : deux demandes ouvertes sur la même catégorie ne
   * peuvent pas se disputer le même dépôt.
   */
  requestId: string;
  /** 'drive' si détecté automatiquement, 'crm' si saisi dans l'app. */
  source: string;
  /** Identifiant du fichier Drive, vide pour une saisie manuelle. */
  driveFileId: string;
}

export type RequestPriority = 'normale' | 'urgente';
/** Statut stocké. « Livrée » et « en retard » sont déduits, pas enregistrés. */
export type RequestStatus = 'ouverte' | 'close' | 'annulee';

export interface ContentRequest {
  id: string;
  modelId: string;
  /** Dossier visé chez CETTE créatrice. Vide pour une demande personnalisée. */
  category: ContentCategory;
  /**
   * Chiffre de tête du dossier visé. C'est lui qui fait le pont entre
   * créatrices : « le dossier 4 » désigne les nude pics chez toutes, même si
   * l'identifiant Drive diffère. 0 pour une demande personnalisée.
   */
  folderPosition: number;
  /**
   * Intitulé libre d'une demande hors arborescence. Rempli = demande
   * personnalisée : elle ne vise aucun dossier, la livraison atterrit dans la
   * catégorie « Demandes personnalisées ».
   */
  customLabel: string;
  quantity: number;
  brief: string;
  /** AAAA-MM-JJ, vide si pas d'échéance. */
  dueAt: string;
  priority: RequestPriority;
  status: RequestStatus;
  createdBy: string;
  createdAt: string;
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

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

function rowToEntry(r: Row): ContentEntry {
  return {
    id: str(r.id),
    modelId: str(r.model_id),
    category: str(r.category) as ContentCategory,
    seq: typeof r.seq === 'number' ? r.seq : 0,
    label: str(r.label),
    addedAt: str(r.added_at).slice(0, 10),
    addedBy: str(r.added_by),
    seen: r.seen === true,
    requestId: str(r.request_id),
    source: str(r.source, 'crm'),
    driveFileId: str(r.drive_file_id),
  };
}

function rowToFolder(r: Row): ModelFolder {
  return {
    modelId: str(r.model_id),
    folderId: str(r.folder_id),
    name: str(r.name),
    position: typeof r.position === 'number' ? r.position : 999,
  };
}

function rowToRequest(r: Row): ContentRequest {
  return {
    id: str(r.id),
    modelId: str(r.model_id),
    category: str(r.category),
    folderPosition: typeof r.folder_position === 'number' ? r.folder_position : 0,
    customLabel: str(r.custom_label),
    quantity: typeof r.quantity === 'number' ? r.quantity : 1,
    brief: str(r.brief),
    dueAt: str(r.due_at).slice(0, 10),
    priority: str(r.priority) === 'urgente' ? 'urgente' : 'normale',
    status: (['ouverte', 'close', 'annulee'] as string[]).includes(str(r.status))
      ? (str(r.status) as RequestStatus)
      : 'ouverte',
    createdBy: str(r.created_by),
    createdAt: str(r.created_at).slice(0, 10),
  };
}

/** Les 400 derniers dépôts, tous modèles confondus. */
export async function loadEntries(): Promise<ContentEntry[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_content_log')
      .select('*')
      .order('added_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(400);
    if (error || !data) return [];
    return (data as Row[]).map(rowToEntry);
  }, []);
}

export async function loadEntriesForModel(modelId: string): Promise<ContentEntry[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_content_log')
      .select('*')
      .eq('model_id', modelId)
      .order('added_at', { ascending: false })
      .order('created_at', { ascending: false })
      .limit(400);
    if (error || !data) return [];
    return (data as Row[]).map(rowToEntry);
  }, []);
}

/**
 * Enregistre un dépôt.
 *
 * Le numéro est calculé côté serveur à partir du plus haut numéro déjà connu
 * pour ce couple (modèle, catégorie) : deux personnes qui cliquent en même
 * temps ne peuvent pas se voir attribuer le même numéro par erreur d'affichage.
 */
export async function addEntry(params: {
  modelId: string;
  category: ContentCategory;
  label?: string;
  addedBy: string;
  addedAt?: string;
  requestId?: string;
}): Promise<{ ok: true; entry: ContentEntry } | { ok: false; error: string }> {
  try {
    const { data: last, error: readError } = await supabase
      .from('crm_content_log')
      .select('seq')
      .eq('model_id', params.modelId)
      .eq('category', params.category)
      .order('seq', { ascending: false })
      .limit(1);
    if (readError) return { ok: false, error: readError.message };

    const nextSeq = ((last?.[0]?.seq as number | undefined) ?? 0) + 1;

    const { data, error } = await supabase
      .from('crm_content_log')
      .insert({
        model_id: params.modelId,
        category: params.category,
        seq: nextSeq,
        label: (params.label ?? '').trim(),
        added_at: params.addedAt ?? new Date().toISOString().slice(0, 10),
        added_by: params.addedBy,
        seen: false,
        request_id: params.requestId || null,
      })
      .select('*');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: 'Aucune ligne écrite — vérifie les policies RLS de crm_content_log.' };
    }
    return { ok: true, entry: rowToEntry(data[0] as Row) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function deleteEntry(id: string): Promise<SaveResult> {
  try {
    const { error } = await supabase.from('crm_content_log').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function markSeen(ids: string[]): Promise<SaveResult> {
  if (ids.length === 0) return { ok: true };
  try {
    const { error } = await supabase.from('crm_content_log').update({ seen: true }).in('id', ids);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/**
 * Le lien Drive vit dans crm_models.drive_link.
 *
 * UPSERT et non UPDATE : si crm_models est vide, l'app retombe sur la liste en
 * dur du code et un UPDATE ne toucherait aucune ligne sans lever d'erreur.
 */
export async function saveDriveLink(model: Model, url: string): Promise<SaveResult> {
  try {
    const { data, error } = await supabase
      .from('crm_models')
      .upsert(
        {
          id: model.id,
          name: model.name,
          pseudo: model.pseudo,
          platforms: model.platforms,
          username: model.username,
          manager: model.manager,
          commission: model.commission,
          status: model.status,
          drive_link: url.trim() || null,
          notion_link: model.notionLink ?? null,
          avatar: model.avatar ?? null,
        },
        { onConflict: 'id' },
      )
      .select('id');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: 'Aucune ligne écrite dans crm_models — vérifie les policies RLS.' };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/** Arborescence Drive de toutes les créatrices, telle que découverte. */
export async function loadFolders(): Promise<ModelFolder[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_model_folder')
      .select('*')
      .order('position', { ascending: true });
    if (error || !data) return [];
    return (data as Row[]).map(rowToFolder);
  }, []);
}

// ─── Demandes de contenu ─────────────────────────────────────────────────────

export async function loadRequests(): Promise<ContentRequest[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_content_request')
      .select('*')
      .order('created_at', { ascending: false })
      .limit(400);
    if (error || !data) return [];
    return (data as Row[]).map(rowToRequest);
  }, []);
}

export async function loadRequestsForModel(modelId: string): Promise<ContentRequest[]> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_content_request')
      .select('*')
      .eq('model_id', modelId)
      .order('created_at', { ascending: false })
      .limit(200);
    if (error || !data) return [];
    return (data as Row[]).map(rowToRequest);
  }, []);
}

/**
 * Une même demande peut être adressée à plusieurs créatrices d'un coup.
 *
 * On résout le dossier créatrice par créatrice à partir de sa position : « le
 * dossier 4 » vise les nude pics de chacune, même si l'identifiant Drive
 * diffère. Une demande personnalisée ne vise aucun dossier.
 */
export async function createRequests(params: {
  modelIds: string[];
  folderPosition: number;
  customLabel?: string;
  folders: ModelFolder[];
  quantity: number;
  brief: string;
  dueAt: string;
  priority: RequestPriority;
  createdBy: string;
}): Promise<{ ok: true; requests: ContentRequest[] } | { ok: false; error: string }> {
  if (params.modelIds.length === 0) {
    return { ok: false, error: 'Sélectionne au moins une créatrice.' };
  }
  const custom = (params.customLabel ?? '').trim();
  if (!custom && params.folderPosition <= 0) {
    return { ok: false, error: 'Choisis un dossier ou saisis un intitulé personnalisé.' };
  }

  const categoryFor = (modelId: string): string => {
    if (custom) return '';
    const mine = params.folders.filter((f) => f.modelId === modelId);
    const match = mine.find((f) => f.position === params.folderPosition);
    if (match) return match.folderId;
    // Pas encore synchronisée : on retombe sur la clé par défaut de ce rang,
    // que le Suivi Contenu utilise justement avant la première synchro.
    return DEFAULT_FOLDERS.find((f) => f.position === params.folderPosition)?.key ?? '';
  };

  try {
    const { data, error } = await supabase
      .from('crm_content_request')
      .insert(
        params.modelIds.map((modelId) => ({
          model_id: modelId,
          category: categoryFor(modelId),
          folder_position: custom ? 0 : params.folderPosition,
          custom_label: custom,
          quantity: Math.max(1, params.quantity),
          brief: params.brief.trim(),
          due_at: params.dueAt || null,
          priority: params.priority,
          status: 'ouverte',
          created_by: params.createdBy,
        })),
      )
      .select('*');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return {
        ok: false,
        error: 'Aucune ligne écrite — vérifie les policies RLS de crm_content_request.',
      };
    }
    return { ok: true, requests: (data as Row[]).map(rowToRequest) };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function updateRequest(
  id: string,
  patch: Partial<Pick<ContentRequest, 'status' | 'quantity' | 'brief' | 'dueAt' | 'priority'>>,
): Promise<SaveResult> {
  try {
    const row: Row = {};
    if (patch.status !== undefined) row.status = patch.status;
    if (patch.quantity !== undefined) row.quantity = Math.max(1, patch.quantity);
    if (patch.brief !== undefined) row.brief = patch.brief.trim();
    if (patch.dueAt !== undefined) row.due_at = patch.dueAt || null;
    if (patch.priority !== undefined) row.priority = patch.priority;
    const { error } = await supabase.from('crm_content_request').update(row).eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export async function deleteRequest(id: string): Promise<SaveResult> {
  try {
    const { error } = await supabase.from('crm_content_request').delete().eq('id', id);
    if (error) return { ok: false, error: error.message };
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

export type EffectiveStatus = 'ouverte' | 'en_retard' | 'livree' | 'close' | 'annulee';

export const REQUEST_STATUS_LABELS: Record<EffectiveStatus, string> = {
  ouverte: 'En cours',
  en_retard: 'En retard',
  livree: 'Livrée',
  close: 'Clôturée',
  annulee: 'Annulée',
};

export const REQUEST_STATUS_STYLES: Record<
  EffectiveStatus,
  { text: string; bg: string; border: string }
> = {
  ouverte: { text: '#C9A84C', bg: 'rgba(201,168,76,0.12)', border: 'rgba(201,168,76,0.3)' },
  en_retard: { text: '#f87171', bg: 'rgba(248,113,113,0.12)', border: 'rgba(248,113,113,0.3)' },
  livree: { text: '#34d399', bg: 'rgba(52,211,153,0.12)', border: 'rgba(52,211,153,0.3)' },
  close: { text: '#888888', bg: 'rgba(136,136,136,0.10)', border: 'rgba(136,136,136,0.25)' },
  annulee: { text: '#666666', bg: 'rgba(102,102,102,0.10)', border: 'rgba(102,102,102,0.25)' },
};

export interface RequestProgress {
  request: ContentRequest;
  delivered: number;
  remaining: number;
  percent: number;
  effective: EffectiveStatus;
  daysLeft: number | null;
}

const todayIso = () => new Date().toISOString().slice(0, 10);

function daysBetween(fromIso: string, toIso: string): number {
  const a = Date.parse(`${fromIso}T00:00:00Z`);
  const b = Date.parse(`${toIso}T00:00:00Z`);
  if (Number.isNaN(a) || Number.isNaN(b)) return 0;
  return Math.round((b - a) / 86_400_000);
}

export function progressOf(
  request: ContentRequest,
  entries: ContentEntry[],
  today = todayIso(),
): RequestProgress {
  const delivered = entries.filter((e) => e.requestId === request.id).length;
  const remaining = Math.max(0, request.quantity - delivered);
  const percent = request.quantity > 0
    ? Math.min(100, Math.round((delivered / request.quantity) * 100))
    : 0;

  let effective: EffectiveStatus;
  if (request.status === 'annulee') effective = 'annulee';
  else if (remaining === 0) effective = 'livree';
  else if (request.status === 'close') effective = 'close';
  else if (request.dueAt && request.dueAt < today) effective = 'en_retard';
  else effective = 'ouverte';

  return {
    request,
    delivered,
    remaining,
    percent,
    effective,
    daysLeft: request.dueAt ? daysBetween(today, request.dueAt) : null,
  };
}

/** Demandes qui attendent encore quelque chose de la créatrice. */
export function isActionable(p: RequestProgress): boolean {
  return p.effective === 'ouverte' || p.effective === 'en_retard';
}

// ─── Agrégation ──────────────────────────────────────────────────────────────

export interface CategoryStat {
  category: FolderDef;
  /** Dépôts du mois affiché. */
  entriesInMonth: ContentEntry[];
  /** Plus haut numéro atteint, toutes périodes confondues. */
  total: number;
  lastAddedAt: string;
  unseen: number;
}

export function monthOf(dateIso: string): string {
  return dateIso.slice(0, 7);
}

export function statsFor(
  entries: ContentEntry[],
  month: string,
  folders: FolderDef[],
): CategoryStat[] {
  return folders.map((category) => {
    const all = entries.filter((e) => e.category === category.key);
    const entriesInMonth = all
      .filter((e) => monthOf(e.addedAt) === month)
      .sort((a, b) => a.seq - b.seq);
    return {
      category,
      entriesInMonth,
      total: all.reduce((max, e) => Math.max(max, e.seq), 0),
      lastAddedAt: all.reduce((last, e) => (e.addedAt > last ? e.addedAt : last), ''),
      unseen: entriesInMonth.filter((e) => !e.seen).length,
    };
  });
}

export function formatDay(iso: string): string {
  if (!iso) return '—';
  const [y, m, d] = iso.split('-');
  return `${d}/${m}/${y.slice(2)}`;
}

/** « Script 12 » ou « Script 12 — Halloween » si un libellé a été saisi. */
export function entryTitle(e: ContentEntry, folders: FolderDef[] = []): string {
  const unit = defByKey(folders, e.category).unit;
  return e.label ? `${unit} ${e.seq} — ${e.label}` : `${unit} ${e.seq}`;
}
