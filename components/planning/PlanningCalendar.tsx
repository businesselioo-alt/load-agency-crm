'use client';

import { useState, useEffect, useCallback, useMemo, useRef } from 'react';
import { ChevronLeft, ChevronRight, Plus, CalendarDays, History, X, Check } from 'lucide-react';
import {
  PlanningModel, SFSPlanningSlot, SlotStatus, CustomModel,
  STATUS_CONFIG, COLOR_PALETTE,
  loadSlotsFromKey, saveSlotsToKey, loadModelsFromKey, saveModelsToKey,
} from '@/lib/planning-sfs';
import { PlanningConfig } from '@/lib/planning-config';
import SlotModal from './SlotModal';
import { useAuth } from '@/contexts/AuthContext';

// ─── Constants ────────────────────────────────────────────────────────────────

const GOLD       = '#C9A84C';
const GOLD_HOVER = '#E2C06A';

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

// Status styles — dark bg at 0.12 opacity for visibility, full-sat text
const DARK_STATUS: Record<SlotStatus, { bg: string; border: string; text: string; ring: string; glow: string }> = {
  programmé:  { bg: 'bg-emerald-500/[0.12]', border: 'border-emerald-500/25', text: 'text-emerald-400', ring: 'ring-emerald-500/30', glow: '0 0 12px rgba(16,185,129,0.18)' },
  en_attente: { bg: 'bg-amber-500/[0.12]',   border: 'border-amber-500/25',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   glow: '0 0 12px rgba(245,158,11,0.18)' },
  annulé:     { bg: 'bg-red-500/[0.12]',     border: 'border-red-500/25',     text: 'text-red-400',     ring: 'ring-red-500/30',     glow: '0 0 12px rgba(239,68,68,0.15)' },
};

// ─── Helpers ──────────────────────────────────────────────────────────────────

function dateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function todayDate() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function getModelColor(name: string, models: CustomModel[]) {
  return models.find((m) => m.name === name)?.color ?? GOLD;
}

// ─── Slot card ────────────────────────────────────────────────────────────────

