-- Ensure profile fields exist on clients table
DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'company'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN company text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'manager'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN manager text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'phone'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN phone text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'website'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN website text;
  END IF;

  IF NOT EXISTS (
    SELECT 1 FROM information_schema.columns 
    WHERE table_schema = 'public' AND table_name = 'clients' AND column_name = 'profile_url'
  ) THEN
    ALTER TABLE public.clients ADD COLUMN profile_url text;
  END IF;
END $$;


