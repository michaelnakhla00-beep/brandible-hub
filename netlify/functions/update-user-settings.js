const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST' && event.httpMethod !== 'PUT' && event.httpMethod !== 'PATCH') {
    return { statusCode: 405, body: 'Method not allowed' };
  }
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    const body = JSON.parse(event.body || '{}');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: user.sub,
        email_notifications: !!body.email_notifications,
        invoice_reminders: !!body.invoice_reminders,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ settings: data }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


