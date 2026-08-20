import { jsPDF } from 'jspdf';
import type { AgencySettings, CommissionInvoice, Currency, ModelBilling } from './compta';
import { addDays, bankBlock, billingDisplayName } from './compta';
import { LOGO_GOLD_PNG, LOGO_RATIO } from './logo-asset';

// ─────────────────────────────────────────────────────────────────────────────
// Facture de commission, mise en page calquée sur les factures Revolut
// Business que Load Agency émettait jusqu'ici, pour que les modèles
// reconnaissent le document.
//
// Police Helvetica standard (WinAnsi) : PDF léger, pas de police embarquée.
// Les symboles monétaires £ $ € existent dans cet encodage ; AUD est écrit
// « A$ », qui passe aussi.
// ─────────────────────────────────────────────────────────────────────────────

const INK: [number, number, number] = [17, 17, 17];
const MUTED: [number, number, number] = [110, 110, 110];
const RULE: [number, number, number] = [220, 220, 220];
const BOX: [number, number, number] = [245, 245, 245];
const BADGE: [number, number, number] = [15, 13, 10];
const GOLD: [number, number, number] = [201, 168, 76];

const PAGE_W = 210;
const PAGE_H = 297;
const M = 20;
const RIGHT = PAGE_W - M;

const SYMBOLS: Record<Currency, string> = { EUR: '€', USD: '$', GBP: '£', AUD: 'A$' };

