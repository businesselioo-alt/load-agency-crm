-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 6 : conversion en USD
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- Toutes les factures sont émises en USD (LoadScale LLC n'a qu'un
-- compte USD). Le taux est FIGÉ au moment de la validation et
-- stocké ici : une facture ne doit pas changer de montant selon
-- le jour où on l'ouvre.
-- ============================================================

ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS fx_rate    NUMERIC NOT NULL DEFAULT 1,
  ADD COLUMN IF NOT EXISTS fx_date    TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS fx_source  TEXT    NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS amount_usd NUMERIC NOT NULL DEFAULT 0;
