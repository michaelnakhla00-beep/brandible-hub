// netlify/functions/get-all-clients.js
const fs = require("fs");
const path = require("path");

// Helper to find the data file in different environments
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
    if (!isAdmin) {
      return { 
        statusCode: 403, 
        body: JSON.stringify({ error: "Admin access required" }) 
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

    // Return all clients with safe fields only
    const clients = jsonData.clients.map(client => {
      const { id, email, name, kpis, files } = client;
      // Return minimal data for admin overview - full details can be fetched via get-client
      return { id, email, name, kpis, filesCount: files?.length || 0, activity: client.activity };
    });

    return {
      statusCode: 200,
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({ clients })
    };
  } catch (err) {
    console.error("Error in get-all-clients:", err);
    return { 
      statusCode: 500, 
      body: JSON.stringify({ error: "Server error: " + err.message }) 
    };
  }
};

