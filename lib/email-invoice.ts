import type { AgencySettings, CommissionInvoice, ModelBilling } from './compta';
import { billingDisplayName, formatMoney } from './compta';

/**
 * Email accompagnant la facture. Rédigé en anglais : les modèles sont au
 * Royaume-Uni, en France et en Australie, et la facture elle-même est en
 * anglais. Volontairement sobre — c'est un document comptable, pas une
 * campagne marketing.
 */
export function invoiceEmail(
  inv: CommissionInvoice,
  b: ModelBilling,
  a: AgencySettings,
  modelName: string,
  periodLabelEn: string,
): { subject: string; html: string; text: string } {
  const to = billingDisplayName(b, modelName);
  const amount = formatMoney(inv.amount, inv.currency);
  const subject = `Invoice ${inv.invoiceNumber} from ${a.name}`;

  const text = [
    `Hi ${b.firstName || to},`,
    '',
    `Please find attached invoice ${inv.invoiceNumber} for ${periodLabelEn}.`,
    '',
    `Amount due: ${amount}`,
    a.paymentDays > 0 ? `Payment terms: within ${a.paymentDays} days.` : 'Payment terms: on receipt.',
    '',
    'Bank transfer details are on the invoice. Please use the invoice number as payment reference.',
    '',
    a.name,
    a.email,
  ].join('\n');

  const html = `<!doctype html>
<html><body style="margin:0;padding:0;background:#f5f5f5;font-family:Helvetica,Arial,sans-serif;">
  <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="background:#f5f5f5;padding:32px 12px;">
    <tr><td align="center">
      <table role="presentation" width="100%" cellpadding="0" cellspacing="0" style="max-width:560px;background:#ffffff;border-radius:12px;padding:32px;">
        <tr><td style="font-size:15px;color:#111;line-height:1.6;">
          <p style="margin:0 0 16px;">Hi ${escapeHtml(b.firstName || to)},</p>
          <p style="margin:0 0 16px;">Please find attached invoice
            <strong>${escapeHtml(inv.invoiceNumber)}</strong> for ${escapeHtml(periodLabelEn)}.</p>
          <table role="presentation" cellpadding="0" cellspacing="0" style="width:100%;background:#faf7ef;border:1px solid #e8dcbb;border-radius:10px;padding:16px;margin:0 0 20px;">
            <tr><td style="font-size:13px;color:#6b6b6b;padding-bottom:4px;">Amount due</td></tr>
            <tr><td style="font-size:24px;font-weight:bold;color:#111;">${escapeHtml(amount)}</td></tr>
          </table>
          <p style="margin:0 0 16px;font-size:14px;color:#444;">
            ${a.paymentDays > 0
              ? `Payment is due within ${a.paymentDays} days.`
              : 'Payment is due on receipt.'}
            Bank transfer details are on the invoice — please use the invoice number as payment reference.
          </p>
          <p style="margin:24px 0 0;font-size:14px;color:#444;">
            ${escapeHtml(a.name)}<br/>
            <a href="mailto:${escapeHtml(a.email)}" style="color:#8a7327;">${escapeHtml(a.email)}</a>
          </p>
        </td></tr>
      </table>
    </td></tr>
  </table>
</body></html>`;

  return { subject, html, text };
}

function escapeHtml(v: string): string {
  return (v ?? '')
    .replace(/&/g, '&amp;')
    .replace(/</g, '&lt;')
    .replace(/>/g, '&gt;')
    .replace(/"/g, '&quot;');
}
