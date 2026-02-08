-- Add currency to bazaar_posts to match app payloads.
alter table public.bazaar_posts
  add column if not exists currency text default 'CAD';

-- Optional: enforce allowed currency values used in the app.
-- Uncomment to apply.
-- alter table public.bazaar_posts
--   add constraint bazaar_posts_currency_check
--   check (currency in ('CAD', 'USD', 'EUR'));
