INSERT INTO crm_users (id, first_name, last_name, name, email, password, role, modules, status, created_at)
VALUES
  ('u1', 'Admin',     '',      'Admin',     'admin@loadagency.com',     'admin123',    'admin',     ARRAY['dashboard','models','invoices','marketing_mym','marketing_of','chatting','calendar','settings'], 'active', '2026-01-01T00:00:00Z'),
  ('u2', 'Sadie',     '',      'Sadie',     'sadie@loadagency.com',     'sadie123',    'manager',   ARRAY['dashboard','models','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z'),
  ('u3', 'Kate',      '',      'Kate',      'kate@loadagency.com',      'kate123',     'manager',   ARRAY['dashboard','models','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z'),
  ('u4', 'Charlotte', 'Grace', 'Charlotte', 'charlotte@loadagency.com', 'charlotte123','model',     ARRAY['dashboard','models'], 'active', '2026-01-01T00:00:00Z'),
  ('u5', 'Chatter',   '',      'Chatter',   'chatter@loadagency.com',   'chatter123',  'chatter',   ARRAY['dashboard','chatting'], 'active', '2026-01-01T00:00:00Z'),
  ('u6', 'Comptable', '',      'Comptable', 'compta@loadagency.com',    'compta123',   'compta',    ARRAY['dashboard','invoices'], 'active', '2026-01-01T00:00:00Z'),
  ('u7', 'Marketing', '',      'Marketing', 'marketing@loadagency.com', 'marketing123','marketing', ARRAY['dashboard','marketing_mym','marketing_of','calendar'], 'active', '2026-01-01T00:00:00Z')
ON CONFLICT (id) DO UPDATE SET
  email    = EXCLUDED.email,
  password = EXCLUDED.password,
  role     = EXCLUDED.role,
  modules  = EXCLUDED.modules,
  status   = EXCLUDED.status;
