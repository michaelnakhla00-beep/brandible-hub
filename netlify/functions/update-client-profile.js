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

    // Auto-recalculate KPIs based on current data
    try {
      // Get client email for querying projects and files
      const clientEmail = data.email;
      
      // Count active projects from projects table
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
      
      // Count files from Supabase Storage
      let totalFiles = 0;
      try {
        // Sanitize email for storage path (same as frontend does)
        const sanitizedEmail = clientEmail.replace(/[^a-zA-Z0-9]/g, '_');
        const { data: filesList, error: filesError } = await supabase.storage
          .from('client_files')
          .list(sanitizedEmail);
        
        if (!filesError && filesList) {
          totalFiles = filesList.length;
        } else if (data.files && Array.isArray(data.files)) {
          // Fallback to JSON array if storage query fails
          totalFiles = data.files.length;
        } else if (typeof data.files === 'number') {
          // Fallback to numeric value
          totalFiles = data.files;
        }
      } catch (fileCountError) {
        console.error('Error counting files:', fileCountError);
        // Fallback to existing data
        if (data.files && Array.isArray(data.files)) {
          totalFiles = data.files.length;
        } else if (typeof data.files === 'number') {
          totalFiles = data.files;
        }
      }
      
      // Count open invoices from invoices JSON array
      let openInvoices = 0;
      if (data.invoices && Array.isArray(data.invoices)) {
        openInvoices = data.invoices.filter(
          i => i.status && i.status.toLowerCase() === 'open'
        ).length;
      } else if (typeof data.invoices === 'number') {
        openInvoices = data.invoices;
      }
      
      // Update lastUpdate to today's date
      const today = new Date().toISOString().split('T')[0];
      
      // Build updated KPIs object
      const updatedKPIs = {
        activeProjects,
        files: totalFiles,
        openInvoices,
        lastUpdate: today
      };
      
      // Update KPIs in the client record
      const { error: kpiError } = await supabase
        .from('clients')
        .update({ kpis: updatedKPIs })
        .eq('id', clientId);
      
      if (kpiError) {
        console.error('Error updating KPIs:', kpiError);
        // Don't fail the request if KPI update fails
      } else {
        // Update the returned data with new KPIs
        data.kpis = updatedKPIs;
        console.log('✅ KPIs auto-updated:', updatedKPIs);
      }
    } catch (kpiCalcError) {
      console.error('Error calculating KPIs:', kpiCalcError);
      // Non-blocking - continue even if KPI calculation fails
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


