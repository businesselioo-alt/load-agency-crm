import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { CATEGORIES, ContentCategory } from '@/lib/contenu';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Synchronisation Drive → CRM.
 *
 * Un script Google Apps Script parcourt le Drive de chaque créatrice et appelle
 * cette route pour signaler les nouveaux fichiers.
 *
 * Deux garde-fous :
 *
 * 1. Un secret partagé (en-tête x-ingest-secret). Sans lui, n'importe qui
 *    pourrait injecter des dépôts fictifs dans le CRM.
 * 2. Une contrainte d'unicité sur drive_file_id côté base. Le script peut
 *    repasser autant de fois qu'il veut sur les mêmes fichiers, un fichier
 *    donné ne produira jamais deux lignes. L'idempotence vit dans le schéma,
 *    pas dans la mémoire du script — un script qui perd son curseur ne casse
 *    donc rien.
 */

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  // La clé service_role contourne RLS ; à défaut la clé anon suffit tant que
  // les policies du CRM restent permissives.
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

/**
 * Distingue « le serveur n'a pas de secret » de « le secret fourni est faux ».
 *
 * Révéler l'absence de configuration n'aide personne à deviner le secret, et
 * ça évite des heures de diagnostic à l'aveugle entre une variable Vercel
 * absente et un copier-coller raté dans Apps Script.
 */
type AuthResult = 'ok' | 'not_configured' | 'invalid';

function checkAuth(req: Request): AuthResult {
  const expected = process.env.DRIVE_INGEST_SECRET;
  if (!expected) return 'not_configured';
  return authorized(req, expected) ? 'ok' : 'invalid';
}

function authFailure(result: AuthResult) {
  if (result === 'not_configured') {
    return NextResponse.json(
      {
        error:
          "DRIVE_INGEST_SECRET n'est pas défini sur le serveur. Ajoute-le dans les variables d'environnement Vercel, puis redéploie.",
      },
      { status: 501 },
    );
  }
  return NextResponse.json(
    { error: 'Secret invalide. Vérifie la valeur de SECRET dans le script Google.' },
    { status: 401 },
  );
}

function authorized(req: Request, expected: string): boolean {
  const got = req.headers.get('x-ingest-secret') ?? '';
  // Comparaison de longueur constante, pour ne pas laisser deviner le secret
  // caractère par caractère via le temps de réponse.
  if (got.length !== expected.length) return false;
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0;
}

/** Extrait l'identifiant d'un dossier depuis une URL Drive collée par l'agence. */
function folderIdFrom(link: string): string {
  if (!link) return '';
  const byPath = link.match(/\/folders\/([A-Za-z0-9_-]{10,})/);
  if (byPath) return byPath[1];
  const byQuery = link.match(/[?&]id=([A-Za-z0-9_-]{10,})/);
  if (byQuery) return byQuery[1];
  // L'agence a pu coller directement l'identifiant.
  return /^[A-Za-z0-9_-]{10,}$/.test(link.trim()) ? link.trim() : '';
}

const VALID_CATEGORIES = new Set<string>(CATEGORIES.map((c) => c.key));

/**
 * GET — la liste des dossiers à surveiller.
 *
 * Le script n'a aucune configuration en dur : il demande au CRM quelles
 * créatrices suivre et où. Ajouter une créatrice, c'est renseigner son lien
 * Drive dans le CRM, rien d'autre.
 */
export async function GET(req: Request) {
  const auth = checkAuth(req);
  if (auth !== 'ok') return authFailure(auth);
  const db = serverClient();
  if (!db) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 501 });

  const { data, error } = await db.from('crm_models').select('id, name, drive_link');
  if (error) return NextResponse.json({ error: error.message }, { status: 500 });

  const targets = (data ?? [])
    .map((m) => ({
      modelId: m.id as string,
      name: (m.name as string) ?? '',
      folderId: folderIdFrom((m.drive_link as string) ?? ''),
    }))
    .filter((t) => t.folderId);

  return NextResponse.json({
    targets,
    categories: CATEGORIES.map((c, i) => ({ index: i + 1, key: c.key, label: c.label })),
  });
}

interface IncomingFile {
  driveFileId?: string;
  name?: string;
  category?: string;
  createdAt?: string;
}

