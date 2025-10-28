-- Apply debug policy to allow all authenticated inserts
-- This is TEMPORARY for debugging - remove after testing

-- Drop the temporary policy if it exists
DROP POLICY IF EXISTS "allow_all_inserts_temp" ON public.client_activity;

-- Create temporary permissive policy
CREATE POLICY "allow_all_inserts_temp"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);

-- Verify policy was created
SELECT * FROM pg_policies WHERE tablename = 'client_activity';
