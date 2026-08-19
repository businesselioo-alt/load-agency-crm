'use client';

import { useEffect, useMemo, useState } from 'react';
import { ChevronDown, ChevronRight, Save, Search, Building2, CheckCircle2, AlertCircle } from 'lucide-react';
import { Model } from '@/lib/data';
import {
  ModelBilling, SaveResult, COMPANY_TYPES, billingDisplayName,
  emptyBilling, loadAllBilling, missingFields, safeLoadModels, saveBilling, saveCommission,
} from '@/lib/compta';
import { Card, Field, TextInput, TextArea, GoldButton, Banner, EmptyState, SectionTitle } from './ui';

export default function BillingTab() {
  const [models, setModels] = useState<Model[]>([]);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [rates, setRates] = useState<Record<string, number>>({});

  const [openId, setOpenId] = useState<string | null>(null);
  const [draft, setDraft] = useState<ModelBilling | null>(null);
  const [draftRate, setDraftRate] = useState<number>(20);

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
    setDraftRate(rates[m.id] ?? m.commission);
  };

  const patch = (p: Partial<ModelBilling>) => setDraft((d) => (d ? { ...d, ...p } : d));

  const submit = async () => {
    if (!draft) return;
    setSaving(true);
    setFeedback(null);

    const [resBilling, resRate] = await Promise.all([
      saveBilling(draft),
      draftRate !== rates[draft.modelId]
        ? saveCommission(draft.modelId, draftRate)
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
        message: `Fiche enregistrée, mais le % agence n'a pas pu être mis à jour : ${resRate.error}`,
      });
      return;
    }

    setBilling((prev) => ({ ...prev, [draft.modelId]: draft }));
    setRates((prev) => ({ ...prev, [draft.modelId]: draftRate }));
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

                <span className="px-2.5 py-1 rounded-lg text-xs font-medium bg-[#C9A84C]/10 text-[#C9A84C] flex-shrink-0">
                  {rates[m.id] ?? m.commission} %
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
                      <Field label="% pour l'agence" hint="Partagé avec le module Management">
                        <TextInput
                          type="number"
                          min={0}
                          max={100}
                          step="0.5"
                          value={draftRate}
                          onChange={(e) => setDraftRate(Number(e.target.value))}
                        />
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
