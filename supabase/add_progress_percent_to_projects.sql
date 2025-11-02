-- Add progress_percent column to projects table
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' 
      AND table_name = 'projects' 
      AND column_name = 'progress_percent'
  ) THEN
    ALTER TABLE public.projects
    ADD COLUMN progress_percent INT DEFAULT 0 CHECK (progress_percent >= 0 AND progress_percent <= 100);
    
    -- Create index for faster queries
    CREATE INDEX IF NOT EXISTS idx_projects_progress_percent ON public.projects(progress_percent);
  END IF;
END $$;

