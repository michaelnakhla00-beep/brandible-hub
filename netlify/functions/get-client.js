// netlify/functions/get-client.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: "Not authenticated" }) 
      };
    }

    // Check if user is admin
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    
    // Get the email to query - admin can query by param, clients get their own email
    let emailToQuery = (user.email || "").toLowerCase();
    
    // If admin and email query parameter provided, use that
    if (isAdmin && event.queryStringParameters && event.queryStringParameters.email) {
      emailToQuery = event.queryStringParameters.email.toLowerCase();
    } else if (!isAdmin) {
      // Non-admin users can only access their own data
      // This is already enforced by setting emailToQuery to their email
    }
    
    const email = emailToQuery;

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query Supabase for client data
    const { data: client, error } = await supabase
      .from('clients')
      .select('*')
      .eq('email', email)
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    if (!client) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: "Client not found for this email" }) 
      };
    }

    // Return client data (excluding internal fields)
    const { id, email: e, name, kpis, projects, files, invoices, activity, updates } = client;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: e, name, kpis, projects, files, invoices, activity, updates })
    };
  } catch (err) {
    console.error("Error in get-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};
