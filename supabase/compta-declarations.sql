-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 4 : déclarations des modèles
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- La modèle déclare le montant qu'elle a reçu et sa devise.
-- Le montant reste NON FACTURABLE tant qu'un admin ou un manager
-- ne l'a pas validé : c'est la base de calcul de la commission,
-- déclarée par la partie qui la paie.
-- ============================================================

-- La devise n'est plus une propriété de la modèle mais de chaque
-- déclaration : une même modèle peut être payée en USD un mois et
-- en EUR le suivant.
ALTER TABLE crm_model_billing DROP COLUMN IF EXISTS currency;

ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS declared_by   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS declared_at   TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validated_by  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS validated_at  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS refusal_note  TEXT NOT NULL DEFAULT '';

-- Statuts : a_declarer -> declare -> valide -> facturee -> payee
--                               \-> refuse (retour à la modèle)
UPDATE crm_commission_invoices SET status = 'a_declarer' WHERE status = 'a_facturer';
UPDATE crm_commission_invoices SET status = 'facturee'   WHERE status = 'envoyee';

ALTER TABLE crm_commission_invoices ALTER COLUMN status SET DEFAULT 'a_declarer';
