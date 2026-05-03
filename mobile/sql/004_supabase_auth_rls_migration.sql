-- ============================================================================
-- AUTH & PER-USER RLS MIGRATION
-- Run this after supabase_schema.sql, supabase_migration.sql,
-- and supabase_categories_tables.sql
-- ============================================================================

-- ─── 1. Add user_id columns ──────────────────────────────────────────────────
-- auth.uid() is set automatically as the DEFAULT so existing insert code
-- doesn't need to pass user_id explicitly.

ALTER TABLE journal_sessions
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE journal_sessions
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE categories_active
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE categories_active
  ALTER COLUMN user_id SET DEFAULT auth.uid();

ALTER TABLE categories_pending
  ADD COLUMN IF NOT EXISTS user_id uuid REFERENCES auth.users(id) ON DELETE CASCADE;

ALTER TABLE categories_pending
  ALTER COLUMN user_id SET DEFAULT auth.uid();

-- thought_items is secured via its parent session (see RLS policy below)
-- no user_id column needed here

-- ─── 2. journal_sessions — drop old anon policies, add per-user policies ─────

DROP POLICY IF EXISTS "Allow anon insert on journal_sessions"  ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon select on journal_sessions"  ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon update on journal_sessions"  ON journal_sessions;
DROP POLICY IF EXISTS "Allow anon delete on journal_sessions"  ON journal_sessions;

CREATE POLICY "Users can select own sessions"
  ON journal_sessions FOR SELECT
  TO authenticated
  USING (user_id = auth.uid());

CREATE POLICY "Users can insert own sessions"
  ON journal_sessions FOR INSERT
  TO authenticated
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can update own sessions"
  ON journal_sessions FOR UPDATE
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

CREATE POLICY "Users can delete own sessions"
  ON journal_sessions FOR DELETE
  TO authenticated
  USING (user_id = auth.uid());

-- ─── 3. categories_active — drop old anon policies, add per-user policies ────

DROP POLICY IF EXISTS "Allow anon select on categories_active"  ON categories_active;
DROP POLICY IF EXISTS "Allow anon insert on categories_active"  ON categories_active;
DROP POLICY IF EXISTS "Allow anon update on categories_active"  ON categories_active;
DROP POLICY IF EXISTS "Allow anon delete on categories_active"  ON categories_active;

CREATE POLICY "Users manage own active categories"
  ON categories_active FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 4. categories_pending — drop old anon policies, add per-user policies ───

DROP POLICY IF EXISTS "Allow anon select on categories_pending"  ON categories_pending;
DROP POLICY IF EXISTS "Allow anon insert on categories_pending"  ON categories_pending;
DROP POLICY IF EXISTS "Allow anon update on categories_pending"  ON categories_pending;
DROP POLICY IF EXISTS "Allow anon delete on categories_pending"  ON categories_pending;

CREATE POLICY "Users manage own pending categories"
  ON categories_pending FOR ALL
  TO authenticated
  USING (user_id = auth.uid())
  WITH CHECK (user_id = auth.uid());

-- ─── 5. thought_items — secured via parent session ownership ─────────────────

DROP POLICY IF EXISTS "Allow anon select on thought_items"  ON thought_items;
DROP POLICY IF EXISTS "Allow anon insert on thought_items"  ON thought_items;
DROP POLICY IF EXISTS "Allow anon update on thought_items"  ON thought_items;
DROP POLICY IF EXISTS "Allow anon delete on thought_items"  ON thought_items;

CREATE POLICY "Users can select own thought items"
  ON thought_items FOR SELECT
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_sessions
      WHERE journal_sessions.id = thought_items.session_id
        AND journal_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can insert own thought items"
  ON thought_items FOR INSERT
  TO authenticated
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM journal_sessions
      WHERE journal_sessions.id = thought_items.session_id
        AND journal_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can update own thought items"
  ON thought_items FOR UPDATE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_sessions
      WHERE journal_sessions.id = thought_items.session_id
        AND journal_sessions.user_id = auth.uid()
    )
  );

CREATE POLICY "Users can delete own thought items"
  ON thought_items FOR DELETE
  TO authenticated
  USING (
    EXISTS (
      SELECT 1 FROM journal_sessions
      WHERE journal_sessions.id = thought_items.session_id
        AND journal_sessions.user_id = auth.uid()
    )
  );

-- ─── 6. psychology_10k — read-only for authenticated users ───────────────────
-- Drop any existing anon select policy and replace with authenticated read

DROP POLICY IF EXISTS "Allow anon select on psychology_10k" ON psychology_10k;

CREATE POLICY "Authenticated users can read psychology data"
  ON psychology_10k FOR SELECT
  TO authenticated
  USING (true);
