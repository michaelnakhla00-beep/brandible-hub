const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    const supabase = createClient(supabaseUrl, supabaseKey);

    const { data, error } = await supabase
      .from('notifications')
      .select('*')
      .eq('user_id', user.sub)
      .order('created_at', { ascending: false })
      .limit(50);

    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ notifications: data || [] }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


