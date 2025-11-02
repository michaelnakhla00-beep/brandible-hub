// netlify/functions/get-feedback.js
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

    let query = supabase.from('feedback').select('*');

    // If admin, show all feedback; if client, show only their feedback
    if (!isAdmin) {
      // For clients, we need to match user_id to their client record
      // Since user_id might be Netlify Identity UUID, we'll filter by email matching
      const userEmail = (user.email || "").toLowerCase();
      
      // First, get the client record to get their UUID
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', userEmail)
        .single();

      if (clientError || !client) {
        // If no client found, return empty array
        return {
          statusCode: 200,
          headers: { "Content-Type": "application/json" },
          body: JSON.stringify({ feedback: [], averageRating: 0 })
        };
      }

      // Filter by project_id if provided, otherwise all for this user
      if (project_id) {
        query = query.eq('project_id', project_id).eq('user_id', client.id);
      } else {
        query = query.eq('user_id', client.id);
      }
    } else {
      // Admin: filter by project_id if provided, otherwise all
      if (project_id) {
        query = query.eq('project_id', project_id);
      }
    }

    const { data: feedback, error } = await query.order('created_at', { ascending: false });

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    // Calculate average rating
    let averageRating = 0;
    if (feedback && feedback.length > 0) {
      const sum = feedback.reduce((acc, f) => acc + (f.rating || 0), 0);
      averageRating = Math.round((sum / feedback.length) * 10) / 10; // Round to 1 decimal
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        feedback: feedback || [], 
        averageRating,
        count: feedback?.length || 0
      })
    };
  } catch (err) {
    console.error("Error in get-feedback:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

