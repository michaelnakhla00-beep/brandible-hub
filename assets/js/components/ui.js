// UI helpers: dark mode, sticky sidebar active state

const THEME_KEY = 'brandible_theme';

export function initThemeToggle(button) {
	if (!button) return;
	const saved = localStorage.getItem(THEME_KEY);
	if (saved === 'dark') document.documentElement.classList.add('dark');
	if (saved === 'light') document.documentElement.classList.remove('dark');
	button.addEventListener('click', () => {
		document.documentElement.classList.toggle('dark');
		localStorage.setItem(THEME_KEY, document.documentElement.classList.contains('dark') ? 'dark' : 'light');
	});
}

export function setActiveTab(tabButtons, activeId) {
	Array.from(tabButtons || []).forEach((btn) => {
		const id = btn.getAttribute('data-tab');
		btn.classList.toggle('bg-white', id === activeId);
		btn.classList.toggle('dark:bg-slate-900', id === activeId);
		btn.classList.toggle('shadow-sm', id === activeId);
	});
}


