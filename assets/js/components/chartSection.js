// ChartSection component: renders a titled chart with time filters

let chartJsReadyPromise;

function ensureChartJs() {
	if (window.Chart) return Promise.resolve();
	if (chartJsReadyPromise) return chartJsReadyPromise;
	chartJsReadyPromise = new Promise((resolve) => {
		const s = document.createElement('script');
		s.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.4/dist/chart.umd.min.js';
		s.onload = () => resolve();
		document.head.appendChild(s);
	});
	return chartJsReadyPromise;
}

export async function renderChartSection(container, { title, description = '', dataset, initialRange = 'month', onRangeChange }) {
	if (!container) return;
	await ensureChartJs();
	// Destroy any prior chart instance attached to this container
	if (container.__chartInstance) {
		try { container.__chartInstance.destroy(); } catch {}
		container.__chartInstance = null;
	}
	// Reset container content
	container.innerHTML = '';

	const wrap = document.createElement('div');
	wrap.className = 'rounded-xl border border-slate-100 dark:border-slate-800 bg-white dark:bg-slate-900 p-4 shadow-sm';
	// Constrain layout to prevent vertical expansion
	wrap.style.position = 'relative';
	wrap.style.height = '320px';
	wrap.style.minHeight = '320px';

	const header = document.createElement('div');
	header.className = 'flex items-center justify-between gap-2';

	const titleEl = document.createElement('div');
	titleEl.className = 'text-sm font-semibold text-slate-900 dark:text-white';
	titleEl.textContent = title;

	const descEl = document.createElement('div');
	descEl.className = 'text-xs text-slate-500 dark:text-slate-400';
	descEl.textContent = description;

	const left = document.createElement('div');
	left.appendChild(titleEl);
	left.appendChild(descEl);

	const filters = document.createElement('div');
	filters.className = 'inline-flex rounded-lg border border-slate-200 dark:border-slate-700 p-1 bg-slate-50 dark:bg-slate-800';

	const ranges = ['week', 'month', 'quarter'];
	let activeRange = initialRange;

	const makeBtn = (r) => {
		const b = document.createElement('button');
		b.type = 'button';
		b.className = `px-3 py-1 text-xs rounded-md transition-colors ${r === activeRange ? 'bg-white dark:bg-slate-900 text-slate-900 dark:text-white shadow-sm' : 'text-slate-600 dark:text-slate-300 hover:text-slate-900 dark:hover:text-white'}`;
		b.textContent = r[0].toUpperCase() + r.slice(1);
		b.addEventListener('click', () => {
			activeRange = r;
			[...filters.children].forEach((c) => c.classList.remove('bg-white', 'dark:bg-slate-900', 'text-slate-900', 'dark:text-white', 'shadow-sm'));
			b.classList.add('bg-white', 'dark:bg-slate-900', 'text-slate-900', 'dark:text-white', 'shadow-sm');
			const updated = typeof onRangeChange === 'function' ? onRangeChange(r) : dataset;
			updateChart(updated);
		});
		return b;
	};

	ranges.forEach((r) => filters.appendChild(makeBtn(r)));

	header.appendChild(left);
	header.appendChild(filters);

	const canvas = document.createElement('canvas');
	canvas.style.width = '100%';
	canvas.style.height = '100%';
	canvas.style.display = 'block';

	wrap.appendChild(header);
	wrap.appendChild(document.createElement('div')).className = 'h-3';
	wrap.appendChild(canvas);
	container.appendChild(wrap);

	const ctx = canvas.getContext('2d');

	let chartInstance;

	function updateChart(d) {
		const config = getConfig(d);
		if (chartInstance) {
			chartInstance.data = config.data;
			chartInstance.options = config.options;
			chartInstance.update();
			return;
		}
		chartInstance = new window.Chart(ctx, config);
		// Attach on container for future destroys
		container.__chartInstance = chartInstance;
	}

	function getConfig(d) {
		const defaultColors = ['#4C52F8', '#7B61FF', '#A68CFF', '#C7B8FF'];
		return {
			type: d.type || 'line',
			data: {
				labels: d.labels || [],
				datasets: (d.series || []).map((s, i) => ({
					label: s.name,
					data: s.data,
					tension: 0.35,
					borderColor: s.color || defaultColors[i % defaultColors.length],
					backgroundColor: s.backgroundColor || `${(s.color || defaultColors[i % defaultColors.length])}22`,
					fill: d.type === 'line',
					stack: s.stack || undefined,
				})),
			},
			options: {
				maintainAspectRatio: false,
				plugins: {
					legend: { display: true, labels: { color: getTextColor() } },
					tooltip: { intersect: false, mode: 'index' },
				},
				scales: {
					x: { ticks: { color: getTextColor() }, grid: { color: getGridColor() } },
					y: { ticks: { color: getTextColor() }, grid: { color: getGridColor() }, beginAtZero: true },
				},
			}
		};
	}

	function getTextColor() {
		return document.documentElement.classList.contains('dark') ? '#E5E7EB' : '#0F172A';
	}
	function getGridColor() {
		return document.documentElement.classList.contains('dark') ? '#1F2937' : '#E5E7EB';
	}

	updateChart(dataset);

	return {
		refresh(newDataset) {
			updateChart(newDataset);
		}
	};
}


