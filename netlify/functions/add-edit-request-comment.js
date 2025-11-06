// netlify/functions/add-edit-request-comment.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const isAdmin = user.app_metadata?.roles?.includes('admin');
    const userEmail = (user.email || '').toLowerCase();
    const { requestId, comment } = JSON.parse(event.body || '{}');

    if (!requestId || !comment || !comment.trim()) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID and comment are required' }) };
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

    // Create comment
    const { data: newComment, error } = await supabase
      .from('edit_request_comments')
      .insert({
        request_id: requestId,
        client_email: userEmail,
        comment: comment.trim(),
        is_admin: isAdmin
      })
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    return {
      statusCode: 201,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, comment: newComment })
    };
  } catch (err) {
    console.error('Error in add-edit-request-comment:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

