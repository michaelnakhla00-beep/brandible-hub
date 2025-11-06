// netlify/functions/get-edit-request-comments.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const isAdmin = user.app_metadata?.roles?.includes('admin');
    const userEmail = (user.email || '').toLowerCase();
    const requestId = event.queryStringParameters?.requestId;

    if (!requestId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Verify request exists and user has access
    const { data: request, error: fetchError } = await supabase
      .from('edit_requests')
      .select('client_email')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Request not found' }) };
    }

    if (!isAdmin && request.client_email !== userEmail) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized' }) };
    }

    // Get comments
    const { data: comments, error } = await supabase
      .from('edit_request_comments')
      .select('*')
      .eq('request_id', requestId)
      .order('created_at', { ascending: true });

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ comments: comments || [] })
    };
  } catch (err) {
    console.error('Error in get-edit-request-comments:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

