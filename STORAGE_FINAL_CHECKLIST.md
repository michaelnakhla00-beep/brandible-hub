# Supabase Storage - Final Setup Checklist

## ✅ Steps to Complete

### 1. Make Bucket Public (Required)

1. Go to **Supabase Dashboard**
2. Navigate to **Storage**
3. Click on the **`client_files`** bucket
4. Click **Settings** (gear icon)
5. Find **"Public bucket"** toggle
6. Turn it **ON**
7. Click **Save**

This is required because:
- Allows authenticated users to download files
- Works with RLS policies for secure access
- Files are still protected by folder structure

### 2. Verify Bucket Name

Confirm the bucket is exactly named `client_files` (lowercase, underscore):
- ❌ `clientfiles` - wrong
- ❌ `client_files_bucket` - wrong
- ✅ `client_files` - correct

### 3. Verify RLS Policies Applied

Go to **Storage** → `client_files` → **Policies** → You should see:
- ✅ authenticated_upload
- ✅ authenticated_read
- ✅ authenticated_delete

### 4. Test File Upload

1. Open your deployed site
2. Log in as a client
3. Go to the **Files** section (right sidebar)
4. Click **Upload**
5. Select a test file (PDF, JPG, or PNG)
6. Watch for:
   - Progress bar animation
   - Toast notification: "File uploaded successfully"
   - File appears in the list

### 5. Verify in Supabase

1. Go to **Storage** → `client_files`
2. You should see a folder named after the user's sanitized email
   - Example: `client_example_com`
3. Inside that folder, you should see the uploaded file

## Expected Folder Structure

```
client_files/
└── user_email_sanitized/
    └── 1698567890-filename.pdf
```

## Troubleshooting

### Still getting "new row violates row-level security policy"?

**Check these:**

1. **Bucket name is exactly `client_files`**
   - Verify in portal.js: all `.from('client_files')` calls

2. **Policies were created successfully**
   - Go to Storage → client_files → Policies
   - Should see 3 policies listed

3. **Bucket is public**
   - Go to Settings → Public bucket is ON

4. **User is authenticated**
   - Check browser console for auth errors
   - Verify Netlify Identity token is being passed

### Still Not Working?

Share the exact error message from:
1. Browser console (F12 → Console)
2. Network tab when uploading
3. Supabase Storage logs

## Success Indicators

✅ Upload progress bar shows
✅ "File uploaded successfully" toast appears
✅ File shows in list with name, date, size
✅ File is visible in Supabase dashboard
✅ Download button works
✅ Delete button works

Your upload should work now! 🎉

