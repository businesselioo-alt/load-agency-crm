import { supabase } from './supabase';
import { loadModels, MODELS, Model } from './data';

// ─────────────────────────────────────────────────────────────────────────────
// Module Compta Modèle — fiches de facturation des créatrices.
//
// Le % agence n'est pas dupliqué ici : il vit dans crm_models.commission.
// La fiche le lit et l'écrit à cet endroit, pour éviter deux sources de
// vérité qui divergeraient (le module Management l'utilise déjà).
// ─────────────────────────────────────────────────────────────────────────────

export type Currency = 'EUR' | 'USD' | 'GBP' | 'AUD';

export const CURRENCIES: Currency[] = ['EUR', 'USD', 'GBP', 'AUD'];

export const CURRENCY_SYMBOLS: Record<Currency, string> = {
  EUR: '\u20AC', USD: '$', GBP: '\u00A3', AUD: 'A$',
};

/** Montant formaté à la française : £3 463,00 */
export function formatMoney(amount: number, currency: Currency): string {
  const value = (Number(amount) || 0).toLocaleString('fr-FR', {
    minimumFractionDigits: 2,
    maximumFractionDigits: 2,
  });
  return `${CURRENCY_SYMBOLS[currency]}${value}`;
}

/** Arrondi comptable à 2 décimales. */
export function round2(n: number): number {
  return Math.round((Number(n) + Number.EPSILON) * 100) / 100;
}

export interface ModelBilling {
  modelId: string;
  firstName: string;
  lastName: string;
  email: string;
  address: string;
  hasCompany: boolean;
  companyName: string;
  companyType: string;
  companyAddress: string;
}

export function emptyBilling(modelId: string, fullName = ''): ModelBilling {
  const parts = fullName.trim().split(/\s+/);
  return {
    modelId,
    firstName: parts[0] ?? '',
    lastName: parts.slice(1).join(' '),
    email: '',
    address: '',
    hasCompany: false,
    companyName: '',
    companyType: '',
    companyAddress: '',
  };
}

/** Suggestions du champ « type d'entreprise » — liste ouverte, pas un enum. */
export const COMPANY_TYPES = [
  'Auto-entrepreneur',
  'EI',
  'EURL',
  'SASU',
  'SARL',
  'SAS',
  'Ltd',
  'LLC',
  'FZ-LLC',
  'Sole trader',
  'Freelance',
];

/** Le nom qui doit apparaître sur une facture pour cette fiche. */
export function billingDisplayName(b: ModelBilling, fallback = ''): string {
  if (b.hasCompany && b.companyName.trim()) return b.companyName.trim();
  const person = `${b.firstName} ${b.lastName}`.trim();
  return person || fallback;
}

/** Champs manquants pour pouvoir émettre une facture propre. */
export function missingFields(b: ModelBilling): string[] {
  const missing: string[] = [];
  if (!b.firstName.trim()) missing.push('prénom');
  if (!b.lastName.trim()) missing.push('nom');
  if (!b.email.trim()) missing.push('email');
  if (!b.address.trim()) missing.push('adresse');
  if (b.hasCompany) {
    if (!b.companyName.trim()) missing.push("nom de l'entreprise");
    if (!b.companyType.trim()) missing.push("type d'entreprise");
    if (!b.companyAddress.trim()) missing.push("adresse de l'entreprise");
  }
  return missing;
}

// ─── Garde-fou réseau ────────────────────────────────────────────────────────
//
// Un appel Supabase injoignable peut rejeter — ou rester pendant sans jamais
// répondre — et le composant resterait bloqué sur son skeleton indéfiniment.
// Toutes les lectures passent par ici : en cas d'erreur ou de dépassement de
// délai, on retombe sur une valeur par défaut et l'interface s'affiche.

const READ_TIMEOUT_MS = 8000;

