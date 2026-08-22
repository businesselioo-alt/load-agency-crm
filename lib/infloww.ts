import 'server-only';

const BASE = 'https://openapi.infloww.com/v1';

interface InflowwCreator {
  id: number | string;
  userName: string;
  [key: string]: unknown;
}

export interface InflowwTransaction {
  // Amount fields (cents)
  net?: number;
  amount?: number;
  fee?: number;
  netAmount?: number;
  net_amount?: number;
  grossAmount?: number;
  gross_amount?: number;
  platformFee?: number;
  platform_fee?: number;
  // Type / status
  type?: string;
  transactionType?: string;
  category?: string;
  status?: string;
  state?: string;
  transactionStatus?: string;
  // Sub-specific fields that might distinguish new vs renewal
  isNew?: boolean;
  is_new?: boolean;
  subscriptionType?: string;
  subscription_type?: string;
  [key: string]: unknown;
}

// Type values (lowercased) that mean a brand-new subscription
const NEW_SUB_TYPES = new Set(['subscribe', 'subscription', 'new_subscription', 'newsub', 'new sub']);

// Type values (lowercased) that are renewals — never count as new
const RENEWAL_TYPES = new Set(['rebill', 'renewal', 'renewed', 'renewedsubscription', 'recurring', 'resubscribe']);

/**
 * Les pôles configurés.
 *
 * L'en-tête `x-oid` désigne une organisation Infloww — un pôle. Une seule
 * valeur ne montre qu'un pôle, et les créatrices des autres restent invisibles
 * sans qu'aucune erreur ne le signale : l'API répond 200 avec une liste courte.
 *
 * INFLOWW_OID accepte donc plusieurs identifiants séparés par des virgules.
 * Une valeur unique continue de fonctionner à l'identique.
 */
export function inflowwOids(): string[] {
  return (process.env.INFLOWW_OID ?? '')
    .split(',')
    .map((o) => o.trim())
    .filter(Boolean);
}

/**
 * Tentative « sans pôle » : on interroge l'API en omettant complètement
 * l'en-tête x-oid, pour voir si elle renvoie alors les créatrices qui
 * n'appartiennent à aucun pôle. On ne sait pas si l'API l'accepte — c'est
 * précisément ce que ce passage sert à déterminer, sans rien casser : si elle
 * refuse, l'erreur est consignée et les autres pôles remontent quand même.
 */
export const SANS_POLE = '__sans_pole__';

function inflowwHeaders(oid?: string): Record<string, string> {
  const base: Record<string, string> = {
    Authorization: process.env.INFLOWW_API_KEY ?? '',
    'Content-Type': 'application/json',
  };
  if (oid === SANS_POLE) return base;
  base['x-oid'] = oid ?? inflowwOids()[0] ?? '';
  return base;
}

// ─── Creators ────────────────────────────────────────────────────────────────

/** Une créatrice et le pôle dans lequel elle a été trouvée. */
export interface CreatorRef {
  id: number;
  oid: string;
}

export interface CreatorsDebug {
  totalFound: number;
  /** Nombre de créatrices remontées par pôle — le premier chiffre à regarder. */
  byOid: Record<string, number>;
  /** Pôles dont l'appel a échoué, avec le motif. */
  oidErrors: Record<string, string>;
  /** Usernames vus dans plusieurs pôles : le premier rencontré l'emporte. */
  duplicates: string[];
  rawFirstPageKeys: string[];
  rawFirstPageDataKeys: string[];
  listPath: string;
  sampleCreatorKeys: string[];
  allUserNames: string[];
  // Complete unfiltered object for louvalmont (or first creator as fallback).
  // Exposes any undocumented fields (subscriberCount, totalFans, etc.) present
  // in the real API response that the docs sample payloads omit.
  rawLouValmontFull: unknown;
}

