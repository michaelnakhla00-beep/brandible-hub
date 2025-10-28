-- Check existing RLS policies on client_activity table
SELECT 
  schemaname, 
  tablename, 
  policyname, 
  permissive,
  roles,
  cmd,
  qual,
  with_check
FROM pg_policies 
WHERE tablename = 'client_activity';

-- Drop ALL existing policies
DROP POLICY IF EXISTS "clients_can_insert_own_activity" ON public.client_activity;
DROP POLICY IF EXISTS "admins_can_view_activity" ON public.client_activity;
DROP POLICY IF EXISTS "authenticated_users_can_insert" ON public.client_activity;
DROP POLICY IF EXISTS "allow_all_inserts_temp" ON public.client_activity;
DROP POLICY IF EXISTS "public_allow_inserts" ON public.client_activity;

-- Create simple permissive policy for anon users
CREATE POLICY "anon_can_insert"
  ON public.client_activity
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated users
CREATE POLICY "authenticated_can_insert"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- View all policies
SELECT policyname, cmd, roles FROM pg_policies WHERE tablename = 'client_activity';
