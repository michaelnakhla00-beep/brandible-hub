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

// Store all clients globally for modal access
let allClientsGlobal = [];
let currentClientEmail = null;
let editMode = false;
let originalClientData = null;

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
      <tr class="table-row">
        <td class="py-3 px-4 font-medium">${client.name || "N/A"}</td>
        <td class="py-3 px-4 text-slate-600 dark:text-slate-300">${client.email || "N/A"}</td>
        <td class="py-3 px-4">${client.kpis?.activeProjects || 0}</td>
        <td class="py-3 px-4">${client.kpis?.openInvoices || 0}</td>
        <td class="py-3 px-4 text-sm text-slate-500">${client.kpis?.lastUpdate || "N/A"}</td>
        <td class="py-3 px-4 text-right">
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
   4) Modal rendering functions
---------------------------- */

function renderModalKPIs(client) {
  const container = document.getElementById("modalKPIs");
  if (!container || !client.kpis) return;
  
  const toMoney = (n) => `$${Number(n).toFixed(2)}`;
  
  container.innerHTML = `
    <div class="card p-4">
      <div class="text-2xl font-semibold">${client.kpis.activeProjects || 0}</div>
      <div class="text-slate-500">Active Projects</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-semibold">${client.kpis.files || 0}</div>
      <div class="text-slate-500">Files Shared</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-semibold">${client.kpis.openInvoices || 0}</div>
      <div class="text-slate-500">Open Invoices</div>
    </div>
    <div class="card p-4">
      <div class="text-2xl font-semibold">${client.kpis.lastUpdate || "N/A"}</div>
      <div class="text-slate-500">Last Update</div>
    </div>
  `;
}

function renderModalProjects(client) {
  const container = document.getElementById("modalProjects");
  if (!container || !client.projects || !client.projects.length) {
    container.innerHTML = '<p class="text-slate-500">No projects</p>';
    return;
  }
  
  container.innerHTML = client.projects.map(p => {
    const pillClass = p.status === "Completed" || p.status === "Done" 
      ? "pill-green" 
      : p.status.toLowerCase().includes("review") 
      ? "pill-slate" 
      : "pill-amber";
    
    return `
      <div class="card p-4">
        <div class="flex items-start justify-between">
          <div class="flex-1">
            <div class="font-medium mb-1">${p.name}</div>
            <div class="text-sm text-slate-600 dark:text-slate-300 mb-2">${p.summary || ""}</div>
            ${p.links?.length ? `
              <div class="flex flex-wrap gap-2 mt-2">
                ${p.links.map(l => `<a href="${l.url}" target="_blank" rel="noopener" class="chip">${l.label}</a>`).join("")}
              </div>
            ` : ""}
          </div>
          <span class="${pillClass}">${p.status}</span>
        </div>
      </div>
    `;
  }).join("");
}

function renderModalFiles(client) {
  const container = document.getElementById("modalFiles");
  if (!container || !client.files || !client.files.length) {
    container.innerHTML = '<p class="text-slate-500">No files</p>';
    return;
  }
  
  container.innerHTML = client.files.map(f => `
    <li class="flex items-center justify-between p-3 rounded-xl border border-slate-200 dark:border-slate-800">
      <a href="${f.url}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline flex-1">
        ${f.name}
      </a>
      <span class="text-xs text-slate-500">${f.updated || ""}</span>
    </li>
  `).join("");
}

function renderModalInvoices(client) {
  const container = document.getElementById("modalInvoices");
  if (!container || !client.invoices || !client.invoices.length) {
    container.innerHTML = '<tr><td colspan="4" class="text-center py-4 text-slate-500">No invoices</td></tr>';
    return;
  }
  
  const toMoney = (n) => `$${Number(n).toFixed(2)}`;
  
  container.innerHTML = client.invoices.map(inv => `
    <tr class="border-t border-slate-200 dark:border-slate-800">
      <td class="py-2">${inv.number}</td>
      <td class="py-2">${inv.date}</td>
      <td class="py-2">${toMoney(inv.amount)}</td>
      <td class="py-2">
        ${inv.status === "Paid" 
          ? '<span class="pill-green">Paid</span>' 
          : '<span class="pill-amber">Open</span>'
        }
      </td>
    </tr>
  `).join("");
}

function renderModalActivity(client) {
  const container = document.getElementById("modalActivity");
  if (!container || !client.activity || !client.activity.length) {
    container.innerHTML = '<p class="text-slate-500">No recent activity</p>';
    return;
  }
  
  container.innerHTML = client.activity.map(a => `
    <li class="flex items-start gap-3 p-2">
      <div class="size-2 mt-2 rounded-full ${
        a.type === "file" 
          ? "bg-sky-500" 
          : a.type === "invoice" 
          ? "bg-amber-500" 
          : "bg-indigo-500"
      }"></div>
      <div class="flex-1">
        <div class="text-sm">${a.text}</div>
        <div class="text-xs text-slate-500">${a.when}</div>
      </div>
    </li>
  `).join("");
}

