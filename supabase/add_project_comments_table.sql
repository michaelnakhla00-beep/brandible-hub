-- Create project_comments table for client/admin communication
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'project_comments'
  ) THEN
    CREATE TABLE public.project_comments (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      author_role text NOT NULL CHECK (author_role IN ('client', 'admin')),
      author_id text, -- email or user identifier
      message text NOT NULL,
      created_at timestamptz DEFAULT now()
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_project_comments_project_id ON public.project_comments(project_id);
    CREATE INDEX IF NOT EXISTS idx_project_comments_created_at ON public.project_comments(created_at DESC);

    -- Enable RLS
    ALTER TABLE public.project_comments ENABLE ROW LEVEL SECURITY;

    -- Policy: Clients can view comments on their projects
    CREATE POLICY "Clients can view comments on their projects"
      ON public.project_comments FOR SELECT
      USING (true); -- Will be filtered by Netlify Functions

    -- Policy: Clients can insert their own comments
    CREATE POLICY "Clients can insert comments"
      ON public.project_comments FOR INSERT
      WITH CHECK (true); -- Will be validated by Netlify Functions

    -- Policy: Admins can view all comments
    CREATE POLICY "Admins can view all comments"
      ON public.project_comments FOR SELECT
      USING (true);

    -- Policy: Admins can insert comments
    CREATE POLICY "Admins can insert comments"
      ON public.project_comments FOR INSERT
      WITH CHECK (true);

    -- Policy: Admins can delete comments
    CREATE POLICY "Admins can delete comments"
      ON public.project_comments FOR DELETE
      USING (true);
  END IF;
END $$;

