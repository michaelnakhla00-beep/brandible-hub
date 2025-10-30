// netlify/functions/update-client-profile.js
const { createClient } = require('@supabase/supabase-js');

exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }

  try {
    const { user } = context.clientContext || {};
    if (!user) {
      return { statusCode: 401, body: JSON.stringify({ error: 'Not authenticated' }) };
    }

    const body = JSON.parse(event.body || '{}');
    const { clientId, fields } = body;
    if (!clientId || !fields || typeof fields !== 'object') {
      return { statusCode: 400, body: JSON.stringify({ error: 'Missing clientId or fields' }) };
    }

    const supabaseUrl = process.env.SUPABASE_URL;
    const serviceKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    if (!supabaseUrl || !serviceKey) {
      return { statusCode: 500, body: JSON.stringify({ error: 'Server configuration missing' }) };
    }

    const supabase = createClient(supabaseUrl, serviceKey);

    // Whitelist of fields that can be updated via this function
    const allowed = ['name', 'company', 'manager', 'phone', 'website', 'profile_url', 'activity', 'projects'];
    const payload = {};
    for (const k of allowed) {
      if (k in fields) payload[k] = fields[k];
    }
    if (Object.keys(payload).length === 0) {
      return { statusCode: 400, body: JSON.stringify({ error: 'No valid fields to update' }) };
    }

    const { data, error } = await supabase
      .from('clients')
      .update(payload)
      .eq('id', clientId)
      .select('*')
      .single();

    if (error) {
      return { statusCode: 500, body: JSON.stringify({ error: error.message }) };
    }

    // 🔄 Recalculate KPIs from actual data sources (matching what UI displays)
    try {
      const clientEmail = data.email;
      
      // Count active projects from projects table (matches UI)
      const { data: projectsData, error: projectsError } = await supabase
        .from('projects')
        .select('status')
        .eq('client_email', clientEmail);
      
      let activeProjects = 0;
      if (!projectsError && projectsData) {
        activeProjects = projectsData.filter(
          p => p.status && 
          p.status.toLowerCase() !== 'done' && 
          p.status.toLowerCase() !== 'complete'
        ).length;
      }
      
      // Count files from Supabase Storage (matches UI)
      let totalFiles = 0;
      try {
        const sanitizedEmail = clientEmail.replace(/[^a-zA-Z0-9]/g, '_');
        const { data: filesList, error: filesError } = await supabase.storage
          .from('client_files')
          .list(sanitizedEmail);
        
        if (!filesError && filesList) {
          totalFiles = filesList.length;
        }
      } catch (fileCountError) {
        console.error('Error counting files from storage:', fileCountError);
        // Fallback to JSON if storage fails
        const parseJSON = (str) => {
          try {
            if (Array.isArray(str)) return str;
            if (typeof str === 'string') return JSON.parse(str || '[]');
            return [];
          } catch {
            return [];
          }
        };
        totalFiles = parseJSON(data.files).length;
      }
      
      // Count open invoices from JSON (matches UI)
      let openInvoices = 0;
      const parseJSON = (str) => {
        try {
          if (Array.isArray(str)) return str;
          if (typeof str === 'string') return JSON.parse(str || '[]');
          return [];
        } catch {
          return [];
        }
      };
      const invoices = parseJSON(data.invoices);
      openInvoices = invoices.filter(i => i.status && i.status.toLowerCase() === 'open').length;
      
      // Build new KPI object
      const kpis = {
        files: totalFiles,
        activeProjects,
        openInvoices,
        lastUpdate: new Date().toISOString().split('T')[0],
      };

      console.log('✅ Recalculated KPIs from actual sources:', kpis);

      const { error: kpiError } = await supabase
        .from('clients')
        .update({ kpis })
        .eq('id', clientId);

      if (kpiError) {
        console.error('Error updating KPIs:', kpiError);
      } else {
        // Update the returned data with new KPIs
        data.kpis = kpis;
      }
    } catch (err) {
      console.error('Unexpected error recalculating KPIs:', err);
    }

    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true, client: data })
    };
  } catch (err) {
    return { statusCode: 500, body: JSON.stringify({ error: err.message }) };
  }
};


