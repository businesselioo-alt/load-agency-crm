'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import Link from 'next/link';
import {
  ConsolidatedMetrics, calcConsolidated, getConsolidatedChartData,
  OF_MODELS, MYM_MODELS, loadPlatformData, ChartPoint,
  PlatformData, calcMetrics, loadOfUsernames,
} from '@/lib/performance-data';

// ─── Interactive line chart (Recharts) ───────────────────────────────────────

function fmtDayLabel(day: number): string {
  const months = ['janv', 'févr', 'mars', 'avr', 'mai', 'juin', 'juil', 'août', 'sept', 'oct', 'nov', 'déc'];
  return `${day} ${months[new Date().getMonth()]}`;
}

function LineChart({ data, color, gradId, currencySym }: {
  data: ChartPoint[]; color: string; gradId: string; currencySym: string;
}) {
  const hasData = data.some((d) => d.value > 0);
  if (!hasData) {
    return (
      <div className="h-14 flex items-center justify-center text-xs text-[#555]">
        Aucune donnée ce mois
      </div>
    );
  }
  const chartData = data.map((d) => ({ date: fmtDayLabel(d.day), value: d.value }));
  return (
    <ResponsiveContainer width="100%" height={56}>
      <AreaChart data={chartData} margin={{ top: 4, right: 4, bottom: 4, left: 4 }}>
        <defs>
          <linearGradient id={gradId} x1="0" y1="0" x2="0" y2="1">
            <stop offset="0%"   stopColor={color} stopOpacity={0.18} />
            <stop offset="100%" stopColor={color} stopOpacity={0} />
          </linearGradient>
        </defs>
        <Tooltip
          cursor={{ stroke: color, strokeWidth: 1, opacity: 0.35 }}
          content={(props) => {
            if (!props.active || !props.payload?.length) return null;
            const val = Number(props.payload[0].value);
            return (
              <div style={{
                backgroundColor: '#1a1a1a',
                border: '1px solid #333',
                borderRadius: '10px',
                padding: '7px 12px',
                fontSize: '12px',
                boxShadow: '0 8px 24px rgba(0,0,0,0.65)',
                pointerEvents: 'none',
              }}>
                <p style={{ color: '#888', margin: 0 }}>{props.label}</p>
                <p style={{ color: '#f0f0f0', fontWeight: 700, margin: '3px 0 0' }}>
                  {currencySym}{val.toLocaleString('fr-FR', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </p>
              </div>
            );
          }}
        />
        <Area
          type="monotone"
          dataKey="value"
          stroke={color}
          strokeWidth={2.5}
          fill={`url(#${gradId})`}
          fillOpacity={1}
          dot={false}
          activeDot={{ r: 4, fill: color, strokeWidth: 0 }}
          isAnimationActive={false}
        />
      </AreaChart>
    </ResponsiveContainer>
  );
}

// ─── Platform performance block ───────────────────────────────────────────────

function PlatformBlock({ label, color, gradId, metrics, chart, currencySym }: {
  label: string; color: string; gradId: string;
  metrics: ConsolidatedMetrics;
  chart: ChartPoint[];
  currencySym: string;
}) {
  const fmtCA = (n: number) => n === 0 ? '—' : `${currencySym}${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const fmtN0 = (n: number) => n.toLocaleString('fr-FR');

  const cols = [
    { label: 'Auj',     ca: metrics.caToday    },
    { label: 'Hier',    ca: metrics.caYesterday },
    { label: 'Semaine', ca: metrics.caWeek      },
    { label: 'Mois',    ca: metrics.caMonth     },
  ];

  return (
    <div className="flex flex-col gap-4">
      {/* Platform header */}
      <div className="flex items-center gap-3">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="font-bold text-white text-base">{label}</span>
        <div className="ml-auto flex items-center gap-4">
          <div className="text-right">
            <p className="text-[10px] text-[#888]">Total abonnés</p>
            <p className="text-base font-bold text-white leading-tight">{fmtN0(metrics.totalSubs)}</p>
          </div>
          <div className="text-right">
            <p className="text-[10px] text-[#888]">Subs L30</p>
            <p className="text-base font-bold text-white leading-tight">{fmtN0(metrics.subsLast30Days)}</p>
          </div>
        </div>
      </div>

      {/* 4 metric columns — 2 per row on mobile, 4 on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cols.map((c) => (
          <div key={c.label} className="rounded-xl p-3 border border-[#222] bg-[#1a1a1a] flex flex-col gap-0.5">
            <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wide">{c.label}</p>
            <p className="text-sm font-bold text-white leading-tight">{fmtCA(c.ca)}</p>
          </div>
        ))}
      </div>

      {/* Chart */}
      <div>
        <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wider mb-1.5">CA — mois en cours</p>
        <LineChart data={chart} color={color} gradId={gradId} currencySym={currencySym} />
      </div>
    </div>
  );
}

// ─── Empty metrics ────────────────────────────────────────────────────────────

const EMPTY: ConsolidatedMetrics = {
  caToday: 0, caYesterday: 0, caWeek: 0, caMonth: 0,
  subsToday: 0, subsYesterday: 0, subsWeek: 0, subsMonth: 0,
  totalSubs: 0, subsLast30Days: 0,
};


// ─── CA par créatrice ─────────────────────────────────────────────────────────

/**
 * Le détail que le total consolidé masque.
 *
 * Un chiffre d'affaires global qui stagne peut cacher une créatrice qui double
 * et une autre qui s'effondre. Le tri se fait sur le mois en cours, décroissant :
 * la première ligne est celle qui porte l'agence, la dernière celle qu'il faut
 * regarder de près.
 */
function ModelRevenueTable({ data, usernames, currencySym }: {
  data: PlatformData; usernames: Record<string, string>; currencySym: string;
}) {
  const rows = Object.entries(data)
    .map(([name, stats]) => ({
      name,
      // Le pseudo si on le connaît, le nom de fiche sinon.
      label: usernames[name] ?? name,
      m: calcMetrics(stats.entries),
    }))
    .sort((a, b) => b.m.caMonth - a.m.caMonth);

  const fmt = (n: number) =>
    n === 0 ? '—' : `${currencySym}${n.toLocaleString('fr-FR', { maximumFractionDigits: 0 })}`;

  const totalMois = rows.reduce((s, r) => s + r.m.caMonth, 0);

  if (rows.length === 0) {
    return <p className="text-sm text-[#666] px-4 sm:px-6 py-6">Aucune créatrice.</p>;
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm min-w-[520px]">
        <thead>
          <tr className="text-[10px] uppercase tracking-wider text-[#555]">
            <th className="text-left font-semibold px-4 sm:px-6 py-2">Créatrice</th>
            <th className="text-right font-semibold px-3 py-2">Auj</th>
            <th className="text-right font-semibold px-3 py-2">Hier</th>
            <th className="text-right font-semibold px-3 py-2">Semaine</th>
            <th className="text-right font-semibold px-4 sm:px-6 py-2">Mois</th>
          </tr>
        </thead>
        <tbody>
          {rows.map((r) => {
            // La part du mois : ce qui dit d'un coup d'œil si l'agence repose
            // sur une seule créatrice.
            const part = totalMois > 0 ? (r.m.caMonth / totalMois) * 100 : 0;
            return (
              <tr key={r.name} className="border-t border-[#1c1c1c] hover:bg-[#161616] transition">
                <td className="px-4 sm:px-6 py-2.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <span className="w-7 h-7 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#C9A84C] text-xs font-bold">{r.label.charAt(0).toUpperCase()}</span>
                    </span>
                    <span className="min-w-0">
                      <span className="block text-white truncate">{r.label}</span>
                      {part >= 1 && (
                        <span className="block text-[10px] text-[#666]">{part.toFixed(0)} % du mois</span>
                      )}
                    </span>
                  </div>
                </td>
                <td className="text-right px-3 py-2.5 tabular-nums text-white">{fmt(r.m.caToday)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-[#999]">{fmt(r.m.caYesterday)}</td>
                <td className="text-right px-3 py-2.5 tabular-nums text-[#999]">{fmt(r.m.caWeek)}</td>
                <td className="text-right px-4 sm:px-6 py-2.5 tabular-nums font-semibold text-white">{fmt(r.m.caMonth)}</td>
              </tr>
            );
          })}
          <tr className="border-t border-[#222] bg-[#0d0d0d]">
            <td className="px-4 sm:px-6 py-2.5 text-[#888] font-semibold">Total</td>
            <td className="text-right px-3 py-2.5 tabular-nums text-white font-semibold">
              {fmt(rows.reduce((s, r) => s + r.m.caToday, 0))}
            </td>
            <td className="text-right px-3 py-2.5 tabular-nums text-[#999]">
              {fmt(rows.reduce((s, r) => s + r.m.caYesterday, 0))}
            </td>
            <td className="text-right px-3 py-2.5 tabular-nums text-[#999]">
              {fmt(rows.reduce((s, r) => s + r.m.caWeek, 0))}
            </td>
            <td className="text-right px-4 sm:px-6 py-2.5 tabular-nums font-bold text-white">{fmt(totalMois)}</td>
          </tr>
        </tbody>
      </table>
    </div>
  );
}

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();


  const [ofMetrics,  setOfMetrics]  = useState<ConsolidatedMetrics>(EMPTY);
  const [mymMetrics, setMymMetrics] = useState<ConsolidatedMetrics>(EMPTY);
  const [ofChart,    setOfChart]    = useState<ChartPoint[]>([]);
  const [mymChart,   setMymChart]   = useState<ChartPoint[]>([]);
  const [ofByModel,  setOfByModel]  = useState<PlatformData>({});
  const [ofUsernames, setOfUsernames] = useState<Record<string, string>>({});

  useEffect(() => {
    Promise.all([
      loadPlatformData('of',  OF_MODELS),
      loadPlatformData('mym', MYM_MODELS),
    ]).then(([ofData, mymData]) => {
      setOfMetrics(calcConsolidated(ofData));
      setMymMetrics(calcConsolidated(mymData));
      setOfByModel(ofData);
      setOfChart(getConsolidatedChartData(ofData));
      setMymChart(getConsolidatedChartData(mymData));
    });
    loadOfUsernames().then(setOfUsernames);
  }, []);

  return (
    <div className="p-4 sm:p-6 lg:p-8 space-y-5 sm:space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-xl sm:text-2xl font-bold text-white">Bonjour, {user?.name} 👋</h1>
        <p className="text-[#888] text-sm mt-1">
          {new Date().toLocaleDateString('fr-FR', { weekday: 'long', year: 'numeric', month: 'long', day: 'numeric' })}
        </p>
      </div>

      {/* ── Performance Overview ── */}
      <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
        {/* Card header */}
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-[#222]">
          <div>
            <h2 className="font-bold text-white">Performance</h2>
            <p className="text-xs text-[#888] mt-0.5">Données en temps réel · synchronisées depuis la Vue Globale</p>
          </div>
          <Link
            href="/dashboard/marketing"
            className="flex items-center gap-1.5 text-xs font-medium text-[#C9A84C] hover:text-[#E2C06A] transition flex-shrink-0"
          >
            Vue complète <ArrowUpRight size={13} />
          </Link>
        </div>

        {/* OF and MYM blocks — stacked on mobile, side by side on md+ */}
        <div className="flex flex-col md:flex-row">
          <div className="flex-1 p-4 sm:p-6">
            <PlatformBlock
              label="OnlyFans"
              color="#a855f7"
              gradId="db-grad-of"
              metrics={ofMetrics}
              chart={ofChart}
              currencySym="$"
            />
          </div>
          {/* Divider: horizontal on mobile, vertical on md+ */}
          <div className="h-px md:h-auto md:w-px bg-[#222] mx-0 md:mx-0 flex-shrink-0" />
          <div className="flex-1 p-4 sm:p-6">
            <PlatformBlock
              label="MYM"
              color="#ec4899"
              gradId="db-grad-mym"
              metrics={mymMetrics}
              chart={mymChart}
              currencySym="€"
            />
          </div>
        </div>
      </div>

      {/* ── CA par créatrice — OnlyFans ── */}
      <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
        <div className="flex flex-wrap items-center justify-between gap-2 px-4 sm:px-6 py-4 border-b border-[#222]">
          <div>
            <h2 className="font-bold text-white">CA par créatrice</h2>
            <p className="text-xs text-[#888] mt-0.5">OnlyFans · synchronisé depuis Infloww</p>
          </div>
          <Link
            href="/dashboard/marketing"
            className="flex items-center gap-1.5 text-xs font-medium text-[#C9A84C] hover:text-[#E2C06A] transition flex-shrink-0"
          >
            Vue complète <ArrowUpRight size={13} />
          </Link>
        </div>
        <ModelRevenueTable data={ofByModel} usernames={ofUsernames} currencySym="$" />
      </div>

    </div>
  );
}
