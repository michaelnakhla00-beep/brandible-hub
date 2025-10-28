-- TEMPORARY: Make client_activity table insert public for debugging
-- WARNING: This is NOT secure - only use for testing!
-- Remove this policy after confirming inserts work

-- Allow anyone to insert (for testing only)
DROP POLICY IF EXISTS "public_allow_inserts" ON public.client_activity;

CREATE POLICY "public_allow_inserts"
  ON public.client_activity
  FOR INSERT
  TO anon
  WITH CHECK (true);

-- Also allow authenticated users
DROP POLICY IF EXISTS "allow_all_inserts_temp" ON public.client_activity;

CREATE POLICY "allow_all_inserts_temp"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify policies exist
SELECT * FROM pg_policies WHERE tablename = 'client_activity';