async function safeRead<T>(run: () => Promise<T>, fallback: T): Promise<T> {
  try {
    return await Promise.race([
      run(),
      new Promise<T>((resolve) => setTimeout(() => resolve(fallback), READ_TIMEOUT_MS)),
    ]);
  } catch {
    return fallback;
  }
}

export async function safeLoadModels(): Promise<Model[]> {
  return safeRead(loadModels, MODELS);
}

// ─── Mapping Supabase ────────────────────────────────────────────────────────

type Row = Record<string, unknown>;
const str = (v: unknown, d = '') => (typeof v === 'string' ? v : d);

function rowToBilling(r: Row): ModelBilling {
  return {
    modelId: str(r.model_id),
    firstName: str(r.first_name),
    lastName: str(r.last_name),
    email: str(r.email),
    address: str(r.address),
    hasCompany: r.has_company === true,
    companyName: str(r.company_name),
    companyType: str(r.company_type),
    companyAddress: str(r.company_address),
  };
}

function billingToRow(b: ModelBilling): Row {
  return {
    model_id: b.modelId,
    first_name: b.firstName.trim(),
    last_name: b.lastName.trim(),
    email: b.email.trim(),
    address: b.address.trim(),
    has_company: b.hasCompany,
    // Si la facturation société est décochée, on vide les champs société
    // plutôt que de garder des données fantômes qui réapparaîtraient.
    company_name: b.hasCompany ? b.companyName.trim() : '',
    company_type: b.hasCompany ? b.companyType.trim() : '',
    company_address: b.hasCompany ? b.companyAddress.trim() : '',
    updated_at: new Date().toISOString(),
  };
}

// ─── Accès données ───────────────────────────────────────────────────────────

export async function loadAllBilling(): Promise<Record<string, ModelBilling>> {
  return safeRead(async () => {
    const out: Record<string, ModelBilling> = {};
    const { data, error } = await supabase.from('crm_model_billing').select('*');
    if (!error && data) {
      (data as Row[]).forEach((r) => {
        const b = rowToBilling(r);
        if (b.modelId) out[b.modelId] = b;
      });
    }
    return out;
  }, {});
}

export interface SaveResult {
  ok: boolean;
  error?: string;
}

