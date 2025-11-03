const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    const { client_id, client_email } = event.queryStringParameters || {};
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let targetId = client_id;
    if (!targetId && client_email) {
      const { data: c } = await supabase.from('clients').select('id').eq('email', client_email.toLowerCase()).single();
      targetId = c && c.id;
    }
    if (!targetId) return { statusCode: 400, body: JSON.stringify({ error: 'client_id or client_email required' }) };
    const { data, error } = await supabase.from('brand_profiles').select('*').eq('user_id', targetId).single();
    if (error && error.code !== 'PGRST116') throw error;
    return { statusCode: 200, body: JSON.stringify({ brand: data || null }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


