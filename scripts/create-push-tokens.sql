-- Create push tokens table
create table if not exists public.push_tokens (
  user_id uuid references auth.users(id) on delete cascade not null,
  token text primary key,
  device_type text,
  created_at timestamp with time zone default timezone('utc'::text, now()) not null
);

-- RLS
alter table public.push_tokens enable row level security;

create policy "Users can manage their own tokens"
  on public.push_tokens
  for all
  using (auth.uid() = user_id);

-- Enable Realtime
alter publication supabase_realtime add table push_tokens;
