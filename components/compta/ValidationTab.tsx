'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, X, AlertCircle, FileText, Download, Send } from 'lucide-react';
import { Model, Platform } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  AgencySettings, CommissionInvoice, Currency, CURRENCIES, DEFAULT_AGENCY, InvoiceGroup, ModelBilling,
  STATUS_LABELS, STATUS_STYLES,
  billingDisplayName, buildGroups, computeCommission, currencyFor, periodOptionLabel, previousPeriod,
  emptyBilling, emptyInvoice, groupKeyOf,
  formatMoney, hasBankAccount, invoiceKey, isBillable, isGroupBillable, loadAgency,
  loadAllBilling, loadInvoices, missingFields, rateFor, recentPeriods, safeLoadModels,
  saveGroup, saveInvoice, takeNextInvoiceNumber,
} from '@/lib/compta';
import { downloadInvoicePdf, invoicePdfBlobUrl } from '@/lib/pdf-invoice';
import { Card, TextInput, NumberInput, Banner, EmptyState } from './ui';

const today = () => new Date().toISOString().slice(0, 10);

/**
 * Vue agence : ce que chaque modèle a déclaré, plateforme par plateforme, et la
 * validation des montants.
 *
 * La déclaration est par plateforme — elle reçoit un paiement de chacune. La
 * facture, elle, regroupe les plateformes d'un même mois sur un seul document :
 * un compte bancaire, un virement.
 */
