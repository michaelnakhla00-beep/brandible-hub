// netlify/functions/get-all-clients.js
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
    if (!isAdmin) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Admin access required" }) 
      };
    }

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query all clients from Supabase
    const { data: clients, error } = await supabase
      .from('clients')
      .select('*')
      .order('name');

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    // Return minimal data for admin overview (full details available via get-client)
    const clientsList = clients.map(client => {
      const { id, email, name, kpis, files, activity } = client;
      return {
        id,
        email,
        name,
        kpis,
        filesCount: Array.isArray(files) ? files.length : 0,
        activity: activity || []
      };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients: clientsList })
    };
  } catch (err) {
    console.error("Error in get-all-clients:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};