export async function saveBilling(b: ModelBilling): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_model_billing')
      .upsert(billingToRow(b), { onConflict: 'model_id' });
    if (error) {
      if (error.code === '42P01') {
        return {
          ok: false,
          error: "La table crm_model_billing n'existe pas encore. Exécutez supabase/compta-fiches.sql dans le SQL Editor.",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/**
 * Le % agence vit dans crm_models.commission — source de vérité partagée avec
 * le module Management.
 *
 * UPSERT et non UPDATE : si la table crm_models est vide (l'app retombe alors
 * sur la liste en dur du code), un UPDATE ne toucherait aucune ligne, ne
 * lèverait aucune erreur, et la valeur reviendrait à sa valeur d'origine au
 * rechargement — sans que personne ne comprenne pourquoi.
 */
export async function saveCommission(model: Model, rate: number): Promise<SaveResult> {
  try {
    const { data, error } = await supabase
      .from('crm_models')
      .upsert(
        {
          id: model.id,
          name: model.name,
          pseudo: model.pseudo,
          platforms: model.platforms,
          username: model.username,
          manager: model.manager,
          commission: rate,
          status: model.status,
          drive_link: model.driveLink ?? null,
          notion_link: model.notionLink ?? null,
          avatar: model.avatar ?? null,
        },
        { onConflict: 'id' },
      )
      .select('id');
    if (error) return { ok: false, error: error.message };
    if (!data || data.length === 0) {
      return { ok: false, error: "Aucune ligne écrite dans crm_models — vérifiez les policies RLS." };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Suivi de facturation.
//
// Le PDF est produit par Revolut Business — leur API ne permet pas de créer
// des factures. Le CRM calcule le montant, prépare les infos à coller dans
// Revolut, et suit le statut. Le numéro de facture vient de Revolut et est
// saisi ici : une seule série, pas de doublon de numérotation.
// ─────────────────────────────────────────────────────────────────────────────

export type InvoiceStatus =
  | 'a_declarer'  // la modèle n'a rien saisi
  | 'declare'     // saisi, en attente de validation
  | 'refuse'      // refusé, la modèle doit corriger
  | 'valide'      // montant validé, facturable
  | 'facturee'    // facture envoyée
  | 'payee';

export const STATUS_LABELS: Record<InvoiceStatus, string> = {
  a_declarer: 'À déclarer',
  declare: 'À valider',
  refuse: 'Refusé',
  valide: 'À facturer',
  facturee: 'Facturée',
  payee: 'Payée',
};

export const STATUS_STYLES: Record<InvoiceStatus, { text: string; bg: string; border: string }> = {
  a_declarer: { text: '#888888', bg: 'rgba(255,255,255,0.04)', border: 'rgba(255,255,255,0.10)' },
  declare:    { text: '#93c5fd', bg: 'rgba(30,64,175,0.20)',   border: 'rgba(147,197,253,0.25)' },
  refuse:     { text: '#fca5a5', bg: 'rgba(153,27,27,0.20)',   border: 'rgba(252,165,165,0.25)' },
  valide:     { text: '#C9A84C', bg: 'rgba(201,168,76,0.12)',  border: 'rgba(201,168,76,0.25)' },
  facturee:   { text: '#c4b5fd', bg: 'rgba(91,33,182,0.22)',   border: 'rgba(196,181,253,0.25)' },
  payee:      { text: '#86efac', bg: 'rgba(21,128,61,0.18)',   border: 'rgba(134,239,172,0.25)' },
};

/** Une déclaration n'est facturable qu'une fois validée. */
export function isBillable(status: InvoiceStatus): boolean {
  return status === 'valide' || status === 'facturee' || status === 'payee';
}

/** Libellé de prestation repris de vos factures Revolut. */
export const SERVICE_LABEL = 'Marketing service';

export interface CommissionInvoice {
  id: string;
  modelId: string;
  period: string;          // 'YYYY-MM'
  grossAmount: number;     // CA brut de la modèle sur la période
  commissionRate: number;
  amount: number;          // ce que l'agence facture
  currency: Currency;
  invoiceNumber: string;
  status: InvoiceStatus;
  issuedAt: string;
  paidAt: string;
  notes: string;
  sentAt: string;
  sentTo: string;
  fxRate: number;
  fxDate: string;
  fxSource: string;
  amountUsd: number;
  declaredBy: string;
  declaredAt: string;
  validatedBy: string;
  validatedAt: string;
  refusalNote: string;
}

export function emptyInvoice(
  modelId: string,
  period: string,
  commissionRate: number,
  currency: Currency,
): CommissionInvoice {
  return {
    id: `ci-${modelId}-${period}`,
    modelId,
    period,
    grossAmount: 0,
    commissionRate,
    amount: 0,
    currency,
    invoiceNumber: '',
    status: 'a_declarer',
    issuedAt: '',
    paidAt: '',
    notes: '',
    sentAt: '',
    sentTo: '',
    fxRate: 1,
    fxDate: '',
    fxSource: '',
    amountUsd: 0,
    declaredBy: '',
    declaredAt: '',
    validatedBy: '',
    validatedAt: '',
    refusalNote: '',
  };
}

/** Commission = CA brut × taux. C'est le montant que l'agence facture. */
export function computeCommission(grossAmount: number, rate: number): number {
  return round2(((Number(grossAmount) || 0) * (Number(rate) || 0)) / 100);
}

/** Libellé de période lisible : '2026-08' → 'Août 2026'. */
export function periodLabel(period: string): string {
  const [y, m] = period.split('-').map(Number);
  if (!y || !m) return period;
  const label = new Date(y, m - 1, 1).toLocaleDateString('fr-FR', { month: 'long', year: 'numeric' });
  return label.charAt(0).toUpperCase() + label.slice(1);
}

export function currentPeriod(d = new Date()): string {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}`;
}

/** Les 12 derniers mois, du plus récent au plus ancien. */
export function recentPeriods(count = 12, from = new Date()): string[] {
  return Array.from({ length: count }, (_, i) => {
    const d = new Date(from.getFullYear(), from.getMonth() - i, 1);
    return currentPeriod(d);
  });
}

/**
 * Bloc prêt à coller dans le formulaire de facture Revolut.
 * Le nom retenu est celui de la société si la facturation est au nom de
 * l'entreprise, sinon celui de la personne.
 */
export function revolutClipboard(
  b: ModelBilling,
  inv: CommissionInvoice,
  fallbackName: string,
): string {
  const name = billingDisplayName(b, fallbackName);
  const address = b.hasCompany ? b.companyAddress : b.address;
  return [
    name,
    b.email,
    address,
    '',
    `${SERVICE_LABEL} — ${formatMoney(inv.amount, inv.currency)}`,
    `Période : ${periodLabel(inv.period)}`,
  ]
    .filter((l) => l !== undefined)
    .join('\n');
}

function rowToInvoice(r: Row): CommissionInvoice {
  const num = (v: unknown, d = 0) => (v === null || v === undefined ? d : Number(v) || d);
  return {
    id: str(r.id),
    modelId: str(r.model_id),
    period: str(r.period),
    grossAmount: num(r.gross_amount),
    commissionRate: num(r.commission_rate, 20),
    amount: num(r.amount),
    currency: (str(r.currency, 'EUR') as Currency),
    invoiceNumber: str(r.invoice_number),
    status: (str(r.status, 'a_declarer') as InvoiceStatus),
    issuedAt: str(r.issued_at),
    paidAt: str(r.paid_at),
    notes: str(r.notes),
    sentAt: str(r.sent_at),
    sentTo: str(r.sent_to),
    fxRate: num(r.fx_rate, 1),
    fxDate: str(r.fx_date),
    fxSource: str(r.fx_source),
    amountUsd: num(r.amount_usd),
    declaredBy: str(r.declared_by),
    declaredAt: str(r.declared_at),
    validatedBy: str(r.validated_by),
    validatedAt: str(r.validated_at),
    refusalNote: str(r.refusal_note),
  };
}

function invoiceToRow(i: CommissionInvoice): Row {
  return {
    id: i.id,
    model_id: i.modelId,
    period: i.period,
    gross_amount: i.grossAmount,
    commission_rate: i.commissionRate,
    amount: i.amount,
    currency: i.currency,
    invoice_number: i.invoiceNumber.trim(),
    status: i.status,
    issued_at: i.issuedAt,
    paid_at: i.paidAt,
    notes: i.notes.trim(),
    sent_at: i.sentAt,
    sent_to: i.sentTo,
    fx_rate: i.fxRate,
    fx_date: i.fxDate,
    fx_source: i.fxSource,
    amount_usd: i.amountUsd,
    declared_by: i.declaredBy,
    declared_at: i.declaredAt,
    validated_by: i.validatedBy,
    validated_at: i.validatedAt,
    refusal_note: i.refusalNote.trim(),
    updated_at: new Date().toISOString(),
  };
}

export async function loadInvoices(period: string): Promise<Record<string, CommissionInvoice>> {
  return safeRead(async () => {
    const out: Record<string, CommissionInvoice> = {};
    const { data, error } = await supabase
      .from('crm_commission_invoices')
      .select('*')
      .eq('period', period);
    if (!error && data) {
      (data as Row[]).forEach((r) => {
        const i = rowToInvoice(r);
        if (i.modelId) out[i.modelId] = i;
      });
    }
    return out;
  }, {});
}

export async function saveInvoice(i: CommissionInvoice): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_commission_invoices')
      .upsert(invoiceToRow(i), { onConflict: 'model_id,period' });
    if (error) {
      if (error.code === '42P01') {
        return {
          ok: false,
          error: "La table crm_commission_invoices n'existe pas encore. Exécutez supabase/compta-facturation.sql dans le SQL Editor.",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

/**
 * Retrouve la fiche modèle correspondant à un utilisateur connecté.
 * Aucun lien explicite n'existe aujourd'hui entre crm_users et crm_models :
 * on rapproche par email de facturation, puis par nom complet. À remplacer
 * par une colonne model_id sur crm_users dès que possible.
 */
export function findModelForUser(
  models: Model[],
  billing: Record<string, ModelBilling>,
  user: { email?: string; name?: string } | null,
): Model | null {
  if (!user) return null;
  const email = (user.email ?? '').trim().toLowerCase();
  const name = (user.name ?? '').trim().toLowerCase();

  if (email) {
    const byEmail = models.find((m) => (billing[m.id]?.email ?? '').trim().toLowerCase() === email);
    if (byEmail) return byEmail;
  }
  if (name) {
    const byName = models.find((m) => m.name.trim().toLowerCase() === name);
    if (byName) return byName;
    const byPerson = models.find((m) => {
      const b = billing[m.id];
      if (!b) return false;
      return `${b.firstName} ${b.lastName}`.trim().toLowerCase() === name;
    });
    if (byPerson) return byPerson;
  }
  return null;
}

/** Toutes les périodes d'une seule modèle, pour sa vue Comptabilité. */
export async function loadInvoicesForModel(
  modelId: string,
): Promise<Record<string, CommissionInvoice>> {
  return safeRead(async () => {
    const out: Record<string, CommissionInvoice> = {};
    const { data, error } = await supabase
      .from('crm_commission_invoices')
      .select('*')
      .eq('model_id', modelId);
    if (!error && data) {
      (data as Row[]).forEach((r) => {
        const i = rowToInvoice(r);
        if (i.period) out[i.period] = i;
      });
    }
    return out;
  }, {});
}

// ─────────────────────────────────────────────────────────────────────────────
// Paramètres de l'agence — émetteur des factures de commission.
// Une seule ligne en base (id = 'default').
//
// La numérotation continue la série Revolut existante (INV-164, 165, ...) :
// une seule suite de factures, pas de doublon dans la comptabilité.
// ─────────────────────────────────────────────────────────────────────────────

export interface AgencySettings {
  name: string;
  legalForm: string;
  address: string;
  taxId: string;
  email: string;
  phone: string;
  bankAccounts: Record<Currency, string>;
  bankPdfUrl: string;
  invoicePrefix: string;
  nextNumber: number;
  serviceLabel: string;
  paymentDays: number;
  paymentTerms: string;
  vatMention: string;
  footerNote: string;
}

export const DEFAULT_AGENCY: AgencySettings = {
  name: 'LoadScale LLC',
  legalForm: '',
  address: '',
  taxId: '',
  email: '',
  phone: '',
  bankAccounts: { EUR: '', USD: '', GBP: '', AUD: '' },
  bankPdfUrl: '',
  invoicePrefix: 'INV',
  nextNumber: 164,
  serviceLabel: 'Marketing service',
  paymentDays: 0,
  paymentTerms: 'Thank you for your business.',
  vatMention: 'No VAT charged – US Company.',
  footerNote: 'Late payments may incur additional fees.',
};

/** Champs sans lesquels une facture ne peut pas partir. */
export function agencyMissingFields(a: AgencySettings): string[] {
  const missing: string[] = [];
  if (!a.name.trim()) missing.push('nom');
  if (!a.address.trim()) missing.push('adresse');
  if (!a.email.trim()) missing.push('email');
  const noAccount = CURRENCIES.filter((c) => !a.bankAccounts[c]?.trim());
  if (noAccount.length === CURRENCIES.length) missing.push('coordonnées bancaires');
  return missing;
}

export function formatInvoiceNumber(prefix: string, n: number): string {
  return `${(prefix || 'INV').toUpperCase()}-${n}`;
}

/**
 * Bloc bancaire de la devise facturée, imprimé ligne par ligne.
 * Retourne un tableau vide si le compte de cette devise n'est pas renseigné —
 * la facture est alors bloquée plutôt qu'émise sans coordonnées.
 */
export function bankBlock(a: AgencySettings, currency: Currency): string[] {
  return (a.bankAccounts[currency] ?? '')
    .split('\n')
    .map((l) => l.trim())
    .filter(Boolean);
}

export function hasBankAccount(a: AgencySettings, currency: Currency): boolean {
  return Boolean(a.bankAccounts[currency]?.trim());
}

function rowToAgency(r: Row): AgencySettings {
  const num = (v: unknown, d: number) => (v === null || v === undefined ? d : Number(v) || d);
  return {
    name: str(r.name, DEFAULT_AGENCY.name),
    legalForm: str(r.legal_form),
    address: str(r.address),
    taxId: str(r.tax_id),
    email: str(r.email),
    phone: str(r.phone),
    bankAccounts: {
      EUR: str(r.bank_eur),
      USD: str(r.bank_usd),
      GBP: str(r.bank_gbp),
      AUD: str(r.bank_aud),
    },
    bankPdfUrl: str(r.bank_pdf_url),
    invoicePrefix: str(r.invoice_prefix, 'INV'),
    nextNumber: num(r.next_number, 164),
    serviceLabel: str(r.service_label, DEFAULT_AGENCY.serviceLabel),
    paymentDays: num(r.payment_days, 0),
    paymentTerms: str(r.payment_terms, DEFAULT_AGENCY.paymentTerms),
    vatMention: str(r.vat_mention, DEFAULT_AGENCY.vatMention),
    footerNote: str(r.footer_note, DEFAULT_AGENCY.footerNote),
  };
}

function agencyToRow(a: AgencySettings): Row {
  return {
    id: 'default',
    name: a.name.trim(),
    legal_form: a.legalForm.trim(),
    address: a.address.trim(),
    tax_id: a.taxId.trim(),
    email: a.email.trim(),
    phone: a.phone.trim(),
    bank_eur: a.bankAccounts.EUR.trim(),
    bank_usd: a.bankAccounts.USD.trim(),
    bank_gbp: a.bankAccounts.GBP.trim(),
    bank_aud: a.bankAccounts.AUD.trim(),
    bank_pdf_url: a.bankPdfUrl.trim(),
    invoice_prefix: (a.invoicePrefix || 'INV').trim().toUpperCase(),
    next_number: a.nextNumber,
    service_label: a.serviceLabel.trim(),
    payment_days: a.paymentDays,
    payment_terms: a.paymentTerms.trim(),
    vat_mention: a.vatMention.trim(),
    footer_note: a.footerNote.trim(),
    updated_at: new Date().toISOString(),
  };
}

export async function loadAgency(): Promise<AgencySettings> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_agency_settings')
      .select('*')
      .eq('id', 'default')
      .maybeSingle();
    if (!error && data) return rowToAgency(data as Row);
    return DEFAULT_AGENCY;
  }, DEFAULT_AGENCY);
}

export async function saveAgency(a: AgencySettings): Promise<SaveResult> {
  try {
    const { error } = await supabase
      .from('crm_agency_settings')
      .upsert(agencyToRow(a), { onConflict: 'id' });
    if (error) {
      if (error.code === '42P01') {
        return {
          ok: false,
          error: "La table crm_agency_settings n'existe pas encore. Exécutez supabase/compta-agence.sql dans le SQL Editor.",
        };
      }
      return { ok: false, error: error.message };
    }
    return { ok: true };
  } catch (e) {
    return { ok: false, error: e instanceof Error ? e.message : 'Erreur réseau' };
  }
}

// ─────────────────────────────────────────────────────────────────────────────
// Conversion en USD.
//
// LoadScale LLC n'encaisse que sur un compte USD : toutes les factures sont
// donc émises en USD, quelle que soit la devise dans laquelle la modèle a été
// payée. Le taux est figé à la validation et imprimé sur la facture — une
// facture émise ne change jamais de montant.
// ─────────────────────────────────────────────────────────────────────────────

/**
 * Devise de consolidation. N'apparaît sur AUCUNE facture : chaque facture est
 * émise dans la devise de la modèle. Sert uniquement à afficher un total
 * agrégé lisible dans le CRM.
 */
export const REPORTING_CURRENCY: Currency = 'USD';

export interface FxQuote {
  rate: number;
  from: string;
  to: string;
  date: string;
  source: string;
}

export async function fetchFxRate(from: Currency): Promise<FxQuote | { error: string }> {
  if (from === REPORTING_CURRENCY) {
    return { rate: 1, from, to: REPORTING_CURRENCY, date: new Date().toISOString().slice(0, 10), source: 'identité' };
  }
  try {
    const res = await fetch(`/api/fx?from=${from}&to=${REPORTING_CURRENCY}`);
    const data = (await res.json()) as Partial<FxQuote> & { error?: string };
    if (!res.ok || typeof data.rate !== 'number') {
      return { error: data.error ?? 'Taux de change indisponible.' };
    }
    return {
      rate: data.rate,
      from,
      to: REPORTING_CURRENCY,
      date: data.date ?? '',
      source: data.source ?? 'BCE',
    };
  } catch {
    return { error: 'Service de taux injoignable.' };
  }
}

export function convertToUsd(amount: number, rate: number): number {
  return round2((Number(amount) || 0) * (Number(rate) || 0));
}

/** Total agrégé toutes devises, à titre indicatif dans le CRM uniquement. */
export async function consolidate(
  amounts: { amount: number; currency: Currency }[],
): Promise<number | null> {
  const byCurrency = new Map<Currency, number>();
  amounts.forEach(({ amount, currency }) => {
    byCurrency.set(currency, (byCurrency.get(currency) ?? 0) + amount);
  });
  let total = 0;
  for (const [currency, amount] of byCurrency) {
    const quote = await fetchFxRate(currency);
    if ('error' in quote) return null;
    total += amount * quote.rate;
  }
  return round2(total);
}

/**
 * Réserve le prochain numéro de facture et incrémente le compteur.
 *
 * Le compteur vit dans crm_agency_settings : deux validations simultanées
 * pourraient théoriquement obtenir le même numéro. À l'échelle d'une agence
 * où une seule personne facture, le risque est nul ; si plusieurs managers
 * facturent en parallèle, il faudra passer par une séquence Postgres.
 */
export async function takeNextInvoiceNumber(): Promise<{ number: string } | { error: string }> {
  const a = await loadAgency();
  const number = formatInvoiceNumber(a.invoicePrefix, a.nextNumber);
  const res = await saveAgency({ ...a, nextNumber: a.nextNumber + 1 });
  if (!res.ok) return { error: res.error ?? 'Impossible de réserver le numéro de facture.' };
  return { number };
}

/** Lecture ciblée d'une facture — utilisée côté serveur avant envoi. */
export async function loadInvoice(
  modelId: string,
  period: string,
): Promise<CommissionInvoice | null> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_commission_invoices')
      .select('*')
      .eq('model_id', modelId)
      .eq('period', period)
      .maybeSingle();
    if (!error && data) return rowToInvoice(data as Row);
    return null;
  }, null);
}

export async function loadBillingFor(modelId: string): Promise<ModelBilling | null> {
  return safeRead(async () => {
    const { data, error } = await supabase
      .from('crm_model_billing')
      .select('*')
      .eq('model_id', modelId)
      .maybeSingle();
    if (!error && data) return rowToBilling(data as Row);
    return null;
  }, null);
}
