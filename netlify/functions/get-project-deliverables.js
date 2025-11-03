const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    const { project_id } = event.queryStringParameters || {};
    if (!project_id) return { statusCode: 400, body: JSON.stringify({ error: 'project_id required' }) };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('project_deliverables')
      .select('*')
      .eq('project_id', project_id)
      .order('created_at', { ascending: true });

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ deliverables: data || [] }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


