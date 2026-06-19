import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';

export async function GET() {
  const url = process.env.NEXT_PUBLIC_SUPABASE_URL;
  const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY;

  const envStatus = {
    NEXT_PUBLIC_SUPABASE_URL: url
      ? `✅ défini (${url})`
      : '❌ MANQUANT',
    NEXT_PUBLIC_SUPABASE_ANON_KEY: key
      ? `✅ défini (${key.slice(0, 20)}...)`
      : '❌ MANQUANT',
  };

  if (!url || !key) {
    return NextResponse.json({
      status: 'ERREUR',
      message: 'Variables d\'environnement manquantes — ajoute-les dans Vercel → Settings → Environment Variables',
      env: envStatus,
    }, { status: 500 });
  }

  try {
    const supabase = createClient(url, key);
    const { data, error, count } = await supabase
      .from('crm_users')
      .select('id, email, role, status', { count: 'exact' })
      .limit(10);

    if (error) {
      return NextResponse.json({
        status: 'ERREUR SUPABASE',
        message: error.message,
        code: error.code,
        env: envStatus,
      }, { status: 500 });
    }

    return NextResponse.json({
      status: '✅ CONNEXION OK',
      utilisateurs_en_base: count ?? data?.length ?? 0,
      comptes: data?.map((u) => ({ email: u.email, role: u.role, status: u.status })),
      env: envStatus,
    });
  } catch (e) {
    return NextResponse.json({
      status: 'EXCEPTION',
      message: String(e),
      env: envStatus,
    }, { status: 500 });
  }
}
