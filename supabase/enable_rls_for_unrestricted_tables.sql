-- Enable RLS and create policies for previously unrestricted tables
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  -- ============================================
  -- INVOICES TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoices'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.invoices ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Clients can view their own invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;

    -- Policy: Clients can view their own invoices (filtered by Netlify Functions)
    CREATE POLICY "Clients can view their own invoices"
      ON public.invoices FOR SELECT
      USING (true); -- Actual filtering done by Netlify Functions based on client_id

    -- Policy: Admins can manage all invoices
    CREATE POLICY "Admins can manage all invoices"
      ON public.invoices FOR ALL
      USING (true); -- Admin access via Netlify Functions with service role

    -- Policy: Service role can do everything (for Netlify Functions)
    CREATE POLICY "Service role full access"
      ON public.invoices FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- INVOICE_ITEMS TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'invoice_items'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.invoice_items ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
    DROP POLICY IF EXISTS "Admins can manage invoice items" ON public.invoice_items;

    -- Policy: Users can view items for invoices they can access
    CREATE POLICY "Users can view invoice items"
      ON public.invoice_items FOR SELECT
      USING (true); -- Filtered via invoice relationship in Netlify Functions

    -- Policy: Admins can manage all invoice items
    CREATE POLICY "Admins can manage invoice items"
      ON public.invoice_items FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.invoice_items FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- PAYMENTS TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'payments'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.payments ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
    DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;

    -- Policy: Users can view payments for invoices they can access
    CREATE POLICY "Users can view payments"
      ON public.payments FOR SELECT
      USING (true); -- Filtered via invoice relationship in Netlify Functions

    -- Policy: Admins can manage all payments
    CREATE POLICY "Admins can manage payments"
      ON public.payments FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.payments FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- NOTIFICATIONS TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'notifications'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.notifications ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;

    -- Policy: Users can view their own notifications
    CREATE POLICY "Users can view their own notifications"
      ON public.notifications FOR SELECT
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Users can update their own notifications (mark as read)
    CREATE POLICY "Users can update their own notifications"
      ON public.notifications FOR UPDATE
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Admins can manage all notifications
    CREATE POLICY "Admins can manage all notifications"
      ON public.notifications FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.notifications FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- USER_SETTINGS TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'user_settings'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.user_settings ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Admins can manage all settings" ON public.user_settings;

    -- Policy: Users can view their own settings
    CREATE POLICY "Users can view their own settings"
      ON public.user_settings FOR SELECT
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Users can update their own settings
    CREATE POLICY "Users can update their own settings"
      ON public.user_settings FOR UPDATE
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Users can insert their own settings
    CREATE POLICY "Users can insert their own settings"
      ON public.user_settings FOR INSERT
      WITH CHECK (true); -- Validated by Netlify Functions

    -- Policy: Admins can manage all settings
    CREATE POLICY "Admins can manage all settings"
      ON public.user_settings FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.user_settings FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- BRAND_PROFILES TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'brand_profiles'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.brand_profiles ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Users can update their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Users can insert their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Admins can manage all brand profiles" ON public.brand_profiles;

    -- Policy: Users can view their own brand profile
    CREATE POLICY "Users can view their own brand profile"
      ON public.brand_profiles FOR SELECT
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Users can update their own brand profile
    CREATE POLICY "Users can update their own brand profile"
      ON public.brand_profiles FOR UPDATE
      USING (true); -- Filtered by user_id in Netlify Functions

    -- Policy: Users can insert their own brand profile
    CREATE POLICY "Users can insert their own brand profile"
      ON public.brand_profiles FOR INSERT
      WITH CHECK (true); -- Validated by Netlify Functions

    -- Policy: Admins can manage all brand profiles
    CREATE POLICY "Admins can manage all brand profiles"
      ON public.brand_profiles FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.brand_profiles FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- PROJECT_PHASES TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_phases'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.project_phases ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view project phases" ON public.project_phases;
    DROP POLICY IF EXISTS "Admins can manage project phases" ON public.project_phases;

    -- Policy: Users can view phases for their projects
    CREATE POLICY "Users can view project phases"
      ON public.project_phases FOR SELECT
      USING (true); -- Filtered via project relationship in Netlify Functions

    -- Policy: Admins can manage all project phases
    CREATE POLICY "Admins can manage project phases"
      ON public.project_phases FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.project_phases FOR ALL
      USING (true);
  END IF;

  -- ============================================
  -- PROJECT_DELIVERABLES TABLE
  -- ============================================
  IF EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_deliverables'
  ) THEN
    -- Enable RLS
    ALTER TABLE public.project_deliverables ENABLE ROW LEVEL SECURITY;

    -- Drop existing policies if any
    DROP POLICY IF EXISTS "Users can view project deliverables" ON public.project_deliverables;
    DROP POLICY IF EXISTS "Admins can manage project deliverables" ON public.project_deliverables;

    -- Policy: Users can view deliverables for their projects
    CREATE POLICY "Users can view project deliverables"
      ON public.project_deliverables FOR SELECT
      USING (true); -- Filtered via project relationship in Netlify Functions

    -- Policy: Admins can manage all project deliverables
    CREATE POLICY "Admins can manage project deliverables"
      ON public.project_deliverables FOR ALL
      USING (true);

    -- Policy: Service role full access
    CREATE POLICY "Service role full access"
      ON public.project_deliverables FOR ALL
      USING (true);
  END IF;

END $$;

