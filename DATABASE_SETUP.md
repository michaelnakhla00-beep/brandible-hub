# Database Setup for Client Updates

## Current Limitation

The `update-client` function is currently implemented but **cannot directly modify `clients.json`** in production because:
- Netlify Functions run in a read-only filesystem
- The `data/clients.json` file is bundled with the deployment
- Changes wouldn't persist between deployments

## Production Solutions

### Option 1: Use a Database (Recommended)

Connect to a database service to store client data:

#### Fauna (Serverless Database)

```javascript
// Example implementation in update-client.js
const faunadb = require('faunadb');
const q = faunadb.query;

exports.handler = async (event, context) => {
  const client = new faunadb.Client({
    secret: process.env.FAUNA_SECRET_KEY
  });
  
  const { email, kpis, activity } = JSON.parse(event.body);
  
  await client.query(
    q.Update(
      q.Select(
        'ref',
        q.Get(q.Match(q.Index('client_by_email'), email))
      ),
      { data: { kpis, activity } }
    )
  );
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
```

#### Supabase (PostgreSQL)

```javascript
// Using Supabase client
import { createClient } from '@supabase/supabase-js';

const supabase = createClient(
  process.env.SUPABASE_URL,
  process.env.SUPABASE_KEY
);

await supabase
  .from('clients')
  .update({ kpis, activity })
  .eq('email', email);
```

#### DynamoDB (AWS)

```javascript
// Using AWS SDK
const AWS = require('aws-sdk');
const dynamodb = new AWS.DynamoDB.DocumentClient();

await dynamodb.update({
  TableName: 'clients',
  Key: { email },
  UpdateExpression: 'SET kpis = :kpis, activity = :activity',
  ExpressionAttributeValues: {
    ':kpis': kpis,
    ':activity': activity
  }
}).promise();
```

### Option 2: Use Netlify KV Storage

Netlify's key-value store (beta):

```javascript
const { kv } = require("@netlify/functions");

exports.handler = async (event, context) => {
  const { email, kpis, activity } = JSON.parse(event.body);
  
  await kv.set(`client:${email}`, {
    kpis,
    activity,
    updatedAt: new Date().toISOString()
  });
  
  return {
    statusCode: 200,
    body: JSON.stringify({ success: true })
  };
};
```

### Option 3: Git Integration (Advanced)

Commit changes back to the repository using GitHub API:

```javascript
const axios = require('axios');

exports.handler = async (event, context) => {
  const { email, kpis, activity } = JSON.parse(event.body);
  
  // Update clients.json in memory
  const clients = await fs.readFile(...);
  const updated = updateClientInData(clients, email, kpis, activity);
  
  // Commit to GitHub
  await axios.put(
    `https://api.github.com/repos/${process.env.REPO}/contents/data/clients.json`,
    {
      message: `Update client: ${email}`,
      content: Buffer.from(updated).toString('base64'),
      sha: currentSha
    },
    {
      headers: {
        Authorization: `token ${process.env.GITHUB_TOKEN}`
      }
    }
  );
  
  return { statusCode: 200, body: JSON.stringify({ success: true }) };
};
```

## Migration Steps

### For Fauna:

1. Sign up at [fauna.com](https://fauna.com)
2. Create a database named `brandible-hub`
3. Create a collection named `clients`
4. Add an index on `email`:
   ```javascript
   CreateIndex({
     name: "client_by_email",
     source: Collection("clients"),
     terms: [{ field: ["data", "email"] }],
     unique: true
   })
   ```
5. Upload your current client data
6. Add environment variable: `FAUNA_SECRET_KEY`
7. Update `update-client.js` and `get-client.js` to use Fauna

### For Supabase:

1. Sign up at [supabase.com](https://supabase.com)
2. Create a new project
3. Create a `clients` table:
   ```sql
   CREATE TABLE clients (
     email TEXT PRIMARY KEY,
     name TEXT,
     kpis JSONB,
     projects JSONB,
     files JSONB,
     invoices JSONB,
     activity JSONB,
     updates JSONB
   );
   ```
4. Import your current data
5. Add environment variables: `SUPABASE_URL`, `SUPABASE_KEY`
6. Update functions to use Supabase client

## Current Implementation

The current implementation:
- ✅ Accepts update requests
- ✅ Validates admin authentication
- ✅ Returns success response
- ⚠️ **Does not persist changes** (file system is read-only)

## Testing Locally

For local development, you can temporarily enable file writing:

```javascript
// Only for local testing - DON'T deploy this to production
if (process.env.NETLIFY_DEV === "true") {
  fs.writeFileSync(dataPath, JSON.stringify(jsonData, null, 2));
}
```

## Recommended Next Steps

1. **Choose a database** (Fauna recommended for simplicity)
2. **Set up the database** with your current client data
3. **Update both functions** (`get-client.js` and `update-client.js`) to use the database
4. **Test thoroughly** before deploying
5. **Migrate existing data** to the database

## Quick Start with Fauna

1. Install Fauna CLI:
   ```bash
   npm install -g fauna-shell
   ```

2. Login:
   ```bash
   fauna cloud-login
   ```

3. Create database:
   ```bash
   fauna create-database brandible-hub
   ```

4. Set environment variable in Netlify:
   ```
   FAUNA_SECRET_KEY=your_secret_key_here
   ```

5. Update functions to use Fauna SDK

## Questions?

- Fauna docs: https://docs.fauna.com
- Netlify Functions: https://docs.netlify.com/functions/overview/
- Supabase: https://supabase.com/docs

