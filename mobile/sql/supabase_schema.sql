-- Supabase Schema for MindJournal

-- ============================================================================
-- JOURNAL SESSIONS TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS journal_sessions (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  created_at timestamptz DEFAULT now(),
  started_at timestamptz NOT NULL,
  ended_at timestamptz,
  messages jsonb NOT NULL, -- Array of {role: 'user'|'agent', content: string, timestamp: string}
  meta jsonb DEFAULT '{}'::jsonb
);

-- Index for querying sessions by date
CREATE INDEX IF NOT EXISTS idx_journal_sessions_created_at ON journal_sessions(created_at DESC);
CREATE INDEX IF NOT EXISTS idx_journal_sessions_started_at ON journal_sessions(started_at DESC);

-- ============================================================================
-- PSYCHOLOGY 10K DATASET TABLE
-- ============================================================================
CREATE TABLE IF NOT EXISTS psychology_10k (
  id text PRIMARY KEY, -- e.g., 'row_0'
  prompt text NOT NULL,
  response text NOT NULL,
  created_at timestamptz DEFAULT now()
);

-- Index for full-text search on prompts and responses
CREATE INDEX IF NOT EXISTS idx_psychology_10k_prompt ON psychology_10k USING gin(to_tsvector('english', prompt));
CREATE INDEX IF NOT EXISTS idx_psychology_10k_response ON psychology_10k USING gin(to_tsvector('english', response));

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on journal_sessions
ALTER TABLE journal_sessions ENABLE ROW LEVEL SECURITY;

-- Enable RLS on psychology_10k
ALTER TABLE psychology_10k ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEMO POLICIES (Temporary - for development/testing)
-- ============================================================================
-- NOTE: These policies allow anonymous access for demo purposes.
-- For production, you MUST:
-- 1. Use authenticated users (auth.uid())
-- 2. Add per-user policies (e.g., WHERE user_id = auth.uid())
-- 3. Restrict psychology_10k to read-only for authenticated users
-- 4. Remove anon access entirely

-- Journal Sessions: Allow anon to insert and select
CREATE POLICY "Allow anon insert on journal_sessions"
  ON journal_sessions
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon select on journal_sessions"
  ON journal_sessions
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon update on journal_sessions"
  ON journal_sessions
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on journal_sessions"
  ON journal_sessions
  FOR DELETE
  TO anon
  USING (true);

-- Psychology 10K: Allow anon to select (read-only for dataset)
CREATE POLICY "Allow anon select on psychology_10k"
  ON psychology_10k
  FOR SELECT
  TO anon
  USING (true);

-- ============================================================================
-- PRODUCTION SECURITY NOTES
-- ============================================================================
-- For production, replace the above policies with:
--
-- -- Journal Sessions (authenticated users only)
-- CREATE POLICY "Users can insert their own sessions"
--   ON journal_sessions FOR INSERT
--   TO authenticated
--   WITH CHECK (auth.uid() IS NOT NULL);
--
-- CREATE POLICY "Users can select their own sessions"
--   ON journal_sessions FOR SELECT
--   TO authenticated
--   USING (user_id = auth.uid());
--
-- -- Psychology 10K (read-only for authenticated users)
-- CREATE POLICY "Authenticated users can read psychology_10k"
--   ON psychology_10k FOR SELECT
--   TO authenticated
--   USING (true);
--
-- Also add user_id column to journal_sessions:
-- ALTER TABLE journal_sessions ADD COLUMN user_id uuid REFERENCES auth.users(id);

