// Data helpers: fetch wrappers for Netlify functions, JSON parsing, KPI calculations

export function parseJSON(data) {
	try {
		if (data == null) return [];
		return typeof data === 'string' ? JSON.parse(data) : data;
	} catch {
		return [];
	}
}

async function getJson(url, opts) {
    const res = await fetch(url, { headers: { 'Content-Type': 'application/json' }, ...opts });
	if (!res.ok) throw new Error(`Request failed: ${res.status}`);
	return await res.json();
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

export async function fetchClients() {
	// Backed by Netlify function
	const data = await getJson('/.netlify/functions/get-all-clients');
	return data?.clients || data || [];
}

export async function fetchLeads() {
    const token = await getIdentityToken();
    const raw = await getJson('/.netlify/functions/get-leads', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
	const arr = Array.isArray(raw) ? raw : raw?.leads || raw?.data || raw?.rows || [];
	// Normalize common field names
	return arr.map((l, i) => ({
		id: l.id ?? l.lead_id ?? i,
		name: l.name ?? l.full_name ?? '',
		email: l.email ?? l.email_address ?? '',
		phone: l.phone ?? l.phone_number ?? '',
		service: l.service ?? l.topic ?? l.source_service ?? '',
		message: l.message ?? l.notes ?? '',
		source: (l.source || l.origin || 'other').toLowerCase(),
		status: l.status || 'New',
		created_at: l.created_at || l.createdAt || l.timestamp || l.submitted_at || null,
		score: l.score || l.lead_score || 'warm',
		assigned_to: l.assigned_to || l.assignee || 'unassigned',
	}))
}

export async function fetchProjects() {
    const token = await getIdentityToken();
    const data = await getJson('/.netlify/functions/get-projects', { headers: token ? { Authorization: `Bearer ${token}` } : undefined });
	return data?.projects || data || [];
}

export function computeKPIs({ clients = [], projects = [], invoices = [] }) {
    const totalClients = clients.length;
    const activeProjects = clients.reduce((sum, c) => sum + (Number(c.kpis?.activeProjects) || (Array.isArray(c.projects) ? c.projects.length : (Array.isArray(c.projects?.data) ? c.projects.data.length : 0))), 0) ||
        projects.filter((p) => (p.status || '').toLowerCase() === 'active').length;
    const openInvoices = clients.reduce((sum, c) => sum + (Number(c.kpis?.openInvoices) || (Array.isArray(c.invoices) ? c.invoices.filter((i) => (i.status || '').toLowerCase() !== 'paid').length : 0)), 0) ||
        invoices.filter((i) => (i.status || '').toLowerCase() !== 'paid').length;
    const activeClients = clients.filter((c) => (c.status || '').toLowerCase() === 'active').length;
    const conversions = Math.round((activeClients / Math.max(clients.length, 1)) * 100);
    const monthlyRevenue = (Array.isArray(invoices) ? invoices : [])
        .filter((i) => (i.status || '').toLowerCase() === 'paid')
        .reduce((sum, i) => sum + (Number(i.amount) || 0), 0);

	return [
		{ label: 'Total Clients', value: String(totalClients), trendPct: 4.2, trendLabel: 'vs last month' },
		{ label: 'Active Projects', value: String(activeProjects), trendPct: 2.1, trendLabel: 'vs last month' },
		{ label: 'Open Invoices', value: String(openInvoices), trendPct: -1.3, trendLabel: 'vs last month' },
		{ label: 'Conversion Rate', value: `${conversions}%`, trendPct: 0.8, trendLabel: 'vs last month' },
		{ label: 'Monthly Revenue', value: `$${formatNumber(monthlyRevenue)}`, trendPct: 3.6, trendLabel: 'vs last month' },
	];
}

export function buildRevenueDataset(range = 'month') {
	const labels = range === 'week' ? ['Mon','Tue','Wed','Thu','Fri','Sat','Sun'] : range === 'quarter' ? ['Q1','Q2','Q3','Q4'] : ['Jan','Feb','Mar','Apr','May','Jun','Jul','Aug','Sep','Oct','Nov','Dec'];
	const points = labels.map(() => Math.round(500 + Math.random() * 200));
	return { type: 'line', labels, series: [{ name: 'Revenue', data: points, color: '#4C52F8' }] };
}

export function buildLeadSourceDataset(leads = []) {
	const sources = ['website','instagram','referral','other'];
	const counts = sources.map((s) => leads.filter((l) => (l.source || '').toLowerCase() === s).length);
	return { type: 'bar', labels: sources.map(capitalize), series: [{ name: 'Leads', data: counts, color: '#7B61FF' }] };
}

function formatNumber(n) {
	return (Number(n) || 0).toLocaleString();
}

function capitalize(s) { return (s || '').charAt(0).toUpperCase() + (s || '').slice(1); }


