# Quick Start Guide - Roles Setup

## 🎯 What's Been Added

Your Hub now has **two roles**:

1. **Admin** - Can view all clients and manage the system
2. **Client** - Can only view their own data

## 🚀 To Set Up Roles (5 Minutes)

### Step 1: Make Yourself an Admin

Since you're already logged in as `michaelnakhla00@gmail.com`, you have two options:

#### Option A: Netlify UI (Easy)
1. Go to your Netlify dashboard → **Identity** → **Users**
2. Find your user (`michaelnakhla00@gmail.com`)
3. Click to open user details
4. Add metadata (if you see an editor):
   ```json
   {
     "roles": ["admin"]
   }
   ```

#### Option B: Netlify CLI (Recommended)
```bash
# Login to Netlify
netlify login

# List users to find your user ID
netlify identity:list-users

# Update your metadata to make you admin
netlify identity:update-user YOUR_USER_ID --app-metadata '{"roles":["admin"]}'
```

### Step 2: Wait for Redeploy

After pushing the code, Netlify will redeploy. Wait 1-2 minutes.

### Step 3: Test It

1. **Log out** from the Hub
2. **Log in** again
3. You should be **automatically redirected to `/admin.html`** (the admin dashboard)
4. You'll see:
   - All clients list
   - Combined statistics
   - Admin badge in header
   - Search functionality

### Step 4: Invite a Client

1. Go to Netlify dashboard → **Identity** → **Users** → **Invite users**
2. Enter a client email (must match an email in `data/clients.json`)
3. They receive an invite email
4. When they log in, they go to `/portal.html` with their own data

## 📁 New Files Created

- `admin.html` - Admin dashboard
- `assets/js/admin.js` - Admin functionality
- `netlify/functions/get-all-clients.js` - Function to get all clients (admin only)
- `ROLES_SETUP.md` - Detailed setup guide
- This `QUICK_START.md` - Quick reference

## 🔍 How It Works

### Role Detection
The system checks `user.app_metadata.roles` to determine if a user is an admin.

### Automatic Redirects
- **Admin users** → `/admin.html`
- **Client users** → `/portal.html`
- **Not logged in** → `/index.html`

### Access Control
- Admin function (`get-all-clients`) checks for admin role
- Client function (`get-client`) filters by email
- Client users cannot access admin pages

## 🐛 Troubleshooting

**"I'm still going to portal.html instead of admin.html"**
- Clear browser cache (Ctrl+Shift+R)
- Make sure you added the role metadata correctly
- Check browser console for errors

**"Client data not showing"**
- Verify email in `clients.json` matches exactly
- Check that they accepted the invite

## 📚 More Info

- **Full setup guide**: See `ROLES_SETUP.md`
- **Troubleshooting**: See `TROUBLESHOOTING.md`
- **Deployment**: See `DEPLOYMENT.md`

## ✅ What's Next?

1. Add the admin role to your user
2. Add more clients to `data/clients.json`
3. Customize the admin dashboard as needed
4. Test with multiple users

Your Hub is now ready for multi-role access! 🎉