function renderModalUpdates(client) {
  const container = document.getElementById("modalUpdates");
  const section = document.getElementById("modalUpdatesSection");
  if (!container || !client.updates || !client.updates.length) {
    if (section) section.style.display = "none";
    return;
  }
  
  if (section) section.style.display = "block";
  
  container.innerHTML = client.updates.map(u => `
    <li class="p-3 rounded-xl border border-slate-200 dark:border-slate-800">
      <div class="flex items-start justify-between mb-1">
        <div class="font-medium">${u.title}</div>
        <div class="text-xs text-slate-500">${u.when}</div>
      </div>
      <div class="text-sm text-slate-600 dark:text-slate-300">${u.body || ""}</div>
    </li>
  `).join("");
}

/* ---------------------------
   5) View client modal
---------------------------- */
window.viewClient = function (email) {
  const client = allClientsGlobal.find(c => c.email?.toLowerCase() === email.toLowerCase());
  if (!client) {
    alert("Client not found");
    return;
  }
  
  // Store current client for editing
  currentClientEmail = email;
  
  // Populate modal header
  document.getElementById("modalClientName").textContent = client.name || "Unknown";
  document.getElementById("modalClientEmail").textContent = client.email || "";
  
  // Reset edit mode
  if (editMode) {
    cancelEditMode();
  }
  
  // Fetch full client data
  fetchClientFullData(email).then(fullClient => {
    // Store original data
    originalClientData = { ...fullClient };
    
    renderModalKPIs(fullClient);
    renderModalProjects(fullClient);
    renderModalFiles(fullClient);
    renderModalInvoices(fullClient);
    renderModalActivity(fullClient);
    renderModalUpdates(fullClient);
  }).catch(err => {
    console.error("Error fetching full client data:", err);
    // Fallback to basic data from list
    originalClientData = { ...client };
    renderModalKPIs(client);
  });
  
  // Show modal
  document.getElementById("clientModal").classList.remove("hidden");
};

async function fetchClientFullData(email) {
  const token = await new Promise((resolve) => {
    const id = window.netlifyIdentity;
    const user = id && id.currentUser();
    if (!user) return resolve(null);
    user.jwt().then(resolve).catch(() => resolve(null));
  });

  const res = await fetch(`/.netlify/functions/get-client?email=${encodeURIComponent(email)}`, {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    throw new Error(`Failed to fetch client data: ${res.status}`);
  }
  return res.json();
}

/* ---------------------------
   7) Edit Mode Functions
---------------------------- */

window.toggleEditMode = function() {
  editMode = !editMode;
  
  // Toggle headers
  document.getElementById("editModeHeader").classList.toggle("hidden");
  
  // Toggle edit sections
  document.getElementById("editKPIsSection").classList.toggle("hidden");
  document.getElementById("editActivitySection").classList.toggle("hidden");
  
  // Update edit button
  const editBtn = document.getElementById("editBtn");
  if (editBtn) {
    editBtn.textContent = editMode ? "Viewing" : "Edit";
    editBtn.disabled = editMode;
  }
  
  // Populate edit fields with current data
  if (editMode && originalClientData) {
    populateEditFields(originalClientData);
  }
};

window.cancelEditMode = function() {
  editMode = false;
  document.getElementById("editModeHeader").classList.add("hidden");
  document.getElementById("editKPIsSection").classList.add("hidden");
  document.getElementById("editActivitySection").classList.add("hidden");
  document.getElementById("editBtn").textContent = "Edit";
  document.getElementById("editBtn").disabled = false;
};

function populateEditFields(client) {
  if (!client.kpis) return;
  
  document.getElementById("editKPIProjects").value = client.kpis.activeProjects || 0;
  document.getElementById("editKPIFiles").value = client.kpis.files || 0;
  document.getElementById("editKPIInvoices").value = client.kpis.openInvoices || 0;
  document.getElementById("editKPILastUpdate").value = client.kpis.lastUpdate || "";
}

window.addActivityToClient = function() {
  const type = document.getElementById("newActivityType").value;
  const text = document.getElementById("newActivityText").value;
  const when = document.getElementById("newActivityWhen").value;
  
  if (!text || !when) {
    alert("Please fill in both activity description and time");
    return;
  }
  
  // Add to original client data
  if (!originalClientData.activity) {
    originalClientData.activity = [];
  }
  
  originalClientData.activity.unshift({
    type: type,
    text: text,
    when: when
  });
  
  // Re-render activity
  renderModalActivity(originalClientData);
  
  // Clear form
  document.getElementById("newActivityText").value = "";
  document.getElementById("newActivityWhen").value = "";
};

window.saveClientChanges = async function() {
  const saveBtn = document.getElementById("saveBtn");
  const saveBtnText = document.getElementById("saveBtnText");
  
  try {
    // Show saving state
    saveBtn.disabled = true;
    saveBtnText.textContent = "Saving...";
    
    // Get updated KPI values
    const updatedKPIs = {
      activeProjects: parseInt(document.getElementById("editKPIProjects").value) || 0,
      files: parseInt(document.getElementById("editKPIFiles").value) || 0,
      openInvoices: parseInt(document.getElementById("editKPIInvoices").value) || 0,
      lastUpdate: document.getElementById("editKPILastUpdate").value || ""
    };
    
    // Update original data
    originalClientData.kpis = updatedKPIs;
    
    // Call update function
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });
    
    const res = await fetch("/.netlify/functions/update-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        email: currentClientEmail,
        kpis: updatedKPIs,
        activity: originalClientData.activity,
        timestamp: new Date().toISOString()
      }),
    });
    
    if (!res.ok) {
      throw new Error(`Failed to save: ${res.status}`);
    }
    
    const result = await res.json();
    console.log("Save result:", result);
    
    // Update the display
    renderModalKPIs(originalClientData);
    
    alert("✅ Changes saved successfully!");
    cancelEditMode();
    
    // Refresh the clients list
    const data = await fetchAllClients();
    const clients = data.clients || [];
    allClientsGlobal = clients;
    renderAdminKPIs(clients);
    renderClientsTable(clients);
    
  } catch (error) {
    console.error("Error saving:", error);
    alert("❌ Failed to save changes: " + error.message);
  } finally {
    saveBtn.disabled = false;
    saveBtnText.textContent = "Save Changes";
  }
};

