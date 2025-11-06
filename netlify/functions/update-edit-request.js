// netlify/functions/update-edit-request.js
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
    const { requestId, updates } = JSON.parse(event.body || '{}');

    if (!requestId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get current request
    const { data: currentRequest, error: fetchError } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !currentRequest) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Request not found' }) };
    }

    // Check permissions
    if (!isAdmin && currentRequest.client_email !== userEmail) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Not authorized' }) };
    }

    // Clients can only update pending requests
    if (!isAdmin && currentRequest.status !== 'Pending') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Can only edit pending requests' }) };
    }

    // Build update payload
    const updatePayload = {};

    if (isAdmin) {
      // Admin can update status, rejection_reason, admin_notes
      if (updates.status) updatePayload.status = updates.status;
      if (updates.rejection_reason !== undefined) updatePayload.rejection_reason = updates.rejection_reason;
      if (updates.admin_notes !== undefined) updatePayload.admin_notes = updates.admin_notes;
      if (updates.project_id !== undefined) updatePayload.project_id = updates.project_id;
    } else {
      // Client can update title, description, priority, attachments (only if pending)
      if (updates.title) updatePayload.title = updates.title.trim();
      if (updates.description !== undefined) updatePayload.description = updates.description?.trim() || null;
      if (updates.priority) updatePayload.priority = updates.priority;
      if (updates.attachments) updatePayload.attachments = updates.attachments;
    }

    if (Object.keys(updatePayload).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No valid updates provided' }) };
    }

    // Update request
    const { data: updatedRequest, error } = await supabase
      .from('edit_requests')
      .update(updatePayload)
      .eq('id', requestId)
      .select()
      .single();

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    // Send notifications based on status changes
    if (isAdmin && updates.status) {
      const { data: client } = await supabase
        .from('clients')
        .select('id, name')
        .eq('email', currentRequest.client_email)
        .single();

      let notificationMessage = '';
      if (updates.status === 'Approved') {
        notificationMessage = `Your edit request "${currentRequest.title}" has been approved`;
      } else if (updates.status === 'Rejected') {
        notificationMessage = `Your edit request "${currentRequest.title}" has been rejected. ${updates.rejection_reason ? 'Reason: ' + updates.rejection_reason : ''}`;
      } else if (updates.status === 'Converted' && updates.project_id) {
        notificationMessage = `Your edit request "${currentRequest.title}" has been converted to a project`;
      }

      if (notificationMessage && client?.id) {
        try {
          const siteUrl = process.env.URL || 
            `${event.headers['x-forwarded-proto'] || 'https'}://${event.headers['x-forwarded-host'] || event.headers.host}`;
          
          await fetch(`${siteUrl}/.netlify/functions/create-notification`, {
            method: 'POST',
            headers: {
              'Content-Type': 'application/json',
              'Authorization': `Bearer ${process.env.NETLIFY_IDENTITY_ADMIN_TOKEN || ''}`
            },
            body: JSON.stringify({
              client_id: client.id,
              message: notificationMessage,
              type: 'edit_request'
            })
          });
        } catch (notifErr) {
          console.error('Failed to send notification:', notifErr);
        }
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, request: updatedRequest })
    };
  } catch (err) {
    console.error('Error in update-edit-request:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

