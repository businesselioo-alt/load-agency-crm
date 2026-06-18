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

// ─── Helpers ──────────────────────────────────────────────────────────────────

const DAYS_FR = ['Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam', 'Dim'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

function dateStr(date: Date) {
  return `${date.getFullYear()}-${String(date.getMonth() + 1).padStart(2, '0')}-${String(date.getDate()).padStart(2, '0')}`;
}
function todayDate() { const d = new Date(); d.setHours(0, 0, 0, 0); return d; }
function getModelColor(name: string, models: CustomModel[]) {
  return models.find((m) => m.name === name)?.color ?? '#a855f7';
}

// ─── Slot card ────────────────────────────────────────────────────────────────

function SlotCard({ slot, isPast, onEdit }: { slot: SFSPlanningSlot; isPast: boolean; onEdit: (s: SFSPlanningSlot) => void }) {
  const cfg = STATUS_CONFIG[slot.status];
  return (
    <div
      onClick={() => !isPast && onEdit(slot)}
      className={`px-2 py-1.5 rounded-lg border text-xs transition-all ${cfg.bg} ${cfg.border} ${cfg.text} ${!isPast ? 'cursor-pointer hover:shadow-sm hover:scale-[1.01]' : 'opacity-70'}`}
    >
      <div className="flex items-center gap-1 font-semibold truncate">
        <span className="text-[11px]">{cfg.emoji}</span>
        <span className="truncate">{slot.partnerAgency}</span>
        {slot.time && <span className="ml-auto pl-1 text-[10px] font-normal opacity-60 flex-shrink-0">{slot.time}</span>}
      </div>
      <div className="text-[11px] opacity-75 truncate pl-4">↳ {slot.partnerModel}</div>
    </div>
  );
}

// ─── Day cell ─────────────────────────────────────────────────────────────────

function DayCell({ day, dateString, isToday, isPast, isCurrentMonth, slots, activeColor, onAdd, onEdit }: {
  day: number; dateString: string; isToday: boolean; isPast: boolean;
  isCurrentMonth: boolean; slots: SFSPlanningSlot[]; activeColor: string;
  onAdd: (date: string) => void; onEdit: (slot: SFSPlanningSlot) => void;
}) {
  const canAdd = !isPast && isCurrentMonth && slots.length < 2;
  return (
    <div className={`min-h-28 p-1.5 rounded-xl border flex flex-col gap-1 transition-all ${
      isToday ? 'ring-2 ring-offset-0' : ''
    } ${isPast || !isCurrentMonth ? 'border-gray-100 bg-gray-50/50' : 'border-gray-100 bg-white hover:border-gray-200'} ${!isCurrentMonth ? 'opacity-40' : ''}`}
      style={isToday ? { borderColor: activeColor, boxShadow: `0 0 0 2px ${activeColor}33` } : {}}
    >
      <div className="flex items-start justify-between">
        <span
          className="w-6 h-6 flex items-center justify-center rounded-full text-xs font-semibold"
          style={isToday ? { backgroundColor: activeColor, color: '#fff' } : { color: isPast ? '#9ca3af' : '#374151' }}
        >
          {day}
        </span>
        {slots.length === 2 && !isPast && <span className="text-[10px] text-gray-400 mt-0.5">max</span>}
      </div>
      <div className="flex flex-col gap-1 flex-1">
        {slots.map((slot) => <SlotCard key={slot.id} slot={slot} isPast={isPast} onEdit={onEdit} />)}
      </div>
      {canAdd && (
        <button
          onClick={() => onAdd(dateString)}
          className="flex items-center justify-center gap-0.5 w-full py-1 text-[11px] text-gray-400 hover:text-[#a855f7] hover:bg-[#a855f7]/5 rounded-lg transition-all"
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
    <div className="flex flex-col items-center justify-center py-20 text-center">
      <History size={40} className="text-gray-200 mb-3" />
      <p className="text-gray-400 text-sm">Aucun SFS dans l'historique</p>
    </div>
  );

  return (
    <div className="space-y-6">
      {[...grouped.entries()].map(([monthKey, monthSlots]) => {
        const [year, month] = monthKey.split('-').map(Number);
        return (
          <div key={monthKey}>
            <div className="flex items-center gap-3 mb-3">
              <h3 className="font-semibold text-gray-900 text-sm">{MONTHS_FR[month - 1]} {year}</h3>
              <div className="flex-1 h-px bg-gray-100" />
              <span className="text-xs text-gray-400">{monthSlots.length} SFS</span>
            </div>
            <div className="space-y-2">
              {monthSlots.map((slot) => {
                const cfg = STATUS_CONFIG[slot.status];
                const d = new Date(slot.date + 'T12:00:00');
                return (
                  <div key={slot.id} className="flex items-center gap-4 bg-white rounded-xl border border-gray-100 px-4 py-3 hover:border-gray-200 transition">
                    <div className="text-center w-10 flex-shrink-0">
                      <p className="text-xs text-gray-400 uppercase">{MONTHS_FR[d.getMonth()].substring(0, 3)}</p>
                      <p className="text-lg font-bold text-gray-800 leading-tight">{d.getDate()}</p>
                      {slot.time && <p className="text-[10px] text-gray-400">{slot.time}</p>}
                    </div>
                    <div className="w-px h-8 bg-gray-100 flex-shrink-0" />
                    <span className={`flex-shrink-0 px-2.5 py-1 rounded-lg border text-xs font-medium ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                      {cfg.emoji} {cfg.label}
                    </span>
                    <div className="flex-1 min-w-0">
                      <p className="text-sm font-semibold text-gray-900">{slot.partnerAgency}</p>
                      <p className="text-xs text-gray-500">↳ {slot.partnerModel}</p>
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
    <div className="absolute top-full left-0 mt-2 z-30 w-72 bg-white rounded-2xl shadow-xl border border-gray-100 p-4">
      <div className="absolute -top-2 left-5 w-3 h-3 bg-white border-l border-t border-gray-100 rotate-45" />
      <div className="flex items-center justify-between mb-3">
        <p className="text-sm font-semibold text-gray-900">Nouvelle model</p>
        <button onClick={onClose} className="p-1 text-gray-400 hover:text-gray-600 rounded-lg transition"><X size={15} /></button>
      </div>
      <form onSubmit={handleSubmit} className="space-y-3">
        {error && <p className="text-xs text-red-500 bg-red-50 px-2.5 py-1.5 rounded-lg border border-red-100">{error}</p>}
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-1">Prénom *</label>
          <input ref={inputRef} type="text" placeholder="ex : Sophie" value={name}
            onChange={(e) => { setName(e.target.value); setError(''); }}
            className="w-full px-3 py-2 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition" />
        </div>
        <div>
          <label className="block text-xs font-medium text-gray-500 mb-2">Couleur</label>
          <div className="flex flex-wrap gap-2">
            {COLOR_PALETTE.map((hex) => (
              <button key={hex} type="button" onClick={() => setColor(hex)}
                className="w-7 h-7 rounded-full transition-transform hover:scale-110 flex items-center justify-center flex-shrink-0"
                style={{ backgroundColor: hex }}>
                {color === hex && <Check size={12} className="text-white" strokeWidth={3} />}
              </button>
            ))}
          </div>
          <div className="mt-3 flex items-center gap-2 px-3 py-2 bg-gray-50 rounded-xl">
            <span className="w-2.5 h-2.5 rounded-full flex-shrink-0" style={{ backgroundColor: color }} />
            <span className="text-sm font-medium text-gray-700">{name || 'Prénom'}</span>
          </div>
        </div>
        <div className="flex gap-2 pt-1">
          <button type="button" onClick={onClose} className="flex-1 py-2 text-sm text-gray-500 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Annuler</button>
          <button type="submit" className="flex-1 py-2 text-sm font-semibold text-white rounded-xl transition" style={{ backgroundColor: color }}>Ajouter</button>
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

  // Reset state when config changes (switching between OF and MYM)
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

  const today = todayDate();
  const todayStr = dateStr(today);
  const activeColor = getModelColor(selectedModel, models);

  const modelSlots = useMemo(() => slots.filter((s) => s.modelName === selectedModel), [slots, selectedModel]);
  const upcomingSlots = useMemo(() => modelSlots.filter((s) => s.date >= todayStr), [modelSlots, todayStr]);
  const historySlots = useMemo(() => modelSlots.filter((s) => s.date < todayStr), [modelSlots, todayStr]);
  const slotsOnDate = useCallback((date: string) => modelSlots.filter((s) => s.date === date).length, [modelSlots]);

  // Calendar grid
  const year = currentMonth.getFullYear();
  const month = currentMonth.getMonth();
  const startOffset = (new Date(year, month, 1).getDay() + 6) % 7;
  const daysInMonth = new Date(year, month + 1, 0).getDate();
  const prevMonthDays = new Date(year, month, 0).getDate();

  const cells: { day: number; date: Date; isCurrentMonth: boolean }[] = [];
  for (let i = startOffset - 1; i >= 0; i--) cells.push({ day: prevMonthDays - i, date: new Date(year, month - 1, prevMonthDays - i), isCurrentMonth: false });
  for (let d = 1; d <= daysInMonth; d++) cells.push({ day: d, date: new Date(year, month, d), isCurrentMonth: true });
  while (cells.length % 7 !== 0) { const d = cells.length - startOffset - daysInMonth + 1; cells.push({ day: d, date: new Date(year, month + 1, d), isCurrentMonth: false }); }

  // CRUD
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
    <div className="p-6 min-h-full">
      {/* ── Top bar ── */}
      <div className="flex items-center justify-between mb-5">
        <div className="flex items-center gap-2 text-sm text-gray-500">
          <span className="font-semibold text-gray-900">{config.title}</span>
          <span className="text-gray-300">·</span>
          <span>max 2 SFS / jour</span>
          <span className="text-gray-300">·</span>
          <span>{models.length} model{models.length > 1 ? 's' : ''}</span>
        </div>
        <button
          onClick={() => { if (!modal.open) setModal({ open: true, mode: 'add', date: todayStr, model: selectedModel }); }}
          className="flex items-center gap-2 px-4 py-2.5 text-white rounded-xl text-sm font-semibold transition shadow-sm"
          style={{ backgroundColor: activeColor }}
        >
          <Plus size={15} />
          Ajouter un SFS
        </button>
      </div>

      {/* ── Model tabs ── */}
      <div className="flex items-center gap-2 mb-5">
        <div className="flex gap-1 bg-white rounded-2xl p-1.5 shadow-sm border border-gray-100 overflow-x-auto flex-1">
          {models.map((m) => {
            const isActive = selectedModel === m.name;
            const upcoming = slots.filter((s) => s.modelName === m.name && s.date >= todayStr).length;
            return (
              <div key={m.name} className="flex items-center flex-shrink-0 group/tab">
                <button
                  onClick={() => setSelectedModel(m.name)}
                  className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium whitespace-nowrap transition-all ${
                    isActive ? 'text-white shadow-sm' : 'text-gray-500 hover:text-gray-800 hover:bg-gray-50'
                  } ${isAdmin ? 'pr-2' : ''}`}
                  style={isActive ? { backgroundColor: m.color } : {}}
                >
                  <span className="w-2 h-2 rounded-full flex-shrink-0" style={{ backgroundColor: isActive ? 'rgba(255,255,255,0.6)' : m.color }} />
                  {m.name}
                  {upcoming > 0 && (
                    <span className="text-xs px-1.5 py-0.5 rounded-md font-semibold"
                      style={isActive ? { backgroundColor: 'rgba(255,255,255,0.2)', color: '#fff' } : { backgroundColor: '#f3f4f6', color: '#6b7280' }}>
                      {upcoming}
                    </span>
                  )}
                </button>
                {isAdmin && (
                  <button
                    onClick={(e) => { e.stopPropagation(); setConfirmDelete(m.name); }}
                    className={`ml-0.5 p-1 rounded-lg transition-all opacity-0 group-hover/tab:opacity-100 flex-shrink-0 ${
                      isActive ? 'hover:bg-white/20 text-white/70 hover:text-white' : 'hover:bg-red-50 text-gray-300 hover:text-red-400'
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
            className={`flex items-center gap-2 px-4 py-3 rounded-2xl border text-sm font-medium transition-all shadow-sm ${
              showAddModel ? 'text-white border-transparent' : 'bg-white text-gray-600 border-gray-200 hover:border-gray-300'
            }`}
            style={showAddModel ? { backgroundColor: activeColor, borderColor: activeColor } : {}}
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
      <div className="flex items-center justify-between mb-5">
        <div className="flex gap-1 bg-gray-100 rounded-xl p-1">
          {(['upcoming', 'history'] as const).map((v) => {
            const isActive = view === v;
            const count = v === 'upcoming' ? upcomingSlots.length : historySlots.length;
            return (
              <button key={v} onClick={() => setView(v)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg text-sm font-medium transition-all ${isActive ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}>
                {v === 'upcoming' ? <CalendarDays size={15} /> : <History size={15} />}
                {v === 'upcoming' ? 'À venir' : 'Historique'}
                {count > 0 && (
                  <span className="text-xs px-1.5 py-0.5 rounded-md"
                    style={isActive && v === 'upcoming' ? { backgroundColor: activeColor, color: '#fff' } : { backgroundColor: '#e5e7eb', color: '#6b7280' }}>
                    {count}
                  </span>
                )}
              </button>
            );
          })}
        </div>
        {view === 'upcoming' && (
          <div className="flex items-center gap-3 text-xs">
            {(Object.keys(STATUS_CONFIG) as SlotStatus[]).map((s) => {
              const cfg = STATUS_CONFIG[s];
              const count = upcomingSlots.filter((sl) => sl.status === s).length;
              if (count === 0) return null;
              return (
                <span key={s} className={`flex items-center gap-1.5 px-2.5 py-1.5 rounded-lg border ${cfg.bg} ${cfg.border} ${cfg.text}`}>
                  {cfg.emoji} {count} {cfg.label}
                </span>
              );
            })}
          </div>
        )}
      </div>

      {/* ── Calendar ── */}
      {view === 'upcoming' && (
        <div className="bg-white rounded-2xl border border-gray-100 shadow-sm overflow-hidden">
          <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
            <button onClick={() => setCurrentMonth(new Date(year, month - 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
              <ChevronLeft size={18} />
            </button>
            <div className="flex items-center gap-3">
              <h2 className="font-semibold text-gray-900">{MONTHS_FR[month]} {year}</h2>
              {(year !== today.getFullYear() || month !== today.getMonth()) && (
                <button onClick={() => setCurrentMonth(new Date(today.getFullYear(), today.getMonth(), 1))}
                  className="text-xs font-medium transition" style={{ color: activeColor }}>
                  Aujourd'hui
                </button>
              )}
            </div>
            <button onClick={() => setCurrentMonth(new Date(year, month + 1, 1))} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
              <ChevronRight size={18} />
            </button>
          </div>
          <div className="grid grid-cols-7 border-b border-gray-50">
            {DAYS_FR.map((d) => (
              <div key={d} className="py-2.5 text-center text-xs font-semibold text-gray-400 uppercase tracking-wide">{d}</div>
            ))}
          </div>
          <div className="grid grid-cols-7 gap-1 p-2">
            {cells.map((cell, idx) => {
              const ds = dateStr(cell.date);
              const daySlots = modelSlots.filter((s) => s.date === ds);
              return (
                <DayCell key={idx} day={cell.day} dateString={ds}
                  isToday={ds === todayStr} isPast={ds < todayStr}
                  isCurrentMonth={cell.isCurrentMonth} slots={daySlots}
                  activeColor={activeColor}
                  onAdd={(date) => setModal({ open: true, mode: 'add', date, model: selectedModel })}
                  onEdit={(slot) => setModal({ open: true, mode: 'edit', slot })}
                />
              );
            })}
          </div>
          <div className="flex items-center gap-4 px-6 py-3 border-t border-gray-50 text-xs text-gray-400">
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded border-2" style={{ borderColor: activeColor }} />
              Aujourd'hui
            </span>
            <span className="flex items-center gap-1.5">
              <span className="w-3 h-3 rounded bg-gray-100 border border-gray-200" />
              Jours passés
            </span>
            <span className="ml-auto">Cliquez sur un slot pour le modifier</span>
          </div>
        </div>
      )}

      {/* ── History ── */}
      {view === 'history' && (
        <div>
          <div className="flex items-center gap-2 mb-4 px-1">
            <History size={14} className="text-gray-400" />
            <span className="text-sm text-gray-500">
              {historySlots.length} SFS passé{historySlots.length > 1 ? 's' : ''} pour <strong>{selectedModel}</strong>
            </span>
          </div>
          <HistoryList slots={historySlots} onEdit={(slot) => setModal({ open: true, mode: 'edit', slot })} />
        </div>
      )}

      {/* ── Confirm delete model ── */}
      {confirmDelete && (
        <div className="fixed inset-0 z-50 flex items-center justify-center p-4">
          <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={() => setConfirmDelete(null)} />
          <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-sm z-10 p-6">
            <div className="w-11 h-11 rounded-xl bg-red-50 flex items-center justify-center mb-4">
              <X size={20} className="text-red-500" />
            </div>
            <h3 className="font-semibold text-gray-900 mb-1">Supprimer {confirmDelete} ?</h3>
            <p className="text-sm text-gray-500 mb-6">
              Cette action supprimera <strong>{confirmDelete}</strong> et tous ses SFS planifiés.
            </p>
            <div className="flex gap-3">
              <button onClick={() => setConfirmDelete(null)} className="flex-1 py-2.5 text-sm font-medium text-gray-600 border border-gray-200 rounded-xl hover:bg-gray-50 transition">Annuler</button>
              <button onClick={() => deleteModel(confirmDelete)} className="flex-1 py-2.5 text-sm font-semibold text-white bg-red-500 rounded-xl hover:bg-red-600 transition">Supprimer</button>
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
