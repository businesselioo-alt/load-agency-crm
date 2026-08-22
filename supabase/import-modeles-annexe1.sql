-- ============================================================
-- Import des fiches créatrices — source : Annexe 1 « Model info »
-- À exécuter dans Supabase → SQL Editor → Run
-- ============================================================
--
-- Charlotte Grace est mise à jour ; les sept autres sont créées.
-- Le script est rejouable : ON CONFLICT met à jour au lieu de dupliquer.
--
-- ⚠️ Les mots de passe MYM / OF de l'annexe ne sont PAS repris ici, et il
-- n'existe volontairement aucune colonne pour les accueillir. Les stocker dans
-- une base dont les policies sont encore permissives, alimentée par une app
-- dont le dépôt est public, reviendrait à publier les accès de tes créatrices.
-- Ils doivent vivre dans un gestionnaire de mots de passe partagé.
--
-- Les identifiants m20 à m26 évitent toute collision avec la série existante
-- (m1 à m7). La prochaine créatrice ajoutée depuis le CRM prendra m27.
-- ============================================================

-- ─── 1. Charlotte Grace — mise à jour ────────────────────────────────────────

UPDATE crm_models
   SET platforms = ARRAY['MYM','OF'],
       status    = 'active'
 WHERE name ILIKE '%charlotte%grace%';

UPDATE crm_model_billing b
   SET first_name  = 'Charlotte',
       last_name   = 'Grace Mcknight',
       email       = 'Cgracem323@gmail.com',
       birth_date  = '2002-10-03',
       birth_place = 'Wodonga, Australia',
       address     = '15 Sunderland Crescent' || chr(10) || 'Seaford 5169' || chr(10) || 'South Australia, Australia',
       usernames   = jsonb_build_object('MYM', 'loujtf'),
       has_company     = TRUE,
       company_name    = 'C.G McKnight & R.L Stein',
       company_type    = 'Family partnership',
       company_address = '15 Sunderland Crescent' || chr(10) || 'Seaford 5169' || chr(10) || 'South Australia, Australia' || chr(10) || 'Reg. 19815106610'
  FROM crm_models m
 WHERE m.id = b.model_id AND m.name ILIKE '%charlotte%grace%';

-- ─── 2. Les sept nouvelles créatrices ────────────────────────────────────────

INSERT INTO crm_models (id, name, pseudo, platforms, username, manager, commission, status, sort_order) VALUES
  ('m20', 'Imogen Grace Margaret Bushby', '', ARRAY['OF','MYM'], 'loricampion',  'Sadie', 20, 'active', 20),
  ('m21', 'Kenzi Rex',                    '', ARRAY['OF','MYM'], 'Elodiemouvin', 'Sadie', 20, 'active', 21),
  ('m22', 'Annie Broadbent',              '', ARRAY['MYM'],      'mindymnp',     'Sadie', 20, 'active', 22),
  ('m23', 'Lucie Jaid McConnell',         '', ARRAY['MYM'],      'Aurorehrg',    'Sadie', 20, 'active', 23),
  ('m24', 'Angel''ee Crowden',            '', ARRAY['MYM'],      'violettehns',  'Sadie', 20, 'active', 24),
  ('m25', 'Emily Wakeling',               '', ARRAY['MYM','OF'], 'milavpy',      'Sadie', 20, 'active', 25),
  ('m26', 'Brianna Taylor',               '', ARRAY['MYM'],      'chloelpm',     'Sadie', 20, 'active', 26)
ON CONFLICT (id) DO UPDATE SET
  name       = EXCLUDED.name,
  platforms  = EXCLUDED.platforms,
  username   = EXCLUDED.username,
  status     = EXCLUDED.status;

INSERT INTO crm_model_billing
  (model_id, first_name, last_name, email, birth_date, birth_place, address,
   usernames, has_company, company_name, company_type, company_address)
