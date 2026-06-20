import 'server-only';

const BASE = 'https://openapi.infloww.com/v1';

interface InflowwCreator {
  id: number | string;
  userName: string;
  [key: string]: unknown;
}

export interface InflowwTransaction {
  amount?: number;
  netAmount?: number;
  totalAmount?: number;
  price?: number;
  grossAmount?: number;
  earnedAmount?: number;
  payout?: number;
  type?: string;
  transactionType?: string;
  category?: string;
  [key: string]: unknown;
}

function inflowwHeaders(): Record<string, string> {
  return {
    Authorization: process.env.INFLOWW_API_KEY ?? '',
    'x-oid': process.env.INFLOWW_OID ?? '',
    'Content-Type': 'application/json',
  };
}

export interface CreatorsDebug {
  totalFound: number;
  rawFirstPageKeys: string[];        // top-level keys of first response
  rawFirstPageDataKeys: string[];    // keys inside .data if it exists
  listPath: string;                  // where the list was actually found
  sampleCreatorKeys: string[];       // keys of first creator object
  allUserNames: string[];            // all userNames extracted
}

// Returns map of userName → creatorId for all connected creators
export async function getConnectedCreators(): Promise<{ map: Map<string, number>; debug: CreatorsDebug }> {
  const map = new Map<string, number>();
  let cursor: string | undefined;
  let firstPageRaw: Record<string, unknown> | null = null;
  let listPath = 'unknown';

  try {
    do {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) params.set('cursor', cursor);
      const url = `${BASE}/creators?${params}`;
      console.log('[infloww] GET', url);

      const res = await fetch(url, { headers: inflowwHeaders(), cache: 'no-store' });
      console.log('[infloww] creators status:', res.status);
      if (!res.ok) {
        const body = await res.text();
        console.log('[infloww] creators error body:', body);
        break;
      }

      const json: Record<string, unknown> = await res.json();
      if (!firstPageRaw) firstPageRaw = json;
      console.log('[infloww] creators raw top-level keys:', Object.keys(json));

      // Try to find the list in various locations
      const d = json.data as Record<string, unknown> | undefined;
      let list: InflowwCreator[] = [];
      if (Array.isArray(d?.list)) {
        list = d!.list as InflowwCreator[];
        listPath = 'data.list';
      } else if (Array.isArray(json.data)) {
        list = json.data as InflowwCreator[];
        listPath = 'data';
      } else if (Array.isArray(json.list)) {
        list = json.list as InflowwCreator[];
        listPath = 'list';
      } else if (Array.isArray(json.creators)) {
        list = json.creators as InflowwCreator[];
        listPath = 'creators';
      } else if (Array.isArray(json.result)) {
        list = json.result as InflowwCreator[];
        listPath = 'result';
      } else if (Array.isArray(json.items)) {
        list = json.items as InflowwCreator[];
        listPath = 'items';
      }

      console.log('[infloww] creators list found at:', listPath, '| count:', list.length);
      if (list.length > 0) {
        console.log('[infloww] first creator raw object:', JSON.stringify(list[0]));
      }

      for (const c of list) {
        // Try common id/userName field name variants
        const id   = c.id ?? (c as Record<string, unknown>).creatorId ?? (c as Record<string, unknown>).creator_id;
        const name = c.userName ?? (c as Record<string, unknown>).username ?? (c as Record<string, unknown>).user_name ?? (c as Record<string, unknown>).name;
        if (name && id) map.set(String(name), Number(id));
      }

      // Try cursor in various locations
      const hasMore = json.hasMore ?? d?.hasMore ?? json.has_more;
      const nextCursor = json.cursor ?? d?.cursor ?? json.nextCursor ?? json.next_cursor;
      cursor = hasMore ? String(nextCursor ?? '') : undefined;
    } while (cursor);
  } catch (e) {
    console.log('[infloww] getConnectedCreators exception:', e);
  }

  const debug: CreatorsDebug = {
    totalFound: map.size,
    rawFirstPageKeys: firstPageRaw ? Object.keys(firstPageRaw) : [],
    rawFirstPageDataKeys: firstPageRaw?.data && typeof firstPageRaw.data === 'object' && !Array.isArray(firstPageRaw.data)
      ? Object.keys(firstPageRaw.data as object)
      : [],
    listPath,
    sampleCreatorKeys: [],
    allUserNames: [...map.keys()],
  };

  console.log('[infloww] creatorsMap size:', map.size, '| userNames:', [...map.keys()]);
  return { map, debug };
}

