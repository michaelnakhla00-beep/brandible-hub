const supabaseJs = require('@supabase/supabase-js');
const createClient = supabaseJs.createClient;

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return {
      statusCode: 405,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: 'Method not allowed' })
    };
  }
  try {
    const user = context.clientContext && context.clientContext.user;
    const userRoles = user && user.app_metadata && user.app_metadata.roles || [];
    const isAdmin = userRoles.indexOf('admin') >= 0;
    if (!user || !isAdmin) {
      return {
        statusCode: 403,
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ error: 'Admin required' })
      };
    }
    const body = JSON.parse(event.body || '{}');
    const client_id = body.client_id;
    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    let query;
    if (client_id) {
      query = supabase.from('notifications').update({ is_read: true }).eq('user_id', client_id).select('id');
    } else {
      // Admin wants to mark all notifications as read - update only unread ones
      // Use .is('is_read', false) to match unread notifications (avoids UUID comparison issues)
      query = supabase.from('notifications').update({ is_read: true }).eq('is_read', false).select('id');
    }
    const result = await query;
    if (result.error) {
      console.error('Supabase update error:', result.error);
      throw result.error;
    }
    const updatedCount = result.data ? result.data.length : 0;
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, updated: updatedCount })
    };
  } catch (err) {
    console.error('mark-all-notifications-read error:', err);
    return {
      statusCode: 500,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ error: err.message || 'Failed to update notifications' })
    };
  }
};


