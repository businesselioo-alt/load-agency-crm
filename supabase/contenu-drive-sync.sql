-- ============================================================
-- Suivi Contenu — synchronisation automatique depuis Google Drive
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- drive_file_id porte l'idempotence de toute la chaîne : le script Drive peut
-- repasser sur les mêmes fichiers autant de fois qu'il veut, la base refuse le
-- second enregistrement. C'est volontairement en base et non dans le script —
-- un script qui perd sa mémoire ne doit pas pouvoir polluer le CRM.
--
-- L'index est PARTIEL (WHERE ... IS NOT NULL) pour que les dépôts saisis à la
-- main, qui n'ont pas de fichier Drive, ne se gênent pas entre eux.
-- ============================================================

ALTER TABLE crm_content_log
  ADD COLUMN IF NOT EXISTS drive_file_id TEXT,
  ADD COLUMN IF NOT EXISTS source TEXT NOT NULL DEFAULT 'crm';

CREATE UNIQUE INDEX IF NOT EXISTS crm_content_log_drive_file_key
  ON crm_content_log (drive_file_id)
  WHERE drive_file_id IS NOT NULL;

-- Vérification : doit renvoyer 2 lignes
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'crm_content_log'
   AND column_name IN ('drive_file_id', 'source')
 ORDER BY column_name;
