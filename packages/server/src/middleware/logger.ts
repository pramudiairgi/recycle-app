type LogLevel = 'INFO' | 'WARN' | 'ERROR';

interface LogEntry {
	timestamp: string;
	level: LogLevel;
	message: string;
	context?: Record<string, unknown>;
}

export function logger(level: LogLevel, message: string, context?: Record<string, unknown>): void {
	const entry: LogEntry = {
		timestamp: new Date().toISOString(),
		level,
		message,
		context,
	};
	const prefix = `[${entry.timestamp}] [${entry.level}] ${entry.message}`;
	if (level === 'ERROR') {
		console.error(prefix, context ?? '');
	} else if (level === 'WARN') {
		console.warn(prefix, context ?? '');
	} else {
		console.log(prefix, context ?? '');
	}
}

export function logRequest(method: string, path: string, statusCode: number): void {
	logger('INFO', `${method} ${path} ${statusCode}`);
}

export function logError(message: string, error?: Error): void {
	logger('ERROR', message, error ? { stack: error.stack, name: error.name } : undefined);
}

export function logWarning(message: string, context?: Record<string, unknown>): void {
	logger('WARN', message, context);
}
