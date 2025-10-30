// ClientCard list with expandable details and quick actions

import { parseJSON } from './data.js';

export function renderClientCards(container, clients, { onView, onEdit, onArchive, onSearch } = {}) {
	if (!container) return;
	container.innerHTML = '';

	const controls = document.createElement('div');
	controls.className = 'flex flex-wrap items-center justify-between gap-3 mb-4';

	const search = document.createElement('input');
	search.type = 'search';
	search.placeholder = 'Search clients…';
	search.className = 'w-full sm:w-64 rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 ring-brand focus:border-transparent';
	search.addEventListener('input', () => {
		if (typeof onSearch === 'function') onSearch(search.value);
	});

	const filter = document.createElement('select');
	filter.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
	['All statuses','Active','Paused','Archived'].forEach((o, i) => {
		const opt = document.createElement('option');
		opt.value = i === 0 ? '' : o.toLowerCase();
		opt.textContent = o;
		filter.appendChild(opt);
	});

	controls.appendChild(search);
	controls.appendChild(filter);
	container.appendChild(controls);

	const list = document.createElement('div');
	list.className = 'grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-4';
	container.appendChild(list);

	const renderList = (rows) => {
		list.innerHTML = '';
		rows.forEach((c) => list.appendChild(ClientCard(c)));
	};

	filter.addEventListener('change', () => {
		const status = filter.value;
		const q = search.value?.toLowerCase() || '';
		const filtered = clients.filter((c) => {
			const matchesStatus = !status || (c.status || '').toLowerCase() === status;
			const matchesSearch = !q || [c.name, c.email].filter(Boolean).some((v) => v.toLowerCase().includes(q));
			return matchesStatus && matchesSearch;
		});
		renderList(filtered);
	});

	search.addEventListener('input', () => filter.dispatchEvent(new Event('change')));

	renderList(clients);

	function ClientCard(client) {
		const { id, name, email, status = 'Active', avatar_url } = client;
		const projectsArr = Array.isArray(client.projects) ? client.projects : parseJSON(client.projects);
		const invoicesArr = Array.isArray(client.invoices) ? client.invoices : parseJSON(client.invoices);
		const filesArr = Array.isArray(client.files) ? client.files : parseJSON(client.files);
		const projectsCount = (projectsArr && projectsArr.length) || Number(client.kpis?.activeProjects) || 0;
		const invoicesCount = (invoicesArr && invoicesArr.length) || Number(client.kpis?.openInvoices) || 0;
		const filesCount = (filesArr && filesArr.length) || Number(client.kpis?.files) || 0;

		const card = document.createElement('div');
		card.className = 'rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all';

		const head = document.createElement('div');
		head.className = 'flex items-center justify-between gap-3';

		const left = document.createElement('div');
		left.className = 'flex items-center gap-3';

		const avatar = document.createElement('div');
		avatar.className = 'h-10 w-10 rounded-full bg-gradient-to-br from-[#4C52F8] to-[#7B61FF] text-white flex items-center justify-center text-sm font-semibold shadow-[0_2px_10px_rgba(124,97,255,0.15)] overflow-hidden';
		if (avatar_url) {
			const img = document.createElement('img');
			img.src = avatar_url;
			img.alt = name || 'Client';
			img.className = 'h-full w-full object-cover';
			avatar.appendChild(img);
		} else {
			avatar.textContent = (name || email || '?').slice(0, 2).toUpperCase();
		}

		const meta = document.createElement('div');
		meta.innerHTML = `
			<div class="text-sm font-semibold text-slate-900 dark:text-white">${name || 'Unnamed Client'}</div>
			<div class="text-xs text-slate-500 dark:text-slate-400">${email || ''}</div>
		`;

		left.appendChild(avatar);
		left.appendChild(meta);

		const right = document.createElement('div');
		right.className = 'flex items-center gap-2';
		const statusBadge = document.createElement('span');
		statusBadge.className = `px-2 py-1 text-xs rounded-full ${status === 'Active' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : status === 'Paused' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200'}`;
		statusBadge.textContent = status;

		const expandBtn = document.createElement('button');
		expandBtn.className = 'ml-1 text-xs px-2 py-1 rounded-md bg-slate-100 dark:bg-slate-800 text-slate-700 dark:text-slate-200 hover:bg-slate-200 dark:hover:bg-slate-700';
		expandBtn.textContent = 'Hide';

		right.appendChild(statusBadge);
		right.appendChild(expandBtn);

		head.appendChild(left);
		head.appendChild(right);

		const stats = document.createElement('div');
		stats.className = 'mt-3 grid grid-cols-3 gap-2 text-center';
		stats.innerHTML = `
			<div class="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
				<div class="text-xs text-slate-500 dark:text-slate-400">Projects</div>
				<div class="text-sm font-semibold text-slate-900 dark:text-white">${projectsCount}</div>
			</div>
			<div class="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
				<div class="text-xs text-slate-500 dark:text-slate-400">Invoices</div>
				<div class="text-sm font-semibold text-slate-900 dark:text-white">${invoicesCount}</div>
			</div>
			<div class="rounded-lg bg-slate-50 dark:bg-slate-800 p-2">
				<div class="text-xs text-slate-500 dark:text-slate-400">Files</div>
				<div class="text-sm font-semibold text-slate-900 dark:text-white">${filesCount}</div>
			</div>
		`;

		const details = document.createElement('div');
		details.className = 'mt-3';
		details.innerHTML = `
			<div class="rounded-lg border border-slate-100 dark:border-slate-800 p-3">
				<div class="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Projects</div>
				<div class="flex flex-col gap-2" data-projects>${(projectsArr || []).length ? (projectsArr || []).map((p) => `
					<div class="flex items-center justify-between text-sm">
						<div class="text-slate-700 dark:text-slate-200">${p.name || 'Untitled'}</div>
						<div class="text-xs text-slate-500 dark:text-slate-400">${p.status || 'N/A'}</div>
					</div>
				`).join('') : '<div class="text-xs text-slate-500">No projects</div>'}
				</div>
				<div class="h-3"></div>
				<div class="text-xs font-semibold text-slate-700 dark:text-slate-200 mb-2">Quick Actions</div>
				<div class="flex flex-wrap gap-2">
					<button class="px-3 py-1.5 text-xs rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50" data-action="view">View</button>
					<button class="px-3 py-1.5 text-xs rounded-md bg-brand text-white hover:opacity-90" data-action="edit">Edit</button>
					<button class="px-3 py-1.5 text-xs rounded-md bg-rose-50 text-rose-700 border border-rose-200 hover:bg-rose-100" data-action="archive">Archive</button>
				</div>
			</div>
		`;

		async function loadProjectsIfNeeded() {
			if (details.getAttribute('data-loaded') === '1') return;
			const listWrap = details.querySelector('[data-projects]');
			if (!listWrap) return;
			listWrap.innerHTML = '<div class="text-xs text-slate-500">Loading projects…</div>';
			const token = await getIdentityToken();
			try {
				const res = await fetch(`/.netlify/functions/get-projects?email=${encodeURIComponent(email || '')}`, { headers: token ? { Authorization: `Bearer ${token}` } : {} });
				if (res.ok) {
					const data = await res.json();
					const projs = (data?.projects || []).map((p) => ({ name: p.title || p.name, status: p.status || 'In Progress' }));
					listWrap.innerHTML = projs.length ? projs.map((p) => `
						<div class="flex items-center justify-between text-sm">
							<div class="text-slate-700 dark:text-slate-200">${p.name || 'Untitled'}</div>
							<div class="text-xs text-slate-500 dark:text-slate-400">${p.status}</div>
						</div>
					`).join('') : '<div class="text-xs text-slate-500">No projects</div>';
					details.setAttribute('data-loaded', '1');
				} else {
					listWrap.innerHTML = '<div class="text-xs text-rose-600">Failed to load projects</div>';
				}
			} catch {
				listWrap.innerHTML = '<div class="text-xs text-rose-600">Failed to load projects</div>';
			}
		}

		// Default expanded → load now
		loadProjectsIfNeeded();

		expandBtn.addEventListener('click', async () => {
			details.classList.toggle('hidden');
			expandBtn.textContent = details.classList.contains('hidden') ? 'Details' : 'Hide';
			if (!details.classList.contains('hidden')) {
				loadProjectsIfNeeded();
			}
		});

		details.addEventListener('click', (e) => {
			const btn = e.target.closest('button[data-action]');
			if (!btn) return;
			const action = btn.getAttribute('data-action');
			if (action === 'view' && typeof onView === 'function') onView(client);
			if (action === 'edit' && typeof onEdit === 'function') onEdit(client);
			if (action === 'archive' && typeof onArchive === 'function') onArchive(client);
		});

		card.appendChild(head);
		card.appendChild(stats);
		card.appendChild(details);
		return card;
	}
}

async function getIdentityToken() {
	try {
		const id = window.netlifyIdentity;
		const user = id && id.currentUser && id.currentUser();
		if (!user) return null;
		return await user.jwt();
	} catch {
		return null;
	}
}


