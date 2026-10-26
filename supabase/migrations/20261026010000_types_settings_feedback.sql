create table public.types (like public.sessions including all);
create table public.settings (like public.sessions including all);
create table public.feedback (
  id uuid primary key default gen_random_uuid(),
  doc jsonb not null check (pg_column_size(doc) < 2000 and doc->>'verdict' in ('benar', 'koreksi')),
  created_at timestamptz not null default now()
);

alter table public.types enable row level security;
alter table public.settings enable row level security;
alter table public.feedback enable row level security;

grant select on public.types, public.settings to anon, authenticated;
grant insert, update, delete on public.types, public.settings to authenticated;
grant select, insert on public.feedback to authenticated;

create policy "read" on public.types for select to anon, authenticated using (true);
create policy "read" on public.settings for select to anon, authenticated using (true);

create policy "admin insert" on public.types for insert to authenticated with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin update" on public.types for update to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69') with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin delete" on public.types for delete to authenticated using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');

create policy "admin insert" on public.settings for insert to authenticated with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin update" on public.settings for update to authenticated
  using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69') with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin delete" on public.settings for delete to authenticated using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');

-- feedback is write-and-read for the admin only: nothing in the app shows it
create policy "admin read" on public.feedback for select to authenticated using ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
create policy "admin insert" on public.feedback for insert to authenticated with check ((select auth.uid()) = 'c9b675a2-553e-4ef7-88ec-29bd1ffd4e69');
