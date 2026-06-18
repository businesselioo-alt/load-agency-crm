'use client';

import { useState } from 'react';
import { ChevronLeft, ChevronRight, Plus, X } from 'lucide-react';
import { MODELS, SCHEDULE, ScheduleEntry, Platform } from '@/lib/data';

const DAYS_FR = ['Dim', 'Lun', 'Mar', 'Mer', 'Jeu', 'Ven', 'Sam'];
const MONTHS_FR = [
  'Janvier', 'Février', 'Mars', 'Avril', 'Mai', 'Juin',
  'Juillet', 'Août', 'Septembre', 'Octobre', 'Novembre', 'Décembre',
];

const TYPE_COLORS: Record<ScheduleEntry['type'], string> = {
  post: 'bg-purple-100 text-purple-700',
  live: 'bg-red-100 text-red-600',
  story: 'bg-blue-100 text-blue-700',
  announcement: 'bg-yellow-100 text-yellow-700',
};

const TYPE_LABELS: Record<ScheduleEntry['type'], string> = {
  post: 'Post',
  live: 'Live',
  story: 'Story',
  announcement: 'Annonce',
};

const PLATFORM_COLORS: Record<Platform, string> = {
  MYM: 'bg-purple-500',
  OF: 'bg-blue-500',
  Reveal: 'bg-emerald-500',
};