export async function getConnectedCreators(): Promise<{
  map: Map<string, CreatorRef>;
  /** L'objet brut de chaque créatrice, pour en dériver un nom lisible. */
  raw: Map<string, Record<string, unknown>>;
  debug: CreatorsDebug;
}> {
  const map = new Map<string, CreatorRef>();
  const raw = new Map<string, Record<string, unknown>>();
  let firstPageRaw: Record<string, unknown> | null = null;
  let listPath = 'unknown';
  let sampleCreatorKeys: string[] = [];
  let rawLouValmontFull: unknown = null;
  let rawFirstCreatorFull: unknown = null; // fallback if louvalmont not found

  const byOid: Record<string, number> = {};
  const oidErrors: Record<string, string> = {};
  const duplicates: string[] = [];

  const configured = inflowwOids();
  if (configured.length === 0) {
    console.log('[infloww] AUCUN pôle configuré — INFLOWW_OID est vide.');
  }

  // Chaque pôle, puis un passage sans en-tête de pôle pour ratisser les
  // créatrices qui n'en ont pas. L'ordre compte : les pôles d'abord, pour que
  // byOid attribue chaque créatrice à son pôle réel plutôt qu'au fourre-tout.
  const attempts = [...configured, SANS_POLE];

  // Un pôle à la fois : l'API n'accepte qu'un x-oid par requête.
  for (const oid of attempts) {
  let cursor: string | undefined;
  byOid[oid] = 0;

  try {
    do {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) params.set('cursor', cursor);
      const url = `${BASE}/creators?${params}`;
      console.log('[infloww] GET', url);

      const res = await fetch(url, { headers: inflowwHeaders(oid), cache: 'no-store' });
      console.log('[infloww] creators status:', res.status, '| oid:', oid);
      if (!res.ok) {
        const body = await res.text();
        console.log('[infloww] creators error body:', body);
        oidErrors[oid] = `HTTP ${res.status} — ${body.slice(0, 200)}`;
        break;
      }

      const json: Record<string, unknown> = await res.json();
      if (!firstPageRaw) firstPageRaw = json;
      console.log('[infloww] creators raw top-level keys:', Object.keys(json));

      const d = json.data as Record<string, unknown> | undefined;
      let list: InflowwCreator[] = [];
      if (Array.isArray(d?.list))          { list = d!.list as InflowwCreator[];          listPath = 'data.list'; }
      else if (Array.isArray(d?.creators)) { list = d!.creators as InflowwCreator[];      listPath = 'data.creators'; }
      else if (Array.isArray(json.data))   { list = json.data as InflowwCreator[];        listPath = 'data'; }
      else if (Array.isArray(json.list))   { list = json.list as InflowwCreator[];        listPath = 'list'; }
      else if (Array.isArray(json.creators)){ list = json.creators as InflowwCreator[];   listPath = 'creators'; }
      else if (Array.isArray(json.result)) { list = json.result as InflowwCreator[];      listPath = 'result'; }
      else if (Array.isArray(json.items))  { list = json.items as InflowwCreator[];       listPath = 'items'; }

      console.log('[infloww] creators list at:', listPath, '| count:', list.length);
      if (list.length > 0) {
        sampleCreatorKeys = Object.keys(list[0] as object);
        console.log('[infloww] first creator raw:', JSON.stringify(list[0]));
      }

      for (const c of list) {
        const raw2 = c as Record<string, unknown>;
        const id   = raw2.id ?? raw2.creatorId ?? raw2.creator_id;
        const name = raw2.userName ?? raw2.username ?? raw2.user_name ?? raw2.name;
        if (name && id) {
          const key = String(name);
          // Une créatrice présente dans deux pôles ne doit être comptée qu'une
          // fois : la synchroniser deux fois doublerait son chiffre d'affaires.
          if (map.has(key)) {
            if (!duplicates.includes(key)) duplicates.push(key);
            continue;
          }
          map.set(key, { id: Number(id), oid });
          raw.set(key, raw2);
          byOid[oid] += 1;
          // Capture the full unfiltered object — we're looking for undocumented
          // subscriber-count fields (subscriberCount, totalFans, activeSubscribers…)
          if (!rawFirstCreatorFull) rawFirstCreatorFull = raw2;
          if (String(name) === 'louvalmont') {
            rawLouValmontFull = raw2;
            console.log('[infloww] louvalmont FULL raw object:', JSON.stringify(raw2));
          }
        }
      }

      const hasMore    = json.hasMore    ?? d?.hasMore    ?? json.has_more;
      const nextCursor = json.cursor     ?? d?.cursor     ?? json.nextCursor ?? json.next_cursor;
      cursor = hasMore ? String(nextCursor ?? '') || undefined : undefined;
    } while (cursor);
  } catch (e) {
    console.log('[infloww] getConnectedCreators exception:', e);
    oidErrors[oid] = String(e);
  }
  }

  console.log('[infloww] creatorsMap size:', map.size, '| userNames:', [...map.keys()]);

  return {
    map,
    raw,
    debug: {
      totalFound: map.size,
      byOid,
      oidErrors,
      duplicates,
      rawFirstPageKeys: firstPageRaw ? Object.keys(firstPageRaw) : [],
      rawFirstPageDataKeys:
        firstPageRaw?.data && typeof firstPageRaw.data === 'object' && !Array.isArray(firstPageRaw.data)
          ? Object.keys(firstPageRaw.data as object)
          : [],
      listPath,
      sampleCreatorKeys,
      allUserNames: [...map.keys()],
      // Full raw object — louvalmont if found, otherwise first creator in list.
      // This is the most important debug field: it reveals every field the API
      // actually returns, including any subscriber-count fields not in the docs.
      rawLouValmontFull: rawLouValmontFull ?? rawFirstCreatorFull,
    },
  };
}

