-- Final schema of the Supabase project "kineret-leads" (herokvahhjgasqosjwuu).
-- One generic table of JSON documents: leads, tasks and one settings document.
--   rev = per-document version (conflict detection)     seq = global change counter (sync cursor)
-- Access: only e-mails listed in public.allowed_users can read/write (that table is closed to the API).
-- To add/remove a user, run in the SQL editor (never commit real e-mails here):
--   insert into public.allowed_users (email) values ('<login-email>');
-- The login e-mail is built by the app as  <digits of the username>@example.com
-- Also turn OFF "Allow new users to sign up" in the Supabase dashboard (Authentication > Sign In / Providers).

create sequence if not exists public.docs_seq;

create table public.docs (
  kind text not null check (kind in ('lead','task','settings')),
  id text not null,
  data jsonb not null default '{}'::jsonb,
  rev integer not null default 1,
  seq bigint not null default nextval('public.docs_seq'),
  deleted boolean not null default false,
  updated_at timestamptz not null default now(),
  updated_by text,
  primary key (kind, id)
);

create index docs_seq_idx on public.docs (seq);

create or replace function public.docs_touch() returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.seq := nextval('public.docs_seq');
  new.updated_at := now();
  if tg_op = 'UPDATE' then
    new.rev := old.rev + 1;
  else
    new.rev := 1;
  end if;
  return new;
end
$$;

create trigger docs_touch before insert or update on public.docs
  for each row execute function public.docs_touch();

create table public.allowed_users (email text primary key);
alter table public.allowed_users enable row level security;
revoke all on public.allowed_users from anon, authenticated;

create schema if not exists private;
revoke all on schema private from public, anon;
grant usage on schema private to authenticated;

create or replace function private.is_allowed() returns boolean
language sql stable security definer
set search_path = ''
as $$ select exists (select 1 from public.allowed_users where email = (auth.jwt() ->> 'email')) $$;

revoke all on function private.is_allowed() from public, anon;
grant execute on function private.is_allowed() to authenticated;

alter table public.docs enable row level security;

create policy "allowed users only" on public.docs
  for all to authenticated
  using (private.is_allowed())
  with check (private.is_allowed());

revoke all on public.docs from anon;
grant select, insert, update, delete on public.docs to authenticated;
grant usage, select on sequence public.docs_seq to authenticated;

alter publication supabase_realtime add table public.docs;
