import 'server-only';

const BASE = 'https://openapi.infloww.com/v1';

interface InflowwCreator {
  id: number | string;
  userName: string;
  [key: string]: unknown;
}

interface InflowwTransaction {
  amount?: number;
  netAmount?: number;
  totalAmount?: number;
  type?: string;
  transactionType?: string;
  [key: string]: unknown;
}

function inflowwHeaders(): Record<string, string> {
  return {
    Authorization: process.env.INFLOWW_API_KEY ?? '',
    'x-oid': process.env.INFLOWW_OID ?? '',
    'Content-Type': 'application/json',
  };
}

// Returns map of userName → creatorId for all connected creators
export async function getConnectedCreators(): Promise<Map<string, number>> {
  const map = new Map<string, number>();
  let cursor: string | undefined;

  try {
    do {
      const params = new URLSearchParams({ limit: '100' });
      if (cursor) params.set('cursor', cursor);

      const res = await fetch(`${BASE}/creators?${params}`, {
        headers: inflowwHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) break;

      const json = await res.json();
      const list: InflowwCreator[] = json?.data?.list ?? json?.list ?? [];
      for (const c of list) {
        if (c.userName && c.id) map.set(c.userName, Number(c.id));
      }
      cursor = json?.hasMore ? json?.cursor : undefined;
    } while (cursor);
  } catch {
    // return partial map on error
  }

  return map;
}

async function getCreatorTransactions(
  creatorId: number,
  startTime: string,
  endTime: string,
): Promise<InflowwTransaction[]> {
  const all: InflowwTransaction[] = [];
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

      const res = await fetch(`${BASE}/transactions?${params}`, {
        headers: inflowwHeaders(),
        cache: 'no-store',
      });
      if (!res.ok) break;

      const json = await res.json();
      const list: InflowwTransaction[] = json?.data?.list ?? json?.data ?? json?.list ?? [];
      all.push(...list);
      cursor = json?.hasMore ? json?.cursor : undefined;
    } while (cursor);
  } catch {
    // return partial list on error
  }

  return all;
}

function sumTransactions(txns: InflowwTransaction[]): { revenue: number; newSubs: number } {
  let revenue = 0;
  let newSubs = 0;
  for (const t of txns) {
    const amt = Number(t.amount ?? t.netAmount ?? t.totalAmount ?? 0);
    if (!isNaN(amt)) revenue += amt;

    const type = String(t.type ?? t.transactionType ?? '').toLowerCase();
    if (type.includes('subscribe') && !type.includes('unsubscribe')) newSubs++;
  }
  return { revenue, newSubs };
}

export async function getCreatorEarnings(
  creatorId: number,
  date: string,
): Promise<{ revenue: number; newSubs: number }> {
  const txns = await getCreatorTransactions(
    creatorId,
    `${date}T00:00:00.000Z`,
    `${date}T23:59:59.999Z`,
  );
  return sumTransactions(txns);
}

export async function getCreatorEarningsRange(
  creatorId: number,
  startDate: string,
  endDate: string,
): Promise<{ revenue: number; newSubs: number }> {
  const txns = await getCreatorTransactions(
    creatorId,
    `${startDate}T00:00:00.000Z`,
    `${endDate}T23:59:59.999Z`,
  );
  return sumTransactions(txns);
}
