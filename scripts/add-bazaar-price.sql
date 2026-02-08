-- Add price to bazaar_posts to match app payloads.
alter table public.bazaar_posts
  add column if not exists price numeric;

-- Optional: enforce non-negative prices.
-- Uncomment to apply.
-- alter table public.bazaar_posts
--   add constraint bazaar_posts_price_nonnegative
--   check (price >= 0);
