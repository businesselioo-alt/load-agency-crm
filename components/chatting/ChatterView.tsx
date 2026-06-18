'use client';

import { useState, useEffect, useMemo } from 'react';
import { Check, Clock, X, FileText, ChevronLeft, ChevronRight } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  ShiftKey, ShiftRecap, SHIFT_MAP, SHIFTS,
  ChattingPlatform, WeekPlan,
  loadPlan, loadRecaps, saveRecaps,
  CHAT_MODELS, getWeekDates, addWeeks, fmtWeekRange, fmtDayFull, todayStr, uid,
} from '@/lib/chatting';

interface MyShift {
  date: string;
  model: string;
  shift: ShiftKey;
  platform: ChattingPlatform;
}

// ─── Recap Modal ──────────────────────────────────────────────────────────────

function RecapModal({ myShift, existing, onSave, onClose }: {
  myShift: MyShift;
  existing?: ShiftRecap;
  onSave: (r: ShiftRecap) => void;
  onClose: () => void;
}) {
  const { user } = useAuth();
  const [caNet,    setCaNet]    = useState(String(existing?.caNet    ?? ''));
  const [messages, setMessages] = useState(String(existing?.messages ?? ''));
  const [note,     setNote]     = useState(existing?.note ?? '');

  const sh = SHIFT_MAP[myShift.shift];

  function handleSave() {
    onSave({
      id:           existing?.id ?? uid(),
      date:         myShift.date,
      model:        myShift.model,
      shift:        myShift.shift,
      platform:     myShift.platform,
      chatterId:    user?.id ?? '',
      chatterName:  user?.name ?? '',
      caNet:        parseFloat(caNet.replace(',', '.')) || 0,
      messages:     parseInt(messages) || 0,
      note,
      submittedAt:  new Date().toISOString(),
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#111] border border-[#222] rounded-xl shadow-2xl p-6 w-96 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <div>
            <h3 className="font-bold text-white text-sm">Recap du shift</h3>
            <p className="text-xs text-[#888] mt-0.5">
              <span className="font-medium" style={{ color: sh.color }}>{sh.label} {sh.hours}</span>
              {' · '}{myShift.model}{' · '}{myShift.platform.toUpperCase()}
            </p>
          </div>
          <button onClick={onClose} className="text-[#555] hover:text-white transition"><X size={16} /></button>
        </div>

        <div className="rounded-xl bg-[#1a1a1a] px-3 py-2 text-xs text-[#888]">
          {new Date(myShift.date + 'T12:00:00').toLocaleDateString('fr-FR', { weekday: 'long', day: 'numeric', month: 'long', year: 'numeric' })}
        </div>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#888]">CA net produit (€) *</span>
          <input
            type="number" min="0" step="0.01" value={caNet} onChange={(e) => setCaNet(e.target.value)}
            placeholder="0.00"
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]"
            autoFocus
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#888]">Messages envoyés</span>
          <input
            type="number" min="0" value={messages} onChange={(e) => setMessages(e.target.value)}
            placeholder="0"
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C]"
          />
        </label>

        <label className="flex flex-col gap-1">
          <span className="text-xs font-semibold text-[#888]">Note libre</span>
          <textarea
            value={note} onChange={(e) => setNote(e.target.value)} rows={2}
            placeholder="Commentaire, observations..."
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] resize-none"
          />
        </label>

        <div className="flex gap-2">
          <button onClick={onClose} className="flex-1 py-2.5 rounded-xl border border-[#333] text-sm text-[#888] hover:bg-[#1a1a1a] transition">Annuler</button>
          <button onClick={handleSave} className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-black text-sm font-semibold hover:bg-[#E2C06A] transition">Enregistrer</button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChatterView() {
  const { user } = useAuth();

  const [ofPlan,  setOfPlan]  = useState<WeekPlan>({});
  const [mymPlan, setMymPlan] = useState<WeekPlan>({});
  const [recaps,  setRecaps]  = useState<ShiftRecap[]>([]);
  const [anchor,  setAnchor]  = useState<string>(() => getWeekDates()[0]);
  const [modal,   setModal]   = useState<MyShift | null>(null);
  const [tab,     setTab]     = useState<'shifts' | 'history'>('shifts');

  const weekDates = useMemo(() => getWeekDates(anchor), [anchor]);
  const today = todayStr();

  useEffect(() => {
    Promise.all([loadPlan('of'), loadPlan('mym'), loadRecaps()]).then(([of, mym, r]) => {
      setOfPlan(of); setMymPlan(mym); setRecaps(r);
    });
  }, []);

  // Find this user's assigned shifts for the displayed week
  const myShifts = useMemo<MyShift[]>(() => {
    if (!user) return [];
    const result: MyShift[] = [];
    const plans: [ChattingPlatform, WeekPlan][] = [['of', ofPlan], ['mym', mymPlan]];
    for (const date of weekDates) {
      for (const [platform, plan] of plans) {
        const models = CHAT_MODELS[platform];
        for (const model of models) {
          const dayPlan = plan[date]?.[model];
          if (!dayPlan) continue;
          for (const sh of SHIFTS) {
            if (dayPlan[sh.key] === user.id) {
              result.push({ date, model, shift: sh.key, platform });
            }
          }
        }
      }
    }
    // Sort by date then shift order
    return result.sort((a, b) => {
      if (a.date !== b.date) return a.date.localeCompare(b.date);
      return SHIFTS.findIndex(s => s.key === a.shift) - SHIFTS.findIndex(s => s.key === b.shift);
    });
  }, [user, weekDates, ofPlan, mymPlan]);

  // Group by date
  const shiftsByDate = useMemo(() => {
    const map = new Map<string, MyShift[]>();
    for (const s of myShifts) {
      const arr = map.get(s.date) ?? [];
      arr.push(s);
      map.set(s.date, arr);
    }
    return map;
  }, [myShifts]);

  function hasRecap(ms: MyShift): boolean {
    return recaps.some(
      (r) => r.date === ms.date && r.model === ms.model && r.shift === ms.shift && r.chatterId === user?.id,
    );
  }

  function getRecap(ms: MyShift): ShiftRecap | undefined {
    return recaps.find(
      (r) => r.date === ms.date && r.model === ms.model && r.shift === ms.shift && r.chatterId === user?.id,
    );
  }

  function handleSave(recap: ShiftRecap) {
    const next = recaps.some((r) => r.id === recap.id)
      ? recaps.map((r) => (r.id === recap.id ? recap : r))
      : [...recaps, recap];
    setRecaps(next);
    saveRecaps(next);
    setModal(null);
  }

  const myHistory = useMemo(
    () => recaps.filter((r) => r.chatterId === user?.id).sort((a, b) => b.date.localeCompare(a.date)),
    [recaps, user],
  );

  const totalCaWeek = useMemo(
    () => myShifts.filter((s) => s.date <= today).reduce((sum, s) => sum + (getRecap(s)?.caNet ?? 0), 0),
    [myShifts, recaps], // eslint-disable-line react-hooks/exhaustive-deps
  );

  const fmtCA = (n: number) => n === 0 ? '—' : `€${n.toLocaleString('fr-FR', { minimumFractionDigits: 0, maximumFractionDigits: 2 })}`;

  return (
    <div className="p-6 max-w-2xl mx-auto space-y-5">
      {/* Header */}
      <div>
        <h2 className="text-xl font-bold text-white">Mon Planning</h2>
        <p className="text-sm text-[#888] mt-0.5">Tes shifts et récaps de la semaine</p>
      </div>

      {/* Week nav + summary */}
      <div className="bg-[#111] rounded-2xl border border-[#222] p-4 flex items-center gap-4">
        <button onClick={() => setAnchor((a) => addWeeks(a, -1))} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#555] transition">
          <ChevronLeft size={16} />
        </button>
        <div className="flex-1 text-center">
          <p className="text-sm font-semibold text-white">{fmtWeekRange(weekDates)}</p>
          <p className="text-xs text-[#888] mt-0.5">{myShifts.length} shift{myShifts.length !== 1 ? 's' : ''} · CA semaine : <span className="font-semibold text-[#888]">{fmtCA(totalCaWeek)}</span></p>
        </div>
        <button onClick={() => setAnchor((a) => addWeeks(a, 1))} className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#555] transition">
          <ChevronRight size={16} />
        </button>
      </div>

      {/* Tabs */}
      <div className="flex gap-2">
        {(['shifts', 'history'] as const).map((t) => (
          <button
            key={t}
            onClick={() => setTab(t)}
            className={`px-4 py-2 rounded-xl text-sm font-medium transition ${tab === t ? 'bg-[#C9A84C] text-black' : 'bg-[#111] border border-[#333] text-[#888] hover:bg-[#1a1a1a]'}`}
          >
            {t === 'shifts' ? 'Mes shifts' : 'Historique recaps'}
          </button>
        ))}
      </div>

      {/* Shifts tab */}
      {tab === 'shifts' && (
        <div className="space-y-4">
          {weekDates.map((date) => {
            const dayShifts = shiftsByDate.get(date);
            if (!dayShifts?.length) return null;
            const isPast   = date < today;
            const isToday  = date === today;
            return (
              <div key={date} className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
                <div className={`px-4 py-3 border-b border-[#1a1a1a] flex items-center gap-2 ${isToday ? 'bg-[#C9A84C]/5' : ''}`}>
                  <p className={`text-sm font-semibold ${isToday ? 'text-[#C9A84C]' : 'text-white'}`}>
                    {fmtDayFull(date)}
                  </p>
                  {isToday && <span className="text-[10px] bg-[#C9A84C] text-black px-2 py-0.5 rounded-full font-semibold">Aujourd'hui</span>}
                </div>
                <div className="divide-y divide-[#1a1a1a]">
                  {dayShifts.map((ms) => {
                    const sh         = SHIFT_MAP[ms.shift];
                    const recapDone  = hasRecap(ms);
                    const recap      = getRecap(ms);
                    return (
                      <div key={`${ms.model}-${ms.shift}`} className="flex items-center gap-3 px-4 py-3">
                        {/* Shift badge */}
                        <div className="flex-shrink-0 rounded-lg px-2 py-1 text-xs font-bold border" style={{ color: sh.color, backgroundColor: sh.bg, borderColor: sh.border }}>
                          {sh.label} {sh.hours}
                        </div>

                        {/* Info */}
                        <div className="flex-1 min-w-0">
                          <p className="text-sm font-medium text-white">{ms.model}</p>
                          <p className="text-xs text-[#888]">{ms.platform.toUpperCase()}</p>
                        </div>

                        {/* Recap status */}
                        {isPast || isToday ? (
                          recapDone ? (
                            <div className="flex items-center gap-2">
                              <div className="text-right">
                                <p className="text-xs font-semibold text-emerald-400">{fmtCA(recap?.caNet ?? 0)}</p>
                                <p className="text-[10px] text-[#888]">{recap?.messages ?? 0} msg</p>
                              </div>
                              <div className="flex items-center gap-1.5 text-xs text-emerald-400 bg-emerald-500/10 px-2.5 py-1.5 rounded-xl font-medium">
                                <Check size={12} /> Soumis
                              </div>
                              <button onClick={() => setModal(ms)} className="text-xs text-[#555] hover:text-[#C9A84C] transition">Modifier</button>
                            </div>
                          ) : (
                            <button
                              onClick={() => setModal(ms)}
                              className="flex items-center gap-1.5 text-xs font-semibold text-black bg-[#C9A84C] hover:bg-[#E2C06A] px-3 py-1.5 rounded-xl transition"
                            >
                              <FileText size={12} /> Remplir le recap
                            </button>
                          )
                        ) : (
                          <div className="flex items-center gap-1.5 text-xs text-[#555] bg-[#1a1a1a] px-2.5 py-1.5 rounded-xl">
                            <Clock size={12} /> À venir
                          </div>
                        )}
                      </div>
                    );
                  })}
                </div>
              </div>
            );
          })}

          {myShifts.length === 0 && (
            <div className="text-center py-16 text-[#555]">
              <p className="text-2xl mb-2">📭</p>
              <p className="text-sm">Aucun shift assigné cette semaine</p>
            </div>
          )}
        </div>
      )}

      {/* History tab */}
      {tab === 'history' && (
        <div className="space-y-2">
          {myHistory.length === 0 && (
            <div className="text-center py-16 text-[#555]">
              <p className="text-2xl mb-2">📋</p>
              <p className="text-sm">Aucun recap soumis pour le moment</p>
            </div>
          )}
          {myHistory.map((r) => {
            const sh = SHIFT_MAP[r.shift];
            return (
              <div key={r.id} className="bg-[#111] rounded-xl border border-[#222] px-4 py-3 flex items-center gap-3">
                <div className="flex-shrink-0">
                  <div className="text-xs font-bold text-[#555]">
                    {new Date(r.date + 'T12:00:00').toLocaleDateString('fr-FR', { day: 'numeric', month: 'short' })}
                  </div>
                  <div className="text-[10px] font-bold mt-0.5" style={{ color: sh.color }}>{sh.label}</div>
                </div>
                <div className="w-px h-8 bg-[#222] flex-shrink-0" />
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium text-white">{r.model}</p>
                  <p className="text-xs text-[#888]">{r.platform.toUpperCase()} · {r.messages} msg{r.note ? ` · ${r.note}` : ''}</p>
                </div>
                <div className="text-right flex-shrink-0">
                  <p className="text-sm font-bold text-white">{fmtCA(r.caNet)}</p>
                  <p className="text-[10px] text-[#888]">CA net</p>
                </div>
              </div>
            );
          })}
        </div>
      )}

      {/* Recap modal */}
      {modal && (
        <RecapModal
          myShift={modal}
          existing={getRecap(modal)}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
