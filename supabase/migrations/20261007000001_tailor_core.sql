-- =============================================================================
-- TailorOS : clients, fiches de mesures, commandes, paiements.
-- Intégrité inter-organisations garantie par des clés étrangères composites (org_id, id) :
-- une commande ne peut pas pointer vers le client d'une autre organisation, même via service_role.
-- =============================================================================

create table public.customers (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 120),
  phone text check (phone is null or char_length(phone) <= 30),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  unique (org_id, id)
);
create index customers_org_name_idx on public.customers (org_id, lower(name));

create table public.measurements (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  chest numeric(5, 1) check (chest is null or chest between 1 and 300),
  waist numeric(5, 1) check (waist is null or waist between 1 and 300),
  hips numeric(5, 1) check (hips is null or hips between 1 and 300),
  shoulder numeric(5, 1) check (shoulder is null or shoulder between 1 and 300),
  sleeve numeric(5, 1) check (sleeve is null or sleeve between 1 and 300),
  length numeric(5, 1) check (length is null or length between 1 and 300),
  notes text check (notes is null or char_length(notes) <= 500),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  taken_at timestamptz not null default now(),
  foreign key (org_id, customer_id) references public.customers (org_id, id) on delete cascade,
  check (coalesce(chest, waist, hips, shoulder, sleeve, length) is not null)
);
create index measurements_customer_idx on public.measurements (customer_id, taken_at desc);

create table public.orders (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  customer_id uuid not null,
  description text not null check (char_length(btrim(description)) between 1 and 200),
  total_xof bigint not null check (total_xof between 0 and 100000000000),
  due_date date not null,
  status text not null default 'received'
    check (status in ('received', 'in_progress', 'ready', 'delivered', 'cancelled')),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (org_id, id),
  -- NO ACTION (et non RESTRICT) : supprimer un client qui a des commandes est refusé,
  -- mais supprimer toute l'organisation (droit à l'effacement) reste possible, la vérification ayant lieu en fin d'instruction.
  foreign key (org_id, customer_id) references public.customers (org_id, id) on delete no action
);
create index orders_org_status_due_idx on public.orders (org_id, status, due_date);
create index orders_customer_idx on public.orders (customer_id, created_at desc);

create table public.payments (
  id uuid primary key default gen_random_uuid(),
  org_id uuid not null references public.organizations (id) on delete cascade,
  order_id uuid not null,
  amount_xof bigint not null check (amount_xof > 0),
  created_by uuid default auth.uid() references auth.users (id) on delete set null,
  paid_at timestamptz not null default now(),
  foreign key (org_id, order_id) references public.orders (org_id, id) on delete cascade
);
create index payments_order_idx on public.payments (order_id, paid_at desc);