export default function ValidationTab() {
  const { user } = useAuth();
  const [period, setPeriod] = useState(previousPeriod());
  const [models, setModels] = useState<Model[]>([]);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [agency, setAgency] = useState<AgencySettings>(DEFAULT_AGENCY);
  const [invoices, setInvoices] = useState<Record<string, CommissionInvoice>>({});
  const [loading, setLoading] = useState(true);
  const [busyKey, setBusyKey] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [refusing, setRefusing] = useState<string | null>(null);
  const [refusalNote, setRefusalNote] = useState('');
  const [confirmSend, setConfirmSend] = useState<string | null>(null);
  const [sent, setSent] = useState<string | null>(null);

  useEffect(() => {
    (async () => {
      const [m, b, inv, a] = await Promise.all([
        safeLoadModels(),
        loadAllBilling(),
        loadInvoices(previousPeriod()),
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

  const platformsOf = (m: Model): Platform[] =>
    (m.platforms?.length ? m.platforms : (['MYM'] as Platform[])).slice().sort();

  /**
   * La devise vient de la fiche de la modèle dès qu'elle y est renseignée : elle
   * encaisse tout sur le même compte. Une ligne déjà enregistrée dans une autre
   * devise est réalignée à l'affichage, puis au prochain enregistrement.
   */
  const rowFor = (m: Model, platform: Platform): CommissionInvoice => {
    const row =
      invoices[invoiceKey(m.id, platform)] ??
      emptyInvoice(
        m.id,
        platform,
        period,
        rateFor(billing[m.id], platform, m.commission),
        currencyFor(billing[m.id], platform),
      );
    const forced = billing[m.id]?.payoutCurrency;
    return forced && row.currency !== forced ? { ...row, currency: forced } : row;
  };

  const groups = useMemo(
    () => buildGroups(models.flatMap((m) => platformsOf(m).map((p) => rowFor(m, p)))),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models, invoices, billing, period],
  );

  /**
   * Une ligne par modèle et par plateforme.
   *
   * Deux plateformes d'une même modèle tiennent sur la même facture si elles
   * sont dans la même devise, sinon elles forment deux factures distinctes. Les
   * boutons de facturation appartiennent donc au groupe, pas à la modèle :
   * `isGroupFirst` marque la première ligne de chaque facture.
   */
  const lines = useMemo(
    () =>
      models.flatMap((m) => {
        const plats = platformsOf(m);
        const seen = new Set<string>();
        return plats.map((platform, idx) => {
          const groupKey = groupKeyOf(rowFor(m, platform));
          const isGroupFirst = !seen.has(groupKey);
          seen.add(groupKey);
          return { model: m, platform, isFirst: idx === 0, isGroupFirst, groupKey };
        });
      }),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [models, invoices, billing, period],
  );

  const groupFor = (groupKey: string): InvoiceGroup | null =>
    groups.find((g) => g.key === groupKey) ?? null;

  const patch = (m: Model, platform: Platform, p: Partial<CommissionInvoice>) =>
    setInvoices((prev) => {
      const next = { ...rowFor(m, platform), ...p };
      next.amount = computeCommission(next.grossAmount, next.commissionRate);
      return { ...prev, [invoiceKey(m.id, platform)]: next };
    });

  const persist = async (m: Model, platform: Platform, override?: Partial<CommissionInvoice>) => {
    const row = { ...rowFor(m, platform), ...(override ?? {}) };
    row.amount = computeCommission(row.grossAmount, row.commissionRate);
    setBusyKey(invoiceKey(m.id, platform));
    setError(null);
    const res = await saveInvoice(row);
    setBusyKey(null);
    if (!res.ok) {
      setError(res.error ?? "Échec de l'enregistrement.");
      return;
    }
    setInvoices((prev) => ({ ...prev, [invoiceKey(m.id, platform)]: row }));
  };

  const validate = async (m: Model, platform: Platform) => {
    const row = rowFor(m, platform);
    if (!hasBankAccount(agency, row.currency)) {
      setError(
        `Aucun compte ${row.currency} renseigné dans l'onglet Agence. Impossible d'émettre une facture en ${row.currency}.`,
      );
      return;
    }
    setError(null);
    await persist(m, platform, {
      status: 'valide',
      validatedBy: user?.name ?? '',
      validatedAt: today(),
      refusalNote: '',
    });
  };

  const refuse = async (m: Model, platform: Platform) => {
    await persist(m, platform, {
      status: 'refuse',
      validatedBy: user?.name ?? '',
      validatedAt: today(),
      refusalNote: refusalNote.trim() || 'Montant à corriger.',
    });
    setRefusing(null);
    setRefusalNote('');
  };

  /** Réserve un numéro pour tout le groupe, puis ouvre ou télécharge le PDF. */
  const withPdf = async (m: Model, g: InvoiceGroup, action: 'preview' | 'download') => {
    const b = billing[m.id] ?? emptyBilling(m.id, m.name);
    let lines = g.lines;
    setBusyKey(g.key);
    setError(null);

    if (!g.invoiceNumber) {
      const res = await takeNextInvoiceNumber();
      if ('error' in res) {
        setBusyKey(null);
        setError(res.error);
        return;
      }
      const issuedAt = today();
      const saved = await saveGroup(g.lines, { invoiceNumber: res.number, issuedAt });
      if (!saved.ok) {
        setBusyKey(null);
        setError(saved.error ?? 'Numéro réservé mais facture non enregistrée.');
        return;
      }
      lines = g.lines.map((l) => ({ ...l, invoiceNumber: res.number, issuedAt }));
      setInvoices((prev) => {
        const next = { ...prev };
        lines.forEach((l) => {
          next[invoiceKey(l.modelId, l.platform)] = l;
        });
        return next;
      });
    }

    try {
      const ctx = { lines, billing: b, agency, modelName: m.name };
      if (action === 'download') await downloadInvoicePdf(ctx);
      else window.open(await invoicePdfBlobUrl(ctx), '_blank');
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Génération du PDF impossible.');
    } finally {
      setBusyKey(null);
    }
  };

  const send = async (m: Model, g: InvoiceGroup) => {
    setBusyKey(g.key);
    setError(null);
    try {
      const res = await fetch('/api/invoices/send', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ modelId: m.id, period, currency: g.currency }),
      });
      const data = (await res.json()) as { error?: string; to?: string; warning?: string };
      if (!res.ok) {
        setError(data.error ?? 'Envoi impossible.');
        return;
      }
      if (data.warning) setError(data.warning);
      const now = today();
      setInvoices((prev) => {
        const next = { ...prev };
        g.lines.forEach((l) => {
          next[invoiceKey(l.modelId, l.platform)] = {
            ...l,
            status: 'facturee',
            sentAt: now,
            sentTo: data.to ?? '',
          };
        });
        return next;
      });
      setSent(g.key);
      setTimeout(() => setSent(null), 4000);
    } catch (e) {
      setError(e instanceof Error ? e.message : 'Envoi impossible.');
    } finally {
      setBusyKey(null);
      setConfirmSend(null);
    }
  };

  const totals = useMemo(() => {
    const pending: Record<string, number> = {};
    const billable: Record<string, number> = {};
    lines.forEach(({ model: m, platform }) => {
      const i = invoices[invoiceKey(m.id, platform)];
      if (!i || i.amount <= 0) return;
      if (isBillable(i.status)) billable[i.currency] = (billable[i.currency] ?? 0) + i.amount;
      else if (i.status === 'declare') pending[i.currency] = (pending[i.currency] ?? 0) + i.amount;
    });
    return { pending, billable };
  }, [lines, invoices]);

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
              {periodOptionLabel(p)}
            </option>
          ))}
        </select>
      </div>

      <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
        {[
          { label: 'En attente de validation', map: totals.pending, color: '#93c5fd' },
          { label: 'Validé, facturable', map: totals.billable, color: '#C9A84C' },
        ].map(({ label, map, color }) => (
          <div key={label} className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
            <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">{label}</p>
            <div className="flex flex-wrap gap-x-4">
              {Object.entries(map).map(([cur, v]) => (
                <p key={cur} className="text-lg font-bold" style={{ color }}>
                  {formatMoney(v, cur as Currency)}
                </p>
              ))}
              {Object.keys(map).length === 0 && <p className="text-lg font-bold text-[#333]">—</p>}
            </div>
          </div>
        ))}
      </div>

      {error && <Banner kind="error" message={error} />}

      <Card className="overflow-hidden">
        {lines.length === 0 ? (
          <EmptyState title="Aucune modèle" />
        ) : (
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1040px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#0d0d0d]">
                  {['Modèle', 'Plateforme', 'Facturé à', 'Montant reçu', 'Devise', '%', 'Commission', 'Statut', 'Facture', ''].map(
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
                {lines.map(({ model: m, platform, isFirst, isGroupFirst, groupKey }) => {
                  const key = invoiceKey(m.id, platform);
                  const b = billing[m.id] ?? null;
                  const i = rowFor(m, platform);
                  const st = STATUS_STYLES[i.status];
                  const locked = isBillable(i.status);
                  const incomplete = !b || missingFields(b).length > 0;
                  const g = groupFor(groupKey);
                  const count = g?.lines.length ?? 1;
                  const canInvoice = g !== null && isGroupBillable(g);

                  return (
                    <tr
                      key={key}
                      className={`border-b border-[#161616] last:border-b-0 hover:bg-[#141414] transition align-top ${
                        isFirst ? '' : 'border-t-0'
                      }`}
                    >
                      <td className="px-4 py-3">
                        {isFirst ? (
                          <>
                            <p className="text-sm text-white">{m.name}</p>
                            <p className="text-[10px] text-[#555]">@{m.pseudo}</p>
                          </>
                        ) : (
                          <span className="text-[#333] text-sm">↳</span>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <span className="px-2 py-1 rounded-lg text-[11px] bg-[#1a1a1a] text-[#C9A84C]">
                          {platform}
                        </span>
                      </td>

                      <td className="px-4 py-3">
                        {isFirst && (
                          <div className="flex items-center gap-1.5">
                            <span className="text-sm text-[#aaa] truncate max-w-[150px]">
                              {b ? billingDisplayName(b, m.name) : '—'}
                            </span>
                            {incomplete && (
                              <span title="Fiche incomplète, onglet Fiches modèles">
                                <AlertCircle size={13} className="text-amber-400/70 flex-shrink-0" />
                              </span>
                            )}
                          </div>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <NumberInput
                          min={0}
                          step="0.01"
                          disabled={locked}
                          value={i.grossAmount}
                          placeholder="0"
                          onValueChange={(n) => patch(m, platform, { grossAmount: n })}
                          onBlur={() => persist(m, platform)}
                          className="!w-28 !py-1.5 !px-2 text-right"
                        />
                      </td>

                      <td className="px-4 py-3">
                        {b?.payoutCurrency ? (
                          <span
                            className="text-sm text-[#888]"
                            title="Devise définie sur la fiche de la modèle"
                          >
                            {b.payoutCurrency}
                          </span>
                        ) : (
                        <select
                          disabled={locked}
                          value={i.currency}
                          onChange={(e) => {
                            const cur = e.target.value as Currency;
                            patch(m, platform, { currency: cur });
                            setTimeout(() => persist(m, platform, { currency: cur }), 0);
                          }}
                          className="px-2 py-1.5 bg-[#0f0f0f] border border-[#222] rounded-lg text-xs text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer disabled:opacity-50"
                        >
                          {CURRENCIES.map((c) => (
                            <option key={c} value={c}>
                              {c}
                            </option>
                          ))}
                        </select>
                        )}
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
                        {refusing === key && (
                          <div className="mt-2 flex flex-col gap-2 min-w-48">
                            <TextInput
                              autoFocus
                              value={refusalNote}
                              placeholder="Motif du refus"
                              onChange={(e) => setRefusalNote(e.target.value)}
                              className="!py-1.5 !px-2 !text-xs"
                            />
                            <div className="flex gap-2">
                              <button
                                onClick={() => refuse(m, platform)}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-red-500/15 text-red-300 border border-red-500/25 hover:bg-red-500/25 transition"
                              >
                                Confirmer
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
                        )}
                      </td>

                      <td className="px-4 py-3">
                        {isGroupFirst && g && (
                          <>
                            {g.invoiceNumber ? (
                              <p className="text-[11px] text-[#C9A84C]">{g.invoiceNumber}</p>
                            ) : (
                              <span className="text-[11px] text-[#444]">—</span>
                            )}
                            {count > 1 && (
                              <p className="text-[10px] text-[#555] mt-0.5">
                                {count} lignes · {formatMoney(g.amount, g.currency)}
                              </p>
                            )}
                            {g.sentAt && (
                              <p className="text-[10px] text-[#444] mt-0.5">
                                envoyée le {new Date(`${g.sentAt}T00:00:00`).toLocaleDateString('fr-FR')}
                              </p>
                            )}
                          </>
                        )}
                      </td>

                      <td className="px-4 py-3">
                        <div className="flex items-center gap-1 justify-end">
                          {!locked && i.grossAmount > 0 && refusing !== key && (
                            <>
                              <button
                                onClick={() => validate(m, platform)}
                                disabled={busyKey === key}
                                title="Valider le montant"
                                className="p-2 text-[#555] hover:text-emerald-400 transition disabled:opacity-30"
                              >
                                <Check size={15} />
                              </button>
                              <button
                                onClick={() => setRefusing(key)}
                                disabled={busyKey === key}
                                title="Refuser"
                                className="p-2 text-[#555] hover:text-red-400 transition disabled:opacity-30"
                              >
                                <X size={15} />
                              </button>
                            </>
                          )}

                          {isGroupFirst && canInvoice && g && (
                            <>
                              <button
                                onClick={() => withPdf(m, g, 'preview')}
                                disabled={busyKey === g.key}
                                title="Aperçu de la facture"
                                className="p-2 text-[#555] hover:text-[#C9A84C] transition disabled:opacity-30"
                              >
                                <FileText size={15} />
                              </button>
                              <button
                                onClick={() => withPdf(m, g, 'download')}
                                disabled={busyKey === g.key}
                                title="Télécharger le PDF"
                                className="p-2 text-[#555] hover:text-[#C9A84C] transition disabled:opacity-30"
                              >
                                <Download size={15} />
                              </button>
                              {g.status === 'valide' && (
                                <button
                                  onClick={() => setConfirmSend(g.key)}
                                  disabled={busyKey === g.key || !g.invoiceNumber}
                                  title={g.invoiceNumber ? 'Envoyer par email' : "Génère d'abord la facture"}
                                  className="p-2 text-[#555] hover:text-violet-300 transition disabled:opacity-30"
                                >
                                  <Send size={15} />
                                </button>
                              )}
                              {sent === g.key && (
                                <span className="text-[11px] text-emerald-400">Envoyée</span>
                              )}
                            </>
                          )}
                        </div>

                        {isGroupFirst && g && confirmSend === g.key && (
                          <div className="mt-2 flex flex-col gap-2 min-w-52">
                            <p className="text-[11px] text-[#888] leading-snug">
                              Envoyer {g.invoiceNumber} à{' '}
                              <span className="text-white">{b?.email ?? '—'}</span> ?
                            </p>
                            <div className="flex gap-2">
                              <button
                                onClick={() => send(m, g)}
                                disabled={busyKey === g.key}
                                className="px-2.5 py-1 rounded-lg text-[11px] bg-[#C9A84C] text-black font-semibold hover:bg-[#d9b95c] transition disabled:opacity-40"
                              >
                                {busyKey === g.key ? 'Envoi...' : 'Confirmer'}
                              </button>
                              <button
                                onClick={() => setConfirmSend(null)}
                                className="px-2.5 py-1 rounded-lg text-[11px] text-[#666] hover:text-white transition"
                              >
                                Annuler
                              </button>
                            </div>
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
        Chaque modèle déclare un montant par plateforme. La validation se fait ligne par ligne ; la
        facture regroupe ensuite toutes les plateformes du mois qui partagent la même devise — un
        total, un bloc bancaire, un virement. Deux devises différentes donnent deux factures : pour
        n&apos;en émettre qu&apos;une, renseigne la devise de paiement sur la fiche de la modèle.
      </p>
    </div>
  );
}
