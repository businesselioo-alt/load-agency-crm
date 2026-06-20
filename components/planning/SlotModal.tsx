'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SFSPlanningSlot, SlotStatus, STATUS_CONFIG } from '@/lib/planning-sfs';

// Dark-mode status styles
const DARK_STATUS: Record<SlotStatus, { bg: string; border: string; text: string; ring: string; glow: string }> = {
  programmé:  { bg: 'bg-emerald-500/10', border: 'border-emerald-500/25', text: 'text-emerald-400', ring: 'ring-emerald-500/30', glow: '0 0 14px rgba(16,185,129,0.18)' },
  en_attente: { bg: 'bg-amber-500/10',   border: 'border-amber-500/25',   text: 'text-amber-400',   ring: 'ring-amber-500/30',   glow: '0 0 14px rgba(245,158,11,0.18)' },
  annulé:     { bg: 'bg-red-500/10',     border: 'border-red-500/25',     text: 'text-red-400',     ring: 'ring-red-500/30',     glow: '0 0 14px rgba(239,68,68,0.14)' },
};

interface SlotModalProps {
  mode: 'add' | 'edit';
  defaultDate?: string;
  defaultModel?: string;
  todayStr: string;
  slot?: SFSPlanningSlot;
  onSave: (data: Omit<SFSPlanningSlot, 'id' | 'createdAt'>) => void;
  onDelete?: (id: string) => void;
  onClose: () => void;
  slotsOnDate: (date: string) => number;
}

export default function SlotModal({
  mode, defaultDate, defaultModel, todayStr, slot, onSave, onDelete, onClose, slotsOnDate,
}: SlotModalProps) {
  const [form, setForm] = useState({
    date:          slot?.date          ?? defaultDate ?? todayStr,
    time:          slot?.time          ?? '',
    partnerAgency: slot?.partnerAgency ?? '',
    partnerModel:  slot?.partnerModel  ?? '',
    status:        (slot?.status       ?? 'en_attente') as SlotStatus,
  });
  const [error, setError] = useState('');

  useEffect(() => {
    const handler = (e: KeyboardEvent) => { if (e.key === 'Escape') onClose(); };
    window.addEventListener('keydown', handler);
    return () => window.removeEventListener('keydown', handler);
  }, [onClose]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    setError('');
    if (!form.date || !form.partnerAgency.trim() || !form.partnerModel.trim()) {
      setError('Tous les champs sont requis.');
      return;
    }
    if (mode === 'add' && slotsOnDate(form.date) >= 2) {
      setError('Maximum 2 SFS par jour atteint pour cette date.');
      return;
    }
    onSave({
      modelName:     slot?.modelName ?? defaultModel ?? '',
      date:          form.date,
      time:          form.time || undefined,
      partnerAgency: form.partnerAgency.trim(),
      partnerModel:  form.partnerModel.trim(),
      status:        form.status,
    });
  };

  const inputClass = 'w-full px-3 py-2.5 bg-white/[0.04] border border-white/10 rounded-xl text-sm text-white placeholder-[#444] outline-none focus:border-[#C9A84C] focus:ring-2 focus:ring-[#C9A84C]/20 transition';
  const labelClass = 'block text-xs font-medium text-[#666] mb-1.5';

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/60 backdrop-blur-sm" onClick={onClose} />

      <div className="relative bg-[#111] border border-white/10 rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
        {/* Header */}
        <div className="flex items-center justify-between px-6 py-4 border-b border-white/[0.06]">
          <div>
            <h2 className="font-semibold text-white text-base">
              {mode === 'add' ? 'Nouveau SFS' : 'Modifier le SFS'}
            </h2>
            {mode === 'edit' && slot && (
              <p className="text-xs text-[#555] mt-0.5">{slot.partnerAgency} · {slot.partnerModel}</p>
            )}
          </div>
          <button onClick={onClose}
            className="p-1.5 text-[#555] hover:text-white hover:bg-white/5 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-500/10 border border-red-500/20 rounded-xl text-red-400 text-sm">
              {error}
            </div>
          )}

          <div className="grid grid-cols-2 gap-3">
            <div>
              <label className={labelClass}>Date *</label>
              <input
                type="date"
                required
                min={mode === 'add' ? todayStr : undefined}
                value={form.date}
                onChange={(e) => { setForm((f) => ({ ...f, date: e.target.value })); setError(''); }}
                className={inputClass}
              />
            </div>
            <div>
              <label className={labelClass}>Heure</label>
              <input
                type="time"
                value={form.time}
                onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
                className={inputClass}
              />
            </div>
          </div>

          <div>
            <label className={labelClass}>Agence partenaire *</label>
            <input
              type="text"
              required
              placeholder="ex : Nova Talent"
              value={form.partnerAgency}
              onChange={(e) => setForm((f) => ({ ...f, partnerAgency: e.target.value }))}
              className={inputClass}
            />
          </div>

          <div>
            <label className={labelClass}>Model partenaire *</label>
            <input
              type="text"
              required
              placeholder="ex : Léna"
              value={form.partnerModel}
              onChange={(e) => setForm((f) => ({ ...f, partnerModel: e.target.value }))}
              className={inputClass}
            />
          </div>

          {/* Status picker */}
          <div>
            <label className={labelClass}>Statut *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(DARK_STATUS) as SlotStatus[]).map((s) => {
                const cfg   = DARK_STATUS[s];
                const scfg  = STATUS_CONFIG[s];
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex flex-col items-center gap-1.5 px-3 py-3 rounded-xl border text-xs font-medium transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.border} ${cfg.text} ring-1 ${cfg.ring}`
                        : 'bg-white/[0.02] border-white/[0.06] text-[#555] hover:bg-white/[0.05] hover:border-white/10 hover:text-[#888]'
                    }`}
                    style={active ? { boxShadow: cfg.glow } : {}}
                  >
                    <span className="text-base leading-none">{scfg.emoji}</span>
                    <span>{scfg.label}</span>
                  </button>
                );
              })}
            </div>
          </div>

          {/* Actions */}
          <div className={`flex gap-3 pt-1 ${mode === 'edit' ? 'justify-between' : 'justify-end'}`}>
            {mode === 'edit' && slot && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(slot.id); onClose(); }}
                className="px-4 py-2.5 text-red-400 hover:bg-red-500/10 border border-red-500/20 rounded-xl text-sm font-medium transition"
              >
                Supprimer
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button type="button" onClick={onClose}
                className="px-4 py-2.5 text-[#888] border border-white/10 rounded-xl text-sm hover:bg-white/5 transition">
                Annuler
              </button>
              <button type="submit"
                className="px-5 py-2.5 bg-[#C9A84C] text-black rounded-xl text-sm font-semibold hover:bg-[#E2C06A] transition shadow-lg"
                style={{ boxShadow: '0 4px 16px rgba(201,168,76,0.35)' }}>
                {mode === 'add' ? 'Créer le SFS' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
