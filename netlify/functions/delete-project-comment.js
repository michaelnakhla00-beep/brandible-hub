// netlify/functions/delete-project-comment.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "DELETE") {
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
    const { comment_id } = event.queryStringParameters || {};

    if (!comment_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "comment_id is required" })
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

    // If not admin, verify the user owns the comment
    if (!isAdmin) {
      const { data: comment, error: fetchError } = await supabase
        .from('project_comments')
        .select('author_id')
        .eq('id', comment_id)
        .single();

      if (fetchError || !comment) {
        return {
          statusCode: 404,
          body: JSON.stringify({ error: "Comment not found" })
        };
      }

      if (comment.author_id !== user.email && comment.author_id !== user.id) {
        return {
          statusCode: 403,
          body: JSON.stringify({ error: "Not authorized to delete this comment" })
        };
      }
    }

    // Delete comment
    const { error } = await supabase
      .from('project_comments')
      .delete()
      .eq('id', comment_id);

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
      body: JSON.stringify({ success: true, message: "Comment deleted" })
    };
  } catch (err) {
    console.error("Error in delete-project-comment:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

