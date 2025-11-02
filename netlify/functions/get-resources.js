// netlify/functions/get-resources.js
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

    const isAdmin = user.app_metadata?.roles?.includes("admin");
    const { category } = event.queryStringParameters || {};

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    let query = supabase.from('resources').select('*');

    // Filter by visible_to: clients see only 'client', admins see all
    if (!isAdmin) {
      query = query.eq('visible_to', 'client');
    }

    // Filter by category if provided
    if (category && ['Guides', 'Templates', 'Tutorials'].includes(category)) {
      query = query.eq('category', category);
    }

    const { data: resources, error } = await query.order('created_at', { ascending: false });

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
      body: JSON.stringify({ resources: resources || [] })
    };
  } catch (err) {
    console.error("Error in get-resources:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

