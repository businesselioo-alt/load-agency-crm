'use client';

import { useEffect, useMemo, useState } from 'react';
import { Check, RotateCcw, Search, AlertTriangle } from 'lucide-react';
import { Model, Platform } from '@/lib/data';
import {
  AgencySettings, CommissionInvoice, Currency, DEFAULT_AGENCY, InvoiceStatus,
  STATUS_LABELS, STATUS_STYLES,
  periodOptionLabel, previousPeriod, currencyFor, daysLate, dueDateOf, emptyInvoice, formatMoney, isOverdue,
  loadAgency, loadAllBilling, loadAllInvoices, ModelBilling, periodLabel, PLATFORMS, rateFor,
  recentPeriods, safeLoadModels, saveInvoice,
} from '@/lib/compta';
import { Card, TextInput, Banner, EmptyState } from './ui';

type Filter = 'toutes' | 'a_declarer' | 'a_valider' | 'a_facturer' | 'envoyees' | 'en_retard' | 'payees';

const FILTERS: { id: Filter; label: string }[] = [
  { id: 'toutes', label: 'Toutes' },
  { id: 'a_declarer', label: 'À déclarer' },
  { id: 'a_valider', label: 'À valider' },
  { id: 'a_facturer', label: 'À facturer' },
  { id: 'envoyees', label: 'Envoyées' },
  { id: 'en_retard', label: 'En retard' },
  { id: 'payees', label: 'Payées' },
];

const ALL_PERIODS = 'all';

const fr = (iso: string) =>
  iso ? new Date(`${iso}T00:00:00`).toLocaleDateString('fr-FR') : '—';

function Money({ map, color }: { map: Record<string, number>; color: string }) {
  const entries = Object.entries(map).filter(([, v]) => v > 0);
  return (
    <div className="flex flex-wrap gap-x-4">
      {entries.map(([cur, v]) => (
        <p key={cur} className="text-lg font-bold" style={{ color }}>
          {formatMoney(v, cur as Currency)}
        </p>
      ))}
      {entries.length === 0 && <p className="text-lg font-bold text-[#333]">—</p>}
    </div>
  );
}

interface Row {
  model: Model;
  invoice: CommissionInvoice;
  declared: boolean;
}

/**
 * Vue financière consolidée, réservée à l'admin.
 *
 * Sur un mois donné, chaque modèle apparaît — y compris celles qui n'ont rien
 * déclaré : c'est justement l'information utile pour savoir qui relancer.
 * En « toutes périodes », seules les factures réellement existantes sont
 * listées, sinon la table se remplirait de lignes vides.
 */
