import { NextResponse } from 'next/server';
import {
  getConnectedCreators,
  getCreatorTransactionsDebug,
  type InflowwTransaction,
} from '@/lib/infloww';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Les ventes récentes, toutes créatrices confondues.
 *
 * Le cron quotidien agrège : il répond à « combien ce mois-ci ». Cette route
 * fait l'inverse — elle garde chaque transaction telle quelle, pour répondre à
 * « que vient-il de se passer ». Rien n'est écrit en base : ce qui compte ici
 * est la fraîcheur, pas la conservation.
 *
 * La documentation Infloww ne décrit pas complètement l'objet transaction. On
 * lit donc chaque information par une liste de noms de champs plausibles, et on
 * expose un échantillon brut : si un champ nous échappe, il est visible dans la
 * réponse au lieu de disparaître en silence.
 */

const FAN_KEYS = [
  'fanName', 'fan_name', 'fanUserName', 'fanUsername',
  'userName', 'username', 'user_name',
  'customerName', 'customer_name', 'subscriberName',
  'nickName', 'nickname', 'displayName', 'name',
];

const FAN_ID_KEYS = ['fanId', 'fan_id', 'userId', 'user_id', 'customerId', 'subscriberId'];

const TIME_KEYS = [
  'createdTime', 'created_time', 'createdAt', 'created_at',
  'transactionTime', 'transaction_time', 'time', 'timestamp', 'date',
];

function pick(raw: Record<string, unknown>, keys: string[]): string {
  for (const k of keys) {
    const v = raw[k];
    if (v !== undefined && v !== null && String(v).trim() !== '') return String(v).trim();
  }
  return '';
}

/**
 * L'instant de la vente, ramené à une date ISO.
 *
 * Infloww mélange les formats : millisecondes depuis 1970 pour certains
 * champs, chaîne ISO pour d'autres. On accepte les deux plutôt que d'imposer
 * un format que l'API ne garantit pas.
 */
function toIso(v: string): string {
  if (!v) return '';
  if (/^\d{10}$/.test(v))  return new Date(Number(v) * 1000).toISOString();
  if (/^\d{13}$/.test(v))  return new Date(Number(v)).toISOString();
  const d = new Date(v);
  return isNaN(d.getTime()) ? '' : d.toISOString();
}

/** Le montant net, en dollars. Même règle que la synchronisation quotidienne. */
function amountOf(t: InflowwTransaction): number {
  const raw = t as Record<string, unknown>;
  const net = raw.net ?? raw.netAmount ?? raw.net_amount;
  const netNum = net !== undefined && net !== null ? Number(net) : null;
  if (netNum !== null && netNum > 0) return netNum / 100;
  const gross = raw.amount ?? raw.grossAmount ?? raw.gross_amount;
  if (gross !== undefined && Number(gross) > 0) {
    const fee = raw.fee ?? raw.platformFee ?? raw.platform_fee;
    return (Number(gross) - (fee !== undefined ? Number(fee) : 0)) / 100;
  }
  return 0;
}

export interface Sale {
  id: string;
  creator: string;
  fan: string;
  fanId: string;
  type: string;
  amount: number;
  at: string;
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  const hours = Math.min(Math.max(Number(params.get('hours') ?? 24), 1), 168);
  const limit = Math.min(Math.max(Number(params.get('limit') ?? 100), 1), 500);

  try {
    const { map } = await getConnectedCreators();
    if (map.size === 0) {
      return NextResponse.json({ sales: [], creators: [], erreurs: ['Aucune créatrice connectée.'] });
    }

    const end = new Date();
    const start = new Date(end.getTime() - hours * 3600 * 1000);
    const startISO = start.toISOString();
    const endISO = end.toISOString();

    // Toutes les créatrices en parallèle : en série, onze appels enchaînés
    // dépasseraient le temps d'exécution accordé à la route.
    const perCreator = await Promise.all(
      [...map.values()].map(async (ref) => {
        try {
          const { transactions } = await getCreatorTransactionsDebug(
            ref.id, startISO, endISO, ref.oid,
          );
          return { ref, transactions, erreur: null as string | null };
        } catch (e) {
          return { ref, transactions: [] as InflowwTransaction[], erreur: String(e) };
        }
      }),
    );

    const sales: Sale[] = [];
    const erreurs: string[] = [];
    let echantillonBrut: unknown = null;

    perCreator.forEach(({ ref, transactions, erreur }) => {
      if (erreur) erreurs.push(`${ref.userName} : ${erreur}`);
      transactions.forEach((t, i) => {
        const raw = t as Record<string, unknown>;
        if (!echantillonBrut) echantillonBrut = raw;
        const amount = amountOf(t);
        // Une vente à zéro n'est pas une vente : abonnements gratuits et
        // écritures techniques encombreraient le fil sans rien apprendre.
        if (amount <= 0) return;
        sales.push({
          id: String(raw.id ?? raw.transactionId ?? `${ref.userName}-${i}`),
          creator: ref.userName,
          fan: pick(raw, FAN_KEYS),
          fanId: pick(raw, FAN_ID_KEYS),
          type: String(t.type ?? t.transactionType ?? t.category ?? '—'),
          amount,
          at: toIso(pick(raw, TIME_KEYS)),
        });
      });
    });

    // Les plus récentes d'abord. Une transaction sans horodatage part en fin de
    // liste plutôt que d'être jetée — mieux vaut une vente mal située qu'une
    // vente invisible.
    sales.sort((a, b) => (b.at || '').localeCompare(a.at || ''));

    return NextResponse.json({
      sales: sales.slice(0, limit),
      total: sales.length,
      creators: [...map.values()].map((r) => r.userName).sort(),
      fenetre: { start: startISO, end: endISO, heures: hours },
      erreurs,
      // Le premier objet brut rencontré : il révèle les champs réellement
      // renvoyés, y compris ceux que la liste ci-dessus ne prévoit pas.
      echantillonBrut,
    });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
