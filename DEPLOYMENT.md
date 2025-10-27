# Brandible Hub - Deployment Checklist

Follow these steps to deploy and configure your Hub.

## Pre-Deployment

- [ ] Ensure all files are committed to your Git repository
- [ ] Verify `data/clients.json` contains your client data
- [ ] Check that `netlify.toml` is configured correctly

## Netlify Deployment

### Step 1: Initial Deployment

1. **Connect Repository to Netlify**
   - Go to [Netlify](https://app.netlify.com)
   - Click "Add new site" → "Import an existing project"
   - Select your Git provider and repository
   - Netlify will auto-detect settings from `netlify.toml`

2. **Deploy Settings**
   - Build command: (leave blank - no build step)
   - Publish directory: `.` (root)
   - Click "Deploy site"

### Step 2: Enable Netlify Identity

1. **Activate Identity**
   - In your site dashboard, go to **Identity** → **Settings**
   - Click "Enable identity"
   - Select your registration method:
     * **Invite only** (recommended) - You control who can sign up
     * **Open sign ups** - Anyone can register

2. **Configure Email**
   - For production, set up SMTP:
     - Go to **Identity** → **Settings** → **Email**
     - Choose an email provider or use Netlify's default
     - Configure SMTP settings for custom domain emails

3. **Configure Email Templates** (Optional)
   - Go to **Identity** → **Settings** → **Email templates**
   - Customize invitation, confirmation, and other emails

### Step 3: Add Users

1. **Invite Your First Client**
   - Go to **Identity** → **Users** → **Invite users**
   - Enter the client's email address
   - The email must match exactly the `email` field in `data/clients.json`
   - Click "Send invite"

2. **Client Self-Registration** (if using open sign-ups)
   - Share your Hub URL
   - Clients can sign up themselves
   - Their email must exist in `clients.json` to see their data

### Step 4: Verify Function Deploys

1. **Check Functions**
   - Go to **Functions** in your site dashboard
   - You should see `get-client` listed
   - Click on it to view logs and details

2. **Test Function** (Optional)
   - Use the "Invoke" button to test the function
   - Check the logs for any errors

### Step 5: Configure Custom Domain (Optional)

1. **Add Domain**
   - Go to **Domain settings**
   - Add your custom domain (e.g., hub.yourdomain.com)
   - Follow DNS configuration instructions

2. **Update HTTPS**
   - Netlify automatically provisions SSL certificates
   - Configure subdomain redirects if needed

## Post-Deployment Testing

- [ ] Visit your Hub URL
- [ ] Click "Sign in" and complete authentication
- [ ] Verify you see the dashboard with client data
- [ ] Test dark mode toggle
- [ ] Test global search functionality
- [ ] Test project filters (Active/All)
- [ ] Test support form submission
- [ ] Verify all links work (files, projects, etc.)

## Adding New Clients

### Via Code

1. Edit `data/clients.json`
2. Add a new entry to the `clients` array with:
   - Unique `id`
   - Client `name`
   - Client `email`
   - Complete data structure (kpis, projects, files, invoices, activity, updates)
3. Commit and push changes
4. Netlify will auto-deploy

### Via Netlify Admin

1. Edit the file in Netlify's dashboard
2. Go to **Deploys** → **Trigger deploy** → **Deploy site**
3. Or use Netlify's built-in file editor

## Troubleshooting

### Function Returns 404

**Problem**: Function can't find `clients.json`

**Solution**: 
1. Verify `netlify.toml` has `included_files = ["data/clients.json"]`
2. Check that `data/clients.json` exists in your repository
3. Redeploy the site

### Authentication Not Working

**Problem**: Users can't log in

**Solution**:
1. Ensure Identity is enabled in Netlify dashboard
2. Check that users have been invited
3. Verify user email matches `clients.json` exactly
4. Check browser console for JavaScript errors

### No Data Displaying

**Problem**: Dashboard loads but shows no data

**Solution**:
1. Verify the user's email in `clients.json`
2. Check browser network tab for function responses
3. Review function logs in Netlify dashboard
4. Ensure the function deployed successfully

### File Path Issues

**Problem**: "Error: Could not find clients.json file"

**Solution**:
1. The updated `get-client.js` now tries multiple paths
2. Check function logs in Netlify dashboard
3. Verify the data file is included in deployment
4. Try redeploying

## Environment Variables (Optional)

If you need to store sensitive data or configuration:

1. Go to **Site settings** → **Environment variables**
2. Add variables like:
   - `ADMIN_EMAIL` - For admin notifications
   - `SUPPORT_EMAIL` - For support form submissions
3. Access in functions via `process.env.VARIABLE_NAME`

## Monitoring

- **Netlify Analytics**: Enable in site settings to track usage
- **Function Logs**: View real-time logs under Functions
- **Forms**: Support requests go to **Forms** section

## Next Steps

- [ ] Customize email templates
- [ ] Add more clients to `clients.json`
- [ ] Configure custom domain
- [ ] Set up analytics
- [ ] Add more serverless functions if needed
- [ ] Configure webhooks for integrations

## Support

For issues or questions:
- Check Netlify documentation: https://docs.netlify.com
- Review function logs in the dashboard
- Contact your Netlify support plan representative

