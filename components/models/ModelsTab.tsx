'use client';

import { useEffect, useState } from 'react';
import {
  Plus, ChevronDown, ChevronRight, Save, Trash2, AlertTriangle, ExternalLink, Search,
} from 'lucide-react';
import { MODELS, Model, ModelStatus, Platform } from '@/lib/data';
import {
  COMPANY_TYPES, CURRENCIES, Currency, ModelBilling, PLATFORMS,
  emptyBilling, loadAllBilling, missingFields, rateFor, saveBilling,
} from '@/lib/compta';
import {
  MODEL_STATUS_LABELS, MODEL_STATUS_STYLES,
  deleteModel, emptyModel, loadModelSource, managersOf, saveModel, seedModels,
} from '@/lib/modeles';
import {
  Banner, EmptyState, GhostButton, GoldButton, NumberInput, SectionTitle, TextArea, TextInput,
} from '@/components/compta/ui';

const STATUSES: ModelStatus[] = ['active', 'inactive', 'suspended'];

/**
 * Modèles — la fiche complète d'une créatrice, en un seul endroit.
 *
 * Elle réunit ce qui était éclaté entre Management et Compta Modèle : identité,
 * plateformes, taux, coordonnées de facturation. Le stockage n'a pas bougé —
 * l'état civil et la facturation restent dans `crm_model_billing`, le reste
 * dans `crm_models` — donc la comptabilité lit exactement les mêmes données
 * qu'avant. Seul l'écran de saisie a été regroupé.
 */