function SlotCard({ slot, isPast, onEdit }: { slot: SFSPlanningSlot; isPast: boolean; onEdit: (s: SFSPlanningSlot) => void }) {
  const cfg   = DARK_STATUS[slot.status];
  const emoji = STATUS_CONFIG[slot.status].emoji;
  return (
    <div
      onClick={() => !isPast && onEdit(slot)}
      className={`px-2 py-1.5 rounded-lg border text-xs transition-all ${cfg.bg} ${cfg.border} ${cfg.text} ${
        !isPast ? 'cursor-pointer hover:brightness-110 active:scale-[0.98]' : 'opacity-40'
      }`}
      style={!isPast ? { boxShadow: cfg.glow } : {}}
    >
      <div className="flex items-center gap-1 font-semibold truncate">
        <span className="text-[11px]">{emoji}</span>
        <span className="truncate">{slot.partnerAgency}</span>
        {slot.time && <span className="ml-auto pl-1 text-[10px] font-normal opacity-50 flex-shrink-0">{slot.time}</span>}
      </div>
      <div className="text-[11px] opacity-60 truncate pl-4">↳ {slot.partnerModel}</div>
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({ day, dateString, isToday, isPast, isCurrentMonth, slots, onAdd, onEdit }: {
  day: number; dateString: string; isToday: boolean; isPast: boolean;
  isCurrentMonth: boolean; slots: SFSPlanningSlot[];
  onAdd: (date: string) => void; onEdit: (slot: SFSPlanningSlot) => void;
}) {
  const canAdd = !isPast && isCurrentMonth && slots.length < 2;

  let cellClass = 'min-h-28 p-1.5 rounded-xl border flex flex-col gap-1 transition-all ';
  if (!isCurrentMonth) {
    cellClass += 'border-white/[0.04] bg-transparent opacity-20';
  } else if (isPast) {
    cellClass += 'border-white/[0.05] bg-white/[0.01] opacity-40';
  } else if (isToday) {
    cellClass += 'border-transparent bg-white/[0.03]';
  } else {
    cellClass += 'border-white/[0.08] bg-white/[0.02] hover:bg-white/[0.04] hover:border-[#C9A84C]/30';
  }

  return (
    <div
      className={cellClass}
      style={isToday ? { borderColor: GOLD + '70', boxShadow: `0 0 0 1px ${GOLD}30, inset 0 0 20px ${GOLD}08` } : {}}
    >
      <div className="flex items-start justify-between">
        <span
          className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold flex-shrink-0 transition-all"
          style={
            isToday
              ? { backgroundColor: GOLD, color: '#000', boxShadow: `0 0 10px ${GOLD}70` }
              : { color: isPast ? '#555' : '#f0f0f0' }
          }
        >
          {day}
        </span>
        {slots.length === 2 && !isPast && (
          <span className="text-[9px] text-[#555] mt-0.5 font-medium uppercase tracking-wide">max</span>
        )}
      </div>
      <div className="flex flex-col gap-1 flex-1">
        {slots.map((slot) => <SlotCard key={slot.id} slot={slot} isPast={isPast} onEdit={onEdit} />)}
      </div>
      {canAdd && (
        <button
          onClick={() => onAdd(dateString)}
          className="flex items-center justify-center gap-0.5 w-full py-1 text-[11px] text-[#555] hover:text-[#C9A84C] hover:bg-[#C9A84C]/5 rounded-lg transition-all"
        >
          <Plus size={10} /> SFS
        </button>
      )}
    </div>
  );
}

// ─── History list ─────────────────────────────────────────────────────────────

function HistoryList({ slots, onEdit }: { slots: SFSPlanningSlot[]; onEdit: (slot: SFSPlanningSlot) => void }) {
  const grouped = useMemo(() => {
    const sorted = [...slots].sort((a, b) => b.date.localeCompare(a.date));
    const map = new Map<string, SFSPlanningSlot[]>();
    sorted.forEach((s) => { const key = s.date.substring(0, 7); if (!map.has(key)) map.set(key, []); map.get(key)!.push(s); });
    return map;
  }, [slots]);

  if (slots.length === 0) return (
    <div className="flex flex-col items-center justify-center py-24 text-center">
      <History size={36} className="text-[#2a2a2a] mb-3" />
      <p className="text-[#555] text-sm">Aucun SFS dans l'historique</p>
    </div>
  );

  return (
    <div className="space-y-8">
      {[...grouped.entries()].map(([monthKey, monthSlots]) => {
        const [year, month] = monthKey.split('-').map(Number);
        return (
          <div key={monthKey}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-[#f0f0f0] text-sm">{MONTHS_FR[month - 1]} {year}</h3>
              <div className="flex-1 h-px bg-white/[0.08]" />
              <span className="text-xs text-[#555]">{monthSlots.length} SFS</span>
            </div>
            <div className="space-y-2">
              {monthSlots.map((slot) => {
                const cfg  = DARK_STATUS[slot.status];
                const scfg = STATUS_CONFIG[slot.status];
                const d = new Date(slot.date + 'T12:00:00');
                return (
                  <div key={slot.id}
                    className="flex items-center gap-4 bg-[#111] rounded-xl border border-white/[0.08] px-4 py-3 hover:border-[#C9A84C]/30 transition cursor-pointer"
                    onClick={() => onEdit(slot)}>
                    <div className="text-center w-10 flex-shrink-0">
                      <p className="text-[10px] text-[#555] uppercase tracking-wide">{MONTHS_FR[d.getMonth()].substring(0, 3)}</p>
                      <p className="text-xl font-bold text-[#f0f0f0] leading-tight">{d.getDate()}</p>
                      {slot.time && <p className="text-[10px] text-[#555]">{slot.time}</p>}
                    </div>
                    <div className="w-px h-8 bg-white/[0.08] flex-shrink-0" />
                    <span className={`flex-shrink-0 flex items-center gap-1.5 px-2.5 py-1 rounded-lg border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}
                      style={{ boxShadow: cfg.glow }}>
                      {scfg.emoji} {scfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-[#f0f0f0]">{slot.partnerAgency}</p>
                      <p className="text-xs text-[#999]">↳ {slot.partnerModel}</p>
                    </div>
                  </div>
                );
              })}
            </div>
          </div>
        );
      })}
    </div>
  );
}

// ─── Add Model Form ───────────────────────────────────────────────────────────

function AddModelForm({ onAdd, onClose, existingNames }: {
  onAdd: (model: CustomModel) => void; onClose: () => void; existingNames: string[];
}) {
  const [name, setName] = useState('');
  const [color, setColor] = useState(COLOR_PALETTE[0]);
  const [error, setError] = useState('');
  const inputRef = useRef<HTMLInputElement>(null);

  useEffect(() => { inputRef.current?.focus(); }, []);
  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    const trimmed = name.trim();
    if (!trimmed) { setError('Le prénom est requis.'); return; }
    if (existingNames.some((n) => n.toLowerCase() === trimmed.toLowerCase())) { setError('Cette model existe déjà.'); return; }
    onAdd({ name: trimmed, color });
    onClose();
  };

  return (
    <div className="absolute top-full left-0 mt-2 z-30 w-72 bg-[#111] rounded-2xl shadow-2xl border border-white/[0.08] p-4">
      <div className="absolute -top-2 left-5 w-3 h-3 bg-[#111] border-l border-t border-white/[0.08] rotate-45" />
      <div className="flex items-center justify-between mb-4">
        <p className="text-sm font-semibold text-[#f0f0f0]">Nouvelle model</p>
        <button onClick={onClose} className="p-1 text-[#555] hover:text-[#f0f0f0] rounded-lg transition"><X size={15} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && (
          <p className="text-xs text-red-400 bg-red-500/[0.12] border border-red-500/25 px-2.5 py-1.5 rounded-lg">{error}</p>
        )}
        <div>
          <label className="block text-xs font-medium text-[#999] mb-1.5">Prénom *</label>
          <input ref={inputRef} type="text" placeholder="ex : Sophie" value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className="w-full px-3 py-2.5 bg-white/[0.04] border border-white/[0.08] rounded-xl text-sm text-[#f0f0f0] placeholder-[#555] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition" />
        </div>
        <div>
          <label className="block text-xs font-medium text-[#999] mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((hex) => (
              <button key={hex} type="button" onClick={() => setColor(hex)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: hex, boxShadow: color === hex ? `0 0 0 2px #111, 0 0 0 3.5px ${hex}` : 'none' }}>
                {color === hex && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-white/[0.04] border border-white/[0.08] rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color, boxShadow: `0 0 6px ${color}80` }} />
            <span className="text-sm font-medium text-[#f0f0f0]">{name || 'Prénom'}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose}
            className="flex-1 py-2 text-sm text-[#999] border border-white/[0.08] rounded-xl hover:bg-white/[0.04] hover:border-[#C9A84C]/30 transition">
            Annuler
          </button>
          <button type="submit"
            className="flex-1 py-2 text-sm font-semibold text-black rounded-xl transition hover:brightness-110"
            style={{ backgroundColor: color }}>
            Ajouter
          </button>
        </div>
      </form>
    </div>
  );
}

// ─── Main component ───────────────────────────────────────────────────────────

type ModalState =
  | { open: false }
  | { open: true; mode: 'add'; date: string; model: PlanningModel }
  | { open: true; mode: 'edit'; slot: SFSPlanningSlot };

interface PlanningCalendarProps {
  config: PlanningConfig;
}

export default function PlanningCalendar({ config }: PlanningCalendarProps) {
  const { user } = useAuth();
  const isAdmin = user?.role === 'admin';

  const [slots, setSlots] = useState<SFSPlanningSlot[]>([]);
  const [models, setModels] = useState<CustomModel[]>([]);
  const [ready, setReady] = useState(false);
  const [selectedModel, setSelectedModel] = useState<PlanningModel>(config.initialModel);
  const [view, setView] = useState<'upcoming' | 'history'>('upcoming');
  const [currentMonth, setCurrentMonth] = useState(() => { const d = new Date(); return new Date(d.getFullYear(), d.getMonth(), 1); });
  const [modal, setModal] = useState<ModalState>({ open: false });
  const [showAddModel, setShowAddModel] = useState(false);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);
  const addModelBtnRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    setReady(false);
    Promise.all([
      loadSlotsFromKey(config.slotsKey),
      loadModelsFromKey(config.modelsKey, config.defaultModels),
    ]).then(([loadedSlots, loadedModels]) => {
      setSlots(loadedSlots);
      setModels(loadedModels);
      setSelectedModel(
        loadedModels.find((m) => m.name === config.initialModel)
          ? config.initialModel
          : loadedModels[0]?.name ?? ''
      );
      setView('upcoming');
      setModal({ open: false });
      setShowAddModel(false);
      setConfirmDelete(null);
      setReady(true);
    });
  }, [config.slotsKey, config.modelsKey, config.initialModel]); // eslint-disable-line react-hooks/exhaustive-deps

  useEffect(() => { if (ready) saveSlotsToKey(config.slotsKey, slots); }, [slots, ready, config.slotsKey]);
  useEffect(() => { if (ready) saveModelsToKey(config.modelsKey, models); }, [models, ready, config.modelsKey]);

  useEffect(() => {
    if (!showAddModel) return;
    const handler = (e: MouseEvent) => {
      if (addModelBtnRef.current && !addModelBtnRef.current.contains(e.target as Node)) setShowAddModel(false);
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, [showAddModel]);

  const today  = todayDate();
  const todayStr = dateStr(today);
  const activeColor = getModelColor(selectedModel, models);

  const modelSlots    = useMemo(() => slots.filter((s) => s.modelName === selectedModel), [slots, selectedModel]);
  const upcomingSlots = useMemo(() => modelSlots.filter((s) => s.date >= todayStr), [modelSlots, todayStr]);
  const historySlots  = useMemo(() => modelSlots.filter((s) => s.date < todayStr),  [modelSlots, todayStr]);
  const slotsOnDate   = useCallback((date: string) => modelSlots.filter((s) => s.date === date).length, [modelSlots]);

  const year  = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const startOffset   = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth   = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d), isCurrentMonth: true });
  while (cells.length % 7 !== 0) { const d = cells.length - startOffset - daysInMonth + 1; cells.push({ day: d, date: new Date(year, month + 1, d), isCurrentMonth: false }); }

  const addSlot = (data: Omit<SFSPlanningSlot, 'id' | 'createdAt'>) => {
    setSlots((prev) => [...prev, { ...data, id: `slot_${Date.now()}_${Math.random().toString(36).slice(2, 7)}`, createdAt: new Date().toISOString() }]);
    setModal({ open: false });
  };
  const editSlot = (data: Omit<SFSPlanningSlot, 'id' | 'createdAt'>) => {
    if (modal.open && modal.mode === 'edit') setSlots((prev) => prev.map((s) => (s.id === modal.slot.id ? { ...s, ...data } : s)));
    setModal({ open: false });
  };
  const deleteSlot = (id: string) => setSlots((prev) => prev.filter((s) => s.id !== id));

  const addModel = (model: CustomModel) => { setModels((prev) => [...prev, model]); setSelectedModel(model.name); };
  const deleteModel = (name: string) => {
    const remaining = models.filter((m) => m.name !== name);
    setModels(remaining);
    setSlots((prev) => prev.filter((s) => s.modelName !== name));
    if (selectedModel === name) setSelectedModel(remaining[0]?.name ?? '');
    setConfirmDelete(null);
  };

  if (!ready) return null;

  return (
    <div className="p-4 sm:p-6 min-h-full">

      {/* ── Top bar ── */}
      <div className="flex flex-wrap items-center justify-between gap-3 mb-5 sm:mb-6">
        <div className="flex flex-wrap items-center gap-x-2.5 gap-y-1 min-w-0">
          <span className="font-bold text-[#f0f0f0]">{config.title}</span>
          <span className="text-[#333]">·</span>
          <span className="text-sm text-[#555]">max 2 SFS / jour</span>
          <span className="text-[#333]">·</span>
          <span className="text-sm text-[#555]">{models.length} model{models.length > 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => { if (!modal.open) setModal({ open: true, mode: 'add', date: todayStr, model: selectedModel }); }}
          className="flex items-center gap-2 px-4 py-2.5 text-black rounded-xl text-sm font-semibold transition-all hover:bg-[#E2C06A] active:scale-[0.98]"
          style={{ backgroundColor: GOLD, boxShadow: `0 4px 20px ${GOLD}50` }}
        >
          <Plus size={15} />
          Ajouter un SFS
        </button>
      </div>

      {/* ── Model tabs ── */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex gap-1 bg-[#0d0d0d] rounded-2xl p-1.5 border border-white/[0.08] overflow-x-auto flex-1">
          {models.map((m) => {
            const isActive  = selectedModel === m.name;
            const upcoming  = slots.filter((s) => s.modelName === m.name && s.date >= todayStr).length;
            return (
              <div key={m.name} className="flex items-center flex-shrink-0 group/tab">
                <button
                  onClick={() => setSelectedModel(m.name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isActive ? 'text-black shadow-lg' : 'text-[#999] hover:text-[#f0f0f0] hover:bg-white/[0.05]'
                  } ${isAdmin ? 'pr-2' : ''}`}
                  style={isActive ? { backgroundColor: m.color, boxShadow: `0 2px 14px ${m.color}55` } : {}}
                >
                  {/* Dot keeps per-model color always */}
                  <span className="w-2 h-2 rounded-full flex-shrink-0"
                    style={{
                      backgroundColor: isActive ? 'rgba(0,0,0,0.35)' : m.color,
                      boxShadow: isActive ? 'none' : `0 0 6px ${m.color}90`,
                    }} />
                  {m.name}
                  {upcoming > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                      style={isActive
                        ? { backgroundColor: 'rgba(0,0,0,0.22)', color: 'rgba(0,0,0,0.75)' }
                        : { backgroundColor: 'rgba(255,255,255,0.07)', color: '#888' }}>
                      {upcoming}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.name); }}
                    className={`ml-0.5 p-1 rounded-lg transition-all opacity-0 group-hover/tab:opacity-100 flex-shrink-0 ${
                      isActive ? 'hover:bg-black/20 text-black/50 hover:text-black/80' : 'hover:bg-red-500/10 text-[#444] hover:text-red-400'
                    }`}
                  >
                    <X size={12} />
                  </button>
                )}
              </div>
            );
          })}
        </div>

        <div ref={addModelBtnRef} className="relative flex-shrink-0">
          <button
            onClick={() => setShowAddModel((v) => !v)}
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-medium transition-all ${
              showAddModel
                ? 'text-black border-transparent'
                : 'bg-[#0d0d0d] text-[#999] border-white/[0.08] hover:border-[#C9A84C]/40 hover:text-[#f0f0f0]'
            }`}
            style={showAddModel ? { backgroundColor: GOLD, borderColor: GOLD, boxShadow: `0 4px 16px ${GOLD}50` } : {}}
          >
            <Plus size={15} />
            <span className="hidden sm:inline">Ajouter une model</span>
          </button>
          {showAddModel && (
            <AddModelForm onAdd={addModel} onClose={() => setShowAddModel(false)} existingNames={models.map((m) => m.name)} />
          )}
        </div>
      </div>

      {/* ── View tabs ── */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 mb-5">
        <div className="flex gap-1 bg-[#0d0d0d] border border-white/[0.08] rounded-xl p-1">
          {(['upcoming', 'history'] as const).map((v) => {
            const isActive = view === v;
            const count = v === 'upcoming' ? upcomingSlots.length : historySlots.length;
            return (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${
                  isActive ? 'bg-white/[0.07] text-[#f0f0f0] shadow-sm' : 'text-[#555] hover:text-[#999]'
                }`}>
                {v === 'upcoming' ? <CalendarDays size={15} /> : <History size={15} />}
                {v === 'upcoming' ? 'À venir' : 'Historique'}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                    style={isActive && v === 'upcoming'
                      ? { backgroundColor: GOLD, color: '#000' }
                      : { backgroundColor: 'rgba(255,255,255,0.06)', color: '#666' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {view === 'upcoming' && (
          <div className="flex flex-wrap items-center gap-1.5 text-xs">
            {(Object.keys(DARK_STATUS) as SlotStatus[]).map((s) => {
              const cfg  = DARK_STATUS[s];
              const scfg = STATUS_CONFIG[s];
              const count = upcomingSlots.filter((sl) => sl.status === s).length;
              if (count === 0) return null;
              return (
                <span key={s} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.text}`}
                  style={{ boxShadow: cfg.glow }}>
                  {scfg.emoji} {count} {scfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Calendar ── */}
      {view === 'upcoming' && (
        <div className="relative">
          <div className="overflow-x-auto">
            <div className="min-w-[580px]">
              <div className="bg-[#0d0d0d] rounded-2xl border border-white/[0.08] overflow-hidden">
                {/* Month nav */}
                <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.08]">
                  <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))}
                    className="p-2 rounded-xl hover:bg-white/[0.05] hover:border-[#C9A84C]/30 border border-transparent transition text-[#555] hover:text-[#f0f0f0]">
                    <ChevronLeft size={17} />
                  </button>
                  <div className="flex items-center gap-3">
                    <h2 className="font-semibold text-[#f0f0f0]">{MONTHS_FR[month]} {year}</h2>
                    {(year !== today.getFullYear() || month !== today.getMonth()) && (
                      <button
                        onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                        className="text-xs font-semibold px-2.5 py-1 rounded-lg transition hover:brightness-110"
                        style={{ color: '#000', backgroundColor: GOLD }}>
                        Aujourd'hui
                      </button>
                    )}
                  </div>
                  <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))}
                    className="p-2 rounded-xl hover:bg-white/[0.05] border border-transparent hover:border-[#C9A84C]/30 transition text-[#555] hover:text-[#f0f0f0]">
                    <ChevronRight size={17} />
                  </button>
                </div>

                {/* Day headers */}
                <div className="grid grid-cols-7 border-b border-white/[0.05]">
                  {DAYS_FR.map((d) => (
                    <div key={d} className="py-3 text-center text-[10px] font-semibold text-[#555] uppercase tracking-widest">{d}</div>
                  ))}
                </div>

                {/* Grid */}
                <div className="grid grid-cols-7 gap-1 p-2">
                  {cells.map((cell, idx) => {
                    const ds = dateStr(cell.date);
                    const daySlots = modelSlots.filter((s) => s.date === ds);
                    return (
                      <DayCell key={idx} day={cell.day} dateString={ds}
                        isToday={ds === todayStr} isPast={ds < todayStr}
                        isCurrentMonth={cell.isCurrentMonth} slots={daySlots}
                        onAdd={(date) => setModal({ open: true, mode: 'add', date, model: selectedModel })}
                        onEdit={(slot) => setModal({ open: true, mode: 'edit', slot })}
                      />
                    );
                  })}
                </div>

                {/* Footer legend */}
                <div className="hidden sm:flex items-center gap-5 px-6 py-3 border-t border-white/[0.05] text-xs text-[#555]">
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded border" style={{ borderColor: GOLD, boxShadow: `0 0 5px ${GOLD}50` }} />
                    Aujourd'hui
                  </span>
                  <span className="flex items-center gap-1.5">
                    <span className="w-3 h-3 rounded bg-white/[0.02] border border-white/[0.08]" />
                    Jours passés
                  </span>
                  <span className="ml-auto">Cliquez sur un slot pour le modifier</span>
                </div>
              </div>
            </div>
          </div>
          {/* Right-edge fade — scroll affordance on mobile */}
          <div className="pointer-events-none absolute top-0 right-0 h-full w-10 bg-gradient-to-l from-[#0a0a0a] to-transparent sm:hidden rounded-r-2xl" />
        </div>
      )}

      {/* ── History ── */}
      {view === 'history' && (
        <div>
          <div className="flex items-center gap-2 mb-5 px-1">
            <History size={14} className="text-[#555]" />
            <span className="text-sm text-[#999]">
              {historySlots.length} SFS passé{historySlots.length > 1 ? 's' : ''} pour <strong className="text-[#f0f0f0]">{selectedModel}</strong>
            </span>
          </div>
          <HistoryList slots={historySlots} onEdit={(slot) => setModal({ open: true, mode: 'edit', slot })} />
        </div>
      )}

      {/* ── Confirm delete model ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/70 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-[#111] border border-white/[0.08] rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6">
            <div className="w-11 h-11 rounded-xl bg-red-500/[0.12] border border-red-500/25 flex items-center justify-center mb-4">
              <X size={20} className="text-red-400" />
            </div>
            <h3 className="font-semibold text-[#f0f0f0] mb-1">Supprimer {confirmDelete} ?</h3>
            <p className="text-sm text-[#999] mb-6">
              Cette action supprimera <strong className="text-[#f0f0f0]">{confirmDelete}</strong> et tous ses SFS planifiés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)}
                className="flex-1 py-2.5 text-sm font-medium text-[#999] border border-white/[0.08] rounded-xl hover:bg-white/[0.04] hover:border-[#C9A84C]/30 transition">
                Annuler
              </button>
              <button onClick={() => deleteModel(confirmDelete)}
                className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500/80 border border-red-500/25 rounded-xl hover:bg-red-500 transition">
                Supprimer
              </button>
            </div>
          </div>
        </div>
      )}

      {/* ── Slot modal ── */}
      {modal.open && (
        <SlotModal
          mode={modal.mode}
          defaultDate={modal.mode === 'add' ? modal.date : undefined}
          defaultModel={modal.mode === 'add' ? modal.model : undefined}
          todayStr={todayStr}
          slot={modal.mode === 'edit' ? modal.slot : undefined}
          onSave={modal.mode === 'add' ? addSlot : editSlot}
          onDelete={deleteSlot}
          onClose={() => setModal({ open: false })}
          slotsOnDate={(date) =>
            slots.filter(
              (s) =>
                s.date === date &&
                s.modelName === (modal.mode === 'add' ? modal.model : modal.slot.modelName) &&
                (modal.mode === 'edit' ? s.id !== modal.slot.id : true),
            ).length
          }
        />
      )}
    </div>
  );
}

export { GOLD_HOVER };
