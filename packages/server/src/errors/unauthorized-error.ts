import { AppError } from './app-error';

export class UnauthorizedError extends AppError {
	constructor(message: string = 'Unauthorized') {
		super(message, 'UNAUTHORIZED', 401);
		this.name = 'UnauthorizedError';
	}
}
