import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { INFLOWW_OF_MAPPING } from '@/lib/infloww-mapping';
import {
  getConnectedCreators,
  getCreatorTransactionsDebug,
  sumTransactions,
  type SumDebug,
} from '@/lib/infloww';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

// ─── Paris timezone boundaries ────────────────────────────────────────────────
// Returns the UTC timestamps that bracket a full calendar day in Europe/Paris,
// handling DST correctly (UTC+1 winter, UTC+2 summer).
interface DateBounds {
  localDate: string; // Paris calendar date, e.g. "2026-06-19" — used for Supabase
  start: string;     // UTC ISO of Paris 00:00:00 that day
  end: string;       // UTC ISO of Paris 23:59:59.999 that day
}

function parisDateBounds(offsetDays: number): DateBounds {
  const now = new Date();

  // Step 1: get today's calendar date in Paris ("YYYY-MM-DD" via sv-SE locale)
  const todayParis = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(now);

  // Step 2: apply day offset to get the target Paris date
  const [y, m, d] = todayParis.split('-').map(Number);
  const targetUTCNoon = new Date(Date.UTC(y, m - 1, d + offsetDays, 12, 0, 0));
  const localDate = new Intl.DateTimeFormat('sv-SE', {
    timeZone: 'Europe/Paris',
  }).format(targetUTCNoon);

  // Step 3: find the Paris UTC offset on the target date by comparing noon
  // "What hour does Paris clock show when it's noon UTC on that day?"
  const [ty, tm, td] = localDate.split('-').map(Number);
  const noonUTC = new Date(Date.UTC(ty, tm - 1, td, 12, 0, 0));
  const parisNoonHour = Number(
    new Intl.DateTimeFormat('en-US', {
      timeZone: 'Europe/Paris',
      hour: 'numeric',
      hour12: false,
      hourCycle: 'h23',
    }).format(noonUTC),
  );
  // e.g. 14 → UTC+2 (summer), 13 → UTC+1 (winter)
  const offsetHours = parisNoonHour - 12;

  // Step 4: Paris 00:00:00 = UTC (00:00 - offset), Paris 23:59:59.999 = UTC (23:59:59.999 - offset)
  // JS Date.UTC handles negative hours correctly (wraps to previous day)
  const start = new Date(Date.UTC(ty, tm - 1, td,  0 - offsetHours,  0,  0,   0));
  const end   = new Date(Date.UTC(ty, tm - 1, td, 23 - offsetHours, 59, 59, 999));

  return { localDate, start: start.toISOString(), end: end.toISOString() };
}

// ─── Types ────────────────────────────────────────────────────────────────────

interface DateDebug {
  localDate: string;
  startTime: string;
  endTime: string;
  transactionCount: number;
  firstRawTransaction: unknown;
  sum: SumDebug;
  computedRevenue: number;
  computedNewSubs: number;
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
  // Aggregate type counts across ALL models and dates — catches rare types
  const globalTypeCount: Record<string, number> = {};

  try {
    const todayBounds     = parisDateBounds(0);
    const yesterdayBounds = parisDateBounds(-1);
    const dateBounds      = [todayBounds, yesterdayBounds];

    console.log('[sync] Paris date bounds:',
      JSON.stringify(dateBounds.map(b => ({ localDate: b.localDate, start: b.start, end: b.end }))));

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

      for (const bounds of dateBounds) {
        const { localDate, start: startTime, end: endTime } = bounds;

        const dateDebug: DateDebug = {
          localDate, startTime, endTime,
          transactionCount: 0, firstRawTransaction: null,
          sum: { totalInput: 0, excludedPending: 0, includedCount: 0, revenueField: 'none', distinctTypes: {}, distinctStatuses: {}, revenueByType: {}, sampleByType: {} },
          computedRevenue: 0, computedNewSubs: 0, supabaseError: null,
        };

        try {
          const { transactions, debug: txDebug } = await getCreatorTransactionsDebug(
            creatorId, startTime, endTime,
          );

          dateDebug.transactionCount    = txDebug.totalCount;
          dateDebug.firstRawTransaction = txDebug.firstRawTransaction;

          const { revenue, newSubs, debug: sumDbg } = sumTransactions(transactions);
          dateDebug.sum           = sumDbg;
          dateDebug.computedRevenue = revenue;
          dateDebug.computedNewSubs = newSubs;

          // Accumulate type counts globally
          for (const [type, count] of Object.entries(sumDbg.distinctTypes)) {
            globalTypeCount[type] = (globalTypeCount[type] ?? 0) + count;
          }

          console.log(`[sync] ${modelName} ${localDate}: ${transactions.length} txns → $${revenue.toFixed(2)} / ${newSubs} newSubs`);

          // Preserve existing new_subs if Infloww has no subscription data
          const { data: existing } = await supabase
            .from('vg_daily_entries')
            .select('new_subs')
            .eq('platform', 'of')
            .eq('model_name', modelName)
            .eq('date', localDate)
            .maybeSingle();

          const finalNewSubs = newSubs > 0 ? newSubs : (existing?.new_subs ?? 0);

          const { error } = await supabase.from('vg_daily_entries').upsert(
            {
              id:         `of_${modelName}_${localDate}`,
              platform:   'of',
              model_name: modelName,
              date:       localDate,
              new_subs:   finalNewSubs,
              revenue,
              note:       'infloww',
            },
            { onConflict: 'platform,model_name,date' },
          );

          if (error) {
            dateDebug.supabaseError = error.message;
            errors.push(`${modelName} ${localDate}: ${error.message}`);
          } else {
            synced.push(`${modelName} ${localDate}: $${revenue.toFixed(2)} / ${finalNewSubs} subs`);
          }
        } catch (e) {
          const msg = String(e);
          dateDebug.supabaseError = msg;
          errors.push(`${modelName} ${localDate}: ${msg}`);
        }

        modelDebug.dates.push(dateDebug);
      }

      debugModels.push(modelDebug);
    }

    console.log('[sync] globalTypeCount across all models/dates:', JSON.stringify(globalTypeCount));

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
      debug: {
        // Global type aggregation — if "Subscribe"/"Rebill"/etc. exist anywhere, they appear here
        globalTypeCount,
        parisDateBounds: dateBounds,
        creatorsFound: creatorsMap.size,
        creatorsDebug,
        models: debugModels,
      },
    });
  } catch (e) {
    console.log('[sync] fatal error:', e);
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
