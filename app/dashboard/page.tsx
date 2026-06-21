'use client';

import { useState, useEffect } from 'react';
import { ArrowUpRight } from 'lucide-react';
import { AreaChart, Area, Tooltip, ResponsiveContainer } from 'recharts';
import { useAuth } from '@/contexts/AuthContext';
import { MODELS, INVOICES } from '@/lib/data';
import Link from 'next/link';
import {
  ConsolidatedMetrics, calcConsolidated, getConsolidatedChartData,
  OF_MODELS, MYM_MODELS, loadPlatformData, ChartPoint,
} from '@/lib/performance-data';
import {
  loadRecaps, calcPlatformCA, ModelCAMetrics,
  OF_MODELS as CHAT_OF, MYM_MODELS as CHAT_MYM,
} from '@/lib/chatting';

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

// ─── Chatting CA compact card ─────────────────────────────────────────────────

function ChatCACard({ label, color, metrics, currencySym }: { label: string; color: string; metrics: ModelCAMetrics; currencySym: string }) {
  const fmt = (n: number) => n === 0 ? '—' : `${currencySym}${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
  const cells = [
    { l: 'Auj',     v: metrics.caToday },
    { l: 'Hier',    v: metrics.caYesterday },
    { l: 'Semaine', v: metrics.caWeek },
    { l: 'Mois',    v: metrics.caMonth },
  ];
  return (
    <div className="bg-[#111] rounded-2xl border border-[#222] p-4 sm:p-5">
      <div className="flex items-center gap-2 mb-4">
        <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
        <span className="text-sm font-bold text-white">{label}</span>
      </div>
      {/* 2 per row on mobile, 4 on sm+ */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-2">
        {cells.map((c) => (
          <div key={c.l} className="rounded-xl bg-[#1a1a1a] p-2.5">
            <p className="text-[9px] font-semibold text-[#555] uppercase tracking-wide mb-1">{c.l}</p>
            <p className="text-sm font-bold text-white">{fmt(c.v)}</p>
          </div>
        ))}
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

const EMPTY_CHAT: ModelCAMetrics = { caToday: 0, caYesterday: 0, caWeek: 0, caMonth: 0 };

// ─── Dashboard ────────────────────────────────────────────────────────────────

export default function DashboardPage() {
  const { user } = useAuth();

  const recentInvoices = INVOICES.slice(0, 5);

  const [ofMetrics,  setOfMetrics]  = useState<ConsolidatedMetrics>(EMPTY);
  const [mymMetrics, setMymMetrics] = useState<ConsolidatedMetrics>(EMPTY);
  const [ofChart,    setOfChart]    = useState<ChartPoint[]>([]);
  const [mymChart,   setMymChart]   = useState<ChartPoint[]>([]);
  const [chatOf,     setChatOf]     = useState<ModelCAMetrics>(EMPTY_CHAT);
  const [chatMym,    setChatMym]    = useState<ModelCAMetrics>(EMPTY_CHAT);

  useEffect(() => {
    Promise.all([
      loadPlatformData('of',  OF_MODELS),
      loadPlatformData('mym', MYM_MODELS),
      loadRecaps(),
    ]).then(([ofData, mymData, recaps]) => {
      setOfMetrics(calcConsolidated(ofData));
      setMymMetrics(calcConsolidated(mymData));
      setOfChart(getConsolidatedChartData(ofData));
      setMymChart(getConsolidatedChartData(mymData));
      setChatOf(calcPlatformCA(recaps, CHAT_OF,  'of'));
      setChatMym(calcPlatformCA(recaps, CHAT_MYM, 'mym'));
    });
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

      {/* ── Chatting CA ── */}
      <div>
        <div className="flex items-center gap-3 mb-3">
          <h2 className="text-sm font-bold text-[#555] uppercase tracking-wide">CA Chatting</h2>
          <div className="flex-1 h-px bg-[#222]" />
          <Link href="/dashboard/chatter" className="flex items-center gap-1 text-xs font-medium text-[#C9A84C] hover:text-[#E2C06A] transition flex-shrink-0">
            Voir détails <ArrowUpRight size={11} />
          </Link>
        </div>
        {/* 1 column on mobile, 2 on sm+ */}
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
          <ChatCACard label="Chatting OnlyFans" color="#a855f7" metrics={chatOf}  currencySym="$" />
          <ChatCACard label="Chatting MYM"      color="#ec4899" metrics={chatMym} currencySym="€" />
        </div>
      </div>

      {/* ── Models + Paiements ── */}
      {/* 1 column on mobile/tablet, 3-col grid on lg+ */}
      <div className="grid grid-cols-1 lg:grid-cols-3 gap-5">
        {/* Models — takes 2 of 3 cols on lg+ */}
        <div className="lg:col-span-2 bg-[#111] rounded-2xl border border-[#222] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <div className="flex items-center gap-2">
              <h2 className="font-semibold text-white">Models</h2>
              <span className="text-xs bg-[#1a1a1a] text-[#888] px-2 py-0.5 rounded-full">
                {MODELS.filter((m) => m.status === 'active').length} actives
              </span>
            </div>
            <Link href="/dashboard/models" className="flex items-center gap-1.5 text-sm text-[#C9A84C] hover:text-[#E2C06A] font-medium transition flex-shrink-0">
              Voir tout <ArrowUpRight size={14} />
            </Link>
          </div>
          <div className="space-y-1">
            {MODELS.map((model) => (
              <div key={model.id} className="flex items-center gap-3 px-2 sm:px-3 py-2.5 rounded-xl hover:bg-[#1a1a1a] transition">
                <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                  <span className="text-[#C9A84C] text-sm font-bold">{model.name.charAt(0)}</span>
                </div>
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white truncate">{model.name}</p>
                  <p className="text-xs text-[#888] truncate">{model.pseudo} · {model.manager}</p>
                </div>
                {/* Platform badges — hidden on very small screens to prevent overflow */}
                <div className="hidden sm:flex gap-1 flex-shrink-0">
                  {model.platforms.map((p) => (
                    <span key={p} className={`px-2 py-0.5 rounded-full text-xs font-medium ${
                      p === 'MYM' ? 'bg-pink-500/10 text-pink-400' :
                      p === 'OF'  ? 'bg-purple-500/10 text-purple-400' :
                      'bg-emerald-500/10 text-emerald-400'
                    }`}>{p}</span>
                  ))}
                </div>
                <span className="flex items-center gap-1 text-xs text-green-400 bg-green-500/10 px-2 py-1 rounded-full flex-shrink-0">
                  <span className="w-1.5 h-1.5 rounded-full bg-green-500 flex-shrink-0" />
                  Actif
                </span>
              </div>
            ))}
          </div>
        </div>

        {/* Derniers paiements */}
        <div className="bg-[#111] rounded-2xl border border-[#222] p-4 sm:p-5">
          <div className="flex items-center justify-between mb-4 sm:mb-5">
            <h2 className="font-semibold text-white">Derniers paiements</h2>
            <Link href="/dashboard/invoices" className="text-sm text-[#C9A84C] hover:text-[#E2C06A] font-medium transition flex-shrink-0">
              Voir tout
            </Link>
          </div>
          <div className="space-y-3">
            {recentInvoices.map((inv) => {
              const model = MODELS.find((m) => m.id === inv.modelId);
              const sym   = inv.currency === 'EUR' ? '€' : inv.currency === 'GBP' ? '£' : '$';
              return (
                <div key={inv.id} className="flex items-center justify-between py-1.5">
                  <div className="flex items-center gap-2.5 min-w-0">
                    <div className="w-7 h-7 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0">
                      <span className="text-[#C9A84C] text-xs font-bold">{model?.name.charAt(0)}</span>
                    </div>
                    <div className="min-w-0">
                      <p className="text-xs font-medium text-white truncate">{model?.name}</p>
                      <p className="text-xs text-[#888]">{inv.platform}</p>
                    </div>
                  </div>
                  <span className="text-sm font-semibold text-white flex-shrink-0 ml-2">{sym}{inv.amount.toLocaleString('fr-FR')}</span>
                </div>
              );
            })}
          </div>
        </div>
      </div>
    </div>
  );
}
