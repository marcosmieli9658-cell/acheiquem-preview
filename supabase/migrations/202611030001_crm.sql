-- Achei Quem: first administrative slice. No public registrations or demo seed.
-- Apply once through Supabase migrations / SQL Editor in a dedicated project.
begin;

create schema if not exists aq_private;
revoke all on schema aq_private from public, anon, authenticated;

create table aq_private.admin_members (
  user_id uuid primary key references auth.users(id) on delete cascade,
  created_at timestamptz not null default now()
);
alter table aq_private.admin_members enable row level security;
revoke all on aq_private.admin_members from public, anon, authenticated;

create function public.aq_is_admin() returns boolean
language sql stable security definer set search_path = ''
as $$
  select exists (select 1 from aq_private.admin_members where user_id = (select auth.uid()));
$$;
revoke all on function public.aq_is_admin() from public, anon;
grant execute on function public.aq_is_admin() to authenticated;

create table public.aq_categories (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 100),
  description text not null default '' check (length(description) <= 1000),
  active boolean not null default true,
  created_at timestamptz not null default now()
);
create unique index aq_categories_name_unique on public.aq_categories
  (lower(translate(btrim(name), 'áàâãäéèêëíìîïóòôõöúùûüçÁÀÂÃÄÉÈÊËÍÌÎÏÓÒÔÕÖÚÙÛÜÇ', 'aaaaaeeeeiiiiooooouuuucAAAAAEEEEIIIIOOOOOUUUUC')));

create table public.aq_professionals (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  email text not null default '' check (length(email) <= 254),
  phone text not null default '' check (length(phone) <= 40),
  city text not null check (length(btrim(city)) between 2 and 100),
  cities text[] not null default '{}',
  description text not null default '' check (length(description) <= 5000),
  skills text[] not null default '{}',
  categories uuid[] not null default '{}',
  photo_url text not null default '' check (length(photo_url) <= 2000),
  photo_index integer check (photo_index between 0 and 5),
  status text not null default 'pending' check (status in ('pending','approved','rejected')),
  subscription_status text not null default 'inactive' check (subscription_status in ('inactive','active','cancelled')),
  notes text not null default '' check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (cardinality(cities) <= 100 and cardinality(skills) <= 100 and cardinality(categories) <= 100)
);
create index aq_professionals_status_city on public.aq_professionals(status, city);

create table public.aq_clients (
  id uuid primary key default gen_random_uuid(),
  name text not null check (length(btrim(name)) between 2 and 160),
  email text not null default '' check (length(email) <= 254),
  city text not null check (length(btrim(city)) between 2 and 100),
  status text not null default 'active' check (status in ('active','inactive')),
  created_at timestamptz not null default now()
);

create table public.aq_category_requests (
  id uuid primary key default gen_random_uuid(),
  professional_id uuid not null references public.aq_professionals(id),
  name text not null check (length(btrim(name)) between 2 and 100),
  status text not null default 'pending' check (status in ('pending','resolved','rejected')),
  category_id uuid references public.aq_categories(id),
  created_at timestamptz not null default now(),
  check ((status = 'resolved' and category_id is not null) or (status <> 'resolved' and category_id is null))
);
create index aq_category_requests_professional_status on public.aq_category_requests(professional_id,status);

create table public.aq_transactions (
  id uuid primary key default gen_random_uuid(),
  direction text not null check (direction in ('income','expense')),
  kind text not null check (kind in ('subscription','expense','other')),
  description text not null check (length(btrim(description)) between 1 and 500),
  professional_id uuid references public.aq_professionals(id),
  amount_cents integer not null check (amount_cents between 1 and 999999999),
  due_on date not null,
  paid_on date,
  status text not null default 'pending' check (status in ('pending','paid','cancelled')),
  payment_method text not null default 'other' check (payment_method in ('pix','transfer','cash','card','other')),
  notes text not null default '' check (length(notes) <= 5000),
  created_at timestamptz not null default now(),
  check ((status='paid' and paid_on is not null) or (status<>'paid' and paid_on is null)),
  check (kind<>'subscription' or (direction='income' and professional_id is not null)),
  check (kind<>'expense' or direction='expense')
);
create index aq_transactions_status_due on public.aq_transactions(status,due_on);
create index aq_transactions_professional on public.aq_transactions(professional_id);

