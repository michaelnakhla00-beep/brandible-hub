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

// Files
function renderFiles({ files = [] }) {
  const el = document.getElementById("files");
  if (!el) return;
  el.innerHTML = files
    .map(
      (f) => `
    <li class="flex items-center justify-between gap-3">
      <a href="${f.url}" target="_blank" rel="noopener" class="text-indigo-600 hover:underline">${f.name}</a>
      <span class="text-xs text-slate-500">${f.updated || ""}</span>
    </li>`
    )
    .join("");
}

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

/* ---------------------------
   4) Init
---------------------------- */
(async function init() {
  const overlay = document.getElementById("loadingOverlay");
  try {
    const data = await fetchClientData();

    renderKPIs(data);
    renderProjects({ projects: data.projects || [] });
    renderFiles({ files: data.files || [] });
    renderInvoices({ invoices: data.invoices || [] });
    renderActivity({ activity: data.activity || [] });
    renderUpdates({ updates: data.updates || [] });

    wireFilters(data);
  } catch (e) {
    console.error(e);
    alert("Failed to load dashboard. If this persists, contact Brandible.");
  } finally {
    if (overlay) overlay.style.display = "none";
  }
})();
