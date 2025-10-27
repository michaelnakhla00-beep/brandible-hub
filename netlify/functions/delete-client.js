const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Get auth token from Authorization header
    const authHeader = event.headers['authorization'] || event.headers['Authorization'];
    if (!authHeader || !authHeader.startsWith('Bearer ')) {
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Not authenticated' }) 
      };
    }

    // Check admin role by verifying the JWT
    const authToken = authHeader.replace('Bearer ', '').trim();
    
    // Use Netlify Identity Admin API to verify user
    const userResponse = await fetch(`${process.env.URL}/.netlify/identity/user`, {
      headers: { 
        'Authorization': `Bearer ${authToken}`,
        'Content-Type': 'application/json'
      }
    });
    
    if (!userResponse.ok) {
      console.error('Identity user verification failed:', userResponse.status);
      return { 
        statusCode: 401, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Invalid authentication token' }) 
      };
    }

    const user = await userResponse.json();
    const isAdmin = user?.app_metadata?.roles?.includes('admin');
    
    if (!isAdmin) {
      console.error('User is not admin:', user.email);
      return { 
        statusCode: 403, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Only admins can delete clients' }) 
      };
    }
    
    console.log('✓ Authenticated admin user:', user.email);

    // Parse request
    const { email } = JSON.parse(event.body);
    if (!email) {
      return { 
        statusCode: 400, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Email is required' }) 
      };
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_ANON_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { 
        statusCode: 500, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Supabase not configured' }) 
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get the client to find their ID
    const { data: client, error: fetchError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', email.toLowerCase())
      .single();

    if (fetchError || !client) {
      console.error('Client not found:', email);
      return { 
        statusCode: 404, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Client not found' }) 
      };
    }

    // Delete from Supabase
    const { error: deleteError } = await supabase
      .from('clients')
      .delete()
      .eq('email', email.toLowerCase());

    if (deleteError) {
      console.error('Supabase delete error:', deleteError);
      return { 
        statusCode: 500, 
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Failed to delete client from database' }) 
      };
    }

    console.log(`✓ Client ${email} deleted from Supabase`);

    // Try to delete from Netlify Identity
    let identityDeleted = false;
    const adminToken = process.env.NETLIFY_IDENTITY_ADMIN_TOKEN;

    if (adminToken) {
      try {
        // Get the site URL
        const origin = event.headers['host'] || event.headers['x-forwarded-host'] || '';
        const protocol = event.headers['x-forwarded-proto'] || 'https';
        const siteUrl = origin ? `${protocol}://${origin}` : process.env.URL;
        
        if (siteUrl) {
          // First, try to find the user by email to get their ID
          const identityResponse = await fetch(`${siteUrl}/.netlify/identity/admin/users?email=${encodeURIComponent(email.toLowerCase())}`, {
            headers: {
              'Authorization': `Bearer ${adminToken}`
            }
          });

          if (identityResponse.ok) {
            const users = await identityResponse.json();
            const identityUser = users.find(u => u.email === email.toLowerCase());
            
            if (identityUser && identityUser.id) {
              // Delete the user from Identity
              const deleteIdentityResponse = await fetch(`${siteUrl}/.netlify/identity/admin/users/${identityUser.id}`, {
                method: 'DELETE',
                headers: {
                  'Authorization': `Bearer ${adminToken}`
                }
              });

              if (deleteIdentityResponse.ok) {
                identityDeleted = true;
                console.log(`✓ User ${email} deleted from Netlify Identity`);
              } else {
                console.warn(`⚠ Failed to delete user from Identity (${deleteIdentityResponse.status})`);
              }
            } else {
              console.log(`ℹ User ${email} not found in Identity (invitation may not have been sent)`);
            }
          } else {
            console.warn(`⚠ Failed to query Identity users (${identityResponse.status})`);
          }
        }
      } catch (identityErr) {
        console.error('❌ Error deleting from Identity:', identityErr);
        // Don't fail the whole request if Identity deletion fails
      }
    } else {
      console.warn('⚠️ NETLIFY_IDENTITY_ADMIN_TOKEN not set - skipping Identity deletion');
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        message: identityDeleted 
          ? 'Client removed from database and Identity' 
          : 'Client removed from database (Identity user not found or not configured)',
        deleted: true,
        identityDeleted
      })
    };
  } catch (err) {
    console.error("Error in delete-client:", err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ 
        error: 'Internal server error',
        message: err.message 
      })
    };
  }
};

