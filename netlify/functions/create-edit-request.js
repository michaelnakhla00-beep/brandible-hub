// netlify/functions/create-edit-request.js
const { createClient } = require('@supabase/supabase-js');
const { notifyAdmins } = require('./notify-admins');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    // Only clients can create requests (not admins)
    const isAdmin = user.app_metadata?.roles?.includes('admin');
    if (isAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Only clients can create edit requests' }) };
    }

    const userEmail = (user.email || '').toLowerCase();
    const { title, description, priority, attachments } = JSON.parse(event.body || '{}');

    if (!title || !title.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Title is required' }) };
    }

    // Initialize Supabase
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Check limit: max 5 pending requests
    const { data: pendingRequests, error: countError } = await supabase
      .from('edit_requests')
      .select('id')
      .eq('client_email', userEmail)
      .eq('status', 'Pending');

    if (countError) {
      console.error('Error checking pending requests:', countError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to check request limit' }) };
    }

    if (pendingRequests && pendingRequests.length >= 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'You have reached the limit of 5 pending requests. Please wait for approval or cancel an existing request.' })
      };
    }

    // Create request
    const { data: request, error } = await supabase
      .from('edit_requests')
      .insert({
        client_email: userEmail,
        title: title.trim(),
        description: description?.trim() || null,
        priority: priority || 'Normal',
        attachments: attachments || [],
        status: 'Pending'
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    // Get client name for notification
    const { data: client } = await supabase
      .from('clients')
      .select('name, id')
      .eq('email', userEmail)
      .single();

    const clientName = client?.name || userEmail;

    // Notify admins about new edit request
    await notifyAdmins(
      `New edit request: "${title.trim()}"`,
      'system',
      userEmail,
      clientName
    );
    
    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, request })
    };
  } catch (err) {
    console.error('Error in create-edit-request:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

