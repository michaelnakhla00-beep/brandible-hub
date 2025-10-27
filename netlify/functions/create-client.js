// netlify/functions/create-client.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST
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

    // Check if user is admin
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (!isAdmin) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Admin access required" }) 
      };
    }

    const { name, email, kpis } = JSON.parse(event.body);
    
    if (!name || !email) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Name and email are required" })
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Prepare new client data
    const newClient = {
      email: email.toLowerCase(),
      name,
      kpis: kpis || {
        activeProjects: 0,
        files: 0,
        openInvoices: 0,
        lastUpdate: new Date().toLocaleDateString()
      },
      projects: [],
      files: [],
      invoices: [],
      activity: [],
      updates: []
    };

    // Insert new client into Supabase
    const { data: createdClient, error } = await supabase
      .from('clients')
      .insert(newClient)
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      
      // Check for duplicate email error
      if (error.code === '23505') {
        return {
          statusCode: 409,
          body: JSON.stringify({ error: "Client with this email already exists" })
        };
      }
      
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    if (!createdClient) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Failed to create client" })
      };
    }

    // Send Netlify Identity invitation to the client
    let invitationSent = false;
    let invitationError = null;
    
    try {
      // Get the site URL from headers or use NETLIFY_SITE_URL
      const origin = event.headers['origin'] || event.headers['host'] || 
                     process.env.CONTEXT ? `https://${process.env.DEPLOY_PRIME_URL}` : '';
      
      if (!origin) {
        throw new Error('Could not determine site URL');
      }
      
      const siteUrl = origin.includes('://') ? origin : `https://${origin}`;
      
      // Call Netlify Identity invite API
      const inviteResponse = await fetch(`${siteUrl}/.netlify/identity/invite`, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        body: JSON.stringify({
          email: email.toLowerCase(),
          data: {
            role: 'client'
          }
        })
      });

      if (inviteResponse.ok) {
        invitationSent = true;
        console.log(`Invitation sent to ${email}`);
      } else {
        invitationError = await inviteResponse.text();
        console.error('Failed to send invitation:', invitationError);
      }
    } catch (inviteErr) {
      console.error('Error sending invitation:', inviteErr);
      invitationError = inviteErr.message;
      // Don't fail the whole request if invitation fails
      // Client is already created in database
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        success: true,
        message: invitationSent 
          ? "Client created successfully and invitation sent" 
          : "Client created successfully" + (invitationError ? " (invitation not sent)" : ""),
        client: createdClient,
        invitationSent,
        invitationError: invitationError || undefined
      })
    };
  } catch (err) {
    console.error("Error in create-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