-- Soldes calculés en base (RLS de l'appelant appliquée grâce à security_invoker).
create view public.order_balances with (security_invoker = true) as
select
  o.id,
  o.org_id,
  o.customer_id,
  o.description,
  o.total_xof,
  o.due_date,
  o.status,
  o.created_at,
  coalesce(p.paid, 0)::bigint as paid_xof,
  (o.total_xof - coalesce(p.paid, 0))::bigint as balance_xof,
  (o.due_date < current_date and o.status not in ('delivered', 'cancelled')) as is_late
from public.orders o
left join lateral (select sum(amount_xof) as paid from public.payments where order_id = o.id) p on true;

-- ---------------------------------------------------------------------------
-- Actions (seules voies pour changer un statut ou enregistrer un paiement)
-- ---------------------------------------------------------------------------

create function public.advance_order_status(p_order uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_next text;
begin
  select org_id, status into v_org, v_status from public.orders where id = p_order for update;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'commande introuvable' using errcode = 'P0002';
  end if;

  v_next := case v_status
    when 'received' then 'in_progress'
    when 'in_progress' then 'ready'
    when 'ready' then 'delivered'
  end;
  if v_next is null then
    raise exception 'statut final' using errcode = '23514';
  end if;

  update public.orders set status = v_next, updated_at = now() where id = p_order;
  perform public._audit(v_org, 'order.status_changed', p_order::text, jsonb_build_object('from', v_status, 'to', v_next));
  return v_next;
end;
$$;

create function public.cancel_order(p_order uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
begin
  select org_id, status into v_org, v_status from public.orders where id = p_order for update;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'commande introuvable' using errcode = 'P0002';
  end if;
  if not public.has_org_role(v_org, 'admin') then
    raise exception 'droits insuffisants' using errcode = '42501';
  end if;
  if v_status in ('delivered', 'cancelled') then
    raise exception 'statut final' using errcode = '23514';
  end if;

  update public.orders set status = 'cancelled', updated_at = now() where id = p_order;
  perform public._audit(v_org, 'order.cancelled', p_order::text, jsonb_build_object('from', v_status));
end;
$$;

create function public.add_payment(p_order uuid, p_amount bigint)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_org uuid;
  v_status text;
  v_total bigint;
  v_paid bigint;
  v_id uuid;
begin
  if p_amount is null or p_amount <= 0 then
    raise exception 'montant invalide' using errcode = '22023';
  end if;

  -- Verrou sur la commande : deux paiements simultanés ne peuvent pas dépasser le total.
  select org_id, status, total_xof into v_org, v_status, v_total from public.orders where id = p_order for update;
  if v_org is null or not public.is_org_member(v_org) then
    raise exception 'commande introuvable' using errcode = 'P0002';
  end if;
  if v_status = 'cancelled' then
    raise exception 'commande annulée' using errcode = '23514';
  end if;

  select coalesce(sum(amount_xof), 0) into v_paid from public.payments where order_id = p_order;
  if v_paid + p_amount > v_total then
    raise exception 'overpayment' using errcode = '23514';
  end if;

  insert into public.payments (org_id, order_id, amount_xof) values (v_org, p_order, p_amount) returning id into v_id;
  perform public._audit(v_org, 'payment.recorded', p_order::text, jsonb_build_object('amount_xof', p_amount));
  return v_id;
end;
$$;

-- ---------------------------------------------------------------------------
-- RLS
-- ---------------------------------------------------------------------------

alter table public.customers enable row level security;
alter table public.measurements enable row level security;
alter table public.orders enable row level security;
alter table public.payments enable row level security;

create policy customers_select on public.customers for select to authenticated using (public.is_org_member(org_id));
create policy customers_insert on public.customers for insert to authenticated with check (public.is_org_member(org_id));
create policy customers_update on public.customers for update to authenticated
  using (public.is_org_member(org_id)) with check (public.is_org_member(org_id));
create policy customers_delete on public.customers for delete to authenticated using (public.has_org_role(org_id, 'admin'));

create policy measurements_select on public.measurements for select to authenticated using (public.is_org_member(org_id));
create policy measurements_insert on public.measurements for insert to authenticated with check (public.is_org_member(org_id));

create policy orders_select on public.orders for select to authenticated using (public.is_org_member(org_id));
create policy orders_insert on public.orders for insert to authenticated with check (public.is_org_member(org_id));

create policy payments_select on public.payments for select to authenticated using (public.is_org_member(org_id));

-- ---------------------------------------------------------------------------
-- Privilèges (par colonne : created_by, status, id… ne sont jamais fournis par l'utilisateur)
-- ---------------------------------------------------------------------------

grant select, delete on public.customers to authenticated;
grant insert (org_id, name, phone) on public.customers to authenticated;
grant update (name, phone) on public.customers to authenticated;

grant select on public.measurements to authenticated;
grant insert (org_id, customer_id, chest, waist, hips, shoulder, sleeve, length, notes) on public.measurements to authenticated;

grant select on public.orders to authenticated;
grant insert (org_id, customer_id, description, total_xof, due_date) on public.orders to authenticated;

grant select on public.payments to authenticated;
grant select on public.order_balances to authenticated;

grant all on public.customers, public.measurements, public.orders, public.payments, public.order_balances to service_role;

grant execute on function public.advance_order_status(uuid), public.cancel_order(uuid), public.add_payment(uuid, bigint) to authenticated;
grant execute on function public.advance_order_status(uuid), public.cancel_order(uuid), public.add_payment(uuid, bigint) to service_role;
