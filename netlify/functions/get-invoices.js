const { createClient } = require('@supabase/supabase-js');

const SUPABASE_URL = process.env.SUPABASE_URL;
const SUPABASE_SERVICE_ROLE_KEY = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!SUPABASE_URL || !SUPABASE_SERVICE_ROLE_KEY) {
    throw new Error('Supabase configuration missing');
  }
  return createClient(SUPABASE_URL, SUPABASE_SERVICE_ROLE_KEY);
}

function isAdmin(user) {
  return Boolean(user && (user.app_metadata?.roles || []).includes('admin'));
}

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const supabase = getSupabase();
    const params = event.queryStringParameters || {};
    const admin = isAdmin(user);

    let clientId = params.clientId || null;

    if (!admin) {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id, name, email')
        .eq('email', user.email)
        .maybeSingle();

      if (clientError) throw clientError;
      if (!client) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Client record not found' }) };
      }
      clientId = client.id;
    }

    if (!clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required' }) };
    }

    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('client_id', clientId)
      .order('issued_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data: invoices, error } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoices: invoices || [] }),
    };
  } catch (err) {
    console.error('get-invoices error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to fetch invoices' }),
    };
  }
};

