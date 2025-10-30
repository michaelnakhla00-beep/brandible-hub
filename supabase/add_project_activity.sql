-- Add activity JSONB column to projects to persist project activity/comments
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns
    WHERE table_schema = 'public' AND table_name = 'projects' AND column_name = 'activity'
  ) THEN
    ALTER TABLE public.projects
      ADD COLUMN activity jsonb;
  END IF;
END $$;


