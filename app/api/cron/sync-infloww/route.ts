import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { INFLOWW_OF_MAPPING } from '@/lib/infloww-mapping';
import {
  getConnectedCreators,
  getCreatorTransactionsDebug,
  sumTransactions,
} from '@/lib/infloww';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function utcDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

interface DateDebug {
  date: string;
  startTime: string;
  endTime: string;
  transactionCount: number;
  firstRawTransaction: unknown;
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

export async function GET() {
  const synced: string[]     = [];
  const errors: string[]     = [];
  const debugModels: ModelDebug[] = [];

  try {
    const today     = utcDate(0);
    const yesterday = utcDate(-1);
    const dates = [today, yesterday];
    console.log('[sync] UTC dates to sync:', dates);

    // ── 1. Resolve creators ──────────────────────────────────────────────────
    const { map: creatorsMap, debug: creatorsDebug } = await getConnectedCreators();

    console.log('[sync] creatorsMap size:', creatorsMap.size);
    console.log('[sync] creatorsMap entries:', JSON.stringify([...creatorsMap.entries()]));
    console.log('[sync] INFLOWW_OF_MAPPING userNames we need:', Object.values(INFLOWW_OF_MAPPING));

    // ── 2. Per-model sync ────────────────────────────────────────────────────
    for (const [modelName, userName] of Object.entries(INFLOWW_OF_MAPPING)) {
      const creatorId = creatorsMap.get(userName) ?? null;
      console.log(`[sync] ${modelName} (${userName}) → creatorId: ${creatorId}`);

      const modelDebug: ModelDebug = { model: modelName, userName, creatorId, dates: [] };

      if (!creatorId) {
        const msg = `${modelName}: "${userName}" not found in Infloww creators map`;
        errors.push(msg);
        modelDebug.error = msg;
        debugModels.push(modelDebug);
        continue;
      }

      for (const date of dates) {
        const startTime = `${date}T00:00:00.000Z`;
        const endTime   = `${date}T23:59:59.999Z`;
        const dateDebug: DateDebug = {
          date, startTime, endTime,
          transactionCount: 0, firstRawTransaction: null,
          computedRevenue: 0, computedNewSubs: 0, supabaseError: null,
        };

        try {
          const { transactions, debug: txDebug } = await getCreatorTransactionsDebug(
            creatorId, startTime, endTime,
          );

          dateDebug.transactionCount    = txDebug.totalCount;
          dateDebug.firstRawTransaction = txDebug.firstRawTransaction;

          const { revenue, newSubs } = sumTransactions(transactions);
          dateDebug.computedRevenue  = revenue;
          dateDebug.computedNewSubs  = newSubs;

          console.log(`[sync] ${modelName} ${date}: ${transactions.length} txns → revenue=${revenue} newSubs=${newSubs}`);

          // Preserve existing new_subs if Infloww has no subscription data
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
            console.log(`[sync] supabase error ${modelName} ${date}:`, error.message);
          } else {
            synced.push(`${modelName} ${date}: $${revenue.toFixed(2)}`);
          }
        } catch (e) {
          const msg = String(e);
          dateDebug.supabaseError = msg;
          errors.push(`${modelName} ${date}: ${msg}`);
          console.log(`[sync] exception ${modelName} ${date}:`, msg);
        }

        modelDebug.dates.push(dateDebug);
      }

      debugModels.push(modelDebug);
    }

    return NextResponse.json({
      synced,
      errors,
      timestamp: new Date().toISOString(),
      debug: {
        utcDates: dates,
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
