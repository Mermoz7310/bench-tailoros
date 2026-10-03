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
