// KPICard component: renders a grid of KPI cards with optional trends and sparklines

export function renderKPICards(container, kpis) {
	if (!container) return;
	container.innerHTML = '';
	const grid = document.createElement('div');
	grid.className = 'grid grid-cols-1 sm:grid-cols-2 lg:grid-cols-5 gap-4';

	kpis.forEach((kpi) => {
		const { label, value, trendPct = 0, trendLabel = '', spark = [] } = kpi;
		const card = document.createElement('div');
		card.className = 'group relative overflow-hidden rounded-xl bg-white dark:bg-slate-900 p-4 shadow-sm hover:shadow-md transition-all duration-200 hover:-translate-y-0.5 border border-slate-100 dark:border-slate-800';

		const title = document.createElement('div');
		title.className = 'text-xs font-medium text-slate-500 dark:text-slate-400';
		title.textContent = label;

		const valueEl = document.createElement('div');
		valueEl.className = 'mt-2 text-2xl font-semibold text-slate-900 dark:text-white tracking-tight';
		valueEl.textContent = value;

		const trend = document.createElement('div');
		const isUp = trendPct >= 0;
		trend.className = `mt-2 inline-flex items-center text-xs font-medium ${isUp ? 'text-emerald-600' : 'text-rose-600'}`;
		trend.innerHTML = `${isUp ? '▲' : '▼'} ${Math.abs(trendPct).toFixed(1)}% <span class="ml-1 text-slate-500 dark:text-slate-400">${trendLabel}</span>`;

		const sparkWrap = document.createElement('div');
		sparkWrap.className = 'absolute right-0 bottom-0 opacity-60 group-hover:opacity-90 transition-opacity p-2';
		sparkWrap.style.width = '80px';
		sparkWrap.style.height = '36px';

		const svg = document.createElementNS('http://www.w3.org/2000/svg', 'svg');
		svg.setAttribute('viewBox', '0 0 80 36');
		svg.setAttribute('fill', 'none');
		svg.setAttribute('width', '80');
		svg.setAttribute('height', '36');

		const path = document.createElementNS('http://www.w3.org/2000/svg', 'path');
		const points = spark.length ? spark : [5, 8, 6, 12, 9, 11, 15, 14, 13, 18, 16, 21];
		const max = Math.max(...points);
		const min = Math.min(...points);
		const norm = points.map((v, i) => {
			const x = (i / (points.length - 1)) * 80;
			const y = 36 - ((v - min) / (max - min || 1)) * 30 - 3;
			return `${x},${y}`;
		}).join(' ');
		path.setAttribute('d', `M ${norm}`);
		path.setAttribute('stroke', 'url(#grad)');
		path.setAttribute('stroke-width', '2');
		path.setAttribute('fill', 'none');

		const defs = document.createElementNS('http://www.w3.org/2000/svg', 'defs');
		const lg = document.createElementNS('http://www.w3.org/2000/svg', 'linearGradient');
		lg.setAttribute('id', 'grad');
		lg.setAttribute('x1', '0');
		lg.setAttribute('x2', '1');
		lg.setAttribute('y1', '0');
		lg.setAttribute('y2', '0');
		const stop1 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
		stop1.setAttribute('offset', '0%');
		stop1.setAttribute('stop-color', '#4C52F8');
		const stop2 = document.createElementNS('http://www.w3.org/2000/svg', 'stop');
		stop2.setAttribute('offset', '100%');
		stop2.setAttribute('stop-color', '#7B61FF');
		defs.appendChild(lg);
		lg.appendChild(stop1);
		lg.appendChild(stop2);

		svg.appendChild(defs);
		svg.appendChild(path);
		sparkWrap.appendChild(svg);

		card.appendChild(title);
		card.appendChild(valueEl);
		card.appendChild(trend);
		card.appendChild(sparkWrap);
		grid.appendChild(card);
	});

	container.appendChild(grid);
}


