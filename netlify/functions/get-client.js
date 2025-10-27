// netlify/functions/get-client.js
const fs = require("fs");
const path = require("path");

// Helper to find the data file in different environments
function getDataPath() {
  // Try multiple possible paths for different environments
  const possiblePaths = [
    path.join(__dirname, "../../data/clients.json"),
    path.join(process.cwd(), "data/clients.json"),
    path.join("/var/task/data/clients.json"),
    path.join(__dirname, "data/clients.json")
  ];
  
  for (const dataPath of possiblePaths) {
    try {
      if (fs.existsSync(dataPath)) {
        return dataPath;
      }
    } catch (e) {
      // Continue to next path
    }
  }
  return null;
}

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
    
    // Get the email to query - admin can query by param, clients get their own email
    let emailToQuery = (user.email || "").toLowerCase();
    
    // If admin and email query parameter provided, use that
    if (isAdmin && event.queryStringParameters && event.queryStringParameters.email) {
      emailToQuery = event.queryStringParameters.email.toLowerCase();
    }
    
    const email = emailToQuery;
    
    // Find and read the data file
    const dataPath = getDataPath();
    if (!dataPath) {
      console.error("Could not find clients.json file");
      return { 
        statusCode: 500, 
        body: JSON.stringify({ error: "Configuration error" }) 
      };
    }
    
    const jsonData = JSON.parse(fs.readFileSync(dataPath, "utf8"));

    const client = jsonData.clients.find((c) => (c.email || "").toLowerCase() === email);
    if (!client) {
      return { 
        statusCode: 404, 
        body: JSON.stringify({ error: "Client not found for this email" }) 
      };
    }

    // Return only safe fields (now includes `updates`)
    const { id, email: e, name, kpis, projects, files, invoices, activity, updates } = client;
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ id, email: e, name, kpis, projects, files, invoices, activity, updates })
    };
  } catch (err) {
    console.error("Error in get-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};