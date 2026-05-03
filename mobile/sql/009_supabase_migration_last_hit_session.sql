-- Migration: Add last_hit_session_id to categories_pending
-- Prevents incrementing hit_count multiple times for the same session

-- Add last_hit_session_id column (nullable uuid)
ALTER TABLE categories_pending 
ADD COLUMN IF NOT EXISTS last_hit_session_id uuid;

-- Add index on last_hit_session_id (optional, for query performance)
CREATE INDEX IF NOT EXISTS idx_categories_pending_last_hit_session_id 
ON categories_pending(last_hit_session_id);

