-- Migration: Add restaurant reviews table and rating columns
-- Run this in Supabase SQL Editor

-- 1. Add rating columns to restaurants table
ALTER TABLE restaurants
  ADD COLUMN IF NOT EXISTS average_rating DECIMAL(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS review_count INTEGER DEFAULT 0,
  ADD COLUMN IF NOT EXISTS cuisine TEXT;

-- 2. Create restaurant_reviews table
CREATE TABLE IF NOT EXISTS restaurant_reviews (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  restaurant_id UUID NOT NULL REFERENCES restaurants(id) ON DELETE CASCADE,
  user_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  updated_at TIMESTAMPTZ DEFAULT now()
);

-- 3. Create indexes for faster lookups
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_restaurant_id ON restaurant_reviews(restaurant_id);
CREATE INDEX IF NOT EXISTS idx_restaurant_reviews_user_id ON restaurant_reviews(user_id);

-- 4. Enable Row Level Security
ALTER TABLE restaurant_reviews ENABLE ROW LEVEL SECURITY;

-- 5. RLS Policies (drop if exists to avoid conflicts)
DROP POLICY IF EXISTS "Reviews are publicly readable" ON restaurant_reviews;
DROP POLICY IF EXISTS "Authenticated users can create reviews" ON restaurant_reviews;
DROP POLICY IF EXISTS "Users can update own reviews" ON restaurant_reviews;
DROP POLICY IF EXISTS "Users can delete own reviews" ON restaurant_reviews;

-- Anyone can read reviews
CREATE POLICY "Reviews are publicly readable"
  ON restaurant_reviews FOR SELECT
  USING (true);

-- Authenticated users can create reviews
CREATE POLICY "Authenticated users can create reviews"
  ON restaurant_reviews FOR INSERT
  TO authenticated
  WITH CHECK (auth.uid() = user_id);

-- Users can update their own reviews
CREATE POLICY "Users can update own reviews"
  ON restaurant_reviews FOR UPDATE
  TO authenticated
  USING (auth.uid() = user_id);

-- Users can delete their own reviews
CREATE POLICY "Users can delete own reviews"
  ON restaurant_reviews FOR DELETE
  TO authenticated
  USING (auth.uid() = user_id);

-- 6. Create trigger function to auto-update rating stats
CREATE OR REPLACE FUNCTION update_restaurant_rating_stats()
RETURNS TRIGGER AS $$
BEGIN
  IF TG_OP = 'DELETE' THEN
    UPDATE restaurants
    SET
      average_rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM restaurant_reviews
        WHERE restaurant_id = OLD.restaurant_id
      ), 0),
      review_count = (
        SELECT COUNT(*)
        FROM restaurant_reviews
        WHERE restaurant_id = OLD.restaurant_id
      )
    WHERE id = OLD.restaurant_id;
    RETURN OLD;
  ELSE
    UPDATE restaurants
    SET
      average_rating = COALESCE((
        SELECT ROUND(AVG(rating)::numeric, 1)
        FROM restaurant_reviews
        WHERE restaurant_id = NEW.restaurant_id
      ), 0),
      review_count = (
        SELECT COUNT(*)
        FROM restaurant_reviews
        WHERE restaurant_id = NEW.restaurant_id
      )
    WHERE id = NEW.restaurant_id;
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql;

-- 7. Create trigger (drop if exists to avoid conflicts)
DROP TRIGGER IF EXISTS trigger_update_restaurant_stats ON restaurant_reviews;

CREATE TRIGGER trigger_update_restaurant_stats
  AFTER INSERT OR UPDATE OR DELETE ON restaurant_reviews
  FOR EACH ROW
  EXECUTE FUNCTION update_restaurant_rating_stats();

-- 8. Recalculate ratings for all restaurants based on existing reviews
-- This ensures any reviews added before the trigger was installed are counted
UPDATE restaurants r
SET
  average_rating = COALESCE((
    SELECT ROUND(AVG(rating)::numeric, 1)
    FROM restaurant_reviews
    WHERE restaurant_id = r.id
  ), 0),
  review_count = (
    SELECT COUNT(*)
    FROM restaurant_reviews
    WHERE restaurant_id = r.id
  );

-- Done! The restaurant_reviews table is now ready.
-- Ratings will auto-update on restaurants table when reviews are added/modified/deleted.
-- Existing reviews have been recalculated.
