// netlify/functions/update-client-profile.js
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

    const body = JSON.parse(event.body || '{}');
    const { clientId, fields } = body;
    if (!clientId || !fields || typeof fields !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing clientId or fields' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Whitelist of fields that can be updated via this function
    const allowed = ['company', 'manager', 'phone', 'website', 'profile_url'];
    const payload = {};
    for (const k of allowed) {
      if (k in fields) payload[k] = fields[k];
    }
    if (Object.keys(payload).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No valid fields to update' }) };
    }

    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, client: data })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


