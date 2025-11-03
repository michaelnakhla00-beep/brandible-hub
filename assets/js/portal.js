// assets/js/portal.js

/* ---------------------------
   1) Fetch data (with Identity)
---------------------------- */
// Lazy mount helper to defer heavy renders until visible
function lazyMount(element, mountFn, threshold = 0.15) {
  if (!element || typeof mountFn !== 'function') return;
  const io = new IntersectionObserver(([entry]) => {
    if (entry.isIntersecting) {
      mountFn();
      io.disconnect();
    }
  }, { threshold });
  io.observe(element);
}

// Simple pagination state
const FILES_PAGE_SIZE = 25;
const INVOICES_PAGE_SIZE = 25;
let filesPage = 1;
let invoicesPage = 1;
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

// Profile card
function renderProfile({ id, name, email, company = '', manager = '', phone = '', website = '', profile_url = '' }) {
  const wrap = document.getElementById('profileCard');
  const emailEl = document.getElementById('userEmail');
  if (emailEl) emailEl.textContent = email || '';
  if (!wrap) return;

  const avatar = profile_url || 'https://ui-avatars.com/api/?background=635BFF&color=fff&name=' + encodeURIComponent(name || email || 'User');
  const brand = window.portalBrand || null;
  const businessType = brand?.business_type || '';
  const memberSince = window.portalClientData?.created_at ? new Date(window.portalClientData.created_at).toLocaleDateString() : '';
  const lastUpdate = window.portalClientData?.last_update || '';

  wrap.classList.add('rounded-2xl','p-2');
  wrap.innerHTML = `
    <img src="${avatar}" alt="Avatar" class="w-24 h-24 rounded-full object-cover border-2 border-indigo-500 shadow flex-shrink-0"/>
    <div class="flex-1 text-center sm:text-left w-full sm:w-auto">
      <div class="text-lg font-semibold">${name || ''}${company ? ' • ' + company : ''}</div>
      <div class="text-sm text-slate-500 dark:text-slate-400">${manager ? 'Manager: ' + manager + ' · ' : ''}${email}${phone ? ' · ' + phone : ''}${website ? ' · <a class=\"underline\" href=\"' + website + '\" target=\"_blank\">Website</a>' : ''}</div>
      <div class="text-xs text-slate-500 dark:text-slate-400 mt-1 flex flex-wrap gap-2">
        ${businessType ? `<span class="pill-slate">${businessType}</span>` : ''}
        ${memberSince ? `<span class="pill-slate">Member since ${memberSince}</span>` : ''}
        ${lastUpdate ? `<span class="pill-slate">Last update ${lastUpdate}</span>` : ''}
      </div>
    </div>
    <div class="hidden"></div>
  `;
}

// Projects → Kanban columns; also mirrors a simple list if #projects exists
function renderProjects({ projects = [] }) {
  // Advanced columns
  const colProgress = document.getElementById("col-progress");
  const colReview   = document.getElementById("col-review");
  const colDone     = document.getElementById("col-done");

  const cardHTML = (p, index) => {
    // Determine status badge class
    let statusClass = "status-inprogress";
    let statusText = p.status || "In Progress";
    
    if (p.status && (p.status.toLowerCase().includes("done") || p.status.toLowerCase().includes("complete"))) {
      statusClass = "status-done";
      statusText = "Done";
    } else if (p.status && p.status.toLowerCase().includes("review")) {
      statusClass = "status-review";
      statusText = "Review";
    } else {
      statusClass = "status-inprogress";
      statusText = "In Progress";
    }
    
    // Get progress percent (will be updated via loadProjectProgress)
    const progressPercent = p.progress_percent || 0;
    
    return `
      <div class="project-card cursor-pointer" data-index='${index}' data-project='${JSON.stringify({ name: p.name, summary: p.summary || '', status: statusText, links: p.links || [], progress_percent: progressPercent }).replace(/'/g, "&#39;")}'>
        <div class="project-title">${p.name}</div>
        ${p.summary ? `<div class="project-desc">${p.summary}</div>` : ""}
        <div class="mt-2">
          <div class="flex items-center justify-between text-xs mb-1">
            <span class="text-slate-600 dark:text-slate-400">Progress</span>
            <span class="font-semibold text-purple-600 dark:text-purple-400">${progressPercent}%</span>
          </div>
          <div class="w-full bg-slate-200 dark:bg-slate-800 rounded-full h-2">
            <div class="bg-gradient-to-r from-indigo-600 via-purple-600 to-pink-600 h-2 rounded-full transition-all project-progress-bar" style="width: ${progressPercent}%"></div>
          </div>
        </div>
      <div class="flex items-center justify-between mt-2">
          <span class="status-badge ${statusClass}">${statusText}</span>
      </div>
      <div class="mt-3">
        <button class="btn-ghost btn-sm view-timeline" data-name="${(p.name || '').replace(/"/g,'&quot;')}">View Timeline & Deliverables</button>
      </div>
      <div class="mt-3 hidden" data-role="timeline-wrap">
        <div class="p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 bg-white/60 dark:bg-slate-900/40">
          <div class="text-sm font-semibold mb-2">Timeline</div>
          <div class="space-y-2" data-role="phases"></div>
          <div class="text-sm font-semibold mt-3 mb-2">Deliverables</div>
          <ul class="space-y-1" data-role="deliverables"></ul>
        </div>
      </div>
      ${
        p.links?.length
            ? `<div class="mt-2 flex flex-wrap gap-2">${p.links
              .map(
                (l) =>
                  `<a class="chip" href="${l.url}" target="_blank" rel="noopener">${l.label}</a>`
              )
              .join("")}</div>`
          : ""
      }
    </div>
  `;
  };

  if (colProgress && colReview && colDone) {
    colProgress.innerHTML = "";
    colReview.innerHTML = "";
    colDone.innerHTML = "";

    projects.forEach((p, idx) => {
      const status = (p.status || "In Progress").toLowerCase();
      if (status.includes("done") || status.includes("complete")) {
        colDone.insertAdjacentHTML("beforeend", cardHTML(p, idx));
      } else if (status.includes("review")) {
        colReview.insertAdjacentHTML("beforeend", cardHTML(p, idx));
      } else {
        colProgress.insertAdjacentHTML("beforeend", cardHTML(p, idx));
      }
    });

    // Wire clicks to open client project modal
    document.querySelectorAll('.project-card[data-index]').forEach((el) => {
      el.addEventListener('click', () => {
        const i = Number(el.getAttribute('data-index')) || 0;
        if (window.openClientProjectModal && window.portalClientData) {
          window.openClientProjectModal(window.portalClientData, i);
        }
      });
    });

    // Wire timeline/deliverables buttons (stop propagation to avoid opening modal)
    document.querySelectorAll('.project-card .view-timeline').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const card = e.currentTarget.closest('.project-card');
        const wrap = card.querySelector('[data-role="timeline-wrap"]');
        wrap.classList.toggle('hidden');
        if (!wrap.dataset.loaded) {
          await renderProjectTimelineDeliverables(card, btn.getAttribute('data-name'));
          wrap.dataset.loaded = '1';
        }
      });
    });
  }

  // No fallback - always use kanban columns if they exist
  // If columns don't exist, projects will just not render (which is fine)
}

