export function skeletonLines(count = 3) {
	const wrap = document.createElement('div');
	wrap.className = 'animate-pulse flex flex-col gap-2';
	for (let i = 0; i < count; i++) {
		const line = document.createElement('div');
		line.className = 'h-3 rounded bg-slate-100 dark:bg-slate-800';
		wrap.appendChild(line);
	}
	return wrap;
}

export function skeletonCards(count = 4) {
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-4 gap-4';
	for (let i = 0; i < count; i++) {
		const card = document.createElement('div');
		card.className = 'rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4';
		card.appendChild(skeletonLines(4));
		grid.appendChild(card);
	}
	return grid;
}


