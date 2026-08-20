-- ============================================================
-- Compta Modèle — toutes les migrations en retard, en un seul bloc
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
-- Idempotent : peut être relancé sans risque, les colonnes déjà
-- présentes sont ignorées.
-- ============================================================

-- 1. Une déclaration par plateforme
ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT '';

UPDATE crm_commission_invoices ci
   SET platform = COALESCE(
         (SELECT m.platforms[1] FROM crm_models m WHERE m.id = ci.model_id),
         'MYM')
 WHERE ci.platform = '';

ALTER TABLE crm_commission_invoices
  DROP CONSTRAINT IF EXISTS crm_commission_invoices_model_id_period_key;
ALTER TABLE crm_commission_invoices
  DROP CONSTRAINT IF EXISTS crm_commission_invoices_model_period_platform_key;
ALTER TABLE crm_commission_invoices
  ADD CONSTRAINT crm_commission_invoices_model_period_platform_key
  UNIQUE (model_id, period, platform);

-- 2. Traçabilité de l'envoi email
ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS sent_at TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sent_to TEXT NOT NULL DEFAULT '';

-- 3. Taux de commission par plateforme
ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS commission_rates JSONB NOT NULL DEFAULT '{}'::jsonb;

-- 4. Devise de paiement de la modèle
ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS payout_currency TEXT NOT NULL DEFAULT '';

-- ============================================================
-- Vérification : doit renvoyer 4 lignes
-- ============================================================
SELECT table_name, column_name
  FROM information_schema.columns
 WHERE (table_name = 'crm_model_billing'
        AND column_name IN ('commission_rates', 'payout_currency'))
    OR (table_name = 'crm_commission_invoices'
        AND column_name IN ('platform', 'sent_at'))
 ORDER BY table_name, column_name;
