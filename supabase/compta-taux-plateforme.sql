-- ============================================================
-- Compta Modèle — un taux de commission par plateforme
-- ============================================================
--
-- Le taux peut différer selon la plateforme : 20 % sur MYM, 30 % sur OF.
-- crm_models.commission reste le taux par défaut, utilisé pour toute
-- plateforme sans taux spécifique.
-- ============================================================

ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS commission_rates JSONB NOT NULL DEFAULT '{}'::jsonb;