/**
 * Rattache un fichier à la demande ouverte la plus ancienne de cette catégorie
 * qui n'est pas encore servie. Sans demande correspondante, le dépôt reste
 * spontané.
 */
async function pickRequestId(
  db: NonNullable<ReturnType<typeof serverClient>>,
  modelId: string,
  category: string,
  taken: Map<string, number>,
): Promise<string | null> {
  const { data: requests } = await db
    .from('crm_content_request')
    .select('id, quantity')
    .eq('model_id', modelId)
    .eq('category', category)
    .eq('status', 'ouverte')
    .order('created_at', { ascending: true });
  if (!requests || requests.length === 0) return null;

  for (const r of requests) {
    const id = r.id as string;
    let used = taken.get(id);
    if (used === undefined) {
      const { count } = await db
        .from('crm_content_log')
        .select('id', { count: 'exact', head: true })
        .eq('request_id', id);
      used = count ?? 0;
    }
    if (used < ((r.quantity as number) ?? 1)) {
      taken.set(id, used + 1);
      return id;
    }
    taken.set(id, used);
  }
  return null;
}

export async function POST(req: Request) {
  const auth = checkAuth(req);
  if (auth !== 'ok') return authFailure(auth);
  const db = serverClient();
  if (!db) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 501 });

  let payload: { modelId?: string; files?: IncomingFile[] };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const modelId = (payload.modelId ?? '').trim();
  const files = Array.isArray(payload.files) ? payload.files.slice(0, 300) : [];
  if (!modelId) return NextResponse.json({ error: 'modelId manquant.' }, { status: 400 });
  if (files.length === 0) return NextResponse.json({ inserted: 0, skipped: 0, entries: [] });

  // Fichiers déjà connus : on ne relit pas la contrainte d'unicité par erreur,
  // on filtre avant pour pouvoir renvoyer un décompte honnête au script.
  const ids = files.map((f) => (f.driveFileId ?? '').trim()).filter(Boolean);
  const { data: known } = await db
    .from('crm_content_log')
    .select('drive_file_id')
    .in('drive_file_id', ids);
  const seen = new Set((known ?? []).map((k) => k.drive_file_id as string));

  // Numéro de départ par catégorie, lu une seule fois.
  const nextSeq = new Map<string, number>();
  const taken = new Map<string, number>();
  let inserted = 0;
  let skipped = 0;
  const created: { category: string; seq: number; name: string }[] = [];

  for (const f of files) {
    const driveFileId = (f.driveFileId ?? '').trim();
    const category = (f.category ?? '').trim();
    if (!driveFileId || !VALID_CATEGORIES.has(category) || seen.has(driveFileId)) {
      skipped += 1;
      continue;
    }
    seen.add(driveFileId);

    if (!nextSeq.has(category)) {
      const { data: last } = await db
        .from('crm_content_log')
        .select('seq')
        .eq('model_id', modelId)
        .eq('category', category)
        .order('seq', { ascending: false })
        .limit(1);
      nextSeq.set(category, ((last?.[0]?.seq as number | undefined) ?? 0) + 1);
    }
    const seq = nextSeq.get(category) as number;

    const requestId = await pickRequestId(db, modelId, category, taken);

    const { error } = await db.from('crm_content_log').insert({
      model_id: modelId,
      category: category as ContentCategory,
      seq,
      label: (f.name ?? '').slice(0, 200),
      added_at: (f.createdAt ?? new Date().toISOString()).slice(0, 10),
      added_by: 'Drive',
      source: 'drive',
      drive_file_id: driveFileId,
      request_id: requestId,
      seen: false,
    });

    if (error) {
      // 23505 = doublon sur drive_file_id : le script a repassé sur un fichier
      // déjà enregistré, ce n'est pas une erreur.
      if (error.code === '23505') {
        skipped += 1;
        continue;
      }
      return NextResponse.json(
        { error: error.message, inserted, skipped },
        { status: 500 },
      );
    }

    nextSeq.set(category, seq + 1);
    inserted += 1;
    created.push({ category, seq, name: f.name ?? '' });
  }

  return NextResponse.json({ inserted, skipped, entries: created });
}
