'use client';

import { useState, useEffect, useMemo } from 'react';
import { ChevronLeft, ChevronRight, X, Plus, Trash2, AlertTriangle } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ChattingPlatform, ShiftKey, SHIFTS, SHIFT_MAP,
  ChatterProfile, WeekPlan,
  loadPlan, savePlan, loadChatters, loadPlanModels, savePlanModels,
  CHAT_MODELS, getWeekDates, addWeeks, fmtWeekRange, fmtDayCol, todayStr, uid,
} from '@/lib/chatting';

interface OpenSlot { date: string; model: string; shift: ShiftKey }
interface DropPos  { x: number; y: number }

// ─── Add model modal ──────────────────────────────────────────────────────────

function AddModelModal({ onAdd, onClose, existing }: {
  onAdd: (name: string) => void; onClose: () => void; existing: string[];
}) {
  const [name, setName] = useState('');
  const conflict = existing.includes(name.trim());

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#111] border border-[#222] rounded-xl shadow-2xl p-6 w-72 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">Ajouter une model</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white"><X size={16} /></button>
        </div>
        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#888]">Nom de la model</span>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="ex: Ambre"
            autoFocus
            className="bg-[#1a1a1a] border border-[#333] text-white placeholder-[#444] rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]"
            onKeyDown={(e) => { if (e.key === 'Enter' && name.trim() && !conflict) onAdd(name.trim()); }}
          />
          {conflict && <p className="text-xs text-red-400">Cette model existe déjà</p>}
        </label>
        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#333] text-sm text-[#888] hover:bg-[#1a1a1a] transition">Annuler</button>
          <button
            onClick={() => onAdd(name.trim())}
            disabled={!name.trim() || conflict}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-black text-sm font-semibold hover:bg-[#E2C06A] transition disabled:opacity-40"
          >
            Ajouter
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ShiftPlanning({ platform }: { platform: ChattingPlatform }) {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [plan,          setPlan]          = useState<WeekPlan>({});
  const [chatters,      setChatters]      = useState<ChatterProfile[]>([]);
  const [models,        setModels]        = useState<string[]>([]);
  const [anchor,        setAnchor]        = useState<string>(() => getWeekDates()[0]);
  const [openSlot,      setOpenSlot]      = useState<OpenSlot | null>(null);
  const [dropPos,       setDropPos]       = useState<DropPos | null>(null);
  const [addModelOpen,  setAddModelOpen]  = useState(false);
  const [deleteModel,   setDeleteModel]   = useState<string | null>(null); // name to confirm delete

  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const today     = todayStr();

  // Chatters active on this platform
  const activeChatters = useMemo(
    () => chatters.filter((c) => c.platforms.includes(platform) && c.status === 'active'),
    [chatters, platform],
  );

  useEffect(() => {
    Promise.all([loadPlan(platform), loadChatters(), loadPlanModels(platform)]).then(([p, c, m]) => {
      setPlan(p); setChatters(c); setModels(m);
    });
  }, [platform]);

  function persistPlan(p: WeekPlan)    { setPlan(p);   savePlan(platform, p); }
  function persistModels(m: string[])  { setModels(m); savePlanModels(platform, m); }

  function getAssignment(date: string, model: string, shift: ShiftKey): string | null | undefined {
    return plan[date]?.[model]?.[shift];
  }

  function assign(chatterId: string | null) {
    if (!openSlot) return;
    const { date, model, shift } = openSlot;
    persistPlan({
      ...plan,
      [date]: { ...(plan[date] ?? {}), [model]: { ...(plan[date]?.[model] ?? {}), [shift]: chatterId } },
    });
    setOpenSlot(null);
  }

  function removeAssignment(date: string, model: string, shift: ShiftKey) {
    persistPlan({
      ...plan,
      [date]: { ...(plan[date] ?? {}), [model]: { ...(plan[date]?.[model] ?? {}), [shift]: null } },
    });
  }

  function openDropdown(e: React.MouseEvent, slot: OpenSlot) {
    if (!canEdit) return;
    e.stopPropagation();
    const rect = (e.currentTarget as HTMLElement).getBoundingClientRect();
    setDropPos({ x: Math.min(rect.left, window.innerWidth - 200), y: rect.bottom + 4 });
    setOpenSlot(slot);
  }

  function handleAddModel(name: string) {
    persistModels([...models, name]);
    setAddModelOpen(false);
  }

  function handleDeleteModel(name: string) {
    persistModels(models.filter((m) => m !== name));
    setDeleteModel(null);
  }

  useEffect(() => {
    if (!openSlot) return;
    const close = () => setOpenSlot(null);
    const timer = setTimeout(() => document.addEventListener('click', close), 50);
    return () => { clearTimeout(timer); document.removeEventListener('click', close); };
  }, [openSlot]);

  const accentColor = platform === 'of' ? '#a855f7' : '#ec4899';
  const label       = platform === 'of' ? 'OnlyFans' : 'MYM';

  function findChatter(id: string | null | undefined): ChatterProfile | undefined {
    if (!id) return undefined;
    return chatters.find((c) => c.id === id);
  }

  return (
    <div className="flex flex-col h-full">
      {/* Header */}
      <div className="flex items-center gap-4 px-6 py-4 border-b border-[#222] bg-[#111] flex-shrink-0 flex-wrap gap-y-2">
        <span className="w-2.5 h-2.5 rounded-full" style={{ backgroundColor: accentColor }} />
        <h2 className="font-bold text-white">Planning {label}</h2>
        <span className="text-xs text-[#555] border border-[#333] bg-[#1a1a1a] px-2 py-0.5 rounded-full">{models.length} models</span>

        {canEdit && (
          <button
            onClick={() => setAddModelOpen(true)}
            className="flex items-center gap-1.5 text-xs font-medium text-[#555] hover:text-[#C9A84C] border border-[#333] hover:border-[#C9A84C]/30 rounded-lg px-3 py-1.5 transition"
          >
            <Plus size={12} /> Ajouter une model
          </button>
        )}

        {/* Week nav */}
        <div className="ml-auto flex items-center gap-2">
          <button onClick={() => setAnchor((a) => addWeeks(a, -1))} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#555] transition">
            <ChevronLeft size={16} />
          </button>
          <span className="text-sm font-medium text-[#888] min-w-[200px] text-center">{fmtWeekRange(weekDates)}</span>
          <button onClick={() => setAnchor((a) => addWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#555] transition">
            <ChevronRight size={16} />
          </button>
          <button
            onClick={() => setAnchor(getWeekDates()[0])}
            className="text-xs font-medium px-3 py-1.5 rounded-lg border border-[#333] hover:bg-[#1a1a1a] text-[#555] transition ml-1"
          >
            Aujourd'hui
          </button>
        </div>
      </div>

      {/* Legend */}
      <div className="flex items-center gap-3 px-6 py-2 border-b border-[#1a1a1a] bg-[#0f0f0f] flex-shrink-0 flex-wrap">
        {SHIFTS.map((s) => (
          <div key={s.key} className="flex items-center gap-1.5">
            <span className="w-2.5 h-2.5 rounded-sm" style={{ backgroundColor: s.bg, border: `1.5px solid ${s.border}` }} />
            <span className="text-[11px] text-[#555] font-medium">{s.short} = {s.label} {s.hours}</span>
          </div>
        ))}
        {canEdit && <span className="ml-auto text-[11px] text-[#555]">Cliquer un slot pour assigner</span>}
      </div>

      {/* Table */}
      <div className="flex-1 overflow-auto">
        <table className="w-full border-collapse" style={{ minWidth: 760 }}>
          <thead className="sticky top-0 z-10 bg-[#111]">
            <tr>
              <th className="text-left px-4 py-3 text-xs font-semibold text-[#555] border-b border-[#222] bg-[#111]" style={{ width: 148 }}>Model</th>
              {weekDates.map((d) => {
                const isToday = d === today;
                return (
                  <th key={d}
                      className={`px-2 py-3 text-xs font-semibold border-b border-[#222] text-center ${isToday ? 'text-[#C9A84C]' : 'text-[#555]'}`}
                      style={{ backgroundColor: isToday ? accentColor + '15' : '#111' }}>
                    {fmtDayCol(d)}
                    {isToday && <span className="block text-[9px] font-normal" style={{ color: accentColor }}>auj.</span>}
                  </th>
                );
              })}
              {canEdit && <th className="w-8 border-b border-[#222] bg-[#111]" />}
            </tr>
          </thead>
          <tbody>
            {models.map((model, mi) => (
              <tr key={model} className={mi % 2 === 0 ? 'bg-[#111]' : 'bg-[#0f0f0f]'}>
                {/* Model name */}
                <td className="px-4 py-2 border-b border-[#1a1a1a] align-top">
                  {deleteModel === model ? (
                    <div className="flex flex-col gap-1 py-0.5">
                      <p className="text-[10px] text-red-400 font-semibold flex items-center gap-1"><AlertTriangle size={10} />Supprimer {model} ?</p>
                      <div className="flex gap-1">
                        <button onClick={() => handleDeleteModel(model)} className="text-[10px] px-2 py-0.5 bg-red-500 text-white rounded font-medium hover:bg-red-600 transition">Oui</button>
                        <button onClick={() => setDeleteModel(null)}     className="text-[10px] px-2 py-0.5 border border-[#333] text-[#555] rounded hover:bg-[#1a1a1a] transition">Non</button>
                      </div>
                    </div>
                  ) : (
                    <div className="flex items-center gap-2 pt-0.5 group/row">
                      <div className="w-5 h-5 rounded-full flex-shrink-0 flex items-center justify-center text-[10px] font-bold"
                           style={{ backgroundColor: accentColor + '20', color: accentColor }}>
                        {model.charAt(0).toUpperCase()}
                      </div>
                      <span className="text-xs font-medium text-[#888] truncate max-w-[70px]">{model}</span>
                      {canEdit && (
                        <button
                          onClick={() => setDeleteModel(model)}
                          className="opacity-0 group-hover/row:opacity-100 p-0.5 rounded hover:text-red-400 text-[#333] transition ml-auto flex-shrink-0"
                        >
                          <Trash2 size={11} />
                        </button>
                      )}
                    </div>
                  )}
                </td>

                {/* Day cells */}
                {weekDates.map((date) => {
                  const isToday = date === today;
                  return (
                    <td key={date} className="px-1.5 py-1.5 border-b border-[#1a1a1a] align-top"
                        style={{ backgroundColor: isToday ? accentColor + '06' : undefined }}>
                      <div className="flex flex-col gap-0.5">
                        {SHIFTS.map((sh) => {
                          const assignedId = getAssignment(date, model, sh.key);
                          const chatter    = findChatter(assignedId ?? undefined);
                          return (
                            <div
                              key={sh.key}
                              onClick={(e) => openDropdown(e, { date, model, shift: sh.key })}
                              className={`flex items-center gap-1 rounded px-1 py-0.5 text-[11px] border-l-2 transition-all select-none
                                ${canEdit ? 'cursor-pointer hover:opacity-75' : ''}
                                ${assignedId ? '' : 'opacity-40 hover:opacity-60'}`}
                              style={{
                                borderLeftColor: sh.border,
                                backgroundColor: assignedId ? sh.bg : 'transparent',
                              }}
                            >
                              <span className="font-bold leading-none flex-shrink-0 w-4 text-center" style={{ color: sh.color }}>{sh.short}</span>
                              {chatter ? (
                                <>
                                  <span className="flex-1 truncate text-[#ccc] leading-none" style={{ maxWidth: 50 }}>{chatter.name}</span>
                                  {canEdit && (
                                    <button
                                      onClick={(e) => { e.stopPropagation(); removeAssignment(date, model, sh.key); }}
                                      className="text-[#444] hover:text-red-400 transition flex-shrink-0"
                                    >
                                      <X size={10} />
                                    </button>
                                  )}
                                </>
                              ) : (
                                <span className="text-[#444] flex-1 leading-none">{canEdit ? '+' : '—'}</span>
                              )}
                            </div>
                          );
                        })}
                      </div>
                    </td>
                  );
                })}

                {canEdit && <td className="w-8 border-b border-[#1a1a1a]" />}
              </tr>
            ))}

            {models.length === 0 && (
              <tr>
                <td colSpan={9} className="text-center py-12 text-[#555] text-sm">
                  Aucune model — cliquez sur &quot;Ajouter une model&quot;
                </td>
              </tr>
            )}
          </tbody>
        </table>
      </div>

      {/* Add model modal */}
      {addModelOpen && (
        <AddModelModal
          existing={models}
          onAdd={handleAddModel}
          onClose={() => setAddModelOpen(false)}
        />
      )}

      {/* Assignment dropdown (fixed) */}
      {openSlot && dropPos && (
        <div
          className="fixed z-50 bg-[#111] rounded-xl shadow-2xl border border-[#222] py-1 w-52 max-h-72 overflow-y-auto"
          style={{ left: dropPos.x, top: dropPos.y }}
          onClick={(e) => e.stopPropagation()}
        >
          {/* Slot info */}
          <div className="px-3 py-2 border-b border-[#222] mb-1">
            <p className="text-[10px] font-semibold text-[#555] uppercase tracking-wide truncate">{openSlot.model}</p>
            <p className="text-xs text-[#888] mt-0.5">
              <span className="font-semibold" style={{ color: SHIFT_MAP[openSlot.shift].color }}>
                {SHIFT_MAP[openSlot.shift].label}
              </span>
              {' '}{SHIFT_MAP[openSlot.shift].hours}
            </p>
          </div>

          {/* Retirer */}
          {getAssignment(openSlot.date, openSlot.model, openSlot.shift) && (
            <button
              onClick={() => assign(null)}
              className="w-full text-left px-3 py-2 text-xs text-red-400 hover:bg-red-500/10 transition font-medium border-b border-[#1a1a1a]"
            >
              Retirer l'assignation
            </button>
          )}

          {/* Chatters list */}
          {activeChatters.length === 0 ? (
            <p className="px-3 py-3 text-xs text-[#555] text-center">Aucun chatter actif sur {label}</p>
          ) : (
            activeChatters.map((c) => {
              const isCurrent = getAssignment(openSlot.date, openSlot.model, openSlot.shift) === c.id;
              return (
                <button
                  key={c.id}
                  onClick={() => assign(c.id)}
                  className={`w-full text-left px-3 py-2 text-xs transition flex items-center gap-2
                    ${isCurrent ? 'font-semibold' : 'text-[#888] hover:bg-[#1a1a1a]'}`}
                  style={isCurrent ? { backgroundColor: accentColor + '10', color: accentColor } : undefined}
                >
                  <div className="w-6 h-6 rounded-full flex items-center justify-center text-white text-[10px] font-bold flex-shrink-0"
                       style={{ backgroundColor: accentColor }}>
                    {c.name.charAt(0).toUpperCase()}
                  </div>
                  <span className="flex-1 truncate">{c.name}</span>
                  {isCurrent && <span style={{ color: accentColor }}>✓</span>}
                </button>
              );
            })
          )}
        </div>
      )}
    </div>
  );
}
