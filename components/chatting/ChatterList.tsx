'use client';

import { useState, useEffect } from 'react';
import { Plus, Edit2, Trash2, X, Check } from 'lucide-react';
import {
  ChatterProfile, ChattingPlatform,
  loadChatters, saveChatters, uid,
} from '@/lib/chatting';

// ─── Modal add / edit ─────────────────────────────────────────────────────────

function ChatterModal({ initial, onSave, onClose }: {
  initial?: ChatterProfile;
  onSave: (c: ChatterProfile) => void;
  onClose: () => void;
}) {
  const [name,      setName]      = useState(initial?.name ?? '');
  const [platforms, setPlatforms] = useState<ChattingPlatform[]>(initial?.platforms ?? ['of', 'mym']);
  const [status,    setStatus]    = useState<'active' | 'inactive'>(initial?.status ?? 'active');

  function togglePlatform(p: ChattingPlatform) {
    setPlatforms((prev) =>
      prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p],
    );
  }

  function handleSave() {
    if (!name.trim() || platforms.length === 0) return;
    onSave({
      id:        initial?.id ?? uid(),
      name:      name.trim(),
      platforms,
      status,
    });
  }

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center bg-black/70" onClick={onClose}>
      <div className="bg-[#111] border border-[#222] rounded-xl shadow-2xl p-6 w-80 flex flex-col gap-4" onClick={(e) => e.stopPropagation()}>
        <div className="flex items-center justify-between">
          <h3 className="font-bold text-white text-sm">{initial ? 'Modifier le chatter' : 'Ajouter un chatter'}</h3>
          <button onClick={onClose} className="text-[#555] hover:text-white transition"><X size={16} /></button>
        </div>

        <label className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#888]">Nom</span>
          <input
            type="text" value={name} onChange={(e) => setName(e.target.value)}
            placeholder="Prénom / pseudo"
            autoFocus
            className="bg-[#1a1a1a] border border-[#333] text-white rounded-xl px-3 py-2.5 text-sm focus:outline-none focus:ring-2 focus:ring-[#C9A84C]/30 focus:border-[#C9A84C] placeholder-[#555]"
            onKeyDown={(e) => { if (e.key === 'Enter') handleSave(); }}
          />
        </label>

        <div className="flex flex-col gap-1.5">
          <span className="text-xs font-semibold text-[#888]">Plateformes</span>
          <div className="flex gap-2">
            {(['of', 'mym'] as const).map((p) => {
              const active = platforms.includes(p);
              return (
                <button
                  key={p}
                  onClick={() => togglePlatform(p)}
                  className={`flex-1 py-2 rounded-xl text-sm font-semibold border-2 transition ${
                    active
                      ? p === 'of'
                        ? 'bg-[#C9A84C]/10 border-[#C9A84C] text-[#C9A84C]'
                        : 'bg-pink-500/10 border-pink-500 text-pink-400'
                      : 'border-[#333] text-[#555] hover:border-[#444]'
                  }`}
                >
                  {p.toUpperCase()}
                </button>
              );
            })}
          </div>
          {platforms.length === 0 && <p className="text-xs text-red-400">Au moins une plateforme requise</p>}
        </div>

        {initial && (
          <div className="flex flex-col gap-1.5">
            <span className="text-xs font-semibold text-[#888]">Statut</span>
            <button
              onClick={() => setStatus((s) => s === 'active' ? 'inactive' : 'active')}
              className={`flex items-center gap-2 px-3 py-2 rounded-xl text-sm font-medium border transition ${
                status === 'active'
                  ? 'border-emerald-500/30 bg-emerald-500/10 text-emerald-400'
                  : 'border-[#333] bg-[#1a1a1a] text-[#555]'
              }`}
            >
              <span className={`w-2 h-2 rounded-full ${status === 'active' ? 'bg-emerald-500' : 'bg-[#444]'}`} />
              {status === 'active' ? 'Actif' : 'Inactif'}
            </button>
          </div>
        )}

        <div className="flex gap-2 pt-1">
          <button onClick={onClose}    className="flex-1 py-2.5 rounded-xl border border-[#333] text-sm text-[#888] hover:bg-[#1a1a1a] transition">Annuler</button>
          <button
            onClick={handleSave}
            disabled={!name.trim() || platforms.length === 0}
            className="flex-1 py-2.5 rounded-xl bg-[#C9A84C] text-black text-sm font-semibold hover:bg-[#E2C06A] transition disabled:opacity-40"
          >
            {initial ? 'Enregistrer' : 'Ajouter'}
          </button>
        </div>
      </div>
    </div>
  );
}

// ─── Main ─────────────────────────────────────────────────────────────────────

