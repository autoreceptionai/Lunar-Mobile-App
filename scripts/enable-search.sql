-- Enable pg_trgm for fuzzy search if needed, but we'll use tsvector for full-text
create extension if not exists pg_trgm;

-- Search for bazaar_posts
alter table public.bazaar_posts 
  add column if not exists fts tsvector generated always as (
    to_tsvector('english', title || ' ' || coalesce(description, '') || ' ' || coalesce(city, ''))
  ) stored;

create index if not exists bazaar_posts_fts_idx on public.bazaar_posts using gin(fts);

-- Search for restaurants
alter table public.restaurants
  add column if not exists fts tsvector generated always as (
    to_tsvector('english', name || ' ' || coalesce(cuisine, '') || ' ' || coalesce(address, ''))
  ) stored;

create index if not exists restaurants_fts_idx on public.restaurants using gin(fts);
