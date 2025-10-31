// assets/js/admin.js
import { renderKPICards } from './components/kpiCard.js';
import { renderChartSection } from './components/chartSection.js';
import { renderClientCards } from './components/clientCard.js';
import { renderLeads } from './components/leadsCard.js';
import { renderActivityFeed } from './components/activityFeed.js';
import { fetchClients as fetchClientsFn, fetchLeads as fetchLeadsFn, fetchProjects as fetchProjectsFn, computeKPIs, buildRevenueDataset, buildLeadSourceDataset, parseJSON } from './components/data.js';

const INVOICE_CURRENCY_STORAGE_KEY = 'brandible:lastInvoiceCurrency';

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
let currentClientId = null;
let editMode = false;
let originalClientData = null;
let allBookingsGlobal = [];
let activeClientInvoices = [];
let activeInvoiceClient = null;
let invoiceFormState = null;
const INVOICE_CURRENCY_KEY = 'brandible.invoiceCurrency';
const INVOICE_PDF_ENDPOINT = '/.netlify/functions/generate-invoice-pdf';

/* ---------------------------
   2) Render helpers
---------------------------- */

function renderAdminKPIs(clients = []) {
  const container = document.getElementById("adminKPIs");
  
  const totalProjects = clients.reduce((sum, c) => sum + (c.kpis?.activeProjects || 0), 0);
  const totalInvoices = clients.reduce((sum, c) => sum + (c.kpis?.openInvoices || 0), 0);
  const totalClients = clients.length;
  const totalFiles = clients.reduce((sum, c) => sum + (c.files?.length || 0), 0);
  
  // Get new leads count
  const newLeadsCount = allBookingsGlobal.filter(l => !l.status || l.status === 'New').length;

  // Update Quick Stats cards
  const statTotalClients = document.getElementById('statTotalClients');
  const statNewLeads = document.getElementById('statNewLeads');
  const statActiveProjects = document.getElementById('statActiveProjects');
  const statOpenInvoices = document.getElementById('statOpenInvoices');
  
  if (statTotalClients) statTotalClients.textContent = totalClients;
  if (statNewLeads) statNewLeads.textContent = newLeadsCount;
  if (statActiveProjects) statActiveProjects.textContent = totalProjects;
  if (statOpenInvoices) statOpenInvoices.textContent = totalInvoices;
  
  // Legacy KPI rendering for backward compatibility
  if (container) {
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
            <button onclick="openProfileEditor('${client.email}')" class="btn-ghost text-sm">Edit Profile</button>
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

function renderModalProfile(client) {
  // View mode fields
  const profileImg = document.getElementById("adminProfileImagePreview");
  const nameDisplay = document.getElementById("adminClientNameDisplay");
  const emailDisplay = document.getElementById("adminClientEmailDisplay");
  const companyDisplay = document.getElementById("adminClientCompanyDisplay");
  const managerDisplay = document.getElementById("adminClientManagerDisplay");
  const phoneDisplay = document.getElementById("adminClientPhoneDisplay");
  const websiteDisplay = document.getElementById("adminClientWebsiteDisplay");
  
  if (profileImg) {
    profileImg.src = client.profile_url || '/assets/default-avatar.png';
  }
  if (nameDisplay) nameDisplay.textContent = client.name || "Unknown";
  if (emailDisplay) emailDisplay.textContent = client.email || "";
  if (companyDisplay) companyDisplay.textContent = client.company ? `Company: ${client.company}` : "";
  if (managerDisplay) managerDisplay.textContent = client.manager ? `Manager: ${client.manager}` : "";
  if (phoneDisplay) phoneDisplay.textContent = client.phone ? `Phone: ${client.phone}` : "";
  if (websiteDisplay) {
    if (client.website) {
      websiteDisplay.innerHTML = `Website: <a href="${client.website}" target="_blank" class="text-indigo-600 dark:text-indigo-400 hover:underline">${client.website}</a>`;
    } else {
      websiteDisplay.textContent = "";
    }
  }
  
  // Edit mode fields (will be populated when edit mode is toggled)
  const nameInput = document.getElementById("adminClientName");
  const emailInput = document.getElementById("adminClientEmail");
  const companyInput = document.getElementById("adminClientCompany");
  const managerInput = document.getElementById("adminClientManager");
  const phoneInput = document.getElementById("adminClientPhone");
  const websiteInput = document.getElementById("adminClientWebsite");
  const profileImgEdit = document.getElementById("adminProfileImagePreviewEdit");
  
  if (nameInput) nameInput.value = client.name || "";
  if (emailInput) emailInput.value = client.email || "";
  if (companyInput) companyInput.value = client.company || "";
  if (managerInput) managerInput.value = client.manager || "";
  if (phoneInput) phoneInput.value = client.phone || "";
  if (websiteInput) websiteInput.value = client.website || "";
  if (profileImgEdit) {
    profileImgEdit.src = client.profile_url || '/assets/default-avatar.png';
  }
}

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

  // Wire project title clicks to open Project Workspace modal
  Array.from(container.querySelectorAll('.card .font-medium')).forEach((el, idx) => {
    el.style.cursor = 'pointer';
    el.title = 'Open project';
    el.addEventListener('click', () => window.openProjectModal && window.openProjectModal(client, idx));
  });
}

function renderEditableProjects(client) {
  const container = document.getElementById("modalProjects");
  if (!container) return;
  
  if (!client.projects || !client.projects.length) {
    container.innerHTML = '<p class="text-slate-500">No projects - click "Add Project" to create one</p>';
    return;
  }
  
  container.innerHTML = client.projects.map((p, idx) => {
    const projectId = p.id || `project-${idx}-${Date.now()}`;
    
    return `
      <div class="project-edit-card card p-4" data-project-id="${projectId}" data-supabase-id="${p.id || ''}">
        <div class="flex items-start justify-between mb-3">
          <input type="text" placeholder="Project Name" class="project-name-input font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-purple-500/50 rounded px-2 w-full" value="${p.name || ''}" />
        </div>
        <textarea placeholder="Description (optional)" class="project-desc-input w-full text-sm text-slate-600 dark:text-slate-300 bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500/50 resize-none" rows="2">${p.summary || p.description || ''}</textarea>
        <div class="flex items-center justify-between mt-3">
          <select class="project-status-select border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900">
            <option value="New" ${p.status === 'New' ? 'selected' : ''}>New</option>
            <option value="In Progress" ${p.status === 'In Progress' || !p.status ? 'selected' : ''}>In Progress</option>
            <option value="Review" ${p.status === 'Review' || p.status?.includes('review') ? 'selected' : ''}>Review</option>
            <option value="Complete" ${p.status === 'Complete' || p.status === 'Completed' || p.status === 'Done' ? 'selected' : ''}>Complete</option>
          </select>
          <button onclick="removeProjectCard('${projectId}')" class="btn-ghost text-sm text-red-500">Remove</button>
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
      // Create Supabase client with auth headers for database operations
      adminSupabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        auth: {
          persistSession: false,
          autoRefreshToken: false,
          detectSessionInUrl: false
        }
      });
      
      // Get JWT token and authenticate Supabase client
      try {
        const id = window.netlifyIdentity;
        const user = id && id.currentUser();
        if (user) {
          const token = await user.jwt();
          if (token) {
            console.log('✓ Got JWT token, authenticating Supabase client');
            // Set the session with the JWT token
            await adminSupabaseClient.auth.setSession({
              access_token: token,
              refresh_token: token,
              expires_in: 3600,
              user: {
                id: user.id,
                email: user.email
              }
            });
          }
        }
      } catch (err) {
        console.warn('Could not authenticate Supabase:', err);
      }
      
      console.log('✓ Admin Supabase initialized with auth');
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

// -------------------------
// Admin Profile Editor
// -------------------------
let profileEditorState = { client: null, uploadedUrl: null };

window.openProfileEditor = function(email) {
  // Find client from cached list
  const client = (window.allClients || []).find(c => (c.email || '').toLowerCase() === (email || '').toLowerCase());
  if (!client) return;
  profileEditorState.client = client;
  profileEditorState.uploadedUrl = null;
  // Populate fields
  const modal = document.getElementById('profileEditorModal');
  if (!modal) return;
  const img = document.getElementById('profilePreview');
  const name = document.getElementById('profileName');
  const company = document.getElementById('profileCompany');
  const manager = document.getElementById('profileManager');
  const emailEl = document.getElementById('profileEmail');
  const phone = document.getElementById('profilePhone');
  const website = document.getElementById('profileWebsite');
  img.src = client.profile_url || '/assets/default-avatar.png';
  name.value = client.name || '';
  company.value = client.company || '';
  manager.value = client.manager || '';
  emailEl.value = client.email || '';
  phone.value = client.phone || '';
  website.value = client.website || '';
  modal.classList.remove('hidden');
};

window.closeProfileEditor = function() {
  const modal = document.getElementById('profileEditorModal');
  if (modal) modal.classList.add('hidden');
};

window.closeProfileEditorOnBackdrop = function(e) {
  if (e.target === e.currentTarget) closeProfileEditor();
};

// Helper function to upload avatar via secure Netlify function
async function uploadAvatarViaFunction(file, clientId) {
  // Validate file type
  const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
  if (!allowedTypes.includes(file.type)) {
    throw new Error('Invalid file type. Only images are allowed.');
  }
  
  // Validate file size (5MB max)
  if (file.size > 5 * 1024 * 1024) {
    throw new Error('File too large. Maximum size is 5MB.');
  }
  
  // Convert file to base64
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onloadend = async () => {
      try {
        const base64Data = reader.result.split(',')[1]; // Remove data URL prefix
        
        // Get auth token
        const token = await new Promise((tokenResolve) => {
          const id = window.netlifyIdentity;
          const user = id && id.currentUser();
          if (!user) return tokenResolve(null);
          user.jwt().then(tokenResolve).catch(() => tokenResolve(null));
        });
        
        // Upload via secure Netlify function
        const res = await fetch('/.netlify/functions/upload-avatar', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            clientId: clientId,
            fileData: base64Data,
            fileName: file.name,
            fileType: file.type
          })
        });
        
        const result = await res.json();
        
        if (!res.ok) {
          throw new Error(result.error || 'Upload failed');
        }
        
        resolve(result.profile_url);
      } catch (err) {
        reject(err);
      }
    };
    reader.onerror = () => reject(new Error('Failed to read file'));
    reader.readAsDataURL(file);
  });
}

// Upload avatar and preview
(function wireProfileUpload(){
  document.addEventListener('change', async (e) => {
    // Handler for profile editor modal
    if (e.target && e.target.id === 'profileImageInput') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        const client = profileEditorState.client;
        if (!client || !client.id) throw new Error('No client data available');
        
        const publicUrl = await uploadAvatarViaFunction(file, client.id);
        profileEditorState.uploadedUrl = publicUrl;
        const img = document.getElementById('profilePreview');
        if (img) img.src = publicUrl;
        showToast('Profile image updated ✅');
      } catch (err) {
        console.error('Avatar upload failed:', err);
        showToast('Upload failed', 'error', err.message);
      }
    }
    // Handler for client modal avatar upload
    if (e.target && e.target.id === 'adminClientAvatarUpload') {
      const file = e.target.files && e.target.files[0];
      if (!file) return;
      try {
        if (!originalClientData || !originalClientData.id) {
          throw new Error('No client data available');
        }
        
        const publicUrl = await uploadAvatarViaFunction(file, originalClientData.id);
        
        // Update preview images
        const imgEdit = document.getElementById('adminProfileImagePreviewEdit');
        if (imgEdit) imgEdit.src = publicUrl;
        
        // Update original data
        if (originalClientData) {
          originalClientData.profile_url = publicUrl;
        }
        
        showToast('Profile image updated ✅');
      } catch (err) {
        console.error('Avatar upload failed:', err);
        showToast('Upload failed', 'error', err.message);
      }
    }
  });
})();

window.saveAdminProfileChanges = async function() {
  const btn = document.getElementById('profileSaveBtn');
  const btnText = document.getElementById('profileSaveBtnText');
  if (btn && btnText) { btn.disabled = true; btnText.textContent = 'Saving...'; }
  try {
    const client = profileEditorState.client;
    if (!client) return;
    const payload = {
      clientId: client.id,
      fields: {
        name: document.getElementById('profileName').value.trim(),
        company: document.getElementById('profileCompany').value.trim(),
        manager: document.getElementById('profileManager').value.trim(),
        phone: document.getElementById('profilePhone').value.trim(),
        website: document.getElementById('profileWebsite').value.trim(),
      }
    };
    if (profileEditorState.uploadedUrl) payload.fields.profile_url = profileEditorState.uploadedUrl;
    const res = await fetch('/.netlify/functions/update-client-profile', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify(payload)
    });
    if (!res.ok) throw new Error(`Save failed (${res.status})`);
    const result = await res.json();
    // Update local cache if present
    if (result.client) {
      const idx = (window.allClients || []).findIndex(c => c.id === result.client.id);
      if (idx >= 0) window.allClients[idx] = { ...(window.allClients[idx] || {}), ...result.client };
    }
    closeProfileEditor();
    showToast('Profile updated successfully!');
    // Optionally refresh clients table
    if (typeof loadClients === 'function') loadClients();
  } catch (err) {
    console.error(err);
    showToast('Save failed', 'error', err.message);
  } finally {
    if (btn && btnText) { btn.disabled = false; btnText.textContent = 'Save Changes'; }
  }
};

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

function formatInvoiceCurrency(amount, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(Number(amount) || 0);
  } catch {
    return `$${Number(amount || 0).toFixed(2)}`;
  }
}

function formatInvoiceDate(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function defaultInvoiceDueDate(days = 7) {
  const date = new Date();
  date.setDate(date.getDate() + days);
  return date.toISOString().slice(0, 10);
}

function getSavedInvoiceCurrency() {
  try {
    return localStorage.getItem(INVOICE_CURRENCY_KEY) || 'usd';
  } catch {
    return 'usd';
  }
}

function saveInvoiceCurrency(value) {
  try {
    localStorage.setItem(INVOICE_CURRENCY_KEY, value);
  } catch {
    /* ignore */
  }
}

function generateInvoiceNumberForYear(invoices = [], year = new Date().getFullYear()) {
  let maxSequence = 0;
  invoices.forEach((inv) => {
    const match = String(inv.number || '').match(/^INV-(\d{4})-(\d{5})$/i);
    if (match) {
      const invYear = Number(match[1]);
      const seq = Number(match[2]);
      if (invYear === year && seq > maxSequence) {
        maxSequence = seq;
      }
    }
  });
  const nextSequence = String(maxSequence + 1).padStart(5, '0');
  return `INV-${year}-${nextSequence}`;
}

function makeSafeStorageKey(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

async function uploadInvoiceAttachments(files = [], clientId) {
  if (!files.length) return [];
  if (!adminSupabaseClient) {
    const initialized = await initAdminSupabase();
    if (!initialized) throw new Error('Storage not configured');
  }

  const uploads = [];
  for (const file of files) {
    const safeClient = makeSafeStorageKey(clientId || 'unknown');
    const path = `invoices/${safeClient}/attachments/${Date.now()}-${makeSafeStorageKey(file.name)}`;
    const { error } = await adminSupabaseClient.storage
      .from('client_files')
      .upload(path, file, { cacheControl: '3600', upsert: false });
    if (error) {
      console.error('Attachment upload failed:', error);
      throw new Error(`Failed to upload ${file.name}`);
    }
    const { data } = adminSupabaseClient.storage.from('client_files').getPublicUrl(path);
    uploads.push({ name: file.name, path, url: data.publicUrl });
  }
  return uploads;
}

function buildInvoicePayloadFromState({ store = false } = {}) {
  if (!invoiceFormState || !activeInvoiceClient) {
    throw new Error('Invoice data is not ready');
  }

  return {
    clientId: activeInvoiceClient.id,
    clientName: activeInvoiceClient.name,
    clientEmail: activeInvoiceClient.email,
    invoiceNumber: invoiceFormState.number,
    date: new Date().toISOString(),
    dueDate: invoiceFormState.dueDate || null,
    currency: invoiceFormState.currency || 'USD',
    taxRate: Number(invoiceFormState.taxRate) || 0,
    discountRate: Number(invoiceFormState.discountRate) || 0,
    subtotal: Number(invoiceFormState.subtotal) || 0,
    taxAmount: Number(invoiceFormState.taxAmount) || 0,
    discountAmount: Number(invoiceFormState.discountAmount) || 0,
    total: Number(invoiceFormState.total) || 0,
    notes: invoiceFormState.notes || '',
    items: invoiceFormState.items.map((item) => ({
      description: item.description || 'Line item',
      qty: Number(item.quantity ?? item.qty ?? 0),
      price: Number(item.unit_amount ?? item.price ?? 0),
    })),
    store,
  };
}

async function requestInvoicePdf(payload = {}) {
  const token = await getAuthToken();
  const res = await fetch(INVOICE_PDF_ENDPOINT, {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify(payload),
  });

  const text = await res.text();
  let data;
  try {
    data = JSON.parse(text || '{}');
  } catch (err) {
    throw new Error(`Failed to parse PDF response: ${text}`);
  }

  if (!res.ok) {
    throw new Error(data.error || `Failed to generate PDF (${res.status})`);
  }

  if (!data.url) {
    throw new Error('PDF endpoint did not return a URL');
  }

  return data.url;
}

async function openInvoicePdf(invoice, { store = true } = {}) {
  try {
    const existingUrl = invoice?.pdf_url || invoice?.meta?.pdfUrl;
    if (existingUrl) {
      window.open(existingUrl, '_blank');
      return existingUrl;
    }

    const payload = {
      invoiceId: invoice?.id,
      clientId: invoice?.client_id || currentClientId,
      store,
    };

    const url = await requestInvoicePdf(payload);
    if (url) {
      window.open(url, '_blank');
      invoice.pdf_url = url;
      if (!invoice.meta) invoice.meta = {};
      invoice.meta.pdfUrl = url;
    }
    return url;
  } catch (err) {
    console.error('openInvoicePdf error:', err);
    showToast('Unable to generate PDF', 'error', err.message);
    return null;
  }
}

function renderModalInvoices() {
  const container = document.getElementById('modalInvoices');
  if (!container) return;

  if (!activeClientInvoices.length) {
    container.innerHTML = '<tr><td colspan="6" class="text-center py-4 text-slate-500">No invoices yet</td></tr>';
    return;
  }
  
  const statusClass = (status) => {
    switch ((status || '').toLowerCase()) {
      case 'paid':
        return '<span class="pill-green">Paid</span>';
      case 'open':
        return '<span class="pill-amber">Open</span>';
      case 'draft':
        return '<span class="pill-slate">Draft</span>';
      case 'void':
        return '<span class="pill-slate">Void</span>';
      case 'uncollectible':
        return '<span class="pill-amber">Uncollectible</span>';
      default:
        return `<span class="pill-slate">${status || 'Unknown'}</span>`;
    }
  };

  container.innerHTML = activeClientInvoices
    .map((inv) => `
      <tr class="border-t border-slate-200 dark:border-slate-800">
        <td class="py-2">${inv.number || '—'}</td>
        <td class="py-2">${formatInvoiceDate(inv.issued_at)}</td>
        <td class="py-2">${formatInvoiceDate(inv.due_at)}</td>
        <td class="py-2">${formatInvoiceCurrency(inv.total, inv.currency)}</td>
        <td class="py-2">${statusClass(inv.status)}</td>
        <td class="py-2">
          <div class="flex items-center justify-end gap-2">
            <button class="btn-ghost text-xs" data-action="pdf" data-id="${inv.id}">View PDF</button>
            ${inv.hosted_url ? `<a class="btn-ghost text-xs" href="${inv.hosted_url}" target="_blank" rel="noopener">${inv.status === 'draft' ? 'Preview' : 'Hosted'}</a>` : ''}
            <button class="btn-ghost text-xs" data-action="send" data-id="${inv.id}">${inv.status === 'draft' ? 'Send' : 'Resend'}</button>
          </div>
        </td>
      </tr>
    `)
    .join('');

  container.querySelectorAll('button[data-action="send"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      btn.disabled = true;
      btn.textContent = 'Sending…';
      try {
        const result = await sendInvoiceRequest(btn.getAttribute('data-id'), { sendEmail: true });
        await loadInvoicesForClient(currentClientId);
        showToast(result?.note ? `✅ Invoice updated. ${result.note}` : '✅ Invoice sent');
      } catch (err) {
        console.error(err);
        showToast('Failed to send invoice', 'error');
      } finally {
        btn.disabled = false;
        btn.textContent = 'Resend';
      }
    });
  });

  container.querySelectorAll('button[data-action="pdf"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const id = btn.getAttribute('data-id');
      const invoice = activeClientInvoices.find((entry) => String(entry.id) === String(id));
      if (!invoice) {
        showToast('Invoice not found', 'error');
        return;
      }
      btn.disabled = true;
      btn.textContent = 'Opening…';
      try {
        await openInvoicePdf(invoice, { store: true });
      } finally {
        btn.disabled = false;
        btn.textContent = 'View PDF';
      }
    });
  });
}

async function getAuthToken() {
  const id = window.netlifyIdentity;
  const user = id && id.currentUser();
  if (!user) return null;
  try {
    return await user.jwt();
  } catch {
    return null;
  }
}

async function loadInvoicesForClient(clientId) {
  if (!clientId) {
    activeClientInvoices = [];
    renderModalInvoices();
    return;
  }
  try {
    const token = await getAuthToken();
    const res = await fetch(`/.netlify/functions/get-invoices?clientId=${clientId}`, {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
    const data = await res.json();
    activeClientInvoices = (data.invoices || []).map((invoice) => ({
      ...invoice,
      pdf_url: invoice.pdf_url || invoice.meta?.pdfUrl || null,
    }));
  } catch (err) {
    console.error('loadInvoicesForClient error:', err);
    activeClientInvoices = [];
  }
  renderModalInvoices();
}

async function sendInvoiceRequest(invoiceId, { sendEmail = true } = {}) {
  const token = await getAuthToken();
  const res = await fetch('/.netlify/functions/send-invoice', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ invoiceId, sendEmail }),
  });
  if (!res.ok) {
    const text = await res.text().catch(() => '');
    throw new Error(text || `Failed to send invoice (${res.status})`);
  }
  return res.json();
}

function defaultInvoiceState() {
  return {
    number: generateInvoiceNumberForYear(activeClientInvoices || []),
    currency: getSavedInvoiceCurrency(),
    dueDate: defaultInvoiceDueDate(),
    notes: '',
    sendNow: true,
    taxRate: 0,
    discountRate: 0,
    items: [
      { description: '', quantity: 1, unit_amount: 0 },
    ],
    files: [],
  };
}

function openInvoiceModal(client) {
  activeInvoiceClient = client;
  invoiceFormState = defaultInvoiceState();
  renderInvoiceForm();
  const clientInfo = document.getElementById('invoiceClientInfo');
  if (clientInfo) clientInfo.textContent = `${client.name || 'Client'} • ${client.email || ''}`;
  const numberDisplay = document.getElementById('invoiceNumberDisplay');
  if (numberDisplay) numberDisplay.textContent = invoiceFormState.number;
  document.getElementById('invoiceModal').classList.remove('hidden');
}

function closeInvoiceModal() {
  document.getElementById('invoiceModal').classList.add('hidden');
  invoiceFormState = null;
  activeInvoiceClient = null;
}

function updateInvoiceTotals() {
  if (!invoiceFormState) return;
  const subtotal = invoiceFormState.items.reduce((sum, item) => sum + (Number(item.quantity) || 0) * (Number(item.unit_amount) || 0), 0);
  const taxAmount = subtotal * (Number(invoiceFormState.taxRate) || 0) / 100;
  const discountAmount = subtotal * (Number(invoiceFormState.discountRate) || 0) / 100;
  const total = subtotal + taxAmount - discountAmount;

  invoiceFormState.subtotal = subtotal;
  invoiceFormState.taxAmount = taxAmount;
  invoiceFormState.discountAmount = discountAmount;
  invoiceFormState.total = total;

  const currency = invoiceFormState.currency;
  const subtotalEl = document.getElementById('invoiceSubtotalValue');
  const taxEl = document.getElementById('invoiceTaxValue');
  const discountEl = document.getElementById('invoiceDiscountValue');
  const totalEl = document.getElementById('invoiceTotalValue');

  if (subtotalEl) subtotalEl.textContent = formatInvoiceCurrency(subtotal, currency);
  if (taxEl) taxEl.textContent = formatInvoiceCurrency(taxAmount, currency);
  if (discountEl) discountEl.textContent = formatInvoiceCurrency(-discountAmount, currency);
  if (totalEl) totalEl.textContent = formatInvoiceCurrency(total, currency);
}

function renderInvoiceAttachmentsList() {
  const list = document.getElementById('invoiceAttachmentList');
  if (!list || !invoiceFormState) return;
  if (!invoiceFormState.files || !invoiceFormState.files.length) {
    list.innerHTML = '<li class="text-xs text-slate-400">No attachments added</li>';
    return;
  }
  list.innerHTML = invoiceFormState.files
    .map((file, index) => `
      <li class="flex items-center justify-between gap-2">
        <span class="truncate">${file.name}</span>
        <button class="btn-ghost text-xs" data-attachment-index="${index}">Remove</button>
      </li>
    `)
    .join('');

  list.querySelectorAll('button[data-attachment-index]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = Number(btn.getAttribute('data-attachment-index'));
      invoiceFormState.files.splice(idx, 1);
      renderInvoiceAttachmentsList();
    });
  });
}

function renderInvoiceForm() {
  const modal = document.getElementById('invoiceModal');
  if (!modal || !invoiceFormState) return;

  const numberDisplay = document.getElementById('invoiceNumberDisplay');
  if (numberDisplay) numberDisplay.textContent = invoiceFormState.number;

  const currencyInput = document.getElementById('invoiceCurrency');
  const dueInput = document.getElementById('invoiceDueDate');
  const notesInput = document.getElementById('invoiceNotes');
  const taxInput = document.getElementById('invoiceTaxRate');
  const discountInput = document.getElementById('invoiceDiscountRate');
  const sendNowRadio = document.getElementById('invoiceSendNowRadio');
  const draftRadio = document.getElementById('invoiceSaveDraft');

  if (currencyInput) {
    currencyInput.value = invoiceFormState.currency;
    currencyInput.onchange = (e) => {
      invoiceFormState.currency = e.target.value || 'usd';
      saveInvoiceCurrency(invoiceFormState.currency);
      updateInvoiceTotals();
    };
  }

  if (dueInput) {
    dueInput.value = invoiceFormState.dueDate || '';
    dueInput.onchange = (e) => {
      invoiceFormState.dueDate = e.target.value;
    };
  }

  if (notesInput) {
    notesInput.value = invoiceFormState.notes || '';
    notesInput.oninput = (e) => {
      invoiceFormState.notes = e.target.value;
    };
  }

  if (taxInput) {
    taxInput.value = invoiceFormState.taxRate ?? 0;
    taxInput.oninput = (e) => {
      invoiceFormState.taxRate = Number(e.target.value) || 0;
      updateInvoiceTotals();
    };
  }

  if (discountInput) {
    discountInput.value = invoiceFormState.discountRate ?? 0;
    discountInput.oninput = (e) => {
      invoiceFormState.discountRate = Number(e.target.value) || 0;
      updateInvoiceTotals();
    };
  }

  const updateSubmitLabel = () => {
    const submitLabel = document.getElementById('invoiceSubmitLabel');
    if (submitLabel) submitLabel.textContent = invoiceFormState.sendNow ? 'Send Invoice' : 'Save Draft';
  };

  if (sendNowRadio && draftRadio) {
    sendNowRadio.checked = !!invoiceFormState.sendNow;
    draftRadio.checked = !invoiceFormState.sendNow;
    sendNowRadio.onchange = () => { invoiceFormState.sendNow = true; updateSubmitLabel(); };
    draftRadio.onchange = () => { invoiceFormState.sendNow = false; updateSubmitLabel(); };
  }

  const container = document.getElementById('invoiceItemsContainer');
  const itemsHtml = invoiceFormState.items
    .map((item, index) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_amount) || 0);
      return `
        <div class="rounded-2xl border border-slate-200 dark:border-slate-700 bg-white/80 dark:bg-slate-900/40 p-4" data-index="${index}">
          <div class="grid gap-3 md:grid-cols-[minmax(0,2fr)_minmax(0,0.6fr)_minmax(0,1fr)_minmax(0,1fr)] md:gap-x-3 md:items-center">
            <div>
              <label class="md:hidden text-xs font-semibold text-slate-500">Description</label>
              <input class="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100" type="text" placeholder="Description" data-field="description" data-index="${index}" value="${item.description || ''}">
            </div>
            <div>
              <label class="md:hidden text-xs font-semibold text-slate-500">Qty</label>
              <select class="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right" data-field="quantity" data-index="${index}">
                ${Array.from({ length: 10 }, (_, i) => i + 1)
                  .map((qty) => `<option value="${qty}" ${Number(item.quantity) === qty ? 'selected' : ''}>${qty}</option>`)
                  .join('')}
              </select>
            </div>
            <div>
              <label class="md:hidden text-xs font-semibold text-slate-500">Price</label>
              <input class="w-full px-3 py-2 border border-slate-300 dark:border-slate-700 rounded-md bg-white dark:bg-slate-900 text-slate-900 dark:text-slate-100 text-right" type="number" min="0" step="0.01" data-field="unit_amount" data-index="${index}" value="${item.unit_amount}">
            </div>
            <div class="flex items-center justify-between md:justify-end gap-3">
              <div class="text-right font-semibold text-slate-700 dark:text-slate-200" data-role="line-total">${formatInvoiceCurrency(lineTotal, invoiceFormState.currency)}</div>
              <button class="btn-ghost text-xs" data-action="remove" data-index="${index}" ${invoiceFormState.items.length === 1 ? 'disabled' : ''}>🗑️</button>
            </div>
          </div>
        </div>
      `;
    })
    .join('');
  container.innerHTML = itemsHtml || '<div class="text-xs text-slate-400">Add line items to build the invoice</div>';

  const lineTotalEls = container.querySelectorAll('[data-role="line-total"]');
  container.querySelectorAll('input, select').forEach((input) => {
    const eventName = input.tagName === 'SELECT' ? 'change' : 'input';
    input.addEventListener(eventName, (e) => {
      const idx = Number(e.target.getAttribute('data-index'));
      const field = e.target.getAttribute('data-field');
      if (field === 'quantity' || field === 'unit_amount') {
        invoiceFormState.items[idx][field] = Number(e.target.value);
        const lineTotal = (Number(invoiceFormState.items[idx].quantity) || 0) * (Number(invoiceFormState.items[idx].unit_amount) || 0);
        if (lineTotalEls[idx]) lineTotalEls[idx].textContent = formatInvoiceCurrency(lineTotal, invoiceFormState.currency);
      } else {
        invoiceFormState.items[idx][field] = e.target.value;
      }
      updateInvoiceTotals();
    });
  });

  container.querySelectorAll('button[data-action="remove"]').forEach((btn) => {
    btn.addEventListener('click', (e) => {
      e.preventDefault();
      const idx = Number(btn.getAttribute('data-index'));
      if (invoiceFormState.items.length === 1) return;
      invoiceFormState.items.splice(idx, 1);
      renderInvoiceForm();
    });
  });

  const attachmentInput = document.getElementById('invoiceAttachments');
  if (attachmentInput) {
    attachmentInput.onchange = (e) => {
      const files = Array.from(e.target.files || []);
      if (!files.length) return;
      invoiceFormState.files = (invoiceFormState.files || []).concat(files);
      renderInvoiceAttachmentsList();
      attachmentInput.value = '';
    };
  }
  renderInvoiceAttachmentsList();

  updateInvoiceTotals();
  updateSubmitLabel();
}

async function submitInvoiceForm() {
  if (!activeInvoiceClient || !invoiceFormState) return;

  const filteredItems = invoiceFormState.items.filter((item) => item.description && Number(item.quantity) > 0);
  if (!filteredItems.length) {
    showToast('Please add at least one line item', 'error');
    return;
  }

  const submitBtn = document.getElementById('invoiceSubmit');
  const submitText = document.getElementById('invoiceSubmitLabel');
  const submitSpinner = document.getElementById('invoiceSubmitSpinner');
  if (submitBtn) submitBtn.disabled = true;
  if (submitText) submitText.textContent = invoiceFormState.sendNow ? 'Sending invoice…' : 'Saving draft…';
  if (submitSpinner) submitSpinner.classList.remove('hidden');

  try {
    const token = await getAuthToken();
    const payload = {
      clientId: activeInvoiceClient.id,
      number: invoiceFormState.number,
      currency: invoiceFormState.currency,
      due_at: invoiceFormState.dueDate || null,
      notes: invoiceFormState.notes || '',
      sendNow: invoiceFormState.sendNow,
      taxRate: Number(invoiceFormState.taxRate) || 0,
      discountRate: Number(invoiceFormState.discountRate) || 0,
      subtotal: invoiceFormState.subtotal || 0,
      tax: invoiceFormState.taxAmount || 0,
      discount: invoiceFormState.discountAmount || 0,
      total: invoiceFormState.total || 0,
      items: filteredItems.map((item) => ({
        description: item.description,
        quantity: Number(item.quantity) || 1,
        unit_amount: Number(item.unit_amount) || 0,
      })),
    };

    let attachmentsMeta = [];
    if (invoiceFormState.files && invoiceFormState.files.length) {
      attachmentsMeta = await uploadInvoiceAttachments(invoiceFormState.files, activeInvoiceClient.id);
      payload.attachments = attachmentsMeta;
    }

    const res = await fetch('/.netlify/functions/create-invoice', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify(payload),
    });

    if (!res.ok) {
      const text = await res.text().catch(() => '');
      throw new Error(text || `Failed to create invoice (${res.status})`);
    }

    const responseJson = await res.json();
    const createdInvoice = responseJson.invoice;
    const note = responseJson.note;

    if (invoiceFormState.sendNow && createdInvoice?.id) {
      await sendInvoiceRequest(createdInvoice.id, { sendEmail: true });
    }

    if (createdInvoice?.id) {
      try {
        await requestInvoicePdf({ invoiceId: createdInvoice.id, store: true });
      } catch (pdfErr) {
        console.warn('Invoice PDF generation warning:', pdfErr);
      }
    }

    if (invoiceFormState.sendNow) {
      showToast(note ? `✅ Invoice created. ${note}` : '✅ Invoice created and sent successfully!');
    } else {
      showToast('✅ Invoice draft created');
    }

    await loadInvoicesForClient(activeInvoiceClient.id);
    closeInvoiceModal();
  } catch (err) {
    console.error(err);
    showToast(err.message || 'Failed to create invoice', 'error');
  } finally {
    if (submitBtn) submitBtn.disabled = false;
    if (submitText) submitText.textContent = 'Create Invoice';
    if (submitSpinner) submitSpinner.classList.add('hidden');
  }
}

const createInvoiceBtn = document.getElementById('createInvoiceBtn');
if (createInvoiceBtn) {
  createInvoiceBtn.addEventListener('click', () => {
    if (!originalClientData) {
      showToast('Open a client first', 'error');
      return;
    }
    openInvoiceModal(originalClientData);
  });
}

const invoiceModalClose = document.getElementById('invoiceModalClose');
if (invoiceModalClose) invoiceModalClose.addEventListener('click', closeInvoiceModal);
const invoiceCancel = document.getElementById('invoiceCancel');
if (invoiceCancel) invoiceCancel.addEventListener('click', closeInvoiceModal);

const addInvoiceItemBtn = document.getElementById('addInvoiceItem');
if (addInvoiceItemBtn) {
  addInvoiceItemBtn.addEventListener('click', (e) => {
    e.preventDefault();
    if (!invoiceFormState) return;
    invoiceFormState.items.push({ description: '', quantity: 1, unit_amount: 0 });
    renderInvoiceForm();
  });
}

const invoiceSubmitBtn = document.getElementById('invoiceSubmit');
if (invoiceSubmitBtn) invoiceSubmitBtn.addEventListener('click', submitInvoiceForm);

const invoicePreviewBtn = document.getElementById('invoicePreview');
if (invoicePreviewBtn) {
  invoicePreviewBtn.addEventListener('click', async () => {
    if (!invoiceFormState || !activeInvoiceClient) {
      showToast('Open a client first', 'error');
      return;
    }

    const spinner = invoicePreviewBtn.querySelector('.invoice-preview-spinner');
    invoicePreviewBtn.disabled = true;
    if (spinner) spinner.classList.remove('hidden');

    try {
      const payload = buildInvoicePayloadFromState({ store: false });
      const url = await requestInvoicePdf(payload);
      if (url) window.open(url, '_blank');
    } catch (err) {
      console.error('Preview invoice PDF failed:', err);
      showToast(err.message || 'Failed to preview invoice', 'error');
    } finally {
      invoicePreviewBtn.disabled = false;
      if (spinner) spinner.classList.add('hidden');
    }
  });
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
      .select('id, client_email, activity, type, timestamp, created_at')
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
    
    // Normalize timestamp field (fallback to created_at)
    return (data || []).map((row) => ({
      ...row,
      timestamp: row.timestamp || row.created_at,
    }));
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

// Fetch projects from Supabase
async function fetchProjectsFromSupabase(clientEmail) {
  if (!adminSupabaseClient || !clientEmail) {
    return [];
  }
  
  try {
    const { data, error } = await adminSupabaseClient
      .from('projects')
      .select('*')
      .eq('client_email', clientEmail)
      .order('updated_at', { ascending: false });
    
    if (error) {
      console.error('Error fetching projects:', error);
      return [];
    }
    
    return data || [];
  } catch (err) {
    console.error('Error fetching projects from Supabase:', err);
    return [];
  }
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
  currentClientId = client.id;
  
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
    
    // Fetch projects from Supabase via Netlify function
    try {
      const token = await new Promise((resolve) => {
        const id = window.netlifyIdentity;
        const user = id && id.currentUser();
        if (!user) return resolve(null);
        user.jwt().then(resolve).catch(() => resolve(null));
      });
      
      if (token) {
        console.log('📞 Fetching projects from get-projects function for:', email);
        const res = await fetch(`/.netlify/functions/get-projects?email=${encodeURIComponent(email)}`, {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        });
        
        console.log('📞 Response status:', res.status, res.ok);
        
        if (res.ok) {
          const data = await res.json();
          console.log('📞 Response data:', data);
          console.log('📞 Projects array:', data.projects);
          const supabaseProjects = data.projects || [];
          console.log('📞 Supabase projects length:', supabaseProjects.length);
          if (supabaseProjects.length > 0) {
            console.log('📦 Loaded projects from Supabase:', supabaseProjects.length, 'projects');
            // Convert Supabase format to client format
            const formatted = supabaseProjects.map(p => ({
              id: p.id,
              name: p.title,
              summary: p.description || '',
              status: p.status || 'In Progress',
              deadline: p.deadline || '',
            }));
            // Merge with existing JSON projects (preserve activity/comments by name match)
            const existing = Array.isArray(fullClient.projects) ? fullClient.projects : [];
            const byName = new Map(existing.map(ep => [String(ep.name || '').toLowerCase(), ep]));
            const merged = formatted.map(fp => {
              const key = String(fp.name || '').toLowerCase();
              const extra = byName.get(key) || {};
              return { ...fp, activity: Array.isArray(extra.activity) ? extra.activity : [] };
            });
            // Include any JSON-only projects not in Supabase
            existing.forEach(ep => {
              const key = String(ep.name || '').toLowerCase();
              if (!merged.find(m => String(m.name || '').toLowerCase() === key)) merged.push(ep);
            });
            fullClient.projects = merged;
          } else {
            console.log('⚠️ No projects found in Supabase for', email);
          }
        } else {
          const errorText = await res.text();
          console.error('❌ Failed to fetch projects:', res.status, errorText);
        }
      } else {
        console.warn('⚠️ No auth token available');
      }
    } catch (err) {
      console.error('❌ Error fetching projects from Supabase:', err);
    }
    
    // Update original data after fetching Supabase projects
    originalClientData = { ...fullClient };
    
    // Render profile section first
    renderModalProfile(fullClient);
    
    renderModalKPIs(fullClient);
    renderModalProjects(fullClient);
    renderModalFiles(fullClient);
    await loadInvoicesForClient(fullClient.id);
    renderModalActivity(fullClient);
    renderModalUpdates(fullClient);
    
    // Fetch and render client activity from Supabase
    const activities = await fetchClientActivity(email);
    renderClientActivity(activities, email, fullClient.name || client.name);
  }).catch(err => {
    console.error("Error fetching full client data:", err);
    // Fallback to basic data from list
    originalClientData = { ...client };
    currentClientId = client.id;
    activeClientInvoices = [];
    renderModalKPIs(client);
    renderModalInvoices();
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
  
  // Toggle profile edit/view modes
  const profileView = document.getElementById("profileViewMode");
  const profileEdit = document.getElementById("profileEditMode");
  if (profileView) profileView.classList.toggle("hidden", editMode);
  if (profileEdit) profileEdit.classList.toggle("hidden", !editMode);
  
  // Toggle edit sections
  document.getElementById("editKPIsSection").classList.toggle("hidden");
  document.getElementById("editActivitySection").classList.toggle("hidden");
  
  // Toggle "Add Project" button
  const addProjectBtn = document.getElementById("addProjectBtn");
  if (addProjectBtn) {
    addProjectBtn.classList.toggle("hidden", !editMode);
  }
  
  // Re-render projects in edit mode
  if (editMode) {
    renderEditableProjects(originalClientData);
  } else {
    renderModalProjects(originalClientData);
  }
  
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
  
  // Reset profile view/edit modes
  const profileView = document.getElementById("profileViewMode");
  const profileEdit = document.getElementById("profileEditMode");
  if (profileView) profileView.classList.remove("hidden");
  if (profileEdit) profileEdit.classList.add("hidden");
  
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
    
    // Save profile changes if in edit mode
    const nameInput = document.getElementById("adminClientName");
    const companyInput = document.getElementById("adminClientCompany");
    const managerInput = document.getElementById("adminClientManager");
    const phoneInput = document.getElementById("adminClientPhone");
    const websiteInput = document.getElementById("adminClientWebsite");
    
    if (nameInput && originalClientData.id) {
      try {
        const profileFields = {
          name: nameInput.value.trim(),
          company: companyInput?.value.trim() || '',
          manager: managerInput?.value.trim() || '',
          phone: phoneInput?.value.trim() || '',
          website: websiteInput?.value.trim() || ''
        };
        
        // Include profile_url if avatar was uploaded
        const profileImgEdit = document.getElementById("adminProfileImagePreviewEdit");
        if (profileImgEdit && profileImgEdit.src && !profileImgEdit.src.includes('default-avatar')) {
          profileFields.profile_url = profileImgEdit.src;
        }
        
        const token = await new Promise((resolve) => {
          const id = window.netlifyIdentity;
          const user = id && id.currentUser();
          if (!user) return resolve(null);
          user.jwt().then(resolve).catch(() => resolve(null));
        });
        
        const profileRes = await fetch('/.netlify/functions/update-client-profile', {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            Authorization: token ? `Bearer ${token}` : ''
          },
          body: JSON.stringify({
            clientId: originalClientData.id,
            fields: profileFields
          })
        });
        
        if (profileRes.ok) {
          const profileResult = await profileRes.json();
          if (profileResult.client) {
            // Update local data with saved profile
            Object.assign(originalClientData, profileResult.client);
          }
          console.log('✅ Profile saved successfully');
          
          // Add activity log entry
          try {
            const user = window.netlifyIdentity?.currentUser();
            const adminEmail = user?.email || '';
            // Extract name from email (before @) or use email
            const adminName = adminEmail.split('@')[0]
              .split('.')
              .map(part => part.charAt(0).toUpperCase() + part.slice(1))
              .join(' ') || 'Admin';
            
            const now = new Date();
            const formattedTime = now.toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
            const formattedDate = now.toLocaleDateString([], { month: 'short', day: 'numeric', year: 'numeric' });
            
            const newActivity = {
              text: "Profile updated",
              type: "update",
              when: `${formattedTime} · ${formattedDate} (edited by ${adminName})`
            };
            
            // Get existing activity array or initialize
            const currentActivity = originalClientData.activity || [];
            const updatedActivity = [newActivity, ...currentActivity];
            
            // Update activity in Supabase
            const activityUpdateRes = await fetch('/.netlify/functions/update-client-profile', {
              method: 'POST',
              headers: {
                'Content-Type': 'application/json',
                Authorization: token ? `Bearer ${token}` : ''
              },
              body: JSON.stringify({
                clientId: originalClientData.id,
                fields: { activity: updatedActivity }
              })
            });
            
            if (activityUpdateRes.ok) {
              // Update local data with new activity
              originalClientData.activity = updatedActivity;
              console.log('✅ Activity logged successfully');
            } else {
              console.warn('⚠️ Failed to log activity:', await activityUpdateRes.text());
            }
          } catch (activityErr) {
            console.error('❌ Error logging activity:', activityErr);
            // Non-blocking - don't fail the whole save
          }
        } else {
          console.warn('⚠️ Failed to save profile:', await profileRes.text());
        }
      } catch (err) {
        console.error('❌ Error saving profile:', err);
        // Don't throw - allow other saves to continue
      }
    }
    
    // Save project changes to Supabase
    if (adminSupabaseClient && currentClientEmail) {
      console.log('📝 Starting to save projects to Supabase...');
      const projectCards = document.querySelectorAll('.project-edit-card');
      console.log(`📝 Found ${projectCards.length} project cards to save`);
      
      for (const card of projectCards) {
        const projectName = card.querySelector('.project-name-input')?.value;
        const projectDesc = card.querySelector('.project-desc-input')?.value || '';
        const projectStatus = card.querySelector('.project-status-select')?.value || 'In Progress';
        const supabaseId = card.getAttribute('data-supabase-id');
        
        console.log('📝 Project data:', { projectName, projectDesc, projectStatus, supabaseId });
        
        if (projectName && projectName.trim()) {
          try {
            const result = await upsertProject(currentClientEmail, {
              id: supabaseId, // Send ID if it exists (for updates)
              name: projectName,
              description: projectDesc,
              status: projectStatus
            });
            console.log('✅ Project saved successfully:', result);
          } catch (err) {
            console.error('❌ Failed to save project:', err);
          }
        } else {
          console.warn('⚠️ Skipping empty project name');
        }
      }
      console.log('📝 Finished saving all projects');
    } else {
      console.warn('⚠️ Cannot save projects:', { 
        hasClient: !!adminSupabaseClient, 
        hasEmail: !!currentClientEmail 
      });
    }
    
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
    renderModalProfile(originalClientData);
    renderModalKPIs(originalClientData);
    renderModalActivity(originalClientData);
    
    showToast("Changes saved", "success", "Client updated successfully!");
    cancelEditMode();
    
    // ✅ Force refresh from server for most up-to-date data
    try {
      const refreshRes = await fetch(`/.netlify/functions/get-client?id=${encodeURIComponent(originalClientData.id)}`);
      if (refreshRes.ok) {
        const latestClient = await refreshRes.json();
        // Replace local cache and re-render
        originalClientData = { ...latestClient };
        renderModalProfile(latestClient);
        renderModalKPIs(latestClient);
        renderModalProjects(latestClient);
        renderModalFiles(latestClient);
        await loadInvoicesForClient(latestClient.id);
        renderModalActivity(latestClient);
        showToast('Profile and KPIs updated successfully!');
      } else {
        console.warn('Refresh after save failed:', await refreshRes.text());
      }
    } catch (e) {
      console.error('Error refreshing client data:', e);
    }

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
// Global KPI/Overview chart instance per requested pattern
window.kpiChart = window.kpiChart || null;

function renderDashboardChart(dataset) {
	// Prefer a container with id 'chartContainer' if present; fallback to 'revenueChartContainer'
	const container = document.getElementById('chartContainer') || document.getElementById('revenueChartContainer');
	if (!container) return;

	// 1) Destroy existing chart
	if (window.kpiChart) {
		try { window.kpiChart.destroy(); } catch {}
		window.kpiChart = null;
	}

	// 2) Reset container to single canvas
	// Ensure predictable layout height
	container.style.position = 'relative';
	container.style.height = '320px';
	container.style.minHeight = '320px';
	container.style.width = '100%';
	container.innerHTML = '<canvas id="kpiChart" style="width:100%;height:100%;display:block;"></canvas>';
	const canvas = document.getElementById('kpiChart');
	const ctx = canvas.getContext('2d');

	// Build Chart.js config from dataset
	const defaultColors = ['#4C52F8', '#7B61FF', '#A68CFF', '#C7B8FF'];
	const config = {
		type: dataset.type || 'bar',
		data: {
			labels: dataset.labels || [],
			datasets: (dataset.series || []).map((s, i) => ({
				label: s.name,
				data: s.data,
				borderColor: s.color || defaultColors[i % defaultColors.length],
				backgroundColor: (s.backgroundColor || (s.color || defaultColors[i % defaultColors.length]) + '33'),
				tension: 0.35,
				fill: dataset.type === 'line'
			}))
		},
		options: {
			maintainAspectRatio: false,
			plugins: {
				legend: { display: true, labels: { color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#0F172A' } },
				tooltip: { intersect: false, mode: 'index' }
			},
			scales: {
				x: { ticks: { color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#0F172A' } },
				y: { ticks: { color: document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#0F172A' }, beginAtZero: true }
			}
		}
	};

	// Create new chart instance and assign to global
	window.kpiChart = new Chart(ctx, config);
}

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

    // New: Enhanced Overview KPIs
    try {
      const projects = await fetchProjectsFn().catch(() => []);
      const invoicesFromClients = clients.flatMap((c) => parseJSON(c.invoices || []));
      const kpiContainer = document.getElementById('kpiContainer');
      if (kpiContainer) renderKPICards(kpiContainer, computeKPIs({ clients, projects, invoices: invoicesFromClients }));
    } catch {}

    // New: Charts
    try {
      // Overview/KPI chart uses the requested destroy/reset pattern
      renderDashboardChart(buildRevenueDataset('month'));
      const leadsData = await fetchLeadsFn().catch(() => []);
      allBookingsGlobal = leadsData;
      const leadSourceContainer = document.getElementById('leadSourceChartContainer');
      if (leadSourceContainer) {
        const ds = buildLeadSourceDataset(leadsData);
        renderChartSection(leadSourceContainer, {
          title: 'Lead Sources',
          description: 'Distribution by source',
          dataset: ds,
          initialRange: 'month',
          onRangeChange: () => buildLeadSourceDataset(leadsData),
        });
      }
    } catch {}

    // New: Clients as expandable cards
    try {
      const clientCardsContainer = document.getElementById('clientCardsContainer');
      if (clientCardsContainer) {
        renderClientCards(clientCardsContainer, clients, {
          onView: (c) => c?.email && window.viewClient && window.viewClient(c.email),
          onEdit: (c) => c?.email && window.openProfileEditor && window.openProfileEditor(c.email),
          onArchive: (c) => window.showToast && window.showToast('Archived', 'success', c?.name || c?.email || ''),
          onSearch: () => {},
        });
      }
    } catch {}

    // New: Leads enhanced list
    try {
      const leadsContainer = document.getElementById('leadsContainer');
      if (leadsContainer && Array.isArray(allBookingsGlobal)) {
        renderLeads(leadsContainer, allBookingsGlobal, {
          onChange: (lead) => {
            const idx = allBookingsGlobal.findIndex((l) => l.id === lead.id);
            if (idx >= 0) allBookingsGlobal[idx] = { ...allBookingsGlobal[idx], ...lead };
          },
          onExportCSV: () => window.exportLeadsToCSV && window.exportLeadsToCSV(),
        });
      }
    } catch {}

    // New: Activity feed
    try {
      const items = [];
      clients.forEach((c) => (c.activity || []).forEach((a) => items.push({
        type: a.type || 'project',
        title: a.text || 'Update',
        subtitle: c.name || c.email || '',
        // Preserve original timestamp string if date parsing may fail
        timestamp: a.timestamp || a.when || new Date().toISOString(),
        client: c,
      })));
      const container = document.getElementById('activityFeedContainer');
      if (container) renderActivityFeed(container, items, { onClick: (it) => it?.client?.email && window.viewClient && window.viewClient(it.client.email) });
    } catch {}
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

// === Create Client Modal Logic ===
function getEl(id){ return document.getElementById(id); }

const openAddClientBtn = getEl('openAddClientModal');
if (openAddClientBtn) {
  openAddClientBtn.addEventListener('click', () => {
    const modal = getEl('createClientModal');
    if (!modal) return;
    modal.classList.remove('hidden');
    const today = new Date().toISOString().split('T')[0];
    const lastUpdate = getEl('lastUpdate');
    if (lastUpdate) lastUpdate.value = today;
  });
}

const cancelCreateClient = getEl('cancelCreateClient');
if (cancelCreateClient) {
  cancelCreateClient.addEventListener('click', () => {
    const modal = getEl('createClientModal');
    if (modal) modal.classList.add('hidden');
  });
}

const toggleBusinessFields = getEl('toggleBusinessFields');
if (toggleBusinessFields) {
  toggleBusinessFields.addEventListener('click', (e) => {
    e.preventDefault();
    const fields = getEl('businessFields');
    if (fields) fields.classList.toggle('hidden');
  });
}

const avatarUpload = getEl('avatarUpload');
if (avatarUpload) {
  avatarUpload.addEventListener('change', (e) => {
    const file = e.target.files && e.target.files[0];
    if (!file) return;
    const url = URL.createObjectURL(file);
    const preview = getEl('avatarPreview');
    if (preview) preview.src = url;
  });
}

async function getIdentityTokenForInsert() {
  try {
    const id = window.netlifyIdentity;
    const user = id && id.currentUser && id.currentUser();
    if (!user) return null;
    return await user.jwt();
  } catch { return null; }
}

const createClientBtn = getEl('createClientBtn');
if (createClientBtn) {
  createClientBtn.addEventListener('click', async () => {
    const btn = createClientBtn;
    const loader = btn.querySelector('.loader');
    if (loader) loader.classList.remove('hidden');
    btn.disabled = true;

    try {
      const name = getEl('clientName')?.value?.trim();
      const email = getEl('clientEmail')?.value?.trim();
      if (!name || !email) {
        showToast('⚠️ Please fill in all required fields.');
        return;
      }

      // Duplicate email check via Supabase
      if (!adminSupabaseClient) await initAdminSupabase();
      if (!adminSupabaseClient) throw new Error('Supabase not initialized');
      const { data: existing, error: dupErr } = await adminSupabaseClient
        .from('clients')
        .select('email')
        .eq('email', email)
        .maybeSingle();
      if (dupErr) console.warn('Duplicate check error:', dupErr);
      if (existing) {
        showToast('⚠️ This email is already registered.');
        return;
      }

      const kpis = {
        activeProjects: Number(getEl('activeProjects')?.value || 0),
        files: Number(getEl('filesShared')?.value || 0),
        openInvoices: Number(getEl('openInvoices')?.value || 0),
        lastUpdate: getEl('lastUpdate')?.value || new Date().toISOString().split('T')[0],
      };

      const clientData = {
        name,
        email,
        company: getEl('company')?.value || '',
        manager: getEl('manager')?.value || '',
        phone: getEl('phone')?.value || '',
        website: getEl('website')?.value || '',
        notes: getEl('notes')?.value || '',
        kpis,
        projects: [],
        files: [],
        invoices: [],
        activity: [{ text: 'Client profile created', type: 'system', when: new Date().toISOString() }],
      };

      // Optional avatar upload to Supabase Storage (client_avatars)
      const file = getEl('avatarUpload')?.files?.[0];
      if (file && adminSupabaseClient) {
        const path = `${crypto.randomUUID()}/${file.name}`;
        const { error: upErr } = await adminSupabaseClient.storage.from('client_avatars').upload(path, file);
        if (!upErr) {
          const { data: urlData } = adminSupabaseClient.storage.from('client_avatars').getPublicUrl(path);
          if (urlData?.publicUrl) clientData.profile_url = urlData.publicUrl;
        }
      }

      // Insert client via Netlify function to keep server-side rules
      const token = await getIdentityTokenForInsert();
      const res = await fetch('/.netlify/functions/create-client', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({ name: clientData.name, email: clientData.email, kpis, extra: clientData })
      });
      if (!res.ok) throw new Error(`Create failed (${res.status})`);

      // Close modal and refresh clients
      getEl('createClientModal')?.classList.add('hidden');
      showToast('✅ Client created successfully!');

      const data = await fetchAllClients();
      const clients = data.clients || [];
      allClientsGlobal = clients;
      const container = document.getElementById('clientCardsContainer');
      if (container) {
        renderClientCards(container, clients, {
          onView: (c) => c?.email && window.viewClient && window.viewClient(c.email),
          onEdit: (c) => c?.email && window.openProfileEditor && window.openProfileEditor(c.email),
          onArchive: (c) => window.showToast && window.showToast('Archived', 'success', c?.name || c?.email || ''),
        });
      }
    } catch (err) {
      console.error(err);
      showToast('❌ Error creating client.');
    } finally {
      const loader = createClientBtn.querySelector('.loader');
      if (loader) loader.classList.add('hidden');
      createClientBtn.disabled = false;
    }
  });
}

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

function getStatusColorClass(status) {
  switch(status) {
    case 'New': return 'bg-blue-100 text-blue-700 dark:bg-blue-900/30 dark:text-blue-300 border-blue-200 dark:border-blue-700';
    case 'Contacted': return 'bg-green-100 text-green-700 dark:bg-green-900/30 dark:text-green-300 border-green-200 dark:border-green-700';
    case 'In Progress': return 'bg-yellow-100 text-yellow-700 dark:bg-yellow-900/30 dark:text-yellow-300 border-yellow-200 dark:border-yellow-700';
    case 'Closed': return 'bg-gray-100 text-gray-700 dark:bg-gray-900/30 dark:text-gray-300 border-gray-200 dark:border-gray-700';
    default: return 'bg-slate-100 text-slate-700 dark:bg-slate-900/30 dark:text-slate-300 border-slate-200 dark:border-slate-700';
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
        <select 
          onchange="updateLeadStatus(${lead.id}, this.value)"
          data-status="${lead.status || 'New'}"
          class="status-select px-3 py-2 rounded-lg text-xs font-semibold border-2 ${getStatusColorClass(lead.status || 'New')} hover:opacity-80 transition-all">
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
  console.log('🔄 Updating lead status:', leadId, 'to', newStatus);
  try {
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });

    console.log('📤 Sending request to update-lead-status...');
    const res = await fetch('/.netlify/functions/update-lead-status', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        ...(token ? { Authorization: `Bearer ${token}` } : {}),
      },
      body: JSON.stringify({ leadId, status: newStatus })
    });

    console.log('📥 Response status:', res.status);

    if (res.ok) {
      const result = await res.json();
      console.log('✅ Update successful:', result);
      showToast('Status updated', 'success');
      // Update local data
      const lead = allBookingsGlobal.find(l => l.id === leadId);
      if (lead) lead.status = newStatus;
      
      // Re-render table to show updated colors
      const search = document.getElementById('bookingsSearch');
      const sortDropdown = document.getElementById('sortLeadsDropdown');
      const term = search ? search.value.trim() : '';
      const sortOrder = sortDropdown ? sortDropdown.value : 'newest';
      renderBookingsTable(allBookingsGlobal, term, sortOrder);
    } else {
      const errorText = await res.text();
      console.error('❌ Update failed:', res.status, errorText);
      showToast('Failed to update status', 'error');
    }
  } catch (err) {
    console.error('❌ Error updating status:', err);
    showToast('Failed to update status', 'error');
  }
}

async function updateLeadSource(leadId, newSource) {
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
      body: JSON.stringify({ leadId, source: newSource })
    });

    if (res.ok) {
      const lead = allBookingsGlobal.find(l => l.id === leadId);
      if (lead) lead.source = newSource;
      showToast('Source updated', 'success');
    } else {
      const errorText = await res.text();
      console.error('Update source failed:', res.status, errorText);
      showToast('Failed to update source', 'error');
    }
  } catch (err) {
    console.error('Error updating source:', err);
    showToast('Failed to update source', 'error');
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
window.updateLeadSource = updateLeadSource;

async function updateLeadScore(leadId, newScore) {
  try {
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });
    const res = await fetch('/.netlify/functions/update-lead-status', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ leadId, score: newScore })
    });
    if (res.ok) {
      const lead = allBookingsGlobal.find(l => l.id === leadId);
      if (lead) lead.score = newScore;
      showToast('Score updated', 'success');
    } else {
      showToast('Failed to update score', 'error');
    }
  } catch (e) {
    console.error(e);
    showToast('Failed to update score', 'error');
  }
}

window.updateLeadScore = updateLeadScore;

// Global admin refresh: reload clients/leads and re-render main areas
window.refreshAdmin = async function() {
  const overlay = document.getElementById('loadingOverlay');
  if (overlay) overlay.style.display = 'flex';
  try {
    const data = await fetchAllClients();
    const clients = data.clients || [];
    allClientsGlobal = clients;
    renderAdminKPIs(clients);
    renderClientsTable(clients);
    renderAllActivity(clients);
    renderAnalytics(clients);
    // Also refresh cards-based UI if present
    const container = document.getElementById('clientCardsContainer');
    if (container) {
      renderClientCards(container, clients, {
        onView: (c) => c?.email && window.viewClient && window.viewClient(c.email),
        onEdit: (c) => c?.email && window.openProfileEditor && window.openProfileEditor(c.email),
        onArchive: (c) => window.showToast && window.showToast('Archived', 'success', c?.name || c?.email || ''),
      });
    }
    await refreshBookings();
    if (window.showToast) window.showToast('Admin data refreshed');
  } catch (e) {
    console.error('Admin refresh failed:', e);
  } finally {
    if (overlay) overlay.style.display = 'none';
  }
}

// === PROJECT MODAL HANDLING ===
let activeProjectIndex = null;
let activeClient = null;

function renderProjectActivity(activity) {
  const container = document.getElementById('projectActivity');
  if (!container) return;
  container.innerHTML = (activity && activity.length)
    ? activity.map(a => `<div>🕓 ${a.when} — ${a.text} <span class='text-slate-400'>(${a.by || 'Admin'})</span></div>`).join('')
    : `<div class="text-slate-400 italic">No activity yet.</div>`;
}

function updateStatusBadge(status) {
  const badge = document.getElementById('projectStatusBadge');
  if (!badge) return;
  const map = {
    'In Progress': 'bg-blue-100 text-blue-700',
    'Review': 'bg-yellow-100 text-yellow-700',
    'Done': 'bg-green-100 text-green-700'
  };
  badge.className = `px-3 py-1 text-xs rounded-full ${map[status] || 'bg-slate-100 text-slate-700'}`;
  badge.textContent = status || '—';
}

window.openProjectModal = function(client, index) {
  activeProjectIndex = index;
  activeClient = client;
  const p = (client.projects || [])[index] || {};
  const m = document.getElementById('projectModal');
  if (!m) return;
  document.getElementById('projectTitle').textContent = p.name || 'Untitled Project';
  const t = document.getElementById('editProjectTitle'); if (t) t.value = p.name || '';
  const d = document.getElementById('editProjectDescription'); if (d) d.value = p.summary || '';
  const s = document.getElementById('editProjectStatus'); if (s) s.value = p.status || 'In Progress';
  const dl = document.getElementById('editProjectDeadline'); if (dl) dl.value = p.deadline || '';
  renderProjectActivity(p.activity || []);
  updateStatusBadge(p.status || 'In Progress');
  m.classList.remove('hidden');
}

const pmClose = document.getElementById('closeProjectModal');
if (pmClose) pmClose.onclick = () => document.getElementById('projectModal').classList.add('hidden');
const pmCancel = document.getElementById('cancelProjectChanges');
if (pmCancel) pmCancel.onclick = () => document.getElementById('projectModal').classList.add('hidden');

const pmSave = document.getElementById('saveProjectChanges');
if (pmSave) pmSave.onclick = async () => {
  if (!activeClient || activeProjectIndex == null) return;
  const project = activeClient.projects[activeProjectIndex] || {};
  const now = new Date();
  const formatted = `${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${now.toLocaleDateString()}`;
  project.name = document.getElementById('editProjectTitle')?.value?.trim() || project.name || '';
  project.summary = document.getElementById('editProjectDescription')?.value?.trim() || project.summary || '';
  project.status = document.getElementById('editProjectStatus')?.value || project.status || 'In Progress';
  project.deadline = document.getElementById('editProjectDeadline')?.value || project.deadline || '';
  project.activity = Array.isArray(project.activity) ? project.activity : [];
  project.activity.unshift({ text: 'Project details updated', when: formatted, by: 'Admin' });

  try {
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity; const user = id && id.currentUser();
      if (!user) return resolve(null); user.jwt().then(resolve).catch(() => resolve(null));
    });
    const res = await fetch('/.netlify/functions/update-client-profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clientId: activeClient.id, fields: { projects: activeClient.projects } })
    });
    if (!res.ok) throw new Error('Save failed');
    if (window.showToast) window.showToast('✅ Project updated successfully!');
    // Persist to projects table too (keeps Admin list consistent after reload)
    try {
      await upsertProject(activeClient.email, {
        id: project.id,
        name: project.name,
        description: project.summary,
        status: project.status,
      });
    } catch (e) { console.warn('Upsert to projects table failed', e); }
    // Log to client activity feed
    try { await logAdminActivity(activeClient.email, `Updated project: ${project.name}`, 'project'); } catch {}
    // Keep modal open and reflect activity immediately
    renderProjectActivity(project.activity);
  } catch (e) {
    console.error('Project save failed', e);
    if (window.showToast) window.showToast('Save failed', 'error');
  } finally {
    const m = document.getElementById('projectModal'); if (m) m.classList.add('hidden');
  }
}

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

/* ---------------------------
   Dynamic Project Management Functions
---------------------------- */

// Add a new project card in edit mode
window.addNewProjectCard = function() {
  if (!currentClientEmail) return;
  
  const modalProjects = document.getElementById("modalProjects");
  if (!modalProjects) return;
  
  const projectId = `project-${Date.now()}`;
  const newProjectHTML = `
    <div class="project-edit-card card p-4" data-project-id="${projectId}">
      <div class="flex items-start justify-between mb-3">
        <input type="text" placeholder="Project Name" class="project-name-input font-semibold bg-transparent border-none outline-none focus:ring-2 focus:ring-purple-500/50 rounded px-2" value="" />
      </div>
      <textarea placeholder="Description (optional)" class="project-desc-input w-full text-sm text-slate-600 dark:text-slate-300 bg-transparent border border-slate-200 dark:border-slate-700 rounded px-2 py-1 focus:ring-2 focus:ring-purple-500/50 resize-none" rows="2"></textarea>
      <div class="flex items-center justify-between mt-3">
        <select class="project-status-select border border-slate-200 dark:border-slate-700 rounded px-2 py-1 text-sm bg-white dark:bg-slate-900">
          <option value="New">New</option>
          <option value="In Progress" selected>In Progress</option>
          <option value="Review">Review</option>
          <option value="Complete">Complete</option>
        </select>
        <button onclick="removeProjectCard('${projectId}')" class="btn-ghost text-sm text-red-500">Remove</button>
      </div>
    </div>
  `;
  
  modalProjects.insertAdjacentHTML("beforeend", newProjectHTML);
};

// Remove a project card
window.removeProjectCard = function(projectId) {
  const card = document.querySelector(`[data-project-id="${projectId}"]`);
  if (card && confirm("Remove this project?")) {
    card.remove();
  }
};

// Update or create project in Supabase via Netlify function
async function upsertProject(clientEmail, project) {
  if (!clientEmail) {
    console.warn('No client email provided');
    return;
  }
  
  try {
    console.log('💾 Attempting to save project via Netlify function:', { clientEmail, project });
    
    // Get JWT token
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      if (!user) return resolve(null);
      user.jwt().then(resolve).catch(() => resolve(null));
    });
    
    if (!token) {
      console.warn('No auth token available');
      return;
    }
    
    // Call Netlify function to upsert project
    const res = await fetch('/.netlify/functions/upsert-project', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'Authorization': `Bearer ${token}`
      },
      body: JSON.stringify({ clientEmail, project })
    });
    
    const result = await res.json();
    
    if (!res.ok) {
      console.error('Error from upsert-project function:', result);
      return;
    }
    
    console.log('✅ Project saved successfully via Netlify function:', result);
    return result.data;
    
  } catch (err) {
    console.error('Error upserting project:', err);
    return;
  }
}

// Log admin activity to Supabase
async function logAdminActivity(clientEmail, description, type = 'other') {
  if (!adminSupabaseClient) return;
  
  try {
    await adminSupabaseClient
      .from('client_activity')
      .insert({
        client_email: clientEmail,
        activity: description,
        type: type,
        timestamp: new Date().toISOString()
      });
  } catch (err) {
    console.error('Error logging activity:', err);
  }
}

