'use client';

import { useEffect, useState } from 'react';
import { Save, AlertTriangle, Lock } from 'lucide-react';
import {
  AgencySettings, CURRENCIES, DEFAULT_AGENCY,
  agencyMissingFields, formatInvoiceNumber, loadAgency, saveAgency,
} from '@/lib/compta';
import { Card, Field, TextInput, TextArea, GoldButton, Banner, SectionTitle } from './ui';

const PLACEHOLDER_BANK = [
  'Account holder: LoadScale LLC',
  'Bank: Revolut Business',
  'IBAN: GB00 REVO 0000 0000 0000 00',
  'BIC / SWIFT: REVOGB21',
  'Routing number: 000000000',
  'Bank address: 7 Westferry Circus, London E14 4HD',
].join('\n');

export default function AgencyTab() {
  const [draft, setDraft] = useState<AgencySettings>(DEFAULT_AGENCY);
  const [loading, setLoading] = useState(true);
  const [saving, setSaving] = useState(false);
  const [feedback, setFeedback] = useState<{ kind: 'ok' | 'error'; message: string } | null>(null);

  useEffect(() => {
    (async () => {
      setDraft(await loadAgency());
      setLoading(false);
    })();
  }, []);

  const patch = (p: Partial<AgencySettings>) => setDraft((d) => ({ ...d, ...p }));

  const submit = async () => {
    setSaving(true);
    setFeedback(null);
    const res = await saveAgency(draft);
    setSaving(false);
    setFeedback(
      res.ok
        ? { kind: 'ok', message: 'Paramètres enregistrés.' }
        : { kind: 'error', message: res.error ?? "Échec de l'enregistrement." },
    );
  };

  if (loading) {
    return <div className="h-96 bg-[#111] rounded-2xl border border-[#1f1f1f] animate-pulse" />;
  }

  const missing = agencyMissingFields(draft);

  return (
    <div className="max-w-4xl space-y-5">
      {missing.length > 0 && (
        <div className="flex gap-2 px-4 py-3 rounded-xl border border-amber-500/25 bg-amber-500/10 text-amber-300 text-sm">
          <AlertTriangle size={16} className="flex-shrink-0 mt-0.5" />
          <span>Champs manquants pour émettre une facture : {missing.join(', ')}.</span>
        </div>
      )}

      <Card className="p-6">
        <SectionTitle>Émetteur</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          <Field label="Raison sociale" required>
            <TextInput
              value={draft.name}
              onChange={(e) => patch({ name: e.target.value })}
              placeholder="LoadScale LLC"
            />
          </Field>
          <Field label="Forme juridique" hint="LLC, FZ-LLC, SASU...">
            <TextInput value={draft.legalForm} onChange={(e) => patch({ legalForm: e.target.value })} />
          </Field>
          <Field label="Adresse complète" required className="md:col-span-2">
            <TextArea
              rows={3}
              value={draft.address}
              onChange={(e) => patch({ address: e.target.value })}
              placeholder={'30 N Gould St\n82801-6317 Sheridan\nUnited States'}
            />
          </Field>
          <Field label="N° d'identification" hint="EIN, company number...">
            <TextInput value={draft.taxId} onChange={(e) => patch({ taxId: e.target.value })} />
          </Field>
          <Field label="Email" required hint="Expéditeur et contact des factures">
            <TextInput
              type="email"
              value={draft.email}
              onChange={(e) => patch({ email: e.target.value })}
              placeholder="billing@loadagency.com"
            />
          </Field>
          <Field label="Téléphone">
            <TextInput value={draft.phone} onChange={(e) => patch({ phone: e.target.value })} />
          </Field>
        </div>
      </Card>

      <Card className="p-6">
        <SectionTitle>Coordonnées bancaires par devise</SectionTitle>
        <div className="flex gap-2 mb-4 px-3 py-2.5 rounded-xl border border-[#222] bg-[#0f0f0f] text-[11px] text-[#666]">
          <Lock size={13} className="flex-shrink-0 mt-0.5" />
          <span>
            Chaque facture porte le bloc de la devise dans laquelle elle est émise. Ces
            informations apparaissent en clair sur les factures envoyées à tes modèles.
          </span>
        </div>
        <div className="space-y-5">
          {CURRENCIES.map((c) => (
            <Field
              key={c}
              label={`Compte ${c}`}
              hint={`Imprimé sur les factures émises en ${c}`}
            >
              <TextArea
                rows={6}
                value={draft.bankAccounts[c]}
                onChange={(e) =>
                  patch({ bankAccounts: { ...draft.bankAccounts, [c]: e.target.value } })
                }
                placeholder={c === 'USD' ? PLACEHOLDER_BANK : `Coordonnées du compte ${c}`}
              />
            </Field>
          ))}
        </div>
        <p className="text-[11px] text-[#555] mt-3">
          Dans Revolut, ouvre chaque compte puis « Account details » et colle le bloc ici. Une
          facture ne peut pas être émise dans une devise dont le compte est vide.
        </p>
      </Card>

      <Card className="p-6">
        <SectionTitle>Facturation</SectionTitle>
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <Field label="Préfixe">
            <TextInput
              value={draft.invoicePrefix}
              onChange={(e) => patch({ invoicePrefix: e.target.value.toUpperCase().slice(0, 6) })}
            />
          </Field>
          <Field
            label="Prochain numéro"
            hint={`Prochaine facture : ${formatInvoiceNumber(draft.invoicePrefix, draft.nextNumber)}`}
          >
            <TextInput
              type="number"
              min={1}
              value={draft.nextNumber}
              onChange={(e) => patch({ nextNumber: Number(e.target.value) })}
            />
          </Field>
          <Field label="Délai de paiement (jours)" hint="0 = paiement à réception">
            <TextInput
              type="number"
              min={0}
              max={120}
              value={draft.paymentDays}
              onChange={(e) => patch({ paymentDays: Number(e.target.value) })}
            />
          </Field>
          <Field label="Libellé de la prestation" className="md:col-span-3">
            <TextInput
              value={draft.serviceLabel}
              onChange={(e) => patch({ serviceLabel: e.target.value })}
              placeholder="Marketing service"
            />
          </Field>
          <Field label="Conditions de paiement" className="md:col-span-3">
            <TextInput
              value={draft.paymentTerms}
              onChange={(e) => patch({ paymentTerms: e.target.value })}
            />
          </Field>
          <Field label="Mention TVA" className="md:col-span-3">
            <TextInput value={draft.vatMention} onChange={(e) => patch({ vatMention: e.target.value })} />
          </Field>
          <Field label="Note de bas de facture" className="md:col-span-3">
            <TextInput value={draft.footerNote} onChange={(e) => patch({ footerNote: e.target.value })} />
          </Field>
        </div>
        <p className="text-[11px] text-amber-400/70 mt-4">
          La numérotation continue ta série Revolut. Vérifie le dernier numéro émis dans Revolut avant
          d&apos;enregistrer : deux factures portant le même numéro sont un problème comptable réel.
        </p>
      </Card>

      {feedback && <Banner kind={feedback.kind} message={feedback.message} />}

      <div className="flex justify-end">
        <GoldButton onClick={submit} disabled={saving}>
          <Save size={15} />
          {saving ? 'Enregistrement...' : 'Enregistrer'}
        </GoldButton>
      </div>
    </div>
  );
}
