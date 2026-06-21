import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { INFLOWW_OF_MAPPING } from '@/lib/infloww-mapping';
import {
  getConnectedCreators,
  getCreatorTransactionsDebug,
  sumTransactions,
  getCreatorRefunds,
  type SumDebug,
} from '@/lib/infloww';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// Infloww dashboard uses Europe/Paris local time for its daily totals.
// The Vercel cron runs in UTC, so we convert Paris-local midnight→midnight
// to the correct UTC instants, handling DST (UTC+1 winter, UTC+2 summer).
interface DateBounds {
  date: string;   // Paris calendar date YYYY-MM-DD — used as Supabase key
  start: string;  // UTC ISO = Paris 00:00:00 local
  end: string;    // UTC ISO = Paris 23:59:59.999 local
}

function parisDateBounds(offsetDays: number): DateBounds {
  const now = new Date();

  // Current calendar date in Paris (sv-SE gives YYYY-MM-DD directly)
  const todayParis = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(now);
  const [y, m, d]  = todayParis.split('-').map(Number);

  // Target date (noon UTC on that day — safe DST pivot point)
  const targetNoon = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  const date       = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(targetNoon);
  const [ty, tm, td] = date.split('-').map(Number);

  // Determine the Paris UTC offset on the target date
  // "What hour does Paris show when it is 12:00 UTC?"
  const parisNoon = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris', hour: 'numeric', hour12: false, hourCycle: 'h23',
    }).format(new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0))),
  );
  const offsetHours = parisNoon - 12; // 2 in summer (UTC+2), 1 in winter (UTC+1)

  // Paris 00:00:00 = UTC midnight − offsetHours (JS handles negative hours correctly)
  const start = new Date(Date.UTC(ty, tm - 1, td,  0 - offsetHours,  0,  0,   0));
  const end   = new Date(Date.UTC(ty, tm - 1, td, 23 - offsetHours, 59, 59, 999));

  return { date, start: start.toISOString(), end: end.toISOString() };
}

