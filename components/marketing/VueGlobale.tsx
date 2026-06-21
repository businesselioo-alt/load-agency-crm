'use client';

import { useState, useEffect, useRef, useMemo } from 'react';
import { Plus, X, Edit2, Trash2, BarChart2, RefreshCw } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  DailyEntry, ModelStats, PlatformData, VGPlatform,
  OF_MODELS, MYM_MODELS,
  loadPlatformData, savePlatformData,
  todayStr, yesterdayStr, monthStartStr,
} from '@/lib/performance-data';


// ─── Helpers ──────────────────────────────────────────────────────────────────

function uid() { return Math.random().toString(36).slice(2); }
function fmtCA(n: number, sym = '€') {
  if (n === 0) return '—';
  return `${sym}${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;
}
function fmtN(n: number) { return n === 0 ? '—' : n.toLocaleString('fr-FR'); }

function getYesterdayEntry(entries: DailyEntry[]): DailyEntry | undefined {
  return entries.find((e) => e.date === yesterdayStr());
}
function getTodayEntry(entries: DailyEntry[]): DailyEntry | undefined {
  return entries.find((e) => e.date === todayStr());
}
function sumMonthField(entries: DailyEntry[], field: 'newSubs' | 'revenue'): number {
  const ms = monthStartStr(); const t = todayStr();
  return entries.filter((e) => e.date >= ms && e.date <= t).reduce((s, e) => s + e[field], 0);
}

// ─── Entry Modal (history side panel) ────────────────────────────────────────

function EntryModal({
  initial, onSave, onClose, currencySym,
}: { initial?: DailyEntry; onSave: (e: DailyEntry) => void; onClose: () => void; currencySym: string }) {
  const [date, setDate] = useState(initial?.date ?? todayStr());
  const [subs, setSubs] = useState(String(initial?.newSubs ?? 0));
  const [rev,  setRev]  = useState(String(initial?.revenue ?? ''));
  const [note, setNote] = useState(initial?.note ?? '');

  function handleSave() {
    onSave({ id: initial?.id ?? uid(), date, newSubs: Number(subs) || 0, revenue: parseFloat(rev.replace(',', '.')) || 0, note });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#111] border border-white/[0.08] rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-semibold text-[#f0f0f0] text-sm">{initial ? "Modifier l'entrée" : 'Nouvelle entrée'}</h3>
          <button onClick={onClose} className="text-[#555] hover:text-[#f0f0f0] transition"><X size={16} /></button>
        </div>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#999]">Date</span>
          <input type="date" value={date} onChange={(e) => setDate(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] text-[#f0f0f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 focus:border-[#C9A84C] hover:border-[#C9A84C]/30 w-full transition" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#999]">Nouveaux abonnés</span>
          <input type="number" min="0" value={subs} onChange={(e) => setSubs(e.target.value)} className="bg-white/[0.04] border border-white/[0.08] text-[#f0f0f0] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 focus:border-[#C9A84C] hover:border-[#C9A84C]/30 w-full transition" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#999]">CA ({currencySym})</span>
          <input type="number" min="0" step="0.01" value={rev} onChange={(e) => setRev(e.target.value)} placeholder="0.00" className="bg-white/[0.04] border border-white/[0.08] text-[#f0f0f0] placeholder-[#555] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 focus:border-[#C9A84C] hover:border-[#C9A84C]/30 w-full transition" />
        </label>
        <label className="flex flex-col gap-1">
          <span className="text-xs font-medium text-[#999]">Note</span>
          <input type="text" value={note} onChange={(e) => setNote(e.target.value)} placeholder="Optionnel" className="bg-white/[0.04] border border-white/[0.08] text-[#f0f0f0] placeholder-[#555] rounded-lg px-3 py-2 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20 focus:border-[#C9A84C] hover:border-[#C9A84C]/30 w-full transition" />
        </label>
        <div className="flex gap-2 pt-1">
          <button onClick={onClose}    className="flex-1 py-2 rounded-xl border border-white/[0.08] text-sm text-[#999] hover:bg-white/[0.04] hover:border-[#C9A84C]/30 transition">Annuler</button>
          <button onClick={handleSave} className="flex-1 py-2 rounded-xl bg-[#C9A84C] text-black text-sm font-semibold hover:bg-[#E2C06A] transition" style={{ boxShadow: '0 4px 14px rgba(201,168,76,0.40)' }}>Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── History Side Panel ───────────────────────────────────────────────────────

function SidePanel({ modelName, stats, canEdit, currencySym, onClose, onUpdate }: {
  modelName: string; stats: ModelStats; canEdit: boolean; currencySym: string;
  onClose: () => void; onUpdate: (s: ModelStats) => void;
}) {
  const [entryModal, setEntryModal] = useState<DailyEntry | 'new' | null>(null);
  const sorted = [...stats.entries].sort((a, b) => b.date.localeCompare(a.date));

  function handleSave(entry: DailyEntry) {
    const entries = stats.entries.some((e) => e.id === entry.id)
      ? stats.entries.map((e) => (e.id === entry.id ? entry : e))
      : [...stats.entries, entry];
    onUpdate({ ...stats, entries });
    setEntryModal(null);
  }

  return (
    <>
      <div className="fixed inset-0 z-40" onClick={onClose} />
      <div className="fixed top-0 right-0 h-full w-96 z-50 bg-[#111] border-l border-white/[0.08] shadow-2xl flex flex-col">
        <div className="flex items-center gap-3 px-5 py-4 border-b border-white/[0.08]">
          <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 border border-[#C9A84C]/20 flex items-center justify-center flex-shrink-0">
            <span className="text-[#C9A84C] text-xs font-bold">{modelName.charAt(0).toUpperCase()}</span>
          </div>
          <div className="flex-1 min-w-0">
            <p className="font-semibold text-[#f0f0f0] text-sm truncate">{modelName}</p>
            <p className="text-xs text-[#999]">Historique des entrées</p>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-[#f0f0f0] transition"><X size={18} /></button>
        </div>

        {canEdit && (
          <div className="px-4 py-3 border-b border-white/[0.05]">
            <button
              onClick={() => setEntryModal('new')}
              className="flex items-center justify-center gap-2 w-full py-2 rounded-xl border border-dashed border-[#C9A84C]/40 text-[#C9A84C] text-sm font-medium hover:bg-[#C9A84C]/[0.07] transition"
            >
              <Plus size={14} /> Ajouter une entrée
            </button>
          </div>
        )}

        <div className="flex-1 overflow-y-auto p-4 space-y-2">
          {sorted.length === 0 && <div className="text-center py-12 text-[#555] text-sm">Aucune entrée</div>}
          {sorted.map((entry) => (
            <div key={entry.id} className="rounded-xl border border-white/[0.08] bg-white/[0.02] p-3 hover:border-[#C9A84C]/25 transition">
              <div className="flex items-center justify-between mb-1.5">
                <span className="text-xs font-semibold text-[#999]">
                  {new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'short', day: 'numeric', month: 'short' })}
                </span>
                {canEdit && (
                  <div className="flex gap-1">
                    <button onClick={() => setEntryModal(entry)} className="text-[#555] hover:text-[#C9A84C] transition p-0.5"><Edit2 size={12} /></button>
                    <button onClick={() => onUpdate({ ...stats, entries: stats.entries.filter((e) => e.id !== entry.id) })} className="text-[#555] hover:text-red-400 transition p-0.5"><Trash2 size={12} /></button>
                  </div>
                )}
              </div>
              <div className="flex gap-4">
                <span className="text-xs text-[#999]"><span className="font-semibold text-[#f0f0f0]">{fmtCA(entry.revenue, currencySym)}</span> CA</span>
                <span className="text-xs text-[#999]"><span className="font-semibold text-[#f0f0f0]">+{entry.newSubs}</span> subs</span>
              </div>
              {entry.note && <p className="text-xs text-[#555] mt-1 italic">{entry.note}</p>}
            </div>
          ))}
        </div>
      </div>

      {entryModal !== null && (
        <EntryModal
          initial={entryModal === 'new' ? undefined : entryModal}
          onSave={handleSave}
          onClose={() => setEntryModal(null)}
          currencySym={currencySym}
        />
      )}
    </>
  );
}

// ─── Editable cell (single click) ────────────────────────────────────────────

type CellField = 'totalSubs' | 'subsLast30Days' | 'caHier';

function EditCell({ value, isActive, canEdit, isCurrency = false, currencySym = '€', onActivate, onSave, onCancel }: {
  value: number; isActive: boolean; canEdit: boolean; isCurrency?: boolean; currencySym?: string;
  onActivate: () => void; onSave: (v: number) => void; onCancel: () => void;
}) {
  const [draft, setDraft] = useState('');
  const ref = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (isActive) { setDraft(String(value)); setTimeout(() => ref.current?.select(), 0); }
  }, [isActive]); // eslint-disable-line react-hooks/exhaustive-deps

  if (isActive) {
    return (
      <input
        ref={ref} type="number" min="0" step={isCurrency ? '0.01' : '1'}
        value={draft}
        onChange={(e) => setDraft(e.target.value)}
        onBlur={() => onSave(parseFloat(draft.replace(',', '.')) || 0)}
        onKeyDown={(e) => {
          if (e.key === 'Enter')  { (e.target as HTMLInputElement).blur(); }
          if (e.key === 'Escape') onCancel();
        }}
        className="w-full bg-white/[0.06] border border-[#C9A84C]/50 rounded-lg px-2 py-1 text-xs text-[#f0f0f0] text-right focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/20"
      />
    );
  }

  return (
    <span
      onClick={canEdit ? onActivate : undefined}
      className={`block text-right text-sm text-[#999] rounded-md px-1 py-0.5 -mx-1 transition-colors
        ${canEdit ? 'cursor-pointer hover:bg-[#C9A84C]/[0.10] hover:text-[#C9A84C]' : ''}`}
    >
      {isCurrency ? fmtCA(value, currencySym) : fmtN(value)}
    </span>
  );
}

// ─── Platform section ─────────────────────────────────────────────────────────

function PlatformSection({ platform, models, accentColor, canEdit, refreshKey, syncBadge }: {
  platform: VGPlatform; models: string[]; accentColor: string; canEdit: boolean;
  refreshKey?: number;
  syncBadge?: React.ReactNode;
}) {
  const [data,          setData]          = useState<PlatformData>({});
  const [selectedModel, setSelectedModel] = useState<string | null>(null);
  const [cellEdit,      setCellEdit]      = useState<{ model: string; field: CellField } | null>(null);

  useEffect(() => {
    loadPlatformData(platform, models).then(setData);
  }, [platform, refreshKey]); // eslint-disable-line react-hooks/exhaustive-deps

  function persist(d: PlatformData) { setData(d); savePlatformData(platform, d); }

  function updateStats(model: string, patch: Partial<ModelStats>) {
    persist({ ...data, [model]: { ...data[model], ...patch } });
  }

  function saveYesterdayField(model: string, field: 'newSubs' | 'revenue', value: number) {
    const ystr   = yesterdayStr();
    const stats  = data[model] ?? { totalSubs: 0, subsLast30Days: 0, entries: [] };
    const exists = stats.entries.find((e) => e.date === ystr);
    const entries = exists
      ? stats.entries.map((e) => (e.date === ystr ? { ...e, [field]: value } : e))
      : [...stats.entries, { id: uid(), date: ystr, newSubs: field === 'newSubs' ? value : 0, revenue: field === 'revenue' ? value : 0, note: '' }];
    persist({ ...data, [model]: { ...stats, entries } });
  }

  // Consolidated row values
  const ystr = yesterdayStr(); const ms = monthStartStr(); const t = todayStr();
  const consolidated = useMemo(() => ({
    totalSubs: models.reduce((s, m) => s + (data[m]?.totalSubs ?? 0), 0),
    subsL30:   models.reduce((s, m) => s + (data[m]?.subsLast30Days ?? 0), 0),
    caHier:    models.reduce((s, m) => s + (data[m]?.entries.find((e) => e.date === ystr)?.revenue ?? 0), 0),
    caAujourd: models.reduce((s, m) => s + (data[m]?.entries.find((e) => e.date === t)?.revenue ?? 0), 0),
    // Sum ALL entries from the 1st of the current month to today (inclusive),
    // from every source (manual entry or Infloww auto-sync).
    caMois:    models.reduce((s, m) => s + (data[m]?.entries ?? []).filter((e) => e.date >= ms && e.date <= t).reduce((a, e) => a + e.revenue, 0), 0),
  }), [data, models, ystr, ms, t]);

  const label        = platform === 'of' ? 'OnlyFans' : 'MYM';
  const currencySym  = platform === 'of' ? '$' : '€';

  return (
    <div className="bg-[#111] rounded-xl border border-white/[0.08] overflow-hidden" style={{ boxShadow: '0 2px 16px rgba(0,0,0,0.6)' }}>
      {/* Header */}
      <div className="flex items-center gap-3 px-6 py-4 border-b border-white/[0.08]">
        <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: accentColor, boxShadow: `0 0 8px ${accentColor}80` }} />
        <h3 className="font-bold text-[#f0f0f0]">{label}</h3>
        <span className="text-xs text-[#555] bg-white/[0.04] border border-white/[0.08] px-2 py-0.5 rounded-full">{models.length} models</span>
        <div className="ml-auto flex items-center gap-3">
          {syncBadge}
          {canEdit && <p className="text-[11px] text-[#555]">Cliquer une cellule pour modifier</p>}
        </div>
      </div>

      {/* Table */}
      <div className="overflow-x-auto">
        <table className="w-full text-sm min-w-[680px]">
          <thead>
            <tr className="border-b border-white/[0.08]">
              {/* Model col */}
              <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-36" style={{ backgroundColor: accentColor + '10' }}>Model</th>

              {/* Manual editable */}
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-28" style={{ backgroundColor: accentColor + '10' }}>Total Abonnés</th>
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide w-24" style={{ backgroundColor: accentColor + '10' }}>Subs L30</th>

              {/* Yesterday revenue — auto-synced via Infloww (OF) or manual (MYM) */}
              <th className="text-right px-4 py-3 w-24" style={{ backgroundColor: 'rgba(245,158,11,0.10)' }}>
                <span className="text-[10px] font-semibold text-amber-400 uppercase tracking-wide">CA Hier</span>
                <span className="block text-[9px] text-amber-500/60 font-normal normal-case tracking-normal">saisie quotidienne</span>
              </th>

              {/* Today revenue — live from Infloww (OF), read-only */}
              <th className="text-right px-4 py-3 w-24" style={{ backgroundColor: 'rgba(59,130,246,0.10)' }}>
                <span className="flex items-center justify-end gap-1.5 text-[10px] font-semibold text-blue-400 uppercase tracking-wide">
                  <span className="w-1.5 h-1.5 rounded-full bg-blue-400 animate-pulse flex-shrink-0" />
                  CA Auj.
                </span>
                <span className="block text-[9px] text-blue-500/50 font-normal normal-case tracking-normal">temps réel</span>
              </th>

              {/* Running month total — sum of ALL entries from the 1st to today */}
              <th className="text-right px-4 py-3 text-[10px] font-semibold text-emerald-400 uppercase tracking-wide w-28" style={{ backgroundColor: 'rgba(34,197,94,0.10)' }}>
                CA Mois
                <span className="block text-[9px] text-emerald-500/50 font-normal normal-case tracking-normal">depuis le 1er</span>
              </th>

              <th className="w-10" />
            </tr>
          </thead>
          <tbody>
            {/* Consolidated totals row */}
            <tr className="border-b border-white/[0.08]" style={{ backgroundColor: accentColor + '08' }}>
              <td className="px-5 py-3">
                <span className="text-[10px] font-bold uppercase tracking-widest" style={{ color: accentColor }}>Totaux</span>
              </td>
              <td className="px-4 py-3 text-right font-bold text-[#f0f0f0] text-sm">{fmtN(consolidated.totalSubs)}</td>
              <td className="px-4 py-3 text-right font-bold text-[#f0f0f0] text-sm">{fmtN(consolidated.subsL30)}</td>
              <td className="px-4 py-3 text-right font-bold text-[#f0f0f0] text-sm" style={{ backgroundColor: 'rgba(245,158,11,0.07)' }}>{fmtCA(consolidated.caHier, currencySym)}</td>
              <td className="px-4 py-3 text-right font-bold text-blue-400 text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.07)' }}>{fmtCA(consolidated.caAujourd, currencySym)}</td>
              <td className="px-4 py-3 text-right font-bold text-emerald-400 text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.05)' }}>{fmtCA(consolidated.caMois, currencySym)}</td>
              <td />
            </tr>

            {/* Per-model rows */}
            {models.map((model) => {
              const stats      = data[model] ?? { totalSubs: 0, subsLast30Days: 0, entries: [] };
              const yEntry     = getYesterdayEntry(stats.entries);
              const caHier     = yEntry?.revenue ?? 0;
              const todayEntry = getTodayEntry(stats.entries);
              const caAujourd  = todayEntry?.revenue ?? 0;
              const caMois     = sumMonthField(stats.entries, 'revenue');

              const isActive = (f: CellField) => cellEdit?.model === model && cellEdit?.field === f;
              const activate = (f: CellField) => () => { if (canEdit) setCellEdit({ model, field: f }); };
              const cancel   = () => setCellEdit(null);

              return (
                <tr key={model} className="border-b border-white/[0.04] hover:bg-white/[0.02] transition-colors group">
                  {/* Model name */}
                  <td className="px-5 py-2" style={{ backgroundColor: accentColor + '08' }}>
                    <div className="flex items-center gap-2">
                      <div className="w-6 h-6 rounded-full flex items-center justify-center flex-shrink-0 text-xs font-bold"
                           style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                        {model.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-medium text-[#f0f0f0] truncate max-w-[90px] text-xs">{model}</span>
                    </div>
                  </td>

                  {/* Total Abonnés */}
                  <td className="px-4 py-2" style={{ backgroundColor: accentColor + '08' }}>
                    <EditCell
                      value={stats.totalSubs} isActive={isActive('totalSubs')} canEdit={canEdit}
                      onActivate={activate('totalSubs')}
                      onSave={(v) => { updateStats(model, { totalSubs: v }); setCellEdit(null); }}
                      onCancel={cancel}
                    />
                  </td>

                  {/* Subs L30 */}
                  <td className="px-4 py-2" style={{ backgroundColor: accentColor + '08' }}>
                    <EditCell
                      value={stats.subsLast30Days} isActive={isActive('subsLast30Days')} canEdit={canEdit}
                      onActivate={activate('subsLast30Days')}
                      onSave={(v) => { updateStats(model, { subsLast30Days: v }); setCellEdit(null); }}
                      onCancel={cancel}
                    />
                  </td>

                  {/* CA hier — auto-synced (OF: Infloww) or manually editable */}
                  <td className="px-4 py-2" style={{ backgroundColor: 'rgba(245,158,11,0.06)' }}>
                    <EditCell
                      value={caHier} isActive={isActive('caHier')} canEdit={canEdit} isCurrency currencySym={currencySym}
                      onActivate={activate('caHier')}
                      onSave={(v) => { saveYesterdayField(model, 'revenue', v); setCellEdit(null); }}
                      onCancel={cancel}
                    />
                  </td>

                  {/* CA aujourd'hui — live from Infloww (OF), read-only */}
                  <td className="px-4 py-2 text-right text-sm" style={{ backgroundColor: 'rgba(59,130,246,0.05)' }}>
                    <span className={caAujourd > 0 ? 'font-semibold text-blue-400' : 'text-[#444]'}>{fmtCA(caAujourd, currencySym)}</span>
                  </td>

                  {/* CA mois — sum of ALL entries from the 1st to today */}
                  <td className="px-4 py-2 text-right text-sm" style={{ backgroundColor: 'rgba(34,197,94,0.05)' }}>
                    <span className={caMois > 0 ? 'font-semibold text-emerald-400' : 'text-[#444]'}>{fmtCA(caMois, currencySym)}</span>
                  </td>

                  {/* History icon */}
                  <td className="px-2 py-2">
                    <button
                      onClick={() => setSelectedModel(model)}
                      title="Historique des entrées"
                      className="opacity-0 group-hover:opacity-100 p-1.5 rounded-lg hover:bg-[#C9A84C]/10 text-[#555] hover:text-[#C9A84C] transition"
                    >
                      <BarChart2 size={13} />
                    </button>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>

      {/* Side panel */}
      {selectedModel && (
        <SidePanel
          modelName={selectedModel}
          stats={data[selectedModel] ?? { totalSubs: 0, subsLast30Days: 0, entries: [] }}
          canEdit={canEdit}
          currencySym={currencySym}
          onClose={() => setSelectedModel(null)}
          onUpdate={(s) => updateStats(selectedModel, s)}
        />
      )}
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

const LAST_SYNC_LS_KEY = 'infloww_last_sync';

function timeSince(ts: number): string {
  const mins = Math.floor((Date.now() - ts) / 60000);
  if (mins < 1) return "à l’instant";
  if (mins === 1) return 'il y a 1 min';
  if (mins < 60) return `il y a ${mins} min`;
  return `il y a ${Math.floor(mins / 60)}h`;
}

export default function VueGlobale() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [refreshKey, setRefreshKey] = useState(0);
  const [lastSynced, setLastSynced] = useState<number | null>(null);
  const [isSyncing,  setIsSyncing]  = useState(false);
  const [, forceRender] = useState(0);

  useEffect(() => {
    const stored = localStorage.getItem(LAST_SYNC_LS_KEY);
    if (stored) setLastSynced(Number(stored));
    // Refresh "X min ago" text every minute
    const tick = setInterval(() => forceRender((n) => n + 1), 60_000);
    return () => clearInterval(tick);
  }, []);

  // Auto-poll every 5 minutes in background
  useEffect(() => {
    const id = setInterval(async () => {
      try {
        await fetch('/api/cron/sync-infloww');
        const now = Date.now();
        setLastSynced(now);
        localStorage.setItem(LAST_SYNC_LS_KEY, String(now));
        setRefreshKey((k) => k + 1);
      } catch { /* silent */ }
    }, 5 * 60_000);
    return () => clearInterval(id);
  }, []);

  async function syncInfloww() {
    if (isSyncing) return;
    setIsSyncing(true);
    try {
      await fetch('/api/cron/sync-infloww');
      const now = Date.now();
      setLastSynced(now);
      localStorage.setItem(LAST_SYNC_LS_KEY, String(now));
      setRefreshKey((k) => k + 1);
    } catch { /* ignore */ } finally {
      setIsSyncing(false);
    }
  }

  const syncBadge = (
    <div className="flex items-center gap-2">
      {lastSynced && (
        <span className="text-[11px] text-[#555] flex items-center gap-1.5">
          <span className="w-1.5 h-1.5 rounded-full bg-emerald-500 opacity-70" />
          Infloww · {timeSince(lastSynced)}
        </span>
      )}
      <button
        onClick={syncInfloww}
        disabled={isSyncing}
        className="flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] font-medium border border-[#C9A84C]/30 text-[#C9A84C] hover:bg-[#C9A84C]/[0.10] transition disabled:opacity-40 disabled:cursor-not-allowed"
      >
        <RefreshCw size={10} className={isSyncing ? 'animate-spin' : ''} />
        {isSyncing ? 'Sync…' : 'Actualiser'}
      </button>
    </div>
  );

  return (
    <div className="p-6 space-y-6">
      <div>
        <h2 className="text-xl font-bold text-white">Vue Globale</h2>
        <p className="text-sm text-[#888] mt-0.5">
          <span className="font-medium text-[#C9A84C]">CA hier</span> et <span className="font-medium text-blue-400">CA aujourd'hui</span> se synchronisent automatiquement via Infloww — <span className="font-medium text-emerald-400">CA Mois</span> cumule depuis le 1er
        </p>
      </div>
      <PlatformSection platform="of"  models={OF_MODELS}  accentColor="#a855f7" canEdit={canEdit} refreshKey={refreshKey} syncBadge={syncBadge} />
      <PlatformSection platform="mym" models={MYM_MODELS} accentColor="#ec4899" canEdit={canEdit} />
    </div>
  );
}
