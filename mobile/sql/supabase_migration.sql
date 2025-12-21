-- Migration: Update journal_sessions table
-- Drop meta column, add summary and thoughts columns

-- Drop meta column if it exists
ALTER TABLE journal_sessions 
DROP COLUMN IF EXISTS meta;

-- Add summary column (nullable text)
ALTER TABLE journal_sessions 
ADD COLUMN IF NOT EXISTS summary text;

-- Add thoughts column (nullable jsonb)
-- Intended to store: [{ "text": "...", "timestamp": "...", "confidence": 0.0 }]
ALTER TABLE journal_sessions 
ADD COLUMN IF NOT EXISTS thoughts jsonb;

