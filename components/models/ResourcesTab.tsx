'use client';

import { useState } from 'react';
import { ExternalLink, FileText, HardDrive, Plus, Edit2, Check, X } from 'lucide-react';
import { MODELS, Model } from '@/lib/data';

interface ResourceEntry {
  modelId: string;
  notionLink: string;
  driveLink: string;
  extraLinks: { label: string; url: string }[];
}

export default function ResourcesTab() {
  const [resources, setResources] = useState<ResourceEntry[]>(
    MODELS.map((m) => ({
      modelId: m.id,
      notionLink: m.notionLink ?? '',
      driveLink: m.driveLink ?? '',
      extraLinks: [],
    }))
  );
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editForm, setEditForm] = useState<{ notionLink: string; driveLink: string }>({ notionLink: '', driveLink: '' });
  const [search, setSearch] = useState('');

  const filtered = MODELS.filter((m) => {
    const q = search.toLowerCase();
    return !q || m.name.toLowerCase().includes(q) || m.pseudo.toLowerCase().includes(q);
  });

  const getRes = (modelId: string) => resources.find((r) => r.modelId === modelId);

  const startEdit = (model: Model) => {
    const res = getRes(model.id);
    setEditingId(model.id);
    setEditForm({
      notionLink: res?.notionLink ?? '',
      driveLink: res?.driveLink ?? '',
    });
  };

  const saveEdit = (modelId: string) => {
    setResources((prev) =>
      prev.map((r) =>
        r.modelId === modelId ? { ...r, ...editForm } : r
      )
    );
    setEditingId(null);
  };

  return (
    <div className="space-y-4">
      <div className="flex gap-3">
        <input
          type="text"
          placeholder="Rechercher une model..."
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          className="flex-1 px-4 py-2.5 bg-white border border-gray-200 rounded-xl text-sm outline-none focus:border-[#a855f7] focus:ring-2 focus:ring-[#a855f7]/10 transition"
        />
      </div>

      <div className="grid grid-cols-1 gap-3">
        {filtered.map((model) => {
          const res = getRes(model.id);
          const isEditing = editingId === model.id;

          return (
            <div key={model.id} className="bg-white rounded-2xl border border-gray-100 shadow-sm p-5">
              <div className="flex items-center justify-between mb-4">
                <div className="flex items-center gap-3">
                  <div className="w-10 h-10 rounded-xl bg-[#a855f7]/10 flex items-center justify-center flex-shrink-0">
                    <span className="text-[#a855f7] font-bold">{model.name.charAt(0)}</span>
                  </div>
                  <div>
                    <p className="font-semibold text-gray-900">{model.name}</p>
                    <p className="text-xs text-gray-400">{model.pseudo} · {model.manager}</p>
                  </div>
                </div>
                {isEditing ? (
                  <div className="flex gap-1">
                    <button
                      onClick={() => saveEdit(model.id)}
                      className="p-1.5 text-green-600 hover:bg-green-50 rounded-lg transition"
                    >
                      <Check size={15} />
                    </button>
                    <button
                      onClick={() => setEditingId(null)}
                      className="p-1.5 text-gray-400 hover:bg-gray-100 rounded-lg transition"
                    >
                      <X size={15} />
                    </button>
                  </div>
                ) : (
                  <button
                    onClick={() => startEdit(model)}
                    className="p-1.5 text-gray-400 hover:text-[#a855f7] hover:bg-[#a855f7]/5 rounded-lg transition"
                  >
                    <Edit2 size={15} />
                  </button>
                )}
              </div>

              <div className="grid grid-cols-2 gap-3">
                {/* Notion */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-gray-200 flex items-center justify-center flex-shrink-0">
                    <FileText size={14} className="text-gray-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Notion</p>
                    {isEditing ? (
                      <input
                        type="url"
                        placeholder="https://notion.so/..."
                        value={editForm.notionLink}
                        onChange={(e) => setEditForm((f) => ({ ...f, notionLink: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-[#a855f7] rounded-lg outline-none"
                      />
                    ) : res?.notionLink ? (
                      <a
                        href={res.notionLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#a855f7] hover:text-[#9333ea] font-medium truncate transition"
                      >
                        <ExternalLink size={11} />
                        Ouvrir Notion
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Non configuré</span>
                    )}
                  </div>
                </div>

                {/* Drive */}
                <div className="flex items-center gap-3 p-3 bg-gray-50 rounded-xl">
                  <div className="w-8 h-8 rounded-lg bg-yellow-100 flex items-center justify-center flex-shrink-0">
                    <HardDrive size={14} className="text-yellow-600" />
                  </div>
                  <div className="flex-1 min-w-0">
                    <p className="text-xs font-medium text-gray-500 mb-0.5">Google Drive</p>
                    {isEditing ? (
                      <input
                        type="url"
                        placeholder="https://drive.google.com/..."
                        value={editForm.driveLink}
                        onChange={(e) => setEditForm((f) => ({ ...f, driveLink: e.target.value }))}
                        className="w-full text-xs px-2 py-1 border border-[#a855f7] rounded-lg outline-none"
                      />
                    ) : res?.driveLink ? (
                      <a
                        href={res.driveLink}
                        target="_blank"
                        rel="noopener noreferrer"
                        className="flex items-center gap-1 text-xs text-[#a855f7] hover:text-[#9333ea] font-medium truncate transition"
                      >
                        <ExternalLink size={11} />
                        Ouvrir Drive
                      </a>
                    ) : (
                      <span className="text-xs text-gray-400">Non configuré</span>
                    )}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );
}
