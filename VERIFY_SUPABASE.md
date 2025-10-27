# Verify Supabase Integration

Since your Supabase environment variables are now set in Netlify, here's how to verify everything is working:

## ✅ What's Already Configured

All three Netlify functions are now using Supabase:

1. **get-client.js** - Queries Supabase for individual client data
2. **get-all-clients.js** - Fetches all clients for admin dashboard
3. **update-client.js** - Updates client data in Supabase

## 🔍 Quick Verification Steps

### 1. Check Environment Variables in Netlify

1. Go to Netlify Dashboard → Your Site → Site Settings → Environment Variables
2. Verify these are set:
   - `SUPABASE_URL`
   - `SUPABASE_ANON_KEY`

### 2. Check Netlify Function Logs

1. Go to Netlify Dashboard → Your Site → Functions
2. Click on each function to see logs
3. Invoke a function and check for any errors

### 3. Test the Functions

#### Test get-client.js:
```bash
# Get a JWT token from browser console
window.netlifyIdentity.currentUser().then(user => user.jwt())

# Then test the function
curl -X GET "https://your-site.netlify.app/.netlify/functions/get-client" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

#### Test get-all-clients.js:
```bash
# Admin only - test from admin dashboard
curl -X GET "https://your-site.netlify.app/.netlify/functions/get-all-clients" \
  -H "Authorization: Bearer YOUR_JWT_TOKEN"
```

### 4. Check Supabase Database

1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → `clients` table
3. You should see your client data
4. Add a test client if needed

## 🧪 Testing in the Browser

### Test Client Access:

1. **Log in as a client** (not admin)
2. **Go to portal.html**
3. **Check browser console** (F12) for errors
4. **Verify data loads** from Supabase

### Test Admin Access:

1. **Log in as admin**
2. **Go to admin.html**
3. **View clients list** - should load from Supabase
4. **Click "View" on a client** - opens modal
5. **Click "Edit"** - enables edit mode
6. **Update KPIs** or add activity
7. **Click "Save Changes"**
8. **Verify in Supabase** - data should be updated in database

## 🐛 Troubleshooting

### Issue: "Database not configured"

**Symptoms**: Error message in function logs

**Solution**:
1. Double-check `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify
2. Make sure values don't have extra spaces
3. Redeploy site after setting variables

### Issue: "Client not found"

**Symptoms**: 404 error when accessing client data

**Solutions**:
1. Verify client exists in Supabase `clients` table
2. Check email matches exactly (case-sensitive)
3. Run migration script if needed:
   ```bash
   node scripts/migrate-to-supabase.js
   ```

### Issue: "Admin access required" when trying to edit

**Symptoms**: 403 error when non-admin tries to edit

**Solution**:
1. Verify you're logged in as admin
2. Check Netlify Identity metadata has `roles: ["admin"]`
3. Set admin role in Netlify Identity dashboard

### Issue: Function timeout

**Symptoms**: Functions take too long or timeout

**Solutions**:
1. Check Supabase project is in same region as Netlify
2. Ensure there are no slow queries
3. Upgrade Netlify plan for longer timeouts

## 📊 Verify Data Flow

### Expected Data Flow:

1. **Client logs in** → Netlify Identity authenticates
2. **Portal loads** → Calls `get-client.js`
3. **Function queries Supabase** → SELECT * FROM clients WHERE email = ?
4. **Data returned** → Renders in portal

### For Admins:

1. **Admin logs in** → Netlify Identity authenticates
2. **Admin dashboard loads** → Calls `get-all-clients.js`
3. **Function queries Supabase** → SELECT * FROM clients
4. **All clients displayed** → Renders in admin table
5. **Edit changes** → Calls `update-client.js`
6. **Function updates Supabase** → UPDATE clients SET ...
7. **Changes persist** → Data saved in database

## ✅ Success Criteria

You know it's working when:

- [ ] Clients can log in and see their data
- [ ] Admin can see all clients in dashboard
- [ ] Admin can edit client KPIs and save
- [ ] Changes persist in Supabase
- [ ] No "Database not configured" errors in logs
- [ ] No "Client not found" errors for existing clients

## 🚀 Next Steps After Verification

1. Add more clients to Supabase
2. Test edit functionality thoroughly
3. Monitor Supabase dashboard for usage
4. Set up backups (auto on Supabase paid plans)

## 📞 Still Having Issues?

Check:
1. Netlify function logs for specific errors
2. Browser console for JavaScript errors
3. Supabase logs in dashboard
4. Network tab to see API responses