// Wire up collapsible project sections
function wireCollapsibleSections() {
  const sections = ['progress', 'review', 'done'];
  
  sections.forEach(section => {
    const button = document.querySelector(`[data-collapse-target="${section}"]`);
    const content = document.querySelector(`[data-collapse-content="${section}"]`);
    const icon = document.querySelector(`[data-collapse-icon="${section}"]`);
    
    if (!button || !content || !icon) return;
    
    // Calculate actual content height
    function getContentHeight() {
      const inner = content.querySelector('div');
      return inner ? inner.scrollHeight + 32 : 0; // padding
    }
    
    // Update max-height based on current state
    function updateHeight(isOpen) {
      if (isOpen) {
        const height = getContentHeight();
        content.style.maxHeight = `${height}px`;
        icon.style.transform = 'rotate(0deg)';
      } else {
        content.style.maxHeight = '0px';
        icon.style.transform = 'rotate(180deg)';
      }
    }
    
    // Initial state: only "progress" is open
    const isInitiallyOpen = section === 'progress';
    updateHeight(isInitiallyOpen);
    
    // Toggle on click
    button.addEventListener('click', () => {
      const isCurrentlyOpen = content.style.maxHeight !== '0px' && content.style.maxHeight !== '';
      updateHeight(!isCurrentlyOpen);
    });
    
    // Update height when content changes (dynamic content)
    const observer = new MutationObserver(() => {
      if (content.style.maxHeight !== '0px' && content.style.maxHeight !== '') {
        const height = getContentHeight();
        content.style.maxHeight = `${height}px`;
      }
    });
    
    observer.observe(content, { childList: true, subtree: true });
  });
}

// Files - Supabase Storage
let supabaseClient = null;
let portalInvoices = [];

async function getPortalAuthToken() {
  const id = window.netlifyIdentity;
  const user = id && id.currentUser();
  if (!user) return null;
  try {
    return await user.jwt();
  } catch (err) {
    console.warn('Failed to fetch portal auth token:', err);
    return null;
  }
}

// Sanitize email for use in file paths (replace @ and . with _)
function sanitizeEmail(email) {
  if (!email) return '';
  return email.replace(/[^a-zA-Z0-9]/g, '_');
}

// Store Supabase config globally
let supabaseConfig = { url: null, anonKey: null };

// Get an authenticated Supabase client for database operations
async function getAuthenticatedSupabaseClient() {
  if (!supabaseConfig.url || !supabaseConfig.anonKey) {
    console.error('❌ Supabase config not initialized');
    return null;
  }
  
  // Get JWT token from Netlify Identity
  const token = await new Promise((resolve) => {
    const id = window.netlifyIdentity;
    const user = id && id.currentUser();
    if (!user) {
      console.warn('⚠️ No user logged in');
      return resolve(null);
    }
    user.jwt().then(resolve).catch(() => {
      console.warn('⚠️ Failed to get JWT token');
      resolve(null);
    });
  });
  
  if (!token) {
    console.error('❌ No JWT token available');
    return null;
  }
  
  // Create a Supabase client with auth headers for database operations
  return window.supabase.createClient(supabaseConfig.url, supabaseConfig.anonKey, {
    global: {
      headers: { Authorization: `Bearer ${token}` }
    }
  });
}

