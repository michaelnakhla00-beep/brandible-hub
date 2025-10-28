-- Enable RLS on leads table if not already enabled
ALTER TABLE IF EXISTS public.leads ENABLE ROW LEVEL SECURITY;

-- Drop existing policies if they exist
DROP POLICY IF EXISTS "anon_can_select_leads" ON public.leads;
DROP POLICY IF EXISTS "anon_can_update_leads" ON public.leads;
DROP POLICY IF EXISTS "authenticated_can_select_leads" ON public.leads;
DROP POLICY IF EXISTS "authenticated_can_update_leads" ON public.leads;

-- Allow anyone to read leads (since admin panel uses anon key)
CREATE POLICY "anon_can_select_leads"
ON public.leads
FOR SELECT
TO anon
USING (true);

-- Allow anyone to update leads (admin panel needs this)
CREATE POLICY "anon_can_update_leads"
ON public.leads
FOR UPDATE
TO anon
USING (true);

-- Also allow authenticated users
CREATE POLICY "authenticated_can_select_leads"
ON public.leads
FOR SELECT
TO authenticated
USING (true);

CREATE POLICY "authenticated_can_update_leads"
ON public.leads
FOR UPDATE
TO authenticated
USING (true);

-- Grant necessary permissions
GRANT SELECT, UPDATE ON public.leads TO anon;
GRANT SELECT, UPDATE ON public.leads TO authenticated;

