-- ============================================================
-- Compta Modèle — devise de paiement de la modèle
-- ============================================================
--
-- Une facture porte un seul total et un seul bloc bancaire : deux lignes ne
-- tiennent sur le même document que si elles sont dans la même devise.
-- La devise à retenir est celle du compte bancaire de la modèle — elle
-- encaisse MYM et OF sur le même compte — et non celle de la plateforme.
--
-- Vide = on retombe sur la devise par défaut de la plateforme
-- (MYM → EUR, OF → USD, Reveal → USD).
-- ============================================================

ALTER TABLE crm_model_billing
  ADD COLUMN IF NOT EXISTS payout_currency TEXT NOT NULL DEFAULT '';