export default function ChatterList() {
  const [chatters,   setChatters]   = useState<ChatterProfile[]>([]);
  const [modal,      setModal]      = useState<ChatterProfile | 'new' | null>(null);
  const [deleteId,   setDeleteId]   = useState<string | null>(null);

  useEffect(() => { loadChatters().then(setChatters); }, []);

  function persist(c: ChatterProfile[]) { setChatters(c); saveChatters(c); }

  function handleSave(chatter: ChatterProfile) {
    const next = chatters.some((c) => c.id === chatter.id)
      ? chatters.map((c) => (c.id === chatter.id ? chatter : c))
      : [...chatters, chatter];
    persist(next);
    setModal(null);
  }

  function handleDelete(id: string) {
    persist(chatters.filter((c) => c.id !== id));
    setDeleteId(null);
  }

  const active   = chatters.filter((c) => c.status === 'active').length;
  const inactive = chatters.filter((c) => c.status !== 'active').length;

  return (
    <div className="p-6 space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-xl font-bold text-white">Chatters</h2>
          <p className="text-sm text-[#888] mt-0.5">{active} actif{active !== 1 ? 's' : ''}{inactive > 0 ? ` · ${inactive} inactif${inactive !== 1 ? 's' : ''}` : ''}</p>
        </div>
        <button
          onClick={() => setModal('new')}
          className="flex items-center gap-2 px-4 py-2.5 bg-[#C9A84C] text-black rounded-xl text-sm font-semibold hover:bg-[#E2C06A] transition"
        >
          <Plus size={15} /> Ajouter un chatter
        </button>
      </div>

      <div className="bg-[#111] rounded-2xl border border-[#222] overflow-hidden">
        {chatters.length === 0 ? (
          <div className="py-16 text-center text-[#555]">
            <p className="text-2xl mb-2">👥</p>
            <p className="text-sm">Aucun chatter — ajoutez-en un</p>
          </div>
        ) : (
          <table className="w-full">
            <thead>
              <tr className="border-b border-[#1a1a1a] bg-[#0f0f0f]">
                <th className="text-left px-5 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide">Nom</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide">Plateformes</th>
                <th className="text-left px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wide">Statut</th>
                <th className="w-24 px-4 py-3" />
              </tr>
            </thead>
            <tbody>
              {chatters.map((c) => (
                <tr key={c.id} className="border-b border-[#1a1a1a] hover:bg-[#1a1a1a] transition-colors group">
                  <td className="px-5 py-3">
                    <div className="flex items-center gap-3">
                      <div className="w-8 h-8 rounded-full bg-[#C9A84C]/10 flex items-center justify-center flex-shrink-0 text-sm font-bold text-[#C9A84C]">
                        {c.name.charAt(0).toUpperCase()}
                      </div>
                      <span className="font-semibold text-white text-sm">{c.name}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <div className="flex gap-1.5">
                      {c.platforms.map((p) => (
                        <span key={p} className={`text-xs font-semibold px-2 py-0.5 rounded-full ${p === 'of' ? 'bg-purple-500/10 text-purple-400' : 'bg-pink-500/10 text-pink-400'}`}>
                          {p.toUpperCase()}
                        </span>
                      ))}
                    </div>
                  </td>
                  <td className="px-4 py-3">
                    <span className={`flex items-center gap-1.5 w-fit text-xs font-medium px-2.5 py-1 rounded-full ${
                      c.status === 'active' ? 'bg-emerald-500/10 text-emerald-400' : 'bg-[#1a1a1a] text-[#555]'
                    }`}>
                      <span className={`w-1.5 h-1.5 rounded-full ${c.status === 'active' ? 'bg-emerald-500' : 'bg-[#555]'}`} />
                      {c.status === 'active' ? 'Actif' : 'Inactif'}
                    </span>
                  </td>
                  <td className="px-4 py-3">
                    {deleteId === c.id ? (
                      <div className="flex items-center gap-2">
                        <span className="text-xs text-red-400 font-medium">Supprimer ?</span>
                        <button onClick={() => handleDelete(c.id)} className="text-xs text-red-400 hover:text-red-300 font-bold transition"><Check size={14} /></button>
                        <button onClick={() => setDeleteId(null)}  className="text-xs text-[#555] hover:text-[#888] transition"><X size={14} /></button>
                      </div>
                    ) : (
                      <div className="flex items-center gap-1 opacity-0 group-hover:opacity-100 transition">
                        <button onClick={() => setModal(c)}        className="p-1.5 rounded-lg hover:bg-[#1a1a1a] text-[#444] hover:text-[#888] transition"><Edit2  size={14} /></button>
                        <button onClick={() => setDeleteId(c.id)} className="p-1.5 rounded-lg hover:bg-red-500/10 text-[#444] hover:text-red-400 transition"><Trash2 size={14} /></button>
                      </div>
                    )}
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        )}
      </div>

      {modal !== null && (
        <ChatterModal
          initial={modal === 'new' ? undefined : modal}
          onSave={handleSave}
          onClose={() => setModal(null)}
        />
      )}
    </div>
  );
}
