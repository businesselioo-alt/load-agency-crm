'use client';

import { useState, useEffect, useMemo } from 'react';
import {
  ShiftRecap, ChattingPlatform,
  OF_MODELS, MYM_MODELS, CHAT_MODELS,
  loadRecaps, calcModelCA, calcPlatformCA,
  todayStr,
} from '@/lib/chatting';

function fmtCA(n: number) {
  return n === 0 ? '—' : `€${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}

// ─── Platform table ───────────────────────────────────────────────────────────

function PlatformTable({ platform, recaps, accentColor }: {
  platform: ChattingPlatform; recaps: ShiftRecap[]; accentColor: string;
}) {
  const models   = CHAT_MODELS[platform];
  const label    = platform === 'of' ? 'OnlyFans' : 'MYM';
  const totals   = useMemo(() => calcPlatformCA(recaps, models, platform), [recaps, models, platform]);

  return (
    <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-[#222]">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor }} />
        <h3 className="font-bold text-white">{label}</h3>
        <span className="text-xs text-[#555] bg-[#1a1a1a] border border-[#333] px-2 py-0.5 rounded-full">{models.length} models</span>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm">
          <thead>
            <tr style={{ backgroundColor: accentColor + '08' }} className="border-b border-[#222]">
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-40">Model</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-28">CA Aujourd'hui</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-24">CA Hier</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-24">CA Semaine</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-24">CA Mois</th>
            </tr>
          </thead>
          <tbody>
            {/* Totals row */}
            <tr className="border-b border-[#222]" style={{ backgroundColor: accentColor + '08' }}>
              <td className="px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>Totaux</span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-white">{fmtCA(totals.caToday)}</td>
              <td className="px-4 py-3 text-right font-bold text-white">{fmtCA(totals.caYesterday)}</td>
              <td className="px-4 py-3 text-right font-bold text-white">{fmtCA(totals.caWeek)}</td>
              <td className="px-4 py-3 text-right font-bold text-white">{fmtCA(totals.caMonth)}</td>
            </tr>

            {/* Per-model rows */}
            {models.map((model) => {
              const m = calcModelCA(recaps, model, platform);
              const hasAny = m.caToday + m.caYesterday + m.caWeek + m.caMonth > 0;
              return (
                <tr key={model} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors">
                  <td className="px-5 py-2.5">
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                           style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                        {model.charAt(0).toUpperCase()}
                      </div>
                      <span className={`font-medium truncate max-w-[100px] ${hasAny ? 'text-white' : 'text-[#555]'}`}>{model}</span>
                    </div>
                  </td>
                  <td className="px-4 py-2.5 text-right text-sm text-[#888]">{fmtCA(m.caToday)}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-[#888]">{fmtCA(m.caYesterday)}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-[#888]">{fmtCA(m.caWeek)}</td>
                  <td className="px-4 py-2.5 text-right text-sm text-[#888]">{fmtCA(m.caMonth)}</td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

// ─── Daily detail view ────────────────────────────────────────────────────────

function DailyDetail({ recaps }: { recaps: ShiftRecap[] }) {
  const [date, setDate] = useState(todayStr());

  const dayRecaps = useMemo(
    () => recaps.filter((r) => r.date === date).sort((a, b) => a.platform.localeCompare(b.platform) || a.model.localeCompare(b.model)),
    [recaps, date],
  );

  const grouped = useMemo(() => {
    const m = new Map<string, ShiftRecap[]>();
    for (const r of dayRecaps) {
      const key = `${r.platform}:${r.model}`;
      const arr = m.get(key) ?? [];
      arr.push(r);
      m.set(key, arr);
    }
    return m;
  }, [dayRecaps]);

  const totalCA = dayRecaps.reduce((s, r) => s + r.caNet, 0);

  return (
    <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#222]">
        <h3 className="font-bold text-white">Détail journalier</h3>
        <input
          type="date" value={date} onChange={(e) => setDate(e.target.value)}
          className="ml-auto bg-[#1a1a1a] border border-[#333] text-white rounded-lg px-3 py-1.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]"
        />
        {totalCA > 0 && (
          <div className="text-sm font-bold text-white">
            Total : €{totalCA.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}
          </div>
        )}
      </div>

      {dayRecaps.length === 0 ? (
        <div className="py-12 text-center text-[#555] text-sm">Aucune saisie pour cette date</div>
      ) : (
        <div className="divide-y divide-[#1a1a1a]">
          {Array.from(grouped.entries()).map(([key, recs]) => {
            const [platform, model] = key.split(':');
            const sum = recs.reduce((s, r) => s + r.caNet, 0);
            return (
              <div key={key} className="px-6 py-3 flex items-center gap-3">
                <span className={`text-[10px] font-bold px-2 py-0.5 rounded-full ${platform === 'of' ? 'bg-purple-500/10 text-purple-400' : 'bg-pink-500/10 text-pink-400'}`}>
                  {platform.toUpperCase()}
                </span>
                <span className="text-sm font-medium text-white flex-1">{model}</span>
                <div className="text-right">
                  <p className="text-sm font-bold text-white">€{sum.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}</p>
                  <p className="text-[10px] text-[#888]">
                    {recs.map((r) => `${r.chatterName.split(' ')[0]}`).join(', ')}
                  </p>
                </div>
              </div>
            );
          })}
        </div>
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ModelCADashboard() {
  const [recaps, setRecaps] = useState<ShiftRecap[]>([]);

  useEffect(() => { loadRecaps().then(setRecaps); }, []);

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Dashboard CA Chatting</h2>
        <p className="text-sm text-[#888] mt-0.5">CA net généré par plateforme et par model</p>
      </div>

      <PlatformTable platform="of"  recaps={recaps} accentColor="#a855f7" />
      <PlatformTable platform="mym" recaps={recaps} accentColor="#ec4899" />
      <DailyDetail   recaps={recaps} />
    </div>
  );
}
