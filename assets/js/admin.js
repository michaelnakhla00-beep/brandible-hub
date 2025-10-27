// assets/js/admin.js

/* ---------------------------
   1) Fetch all clients data
---------------------------- */
async function fetchAllClients() {
  const token = await new Promise((resolve) => {
    const id = window.netlifyIdentity;
    const user = id && id.currentUser();
    if (!user) return resolve(null);
    user.jwt().then(resolve).catch(() => resolve(null));
  });

  const res = await fetch("/.netlify/functions/get-all-clients", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Function error ${res.status}: ${text}`);
  }
  return res.json();
}

/* ---------------------------
   2) Render helpers
---------------------------- */

function renderAdminKPIs(clients = []) {
  const container = document.getElementById("adminKPIs");
  if (!container) return;

  const totalProjects = clients.reduce((sum, c) => sum + (c.kpis?.activeProjects || 0), 0);
  const totalInvoices = clients.reduce((sum, c) => sum + (c.kpis?.openInvoices || 0), 0);
  const totalClients = clients.length;
  const totalFiles = clients.reduce((sum, c) => sum + (c.files?.length || 0), 0);

  const entries = [
    { label: "Total Clients", value: totalClients },
    { label: "Active Projects", value: totalProjects },
    { label: "Open Invoices", value: totalInvoices },
    { label: "Files Shared", value: totalFiles },
  ];

  container.innerHTML = entries
    .map(
      (e) => `
      <div class="card p-5">
        <div class="text-2xl font-semibold">${e.value}</div>
        <div class="text-slate-500">${e.label}</div>
      </div>`
    )
    .join("");
}

function renderClientsTable(clients = [], searchTerm = "") {
  const container = document.getElementById("clientsTable");
  if (!container) return;

  // Filter clients if search term exists
  let filtered = clients;
  if (searchTerm.trim()) {
    const term = searchTerm.toLowerCase();
    filtered = clients.filter(
      (c) =>
        c.name?.toLowerCase().includes(term) || c.email?.toLowerCase().includes(term)
    );
  }

  container.innerHTML = filtered
    .map(
      (client) => `
      <tr class="border-t border-slate-200 dark:border-slate-800 hover:bg-slate-50 dark:hover:bg-slate-900">
        <td class="py-3 font-medium">${client.name || "N/A"}</td>
        <td class="py-3 text-slate-600 dark:text-slate-300">${client.email || "N/A"}</td>
        <td class="py-3">${client.kpis?.activeProjects || 0}</td>
        <td class="py-3">${client.kpis?.openInvoices || 0}</td>
        <td class="py-3 text-sm text-slate-500">${client.kpis?.lastUpdate || "N/A"}</td>
        <td class="py-3 text-right">
          <button onclick="viewClient('${client.email}')" class="btn-primary text-sm">
            View
          </button>
        </td>
      </tr>`
    )
    .join("");
}

function renderAllActivity(clients = []) {
  const container = document.getElementById("allActivity");
  if (!container) return;

  // Collect all activity from all clients with client info
  const allActivity = [];
  clients.forEach((client) => {
    if (client.activity) {
      client.activity.forEach((activity) => {
        allActivity.push({
          ...activity,
          clientName: client.name,
        });
      });
    }
  });

  // Sort by most recent (would need date parsing for proper sorting)
  allActivity.sort((a, b) => {
    // Simple string comparison for now
    return (b.when || "").localeCompare(a.when || "");
  });

  // Take top 20
  const recentActivity = allActivity.slice(0, 20);

  container.innerHTML = recentActivity
    .map(
      (a) => `
      <li class="flex items-start gap-3">
        <div class="size-2 mt-2 rounded-full ${
          a.type === "file"
            ? "bg-sky-500"
            : a.type === "invoice"
            ? "bg-amber-500"
            : "bg-indigo-500"
        }"></div>
        <div class="flex-1">
          <div class="text-sm">
            <span class="font-medium">${a.clientName}</span>: ${a.text}
          </div>
          <div class="text-xs text-slate-500">${a.when}</div>
        </div>
      </li>`
    )
    .join("");
}

/* ---------------------------
   3) Search functionality
---------------------------- */
function wireSearch(allClients) {
  const search = document.getElementById("clientSearch");
  if (search) {
    search.addEventListener("input", () => {
      const term = search.value.trim();
      renderClientsTable(allClients, term);
    });
  }
}

/* ---------------------------
   4) View client function
---------------------------- */
window.viewClient = function (email) {
  // Redirect to portal view of specific client
  // In a full implementation, this would pass the email as a parameter
  // or switch to an admin view of that client's data
  alert(`View client: ${email}\nThis would show detailed view for this client.`);
};

/* ---------------------------
   5) Init
---------------------------- */
(async function init() {
  const overlay = document.getElementById("loadingOverlay");
  try {
    const data = await fetchAllClients();
    const clients = data.clients || [];

    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAllActivity(clients);
    wireSearch(clients);
  } catch (e) {
    console.error(e);
    alert("Failed to load admin dashboard. If this persists, contact support.");
  } finally {
    if (overlay) overlay.style.display = "none";
  }
})();

