-- Create resources table for guides, templates, and tutorials
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
    WHERE table_schema = 'public' AND table_name = 'resources'
  ) THEN
    CREATE TABLE public.resources (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      title text NOT NULL,
      description text,
      file_url text NOT NULL,
      category text NOT NULL CHECK (category IN ('Guides', 'Templates', 'Tutorials')),
      visible_to text NOT NULL DEFAULT 'client' CHECK (visible_to IN ('client', 'internal')),
      created_at timestamptz DEFAULT now(),
      updated_at timestamptz DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_resources_category ON public.resources(category);
    CREATE INDEX IF NOT EXISTS idx_resources_visible_to ON public.resources(visible_to);
    CREATE INDEX IF NOT EXISTS idx_resources_created_at ON public.resources(created_at DESC);

    -- Enable RLS
    ALTER TABLE public.resources ENABLE ROW LEVEL SECURITY;

    -- Policy: Anyone can view client-visible resources
    CREATE POLICY "Anyone can view client resources"
      ON public.resources FOR SELECT
      USING (visible_to = 'client');

    -- Policy: Admins can view all resources
    CREATE POLICY "Admins can view all resources"
      ON public.resources FOR SELECT
      USING (true);

    -- Policy: Admins can insert resources
    CREATE POLICY "Admins can insert resources"
      ON public.resources FOR INSERT
      WITH CHECK (true);

    -- Policy: Admins can update resources
    CREATE POLICY "Admins can update resources"
      ON public.resources FOR UPDATE
      USING (true);

    -- Policy: Admins can delete resources
    CREATE POLICY "Admins can delete resources"
      ON public.resources FOR DELETE
      USING (true);

    -- Trigger to update updated_at
    CREATE TRIGGER update_resources_updated_at
      BEFORE UPDATE ON public.resources
      FOR EACH ROW
      EXECUTE FUNCTION update_updated_at_column();
  END IF;
END $$;