VALUES
  ('m20', 'Imogen', 'Grace Margaret Bushby', 'Imogenbushbyy@gmail.com',
   '2005-08-15', 'Campbelltown, Australia',
   'Unit 3/35 Grant Avenue' || chr(10) || 'Hope Island, Queensland' || chr(10) || 'Australia',
   jsonb_build_object('OF', 'loricampion', 'MYM', 'lorinmp'),
   FALSE, '', '', ''),

  ('m21', 'Kenzi', 'Rex', 'kenzirex16@gmail.com',
   '2006-08-26', 'Colchester, UK',
   '44 St Anne''s Road' || chr(10) || 'CO15 3NG' || chr(10) || 'United Kingdom',
   jsonb_build_object('OF', 'Elodiemouvin', 'MYM', 'Elodiemnz'),
   FALSE, '', '', ''),

  ('m22', 'Annie', 'Broadbent', 'Annie.broadbentt@gmail.com',
   '2002-06-02', 'Manchester, UK',
   '3 Lymewood Drive' || chr(10) || 'Disley, SK12 2LD' || chr(10) || 'United Kingdom',
   jsonb_build_object('MYM', 'mindymnp'),
   FALSE, '', '', ''),

  ('m23', 'Lucie', 'Jaid McConnell', 'luciejaid1@gmail.com',
   '1997-06-01', 'Geelong, Australia',
   '22 John Dalley Drive' || chr(10) || 'Helensvale 4212' || chr(10) || 'Australia',
   jsonb_build_object('MYM', 'Aurorehrg'),
   TRUE, 'Lucie Jaid McConnell', 'Limited',
   '22 John Dalley Drive' || chr(10) || 'Helensvale 4212, Australia' || chr(10) || 'Reg. 50335136842'),

  ('m24', 'Angel''ee', 'Crowden', 'angelcrowden1@gmail.com',
   '1998-02-24', 'Brisbane, Australia',
   '21 Lyndon Road' || chr(10) || 'Capalaba 4157' || chr(10) || 'Australia',
   jsonb_build_object('MYM', 'violettehns'),
   TRUE, 'Crowden Enterprises Pty Limited', 'Pty limited',
   '21 Lyndon Road' || chr(10) || 'Capalaba 4157, Australia' || chr(10) || 'Reg. 686512989'),

  ('m25', 'Emily', 'Wakeling', 'xemilyxpaigex@gmail.com',
   '1994-04-26', 'Exeter, UK',
   '1 Elsanta Close' || chr(10) || 'Cheddar, BS27 3GL' || chr(10) || 'United Kingdom',
   jsonb_build_object('MYM', 'milavpy', 'OF', 'gemmawilson'),
   TRUE, 'EW Chic Digital Ltd', 'Limited',
   '14 St Stephens Mansions' || chr(10) || 'Mount Stuart Square, Cardiff Bay' || chr(10) || 'Cardiff, Wales, CF10 5LQ' || chr(10) || 'Reg. 15858461'),

  ('m26', 'Brianna', 'Taylor', 'briannataylor1973@gmail.com',
   '2002-10-06', 'Melrose, Australia',
   '301/3550 Main Beach Parade' || chr(10) || 'Main Beach, QLD 4217' || chr(10) || 'Australia',
   jsonb_build_object('MYM', 'chloelpm'),
   TRUE, 'Brianna Taylor', 'Sole trader',
   '301/3550 Main Beach Parade' || chr(10) || 'Main Beach, QLD 4217, Australia' || chr(10) || 'ABN 91623058924')

ON CONFLICT (model_id) DO UPDATE SET
  first_name      = EXCLUDED.first_name,
  last_name       = EXCLUDED.last_name,
  email           = EXCLUDED.email,
  birth_date      = EXCLUDED.birth_date,
  birth_place     = EXCLUDED.birth_place,
  address         = EXCLUDED.address,
  usernames       = EXCLUDED.usernames,
  has_company     = EXCLUDED.has_company,
  company_name    = EXCLUDED.company_name,
  company_type    = EXCLUDED.company_type,
  company_address = EXCLUDED.company_address;

-- ─── Vérification : doit renvoyer 8 lignes ───────────────────────────────────

SELECT m.id, m.name, m.platforms, b.email, b.birth_date, b.usernames
  FROM crm_models m
  LEFT JOIN crm_model_billing b ON b.model_id = m.id
 WHERE m.id IN ('m20','m21','m22','m23','m24','m25','m26')
    OR m.name ILIKE '%charlotte%grace%'
 ORDER BY m.sort_order;
