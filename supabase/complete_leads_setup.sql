-- Complete setup for leads table with status support

-- Add status column if it doesn't exist
ALTER TABLE IF EXISTS public.leads ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- Enable RLS if not already enabled
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "anon_can_select_leads" ON public.leads;
DROP POLICY IF EXISTS "anon_can_update_leads" ON public.leads;
DROP POLICY IF EXISTS "authenticated_can_select_leads" ON public.leads;
DROP POLICY IF EXISTS "authenticated_can_update_leads" ON public.leads;

-- Allow anyone to read leads
CREATE POLICY "anon_can_select_leads"
ON public.leads
FOR SELECT
TO anon
USING (true);

-- Allow anyone to update leads
CREATE POLICY "anon_can_update_leads"
ON public.leads
FOR UPDATE
TO anon
USING (true)
WITH CHECK (true);

-- Also allow authenticated users to read
CREATE POLICY "authenticated_can_select_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

-- Also allow authenticated users to update
CREATE POLICY "authenticated_can_update_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true)
WITH CHECK (true);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.leads TO anon;
GRANT SELECT, UPDATE ON public.leads TO authenticated;

-- Update any existing rows without status to have 'New'
UPDATE public.leads SET status = 'New' WHERE status IS NULL;

