// assets/js/portal.js

/* ---------------------------
   1) Fetch data (with Identity)
---------------------------- */
async function fetchClientData() {
  const token = await new Promise((resolve) => {
    const id = window.netlifyIdentity;
    const user = id && id.currentUser();
    if (!user) return resolve(null);
    user.jwt().then(resolve).catch(() => resolve(null));
  });

  const res = await fetch("/.netlify/functions/get-client", {
    headers: token ? { Authorization: `Bearer ${token}` } : {},
  });

  if (!res.ok) {
    const text = await res.text().catch(() => "");
    throw new Error(`Function error ${res.status}: ${text}`);
  }
  return res.json();
}

/* ---------------------------
   2) Render helpers (Advanced)
---------------------------- */

// KPIs
function renderKPIs({ kpis = {} }) {
  const container = document.getElementById("kpis");
  if (!container) return;

  const entries = [
    { label: "Active Projects", value: kpis.activeProjects ?? 0 },
    { label: "Files Shared", value: kpis.files ?? 0 },
    { label: "Open Invoices", value: kpis.openInvoices ?? 0 },
    { label: "Last Update", value: kpis.lastUpdate || "–" },
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

// Projects → Kanban columns; also mirrors a simple list if #projects exists
function renderProjects({ projects = [] }) {
  // Advanced columns
  const colProgress = document.getElementById("col-progress");
  const colReview   = document.getElementById("col-review");
  const colDone     = document.getElementById("col-done");

  const cardHTML = (p) => `
    <div class="rounded-xl border border-slate-200 dark:border-slate-800 bg-white dark:bg-slate-900 p-3">
      <div class="flex items-center justify-between">
        <div class="font-medium">${p.name}</div>
        <span class="${
          p.status === "Completed" || p.status === "Done"
            ? "pill-green"
            : p.status.toLowerCase().includes("review")
            ? "pill-slate"
            : "pill-amber"
        }">${p.status}</span>
      </div>
      <div class="text-sm text-slate-600 dark:text-slate-300 mt-1">${p.summary || ""}</div>
      ${
        p.links?.length
          ? `<div class="mt-3 flex flex-wrap gap-2">${p.links
              .map(
                (l) =>
                  `<a class="chip" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
              )
              .join("")}</div>`
          : ""
      }
    </div>
  `;

  if (colProgress && colReview && colDone) {
    colProgress.innerHTML = "";
    colReview.innerHTML = "";
    colDone.innerHTML = "";

    projects.forEach((p) => {
      const status = (p.status || "In Progress").toLowerCase();
      if (status.includes("done") || status.includes("complete")) {
        colDone.insertAdjacentHTML("beforeend", cardHTML(p));
      } else if (status.includes("review")) {
        colReview.insertAdjacentHTML("beforeend", cardHTML(p));
      } else {
        colProgress.insertAdjacentHTML("beforeend", cardHTML(p));
      }
    });
  }

  // Fallback simple list for backward compatibility
  const list = document.getElementById("projects");
  if (list) {
    list.innerHTML = projects
      .map(
        (p) => `
      <div class="p-4 flex items-start gap-4">
        <div class="size-10 rounded-lg bg-indigo-100"></div>
        <div class="flex-1">
          <div class="flex items-center justify-between">
            <h3 class="font-semibold">${p.name}</h3>
            <span class="text-xs px-2 py-1 rounded-full ${
              p.status === "In Progress"
                ? "bg-amber-100 text-amber-700"
                : p.status === "Completed" || p.status === "Done"
                ? "bg-emerald-100 text-emerald-700"
                : "bg-slate-100 text-slate-700"
            }">${p.status}</span>
          </div>
          <p class="text-sm text-slate-600 mt-1">${p.summary || ""}</p>
          ${
            p.links?.length
              ? `<div class="mt-3 flex flex-wrap gap-2">${p.links
                  .map(
                    (l) =>
                      `<a class="chip" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
                  )
                  .join("")}</div>`
              : ""
          }
        </div>
      </div>`
      )
      .join("");
  }
}

// Files - Supabase Storage
let supabaseClient = null;

// Sanitize email for use in file paths (replace @ and . with _)
function sanitizeEmail(email) {
  if (!email) return '';
  return email.replace(/[^a-zA-Z0-9]/g, '_');
}

