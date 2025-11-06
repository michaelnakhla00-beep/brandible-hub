// netlify/functions/get-edit-requests.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'GET') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const user = context.clientContext?.user;
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const isAdmin = user.app_metadata?.roles?.includes('admin');
    const userEmail = (user.email || '').toLowerCase();

    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Database not configured' }) };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Priority order: Urgent > High > Normal > Low
    const priorityOrder = { 'Urgent': 4, 'High': 3, 'Normal': 2, 'Low': 1 };

    let query = supabase
      .from('edit_requests')
      .select('*');

    if (isAdmin) {
      // Admin sees all requests, sorted by date first
      query = query.order('created_at', { ascending: false });
    } else {
      // Client sees only their requests
      query = query.eq('client_email', userEmail).order('created_at', { ascending: false });
    }

    const { data: requests, error } = await query;

    if (error) {
      console.error('Supabase error:', error);
      return { statusCode: 500, body: JSON.stringify({ error: 'Database error: ' + error.message }) };
    }

    // Sort by priority (for admin view - priority first, then date)
    if (isAdmin && requests) {
      requests.sort((a, b) => {
        const priorityDiff = (priorityOrder[b.priority] || 0) - (priorityOrder[a.priority] || 0);
        if (priorityDiff !== 0) return priorityDiff;
        return new Date(b.created_at) - new Date(a.created_at);
      });
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ requests: requests || [] })
    };
  } catch (err) {
    console.error('Error in get-edit-requests:', err);
    return { statusCode: 500, body: JSON.stringify({ error: 'Server error: ' + err.message }) };
  }
};

