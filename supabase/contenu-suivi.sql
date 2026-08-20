-- ============================================================
-- Suivi Contenu — journal des dépôts sur le Drive
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Le CRM ne stocke pas les fichiers. Il enregistre le fait qu'un contenu a été
-- déposé : catégorie, numéro, date, auteur. C'est ce journal qui alimente
-- l'alerte « nouveautés » côté agence.
--
-- La numérotation est continue par (modèle, catégorie) : Script 1, Script 2…
-- ============================================================

CREATE TABLE IF NOT EXISTS crm_content_log (
  id          UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  model_id    TEXT NOT NULL,
  category    TEXT NOT NULL,
  seq         INTEGER NOT NULL DEFAULT 0,
  label       TEXT NOT NULL DEFAULT '',
  added_at    DATE NOT NULL DEFAULT CURRENT_DATE,
  added_by    TEXT NOT NULL DEFAULT '',
  seen        BOOLEAN NOT NULL DEFAULT FALSE,
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

CREATE INDEX IF NOT EXISTS crm_content_log_model_idx
  ON crm_content_log (model_id, category, seq DESC);

CREATE INDEX IF NOT EXISTS crm_content_log_added_idx
  ON crm_content_log (added_at DESC);

-- Le lien Drive vit déjà dans crm_models.drive_link ; on s'assure qu'il existe.
ALTER TABLE crm_models
  ADD COLUMN IF NOT EXISTS drive_link TEXT;

-- ⚠️ Policy permissive, comme les autres tables du CRM tant que
-- l'authentification Supabase n'est pas branchée. À remplacer par une policy
-- par rôle le jour où on sécurise l'app.
ALTER TABLE crm_content_log ENABLE ROW LEVEL SECURITY;
DROP POLICY IF EXISTS temp_anon_all ON crm_content_log;
CREATE POLICY temp_anon_all ON crm_content_log FOR ALL USING (true) WITH CHECK (true);

-- Vérification : doit renvoyer 1 ligne
SELECT table_name FROM information_schema.tables WHERE table_name = 'crm_content_log';
