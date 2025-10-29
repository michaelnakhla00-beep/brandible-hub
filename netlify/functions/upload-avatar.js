// netlify/functions/upload-avatar.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user } = context.clientContext || {};
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Parse JSON body (file comes as base64 encoded)
    const body = JSON.parse(event.body || '{}');
    const { clientId, fileData, fileName, fileType } = body;

    if (!clientId || !fileData || !fileName) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing clientId, fileData, or fileName' }) };
    }

    // Validate file type (images only)
    const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
    if (fileType && !allowedTypes.includes(fileType.toLowerCase())) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Invalid file type. Only images are allowed.' }) };
    }

    // Validate file size (max 5MB)
    const fileSize = Buffer.from(fileData, 'base64').length;
    const maxSize = 5 * 1024 * 1024; // 5MB
    if (fileSize > maxSize) {
      return { statusCode: 400, body: JSON.stringify({ error: 'File too large. Maximum size is 5MB.' }) };
    }

    // Sanitize filename
    const safeName = (fileName || 'avatar')
      .trim()
      .replace(/\s+/g, '_')
      .replace(/[^a-zA-Z0-9._-]/g, '')
      .toLowerCase();

    // Ensure it has an extension
    const ext = safeName.includes('.') ? safeName.split('.').pop() : 'jpg';
    const finalName = safeName.includes('.') ? safeName : `${safeName}.${ext}`;
    const path = `${clientId}/${Date.now()}-${finalName}`;

    // Convert base64 to buffer
    const fileBuffer = Buffer.from(fileData, 'base64');

    // Upload to Supabase Storage using service role (bypasses RLS)
    const { data: uploadData, error: uploadError } = await supabase.storage
      .from('client_avatars')
      .upload(path, fileBuffer, {
        contentType: fileType || 'image/jpeg',
        upsert: true
      });

    if (uploadError) {
      console.error('Supabase storage upload error:', uploadError);
      return { statusCode: 500, body: JSON.stringify({ error: `Upload failed: ${uploadError.message}` }) };
    }

    // Get public URL
    const { data: urlData } = supabase.storage
      .from('client_avatars')
      .getPublicUrl(path);

    const publicUrl = urlData.publicUrl;

    // Update client profile_url in database
    const { error: updateError } = await supabase
      .from('clients')
      .update({ profile_url: publicUrl })
      .eq('id', clientId);

    if (updateError) {
      console.error('Error updating profile_url:', updateError);
      return { statusCode: 500, body: JSON.stringify({ error: `Upload succeeded but failed to update profile: ${updateError.message}` }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        success: true,
        profile_url: publicUrl,
        path: path
      })
    };
  } catch (err) {
    console.error('Error in upload-avatar:', err);
    return { statusCode: 500, body: JSON.stringify({ error: err.message || 'Internal server error' }) };
  }
};

