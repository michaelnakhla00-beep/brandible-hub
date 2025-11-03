const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'DELETE') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    }
    const { id } = event.queryStringParameters || {};
    if (!id) return { statusCode: 400, body: JSON.stringify({ error: 'id required' }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { error } = await supabase.from('project_phases').delete().eq('id', id);
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ success: true }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


