// assets/js/auth.js
async function ensureIdentityLoaded() {
return new Promise((resolve) => {
if (window.netlifyIdentity) return resolve();
const iv = setInterval(() => {
if (window.netlifyIdentity) { clearInterval(iv); resolve(); }
}, 50);
});
}


(async function initAuth() {
await ensureIdentityLoaded();
const id = window.netlifyIdentity;


// Wire buttons if present
const loginBtn = document.getElementById("loginBtn");
const logoutBtn = document.getElementById("logoutBtn");
loginBtn && loginBtn.addEventListener("click", () => id.open("login"));
logoutBtn && logoutBtn.addEventListener("click", () => id.logout());


id.on("login", (user) => {
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
if (!location.pathname.endsWith("index.html")) {
location.href = "/index.html";
}
});


id.on("init", (user) => {
  const onPortal = location.pathname.endsWith("portal.html");
  if (onPortal && !user) location.href = "/index.html";

  if (onPortal && user) {
    const el = document.getElementById("userEmail");
    if (el) el.textContent = user.email;
    
    // Future: Add role-based features here if needed
    // const isAdmin = user.app_metadata?.roles?.includes("admin");
  }
});