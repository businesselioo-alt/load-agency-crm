'use client';

import { useEffect, useMemo, useState } from 'react';
import { Search, Bell } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  currentPeriod, findModelForUser, loadAllBilling, periodOptionLabel,
  recentPeriods, safeLoadModels,
} from '@/lib/compta';
import {
  ContentCategory, ContentEntry, ContentRequest,
  addEntry, deleteEntry, entryTitle, loadEntries, loadRequests, markSeen, saveDriveLink,
} from '@/lib/contenu';
import { Banner, EmptyState, TextInput } from '@/components/compta/ui';
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
  const [month, setMonth] = useState(currentPeriod());
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, billing, e, r] = await Promise.all([
        safeLoadModels(),
        loadAllBilling(),
        loadEntries(),
        loadRequests(),
      ]);
      setModels(m);
      setMe(findModelForUser(m, billing, user));
      setEntries(e);
      setRequests(r);
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [user?.email, user?.name]);

  const periods = useMemo(() => recentPeriods(12, new Date()), []);

  const visibleModels = useMemo(() => {
    if (isModel) return me ? [me] : [];
    const q = query.trim().toLowerCase();
    return models.filter(
      (m) => !q || m.name.toLowerCase().includes(q) || (m.pseudo ?? '').toLowerCase().includes(q),
    );
  }, [isModel, me, models, query]);

  const unseen = useMemo(
    () => (isModel ? [] : entries.filter((e) => !e.seen && e.addedAt.slice(0, 7) === month)),
    [entries, isModel, month],
  );

  const add = async (
    model: Model,
    category: ContentCategory,
    count: number,
    requestId?: string,
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

        {!isModel && (
          <div className="relative flex-1 min-w-48 max-w-xs">
            <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] z-10" />
            <TextInput
              value={query}
              onChange={(e) => setQuery(e.target.value)}
              placeholder="Rechercher une créatrice"
              className="!pl-9"
            />
          </div>
        )}
      </div>

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
                .map((e) => `${models.find((m) => m.id === e.modelId)?.name ?? '?'} · ${entryTitle(e)}`)
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
          busy={busy}
          onDeliver={(r, count) => add(me, r.category, count, r.id)}
        />
      )}

      {visibleModels.length === 0 ? (
        <EmptyState
          title={isModel ? 'Aucune fiche associée à ton compte' : 'Aucune créatrice'}
          subtitle={
            isModel
              ? "Ton email ne correspond à aucune fiche modèle. Demande à l'agence de le renseigner dans Compta → Fiches modèles."
              : undefined
          }
        />
      ) : (
        <div className="space-y-4">
          {visibleModels.map((m) => (
            <ContentCard
              key={m.id}
              model={m}
              entries={entries.filter((e) => e.modelId === m.id)}
              month={month}
              mode={isModel ? 'modele' : 'agence'}
              busy={busy}
              onAdd={(category, count) => add(m, category, count)}
              onDelete={remove}
              onMarkSeen={see}
              onSaveDrive={(url) => drive(m, url)}
            />
          ))}
        </div>
      )}

      <p className="text-[11px] text-[#444] leading-relaxed">
        Le fichier reste sur le Drive. Ici on note seulement qu&apos;il a été déposé : la créatrice
        clique sur « Ajouter » dans la bonne catégorie, le CRM attribue le numéro suivant, et
        l&apos;agence voit la nouveauté en doré tant qu&apos;elle ne l&apos;a pas marquée comme vue.
      </p>
    </div>
  );
}
