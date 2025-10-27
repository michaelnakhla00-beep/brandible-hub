# Setting Up Auto-Invitations with Admin Token

## Why You Need This

When you create a new client in the admin dashboard, the system can automatically send them a Netlify Identity invitation email. This requires an admin token for authentication.

## How to Get Your Admin Token

### Method 1: Netlify CLI (Recommended)

1. **Install Netlify CLI** (if not already installed):
   ```bash
   npm install -g netlify-cli
   ```

2. **Login**:
   ```bash
   netlify login
   ```

3. **Link your site** (if not already linked):
   ```bash
   cd /path/to/your/HUB
   netlify link
   ```

4. **Get the token**:
   ```bash
   netlify status
   ```
   
   Look for the **Identity Admin Token** in the output. It will look like:
   ```
   Identity Admin Token: abc123xyz456...
   ```

### Method 2: Netlify Dashboard

1. Go to your Netlify dashboard
2. Navigate to your site
3. Go to **Site settings** → **Identity**
4. Scroll to **Administrative Tokens**
5. Click **Generate new access token**
6. Copy the token (you'll only see it once!)

## Setting the Environment Variable

### In Netlify Dashboard:

1. Go to **Site settings** → **Environment variables**
2. Click **Add environment variable**
3. Add:
   - **Key**: `NETLIFY_IDENTITY_ADMIN_TOKEN`
   - **Value**: Your admin token (the long string you copied)
4. Click **Save**

### Important Notes:

- 🔒 Keep this token secure - it has admin access to Identity
- 🔑 Never commit this token to your repository
- 🚫 Token is only shown once when generated
- ✅ Same token works for all environments (production, branch deploys)

## Testing the Auto-Invite Feature

### 1. Create a Test Client

1. Go to admin dashboard
2. Click **"+ New Client"**
3. Fill in the form:
   - Name: Test User
   - Email: your-email@example.com
   - Default KPIs: 0
4. Click **"Create Client"**

### 2. What Should Happen

**If token is set correctly:**
- ✅ Client appears in Supabase
- ✅ Client appears in admin dashboard table
- ✅ Toast shows: "Client created and invitation email sent!"
- ✅ Client receives email with invite link

**If token is not set:**
- ✅ Client appears in Supabase
- ✅ Toast shows: "Client created! (Add NETLIFY_IDENTITY_ADMIN_TOKEN to enable auto-invites)"

### 3. Check the Email

- Client should receive invitation email
- Email has subject: "You've been invited to [Site Name]"
- Email contains link to accept invitation
- Client can set password and log in

## Troubleshooting

### Error: "Admin token not configured"

**Solution**: 
1. Go to Netlify → Site Settings → Environment Variables
2. Add `NETLIFY_IDENTITY_ADMIN_TOKEN` with your admin token value
3. Redeploy the site

### Error: "Invite failed (401): Unauthorized"

**Solution**:
1. Verify the admin token is correct (no extra spaces)
2. Check that Identity is enabled
3. Try generating a new token

### Error: "Invite failed (404): Not Found"

**Solution**:
1. Check your site URL is correct
2. Ensure `.netlify/identity` is accessible
3. Verify the endpoint exists for your site

### Invitation Sent But Client Not Receiving Email

**Solution**:
1. Check spam/junk folder
2. Verify email provider configuration in Netlify
3. Check Netlify function logs for email delivery errors
4. Ensure SMTP is configured for production

## Verification Steps

### Check Function Logs:

1. Go to Netlify Dashboard → **Functions**
2. Click on `create-client`
3. View recent invocations
4. Look for log messages like:
   - `✓ Invitation sent successfully to user@example.com`
   - `❌ Failed to send invitation: ...`

### Check Supabase:

1. Go to Supabase Dashboard
2. Navigate to **Table Editor** → `clients`
3. Verify the new client was created
4. Check `created_at` timestamp

### Check Netlify Identity:

1. Go to Netlify Dashboard → **Identity** → **Users**
2. Look for the new user
3. Status should be "Invited" or "Confirmed"

## How It Works

### Flow Diagram:

```
Admin creates client
    ↓
Client saved to Supabase ✅
    ↓
Function checks for admin token
    ↓
If token exists:
  → Calls Identity Admin API
  → Sends invitation email
  → Returns success
    ↓
Toast notification shown
    ↓
Client appears in table
```

### API Endpoint Used:

```
POST https://your-site.netlify.app/.netlify/identity/admin/users/invite
Authorization: Bearer {NETLIFY_IDENTITY_ADMIN_TOKEN}
Body: { "email": "client@example.com" }
```

### Response Handling:

- **Success**: `invitationSent = true`, client receives email
- **Failure**: Client still created, but toast shows manual invite needed
- **Not Configured**: Token not set, toast shows configuration message

## Security Notes

- ✅ Admin token is stored securely in Netlify environment variables
- ✅ Only admins can trigger invitations (enforced by function)
- ✅ Token never exposed to frontend
- ✅ Failed invitations don't block client creation

## Next Steps

After setting up auto-invites:

1. ✅ Test by creating a client
2. ✅ Verify email is received
3. ✅ Test client login flow
4. ✅ Customize email template if desired
5. ✅ Monitor for any failures in logs

## Support

- Netlify Identity docs: https://docs.netlify.com/visitor-access/identity/identity-api/
- Function logs: Netlify Dashboard → Functions → create-client
- Identity settings: Netlify Dashboard → Identity → Settings

