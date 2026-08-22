'use client';

import { useEffect, useMemo, useState } from 'react';
import { Bell } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  currentPeriod, findModelForUser, loadAllBilling, periodOptionLabel,
  recentPeriods, safeLoadModels,
} from '@/lib/compta';
import {
  ContentCategory, ContentEntry, ContentRequest, ModelFolder,
  CUSTOM_KEY, addEntry, deleteEntry, entryTitle, foldersFor,
  loadEntries, loadFolders, loadRequests, markSeen, saveDriveLink,
} from '@/lib/contenu';
import { Banner, EmptyState } from '@/components/compta/ui';
import ContentCard from './ContentCard';
import ModelRequests from './ModelRequests';

/**
 * Suivi Contenu.
 *
 * Vue agence : toutes les créatrices, avec les nouveautés mises en évidence.
 * Vue créatrice : sa seule carte, sans la notion de « vu ».
 */
export default function SuiviContenTab() {
  const { user } = useAuth();
  const isModel = user?.role === 'model';

  const [models, setModels] = useState<Model[]>([]);
  const [me, setMe] = useState<Model | null>(null);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [folders, setFolders] = useState<ModelFolder[]>([]);
  const [month, setMonth] = useState(currentPeriod());
  const [selectedId, setSelectedId] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, billing, e, r, f] = await Promise.all([
        safeLoadModels(),
        loadAllBilling(),
        loadEntries(),
        loadRequests(),
        loadFolders(),
      ]);
      setModels(m);
      setMe(findModelForUser(m, billing, user));
      setEntries(e);
      setRequests(r);
      setFolders(f);
      setSelectedId((prev) => prev || m[0]?.id || '');
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.name]);

  const periods = useMemo(() => recentPeriods(12, new Date()), []);

  /**
   * Une seule créatrice à l'écran.
   *
   * Empiler toutes les cartes obligeait à scroller pour atteindre la dixième —
   * et chaque carte fait huit lignes. Le sélecteur remplace le défilement, et
   * les pastilles signalent qui a du nouveau sans qu'on ait à ouvrir sa carte.
   */
  const selected = useMemo(
    () => (isModel ? me : models.find((m) => m.id === selectedId) ?? models[0] ?? null),
    [isModel, me, models, selectedId],
  );

  const unseen = useMemo(
    () => (isModel ? [] : entries.filter((e) => !e.seen && e.addedAt.slice(0, 7) === month)),
    [entries, isModel, month],
  );

  /** Nombre de nouveautés par créatrice, pour les pastilles du sélecteur. */
  const unseenByModel = useMemo(() => {
    const out: Record<string, number> = {};
    unseen.forEach((e) => {
      out[e.modelId] = (out[e.modelId] ?? 0) + 1;
    });
    return out;
  }, [unseen]);

  const selectedFolders = useMemo(
    () => (selected ? foldersFor(selected.id, folders, entries) : []),
    [selected, folders, entries],
  );

  const add = async (
    model: Model,
    category: ContentCategory,
    count: number,
    requestId?: string,
    label?: string,
  ) => {
    setBusy(true);
    setError(null);
    const created: ContentEntry[] = [];
    for (let n = 0; n < count; n += 1) {
      // Séquentiel et non parallèle : chaque insertion lit le dernier numéro
      // attribué, deux insertions simultanées prendraient le même.
      const res = await addEntry({
        modelId: model.id,
        category,
        addedBy: user?.name ?? '',
        requestId,
        label,
      });
      if (!res.ok) {
        setError(res.error);
        break;
      }
      created.push(res.entry);
    }
    if (created.length > 0) setEntries((prev) => [...created, ...prev]);
    setBusy(false);
  };

  const remove = async (entry: ContentEntry) => {
    setBusy(true);
    setError(null);
    const res = await deleteEntry(entry.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Suppression impossible.');
      return;
    }
    setEntries((prev) => prev.filter((e) => e.id !== entry.id));
  };

  const see = async (ids: string[]) => {
    setBusy(true);
    setError(null);
    const res = await markSeen(ids);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Mise à jour impossible.');
      return;
    }
    const set = new Set(ids);
    setEntries((prev) => prev.map((e) => (set.has(e.id) ? { ...e, seen: true } : e)));
  };

  const drive = async (model: Model, url: string) => {
    setBusy(true);
    setError(null);
    const res = await saveDriveLink(model, url);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Enregistrement impossible.');
      return;
    }
    const next = url.trim() || undefined;
    setModels((prev) => prev.map((m) => (m.id === model.id ? { ...m, driveLink: next } : m)));
    setMe((prev) => (prev && prev.id === model.id ? { ...prev, driveLink: next } : prev));
  };

  if (loading) {
    return <div className="h-96 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  const recent = unseen.slice(0, 6);

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={month}
          onChange={(e) => setMonth(e.target.value)}
          className="px-3 py-2.5 bg-[#111] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
        >
          {periods.map((p) => (
            <option key={p} value={p}>
              {periodOptionLabel(p)}
            </option>
          ))}
        </select>

      </div>

      {!isModel && models.length > 0 && (
        <div className="flex flex-wrap gap-2">
          {models.map((m) => {
            const on = selected?.id === m.id;
            const n = unseenByModel[m.id] ?? 0;
            return (
              <button
                key={m.id}
                onClick={() => setSelectedId(m.id)}
                className={`inline-flex items-center gap-2 px-3.5 py-2 rounded-xl text-sm border transition ${
                  on
                    ? 'bg-[#C9A84C] border-[#C9A84C] text-black font-medium'
                    : 'bg-[#111] border-[#222] text-[#777] hover:text-white hover:border-[#333]'
                }`}
              >
                {m.name}
                {n > 0 && (
                  <span
                    className={`px-1.5 py-0.5 rounded-md text-[10px] font-semibold ${
                      on ? 'bg-black/20 text-black' : 'bg-[#C9A84C]/20 text-[#C9A84C]'
                    }`}
                  >
                    {n}
                  </span>
                )}
              </button>
            );
          })}
        </div>
      )}

      {!isModel && unseen.length > 0 && (
        <div className="flex gap-2 px-4 py-3 rounded-xl border border-[#C9A84C]/25 bg-[#C9A84C]/10 text-sm text-[#C9A84C]">
          <Bell size={16} className="flex-shrink-0 mt-0.5" />
          <div>
            <p className="font-medium">
              {unseen.length} nouveau{unseen.length > 1 ? 'x' : ''} dépôt
              {unseen.length > 1 ? 's' : ''} à vérifier sur le Drive
            </p>
            <p className="text-[11px] text-[#C9A84C]/70 mt-0.5">
              {recent
                .map(
                  (e) =>
                    `${models.find((m) => m.id === e.modelId)?.name ?? '?'} · ${entryTitle(
                      e,
                      foldersFor(e.modelId, folders, entries),
                    )}`,
                )
                .join(' — ')}
              {unseen.length > recent.length ? ' …' : ''}
            </p>
          </div>
        </div>
      )}

      {error && <Banner kind="error" message={error} />}

      {isModel && me && (
        <ModelRequests
          requests={requests.filter((r) => r.modelId === me.id)}
          entries={entries.filter((e) => e.modelId === me.id)}
          folders={selectedFolders}
          busy={busy}
          onDeliver={(r, count) =>
            add(me, r.customLabel ? CUSTOM_KEY : r.category, count, r.id, r.customLabel)
          }
        />
      )}

      {!selected ? (
        <EmptyState
          title={isModel ? 'Aucune fiche associée à ton compte' : 'Aucune créatrice'}
          subtitle={
            isModel
              ? "Ton email ne correspond à aucune fiche modèle. Demande à l'agence de le renseigner dans Compta → Fiches modèles."
              : undefined
          }
        />
      ) : (
        <ContentCard
          key={selected.id}
          model={selected}
          entries={entries.filter((e) => e.modelId === selected.id)}
          folders={selectedFolders}
          month={month}
          mode={isModel ? 'modele' : 'agence'}
          busy={busy}
          onAdd={(category, count) => add(selected, category, count)}
          onDelete={remove}
          onMarkSeen={see}
          onSaveDrive={(url) => drive(selected, url)}
        />
      )}

      <p className="text-[11px] text-[#444] leading-relaxed">
        Les catégories sont les dossiers réels du Drive de la créatrice, remontés par la
        synchronisation — renomme ou ajoute un dossier sur le Drive, il apparaît ici au passage
        suivant. Le fichier reste sur le Drive. Ici on note seulement qu&apos;il a été déposé : la créatrice
        clique sur « Ajouter » dans la bonne catégorie, le CRM attribue le numéro suivant, et
        l&apos;agence voit la nouveauté en doré tant qu&apos;elle ne l&apos;a pas marquée comme vue.
      </p>
    </div>
  );
}