/* ---------------------------
   8) New Client Modal Functions
---------------------------- */

window.openNewClientModal = function() {
  document.getElementById('newClientModal').classList.remove('hidden');
  // Reset form
  document.getElementById('newClientName').value = '';
  document.getElementById('newClientEmail').value = '';
  document.getElementById('newClientProjects').value = '0';
  document.getElementById('newClientFiles').value = '0';
  document.getElementById('newClientInvoices').value = '0';
  document.getElementById('newClientLastUpdate').value = '';
  document.getElementById('newClientNotes').value = '';
};

window.submitNewClient = async function() {
  const name = document.getElementById('newClientName').value.trim();
  const email = document.getElementById('newClientEmail').value.trim();
  
  // Validate required fields
  if (!name || !email) {
    showToast('Validation error', 'error', 'Please fill in name and email');
    return;
  }
  
  // Validate email format
  if (!email.includes('@')) {
    showToast('Validation error', 'error', 'Please enter a valid email address');
    return;
  }
  
  const submitBtn = document.getElementById('submitNewClientBtn');
  const submitBtnText = document.getElementById('submitNewClientBtnText');
  
  try {
    submitBtn.disabled = true;
    submitBtnText.textContent = 'Creating...';
    
    // Get KPI values
    const kpis = {
      activeProjects: parseInt(document.getElementById('newClientProjects').value) || 0,
      files: parseInt(document.getElementById('newClientFiles').value) || 0,
      openInvoices: parseInt(document.getElementById('newClientInvoices').value) || 0,
      lastUpdate: document.getElementById('newClientLastUpdate').value || new Date().toLocaleDateString()
    };
    
    // Get auth token
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });
    
    // Call create function
    const res = await fetch('/.netlify/functions/create-client', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({
        name,
        email,
        kpis
      })
    });
    
    if (!res.ok) {
      const error = await res.json().catch(() => ({ error: 'Unknown error' }));
      throw new Error(error.error || `Failed to create client: ${res.status}`);
    }
    
    const result = await res.json();
    console.log('Create result:', result);
    
    // Close modal
    document.getElementById('newClientModal').classList.add('hidden');
    
    // Refresh clients list
    const data = await fetchAllClients();
    const clients = data.clients || [];
    allClientsGlobal = clients;
    
    // Update KPIs (will automatically show incremented total clients)
    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAllActivity(clients);
    
    // Show toast notification
    if (result.invitationSent) {
      showToast('New client added', 'success', 'Client created and invitation email sent!');
    } else if (result.invitationError) {
      showToast('New client added', 'success', 'Client created (invitation not sent)');
    } else {
      showToast('New client added', 'success', 'Client created successfully!');
    }
    
  } catch (error) {
    console.error('Error creating client:', error);
    showToast('Failed to create client', 'error', error.message);
  } finally {
    submitBtn.disabled = false;
    submitBtnText.textContent = 'Create Client';
  }
};

/* ---------------------------
   6) Init
---------------------------- */
(async function init() {
  const overlay = document.getElementById("loadingOverlay");
  try {
    const data = await fetchAllClients();
    const clients = data.clients || [];
    
    // Store clients globally for modal access
    allClientsGlobal = clients;

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

