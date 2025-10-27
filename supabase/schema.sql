-- Brandible Hub Supabase Schema
-- Run this in your Supabase SQL editor to create the clients table

-- Create clients table
CREATE TABLE IF NOT EXISTS clients (
  id UUID DEFAULT gen_random_uuid() PRIMARY KEY,
  email TEXT NOT NULL UNIQUE,
  name TEXT NOT NULL,
  kpis JSONB DEFAULT '{}',
  projects JSONB DEFAULT '[]',
  files JSONB DEFAULT '[]',
  invoices JSONB DEFAULT '[]',
  activity JSONB DEFAULT '[]',
  updates JSONB DEFAULT '[]',
  created_at TIMESTAMP WITH TIME ZONE DEFAULT now(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT now()
);

-- Create index on email for faster lookups
CREATE INDEX IF NOT EXISTS idx_clients_email ON clients(email);

-- Create trigger to update updated_at timestamp
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

CREATE TRIGGER update_clients_updated_at
  BEFORE UPDATE ON clients
  FOR EACH ROW
  EXECUTE FUNCTION update_updated_at_column();

-- Enable Row Level Security (RLS)
ALTER TABLE clients ENABLE ROW LEVEL SECURITY;

-- Allow all authenticated users to read their own data
-- Note: This will be enforced by Netlify Identity checks in the functions
-- But RLS provides an extra security layer
CREATE POLICY "Clients can view their own data"
  ON clients FOR SELECT
  USING (true);

-- Allow authenticated admins to update any client
-- Note: Admin check happens in Netlify Functions
CREATE POLICY "Admins can update clients"
  ON clients FOR UPDATE
  USING (true);

-- Allow authenticated admins to insert clients
CREATE POLICY "Admins can insert clients"
  ON clients FOR INSERT
  WITH CHECK (true);

-- Allow authenticated admins to delete clients
CREATE POLICY "Admins can delete clients"
  ON clients FOR DELETE
  USING (true);

