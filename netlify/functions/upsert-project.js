// netlify/functions/upsert-project.js

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

    // Get Supabase URL and service key from environment
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseServiceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseServiceKey) {
      console.error('Missing Supabase configuration');
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: 'Server configuration missing. Please set SUPABASE_URL and SUPABASE_SERVICE_ROLE_KEY environment variables.' }) 
      };
    }

    // Use fetch to call Supabase REST API directly
    const projectData = {
      client_email: clientEmail,
      title: project.name,
      description: project.description || project.summary || '',
      status: project.status || 'In Progress'
    };

    // Check if project ID was provided (for updates)
    const projectId = project.id;
    
    let result, error;
    
    if (projectId) {
      // Update existing project by ID
      console.log('Updating existing project:', projectId);
      const updateUrl = `${supabaseUrl}/rest/v1/projects?id=eq.${projectId}`;
      const updateRes = await fetch(updateUrl, {
        method: 'PATCH',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(projectData)
      });
      result = await updateRes.json();
      if (!updateRes.ok) {
        error = { message: 'Failed to update project' };
      }
    } else {
      // Always insert new project (don't check for duplicates by title)
      console.log('Inserting new project');
      const insertUrl = `${supabaseUrl}/rest/v1/projects`;
      const insertRes = await fetch(insertUrl, {
        method: 'POST',
        headers: {
          'apikey': supabaseServiceKey,
          'Authorization': `Bearer ${supabaseServiceKey}`,
          'Content-Type': 'application/json',
          'Prefer': 'return=representation'
        },
        body: JSON.stringify(projectData)
      });
      result = await insertRes.json();
      if (!insertRes.ok) {
        error = { message: 'Failed to insert project' };
      }
    }

    if (error) {
      console.error('Upsert error:', error);
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: error.message || 'Failed to save project' }) 
      };
    }

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
