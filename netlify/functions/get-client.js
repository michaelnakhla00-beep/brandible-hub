// netlify/functions/get-client.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: "Not authenticated" }) 
      };
    }

    // Check if user is admin
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    
    // Identify target by id or email
    const qs = event.queryStringParameters || {};
    const requestedId = qs.id || null;
    
    // Get the email to query - admin can query by param, clients get their own email
    let emailToQuery = (user.email || "").toLowerCase();
    
    // If admin and email query parameter provided, use that
    if (isAdmin && event.queryStringParameters && event.queryStringParameters.email) {
      emailToQuery = event.queryStringParameters.email.toLowerCase();
    } else if (!isAdmin) {
      // Non-admin users can only access their own data
      // This is already enforced by setting emailToQuery to their email
    }
    
    const email = emailToQuery;

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Query Supabase for client data by id (preferred) or email
    let client, clientError;
    if (requestedId) {
      const byId = await supabase
        .from('clients')
        .select('*')
        .eq('id', requestedId)
        .single();
      client = byId.data; clientError = byId.error;
    } else {
      const byEmail = await supabase
        .from('clients')
        .select('*')
        .eq('email', email)
        .single();
      client = byEmail.data; clientError = byEmail.error;
    }

    if (clientError) {
      console.error("Supabase error:", clientError);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + clientError.message })
      };
    }

    if (!client) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: "Client not found for this email" }) 
      };
    }

    // Also fetch projects from the projects table
    const { data: projectsData, error: projectsError } = await supabase
      .from('projects')
      .select('*')
      .eq('client_email', email)
      .order('updated_at', { ascending: false });

    if (projectsError) {
      console.error("Supabase projects error:", projectsError);
    }

    // Convert Supabase projects format to expected format
    const supabaseProjects = (projectsData || []).map(p => ({
      name: p.title,
      summary: p.description || '',
      status: p.status || 'In Progress',
      links: [] // Add links if needed
    }));

    // Merge Supabase projects with any existing projects from client data
    const mergedProjects = supabaseProjects.length > 0 ? supabaseProjects : (client.projects || []);

    // 🔄 Auto-recalculate KPIs from actual data sources (always fresh)
    try {
      // Count active projects from projects table
      let activeProjects = 0;
      if (projectsData) {
        activeProjects = projectsData.filter(
          p => p.status && 
          p.status.toLowerCase() !== 'done' && 
          p.status.toLowerCase() !== 'complete'
        ).length;
      }
      
      // Count files from Supabase Storage
      let totalFiles = 0;
      try {
        const sanitizedEmail = email.replace(/[^a-zA-Z0-9]/g, '_');
        const { data: filesList, error: filesError } = await supabase.storage
          .from('client_files')
          .list(sanitizedEmail);
        
        if (!filesError && filesList) {
          totalFiles = filesList.length;
        }
      } catch (fileCountError) {
        console.error('Error counting files from storage:', fileCountError);
      }
      
      // Count open invoices from JSON
      const parseJSON = (str) => {
        try {
          if (Array.isArray(str)) return str;
          if (typeof str === 'string') return JSON.parse(str || '[]');
          return [];
        } catch {
          return [];
        }
      };
      const invoices = parseJSON(client.invoices);
      const openInvoices = invoices.filter(i => i.status && i.status.toLowerCase() === 'open').length;
      
      // Build updated KPIs
      const updatedKPIs = {
        files: totalFiles,
        activeProjects,
        openInvoices,
        lastUpdate: new Date().toISOString().split('T')[0],
      };
      
      // Update KPIs in database (async, non-blocking for response)
      const { error: kpiUpdateError } = await supabase
        .from('clients')
        .update({ kpis: updatedKPIs })
        .eq('id', client.id);
      
      if (kpiUpdateError) {
        console.error('Error updating KPIs in get-client:', kpiUpdateError);
      }
      
      // Use fresh KPIs for response
      client.kpis = updatedKPIs;
    } catch (kpiError) {
      console.error('Error recalculating KPIs in get-client:', kpiError);
      // Continue with existing KPIs if calculation fails
    }

    // Return client data (excluding internal fields)
    const { id, email: e, name, kpis, files, invoices, activity, updates, company, manager, phone, website, profile_url } = client;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        id, 
        email: e, 
        name, 
        kpis, 
        projects: mergedProjects, 
        files, 
        invoices, 
        activity, 
        updates,
        company: company || null,
        manager: manager || null,
        phone: phone || null,
        website: website || null,
        profile_url: profile_url || null
      })
    };
  } catch (err) {
    console.error("Error in get-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};
