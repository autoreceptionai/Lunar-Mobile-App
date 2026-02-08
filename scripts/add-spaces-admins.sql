-- Spaces schema updates for cover images, org types, and admins.

alter table public.spaces
  add column if not exists cover_image_url text not null default '',
  add column if not exists address text,
  add column if not exists org_type text;

do $$
begin
  if not exists (
    select 1
    from pg_constraint
    where conname = 'spaces_org_type_check'
  ) then
    alter table public.spaces
      add constraint spaces_org_type_check
      check (
        org_type is null
        or org_type in ('MSA', 'Mosque', 'Non-Profit', 'Islamic Education', 'Business')
      );
  end if;
end $$;

-- Set this after you backfill existing rows with a real user id.
-- update public.spaces set created_by = '<ADMIN_USER_UUID>' where created_by is null;
-- alter table public.spaces alter column created_by set not null;

alter table public.profiles
  add column if not exists is_super_admin boolean not null default false;

create table if not exists public.space_admins (
  space_id uuid not null references public.spaces(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null default 'admin',
  created_at timestamp with time zone not null default now(),
  primary key (space_id, user_id)
);

alter table public.space_announcements
  add column if not exists is_pinned boolean not null default false;
