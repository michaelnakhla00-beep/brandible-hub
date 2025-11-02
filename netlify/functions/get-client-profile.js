// netlify/functions/get-client-profile.js
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

    const isAdmin = user.app_metadata?.roles?.includes("admin");
    const { email: targetEmail } = event.queryStringParameters || {};

    // Determine target email
    let emailToQuery = (user.email || "").toLowerCase();
    if (isAdmin && targetEmail) {
      emailToQuery = targetEmail.toLowerCase();
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

    // Get client record
    const { data: client, error: clientError } = await supabase
      .from('clients')
      .select('*')
      .eq('email', emailToQuery)
      .single();

    if (clientError || !client) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Client not found" })
      };
    }

    // Get or calculate profile completion
    const { data: profile, error: profileError } = await supabase
      .from('client_profiles')
      .select('*')
      .eq('email', emailToQuery)
      .single();

    // Calculate completion if not exists
    let completionPercentage = 0;
    let missingItems = [];

    // Check completion criteria
    const hasLogo = client.profile_url && client.profile_url.trim() !== '';
    const hasQuestionnaire = client.company || client.manager || client.phone || client.website;
    const hasFiles = client.files && Array.isArray(client.files) && client.files.length > 0;
    const hasContactInfo = client.email && client.phone;

    if (!hasLogo) missingItems.push('brand_logo');
    if (!hasQuestionnaire) missingItems.push('questionnaire');
    if (!hasFiles) missingItems.push('files');
    if (!hasContactInfo) missingItems.push('contact_info');

    completionPercentage = Math.round(((4 - missingItems.length) / 4) * 100);

    // If profile doesn't exist, create it
    if (profileError || !profile) {
      const { data: newProfile, error: createError } = await supabase
        .from('client_profiles')
        .insert({
          user_id: client.id,
          email: emailToQuery,
          completion_percentage: completionPercentage,
          missing_items: missingItems
        })
        .select()
        .single();

      if (createError) {
        console.error("Error creating profile:", createError);
      }

      return {
        statusCode: 200,
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          completion_percentage: completionPercentage,
          missing_items: missingItems,
          profile: newProfile || null
        })
      };
    }

    // Update existing profile if calculation differs
    if (profile.completion_percentage !== completionPercentage) {
      const { error: updateError } = await supabase
        .from('client_profiles')
        .update({
          completion_percentage: completionPercentage,
          missing_items: missingItems
        })
        .eq('id', profile.user_id || profile.id);

      if (updateError) {
        console.error("Error updating profile:", updateError);
      }
    }

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        completion_percentage: completionPercentage,
        missing_items: missingItems,
        profile
      })
    };
  } catch (err) {
    console.error("Error in get-client-profile:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

