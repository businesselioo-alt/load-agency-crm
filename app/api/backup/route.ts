import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Export intégral de la base, pour sauvegarde externe.
 *
 * Supabase en offre gratuite ne fait AUCUNE sauvegarde automatique : une
 * suppression accidentelle, un projet supprimé pour inactivité prolongée ou un
 * UPDATE sans WHERE effacent les données définitivement. Cette route existe
 * pour que la survie du CRM ne dépende pas d'un seul système.
 *
 * Elle renvoie toutes les tables sous forme de JSON, pagination comprise. Le
 * format brut — une ligne = un objet, noms de colonnes d'origine — est celui
 * qui se réimporte le plus fidèlement. Un CSV perdrait les types et les
 * colonnes JSONB.
 *
 * ⚠️ La réponse contient l'intégralité des données personnelles des
 * créatrices. La route est protégée par le même secret que la synchronisation
 * Drive, et le fichier produit doit atterrir dans un dossier privé.
 */

const TABLES = [
  // Cœur du CRM
  'crm_models',
  'crm_model_billing',
  'crm_model_folder',
  'crm_commission_invoices',
  'crm_agency_settings',
  'crm_content_log',
  'crm_content_request',
  'crm_content_tracking',
  'crm_resource',
  'crm_invoices',
  'crm_users',
  // Modules annexes
  'chat_chatters',
  'chat_plan_models',
  'chat_recaps',
  'chat_shift_plans',
  'sfs_planning_models',
  'sfs_planning_slots',
  'sfs_rows',
  'vg_daily_entries',
  'vg_model_stats',
];

const PAGE = 1000;

function serverClient() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.SUPABASE_SERVICE_ROLE_KEY ?? process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;
  if (!url || !key) return null;
  return createClient(url, key, { auth: { persistSession: false } });
}

function authorized(req: Request): 'ok' | 'not_configured' | 'invalid' {
  const expected = process.env.DRIVE_INGEST_SECRET;
  if (!expected) return 'not_configured';
  const got = req.headers.get('x-ingest-secret') ?? '';
  if (got.length !== expected.length) return 'invalid';
  let diff = 0;
  for (let i = 0; i < expected.length; i += 1) diff |= got.charCodeAt(i) ^ expected.charCodeAt(i);
  return diff === 0 ? 'ok' : 'invalid';
}

/** Lit une table entière, par pages, pour ne pas dépendre d'une limite serveur. */
async function dumpTable(
  db: NonNullable<ReturnType<typeof serverClient>>,
  table: string,
): Promise<{ rows: unknown[]; error?: string }> {
  const rows: unknown[] = [];
  for (let from = 0; ; from += PAGE) {
    const { data, error } = await db.from(table).select('*').range(from, from + PAGE - 1);
    if (error) {
      // Une table absente n'est pas un échec de sauvegarde : le schéma évolue,
      // et refuser d'exporter les 19 autres pour ça serait absurde.
      return { rows, error: error.message };
    }
    if (!data || data.length === 0) break;
    rows.push(...data);
    if (data.length < PAGE) break;
  }
  return { rows };
}

export async function GET(req: Request) {
  const auth = authorized(req);
  if (auth === 'not_configured') {
    return NextResponse.json(
      { error: "DRIVE_INGEST_SECRET n'est pas défini sur le serveur." },
      { status: 501 },
    );
  }
  if (auth === 'invalid') {
    return NextResponse.json({ error: 'Secret invalide.' }, { status: 401 });
  }

  const db = serverClient();
  if (!db) return NextResponse.json({ error: 'Supabase non configuré.' }, { status: 501 });

  const tables: Record<string, unknown[]> = {};
  const skipped: Record<string, string> = {};
  let total = 0;

  for (const table of TABLES) {
    const { rows, error } = await dumpTable(db, table);
    if (error && rows.length === 0) {
      skipped[table] = error;
      continue;
    }
    tables[table] = rows;
    total += rows.length;
  }

  return NextResponse.json({
    generatedAt: new Date().toISOString(),
    source: process.env.NEXT_PUBLIC_SUPABASE_URL ?? '',
    totalRows: total,
    tableCount: Object.keys(tables).length,
    skipped,
    tables,
  });
}
