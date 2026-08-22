import { NextResponse } from 'next/server';
import { createClient } from '@supabase/supabase-js';
import { buildInflowwMapping } from '@/lib/infloww-mapping';
import {
  getConnectedCreators,
  getCreatorTransactionsDebug,
  sumTransactions,
  getCreatorRefunds,
  inflowwOids,
  type SumDebug,
} from '@/lib/infloww';
import { ensureModelsFromInfloww } from '@/lib/infloww-sync-models';
import { loadIdentities, resolveCreator, rememberIdentity } from '@/lib/infloww-identity';

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

/**
 * Diagnostic seul : qui Infloww renvoie, et qui le CRM réclame.
 *
 * La synchronisation complète relit tout le mois pour chaque créatrice — plus
 * d'une minute, donc illisible quand on cherche simplement pourquoi un compte
 * manque. Ce mode ne fait qu'un appel et n'écrit rien.
 */
async function creatorsDiagnostic() {
  const { map, byPid, debug } = await getConnectedCreators();
  const { mapping, missingUsername, fromDatabase } = await buildInflowwMapping(supabase);
  const identities = await loadIdentities(supabase);

  const requested = new Set(Object.values(mapping).map((u) => u.toLowerCase()));
  const claimedPids = new Set([...identities.values()].map((i) => i.platformPid));

  // L'état réel des fiches, sans interprétation : c'est la seule façon de
  // savoir si un surnom historique a sa propre fiche ou n'est qu'une clé de
  // mapping — et donc si une fusion créerait un doublon ou en supprimerait un.
  const [{ data: rawModels }, { data: rawBilling }] = await Promise.all([
    supabase.from('crm_models').select('id, name, platforms, status, username'),
    supabase.from('crm_model_billing').select('model_id, usernames'),
  ]);
  const usernamesByModel = new Map<string, Record<string, string>>();
  (rawBilling ?? []).forEach((b: Record<string, unknown>) => {
    const u = b.usernames;
    if (u && typeof u === 'object') {
      usernamesByModel.set(b.model_id as string, u as Record<string, string>);
    }
  });
  const crmModels = (rawModels ?? []).map((m: Record<string, unknown>) => ({
    id: m.id,
    name: m.name,
    platforms: m.platforms,
    status: m.status,
    usernameField: m.username ?? '',
    usernames: usernamesByModel.get(m.id as string) ?? {},
  }));

  // Les noms sous lesquels du chiffre d'affaires est déjà enregistré : un
  // renommage doit les emporter avec lui, sinon l'historique devient orphelin.
  const { data: historyRows } = await supabase
    .from('vg_daily_entries')
    .select('model_name, platform');
  const historyNames: Record<string, number> = {};
  (historyRows ?? []).forEach((r: Record<string, unknown>) => {
    const k = `${r.platform as string}|${r.model_name as string}`;
    historyNames[k] = (historyNames[k] ?? 0) + 1;
  });

  return NextResponse.json({
    mode: 'diagnostic',
    crmModels,
    historyNames,
    creatorsFound: map.size,
    apiErrors: debug.apiErrors,
    tagCounts: debug.tagCounts,
    oidErrors: debug.oidErrors,
    byOid: debug.byOid,
    // Ce que l'API renvoie réellement, identifiant stable compris.
    inflowwAccounts: [...map.values()].map((r) => ({
      userName: r.userName,
      platformPid: r.platformPid,
      creatorId: r.id,
    })),
    // Ce que le CRM cherche, et si une identité stable est déjà mémorisée.
    crmExpects: Object.entries(mapping).map(([model, userName]) => {
      const known = identities.get(model);
      return {
        model,
        userName,
        knownPid: known?.platformPid ?? null,
        resolvedBy: known && byPid.has(known.platformPid)
          ? 'platformPid'
          : map.has(userName)
            ? 'userName'
            : 'INTROUVABLE',
      };
    }),
    unmatchedInflowwAccounts: [...map.entries()]
      .filter(([u, r]) => !requested.has(u.toLowerCase()) && !claimedPids.has(r.platformPid))
      .map(([u]) => u),
    missingUsername,
    fromDatabase,
  });
}

/**
 * Sonde : à quoi ressemble vraiment une transaction Infloww.
 *
 * Concevoir un fil de ventes en direct sans connaître les champs disponibles
 * reviendrait à deviner. On ne saurait ni s'il existe un horodatage — sans quoi
 * « en direct » n'a pas de sens — ni s'il existe un identifiant d'acheteur.
 * Cette sonde ramène quelques transactions brutes, non filtrées, et rien
 * d'autre.
 */
async function transactionsProbe() {
  const { map } = await getConnectedCreators();
  const first = [...map.values()][0];
  if (!first) return NextResponse.json({ mode: 'sonde', error: 'aucune créatrice' });

  const end = new Date();
  const start = new Date(end.getTime() - 24 * 3600 * 1000);
  const { transactions, debug } = await getCreatorTransactionsDebug(
    first.id, start.toISOString(), end.toISOString(), first.oid,
  );

  const keys = new Set<string>();
  transactions.forEach((t) => Object.keys(t).forEach((k) => keys.add(k)));

  return NextResponse.json({
    mode: 'sonde',
    creator: first.userName,
    fenetre: { start: start.toISOString(), end: end.toISOString() },
    status: debug.status,
    total: transactions.length,
    // Tous les champs rencontrés, toutes transactions confondues : certains
    // n'apparaissent que sur certains types de vente.
    champsRencontres: [...keys].sort(),
    // Brut, sans filtrage ni renommage.
    echantillon: transactions.slice(0, 5),
  });
}

