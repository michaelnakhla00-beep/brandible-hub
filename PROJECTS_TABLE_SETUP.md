# Projects Table Setup for Brandible Hub

## Error Message
```
Could not find the table 'public.projects' in the schema cache
```

This error occurs because the `projects` table doesn't exist in your Supabase database yet.

## Solution

### Step 1: Run the SQL Migration

1. Go to your Supabase Dashboard: https://app.supabase.com
2. Select your project
3. Navigate to **SQL Editor**
4. Click **New Query**
5. Copy and paste the contents of `supabase/create_projects_table.sql`
6. Click **Run** to execute the migration

### Step 2: Verify the Table

After running the migration, verify that the table was created:

1. Go to **Table Editor** in Supabase
2. You should see a new table called `projects`
3. The table should have these columns:
   - `id` (UUID)
   - `client_email` (TEXT)
   - `title` (TEXT)
   - `description` (TEXT)
   - `status` (TEXT)
   - `created_at` (TIMESTAMPTZ)
   - `updated_at` (TIMESTAMPTZ)

### Step 3: Test the Feature

After running the migration:

1. Log into the Brandible Hub as admin
2. Open a client's profile
3. Click "Edit" to enter edit mode
4. Try adding a new project
5. Save changes

The projects should now save successfully to Supabase!

## Table Schema

The `projects` table is structured as follows:

```sql
CREATE TABLE public.projects (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  client_email TEXT NOT NULL,
  title TEXT NOT NULL,
  description TEXT DEFAULT '',
  status TEXT DEFAULT 'In Progress',
  created_at TIMESTAMPTZ DEFAULT NOW(),
  updated_at TIMESTAMPTZ DEFAULT NOW(),
  UNIQUE(client_email, title)
);
```

## Security

The table has Row Level Security (RLS) enabled with policies for:
- **SELECT**: Authenticated users can read all projects
- **INSERT**: Authenticated users can create projects
- **UPDATE**: Authenticated users can update projects
- **DELETE**: Authenticated users can delete projects

## Status Values

The `status` field supports these values:
- `New`
- `In Progress` (default)
- `Review`
- `Complete`

These statuses match the project columns in the client portal.

## Troubleshooting

If you still encounter issues:

1. **Check Supabase Logs**: Go to **Logs** → **Postgres Logs** to see any errors
2. **Verify RLS Policies**: Ensure the policies are created correctly
3. **Check Permissions**: Verify your authenticated user has access to the table

## Migration File Location

The SQL migration file is located at:
```
supabase/create_projects_table.sql
```