export default function ModelsTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [fromDatabase, setFromDatabase] = useState(true);
  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<Model | null>(null);
  const [bDraft, setBDraft] = useState<ModelBilling | null>(null);
  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<string | null>(null);
  const [confirmDelete, setConfirmDelete] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [{ models: m, fromDatabase: db }, b] = await Promise.all([
        loadModelSource(),
        loadAllBilling(),
      ]);
      setModels(m);
      setBilling(b);
      setFromDatabase(db);
      setLoading(false);
    })();
  }, []);

  const open = (m: Model) => {
    setOpenId(m.id);
    setDraft({ ...m });
    setBDraft(billing[m.id] ?? emptyBilling(m.id, m.name));
    setError(null);
    setFeedback(null);
  };

  const startNew = () => {
    const m = emptyModel(models);
    setModels((prev) => [...prev, m]);
    open(m);
  };

  const patch = (p: Partial<Model>) => setDraft((d) => (d ? { ...d, ...p } : d));
  const patchB = (p: Partial<ModelBilling>) => setBDraft((d) => (d ? { ...d, ...p } : d));

  const togglePlatform = (p: Platform) =>
    setDraft((d) =>
      d
        ? {
            ...d,
            platforms: d.platforms.includes(p)
              ? d.platforms.filter((x) => x !== p)
              : [...d.platforms, p],
          }
        : d,
    );

  const setRate = (p: Platform, n: number) =>
    setBDraft((d) => (d ? { ...d, commissionRates: { ...d.commissionRates, [p]: n } } : d));

  const setUsername = (p: Platform, v: string) =>
    setBDraft((d) => (d ? { ...d, usernames: { ...d.usernames, [p]: v } } : d));

  /**
   * Avant la première écriture, on recopie la liste du code dans la base.
   * Sans ça, enregistrer une créatrice ferait disparaître toutes les autres :
   * la table cesserait d'être vide, et l'app n'utiliserait plus la liste de
   * secours.
   */
  const ensureSeeded = async (): Promise<boolean> => {
    if (fromDatabase) return true;
    const res = await seedModels(models.filter((m) => m.name.trim()));
    if (!res.ok) {
      setError(res.error ?? 'Import impossible.');
      return false;
    }
    setFromDatabase(true);
    return true;
  };

  const submit = async () => {
    if (!draft || !bDraft) return;
    setBusy(true);
    setError(null);
    setFeedback(null);

    if (!(await ensureSeeded())) {
      setBusy(false);
      return;
    }

    // Le nom affiché partout se compose du prénom et du nom de la fiche : une
    // seule saisie, pas deux champs à tenir synchronisés.
    const fullName = `${bDraft.firstName} ${bDraft.lastName}`.trim() || draft.name.trim();
    const nextModel: Model = { ...draft, name: fullName };

    // crm_models.commission reste le taux de repli : on y met celui de la
    // première plateforme, comme le fait déjà le module Compta.
    const first = nextModel.platforms[0];
    if (first) {
      nextModel.commission = rateFor(bDraft, first, draft.commission);
    }

    const index = models.findIndex((m) => m.id === draft.id);
    const res = await saveModel(nextModel, index < 0 ? models.length : index);
    if (!res.ok) {
      setBusy(false);
      setError(res.error ?? "Échec de l'enregistrement de la fiche.");
      return;
    }

    const resB = await saveBilling(bDraft);
    setBusy(false);
    if (!resB.ok) {
      setError(
        `Fiche enregistrée, mais les informations de facturation ont échoué : ${
          resB.error ?? 'erreur inconnue'
        }`,
      );
      return;
    }

    setModels((prev) => prev.map((m) => (m.id === nextModel.id ? nextModel : m)));
    setBilling((prev) => ({ ...prev, [bDraft.modelId]: bDraft }));
    setOpenId(null);
    setDraft(null);
    setBDraft(null);
    setFeedback('Fiche enregistrée.');
  };

  const remove = async (m: Model) => {
    setBusy(true);
    setError(null);
    const res = await deleteModel(m.id);
    setBusy(false);
    setConfirmDelete(null);
    if (!res.ok) {
      setError(res.error ?? 'Suppression impossible.');
      return;
    }
    setModels((prev) => prev.filter((x) => x.id !== m.id));
    if (openId === m.id) {
      setOpenId(null);
      setDraft(null);
      setBDraft(null);
    }
    setFeedback(`${m.name} retirée du CRM.`);
  };

  const cancel = () => {
    setModels((prev) => prev.filter((m) => m.name.trim() || m.id !== openId));
    setOpenId(null);
    setDraft(null);
    setBDraft(null);
  };

  if (loading) {
    return <div className="h-96 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  const q = query.trim().toLowerCase();
  const visible = models.filter(
    (m) =>
      !q ||
      m.name.toLowerCase().includes(q) ||
      m.pseudo.toLowerCase().includes(q) ||
      m.manager.toLowerCase().includes(q),
  );

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center gap-3">
        <div className="relative flex-1 min-w-48 max-w-sm">
          <Search size={14} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444] z-10" />
          <TextInput
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une créatrice"
            className="!pl-9"
          />
        </div>
        <div className="flex-1" />
        <GoldButton onClick={startNew} disabled={busy}>
          <Plus size={15} />
          Ajouter une créatrice
        </GoldButton>
      </div>

      {!fromDatabase && (
        <div className="flex gap-2 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>
            Cette liste vient encore du code, la table est vide. Le premier enregistrement y
            recopiera automatiquement les {models.length} créatrices affichées.
          </span>
        </div>
      )}

      {error && <Banner kind="error" message={error} />}
      {feedback && <Banner kind="ok" message={feedback} />}

      {visible.length === 0 ? (
        <EmptyState title="Aucune créatrice" subtitle="Ajoute ta première créatrice au CRM." />
      ) : (
        <div className="space-y-2">
          {visible.map((m) => {
            const isOpen = openId === m.id;
            const st = MODEL_STATUS_STYLES[m.status];
            const b = billing[m.id];
            const incomplete = !b || missingFields(b).length > 0;

            return (
              <div key={m.id} className="bg-[#111] border border-[#1f1f1f] rounded-2xl overflow-hidden">
                <button
                  onClick={() => (isOpen ? cancel() : open(m))}
                  className="w-full flex items-center gap-3 px-5 py-4 hover:bg-[#141414] transition text-left"
                >
                  {isOpen ? (
                    <ChevronDown size={16} className="text-[#C9A84C] flex-shrink-0" />
                  ) : (
                    <ChevronRight size={16} className="text-[#444] flex-shrink-0" />
                  )}
                  <div className="flex-1 min-w-0">
                    <p className="text-sm font-semibold text-white truncate">
                      {m.name || 'Nouvelle créatrice'}
                    </p>
                    <p className="text-[11px] text-[#555] truncate">
                      {m.pseudo ? `@${m.pseudo}` : 'pseudo non renseigné'}
                      {m.manager ? ` · ${m.manager}` : ''}
                    </p>
                  </div>

                  {incomplete && !isOpen && (
                    <span
                      title="Fiche de facturation incomplète"
                      className="hidden md:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[10px] text-amber-400/80 border border-amber-500/20 bg-amber-500/5"
                    >
                      <AlertTriangle size={11} />
                      à compléter
                    </span>
                  )}

                  <div className="hidden md:flex items-center gap-1.5">
                    {m.platforms.map((p) => (
                      <span
                        key={p}
                        className="px-2 py-1 rounded-lg text-[11px] bg-[#1a1a1a] text-[#C9A84C]"
                      >
                        {p} · {rateFor(b, p, m.commission)} %
                      </span>
                    ))}
                  </div>

                  <span
                    className="px-2 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap"
                    style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
                  >
                    {MODEL_STATUS_LABELS[m.status]}
                  </span>
                </button>

                {isOpen && draft && bDraft && (
                  <div className="px-5 pb-5 pt-4 border-t border-[#1a1a1a] space-y-6">
                    <div>
                      <SectionTitle>Identité</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Prénom <span className="text-[#C9A84C]">*</span>
                          </label>
                          <TextInput
                            autoFocus
                            value={bDraft.firstName}
                            onChange={(e) => patchB({ firstName: e.target.value })}
                            placeholder="Charlotte"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Nom de famille <span className="text-[#C9A84C]">*</span>
                          </label>
                          <TextInput
                            value={bDraft.lastName}
                            onChange={(e) => patchB({ lastName: e.target.value })}
                            placeholder="Grace"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Email <span className="text-[#C9A84C]">*</span>
                          </label>
                          <TextInput
                            type="email"
                            value={bDraft.email}
                            onChange={(e) => patchB({ email: e.target.value })}
                            placeholder="charlotte@exemple.com"
                          />
                          <p className="text-[10px] text-[#555] mt-1">
                            Sert à lui envoyer ses factures et à relier son compte CRM.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Pseudo interne
                          </label>
                          <TextInput
                            value={draft.pseudo}
                            onChange={(e) => patch({ pseudo: e.target.value })}
                            placeholder="loujtf"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Date de naissance
                          </label>
                          <TextInput
                            type="date"
                            value={bDraft.birthDate}
                            onChange={(e) => patchB({ birthDate: e.target.value })}
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Lieu de naissance
                          </label>
                          <TextInput
                            value={bDraft.birthPlace}
                            onChange={(e) => patchB({ birthPlace: e.target.value })}
                            placeholder="Lyon, France"
                          />
                        </div>
                        <div className="md:col-span-2">
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Adresse complète <span className="text-[#C9A84C]">*</span>
                          </label>
                          <TextArea
                            rows={3}
                            value={bDraft.address}
                            onChange={(e) => patchB({ address: e.target.value })}
                            placeholder={'14 rue des Lilas\n69003 Lyon\nFrance'}
                          />
                          <p className="text-[10px] text-[#555] mt-1">
                            Cette adresse est imprimée sur ses factures.
                          </p>
                        </div>
                      </div>
                    </div>

                    <div>
                      <SectionTitle>Plateformes</SectionTitle>
                      <div className="flex flex-wrap gap-2">
                        {PLATFORMS.map((p) => {
                          const on = draft.platforms.includes(p);
                          return (
                            <button
                              key={p}
                              type="button"
                              onClick={() => togglePlatform(p)}
                              className={`px-4 py-2.5 rounded-xl text-sm border transition ${
                                on
                                  ? 'bg-[#C9A84C]/15 border-[#C9A84C]/40 text-[#C9A84C] font-medium'
                                  : 'bg-[#0f0f0f] border-[#222] text-[#666] hover:text-[#999]'
                              }`}
                            >
                              {p}
                            </button>
                          );
                        })}
                      </div>

                      {draft.platforms.length > 0 && (
                        <div className="mt-4 space-y-3">
                          {draft.platforms.map((p) => (
                            <div
                              key={p}
                              className="grid grid-cols-1 md:grid-cols-3 gap-4 px-4 py-3 rounded-xl bg-[#0f0f0f] border border-[#1f1f1f]"
                            >
                              <div className="flex items-center">
                                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#1a1a1a] text-[#C9A84C]">
                                  {p}
                                </span>
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#888] mb-1.5">
                                  Username sur {p}
                                </label>
                                <TextInput
                                  value={bDraft.usernames?.[p] ?? ''}
                                  onChange={(e) => setUsername(p, e.target.value)}
                                  placeholder="charlottegrace"
                                  className="!py-2"
                                />
                              </div>
                              <div>
                                <label className="block text-[11px] font-medium text-[#888] mb-1.5">
                                  % agence sur {p}
                                </label>
                                <NumberInput
                                  min={0}
                                  max={100}
                                  step="0.5"
                                  value={rateFor(bDraft, p, draft.commission)}
                                  onValueChange={(n) => setRate(p, n)}
                                  className="!py-2"
                                />
                              </div>
                            </div>
                          ))}
                        </div>
                      )}

                      <p className="text-[11px] text-[#555] mt-2">
                        {draft.platforms.length === 0
                          ? 'Aucune plateforme : elle ne pourra rien déclarer.'
                          : `Elle déclarera ${draft.platforms.length} montant${
                              draft.platforms.length > 1 ? 's' : ''
                            } par mois, un par plateforme.`}
                      </p>
                    </div>

                    <div>
                      <SectionTitle>Paiement et facturation</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Devise de paiement
                          </label>
                          <select
                            value={bDraft.payoutCurrency}
                            onChange={(e) =>
                              patchB({ payoutCurrency: e.target.value as Currency | '' })
                            }
                            className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
                          >
                            <option value="">Selon la plateforme</option>
                            {CURRENCIES.map((c) => (
                              <option key={c} value={c}>
                                {c}
                              </option>
                            ))}
                          </select>
                          <p className="text-[10px] text-[#555] mt-1">
                            La devise de son compte bancaire. Elle s&apos;applique à toutes ses
                            déclarations.
                          </p>
                        </div>
                      </div>

                      <label className="flex items-center gap-3 px-3 py-2.5 mt-4 bg-[#0f0f0f] border border-[#222] rounded-xl cursor-pointer w-fit">
                        <input
                          type="checkbox"
                          checked={bDraft.hasCompany}
                          onChange={(e) => patchB({ hasCompany: e.target.checked })}
                          className="w-4 h-4 accent-[#C9A84C]"
                        />
                        <span className="text-sm text-white">
                          Elle a une société, on facture l&apos;entreprise
                        </span>
                      </label>

                      {bDraft.hasCompany && (
                        <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                          <div>
                            <label className="block text-xs font-medium text-[#888] mb-1.5">
                              Nom de l&apos;entreprise
                            </label>
                            <TextInput
                              value={bDraft.companyName}
                              onChange={(e) => patchB({ companyName: e.target.value })}
                              placeholder="Charlotte Grace Media"
                            />
                          </div>
                          <div>
                            <label className="block text-xs font-medium text-[#888] mb-1.5">
                              Type d&apos;entreprise
                            </label>
                            <TextInput
                              list="crm-company-types"
                              value={bDraft.companyType}
                              onChange={(e) => patchB({ companyType: e.target.value })}
                              placeholder="Auto-entrepreneur"
                            />
                          </div>
                          <div className="md:col-span-2">
                            <label className="block text-xs font-medium text-[#888] mb-1.5">
                              Adresse de l&apos;entreprise
                            </label>
                            <TextArea
                              rows={3}
                              value={bDraft.companyAddress}
                              onChange={(e) => patchB({ companyAddress: e.target.value })}
                            />
                          </div>
                        </div>
                      )}
                    </div>

                    <div>
                      <SectionTitle>Suivi agence</SectionTitle>
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Manager
                          </label>
                          <TextInput
                            list="crm-managers"
                            value={draft.manager}
                            onChange={(e) => patch({ manager: e.target.value })}
                            placeholder="Sadie"
                          />
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Statut
                          </label>
                          <select
                            value={draft.status}
                            onChange={(e) => patch({ status: e.target.value as ModelStatus })}
                            className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
                          >
                            {STATUSES.map((s) => (
                              <option key={s} value={s}>
                                {MODEL_STATUS_LABELS[s]}
                              </option>
                            ))}
                          </select>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Lien Drive
                          </label>
                          <TextInput
                            value={draft.driveLink ?? ''}
                            onChange={(e) => patch({ driveLink: e.target.value })}
                            placeholder="https://drive.google.com/drive/folders/..."
                          />
                          <p className="text-[10px] text-[#555] mt-1">
                            Dossier racine surveillé par la synchronisation automatique.
                          </p>
                        </div>
                        <div>
                          <label className="block text-xs font-medium text-[#888] mb-1.5">
                            Lien Notion
                          </label>
                          <TextInput
                            value={draft.notionLink ?? ''}
                            onChange={(e) => patch({ notionLink: e.target.value })}
                            placeholder="https://notion.so/..."
                          />
                        </div>
                      </div>
                    </div>

                    {confirmDelete === m.id ? (
                      <div className="flex flex-wrap items-center gap-3 px-4 py-3 rounded-xl border border-red-500/25 bg-red-500/10">
                        <AlertTriangle size={16} className="text-red-300 flex-shrink-0" />
                        <p className="text-[12px] text-red-200 flex-1 min-w-48 leading-snug">
                          Supprimer {m.name} définitivement ? Ses déclarations, factures et dépôts
                          resteront en base sans fiche rattachée. Pour arrêter une collaboration,
                          passe-la plutôt en <strong>Inactive</strong>.
                        </p>
                        <button
                          onClick={() => remove(m)}
                          disabled={busy}
                          className="px-3 py-1.5 rounded-lg text-[11px] bg-red-500/20 text-red-200 border border-red-500/30 hover:bg-red-500/30 transition disabled:opacity-40"
                        >
                          Supprimer quand même
                        </button>
                        <button
                          onClick={() => setConfirmDelete(null)}
                          className="px-3 py-1.5 rounded-lg text-[11px] text-[#888] hover:text-white transition"
                        >
                          Annuler
                        </button>
                      </div>
                    ) : (
                      <div className="flex flex-wrap items-center gap-2">
                        <button
                          onClick={() => setConfirmDelete(m.id)}
                          className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] text-[#555] border border-[#222] hover:text-red-400 hover:border-red-500/30 transition"
                        >
                          <Trash2 size={13} />
                          Supprimer
                        </button>
                        {draft.driveLink && (
                          <a
                            href={draft.driveLink}
                            target="_blank"
                            rel="noopener noreferrer"
                            className="inline-flex items-center gap-1.5 px-3 py-2 rounded-xl text-[11px] text-[#C9A84C] border border-[#C9A84C]/25 hover:bg-[#C9A84C]/10 transition"
                          >
                            <ExternalLink size={13} />
                            Drive
                          </a>
                        )}
                        <div className="flex-1" />
                        <GhostButton onClick={cancel}>Annuler</GhostButton>
                        <GoldButton
                          onClick={submit}
                          disabled={busy || !`${bDraft.firstName}${bDraft.lastName}`.trim()}
                        >
                          <Save size={15} />
                          {busy ? 'Enregistrement...' : 'Enregistrer'}
                        </GoldButton>
                      </div>
                    )}
                  </div>
                )}
              </div>
            );
          })}
        </div>
      )}

      <datalist id="crm-managers">
        {managersOf(models.length > 0 ? models : MODELS).map((n) => (
          <option key={n} value={n} />
        ))}
      </datalist>
      <datalist id="crm-company-types">
        {COMPANY_TYPES.map((t) => (
          <option key={t} value={t} />
        ))}
      </datalist>

      <p className="text-[11px] text-[#444] leading-relaxed">
        Cette fiche est la seule à remplir. Les montants déclarés, les factures et le suivi de
        contenu s&apos;appuient dessus — un champ manquant ici bloque l&apos;émission d&apos;une
        facture, jamais l&apos;inverse.
      </p>
    </div>
  );
}
