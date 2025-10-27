-- Updated Supabase Storage RLS Policies
-- Run this in Supabase SQL Editor

-- Drop existing policies
DROP POLICY IF EXISTS "authenticated_upload" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_read" ON storage.objects;
DROP POLICY IF EXISTS "authenticated_delete" ON storage.objects;

-- Enable RLS on the storage.objects table (if not already enabled)
ALTER TABLE storage.objects ENABLE ROW LEVEL SECURITY;

-- Policy 1: Allow uploads to public bucket (any authenticated user)
CREATE POLICY "enable_upload_for_authenticated_users"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client_files');

-- Policy 2: Allow reading from public bucket (any authenticated user)
CREATE POLICY "enable_select_for_authenticated_users"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client_files');

-- Policy 3: Allow delete from public bucket (any authenticated user)
CREATE POLICY "enable_delete_for_authenticated_users"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client_files');

-- Policy 4: Allow updates (if needed)
CREATE POLICY "enable_update_for_authenticated_users"
ON storage.objects
FOR UPDATE
TO authenticated
USING (bucket_id = 'client_files')
WITH CHECK (bucket_id = 'client_files');

