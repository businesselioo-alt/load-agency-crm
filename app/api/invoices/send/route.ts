import { NextResponse } from 'next/server';
import {
  loadAgency, loadBillingFor, loadInvoices, missingFields, safeLoadModels,
  agencyMissingFields, buildGroups, hasBankAccount, isGroupBillable, saveGroup,
} from '@/lib/compta';
import { buildInvoicePdf, invoiceFileName } from '@/lib/pdf-invoice';
import { invoiceEmail } from '@/lib/email-invoice';

export const runtime = 'nodejs';
export const dynamic = 'force-dynamic';

/**
 * Envoi d'une facture par email.
 *
 * La route n'accepte QUE l'identifiant d'une facture. Le destinataire, le
 * montant et le PDF sont reconstruits ici depuis Supabase : le navigateur ne
 * peut ni changer l'adresse d'envoi, ni le montant, ni joindre un fichier
 * arbitraire. Sans cette contrainte, l'endpoint serait un relais à spam
 * capable d'envoyer au nom du domaine de l'agence.
 */
export async function POST(req: Request) {
  const apiKey = process.env.RESEND_API_KEY;
  const from = process.env.INVOICE_FROM_EMAIL;

  if (!apiKey || !from) {
    return NextResponse.json(
      {
        error:
          "Envoi d'email non configuré. Définissez RESEND_API_KEY et INVOICE_FROM_EMAIL dans les variables d'environnement.",
      },
      { status: 501 },
    );
  }

  let payload: { modelId?: string; period?: string; currency?: string };
  try {
    payload = await req.json();
  } catch {
    return NextResponse.json({ error: 'Corps de requête invalide.' }, { status: 400 });
  }

  const { modelId, period, currency } = payload;
  if (!modelId || !period) {
    return NextResponse.json({ error: 'Champs requis : modelId, period.' }, { status: 400 });
  }

  const [agency, billing, periodInvoices, models] = await Promise.all([
    loadAgency(),
    loadBillingFor(modelId),
    loadInvoices(period),
    safeLoadModels(),
  ]);

  const model = models.find((m) => m.id === modelId);
  if (!billing || !model) {
    return NextResponse.json({ error: 'Fiche modèle ou modèle introuvable.' }, { status: 404 });
  }

  // La facture regroupe toutes les plateformes de la modèle sur la période.
  const rows = Object.values(periodInvoices).filter(
    (i) => i.modelId === modelId && (!currency || i.currency === currency),
  );
  const group = buildGroups(rows)[0];
  if (!group) {
    return NextResponse.json({ error: 'Aucune ligne à facturer pour cette période.' }, { status: 404 });
  }
  const invoice = group.lines[0];

  // ── Garde-fous : on refuse d'envoyer un document incomplet ────────────────
  if (!isGroupBillable(group)) {
    return NextResponse.json(
      { error: "Toutes les lignes ne sont pas validées. Validez-les avant d'envoyer la facture." },
      { status: 409 },
    );
  }
  if (!group.invoiceNumber) {
    return NextResponse.json(
      { error: "La facture n'a pas encore de numéro. Générez-la d'abord." },
      { status: 409 },
    );
  }
  if (!billing.email) {
    return NextResponse.json(
      { error: "Aucun email sur la fiche de cette modèle." },
      { status: 409 },
    );
  }
  const modelMissing = missingFields(billing);
  if (modelMissing.length > 0) {
    return NextResponse.json(
      { error: `Fiche modèle incomplète : ${modelMissing.join(', ')}.` },
      { status: 409 },
    );
  }
  const agencyIssues = agencyMissingFields(agency);
  if (agencyIssues.length > 0) {
    return NextResponse.json(
      { error: `Paramètres agence incomplets : ${agencyIssues.join(', ')}.` },
      { status: 409 },
    );
  }
  if (!hasBankAccount(agency, group.currency)) {
    return NextResponse.json(
      { error: `Aucun compte ${group.currency} renseigné dans l'onglet Agence.` },
      { status: 409 },
    );
  }

  // ── PDF ───────────────────────────────────────────────────────────────────
  let base64: string;
  try {
    const doc = await buildInvoicePdf({ lines: group.lines, billing, agency, modelName: model.name });
    base64 = Buffer.from(doc.output('arraybuffer')).toString('base64');
  } catch (e) {
    return NextResponse.json(
      { error: `Génération du PDF impossible : ${e instanceof Error ? e.message : 'erreur inconnue'}` },
      { status: 500 },
    );
  }

  // ── Envoi ─────────────────────────────────────────────────────────────────
  const [y, m] = period.split('-').map(Number);
  const periodLabelEn = new Date(y, (m || 1) - 1, 1).toLocaleDateString('en-GB', {
    month: 'long',
    year: 'numeric',
  });
  const mail = invoiceEmail(
    { ...invoice, invoiceNumber: group.invoiceNumber, amount: group.amount },
    billing,
    agency,
    model.name,
    periodLabelEn,
  );

  try {
    const res = await fetch('https://api.resend.com/emails', {
      method: 'POST',
      headers: {
        Authorization: `Bearer ${apiKey}`,
        'Content-Type': 'application/json',
      },
      body: JSON.stringify({
        from,
        to: [billing.email],
        reply_to: agency.email || undefined,
        subject: mail.subject,
        html: mail.html,
        text: mail.text,
        attachments: [
          { filename: invoiceFileName(invoice, model.name), content: base64 },
        ],
      }),
    });

    const body = (await res.json().catch(() => ({}))) as { id?: string; message?: string };
    if (!res.ok) {
      return NextResponse.json(
        { error: body.message ?? `Resend a répondu ${res.status}.` },
        { status: 502 },
      );
    }

    const now = new Date().toISOString().slice(0, 10);
    const saved = await saveGroup(group.lines, {
      status: 'facturee',
      issuedAt: group.issuedAt || now,
      sentAt: now,
      sentTo: billing.email,
    });

    return NextResponse.json({
      ok: true,
      id: body.id,
      to: billing.email,
      // L'email est parti même si l'écriture en base échoue : on le signale
      // plutôt que de laisser croire que rien ne s'est passé.
      warning: saved.ok ? undefined : `Email envoyé, mais statut non enregistré : ${saved.error}`,
    });
  } catch (e) {
    return NextResponse.json(
      { error: e instanceof Error ? e.message : 'Service email injoignable.' },
      { status: 502 },
    );
  }
}
