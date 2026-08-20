'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X, AlertCircle, FileText, Download, Send } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  CommissionInvoice, Currency, CURRENCIES, ModelBilling,
  STATUS_LABELS, STATUS_STYLES,
  AgencySettings, DEFAULT_AGENCY,
  billingDisplayName, computeCommission, currentPeriod, emptyInvoice,
  formatMoney, hasBankAccount, isBillable, loadAgency,
  loadAllBilling, loadInvoices, missingFields, periodLabel, recentPeriods, safeLoadModels,
  saveInvoice, takeNextInvoiceNumber, emptyBilling,
} from '@/lib/compta';
import { downloadInvoicePdf, invoicePdfBlobUrl } from '@/lib/pdf-invoice';
import { Card, TextInput, NumberInput, Banner, EmptyState } from './ui';

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
  const [sending, setSending] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);
  const [confirmSend, setConfirmSend] = useState<string | null>(null);

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
  /**
   * Réserve un numéro si la facture n'en a pas encore, puis ouvre ou télécharge
   * le PDF. Le numéro n'est attribué qu'une fois : rouvrir l'aperçu ne consomme
   * pas un nouveau numéro.
   */
  const withPdf = async (m: Model, action: 'preview' | 'download') => {
    const b = billing[m.id] ?? emptyBilling(m.id, m.name);
    let row = rowFor(m);
    setBusyId(m.id);
    setError(null);

    if (!row.invoiceNumber) {
      const res = await takeNextInvoiceNumber();
      if ('error' in res) {
        setBusyId(null);
        setError(res.error);
        return;
      }
      row = { ...row, invoiceNumber: res.number, issuedAt: row.issuedAt || new Date().toISOString().slice(0, 10) };
      const saved = await saveInvoice(row);
      if (!saved.ok) {
        setBusyId(null);
        setError(saved.error ?? "Numéro réservé mais facture non enregistrée.");
        return;
      }
      setInvoices((prev) => ({ ...prev, [m.id]: row }));
    }

    const ctx = { invoice: row, billing: b, agency, modelName: m.name };
    try {
      if (action === 'download') await downloadInvoicePdf(ctx);
      else window.open(await invoicePdfBlobUrl(ctx), '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Génération du PDF impossible.');
    } finally {
      setBusyId(null);
    }
  };

  /**
   * Envoi réel. Le navigateur ne transmet que l'identifiant de la facture :
   * le serveur reconstruit le destinataire, le montant et le PDF depuis la
   * base. Impossible de forger une adresse ou un montant depuis ici.
   */
  const send = async (m: Model) => {
    setSending(m.id);
    setError(null);
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: m.id, period }),
      });
      const data = (await res.json()) as { error?: string; to?: string; warning?: string };
      if (!res.ok) {
        setError(data.error ?? "Envoi impossible.");
        return;
      }
      if (data.warning) setError(data.warning);
      const now = new Date().toISOString().slice(0, 10);
      setInvoices((prev) => ({
        ...prev,
        [m.id]: { ...rowFor(m), status: 'facturee', sentAt: now, sentTo: data.to ?? '' },
      }));
      setSent(m.id);
      setTimeout(() => setSent(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : "Envoi impossible.");
    } finally {
      setSending(null);
      setConfirmSend(null);
    }
  };

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
                        <NumberInput
                          min={0}
                          step="0.01"
                          disabled={locked}
                          value={i.grossAmount}
                          placeholder="0"
                          onValueChange={(n) => patch(m, { grossAmount: n })}
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
                        {i.invoiceNumber && (
                          <p className="text-[10px] text-[#C9A84C] mt-1">{i.invoiceNumber}</p>
                        )}
                        {i.sentAt && (
                          <p className="text-[10px] text-[#444] mt-0.5">
                            envoyée le {new Date(`${i.sentAt}T00:00:00`).toLocaleDateString('fr-FR')}
                          </p>
                        )}
                        {i.validatedBy && isBillable(i.status) && !i.sentAt && (
                          <p className="text-[10px] text-[#444] mt-0.5">par {i.validatedBy}</p>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {confirmSend === m.id ? (
                          <div className="flex flex-col gap-2 min-w-56">
                            <p className="text-[11px] text-[#888] leading-snug">
                              Envoyer {i.invoiceNumber} à{' '}
                              <span className="text-white">{b?.email ?? '—'}</span> ?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => send(m)}
                                disabled={sending === m.id}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b95c] transition disabled:opacity-40"
                              >
                                {sending === m.id ? 'Envoi...' : 'Confirmer'}
                              </button>
                              <button
                                onClick={() => setConfirmSend(null)}
                                className="px-2.5 py-1 rounded-lg text-[11px] text-[#666] hover:text-white transition"
                              >
                                Annuler
                              </button>
                            </div>
                          </div>
                        ) : refusing === m.id ? (
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
                              <>
                                <button
                                  onClick={() => withPdf(m, 'preview')}
                                  disabled={busyId === m.id}
                                  title="Aperçu de la facture"
                                  className="p-2 text-[#555] hover:text-[#C9A84C] transition disabled:opacity-30"
                                >
                                  <FileText size={15} />
                                </button>
                                <button
                                  onClick={() => withPdf(m, 'download')}
                                  disabled={busyId === m.id}
                                  title="Télécharger le PDF"
                                  className="p-2 text-[#555] hover:text-[#C9A84C] transition disabled:opacity-30"
                                >
                                  <Download size={15} />
                                </button>
                                {i.status === 'valide' && (
                                  <button
                                    onClick={() => setConfirmSend(m.id)}
                                    disabled={sending === m.id || !i.invoiceNumber}
                                    title={i.invoiceNumber ? 'Envoyer la facture par email' : "Génère d'abord la facture"}
                                    className="p-2 text-[#555] hover:text-violet-300 transition disabled:opacity-30"
                                  >
                                    <Send size={15} />
                                  </button>
                                )}
                                {sent === m.id && (
                                  <span className="text-[11px] text-emerald-400">Envoyée</span>
                                )}
                                {i.status === 'valide' && !i.invoiceNumber && (
                                  <button
                                    onClick={() => persist(m, { status: 'declare', validatedBy: '', validatedAt: '' })}
                                    disabled={busyId === m.id}
                                    title="Annuler la validation"
                                    className="px-2 py-1 rounded-lg text-[11px] text-[#555] hover:text-white transition"
                                  >
                                    Dévalider
                                  </button>
                                )}
                              </>
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
