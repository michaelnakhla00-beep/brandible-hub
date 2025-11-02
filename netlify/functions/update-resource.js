// netlify/functions/update-resource.js
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

    const { resource_id } = event.queryStringParameters || {};
    const { title, description, category, visible_to } = JSON.parse(event.body || "{}");

    if (!resource_id) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "resource_id is required" })
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

    // Build update object
    const updates = {};
    if (title !== undefined) updates.title = title;
    if (description !== undefined) updates.description = description;
    if (category !== undefined) {
      if (!['Guides', 'Templates', 'Tutorials'].includes(category)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "category must be one of: Guides, Templates, Tutorials" })
        };
      }
      updates.category = category;
    }
    if (visible_to !== undefined) {
      if (!['client', 'internal'].includes(visible_to)) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "visible_to must be 'client' or 'internal'" })
        };
      }
      updates.visible_to = visible_to;
    }

    if (Object.keys(updates).length === 0) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "No valid fields to update" })
      };
    }

    // Update resource
    const { data: resource, error } = await supabase
      .from('resources')
      .update(updates)
      .eq('id', resource_id)
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
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, resource })
    };
  } catch (err) {
    console.error("Error in update-resource:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

