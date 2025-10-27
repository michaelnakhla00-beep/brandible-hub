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

### Adding Client Data

Edit `data/clients.json` to add or modify client information:

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

