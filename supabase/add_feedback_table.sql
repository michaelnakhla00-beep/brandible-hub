-- Create feedback table for project ratings and comments
-- Run this in Supabase SQL Editor

DO $$
BEGIN
  IF NOT EXISTS (
    SELECT 1 FROM information_schema.tables
    WHERE table_schema = 'public' AND table_name = 'feedback'
  ) THEN
    CREATE TABLE public.feedback (
      id uuid PRIMARY KEY DEFAULT gen_random_uuid(),
      user_id uuid NOT NULL, -- References client/user
      project_id uuid NOT NULL REFERENCES public.projects(id) ON DELETE CASCADE,
      rating int NOT NULL CHECK (rating >= 1 AND rating <= 5),
      comment text,
      created_at timestamptz DEFAULT now(),
      UNIQUE(user_id, project_id) -- One feedback per project per user
    );

    -- Create indexes
    CREATE INDEX IF NOT EXISTS idx_feedback_project_id ON public.feedback(project_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_user_id ON public.feedback(user_id);
    CREATE INDEX IF NOT EXISTS idx_feedback_rating ON public.feedback(rating);

    -- Enable RLS
    ALTER TABLE public.feedback ENABLE ROW LEVEL SECURITY;

    -- Policy: Users can view their own feedback
    CREATE POLICY "Users can view their own feedback"
      ON public.feedback FOR SELECT
      USING (true); -- Will be filtered by Netlify Functions

    -- Policy: Users can insert their own feedback
    CREATE POLICY "Users can insert feedback"
      ON public.feedback FOR INSERT
      WITH CHECK (true); -- Will be validated by Netlify Functions

    -- Policy: Admins can view all feedback
    CREATE POLICY "Admins can view all feedback"
      ON public.feedback FOR SELECT
      USING (true);

    -- Policy: Users can update their own feedback
    CREATE POLICY "Users can update their own feedback"
      ON public.feedback FOR UPDATE
      USING (true);
  END IF;
END $$;

