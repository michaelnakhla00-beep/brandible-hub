// Activity Feed with relative timestamps and clickable items

function timeAgo(date) {
	const parsed = typeof date === 'string' ? new Date(date) : date instanceof Date ? date : null;
	if (!parsed || isNaN(parsed.getTime())) {
		// Fallback: if original is a readable string like "2h ago", show it
		return typeof date === 'string' ? date : '';
	}
	const diff = Math.floor((Date.now() - parsed.getTime()) / 1000);
	if (diff < 60) return `${diff}s ago`;
	const m = Math.floor(diff / 60);
	if (m < 60) return `${m}m ago`;
	const h = Math.floor(m / 60);
	if (h < 24) return `${h}h ago`;
	const days = Math.floor(h / 24);
	return `${days}d ago`;
}

export function renderActivityFeed(container, items = [], { onClick } = {}) {
	if (!container) return;
	container.innerHTML = '';

	const list = document.createElement('div');
	list.className = 'flex flex-col divide-y divide-slate-100 dark:divide-slate-800 rounded-xl border border-slate-100 dark:border-slate-800 overflow-hidden bg-white dark:bg-slate-900';

	items.forEach((it) => {
		const row = document.createElement('button');
		row.type = 'button';
		row.className = 'text-left px-4 py-3 hover:bg-slate-50 dark:hover:bg-slate-800/70 focus:outline-none focus:bg-slate-50 dark:focus:bg-slate-800/70 transition-colors';
		row.innerHTML = `
			<div class="flex items-center gap-3">
				<span class="h-7 w-7 inline-flex items-center justify-center rounded-full text-xs ${iconBg(it.type)}">${iconGlyph(it.type)}</span>
				<div class="flex-1">
					<div class="text-sm text-slate-800 dark:text-slate-100">${it.title || 'Activity'}</div>
					<div class="text-xs text-slate-500 dark:text-slate-400">${it.subtitle || ''}</div>
				</div>
				<div class="text-xs text-slate-400">${timeAgo(it.timestamp || new Date())}</div>
			</div>
		`;
		row.addEventListener('click', () => typeof onClick === 'function' && onClick(it));
		list.appendChild(row);
	});

	container.appendChild(list);
}

function iconBg(type) {
	switch ((type || '').toLowerCase()) {
		case 'lead': return 'bg-amber-50 text-amber-700 dark:bg-amber-900/30 dark:text-amber-300';
		case 'project': return 'bg-sky-50 text-sky-700 dark:bg-sky-900/30 dark:text-sky-300';
		case 'invoice': return 'bg-emerald-50 text-emerald-700 dark:bg-emerald-900/30 dark:text-emerald-300';
		default: return 'bg-slate-100 text-slate-700 dark:bg-slate-700/60 dark:text-slate-200';
	}
}

function iconGlyph(type) {
	switch ((type || '').toLowerCase()) {
		case 'lead': return 'L';
		case 'project': return 'P';
		case 'invoice': return '$';
		default: return '•';
	}
}