export async function GET(request: Request) {
  const params = new URL(request.url).searchParams;
  if (params.get('creators') === '1') {
    return creatorsDiagnostic();
  }
  if (params.get('transactions') === '1') {
    return transactionsProbe();
  }

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
    const {
      map: creatorsMap,
      byPid: creatorsByPid,
      raw: creatorsRaw,
      debug: creatorsDebug,
    } = await getConnectedCreators();

    // Les identités déjà apprises : elles priment sur le pseudo, qui peut être
    // périmé des deux côtés.
    const identities = await loadIdentities(supabase);

    // Toute créatrice Infloww sans fiche CRM en obtient une, identifiée par son
    // username OnlyFans. C'est ce qui fait qu'ajouter une créatrice dans
    // Infloww suffit : elle apparaît dans le CRM au passage suivant.
    const modelsSync = await ensureModelsFromInfloww(supabase, creatorsMap, creatorsRaw);
    if (modelsSync.created.length > 0) {
      console.log('[sync] fiches créées :', JSON.stringify(modelsSync.created));
    }
    modelsSync.errors.forEach((e) => errors.push(`création fiche — ${e}`));

    // Le mapping vient des fiches modèles, plus les sept clés historiques.
    // Ajouter une créatrice au dashboard = renseigner son username OF dans le
    // CRM, plus aucune modification de code.
    const { mapping, missingUsername, fromDatabase } = await buildInflowwMapping(supabase);

    console.log('[sync] creatorsMap size:', creatorsMap.size);
    console.log('[sync] creatorsMap entries:', JSON.stringify([...creatorsMap.entries()]));
    console.log('[sync] userNames needed:', Object.values(mapping));

    // Comptes Infloww qu'aucune fiche CRM ne réclame : ce sont eux qui
    // manquent au dashboard, et le nom affiché ici est celui à recopier dans
    // le champ « Username sur OF » de la fiche concernée.
    const requested = new Set(Object.values(mapping).map((u) => u.toLowerCase()));
    const claimedPids = new Set(
      [...identities.values()].map((i) => i.platformPid),
    );
    const unmatchedInflowwAccounts = [...creatorsMap.entries()]
      .filter(([u, ref]) => !requested.has(u.toLowerCase()) && !claimedPids.has(ref.platformPid))
      .map(([u]) => u);

    // Ce que la résolution a appris à ce passage — le bloc à lire quand un
    // pseudo a changé : `renamed` liste les créatrices retrouvées malgré lui.
    const resolution: {
      byPlatformPid: string[];
      byUserName: string[];
      renamed: { model: string; crmUserName: string; inflowwUserName: string }[];
      identityErrors: string[];
    } = { byPlatformPid: [], byUserName: [], renamed: [], identityErrors: [] };

    // ── 2. Per-model sync ──────────────────────────────────────────────────
    for (const [modelName, userName] of Object.entries(mapping)) {
      // L'identifiant stable d'abord, le pseudo seulement en dernier recours.
      const { ref: creator, matchedBy } = resolveCreator(
        modelName, userName, identities, creatorsMap, creatorsByPid,
      );
      const creatorId = creator?.id ?? null;
      const creatorOid = creator?.oid;
      console.log(`[sync] ${modelName} (${userName}) → creatorId: ${creatorId} (pôle ${creatorOid ?? '—'}, via ${matchedBy})`);

      const modelDebug: ModelDebug = { model: modelName, userName, creatorId, dates: [] };

      if (!creatorId || !creator) {
        const msg = `${modelName}: "${userName}" not found in Infloww`;
        errors.push(msg);
        modelDebug.error = msg;
        debugModels.push(modelDebug);
        continue;
      }

      // Retenir l'identifiant stable dès qu'on le voit : c'est ce qui rend le
      // prochain changement de pseudo indolore.
      if (matchedBy === 'platformPid') resolution.byPlatformPid.push(modelName);
      else resolution.byUserName.push(modelName);
      if (creator.userName.toLowerCase() !== userName.toLowerCase()) {
        resolution.renamed.push({
          model: modelName,
          crmUserName: userName,
          inflowwUserName: creator.userName,
        });
      }
      const idErr = await rememberIdentity(supabase, modelName, creator);
      if (idErr) resolution.identityErrors.push(`${modelName} : ${idErr}`);

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
            creatorId, startTime, endTime, creatorOid,
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
          const refunds = await getCreatorRefunds(creatorId, startTime, endTime, creatorOid);
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
      const { debug: wideDbg } = await getCreatorTransactionsDebug(
        louId.id, wideStart, wideEnd, louId.oid,
      );
      wideWindowTest = {
        creatorId: louId.id, wideStart, wideEnd,
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
        await getCreatorTransactionsDebug(investId.id, sevenDaysAgo, nowISO2, investId.oid);

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
        // Diagnostic du mapping — à regarder en premier quand une créatrice
        // manque au dashboard.
        // Pôles Infloww — le premier bloc à regarder quand des créatrices
        // manquent : byOid dit combien chaque pôle a remonté.
        // Fiches créées automatiquement à ce passage.
        modelsSync,
        poles: {
          configured: inflowwOids().length,
          // Une clé « __sans_pole__ » ici signifie que l'API accepte d'être
          // interrogée sans en-tête de pôle, et combien de créatrices elle
          // renvoie alors en plus.
          byOid: creatorsDebug.byOid,
          errors: creatorsDebug.oidErrors,
          duplicates: creatorsDebug.duplicates,
          totalCreators: creatorsDebug.totalFound,
        },
        mapping: {
          total: Object.keys(mapping).length,
          fromDatabase,
          missingUsername,
          unmatchedInflowwAccounts,
        },
        // Comment chaque créatrice a été retrouvée. `renamed` non vide = un
        // pseudo a changé quelque part et le lien a tenu quand même.
        resolution,
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
