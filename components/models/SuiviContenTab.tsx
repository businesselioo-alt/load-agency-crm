'use client';

import { useState } from 'react';
import { CheckCircle2, XCircle, Clock, ChevronDown } from 'lucide-react';
import { MODELS, CONTENT_TRACKING, ContentStatus, ContentTracking } from '@/lib/data';

const STATUS_CONFIG: Record<ContentStatus, { label: string; icon: typeof CheckCircle2; color: string; bg: string }> = {
  fait: { label: 'Fait', icon: CheckCircle2, color: 'text-green-600', bg: 'bg-green-50' },
  manquant: { label: 'Manquant', icon: XCircle, color: 'text-red-500', bg: 'bg-red-50' },
  en_retard: { label: 'En retard', icon: Clock, color: 'text-orange-500', bg: 'bg-orange-50' },
};

const CONTENT_TYPES: { key: keyof Omit<ContentTracking, 'modelId' | 'week'>; label: string }[] = [
  { key: 'photos', label: 'Photos' },
  { key: 'videos', label: 'Vidéos' },
  { key: 'stories', label: 'Stories' },
  { key: 'reels', label: 'Reels' },
];

function StatusBadge({ status }: { status: ContentStatus }) {
  const cfg = STATUS_CONFIG[status];
  const Icon = cfg.icon;
  return (
    <span className={`inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-xs font-medium ${cfg.bg} ${cfg.color}`}>
      <Icon size={13} />
      {cfg.label}
    </span>
  );
}

function StatusSelect({
  value,
  onChange,
}: {
  value: ContentStatus;
  onChange: (v: ContentStatus) => void;
}) {
  return (
    <div className="relative inline-flex items-center">
      <select
        value={value}
        onChange={(e) => onChange(e.target.value as ContentStatus)}
        className={`appearance-none pl-3 pr-7 py-1.5 rounded-lg text-xs font-medium cursor-pointer outline-none border-0 ${STATUS_CONFIG[value].bg} ${STATUS_CONFIG[value].color}`}
      >
        <option value="fait">Fait</option>
        <option value="manquant">Manquant</option>
        <option value="en_retard">En retard</option>
      </select>
      <ChevronDown size={11} className={`absolute right-1.5 pointer-events-none ${STATUS_CONFIG[value].color}`} />
    </div>
  );
}

export default function SuiviContenTab() {
  const [tracking, setTracking] = useState<ContentTracking[]>(CONTENT_TRACKING);
  const [selectedWeek] = useState('2026-W23');

  const updateStatus = (modelId: string, field: keyof Omit<ContentTracking, 'modelId' | 'week'>, value: ContentStatus) => {
    setTracking((prev) =>
      prev.map((t) =>
        t.modelId === modelId && t.week === selectedWeek ? { ...t, [field]: value } : t
      )
    );
  };

  const getTracking = (modelId: string) =>
    tracking.find((t) => t.modelId === modelId && t.week === selectedWeek);

  const getScore = (modelId: string) => {
    const t = getTracking(modelId);
    if (!t) return 0;
    const values = [t.photos, t.videos, t.stories, t.reels];
    return values.filter((v) => v === 'fait').length;
  };

  const totalModels = MODELS.length;
  const completedModels = MODELS.filter((m) => getScore(m.id) === 4).length;
  const missingModels = MODELS.filter((m) => {
    const t = getTracking(m.id);
    return t && Object.values([t.photos, t.videos, t.stories, t.reels]).some((v) => v === 'manquant');
  }).length;
  const lateModels = MODELS.filter((m) => {
    const t = getTracking(m.id);
    return t && Object.values([t.photos, t.videos, t.stories, t.reels]).some((v) => v === 'en_retard');
  }).length;

  return (
    <div className="space-y-5">
      {/* Stats */}
      <div className="grid grid-cols-4 gap-3">
        {[
          { label: 'Total models', value: totalModels, color: 'text-gray-900', bg: 'bg-white' },
          { label: 'Complètes', value: completedModels, color: 'text-green-600', bg: 'bg-green-50' },
          { label: 'Manquant', value: missingModels, color: 'text-red-500', bg: 'bg-red-50' },
          { label: 'En retard', value: lateModels, color: 'text-orange-500', bg: 'bg-orange-50' },
        ].map((s) => (
          <div key={s.label} className={`${s.bg} rounded-2xl p-4 border border-gray-100`}>
            <p className={`text-2xl font-bold ${s.color}`}>{s.value}</p>
            <p className="text-xs text-gray-500 mt-0.5">{s.label}</p>
          </div>
        ))}
      </div>

      {/* Week selector */}
      <div className="flex items-center gap-3">
        <span className="text-sm text-gray-500">Semaine :</span>
        <span className="px-3 py-1.5 bg-[#a855f7]/10 text-[#a855f7] rounded-lg text-sm font-medium">
          Semaine 23 — 2 au 8 Juin 2026
        </span>
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Model</th>
              {CONTENT_TYPES.map((ct) => (
                <th key={ct.key} className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">
                  {ct.label}
                </th>
              ))}
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Score</th>
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {MODELS.map((model) => {
              const t = getTracking(model.id);
              const score = getScore(model.id);
              return (
                <tr key={model.id} className="hover:bg-gray-50/50 transition-colors">
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2.5">
                      <div className="w-8 h-8 rounded-full bg-[#a855f7]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#a855f7] text-xs font-bold">{model.name.charAt(0)}</span>
                      </div>
                      <div>
                        <p className="text-sm font-medium text-gray-900">{model.name}</p>
                        <p className="text-xs text-gray-400">{model.manager}</p>
                      </div>
                    </div>
                  </td>
                  {CONTENT_TYPES.map((ct) => (
                    <td key={ct.key} className="px-5 py-4">
                      {t ? (
                        <StatusSelect
                          value={t[ct.key]}
                          onChange={(v) => updateStatus(model.id, ct.key, v)}
                        />
                      ) : (
                        <span className="text-gray-300 text-sm">—</span>
                      )}
                    </td>
                  ))}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-2">
                      <div className="w-24 bg-gray-100 rounded-full h-1.5">
                        <div
                          className="bg-[#a855f7] h-1.5 rounded-full transition-all"
                          style={{ width: `${(score / 4) * 100}%` }}
                        />
                      </div>
                      <span className="text-xs font-semibold text-gray-700">{score}/4</span>
                    </div>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