export default function ScheduleTab() {
  const today = new Date();
  const [currentDate, setCurrentDate] = useState(new Date(today.getFullYear(), today.getMonth(), 1));
  const [entries, setEntries] = useState<ScheduleEntry[]>(SCHEDULE);
  const [selectedDate, setSelectedDate] = useState<string | null>(null);
  const [showAddForm, setShowAddForm] = useState(false);
  const [form, setForm] = useState({
    modelId: '',
    title: '',
    description: '',
    platform: 'MYM' as Platform,
    type: 'post' as ScheduleEntry['type'],
  });

  const year = currentDate.getFullYear();
  const month = currentDate.getMonth();

  const firstDay = new Date(year, month, 1).getDay();
  const daysInMonth = new Date(year, month + 1, 0).getDate();

  const prevMonth = () => setCurrentDate(new Date(year, month - 1, 1));
  const nextMonth = () => setCurrentDate(new Date(year, month + 1, 1));

  const getDateStr = (day: number) => `${year}-${String(month + 1).padStart(2, '0')}-${String(day).padStart(2, '0')}`;

  const getEntriesForDay = (day: number) => {
    const dateStr = getDateStr(day);
    return entries.filter((e) => e.date === dateStr);
  };

  const todayStr = `${today.getFullYear()}-${String(today.getMonth() + 1).padStart(2, '0')}-${String(today.getDate()).padStart(2, '0')}`;

  const selectedEntries = selectedDate ? entries.filter((e) => e.date === selectedDate) : [];

  const addEntry = (e: React.FormEvent) => {
    e.preventDefault();
    if (!form.modelId || !form.title || !selectedDate) return;
    const newEntry: ScheduleEntry = {
      id: `s${Date.now()}`,
      modelId: form.modelId,
      date: selectedDate,
      title: form.title,
      description: form.description || undefined,
      platform: form.platform,
      type: form.type,
    };
    setEntries((prev) => [...prev, newEntry]);
    setForm({ modelId: '', title: '', description: '', platform: 'MYM', type: 'post' });
    setShowAddForm(false);
  };

  const cells: (number | null)[] = [
    ...Array.from({ length: firstDay }, () => null),
    ...Array.from({ length: daysInMonth }, (_, i) => i + 1),
  ];

  while (cells.length % 7 !== 0) cells.push(null);

  return (
    <div className="space-y-5">
      <div className="flex gap-5">
        {/* Calendar */}
        <div className="flex-1 bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
          {/* Header */}
          <div className="flex items-center justify-between mb-5">
            <h3 className="font-semibold text-gray-900">
              {MONTHS_FR[month]} {year}
            </h3>
            <div className="flex gap-1">
              <button onClick={prevMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
                <ChevronLeft size={17} />
              </button>
              <button onClick={nextMonth} className="p-1.5 rounded-lg hover:bg-gray-100 transition text-gray-500">
                <ChevronRight size={17} />
              </button>
            </div>
          </div>

          {/* Day labels */}
          <div className="grid grid-cols-7 mb-2">
            {DAYS_FR.map((d) => (
              <div key={d} className="text-center text-xs font-semibold text-gray-400 py-1">
                {d}
              </div>
            ))}
          </div>

          {/* Grid */}
          <div className="grid grid-cols-7 gap-0.5">
            {cells.map((day, idx) => {
              if (!day) return <div key={`empty-${idx}`} className="h-20" />;
              const dateStr = getDateStr(day);
              const dayEntries = getEntriesForDay(day);
              const isToday = dateStr === todayStr;
              const isSelected = dateStr === selectedDate;

              return (
                <div
                  key={day}
                  onClick={() => setSelectedDate(isSelected ? null : dateStr)}
                  className={`h-20 p-1.5 rounded-xl cursor-pointer transition-all border ${
                    isSelected
                      ? 'bg-[#a855f7]/5 border-[#a855f7]/20'
                      : 'border-transparent hover:bg-gray-50'
                  }`}
                >
                  <div className={`w-6 h-6 flex items-center justify-center rounded-full text-xs font-medium mb-1 ${
                    isToday
                      ? 'bg-[#a855f7] text-white'
                      : 'text-gray-700'
                  }`}>
                    {day}
                  </div>
                  <div className="space-y-0.5">
                    {dayEntries.slice(0, 2).map((entry) => (
                      <div
                        key={entry.id}
                        className="flex items-center gap-1 truncate"
                      >
                        <div className={`w-1.5 h-1.5 rounded-full flex-shrink-0 ${PLATFORM_COLORS[entry.platform]}`} />
                        <span className="text-xs text-gray-600 truncate">{entry.title}</span>
                      </div>
                    ))}
                    {dayEntries.length > 2 && (
                      <span className="text-xs text-gray-400">+{dayEntries.length - 2}</span>
                    )}
                  </div>
                </div>
              );
            })}
          </div>
        </div>

        {/* Sidebar: selected day detail */}
        <div className="w-72 flex-shrink-0">
          {selectedDate ? (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 h-full">
              <div className="flex items-center justify-between mb-4">
                <h3 className="font-semibold text-gray-900 text-sm">
                  {new Date(selectedDate + 'T12:00:00').toLocaleDateString('fr-FR', {
                    weekday: 'long',
                    day: 'numeric',
                    month: 'long',
                  })}
                </h3>
                <button
                  onClick={() => { setShowAddForm(true); }}
                  className="p-1.5 text-[#a855f7] hover:bg-[#a855f7]/5 rounded-lg transition"
                >
                  <Plus size={15} />
                </button>
              </div>

              {showAddForm ? (
                <form onSubmit={addEntry} className="space-y-3">
                  <select
                    required
                    value={form.modelId}
                    onChange={(e) => setForm((f) => ({ ...f, modelId: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#a855f7]"
                  >
                    <option value="">Model</option>
                    {MODELS.map((m) => <option key={m.id} value={m.id}>{m.name}</option>)}
                  </select>
                  <input
                    required
                    type="text"
                    placeholder="Titre de l'annonce"
                    value={form.title}
                    onChange={(e) => setForm((f) => ({ ...f, title: e.target.value }))}
                    className="w-full px-3 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#a855f7]"
                  />
                  <div className="grid grid-cols-2 gap-2">
                    <select
                      value={form.platform}
                      onChange={(e) => setForm((f) => ({ ...f, platform: e.target.value as Platform }))}
                      className="px-2 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#a855f7]"
                    >
                      {(['MYM', 'OF', 'Reveal'] as Platform[]).map((p) => <option key={p} value={p}>{p}</option>)}
                    </select>
                    <select
                      value={form.type}
                      onChange={(e) => setForm((f) => ({ ...f, type: e.target.value as ScheduleEntry['type'] }))}
                      className="px-2 py-2 border border-gray-200 rounded-xl text-xs outline-none focus:border-[#a855f7]"
                    >
                      {(['post', 'live', 'story', 'announcement'] as const).map((t) => (
                        <option key={t} value={t}>{TYPE_LABELS[t]}</option>
                      ))}
                    </select>
                  </div>
                  <div className="flex gap-2">
                    <button type="submit" className="flex-1 py-2 bg-[#a855f7] text-white rounded-xl text-xs font-medium hover:bg-[#9333ea] transition">
                      Ajouter
                    </button>
                    <button type="button" onClick={() => setShowAddForm(false)} className="py-2 px-3 border border-gray-200 rounded-xl text-xs text-gray-500 hover:bg-gray-50 transition">
                      <X size={13} />
                    </button>
                  </div>
                </form>
              ) : selectedEntries.length === 0 ? (
                <div className="py-8 text-center">
                  <p className="text-gray-400 text-sm">Aucune annonce</p>
                  <button
                    onClick={() => setShowAddForm(true)}
                    className="mt-3 flex items-center gap-1.5 mx-auto text-xs text-[#a855f7] hover:text-[#9333ea] transition font-medium"
                  >
                    <Plus size={13} />
                    Ajouter une annonce
                  </button>
                </div>
              ) : (
                <div className="space-y-3">
                  {selectedEntries.map((entry) => {
                    const model = MODELS.find((m) => m.id === entry.modelId);
                    return (
                      <div key={entry.id} className="p-3 bg-gray-50 rounded-xl">
                        <div className="flex items-center gap-2 mb-1.5">
                          <div className={`w-2 h-2 rounded-full ${PLATFORM_COLORS[entry.platform]}`} />
                          <span className="text-xs font-medium text-gray-900 flex-1">{entry.title}</span>
                          <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[entry.type]}`}>
                            {TYPE_LABELS[entry.type]}
                          </span>
                        </div>
                        {model && (
                          <p className="text-xs text-gray-500">{model.name} · {entry.platform}</p>
                        )}
                        {entry.description && (
                          <p className="text-xs text-gray-400 mt-1">{entry.description}</p>
                        )}
                      </div>
                    );
                  })}
                </div>
              )}
            </div>
          ) : (
            <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5 flex flex-col items-center justify-center h-full min-h-48 text-center">
              <p className="text-gray-400 text-sm">Cliquez sur un jour pour voir les annonces</p>
            </div>
          )}
        </div>
      </div>

      {/* Upcoming */}
      <div className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
        <h3 className="font-semibold text-gray-900 mb-4">Prochaines annonces</h3>
        <div className="grid grid-cols-3 gap-3">
          {entries
            .filter((e) => e.date >= todayStr)
            .sort((a, b) => a.date.localeCompare(b.date))
            .slice(0, 6)
            .map((entry) => {
              const model = MODELS.find((m) => m.id === entry.modelId);
              return (
                <div key={entry.id} className="flex items-start gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="text-center flex-shrink-0">
                    <p className="text-xs text-gray-400">
                      {new Date(entry.date + 'T12:00:00').toLocaleDateString('fr-FR', { month: 'short' }).toUpperCase()}
                    </p>
                    <p className="text-lg font-bold text-gray-900 leading-tight">
                      {new Date(entry.date + 'T12:00:00').getDate()}
                    </p>
                  </div>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{entry.title}</p>
                    <p className="text-xs text-gray-500">{model?.name}</p>
                    <div className="flex items-center gap-1.5 mt-1">
                      <div className={`w-1.5 h-1.5 rounded-full ${PLATFORM_COLORS[entry.platform]}`} />
                      <span className="text-xs text-gray-400">{entry.platform}</span>
                      <span className={`px-1.5 py-0.5 rounded text-xs font-medium ${TYPE_COLORS[entry.type]}`}>
                        {TYPE_LABELS[entry.type]}
                      </span>
                    </div>
                  </div>
                </div>
              );
            })}
        </div>
      </div>
    </div>
  );
}
