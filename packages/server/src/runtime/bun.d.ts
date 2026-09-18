declare module 'bun' {
	export interface ServeOptions {
		port?: number;
		hostname?: string;
		fetch(req: Request): Response | Promise<Response>;
	}
	export interface BunServer {
		readonly port: number;
		stop(): void;
	}
	export function serve(options: ServeOptions): BunServer;
	export const password: {
		hash(password: string, options?: { algorithm?: 'bcrypt'; cost?: number }): Promise<string>;
		verify(password: string, hash: string): Promise<boolean>;
	};
	export const env: Record<string, string | undefined>;
}

declare module 'bun:test' {
	export function describe(name: string, fn: () => void | Promise<void>): void;
	export function it(name: string, fn: () => void | Promise<void>): void;
	export const expect: {
		(val: unknown): {
			toBe(expected: unknown): void;
			toEqual(expected: unknown): void;
			toBeNull(): void;
			toBeGreaterThan(n: number): void;
			rejects: { toThrow(expected?: string | RegExp): Promise<void> };
		};
	};
}
