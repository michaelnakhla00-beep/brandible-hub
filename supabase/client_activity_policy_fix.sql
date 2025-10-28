-- Fix RLS policies for client_activity table
-- This allows authenticated users to insert their own activity
-- And admins to view all activity

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "clients_can_insert_own_activity" ON public.client_activity;
DROP POLICY IF EXISTS "admins_can_view_activity" ON public.client_activity;
DROP POLICY IF EXISTS "clients_can_insert_activity" ON public.client_activity;
DROP POLICY IF EXISTS "allow_all_inserts_temp" ON public.client_activity;

-- Allow authenticated users to insert their own activity
-- We use lowercase comparison to handle case sensitivity
CREATE POLICY "clients_can_insert_own_activity"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (
    LOWER(auth.email()) = LOWER(client_email)
  );

-- Allow admins and the client themselves to view activity
CREATE POLICY "admins_can_view_activity"
  ON public.client_activity
  FOR SELECT
  TO authenticated
  USING (
    LOWER(auth.email()) LIKE '%@brandible.com' OR
    LOWER(auth.email()) = LOWER(client_email)
  );

-- Also add a permissive policy for testing (can be removed later)
-- This allows any authenticated user to insert activity
CREATE POLICY "authenticated_users_can_insert"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Temporary permissive policy for debugging (REMOVE after testing)
-- This allows all authenticated users to insert any activity
CREATE POLICY "allow_all_inserts_temp"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
