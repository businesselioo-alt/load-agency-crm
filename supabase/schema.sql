-- ============================================================
-- Load Agency CRM — Supabase Schema
-- Run this in the Supabase SQL Editor
-- ============================================================

-- ============================================================
-- 1. CRM Users
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_users (
  id          TEXT PRIMARY KEY,
  first_name  TEXT NOT NULL DEFAULT '',
  last_name   TEXT NOT NULL DEFAULT '',
  name        TEXT NOT NULL DEFAULT '',
  email       TEXT UNIQUE NOT NULL,
  password    TEXT NOT NULL,
  role        TEXT NOT NULL DEFAULT 'manager',
  modules     TEXT[] NOT NULL DEFAULT '{}',
  status      TEXT NOT NULL DEFAULT 'active',
  created_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 2. Models (creator profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_models (
  id           TEXT PRIMARY KEY,
  name         TEXT NOT NULL,
  pseudo       TEXT NOT NULL DEFAULT '',
  platforms    TEXT[] NOT NULL DEFAULT '{}',
  username     TEXT NOT NULL DEFAULT '',
  manager      TEXT NOT NULL DEFAULT '',
  commission   NUMERIC NOT NULL DEFAULT 20,
  status       TEXT NOT NULL DEFAULT 'active',
  drive_link   TEXT,
  notion_link  TEXT,
  avatar       TEXT,
  sort_order   INT NOT NULL DEFAULT 0
);

-- ============================================================
-- 3. Invoices
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_invoices (
  id        TEXT PRIMARY KEY,
  model_id  TEXT NOT NULL,
  amount    NUMERIC NOT NULL DEFAULT 0,
  platform  TEXT NOT NULL DEFAULT '',
  currency  TEXT NOT NULL DEFAULT 'EUR',
  date      TEXT NOT NULL DEFAULT '',
  notes     TEXT,
  period    TEXT NOT NULL DEFAULT '',
  created_at TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 4. Content tracking (suivi contenu)
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_content_tracking (
  id        BIGSERIAL PRIMARY KEY,
  model_id  TEXT NOT NULL,
  week      TEXT NOT NULL,
  photos    TEXT NOT NULL DEFAULT 'fait',
  videos    TEXT NOT NULL DEFAULT 'fait',
  stories   TEXT NOT NULL DEFAULT 'fait',
  reels     TEXT NOT NULL DEFAULT 'fait',
  UNIQUE(model_id, week)
);

-- ============================================================
-- 5. Schedule entries
-- ============================================================
CREATE TABLE IF NOT EXISTS crm_schedule (
  id          TEXT PRIMARY KEY,
  model_id    TEXT NOT NULL,
  date        TEXT NOT NULL,
  title       TEXT NOT NULL DEFAULT '',
  description TEXT,
  platform    TEXT NOT NULL DEFAULT '',
  type        TEXT NOT NULL DEFAULT 'post'
);

-- ============================================================
-- 6. Vue Globale — model stats (total subs etc.)
-- ============================================================
CREATE TABLE IF NOT EXISTS vg_model_stats (
  id                BIGSERIAL PRIMARY KEY,
  platform          TEXT NOT NULL,
  model_name        TEXT NOT NULL,
  total_subs        INT NOT NULL DEFAULT 0,
  subs_last_30_days INT NOT NULL DEFAULT 0,
  updated_at        TIMESTAMPTZ NOT NULL DEFAULT NOW(),
  UNIQUE(platform, model_name)
);

-- ============================================================
-- 7. Vue Globale — daily entries
-- ============================================================
CREATE TABLE IF NOT EXISTS vg_daily_entries (
  id          TEXT PRIMARY KEY,
  platform    TEXT NOT NULL,
  model_name  TEXT NOT NULL,
  date        TEXT NOT NULL,
  new_subs    INT NOT NULL DEFAULT 0,
  revenue     NUMERIC NOT NULL DEFAULT 0,
  note        TEXT NOT NULL DEFAULT '',
  UNIQUE(platform, model_name, date)
);

-- ============================================================
-- 8. SFS Planning slots (PlanningCalendar)
-- ============================================================
CREATE TABLE IF NOT EXISTS sfs_planning_slots (
  id              TEXT PRIMARY KEY,
  platform        TEXT NOT NULL,
  model_name      TEXT NOT NULL,
  date            TEXT NOT NULL,
  time            TEXT,
  partner_agency  TEXT NOT NULL DEFAULT '',
  partner_model   TEXT NOT NULL DEFAULT '',
  status          TEXT NOT NULL DEFAULT 'en_attente',
  created_at      TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 9. SFS Planning models (custom per platform)
-- ============================================================
CREATE TABLE IF NOT EXISTS sfs_planning_models (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  name        TEXT NOT NULL,
  color       TEXT NOT NULL DEFAULT '#a855f7',
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE(platform, name)
);

-- ============================================================
-- 10. SFS Marketing rows (the SFS tracking table)
-- ============================================================
CREATE TABLE IF NOT EXISTS sfs_rows (
  id                  TEXT PRIMARY KEY,
  platform            TEXT NOT NULL,
  pseudo              TEXT NOT NULL DEFAULT '',
  first_name          TEXT NOT NULL DEFAULT '',
  subscribers         INT NOT NULL DEFAULT 0,
  former_subscribers  INT NOT NULL DEFAULT 0,
  interested          INT,
  last_sfs            TEXT NOT NULL DEFAULT '',
  sfs1                JSONB,
  sfs2                JSONB,
  sfs3                JSONB,
  nudge_active        BOOLEAN NOT NULL DEFAULT false,
  sort_order          INT NOT NULL DEFAULT 0
);

-- ============================================================
-- 11. Chatting shift plans (individual assignment rows)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_shift_plans (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  date        TEXT NOT NULL,
  model_name  TEXT NOT NULL,
  shift       TEXT NOT NULL,
  chatter_id  TEXT,
  UNIQUE(platform, date, model_name, shift)
);

-- ============================================================
-- 12. Chatting recaps
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_recaps (
  id            TEXT PRIMARY KEY,
  date          TEXT NOT NULL,
  model_name    TEXT NOT NULL,
  shift         TEXT NOT NULL,
  platform      TEXT NOT NULL,
  chatter_id    TEXT NOT NULL,
  chatter_name  TEXT NOT NULL,
  ca_net        NUMERIC NOT NULL DEFAULT 0,
  messages      INT NOT NULL DEFAULT 0,
  note          TEXT NOT NULL DEFAULT '',
  submitted_at  TIMESTAMPTZ NOT NULL DEFAULT NOW()
);

-- ============================================================
-- 13. Chatters (profiles)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_chatters (
  id        TEXT PRIMARY KEY,
  name      TEXT NOT NULL,
  platforms TEXT[] NOT NULL DEFAULT '{}',
  status    TEXT NOT NULL DEFAULT 'active'
);

-- ============================================================
-- 14. Chat plan models (dynamic per platform)
-- ============================================================
CREATE TABLE IF NOT EXISTS chat_plan_models (
  id          BIGSERIAL PRIMARY KEY,
  platform    TEXT NOT NULL,
  name        TEXT NOT NULL,
  sort_order  INT NOT NULL DEFAULT 0,
  UNIQUE(platform, name)
);

-- ============================================================
-- PERMISSIONS — Allow anon key full access
-- ============================================================
GRANT USAGE ON SCHEMA public TO anon;
GRANT ALL ON ALL TABLES IN SCHEMA public TO anon;
GRANT ALL ON ALL SEQUENCES IN SCHEMA public TO anon;

-- Disable RLS (internal CRM with custom auth — no Supabase Auth)
ALTER TABLE crm_users              DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_models             DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_invoices           DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_content_tracking   DISABLE ROW LEVEL SECURITY;
ALTER TABLE crm_schedule           DISABLE ROW LEVEL SECURITY;
ALTER TABLE vg_model_stats         DISABLE ROW LEVEL SECURITY;
ALTER TABLE vg_daily_entries       DISABLE ROW LEVEL SECURITY;
ALTER TABLE sfs_planning_slots     DISABLE ROW LEVEL SECURITY;
ALTER TABLE sfs_planning_models    DISABLE ROW LEVEL SECURITY;
ALTER TABLE sfs_rows               DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_shift_plans       DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_recaps            DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_chatters          DISABLE ROW LEVEL SECURITY;
ALTER TABLE chat_plan_models       DISABLE ROW LEVEL SECURITY;

-- ============================================================
-- REALTIME — Enable for key tables
-- ============================================================
ALTER PUBLICATION supabase_realtime ADD TABLE vg_model_stats;
ALTER PUBLICATION supabase_realtime ADD TABLE vg_daily_entries;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_shift_plans;
ALTER PUBLICATION supabase_realtime ADD TABLE chat_recaps;
ALTER PUBLICATION supabase_realtime ADD TABLE sfs_planning_slots;
ALTER PUBLICATION supabase_realtime ADD TABLE crm_users;
ALTER PUBLICATION supabase_realtime ADD TABLE sfs_rows;

-- ============================================================
-- SEED DATA
-- ============================================================

-- CRM Users
INSERT INTO crm_users (id, first_name, last_name, name, email, password, role, modules, status, created_at) VALUES
  ('u1', 'Admin',     '',      'Admin',          'admin@loadagency.com',     'admin123',   'admin',     ARRAY['dashboard','models','invoices','marketing_mym','marketing_of','chatting','calendar','settings'], 'active', '2026-01-01T00:00:00Z'),
  ('u2', 'Sadie',     '',      'Sadie',          'sadie@loadagency.com',     'sadie123',   'manager',   ARRAY['dashboard','models','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z'),
  ('u3', 'Kate',      '',      'Kate',           'kate@loadagency.com',      'kate123',    'manager',   ARRAY['dashboard','models','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z'),
  ('u4', 'Charlotte', 'Grace', 'Charlotte Grace','charlotte@loadagency.com', 'model123',   'model',     ARRAY['dashboard','models'], 'active', '2026-01-01T00:00:00Z'),
  ('u5', 'Chatter',   '',      'Chatter',        'chatter@loadagency.com',   'chatter123', 'chatter',   ARRAY['dashboard','chatting'], 'active', '2026-01-01T00:00:00Z'),
  ('u6', 'Comptable', '',      'Comptable',      'compta@loadagency.com',    'compta123',  'compta',    ARRAY['dashboard','invoices'], 'active', '2026-01-01T00:00:00Z'),
  ('u7', 'Marketing', '',      'Marketing',      'marketing@loadagency.com', 'mkt123',     'marketing', ARRAY['dashboard','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO NOTHING;

-- Models
INSERT INTO crm_models (id, name, pseudo, platforms, username, manager, commission, status, drive_link, notion_link, sort_order) VALUES
  ('m1', 'Charlotte Grace', 'loujtf',      ARRAY['MYM','OF'],      'charlottegrace', 'Sadie', 20, 'active', 'https://drive.google.com', 'https://notion.so', 0),
  ('m2', 'Maisie H. Ward',  'miapka',      ARRAY['MYM'],           'maisiehward',    'Sadie', 20, 'active', 'https://drive.google.com', 'https://notion.so', 1),
  ('m3', 'Katy Blackham',   'eloisetms',   ARRAY['MYM'],           'katyblackham',   'Sadie', 20, 'active', 'https://drive.google.com', 'https://notion.so', 2),
  ('m4', 'Tiahne Davis',    'sarahjea',    ARRAY['MYM','Reveal'],  'tiahnedavis',    'Kate',  20, 'active', 'https://drive.google.com', 'https://notion.so', 3),
  ('m5', 'Kiara Sanders',   'chloebleue',  ARRAY['MYM','OF'],      'kiarasanders',   'Kate',  20, 'active', 'https://drive.google.com', 'https://notion.so', 4),
  ('m6', 'Jazz',            'lenajns',     ARRAY['MYM'],           'jazz',           'Sadie', 20, 'active', 'https://drive.google.com', 'https://notion.so', 5),
  ('m7', 'Georgia',         'manonvpa',    ARRAY['MYM'],           'georgia',        'Sadie', 20, 'active', 'https://drive.google.com', 'https://notion.so', 6)
ON CONFLICT (id) DO NOTHING;

-- Invoices
INSERT INTO crm_invoices (id, model_id, amount, platform, currency, date, period) VALUES
  ('inv1',  'm1', 3200, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv2',  'm1', 1800, 'OF',     'GBP', '2026-05-31', 'Mai 2026'),
  ('inv3',  'm2', 2400, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv4',  'm3', 1900, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv5',  'm4', 2100, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv6',  'm4',  950, 'Reveal', 'USD', '2026-05-31', 'Mai 2026'),
  ('inv7',  'm5', 2800, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv8',  'm5', 1500, 'OF',     'GBP', '2026-05-31', 'Mai 2026'),
  ('inv9',  'm6', 1600, 'MYM',    'EUR', '2026-05-31', 'Mai 2026'),
  ('inv10', 'm7', 1750, 'MYM',    'EUR', '2026-05-31', 'Mai 2026')
ON CONFLICT (id) DO NOTHING;

-- Content tracking
INSERT INTO crm_content_tracking (model_id, week, photos, videos, stories, reels) VALUES
  ('m1', '2026-W23', 'fait',      'fait',      'en_retard', 'fait'),
  ('m2', '2026-W23', 'fait',      'manquant',  'fait',      'manquant'),
  ('m3', '2026-W23', 'en_retard', 'fait',      'fait',      'fait'),
  ('m4', '2026-W23', 'fait',      'fait',      'fait',      'fait'),
  ('m5', '2026-W23', 'manquant',  'manquant',  'fait',      'en_retard'),
  ('m6', '2026-W23', 'fait',      'fait',      'fait',      'fait'),
  ('m7', '2026-W23', 'fait',      'en_retard', 'manquant',  'fait')
ON CONFLICT (model_id, week) DO NOTHING;

-- Default chatters
INSERT INTO chat_chatters (id, name, platforms, status) VALUES
  ('cp-marc', 'Marc', ARRAY['of','mym'], 'active'),
  ('cp-fana', 'Fana', ARRAY['of','mym'], 'active')
ON CONFLICT (id) DO NOTHING;

-- SFS Planning models (OF defaults)
INSERT INTO sfs_planning_models (platform, name, color, sort_order) VALUES
  ('of', 'Lou',    '#a855f7', 0),
  ('of', 'Margot', '#ec4899', 1),
  ('of', 'Jeanne', '#3b82f6', 2),
  ('of', 'Lucie',  '#10b981', 3),
  ('of', 'Lorie',  '#f97316', 4),
  ('of', 'Élodie', '#f43f5e', 5),
  ('of', 'Lilou',  '#6366f1', 6)
ON CONFLICT (platform, name) DO NOTHING;

-- SFS rows (MYM)
INSERT INTO sfs_rows (id, platform, pseudo, first_name, subscribers, former_subscribers, interested, last_sfs, sfs1, sfs2, sfs3, nudge_active, sort_order) VALUES
  ('mym1',  'mym', 'lenajns',      'Jazz',           16165, 15131, 21083, '08/06', '{"date":"11/06","chatter":"Abzerty","target":"Lou 16k4","status":"prévu"}', '{"date":"13/06","target":"Lou","status":"prévu"}', '{"date":"15/06","target":"Lou","status":"prévu"}', true,  0),
  ('mym2',  'mym', 'manonvpa',     'Georgia',         8278,  3060,  3544, '11/06', '{"date":"11/06","chatter":"Eud","target":"Léna 8k9","status":"fait"}',     '{"date":"13/06","target":"Léna","status":"prévu"}','{"date":"15/06","target":"Léna","status":"fait"}', true,  1),
  ('mym3',  'mym', 'paulineqrt',   'Hatty',           8501,  3080,  3483, '08/06', '{"date":"11/06","chatter":"Lucas","target":"Julie 10k","status":"prévu"}', '{"date":"13/06","target":"Julie","status":"prévu"}','{"date":"15/06","target":"Julie","status":"prévu"}',true, 2),
  ('mym4',  'mym', 'julievivi',    'Brianna Smith',   9751,  2324,  1543, '29/05', '{"date":"29/05","target":"Violette 6k3","status":"fait"}', null, null, true, 3),
  ('mym5',  'mym', 'aliceqsd',     'Jessica',         6877,  1647,  1357, '08/06', '{"date":"12/06","chatter":"Le R","target":"ChloéLpm 8k4","status":"prévu"}','{"date":"14/06","status":"prévu"}','{"date":"16/06","status":"prévu"}', false, 4),
  ('mym6',  'mym', 'sarahjea',     'Tiahne',          6397,  1378,   908, '09/06', '{"date":"12/06","chatter":"François","status":"prévu"}', '{"date":"14/06","status":"prévu"}', '{"date":"16/06","status":"prévu"}', false, 5),
  ('mym7',  'mym', 'eloisetms',    'Katy',            5756,  1215,   591, '09/06', '{"date":"12/06","chatter":"François","target":"Lou","status":"prévu"}', '{"date":"14/06","target":"Lou","status":"prévu"}', '{"date":"16/06","target":"Lou","status":"prévu"}', false, 6),
  ('mym8',  'mym', 'chloebleue',   'Kiara',           3719,   722,   331, '09/06', '{"date":"12/06","chatter":"Le R","target":"Léna","status":"prévu"}', '{"date":"14/06","target":"Léna","status":"prévu"}', '{"date":"16/06","target":"Léna","status":"prévu"}', false, 7),
  ('mym9',  'mym', 'eliseroee',    'Millie',          3840,   624,   417, '09/06', '{"date":"12/06","chatter":"François","target":"Julie","status":"prévu"}', '{"date":"14/06","target":"Julie","status":"prévu"}', '{"date":"16/06","target":"Julie","status":"prévu"}', false, 8),
  ('mym10', 'mym', 'loujtf',       'Charlotte',       7701,  1458,   916, '28/05', '{"date":"28/05","target":"Violette","status":"fait"}', null, null, true, 9),
  ('mym11', 'mym', 'milavpy',      'Emily',           3461,   625,   539, '07/06', '{"date":"12/06","chatter":"Matteo","target":"ChloéLpm","status":"prévu"}', '{"date":"14/06","status":"prévu"}', '{"date":"16/06","status":"prévu"}', false, 10),
  ('mym12', 'mym', 'emmacuty',     'Grace',           2434,   261,   143, '10/06', '{"date":"12/06","chatter":"Lucas","status":"prévu"}', '{"date":"14/06","status":"prévu"}', '{"date":"16/06","status":"prévu"}', false, 11),
  ('mym13', 'mym', 'lorienmp',     'Immy Grace',      3456,   390,   228, '07/06', '{"date":"12/06","chatter":"François","status":"prévu"}', '{"date":"14/06","status":"prévu"}', '{"date":"16/06","status":"prévu"}', false, 12),
  ('mym14', 'mym', 'edenlou',      'Holly',           1814,   221,    92, '07/06', '{"date":"12/06","chatter":"François","status":"prévu"}', '{"date":"14/06","status":"prévu"}', '{"date":"16/06","status":"prévu"}', false, 13),
  ('mym15', 'mym', 'elodie',       'Kenzi',           1334,   130,    61, '07/06', '{"date":"11/06","chatter":"Lucas","status":"prévu"}', '{"date":"13/06","status":"prévu"}', '{"date":"15/06","status":"prévu"}', false, 14),
  ('mym16', 'mym', 'chloelpm',     'Brianna Taylor',  2165,   152,   235, '07/06', '{"date":"11/06","chatter":"François","status":"prévu"}', '{"date":"13/06","status":"prévu"}', '{"date":"15/06","status":"prévu"}', false, 15),
  ('mym17', 'mym', 'jeannebourgot','Lylah',           3226,   265,   206, '07/06', '{"date":"07/06","status":"fait"}', null, null, true, 16),
  ('mym18', 'mym', 'ineshrg',      'Skye',            1153,   100,   123, '07/06', '{"date":"11/06","chatter":"HMSS","status":"prévu"}', '{"date":"13/06","status":"prévu"}', '{"date":"15/06","status":"prévu"}', false, 17),
  ('mym19', 'mym', 'violettehns',  'Angel',           2086,   169,   352, '07/06', '{"date":"07/06","status":"fait"}', null, null, false, 18),
  ('mym20', 'mym', 'lounarvp',     'Luize',           1675,    61,    43, '',      null, null, null, false, 19)
ON CONFLICT (id) DO NOTHING;

-- SFS rows (OF)
INSERT INTO sfs_rows (id, platform, pseudo, first_name, subscribers, former_subscribers, interested, last_sfs, sfs1, sfs2, sfs3, nudge_active, sort_order) VALUES
  ('of1', 'of', 'loujtf',    'Charlotte Grace', 4820, 890, 610, '05/06', '{"date":"12/06","chatter":"Le R","target":"Kiara OF","status":"prévu"}', '{"date":"16/06","target":"Kiara OF","status":"prévu"}', null, true, 0),
  ('of2', 'of', 'chloebleue','Kiara Sanders',   2180, 340, 218, '05/06', '{"date":"12/06","chatter":"Le R","target":"Charlotte OF","status":"prévu"}', '{"date":"16/06","target":"Charlotte OF","status":"prévu"}', null, false, 1)
ON CONFLICT (id) DO NOTHING;
