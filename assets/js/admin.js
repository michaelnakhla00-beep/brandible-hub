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
let allBookingsGlobal = [];

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
          <div class="flex items-center gap-2 justify-end">
            <button onclick="viewClient('${client.email}')" class="btn-primary text-sm">
              View
            </button>
            <button onclick="confirmDeleteClient('${client.email}', '${client.name || 'this client'}')" 
                    class="inline-flex items-center justify-center rounded-xl px-3 py-2 text-sm bg-red-500/10 text-red-600 hover:bg-red-500/20 dark:bg-red-900/20 dark:text-red-400 dark:hover:bg-red-900/40 transition-all">
              <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
              </svg>
            </button>
          </div>
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

  // Bookings search
  const bookingsSearch = document.getElementById("bookingsSearch");
  if (bookingsSearch) {
    bookingsSearch.addEventListener("input", () => {
      const term = bookingsSearch.value.trim();
      const sortDropdown = document.getElementById('sortLeadsDropdown');
      const sortOrder = sortDropdown ? sortDropdown.value : 'newest';
      renderBookingsTable(allBookingsGlobal, term, sortOrder);
    });
  }
  
  // Leads sort dropdown
  const sortLeadsDropdown = document.getElementById("sortLeadsDropdown");
  if (sortLeadsDropdown) {
    sortLeadsDropdown.addEventListener("change", () => {
      const term = bookingsSearch ? bookingsSearch.value.trim() : '';
      const sortOrder = sortLeadsDropdown.value;
      renderBookingsTable(allBookingsGlobal, term, sortOrder);
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

// Admin Supabase Storage
let adminSupabaseClient = null;

async function initAdminSupabase() {
  if (!window.supabase) {
    console.error('Supabase client not loaded');
    return false;
  }
  
  try {
    const res = await fetch('/.netlify/functions/get-storage-config');
    const config = await res.json();
    
    if (config.url && config.anonKey) {
      adminSupabaseClient = window.supabase.createClient(config.url, config.anonKey);
      console.log('✓ Admin Supabase Storage initialized');
      return true;
    }
  } catch (err) {
    console.warn('Failed to initialize Admin Supabase Storage:', err);
    return false;
  }
  
  return false;
}

// Sanitize email for use in file paths
function sanitizeEmailForAdmin(email) {
  if (!email) return '';
  return email.replace(/[^a-zA-Z0-9]/g, '_');
}

// Fetch files from Supabase Storage for a client
async function fetchSupabaseFilesForClient(clientEmail) {
  if (!adminSupabaseClient) {
    console.log('Supabase not initialized, returning empty files array');
    return [];
  }
  
  try {
    const safeEmail = sanitizeEmailForAdmin(clientEmail);
    const { data, error } = await adminSupabaseClient.storage
      .from('client_files')
      .list(safeEmail || '');
    
    if (error) {
      console.error('Error fetching files for admin:', error);
      return [];
    }
    
    return data.map(file => ({
      name: file.name,
      size: file.metadata?.size || 0,
      updated: new Date(file.updated_at).toLocaleDateString()
    }));
  } catch (err) {
    console.error('Error fetching Supabase files for admin:', err);
    return [];
  }
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Get file type icon based on file extension
function getFileTypeIcon(filename) {
  const ext = filename.split('.').pop()?.toLowerCase() || '';
  const iconClass = "w-6 h-6";
  
  switch(ext) {
    case 'pdf':
      return `<svg class="${iconClass} text-red-600" fill="currentColor" viewBox="0 0 24 24">
        <path d="M14 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V8l-6-6z"/><path d="M14 2v6h6"/><path d="M16 13H8v-2h8v2zm0 3H8v-2h8v2z"/>
      </svg>`;
    case 'jpg':
    case 'jpeg':
    case 'png':
    case 'gif':
    case 'webp':
      return `<svg class="${iconClass} text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16l4.586-4.586a2 2 0 012.828 0L16 16m-2-2l1.586-1.586a2 2 0 012.828 0L20 14m-6-6h.01M6 20h12a2 2 0 002-2V6a2 2 0 00-2-2H6a2 2 0 00-2 2v12a2 2 0 002 2z"/>
      </svg>`;
    case 'docx':
    case 'doc':
      return `<svg class="${iconClass} text-blue-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>`;
    case 'zip':
    case 'rar':
      return `<svg class="${iconClass} text-orange-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M5 8h14M5 8a2 2 0 110-4h14a2 2 0 110 4M5 8v10a2 2 0 002 2h10a2 2 0 002-2V8m-9 4h4"/>
      </svg>`;
    default:
      return `<svg class="${iconClass} text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
        <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"/>
      </svg>`;
  }
}

async function renderModalFiles(client) {
  const container = document.getElementById("modalFiles");
  const downloadAllBtn = document.getElementById("downloadAllBtn");
  const filesLastUpdated = document.getElementById("filesLastUpdated");
  if (!container) return;
  
  // Try to fetch from Supabase Storage first
  let supabaseFiles = [];
  if (adminSupabaseClient && client.email) {
    supabaseFiles = await fetchSupabaseFilesForClient(client.email);
  }
  
  // If we have Supabase files, display them
  if (supabaseFiles.length > 0) {
    // Show download all button
    if (downloadAllBtn) downloadAllBtn.classList.remove('hidden');
    
    // Calculate most recent upload time
    const latestDate = supabaseFiles.reduce((latest, file) => {
      const fileDate = new Date(file.updated_at);
      if (!latest || fileDate > latest) return fileDate;
      return latest;
    }, null);
    
    // Show last updated timestamp
    if (filesLastUpdated) {
      filesLastUpdated.classList.remove('hidden');
      filesLastUpdated.textContent = latestDate 
        ? `Last updated: ${latestDate.toLocaleString()}`
        : 'Last updated: Recently';
    }
    
    container.innerHTML = supabaseFiles.map(f => `
      <li class="group flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 transition-all">
        <div class="flex items-center gap-3 flex-1 min-w-0">
          <div class="flex-shrink-0">
            ${getFileTypeIcon(f.name)}
          </div>
          <div class="min-w-0 flex-1">
            <p class="text-sm font-medium text-slate-900 dark:text-slate-100 truncate">${f.name}</p>
            <div class="flex items-center gap-2 mt-0.5">
              <p class="text-xs text-slate-500 dark:text-slate-400">${f.updated || 'Recently'}</p>
              ${f.size ? `<span class="text-xs text-slate-400 dark:text-slate-500">• ${formatFileSize(f.size)}</span>` : ''}
            </div>
          </div>
        </div>
        <div class="flex items-center gap-2">
          <button onclick="downloadAdminFile('${client.email}', '${f.name}')" class="btn-ghost text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Download">
            <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
              <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
            </svg>
          </button>
        </div>
      </li>
    `).join("");
    return;
  }
  
  // Hide download all button if no files
  if (downloadAllBtn) downloadAllBtn.classList.add('hidden');
  if (filesLastUpdated) filesLastUpdated.classList.add('hidden');
  
  // Fallback to old files array if no Supabase files
  if (!client.files || !client.files.length) {
    container.innerHTML = '<p class="text-slate-500 dark:text-slate-400 p-3">No files uploaded yet</p>';
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

// Admin file download function
window.downloadAdminFile = async function(clientEmail, filename) {
  try {
    if (!adminSupabaseClient) {
      throw new Error('Supabase not initialized');
    }
    
    const safeEmail = sanitizeEmailForAdmin(clientEmail);
    const fullPath = `${safeEmail}/${filename}`;
    
    const { data } = await adminSupabaseClient.storage
      .from('client_files')
      .getPublicUrl(fullPath);
    
    window.open(data.publicUrl, '_blank');
  } catch (err) {
    console.error('Error downloading file:', err);
    alert('Failed to download file');
  }
};

// Download all files as ZIP for the current client
window.downloadAllFilesForCurrentClient = async function() {
  if (!currentClientEmail || !adminSupabaseClient) {
    showToast('Error', 'error', 'No client selected or Supabase not initialized');
    return;
  }
  
  const downloadBtn = document.getElementById('downloadAllBtn');
  if (downloadBtn) downloadBtn.disabled = true;
  
  try {
    // Fetch all files for the current client
    const files = await fetchSupabaseFilesForClient(currentClientEmail);
    
    if (!files || files.length === 0) {
      showToast('No files', 'info', 'No files available to download');
      return;
    }
    
    showToast('Preparing download...', 'info', `Downloading ${files.length} files...`);
    
    // Create JSZip instance
    const zip = new JSZip();
    const safeEmail = sanitizeEmailForAdmin(currentClientEmail);
    
    // Download and add each file to the ZIP
    for (const file of files) {
      try {
        const { data, error } = await adminSupabaseClient.storage
          .from('client_files')
          .download(`${safeEmail}/${file.name}`);
        
        if (error) {
          console.error(`Error downloading ${file.name}:`, error);
          continue;
        }
        
        // Convert blob to array buffer and add to ZIP
        const blob = data;
        zip.file(file.name, blob);
      } catch (err) {
        console.error(`Error processing ${file.name}:`, err);
      }
    }
    
    // Generate the ZIP file
    const zipBlob = await zip.generateAsync({ type: 'blob' });
    
    // Trigger download
    const clientName = (currentClientEmail.split('@')[0] || 'client').replace(/[^a-zA-Z0-9]/g, '_');
    const filename = `${clientName}_files_${Date.now()}.zip`;
    saveAs(zipBlob, filename);
    
    showToast('Download complete', 'success', `Downloaded ${files.length} files`);
  } catch (err) {
    console.error('Error creating ZIP:', err);
    showToast('Download failed', 'error', 'Failed to download files');
  } finally {
    if (downloadBtn) downloadBtn.disabled = false;
  }
};

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

// Fetch and render client activity from Supabase
async function fetchClientActivity(clientEmail) {
  if (!adminSupabaseClient) {
    console.warn('Supabase not initialized');
    return [];
  }
  
  console.log('🔍 Fetching client activity for:', clientEmail);
  
  try {
    const { data, error } = await adminSupabaseClient
      .from('client_activity')
      .select('*')
      .eq('client_email', clientEmail)
      .order('timestamp', { ascending: false })
      .limit(10);
    
    if (error) {
      console.error('❌ Error fetching client activity:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
      return [];
    }
    
    console.log('✅ Fetched client activity:', data?.length || 0, 'records');
    console.log('Activity data:', data);
    
    return data || [];
  } catch (err) {
    console.error('❌ Failed to fetch client activity:', err);
    return [];
  }
}

function renderClientActivity(activities, clientEmail, clientName) {
  const container = document.getElementById("modalClientActivity");
  if (!container) return;
  
  if (!activities || activities.length === 0) {
    container.innerHTML = '<p class="text-slate-500 dark:text-slate-400">No client activity recorded</p>';
    return;
  }
  
  const getTypeBadgeClass = (type) => {
    switch(type) {
      case 'upload':
        return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
      case 'invoice':
        return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
      case 'project':
        return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
      default:
        return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    }
  };
  
  const getTimeAgo = (timestamp) => {
    const now = new Date();
    const time = new Date(timestamp);
    const diffMs = now - time;
    const diffMins = Math.floor(diffMs / 60000);
    const diffHours = Math.floor(diffMins / 60);
    const diffDays = Math.floor(diffHours / 24);
    
    if (diffMins < 1) return 'Just now';
    if (diffMins < 60) return `${diffMins} minute${diffMins > 1 ? 's' : ''} ago`;
    if (diffHours < 24) return `${diffHours} hour${diffHours > 1 ? 's' : ''} ago`;
    if (diffDays < 7) return `${diffDays} day${diffDays > 1 ? 's' : ''} ago`;
    return time.toLocaleDateString();
  };
  
  container.innerHTML = activities.map(activity => `
    <li class="flex items-start gap-3 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 transition-all">
      <div class="flex-1 min-w-0">
        <div class="flex items-center gap-2 mb-1">
          <span class="text-sm font-medium text-slate-900 dark:text-slate-100">${clientName || activity.client_email}</span>
          <span class="px-2 py-0.5 text-xs font-medium rounded-full ${getTypeBadgeClass(activity.type)}">
            ${activity.type}
          </span>
        </div>
        <p class="text-sm text-slate-600 dark:text-slate-300">${activity.activity}</p>
        <p class="text-xs text-slate-500 dark:text-slate-400 mt-1">${getTimeAgo(activity.timestamp)}</p>
      </div>
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
  fetchClientFullData(email).then(async fullClient => {
    // Store original data
    originalClientData = { ...fullClient };
    
    renderModalKPIs(fullClient);
    renderModalProjects(fullClient);
    renderModalFiles(fullClient);
    renderModalInvoices(fullClient);
    renderModalActivity(fullClient);
    renderModalUpdates(fullClient);
    
    // Fetch and render client activity from Supabase
    const activities = await fetchClientActivity(email);
    renderClientActivity(activities, email, fullClient.name || client.name);
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
  
  // Handle date format conversion for date picker (expects YYYY-MM-DD)
  const lastUpdate = client.kpis.lastUpdate || "";
  if (lastUpdate) {
    try {
      // If it's already in YYYY-MM-DD format, use it directly
      if (lastUpdate.match(/^\d{4}-\d{2}-\d{2}$/)) {
        document.getElementById("editKPILastUpdate").value = lastUpdate;
      } else {
        // Try to parse and convert to YYYY-MM-DD
        const date = new Date(lastUpdate);
        if (!isNaN(date.getTime())) {
          const year = date.getFullYear();
          const month = String(date.getMonth() + 1).padStart(2, '0');
          const day = String(date.getDate()).padStart(2, '0');
          document.getElementById("editKPILastUpdate").value = `${year}-${month}-${day}`;
        }
      }
    } catch (err) {
      console.error('Error parsing date:', err);
      document.getElementById("editKPILastUpdate").value = "";
    }
  } else {
    document.getElementById("editKPILastUpdate").value = "";
  }
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
    
    // Get current user and token
    const user = window.netlifyIdentity?.currentUser();
    if (!user) {
      throw new Error('Not authenticated');
    }
    
    const token = user?.token?.access_token;
    if (!token) {
      throw new Error('No access token available');
    }
    
    const res = await fetch("/.netlify/functions/update-client", {
      method: "POST",
      headers: {
        "Content-Type": "application/json",
        "Authorization": `Bearer ${token}`
      },
      body: JSON.stringify({
        email: currentClientEmail,
        kpis: updatedKPIs,
        activity: originalClientData.activity || []
      }),
    });
    
    let result;
    try {
      result = await res.json();
      console.log("Save result:", result);
    } catch (jsonError) {
      console.error("Failed to parse response:", jsonError);
      throw new Error(`Server error (${res.status}): Invalid response`);
    }
    
    if (!res.ok) {
      // Extract detailed error information
      const errorDetails = result.details || result.hint || result.error || `Failed to save: ${res.status}`;
      const errorCode = result.code ? ` (${result.code})` : '';
      throw new Error(`${errorDetails}${errorCode}`);
    }
    
    if (!result.success) {
      const errorDetails = result.details || result.error || result.message || 'Failed to save changes';
      const errorCode = result.code ? ` (${result.code})` : '';
      throw new Error(`${errorDetails}${errorCode}`);
    }
    
    // Update the display
    renderModalKPIs(originalClientData);
    
    showToast("Changes saved", "success", "Client updated successfully!");
    cancelEditMode();
    
    // Refresh the clients list
    const data = await fetchAllClients();
    const clients = data.clients || [];
    allClientsGlobal = clients;
    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAnalytics(clients);
    
  } catch (error) {
    console.error("Error saving:", error);
    const errorMessage = error.message || 'Failed to save changes';
    showToast("Failed to save", "error", errorMessage);
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
    renderAnalytics(clients);
    
    // Show toast notification
    if (result.invitationSent) {
      showToast('New client added', 'success', 'Client created and invitation email sent!');
    } else if (result.inviteStatus === 'failed') {
      showToast('New client added', 'success', 'Client created! (Please invite them manually from Netlify)');
    } else if (result.inviteStatus === 'not_configured') {
      showToast('New client added', 'success', 'Client created! (Add NETLIFY_IDENTITY_ADMIN_TOKEN to enable auto-invites)');
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
   5.5) Delete Client
---------------------------- */
let clientToDelete = { email: null, name: null };

function confirmDeleteClient(email, name) {
  clientToDelete = { email, name };
  document.getElementById('deleteClientName').textContent = name;
  document.getElementById('deleteConfirmModal').classList.remove('hidden');
}

function closeDeleteModal() {
  document.getElementById('deleteConfirmModal').classList.add('hidden');
  clientToDelete = { email: null, name: null };
}

function closeDeleteModalOnBackdrop(event) {
  if (event.target === event.currentTarget) {
    closeDeleteModal();
  }
}

async function deleteClientConfirmed() {
  if (!clientToDelete.email) return;
  
  const btn = document.getElementById('confirmDeleteBtn');
  const btnText = document.getElementById('confirmDeleteBtnText');
  
  btn.disabled = true;
  btnText.textContent = 'Deleting...';
  
  try {
    const user = window.netlifyIdentity?.currentUser();
    const token = user?.token?.access_token;
    
    if (!token) {
      throw new Error('Not authenticated');
    }
    
    const res = await fetch('/.netlify/functions/delete-client', {
      method: 'POST',
      headers: { 
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ 
        email: clientToDelete.email 
      })
    });
    
    const result = await res.json();
    
    if (!res.ok) {
      closeDeleteModal();
      throw new Error(result.error || 'Failed to delete client');
    }
    
    // Close modal
    closeDeleteModal();
    
    // Show appropriate toast with specific message
    if (result.success) {
      if (result.identityDeleted === true) {
        showToast('Client removed', 'success', result.message || 'Client successfully removed from database and Identity.');
      } else if (result.identityDeleted === false) {
        showToast('Client removed', 'success', result.message || 'Client record deleted, but Netlify user not found.');
      } else {
        showToast('Client removed', 'success', result.message || 'Client successfully deleted.');
      }
    } else {
      showToast('Failed to remove client', 'error', result.error || result.message || 'Unknown error occurred');
      return;
    }
    
    // Refresh clients list
    const data = await fetchAllClients();
    const clients = data.clients || [];
    allClientsGlobal = clients;
    
    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAllActivity(clients);
    renderAnalytics(clients);
    
  } catch (error) {
    console.error('Error deleting client:', error);
    showToast('Failed to remove client', 'error', error.message);
  } finally {
    btn.disabled = false;
    btnText.textContent = 'Confirm Delete';
  }
}

// Make functions globally available
window.confirmDeleteClient = confirmDeleteClient;
window.closeDeleteModal = closeDeleteModal;
window.closeDeleteModalOnBackdrop = closeDeleteModalOnBackdrop;
window.deleteClientConfirmed = deleteClientConfirmed;

// Debug function to manually test table rendering
window.testRenderBookings = function() {
  const testData = [
    {id: 1, name: "Michael Nakhla", email: "michaelnakhla0@gmail.com", phone: "2016473706", service: "SEO", message: "Test Test.", date: "2025-10-29", time: "11:30 AM"},
    {id: 2, name: "Michael Nakhla", email: "michaelnakhla0@gmail.com", phone: "2016473706", service: "SEO", message: "TEST TEST", date: "2025-10-30", time: "11:30 AM"}
  ];
  console.log('🧪 Testing render with', testData);
  renderBookingsTable(testData, '');
};

/* ---------------------------
   5.6) Analytics
---------------------------- */
let doughnutChartInstance = null;
let barChartInstance = null;

function calculateAnalytics(clients = []) {
  const analytics = {
    totalClients: clients.length,
    activeProjects: 0,
    openInvoices: 0,
    filesShared: 0,
    projectsData: [],
    invoicesData: []
  };

  clients.forEach(client => {
    analytics.activeProjects += client.kpis?.activeProjects || 0;
    analytics.openInvoices += client.kpis?.openInvoices || 0;
    analytics.filesShared += client.kpis?.files || 0;
    
    if (client.kpis?.activeProjects > 0) {
      analytics.projectsData.push({
        name: client.name,
        projects: client.kpis.activeProjects
      });
    }
    
    if (client.kpis?.openInvoices > 0) {
      analytics.invoicesData.push({
        name: client.name,
        invoices: client.kpis.openInvoices
      });
    }
  });

  return analytics;
}

function renderAnalytics(clients = []) {
  const analytics = calculateAnalytics(clients);
  
  // Hide analytics section if no data
  const analyticsSection = document.getElementById('analyticsSection');
  if (analytics.totalClients === 0) {
    if (analyticsSection) analyticsSection.style.display = 'none';
    return;
  }
  if (analyticsSection) analyticsSection.style.display = 'block';

  // Destroy existing charts if they exist
  if (doughnutChartInstance) {
    doughnutChartInstance.destroy();
  }
  if (barChartInstance) {
    barChartInstance.destroy();
  }

  // Create doughnut chart
  const doughnutCtx = document.getElementById('doughnutChart');
  if (doughnutCtx) {
    const isDark = document.documentElement.classList.contains('dark');
    doughnutChartInstance = new Chart(doughnutCtx, {
      type: 'doughnut',
      data: {
        labels: ['Active Projects', 'Open Invoices'],
        datasets: [{
          data: [analytics.activeProjects, analytics.openInvoices],
          backgroundColor: [
            'rgba(99, 102, 241, 0.8)', // indigo
            'rgba(139, 92, 246, 0.8)'  // purple
          ],
          borderColor: [
            'rgba(99, 102, 241, 1)',
            'rgba(139, 92, 246, 1)'
          ],
          borderWidth: 2
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        plugins: {
          legend: {
            position: 'bottom',
            labels: {
              color: isDark ? '#e2e8f0' : '#475569',
              padding: 15,
              font: {
                family: "'Inter', sans-serif",
                size: 12
              }
            }
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            padding: 12,
            titleColor: isDark ? '#e2e8f0' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            borderWidth: 1
          }
        }
      }
    });
  }

  // Sort and get top clients for bar chart
  const topClients = analytics.projectsData
    .sort((a, b) => b.projects - a.projects)
    .slice(0, 8);

  // Create bar chart
  const barCtx = document.getElementById('barChart');
  if (barCtx) {
    const isDark = document.documentElement.classList.contains('dark');
    barChartInstance = new Chart(barCtx, {
      type: 'bar',
      data: {
        labels: topClients.map(c => c.name || 'Unknown'),
        datasets: [{
          label: 'Active Projects',
          data: topClients.map(c => c.projects),
          backgroundColor: 'rgba(99, 102, 241, 0.7)',
          borderColor: 'rgba(99, 102, 241, 1)',
          borderWidth: 2,
          borderRadius: 8
        }]
      },
      options: {
        responsive: true,
        maintainAspectRatio: true,
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: {
                family: "'Inter', sans-serif",
                size: 11
              }
            },
            grid: {
              color: isDark ? 'rgba(148, 163, 184, 0.1)' : 'rgba(100, 116, 139, 0.1)'
            }
          },
          x: {
            ticks: {
              color: isDark ? '#94a3b8' : '#64748b',
              font: {
                family: "'Inter', sans-serif",
                size: 11
              },
              maxRotation: 45,
              minRotation: 0
            },
            grid: {
              display: false
            }
          }
        },
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            backgroundColor: isDark ? 'rgba(15, 23, 42, 0.9)' : 'rgba(255, 255, 255, 0.95)',
            padding: 12,
            titleColor: isDark ? '#e2e8f0' : '#1e293b',
            bodyColor: isDark ? '#cbd5e1' : '#475569',
            borderColor: 'rgba(139, 92, 246, 0.3)',
            borderWidth: 1
          }
        }
      }
    });
  }
}

/* ---------------------------
   6) Init
---------------------------- */
(async function init() {
  const overlay = document.getElementById("loadingOverlay");
  try {
    // Initialize Supabase Storage for admin
    await initAdminSupabase();
    
    const data = await fetchAllClients();
    const clients = data.clients || [];
    
    // Store clients globally for modal access
    allClientsGlobal = clients;

    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAllActivity(clients);
    renderAnalytics(clients);
    wireSearch(clients);

    // Wire bookings refresh
    const refreshBtn = document.getElementById('refreshBookingsBtn');
    if (refreshBtn) {
      refreshBtn.addEventListener('click', async () => {
        await refreshBookings();
        showToast('Bookings refreshed', 'success');
      });
    }
  } catch (e) {
    console.error(e);
    alert("Failed to load admin dashboard. If this persists, contact support.");
  } finally {
    if (overlay) overlay.style.display = "none";
  }
})();

/* ---------------------------
   9) Bookings (Leads) Tab
---------------------------- */

async function fetchBookings() {
  console.log('🔍 fetchBookings called');
  try {
    // Get JWT token for authenticated request
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });

    console.log('📋 Fetching leads from Netlify function...');
    const res = await fetch("/.netlify/functions/get-leads", {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });

    if (!res.ok) {
      const text = await res.text().catch(() => "");
      console.error('❌ Function error:', res.status, text);
      throw new Error(`Function error ${res.status}: ${text}`);
    }
    
    const result = await res.json();
    const leads = result.leads || [];
    
    console.log('✅ Fetched leads:', leads.length, 'records');
    console.log('Lead data:', leads);
    return leads;
  } catch (err) {
    console.error('❌ Failed to fetch leads:', err);
    return [];
  }
}

function getStatusColor(status) {
  switch(status) {
    case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300';
    case 'Contacted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300';
    case 'In Progress': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300';
    case 'Closed': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300';
  }
}

function renderBookingsTable(leads = [], searchTerm = '', sortOrder = 'newest') {
  console.log('🎨 renderBookingsTable called with', leads.length, 'leads, searchTerm:', searchTerm);
  const tbody = document.getElementById('bookingsTable');
  const empty = document.getElementById('bookingsEmpty');
  
  if (!tbody) {
    console.error('❌ bookingsTable element not found!');
    return;
  }

  // Filter leads
  let filtered = leads;
  if (searchTerm.trim()) {
    const t = searchTerm.toLowerCase();
    filtered = leads.filter(l =>
      (l.name || '').toLowerCase().includes(t) ||
      (l.email || '').toLowerCase().includes(t) ||
      (l.service || '').toLowerCase().includes(t)
    );
  }

  // Sort leads
  if (sortOrder === 'newest') {
    filtered.sort((a, b) => new Date(b.created_at || 0) - new Date(a.created_at || 0));
  } else {
    filtered.sort((a, b) => new Date(a.created_at || 0) - new Date(b.created_at || 0));
  }

  if (!filtered.length) {
    console.log('⚠️ No filtered results, showing empty state');
    tbody.innerHTML = '';
    if (empty) empty.classList.remove('hidden');
    return;
  }
  
  console.log('✅ Rendering', filtered.length, 'filtered leads');
  if (empty) empty.classList.add('hidden');

  const safe = (v) => (v == null ? '' : v);
  
  const html = filtered.map((lead, idx) => `
    <tr class="cursor-pointer transition-all ${idx % 2 === 0 ? 'bg-gray-50/40 dark:bg-slate-800/20' : ''} hover:bg-white/70 dark:hover:bg-slate-800/40" onclick='openLeadDetailsModal(${JSON.stringify(lead).replace(/'/g, "&#39;")})'>
      <td class="py-3 px-4 font-medium">${safe(lead.name)}</td>
      <td class="py-3 px-4 text-slate-600 dark:text-slate-300">
        <a href="mailto:${safe(lead.email)}?subject=Follow-up from Brandible Marketing Group" class="flex items-center gap-1 hover:text-purple-600 dark:hover:text-purple-400" onclick="event.stopPropagation()">
          ${safe(lead.email)}
          <svg class="w-4 h-4 inline" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M3 8l7.89 5.26a2 2 0 002.22 0L21 8M5 19h14a2 2 0 002-2V7a2 2 0 00-2-2H5a2 2 0 00-2 2v10a2 2 0 002 2z"></path>
          </svg>
        </a>
      </td>
      <td class="py-3 px-4">${safe(lead.phone)}</td>
      <td class="py-3 px-4">${safe(lead.service)}</td>
      <td class="py-3 px-4 max-w-[320px] truncate" title="${safe(lead.message)}">${safe(lead.message)}</td>
      <td class="py-3 px-4 text-sm text-slate-500">${lead.created_at ? new Date(lead.created_at).toLocaleString() : (lead.date || '') + ' ' + (lead.time || '')}</td>
      <td class="py-3 px-4" onclick="event.stopPropagation()">
        <select onchange="updateLeadStatus(${lead.id}, this.value)" class="px-2 py-1 rounded-lg text-xs border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 ${getStatusColor(lead.status || 'New')}">
          <option value="New" ${lead.status === 'New' ? 'selected' : ''}>New</option>
          <option value="Contacted" ${lead.status === 'Contacted' ? 'selected' : ''}>Contacted</option>
          <option value="In Progress" ${lead.status === 'In Progress' ? 'selected' : ''}>In Progress</option>
          <option value="Closed" ${lead.status === 'Closed' ? 'selected' : ''}>Closed</option>
        </select>
      </td>
    </tr>
  `).join('');
  
  tbody.innerHTML = html;
}

async function updateLeadStatus(leadId, newStatus) {
  try {
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });

    const res = await fetch('/.netlify/functions/update-lead-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ leadId, status: newStatus })
    });

    if (res.ok) {
      showToast('Status updated', 'success');
      // Update local data
      const lead = allBookingsGlobal.find(l => l.id === leadId);
      if (lead) lead.status = newStatus;
    } else {
      showToast('Failed to update status', 'error');
    }
  } catch (err) {
    console.error('Error updating status:', err);
    showToast('Failed to update status', 'error');
  }
}

window.exportLeadsToCSV = function() {
  const leads = allBookingsGlobal;
  if (!leads || leads.length === 0) {
    showToast('No leads to export', 'error');
    return;
  }

  // CSV headers
  const headers = ['Name', 'Email', 'Phone', 'Service', 'Message', 'Date', 'Status'];
  
  // CSV rows
  const rows = leads.map(lead => [
    lead.name || '',
    lead.email || '',
    lead.phone || '',
    lead.service || '',
    (lead.message || '').replace(/"/g, '""'),
    lead.created_at ? new Date(lead.created_at).toLocaleString() : '',
    lead.status || 'New'
  ]);
  
  // Build CSV content
  const csvContent = [
    headers.join(','),
    ...rows.map(row => row.map(cell => `"${cell}"`).join(','))
  ].join('\n');
  
  // Download
  const blob = new Blob([csvContent], { type: 'text/csv' });
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = 'brandible-leads.csv';
  a.click();
  URL.revokeObjectURL(url);
  
  showToast('CSV exported successfully', 'success');
}

window.updateLeadStatus = updateLeadStatus;

async function refreshBookings() {
  console.log('🔄 refreshBookings called');
  const data = await fetchBookings();
  console.log('📦 Received data:', data);
  allBookingsGlobal = data;
  const search = document.getElementById('bookingsSearch');
  const sortDropdown = document.getElementById('sortLeadsDropdown');
  const term = search ? search.value.trim() : '';
  const sortOrder = sortDropdown ? sortDropdown.value : 'newest';
  console.log('🎨 Rendering table with', data.length, 'leads');
  renderBookingsTable(allBookingsGlobal, term, sortOrder);
}

// Simple section router for tabs
window.showAdminSection = function(section) {
  const sections = {
    overview: document.getElementById('overviewSection'),
    analytics: document.getElementById('analyticsSection'),
    clients: document.getElementById('clientsSection'),
    bookings: document.getElementById('bookingsSection'),
  };

  Object.values(sections).forEach(el => el && el.classList.add('hidden'));
  if (sections[section]) sections[section].classList.remove('hidden');

  // active tab styles
  const tabs = {
    overview: document.getElementById('tabOverview'),
    analytics: document.getElementById('tabAnalytics'),
    clients: document.getElementById('tabClients'),
    bookings: document.getElementById('tabBookings'),
  };
  Object.values(tabs).forEach(btn => btn && btn.classList.remove('sidebar-link-active'));
  if (tabs[section]) tabs[section].classList.add('sidebar-link-active');

  // lazy load bookings when first opened
  if (section === 'bookings') {
    console.log('📖 Bookings section opened, loading data...');
    console.log('📖 All bookings global:', allBookingsGlobal);
    console.log('📖 Calling refreshBookings now...');
    refreshBookings().catch(err => {
      console.error('❌ Error loading bookings:', err);
      const tbody = document.getElementById('bookingsTable');
      const empty = document.getElementById('bookingsEmpty');
      if (tbody) tbody.innerHTML = '';
      if (empty) empty.classList.remove('hidden');
    });
  }
}