export interface TransactionsDebug {
  url: string;
  status: number;
  rawFirstPageKeys: string[];
  listPath: string;
  totalCount: number;
  firstRawTransaction: unknown;
}

export async function getCreatorTransactionsDebug(
  creatorId: number,
  startTime: string,
  endTime: string,
): Promise<{ transactions: InflowwTransaction[]; debug: TransactionsDebug }> {
  const all: InflowwTransaction[] = [];
  let cursor: string | undefined;
  let firstPageRaw: Record<string, unknown> | null = null;
  let listPath = 'unknown';
  let firstStatus = 0;
  let firstUrl = '';

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

      const res = await fetch(url, { headers: inflowwHeaders(), cache: 'no-store' });
      if (!firstStatus) firstStatus = res.status;
      console.log('[infloww] transactions status:', res.status);

      if (!res.ok) {
        const body = await res.text();
        console.log('[infloww] transactions error body:', body);
        break;
      }

      const json: Record<string, unknown> = await res.json();
      if (!firstPageRaw) firstPageRaw = json;
      console.log('[infloww] transactions raw top-level keys:', Object.keys(json));

      const td = json.data as Record<string, unknown> | undefined;
      let list: InflowwTransaction[] = [];
      if (Array.isArray(td?.list)) {
        list = td!.list as InflowwTransaction[];
        listPath = 'data.list';
      } else if (Array.isArray(td?.transactions)) {
        list = td!.transactions as InflowwTransaction[];
        listPath = 'data.transactions';
      } else if (Array.isArray(json.data)) {
        list = json.data as InflowwTransaction[];
        listPath = 'data';
      } else if (Array.isArray(json.list)) {
        list = json.list as InflowwTransaction[];
        listPath = 'list';
      } else if (Array.isArray(json.transactions)) {
        list = json.transactions as InflowwTransaction[];
        listPath = 'transactions';
      } else if (Array.isArray(json.result)) {
        list = json.result as InflowwTransaction[];
        listPath = 'result';
      } else if (Array.isArray(json.items)) {
        list = json.items as InflowwTransaction[];
        listPath = 'items';
      }

      console.log('[infloww] transactions list at:', listPath, '| count:', list.length);
      if (list.length > 0) {
        console.log('[infloww] first transaction raw:', JSON.stringify(list[0]));
      }

      all.push(...list);
      const hasMore = json.hasMore ?? td?.hasMore ?? json.has_more;
      const nextCursor = json.cursor ?? td?.cursor ?? json.nextCursor;
      cursor = hasMore ? String(nextCursor ?? '') : undefined;
    } while (cursor);
  } catch (e) {
    console.log('[infloww] getCreatorTransactions exception:', e);
  }

  const debug: TransactionsDebug = {
    url: firstUrl,
    status: firstStatus,
    rawFirstPageKeys: firstPageRaw ? Object.keys(firstPageRaw) : [],
    listPath,
    totalCount: all.length,
    firstRawTransaction: all[0] ?? null,
  };

  return { transactions: all, debug };
}

export function sumTransactions(txns: InflowwTransaction[]): { revenue: number; newSubs: number } {
  let revenue = 0;
  let newSubs = 0;
  for (const t of txns) {
    // Try all known amount field names
    const amt = Number(
      t.amount ?? t.netAmount ?? t.totalAmount ?? t.price ??
      t.grossAmount ?? t.earnedAmount ?? t.payout ?? 0,
    );
    if (!isNaN(amt)) revenue += amt;

    const type = String(t.type ?? t.transactionType ?? t.category ?? '').toLowerCase();
    if (type.includes('subscribe') && !type.includes('unsubscribe')) newSubs++;
  }
  return { revenue, newSubs };
}

export async function getCreatorEarnings(
  creatorId: number,
  date: string,
): Promise<{ revenue: number; newSubs: number }> {
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
): Promise<{ revenue: number; newSubs: number }> {
  const { transactions } = await getCreatorTransactionsDebug(
    creatorId,
    `${startDate}T00:00:00.000Z`,
    `${endDate}T23:59:59.999Z`,
  );
  return sumTransactions(transactions);
}
