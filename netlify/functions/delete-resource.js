// netlify/functions/delete-resource.js
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

    // Admin only
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    const { resource_id } = event.queryStringParameters || {};

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

    // Get resource to find file path
    const { data: resource, error: fetchError } = await supabase
      .from('resources')
      .select('file_url')
      .eq('id', resource_id)
      .single();

    if (fetchError || !resource) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Resource not found" })
      };
    }

    // Extract file path from URL
    const urlParts = resource.file_url.split('/');
    const filePath = urlParts.slice(urlParts.indexOf('resources_files') + 1).join('/');

    // Delete file from storage (if path is valid)
    if (filePath && filePath.includes('resources_files')) {
      const { error: storageError } = await supabase.storage
        .from('resources_files')
        .remove([filePath]);

      if (storageError) {
        console.error('Error deleting file from storage:', storageError);
        // Continue with database deletion even if storage deletion fails
      }
    }

    // Delete resource record
    const { error } = await supabase
      .from('resources')
      .delete()
      .eq('id', resource_id);

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
      body: JSON.stringify({ success: true, message: "Resource deleted" })
    };
  } catch (err) {
    console.error("Error in delete-resource:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

