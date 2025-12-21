-- ============================================================================
-- CATEGORIES AND THOUGHT ITEMS TABLES
-- ============================================================================

-- Categories Active Table
CREATE TABLE IF NOT EXISTS categories_active (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  thought_count int NOT NULL DEFAULT 0
);

-- Categories Pending Table
CREATE TABLE IF NOT EXISTS categories_pending (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  name text UNIQUE NOT NULL,
  created_at timestamptz DEFAULT now(),
  hit_count int NOT NULL DEFAULT 0,
  threshold int NOT NULL DEFAULT 5
);

-- Thought Items Table
CREATE TABLE IF NOT EXISTS thought_items (
  id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
  session_id uuid NOT NULL REFERENCES journal_sessions(id) ON DELETE CASCADE,
  created_at timestamptz DEFAULT now(),
  text text NOT NULL,
  source_timestamp timestamptz,
  assigned_category_id uuid REFERENCES categories_active(id),
  pending_category_id uuid REFERENCES categories_pending(id)
);

-- ============================================================================
-- INDEXES
-- ============================================================================

-- Indexes for thought_items
CREATE INDEX IF NOT EXISTS idx_thought_items_session_id ON thought_items(session_id);
CREATE INDEX IF NOT EXISTS idx_thought_items_assigned_category_id ON thought_items(assigned_category_id);
CREATE INDEX IF NOT EXISTS idx_thought_items_pending_category_id ON thought_items(pending_category_id);

-- Optional index for categories_active
CREATE INDEX IF NOT EXISTS idx_categories_active_thought_count ON categories_active(thought_count);

-- ============================================================================
-- ROW LEVEL SECURITY (RLS)
-- ============================================================================

-- Enable RLS on all tables
ALTER TABLE categories_active ENABLE ROW LEVEL SECURITY;
ALTER TABLE categories_pending ENABLE ROW LEVEL SECURITY;
ALTER TABLE thought_items ENABLE ROW LEVEL SECURITY;

-- ============================================================================
-- DEMO POLICIES (Temporary - for development/testing)
-- ============================================================================
-- NOTE: These policies allow anonymous access for demo purposes.
-- For production, you MUST use authenticated users and per-user policies.

-- Thought Items: Allow anon select/insert/update/delete
CREATE POLICY "Allow anon select on thought_items"
  ON thought_items
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on thought_items"
  ON thought_items
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on thought_items"
  ON thought_items
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on thought_items"
  ON thought_items
  FOR DELETE
  TO anon
  USING (true);

-- Categories Pending: Allow anon select/insert/update/delete
CREATE POLICY "Allow anon select on categories_pending"
  ON categories_pending
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on categories_pending"
  ON categories_pending
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on categories_pending"
  ON categories_pending
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on categories_pending"
  ON categories_pending
  FOR DELETE
  TO anon
  USING (true);

-- Categories Active: Allow anon select/insert/update/delete
CREATE POLICY "Allow anon select on categories_active"
  ON categories_active
  FOR SELECT
  TO anon
  USING (true);

CREATE POLICY "Allow anon insert on categories_active"
  ON categories_active
  FOR INSERT
  TO anon
  WITH CHECK (true);

CREATE POLICY "Allow anon update on categories_active"
  ON categories_active
  FOR UPDATE
  TO anon
  USING (true)
  WITH CHECK (true);

CREATE POLICY "Allow anon delete on categories_active"
  ON categories_active
  FOR DELETE
  TO anon
  USING (true);

