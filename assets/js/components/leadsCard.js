// Leads list with scoring badges, inline notes, follow-up date, assigned to, CSV export hook

export function renderLeads(container, leads, { onChange, onExportCSV } = {}) {
	if (!container) return;
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
		return leads.filter((l) => {
			const matchesSrc = !sf || (l.source || '').toLowerCase() === sf;
			const matchesScore = !sc || (l.score || '').toLowerCase() === sc;
			return matchesSrc && matchesScore;
		});
	}

	srcFilter.addEventListener('change', () => renderList(currentRows()));
	scoreFilter.addEventListener('change', () => renderList(currentRows()));

	renderList(leads);

	function LeadRow(lead) {
		const row = document.createElement('div');
		row.className = 'rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-3 shadow-sm';

		const header = document.createElement('div');
		header.className = 'flex items-center justify-between gap-2';

		const who = document.createElement('div');
		who.className = 'text-sm font-semibold text-slate-900 dark:text-white';
		who.textContent = lead.name || lead.email || 'Unknown Lead';

		const score = document.createElement('span');
		const s = (lead.score || 'warm').toLowerCase();
		score.className = `px-2 py-1 text-xs rounded-full ${s === 'hot' ? 'bg-rose-50 text-rose-700 dark:bg-rose-900/30 dark:text-rose-300' : s === 'warm' ? 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300' : 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200'}`;
		score.textContent = s[0].toUpperCase() + s.slice(1);

		header.appendChild(who);
		header.appendChild(score);

		const meta = document.createElement('div');
		meta.className = 'mt-2 grid grid-cols-2 md:grid-cols-4 gap-2 text-xs text-slate-600 dark:text-slate-300';
		meta.innerHTML = `
			<div><span class="text-slate-500">Email:</span> ${lead.email || '—'}</div>
			<div><span class="text-slate-500">Source:</span> ${lead.source || '—'}</div>
			<div><span class="text-slate-500">Status:</span> ${lead.status || 'New'}</div>
			<div><span class="text-slate-500">Assigned:</span> ${lead.assigned_to || 'Unassigned'}</div>
		`;

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

		row.appendChild(header);
		row.appendChild(meta);
		row.appendChild(notes);
		row.appendChild(followWrap);
		return row;
	}
}