/** Format anglo-saxon, celui des factures Revolut : £3,463.00 */
function money(amount: number, currency: Currency): string {
  const v = (Number(amount) || 0).toLocaleString('en-US', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${SYMBOLS[currency]}${v}`;
}

function enDate(iso: string): string {
  if (!iso) return '';
  const d = new Date(`${iso}T00:00:00`);
  if (Number.isNaN(d.getTime())) return iso;
  return d.toLocaleDateString('en-GB', { day: 'numeric', month: 'long', year: 'numeric' });
}

/** Libellé de période en anglais : '2026-07' -> 'July 2026'. Le document est en anglais. */
function enPeriod(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  return new Date(y, m - 1, 1).toLocaleDateString('en-GB', { month: 'long', year: 'numeric' });
}

/** Dernier jour de la période 'YYYY-MM' — la date de réalisation de la prestation. */
export function periodEndDate(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return '';
  return new Date(y, m, 0).toISOString().slice(0, 10);
}

export interface InvoiceContext {
  /** Les lignes de la facture — une par plateforme, regroupées sur un document. */
  lines: CommissionInvoice[];
  billing: ModelBilling;
  agency: AgencySettings;
  modelName: string;
}

export async function buildInvoicePdf(ctx: InvoiceContext): Promise<jsPDF> {
  const { lines, billing: b, agency: a, modelName } = ctx;
  const inv = lines[0];
  const doc = new jsPDF({ unit: 'mm', format: 'a4' });
  const cur = inv.currency;
  const total = Math.round(lines.reduce((s, l) => s + l.amount, 0) * 100) / 100;

  // ── En-tête ────────────────────────────────────────────────────────────────
  const badgeR = 9;
  doc.setFillColor(...BADGE);
  doc.circle(M + badgeR, M + badgeR, badgeR, 'F');
  const logoW = 12.5;
  const logoH = logoW / LOGO_RATIO;
  doc.addImage(LOGO_GOLD_PNG, 'PNG', M + badgeR - logoW / 2, M + badgeR - logoH / 2, logoW, logoH);

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(24);
  doc.setTextColor(...INK);
  doc.text('Invoice', RIGHT, M + 10, { align: 'right' });

  // ── Métadonnées ────────────────────────────────────────────────────────────
  let y = M + 32;
  const labelX = M;
  const valueX = M + 42;
  const dueDate = a.paymentDays > 0 ? addDays(inv.issuedAt, a.paymentDays) : inv.issuedAt;

  const meta: [string, string][] = [
    ['Invoice Number:', inv.invoiceNumber || '—'],
    ['Issued on:', enDate(inv.issuedAt)],
    ['Due date:', enDate(dueDate)],
    ['Date of sale / supply:', enDate(periodEndDate(inv.period) || inv.issuedAt)],
  ];
  doc.setFontSize(9);
  meta.forEach(([label, value]) => {
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(...INK);
    doc.text(label, labelX, y);
    doc.text(value, valueX, y);
    y += 5.2;
  });

  // ── Parties ────────────────────────────────────────────────────────────────
  y += 10;
  const colW = (RIGHT - M - 10) / 2;
  const rightX = M + colW + 10;

  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Billed to', M, y);
  doc.text('From', rightX, y);

  y += 6;
  doc.setFontSize(9);

  const billedTo = [
    billingDisplayName(b, modelName),
    b.email,
    ...(b.hasCompany ? b.companyAddress : b.address).split('\n'),
  ]
    .map((l) => l.trim())
    .filter(Boolean);

  const from = [
    [a.name, a.legalForm].filter(Boolean).join(' '),
    ...a.address.split('\n'),
    a.taxId ? `Registration number: ${a.taxId}` : '',
    a.email,
  ]
    .map((l) => l.trim())
    .filter(Boolean);

  const writeParty = (lines: string[], x: number) => {
    let cursor = y;
    lines.forEach((l) => {
      const wrapped = doc.splitTextToSize(l, colW) as string[];
      wrapped.forEach((w) => {
        doc.text(w, x, cursor);
        cursor += 4.6;
      });
    });
    return cursor;
  };

  doc.setFont('helvetica', 'bold');
  const leftEnd = writeParty(billedTo.slice(0, 1), M);
  const rightEnd = writeParty(from.slice(0, 1), rightX);
  const secondY = Math.max(leftEnd, rightEnd);

  doc.setFont('helvetica', 'normal');
  doc.setTextColor(60, 60, 60);
  y = secondY;
  const l2 = writeParty(billedTo.slice(1), M);
  const r2 = writeParty(from.slice(1), rightX);
  y = Math.max(l2, r2) + 14;

  // ── Tableau ────────────────────────────────────────────────────────────────
  doc.setFont('helvetica', 'bold');
  doc.setFontSize(11);
  doc.setTextColor(...INK);
  doc.text('Item', M, y);
  y += 7;

  const colPrice = M + 105;
  const colQty = M + 130;
  const colTax = M + 152;

  doc.setFontSize(8.5);
  doc.text('Name / description', M, y);
  doc.text('Price', colPrice, y, { align: 'right' });
  doc.text('Quantity', colQty, y, { align: 'right' });
  doc.text('Tax rate', colTax, y, { align: 'right' });
  doc.text('Amount', RIGHT, y, { align: 'right' });

  y += 2.5;
  doc.setDrawColor(...RULE);
  doc.setLineWidth(0.3);
  doc.line(M, y, RIGHT, y);
  y += 6;

  lines.forEach((line, idx) => {
    if (idx > 0) y += 6;
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    const label = `${a.serviceLabel || 'Marketing service'}${
      lines.length > 1 ? ` — ${line.platform}` : ''
    }`;
    doc.text(label, M, y);
    doc.text(money(line.amount, cur), colPrice, y, { align: 'right' });
    doc.text('1', colQty, y, { align: 'right' });
    doc.text('-', colTax, y, { align: 'right' });
    doc.text(money(line.amount, cur), RIGHT, y, { align: 'right' });

    y += 4.5;
    doc.setFontSize(7.5);
    doc.setTextColor(...MUTED);
    doc.text(enPeriod(line.period), M, y);
  });

  y += 3;
  doc.setDrawColor(...RULE);
  doc.line(M, y, RIGHT, y);

  // ── Totaux ─────────────────────────────────────────────────────────────────
  y += 8;
  const totalsX = M + 105;
  doc.setFont('helvetica', 'normal');
  doc.setFontSize(9);
  doc.setTextColor(...INK);
  doc.text('Subtotal', totalsX, y);
  doc.text(money(total, cur), RIGHT, y, { align: 'right' });

  y += 3;
  doc.setDrawColor(...RULE);
  doc.line(totalsX, y, RIGHT, y);
  y += 6;

  doc.setFont('helvetica', 'bold');
  doc.text('Total', totalsX, y);
  doc.text(money(total, cur), RIGHT, y, { align: 'right' });

  // ── Note ───────────────────────────────────────────────────────────────────
  y += 10;
  const noteLines = [a.paymentTerms, a.vatMention, a.footerNote, inv.notes]
    .map((l) => (l ?? '').trim())
    .filter(Boolean);

  if (noteLines.length > 0) {
    const wrapped = noteLines.flatMap((l) => doc.splitTextToSize(l, RIGHT - M - 12) as string[]);
    const boxH = 12 + wrapped.length * 4.6;
    doc.setFillColor(...BOX);
    doc.rect(M, y, RIGHT - M, boxH, 'F');
    doc.setFont('helvetica', 'bold');
    doc.setFontSize(9);
    doc.setTextColor(...INK);
    doc.text('Invoice note', M + 6, y + 7);
    doc.setFont('helvetica', 'normal');
    doc.setTextColor(60, 60, 60);
    let ny = y + 13;
    wrapped.forEach((l) => {
      doc.text(l, M + 6, ny);
      ny += 4.6;
    });
    y += boxH + 8;
  }

  // ── Coordonnées de paiement ────────────────────────────────────────────────
  const bank = bankBlock(a, cur);
  if (bank.length > 0) {
    // Les coordonnées Revolut arrivent en sections séparées par une ligne
    // vide (compte local, puis SWIFT). On pose la première section et la
    // dernière sur toute la largeur, et les sections intermédiaires côte à
    // côte : sinon un bloc de 18 lignes pousse une deuxième page inutile.
    const groups: string[][] = [];
    let current: string[] = [];
    (a.bankAccounts[cur] ?? '').split('\n').forEach((raw) => {
      const line = raw.trim();
      if (!line) {
        if (current.length) groups.push(current);
        current = [];
      } else {
        current.push(line);
      }
    });
    if (current.length) groups.push(current);

    const head = groups.length > 2 ? groups[0] : [];
    const tail = groups.length > 3 ? groups[groups.length - 1] : [];
    const middle = groups.slice(head.length ? 1 : 0, tail.length ? groups.length - 1 : groups.length);

    const LH = 4.2;

    // hauteur nécessaire : titre + head + lignes des paires + tail
    let pairsHeight = 0;
    for (let i = 0; i < middle.length; i += 2) {
      pairsHeight += Math.max(middle[i].length, middle[i + 1]?.length ?? 0) * LH + 3;
    }
    const needed = 8 + head.length * LH + pairsHeight + tail.length * LH;

    if (y + needed > PAGE_H - 20) {
      doc.addPage();
      y = M;
    }

    doc.setFont('helvetica', 'bold');
    doc.setFontSize(11);
    doc.setTextColor(...INK);
    doc.text('Pay this invoice by bank transfer', M, y);
    y += 7;

    const writeGroup = (
      lines: string[],
      x: number,
      startY: number,
      width: number,
      boldFirst = false,
    ) => {
      let cursor = startY;
      lines.forEach((line, idx) => {
        const heading = boldFirst && idx === 0;
        doc.setFont('helvetica', heading ? 'bold' : 'normal');
        doc.setFontSize(heading ? 8 : 8.5);
        if (heading) doc.setTextColor(...INK);
        else doc.setTextColor(60, 60, 60);
        (doc.splitTextToSize(line, width) as string[]).forEach((w) => {
          doc.text(w, x, cursor);
          cursor += LH;
        });
      });
      return cursor;
    };

    if (head.length) y = writeGroup(head, M, y, RIGHT - M) + 3;

    const colW2 = (RIGHT - M - 8) / 2;
    for (let i = 0; i < middle.length; i += 2) {
      const left = writeGroup(middle[i], M, y, colW2, true);
      const right = middle[i + 1] ? writeGroup(middle[i + 1], M + colW2 + 8, y, colW2, true) : y;
      y = Math.max(left, right) + 3;
    }

    if (tail.length) y = writeGroup(tail, M, y, RIGHT - M);
  }

  // ── Pied de page ───────────────────────────────────────────────────────────
  const pages = doc.getNumberOfPages();
  for (let p = 1; p <= pages; p++) {
    doc.setPage(p);
    doc.setFont('helvetica', 'normal');
    doc.setFontSize(8);
    doc.setTextColor(...MUTED);
    doc.text(`Page ${p} of ${pages}`, M, PAGE_H - 12);
    doc.text(a.name, RIGHT, PAGE_H - 12, { align: 'right' });
  }

  return doc;
}

export function invoiceFileName(inv: CommissionInvoice, modelName: string): string {
  const slug = modelName
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .replace(/[^a-zA-Z0-9]+/g, '-')
    .replace(/^-|-$/g, '')
    .toLowerCase();
  return `${inv.invoiceNumber || 'invoice'}_${slug}.pdf`;
}

export async function downloadInvoicePdf(ctx: InvoiceContext): Promise<void> {
  const doc = await buildInvoicePdf(ctx);
  doc.save(invoiceFileName(ctx.lines[0], ctx.modelName));
}

export async function invoicePdfBlobUrl(ctx: InvoiceContext): Promise<string> {
  const doc = await buildInvoicePdf(ctx);
  return doc.output('bloburl').toString();
}
