-- Migration: Add categorization tracking columns to journal_sessions
-- Adds post_processed_at, categorization_status, and categorization_error

-- Add post_processed_at column (nullable timestamptz)
ALTER TABLE journal_sessions 
ADD COLUMN IF NOT EXISTS post_processed_at timestamptz;

-- Add categorization_status column (text, not null, default 'idle')
-- with CHECK constraint for allowed values
ALTER TABLE journal_sessions 
ADD COLUMN IF NOT EXISTS categorization_status text NOT NULL DEFAULT 'idle';

-- Add CHECK constraint for categorization_status allowed values
ALTER TABLE journal_sessions
DROP CONSTRAINT IF EXISTS journal_sessions_categorization_status_check;

ALTER TABLE journal_sessions
ADD CONSTRAINT journal_sessions_categorization_status_check 
CHECK (categorization_status IN ('idle', 'running', 'done', 'error'));

-- Add categorization_error column (nullable text)
ALTER TABLE journal_sessions 
ADD COLUMN IF NOT EXISTS categorization_error text;

