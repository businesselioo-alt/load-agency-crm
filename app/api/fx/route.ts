import { NextResponse } from 'next/server';

/**
 * Taux de change de référence, côté serveur.
 *
 * Source : Frankfurter (https://frankfurter.dev), qui rediffuse les taux de
 * référence publiés par la Banque centrale européenne. Gratuit, sans clé.
 *
 * La BCE publie un taux par jour ouvré vers 16h CET — ce n'est pas de
 * l'intraday, et c'est voulu : une facture doit porter un taux officiel et
 * daté, pas une valeur qui change à chaque rafraîchissement de page.
 *
 * L'appel passe par le serveur pour éviter les blocages CORS et pour que la
 * réponse soit mise en cache 1 h côté Vercel plutôt qu'une requête par visite.
 */

const BASE = 'https://api.frankfurter.dev/v1';
const SUPPORTED = ['EUR', 'USD', 'GBP', 'AUD'];

export const revalidate = 3600;

export async function GET(req: Request) {
  const { searchParams } = new URL(req.url);
  const from = (searchParams.get('from') ?? '').toUpperCase();
  const to = (searchParams.get('to') ?? 'USD').toUpperCase();

  if (!SUPPORTED.includes(from) || !SUPPORTED.includes(to)) {
    return NextResponse.json(
      { error: `Devises acceptées : ${SUPPORTED.join(', ')}.` },
      { status: 400 },
    );
  }

  // Même devise : pas de conversion, pas d'appel réseau.
  if (from === to) {
    return NextResponse.json({
      rate: 1,
      from,
      to,
      date: new Date().toISOString().slice(0, 10),
      source: 'identité',
    });
  }

  try {
    const res = await fetch(`${BASE}/latest?base=${from}&symbols=${to}`, {
      next: { revalidate: 3600 },
    });
    if (!res.ok) {
      return NextResponse.json(
        { error: `Le service de taux a répondu ${res.status}.` },
        { status: 502 },
      );
    }
    const data = (await res.json()) as { date?: string; rates?: Record<string, number> };
    const rate = data.rates?.[to];
    if (typeof rate !== 'number' || !(rate > 0)) {
      return NextResponse.json({ error: 'Taux introuvable.' }, { status: 502 });
    }
    return NextResponse.json({
      rate,
      from,
      to,
      date: data.date ?? new Date().toISOString().slice(0, 10),
      source: 'BCE',
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Service de taux injoignable.' },
      { status: 502 },
    );
  }
}
