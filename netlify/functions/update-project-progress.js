// netlify/functions/update-project-progress.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH") {
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

    // Admin only
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    const { project_id, progress_percent } = JSON.parse(event.body || "{}");

    if (!project_id || progress_percent === undefined) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "project_id and progress_percent are required" })
      };
    }

    if (progress_percent < 0 || progress_percent > 100) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "progress_percent must be between 0 and 100" })
      };
    }

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

    // Update project progress
    const { data: project, error } = await supabase
      .from('projects')
      .update({ progress_percent })
      .eq('id', project_id)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    if (!project) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Project not found" })
      };
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, project })
    };
  } catch (err) {
    console.error("Error in update-project-progress:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

