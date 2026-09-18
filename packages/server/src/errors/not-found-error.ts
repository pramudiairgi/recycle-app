import { AppError } from './app-error';

export class NotFoundError extends AppError {
	constructor(message: string = 'Resource not found') {
		super(message, 'NOT_FOUND', 404);
		this.name = 'NotFoundError';
	}
}
