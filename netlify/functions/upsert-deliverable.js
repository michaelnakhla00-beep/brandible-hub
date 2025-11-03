const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    const body = JSON.parse(event.body || '{}');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const payload = {
      id: body.id || undefined,
      project_id: body.project_id,
      title: body.title,
      description: body.description || null,
      is_complete: !!body.is_complete
    };
    const { data, error } = await supabase.from('project_deliverables').upsert(payload, { onConflict: 'id' }).select().single();
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ deliverable: data }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


