-- Migration: Add unique constraint on (session_id, text) to thought_items
-- Prevents duplicate thought items within the same session

-- Step 1: Remove duplicate rows, keeping the one with the earliest created_at
-- (or the one with the lowest id if created_at is the same)
DELETE FROM thought_items
WHERE id IN (
  SELECT id
  FROM (
    SELECT id,
           ROW_NUMBER() OVER (
             PARTITION BY session_id, text 
             ORDER BY created_at ASC, id ASC
           ) as rn
    FROM thought_items
  ) t
  WHERE rn > 1
);

-- Step 2: Drop constraint if it exists (for idempotency)
ALTER TABLE thought_items
DROP CONSTRAINT IF EXISTS thought_items_session_text_unique;

-- Step 3: Add unique constraint on (session_id, text)
ALTER TABLE thought_items
ADD CONSTRAINT thought_items_session_text_unique
UNIQUE (session_id, text);

