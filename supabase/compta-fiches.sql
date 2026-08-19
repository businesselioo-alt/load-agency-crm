-- ============================================================
-- Load Agency CRM — Compta Modèle, étape 2 : fiches de facturation
-- À exécuter dans le SQL Editor de Supabase
-- ============================================================
--
-- Le pourcentage agence n'est PAS stocké ici : il vit déjà dans
-- crm_models.commission. Le dupliquer créerait deux vérités qui
-- divergeraient. La fiche lit et écrit directement cette colonne.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_model_billing (
  model_id        TEXT PRIMARY KEY,

  -- Identité de la créatrice
  first_name      TEXT NOT NULL DEFAULT '',
  last_name       TEXT NOT NULL DEFAULT '',
  email           TEXT NOT NULL DEFAULT '',
  address         TEXT NOT NULL DEFAULT '',

  -- Facturation à une société plutôt qu'à la personne
  has_company     BOOLEAN NOT NULL DEFAULT FALSE,
  company_name    TEXT NOT NULL DEFAULT '',
  company_type    TEXT NOT NULL DEFAULT '',
  company_address TEXT NOT NULL DEFAULT '',

  updated_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ------------------------------------------------------------
-- RLS
-- Cette table contient des données personnelles (nom, adresse,
-- email). RLS est activée, contrairement aux tables existantes.
-- La policy ci-dessous est PERMISSIVE et temporaire : elle évite
-- de casser l'app tant que l'authentification se fait côté client.
-- À remplacer par des policies basées sur auth.uid() dès la
-- migration vers Supabase Auth.
-- ------------------------------------------------------------
ALTER TABLE crm_model_billing ENABLE ROW LEVEL SECURITY;

DROP POLICY IF EXISTS temp_anon_all ON crm_model_billing;
CREATE POLICY temp_anon_all ON crm_model_billing
  FOR ALL USING (true) WITH CHECK (true);

-- ------------------------------------------------------------
-- Amorce : une fiche vide par modèle existant, prénom/nom
-- pré-remplis depuis crm_models.name quand c'est possible.
-- ------------------------------------------------------------
INSERT INTO crm_model_billing (model_id, first_name, last_name)
SELECT
  id,
  split_part(name, ' ', 1),
  CASE
    WHEN POSITION(' ' IN name) > 0
      THEN TRIM(SUBSTRING(name FROM POSITION(' ' IN name) + 1))
    ELSE ''
  END
FROM crm_models
ON CONFLICT (model_id) DO NOTHING;
