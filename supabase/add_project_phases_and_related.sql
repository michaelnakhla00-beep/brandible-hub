-- Project phases, deliverables, notifications, user_settings, brand_profiles
DO $$
BEGIN
  -- project_phases
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_phases'
  ) THEN
    CREATE TABLE public.project_phases (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      phase_name text NOT NULL,
      start_date date,
      end_date date,
      status text NOT NULL CHECK (status IN ('pending','active','done')) DEFAULT 'pending',
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_project_phases_project ON public.project_phases(project_id);
  END IF;

  -- project_deliverables
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='project_deliverables'
  ) THEN
    CREATE TABLE public.project_deliverables (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      title text NOT NULL,
      description text,
      is_complete boolean DEFAULT false,
      created_at timestamptz DEFAULT now()
    );
    CREATE INDEX IF NOT EXISTS idx_project_deliverables_project ON public.project_deliverables(project_id);
  END IF;

  -- notifications
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='notifications'
  ) THEN
    CREATE TABLE public.notifications (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL,
      message text NOT NULL,
      type text NOT NULL CHECK (type IN ('file','invoice','comment','system')),
      created_at timestamptz DEFAULT now(),
      is_read boolean DEFAULT false
    );
    CREATE INDEX IF NOT EXISTS idx_notifications_user ON public.notifications(user_id, is_read);
  END IF;

  -- user_settings
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='user_settings'
  ) THEN
    CREATE TABLE public.user_settings (
      user_id uuid PRIMARY KEY,
      email_notifications boolean DEFAULT true,
      invoice_reminders boolean DEFAULT true,
      updated_at timestamptz DEFAULT now()
    );
  END IF;

  -- brand_profiles
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables WHERE table_schema='public' AND table_name='brand_profiles'
  ) THEN
    CREATE TABLE public.brand_profiles (
      user_id uuid PRIMARY KEY,
      logo_url text,
      brand_colors jsonb DEFAULT '[]'::jsonb,
      brand_fonts text,
      target_audience text,
      updated_at timestamptz DEFAULT now()
    );
  END IF;
END $$;


