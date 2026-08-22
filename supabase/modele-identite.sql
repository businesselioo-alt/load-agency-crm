-- ============================================================
-- Fiche modèle — état civil et identifiants de plateforme
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Ces champs rejoignent crm_model_billing, qui contenait déjà l'adresse et les
-- coordonnées de facturation. Aucune colonne n'est déplacée ni renommée : la
-- comptabilité lit exactement les mêmes données qu'avant, seul l'écran de
-- saisie a été regroupé dans Management → Modèles.
--
-- usernames est un JSONB { "MYM": "...", "OF": "..." } : une créatrice n'a pas
-- le même identifiant partout, et une colonne unique obligeait à choisir.
-- ============================================================

ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS birth_date  TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS birth_place TEXT NOT NULL DEFAULT '',
  ADD COLUMN IF NOT EXISTS usernames   JSONB NOT NULL DEFAULT '{}'::jsonb;

-- Reprise de l'identifiant déjà saisi dans crm_models.username : on le range
-- sous la première plateforme de la créatrice plutôt que de le perdre.
UPDATE crm_model_billing b
   SET usernames = jsonb_build_object(COALESCE(m.platforms[1], 'MYM'), m.username)
  FROM crm_models m
 WHERE m.id = b.model_id
   AND b.usernames = '{}'::jsonb
   AND COALESCE(m.username, '') <> '';

-- Vérification : doit renvoyer 3 lignes
SELECT column_name
  FROM information_schema.columns
 WHERE table_name = 'crm_model_billing'
   AND column_name IN ('birth_date', 'birth_place', 'usernames')
 ORDER BY column_name;