async function initSupabase() {
  if (!window.supabase) {
    console.error('❌ Supabase client library not loaded');
    return false;
  }
  
  try {
    // Get JWT token from Netlify Identity for authenticated access
    console.log('🔍 Checking for Netlify Identity user...');
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity;
      const user = id && id.currentUser();
      console.log('User found:', !!user, user?.email);
      if (!user) {
        console.warn('⚠️ No user logged in to Netlify Identity');
        return resolve(null);
      }
      user.jwt().then(resolve).catch(() => {
        console.warn('⚠️ Failed to get JWT token');
        resolve(null);
      });
    });
    
    console.log('🔑 JWT token retrieved:', token ? 'Yes (length: ' + token.length + ')' : 'No');
    
    const res = await fetch('/.netlify/functions/get-storage-config');
    const config = await res.json();
    
    console.log('📦 Supabase config retrieved:', {
      url: config.url ? 'Yes' : 'No',
      anonKey: config.anonKey ? 'Yes' : 'No'
    });
    
    if (config.url && config.anonKey) {
      // Initialize Supabase client with auth token for authenticated access
      supabaseClient = window.supabase.createClient(config.url, config.anonKey, {
        global: {
          headers: token ? { Authorization: `Bearer ${token}` } : {}
        }
      });
      
      console.log('✅ Supabase Storage initialized with auth');
      console.log('📝 Supabase client created:', {
        hasClient: !!supabaseClient,
        hasAuth: !!token,
        authLength: token ? token.length : 0
      });
      return true;
    } else {
      console.error('❌ Missing Supabase config (url or anonKey)');
    }
  } catch (err) {
    console.error('❌ Failed to initialize Supabase Storage:', err);
    console.error('Error stack:', err.stack);
    return false;
  }
  
  return false;
}

// Fetch files from Supabase Storage
async function fetchSupabaseFiles(userEmail) {
  if (!supabaseClient) {
    console.log('Supabase not initialized, returning empty files array');
    return [];
  }
  
  try {
    const safeEmail = sanitizeEmail(userEmail);
    const { data, error } = await supabaseClient.storage
      .from('client_files')
      .list(safeEmail || '');
    
    if (error) {
      console.error('Error fetching files:', error);
      return [];
    }
    
    return data.map(file => ({
      name: file.name,
      size: file.metadata?.size || 0,
      updated: new Date(file.updated_at).toLocaleDateString()
    }));
  } catch (err) {
    console.error('Error fetching Supabase files:', err);
    return [];
  }
}

// Upload file to Supabase Storage
async function uploadFileToSupabase(file, userEmail) {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized');
  }
  
  const safeEmail = sanitizeEmail(userEmail);
  const filePath = `${safeEmail}/${Date.now()}-${file.name}`;
  
  const { data, error } = await supabaseClient.storage
    .from('client_files')
    .upload(filePath, file, {
      cacheControl: '3600',
      upsert: false
    });
  
  if (error) {
    throw new Error(error.message);
  }
  
  return data;
}

// Delete file from Supabase Storage
async function deleteFileFromSupabase(filePath, userEmail) {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized');
  }
  
  const safeEmail = sanitizeEmail(userEmail);
  const fullPath = `${safeEmail}/${filePath}`;
  
  const { error } = await supabaseClient.storage
    .from('client_files')
    .remove([fullPath]);
  
  if (error) {
    throw new Error(error.message);
  }
}

// Get public URL for file
async function getFileUrl(filePath, userEmail) {
  if (!supabaseClient) {
    throw new Error('Supabase not initialized');
  }
  
  const safeEmail = sanitizeEmail(userEmail);
  const fullPath = `${safeEmail}/${filePath}`;
  
  const { data } = await supabaseClient.storage
    .from('client_files')
    .getPublicUrl(fullPath);
  
  return data.publicUrl;
}

// Format file size
function formatFileSize(bytes) {
  if (!bytes || bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return Math.round((bytes / Math.pow(k, i)) * 100) / 100 + ' ' + sizes[i];
}

// Test function to manually test activity logging
window.testActivityLog = async function() {
  const user = window.netlifyIdentity?.currentUser();
  const userEmail = user?.email || 'test@example.com';
  
  console.log('🧪 Testing activity log...', { userEmail, supabaseClient: !!supabaseClient });
  
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized');
    return;
  }
  
  // Try to insert a test record
  const testActivity = `Test activity at ${new Date().toISOString()}`;
  
  console.log('📝 Inserting test activity...', { client_email: userEmail, activity: testActivity, type: 'test' });
  
  const { data, error } = await supabaseClient
    .from('client_activity')
    .insert({
      client_email: userEmail,
      activity: testActivity,
      type: 'test'
    })
    .select();
  
  if (error) {
    console.error('❌ Test insert failed:', error);
    console.error('Error details:', {
      message: error.message,
      details: error.details,
      hint: error.hint,
      code: error.code
    });
  } else {
    console.log('✅ Test insert successful!', data);
  }
};

