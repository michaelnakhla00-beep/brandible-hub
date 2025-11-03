const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const adminUser = context.clientContext && context.clientContext.user;
    if (!adminUser) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    // Admins and server actions can call this to notify a client
    const body = JSON.parse(event.body || '{}');
    let { client_id, client_email, message, type } = body;
    if (!message || !type) return { statusCode: 400, body: JSON.stringify({ error: 'message and type required' }) };

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    if (!client_id && client_email) {
      const { data: c } = await supabase.from('clients').select('id').eq('email', client_email.toLowerCase()).single();
      client_id = c && c.id;
    }
    if (!client_id) return { statusCode: 400, body: JSON.stringify({ error: 'client_id or client_email required' }) };

    const { error } = await supabase
      .from('notifications')
      .insert({ user_id: client_id, message, type });
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


