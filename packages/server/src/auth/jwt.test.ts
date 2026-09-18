import { describe, it, expect } from 'bun:test';
import { signJwt, verifyJwt } from './jwt';

const SECRET = 'test-secret';

describe('jwt', () => {
	it('signs and verifies a round-trip payload', async () => {
		const token = await signJwt({ sub: 1, tenantId: 2, role: 'OWNER' }, SECRET, 3600);
		const payload = await verifyJwt(token, SECRET);
		expect(payload.sub).toBe(1);
		expect(payload.tenantId).toBe(2);
		expect(payload.role).toBe('OWNER');
		expect(payload.exp).toBeGreaterThan(payload.iat);
	});

	it('rejects tampered signatures', async () => {
		const token = await signJwt({ sub: 1, tenantId: 2, role: 'DRIVER' }, SECRET, 3600);
		const [h, b] = token.split('.');
		const bad = `${h}.${b}.AAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAAA`;
		await expect(verifyJwt(bad, SECRET)).rejects.toThrow();
	});

	it('rejects expired tokens', async () => {
		const token = await signJwt({ sub: 1, tenantId: 2, role: 'DRIVER' }, SECRET, -10);
		await expect(verifyJwt(token, SECRET)).rejects.toThrow('Token expired');
	});

	it('rejects malformed tokens', async () => {
		await expect(verifyJwt('not-a-jwt', SECRET)).rejects.toThrow();
	});

	it('rejects wrong secret', async () => {
		const token = await signJwt({ sub: 1, tenantId: 2, role: 'DRIVER' }, SECRET, 3600);
		await expect(verifyJwt(token, 'other-secret')).rejects.toThrow();
	});
});