// Log client activity to Supabase
async function logClientActivity(clientEmail, activity, type = 'upload') {
  try {
    console.log('🔍 logClientActivity called with:', { clientEmail, activity, type });
    
    if (!supabaseClient) {
      console.error('❌ Supabase client is null/undefined!');
      console.warn('Supabase not initialized, skipping activity log');
      return;
    }
    
    console.log('📝 Supabase client exists, preparing insert...');
    console.log('📝 Insert payload:', { client_email: clientEmail, activity, type });
    
    const { data, error } = await supabaseClient
      .from('client_activity')
      .insert({
        client_email: clientEmail,
        activity: activity,
        type: type
      })
      .select();
    
    if (error) {
      console.error('❌ Supabase insert error:', error);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log('✅ Activity logged successfully!', data);
    }
  } catch (err) {
    console.error('❌ Exception in logClientActivity:', err);
    console.error('Error stack:', err.stack);
  }
}

// Render files with modern UI
function renderFiles({ files = [], userEmail = '' }) {
  const el = document.getElementById("files");
  const emptyState = document.getElementById("filesEmpty");
  
  if (!el) return;
  
  if (files.length === 0) {
    el.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  
  el.innerHTML = files
    .map(
      (f) => `
    <li class="group flex items-center justify-between gap-3 p-3 rounded-xl border border-slate-200/50 dark:border-slate-700/50 bg-white/50 dark:bg-slate-900/30 hover:bg-white dark:hover:bg-slate-900/50 transition-all">
      <div class="flex items-center gap-3 flex-1 min-w-0">
        <div class="flex-shrink-0">
          <svg class="w-6 h-6 text-indigo-500" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z"></path>
          </svg>
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
        <button onclick="downloadFile('${f.name}', '${userEmail}')" class="btn-ghost text-xs px-3 py-1.5 opacity-0 group-hover:opacity-100 transition-opacity" title="Download">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M4 16v1a3 3 0 003 3h10a3 3 0 003-3v-1m-4-4l-4 4m0 0l-4-4m4 4V4"></path>
          </svg>
        </button>
        <button onclick="deleteStorageFile('${f.name}', '${userEmail}')" class="text-red-500 hover:text-red-600 opacity-0 group-hover:opacity-100 transition-opacity" title="Delete">
          <svg class="w-4 h-4" fill="none" stroke="currentColor" viewBox="0 0 24 24">
            <path stroke-linecap="round" stroke-linejoin="round" stroke-width="2" d="M19 7l-.867 12.142A2 2 0 0116.138 21H7.862a2 2 0 01-1.995-1.858L5 7m5 4v6m4-6v6m1-10V4a1 1 0 00-1-1h-4a1 1 0 00-1 1v3M4 7h16"></path>
          </svg>
        </button>
      </div>
    </li>`
    )
    .join("");
}

// Global functions for file operations
window.downloadFile = async function(filename, userEmail) {
  try {
    const url = await getFileUrl(filename, userEmail);
    window.open(url, '_blank');
  } catch (err) {
    console.error('Error downloading file:', err);
    alert('Failed to download file');
  }
};

window.deleteStorageFile = async function(filename, userEmail) {
  if (!confirm(`Delete ${filename}?`)) return;
  
  try {
    // The filename is just the file name (e.g., "document.pdf")
    // We need to pass it to deleteFileFromSupabase which expects just the filename
    // It will construct the full path internally
    await deleteFileFromSupabase(filename, userEmail);
    showToast('File deleted', 'success', `${filename} has been removed`);
    
    // Refresh file list
    if (userEmail) {
      const newFiles = await fetchSupabaseFiles(userEmail);
      renderFiles({ files: newFiles, userEmail });
    }
  } catch (err) {
    console.error('Error deleting file:', err);
    showToast('Delete failed', 'error', err.message);
  }
};

// Invoices → table (advanced) + keep hidden fallback div updated
function renderInvoices({ invoices = [] }) {
  const tableBody = document.getElementById("invoicesTable");
  const fallbackDiv = document.getElementById("invoices"); // may be hidden
  const toMoney = (n) => `$${Number(n).toFixed(2)}`;

  if (tableBody) {
    tableBody.innerHTML = invoices
      .map(
        (inv) => `
      <tr class="border-t border-slate-200 dark:border-slate-800">
        <td class="py-2">${inv.number}</td>
        <td class="py-2">${inv.date}</td>
        <td class="py-2">${toMoney(inv.amount)}</td>
        <td class="py-2">${
          inv.status === "Paid"
            ? '<span class="pill-green">Paid</span>'
            : '<span class="pill-amber">Open</span>'
        }</td>
        <td class="py-2 text-right">${
          inv.status === "Paid"
            ? '<button class="btn-ghost">View</button>'
            : '<button class="btn-primary">Pay</button>'
        }</td>
      </tr>`
      )
      .join("");
  }

  if (fallbackDiv) {
    fallbackDiv.innerHTML = invoices
      .map(
        (inv) => `
      <div class="flex items-center justify-between">
        <div>
          <div class="font-medium">#${inv.number}</div>
          <div class="text-xs text-slate-500">${inv.date}</div>
        </div>
        <div class="text-right">
          <div class="font-semibold">${toMoney(inv.amount)}</div>
          <div class="text-xs ${
            inv.status === "Paid" ? "text-emerald-600" : "text-amber-600"
          }">${inv.status}</div>
        </div>
      </div>`
      )
      .join("");
  }
}

// Activity
function renderActivity({ activity = [] }) {
  const el = document.getElementById("activity");
  if (!el) return;
  el.innerHTML = activity
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
      <div>
        <div class="text-sm">${a.text}</div>
        <div class="text-xs text-slate-500">${a.when}</div>
      </div>
    </li>`
    )
    .join("");
}
// Updates
function renderUpdates({ updates = [] }) {
  const el = document.getElementById("updates");
  if (!el) return;
  el.innerHTML = updates.map(u => `
    <li>
      <div class="flex items-center justify-between">
        <div class="font-medium">${u.title}</div>
        <div class="text-xs text-slate-500">${u.when}</div>
      </div>
      <div class="text-sm text-slate-600 dark:text-slate-300">${u.body || ""}</div>
    </li>
  `).join("");
}

/* ---------------------------
   3) UX features (filters/search)
---------------------------- */
function wireFilters(fullData) {
  const btnActive = document.getElementById("filterActive");
  const btnAll = document.getElementById("filterAll");
  if (btnActive) {
    btnActive.addEventListener("click", () => {
      const active = (fullData.projects || []).filter(
        (p) =>
          !String(p.status || "").toLowerCase().includes("done") &&
          !String(p.status || "").toLowerCase().includes("complete")
      );
      renderProjects({ projects: active });
    });
  }
  if (btnAll) {
    btnAll.addEventListener("click", () => {
      renderProjects({ projects: fullData.projects || [] });
    });
  }

  const search = document.getElementById("globalSearch");
  if (search) {
    const run = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) {
        // reset full data views
        renderProjects({ projects: fullData.projects || [] });
        renderFiles({ files: fullData.files || [] });
        renderInvoices({ invoices: fullData.invoices || [] });
        renderActivity({ activity: fullData.activity || [] });
        return;
      }

      const proj = (fullData.projects || []).filter(
        (p) =>
          p.name?.toLowerCase().includes(q) ||
          p.summary?.toLowerCase().includes(q)
      );
      const files = (fullData.files || []).filter((f) =>
        f.name?.toLowerCase().includes(q)
      );
      const invoices = (fullData.invoices || []).filter(
        (i) =>
          String(i.number).toLowerCase().includes(q) ||
          String(i.status).toLowerCase().includes(q)
      );
      const activity = (fullData.activity || []).filter((a) =>
        a.text?.toLowerCase().includes(q)
      );

      renderProjects({ projects: proj });
      renderFiles({ files });
      renderInvoices({ invoices });
      renderActivity({ activity });
    };

    search.addEventListener("input", run);
  }
}

// Toast notification function
function showToast(message, type = 'success', detail = '') {
  // Create toast if it doesn't exist
  let toast = document.getElementById('fileToast');
  if (!toast) {
    toast = document.createElement('div');
    toast.id = 'fileToast';
    toast.className = 'fixed top-4 right-4 z-[3000] transform transition-all duration-500 translate-x-full opacity-0';
    toast.innerHTML = `
      <div class="bg-white/90 dark:bg-slate-900/90 backdrop-blur-2xl rounded-2xl shadow-2xl border border-white/20 dark:border-slate-700/50 px-6 py-4 min-w-[300px]">
        <div class="flex items-center gap-3">
          <div id="toastIcon" class="size-8 rounded-full flex items-center justify-center"></div>
          <div class="flex-1">
            <div id="toastMessage" class="font-medium text-slate-900 dark:text-slate-100"></div>
            <div id="toastDetail" class="text-sm text-slate-600 dark:text-slate-400"></div>
          </div>
          <button onclick="hideToast()" class="text-slate-400 hover:text-slate-600 dark:hover:text-slate-300">✕</button>
        </div>
      </div>
    `;
    document.body.appendChild(toast);
  }

  const toastIcon = document.getElementById('toastIcon');
  const toastMessage = document.getElementById('toastMessage');
  const toastDetail = document.getElementById('toastDetail');
  
  toastMessage.textContent = message;
  toastDetail.textContent = detail || '';
  
  if (type === 'success') {
    toastIcon.innerHTML = '✓';
    toastIcon.className = 'size-9 rounded-full flex items-center justify-center bg-gradient-to-br from-emerald-400 to-emerald-600 text-white shadow-lg shadow-emerald-500/50';
    toast.className = 'fixed top-4 right-4 z-[3000] transform transition-all duration-500 translate-x-0 opacity-100';
  } else if (type === 'error') {
    toastIcon.innerHTML = '✕';
    toastIcon.className = 'size-9 rounded-full flex items-center justify-center bg-gradient-to-br from-red-400 to-red-600 text-white shadow-lg shadow-red-500/50';
    toast.className = 'fixed top-4 right-4 z-[3000] transform transition-all duration-500 translate-x-0 opacity-100';
  }
  
  setTimeout(() => hideToast(), 3000);
}

function hideToast() {
  const toast = document.getElementById('fileToast');
  if (toast) {
    toast.className = 'fixed top-4 right-4 z-[3000] transform transition-all duration-500 translate-x-full opacity-0';
  }
}

window.hideToast = hideToast;

/* ---------------------------
   4) Init
---------------------------- */
(async function init() {
  const overlay = document.getElementById("loadingOverlay");
  try {
    const data = await fetchClientData();
    
    // Get user email for Supabase Storage
    const user = window.netlifyIdentity?.currentUser();
    const userEmail = user?.email || '';

    // Initialize Supabase Storage
    await initSupabase();

    renderKPIs(data);
    renderProjects({ projects: data.projects || [] });
    
    // Try to fetch Supabase files if client is initialized
    let storageFiles = [];
    if (supabaseClient && userEmail) {
      storageFiles = await fetchSupabaseFiles(userEmail);
    }
    
    renderFiles({ files: storageFiles.length > 0 ? storageFiles : (data.files || []), userEmail });
    renderInvoices({ invoices: data.invoices || [] });
    renderActivity({ activity: data.activity || [] });
    renderUpdates({ updates: data.updates || [] });

    wireFilters(data);
    
    // Wire up file upload handler
    const fileInput = document.getElementById('fileInput');
    if (fileInput && userEmail) {
      fileInput.addEventListener('change', async (e) => {
        const files = Array.from(e.target.files);
        if (files.length === 0) return;
        
        const uploadProgress = document.getElementById('uploadProgress');
        const progressBar = document.getElementById('progressBar');
        const uploadStatus = document.getElementById('uploadStatus');
        
        if (uploadProgress && progressBar && uploadStatus) {
          uploadProgress.classList.remove('hidden');
        }
        
        for (const file of files) {
          try {
            if (!supabaseClient) {
              throw new Error('Supabase Storage not configured');
            }
            
            uploadStatus.textContent = `Uploading ${file.name}...`;
            progressBar.style.width = '0%';
            
            console.log('📤 Starting file upload...', { filename: file.name, userEmail });
            
            await uploadFileToSupabase(file, userEmail);
            console.log('✅ File upload successful:', file.name);
            
            // Log client activity
            console.log('📝 Attempting to log client activity...');
            console.log('Supabase client available:', !!supabaseClient);
            console.log('Supabase client type:', typeof supabaseClient);
            
            await logClientActivity(userEmail, `Uploaded ${file.name}`, 'upload');
            console.log('📝 Activity logging attempt completed');
            
            progressBar.style.width = '100%';
            showToast('File uploaded', 'success', `${file.name} uploaded successfully`);
            
            // Refresh file list
            setTimeout(async () => {
              const newFiles = await fetchSupabaseFiles(userEmail);
              renderFiles({ files: newFiles, userEmail });
            }, 500);
          } catch (err) {
            console.error('Upload error:', err);
            showToast('Upload failed', 'error', err.message);
          }
        }
        
        if (uploadProgress) {
          uploadProgress.classList.add('hidden');
        }
        
        // Reset file input
        e.target.value = '';
      });
    }
  } catch (e) {
    console.error(e);
    alert("Failed to load dashboard. If this persists, contact Brandible.");
  } finally {
    if (overlay) overlay.style.display = "none";
  }
})();
