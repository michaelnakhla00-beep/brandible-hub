-- Add optional score column to leads (hot|warm|cold) and ensure source exists
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'score'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN score text CHECK (score IN ('hot','warm','cold')) DEFAULT 'warm';
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'leads' AND column_name = 'source'
  ) THEN
    ALTER TABLE public.leads
      ADD COLUMN source text DEFAULT 'other';
  END IF;
END $$;


