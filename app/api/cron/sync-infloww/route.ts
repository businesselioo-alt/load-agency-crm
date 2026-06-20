import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { INFLOWW_OF_MAPPING } from '@/lib/infloww-mapping';
import { getConnectedCreators, getCreatorEarnings } from '@/lib/infloww';

const supabase = createClient(
  process.env.NEXT_PUBLIC_SUPABASE_URL!,
  process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY!,
);

function utcDate(offsetDays = 0): string {
  const d = new Date();
  d.setUTCDate(d.getUTCDate() + offsetDays);
  return d.toISOString().slice(0, 10);
}

export async function GET() {
  const synced: string[] = [];
  const errors: string[] = [];

  try {
    const creatorsMap = await getConnectedCreators();
    const dates = [utcDate(0), utcDate(-1)]; // today + yesterday

    for (const [modelName, userName] of Object.entries(INFLOWW_OF_MAPPING)) {
      const creatorId = creatorsMap.get(userName);
      if (!creatorId) {
        errors.push(`${modelName}: "${userName}" not found`);
        continue;
      }

      for (const date of dates) {
        try {
          const { revenue, newSubs } = await getCreatorEarnings(creatorId, date);

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
            errors.push(`${modelName} ${date}: ${error.message}`);
          } else {
            synced.push(`${modelName} ${date}: $${revenue.toFixed(2)}`);
          }
        } catch (e) {
          errors.push(`${modelName} ${date}: ${String(e)}`);
        }
      }
    }

    return NextResponse.json({ synced, errors, timestamp: new Date().toISOString() });
  } catch (e) {
    return NextResponse.json({ error: String(e) }, { status: 500 });
  }
}
