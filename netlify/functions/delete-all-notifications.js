const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    if (event.httpMethod !== 'POST' && event.httpMethod !== 'DELETE') {
      return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
    }

    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Authentication required' }) };
    }

    const supabase = createClient(process.env.SUPABASE_URL, process.env.SUPABASE_SERVICE_ROLE_KEY);
    const body = JSON.parse(event.body || '{}');
    const { onlyRead = false, clientEmail = null } = body;

    let query = supabase.from('notifications');

    // If admin, delete all notifications (or only read ones)
    const userRoles = user && user.app_metadata && user.app_metadata.roles || [];
    const isAdmin = Array.isArray(userRoles) && userRoles.includes('admin');
    
    if (isAdmin) {
      if (onlyRead) {
        // Delete only read notifications
        query = query.delete().eq('is_read', true);
      } else if (clientEmail) {
        // Delete notifications for a specific client
        const { data: client } = await supabase
          .from('clients')
          .select('id')
          .eq('email', clientEmail)
          .single();
        
        if (client) {
          query = query.delete().eq('user_id', client.id);
        } else {
          return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
        }
      } else {
        // Delete all notifications (admin only)
        query = query.delete().neq('id', '00000000-0000-0000-0000-000000000000'); // Delete all
      }
    } else {
      // Regular users can only delete their own notifications
      const { data: client } = await supabase
        .from('clients')
        .select('id')
        .eq('email', user.email)
        .single();
      
      if (!client) {
        return { statusCode: 404, body: JSON.stringify({ error: 'Client not found' }) };
      }

      if (onlyRead) {
        query = query.delete().eq('user_id', client.id).eq('is_read', true);
      } else {
        query = query.delete().eq('user_id', client.id);
      }
    }

    const { error } = await query;
    
    if (error) {
      console.error('Delete notifications error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, message: 'Notifications deleted' }),
    };
  } catch (err) {
    console.error('delete-all-notifications error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Failed to delete notifications' }),
    };
  }
};

