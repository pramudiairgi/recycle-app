import { describe, it, expect } from 'bun:test';
import { roleCan } from './middleware';

describe('roleCan (PRD §5.3 matrix)', () => {
	it('OWNER can access everything', () => {
		expect(roleCan('OWNER', 'transactions:write')).toBe(true);
		expect(roleCan('OWNER', 'admin:all')).toBe(true);
		expect(roleCan('OWNER', 'payroll:approve')).toBe(true);
	});

	it('PARTNER is read-only on ledgers and reports', () => {
		expect(roleCan('PARTNER', 'ledgers:read')).toBe(true);
		expect(roleCan('PARTNER', 'reports:read')).toBe(true);
		expect(roleCan('PARTNER', 'ledgers:write')).toBe(false);
		expect(roleCan('PARTNER', 'transactions:write')).toBe(false);
		expect(roleCan('PARTNER', 'payroll:approve')).toBe(false);
	});

	it('ACCOUNTANT prepares payroll but cannot approve or manage factories', () => {
		expect(roleCan('ACCOUNTANT', 'payroll:prepare')).toBe(true);
		expect(roleCan('ACCOUNTANT', 'costs:write')).toBe(true);
		expect(roleCan('ACCOUNTANT', 'payroll:approve')).toBe(false);
		expect(roleCan('ACCOUNTANT', 'factories:manage')).toBe(false);
	});

	it('DRIVER/WORKER can only create and read own transactions', () => {
		for (const role of ['DRIVER', 'WORKER']) {
			expect(roleCan(role, 'transactions:write')).toBe(true);
			expect(roleCan(role, 'transactions:read')).toBe(true);
			expect(roleCan(role, 'transactions:verify')).toBe(false);
			expect(roleCan(role, 'ledgers:read')).toBe(false);
		}
	});

	it('TENANT_ADMIN cannot touch factories or payroll approval', () => {
		expect(roleCan('TENANT_ADMIN', 'transactions:verify')).toBe(true);
		expect(roleCan('TENANT_ADMIN', 'factories:manage')).toBe(false);
		expect(roleCan('TENANT_ADMIN', 'payroll:approve')).toBe(false);
	});

	it('unknown roles can access nothing', () => {
		expect(roleCan('GHOST', 'transactions:read')).toBe(false);
	});
});
