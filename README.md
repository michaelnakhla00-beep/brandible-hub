# Brandible Client Hub

A modern client portal built with vanilla JavaScript, Netlify Identity, and Tailwind CSS for managing projects, files, invoices, and support requests.

## Features

- 🔐 **Authentication** via Netlify Identity
- 📊 **Dashboard** with KPIs and project overview
- 📁 **Project Management** with Kanban board view
- 📄 **File Management** with downloadable files
- 💰 **Invoice Tracking** with payment status
- 📝 **Activity Feed** showing recent actions
- 🔍 **Global Search** across projects, files, and invoices
- 🌓 **Dark Mode** with persistent settings
- 💬 **Support Form** integrated with Netlify Forms

## Setup

### Prerequisites

- A Netlify account
- A Supabase account (free tier available)
- Git repository connected to Netlify

### Local Development

1. Clone this repository
2. Install Netlify CLI:
   ```bash
   npm install -g netlify-cli
   ```
3. Run the development server:
   ```bash
   netlify dev
   ```
4. Open http://localhost:8888 in your browser

### Deployment to Netlify

#### Option 1: Netlify UI

1. Push your code to a Git repository (GitHub, GitLab, or Bitbucket)
2. Go to [Netlify](https://app.netlify.com) and create a new site
3. Connect your repository
4. Netlify will automatically detect the `netlify.toml` configuration
5. Deploy!

#### Option 2: Netlify CLI

1. Build the site:
   ```bash
   npm run build
   ```

2. Deploy to Netlify:
   ```bash
   netlify deploy --prod
   ```

### Configure Netlify Identity

1. Go to your site's dashboard on Netlify
2. Navigate to **Identity** → **Settings**
3. Enable Identity and select the registration method:
   - **Sign up only** (recommended for client portals)
   - **Invite only** (for controlled access)
4. Configure email settings (SMTP) for production use
5. Set up custom email templates if desired

### Setting Up Supabase (Database)

The Hub now uses Supabase for persistent data storage. See [SUPABASE_SETUP.md](./SUPABASE_SETUP.md) for complete instructions.

Quick start:
1. Create a Supabase project at [supabase.com](https://supabase.com)
2. Run `supabase/schema.sql` in the SQL Editor
3. Set `SUPABASE_URL` and `SUPABASE_ANON_KEY` in Netlify environment variables
4. Optionally migrate existing data using `scripts/migrate-to-supabase.js`

### Adding Client Data

Client data is now stored in Supabase. You can add/modify clients:
1. Via Supabase Dashboard → Table Editor
2. Via the Admin panel in the Hub (edit mode)
3. Or manually via SQL

### Setting Up Supabase Storage (File Uploads)

The Hub supports file uploads via Supabase Storage. See [SUPABASE_STORAGE_SETUP.md](./SUPABASE_STORAGE_SETUP.md) for complete setup instructions.

**⚠️ CRITICAL: Bucket Name**
- The storage bucket **MUST** be named exactly `client_files` (lowercase, underscore)
- All RLS policies are scoped to `bucket_id = 'client_files'`
- Never change the bucket name without updating all policies and code references
- Changing the bucket name will break file uploads and cause RLS violations

Quick setup:
1. Create bucket named `client_files` in Supabase Dashboard → Storage
2. Make the bucket **public**
3. Configure RLS policies (see UPDATE_RLS_POLICIES.sql)
4. Files are stored in folders by sanitized email: `client_files/{sanitized_email}/{timestamp-filename}`

For reference, here's the data structure for `data/clients.json` (if you need to migrate):

```json
{
  "clients": [
    {
      "id": "clt_demo_001",
      "name": "Client Name",
      "email": "client@example.com",
      "kpis": {
        "activeProjects": 2,
        "files": 3,
        "openInvoices": 1,
        "lastUpdate": "Oct 3, 2025"
      },
      "projects": [
        {
          "name": "Project Name",
          "status": "In Progress",
          "summary": "Project description",
          "links": [
            { "label": "View Site", "url": "https://example.com" }
          ]
        }
      ],
      "files": [
        {
          "name": "Document.pdf",
          "url": "https://example.com/file.pdf",
          "updated": "Oct 1, 2025"
        }
      ],
      "invoices": [
        {
          "number": "INV-1",
          "date": "2025-09-25",
          "amount": 1800,
          "status": "Open"
        }
      ],
      "activity": [
        {
          "type": "project",
          "text": "Project updated",
          "when": "2 days ago"
        }
      ],
      "updates": [
        {
          "title": "Update Title",
          "body": "Update description",
          "when": "2025-10-04",
          "type": "milestone"
        }
      ]
    }
  ]
}
```

### Adding Users

After enabling Netlify Identity:

1. Go to **Identity** → **Users** in your Netlify dashboard
2. Click **Invite users**
3. Enter the client's email address (must match the `email` field in `clients.json`)
4. The client will receive an email with an invite link
5. They can set their password and log in

### Security

- Users are authenticated via Netlify Identity
- Only authenticated users can access the portal
- Client data is filtered by email address
- The function returns only data matching the authenticated user's email

## Project Structure

```
HUB/
├── assets/
│   ├── css/
│   │   └── styles.css          # Tailwind component styles
│   └── js/
│       ├── auth.js              # Authentication logic
│       └── portal.js            # Portal rendering logic
├── data/
│   └── clients.json             # Client data
├── netlify/
│   ├── functions/
│   │   └── get-client.js        # Serverless function
│   └── netlify.toml             # Netlify configuration
├── index.html                   # Login page
├── portal.html                  # Dashboard
├── package.json                 # Project dependencies
└── README.md                    # This file
```

## Customization

### Styling

The project uses Tailwind CSS with custom component classes defined in:
- `assets/css/styles.css` - Global component styles
- Inline styles in `portal.html` - Additional component utilities

### Adding Features

1. **New Data Fields**: Update `data/clients.json` and modify the render functions in `assets/js/portal.js`
2. **New Pages**: Create new HTML files and add navigation links
3. **New Functions**: Add serverless functions in `netlify/functions/`

## Troubleshooting

### Function Not Found

If you see "Function not found" errors:
- Ensure `netlify.toml` is in the root directory
- Verify the function path is correct: `netlify/functions/get-client.js`
- Check that `data/clients.json` exists

### Authentication Issues

- Ensure Netlify Identity is enabled
- Verify the user's email matches exactly with `clients.json`
- Check browser console for detailed error messages

### Data Not Loading

- Check browser console for errors
- Verify the function is deployed correctly
- Ensure `data/clients.json` has valid JSON syntax

## License

MIT License - see LICENSE file for details

## Support

For issues or questions, contact your Brandible representative.

