let toastRoot;

export function showToast(message, variant = 'success', timeoutMs = 2500) {
	if (!toastRoot) {
		toastRoot = document.createElement('div');
		toastRoot.className = 'fixed z-50 bottom-4 right-4 flex flex-col gap-2';
		document.body.appendChild(toastRoot);
	}

	const el = document.createElement('div');
	el.className = `min-w-[220px] max-w-sm rounded-lg px-3 py-2 text-sm shadow-lg border transition-all duration-200 translate-y-2 opacity-0 ${
		variant === 'error' ? 'bg-rose-50 text-rose-800 border-rose-200 dark:bg-rose-900/30 dark:text-rose-200 dark:border-rose-800' :
		variant === 'info' ? 'bg-slate-50 text-slate-800 border-slate-200 dark:bg-slate-800 dark:text-slate-100 dark:border-slate-700' :
		'bg-emerald-50 text-emerald-800 border-emerald-200 dark:bg-emerald-900/30 dark:text-emerald-200 dark:border-emerald-800'
	}`;
	el.textContent = message;
	toastRoot.appendChild(el);
	requestAnimationFrame(() => {
		el.classList.remove('translate-y-2', 'opacity-0');
		el.classList.add('translate-y-0', 'opacity-100');
	});
	setTimeout(() => dismissToast(el), timeoutMs);
}

export function dismissToast(el) {
	if (!el) return;
	el.classList.add('translate-y-2', 'opacity-0');
	setTimeout(() => el.remove(), 200);
}


