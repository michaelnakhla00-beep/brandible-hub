const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('user_settings')
      .select('*')
      .eq('user_id', user.sub)
      .single();
    if (error && error.code !== 'PGRST116') throw error; -- not found is ok
    return { statusCode: 200, body: JSON.stringify({ settings: data || { email_notifications: true, invoice_reminders: true } }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


