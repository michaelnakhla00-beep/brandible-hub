// netlify/functions/convert-request-to-project.js
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
    if (!isAdmin) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin access required' }) };
    }

    const { requestId, projectTitle, projectDescription } = JSON.parse(event.body || '{}');

    if (!requestId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Request ID is required' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get request
    const { data: request, error: fetchError } = await supabase
      .from('edit_requests')
      .select('*')
      .eq('id', requestId)
      .single();

    if (fetchError || !request) {
      return { statusCode: 404, body: JSON.stringify({ error: 'Request not found' }) };
    }

    if (request.status !== 'Approved') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Can only convert approved requests' }) };
    }

    // Create project
    const projectData = {
      client_email: request.client_email,
      title: projectTitle || request.title,
      description: projectDescription || request.description || '',
      status: 'In Progress'
    };

    const { data: project, error: projectError } = await supabase
      .from('projects')
      .insert(projectData)
      .select()
      .single();

    if (projectError) {
      console.error('Error creating project:', projectError);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to create project: ' + projectError.message }) };
    }

    // Copy files to project folder
    const copiedAttachments = [];
    if (request.attachments && Array.isArray(request.attachments) && request.attachments.length > 0) {
      for (const attachment of request.attachments) {
        if (attachment.path) {
          try {
            // Download file from edit_requests folder
            const { data: fileData, error: downloadError } = await supabase.storage
              .from('client_files')
              .download(attachment.path);

            if (downloadError) {
              console.error('Failed to download file:', attachment.path, downloadError);
              continue;
            }

            // Upload to project folder
            const newPath = `projects/${project.id}/files/${Date.now()}-${attachment.name}`;
            const { error: uploadError } = await supabase.storage
              .from('client_files')
              .upload(newPath, fileData, { contentType: attachment.type || 'application/octet-stream' });

            if (uploadError) {
              console.error('Failed to upload file to project folder:', newPath, uploadError);
              continue;
            }

            // Get public URL
            const { data: urlData } = supabase.storage
              .from('client_files')
              .getPublicUrl(newPath);

            copiedAttachments.push({
              name: attachment.name,
              path: newPath,
              url: urlData.publicUrl,
              type: attachment.type,
              size: attachment.size
            });
          } catch (copyErr) {
            console.error('Error copying file:', attachment.path, copyErr);
            // Continue with other files
          }
        }
      }
    }

    // Update request: mark as converted and link to project
    const { data: updatedRequest, error: updateError } = await supabase
      .from('edit_requests')
      .update({
        status: 'Converted',
        project_id: project.id
      })
      .eq('id', requestId)
      .select()
      .single();

    if (updateError) {
      console.error('Error updating request:', updateError);
      // Project was created, but request update failed - this is not ideal but not critical
    }

    // Notify client
    const { data: client } = await supabase
      .from('clients')
      .select('id, name')
      .eq('email', request.client_email)
      .single();

    if (client?.id) {
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
            message: `Your edit request "${request.title}" has been converted to project "${project.title}"`,
            type: 'edit_request'
          })
        });
      } catch (notifErr) {
        console.error('Failed to send notification:', notifErr);
      }
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        project,
        request: updatedRequest,
        copiedFiles: copiedAttachments.length
      })
    };
  } catch (err) {
    console.error('Error in convert-request-to-project:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

