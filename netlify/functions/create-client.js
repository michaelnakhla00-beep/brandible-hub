// netlify/functions/create-client.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

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

    const { name, email, kpis } = JSON.parse(event.body);
    
    if (!name || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Name and email are required" })
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

    // Prepare new client data
    const newClient = {
      email: email.toLowerCase(),
      name,
      kpis: kpis || {
        activeProjects: 0,
        files: 0,
        openInvoices: 0,
        lastUpdate: new Date().toLocaleDateString()
      },
      projects: [],
      files: [],
      invoices: [],
      activity: [],
      updates: []
    };

    // Insert new client into Supabase
    const { data: createdClient, error } = await supabase
      .from('clients')
      .insert(newClient)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      
      // Check for duplicate email error
      if (error.code === '23505') {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: "Client with this email already exists" })
        };
      }
      
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    if (!createdClient) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to create client" })
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        success: true,
        message: "Client created successfully",
        client: createdClient
      })
    };
  } catch (err) {
    console.error("Error in create-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

