// netlify/functions/delete-lead.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "DELETE") {
      return {
        statusCode: 405,
        body: JSON.stringify({ error: "Method not allowed" })
      };
    }

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

    const { leadId } = JSON.parse(event.body);

    if (!leadId) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Lead ID is required" })
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
    
    // Delete the lead
    console.log("Deleting lead", leadId);
    const { data, error } = await supabase
      .from('leads')
      .delete()
      .eq('id', leadId)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }
    
    console.log("Delete result:", data);
    
    if (!data || data.length === 0) {
      console.error("No rows deleted");
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Lead not found" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, message: "Lead deleted successfully" })
    };
  } catch (err) {
    console.error("Error in delete-lead:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to delete lead" })
    };
  }
};

