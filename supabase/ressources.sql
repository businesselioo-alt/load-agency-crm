-- ============================================================
-- Ressources — bibliothèque de liens de l'agence
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Une seule liste partagée. L'ancien onglet Ressources gardait ses liens dans
-- l'état React : tout disparaissait au rechargement, et personne d'autre ne les
-- voyait jamais. Ici, ce que l'agence ajoute est visible par toute l'équipe et
-- par les créatrices dont for_models = true.
--
-- Les liens propres à une modèle (son Drive) ne vivent pas ici mais sur sa
-- fiche : une ressource est ce qui vaut pour tout le monde.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_resource (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  title       TEXT NOT NULL,
  url         TEXT NOT NULL,
  description TEXT NOT NULL DEFAULT '',
  category    TEXT NOT NULL DEFAULT '',
  for_models  BOOLEAN NOT NULL DEFAULT TRUE,
  sort_order  INTEGER NOT NULL DEFAULT 0,
  created_by  TEXT NOT NULL DEFAULT '',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_resource_order_idx ON crm_resource (sort_order, title);

ALTER TABLE crm_resource ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temp_anon_all ON crm_resource;
CREATE POLICY temp_anon_all ON crm_resource FOR ALL USING (true) WITH CHECK (true);

-- Première ressource. Le WHERE NOT EXISTS rend le script rejouable sans créer
-- de doublon si tu le relances.
INSERT INTO crm_resource (title, url, description, category, for_models, sort_order)
SELECT
  'Aide pour scripts',
  'https://potent-cry-847.notion.site/SCRIPT-ab573bc1ef664149b538ab3fda11273c',
  'Structures, accroches et exemples pour écrire tes scripts.',
  'Scripts',
  TRUE,
  0
WHERE NOT EXISTS (
  SELECT 1 FROM crm_resource WHERE url LIKE '%ab573bc1ef664149b538ab3fda11273c%'
);

-- Vérification : doit renvoyer la ligne « Aide pour scripts »
SELECT title, category, for_models FROM crm_resource ORDER BY sort_order;
