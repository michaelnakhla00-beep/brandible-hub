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

    // Initialize Supabase client with service role key to bypass RLS
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
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
    const adminToken = process.env.NETLIFY_IDENTITY_ADMIN_TOKEN;
    
    if (adminToken) {
      try {
        // Get the site URL
        const origin = event.headers['host'] || event.headers['x-forwarded-host'] || '';
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const siteUrl = origin ? `${protocol}://${origin}` : process.env.URL;
        
        if (!siteUrl) {
          throw new Error('Could not determine site URL');
        }
        
        console.log(`Attempting to send invitation to ${email} via Identity Admin API`);
        
        // Call Netlify Identity Admin API to invite user with client role
        const inviteResponse = await fetch(`${siteUrl}/.netlify/identity/admin/users/invite`, {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${adminToken}`
          },
          body: JSON.stringify({
            email: email.toLowerCase(),
            app_metadata: {
              roles: ['client']
            }
          })
        });

        if (inviteResponse.ok) {
          invitationSent = true;
          const inviteData = await inviteResponse.json();
          console.log(`✓ Invitation sent successfully to ${email}`, inviteData);
        } else {
          const errorText = await inviteResponse.text();
          invitationError = `Invite failed (${inviteResponse.status}): ${errorText}`;
          console.error('❌ Failed to send invitation:', invitationError);
        }
      } catch (inviteErr) {
        console.error('❌ Error sending invitation:', inviteErr);
        invitationError = inviteErr.message;
        // Don't fail the whole request if invitation fails
        // Client is already created in database
      }
    } else {
      invitationError = 'Admin token not configured';
      console.warn('⚠️ NETLIFY_IDENTITY_ADMIN_TOKEN not set - skipping invitation');
    }

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        success: true,
        message: invitationSent 
          ? "Client created and invitation email sent" 
          : "Client created successfully" + (invitationError ? " (invitation not sent)" : ""),
        client: createdClient,
        invitationSent,
        invitationError: invitationError || undefined,
        inviteStatus: invitationSent ? 'sent' : invitationError ? 'failed' : 'not_configured'
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

