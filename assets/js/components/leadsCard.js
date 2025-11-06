// Leads list with scoring badges, inline notes, follow-up date, assigned to, CSV export hook

export function renderLeads(container, leads, { onChange, onExportCSV } = {}) {
	if (!container) return;
	
	// Clear any existing interval
	if (container._filterModeInterval) {
		clearInterval(container._filterModeInterval);
		container._filterModeInterval = null;
	}
	
	container.innerHTML = '';

	const controls = document.createElement('div');
	controls.className = 'flex flex-wrap items-center justify-between gap-3 mb-4';

	const left = document.createElement('div');
	left.className = 'flex items-center gap-2';

	const srcFilter = document.createElement('select');
	srcFilter.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
	['All sources','Website','Instagram','Referral','Other'].forEach((o, i) => {
		const opt = document.createElement('option');
		opt.value = i === 0 ? '' : o.toLowerCase();
		opt.textContent = o;
		srcFilter.appendChild(opt);
	});

	const scoreFilter = document.createElement('select');
	scoreFilter.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
	['All scores','Hot','Warm','Cold'].forEach((o, i) => {
		const opt = document.createElement('option');
		opt.value = i === 0 ? '' : o.toLowerCase();
		opt.textContent = o;
		scoreFilter.appendChild(opt);
	});

	left.appendChild(srcFilter);
	left.appendChild(scoreFilter);

	const exportBtn = document.createElement('button');
	exportBtn.className = 'ml-auto px-3 py-2 text-sm rounded-md bg-white dark:bg-slate-900 border border-slate-200 dark:border-slate-700 hover:bg-slate-50';
	exportBtn.textContent = 'Export CSV';
	exportBtn.addEventListener('click', () => {
		if (typeof onExportCSV === 'function') onExportCSV(currentRows());
	});

	controls.appendChild(left);
	controls.appendChild(exportBtn);
	container.appendChild(controls);

	const list = document.createElement('div');
	list.className = 'flex flex-col gap-3';
	container.appendChild(list);

	const renderList = (rows) => {
		list.innerHTML = '';
		rows.forEach((l) => list.appendChild(LeadRow(l)));
	};

	function currentRows() {
		const sf = srcFilter.value;
		const sc = scoreFilter.value;
		// Get filter mode from global variable (set by admin.js)
		const filterMode = window.leadsFilterMode || 'active';
		return leads.filter((l) => {
			const matchesSrc = !sf || (l.source || '').toLowerCase() === sf;
			const matchesScore = !sc || (l.score || '').toLowerCase() === sc;
			// Filter by active/inactive
			const matchesStatus = filterMode === 'active' ? l.status !== 'Inactive' : l.status === 'Inactive';
			return matchesSrc && matchesScore && matchesStatus;
		});
	}

	srcFilter.addEventListener('change', () => renderList(currentRows()));
	scoreFilter.addEventListener('change', () => renderList(currentRows()));

	// Listen for filter mode changes (set by admin.js)
	let lastFilterMode = window.leadsFilterMode || 'active';
	const checkFilterMode = () => {
		const currentMode = window.leadsFilterMode || 'active';
		if (currentMode !== lastFilterMode) {
			lastFilterMode = currentMode;
			renderList(currentRows());
		}
	};
	const filterModeInterval = setInterval(checkFilterMode, 100);
	
	// Store interval ID so it can be cleared if needed
	if (container) {
		container._filterModeInterval = filterModeInterval;
	}

	renderList(leads);

	function LeadRow(lead) {
		const row = document.createElement('div');
		row.className = 'rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm';

		const header = document.createElement('div');
		header.className = 'flex items-center justify-between gap-2';

		const who = document.createElement('div');
		who.className = 'text-sm font-semibold text-slate-900 dark:text-white';
		who.textContent = lead.name || lead.email || 'Unknown Lead';

		const cameAt = document.createElement('div');
		cameAt.className = 'text-[11px] text-slate-400';
		cameAt.textContent = lead.created_at ? new Date(lead.created_at).toLocaleString() : '';

		const score = document.createElement('span');
		const s = (lead.score || 'warm').toLowerCase();
		score.className = `px-2 py-1 text-xs rounded-full ${s === 'hot' ? 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300' : s === 'warm' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300'}`;
		score.textContent = s[0].toUpperCase() + s.slice(1);

		header.appendChild(who);
		header.appendChild(score);
		header.appendChild(cameAt);

		const meta = document.createElement('div');
		meta.className = 'mt-2 grid grid-cols-1 md:grid-cols-4 gap-2 text-xs text-slate-600 dark:text-slate-300';
		meta.innerHTML = `
			<div class="truncate"><span class="text-slate-500">Email:</span> ${lead.email || '—'}</div>
		`;

		// Editable Source
		const sourceWrap = document.createElement('div');
		sourceWrap.className = 'flex items-center gap-2';
		const sourceLabel = document.createElement('span');
		sourceLabel.className = 'text-slate-500';
		sourceLabel.textContent = 'Source:';
		const sourceSelect = document.createElement('select');
		sourceSelect.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
		['website','instagram','referral','other'].forEach((s) => {
			const opt = document.createElement('option');
			opt.value = s;
			opt.textContent = s.charAt(0).toUpperCase() + s.slice(1);
			if ((lead.source || 'other').toLowerCase() === s) opt.selected = true;
			sourceSelect.appendChild(opt);
		});
		sourceSelect.addEventListener('change', () => {
			lead.source = sourceSelect.value;
			if (typeof onChange === 'function') onChange({ ...lead });
			if (typeof window.updateLeadSource === 'function') window.updateLeadSource(lead.id, sourceSelect.value);
		});
		sourceWrap.appendChild(sourceLabel);
		sourceWrap.appendChild(sourceSelect);

		// Editable Status
		const statusWrap = document.createElement('div');
		statusWrap.className = 'flex items-center gap-2';
		const statusLabel = document.createElement('span');
		statusLabel.className = 'text-slate-500';
		statusLabel.textContent = 'Status:';
		const statusSelect = document.createElement('select');
		statusSelect.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
		['New','Contacted','In Progress','Closed','Inactive'].forEach((s) => {
			const opt = document.createElement('option');
			opt.value = s;
			opt.textContent = s;
			if ((lead.status || 'New') === s) opt.selected = true;
			statusSelect.appendChild(opt);
		});
		statusSelect.addEventListener('change', () => {
			lead.status = statusSelect.value;
			if (typeof onChange === 'function') onChange({ ...lead });
			if (typeof window.updateLeadStatus === 'function') window.updateLeadStatus(lead.id, statusSelect.value);
		});
		statusWrap.appendChild(statusLabel);
		statusWrap.appendChild(statusSelect);

		// Editable Score
		const scoreWrap = document.createElement('div');
		scoreWrap.className = 'flex items-center gap-2';
		const scoreLabel = document.createElement('span');
		scoreLabel.className = 'text-slate-500';
		scoreLabel.textContent = 'Score:';
		const scoreSelect = document.createElement('select');
		scoreSelect.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-2 py-1 text-xs';
		['hot','warm','cold'].forEach((sc) => {
			const opt = document.createElement('option');
			opt.value = sc;
			opt.textContent = sc.charAt(0).toUpperCase() + sc.slice(1);
			if ((lead.score || 'warm').toLowerCase() === sc) opt.selected = true;
			scoreSelect.appendChild(opt);
		});
		scoreSelect.addEventListener('change', () => {
			lead.score = scoreSelect.value;
			if (typeof onChange === 'function') onChange({ ...lead });
			if (typeof window.updateLeadScore === 'function') window.updateLeadScore(lead.id, scoreSelect.value);
		});
		scoreWrap.appendChild(scoreLabel);
		scoreWrap.appendChild(scoreSelect);

		// Assigned
		const assignedWrap = document.createElement('div');
		assignedWrap.textContent = `Assigned: ${lead.assigned_to || 'Unassigned'}`;

		meta.appendChild(sourceWrap);
		meta.appendChild(statusWrap);
		meta.appendChild(scoreWrap);
		meta.appendChild(assignedWrap);

		// Original form message/comment
		const messageDiv = document.createElement('div');
		messageDiv.className = 'mt-3 p-3 rounded-lg bg-slate-50 dark:bg-slate-800/50 border border-slate-200 dark:border-slate-700';
		const messageLabel = document.createElement('div');
		messageLabel.className = 'text-xs font-medium text-slate-500 dark:text-slate-400 mb-1.5';
		messageLabel.textContent = 'Message/Comment:';
		const messageText = document.createElement('div');
		messageText.className = 'text-sm text-slate-700 dark:text-slate-300 whitespace-pre-wrap break-words';
		// Escape HTML and display message
		const message = lead.message || '';
		messageText.textContent = message || 'No message provided';
		messageDiv.appendChild(messageLabel);
		messageDiv.appendChild(messageText);

		const notes = document.createElement('textarea');
		notes.className = 'mt-3 w-full rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm outline-none focus:ring-2 ring-brand';
		notes.placeholder = 'Notes…';
		notes.value = lead.notes || '';
		notes.addEventListener('change', () => {
			lead.notes = notes.value;
			if (typeof onChange === 'function') onChange({ ...lead, notes: notes.value });
		});

		const followWrap = document.createElement('div');
		followWrap.className = 'mt-2 flex items-center gap-3';
		const follow = document.createElement('input');
		follow.type = 'date';
		follow.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
		if (lead.follow_up_date) follow.value = lead.follow_up_date.slice(0, 10);
		follow.addEventListener('change', () => {
			lead.follow_up_date = follow.value;
			if (typeof onChange === 'function') onChange({ ...lead, follow_up_date: follow.value });
		});

		const assign = document.createElement('select');
		assign.className = 'rounded-lg border border-slate-200 dark:border-slate-700 bg-white dark:bg-slate-900 px-3 py-2 text-sm';
		['Unassigned','Admin','Owner','Sales'].forEach((r) => {
			const opt = document.createElement('option');
			opt.value = r.toLowerCase();
			opt.textContent = r;
			if ((lead.assigned_to || 'unassigned').toLowerCase() === opt.value) opt.selected = true;
			assign.appendChild(opt);
		});
		assign.addEventListener('change', () => {
			lead.assigned_to = assign.value;
			if (typeof onChange === 'function') onChange({ ...lead, assigned_to: assign.value });
		});

		followWrap.appendChild(follow);
		followWrap.appendChild(assign);

		// Delete button
		const deleteBtn = document.createElement('button');
		deleteBtn.className = 'mt-3 px-3 py-1.5 rounded-lg text-xs font-semibold bg-red-100 text-red-700 dark:bg-red-900/30 dark:text-red-300 border border-red-200 dark:border-red-700 hover:bg-red-200 dark:hover:bg-red-900/50 transition-all';
		deleteBtn.textContent = 'Delete';
		deleteBtn.addEventListener('click', (e) => {
			e.stopPropagation();
			if (typeof window.deleteLead === 'function') {
				window.deleteLead(lead.id, lead.name || lead.email || 'Unknown Lead');
			}
		});

		row.appendChild(header);
		row.appendChild(meta);
		row.appendChild(messageDiv);
		row.appendChild(notes);
		row.appendChild(followWrap);
		row.appendChild(deleteBtn);
		return row;
	}
}


