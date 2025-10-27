# Supabase Setup for Brandible Hub

This guide walks you through connecting Brandible Hub to Supabase for persistent data storage.

## Prerequisites

- A Supabase account ([sign up free](https://supabase.com))
- Netlify CLI installed (`npm install -g netlify-cli`)
- Node.js installed

## Step 1: Create Supabase Project

1. Go to [Supabase Dashboard](https://app.supabase.com)
2. Click **New Project**
3. Fill in:
   - **Name**: `brandible-hub`
   - **Database Password**: (choose a strong password)
   - **Region**: Choose closest to you
4. Click **Create new project**
5. Wait for project to be ready (~2 minutes)

## Step 2: Create Database Table

1. In your Supabase project, go to **SQL Editor**
2. Click **New query**
3. Copy and paste the contents of `supabase/schema.sql`
4. Click **Run** (or press Cmd/Ctrl + Enter)
5. You should see "Success. No rows returned"

## Step 3: Get Your API Keys

1. Go to **Project Settings** → **API**
2. Copy these values:
   - **Project URL** → This is your `SUPABASE_URL`
   - **anon public** key → This is your `SUPABASE_ANON_KEY`

## Step 4: Set Environment Variables in Netlify

1. Go to your Netlify dashboard
2. Select your Hub site
3. Go to **Site settings** → **Environment variables**
4. Add these variables:
   - **Key**: `SUPABASE_URL` | **Value**: Your Supabase URL
   - **Key**: `SUPABASE_ANON_KEY` | **Value**: Your anon key
5. Click **Save**

## Step 5: Install Dependencies

```bash
npm install
```

This installs `@supabase/supabase-js` and other dependencies.

## Step 6: Migrate Existing Data (Optional)

If you have existing client data in `data/clients.json`, migrate it to Supabase:

### Option A: Using the Migration Script

1. Install dotenv:
   ```bash
   npm install dotenv --save-dev
   ```

2. Create `.env` file in project root:
   ```bash
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   ```

3. Run migration script:
   ```bash
   node scripts/migrate-to-supabase.js
   ```

### Option B: Using Supabase Dashboard

1. Go to **Table Editor** in Supabase
2. Select `clients` table
3. Click **Insert** → **Insert row**
4. Manually enter each client's data
5. Click **Save**

### Option C: Using Supabase SQL Editor

```sql
-- Insert example client
INSERT INTO clients (email, name, kpis, projects, files, invoices, activity, updates)
VALUES (
  'michaelnakhla00@gmail.com',
  'Mike',
  '{"activeProjects": 2, "files": 3, "openInvoices": 1, "lastUpdate": "Oct 3, 2025"}'::jsonb,
  '[{"name": "Website Redesign", "status": "In Progress", "summary": "Migrating to Netlify"}]'::jsonb,
  '[{"name": "Brand Guide.pdf", "url": "https://example.com/guide.pdf", "updated": "Sep 26, 2025"}]'::jsonb,
  '[{"number": "INV-1", "date": "2025-09-25", "amount": 1800, "status": "Open"}]'::jsonb,
  '[{"type": "project", "text": "Updated sitemap", "when": "5 days ago"}]'::jsonb,
  '[{"title": "Launch approved", "body": "We''ll begin next week", "when": "2025-10-04"}]'::jsonb
);
```

## Step 7: Deploy to Netlify

1. Commit and push your changes:
   ```bash
   git add .
   git commit -m "Connect to Supabase database"
   git push
   ```

2. Netlify will automatically deploy

3. After deployment, test the functions:
   - Log in to your Hub
   - Check if client data loads correctly
   - Try editing a client (admin only)

## Step 8: Verify Connection

1. Go to your Netlify dashboard
2. Go to **Functions** → Select a function (e.g., `get-client`)
3. Check function logs for any errors
4. Go to Supabase → **Table Editor** → `clients`
5. You should see your clients listed

## Local Development

For local testing:

1. Create `.env` file in project root:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   ```

2. Create `netlify/functions/.env` file:
   ```
   SUPABASE_URL=your_supabase_url
   SUPABASE_ANON_KEY=your_anon_key
   ```

3. Run local dev server:
   ```bash
   netlify dev
   ```

4. Your local functions will now use Supabase

## Troubleshooting

### Error: "Database not configured"

**Solution**: Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` environment variables in Netlify

### Error: "Client not found"

**Solution**: 
1. Verify client exists in Supabase `clients` table
2. Check that email matches exactly (case-sensitive)
3. Run migration script to import data

### Error: "Authentication failed"

**Solution**:
1. Verify Netlify Identity is enabled
2. Check user has appropriate role (admin for certain functions)
3. Check Supabase Row Level Security policies

### Functions timeout

**Solution**: 
1. Upgrade to Netlify Pro plan for longer timeouts
2. Or optimize queries to be faster

## Security Notes

- **Row Level Security (RLS)** is enabled on the `clients` table
- Additional security is enforced by Netlify Identity in the functions
- Only authenticated users can call functions
- Only admins can update or view all clients
- Clients can only view their own data

## Next Steps

- [ ] Test all CRUD operations
- [ ] Add more clients via Supabase dashboard
- [ ] Monitor usage in Supabase dashboard
- [ ] Set up Supabase backups (automatic on paid plans)
- [ ] Consider adding client creation/deletion functions

## Support

- Supabase docs: https://supabase.com/docs
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Issue: Create a GitHub issue in your repository

