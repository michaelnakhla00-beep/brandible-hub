-- Create projects table for Brandible Hub
-- This table stores client projects with editable status

CREATE TABLE IF NOT EXISTS public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'In Progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_email, title)
);

-- Create index on client_email for fast lookups
CREATE INDEX IF NOT EXISTS idx_projects_client_email ON public.projects(client_email);

-- Create index on status for filtering
CREATE INDEX IF NOT EXISTS idx_projects_status ON public.projects(status);

-- Enable RLS (Row Level Security)
ALTER TABLE public.projects ENABLE ROW LEVEL SECURITY;

-- Create policy to allow authenticated users to read all projects
CREATE POLICY "Allow authenticated read access"
  ON public.projects
  FOR SELECT
  USING (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to insert projects
CREATE POLICY "Allow authenticated insert access"
  ON public.projects
  FOR INSERT
  WITH CHECK (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to update projects
CREATE POLICY "Allow authenticated update access"
  ON public.projects
  FOR UPDATE
  USING (auth.role() = 'authenticated');

-- Create policy to allow authenticated users to delete projects
CREATE POLICY "Allow authenticated delete access"
  ON public.projects
  FOR DELETE
  USING (auth.role() = 'authenticated');

-- Add function to automatically update updated_at timestamp
CREATE OR REPLACE FUNCTION public.handle_updated_at()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

-- Create trigger to update updated_at on UPDATE
CREATE TRIGGER projects_updated_at
  BEFORE UPDATE ON public.projects
  FOR EACH ROW
  EXECUTE FUNCTION public.handle_updated_at();

-- Add comment to table
COMMENT ON TABLE public.projects IS 'Stores client projects with editable status for Brandible Hub';

