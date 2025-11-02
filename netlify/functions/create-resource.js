// netlify/functions/create-resource.js
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

    // Admin only
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (!isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Admin access required" })
      };
    }

    const { title, description, category, visible_to, fileData, fileName, fileType } = JSON.parse(event.body || "{}");

    if (!title || !category || !fileData || !fileName) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "title, category, fileData, and fileName are required" })
      };
    }

    if (!['Guides', 'Templates', 'Tutorials'].includes(category)) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "category must be one of: Guides, Templates, Tutorials" })
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

    // Sanitize filename
    const safeName = (fileName || 'resource')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .toLowerCase();

    const timestamp = Date.now();
    const path = `${timestamp}-${safeName}`;

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');

    // Upload to Supabase Storage
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('resources_files')
      .upload(path, fileBuffer, {
        contentType: fileType || 'application/octet-stream',
        upsert: false
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: `Upload failed: ${uploadError.message}` })
      };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('resources_files')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Create resource record
    const { data: resource, error } = await supabase
      .from('resources')
      .insert({
        title,
        description: description || null,
        category,
        visible_to: visible_to || 'client',
        file_url: publicUrl
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
      body: JSON.stringify({ success: true, resource })
    };
  } catch (err) {
    console.error("Error in create-resource:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

