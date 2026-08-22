-- ============================================================
-- Suivi Contenu — les catégories deviennent les dossiers réels du Drive
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Le CRM n'impose plus sa liste de 8 catégories : il recopie l'arborescence de
-- chaque créatrice, rafraîchie à chaque synchronisation. La clé d'une catégorie
-- devient l'identifiant Drive du dossier — stable même si la modèle le renomme,
-- contrairement au nom.
--
-- Le chiffre de tête (« 4- NUDE PICS ») ne sert plus d'identifiant, seulement
-- d'ordre d'affichage et de correspondance entre créatrices : « le dossier 4 »
-- désigne la même chose chez toutes, ce qui permet d'adresser une demande
-- groupée sans supposer que leurs dossiers portent le même identifiant.
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_model_folder (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    TEXT NOT NULL,
  folder_id   TEXT NOT NULL,
  name        TEXT NOT NULL DEFAULT '',
  position    INTEGER NOT NULL DEFAULT 999,
  updated_at  TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE (model_id, folder_id)
);

CREATE INDEX IF NOT EXISTS crm_model_folder_model_idx
  ON crm_model_folder (model_id, position);

ALTER TABLE crm_model_folder ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temp_anon_all ON crm_model_folder;
CREATE POLICY temp_anon_all ON crm_model_folder FOR ALL USING (true) WITH CHECK (true);

-- Demandes : rang du dossier visé, et intitulé libre pour une demande
-- personnalisée qui ne correspond à aucun dossier.
ALTER TABLE crm_content_request
  ADD COLUMN IF NOT EXISTS folder_position INTEGER NOT NULL DEFAULT 0,
  ADD COLUMN IF NOT EXISTS custom_label    TEXT NOT NULL DEFAULT '';

-- ============================================================
-- Purge des dépôts rangés sous les anciennes clés
-- ============================================================
-- Ces lignes portent 'scripts', 'nude_pics'… au lieu d'un identifiant Drive.
-- Elles seraient orphelines une fois l'arborescence réelle connue. Rien n'est
-- perdu : le Drive reste la source, une resynchronisation les reconstruit à
-- l'identique. On ne touche pas aux saisies manuelles rattachées à une demande.
DELETE FROM crm_content_log
 WHERE source = 'drive'
   AND category IN ('scripts','feed','dressed_pics','nude_pics','nude_vids','collab','feet','marketing');

-- Vérification : doit renvoyer 3 lignes
SELECT 'crm_model_folder' AS objet FROM information_schema.tables WHERE table_name = 'crm_model_folder'
UNION ALL
SELECT column_name FROM information_schema.columns
 WHERE table_name = 'crm_content_request' AND column_name IN ('folder_position','custom_label');
