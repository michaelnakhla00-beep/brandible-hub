const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    // Try to map identity user -> client record to use client.id as notifications.user_id
    let targetId = user.sub;
    try {
      const email = (user.email || '').toLowerCase();
      if (email) {
        const { data: clientRow } = await supabase
          .from('clients')
          .select('id')
          .eq('email', email)
          .single();
        if (clientRow && clientRow.id) targetId = clientRow.id;
      }
    } catch {}

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', targetId)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ notifications: data || [] }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


