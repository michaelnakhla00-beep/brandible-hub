const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (!['POST','PUT','PATCH'].includes(event.httpMethod)) return { statusCode: 405, body: 'Method not allowed' };
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user || !user.app_metadata?.roles?.includes('admin')) return { statusCode: 403, body: JSON.stringify({ error: 'Admin required' }) };
    const body = JSON.parse(event.body || '{}');
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let targetId = body.user_id;
    if (!targetId && body.client_email) {
      const { data: c } = await supabase.from('clients').select('id').eq('email', body.client_email.toLowerCase()).single();
      targetId = c && c.id;
    }
    if (!targetId) return { statusCode: 400, body: JSON.stringify({ error: 'user_id or client_email required' }) };
    const payload = {
      user_id: targetId,
      logo_url: body.logo_url || null,
      brand_colors: Array.isArray(body.brand_colors) ? body.brand_colors : (body.brand_colors ? body.brand_colors : []),
      brand_fonts: body.brand_fonts || null,
      target_audience: body.target_audience || null,
      updated_at: new Date().toISOString()
    };
    const { data, error } = await supabase.from('brand_profiles').upsert(payload, { onConflict: 'user_id' }).select().single();
    if (error) throw error;
    return { statusCode: 200, body: JSON.stringify({ brand: data }) };
  } catch (err) { return { statusCode: 500, body: JSON.stringify({ error: err.message }) }; }
};


