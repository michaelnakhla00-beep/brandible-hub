// netlify/functions/get-projects.js
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

    // Get the email to query - admin can query by param, clients get their own email
    let emailToQuery = event.queryStringParameters?.email || user.email;
    if (!emailToQuery) {
      return { 
        statusCode: 400, 
        body: JSON.stringify({ error: "No email provided" }) 
      };
    }

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
    
    // Query Supabase for projects
    const { data: projects, error } = await supabase
      .from('projects')
      .select('*')
      .eq('client_email', emailToQuery)
      .order('updated_at', { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ projects: projects || [] })
    };
  } catch (err) {
    console.error("Error in get-projects:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

