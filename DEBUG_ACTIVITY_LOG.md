# Debug Client Activity Logging

## Problem
Client activity inserts are not appearing in Supabase `client_activity` table.

## Solution Steps

### Step 1: Apply Temporary Permissive Policy

1. Go to your **Supabase Dashboard**
2. Navigate to **SQL Editor**
3. Copy and paste this SQL:

```sql
-- Apply debug policy to allow all authenticated inserts
DROP POLICY IF EXISTS "allow_all_inserts_temp" ON public.client_activity;

CREATE POLICY "allow_all_inserts_temp"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true);
```

4. Click **Run**
5. Confirm it says "Success"

### Step 2: Test Activity Logging

1. Open the client portal in your browser
2. Open the browser console (F12)
3. Run this test function:
   ```javascript
   testActivityLog()
   ```

4. Look for these console messages:
   - "🧪 Testing activity log..."
   - "📝 Inserting test activity..."
   - Either: "✅ Test insert successful!" OR error details

### Step 3: Upload a File

1. Upload a file from the client portal
2. Watch the console for:
   - "Attempting to log activity: ..."
   - "Current user for insert: ..."
   - Either success or error messages

### Step 4: Check Supabase

Run this query in Supabase SQL Editor:
```sql
SELECT * FROM client_activity ORDER BY timestamp DESC LIMIT 10;
```

## Expected Results

### If Inserts Succeed
You should see:
- Console: "Activity insert success: [...]"
- Supabase: New rows in `client_activity` table

### If Inserts Fail
Check console for error details:
- RLS policy errors
- Authentication errors
- Network errors

## Next Steps

### If It Works
After confirming inserts work, you can either:
1. **Keep the permissive policy** (simple but less secure)
2. **Replace with specific policy** that only allows matching emails:

```sql
DROP POLICY "allow_all_inserts_temp" ON public.client_activity;

CREATE POLICY "clients_can_insert_own_activity"
  ON public.client_activity
  FOR INSERT
  TO authenticated
  WITH CHECK (true); -- Keep permissive for now
```

### If It Still Fails
Share the console error message and we'll debug further.

## Common Issues

### Error: "new row violates row-level security policy"
- **Fix**: Run the permissive policy SQL above

### Error: "No JWT token available"
- **Fix**: Make sure you're logged in to the portal

### Error: "Supabase client not initialized"
- **Fix**: Refresh the page and try again
