-- ============================================================================
-- Clean up duplicate policies on journal_sessions
-- Drops all existing anon policies, then recreates exactly one per action
-- ============================================================================

-- Drop all existing anon policies on journal_sessions (if they exist)
DROP POLICY IF EXISTS "Allow anon insert on journal_sessions" ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon select on journal_sessions" ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon update on journal_sessions" ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon delete on journal_sessions" ON journal_sessions;

-- Re-create exactly one policy for each action
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