// ─── Transactions ─────────────────────────────────────────────────────────────

export interface TransactionsDebug {
  url: string;           // exact URL sent (including all query params)
  status: number;        // HTTP status of first request
  httpErrorBody: string | null;   // full raw body when status !== 2xx
  rawFirstPageFull: unknown;      // complete first-page JSON (not just keys)
  rawFirstPageKeys: string[];
  listPath: string;
  totalCount: number;
  firstRawTransaction: unknown;
  exception: string | null;       // stringified exception if fetch threw
}

export async function getCreatorTransactionsDebug(
  creatorId: number,
  startTime: string,
  endTime: string,
  oid?: string,
): Promise<{ transactions: InflowwTransaction[]; debug: TransactionsDebug }> {
  const all: InflowwTransaction[] = [];
  let cursor: string | undefined;
  let firstPageRaw: Record<string, unknown> | null = null;
  let listPath = 'unknown';
  let firstStatus = 0;
  let firstUrl = '';
  let httpErrorBody: string | null = null;
  let exceptionStr: string | null = null;

  try {
    do {
      const params = new URLSearchParams({
        creatorId: String(creatorId),
        platformCode: 'OnlyFans',
        startTime,
        endTime,
        limit: '100',
      });
      if (cursor) params.set('cursor', cursor);
      const url = `${BASE}/transactions?${params}`;
      if (!firstUrl) firstUrl = url;
      console.log('[infloww] GET', url);

      const res = await fetch(url, { headers: inflowwHeaders(oid), cache: 'no-store' });
      if (!firstStatus) firstStatus = res.status;
      console.log('[infloww] transactions status:', res.status);

      if (!res.ok) {
        httpErrorBody = await res.text();
        console.log('[infloww] transactions error body:', httpErrorBody);
        break;  // stop pagination on error
      }

      const json: Record<string, unknown> = await res.json();
      if (!firstPageRaw) firstPageRaw = json;
      console.log('[infloww] transactions raw first-page:', JSON.stringify(json).slice(0, 500));

      const td = json.data as Record<string, unknown> | undefined;
      let list: InflowwTransaction[] = [];
      if (Array.isArray(td?.list))              { list = td!.list as InflowwTransaction[];         listPath = 'data.list'; }
      else if (Array.isArray(td?.transactions)) { list = td!.transactions as InflowwTransaction[]; listPath = 'data.transactions'; }
      else if (Array.isArray(json.data))        { list = json.data as InflowwTransaction[];        listPath = 'data'; }
      else if (Array.isArray(json.list))        { list = json.list as InflowwTransaction[];        listPath = 'list'; }
      else if (Array.isArray(json.transactions)){ list = json.transactions as InflowwTransaction[];listPath = 'transactions'; }
      else if (Array.isArray(json.result))      { list = json.result as InflowwTransaction[];      listPath = 'result'; }
      else if (Array.isArray(json.items))       { list = json.items as InflowwTransaction[];       listPath = 'items'; }

      console.log('[infloww] transactions list at:', listPath, '| count:', list.length);
      if (list.length > 0) {
        console.log('[infloww] first transaction raw:', JSON.stringify(list[0]));
      }

      all.push(...list);
      const hasMore    = json.hasMore    ?? td?.hasMore    ?? json.has_more;
      const nextCursor = json.cursor     ?? td?.cursor     ?? json.nextCursor;
      cursor = hasMore ? String(nextCursor ?? '') || undefined : undefined;
    } while (cursor);
  } catch (e) {
    exceptionStr = String(e);
    console.log('[infloww] getCreatorTransactions exception:', e);
  }

  return {
    transactions: all,
    debug: {
      url: firstUrl,
      status: firstStatus,
      httpErrorBody,
      rawFirstPageFull: firstPageRaw,   // full JSON — shows exact API response shape
      rawFirstPageKeys: firstPageRaw ? Object.keys(firstPageRaw) : [],
      listPath,
      totalCount: all.length,
      firstRawTransaction: all[0] ?? null,
      exception: exceptionStr,
    },
  };
}

