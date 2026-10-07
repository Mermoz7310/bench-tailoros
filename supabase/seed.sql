-- Données de démo (supabase db reset). Compte : demo@example.com / demo-password-123
-- Jamais exécuté en production.

insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, email_change, email_change_token_new, recovery_token
) values (
  '00000000-0000-0000-0000-000000000000',
  '11111111-1111-4111-8111-111111111111',
  'authenticated', 'authenticated', 'demo@example.com',
  extensions.crypt('demo-password-123', extensions.gen_salt('bf')),
  now(), '{"provider":"email","providers":["email"]}', '{"full_name":"Compte Démo"}',
  now(), now(), '', '', '', ''
);

insert into auth.identities (id, user_id, provider_id, identity_data, provider, last_sign_in_at, created_at, updated_at)
values (
  gen_random_uuid(),
  '11111111-1111-4111-8111-111111111111',
  '11111111-1111-4111-8111-111111111111',
  jsonb_build_object('sub', '11111111-1111-4111-8111-111111111111', 'email', 'demo@example.com', 'email_verified', true),
  'email', now(), now(), now()
);

insert into public.organizations (id, name, slug, created_by)
values ('22222222-2222-4222-8222-222222222222', 'Atelier Démo', 'atelier-demo', '11111111-1111-4111-8111-111111111111');

insert into public.memberships (org_id, user_id, role)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'owner');

insert into public.audit_logs (org_id, actor_id, action, target)
values ('22222222-2222-4222-8222-222222222222', '11111111-1111-4111-8111-111111111111', 'org.created', 'atelier-demo');

-- TailorOS : données de démo réalistes pour l'atelier de démo.
insert into public.customers (id, org_id, name, phone) values
  ('33333333-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', 'Aminata Sow', '77 123 45 67'),
  ('33333333-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', 'Ibrahima Fall', '76 999 00 11'),
  ('33333333-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', 'Khady Ba', '78 456 78 90');

insert into public.measurements (org_id, customer_id, chest, waist, hips, shoulder, sleeve, length, notes) values
  ('22222222-2222-4222-8222-222222222222', '33333333-0000-4000-8000-000000000001', 92, 74, 100, 38, 58, 140, 'Préfère les coupes amples'),
  ('22222222-2222-4222-8222-222222222222', '33333333-0000-4000-8000-000000000002', 104, 90, null, 46, 64, 150, null);

insert into public.orders (id, org_id, customer_id, description, total_xof, due_date, status) values
  ('44444444-0000-4000-8000-000000000001', '22222222-2222-4222-8222-222222222222', '33333333-0000-4000-8000-000000000001', 'Grand boubou bazin', 45000, current_date + 5, 'in_progress'),
  ('44444444-0000-4000-8000-000000000002', '22222222-2222-4222-8222-222222222222', '33333333-0000-4000-8000-000000000002', 'Costume trois pièces', 60000, current_date - 2, 'received'),
  ('44444444-0000-4000-8000-000000000003', '22222222-2222-4222-8222-222222222222', '33333333-0000-4000-8000-000000000003', 'Robe wax', 15000, current_date - 10, 'delivered');

insert into public.payments (org_id, order_id, amount_xof) values
  ('22222222-2222-4222-8222-222222222222', '44444444-0000-4000-8000-000000000001', 20000),
  ('22222222-2222-4222-8222-222222222222', '44444444-0000-4000-8000-000000000003', 15000);
