-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 3 : suivi de facturation
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- Le PDF reste produit par Revolut Business. Le CRM calcule le
-- montant à facturer, prépare les infos à coller, et suit le
-- statut. La numérotation vient de Revolut (INV-164, ...) : elle
-- est saisie ici, pas générée, pour qu'il n'existe qu'une seule
-- série de factures.
-- ============================================================

-- 1. Devise par modèle (les modèles UK facturent en GBP, les FR en EUR)
ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS currency TEXT NOT NULL DEFAULT 'EUR';

-- 2. Une ligne par modèle et par période
CREATE TABLE IF NOT EXISTS crm_commission_invoices (
  id              TEXT PRIMARY KEY,
  model_id        TEXT NOT NULL,
  period          TEXT NOT NULL,              -- 'YYYY-MM'

  gross_amount    NUMERIC NOT NULL DEFAULT 0, -- CA brut de la modèle sur la période
  commission_rate NUMERIC NOT NULL DEFAULT 20,
  amount          NUMERIC NOT NULL DEFAULT 0, -- ce que l'agence facture
  currency        TEXT    NOT NULL DEFAULT 'EUR',

  invoice_number  TEXT    NOT NULL DEFAULT '', -- n° Revolut, ex. INV-164
  status          TEXT    NOT NULL DEFAULT 'a_facturer', -- a_facturer | envoyee | payee
  issued_at       TEXT    NOT NULL DEFAULT '',
  paid_at         TEXT    NOT NULL DEFAULT '',
  notes           TEXT    NOT NULL DEFAULT '',

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, period)
);

CREATE INDEX IF NOT EXISTS idx_commission_invoices_period
  ON crm_commission_invoices (period DESC);

ALTER TABLE crm_commission_invoices ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS temp_anon_all ON crm_commission_invoices;
CREATE POLICY temp_anon_all ON crm_commission_invoices
  FOR ALL USING (true) WITH CHECK (true);
