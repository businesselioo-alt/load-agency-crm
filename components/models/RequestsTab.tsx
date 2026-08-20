'use client';

import { useEffect, useMemo, useState } from 'react';
import { Plus, Trash2, X, Check, AlertTriangle, Send } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import { safeLoadModels } from '@/lib/compta';
import {
  CATEGORIES, CATEGORY_BY_KEY, ContentCategory, ContentEntry, ContentRequest,
  EffectiveStatus, REQUEST_STATUS_LABELS, REQUEST_STATUS_STYLES, RequestPriority,
  createRequests, deleteRequest, formatDay, loadEntries, loadRequests, progressOf, updateRequest,
} from '@/lib/contenu';
import { Banner, EmptyState, GoldButton, GhostButton, NumberInput, TextArea, TextInput } from '@/components/compta/ui';

type Filter = 'actives' | 'en_retard' | 'livrees' | 'toutes';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'actives', label: 'En cours' },
  { id: 'en_retard', label: 'En retard' },
  { id: 'livrees', label: 'Livrées' },
  { id: 'toutes', label: 'Toutes' },
];

const emptyForm = {
  modelIds: [] as string[],
  category: 'scripts' as ContentCategory,
  quantity: 1,
  brief: '',
  dueAt: '',
  priority: 'normale' as RequestPriority,
};

/**
 * Demandes de contenu — vue agence.
 *
 * Une demande est adressée à une ou plusieurs créatrices. Sa progression n'est
 * pas saisie à la main : elle avance quand la créatrice enregistre un dépôt
 * rattaché à cette demande depuis « Mon contenu ».
 */
