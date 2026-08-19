'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X, AlertCircle } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  CommissionInvoice, Currency, CURRENCIES, ModelBilling,
  STATUS_LABELS, STATUS_STYLES,
  AgencySettings, DEFAULT_AGENCY,
  billingDisplayName, computeCommission, currentPeriod, emptyInvoice,
  formatMoney, hasBankAccount, isBillable, loadAgency,
  loadAllBilling, loadInvoices, missingFields, periodLabel, recentPeriods, safeLoadModels, saveInvoice,
} from '@/lib/compta';
import { Card, TextInput, Banner, EmptyState } from './ui';

/**
 * Vue agence : ce que chaque modèle a déclaré pour une période, et la
 * validation du montant. Une déclaration non validée n'est pas facturable.
 */
export default function ValidationTab() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(currentPeriod());
  const [models, setModels] = useState<Model[]>([]);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [agency, setAgency] = useState<AgencySettings>(DEFAULT_AGENCY);
  const [invoices, setInvoices] = useState<Record<string, CommissionInvoice>>({});
  const [loading, setLoading] = useState(true);
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [refusalNote, setRefusalNote] = useState('');

  useEffect(() => {
    (async () => {
      const [m, b, inv, a] = await Promise.all([
        safeLoadModels(),
        loadAllBilling(),
        loadInvoices(currentPeriod()),
        loadAgency(),
      ]);
      setModels(m);
      setBilling(b);
      setInvoices(inv);
      setAgency(a);
      setLoading(false);
    })();
  }, []);

  const changePeriod = async (next: string) => {
    setPeriod(next);
    setLoading(true);
    setInvoices(await loadInvoices(next));
    setLoading(false);
  };

  const rowFor = (m: Model): CommissionInvoice =>
    invoices[m.id] ?? emptyInvoice(m.id, period, m.commission, 'EUR');

  const patch = (m: Model, p: Partial<CommissionInvoice>) =>
    setInvoices((prev) => {
      const next = { ...rowFor(m), ...p };
      next.amount = computeCommission(next.grossAmount, next.commissionRate);
      return { ...prev, [m.id]: next };
    });

  const persist = async (m: Model, override?: Partial<CommissionInvoice>) => {
    const row = { ...rowFor(m), ...(override ?? {}) };
    row.amount = computeCommission(row.grossAmount, row.commissionRate);
    setBusyId(m.id);
    setError(null);
    const res = await saveInvoice(row);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error ?? "Échec de l'enregistrement.");
      return;
    }
    setInvoices((prev) => ({ ...prev, [m.id]: row }));
  };

  /**
   * La facture est émise dans la devise de la modèle. On refuse de valider si
   * le compte bancaire de cette devise n'est pas renseigné : la facture
   * partirait sans coordonnées de règlement.
   */
  const validate = async (m: Model) => {
    const row = rowFor(m);
    if (!hasBankAccount(agency, row.currency)) {
      setError(
        `Aucun compte ${row.currency} renseigné dans l'onglet Agence. Impossible d'émettre une facture en ${row.currency}.`,
      );
      return;
    }
    setError(null);
    await persist(m, {
      status: 'valide',
      validatedBy: user?.name ?? '',
      validatedAt: new Date().toISOString().slice(0, 10),
      refusalNote: '',
    });
  };

  const refuse = async (m: Model) => {
    await persist(m, {
      status: 'refuse',
      validatedBy: user?.name ?? '',
      validatedAt: new Date().toISOString().slice(0, 10),
      refusalNote: refusalNote.trim() || 'Montant à corriger.',
    });
    setRefusing(null);
    setRefusalNote('');
  };

  // Les totaux sont en USD : c'est la devise de facturation. Le pendant non
  // encore validé n'a pas de taux figé, on l'affiche donc dans sa devise
  // d'origine plutôt que d'inventer une conversion.
  const totals = useMemo(() => {
    const pending: Record<string, number> = {};
    const billable: Record<string, number> = {};
    models.forEach((m) => {
      const i = invoices[m.id];
      if (!i || i.amount <= 0) return;
      if (isBillable(i.status)) billable[i.currency] = (billable[i.currency] ?? 0) + i.amount;
      else if (i.status === 'declare') pending[i.currency] = (pending[i.currency] ?? 0) + i.amount;
    });
    return { pending, billable };
  }, [models, invoices]);

  if (loading) {
    return <div className="h-72 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      <div className="flex flex-wrap items-center gap-3">
        <select
          value={period}
          onChange={(e) => changePeriod(e.target.value)}
          className="px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
        >
          {recentPeriods().map((p) => (
            <option key={p} value={p}>
              {periodLabel(p)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">
            En attente de validation
          </p>
          <div className="flex flex-wrap gap-x-4">
            {Object.entries(totals.pending).map(([cur, v]) => (
              <p key={cur} className="text-lg font-bold text-blue-300">
                {formatMoney(v, cur as Currency)}
              </p>
            ))}
            {Object.keys(totals.pending).length === 0 && (
              <p className="text-lg font-bold text-[#333]">—</p>
            )}
          </div>
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">
            Validé, facturable
          </p>
          <div className="flex flex-wrap gap-x-4">
            {Object.entries(totals.billable).map(([cur, v]) => (
              <p key={cur} className="text-lg font-bold text-[#C9A84C]">
                {formatMoney(v, cur as Currency)}
              </p>
            ))}
            {Object.keys(totals.billable).length === 0 && (
              <p className="text-lg font-bold text-[#333]">—</p>
            )}
          </div>
        </div>
      </div>

      {error && <Banner kind="error" message={error} />}

      <Card className="overflow-hidden">
        {models.length === 0 ? (
          <EmptyState title="Aucune modèle" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[880px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#0d0d0d]">
                  {['Modèle', 'Facturé à', 'Montant reçu', 'Devise', '%', 'Commission', 'Statut', ''].map(
                    (h) => (
                      <th
                        key={h}
                        className="text-left px-4 py-3 text-[10px] font-semibold text-[#555] uppercase tracking-wider"
                      >
                        {h}
                      </th>
                    ),
                  )}
                </tr>
              </thead>
              <tbody>
                {models.map((m) => {
                  const b = billing[m.id] ?? null;
                  const i = rowFor(m);
                  const st = STATUS_STYLES[i.status];
                  const locked = isBillable(i.status);
                  const incomplete = !b || missingFields(b).length > 0;

                  return (
                    <tr key={m.id} className="border-b border-[#161616] last:border-b-0 hover:bg-[#141414] transition align-top">
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{m.name}</p>
                        <p className="text-[10px] text-[#555]">@{m.pseudo}</p>
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1.5">
                          <span className="text-sm text-[#aaa] truncate max-w-[160px]">
                            {b ? billingDisplayName(b, m.name) : '—'}
                          </span>
                          {incomplete && (
                            <span title="Fiche incomplète, onglet Fiches modèles">
                              <AlertCircle size={13} className="text-amber-400/70 flex-shrink-0" />
                            </span>
                          )}
                        </div>
                        {i.declaredBy && (
                          <p className="text-[10px] text-[#444] mt-0.5">déclaré par {i.declaredBy}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <TextInput
                          type="number"
                          min={0}
                          step="0.01"
                          disabled={locked}
                          value={i.grossAmount || ''}
                          placeholder="0"
                          onChange={(e) => patch(m, { grossAmount: Number(e.target.value) })}
                          onBlur={() => persist(m)}
                          className="!w-28 !py-1.5 !px-2 text-right"
                        />
                      </td>

                      <td className="px-4 py-3">
                        <select
                          disabled={locked}
                          value={i.currency}
                          onChange={(e) => {
                            patch(m, { currency: e.target.value as Currency });
                            setTimeout(() => persist(m, { currency: e.target.value as Currency }), 0);
                          }}
                          className="px-2 py-1.5 bg-[#0f0f0f] border border-[#222] rounded-lg text-xs text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer disabled:opacity-50"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-sm text-[#888]">{i.commissionRate} %</span>
                      </td>

                      <td className="px-4 py-3">
                        <span className="text-sm font-semibold text-[#C9A84C] whitespace-nowrap">
                          {formatMoney(i.amount, i.currency)}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap"
                          style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
                        >
                          {STATUS_LABELS[i.status]}
                        </span>
                        {i.validatedBy && isBillable(i.status) && (
                          <p className="text-[10px] text-[#444] mt-1">par {i.validatedBy}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {refusing === m.id ? (
                          <div className="flex flex-col gap-2 min-w-52">
                            <TextInput
                              autoFocus
                              value={refusalNote}
                              placeholder="Motif du refus"
                              onChange={(e) => setRefusalNote(e.target.value)}
                              className="!py-1.5 !px-2 !text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => refuse(m)}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition"
                              >
                                Confirmer le refus
                              </button>
                              <button
                                onClick={() => {
                                  setRefusing(null);
                                  setRefusalNote('');
                                }}
                                className="px-2.5 py-1 rounded-lg text-[11px] text-[#666] hover:text-white transition"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : (
                          <div className="flex items-center gap-1 justify-end">
                            {!locked && i.grossAmount > 0 && (
                              <>
                                <button
                                  onClick={() => validate(m)}
                                  disabled={busyId === m.id}
                                  title="Valider le montant"
                                  className="p-2 text-[#555] hover:text-emerald-400 transition disabled:opacity-30"
                                >
                                  <Check size={15} />
                                </button>
                                <button
                                  onClick={() => setRefusing(m.id)}
                                  disabled={busyId === m.id}
                                  title="Refuser"
                                  className="p-2 text-[#555] hover:text-red-400 transition disabled:opacity-30"
                                >
                                  <X size={15} />
                                </button>
                              </>
                            )}
                            {locked && (
                              <button
                                onClick={() => persist(m, { status: 'declare', validatedBy: '', validatedAt: '' })}
                                disabled={busyId === m.id}
                                title="Annuler la validation"
                                className="px-2 py-1 rounded-lg text-[11px] text-[#555] hover:text-white transition"
                              >
                                Dévalider
                              </button>
                            )}
                          </div>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        )}
      </Card>

      <p className="text-[11px] text-[#444] leading-relaxed">
        Un montant validé devient facturable et n&apos;est plus modifiable par la modèle. La
        génération de la facture arrive à l&apos;étape suivante.
      </p>
    </div>
  );
}
