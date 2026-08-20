-- ============================================================
-- Suivi Contenu — demandes de l'agence
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Une demande dit ce que l'agence attend : catégorie, quantité, échéance,
-- brief. Sa progression n'est pas saisie à la main — chaque dépôt livré depuis
-- la demande porte son identifiant, et la barre avance toute seule.
--
-- « Livrée » et « en retard » ne sont pas stockés : ils se déduisent du nombre
-- de dépôts rattachés et de la date du jour. Un statut calculé ne peut pas se
-- désynchroniser de la réalité.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_content_request (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    TEXT NOT NULL,
  category    TEXT NOT NULL,
  quantity    INTEGER NOT NULL DEFAULT 1,
  brief       TEXT NOT NULL DEFAULT '',
  due_at      DATE,
  priority    TEXT NOT NULL DEFAULT 'normale',
  status      TEXT NOT NULL DEFAULT 'ouverte',
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_content_request_model_idx
  ON crm_content_request (model_id, status);

-- Rattachement d'un dépôt à la demande à laquelle il répond.
ALTER TABLE crm_content_log
  ADD COLUMN IF NOT EXISTS request_id UUID;

CREATE INDEX IF NOT EXISTS crm_content_log_request_idx
  ON crm_content_log (request_id);

-- ⚠️ Policy permissive, comme le reste du CRM tant que l'authentification
-- Supabase n'est pas branchée.
ALTER TABLE crm_content_request ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temp_anon_all ON crm_content_request;
CREATE POLICY temp_anon_all ON crm_content_request FOR ALL USING (true) WITH CHECK (true);

-- Vérification : doit renvoyer 2 lignes
SELECT 'crm_content_request' AS objet, table_name AS nom
  FROM information_schema.tables WHERE table_name = 'crm_content_request'
UNION ALL
SELECT 'crm_content_log.request_id', column_name
  FROM information_schema.columns
 WHERE table_name = 'crm_content_log' AND column_name = 'request_id';
