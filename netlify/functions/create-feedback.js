// netlify/functions/create-feedback.js
const { createClient } = require('@supabase/supabase-js');
const { notifyAdmins } = require('./notify-admins');

exports.handler = async (event, context) => {
  if (event.httpMethod !== "POST") {
    return {
      statusCode: 405,
      body: JSON.stringify({ error: "Method not allowed" })
    };
  }

  try {
    const user = context.clientContext && context.clientContext.user;
    if (!user) {
      return { 
        statusCode: 401, 
        body: JSON.stringify({ error: "Not authenticated" }) 
      };
    }

    // Only clients can submit feedback (not admins)
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (isAdmin) {
      return {
        statusCode: 403,
        body: JSON.stringify({ error: "Only clients can submit feedback" })
      };
    }

    const { project_id, rating, comment } = JSON.parse(event.body || "{}");

    if (!project_id || !rating) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "project_id and rating are required" })
      };
    }

    if (rating < 1 || rating > 5) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Rating must be between 1 and 5" })
      };
    }

    // Initialize Supabase client
    const supabaseUrl = process.env.SUPABASE_URL;
    const supabaseKey = process.env.SUPABASE_SERVICE_ROLE_KEY;
    
    if (!supabaseUrl || !supabaseKey) {
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database not configured" })
      };
    }

    const supabase = createClient(supabaseUrl, supabaseKey);

    // Get client ID from email
    const userEmail = (user.email || "").toLowerCase();
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('id')
      .eq('email', userEmail)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Client record not found" })
      };
    }

    // Check if feedback already exists for this project
    const { data: existing, error: checkError } = await supabase
      .from('feedback')
      .select('id')
      .eq('user_id', client.id)
      .eq('project_id', project_id)
      .single();

    if (existing) {
      // Update existing feedback instead of creating new
      const { data: updated, error: updateError } = await supabase
        .from('feedback')
        .update({
          rating,
          comment: comment || null,
          created_at: new Date().toISOString()
        })
        .eq('id', existing.id)
        .select()
        .single();

      if (updateError) {
        console.error("Supabase update error:", updateError);
        return {
          statusCode: 500,
          body: JSON.stringify({ error: "Database error: " + updateError.message })
        };
      }

      // Get project and client info for notification
      const { data: project } = await supabase
        .from('projects')
        .select('title')
        .eq('id', project_id)
        .single();
      
      const { data: clientData } = await supabase
        .from('clients')
        .select('name')
        .eq('id', client.id)
        .single();

      // Notify admins about updated feedback
      const projectTitle = project?.title || 'Project';
      const clientName = clientData?.name || userEmail;
      const stars = '⭐'.repeat(rating);
      await notifyAdmins(
        `Updated rating for "${projectTitle}" ${stars} (${rating}/5)${comment ? ' with comment' : ''}`,
        'comment',
        userEmail,
        clientName
      );

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ success: true, feedback: updated, updated: true })
      };
    }

    // Create new feedback
    const { data: feedback, error } = await supabase
      .from('feedback')
      .insert({
        user_id: client.id,
        project_id,
        rating,
        comment: comment || null
      })
      .select()
      .single();

    if (error) {
      console.error("Supabase error:", error);
      return {
        statusCode: 500,
        body: JSON.stringify({ error: "Database error: " + error.message })
      };
    }

    // Get project and client info for notification
    const { data: project } = await supabase
      .from('projects')
      .select('title')
      .eq('id', project_id)
      .single();
    
    const { data: clientData } = await supabase
      .from('clients')
      .select('name')
      .eq('id', client.id)
      .single();

    // Notify admins about project feedback
    const projectTitle = project?.title || 'Project';
    const clientName = clientData?.name || userEmail;
    const stars = '⭐'.repeat(rating);
    await notifyAdmins(
      `Rated "${projectTitle}" ${stars} (${rating}/5)${comment ? ' with comment' : ''}`,
      'comment',
      userEmail,
      clientName
    );

    return {
      statusCode: 201,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ success: true, feedback, updated: false })
    };
  } catch (err) {
    console.error("Error in create-feedback:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

