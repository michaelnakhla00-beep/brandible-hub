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
    const allowed = ['name', 'company', 'manager', 'phone', 'website', 'profile_url', 'activity'];
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

    // 🔄 Recalculate KPIs directly from the client's own JSON fields
    try {
      const { data: updatedClient, error: fetchError } = await supabase
        .from('clients')
        .select('projects, files, invoices')
        .eq('id', clientId)
        .single();

      if (fetchError) {
        console.error('Error fetching client for KPI recalculation:', fetchError);
      } else if (updatedClient) {
        // Safe parsing with fallback for malformed or null values
        const parseJSON = (str) => {
          try {
            // If it's already an array/object, return it
            if (Array.isArray(str) || (typeof str === 'object' && str !== null)) {
              return str;
            }
            // If it's a string, parse it
            if (typeof str === 'string') {
              return JSON.parse(str || '[]');
            }
            // Default to empty array
            return [];
          } catch {
            return [];
          }
        };

        const projects = parseJSON(updatedClient.projects);
        const files = parseJSON(updatedClient.files);
        const invoices = parseJSON(updatedClient.invoices);

        // Count active projects (exclude Done/Complete)
        const activeProjects = projects.filter(
          p => p.status && !['Done', 'Complete'].includes(p.status)
        ).length;

        // Count files and open invoices
        const totalFiles = files.length;
        const openInvoices = invoices.filter(i => i.status === 'Open').length;

        // Build new KPI object
        const kpis = {
          files: totalFiles,
          activeProjects,
          openInvoices,
          lastUpdate: new Date().toISOString().split('T')[0],
        };

        console.log('✅ Recalculated KPIs:', kpis);

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


