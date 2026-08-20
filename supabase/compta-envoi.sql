-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 7 : envoi des factures
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================

ALTER TABLE crm_commission_invoices
  ADD COLUMN IF NOT EXISTS sent_at TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS sent_to TEXT NOT NULL DEFAULT '';
