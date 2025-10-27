-- Create client_activity table for tracking client-side actions
CREATE TABLE IF NOT EXISTS public.client_activity (
  id BIGSERIAL PRIMARY KEY,
  client_email TEXT NOT NULL,
  activity TEXT NOT NULL,
  type TEXT,
  timestamp TIMESTAMPTZ DEFAULT NOW()
);

-- Create index for faster queries
CREATE INDEX IF NOT EXISTS idx_client_activity_timestamp ON public.client_activity(timestamp DESC);
CREATE INDEX IF NOT EXISTS idx_client_activity_client_email ON public.client_activity(client_email);

-- Enable RLS
ALTER TABLE public.client_activity ENABLE ROW LEVEL SECURITY;

-- Policy: Anyone can insert their own activity
CREATE POLICY "clients_can_insert_own_activity"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (auth.email() = client_email);

-- Policy: Admins can view all activity
CREATE POLICY "admins_can_view_activity"
  ON public.client_activity
  FOR SELECT
  TO authenticated
  USING (
    auth.email() LIKE '%@brandible.com' OR
    client_email = auth.email()
  );

-- Grant permissions
GRANT INSERT, SELECT ON public.client_activity TO authenticated;
GRANT USAGE, SELECT ON SEQUENCE client_activity_id_seq TO authenticated;
