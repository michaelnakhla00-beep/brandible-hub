const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    
    // Get client record by email to find client.id
    const userEmail = (user.email || '').toLowerCase();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', userEmail)
      .single();
    
    if (clientError || !client) {
      return { statusCode: 200, body: JSON.stringify({ brand: null }) };
    }
    
    // Look up brand profile using client.id
    const { data, error } = await supabase
      .from('brand_profiles')
      .select('*')
      .eq('user_id', client.id)
      .single();
    
    if (error && error.code !== 'PGRST116') throw error;
    return { statusCode: 200, body: JSON.stringify({ brand: data || null }) };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


