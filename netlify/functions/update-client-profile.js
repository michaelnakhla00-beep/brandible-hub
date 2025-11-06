// netlify/functions/update-client-profile.js
const { createClient } = require('@supabase/supabase-js');
const { notifyAdmins } = require('./notify-admins');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "PUT" && event.httpMethod !== "PATCH" && event.httpMethod !== "POST") {
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
    const body = JSON.parse(event.body || "{}");
    const { email: targetEmail, completion_percentage, missing_items, fields } = body;

    // Determine target email
    let emailToQuery = (user.email || "").toLowerCase();
    if (isAdmin && targetEmail) {
      emailToQuery = targetEmail.toLowerCase();
    } else if (!isAdmin) {
      // Clients can only update their own profile
      emailToQuery = (user.email || "").toLowerCase();
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

    // Get client record
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', emailToQuery)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Client not found" })
      };
    }

    // Update clients table if fields are provided (phone, website, etc.)
    if (fields && typeof fields === 'object') {
      const clientUpdates = {};
      if (fields.phone !== undefined) clientUpdates.phone = fields.phone || null;
      if (fields.website !== undefined) clientUpdates.website = fields.website || null;
      
      if (Object.keys(clientUpdates).length > 0) {
        const { error: clientUpdateError } = await supabase
          .from('clients')
          .update(clientUpdates)
          .eq('id', client.id);
        
        if (clientUpdateError) {
          console.error("Error updating client:", clientUpdateError);
          return {
            statusCode: 500,
            body: JSON.stringify({ error: "Failed to update client: " + clientUpdateError.message })
          };
        }
        
        // Notify admins if client (not admin) updated their profile
        if (!isAdmin) {
          const { data: clientData } = await supabase
            .from('clients')
            .select('name')
            .eq('id', client.id)
            .single();
          
          const updatedFields = [];
          if (fields.phone !== undefined) updatedFields.push('phone');
          if (fields.website !== undefined) updatedFields.push('website');
          
          if (updatedFields.length > 0) {
            await notifyAdmins(
              `Updated profile information: ${updatedFields.join(', ')}`,
              'system',
              emailToQuery,
              clientData?.name
            );
          }
        }
      }
    }

    // Build profile update object
    const profileUpdates = {};
    if (completion_percentage !== undefined) {
      if (completion_percentage < 0 || completion_percentage > 100) {
        return {
          statusCode: 400,
          body: JSON.stringify({ error: "completion_percentage must be between 0 and 100" })
        };
      }
      profileUpdates.completion_percentage = completion_percentage;
    }
    if (missing_items !== undefined) {
      profileUpdates.missing_items = Array.isArray(missing_items) ? missing_items : [];
    }

    // Only update client_profiles if there are profile updates
    if (Object.keys(profileUpdates).length > 0) {
      const { data: profile, error } = await supabase
        .from('client_profiles')
        .upsert({
          user_id: client.id,
          email: emailToQuery,
          ...profileUpdates
        }, {
          onConflict: 'user_id'
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
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, profile, client: { id: client.id, ...(fields || {}) } })
      };
    }

    // If only client fields were updated (no profile updates), return success
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, client: { id: client.id, ...(fields || {}) } })
    };
  } catch (err) {
    console.error("Error in update-client-profile:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};
