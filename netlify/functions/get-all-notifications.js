const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) {
      return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    }
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('notifications')
      .select('*, user_id')
      .order('created_at', { ascending: false })
      .limit(200);
    if (error) throw error;
    // Attach client email if available
    const ids = [...new Set((data || []).map(n => n.user_id).filter(Boolean))];
    let map = {};
    if (ids.length) {
      const { data: clients } = await supabase.from('clients').select('id,email,name').in('id', ids);
      (clients || []).forEach(c => { map[c.id] = c; });
    }
    const rows = (data || []).map(n => ({ ...n, client: map[n.user_id] || null }));
    return { statusCode: 200, body: JSON.stringify({ notifications: rows }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


