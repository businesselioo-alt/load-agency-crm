-- ============================================================
-- Load Agency CRM — Compta Modèle : un compte bancaire par devise
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- LoadScale LLC dispose d'un compte par devise. Chaque facture est
-- émise dans la devise où la modèle a été payée, avec le bloc
-- bancaire correspondant. Plus aucune conversion : ni taux à figer,
-- ni frais de change subis par la modèle.
-- ============================================================

ALTER TABLE crm_agency_settings
  ADD COLUMN IF NOT EXISTS bank_eur TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_usd TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_gbp TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS bank_aud TEXT NOT NULL DEFAULT '';

-- Reprise de l'ancien champ unique vers le compte USD, s'il était rempli.
UPDATE crm_agency_settings
   SET bank_usd = bank_details
 WHERE bank_usd = '' AND COALESCE(bank_details, '') <> '';
