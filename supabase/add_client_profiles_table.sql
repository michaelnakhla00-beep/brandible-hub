-- Create client_profiles table for tracking profile completion
-- Run this in Supabase SQL Editor
-- NOTE: Make sure to run supabase/create_update_function.sql FIRST if the function doesn't exist

-- Ensure the update_updated_at_column function exists
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'client_profiles'
  ) THEN
    CREATE TABLE public.client_profiles (
      user_id uuid PRIMARY KEY, -- References clients.id or Netlify Identity user
      email text, -- Denormalized for easier lookup
      completion_percentage int DEFAULT 0 CHECK (completion_percentage >= 0 AND completion_percentage <= 100),
      missing_items jsonb DEFAULT '[]'::jsonb,
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Create index
    CREATE INDEX IF NOT EXISTS idx_client_profiles_email ON public.client_profiles(email);

    -- Enable RLS
    ALTER TABLE public.client_profiles ENABLE ROW LEVEL SECURITY;

    -- Policy: Users can view their own profile
    CREATE POLICY "Users can view their own profile"
      ON public.client_profiles FOR SELECT
      USING (true); -- Will be filtered by Netlify Functions

    -- Policy: Users can update their own profile
    CREATE POLICY "Users can update their own profile"
      ON public.client_profiles FOR UPDATE
      USING (true);

    -- Policy: Admins can view all profiles
    CREATE POLICY "Admins can view all profiles"
      ON public.client_profiles FOR SELECT
      USING (true);

    -- Policy: Admins can insert/update profiles
    CREATE POLICY "Admins can manage profiles"
      ON public.client_profiles FOR ALL
      USING (true);

    -- Trigger to update updated_at
    CREATE TRIGGER update_client_profiles_updated_at
      BEFORE UPDATE ON public.client_profiles
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

