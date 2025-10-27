# Supabase Storage Setup for File Uploads

## Overview

The Brandible Hub now supports file uploads for clients using Supabase Storage. Each client has their own private folder in the `client_files` bucket.

## Setup Instructions

### 1. Create Storage Bucket

1. Go to your Supabase dashboard
2. Navigate to **Storage** in the left sidebar
3. Click **"New bucket"**
4. Configure the bucket:
   - **Name**: `client_files`
   - **Public**: `false` (private bucket)
   - **File size limit**: 50 MB (or your preference)
   - **Allowed MIME types**: `application/pdf`, `image/jpeg`, `image/png`, `application/vnd.openxmlformats-officedocument.wordprocessingml.document`

### 2. Set Up Storage Policies

Create policies to ensure clients can only access their own files:

#### Policy 1: Allow clients to list their own files

```sql
-- Allow authenticated users to list files in their own folder
CREATE POLICY "Users can list their own files" 
ON storage.objects FOR SELECT 
TO authenticated
USING (bucket_id = 'client_files' AND (storage.foldername(name))[1] = auth.email());
```

#### Policy 2: Allow clients to upload to their own folder

```sql
-- Allow authenticated users to upload to their own folder
CREATE POLICY "Users can upload to own folder" 
ON storage.objects FOR INSERT 
TO authenticated
WITH CHECK (
  bucket_id = 'client_files' AND 
  (storage.foldername(name))[1] = auth.email()
);
```

#### Policy 3: Allow clients to delete their own files

```sql
-- Allow authenticated users to delete their own files
CREATE POLICY "Users can delete own files" 
ON storage.objects FOR DELETE 
TO authenticated
USING (
  bucket_id = 'client_files' AND 
  (storage.foldername(name))[1] = auth.email()
);
```

#### Policy 4: Allow clients to download their own files

```sql
-- Allow authenticated users to download their own files
CREATE POLICY "Users can download own files" 
ON storage.objects FOR SELECT 
TO authenticated
USING (
  bucket_id = 'client_files' AND 
  (storage.foldername(name))[1] = auth.email()
);
```

### 3. Admin Access (Optional)

If you want admins to access all files:

```sql
-- Allow admins to access all files
CREATE POLICY "Admins can access all files" 
ON storage.objects FOR ALL 
TO authenticated
USING (
  bucket_id = 'client_files' AND 
  auth.jwt() ->> 'app_metadata' ->> 'roles' ? 'admin'
);
```

### 4. Environment Variables

Ensure these are set in Netlify:

1. Go to **Site settings** → **Environment variables**
2. Verify these variables exist:
   - `SUPABASE_URL` - Your Supabase project URL
   - `SUPABASE_ANON_KEY` - Your Supabase anonymous key

## Folder Structure

Files are stored under each user's email address:

```
client_files/
├── user1@example.com/
│   ├── 1234567890-file1.pdf
│   └── 1234567891-file2.png
├── user2@example.com/
│   └── 1234567892-file3.docx
└── ...
```

## File Upload UI

### Features
- ✨ Modern upload button with gradient styling
- 📊 Real-time progress bar
- 📁 File list with download and delete actions
- 🌓 Dark mode compatible
- 📱 Fully responsive
- 🎨 Glassmorphic design

### Supported File Types
- PDF (`.pdf`)
- Images: JPG, JPEG, PNG (`.jpg`, `.jpeg`, `.png`)
- Documents: DOCX, DOC (`.docx`, `.doc`)

### Upload Size Limit
Default: 50 MB (configurable in Supabase)

## How It Works

### 1. Client Uploads File
```
Client clicks "Upload" button
    ↓
Select file(s) from device
    ↓
File uploads to Supabase Storage
    ↓
Progress bar shows upload status
    ↓
Toast notification: "File uploaded successfully"
    ↓
File list refreshes automatically
```

### 2. File Structure
```javascript
// Each file is stored as:
`${userEmail}/${timestamp}-${filename}`

// Example:
"client@example.com/1698567890123-document.pdf"
```

### 3. Security
- ✅ Clients can only see files in their own folder
- ✅ Clients can only upload to their own folder
- ✅ Clients can only delete their own files
- ✅ Folder name matches authenticated user's email
- ✅ Enforced by Supabase Row Level Security (RLS)

## Usage

### Client Portal
1. Log in as a client
2. Navigate to the "Files" section (right sidebar)
3. Click "Upload"
4. Select file(s)
5. Wait for upload to complete
6. View, download, or delete files

### Admin View
1. Log in as admin
2. Can view all files (if admin policy is enabled)
3. Files are organized by client email

## Troubleshooting

### "Supabase Storage not configured"
- Check that `SUPABASE_URL` and `SUPABASE_ANON_KEY` are set in Netlify
- Verify the bucket `client_files` exists in Supabase
- Check that policies are configured correctly

### "Upload failed"
- Check file size (must be under bucket limit)
- Verify file type is allowed (PDF, JPG, PNG, DOCX, DOC)
- Check browser console for detailed error
- Ensure user is authenticated

### "Access denied"
- Verify RLS policies are set up
- Check that the folder name matches the user's email
- Ensure the user is authenticated with Netlify Identity

### Files not showing
- Check browser console for errors
- Verify Supabase Storage is initialized
- Ensure files were uploaded to the correct folder
- Check bucket name matches `client_files`

## Testing

### Test Upload
1. Log in as a test client
2. Navigate to Files section
3. Upload a test PDF file
4. Verify file appears in the list
5. Try downloading the file
6. Try deleting the file

### Test Security
1. Log in as Client A
2. Upload a file
3. Log out
4. Log in as Client B
5. Verify Client B cannot see Client A's files

## Next Steps

### Optional Enhancements
- [ ] Add file size display
- [ ] Add file type icons
- [ ] Add search/filter for files
- [ ] Add bulk upload
- [ ] Add drag-and-drop upload
- [ ] Add admin file management UI
- [ ] Link files to "Files Shared" KPI in admin dashboard

## API Reference

### Functions
- `fetchSupabaseFiles(userEmail)` - Fetch files for a user
- `uploadFileToSupabase(file, userEmail)` - Upload a file
- `deleteFileFromSupabase(filePath, userEmail)` - Delete a file
- `getFileUrl(filePath, userEmail)` - Get download URL for a file

### Netlify Functions
- `get-storage-config.js` - Returns Supabase credentials securely

## Security Notes

⚠️ **Important**:
- The Supabase Storage bucket should be **private**
- RLS policies enforce folder-level access control
- Each client can only access their own email folder
- File paths include the client's email for security
- Upload sizes should be limited to prevent abuse

✅ **Best Practices**:
- Use consistent file naming (timestamp-filename)
- Implement file size limits
- Validate file types on both client and server
- Log storage usage for monitoring
- Consider automatic cleanup of old files

