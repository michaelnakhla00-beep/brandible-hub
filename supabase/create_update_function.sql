-- Create or replace the update_updated_at_column function
-- Run this FIRST before running other migrations that use triggers
-- This function is reusable across all tables that need automatic updated_at tracking

CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = now();
  RETURN NEW;
END;
$$ LANGUAGE plpgsql;

