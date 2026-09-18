const BASE = '/api/v1';

interface ApiResponse<T> {
	data: T;
	error?: { code: string; message: string; details?: Record<string, string[]> };
}

async function request<T>(method: string, path: string, body?: unknown, token?: string): Promise<T> {
	const headers: Record<string, string> = { 'content-type': 'application/json' };
	if (token) headers.authorization = `Bearer ${token}`;
	const res = await fetch(`${BASE}${path}`, {
		method,
		headers,
		body: body ? JSON.stringify(body) : undefined,
	});
	const json = (await res.json()) as ApiResponse<T>;
	if (!res.ok || json.error) {
		throw new Error(json.error?.message ?? `HTTP ${res.status}`);
	}
	return json.data;
}

export const api = {
	login: (email: string, password: string) =>
		request<{ token: string; user: { id: number; tenantId: number; role: string } }>('POST', '/auth/login', { email, password }),

	getTransactions: (token: string, params?: URLSearchParams) =>
		request<{ data: any[]; nextCursor?: string }>('GET', `/transactions${params ? `?${params}` : ''}`, undefined, token),

	createTransaction: (token: string, data: unknown) =>
		request<any>('POST', '/transactions', data, token),

	getTransaction: (token: string, id: number) =>
		request<any>('GET', `/transactions/${id}`, undefined, token),

	verifyTransaction: (token: string, id: number) =>
		request<any>('POST', `/transactions/${id}/verify`, undefined, token),

	completeTransaction: (token: string, id: number) =>
		request<any>('POST', `/transactions/${id}/complete`, undefined, token),

	cancelTransaction: (token: string, id: number, reason: string) =>
		request<any>('POST', `/transactions/${id}/cancel`, { reason }, token),

	syncTransaction: (token: string, data: unknown) =>
		request<any>('POST', '/transactions/sync', data, token),

	getCustomers: (token: string) =>
		request<{ data: any[] }>('GET', '/customers', undefined, token),

	createCustomer: (token: string, data: unknown) =>
		request<any>('POST', '/customers', data, token),

	getCategories: (token: string) =>
		request<{ data: any[] }>('GET', '/categories', undefined, token),

	getFactories: (token: string) =>
		request<{ data: any[] }>('GET', '/factories', undefined, token),

	getQuotes: (token: string, factoryId: number) =>
		request<{ data: any[] }>('GET', `/factories/${factoryId}/quotes`, undefined, token),

	createQuote: (token: string, data: unknown) =>
		request<any>('POST', '/factory-price-quotes', data, token),

	acceptQuote: (token: string, id: number) =>
		request<any>('POST', `/quotes/${id}/accept`, undefined, token),

	revokeQuote: (token: string, id: number) =>
		request<any>('POST', `/quotes/${id}/revoke`, undefined, token),

	getBiddingRank: (token: string, categoryId: number, tonStock: number) =>
		request<{ data: any[] }>('GET', `/bidding/rank?categoryId=${categoryId}&tonStock=${tonStock}`, undefined, token),

	getStockAvailable: (token: string, categoryId: number) =>
		request<{ data: { availableKg: number } }>('GET', `/stock/available?categoryId=${categoryId}`, undefined, token),

	getStockLots: (token: string) =>
		request<{ data: any[] }>('GET', '/stock-lots', undefined, token),

	getLedgers: (token: string, params?: URLSearchParams) =>
		request<{ data: any[]; nextCursor?: string }>('GET', `/ledgers${params ? `?${params}` : ''}`, undefined, token),

	getPayrollRuns: (token: string) =>
		request<{ data: any[] }>('GET', '/payroll-runs', undefined, token),

	preparePayroll: (token: string, data: unknown) =>
		request<any>('POST', '/payroll/prepare', data, token),

	approvePayroll: (token: string, id: number) =>
		request<any>('POST', `/payroll/runs/${id}/approve`, undefined, token),

	getTenants: (token: string) =>
		request<{ data: any[] }>('GET', '/tenants', undefined, token),

	getUsers: (token: string) =>
		request<{ data: any[] }>('GET', '/users', undefined, token),

	getProductionLogs: (token: string) =>
		request<{ data: any[] }>('GET', '/production-logs', undefined, token),

	getAttendances: (token: string) =>
		request<{ data: any[] }>('GET', '/attendances', undefined, token),
};

export type { ApiResponse };
