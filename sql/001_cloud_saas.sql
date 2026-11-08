-- SessionDesk: install only in a dedicated SessionDesk Supabase project.
-- No data from other applications is touched. RLS is required on all exposed tables.

create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to authenticated;

create table if not exists public.account_subscriptions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  status text not null default 'trialing',
  trial_ends_at timestamptz not null default now() + interval '14 days',
  current_period_end timestamptz,
  stripe_customer_id text unique,
  stripe_subscription_id text unique,
  last_stripe_event_created bigint not null default 0,
  updated_at timestamptz not null default now()
);

create table if not exists public.workspaces (
  user_id uuid primary key references auth.users(id) on delete cascade,
  data jsonb not null default '{"businessName":"","clients":[],"events":[],"appointments":[],"settings":{"industry":"Coaching / lessons","lowThreshold":2}}'::jsonb,
  revision bigint not null default 0,
  updated_at timestamptz not null default now(),
  constraint workspace_data_shape check (
    jsonb_typeof(data) = 'object'
    and jsonb_typeof(data->'clients') = 'array'
    and jsonb_typeof(data->'events') = 'array'
    and (not (data ? 'appointments') or jsonb_typeof(data->'appointments') = 'array')
    and (not (data ? 'settings') or jsonb_typeof(data->'settings') = 'object')
  )
);

create or replace function private.sessiondesk_registration()
returns trigger language plpgsql security definer set search_path = '' as $$
begin
  insert into public.account_subscriptions (user_id)
  values (new.id) on conflict (user_id) do nothing;
  return new;
end;
$$;
revoke all on function private.sessiondesk_registration() from public, anon, authenticated;

drop trigger if exists sessiondesk_registration on auth.users;
create trigger sessiondesk_registration
after insert on auth.users
for each row execute function private.sessiondesk_registration();

insert into public.account_subscriptions(user_id)
select id from auth.users on conflict (user_id) do nothing;

create or replace function private.sessiondesk_can_write(account_id uuid)
returns boolean language sql stable security definer set search_path = '' as $$
  select exists (
    select 1 from public.account_subscriptions s
    where s.user_id = account_id
      and (
        s.trial_ends_at > now()
        or (s.status in ('active','trialing') and s.current_period_end > now())
      )
  );
$$;
revoke all on function private.sessiondesk_can_write(uuid) from public, anon;
grant execute on function private.sessiondesk_can_write(uuid) to authenticated;

alter table public.workspaces enable row level security;
alter table public.account_subscriptions enable row level security;

revoke all on public.workspaces from anon, authenticated;
revoke all on public.account_subscriptions from anon, authenticated;
grant select, insert, update on public.workspaces to authenticated;
grant select on public.account_subscriptions to authenticated;

drop policy if exists "owner can read workspace" on public.workspaces;
create policy "owner can read workspace" on public.workspaces
for select to authenticated
using ((select auth.uid()) = user_id);

drop policy if exists "owner can create workspace while subscribed" on public.workspaces;
create policy "owner can create workspace while subscribed"
on public.workspaces for insert to authenticated
with check ((select auth.uid()) = user_id
  and (select private.sessiondesk_can_write((select auth.uid()))));

drop policy if exists "owner can update workspace while subscribed" on public.workspaces;
create policy "owner can update workspace while subscribed"
on public.workspaces for update to authenticated
using ((select auth.uid()) = user_id
  and (select private.sessiondesk_can_write((select auth.uid()))))
with check ((select auth.uid()) = user_id
  and (select private.sessiondesk_can_write((select auth.uid()))));

drop policy if exists "owner can read subscription" on public.account_subscriptions;
create policy "owner can read subscription" on public.account_subscriptions
for select to authenticated using ((select auth.uid()) = user_id);

-- Only privileged verified webhook/server code writes subscription entitlements.
