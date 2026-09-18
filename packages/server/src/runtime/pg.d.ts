declare module 'pg' {
	export interface QueryResult<R = unknown> {
		rows: R[];
		rowCount: number | null;
	}
	export interface PoolClient {
		query(text: string, params?: unknown[]): Promise<QueryResult>;
		release(): void;
	}
	export interface PoolOptions {
		connectionString?: string;
	}
	export class Pool {
		constructor(options?: PoolOptions);
		connect(): Promise<PoolClient>;
		end(): Promise<void>;
	}
}
