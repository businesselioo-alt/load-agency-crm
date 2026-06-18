'use client';

import { useState, useEffect } from 'react';
import { X } from 'lucide-react';
import { SFSPlanningSlot, SlotStatus, STATUS_CONFIG } from '@/lib/planning-sfs';

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
  mode,
  defaultDate,
  defaultModel,
  todayStr,
  slot,
  onSave,
  onDelete,
  onClose,
  slotsOnDate,
}: SlotModalProps) {
  const [form, setForm] = useState({
    date: slot?.date ?? defaultDate ?? todayStr,
    time: slot?.time ?? '',
    partnerAgency: slot?.partnerAgency ?? '',
    partnerModel: slot?.partnerModel ?? '',
    status: (slot?.status ?? 'en_attente') as SlotStatus,
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
    if (mode === 'add') {
      const count = slotsOnDate(form.date);
      if (count >= 2) {
        setError('Maximum 2 SFS par jour atteint pour cette date.');
        return;
      }
    }
    onSave({
      modelName: slot?.modelName ?? defaultModel ?? '',
      date: form.date,
      time: form.time || undefined,
      partnerAgency: form.partnerAgency.trim(),
      partnerModel: form.partnerModel.trim(),
      status: form.status,
    });
  };

  return (
    <div
      className="fixed inset-0 z-50 flex items-center justify-center p-4"
      onClick={(e) => { if (e.target === e.currentTarget) onClose(); }}
    >
      <div className="absolute inset-0 bg-black/40 backdrop-blur-sm" onClick={onClose} />
      <div className="relative bg-white rounded-2xl shadow-2xl w-full max-w-md z-10 overflow-hidden">
        <div className="flex items-center justify-between px-6 py-4 border-b border-gray-100">
          <h2 className="font-semibold text-gray-900">
            {mode === 'add' ? 'Nouveau SFS' : 'Modifier le SFS'}
          </h2>
          <button onClick={onClose} className="p-1.5 text-gray-400 hover:text-gray-600 hover:bg-gray-100 rounded-lg transition">
            <X size={18} />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          {error && (
            <div className="px-3 py-2.5 bg-red-50 border border-red-200 rounded-xl text-red-600 text-sm">
              {error}
            </div>
          )}

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Date *</label>
            <input
              type="date"
              required
              min={mode === 'add' ? todayStr : undefined}
              value={form.date}
              onChange={(e) => { setForm((f) => ({ ...f, date: e.target.value })); setError(''); }}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Heure</label>
            <input
              type="time"
              value={form.time}
              onChange={(e) => setForm((f) => ({ ...f, time: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Agence partenaire *</label>
            <input
              type="text"
              required
              placeholder="ex : Nova Talent"
              value={form.partnerAgency}
              onChange={(e) => setForm((f) => ({ ...f, partnerAgency: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Model partenaire *</label>
            <input
              type="text"
              required
              placeholder="ex : Léna"
              value={form.partnerModel}
              onChange={(e) => setForm((f) => ({ ...f, partnerModel: e.target.value }))}
              className="w-full px-3 py-2.5 border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
            />
          </div>

          <div>
            <label className="block text-xs font-medium text-gray-600 mb-1.5">Statut *</label>
            <div className="grid grid-cols-3 gap-2">
              {(Object.keys(STATUS_CONFIG) as SlotStatus[]).map((s) => {
                const cfg = STATUS_CONFIG[s];
                const active = form.status === s;
                return (
                  <button
                    key={s}
                    type="button"
                    onClick={() => setForm((f) => ({ ...f, status: s }))}
                    className={`flex flex-col items-center gap-1 px-3 py-2.5 rounded-xl border text-xs font-medium transition-all ${
                      active
                        ? `${cfg.bg} ${cfg.border} ${cfg.text} ring-2 ${cfg.ring}`
                        : 'bg-gray-50 border-gray-200 text-gray-500 hover:bg-gray-100'
                    }`}
                  >
                    <span className="text-base">{cfg.emoji}</span>
                    {cfg.label}
                  </button>
                );
              })}
            </div>
          </div>

          <div className={`flex gap-3 pt-2 ${mode === 'edit' ? 'justify-between' : 'justify-end'}`}>
            {mode === 'edit' && slot && onDelete && (
              <button
                type="button"
                onClick={() => { onDelete(slot.id); onClose(); }}
                className="px-4 py-2.5 text-red-500 hover:bg-red-50 border border-red-200 rounded-xl text-sm font-medium transition"
              >
                Supprimer
              </button>
            )}
            <div className="flex gap-2 ml-auto">
              <button
                type="button"
                onClick={onClose}
                className="px-4 py-2.5 text-gray-600 border border-gray-200 rounded-xl text-sm hover:bg-gray-50 transition"
              >
                Annuler
              </button>
              <button
                type="submit"
                className="px-5 py-2.5 bg-[#a855f7] text-white rounded-xl text-sm font-semibold hover:bg-[#9333ea] transition"
              >
                {mode === 'add' ? 'Créer le SFS' : 'Enregistrer'}
              </button>
            </div>
          </div>
        </form>
      </div>
    </div>
  );
}