// Returns DateBounds for every calendar day in the current Paris month,
// from the 1st up to and including today.
function getAllParisMonthDayBounds(): DateBounds[] {
  const now        = new Date();
  const todayParis = new Intl.DateTimeFormat('sv-SE', { timeZone: 'Europe/Paris' }).format(now);
  const dayOfMonth = Number(todayParis.split('-')[2]); // 1-based day number today

  const days: DateBounds[] = [];
  for (let day = 1; day <= dayOfMonth; day++) {
    const offset = day - dayOfMonth; // 0 = today, -1 = yesterday, -(N-1) = 1st of month
    days.push(parisDateBounds(offset));
  }
  return days;
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateDebug {
  date: string;
  startTime: string;
  endTime: string;
  transactionCount: number;
  firstRawTransaction: unknown;
  sum: SumDebug;
  computedRevenue: number;
  computedNewSubs: number;
  refundTotal: number;       // gross refund amount for this day (informational)
  refundCount: number;
  supabaseError: string | null;
}

interface ModelDebug {
  model: string;
  userName: string;
  creatorId: number | null;
  error?: string;
  dates: DateDebug[];
}

// ─── Handler ──────────────────────────────────────────────────────────────────

export async function GET() {
  const synced: string[]          = [];
  const errors: string[]          = [];
  const debugModels: ModelDebug[] = [];
  const globalTypeCount: Record<string, number> = {};
  const totals: Record<string, number> = {}; // date → summed revenue across all models

  try {
    // All days from the 1st of the current Paris month to today.
    // Cap today's endTime to now — Infloww rejects endTime > now.
    const nowISO       = new Date().toISOString();
    const allDayBounds = getAllParisMonthDayBounds();
    const todayDate    = allDayBounds[allDayBounds.length - 1].date;
    const yesterdayDate = allDayBounds.length >= 2 ? allDayBounds[allDayBounds.length - 2].date : '';
    if (allDayBounds[allDayBounds.length - 1].end > nowISO) {
      allDayBounds[allDayBounds.length - 1].end = nowISO;
    }

    console.log('[sync] month bounds: day 1 =', allDayBounds[0].date,
      '| today =', todayDate, '| total days =', allDayBounds.length);

    // Pre-fetch which model×date combos already have Infloww data in Supabase.
    // Historical days (not today or yesterday) that are already synced are skipped
    // so each cron run only re-fetches today + yesterday (still-accumulating data),
    // plus any gaps from earlier in the month that haven't been backfilled yet.
    const monthStart = allDayBounds[0].date;
    const { data: alreadySyncedRows } = await supabase
      .from('vg_daily_entries')
      .select('model_name, date')
      .eq('platform', 'of')
      .eq('note', 'infloww')
      .gte('date', monthStart)
      .lte('date', todayDate);

    const alreadySynced = new Set(
      (alreadySyncedRows ?? []).map((r) => `${r.model_name as string}|${r.date as string}`)
    );
    console.log('[sync] already synced this month:', alreadySynced.size, 'entries');

    // ── 1. Resolve creators ────────────────────────────────────────────────
    const { map: creatorsMap, debug: creatorsDebug } = await getConnectedCreators();
    console.log('[sync] creatorsMap size:', creatorsMap.size);
    console.log('[sync] creatorsMap entries:', JSON.stringify([...creatorsMap.entries()]));
    console.log('[sync] userNames needed:', Object.values(INFLOWW_OF_MAPPING));

    // ── 2. Per-model sync ──────────────────────────────────────────────────
    for (const [modelName, userName] of Object.entries(INFLOWW_OF_MAPPING)) {
      const creatorId = creatorsMap.get(userName) ?? null;
      console.log(`[sync] ${modelName} (${userName}) → creatorId: ${creatorId}`);

      const modelDebug: ModelDebug = { model: modelName, userName, creatorId, dates: [] };

      if (!creatorId) {
        const msg = `${modelName}: "${userName}" not found in Infloww`;
        errors.push(msg);
        modelDebug.error = msg;
        debugModels.push(modelDebug);
        continue;
      }

      for (const { date, start: startTime, end: endTime } of allDayBounds) {
        // Skip historical days that are already in Supabase — their data is final.
        // Always re-fetch today and yesterday (transactions still accumulating).
        const isRecent = date === todayDate || date === yesterdayDate;
        if (!isRecent && alreadySynced.has(`${modelName}|${date}`)) {
          console.log(`[sync] ${modelName} ${date}: already synced, skipping`);
          continue;
        }

        const dateDebug: DateDebug = {
          date, startTime, endTime,
          transactionCount: 0, firstRawTransaction: null,
          sum: { totalInput: 0, excludedPending: 0, includedCount: 0, revenueField: 'none', zeroNetCount: 0, distinctTypes: {}, distinctStatuses: {}, revenueByType: {}, sampleByType: {} },
          computedRevenue: 0, computedNewSubs: 0, refundTotal: 0, refundCount: 0, supabaseError: null,
        };

        try {
          const { transactions, debug: txDebug } = await getCreatorTransactionsDebug(
            creatorId, startTime, endTime,
          );

          dateDebug.transactionCount    = txDebug.totalCount;
          dateDebug.firstRawTransaction = txDebug.firstRawTransaction;

          // Surface API-level errors — previously swallowed silently
          if (txDebug.httpErrorBody !== null) {
            errors.push(`${modelName} ${date}: HTTP ${txDebug.status} — ${txDebug.httpErrorBody.slice(0, 200)}`);
          }
          if (txDebug.exception !== null) {
            errors.push(`${modelName} ${date}: exception — ${txDebug.exception}`);
          }

          const { revenue, newSubs, debug: sumDbg } = sumTransactions(transactions);
          dateDebug.sum             = sumDbg;
          dateDebug.computedRevenue = revenue;
          dateDebug.computedNewSubs = newSubs;

          for (const [type, count] of Object.entries(sumDbg.distinctTypes)) {
            globalTypeCount[type] = (globalTypeCount[type] ?? 0) + count;
          }
          totals[date] = (totals[date] ?? 0) + revenue;

          // Fetch refunds for this model/date (informational — not subtracted from revenue)
          const refunds = await getCreatorRefunds(creatorId, startTime, endTime);
          dateDebug.refundTotal = refunds.total;
          dateDebug.refundCount = refunds.count;
          if (refunds.count > 0) {
            console.log(`[sync] ${modelName} ${date}: ${refunds.count} refunds totalling $${refunds.total.toFixed(2)}`);
          }

          console.log(`[sync] ${modelName} ${date}: ${transactions.length} txns → $${revenue.toFixed(2)} (zeroNet:${sumDbg.zeroNetCount}) / ${newSubs} newSubs`);

          const { data: existing } = await supabase
            .from('vg_daily_entries')
            .select('new_subs')
            .eq('platform', 'of')
            .eq('model_name', modelName)
            .eq('date', date)
            .maybeSingle();

          const finalNewSubs = newSubs > 0 ? newSubs : (existing?.new_subs ?? 0);

          const { error } = await supabase.from('vg_daily_entries').upsert(
            {
              id:         `of_${modelName}_${date}`,
              platform:   'of',
              model_name: modelName,
              date,
              new_subs:   finalNewSubs,
              revenue,
              note:       'infloww',
            },
            { onConflict: 'platform,model_name,date' },
          );

          if (error) {
            dateDebug.supabaseError = error.message;
            errors.push(`${modelName} ${date}: ${error.message}`);
          } else {
            synced.push(`${modelName} ${date}: $${revenue.toFixed(2)} / ${finalNewSubs} subs`);
          }
        } catch (e) {
          const msg = String(e);
          dateDebug.supabaseError = msg;
          errors.push(`${modelName} ${date}: ${msg}`);
        }

        modelDebug.dates.push(dateDebug);
      }

      debugModels.push(modelDebug);
    }

    console.log('[sync] globalTypeCount:', JSON.stringify(globalTypeCount));
    console.log('[sync] totals by date:', JSON.stringify(totals));

    // ── Wide-window sanity test: last 48h for Lou ──────────────────────────
    // If today's narrow window returns 0 txns, this broader window will tell
    // us whether the API has ANY data for today or whether it's a connection issue.
    const louId = creatorsMap.get('louvalmont');
    let wideWindowTest: unknown = null;
    if (louId) {
      const wideStart = new Date(Date.now() - 48 * 3600 * 1000).toISOString();
      const wideEnd   = new Date().toISOString();
      const { debug: wideDbg } = await getCreatorTransactionsDebug(louId, wideStart, wideEnd);
      wideWindowTest = {
        creatorId: louId, wideStart, wideEnd,
        totalCount: wideDbg.totalCount,
        status: wideDbg.status,
        httpErrorBody: wideDbg.httpErrorBody,
        rawFirstPageFull: wideDbg.rawFirstPageFull,
        exception: wideDbg.exception,
      };
      console.log('[sync] wide-window test (Lou, 48h):', JSON.stringify(wideWindowTest));
    }

    // ── Subscription-type investigation: last 7 days for Lou ───────────────
    // Theory: free subscriptions (amount=0, net=0) might appear as "Subscription"
    // type transactions. We currently count only paid new-sub types. If zero-amount
    // Subscription entries exist, counting ALL Subscription-type transactions
    // (paid + free) would give a more realistic new-subscriber number.
    //
    // This block fetches ALL transactions over 7 days and buckets them by
    // type × amount-bucket (zero vs non-zero) to reveal exactly what's there.
    let subscriptionTypeInvestigation: unknown = null;
    const investId = louId ?? creatorsMap.get('jeannebourgot');
    const investName = louId ? 'louvalmont' : 'jeannebourgot';
    if (investId) {
      const sevenDaysAgo = new Date(Date.now() - 7 * 24 * 3600 * 1000).toISOString();
      const nowISO2      = new Date().toISOString();
      const { transactions: allTxns7d, debug: investDbg } =
        await getCreatorTransactionsDebug(investId, sevenDaysAgo, nowISO2);

      // Bucket every transaction: type → { total, zeroAmount, nonZero, samples }
      const byType: Record<string, {
        count: number;
        zeroAmountCount: number;   // net=0 AND amount=0 (or absent) → free sub candidate
        nonZeroCount: number;      // net>0 OR amount>0 → paid
        zeroAmountSamples: unknown[];
        nonZeroSamples: unknown[];
      }> = {};

      for (const t of allTxns7d) {
        const raw    = t as Record<string, unknown>;
        const rawType = String(t.type ?? t.transactionType ?? t.category ?? 'unknown');
        if (!byType[rawType]) {
          byType[rawType] = { count: 0, zeroAmountCount: 0, nonZeroCount: 0, zeroAmountSamples: [], nonZeroSamples: [] };
        }
        byType[rawType].count++;

        const netVal  = raw.net   ?? t.netAmount ?? t.net_amount;
        const grossVal = raw.amount ?? raw.grossAmount ?? raw.gross_amount;
        const netNum   = netVal   !== undefined && netVal   !== null ? Number(netVal)   : 0;
        const grossNum = grossVal !== undefined && grossVal !== null ? Number(grossVal) : 0;
        const isZero   = netNum === 0 && grossNum === 0;

        if (isZero) {
          byType[rawType].zeroAmountCount++;
          if (byType[rawType].zeroAmountSamples.length < 2) byType[rawType].zeroAmountSamples.push(raw);
        } else {
          byType[rawType].nonZeroCount++;
          if (byType[rawType].nonZeroSamples.length < 2) byType[rawType].nonZeroSamples.push(raw);
        }
      }

      // Pull out the Subscription bucket specifically for easy reading
      const subBucket = Object.entries(byType).find(
        ([k]) => k.toLowerCase() === 'subscription' || k.toLowerCase() === 'subscribe'
      );

      subscriptionTypeInvestigation = {
        creator: investName,
        creatorId: investId,
        windowStart: sevenDaysAgo,
        windowEnd: nowISO2,
        totalTransactions: allTxns7d.length,
        apiStatus: investDbg.status,
        httpErrorBody: investDbg.httpErrorBody,
        exception: investDbg.exception,
        // The key question: how many "Subscription" entries and how many are zero-amount?
        subscriptionBucket: subBucket ? subBucket[1] : null,
        // Full breakdown by type so we can see every type present over 7 days
        byType,
      };

      console.log('[sync] subscription investigation (7d, Lou):', JSON.stringify({
        total: allTxns7d.length, byType: Object.fromEntries(
          Object.entries(byType).map(([k, v]) => [k, { count: v.count, zero: v.zeroAmountCount, nonZero: v.nonZeroCount }])
        ),
      }));
    }

    // Confirm what's actually in Supabase for the whole month after all upserts
    const { data: supabaseEntries } = await supabase
      .from('vg_daily_entries')
      .select('model_name, date, revenue, new_subs, note')
      .eq('platform', 'of')
      .gte('date', monthStart)
      .lte('date', todayDate)
      .order('date')
      .order('model_name');

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
      debug: {
        // Quick summary for validation
        revenueTotalByDate: totals,
        // Full detail
        globalTypeCount,
        monthStart,
        todayDate,
        totalDaysInMonth: allDayBounds.length,
        alreadySyncedCount: alreadySynced.size,
        creatorsFound: creatorsMap.size,
        creatorsDebug,
        // Complete unfiltered creator object for louvalmont (or first creator as fallback).
        // Exposes every field actually returned by GET /v1/creators, including any
        // undocumented subscriber-count fields (subscriberCount, totalFans, etc.)
        // not shown in the minimal docs sample payloads.
        rawCreatorObjectFull: creatorsDebug.rawLouValmontFull,
        // Supabase ground truth — confirms today's entries exist and what was written
        supabaseEntriesForSyncedDates: supabaseEntries ?? [],
        // 48h wide-window test for Lou — isolates date-boundary vs auth issues
        wideWindowTest,
        // 7-day subscription-type investigation for Lou:
        // byType[type].zeroAmountCount > 0 → free subs appear as zero-amount transactions
        // If true, count ALL Subscription-type txns (not just paid) for new-sub tracking
        subscriptionTypeInvestigation,
        models: debugModels,
      },
    });
  } catch (e) {
    console.log('[sync] fatal error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
