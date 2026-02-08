-- Create reports table
create table if not exists public.reports (
  id uuid default gen_random_uuid() primary key,
  reporter_id uuid references auth.users(id) on delete set null,
  target_type text not null, -- 'listing', 'space', 'message', 'user'
  target_id uuid not null,
  reason text not null,
  details text,
  status text default 'pending' check (status in ('pending', 'reviewed', 'resolved')),
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.reports enable row level security;

create policy "Users can create reports"
  on public.reports
  for insert
  with check (auth.uid() = reporter_id);

create policy "Admins can view all reports"
  on public.reports
  for select
  using (
    exists (
      select 1 from public.profiles
      where id = auth.uid() and (is_super_admin = true or is_admin = true)
    )
  );
