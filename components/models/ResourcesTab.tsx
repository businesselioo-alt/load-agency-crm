'use client';

import { useEffect, useMemo, useState } from 'react';
import { ExternalLink, Plus, Trash2, Pencil, Check, X, EyeOff, Search } from 'lucide-react';
import { useAuth } from '@/contexts/AuthContext';
import {
  RESOURCE_CATEGORIES, Resource,
  createResource, deleteResource, groupByCategory, hostOf, loadResources, updateResource,
} from '@/lib/ressources';
import {
  Banner, EmptyState, GhostButton, GoldButton, TextArea, TextInput,
} from '@/components/compta/ui';

const emptyDraft = {
  title: '',
  url: '',
  description: '',
  category: 'Scripts',
  forModels: true,
};

/**
 * Ressources — la bibliothèque de liens de l'agence.
 *
 * Une seule liste partagée, enregistrée en base : ce que l'agence ajoute, les
 * créatrices le voient. Les liens propres à une modèle (son Drive) restent sur
 * sa fiche, ils n'ont rien à faire ici.
 */
export default function ResourcesTab() {
  const { user } = useAuth();
  const isModel = user?.role === 'model';
  const canEdit = user?.role === 'admin' || user?.role === 'manager';

  const [items, setItems] = useState<Resource[]>([]);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [creating, setCreating] = useState(false);
  const [draft, setDraft] = useState(emptyDraft);
  const [editingId, setEditingId] = useState<string | null>(null);
  const [editDraft, setEditDraft] = useState(emptyDraft);

  useEffect(() => {
    (async () => {
      setItems(await loadResources());
      setLoading(false);
    })();
  }, []);

  const visible = useMemo(() => {
    const q = query.trim().toLowerCase();
    return items
      .filter((r) => (isModel ? r.forModels : true))
      .filter(
        (r) =>
          !q ||
          r.title.toLowerCase().includes(q) ||
          r.description.toLowerCase().includes(q) ||
          r.category.toLowerCase().includes(q),
      );
  }, [items, isModel, query]);

  const groups = useMemo(() => groupByCategory(visible), [visible]);

  const submit = async () => {
    setBusy(true);
    setError(null);
    const res = await createResource({
      ...draft,
      sortOrder: items.length,
      createdBy: user?.name ?? '',
    });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setItems((prev) => [...prev, res.resource]);
    setDraft(emptyDraft);
    setCreating(false);
  };

  const saveEdit = async (r: Resource) => {
    setBusy(true);
    setError(null);
    const res = await updateResource(r.id, editDraft);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    setItems((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...editDraft } : x)));
    setEditingId(null);
  };

  const remove = async (r: Resource) => {
    setBusy(true);
    setError(null);
    const res = await deleteResource(r.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Suppression impossible.');
      return;
    }
    setItems((prev) => prev.filter((x) => x.id !== r.id));
  };

  if (loading) {
    return <div className="h-96 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] z-10" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une ressource"
            className="!pl-9"
          />
        </div>
        <div className="flex-1" />
        {canEdit && !creating && (
          <GoldButton onClick={() => setCreating(true)}>
            <Plus size={15} />
            Ajouter une ressource
          </GoldButton>
        )}
      </div>

      {creating && canEdit && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 space-y-4">
          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div className="md:col-span-2">
              <label className="block text-xs font-medium text-[#888] mb-1.5">Titre</label>
              <TextInput
                autoFocus
                value={draft.title}
                onChange={(e) => setDraft((d) => ({ ...d, title: e.target.value }))}
                placeholder="Aide pour scripts"
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">Catégorie</label>
              <TextInput
                list="resource-categories"
                value={draft.category}
                onChange={(e) => setDraft((d) => ({ ...d, category: e.target.value }))}
                placeholder="Scripts"
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#888] mb-1.5">Lien</label>
              <TextInput
                type="url"
                value={draft.url}
                onChange={(e) => setDraft((d) => ({ ...d, url: e.target.value }))}
                placeholder="https://..."
              />
            </div>
            <div className="md:col-span-3">
              <label className="block text-xs font-medium text-[#888] mb-1.5">
                Description (optionnelle)
              </label>
              <TextArea
                rows={2}
                value={draft.description}
                onChange={(e) => setDraft((d) => ({ ...d, description: e.target.value }))}
                placeholder="À quoi ça sert, quand s'en servir."
              />
            </div>
          </div>

          <label className="flex items-center gap-3 px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl cursor-pointer w-fit">
            <input
              type="checkbox"
              checked={draft.forModels}
              onChange={(e) => setDraft((d) => ({ ...d, forModels: e.target.checked }))}
              className="w-4 h-4 accent-[#C9A84C]"
            />
            <span className="text-sm text-white">Visible par les créatrices</span>
          </label>

          <div className="flex justify-end gap-2">
            <GhostButton
              onClick={() => {
                setDraft(emptyDraft);
                setCreating(false);
              }}
            >
              Annuler
            </GhostButton>
            <GoldButton onClick={submit} disabled={busy}>
              {busy ? 'Enregistrement...' : 'Enregistrer'}
            </GoldButton>
          </div>
        </div>
      )}

      <datalist id="resource-categories">
        {RESOURCE_CATEGORIES.map((c) => (
          <option key={c} value={c} />
        ))}
      </datalist>

      {error && <Banner kind="error" message={error} />}

      {groups.length === 0 ? (
        <EmptyState
          title="Aucune ressource"
          subtitle={
            canEdit
              ? 'Ajoute les guides, modèles de scripts et process que ton équipe consulte.'
              : "L'agence n'a pas encore partagé de ressource."
          }
        />
      ) : (
        <div className="space-y-6">
          {groups.map(({ category, items: list }) => (
            <div key={category}>
              <h3 className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-3">
                {category}
              </h3>
              <div className="grid grid-cols-1 md:grid-cols-2 gap-3">
                {list.map((r) =>
                  editingId === r.id ? (
                    <div
                      key={r.id}
                      className="bg-[#111] border border-[#C9A84C]/30 rounded-2xl p-4 space-y-3"
                    >
                      <TextInput
                        value={editDraft.title}
                        onChange={(e) => setEditDraft((d) => ({ ...d, title: e.target.value }))}
                        placeholder="Titre"
                      />
                      <TextInput
                        value={editDraft.url}
                        onChange={(e) => setEditDraft((d) => ({ ...d, url: e.target.value }))}
                        placeholder="https://..."
                      />
                      <TextInput
                        list="resource-categories"
                        value={editDraft.category}
                        onChange={(e) => setEditDraft((d) => ({ ...d, category: e.target.value }))}
                        placeholder="Catégorie"
                      />
                      <TextArea
                        rows={2}
                        value={editDraft.description}
                        onChange={(e) =>
                          setEditDraft((d) => ({ ...d, description: e.target.value }))
                        }
                        placeholder="Description"
                      />
                      <label className="flex items-center gap-2.5 text-xs text-[#888] cursor-pointer">
                        <input
                          type="checkbox"
                          checked={editDraft.forModels}
                          onChange={(e) =>
                            setEditDraft((d) => ({ ...d, forModels: e.target.checked }))
                          }
                          className="w-4 h-4 accent-[#C9A84C]"
                        />
                        Visible par les créatrices
                      </label>
                      <div className="flex justify-end gap-1">
                        <button
                          onClick={() => saveEdit(r)}
                          disabled={busy}
                          className="p-2 text-[#555] hover:text-emerald-400 transition disabled:opacity-30"
                          title="Enregistrer"
                        >
                          <Check size={15} />
                        </button>
                        <button
                          onClick={() => setEditingId(null)}
                          className="p-2 text-[#555] hover:text-white transition"
                          title="Annuler"
                        >
                          <X size={15} />
                        </button>
                      </div>
                    </div>
                  ) : (
                    <div
                      key={r.id}
                      className="group bg-[#111] border border-[#1f1f1f] rounded-2xl p-4 hover:border-[#2a2a2a] transition"
                    >
                      <div className="flex items-start gap-3">
                        <div className="flex-1 min-w-0">
                          <div className="flex items-center gap-2 flex-wrap">
                            <a
                              href={r.url}
                              target="_blank"
                              rel="noopener noreferrer"
                              className="inline-flex items-center gap-1.5 text-sm font-medium text-white hover:text-[#C9A84C] transition"
                            >
                              {r.title}
                              <ExternalLink size={12} className="opacity-50" />
                            </a>
                            {!r.forModels && (
                              <span
                                title="Non visible par les créatrices"
                                className="inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-[#1a1a1a] text-[#666] border border-[#242424]"
                              >
                                <EyeOff size={9} />
                                AGENCE
                              </span>
                            )}
                          </div>
                          {r.description && (
                            <p className="text-[12px] text-[#888] mt-1 leading-relaxed">
                              {r.description}
                            </p>
                          )}
                          <p className="text-[10px] text-[#444] mt-1.5">{hostOf(r.url)}</p>
                        </div>

                        {canEdit && (
                          <div className="flex gap-0.5 opacity-0 group-hover:opacity-100 transition flex-shrink-0">
                            <button
                              onClick={() => {
                                setEditingId(r.id);
                                setEditDraft({
                                  title: r.title,
                                  url: r.url,
                                  description: r.description,
                                  category: r.category,
                                  forModels: r.forModels,
                                });
                              }}
                              className="p-1.5 text-[#555] hover:text-[#C9A84C] transition"
                              title="Modifier"
                            >
                              <Pencil size={13} />
                            </button>
                            <button
                              onClick={() => remove(r)}
                              disabled={busy}
                              className="p-1.5 text-[#444] hover:text-red-400 transition disabled:opacity-30"
                              title="Supprimer"
                            >
                              <Trash2 size={13} />
                            </button>
                          </div>
                        )}
                      </div>
                    </div>
                  ),
                )}
              </div>
            </div>
          ))}
        </div>
      )}

      {canEdit && (
        <p className="text-[11px] text-[#444] leading-relaxed">
          Ces liens sont partagés avec toute l&apos;agence. Décoche « visible par les créatrices »
          pour un document interne. Le Drive d&apos;une modèle ne se met pas ici — il vit sur sa
          carte dans Suivi Contenu.
        </p>
      )}
    </div>
  );
}
