# Auto-Invitation Setup for Netlify Identity

When you create a new client via the admin panel, the system automatically sends a Netlify Identity invitation to their email address.

## How It Works

1. Admin creates a new client in the admin panel
2. Client record is saved to Supabase
3. Netlify Identity invitation is automatically sent to the client's email
4. Client is automatically assigned the **'client' role** via `app_metadata`
5. Client receives email with invitation link
6. Client can set their password and log in
7. Client will access portal.html (role-based routing)

## Prerequisites

### 1. Enable Netlify Identity Invites

1. Go to your Netlify dashboard
2. Navigate to **Identity** → **Settings**
3. Make sure **Enable Identity** is ON
4. Under **Registration**, set to **Invite only**
5. Save changes

### 2. Configure Email Templates (Optional)

1. Go to **Identity** → **Email templates**
2. Customize the invitation email template
3. Or leave default template

### 3. Get Your Admin Token

To enable automatic invitations, you need to set up an admin token:

1. Go to **Site settings** → **Environment variables**
2. Go to **Identity** → **Actions** → **Generate new access token**
3. Or use Netlify CLI:
   ```bash
   netlify status
   # Copy your Identity Admin Token
   ```
4. In Netlify dashboard, go to **Site settings** → **Environment variables**
5. Add new variable:
   - **Key**: `NETLIFY_IDENTITY_ADMIN_TOKEN`
   - **Value**: Your admin token from Identity settings

### 4. Set Up Email Provider

For production, configure SMTP:

1. Go to **Identity** → **Settings** → **Email**
2. Choose an email provider or use Netlify's default
3. Configure SMTP settings if using custom provider

## What Happens When You Create a Client

### Success Case:
1. ✅ Client record created in Supabase
2. ✅ Invitation email sent to client
3. ✅ Client appears in admin dashboard
4. ✅ Admin sees: "Client created and invitation email sent!"

### If Invitation Fails:
1. ✅ Client record still created in Supabase
2. ⚠️ Invitation not sent
3. ✅ Admin sees: "Client created successfully! (Note: Invitation could not be sent)"
4. Admin can manually invite via Netlify dashboard

## Manual Invitation (Backup)

If automatic invitation fails, invite manually:

1. Go to Netlify Dashboard → **Identity** → **Users**
2. Click **Invite users**
3. Enter client's email address
4. Click **Send invite**

## Troubleshooting

### "Invitation not sent" error

**Possible causes:**
1. **Netlify Identity not configured** - Enable it in dashboard
2. **Registration method** - Should be "Invite only" or "Open"
3. **Email provider** - Check SMTP settings
4. **Site URL not detected** - Function couldn't determine site URL

**Solutions:**
1. Check Netlify Identity is enabled
2. Verify invite endpoint is accessible
3. Check Netlify function logs for detailed errors
4. Manually invite the user as backup

### Check Function Logs

1. Go to Netlify Dashboard → **Functions**
2. Click on `create-client`
3. View function logs for any errors
4. Look for "Invitation sent to..." or error messages

## Testing

1. **Create a test client** in admin panel
2. **Check email inbox** for invitation
3. **Click invitation link** in email
4. **Set password** and log in
5. **Verify** client can access their portal

## Security Notes

- Only admins can create clients (enforced by function)
- Email must be unique (enforced by Supabase and Netlify)
- Client receives invitation with secure token
- Client must set password before first login
- All authentication handled by Netlify Identity
- **All invited users are automatically assigned the 'client' role**
- Role is stored in `app_metadata: { "roles": ["client"] }`
- Clients are automatically redirected to `/portal.html` on login
- Admin users must be manually assigned `roles: ['admin']` via Netlify dashboard

## Advanced: Custom Invitation Templates

To customize the invitation email:

1. Go to **Identity** → **Email templates**
2. Select **Invite user** template
3. Customize the email subject and body
4. Use variables like `{{ .SiteURL }}` and `{{ .Site }}`
5. Save and deploy

## Next Steps

After creating clients:
- [ ] Verify invitations are being sent
- [ ] Test invitation email links
- [ ] Ensure clients can set passwords
- [ ] Monitor for failed invitations
- [ ] Set up custom email templates if desired

