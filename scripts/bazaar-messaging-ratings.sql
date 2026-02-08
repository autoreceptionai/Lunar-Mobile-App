-- Bazaar Feature Expansion: Messaging, Ratings, and Status
-- Run this in Supabase SQL Editor

-- 1. Add status column to bazaar_posts
ALTER TABLE bazaar_posts
  ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'active',
  ADD COLUMN IF NOT EXISTS sold_at TIMESTAMPTZ;

-- Add check constraint for status (separate statement for IF NOT EXISTS compatibility)
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM pg_constraint WHERE conname = 'bazaar_posts_status_check'
  ) THEN
    ALTER TABLE bazaar_posts
      ADD CONSTRAINT bazaar_posts_status_check
      CHECK (status IN ('active', 'sold'));
  END IF;
END $$;

-- 2. Create conversations table
CREATE TABLE IF NOT EXISTS bazaar_conversations (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  post_id UUID NOT NULL REFERENCES bazaar_posts(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  last_message_at TIMESTAMPTZ DEFAULT now(),
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(post_id, buyer_id)
);

-- 3. Create messages table
CREATE TABLE IF NOT EXISTS bazaar_messages (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  conversation_id UUID NOT NULL REFERENCES bazaar_conversations(id) ON DELETE CASCADE,
  sender_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  content TEXT NOT NULL,
  is_read BOOLEAN DEFAULT false,
  created_at TIMESTAMPTZ DEFAULT now()
);

-- 4. Create seller ratings table
CREATE TABLE IF NOT EXISTS seller_ratings (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  seller_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  buyer_id UUID NOT NULL REFERENCES auth.users(id) ON DELETE CASCADE,
  post_id UUID REFERENCES bazaar_posts(id) ON DELETE SET NULL,
  rating INTEGER NOT NULL CHECK (rating >= 1 AND rating <= 5),
  review_text TEXT,
  created_at TIMESTAMPTZ DEFAULT now(),
  UNIQUE(buyer_id, post_id)
);

-- 5. Add rating columns to profiles
ALTER TABLE profiles
  ADD COLUMN IF NOT EXISTS seller_rating DECIMAL(2,1) DEFAULT 0,
  ADD COLUMN IF NOT EXISTS seller_rating_count INTEGER DEFAULT 0;

-- 6. Indexes for performance
CREATE INDEX IF NOT EXISTS idx_conversations_buyer ON bazaar_conversations(buyer_id);
CREATE INDEX IF NOT EXISTS idx_conversations_seller ON bazaar_conversations(seller_id);
CREATE INDEX IF NOT EXISTS idx_conversations_post ON bazaar_conversations(post_id);
CREATE INDEX IF NOT EXISTS idx_messages_conversation ON bazaar_messages(conversation_id);
CREATE INDEX IF NOT EXISTS idx_messages_created ON bazaar_messages(created_at);
CREATE INDEX IF NOT EXISTS idx_seller_ratings_seller ON seller_ratings(seller_id);
CREATE INDEX IF NOT EXISTS idx_bazaar_posts_status ON bazaar_posts(status);

-- 7. Enable Row Level Security
ALTER TABLE bazaar_conversations ENABLE ROW LEVEL SECURITY;
ALTER TABLE bazaar_messages ENABLE ROW LEVEL SECURITY;
ALTER TABLE seller_ratings ENABLE ROW LEVEL SECURITY;

-- 8. RLS Policies for conversations
DROP POLICY IF EXISTS "Users can view own conversations" ON bazaar_conversations;
CREATE POLICY "Users can view own conversations" ON bazaar_conversations
  FOR SELECT USING (auth.uid() = buyer_id OR auth.uid() = seller_id);

DROP POLICY IF EXISTS "Buyers can create conversations" ON bazaar_conversations;
CREATE POLICY "Buyers can create conversations" ON bazaar_conversations
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- 9. RLS Policies for messages
DROP POLICY IF EXISTS "Participants can view messages" ON bazaar_messages;
CREATE POLICY "Participants can view messages" ON bazaar_messages
  FOR SELECT USING (
    EXISTS (SELECT 1 FROM bazaar_conversations 
      WHERE id = conversation_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Participants can send messages" ON bazaar_messages;
CREATE POLICY "Participants can send messages" ON bazaar_messages
  FOR INSERT WITH CHECK (
    auth.uid() = sender_id AND
    EXISTS (SELECT 1 FROM bazaar_conversations 
      WHERE id = conversation_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
  );

DROP POLICY IF EXISTS "Recipients can mark as read" ON bazaar_messages;
CREATE POLICY "Recipients can mark as read" ON bazaar_messages
  FOR UPDATE USING (
    EXISTS (SELECT 1 FROM bazaar_conversations 
      WHERE id = conversation_id 
      AND (buyer_id = auth.uid() OR seller_id = auth.uid()))
  );

-- 10. RLS Policies for seller ratings
DROP POLICY IF EXISTS "Ratings are public" ON seller_ratings;
CREATE POLICY "Ratings are public" ON seller_ratings 
  FOR SELECT USING (true);

DROP POLICY IF EXISTS "Buyers can rate" ON seller_ratings;
CREATE POLICY "Buyers can rate" ON seller_ratings 
  FOR INSERT WITH CHECK (auth.uid() = buyer_id);

-- 11. Trigger function to update seller rating on profiles
CREATE OR REPLACE FUNCTION update_seller_rating()
RETURNS TRIGGER AS $$
DECLARE
  target_seller_id UUID;
BEGIN
  -- Get the seller_id based on operation type
  IF TG_OP = 'DELETE' THEN
    target_seller_id := OLD.seller_id;
  ELSE
    target_seller_id := NEW.seller_id;
  END IF;

  UPDATE profiles
  SET
    seller_rating = COALESCE((
      SELECT ROUND(AVG(rating)::numeric, 1)
      FROM seller_ratings WHERE seller_id = target_seller_id
    ), 0),
    seller_rating_count = (
      SELECT COUNT(*) FROM seller_ratings WHERE seller_id = target_seller_id
    )
  WHERE id = target_seller_id;

  IF TG_OP = 'DELETE' THEN
    RETURN OLD;
  ELSE
    RETURN NEW;
  END IF;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_seller_rating ON seller_ratings;
CREATE TRIGGER trigger_update_seller_rating
  AFTER INSERT OR UPDATE OR DELETE ON seller_ratings
  FOR EACH ROW EXECUTE FUNCTION update_seller_rating();

-- 12. Trigger function to update conversation last_message_at
CREATE OR REPLACE FUNCTION update_conversation_timestamp()
RETURNS TRIGGER AS $$
BEGIN
  UPDATE bazaar_conversations
  SET last_message_at = NEW.created_at
  WHERE id = NEW.conversation_id;
  RETURN NEW;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

DROP TRIGGER IF EXISTS trigger_update_conversation_timestamp ON bazaar_messages;
CREATE TRIGGER trigger_update_conversation_timestamp
  AFTER INSERT ON bazaar_messages
  FOR EACH ROW EXECUTE FUNCTION update_conversation_timestamp();

-- 13. Grant necessary permissions
GRANT SELECT, INSERT ON bazaar_conversations TO authenticated;
GRANT SELECT, INSERT, UPDATE ON bazaar_messages TO authenticated;
GRANT SELECT, INSERT ON seller_ratings TO authenticated;

-- 14. Enable realtime for messages (for live chat)
ALTER PUBLICATION supabase_realtime ADD TABLE bazaar_messages;

-- Done! The Bazaar messaging, ratings, and status features are ready.
