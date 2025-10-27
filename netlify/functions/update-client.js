// netlify/functions/update-client.js
const fs = require("fs");
const path = require("path");

// Helper to find the data file
function getDataPath() {
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
    } catch (e) {}
  }
  return null;
}

exports.handler = async (event, context) => {
  // Only allow POST
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

    // Check if user is admin
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    if (!isAdmin) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Admin access required" }) 
      };
    }

    const { email, kpis, activity } = JSON.parse(event.body);
    
    if (!email || !kpis) {
      return {
        statusCode: 400,
        body: JSON.stringify({ error: "Email and KPIs are required" })
      };
    }

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
    
    // Find the client
    const clientIndex = jsonData.clients.findIndex(
      (c) => (c.email || "").toLowerCase() === email.toLowerCase()
    );
    
    if (clientIndex === -1) {
      return {
        statusCode: 404,
        body: JSON.stringify({ error: "Client not found" })
      };
    }

    // Update client data
    if (kpis) {
      jsonData.clients[clientIndex].kpis = {
        ...jsonData.clients[clientIndex].kpis,
        ...kpis
      };
    }
    
    if (activity) {
      jsonData.clients[clientIndex].activity = activity;
    }

    // IMPORTANT: In production, you would update a database here
    // The filesystem in Netlify Functions is read-only
    // Options for production:
    // 1. Use a database (Fauna, Supabase, DynamoDB, etc.)
    // 2. Use Netlify's KV storage
    // 3. Use Git API to commit changes back to the repo
    
    // For now, we'll return success but note that the file wasn't modified
    // In a real implementation, you'd save to a database here
    
    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ 
        success: true,
        message: "Client updated (Note: File system is read-only in Netlify. Connect to a database for persistence.)",
        client: jsonData.clients[clientIndex]
      })
    };
  } catch (err) {
    console.error("Error in update-client:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

