-- Add status column to clients table if it doesn't exist
ALTER TABLE IF EXISTS public.clients 
ADD COLUMN IF NOT EXISTS status TEXT DEFAULT 'Active' CHECK (status IN ('Active', 'Paused', 'Archived', 'Inactive'));

-- Create index on status for faster filtering
CREATE INDEX IF NOT EXISTS idx_clients_status ON public.clients(status);

