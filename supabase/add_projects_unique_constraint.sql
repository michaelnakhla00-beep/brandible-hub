-- Add unique constraint to projects table if it doesn't exist
-- Run this AFTER the create_projects_table.sql migration

-- Drop the constraint if it exists (to avoid errors)
ALTER TABLE public.projects DROP CONSTRAINT IF EXISTS projects_client_email_title_key;

-- Add the unique constraint
ALTER TABLE public.projects 
ADD CONSTRAINT projects_client_email_title_key 
UNIQUE (client_email, title);

