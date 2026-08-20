-- ============================================================
-- Compta Modèle — une déclaration par plateforme
-- ============================================================
--
-- Une modèle présente sur OF et MYM reçoit deux paiements, dans deux
-- devises différentes. Elle déclare donc deux montants, et reçoit deux
-- factures : les coordonnées bancaires diffèrent selon la devise, on ne
-- peut pas les réunir sur un seul document.
-- ============================================================

ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS platform TEXT NOT NULL DEFAULT '';

-- Les lignes existantes reprennent la première plateforme de la modèle.
UPDATE crm_commission_invoices ci
   SET platform = COALESCE(
         (SELECT m.platforms[1] FROM crm_models m WHERE m.id = ci.model_id),
         'MYM')
 WHERE ci.platform = '';

-- La clé d'unicité devient (modèle, période, plateforme).
ALTER TABLE crm_commission_invoices
  DROP CONSTRAINT IF EXISTS crm_commission_invoices_model_id_period_key;

ALTER TABLE crm_commission_invoices
  DROP CONSTRAINT IF EXISTS crm_commission_invoices_model_period_platform_key;

ALTER TABLE crm_commission_invoices
  ADD CONSTRAINT crm_commission_invoices_model_period_platform_key
  UNIQUE (model_id, period, platform);
