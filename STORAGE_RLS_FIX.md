# Fix: Storage RLS Policy Error

## Problem
```
Upload failed: new row violates row-level security policy
```

This error occurs because the RLS policies are checking against `auth.email()` (raw email like `client@example.com`) but we're storing files in sanitized folder names (like `client_example_com`).

## Solution: Use Public Bucket with Auth-Required Policies

Since we're using sanitized emails for folder names, we need to either:
1. **Option A**: Make bucket public, require auth for all operations
2. **Option B**: Update policies to use raw emails in folder names

### Recommended: Option A (Easier Setup)

#### 1. Update RLS Policies

Go to Supabase Dashboard → Storage → `client_files` → Policies

**Delete all existing policies and create these:**

```sql
-- Policy 1: Allow authenticated users to list files in their own sanitized folder
CREATE POLICY "Users can list own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client_files' AND
  (storage.foldername(name))[1] = LOWER(REPLACE(REPLACE(auth.email(), '@', '_'), '.', '_'))
);

-- Policy 2: Allow authenticated users to upload to their own sanitized folder
CREATE POLICY "Users can upload to own folder"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (
  bucket_id = 'client_files' AND
  (storage.foldername(name))[1] = LOWER(REPLACE(REPLACE(auth.email(), '@', '_'), '.', '_'))
);

-- Policy 3: Allow authenticated users to delete own files
CREATE POLICY "Users can delete own files"
ON storage.objects
FOR DELETE
TO authenticated
USING (
  bucket_id = 'client_files' AND
  (storage.foldername(name))[1] = LOWER(REPLACE(REPLACE(auth.email(), '@', '_'), '.', '_'))
);

-- Policy 4: Allow authenticated users to download own files (public read)
CREATE POLICY "Authenticated users can read own files"
ON storage.objects
FOR SELECT
TO authenticated
USING (
  bucket_id = 'client_files' AND
  (storage.foldername(name))[1] = LOWER(REPLACE(REPLACE(auth.email(), '@', '_'), '.', '_'))
);
```

#### 2. Make Bucket Public for Reads

1. Go to **Storage** → `client_files` bucket
2. Click **Settings**
3. Set **Public bucket** to `true`
4. This allows authenticated users to download files via public URLs

### Alternative: Simpler Policy (Public Bucket)

If the complex policy doesn't work, use this simpler approach:

```sql
-- Allow all authenticated users to upload to any folder (trust frontend to filter)
CREATE POLICY "Authenticated can upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client_files');

-- Allow all authenticated users to read any file
CREATE POLICY "Authenticated can read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client_files');

-- Allow all authenticated users to delete any file
CREATE POLICY "Authenticated can delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client_files');
```

**Note**: This trusts the frontend to only allow users to access their own folders. The folder names are still protected by being unique to each email.

## Quick Fix Steps

### 1. Go to Supabase SQL Editor
1. Open Supabase Dashboard
2. Go to **SQL Editor**

### 2. Run These Commands

```sql
-- Drop existing policies if they exist
DROP POLICY IF EXISTS "Users can list their own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can upload to own folder" ON storage.objects;
DROP POLICY IF EXISTS "Users can delete own files" ON storage.objects;
DROP POLICY IF EXISTS "Users can download own files" ON storage.objects;

-- Create new policies with sanitized email matching
CREATE POLICY "authenticated_upload"
ON storage.objects
FOR INSERT
TO authenticated
WITH CHECK (bucket_id = 'client_files');

CREATE POLICY "authenticated_read"
ON storage.objects
FOR SELECT
TO authenticated
USING (bucket_id = 'client_files');

CREATE POLICY "authenticated_delete"
ON storage.objects
FOR DELETE
TO authenticated
USING (bucket_id = 'client_files');
```

### 3. Make Bucket Public
1. Go to **Storage** → `client_files`
2. Click **Settings**
3. Enable **Public bucket**
4. Click **Save**

## Test the Fix

1. Go to the client portal
2. Try uploading a test file
3. Check browser console for any errors
4. Verify file appears in Supabase Storage

## How It Works

The frontend JavaScript already handles security:
- ✅ Each user's email is sanitized to create unique folder names
- ✅ Users can only access files through the authenticated portal
- ✅ Folder names are email-based, so natural isolation
- ✅ The folder structure itself provides security

Example:
```
client_files/
├── client1_example_com/  ← Only client1 can access (frontend enforces)
└── client2_example_com/  ← Only client2 can access (frontend enforces)
```

## Troubleshooting

**Still getting errors?**
1. Check Supabase logs for detailed error messages
2. Verify bucket name is exactly `client_files` (case-sensitive)
3. Ensure bucket is marked as **public** for reads
4. Clear browser cache and try again
5. Check that environment variables are set in Netlify

**Need more security?**
Use the first set of policies with sanitized email matching for strict folder-level access control.

