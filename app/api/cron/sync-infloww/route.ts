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

  try {
    const todayBounds     = parisDateBounds(0);
    const yesterdayBounds = parisDateBounds(-1);
    const dateBounds      = [todayBounds, yesterdayBounds];

    console.log('[sync] Paris date bounds:', JSON.stringify(dateBounds));

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

      for (const { date, start: startTime, end: endTime } of dateBounds) {
        const dateDebug: DateDebug = {
          date, startTime, endTime,
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
          dateDebug.sum             = sumDbg;
          dateDebug.computedRevenue = revenue;
          dateDebug.computedNewSubs = newSubs;

          for (const [type, count] of Object.entries(sumDbg.distinctTypes)) {
            globalTypeCount[type] = (globalTypeCount[type] ?? 0) + count;
          }

          console.log(`[sync] ${modelName} ${date}: ${transactions.length} txns → $${revenue.toFixed(2)} / ${newSubs} newSubs`);

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

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
      debug: {
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
