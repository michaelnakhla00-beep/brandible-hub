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

  id.on("login", (user) => {
    console.log("User logged in:", user.email);
    id.close();
    // After login, go to portal
    if (location.pathname.endsWith("index.html") || location.pathname === "/") {
      location.href = "/portal.html";
    } else {
      // On portal, just refresh
      location.reload();
    }
  });

  id.on("logout", () => {
    console.log("User logged out");
    if (!location.pathname.endsWith("index.html")) {
      location.href = "/index.html";
    }
  });

  id.on("init", (user) => {
    console.log("Netlify Identity initialized", user ? `User: ${user.email}` : "No user");
    const onPortal = location.pathname.endsWith("portal.html");
    if (onPortal && !user) location.href = "/index.html";

    if (onPortal && user) {
      const el = document.getElementById("userEmail");
      if (el) el.textContent = user.email;
      
      // Future: Add role-based features here if needed
      // const isAdmin = user.app_metadata?.roles?.includes("admin");
    }
  });
})();