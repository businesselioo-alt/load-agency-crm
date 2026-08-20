'use client';

import { useEffect, useMemo, useState } from 'react';
import { Send, Lock, AlertCircle, CheckCircle2 } from 'lucide-react';
import { Model } from '@/lib/data';
import { useAuth } from '@/contexts/AuthContext';
import {
  CommissionInvoice, Currency, CURRENCIES, ModelBilling,
  STATUS_LABELS, STATUS_STYLES,
  computeCommission, emptyInvoice, findModelForUser, formatMoney,
  loadAllBilling, loadInvoicesForModel, periodLabel, recentPeriods, safeLoadModels, saveInvoice,
} from '@/lib/compta';
import { Card, NumberInput, GoldButton, Banner, EmptyState } from './ui';

/**
 * Vue de la créatrice : elle déclare le montant qu'elle a reçu et sa devise.
 * Le montant reste modifiable tant qu'il n'est pas validé par l'agence.
 */
export default function DeclarationTab({ forModel }: { forModel?: Model | null }) {
  const { user } = useAuth();
  const [model, setModel] = useState<Model | null>(forModel ?? null);
  const [billing, setBilling] = useState<ModelBilling | null>(null);
  const [invoices, setInvoices] = useState<Record<string, CommissionInvoice>>({});
  const [loading, setLoading] = useState(true);
  const [busyPeriod, setBusyPeriod] = useState<string | null>(null);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      const [models, allBilling] = await Promise.all([safeLoadModels(), loadAllBilling()]);
      const me = forModel ?? findModelForUser(models, allBilling, user);
      setModel(me);
      setBilling(me ? allBilling[me.id] ?? null : null);
      if (me) setInvoices(await loadInvoicesForModel(me.id));
      setLoading(false);
    })();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [forModel, user?.email, user?.name]);

  const periods = useMemo(() => recentPeriods(6), []);

  const rowFor = (period: string): CommissionInvoice =>
    invoices[period] ?? emptyInvoice(model?.id ?? '', period, model?.commission ?? 20, 'EUR');

  const patch = (period: string, p: Partial<CommissionInvoice>) =>
    setInvoices((prev) => {
      const next = { ...rowFor(period), ...p };
      next.amount = computeCommission(next.grossAmount, next.commissionRate);
      return { ...prev, [period]: next };
    });

  const submit = async (period: string) => {
    const row = rowFor(period);
    if (row.grossAmount <= 0) {
      setFeedback({ kind: 'error', message: 'Saisis un montant supérieur à 0.' });
      return;
    }
    setBusyPeriod(period);
    setFeedback(null);
    const payload: CommissionInvoice = {
      ...row,
      status: 'declare',
      declaredBy: user?.name ?? '',
      declaredAt: new Date().toISOString().slice(0, 10),
      refusalNote: '',
    };
    const res = await saveInvoice(payload);
    setBusyPeriod(null);
    if (!res.ok) {
      setFeedback({ kind: 'error', message: res.error ?? "Échec de l'envoi." });
      return;
    }
    setInvoices((prev) => ({ ...prev, [period]: payload }));
    setFeedback({ kind: 'ok', message: `Montant de ${periodLabel(period)} transmis à l'agence.` });
  };

  if (loading) {
    return <div className="h-72 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  if (!model) {
    return (
      <Card className="p-10 text-center">
        <p className="text-white font-medium mb-1">Compte non rattaché à une modèle</p>
        <p className="text-[#666] text-sm max-w-md mx-auto">
          Ton compte n&apos;a pas pu être relié à une fiche modèle. Demande à un admin de renseigner
          ton email dans l&apos;onglet Fiches modèles, ou d&apos;utiliser exactement le même nom.
        </p>
      </Card>
    );
  }

  return (
    <div className="space-y-5">
      <Card className="p-5">
        <p className="text-sm text-white font-medium">{model.name}</p>
        <p className="text-xs text-[#555] mt-0.5">
          Commission agence : {model.commission} %
          {billing?.email ? ` · ${billing.email}` : ''}
        </p>
      </Card>

      {feedback && <Banner kind={feedback.kind} message={feedback.message} />}

      <Card className="overflow-hidden">
        {periods.length === 0 ? (
          <EmptyState title="Aucune période" />
        ) : (
          periods.map((period) => {
            const row = rowFor(period);
            const st = STATUS_STYLES[row.status];
            const locked = row.status === 'valide' || row.status === 'facturee' || row.status === 'payee';
            const pending = row.status === 'declare';

            return (
              <div key={period} className="border-b border-[#1a1a1a] last:border-b-0 px-4 md:px-5 py-4">
                <div className="flex flex-wrap items-center gap-3">
                  <div className="min-w-32">
                    <p className="text-sm font-medium text-white">{periodLabel(period)}</p>
                    <span
                      className="inline-block mt-1 px-2 py-0.5 rounded-md text-[10px] font-medium border"
                      style={{ color: st.text, backgroundColor: st.bg, borderColor: st.border }}
                    >
                      {STATUS_LABELS[row.status]}
                    </span>
                  </div>

                  <div className="flex items-end gap-2 flex-1 min-w-64">
                    <div>
                      <label className="block text-[10px] text-[#666] mb-1">Montant reçu</label>
                      <NumberInput
                        min={0}
                        step="0.01"
                        disabled={locked || pending}
                        value={row.grossAmount}
                        placeholder="0.00"
                        onValueChange={(n) => patch(period, { grossAmount: n })}
                        className="!w-36 !py-2"
                      />
                    </div>
                    <div>
                      <label className="block text-[10px] text-[#666] mb-1">Devise</label>
                      <select
                        disabled={locked || pending}
                        value={row.currency}
                        onChange={(e) => patch(period, { currency: e.target.value as Currency })}
                        className="px-3 py-2 bg-[#0f0f0f] border border-[#222] rounded-xl text-sm text-white outline-none focus:border-[#C9A84C]/60 cursor-pointer disabled:opacity-50"
                      >
                        {CURRENCIES.map((c) => (
                          <option key={c} value={c}>
                            {c}
                          </option>
                        ))}
                      </select>
                    </div>
                  </div>

                  <div className="text-right min-w-32">
                    <p className="text-[10px] text-[#666] mb-1">Commission agence</p>
                    <p className="text-sm font-semibold text-[#C9A84C]">
                      {formatMoney(row.amount, row.currency)}
                    </p>
                  </div>

                  <div className="min-w-36 flex justify-end">
                    {locked ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-[#555]">
                        <Lock size={13} />
                        Validé par l&apos;agence
                      </span>
                    ) : pending ? (
                      <span className="inline-flex items-center gap-1.5 text-xs text-blue-300/80">
                        <CheckCircle2 size={13} />
                        En attente
                      </span>
                    ) : (
                      <GoldButton
                        onClick={() => submit(period)}
                        disabled={busyPeriod === period}
                        className="!py-2 !px-3 !text-xs"
                      >
                        <Send size={13} />
                        {busyPeriod === period ? 'Envoi...' : 'Transmettre'}
                      </GoldButton>
                    )}
                  </div>
                </div>

                {row.status === 'refuse' && row.refusalNote && (
                  <div className="mt-3 flex gap-2 text-xs text-red-300/90">
                    <AlertCircle size={14} className="flex-shrink-0 mt-0.5" />
                    <span>Refusé par l&apos;agence : {row.refusalNote}</span>
                  </div>
                )}
              </div>
            );
          })
        )}
      </Card>

      <p className="text-[11px] text-[#444] leading-relaxed">
        Saisis le montant que tu as réellement reçu sur la période, dans la devise dans laquelle tu
        l&apos;as reçu. L&apos;agence valide le montant, puis émet la facture de commission. Une fois
        validé, le montant n&apos;est plus modifiable.
      </p>
    </div>
  );
}