create table public.aq_audit (
  id uuid primary key default gen_random_uuid(),
  entity text not null,
  entity_id uuid not null,
  action text not null,
  actor_id uuid references auth.users(id) on delete set null,
  changed_fields text[] not null default '{}',
  created_at timestamptz not null default now()
);
create index aq_audit_created on public.aq_audit(created_at desc);

-- An authenticated customer cannot turn into an administrator by editing JWT
-- metadata or inserting rows: only a database owner can bootstrap membership.
alter table public.aq_categories enable row level security;
alter table public.aq_professionals enable row level security;
alter table public.aq_clients enable row level security;
alter table public.aq_category_requests enable row level security;
alter table public.aq_transactions enable row level security;
alter table public.aq_audit enable row level security;

revoke all on public.aq_categories, public.aq_professionals, public.aq_clients,
  public.aq_category_requests, public.aq_transactions, public.aq_audit from public, anon, authenticated;
grant select, insert, update on public.aq_categories, public.aq_professionals,
  public.aq_clients, public.aq_category_requests, public.aq_transactions to authenticated;
grant select on public.aq_audit to authenticated;

create policy aq_categories_admin on public.aq_categories for all to authenticated
  using ((select public.aq_is_admin())) with check ((select public.aq_is_admin()));
create policy aq_professionals_admin on public.aq_professionals for all to authenticated
  using ((select public.aq_is_admin())) with check ((select public.aq_is_admin()));
create policy aq_clients_admin on public.aq_clients for all to authenticated
  using ((select public.aq_is_admin())) with check ((select public.aq_is_admin()));
create policy aq_category_requests_admin on public.aq_category_requests for all to authenticated
  using ((select public.aq_is_admin())) with check ((select public.aq_is_admin()));
create policy aq_transactions_admin on public.aq_transactions for all to authenticated
  using ((select public.aq_is_admin())) with check ((select public.aq_is_admin()));
create policy aq_audit_admin_read on public.aq_audit for select to authenticated
  using ((select public.aq_is_admin()));

create function aq_private.validate_professional() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  new.updated_at := now();
  if exists (select 1 from unnest(new.categories) selected_id
    where not exists (select 1 from public.aq_categories category where category.id = selected_id)) then
    raise exception 'Vincule categorias existentes.' using errcode='23514';
  end if;
  if exists (select 1 from unnest(new.skills || new.cities) item where item is null or btrim(item)='') then
    raise exception 'Informe habilidades e cidades válidas.' using errcode='23514';
  end if;
  if new.status='approved' then
    if new.photo_url !~ '^https://' or length(btrim(new.description)) < 30
      or cardinality(new.skills)=0 or cardinality(new.categories)=0 or cardinality(new.cities)=0 then
      raise exception 'Para aprovar, confira foto HTTPS, descrição, habilidades, categorias e cidades atendidas.' using errcode='23514';
    end if;
    if exists(select 1 from public.aq_categories where id=any(new.categories) and not active) then
      raise exception 'Vincule apenas categorias ativas antes de aprovar.' using errcode='23514';
    end if;
    if exists(select 1 from public.aq_category_requests where professional_id=new.id and status='pending') then
      raise exception 'Resolva o pedido de nova categoria antes de aprovar este profissional.' using errcode='23514';
    end if;
  end if;
  return new;
end;
$$;
revoke all on function aq_private.validate_professional() from public, anon, authenticated;
create trigger aq_professional_validation before insert or update on public.aq_professionals
  for each row execute function aq_private.validate_professional();

create function aq_private.validate_category_request() returns trigger
language plpgsql security invoker set search_path = ''
as $$
declare professional_status text;
begin
  if TG_OP='UPDATE' and new.professional_id <> old.professional_id then
    raise exception 'Não é possível transferir um pedido para outro profissional.' using errcode='23514';
  end if;
  -- Lock the same professional row that approval updates, serializing these actions.
  select status into professional_status from public.aq_professionals where id=new.professional_id for update;
  if new.status='pending' and professional_status='approved' then
    raise exception 'Profissional já aprovado: registre a pendência cadastral antes de solicitar uma categoria.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function aq_private.validate_category_request() from public, anon, authenticated;
