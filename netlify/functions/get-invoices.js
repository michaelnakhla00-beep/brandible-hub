const { createClient } = require('@supabase/supabase-js');

function isAdmin(user) {
  if (!user) return false;
  const roles = user.app_metadata?.roles || [];
  return roles.includes('admin');
}

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Supabase configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    const admin = isAdmin(user);

    let clientId = event.queryStringParameters?.clientId || null;

    if (!admin) {
      // Find client record by email
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .single();

      if (clientError || !client) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Client record not found' }) };
      }
      clientId = client.id;
    }

    if (!clientId) {
      return { statusCode: 400, body: JSON.stringify({ error: 'clientId is required' }) };
    }

    const query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .eq('client_id', clientId)
      .order('issued_at', { ascending: false })
      .order('created_at', { ascending: false });

    const { data: invoices, error } = await query;

    if (error) {
      console.error('get-invoices error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Failed to fetch invoices' }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ invoices: invoices || [] }),
    };
  } catch (err) {
    console.error('get-invoices unexpected error:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Unexpected error fetching invoices' }) };
  }
};

const { createClient } = require('@supabase/supabase-js');

const supabaseUrl = process.env.SUPABASE_URL;
const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;

function getSupabase() {
  if (!supabaseUrl || !serviceKey) {
    throw new Error('Supabase credentials not configured');
  }
  return createClient(supabaseUrl, serviceKey);
}

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const isAdmin = user.app_metadata?.roles?.includes('admin');
    const supabase = getSupabase();

    let clientId = null;
    const params = event.queryStringParameters || {};

    if (isAdmin) {
      clientId = params.clientId || null;
    } else {
      const { data: client, error: clientError } = await supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .maybeSingle();
      if (clientError) throw clientError;
      if (!client) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Client record not found' }) };
      }
      clientId = client.id;
    }

    let query = supabase
      .from('invoices')
      .select('*, invoice_items(*)')
      .order('issued_at', { ascending: false })
      .order('created_at', { ascending: false });

    if (clientId) {
      query = query.eq('client_id', clientId);
    }

    if (params.status) {
      query = query.eq('status', params.status);
    }

    const { data, error } = await query;
    if (error) throw error;

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, invoices: data || [] }),
    };
  } catch (err) {
    console.error('get-invoices error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to fetch invoices' }),
    };
  }
};

