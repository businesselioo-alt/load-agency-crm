'use client';

import { useState, useEffect } from 'react';
import { Edit2, Check, X, Search } from 'lucide-react';
import { MODELS } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';

interface ModelInfos {
  firstName: string;
  usernameMYM: string;
  usernameOF: string;
}

const LS_KEY = 'crm_model_infos_v1';

function loadInfos(): Record<string, ModelInfos> {
  if (typeof window === 'undefined') return {};
  try {
    const stored = localStorage.getItem(LS_KEY);
    if (stored) return JSON.parse(stored);
  } catch {}
  return {};
}

function saveInfos(data: Record<string, ModelInfos>) {
  localStorage.setItem(LS_KEY, JSON.stringify(data));
}

function defaultInfos(model: { name: string; username: string }): ModelInfos {
  const firstName = model.name.split(' ')[0];
  return { firstName, usernameMYM: model.username, usernameOF: '' };
}

export default function InfosTab() {
  const { user } = useAuth();
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [infosMap, setInfosMap] = useState<Record<string, ModelInfos>>({});
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<ModelInfos>({ firstName: '', usernameMYM: '', usernameOF: '' });
  const [search, setSearch] = useState('');

  useEffect(() => {
    const stored = loadInfos();
    // Seed defaults for any model not yet in storage
    const seeded = { ...stored };
    MODELS.forEach((m) => {
      if (!seeded[m.id]) seeded[m.id] = defaultInfos(m);
    });
    setInfosMap(seeded);
    saveInfos(seeded);
  }, []);

  const filtered = MODELS.filter((m) => {
    if (!search) return true;
    const q = search.toLowerCase();
    const info = infosMap[m.id];
    return (
      m.name.toLowerCase().includes(q) ||
      (info?.firstName ?? '').toLowerCase().includes(q) ||
      (info?.usernameMYM ?? '').toLowerCase().includes(q) ||
      (info?.usernameOF ?? '').toLowerCase().includes(q)
    );
  });

  const startEdit = (modelId: string) => {
    setEditingId(modelId);
    setEditForm({ ...infosMap[modelId] });
  };

  const saveEdit = (modelId: string) => {
    const updated = { ...infosMap, [modelId]: editForm };
    setInfosMap(updated);
    saveInfos(updated);
    setEditingId(null);
  };

  const cancelEdit = () => setEditingId(null);

  return (
    <div className="space-y-4">
      {/* Search */}
      <div className="relative w-72">
        <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-gray-400" />
        <input
          type="text"
          placeholder="Rechercher une model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="w-full pl-9 pr-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
        />
      </div>

      {/* Table */}
      <div className="bg-white rounded-2xl border border-gray-100 overflow-hidden shadow-sm">
        <table className="w-full">
          <thead>
            <tr className="border-b border-gray-100 bg-gray-50/50">
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Prénom</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Username MYM</th>
              <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider">Username OnlyFans</th>
              {canEdit && (
                <th className="text-left px-5 py-3.5 text-xs font-semibold text-gray-500 uppercase tracking-wider w-20">Actions</th>
              )}
            </tr>
          </thead>
          <tbody className="divide-y divide-gray-50">
            {filtered.map((model) => {
              const info = infosMap[model.id] ?? defaultInfos(model);
              const isEditing = editingId === model.id;

              return (
                <tr key={model.id} className="hover:bg-gray-50/40 transition-colors">
                  {/* Prénom */}
                  <td className="px-5 py-4">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#a855f7]/10 flex items-center justify-center flex-shrink-0">
                        <span className="text-[#a855f7] text-xs font-bold">
                          {(isEditing ? editForm.firstName : info.firstName).charAt(0) || model.name.charAt(0)}
                        </span>
                      </div>
                      {isEditing ? (
                        <input
                          className="px-2 py-1.5 border border-[#a855f7] rounded-lg text-sm w-32 outline-none focus:ring-2 focus:ring-[#a855f7]/10"
                          value={editForm.firstName}
                          onChange={(e) => setEditForm((f) => ({ ...f, firstName: e.target.value }))}
                          autoFocus
                        />
                      ) : (
                        <span className="text-sm font-semibold text-gray-900">{info.firstName}</span>
                      )}
                    </div>
                  </td>

                  {/* Username MYM */}
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        className="px-2 py-1.5 border border-[#a855f7] rounded-lg text-sm w-40 outline-none focus:ring-2 focus:ring-[#a855f7]/10 font-mono"
                        value={editForm.usernameMYM}
                        placeholder="@username"
                        onChange={(e) => setEditForm((f) => ({ ...f, usernameMYM: e.target.value }))}
                      />
                    ) : (
                      <span className="text-sm text-gray-600 font-mono">
                        {info.usernameMYM ? `@${info.usernameMYM.replace(/^@/, '')}` : <span className="text-gray-300">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Username OF */}
                  <td className="px-5 py-4">
                    {isEditing ? (
                      <input
                        className="px-2 py-1.5 border border-[#a855f7] rounded-lg text-sm w-40 outline-none focus:ring-2 focus:ring-[#a855f7]/10 font-mono"
                        value={editForm.usernameOF}
                        placeholder="@username"
                        onChange={(e) => setEditForm((f) => ({ ...f, usernameOF: e.target.value }))}
                      />
                    ) : (
                      <span className="text-sm text-gray-600 font-mono">
                        {info.usernameOF ? `@${info.usernameOF.replace(/^@/, '')}` : <span className="text-gray-300">—</span>}
                      </span>
                    )}
                  </td>

                  {/* Actions */}
                  {canEdit && (
                    <td className="px-5 py-4">
                      {isEditing ? (
                        <div className="flex gap-1">
                          <button
                            onClick={() => saveEdit(model.id)}
                            className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                          >
                            <Check size={15} />
                          </button>
                          <button
                            onClick={cancelEdit}
                            className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                          >
                            <X size={15} />
                          </button>
                        </div>
                      ) : (
                        <button
                          onClick={() => startEdit(model.id)}
                          className="p-1.5 text-gray-400 hover:text-[#a855f7] hover:bg-[#a855f7]/5 rounded-lg transition"
                        >
                          <Edit2 size={15} />
                        </button>
                      )}
                    </td>
                  )}
                </tr>
              );
            })}
          </tbody>
        </table>

        {filtered.length === 0 && (
          <div className="py-12 text-center text-gray-400 text-sm">Aucune model trouvée</div>
        )}
      </div>

      <p className="text-xs text-gray-400 px-1">
        {filtered.length} model{filtered.length > 1 ? 's' : ''}
      </p>
    </div>
  );
}