async function initSupabase() {
  if (!window.supabase) {
    console.error('❌ Supabase client library not loaded');
    return false;
  }
  
  try {
    const res = await fetch('/.netlify/functions/get-storage-config');
    const config = await res.json();
    
    console.log('📦 Supabase config retrieved:', {
      url: config.url ? 'Yes' : 'No',
      anonKey: config.anonKey ? 'Yes' : 'No'
    });
    
    if (config.url && config.anonKey) {
      // Store config globally
      supabaseConfig.url = config.url;
      supabaseConfig.anonKey = config.anonKey;
      
      // Initialize Supabase client WITHOUT auth headers for public Storage bucket
      supabaseClient = window.supabase.createClient(config.url, config.anonKey);
      
      console.log('✅ Supabase Storage initialized (public bucket, no auth)');
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

// ---------------- Notifications -----------------
async function loadNotifications() {
  const token = await getPortalAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/.netlify/functions/get-notifications', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) throw new Error('Failed');
    const { notifications } = await res.json();
    const list = document.getElementById('notificationsList');
    const badge = document.getElementById('unreadBadge');
    const unread = (notifications || []).filter(n => !n.is_read).length;
    if (badge) badge.textContent = unread;
    if (list) {
      list.innerHTML = (notifications || []).map(n => `
        <li data-id="${n.id}" class="p-3 rounded-xl border border-slate-200/60 dark:border-slate-700/60 cursor-pointer ${n.is_read ? '' : 'bg-slate-50 dark:bg-slate-800/40'}">
          <div class="text-sm">${n.message}</div>
          <div class="text-xs text-slate-500 mt-1">${new Date(n.created_at).toLocaleString()}</div>
        </li>`).join('');
      // Wire mark-as-read on click
      list.querySelectorAll('li[data-id]').forEach(li => {
        li.addEventListener('click', async () => {
          const id = li.getAttribute('data-id');
          try {
            const token2 = await getPortalAuthToken();
            await fetch('/.netlify/functions/mark-notification-read', {
              method: 'POST',
              headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token2}` },
              body: JSON.stringify({ id })
            });
            await loadNotifications();
          } catch (err) { console.error('mark read failed', err); }
        });
      });
    }
  } catch (e) {
    console.error('notifications error', e);
  }
}

// ---------------- Account Settings -----------------
async function loadUserSettings() {
  const token = await getPortalAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/.netlify/functions/get-user-settings', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const { settings } = await res.json();
    const emailCb = document.getElementById('settingEmailNotifications');
    const invCb = document.getElementById('settingInvoiceReminders');
    if (emailCb) emailCb.checked = !!settings.email_notifications;
    if (invCb) invCb.checked = !!settings.invoice_reminders;

    // Contact info fields from current user data
    const phoneEl = document.getElementById('accountPhone');
    const webEl = document.getElementById('accountWebsite');
    if (phoneEl) phoneEl.value = window.portalClientData?.phone || '';
    if (webEl) webEl.value = window.portalClientData?.website || '';
    const joinedEl = document.getElementById('accountJoined');
    const lastEl = document.getElementById('accountLastUpdate');
    if (joinedEl) joinedEl.value = window.portalClientData?.created_at ? new Date(window.portalClientData.created_at).toLocaleDateString() : '';
    if (lastEl) lastEl.value = window.portalClientData?.last_update || '';
  } catch (e) {
    console.error('settings error', e);
  }
}

async function saveUserSettings() {
  const token = await getPortalAuthToken();
  if (!token) return;
  const saveBtn = document.getElementById('saveSettingsBtn');
  const originalText = saveBtn?.textContent;
  if (saveBtn) {
    saveBtn.disabled = true;
    saveBtn.textContent = 'Saving...';
  }
  try {
    const body = {
      email_notifications: document.getElementById('settingEmailNotifications')?.checked || false,
      invoice_reminders: document.getElementById('settingInvoiceReminders')?.checked || false,
    };
    const res = await fetch('/.netlify/functions/update-user-settings', {
      method: 'POST', headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, body: JSON.stringify(body)
    });
    if (!res.ok) throw new Error('Failed to save settings');

    // Save contact info (phone, website) to client profile
    const contact = {
      fields: {
        phone: document.getElementById('accountPhone')?.value || null,
        website: document.getElementById('accountWebsite')?.value || null
      }
    };
    const contactRes = await fetch('/.netlify/functions/update-client-profile', { 
      method: 'POST', 
      headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` }, 
      body: JSON.stringify(contact) 
    });
    if (!contactRes.ok) throw new Error('Failed to save contact info');

    // Refresh client data to get updated values
    await refreshClientData();
    
    // Reload settings in modal to show updated values
    await loadUserSettings();
    
    if (window.showToast) window.showToast('Settings saved', 'success');
  } catch (e) { 
    console.error('save settings error', e);
    if (window.showToast) window.showToast('Failed to save settings', 'error', e.message);
  } finally {
    if (saveBtn) {
      saveBtn.disabled = false;
      saveBtn.textContent = originalText || 'Save Settings';
    }
  }
}

// ---------------- Brand Info -----------------
async function loadBrandInfo() {
  const token = await getPortalAuthToken();
  if (!token) return;
  try {
    const res = await fetch('/.netlify/functions/get-brand-profile', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return;
    const { brand } = await res.json();
    if (!brand) return;
    window.portalBrand = brand;
    const logo = document.getElementById('brandLogo');
    const colors = document.getElementById('brandColors');
    const fonts = document.getElementById('brandFonts');
    const aud = document.getElementById('brandAudience');
    const biz = document.getElementById('accountBusinessType');
    if (logo && brand.logo_url) logo.src = brand.logo_url;
    if (fonts) fonts.textContent = brand.brand_fonts || '—';
    if (aud) aud.textContent = brand.target_audience || '—';
    if (biz) biz.value = brand.business_type || brand.brand_type || '';
    if (colors) {
      const arr = Array.isArray(brand.brand_colors) ? brand.brand_colors : [];
      colors.innerHTML = arr.map(c => `<span class="inline-block w-6 h-6 rounded-lg border border-slate-300" style="background:${c}"></span>`).join('');
    }
  } catch (e) { console.error('brand info error', e); }
}

// Resolve project id by title (from Supabase projects)
async function resolveProjectIdByName(name) {
  try {
    const token = await getPortalAuthToken();
    if (!token) return null;
    const res = await fetch('/.netlify/functions/get-projects', { headers: { Authorization: `Bearer ${token}` } });
    if (!res.ok) return null;
    const projects = await res.json();
    const found = (projects || []).find(p => (p.title || '').toLowerCase() === (name || '').toLowerCase());
    return found ? found.id : null;
  } catch { return null; }
}

async function renderProjectTimelineDeliverables(cardEl, projectName) {
  const wrap = cardEl.querySelector('[data-role="timeline-wrap"]');
  if (!wrap) return;
  const phasesEl = wrap.querySelector('[data-role="phases"]');
  const delivEl = wrap.querySelector('[data-role="deliverables"]');
  const projectId = await resolveProjectIdByName(projectName);
  if (!projectId) {
    phasesEl.innerHTML = '<div class="text-xs text-slate-500">No phases found</div>';
    delivEl.innerHTML = '<li class="text-xs text-slate-500">No deliverables found</li>';
    return;
  }
  const token = await getPortalAuthToken();
  try {
    const [phasesRes, delivRes] = await Promise.all([
      fetch(`/.netlify/functions/get-project-phases?project_id=${projectId}`, { headers: { Authorization: `Bearer ${token}` } }),
      fetch(`/.netlify/functions/get-project-deliverables?project_id=${projectId}`, { headers: { Authorization: `Bearer ${token}` } })
    ]);
    const phasesJson = phasesRes.ok ? await phasesRes.json() : { phases: [] };
    const delivJson = delivRes.ok ? await delivRes.json() : { deliverables: [] };
    const phases = phasesJson.phases || [];
    const deliverables = delivJson.deliverables || [];

    // Render phases horizontally
    phasesEl.innerHTML = phases.map(ph => {
      const color = ph.status === 'done' ? 'bg-green-500' : ph.status === 'active' ? 'bg-indigo-500' : 'bg-slate-400';
      return `<div class="text-xs">
        <div class="flex items-center justify-between">
          <span class="font-medium">${ph.phase_name}</span>
          <span class="text-slate-500">${ph.start_date || ''} → ${ph.end_date || ''}</span>
        </div>
        <div class="w-full h-2 bg-slate-200 dark:bg-slate-800 rounded-full mt-1">
          <div class="h-2 ${color} rounded-full" style="width: 100%"></div>
        </div>
      </div>`;
    }).join('') || '<div class="text-xs text-slate-500">No phases yet</div>';

    // Render deliverables checklist (read-only)
    delivEl.innerHTML = deliverables.map(d => `
      <li class="flex items-center gap-2 text-sm">
        <input type="checkbox" disabled ${d.is_complete ? 'checked' : ''} class="rounded"/>
        <span>${d.title}</span>
      </li>
    `).join('') || '<li class="text-xs text-slate-500">No deliverables yet</li>';
  } catch (e) {
    phasesEl.innerHTML = '<div class="text-xs text-rose-500">Failed to load phases</div>';
    delivEl.innerHTML = '<li class="text-xs text-rose-500">Failed to load deliverables</li>';
  }
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
  const safeName = makeSafeStorageKey(file.name) || `file_${Date.now()}`;
  const filePath = `${safeEmail}/${Date.now()}-${safeName}`;
  
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

// Make a storage-safe key (strip unsupported chars, compress whitespace)
function makeSafeStorageKey(name) {
  return String(name)
    .trim()
    .replace(/\s+/g, '_')
    .replace(/[^a-zA-Z0-9._-]/g, '');
}

// Global refresh helper
async function refreshClientData() {
  try {
    const user = window.netlifyIdentity?.currentUser();
    if (!user) throw new Error('Not authenticated');
    const res = await fetch('/.netlify/functions/get-client');
    if (!res.ok) throw new Error(`Refresh failed ${res.status}`);
    const latest = await res.json();
    // Update global client data so modal can access updated values
    window.portalClientData = latest;
    renderKPIs(latest);
    renderProfile({
      id: latest.id,
      name: latest.name,
      email: latest.email,
      company: latest.company,
      manager: latest.manager,
      phone: latest.phone,
      website: latest.website,
      profile_url: latest.profile_url
    });
    renderProjects({ projects: latest.projects || [] });
    wireCollapsibleSections();
    if (latest.projects && latest.projects.length > 0) {
      await loadProjectProgress(latest.projects);
    }
    // Prefer fresh storage list where possible
    const userEmail = user?.email || '';
    let storageFiles = [];
    if (supabaseClient && userEmail) {
      storageFiles = await fetchSupabaseFiles(userEmail);
    }
    renderFiles({ files: storageFiles.length > 0 ? storageFiles : (latest.files || []), userEmail });
    await loadPortalInvoices();
    renderActivity({ activity: latest.activity || [] });
    showToast('Client data refreshed!');
  } catch (err) {
    console.error('Manual refresh failed:', err);
  }
}
window.refreshClientData = refreshClientData;

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
  
  console.log('🧪 Testing activity log...', { userEmail });
  
  if (!supabaseClient) {
    console.error('❌ Supabase client not initialized');
    return;
  }
  
  // Try to insert a test record
  const testActivity = `Test activity at ${new Date().toISOString()}`;
  
  console.log('📝 Inserting test activity...', { client_email: userEmail, activity: testActivity, type: 'test' });
  
  const { data, error } = await supabaseClient
    .from('client_activity')
    .insert([{ 
      client_email: userEmail, 
      activity: testActivity, 
      type: 'test' 
    }]);
  
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
    console.log("Attempting to log activity:", clientEmail, activity, type);
    
    // Use non-authenticated Supabase client (with public policy)
    if (!supabaseClient) {
      console.error('❌ Supabase client not initialized');
      return;
    }
    
    console.log('📝 Inserting activity into client_activity table...');
    const timestamp = new Date().toISOString();
    console.log('Insert payload:', { 
      client_email: clientEmail, 
      activity, 
      type,
      timestamp
    });
    
    // Insert activity using non-authenticated Supabase client
    const { data, error } = await supabaseClient
      .from('client_activity')
      .insert([{ 
        client_email: clientEmail, 
        activity: activity, 
        type: type,
        timestamp: timestamp
      }]);
    
    if (error) {
      console.error("Activity insert error:", error.message);
      console.error('Error details:', {
        message: error.message,
        details: error.details,
        hint: error.hint,
        code: error.code
      });
    } else {
      console.log("Activity insert success:", data);
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
  const loadMoreBtn = document.getElementById('filesLoadMore');
  
  if (!el) return;
  
  if (files.length === 0) {
    el.innerHTML = '';
    if (emptyState) emptyState.style.display = 'block';
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    return;
  }
  
  if (emptyState) emptyState.style.display = 'none';
  const sliceEnd = filesPage * FILES_PAGE_SIZE;
  const visible = files.slice(0, sliceEnd);
  
  el.innerHTML = visible
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

  if (loadMoreBtn) {
    if (files.length > sliceEnd) {
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = () => {
        filesPage += 1;
        renderFiles({ files, userEmail });
      };
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }
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

function formatInvoiceCurrencyPortal(amount, currency = 'usd') {
  try {
    return new Intl.NumberFormat('en-US', {
      style: 'currency',
      currency: currency.toUpperCase(),
    }).format(Number(amount) || 0);
  } catch {
    return `$${Number(amount || 0).toFixed(2)}`;
  }
}

function formatInvoiceDatePortal(value) {
  if (!value) return '—';
  const date = new Date(value);
  if (Number.isNaN(date.getTime())) return '—';
  return date.toLocaleDateString();
}

function renderInvoiceStatusPill(status) {
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
      return '<span class="pill-slate">Uncollectible</span>';
    default:
      return `<span class="pill-slate">${status || 'Unknown'}</span>`;
  }
}

function renderInvoices(invoices = portalInvoices) {
  const tableBody = document.getElementById('invoicesTable');
  const emptyState = document.getElementById('invoicesEmptyState');
  const loadMoreBtn = document.getElementById('invoicesLoadMore');
  if (!tableBody) return;

  if (!invoices.length) {
    tableBody.innerHTML = '';
    if (emptyState) emptyState.classList.remove('hidden');
    if (loadMoreBtn) loadMoreBtn.classList.add('hidden');
    return;
  }

  if (emptyState) emptyState.classList.add('hidden');

  const sliceEnd = invoicesPage * INVOICES_PAGE_SIZE;
  const visible = invoices.slice(0, sliceEnd);

  tableBody.innerHTML = visible
    .map((inv) => {
      const payButton = inv.hosted_url && inv.status !== 'paid'
        ? `<button class="btn-primary text-xs" data-action="pay" data-id="${inv.id}">Pay</button>`
        : '';
      const pdfButtonText = inv.pdf_url ? 'View PDF' : 'Generate PDF';
      const pdfButton = `<button class="btn-ghost text-xs" data-action="pdf" data-id="${inv.id}">${pdfButtonText}</button>`;
      return `
        <tr class="hover:bg-slate-50 dark:hover:bg-slate-800/40 transition-colors">
          <td class="py-3 px-4 font-medium text-slate-700 dark:text-slate-200">${inv.number || '—'}</td>
          <td class="py-3 px-4 text-slate-500">${formatInvoiceDatePortal(inv.issued_at)}</td>
          <td class="py-3 px-4">${renderInvoiceStatusPill(inv.status)}</td>
          <td class="py-3 px-4 font-medium">${formatInvoiceCurrencyPortal(inv.total, inv.currency)}</td>
          <td class="py-3 px-4">
            <div class="flex items-center justify-end gap-2">
              ${payButton}
              ${pdfButton}
              <button class="btn-ghost text-xs" data-action="view" data-id="${inv.id}">View</button>
            </div>
          </td>
        </tr>
      `;
    })
    .join('');

  tableBody.querySelectorAll('button[data-action="pay"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const invoiceId = btn.getAttribute('data-id');
      const invoice = portalInvoices.find((inv) => String(inv.id) === String(invoiceId));
      if (invoice?.hosted_url) window.open(invoice.hosted_url, '_blank');
    });
  });

  tableBody.querySelectorAll('button[data-action="view"]').forEach((btn) => {
    btn.addEventListener('click', () => {
      const invoiceId = btn.getAttribute('data-id');
      const invoice = portalInvoices.find((inv) => String(inv.id) === String(invoiceId));
      if (invoice) openInvoiceDetailModal(invoice);
    });
  });

  tableBody.querySelectorAll('button[data-action="pdf"]').forEach((btn) => {
    btn.addEventListener('click', async () => {
      const invoiceId = btn.getAttribute('data-id');
      const invoice = portalInvoices.find((inv) => String(inv.id) === String(invoiceId));
      if (!invoice) {
        showToast('Invoice not found', 'error');
        return;
      }
      btn.disabled = true;
      const originalText = btn.textContent;
      btn.textContent = 'Preparing…';
      try {
        const url = await viewPortalInvoicePdf(invoice);
        if (url) btn.textContent = 'View PDF';
      } finally {
        btn.disabled = false;
        if (!invoice.pdf_url) btn.textContent = originalText;
      }
    });
  });

  if (loadMoreBtn) {
    if (invoices.length > sliceEnd) {
      loadMoreBtn.classList.remove('hidden');
      loadMoreBtn.onclick = () => {
        invoicesPage += 1;
        renderInvoices(invoices);
      };
    } else {
      loadMoreBtn.classList.add('hidden');
    }
  }
}

function renderInvoiceDetailAttachments(attachments = []) {
  const container = document.getElementById('invoiceDetailAttachments');
  const list = document.getElementById('invoiceDetailAttachmentList');
  if (!container || !list) return;

  if (!attachments.length) {
    container.classList.add('hidden');
    list.innerHTML = '';
    return;
  }

  container.classList.remove('hidden');
  list.innerHTML = attachments
    .map((file) => `
      <li class="flex items-center justify-between text-sm text-slate-600 dark:text-slate-300">
        <span class="truncate">${file.name || 'Attachment'}</span>
        <a class="btn-ghost text-xs" href="${file.url}" target="_blank" rel="noopener">Open</a>
      </li>
    `)
    .join('');
}

function openInvoiceDetailModal(invoice) {
  const modal = document.getElementById('invoiceDetailModal');
  if (!modal) return;

  const { meta = {} } = invoice;
  const subtotal = invoice.subtotal || 0;
  const tax = invoice.tax || 0;
  const discountAmount = meta.discountAmount || 0;
  const total = invoice.total || subtotal + tax - discountAmount;
  const fallbackClient = window.portalClientData || {};

  document.getElementById('invoiceDetailNumber').textContent = invoice.number || '—';
  document.getElementById('invoiceDetailDate').textContent = formatInvoiceDatePortal(invoice.issued_at);
  document.getElementById('invoiceDetailStatus').innerHTML = renderInvoiceStatusPill(invoice.status);
  document.getElementById('invoiceDetailTotal').textContent = formatInvoiceCurrencyPortal(total, invoice.currency);
  document.getElementById('invoiceDetailClient').textContent = invoice.clients?.name || fallbackClient.name || 'Your company';
  document.getElementById('invoiceDetailEmail').textContent = invoice.clients?.email || fallbackClient.email || '';

  const itemsContainer = document.getElementById('invoiceDetailItems');
  itemsContainer.innerHTML = (invoice.invoice_items || [])
    .map((item) => {
      const lineTotal = (Number(item.quantity) || 0) * (Number(item.unit_amount) || 0);
      return `
        <tr>
          <td class="py-3 px-4">${item.description || 'Line item'}</td>
          <td class="py-3 px-4 text-right">${Number(item.quantity) || 0}</td>
          <td class="py-3 px-4 text-right">${formatInvoiceCurrencyPortal(item.unit_amount, invoice.currency)}</td>
          <td class="py-3 px-4 text-right font-medium">${formatInvoiceCurrencyPortal(lineTotal, invoice.currency)}</td>
        </tr>
      `;
    })
    .join('');

  document.getElementById('invoiceDetailSubtotal').textContent = formatInvoiceCurrencyPortal(subtotal, invoice.currency);
  document.getElementById('invoiceDetailTax').textContent = formatInvoiceCurrencyPortal(tax, invoice.currency);
  document.getElementById('invoiceDetailDiscount').textContent = formatInvoiceCurrencyPortal(-discountAmount, invoice.currency);
  document.getElementById('invoiceDetailGrandTotal').textContent = formatInvoiceCurrencyPortal(total, invoice.currency);

  renderInvoiceDetailAttachments(meta.attachments || []);

  const pdfLink = document.getElementById('invoiceDetailPdf');
  if (pdfLink) {
    pdfLink.classList.remove('hidden');
    pdfLink.textContent = invoice.pdf_url ? 'View PDF' : 'Generate PDF';
    pdfLink.href = invoice.pdf_url || '#';
    pdfLink.onclick = async (e) => {
      e.preventDefault();
      const url = await viewPortalInvoicePdf(invoice);
      if (url) {
        pdfLink.href = url;
        pdfLink.textContent = 'View PDF';
      }
    };
  }

  const payBtn = document.getElementById('invoiceDetailPay');
  if (invoice.hosted_url && invoice.status !== 'paid') {
    payBtn.classList.remove('hidden');
    payBtn.onclick = () => window.open(invoice.hosted_url, '_blank');
  } else {
    payBtn.classList.add('hidden');
    payBtn.onclick = null;
  }

  modal.classList.remove('hidden');
}

function closeInvoiceDetailModal() {
  const modal = document.getElementById('invoiceDetailModal');
  if (modal) modal.classList.add('hidden');
}

async function requestPortalInvoicePdf(invoice, { store = true } = {}) {
  const token = await getPortalAuthToken();
  const res = await fetch('/.netlify/functions/generate-invoice-pdf', {
    method: 'POST',
    headers: {
      'Content-Type': 'application/json',
      ...(token ? { Authorization: `Bearer ${token}` } : {}),
    },
    body: JSON.stringify({ invoiceId: invoice.id, store }),
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

async function viewPortalInvoicePdf(invoice) {
  try {
    const existingUrl = invoice.pdf_url || invoice.meta?.pdfUrl;
    if (existingUrl) {
      window.open(existingUrl, '_blank');
      return existingUrl;
    }

    const url = await requestPortalInvoicePdf(invoice, { store: true });
    if (url) {
      invoice.pdf_url = url;
      if (!invoice.meta) invoice.meta = {};
      invoice.meta.pdfUrl = url;
      window.open(url, '_blank');
    }
    return url;
  } catch (err) {
    console.error('viewPortalInvoicePdf error:', err);
    showToast('Unable to open invoice PDF', 'error', err.message);
    return null;
  }
}

const closeInvoiceDetailTrigger = document.getElementById('closeInvoiceDetail');
if (closeInvoiceDetailTrigger) closeInvoiceDetailTrigger.addEventListener('click', closeInvoiceDetailModal);
const invoiceDetailCloseBtn = document.getElementById('invoiceDetailCloseBtn');
if (invoiceDetailCloseBtn) invoiceDetailCloseBtn.addEventListener('click', closeInvoiceDetailModal);
const invoiceDetailModalEl = document.getElementById('invoiceDetailModal');
if (invoiceDetailModalEl) {
  invoiceDetailModalEl.addEventListener('click', (event) => {
    if (event.target === invoiceDetailModalEl) closeInvoiceDetailModal();
  });
}

async function loadPortalInvoices() {
  try {
    const token = await getPortalAuthToken();

    const res = await fetch('/.netlify/functions/get-invoices', {
      headers: token ? { Authorization: `Bearer ${token}` } : {},
    });
    if (!res.ok) throw new Error(`Failed to load invoices (${res.status})`);
    const data = await res.json();
    const baseClient = window.portalClientData || {};
    portalInvoices = (data.invoices || []).map((inv) => ({
      ...inv,
      pdf_url: inv.pdf_url || inv.meta?.pdfUrl || null,
      clients: inv.clients || {
        name: baseClient.name || '',
        email: baseClient.email || '',
      },
    }));
  } catch (err) {
    console.error('loadPortalInvoices error:', err);
    portalInvoices = [];
  }
  renderInvoices();
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
      // Add active state styling
      btnActive.classList.add("bg-indigo-100", "dark:bg-indigo-900/30", "text-indigo-700", "dark:text-indigo-300");
      btnActive.classList.remove("hover:bg-slate-100/50", "dark:hover:bg-slate-800/50");
      if (btnAll) {
        btnAll.classList.remove("bg-indigo-100", "dark:bg-indigo-900/30", "text-indigo-700", "dark:text-indigo-300");
        btnAll.classList.add("hover:bg-slate-100/50", "dark:hover:bg-slate-800/50");
      }
      
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
      // Add active state styling
      btnAll.classList.add("bg-indigo-100", "dark:bg-indigo-900/30", "text-indigo-700", "dark:text-indigo-300");
      btnAll.classList.remove("hover:bg-slate-100/50", "dark:hover:bg-slate-800/50");
      if (btnActive) {
        btnActive.classList.remove("bg-indigo-100", "dark:bg-indigo-900/30", "text-indigo-700", "dark:text-indigo-300");
        btnActive.classList.add("hover:bg-slate-100/50", "dark:hover:bg-slate-800/50");
      }
      
      renderProjects({ projects: fullData.projects || [] });
    });
  }
  
  // Set "Active" as default active on load (matches auto-expanded In Progress)
  if (btnActive) {
    btnActive.click();
  }

  const search = document.getElementById("globalSearch");
  if (search) {
    const run = () => {
      const q = search.value.trim().toLowerCase();
      if (!q) {
        // reset full data views
        renderProjects({ projects: fullData.projects || [] });
        renderFiles({ files: fullData.files || [] });
        renderInvoices();
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
      const invoices = (portalInvoices || []).filter(
        (i) =>
          String(i.number).toLowerCase().includes(q) ||
          String(i.status).toLowerCase().includes(q)
      );
      const activity = (fullData.activity || []).filter((a) =>
        a.text?.toLowerCase().includes(q)
      );

      renderProjects({ projects: proj });
      renderFiles({ files });
      renderInvoices(invoices);
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
   NEW FEATURES: Welcome, Profile Completion, Progress, Comments, Feedback, Resources
---------------------------- */

// Welcome Header with First Name
function renderWelcomeHeader(clientData) {
  const welcomeEl = document.getElementById('welcomeMessage');
  if (!welcomeEl || !clientData) return;
  const fullName = clientData.name || clientData.company || 'there';
  welcomeEl.textContent = `Welcome back, ${fullName} 👋`;
}

// Fetch and render profile completion
async function loadProfileCompletion(clientData) {
  const token = await getPortalAuthToken();
  if (!token) return;
  
  try {
    const res = await fetch('/.netlify/functions/get-client-profile', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) throw new Error('Failed to fetch profile');
    const { completion_percentage, missing_items } = await res.json();
    
    const barEl = document.getElementById('profileCompletionBar');
    const percentEl = document.getElementById('profileCompletionPercent');
    const missingEl = document.getElementById('profileCompletionMissing');
    
    if (barEl) barEl.style.width = `${completion_percentage}%`;
    if (percentEl) percentEl.textContent = `${completion_percentage}%`;
    
    if (missingEl && missing_items && missing_items.length > 0) {
      const map = {
        brand_logo: {
          label: 'Upload brand logo',
          action: () => document.getElementById('openChangePhoto')?.click(),
          hint: 'Add your logo so documents and invoices are branded.'
        },
        questionnaire: {
          label: 'Complete brand questionnaire',
          action: () => openQuestionnaire(),
          hint: 'Tell us more about your brand so we can tailor work.'
        },
        files: {
          label: 'Upload files',
          action: () => document.getElementById('filesCard')?.scrollIntoView({ behavior: 'smooth' }),
          hint: 'Share assets like logos, photos, or copy.'
        },
        contact_info: {
          label: 'Add contact information',
          action: () => document.getElementById('openAccountSettingsBtn')?.click(),
          hint: 'Make sure we can reach you with updates.'
        }
      };
      missingEl.innerHTML = missing_items.map(key => {
        const item = map[key] || { label: key, hint: '' };
        return `<button class="btn-link" data-missing="${key}" title="${item.hint}">📝 ${item.label}</button>`;
      }).join(' ');
      missingEl.querySelectorAll('button[data-missing]').forEach(btn => {
        btn.addEventListener('click', () => {
          const key = btn.getAttribute('data-missing');
          const conf = map[key];
          if (conf && typeof conf.action === 'function') conf.action();
        });
      });
    } else if (missingEl) {
      // 100% complete state
      const wrapper = document.getElementById('profileCompletion');
      if (wrapper) {
        const barContainer = wrapper.querySelector('.w-full.bg-slate-200');
        if (barContainer) barContainer.classList.add('hidden');
      }
      missingEl.innerHTML = '<div class="flex items-center gap-2 text-green-600 dark:text-green-400"><span class="text-xl animate-pulse">✅</span><span>Profile Complete! You\'re all set.</span></div>';
    }
  } catch (err) {
    console.error('Failed to load profile completion:', err);
  }
}

// Update project cards to include progress bars
function updateProjectCardWithProgress(project, progressPercent) {
  const cards = document.querySelectorAll(`.project-card[data-project]`);
  cards.forEach(card => {
    const projectData = JSON.parse(card.getAttribute('data-project') || '{}');
    if (projectData.name === project.name || projectData.name === project.title) {
      // Update progress bar and percentage
      const progressBar = card.querySelector('.project-progress-bar');
      const progressPercentEl = card.querySelector('.text-purple-600, .text-purple-400');
      
      if (progressBar) {
        progressBar.style.width = `${progressPercent}%`;
      }
      if (progressPercentEl && progressPercentEl.textContent.includes('%')) {
        progressPercentEl.textContent = `${progressPercent}%`;
      }
      
      // Update data attribute
      const updatedData = { ...projectData, progress_percent: progressPercent };
      card.setAttribute('data-project', JSON.stringify(updatedData).replace(/'/g, "&#39;"));
    }
  });
}

// Fetch project progress from Supabase projects table
async function loadProjectProgress(projects) {
  const token = await getPortalAuthToken();
  if (!token) return;
  
  try {
    // Fetch projects from Supabase to get progress_percent
    const res = await fetch('/.netlify/functions/get-projects', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) return;
    const supabaseProjects = await res.json();
    
    // Match by project name/title and update cards
    projects.forEach(p => {
      const supabaseProject = supabaseProjects.find(sp => 
        sp.title === p.name || sp.title === p.title || sp.client_email === (window.portalClientData?.email || '')
      );
      if (supabaseProject && supabaseProject.progress_percent !== undefined) {
        updateProjectCardWithProgress(p, supabaseProject.progress_percent);
      } else {
        // Default to 0% if no progress set
        updateProjectCardWithProgress(p, 0);
      }
    });
  } catch (err) {
    console.error('Failed to load project progress:', err);
  }
}

// Load and render resources
async function loadResources(category = 'all') {
  const token = await getPortalAuthToken();
  if (!token) {
    // Silently return if no token - user might not be authenticated yet
    return;
  }
  
  const gridEl = document.getElementById('resourcesGrid');
  const emptyEl = document.getElementById('resourcesEmpty');
  
  if (!gridEl) return;
  
  try {
    const url = category === 'all' 
      ? '/.netlify/functions/get-resources'
      : `/.netlify/functions/get-resources?category=${category}`;
    
    const res = await fetch(url, {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    // Handle errors gracefully - don't show error toast for empty states
    if (!res.ok) {
      // If it's a 404 or empty response, just show empty state
      if (res.status === 404 || res.status === 200) {
        gridEl.innerHTML = '';
        if (emptyEl) emptyEl.classList.remove('hidden');
        return;
      }
      // Only log server errors, don't show user-facing error for expected empty states
      console.warn('Resources API returned non-OK status:', res.status);
      gridEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    
    const { resources } = await res.json();
    
    if (!resources || resources.length === 0) {
      gridEl.innerHTML = '';
      if (emptyEl) emptyEl.classList.remove('hidden');
      return;
    }
    
    if (emptyEl) emptyEl.classList.add('hidden');
    
    gridEl.innerHTML = resources.map(r => `
      <div class="card p-5 hover:shadow-lg transition-shadow">
        <div class="flex items-start justify-between mb-3">
          <div class="flex-1">
            <h3 class="font-semibold text-slate-900 dark:text-slate-100 mb-1">${r.title}</h3>
            <span class="text-xs px-2 py-1 rounded-full bg-purple-100 text-purple-700 dark:bg-purple-900/40 dark:text-purple-300">${r.category}</span>
          </div>
        </div>
        ${r.description ? `<p class="text-sm text-slate-600 dark:text-slate-400 mb-3">${r.description}</p>` : ''}
        <div class="flex items-center gap-2">
          <a href="${r.file_url}" target="_blank" rel="noopener" class="btn-primary text-sm flex-1 text-center">Download</a>
          <a href="${r.file_url}" target="_blank" rel="noopener" class="btn-ghost text-sm">View</a>
        </div>
      </div>
    `).join('');
  } catch (err) {
    // Silently handle errors - show empty state instead of error toast
    console.error('Failed to load resources:', err);
    gridEl.innerHTML = '';
    if (emptyEl) emptyEl.classList.remove('hidden');
  }
}

// Load feedback history
async function loadFeedbackHistory() {
  const token = await getPortalAuthToken();
  if (!token) return;
  
  try {
    const res = await fetch('/.netlify/functions/get-feedback', {
      headers: { Authorization: `Bearer ${token}` }
    });
    
    if (!res.ok) return;
    const { feedback } = await res.json();
    
    const historyEl = document.getElementById('feedbackHistory');
    const listEl = document.getElementById('feedbackHistoryList');
    
    if (!feedback || feedback.length === 0) {
      if (historyEl) historyEl.classList.add('hidden');
      return;
    }
    
    if (historyEl) historyEl.classList.remove('hidden');
    if (listEl) {
      listEl.innerHTML = feedback.map(f => `
        <div class="card p-4">
          <div class="flex items-center justify-between mb-2">
            <span class="text-sm font-medium">${f.project_id ? 'Project Feedback' : 'General Feedback'}</span>
            <div class="flex gap-1">
              ${Array.from({ length: 5 }, (_, i) => 
                `<span class="text-lg ${i < f.rating ? 'text-yellow-400' : 'text-slate-300'}">⭐</span>`
              ).join('')}
            </div>
          </div>
          ${f.comment ? `<p class="text-sm text-slate-600 dark:text-slate-400">${f.comment}</p>` : ''}
          <p class="text-xs text-slate-500 mt-2">${new Date(f.created_at).toLocaleDateString()}</p>
        </div>
      `).join('');
    }
  } catch (err) {
    console.error('Failed to load feedback history:', err);
  }
}

// Submit feedback
async function submitFeedback(projectId, rating, comment) {
  const token = await getPortalAuthToken();
  if (!token) return false;
  
  try {
    const res = await fetch('/.netlify/functions/create-feedback', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        Authorization: `Bearer ${token}`
      },
      body: JSON.stringify({ project_id: projectId, rating, comment })
    });
    
    if (!res.ok) {
      const error = await res.json();
      throw new Error(error.error || 'Failed to submit feedback');
    }
    
    showToast('Feedback submitted successfully!');
    await loadFeedbackHistory();
    return true;
  } catch (err) {
    console.error('Failed to submit feedback:', err);
    showToast(err.message || 'Failed to submit feedback', 'error');
    return false;
  }
}

// Wire up feedback form
function wireFeedbackForm(projects) {
  const projectSelect = document.getElementById('feedbackProjectSelect');
  const ratingStars = document.querySelectorAll('.rating-star');
  const ratingText = document.getElementById('ratingText');
  const commentTextarea = document.getElementById('feedbackComment');
  const submitBtn = document.getElementById('submitFeedback');
  
  if (!projectSelect) return;
  
  // Fetch actual projects from Supabase to get IDs
  async function populateProjectSelect() {
    const token = await getPortalAuthToken();
    if (!token) return;
    
    try {
      const res = await fetch('/.netlify/functions/get-projects', {
        headers: { Authorization: `Bearer ${token}` }
      });
      
      if (res.ok) {
        const supabaseProjects = await res.json();
        projectSelect.innerHTML = '<option value="">Choose a project...</option>' + 
          supabaseProjects.map(p => `<option value="${p.id}">${p.title}</option>`).join('');
        return;
      }
    } catch (err) {
      console.error('Failed to load projects for feedback:', err);
    }
    
    // Fallback: use provided projects array
    projectSelect.innerHTML = '<option value="">Choose a project...</option>' + 
      projects.map(p => `<option value="${p.id || p.name}">${p.name || p.title}</option>`).join('');
  }
  
  populateProjectSelect();
  
  let selectedRating = 0;
  
  // Wire rating stars
  ratingStars.forEach((star, index) => {
    star.addEventListener('click', () => {
      selectedRating = index + 1;
      ratingStars.forEach((s, i) => {
        s.classList.toggle('text-yellow-400', i < selectedRating);
        s.classList.toggle('text-slate-300', i >= selectedRating);
      });
      if (ratingText) {
        ratingText.textContent = `${selectedRating} ${selectedRating === 1 ? 'star' : 'stars'}`;
      }
    });
  });
  
  // Wire submit
  if (submitBtn) {
    submitBtn.addEventListener('click', async () => {
      const projectId = projectSelect.value;
      if (!projectId || !selectedRating) {
        showToast('Please select a project and rating', 'error');
        return;
      }
      
      submitBtn.disabled = true;
      submitBtn.textContent = 'Submitting...';
      
      const success = await submitFeedback(projectId, selectedRating, commentTextarea?.value || '');
      
      if (success) {
        projectSelect.value = '';
        commentTextarea.value = '';
        selectedRating = 0;
        ratingStars.forEach(s => {
          s.classList.remove('text-yellow-400');
          s.classList.add('text-slate-300');
        });
        if (ratingText) ratingText.textContent = 'Select a rating';
      }
      
      submitBtn.disabled = false;
      submitBtn.textContent = 'Submit Feedback';
    });
  }
}

// Wire up resources filters
function wireResourcesFilters() {
  const filters = document.querySelectorAll('.resource-filter');
  filters.forEach(btn => {
    btn.addEventListener('click', () => {
      filters.forEach(f => f.classList.remove('active'));
      btn.classList.add('active');
      const category = btn.getAttribute('data-category') || 'all';
      loadResources(category);
    });
  });
}

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

    window.portalClientData = data;
    
    // New features: Welcome header and profile completion
    renderWelcomeHeader(data);
    await loadProfileCompletion(data);
    
    renderProfile({
      id: data.id,
      name: data.name,
      email: data.email,
      company: data.company,
      manager: data.manager,
      phone: data.phone,
      website: data.website,
      profile_url: data.profile_url
    });
    renderKPIs(data);
    renderProjects({ projects: data.projects || [] });
    
    // Wire up collapsible project sections
    wireCollapsibleSections();
    
    // Load project progress bars
    if (data.projects && data.projects.length > 0) {
      await loadProjectProgress(data.projects);
    }
    
    // Try to fetch Supabase files if client is initialized
    let storageFiles = [];
    if (supabaseClient && userEmail) {
      storageFiles = await fetchSupabaseFiles(userEmail);
    }
    // Lazy mount heavy sections
    const filesCard = document.getElementById('filesCard');
    const invoicesCard = document.getElementById('invoicesCard');
    const activityList = document.getElementById('activity');

    lazyMount(filesCard, () => {
      filesPage = 1;
      renderFiles({ files: storageFiles.length > 0 ? storageFiles : (data.files || []), userEmail });
    });

    lazyMount(invoicesCard, async () => {
      invoicesPage = 1;
      if (!portalInvoices || portalInvoices.length === 0) {
        await loadPortalInvoices();
      } else {
        renderInvoices();
      }
    });

    lazyMount(activityList, () => {
      renderActivity({ activity: data.activity || [] });
    });

    renderUpdates({ updates: data.updates || [] });

    // New features: Feedback and Resources (load in background, don't block on errors)
    wireFeedbackForm(data.projects || []);
    wireResourcesFilters();
    
    // Load resources and feedback history - don't fail if these error
    try {
      await loadResources();
    } catch (err) {
      console.error('Resources failed to load (non-critical):', err);
    }
    try {
      await loadFeedbackHistory();
    } catch (err) {
      console.error('Feedback history failed to load (non-critical):', err);
    }

    // Notifications + Settings + Brand Info
    try { await loadNotifications(); } catch {}
    try { await loadUserSettings(); } catch {}
    try { await loadBrandInfo(); } catch {}
    // Expose brand for profile card additions
    window.portalBrand = window.portalBrand || null;

    // Wire basic account settings values
    const nameInput = document.getElementById('accountName');
    const emailInput = document.getElementById('accountEmail');
    if (nameInput) nameInput.value = data.name || '';
    if (emailInput) emailInput.value = data.email || '';
    const saveBtn = document.getElementById('saveSettingsBtn');
    if (saveBtn) saveBtn.addEventListener('click', saveUserSettings);
    const reset = document.getElementById('passwordResetLink');
    if (reset) {
      reset.addEventListener('click', (e) => {
        e.preventDefault();
        const id = window.netlifyIdentity; if (id) id.open('recovery');
      });
    }
    const openSettings = document.getElementById('openAccountSettingsBtn');
    const settingsModal = document.getElementById('accountSettingsModal');
    if (openSettings && settingsModal) {
      openSettings.addEventListener('click', async () => {
        settingsModal.classList.remove('hidden');
        // Reload fresh data when modal opens
        await refreshClientData();
        await loadUserSettings();
      });
    }
    const editBtn = document.getElementById('editProfileBtn');
    if (editBtn && settingsModal) {
      editBtn.addEventListener('click', async () => {
        settingsModal.classList.remove('hidden');
        // Reload fresh data when modal opens
        await refreshClientData();
        await loadUserSettings();
      });
    }
    const closeSettings = document.getElementById('closeAccountSettings');
    if (closeSettings && settingsModal) closeSettings.addEventListener('click', () => settingsModal.classList.add('hidden'));
    const openChangePhoto = document.getElementById('openChangePhoto');
    const avatarModal = document.getElementById('avatarModal');
    if (openChangePhoto && avatarModal) openChangePhoto.addEventListener('click', () => settingsModal && avatarModal && (settingsModal.classList.add('hidden'), avatarModal.classList.remove('hidden')));
    const notifBtn = document.getElementById('openNotifications');
    const panel = document.getElementById('notificationsPanel');
    if (notifBtn && panel) notifBtn.addEventListener('click', () => panel.classList.toggle('hidden'));
    
    const clearNotifBtn = document.getElementById('clearNotificationsBtn');
    if (clearNotifBtn) {
      clearNotifBtn.addEventListener('click', async () => {
        if (!confirm('Are you sure you want to delete all notifications? This cannot be undone.')) return;
        clearNotifBtn.disabled = true;
        const origText = clearNotifBtn.textContent;
        clearNotifBtn.textContent = 'Clearing...';
        try {
          const token = await getPortalAuthToken();
          if (!token) throw new Error('Not authenticated');
          const res = await fetch('/.netlify/functions/delete-all-notifications', {
            method: 'POST',
            headers: { 'Content-Type': 'application/json', Authorization: `Bearer ${token}` },
            body: JSON.stringify({})
          });
          if (!res.ok) throw new Error('Delete failed');
          if (window.showToast) window.showToast('All notifications cleared', 'success');
          await loadNotifications();
        } catch (err) {
          console.error('Clear notifications error:', err);
          if (window.showToast) window.showToast('Failed to clear notifications', 'error', err.message);
        } finally {
          clearNotifBtn.disabled = false;
          clearNotifBtn.textContent = origText;
        }
      });
    }

    wireFilters(data);

    // Wire avatar modal
    const modal = document.getElementById('avatarModal');
    const btnUpload = document.getElementById('avatarUpload');
    const btnCancel = document.getElementById('avatarCancel');
    const input = document.getElementById('avatarInput');
    if (btnCancel && modal) btnCancel.onclick = () => modal.classList.add('hidden');
    if (btnUpload && input && modal) {
      btnUpload.onclick = async () => {
        const file = input.files && input.files[0];
        if (!file) return;
        
        // Validate file type
        const allowedTypes = ['image/jpeg', 'image/jpg', 'image/png', 'image/gif', 'image/webp'];
        if (!allowedTypes.includes(file.type)) {
          showToast('Upload failed', 'error', 'Invalid file type. Only images are allowed.');
          return;
        }
        
        // Validate file size (5MB max)
        if (file.size > 5 * 1024 * 1024) {
          showToast('Upload failed', 'error', 'File too large. Maximum size is 5MB.');
          return;
        }
        
        try {
          // Convert file to base64 for server upload
          const reader = new FileReader();
          reader.onloadend = async () => {
            try {
              const base64Data = reader.result.split(',')[1]; // Remove data:image/...;base64, prefix
              
              // Get auth token
              const token = await new Promise((resolve) => {
                const id = window.netlifyIdentity;
                const user = id && id.currentUser();
                if (!user) return resolve(null);
                user.jwt().then(resolve).catch(() => resolve(null));
              });
              
              // Upload via secure Netlify function
              const res = await fetch('/.netlify/functions/upload-avatar', {
                method: 'POST',
                headers: {
                  'Content-Type': 'application/json',
                  Authorization: token ? `Bearer ${token}` : ''
                },
                body: JSON.stringify({
                  clientId: data.id,
                  fileData: base64Data,
                  fileName: file.name,
                  fileType: file.type
                })
              });
              
              const result = await res.json();
              
              if (!res.ok) {
                throw new Error(result.error || 'Upload failed');
              }
              
              modal.classList.add('hidden');
              // Refresh avatar in UI
              renderProfile({ ...data, profile_url: result.profile_url });
              showToast('Profile updated successfully!');
              
              // Refresh full client data
              await refreshClientData();
            } catch (e) {
              console.error('Avatar upload failed', e);
              showToast('Upload failed', 'error', e.message || 'Unknown error');
            }
          };
          reader.onerror = () => {
            showToast('Upload failed', 'error', 'Failed to read file');
          };
          reader.readAsDataURL(file);
        } catch (e) {
          console.error('Avatar upload failed', e);
          showToast('Upload failed', 'error', e.message);
        }
      };
    }
    
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
            
            // Refresh file list immediately from Storage
            try {
              const latestFiles = await fetchSupabaseFiles(userEmail);
              renderFiles({ files: latestFiles, userEmail });
            } catch (e2) {
              console.warn('Post-upload file list refresh failed, falling back to soft refresh', e2);
              await refreshClientData();
            }
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

// Client Project Modal logic
let activeProjectIndex = null;
let activeClient = null;

window.openClientProjectModal = function(client, index) {
  activeProjectIndex = index;
  activeClient = client;
  const p = (client.projects || [])[index] || {};
  const m = document.getElementById('clientProjectModal');
  if (!m) return;
  document.getElementById('clientProjectTitle').textContent = p.name || 'Untitled Project';
  document.getElementById('clientProjectDescription').textContent = p.summary || 'No description available.';
  document.getElementById('clientProjectStatus').textContent = p.status || '—';
  renderClientProjectActivity(p.activity || []);
  m.classList.remove('hidden');
}

const cpmClose = document.getElementById('closeClientProjectModal');
if (cpmClose) cpmClose.onclick = () => document.getElementById('clientProjectModal').classList.add('hidden');

function renderClientProjectActivity(activity) {
  const container = document.getElementById('clientProjectActivity');
  if (!container) return;
  container.innerHTML = (activity && activity.length)
    ? activity.map(a => `<div>🕓 ${a.when} — ${a.text} <span class='text-slate-400'>(${a.by || 'Client'})</span></div>`).join('')
    : `<div class="text-slate-400 italic">No activity yet.</div>`;
}

const submitProjectComment = document.getElementById('submitProjectComment');
if (submitProjectComment) submitProjectComment.onclick = async () => {
  const comment = document.getElementById('clientProjectComment')?.value?.trim();
  if (!comment || !activeClient || activeProjectIndex == null) return;
  const p = activeClient.projects[activeProjectIndex] || {};
  const now = new Date();
  const formatted = `${now.toLocaleTimeString([], {hour:'2-digit',minute:'2-digit'})} · ${now.toLocaleDateString()}`;
  p.activity = Array.isArray(p.activity) ? p.activity : [];
  p.activity.unshift({ text: comment, when: formatted, by: activeClient.name || 'Client' });
  try {
    const token = await new Promise((resolve) => {
      const id = window.netlifyIdentity; const user = id && id.currentUser();
      if (!user) return resolve(null); user.jwt().then(resolve).catch(() => resolve(null));
    });
    const res = await fetch('/.netlify/functions/update-client-profile', {
      method: 'POST', headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
      body: JSON.stringify({ clientId: activeClient.id, fields: { projects: activeClient.projects } })
    });
    if (!res.ok) throw new Error('Comment failed');
    document.getElementById('clientProjectComment').value = '';
    renderClientProjectActivity(p.activity);
    showToast('✅ Comment added!');

    // Also persist to projects table for admin reload consistency
    try {
      await fetch('/.netlify/functions/upsert-project', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json', ...(token ? { Authorization: `Bearer ${token}` } : {}) },
        body: JSON.stringify({
          clientEmail: activeClient.email,
          project: { id: p.id, name: p.name, description: p.summary, status: p.status, activity: p.activity }
        })
      });
    } catch (e) { console.warn('Optional projects.activity upsert failed', e); }
  } catch (e) {
    console.error(e);
    showToast('❌ Failed to add comment', 'error');
  }
}

// Smooth scroll + active side nav
(function wireSideNav(){
  const nav = document.getElementById('portalSideNav');
  if (!nav) return;
  const links = Array.from(nav.querySelectorAll('a[data-target]'));
  links.forEach((a) => {
    a.addEventListener('click', (e) => {
      e.preventDefault();
      const id = a.getAttribute('data-target');
      const target = document.getElementById(id);
      if (target) target.scrollIntoView({ behavior: 'smooth', block: 'start' });
    });
  });
  const observer = new IntersectionObserver((entries) => {
    entries.forEach((entry) => {
      if (entry.isIntersecting) {
        const id = entry.target.id;
        links.forEach((l) => l.classList.toggle('sidebar-link-active', l.getAttribute('data-target') === id));
      }
    });
  }, { root: null, rootMargin: '0px 0px -70% 0px', threshold: 0.1 });
  ['overview','kanban','filesCard','invoicesCard','feedback','resources','support'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) observer.observe(el);
  });
})();
