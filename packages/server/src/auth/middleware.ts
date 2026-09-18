import { UnauthorizedError } from '../errors/unauthorized-error';
import { ForbiddenError } from '../errors/forbidden-error';
import { verifyJwt } from './jwt';

export type Scope =
	| 'admin:all'
	| 'transactions:write'
	| 'transactions:verify'
	| 'transactions:read'
	| 'ledgers:read'
	| 'ledgers:write'
	| 'costs:write'
	| 'factories:manage'
	| 'payroll:approve'
	| 'payroll:prepare'
	| 'reports:read';

/** Role × scope matrix from PRD §5.3. '*' grants every scope (OWNER). */
const MATRIX: Record<string, Scope[] | '*'> = {
	OWNER: '*',
	TENANT_ADMIN: ['transactions:write', 'transactions:verify', 'transactions:read', 'ledgers:read', 'ledgers:write', 'costs:write'],
	ACCOUNTANT: ['transactions:read', 'ledgers:read', 'costs:write', 'payroll:prepare', 'reports:read'],
	PARTNER: ['ledgers:read', 'reports:read'],
	DRIVER: ['transactions:write', 'transactions:read'],
	WORKER: ['transactions:write', 'transactions:read'],
};

export function roleCan(role: string, scope: Scope): boolean {
	const granted = MATRIX[role];
	if (!granted) return false;
	if (granted === '*') return true;
	return granted.includes(scope);
}

export interface AuthContext {
	tenantId: number;
	userId: number | null;
	role: string | null;
	viaApiKey: boolean;
}

export interface AuthOptions {
	apiKeys: Set<string>;
	jwtSecret: string;
}

/**
 * Two-layer auth: `x-api-key` (M2M, full OWNER-equivalent within its tenant)
 * or `Authorization: Bearer <JWT>` (human users, role-checked per scope later).
 * API keys are formatted `<tenantId>:<secret>` so tenant scope is explicit.
 */
export async function authenticate(req: Request, opts: AuthOptions): Promise<AuthContext> {
	const apiKey = req.headers.get('x-api-key');
	if (apiKey) {
		if (!opts.apiKeys.has(apiKey)) throw new UnauthorizedError('Invalid API key');
		const sep = apiKey.indexOf(':');
		const tenantId = sep > 0 ? Number(apiKey.slice(0, sep)) : NaN;
		if (!Number.isInteger(tenantId)) throw new UnauthorizedError('Malformed API key scope');
		return { tenantId, userId: null, role: 'OWNER', viaApiKey: true };
	}
	const auth = req.headers.get('authorization');
	if (!auth?.startsWith('Bearer ')) throw new UnauthorizedError('Missing credentials');
	const payload = await verifyJwt(auth.slice(7), opts.jwtSecret);
	return { tenantId: payload.tenantId, userId: payload.sub, role: payload.role, viaApiKey: false };
}

/** Enforce scope after authenticate(). Throws 403 when the role lacks the scope. */
export function requireScope(ctx: AuthContext, scope: Scope): void {
	if (!ctx.role || !roleCan(ctx.role, scope)) {
		throw new ForbiddenError(`Role ${ctx.role ?? 'unknown'} cannot access ${scope}`);
	}
}
