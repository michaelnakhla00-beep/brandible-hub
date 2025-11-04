// netlify/functions/update-lead-status.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== "POST") {
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

    const { leadId, status, source, score } = JSON.parse(event.body);

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
    
    // Build update payload from provided fields
    const updatePayload = {};
    if (typeof status === 'string' && status.length) updatePayload.status = status;
    if (typeof source === 'string' && source.length) updatePayload.source = source;
    if (typeof score === 'string' && score.length) updatePayload.score = score;

    if (!Object.keys(updatePayload).length) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No fields to update' }) };
    }

    console.log("Updating lead", leadId, "with", updatePayload);
    const { data, error } = await supabase
      .from('leads')
      .update(updatePayload)
      .eq('id', leadId)
      .select();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }
    
    console.log("Update result:", data);
    console.log("Updated lead count:", data?.length);
    
    if (!data || data.length === 0) {
      console.error("No rows updated");
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Lead not found or not updated" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, lead: data })
    };
  } catch (err) {
    console.error("Error in update-lead-status:", err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: "Failed to update lead status" })
    };
  }
};

