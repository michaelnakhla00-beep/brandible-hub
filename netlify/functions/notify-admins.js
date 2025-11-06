// netlify/functions/notify-admins.js
// Helper function to notify all admins about client activities
const { createClient } = require('@supabase/supabase-js');

/**
 * Notifies all admins about a client activity
 * Creates a notification for a special admin user record
 * @param {string} message - The notification message
 * @param {string} type - The notification type (e.g., 'system', 'file', 'invoice', 'comment')
 * @param {string} clientEmail - Optional: The client email who triggered the activity
 * @param {string} clientName - Optional: The client name who triggered the activity
 */
async function notifyAdmins(message, type = 'system', clientEmail = null, clientName = null) {
  try {
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      console.error("Supabase credentials not configured");
      return { success: false, error: "Database not configured" };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);
    
    // Find or create an admin client record for notifications
    // We'll use a special email pattern for admin notifications
    const adminEmail = 'admin@brandible.com';
    
    let { data: adminClient, error: adminError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', adminEmail)
      .single();
    
    // If admin client doesn't exist, create it
    if (adminError || !adminClient) {
      const { data: newAdminClient, error: createError } = await supabase
        .from('clients')
        .insert({
          email: adminEmail,
          name: 'Admin Notifications',
          kpis: {},
          projects: [],
          files: [],
          invoices: [],
          activity: [],
          updates: []
        })
        .select('id')
        .single();
      
      if (createError) {
        console.error("Error creating admin client:", createError);
        return { success: false, error: createError.message };
      }
      
      adminClient = newAdminClient;
    }
    
    // Enhance message with client info if provided
    let fullMessage = message;
    if (clientName || clientEmail) {
      const clientInfo = clientName ? `${clientName}${clientEmail ? ` (${clientEmail})` : ''}` : clientEmail;
      fullMessage = `${clientInfo}: ${message}`;
    }
    
    // Create notification for admin
    const { error: notificationError } = await supabase
      .from('notifications')
      .insert({
        user_id: adminClient.id,
        message: fullMessage,
        type: type
      });
    
    if (notificationError) {
      console.error("Error creating admin notification:", notificationError);
      return { success: false, error: notificationError.message };
    }
    
    return { success: true };
  } catch (err) {
    console.error("Error in notifyAdmins:", err);
    return { success: false, error: err.message };
  }
}

// Export as a module function for use in other functions
module.exports = { notifyAdmins };

// Also export as a Netlify function handler for direct calls
exports.handler = async (event, context) => {
  if (event.httpMethod !== 'POST') {
    return { statusCode: 405, body: JSON.stringify({ error: 'Method not allowed' }) };
  }
  
  try {
    const body = JSON.parse(event.body || '{}');
    const { message, type, client_email, client_name } = body;
    
    if (!message) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: 'message is required' })
      };
    }
    
    const result = await notifyAdmins(message, type || 'system', client_email, client_name);
    
    if (!result.success) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: result.error || 'Failed to notify admins' })
      };
    }
    
    return {
      statusCode: 200,
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ success: true })
    };
  } catch (err) {
    console.error('Error in notify-admins handler:', err);
    return {
      statusCode: 500,
      body: JSON.stringify({ error: err.message })
    };
  }
};

