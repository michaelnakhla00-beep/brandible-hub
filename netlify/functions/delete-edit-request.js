// netlify/functions/delete-edit-request.js
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

    const userEmail = (user.email || '').toLowerCase();
    const { requestId } = JSON.parse(event.body || '{}');

    if (!requestId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request to verify ownership and get attachments
    const { data: request, error: fetchError } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Request not found' }) };
    }

    if (request.client_email !== userEmail) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized' }) };
    }

    if (request.status !== 'Pending') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Can only cancel pending requests' }) };
    }

    // Delete files from storage
    if (request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
      for (const attachment of request.attachments) {
        if (attachment.path) {
          try {
            await supabase.storage
              .from('client_files')
              .remove([attachment.path]);
          } catch (storageErr) {
            console.error('Failed to delete file:', attachment.path, storageErr);
            // Continue even if file deletion fails
          }
        }
      }
    }

    // Delete request (cascade will delete comments)
    const { error } = await supabase
      .from('edit_requests')
      .delete()
      .eq('id', requestId);

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Error in delete-edit-request:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

