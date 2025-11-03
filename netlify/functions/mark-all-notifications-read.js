const supabaseJs = require('@supabase/supabase-js');
const createClient = supabaseJs.createClient;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = context.clientContext && context.clientContext.user;
    const userRoles = user && user.app_metadata && user.app_metadata.roles || [];
    const isAdmin = userRoles.indexOf('admin') >= 0;
    if (!user || !isAdmin) return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    const { client_id } = JSON.parse(event.body || '{}');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const query = supabase.from('notifications').update({ is_read: true });
    if (client_id) query.eq('user_id', client_id);
    const { error } = await query;
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


