const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (!['POST','PUT','PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    const body = JSON.parse(event.body || '{}');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let targetId = body.client_id;
    if (!targetId && body.client_email) {
      const { data: c } = await supabase.from('clients').select('id').eq('email', body.client_email.toLowerCase()).single();
      targetId = c && c.id;
    }
    if (!targetId) return { statusCode: 400, body: JSON.stringify({ error: 'client_id or client_email required' }) };
    const { data, error } = await supabase
      .from('user_settings')
      .upsert({
        user_id: targetId,
        email_notifications: !!body.email_notifications,
        invoice_reminders: !!body.invoice_reminders,
        updated_at: new Date().toISOString()
      }, { onConflict: 'user_id' })
      .select()
      .single();
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ settings: data }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