// ─── Revenue + subs calculation ───────────────────────────────────────────────

export interface SumDebug {
  totalInput: number;
  excludedPending: number;
  includedCount: number;
  revenueField: string;
  zeroNetCount: number;     // txns where net=0 → fell back to (amount-fee)/100
  distinctTypes: Record<string, number>;
  distinctStatuses: Record<string, number>;
  revenueByType: Record<string, number>;
  sampleByType: Record<string, unknown>;
}

export interface SumResult {
  revenue: number;
  newSubs: number;
  debug: SumDebug;
}

export function sumTransactions(txns: InflowwTransaction[]): SumResult {
  let revenue = 0;
  let newSubs = 0;
  let revenueField = 'none';
  let zeroNetCount = 0;
  const distinctTypes: Record<string, number>    = {};
  const distinctStatuses: Record<string, number> = {};
  const sampleByType: Record<string, unknown>    = {};

  for (const t of txns) {
    const raw = t as Record<string, unknown>;

    // Track status distribution (informational only — no exclusion)
    const rawStatus = String(t.status ?? t.state ?? t.transactionStatus ?? '');
    if (rawStatus) distinctStatuses[rawStatus] = (distinctStatuses[rawStatus] ?? 0) + 1;

    // Track type distribution + sample per type
    const rawType = String(t.type ?? t.transactionType ?? t.category ?? '');
    const type    = rawType.toLowerCase();
    if (rawType) {
      distinctTypes[rawType] = (distinctTypes[rawType] ?? 0) + 1;
      if (!sampleByType[rawType]) sampleByType[rawType] = t; // capture full raw object
    }

    // ── Revenue (amounts are in cents → divide by 100) ────────────────────
    // Priority: net > amount-fee > amount
    // IMPORTANT: treat net=0 same as absent — "loading" txns have net=0
    // while amount is already set. Falling back to (amount-fee)/100 avoids
    // the gap caused by summing 0 for every pending transaction.
    const netVal = raw.net ?? t.netAmount ?? t.net_amount;
    const netNum = netVal !== undefined && netVal !== null ? Number(netVal) : null;
    if (netNum !== null && netNum > 0) {
      revenue += netNum / 100;
      if (revenueField === 'none') revenueField = 'net/100';
    } else {
      if (netNum === 0) zeroNetCount++;
      const gross  = raw.amount ?? raw.grossAmount ?? raw.gross_amount;
      const feeVal = raw.fee ?? raw.platformFee ?? raw.platform_fee;
      if (gross !== undefined && Number(gross) > 0) {
        const g = Number(gross);
        const f = feeVal !== undefined ? Number(feeVal) : 0;
        revenue += (g - f) / 100;
        if (revenueField === 'none') revenueField = feeVal !== undefined ? '(amount-fee)/100' : 'amount/100';
      }
    }

    // ── New subs ──────────────────────────────────────────────────────────
    // Count as new sub ONLY if type signals new subscription AND not a renewal
    const isNewSubType = NEW_SUB_TYPES.has(type) && !RENEWAL_TYPES.has(type);

    // Also check for explicit isNew / subscriptionType fields if available
    const explicitNew = raw.isNew ?? raw.is_new;
    const subType     = String(raw.subscriptionType ?? raw.subscription_type ?? '').toLowerCase();

    if (isNewSubType) {
      // If the API provides an explicit renewal flag, respect it
      if (explicitNew === false || RENEWAL_TYPES.has(subType)) {
        // it's actually a renewal — skip
      } else {
        newSubs++;
      }
    }
  }

  // Per-type revenue breakdown (same zero-net fallback logic)
  const revenueByType: Record<string, number> = {};
  for (const t of txns) {
    const raw     = t as Record<string, unknown>;
    const rawType = String(t.type ?? t.transactionType ?? t.category ?? 'unknown');
    const netVal  = raw.net ?? t.netAmount ?? t.net_amount;
    const netNum  = netVal !== undefined && netVal !== null ? Number(netVal) : null;
    let amt = 0;
    if (netNum !== null && netNum > 0) {
      amt = netNum / 100;
    } else {
      const gross  = raw.amount ?? raw.grossAmount ?? raw.gross_amount;
      const feeVal = raw.fee ?? raw.platformFee ?? raw.platform_fee;
      if (gross !== undefined && Number(gross) > 0) {
        amt = (Number(gross) - (feeVal !== undefined ? Number(feeVal) : 0)) / 100;
      }
    }
    revenueByType[rawType] = (revenueByType[rawType] ?? 0) + amt;
  }

  console.log('[infloww] sumTransactions: total=%d revenue=%.2f newSubs=%d revenueField=%s zeroNetCount=%d',
    txns.length, revenue, newSubs, revenueField, zeroNetCount);
  console.log('[infloww] revenueByType:', JSON.stringify(revenueByType));
  console.log('[infloww] distinctTypes:', JSON.stringify(distinctTypes));
  console.log('[infloww] distinctStatuses:', JSON.stringify(distinctStatuses));

  return {
    revenue,
    newSubs,
    debug: {
      totalInput: txns.length,
      excludedPending: 0,
      includedCount: txns.length,
      revenueField,
      zeroNetCount,
      distinctTypes,
      revenueByType,
      distinctStatuses,
      sampleByType,
    },
  };
}

