// netlify/functions/upsert-project.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  // Only allow POST
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    // Get JWT from Netlify Identity header
    const token = event.headers.authorization?.replace('Bearer ', '') || 
                  event.headers.authorization?.replace('bearer ', '');
    
    if (!token) {
      return { statusCode: 401, body: JSON.stringify({ error: 'No authorization token' }) };
    }

    const { clientEmail, project } = JSON.parse(event.body);
    
    if (!clientEmail || !project || !project.name) {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing required fields' }) };
    }

    // Initialize Supabase with service role key (bypasses RLS)
    const supabaseUrl = process.env.VITE_SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Supabase configuration missing' }) 
      };
    }

    const supabase = createClient(supabaseUrl, supabaseServiceKey);

    // Check if project exists
    const { data: existing, error: selectError } = await supabase
      .from('projects')
      .select('*')
      .eq('client_email', clientEmail)
      .eq('title', project.name)
      .maybeSingle();

    if (selectError && selectError.code !== 'PGRST301') {
      console.error('Select error:', selectError);
    }

    let result, error;
    
    if (existing) {
      // Update existing project
      console.log('Updating existing project:', existing.id);
      ({ data: result, error } = await supabase
        .from('projects')
        .update({
          title: project.name,
          description: project.description || project.summary || '',
          status: project.status || 'In Progress'
        })
        .eq('id', existing.id));
    } else {
      // Insert new project
      console.log('Inserting new project');
      ({ data: result, error } = await supabase
        .from('projects')
        .insert({
          client_email: clientEmail,
          title: project.name,
          description: project.description || project.summary || '',
          status: project.status || 'In Progress'
        }));
    }

    if (error) {
      console.error('Upsert error:', error);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: error.message || 'Failed to save project' }) 
      };
    }

    // Log activity
    await supabase.from('client_activity').insert({
      client_email: clientEmail,
      activity: `Updated project "${project.name}"`,
      type: 'project',
      timestamp: new Date().toISOString()
    });

    return {
      statusCode: 200,
      body: JSON.stringify({ success: true, data: result })
    };

  } catch (err) {
    console.error('Handler error:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message || 'Internal server error' })
    };
  }
};

