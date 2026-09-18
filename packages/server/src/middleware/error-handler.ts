import { AppError } from '../errors/app-error';
import { ValidationError } from '../errors/validation-error';

export interface ErrorHandlerRequest {
	body?: Record<string, unknown>;
	params?: Record<string, string>;
	query?: Record<string, string>;
	headers?: Record<string, string>;
}

export interface ErrorHandlerResponse {
	status: (code: number) => ErrorHandlerResponse;
	json: (data: unknown) => void;
}

export interface ErrorHandlerNext {
	(err: Error): void;
}

export function errorHandler(err: Error, _req: ErrorHandlerRequest, res: ErrorHandlerResponse, _next: ErrorHandlerNext): void {
	if (err instanceof ValidationError) {
		res.status(422).json({
			error: {
				message: err.message,
				code: err.code,
				statusCode: err.statusCode,
				...(err.details ? { details: err.details } : {}),
			},
		});
		return;
	}
	if (err instanceof AppError) {
		res.status(err.statusCode).json({
			error: {
				message: err.message,
				code: err.code,
				statusCode: err.statusCode,
			},
		});
		return;
	}
	res.status(500).json({
		error: {
			message: 'Internal server error',
			code: 'INTERNAL_ERROR',
			statusCode: 500,
		},
	});
}