create trigger aq_category_request_validation before insert or update on public.aq_category_requests
  for each row execute function aq_private.validate_category_request();

create function aq_private.validate_transaction() returns trigger
language plpgsql security invoker set search_path = ''
as $$
begin
  if TG_OP='UPDATE' and old.status<>'pending' then
    raise exception 'Este lançamento já foi liquidado ou cancelado e não pode ser editado.' using errcode='23514';
  end if;
  if new.paid_on > (now() at time zone 'America/Sao_Paulo')::date then
    raise exception 'Informe a data efetiva do pagamento, até hoje.' using errcode='23514';
  end if;
  return new;
end;
$$;
revoke all on function aq_private.validate_transaction() from public, anon, authenticated;
create trigger aq_transaction_validation before insert or update on public.aq_transactions
  for each row execute function aq_private.validate_transaction();

create function aq_private.record_audit() returns trigger
language plpgsql security definer set search_path = ''
as $$
declare changed text[];
begin
  if TG_OP='UPDATE' then
    select coalesce(array_agg(key order by key),'{}') into changed
      from jsonb_each(to_jsonb(new)) where value is distinct from (to_jsonb(old)->key);
  else
    select array_agg(key order by key) into changed from jsonb_each(to_jsonb(new));
  end if;
  insert into public.aq_audit(entity,entity_id,action,actor_id,changed_fields)
  values(case TG_TABLE_NAME when 'aq_category_requests' then 'categoryRequests'
    else replace(TG_TABLE_NAME,'aq_','') end, new.id,lower(TG_OP),auth.uid(),changed);
  return new;
end;
$$;
revoke all on function aq_private.record_audit() from public, anon, authenticated;
create trigger aq_categories_audit after insert or update on public.aq_categories for each row execute function aq_private.record_audit();
create trigger aq_professionals_audit after insert or update on public.aq_professionals for each row execute function aq_private.record_audit();
create trigger aq_clients_audit after insert or update on public.aq_clients for each row execute function aq_private.record_audit();
create trigger aq_category_requests_audit after insert or update on public.aq_category_requests for each row execute function aq_private.record_audit();
create trigger aq_transactions_audit after insert or update on public.aq_transactions for each row execute function aq_private.record_audit();

create function public.aq_resolve_category_request(request_id uuid, category_id uuid) returns void
language plpgsql security invoker set search_path = ''
as $$
declare candidate uuid; request_status text;
begin
  if not public.aq_is_admin() then raise exception 'Permissão administrativa necessária.' using errcode='42501'; end if;
  select professional_id into candidate from public.aq_category_requests where id=$1;
  if candidate is null then raise exception 'Categoria solicitada não encontrada.' using errcode='23514'; end if;
  -- Consistent lock order: professional first, then request.
  perform 1 from public.aq_professionals where id=candidate for update;
  select status into request_status from public.aq_category_requests where id=$1 for update;
  if request_status<>'pending' then raise exception 'Categoria já analisada. Atualize a lista.' using errcode='23514'; end if;
  if not exists(select 1 from public.aq_categories where id=$2 and active) then
    raise exception 'Vincule uma categoria ativa.' using errcode='23514';
  end if;
  update public.aq_category_requests set status='resolved',category_id=$2 where id=$1;
  update public.aq_professionals set categories=(select array_agg(distinct item) from unnest(categories || array[$2]) item) where id=candidate;
end;
$$;
revoke all on function public.aq_resolve_category_request(uuid,uuid) from public, anon;
grant execute on function public.aq_resolve_category_request(uuid,uuid) to authenticated;

-- Initial catalogue only: no people, invoices, credentials or membership are seeded.
insert into public.aq_categories(name,description) values
  ('Elétrica','Instalações e reparos elétricos'),
  ('Arquitetura','Projetos de arquitetura'),
  ('Engenharia','Projetos e acompanhamento de obras'),
  ('Obras e alvenaria','Pedreiros e mestres de obras'),
  ('Pintura','Pintura e preparação de paredes'),
  ('Pisos e acabamentos','Instalação de pisos e revestimentos'),
  ('Hidráulica','Instalações e reparos hidráulicos'),
  ('Marcenaria','Móveis e soluções sob medida');

commit;
