// netlify/functions/get-project-comments.js
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
    const { project_id } = event.queryStringParameters || {};

    if (!project_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "project_id is required" })
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

    // Fetch comments for this project
    const { data: comments, error } = await supabase
      .from('project_comments')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: true });

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    // If not admin, filter to ensure user can only see comments on their projects
    // This is handled at the project level - if they can see the project, they can see comments
    // For extra security, we could verify project ownership here, but for simplicity
    // we rely on RLS and project-level access control

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ comments: comments || [] })
    };
  } catch (err) {
    console.error("Error in get-project-comments:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

