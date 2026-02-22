-- Migration: Add user authentication support
-- Date: 2026-02-23
-- 
-- Creates user_profiles table and enables Row Level Security (RLS)
-- for projects and evaluations tables.

-- ============================================
-- 1. Create user_profiles table
-- ============================================
-- Extends Supabase auth.users with app-specific data

CREATE TABLE IF NOT EXISTS user_profiles (
  id UUID PRIMARY KEY REFERENCES auth.users(id) ON DELETE CASCADE,
  email TEXT NOT NULL,
  full_name TEXT,
  avatar_url TEXT,
  stripe_customer_id TEXT,  -- Ready for billing
  subscription_status TEXT DEFAULT 'free',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW()
);

-- Index for email lookups
CREATE INDEX IF NOT EXISTS idx_user_profiles_email ON user_profiles(email);

-- Trigger to update updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DROP TRIGGER IF EXISTS update_user_profiles_updated_at ON user_profiles;
CREATE TRIGGER update_user_profiles_updated_at
  BEFORE UPDATE ON user_profiles
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- ============================================
-- 2. Ensure user_id column exists on projects
-- ============================================
-- This should already exist, but ensure it references auth.users

DO $$ 
BEGIN
  -- Add user_id if it doesn't exist
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_name = 'projects' AND column_name = 'user_id'
  ) THEN
    ALTER TABLE projects ADD COLUMN user_id UUID REFERENCES auth.users(id) ON DELETE SET NULL;
  END IF;
END $$;

-- Index for user lookups
CREATE INDEX IF NOT EXISTS idx_projects_user_id ON projects(user_id);

-- ============================================
-- 3. Enable Row Level Security
-- ============================================

-- Projects table
ALTER TABLE projects ENABLE ROW LEVEL SECURITY;

-- Policy: Users can see their own projects OR anonymous projects (user_id IS NULL)
-- This allows the "Save to garden" flow - anonymous evaluations can be viewed
-- and later claimed by linking user_id
DROP POLICY IF EXISTS "Users see own projects" ON projects;
CREATE POLICY "Users see own projects" ON projects
  FOR SELECT
  USING (
    user_id IS NULL                    -- Anonymous projects are public
    OR auth.uid() = user_id            -- Users see their own
  );

-- Policy: Users can insert projects for themselves or anonymous
DROP POLICY IF EXISTS "Users insert own projects" ON projects;
CREATE POLICY "Users insert own projects" ON projects
  FOR INSERT
  WITH CHECK (
    user_id IS NULL                    -- Anonymous inserts allowed
    OR auth.uid() = user_id            -- Users can create for themselves
  );

-- Policy: Users can update only their own projects
DROP POLICY IF EXISTS "Users update own projects" ON projects;
CREATE POLICY "Users update own projects" ON projects
  FOR UPDATE
  USING (auth.uid() = user_id)
  WITH CHECK (auth.uid() = user_id);

-- Policy: Users can delete only their own projects
DROP POLICY IF EXISTS "Users delete own projects" ON projects;
CREATE POLICY "Users delete own projects" ON projects
  FOR DELETE
  USING (auth.uid() = user_id);

-- Evaluations table
ALTER TABLE evaluations ENABLE ROW LEVEL SECURITY;

-- Policy: Users see evaluations for projects they can see
DROP POLICY IF EXISTS "Users see own evaluations" ON evaluations;
CREATE POLICY "Users see own evaluations" ON evaluations
  FOR SELECT
  USING (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = evaluations.project_id
      AND (projects.user_id IS NULL OR projects.user_id = auth.uid())
    )
  );

-- Policy: Users can insert evaluations for their projects
DROP POLICY IF EXISTS "Users insert own evaluations" ON evaluations;
CREATE POLICY "Users insert own evaluations" ON evaluations
  FOR INSERT
  WITH CHECK (
    EXISTS (
      SELECT 1 FROM projects 
      WHERE projects.id = evaluations.project_id
      AND (projects.user_id IS NULL OR projects.user_id = auth.uid())
    )
  );

-- User profiles table
ALTER TABLE user_profiles ENABLE ROW LEVEL SECURITY;

-- Policy: Users see only their own profile
DROP POLICY IF EXISTS "Users see own profile" ON user_profiles;
CREATE POLICY "Users see own profile" ON user_profiles
  FOR SELECT
  USING (auth.uid() = id);

-- Policy: Users can update only their own profile
DROP POLICY IF EXISTS "Users update own profile" ON user_profiles;
CREATE POLICY "Users update own profile" ON user_profiles
  FOR UPDATE
  USING (auth.uid() = id)
  WITH CHECK (auth.uid() = id);

-- ============================================
-- 4. Service role bypass
-- ============================================
-- Note: The service_role key bypasses RLS automatically.
-- This is why our backend can insert/update any row.

-- ============================================
-- 5. Claim anonymous project function
-- ============================================
-- Allows a user to claim an anonymous project after signing in

CREATE OR REPLACE FUNCTION claim_project(
  p_project_id UUID,
  p_user_id UUID
)
RETURNS BOOLEAN AS $$
DECLARE
  v_current_user_id UUID;
BEGIN
  -- Get current owner
  SELECT user_id INTO v_current_user_id 
  FROM projects 
  WHERE id = p_project_id;
  
  -- If not found or already owned, return false
  IF NOT FOUND THEN
    RETURN FALSE;
  END IF;
  
  IF v_current_user_id IS NOT NULL THEN
    -- Already owned - check if by the same user
    RETURN v_current_user_id = p_user_id;
  END IF;
  
  -- Claim the project
  UPDATE projects 
  SET user_id = p_user_id, updated_at = NOW()
  WHERE id = p_project_id AND user_id IS NULL;
  
  RETURN TRUE;
END;
$$ LANGUAGE plpgsql SECURITY DEFINER;

-- Grant execute to authenticated users
GRANT EXECUTE ON FUNCTION claim_project TO authenticated;

-- ============================================
-- Done
-- ============================================
COMMENT ON TABLE user_profiles IS 'Extended user profile data for Prebloom';
COMMENT ON FUNCTION claim_project IS 'Allows a user to claim an anonymous project';
