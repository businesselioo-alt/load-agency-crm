'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, Search, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Model, Platform } from '@/lib/data';
import {
  Currency, CURRENCIES,
  ModelBilling, SaveResult, COMPANY_TYPES, PLATFORMS, PLATFORM_CURRENCY, billingDisplayName,
  emptyBilling, loadAllBilling, missingFields, rateFor, safeLoadModels, saveBilling, saveCommission,
} from '@/lib/compta';
import { Card, Field, TextInput, NumberInput, TextArea, GoldButton, Banner, EmptyState, SectionTitle } from './ui';

export default function BillingTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [rates, setRates] = useState<Record<string, number>>({});
  const [platforms, setPlatforms] = useState<Record<string, Platform[]>>({});

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModelBilling | null>(null);
  const [draftPlatforms, setDraftPlatforms] = useState<Platform[]>([]);

  const [query, setQuery] = useState('');
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [m, b] = await Promise.all([safeLoadModels(), loadAllBilling()]);
      setModels(m);
      setBilling(b);
      setRates(Object.fromEntries(m.map((x) => [x.id, x.commission])));
      setPlatforms(Object.fromEntries(m.map((x) => [x.id, x.platforms ?? []])));
      setLoading(false);
    })();
  }, []);

  const filtered = useMemo(() => {
    const q = query.trim().toLowerCase();
    if (!q) return models;
    return models.filter(
      (m) =>
        m.name.toLowerCase().includes(q) ||
        m.pseudo.toLowerCase().includes(q) ||
        (billing[m.id]?.companyName ?? '').toLowerCase().includes(q),
    );
  }, [models, query, billing]);

  const toggleRow = (m: Model) => {
    setFeedback(null);
    if (openId === m.id) {
      setOpenId(null);
      setDraft(null);
      return;
    }
    setOpenId(m.id);
    setDraft(billing[m.id] ?? emptyBilling(m.id, m.name));
    setDraftPlatforms(platforms[m.id] ?? m.platforms ?? []);
  };

  const togglePlatform = (p: Platform) =>
    setDraftPlatforms((prev) => (prev.includes(p) ? prev.filter((x) => x !== p) : [...prev, p]));

  const setRate = (p: Platform, n: number) =>
    setDraft((d) => (d ? { ...d, commissionRates: { ...d.commissionRates, [p]: n } } : d));

  const patch = (p: Partial<ModelBilling>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const submit = async () => {
    if (!draft) return;
    const model = models.find((x) => x.id === draft.modelId);
    if (!model) return;
    setSaving(true);
    setFeedback(null);

    // Le taux par défaut de la modèle suit celui de sa première plateforme :
    // il sert de repli pour toute plateforme sans taux propre.
    const firstRate = rateFor(draft, draftPlatforms[0] ?? 'MYM', model.commission);

    const samePlatforms =
      draftPlatforms.length === (platforms[draft.modelId] ?? []).length &&
      draftPlatforms.every((p) => (platforms[draft.modelId] ?? []).includes(p));

    const [resBilling, resRate] = await Promise.all([
      saveBilling(draft),
      firstRate !== rates[draft.modelId] || !samePlatforms
        ? saveCommission({ ...model, platforms: draftPlatforms }, firstRate)
        : Promise.resolve<SaveResult>({ ok: true }),
    ]);

    setSaving(false);

    if (!resBilling.ok) {
      setFeedback({ kind: 'error', message: resBilling.error ?? "Échec de l'enregistrement." });
      return;
    }
    if (!resRate.ok) {
      setFeedback({
        kind: 'error',
        message: `Fiche enregistrée, mais le % agence et les plateformes n'ont pas pu être mis à jour : ${resRate.error}`,
      });
      return;
    }

    setBilling((prev) => ({ ...prev, [draft.modelId]: draft }));
    setRates((prev) => ({
      ...prev,
      [draft.modelId]: rateFor(draft, draftPlatforms[0] ?? 'MYM', model.commission),
    }));
    setPlatforms((prev) => ({ ...prev, [draft.modelId]: draftPlatforms }));
    setFeedback({ kind: 'ok', message: 'Fiche enregistrée.' });
  };

  if (loading) {
    return <div className="h-72 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex gap-3 flex-wrap items-center">
        <div className="relative flex-1 min-w-56">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Rechercher une modèle ou une entreprise..."
            className="w-full pl-9 pr-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#C9A84C]/60"
          />
        </div>
        <span className="text-xs text-[#555]">
          {filtered.length} fiche{filtered.length > 1 ? 's' : ''}
        </span>
      </div>

      <Card className="overflow-hidden">
        {filtered.length === 0 && <EmptyState title="Aucune modèle trouvée" />}

        {filtered.map((m) => {
          const b = billing[m.id];
          const isOpen = openId === m.id;
          const missing = b ? missingFields(b) : ['tout'];
          const complete = b !== undefined && missing.length === 0;

          return (
            <div key={m.id} className="border-b border-[#1a1a1a] last:border-b-0">
              <button
                onClick={() => toggleRow(m)}
                className="w-full flex items-center gap-3 px-4 md:px-5 py-4 hover:bg-[#151515] transition text-left"
              >
                {isOpen ? (
                  <ChevronDown size={16} className="text-[#C9A84C] flex-shrink-0" />
                ) : (
                  <ChevronRight size={16} className="text-[#444] flex-shrink-0" />
                )}

                <div className="min-w-0 flex-1">
                  <p className="text-sm font-medium text-white truncate">{m.name}</p>
                  <p className="text-xs text-[#555] truncate">
                    {b ? billingDisplayName(b, `@${m.pseudo}`) : `@${m.pseudo}`}
                  </p>
                </div>

                {b?.hasCompany && (
                  <span className="hidden sm:inline-flex items-center gap-1 px-2 py-1 rounded-lg text-[11px] bg-[#1a1a1a] text-[#888] flex-shrink-0">
                    <Building2 size={12} />
                    Société
                  </span>
                )}

                <span className="hidden sm:flex gap-1 flex-shrink-0">
                  {(platforms[m.id] ?? m.platforms ?? []).map((p) => (
                    <span
                      key={p}
                      className="px-2 py-1 rounded-lg text-[11px] bg-[#1a1a1a] text-[#888]"
                    >
                      {p} · {rateFor(b, p, rates[m.id] ?? m.commission)} %
                    </span>
                  ))}
                </span>

                <span
                  className="flex-shrink-0"
                  title={complete ? 'Fiche complète' : `Manque : ${missing.join(', ')}`}
                >
                  {complete ? (
                    <CheckCircle2 size={15} className="text-emerald-400/80" />
                  ) : (
                    <AlertCircle size={15} className="text-amber-400/70" />
                  )}
                </span>
              </button>

              {isOpen && draft && (
                <div className="px-4 md:px-5 pb-6 pt-2 bg-[#0d0d0d] border-t border-[#1a1a1a] space-y-6">
                  <div>
                    <SectionTitle>Créatrice</SectionTitle>
                    <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                      <Field label="Prénom" required>
                        <TextInput
                          value={draft.firstName}
                          onChange={(e) => patch({ firstName: e.target.value })}
                          placeholder="Charlotte"
                        />
                      </Field>
                      <Field label="Nom de famille" required>
                        <TextInput
                          value={draft.lastName}
                          onChange={(e) => patch({ lastName: e.target.value })}
                          placeholder="Grace"
                        />
                      </Field>
                      <Field label="Email" required>
                        <TextInput
                          type="email"
                          value={draft.email}
                          onChange={(e) => patch({ email: e.target.value })}
                          placeholder="charlotte@exemple.com"
                        />
                      </Field>
                      <Field
                        label="Devise de paiement"
                        hint="La devise dans laquelle elle reçoit ses paiements — elle s'appliquera automatiquement à ses déclarations"
                      >
                        <select
                          value={draft.payoutCurrency}
                          onChange={(e) =>
                            patch({ payoutCurrency: e.target.value as Currency | '' })
                          }
                          className="w-full px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none transition-colors focus:border-[#C9A84C]/60 cursor-pointer"
                        >
                          <option value="">Selon la plateforme</option>
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </Field>
                      <Field label="Adresse complète" required className="md:col-span-2">
                        <TextArea
                          rows={3}
                          value={draft.address}
                          onChange={(e) => patch({ address: e.target.value })}
                          placeholder={'14 rue des Lilas\n69003 Lyon\nFrance'}
                        />
                      </Field>
                    </div>
                  </div>

                  <div>
                    <SectionTitle>Plateformes</SectionTitle>
                    <div className="flex flex-wrap gap-2">
                      {PLATFORMS.map((p) => {
                        const on = draftPlatforms.includes(p);
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
                            <span className="ml-2 text-[10px] opacity-60">
                              {PLATFORM_CURRENCY[p]}
                            </span>
                          </button>
                        );
                      })}
                    </div>
                    {draftPlatforms.length > 0 && (
                      <div className="grid grid-cols-1 md:grid-cols-3 gap-4 mt-4">
                        {draftPlatforms.map((p) => (
                          <Field key={p} label={`% agence sur ${p}`}>
                            <NumberInput
                              min={0}
                              max={100}
                              step="0.5"
                              value={rateFor(draft, p, m.commission)}
                              onValueChange={(n) => setRate(p, n)}
                            />
                          </Field>
                        ))}
                      </div>
                    )}
                    <p className="text-[11px] text-[#555] mt-2">
                      {draftPlatforms.length > 1
                        ? draft.payoutCurrency
                          ? `Elle déclarera ${draftPlatforms.length} montants par mois, tous en ${draft.payoutCurrency} : une seule facture.`
                          : `Elle déclarera ${draftPlatforms.length} montants par mois. Sans devise de paiement, chaque plateforme garde la sienne (${draftPlatforms
                              .map((p) => `${p} en ${PLATFORM_CURRENCY[p]}`)
                              .join(', ')}) et une facture est émise par devise.`
                        : draftPlatforms.length === 1
                          ? 'Une déclaration et une facture par mois.'
                          : 'Aucune plateforme : elle ne pourra rien déclarer.'}
                    </p>
                  </div>

                  <div>
                    <SectionTitle>Facturation</SectionTitle>
                    <label className="flex items-center gap-3 px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl cursor-pointer w-fit">
                      <input
                        type="checkbox"
                        checked={draft.hasCompany}
                        onChange={(e) => patch({ hasCompany: e.target.checked })}
                        className="w-4 h-4 accent-[#C9A84C]"
                      />
                      <span className="text-sm text-white">Elle a une société, on facture l&apos;entreprise</span>
                    </label>

                    {draft.hasCompany && (
                      <div className="grid grid-cols-1 md:grid-cols-2 gap-4 mt-4">
                        <Field label="Nom de l'entreprise" required>
                          <TextInput
                            value={draft.companyName}
                            onChange={(e) => patch({ companyName: e.target.value })}
                            placeholder="Charlotte Grace Media"
                          />
                        </Field>
                        <Field label="Type d'entreprise" required hint="Saisie libre ou suggestion">
                          <TextInput
                            list="compta-company-types"
                            value={draft.companyType}
                            onChange={(e) => patch({ companyType: e.target.value })}
                            placeholder="SASU"
                          />
                          <datalist id="compta-company-types">
                            {COMPANY_TYPES.map((t) => (
                              <option key={t} value={t} />
                            ))}
                          </datalist>
                        </Field>
                        <Field label="Adresse complète de l'entreprise" required className="md:col-span-2">
                          <TextArea
                            rows={3}
                            value={draft.companyAddress}
                            onChange={(e) => patch({ companyAddress: e.target.value })}
                            placeholder={'8 avenue de la République\n75011 Paris\nFrance'}
                          />
                        </Field>
                      </div>
                    )}

                    <p className="text-[11px] text-[#555] mt-3">
                      La facture sera établie au nom de{' '}
                      <span className="text-[#888]">{billingDisplayName(draft, m.name)}</span>.
                    </p>
                  </div>

                  {feedback && <Banner kind={feedback.kind} message={feedback.message} />}

                  <div className="flex justify-end">
                    <GoldButton onClick={submit} disabled={saving}>
                      <Save size={15} />
                      {saving ? 'Enregistrement...' : 'Enregistrer la fiche'}
                    </GoldButton>
                  </div>
                </div>
              )}
            </div>
          );
        })}
      </Card>
    </div>
  );
}
