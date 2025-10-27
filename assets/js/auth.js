// assets/js/auth.js
async function ensureIdentityLoaded() {
  return new Promise((resolve) => {
    if (window.netlifyIdentity) return resolve();
    const iv = setInterval(() => {
      if (window.netlifyIdentity) { 
        clearInterval(iv); 
        resolve(); 
      }
    }, 50);
  });
}

(async function initAuth() {
  await ensureIdentityLoaded();
  const id = window.netlifyIdentity;

  // Wire buttons if present
  const loginBtn = document.getElementById("loginBtn");
  const logoutBtn = document.getElementById("logoutBtn");
  
  if (loginBtn) {
    loginBtn.addEventListener("click", () => {
      console.log("Login button clicked");
      id.open("login");
    });
  }
  
  if (logoutBtn) {
    logoutBtn.addEventListener("click", () => {
      console.log("Logout button clicked");
      id.logout();
    });
  }

  id.on("logout", () => {
    console.log("User logged out");
    location.href = "/index.html";
  });

  id.on("init", (user) => {
    console.log("Netlify Identity initialized", user ? `User: ${user.email}` : "No user");
    
    if (!user) {
      // Not logged in - redirect to login if on protected pages
      if (location.pathname.endsWith("portal.html") || location.pathname.endsWith("admin.html")) {
        location.href = "/index.html";
      }
      return;
    }

    // User is logged in - check role
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    const onAdmin = location.pathname.endsWith("admin.html");
    const onPortal = location.pathname.endsWith("portal.html");

    // Role-based routing
    if (isAdmin) {
      // Admin should be on admin page
      if (!onAdmin && !onPortal) {
        // On login page or root - redirect to admin
        location.href = "/admin.html";
      } else if (onPortal) {
        // Admin accidentally on portal - redirect to admin
        location.href = "/admin.html";
      }
      
      // Update admin page UI
      const el = document.getElementById("userEmail");
      if (el) el.textContent = user.email;
    } else {
      // Regular client - should be on portal page
      if (onAdmin) {
        // Client on admin page - redirect to portal
        location.href = "/portal.html";
      } else if (!onPortal && !location.pathname.endsWith("index.html") && location.pathname !== "/") {
        // On any other page except portal or login - redirect to portal
        location.href = "/portal.html";
      }
      
      // Update portal page UI
      const el = document.getElementById("userEmail");
      if (el) el.textContent = user.email;
    }
  });

  id.on("login", (user) => {
    console.log("User logged in:", user.email);
    id.close();
    
    // Check role after login
    const isAdmin = user.app_metadata?.roles?.includes("admin");
    
    // Redirect based on role
    if (isAdmin) {
      location.href = "/admin.html";
    } else {
      location.href = "/portal.html";
    }
  });
})();