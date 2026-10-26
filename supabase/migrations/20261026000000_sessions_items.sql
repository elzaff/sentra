-- Public demo: everyone reads, only the admin user writes. Signups stay possible, so writes are pinned to the admin's uid.
create table public.sessions (
  id text primary key,
  doc jsonb not null check (pg_column_size(doc) < 100000),
  updated_at timestamptz not null default now()
);
create table public.items (like public.sessions including all);

alter table public.sessions enable row level security;
alter table public.items enable row level security;

grant select on public.sessions, public.items to anon, authenticated;
grant insert, update, delete on public.sessions, public.items to authenticated;

create policy "read" on public.sessions for select to anon, authenticated using (true);
create policy "read" on public.items for select to anon, authenticated using (true);

create policy "admin insert" on public.sessions for insert to authenticated
  with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin update" on public.sessions for update to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69')
  with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin delete" on public.sessions for delete to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');

create policy "admin insert" on public.items for insert to authenticated
  with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin update" on public.items for update to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69')
  with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin delete" on public.items for delete to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
