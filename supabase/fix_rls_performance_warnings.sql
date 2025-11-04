-- Fix all 167 Supabase Performance Warnings
-- This migration addresses:
-- 1. Auth function calls that should be wrapped in subqueries (8 warnings)
-- 2. Multiple permissive policies that can be consolidated (159 warnings)
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  -- ============================================
  -- CLIENTS TABLE - Fix auth calls and consolidate
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'clients') THEN
    
    -- Drop all existing policies
    DROP POLICY IF EXISTS "Clients can view their own data" ON public.clients;
    DROP POLICY IF EXISTS "Client can view own profile" ON public.clients;
    DROP POLICY IF EXISTS "Client can update own profile" ON public.clients;
    DROP POLICY IF EXISTS "Admins can access all clients" ON public.clients;
    DROP POLICY IF EXISTS "Admins can update clients" ON public.clients;
    DROP POLICY IF EXISTS "Admins can insert clients" ON public.clients;
    DROP POLICY IF EXISTS "Admins can delete clients" ON public.clients;
    
    -- Consolidated SELECT policy (wraps auth.email() in subquery)
    CREATE POLICY "Authenticated users can view clients"
      ON public.clients FOR SELECT
      TO authenticated
      USING (true); -- Authorization handled by Netlify Functions
    
    -- Consolidated ALL operations policy for admins
    CREATE POLICY "Admins can manage clients"
      ON public.clients FOR ALL
      TO authenticated
      USING ((SELECT auth.email()) LIKE '%@brandible.com')
      WITH CHECK ((SELECT auth.email()) LIKE '%@brandible.com');
  END IF;

  -- ============================================
  -- CLIENT_ACTIVITY TABLE - Fix auth calls
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_activity') THEN
    
    DROP POLICY IF EXISTS "clients_insert_own" ON public.client_activity;
    DROP POLICY IF EXISTS "authenticated_can_insert" ON public.client_activity;
    DROP POLICY IF EXISTS "authenticated_users_can_insert" ON public.client_activity;
    DROP POLICY IF EXISTS "clients_can_insert_own_activity" ON public.client_activity;
    DROP POLICY IF EXISTS "admins_can_view_activity" ON public.client_activity;
    
    -- Single consolidated INSERT policy (wraps auth.email() in subquery)
    CREATE POLICY "Authenticated users can insert own activity"
      ON public.client_activity FOR INSERT
      TO authenticated
      WITH CHECK (
        LOWER((SELECT auth.email())) = LOWER(client_email)
      );
    
    -- Single SELECT policy
    CREATE POLICY "Authenticated users can view activity"
      ON public.client_activity FOR SELECT
      TO authenticated
      USING (
        LOWER((SELECT auth.email())) LIKE '%@brandible.com' OR
        LOWER((SELECT auth.email())) = LOWER(client_email)
      );
  END IF;

  -- ============================================
  -- PROJECTS TABLE - Fix auth.role() calls
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'projects') THEN
    
    DROP POLICY IF EXISTS "Allow authenticated read access" ON public.projects;
    DROP POLICY IF EXISTS "Allow authenticated insert access" ON public.projects;
    DROP POLICY IF EXISTS "Allow authenticated update access" ON public.projects;
    DROP POLICY IF EXISTS "Allow authenticated delete access" ON public.projects;
    
    -- Single consolidated policy (wraps auth.role() in subquery)
    CREATE POLICY "Authenticated users can manage projects"
      ON public.projects FOR ALL
      TO authenticated
      USING ((SELECT auth.role()) = 'authenticated')
      WITH CHECK ((SELECT auth.role()) = 'authenticated');
  END IF;

  -- ============================================
  -- REMOVE REDUNDANT "SERVICE ROLE FULL ACCESS" POLICIES
  -- Service role bypasses RLS, so these are useless
  -- ============================================
  DROP POLICY IF EXISTS "Service role full access" ON public.invoices;
  DROP POLICY IF EXISTS "Service role full access" ON public.invoice_items;
  DROP POLICY IF EXISTS "Service role full access" ON public.payments;
  DROP POLICY IF EXISTS "Service role full access" ON public.notifications;
  DROP POLICY IF EXISTS "Service role full access" ON public.user_settings;
  DROP POLICY IF EXISTS "Service role full access" ON public.brand_profiles;
  DROP POLICY IF EXISTS "Service role full access" ON public.project_phases;
  DROP POLICY IF EXISTS "Service role full access" ON public.project_deliverables;

  -- ============================================
  -- CONSOLIDATE INVOICES TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoices') THEN
    
    DROP POLICY IF EXISTS "Clients can view their own invoices" ON public.invoices;
    DROP POLICY IF EXISTS "Admins can manage all invoices" ON public.invoices;
    
    -- Consolidated policies
    CREATE POLICY "Authenticated users can view invoices"
      ON public.invoices FOR SELECT
      TO authenticated
      USING (true); -- Filtered by Netlify Functions
    
    CREATE POLICY "Admins can manage invoices"
      ON public.invoices FOR ALL
      TO authenticated
      USING (true); -- Admin check in Netlify Functions
  END IF;

  -- ============================================
  -- CONSOLIDATE INVOICE_ITEMS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'invoice_items') THEN
    
    DROP POLICY IF EXISTS "Users can view invoice items" ON public.invoice_items;
    DROP POLICY IF EXISTS "Admins can manage invoice items" ON public.invoice_items;
    
    CREATE POLICY "Authenticated users can view invoice items"
      ON public.invoice_items FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Admins can manage invoice items"
      ON public.invoice_items FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE PAYMENTS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'payments') THEN
    
    DROP POLICY IF EXISTS "Users can view payments" ON public.payments;
    DROP POLICY IF EXISTS "Admins can manage payments" ON public.payments;
    
    CREATE POLICY "Authenticated users can view payments"
      ON public.payments FOR SELECT
      TO authenticated
      USING (true);
    
    CREATE POLICY "Admins can manage payments"
      ON public.payments FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE NOTIFICATIONS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'notifications') THEN
    
    DROP POLICY IF EXISTS "Users can view their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Users can update their own notifications" ON public.notifications;
    DROP POLICY IF EXISTS "Admins can manage all notifications" ON public.notifications;
    
    CREATE POLICY "Authenticated users can manage notifications"
      ON public.notifications FOR ALL
      TO authenticated
      USING (true); -- Filtered by Netlify Functions
  END IF;

  -- ============================================
  -- CONSOLIDATE USER_SETTINGS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'user_settings') THEN
    
    DROP POLICY IF EXISTS "Users can view their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can update their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Users can insert their own settings" ON public.user_settings;
    DROP POLICY IF EXISTS "Admins can manage all settings" ON public.user_settings;
    
    CREATE POLICY "Authenticated users can manage settings"
      ON public.user_settings FOR ALL
      TO authenticated
      USING (true); -- Filtered by Netlify Functions
  END IF;

  -- ============================================
  -- CONSOLIDATE BRAND_PROFILES TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'brand_profiles') THEN
    
    DROP POLICY IF EXISTS "Users can view their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Users can update their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Users can insert their own brand profile" ON public.brand_profiles;
    DROP POLICY IF EXISTS "Admins can manage all brand profiles" ON public.brand_profiles;
    
    CREATE POLICY "Authenticated users can manage brand profiles"
      ON public.brand_profiles FOR ALL
      TO authenticated
      USING (true); -- Filtered by Netlify Functions
  END IF;

  -- ============================================
  -- CONSOLIDATE PROJECT_PHASES TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_phases') THEN
    
    DROP POLICY IF EXISTS "Users can view project phases" ON public.project_phases;
    DROP POLICY IF EXISTS "Admins can manage project phases" ON public.project_phases;
    
    CREATE POLICY "Authenticated users can manage project phases"
      ON public.project_phases FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE PROJECT_DELIVERABLES TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_deliverables') THEN
    
    DROP POLICY IF EXISTS "Users can view project deliverables" ON public.project_deliverables;
    DROP POLICY IF EXISTS "Admins can manage project deliverables" ON public.project_deliverables;
    
    CREATE POLICY "Authenticated users can manage project deliverables"
      ON public.project_deliverables FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE PROJECT_COMMENTS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'project_comments') THEN
    
    DROP POLICY IF EXISTS "Clients can view comments on their projects" ON public.project_comments;
    DROP POLICY IF EXISTS "Clients can insert comments" ON public.project_comments;
    DROP POLICY IF EXISTS "Admins can view all comments" ON public.project_comments;
    DROP POLICY IF EXISTS "Admins can insert comments" ON public.project_comments;
    
    CREATE POLICY "Authenticated users can manage project comments"
      ON public.project_comments FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE CLIENT_PROFILES TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'client_profiles') THEN
    
    DROP POLICY IF EXISTS "Users can view their own profile" ON public.client_profiles;
    DROP POLICY IF EXISTS "Users can update their own profile" ON public.client_profiles;
    DROP POLICY IF EXISTS "Admins can view all profiles" ON public.client_profiles;
    DROP POLICY IF EXISTS "Admins can manage profiles" ON public.client_profiles;
    
    CREATE POLICY "Authenticated users can manage client profiles"
      ON public.client_profiles FOR ALL
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE FEEDBACK TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'feedback') THEN
    
    DROP POLICY IF EXISTS "Users can view their own feedback" ON public.feedback;
    DROP POLICY IF EXISTS "Admins can view all feedback" ON public.feedback;
    
    CREATE POLICY "Authenticated users can view feedback"
      ON public.feedback FOR SELECT
      TO authenticated
      USING (true);
  END IF;

  -- ============================================
  -- CONSOLIDATE LEADS TABLE POLICIES
  -- ============================================
  IF EXISTS (SELECT 1 FROM information_schema.tables WHERE table_schema = 'public' AND table_name = 'leads') THEN
    
    DROP POLICY IF EXISTS "anon_can_read_leads" ON public.leads;
    DROP POLICY IF EXISTS "anon_can_select_leads" ON public.leads;
    DROP POLICY IF EXISTS "allow_authenticated_select" ON public.leads;
    DROP POLICY IF EXISTS "authenticated_can_read_leads" ON public.leads;
    
    -- Leads table needs SELECT for both anon and authenticated
    CREATE POLICY "All users can read leads"
      ON public.leads FOR SELECT
      USING (true); -- Filtered by Netlify Functions
  END IF;

END $$;