export default function PaymentsTab() {
  const [invoices, setInvoices] = useState<CommissionInvoice[]>([]);
  const [models, setModels] = useState<Model[]>([]);
  const [agency, setAgency] = useState<AgencySettings>(DEFAULT_AGENCY);
  const [billing, setBilling] = useState<Record<string, ModelBilling>>({});
  const [loading, setLoading] = useState(true);
  const [period, setPeriod] = useState<string>(previousPeriod());
  const [filter, setFilter] = useState<Filter>('toutes');
  const [query, setQuery] = useState('');
  const [busyId, setBusyId] = useState<string | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [payingId, setPayingId] = useState<string | null>(null);
  const [payDate, setPayDate] = useState(new Date().toISOString().slice(0, 10));

  useEffect(() => {
    (async () => {
      const [inv, m, a, b] = await Promise.all([
        loadAllInvoices(),
        safeLoadModels(),
        loadAgency(),
        loadAllBilling(),
      ]);
      setInvoices(inv);
      setModels(m);
      setAgency(a);
      setBilling(b);
      setLoading(false);
    })();
  }, []);

  /** La devise de la fiche l'emporte sur celle stockée sur la ligne. */
  const withPayoutCurrency = (i: CommissionInvoice): CommissionInvoice => {
    const forced = billing[i.modelId]?.payoutCurrency;
    return forced && i.currency !== forced ? { ...i, currency: forced } : i;
  };

  const allRows: Row[] = useMemo(() => {
    if (period === ALL_PERIODS) {
      return invoices
        .filter((i) => i.amount > 0 || i.status !== 'a_declarer')
        .map((i) => ({
          model: models.find((m) => m.id === i.modelId) ?? ({ id: i.modelId, name: i.modelId, pseudo: '' } as Model),
          invoice: withPayoutCurrency(i),
          declared: true,
        }));
    }
    return models.flatMap((m) =>
      (m.platforms?.length ? m.platforms : (['MYM'] as Platform[])).map((platform) => {
        const found = invoices.find(
          (i) => i.modelId === m.id && i.period === period && i.platform === platform,
        );
        return {
          model: m,
          invoice: withPayoutCurrency(
            found ??
              emptyInvoice(
                m.id,
                platform,
                period,
                rateFor(billing[m.id], platform, m.commission),
                currencyFor(billing[m.id], platform),
              ),
          ),
          declared: Boolean(found),
        };
      }),
    );
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [invoices, models, period, billing]);

  const rows = useMemo(() => {
    const q = query.trim().toLowerCase();
    return allRows.filter(({ model, invoice: i }) => {
      const matchQ =
        !q ||
        model.name.toLowerCase().includes(q) ||
        i.invoiceNumber.toLowerCase().includes(q) ||
        periodLabel(i.period).toLowerCase().includes(q);
      if (!matchQ) return false;
      switch (filter) {
        case 'a_declarer':
          return i.status === 'a_declarer' || i.status === 'refuse';
        case 'a_valider':
          return i.status === 'declare';
        case 'a_facturer':
          return i.status === 'valide';
        case 'envoyees':
          return i.status === 'facturee';
        case 'en_retard':
          return isOverdue(i, agency.paymentDays);
        case 'payees':
          return i.status === 'payee';
        default:
          return true;
      }
    });
  }, [allRows, query, filter, agency.paymentDays]);

  /** Une section par plateforme : OF et MYM se suivent séparément. */
  const sections = useMemo(() => {
    const used = PLATFORMS.filter((p) => rows.some((r) => r.invoice.platform === p));
    return used.map((platform) => {
      const list = rows.filter((r) => r.invoice.platform === platform);
      const sub: Record<string, number> = {};
      list.forEach(({ invoice: i }) => {
        if (i.status === 'facturee' || i.status === 'payee') {
          sub[i.currency] = (sub[i.currency] ?? 0) + i.amount;
        }
      });
      return { platform, list, sub };
    });
  }, [rows]);

  const totals = useMemo(() => {
    const encaisse: Record<string, number> = {};
    const attente: Record<string, number> = {};
    const retard: Record<string, number> = {};
    let aDeclarer = 0;
    allRows.forEach(({ invoice: i }) => {
      if (i.status === 'a_declarer' || i.status === 'refuse') {
        aDeclarer += 1;
        return;
      }
      if (i.status === 'payee') encaisse[i.currency] = (encaisse[i.currency] ?? 0) + i.amount;
      if (i.status === 'facturee') {
        attente[i.currency] = (attente[i.currency] ?? 0) + i.amount;
        if (isOverdue(i, agency.paymentDays)) {
          retard[i.currency] = (retard[i.currency] ?? 0) + i.amount;
        }
      }
    });
    return { encaisse, attente, retard, aDeclarer };
  }, [allRows, agency.paymentDays]);

  const update = async (inv: CommissionInvoice, patch: Partial<CommissionInvoice>) => {
    setBusyId(inv.id);
    setError(null);
    const next = { ...inv, ...patch };
    const res = await saveInvoice(next);
    setBusyId(null);
    if (!res.ok) {
      setError(res.error ?? 'Mise à jour impossible.');
      return;
    }
    setInvoices((prev) => {
      const exists = prev.some((i) => i.id === inv.id);
      return exists ? prev.map((i) => (i.id === inv.id ? next : i)) : [...prev, next];
    });
    setPayingId(null);
  };

  if (loading) {
    return <div className="h-72 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  return (
    <div className="space-y-5">
      <div className="grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-3">
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Encaissé</p>
          <Money map={totals.encaisse} color="#86efac" />
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">En attente</p>
          <Money map={totals.attente} color="#C9A84C" />
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">Dont en retard</p>
          <Money map={totals.retard} color="#fca5a5" />
        </div>
        <div className="bg-[#111] border border-[#1f1f1f] rounded-2xl p-4">
          <p className="text-[10px] text-[#555] uppercase tracking-wider mb-1.5">
            Sans déclaration
          </p>
          <p className={`text-lg font-bold ${totals.aDeclarer > 0 ? 'text-[#888]' : 'text-[#333]'}`}>
            {totals.aDeclarer > 0 ? `${totals.aDeclarer} modèle${totals.aDeclarer > 1 ? 's' : ''}` : '—'}
          </p>
        </div>
      </div>

      <div className="flex flex-wrap gap-3 items-center">
        <select
          value={period}
          onChange={(e) => setPeriod(e.target.value)}
          className="px-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer"
        >
          {recentPeriods().map((p) => (
            <option key={p} value={p}>
              {periodOptionLabel(p)}
            </option>
          ))}
          <option value={ALL_PERIODS}>Toutes les périodes</option>
        </select>

        <div className="flex gap-1 bg-[#111] rounded-xl p-1 border border-[#222] flex-wrap">
          {FILTERS.map((f) => (
            <button
              key={f.id}
              onClick={() => setFilter(f.id)}
              className={`px-3 py-1.5 rounded-lg text-xs font-medium transition ${
                filter === f.id ? 'bg-[#C9A84C] text-black' : 'text-[#666] hover:text-[#999]'
              }`}
            >
              {f.label}
            </button>
          ))}
        </div>

        <div className="relative flex-1 min-w-48">
          <Search size={15} className="absolute left-3 top-1/2 -translate-y-1/2 text-[#444]" />
          <input
            value={query}
            onChange={(e) => setQuery(e.target.value)}
            placeholder="Modèle, numéro..."
            className="w-full pl-9 pr-3 py-2.5 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white placeholder:text-[#444] outline-none focus:border-[#C9A84C]/60"
          />
        </div>
        <span className="text-xs text-[#555]">{rows.length} ligne{rows.length > 1 ? 's' : ''}</span>
      </div>

      {error && <Banner kind="error" message={error} />}

      {sections.length === 0 ? (
        <Card className="overflow-hidden">
          <EmptyState title="Aucune ligne" subtitle="Change de période ou de filtre." />
        </Card>
      ) : (
        sections.map(({ platform, list, sub }) => (
          <div key={platform} className="space-y-2">
            <div className="flex items-center gap-3 px-1">
              <h3 className="text-sm font-semibold text-[#C9A84C]">{platform}</h3>
              <span className="text-xs text-[#555]">
                {list.length} ligne{list.length > 1 ? 's' : ''}
              </span>
              <span className="ml-auto flex gap-3">
                {Object.entries(sub)
                  .filter(([, v]) => v > 0)
                  .map(([cur, v]) => (
                    <span key={cur} className="text-xs text-[#888]">
                      facturé {formatMoney(v, cur as Currency)}
                    </span>
                  ))}
              </span>
            </div>

            <Card className="overflow-hidden">
          <div className="overflow-x-auto">
            <table className="w-full min-w-[1000px]">
              <thead>
                <tr className="border-b border-[#1f1f1f] bg-[#0d0d0d]">
                  {['Modèle', 'Période', 'Facture', 'Montant', 'Envoyée le', 'Échéance', 'Payée le', 'Statut', ''].map(
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
                {list.map(({ model, invoice: i, declared }) => {
                  const st = STATUS_STYLES[i.status as InvoiceStatus];
                  const late = isOverdue(i, agency.paymentDays);
                  const due = i.status === 'facturee' || i.status === 'payee' ? dueDateOf(i, agency.paymentDays) : '';
                  const issued = i.status === 'facturee' || i.status === 'payee';
                  return (
                    <tr
                      key={`${model.id}-${i.period}-${i.platform}`}
                      className={`border-b border-[#161616] last:border-b-0 hover:bg-[#141414] transition ${
                        declared ? '' : 'opacity-70'
                      }`}
                    >
                      <td className="px-4 py-3">
                        <p className="text-sm text-white">{model.name}</p>
                        {model.pseudo && <p className="text-[10px] text-[#555]">@{model.pseudo}</p>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888]">{periodLabel(i.period)}</td>
                      <td className="px-4 py-3">
                        <span className="text-sm font-medium text-[#C9A84C]">
                          {i.invoiceNumber || '—'}
                        </span>
                      </td>
                      <td className="px-4 py-3 text-sm font-semibold text-white whitespace-nowrap">
                        {i.amount > 0 ? formatMoney(i.amount, i.currency) : <span className="text-[#444]">—</span>}
                      </td>
                      <td className="px-4 py-3 text-sm text-[#888]">{fr(i.sentAt)}</td>
                      <td className="px-4 py-3">
                        <span className={`text-sm ${late ? 'text-red-300' : 'text-[#888]'}`}>
                          {fr(due)}
                        </span>
                        {late && (
                          <p className="text-[10px] text-red-400/80 flex items-center gap-1 mt-0.5">
                            <AlertTriangle size={10} />
                            {daysLate(i, agency.paymentDays)} j de retard
                          </p>
                        )}
                      </td>
                      <td className="px-4 py-3 text-sm text-emerald-400/80">{fr(i.paidAt)}</td>
                      <td className="px-4 py-3">
                        <span
                          className="px-2 py-1 rounded-lg text-[11px] font-medium border whitespace-nowrap"
                          style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
                        >
                          {STATUS_LABELS[i.status as InvoiceStatus]}
                        </span>
                      </td>
                      <td className="px-4 py-3">
                        {!issued ? (
                          <span className="text-[11px] text-[#444]">—</span>
                        ) : payingId === i.id ? (
                          <div className="flex items-center gap-2 min-w-56">
                            <TextInput
                              type="date"
                              value={payDate}
                              onChange={(e) => setPayDate(e.target.value)}
                              className="!py-1.5 !px-2 !text-xs !w-36"
                            />
                            <button
                              onClick={() => update(i, { status: 'payee', paidAt: payDate })}
                              disabled={busyId === i.id}
                              className="px-2.5 py-1 rounded-lg text-[11px] bg-emerald-500/15 text-emerald-300 border border-emerald-500/25 hover:bg-emerald-500/25 transition disabled:opacity-40"
                            >
                              Confirmer
                            </button>
                            <button
                              onClick={() => setPayingId(null)}
                              className="text-[11px] text-[#666] hover:text-white transition"
                            >
                              Annuler
                            </button>
                          </div>
                        ) : i.status === 'payee' ? (
                          <button
                            onClick={() => update(i, { status: 'facturee', paidAt: '' })}
                            disabled={busyId === i.id}
                            title="Annuler l'encaissement"
                            className="p-2 text-[#555] hover:text-white transition disabled:opacity-30"
                          >
                            <RotateCcw size={15} />
                          </button>
                        ) : (
                          <button
                            onClick={() => {
                              setPayDate(new Date().toISOString().slice(0, 10));
                              setPayingId(i.id);
                            }}
                            disabled={busyId === i.id}
                            className="inline-flex items-center gap-1.5 px-3 py-1.5 rounded-lg text-[11px] border border-[#2a2a2a] text-[#888] hover:text-emerald-300 hover:border-emerald-500/30 transition disabled:opacity-30"
                          >
                            <Check size={13} />
                            Paiement reçu
                          </button>
                        )}
                      </td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
            </Card>
          </div>
        ))
      )}

      <p className="text-[11px] text-[#444] leading-relaxed">
        Sur un mois donné, toutes tes modèles apparaissent, y compris celles qui n&apos;ont rien
        déclaré — grisées, statut « À déclarer ». L&apos;échéance est calculée depuis la date
        d&apos;envoi et le délai réglé dans Agence ({agency.paymentDays} jour
        {agency.paymentDays > 1 ? 's' : ''}). Une facture non envoyée n&apos;est jamais comptée en
        retard.
      </p>
    </div>
  );
}
