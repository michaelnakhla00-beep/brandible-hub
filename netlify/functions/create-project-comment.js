// netlify/functions/create-project-comment.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
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

    const isAdmin = user.app_metadata?.roles?.includes("admin");
    const { project_id, message } = JSON.parse(event.body || "{}");

    if (!project_id || !message || !message.trim()) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "project_id and message are required" })
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

    // Determine author role
    const author_role = isAdmin ? 'admin' : 'client';

    // Create comment
    const { data: comment, error } = await supabase
      .from('project_comments')
      .insert({
        project_id,
        author_role,
        author_id: user.email || user.id,
        message: message.trim()
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, comment })
    };
  } catch (err) {
    console.error("Error in create-project-comment:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