export async function getCreatorEarnings(
  creatorId: number,
  date: string,
): Promise<SumResult> {
  const startTime = `${date}T00:00:00.000Z`;
  const endTime   = `${date}T23:59:59.999Z`;
  console.log(`[infloww] getCreatorEarnings creatorId=${creatorId} date=${date} range=[${startTime} → ${endTime}]`);
  const { transactions } = await getCreatorTransactionsDebug(creatorId, startTime, endTime);
  return sumTransactions(transactions);
}

export async function getCreatorEarningsRange(
  creatorId: number,
  startDate: string,
  endDate: string,
): Promise<SumResult> {
  const { transactions } = await getCreatorTransactionsDebug(
    creatorId,
    `${startDate}T00:00:00.000Z`,
    `${endDate}T23:59:59.999Z`,
  );
  return sumTransactions(transactions);
}

// Fetch refund total for a creator over a time range (in dollars).
// Infloww docs list GET /v1/refunds — amounts are in cents like transactions.
export async function getCreatorRefunds(
  creatorId: number,
  startTime: string,
  endTime: string,
  oid?: string,
): Promise<{ total: number; count: number; rawFirst: unknown }> {
  const all: Record<string, unknown>[] = [];
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({
        creatorId: String(creatorId),
        platformCode: 'OnlyFans',
        startTime,
        endTime,
        limit: '100',
      });
      if (cursor) params.set('cursor', cursor);
      const url = `${BASE}/refunds?${params}`;
      console.log('[infloww] GET', url);

      const res = await fetch(url, { headers: inflowwHeaders(oid), cache: 'no-store' });
      console.log('[infloww] refunds status:', res.status);
      if (!res.ok) { console.log('[infloww] refunds error:', await res.text()); break; }

      const json: Record<string, unknown> = await res.json();
      const rd = json.data as Record<string, unknown> | undefined;
      let list: Record<string, unknown>[] = [];
      if (Array.isArray(rd?.list))      { list = rd!.list as Record<string, unknown>[]; }
      else if (Array.isArray(json.data)){ list = json.data as Record<string, unknown>[]; }
      else if (Array.isArray(json.list)){ list = json.list as Record<string, unknown>[]; }
      all.push(...list);

      const hasMore    = json.hasMore ?? rd?.hasMore;
      const nextCursor = json.cursor  ?? rd?.cursor;
      cursor = hasMore ? String(nextCursor ?? '') || undefined : undefined;
    } while (cursor);
  } catch (e) {
    console.log('[infloww] getCreatorRefunds exception:', e);
  }

  // Sum refund amounts (same logic as transactions: net > amount-fee > amount, ÷100)
  let total = 0;
  for (const r of all) {
    const netVal = r.net ?? r.netAmount ?? r.net_amount;
    const netNum = netVal !== undefined && netVal !== null ? Number(netVal) : null;
    if (netNum !== null && netNum > 0) {
      total += netNum / 100;
    } else {
      const gross  = r.amount ?? r.grossAmount;
      const feeVal = r.fee ?? r.platformFee;
      if (gross !== undefined && Number(gross) > 0) {
        total += (Number(gross) - (feeVal !== undefined ? Number(feeVal) : 0)) / 100;
      }
    }
  }

  return { total, count: all.length, rawFirst: all[0] ?? null };
}