export default function RequestsTab() {
  const { user } = useAuth();

  const [models, setModels] = useState<Model[]>([]);
  const [requests, setRequests] = useState<ContentRequest[]>([]);
  const [entries, setEntries] = useState<ContentEntry[]>([]);
  const [filter, setFilter] = useState<Filter>('actives');
  const [form, setForm] = useState(emptyForm);
  const [creating, setCreating] = useState(false);
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, r, e] = await Promise.all([safeLoadModels(), loadRequests(), loadEntries()]);
      setModels(m);
      setRequests(r);
      setEntries(e);
      setLoading(false);
    })();
  }, []);

  const nameOf = (id: string) => models.find((m) => m.id === id)?.name ?? id;

  const rows = useMemo(
    () =>
      requests
        .map((r) => progressOf(r, entries))
        .filter((p) => {
          if (filter === 'toutes') return true;
          if (filter === 'livrees') return p.effective === 'livree';
          if (filter === 'en_retard') return p.effective === 'en_retard';
          return p.effective === 'ouverte' || p.effective === 'en_retard';
        }),
    [requests, entries, filter],
  );

  const counts = useMemo(() => {
    const all = requests.map((r) => progressOf(r, entries));
    return {
      actives: all.filter((p) => p.effective === 'ouverte' || p.effective === 'en_retard').length,
      en_retard: all.filter((p) => p.effective === 'en_retard').length,
      livrees: all.filter((p) => p.effective === 'livree').length,
      toutes: all.length,
    } as Record<Filter, number>;
  }, [requests, entries]);

  const toggleModel = (id: string) =>
    setForm((f) => ({
      ...f,
      modelIds: f.modelIds.includes(id)
        ? f.modelIds.filter((x) => x !== id)
        : [...f.modelIds, id],
    }));

  const submit = async () => {
    setBusy(true);
    setError(null);
    setFeedback(null);
    const res = await createRequests({ ...form, createdBy: user?.name ?? '' });
    setBusy(false);
    if (!res.ok) {
      setError(res.error);
      return;
    }
    setRequests((prev) => [...res.requests, ...prev]);
    setForm(emptyForm);
    setCreating(false);
    setFeedback(
      res.requests.length > 1
        ? `${res.requests.length} demandes envoyées.`
        : 'Demande envoyée.',
    );
  };

  const patch = async (r: ContentRequest, p: Partial<ContentRequest>) => {
    setBusy(true);
    setError(null);
    const res = await updateRequest(r.id, p);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Mise à jour impossible.');
      return;
    }
    setRequests((prev) => prev.map((x) => (x.id === r.id ? { ...x, ...p } : x)));
  };

  const remove = async (r: ContentRequest) => {
    setBusy(true);
    setError(null);
    const res = await deleteRequest(r.id);
    setBusy(false);
    if (!res.ok) {
      setError(res.error ?? 'Suppression impossible.');
      return;
    }
    setRequests((prev) => prev.filter((x) => x.id !== r.id));
  };

  if (loading) {
    return <div className="h-96 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-2">
        <div className="flex gap-1 bg-[#111] rounded-xl p-1 border border-[#222] flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.id
                  ? 'bg-[#C9A84C] text-black'
                  : 'text-[#555] hover:text-[#999] hover:bg-[#1a1a1a]'
              }`}
            >
              {f.label}
              <span className="ml-1.5 opacity-60">{counts[f.id]}</span>
            </button>
          ))}
        </div>
        <div className="flex-1" />
        {!creating && (
          <GoldButton onClick={() => setCreating(true)}>
            <Plus size={15} />
            Nouvelle demande
          </GoldButton>
        )}
      </div>

      {creating && (
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-5 space-y-4">
          <div>
            <p className="text-xs font-semibold text-[#666] uppercase tracking-wider mb-2">
              Créatrices ({form.modelIds.length} sélectionnée
              {form.modelIds.length > 1 ? 's' : ''})
            </p>
            <div className="flex flex-wrap gap-2">
              {models.map((m) => {
                const on = form.modelIds.includes(m.id);
                return (
                  <button
                    key={m.id}
                    type="button"
                    onClick={() => toggleModel(m.id)}
                    className={`px-3 py-2 rounded-xl text-xs border transition ${
                      on
                        ? 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C] font-medium'
                        : 'bg-[#0f0f0f] border-[#222] text-[#666] hover:text-[#999]'
                    }`}
                  >
                    {m.name}
                  </button>
                );
              })}
            </div>
            {models.length > 1 && (
              <button
                type="button"
                onClick={() =>
                  setForm((f) => ({
                    ...f,
                    modelIds: f.modelIds.length === models.length ? [] : models.map((m) => m.id),
                  }))
                }
                className="mt-2 text-[11px] text-[#555] hover:text-[#999] transition"
              >
                {form.modelIds.length === models.length
                  ? 'Tout désélectionner'
                  : 'Sélectionner toutes les créatrices'}
              </button>
            )}
          </div>

          <div className="grid grid-cols-1 md:grid-cols-4 gap-4">
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">Catégorie</label>
              <select
                value={form.category}
                onChange={(e) =>
                  setForm((f) => ({ ...f, category: e.target.value as ContentCategory }))
                }
                className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
              >
                {CATEGORIES.map((c) => (
                  <option key={c.key} value={c.key}>
                    {c.label}
                  </option>
                ))}
              </select>
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">Quantité</label>
              <NumberInput
                min={1}
                max={500}
                value={form.quantity}
                onValueChange={(n) => setForm((f) => ({ ...f, quantity: n }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">Échéance</label>
              <TextInput
                type="date"
                value={form.dueAt}
                onChange={(e) => setForm((f) => ({ ...f, dueAt: e.target.value }))}
              />
            </div>
            <div>
              <label className="block text-xs font-medium text-[#888] mb-1.5">Priorité</label>
              <select
                value={form.priority}
                onChange={(e) =>
                  setForm((f) => ({ ...f, priority: e.target.value as RequestPriority }))
                }
                className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
              >
                <option value="normale">Normale</option>
                <option value="urgente">Urgente</option>
              </select>
            </div>
          </div>

          <div>
            <label className="block text-xs font-medium text-[#888] mb-1.5">
              Brief — ce que tu attends précisément
            </label>
            <TextArea
              rows={3}
              value={form.brief}
              onChange={(e) => setForm((f) => ({ ...f, brief: e.target.value }))}
              placeholder="Ex : 5 vidéos verticales, lingerie noire, éclairage naturel, 30 s minimum."
            />
          </div>

          <div className="flex justify-end gap-2">
            <GhostButton
              onClick={() => {
                setForm(emptyForm);
                setCreating(false);
              }}
            >
              Annuler
            </GhostButton>
            <GoldButton onClick={submit} disabled={busy || form.modelIds.length === 0}>
              <Send size={15} />
              {busy ? 'Envoi...' : `Envoyer${form.modelIds.length > 1 ? ` à ${form.modelIds.length}` : ''}`}
            </GoldButton>
          </div>
        </div>
      )}

      {error && <Banner kind="error" message={error} />}
      {feedback && <Banner kind="ok" message={feedback} />}

      {rows.length === 0 ? (
        <EmptyState
          title="Aucune demande"
          subtitle="Crée une demande pour dire à une créatrice ce que tu attends ce mois-ci."
        />
      ) : (
        <div className="space-y-2">
          {rows.map((p) => (
            <RequestRow
              key={p.request.id}
              progress={p}
              modelName={nameOf(p.request.modelId)}
              busy={busy}
              onClose={() => patch(p.request, { status: 'close' })}
              onReopen={() => patch(p.request, { status: 'ouverte' })}
              onCancel={() => patch(p.request, { status: 'annulee' })}
              onDelete={() => remove(p.request)}
            />
          ))}
        </div>
      )}
    </div>
  );
}

function RequestRow({
  progress,
  modelName,
  busy,
  onClose,
  onReopen,
  onCancel,
  onDelete,
}: {
  progress: ReturnType<typeof progressOf>;
  modelName: string;
  busy: boolean;
  onClose: () => void;
  onReopen: () => void;
  onCancel: () => void;
  onDelete: () => void;
}) {
  const { request: r, delivered, percent, effective, daysLeft } = progress;
  const st = REQUEST_STATUS_STYLES[effective as EffectiveStatus];
  const cat = CATEGORY_BY_KEY[r.category];
  const [open, setOpen] = useState(false);

  return (
    <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl px-5 py-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="w-40 flex-shrink-0">
          <p className="text-sm text-white truncate">{modelName}</p>
          <p className="text-[10px] text-[#555]">{cat?.label ?? r.category}</p>
        </div>

        <div className="w-48 flex-shrink-0">
          <div className="flex items-baseline gap-1.5 mb-1">
            <span className="text-sm font-semibold text-[#C9A84C]">{delivered}</span>
            <span className="text-xs text-[#555]">/ {r.quantity}</span>
            {r.priority === 'urgente' && (
              <span className="ml-1 px-1.5 py-0.5 rounded text-[9px] font-semibold bg-red-500/15 text-red-300 border border-red-500/25">
                URGENT
              </span>
            )}
          </div>
          <div className="h-1.5 bg-[#1a1a1a] rounded-full overflow-hidden">
            <div
              className="h-full rounded-full transition-all"
              style={{ width: `${percent}%`, backgroundColor: st.text }}
            />
          </div>
        </div>

        <div className="w-32 flex-shrink-0 text-[11px]">
          {r.dueAt ? (
            <>
              <p className="text-[#888]">{formatDay(r.dueAt)}</p>
              <p className="text-[10px] text-[#555]">
                {daysLeft === null
                  ? ''
                  : daysLeft < 0
                    ? `${-daysLeft} j de retard`
                    : daysLeft === 0
                      ? "aujourd'hui"
                      : `dans ${daysLeft} j`}
              </p>
            </>
          ) : (
            <span className="text-[#444]">pas d&apos;échéance</span>
          )}
        </div>

        <span
          className="px-2 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap"
          style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
        >
          {REQUEST_STATUS_LABELS[effective as EffectiveStatus]}
        </span>

        <div className="flex-1" />

        <div className="flex items-center gap-1">
          {r.brief && (
            <button
              onClick={() => setOpen((o) => !o)}
              className="px-2.5 py-1 rounded-lg text-[11px] text-[#666] border border-[#222] hover:text-white transition"
            >
              {open ? 'Masquer le brief' : 'Brief'}
            </button>
          )}
          {r.status === 'ouverte' && effective !== 'livree' && (
            <>
              <button
                onClick={onClose}
                disabled={busy}
                title="Clôturer sans attendre le reste"
                className="p-2 text-[#555] hover:text-emerald-400 transition disabled:opacity-30"
              >
                <Check size={15} />
              </button>
              <button
                onClick={onCancel}
                disabled={busy}
                title="Annuler la demande"
                className="p-2 text-[#555] hover:text-amber-400 transition disabled:opacity-30"
              >
                <X size={15} />
              </button>
            </>
          )}
          {(r.status === 'close' || r.status === 'annulee') && (
            <button
              onClick={onReopen}
              disabled={busy}
              title="Rouvrir"
              className="px-2.5 py-1 rounded-lg text-[11px] text-[#666] border border-[#222] hover:text-white transition disabled:opacity-30"
            >
              Rouvrir
            </button>
          )}
          <button
            onClick={onDelete}
            disabled={busy}
            title="Supprimer définitivement"
            className="p-2 text-[#444] hover:text-red-400 transition disabled:opacity-30"
          >
            <Trash2 size={14} />
          </button>
        </div>
      </div>

      {open && r.brief && (
        <p className="mt-3 px-3 py-2.5 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f] text-[12px] text-[#999] whitespace-pre-wrap leading-relaxed">
          {r.brief}
        </p>
      )}

      {effective === 'en_retard' && (
        <p className="mt-2 flex items-center gap-1.5 text-[11px] text-red-300/80">
          <AlertTriangle size={12} />
          Échéance dépassée, il manque {r.quantity - delivered} {cat?.unit ?? 'contenu'}
          {r.quantity - delivered > 1 ? 's' : ''}.
        </p>
      )}
    </div>
  );
}
