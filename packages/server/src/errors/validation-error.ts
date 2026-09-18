import { AppError } from './app-error';

export class ValidationError extends AppError {
	public readonly details?: Record<string, string[]>;

	constructor(message: string, details?: Record<string, string[]>) {
		super(message, 'VALIDATION_ERROR', 422);
		this.name = 'ValidationError';
		this.details = details;
	}
}
