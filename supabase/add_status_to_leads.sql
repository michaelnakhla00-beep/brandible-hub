-- Add status column to leads table
ALTER TABLE IF EXISTS public.leads
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'New';

-- Add index for status queries
CREATE INDEX IF NOT EXISTS idx_leads_status ON public.leads(status);

-- Optional: Add a comment to document the column
COMMENT ON COLUMN public.leads.status IS 'Status of the lead: New, Contacted, In Progress, or Closed';

-- Note: The status column will default to 'New' for existing records

