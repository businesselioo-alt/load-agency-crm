-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 5 : paramètres de l'agence
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- Une seule ligne (id = 'default') : l'émetteur des factures de
-- commission et ses coordonnées de règlement.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_agency_settings (
  id              TEXT PRIMARY KEY DEFAULT 'default',

  -- Émetteur
  name            TEXT NOT NULL DEFAULT 'LoadScale LLC',
  legal_form      TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',
  tax_id          TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  phone           TEXT NOT NULL DEFAULT '',

  -- Coordonnées de règlement : bloc libre, collé une fois, imprimé
  -- tel quel sur la facture. Pas d'extraction de PDF : une erreur d'un
  -- seul chiffre bloquerait un virement.
  bank_details    TEXT NOT NULL DEFAULT '',
  -- PDF officiel des coordonnées, joint à l'email (étape 7)
  bank_pdf_url    TEXT NOT NULL DEFAULT '',

  -- Facturation
  invoice_prefix  TEXT NOT NULL DEFAULT 'INV',
  next_number     INT  NOT NULL DEFAULT 164,
  service_label   TEXT NOT NULL DEFAULT 'Marketing service',
  payment_days    INT  NOT NULL DEFAULT 0,
  payment_terms   TEXT NOT NULL DEFAULT 'Thank you for your business.',
  vat_mention     TEXT NOT NULL DEFAULT 'No VAT charged – US Company.',
  footer_note     TEXT NOT NULL DEFAULT 'Late payments may incur additional fees.',

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

ALTER TABLE crm_agency_settings ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temp_anon_all ON crm_agency_settings;
CREATE POLICY temp_anon_all ON crm_agency_settings
  FOR ALL USING (true) WITH CHECK (true);

INSERT INTO crm_agency_settings (id) VALUES ('default')
ON CONFLICT (id) DO NOTHING;
