// netlify/functions/update-client.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    // Get auth token from Authorization header
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Not authenticated" }) 
      };
    }

    // Check admin role by verifying the JWT
    const authToken = authHeader.replace('Bearer ', '').trim();
    
    // Get site URL from headers or environment
    const origin = event.headers['host'] || event.headers['x-forwarded-host'] || '';
    const protocol = event.headers['x-forwarded-proto'] || 'https';
    const siteUrl = origin ? `${protocol}://${origin}` : process.env.URL || process.env.DEPLOY_PRIME_URL;
    
    console.log('Site URL:', siteUrl);
    
    // Use Netlify Identity Admin API to verify user
    const userResponse = await fetch(`${siteUrl}/.netlify/identity/user`, {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      console.error('Identity user verification failed:', userResponse.status);
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Invalid authentication token" }) 
      };
    }

    const user = await userResponse.json();
    const isAdmin = user?.app_metadata?.roles?.includes('admin');
    
    if (!isAdmin) {
      console.error('User is not admin:', user.email);
      return { 
        statusCode: 403, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Admin access required" }) 
      };
    }
    
    console.log('✓ Authenticated admin user:', user.email);

    // Parse request body safely
    let requestData;
    try {
      requestData = event.body ? JSON.parse(event.body) : {};
    } catch (parseError) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Invalid JSON in request body" })
      };
    }

    const { email, kpis, activity, updates } = requestData;
    
    console.log('Update request received:', { email, has_kpis: !!kpis, has_activity: !!activity, has_updates: !!updates });
    
    if (!email) {
      return {
        statusCode: 400,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Email is required" })
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare update data matching Supabase schema
    const updateData = {};
    
    // Parse and add kpis if provided
    if (kpis) {
      try {
        if (typeof kpis === 'string') {
          updateData.kpis = JSON.parse(kpis);
        } else if (typeof kpis === 'object') {
          updateData.kpis = kpis;
        }
        console.log('Added kpis to update:', updateData.kpis);
      } catch (err) {
        console.error('Failed to parse kpis:', err);
      }
    }
    
    // Parse and add activity if provided
    if (activity) {
      try {
        if (typeof activity === 'string') {
          updateData.activity = JSON.parse(activity);
        } else if (Array.isArray(activity)) {
          updateData.activity = activity;
        }
        console.log('Added activity to update, count:', updateData.activity?.length || 0);
      } catch (err) {
        console.error('Failed to parse activity:', err);
      }
    }
    
    // Parse and add updates if provided
    if (updates) {
      try {
        if (typeof updates === 'string') {
          updateData.updates = JSON.parse(updates);
        } else if (Array.isArray(updates)) {
          updateData.updates = updates;
        }
        console.log('Added updates to update, count:', updateData.updates?.length || 0);
      } catch (err) {
        console.error('Failed to parse updates:', err);
      }
    }
    
    console.log('Final update data:', JSON.stringify(updateData, null, 2));

    // Update client in Supabase with error handling
    let updatedClient;
    let supabaseError;
    let rowsAffected = 0;
    
    try {
      console.log(`Attempting to update client with email: ${email}`);
      
      const { data, error, count } = await supabase
        .from('clients')
        .update(updateData)
        .eq('email', email.toLowerCase())
        .select();
      
      console.log('Supabase response:', { 
        data: data ? 'present' : 'null', 
        error: error ? error.message : 'none',
        count,
        data_length: data?.length
      });
      
      updatedClient = data && data[0];
      supabaseError = error;
      rowsAffected = data?.length || 0;
      
      if (error) {
        console.error('Supabase error details:', {
          message: error.message,
          details: error.details,
          hint: error.hint,
          code: error.code
        });
      }
    } catch (dbError) {
      console.error("Supabase call exception:", dbError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: "Supabase update failed", 
          details: dbError.message,
          type: 'database_exception'
        })
      };
    }

    if (supabaseError) {
      console.error("Supabase error:", supabaseError);
      return {
        statusCode: 500,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: "Supabase update failed", 
          details: supabaseError.message,
          hint: supabaseError.hint,
          code: supabaseError.code
        })
      };
    }

    if (!updatedClient || rowsAffected === 0) {
      console.error(`Client not found or no rows updated: ${email}`);
      return {
        statusCode: 404,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ 
          success: false,
          error: "Client not found", 
          details: `No client found with email: ${email}`
        })
      };
    }

    console.log(`✓ Client ${email} updated successfully (${rowsAffected} row(s) affected)`);

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        success: true,
        message: "Client updated successfully",
        client: updatedClient
      })
    };
  } catch (err) {
    console.error("Error in update-client:", err);
    return { 
      statusCode: 500, 
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};
