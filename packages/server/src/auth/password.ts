import { password } from 'bun';

export async function hashPassword(plain: string): Promise<string> {
	return password.hash(plain, { algorithm: 'bcrypt', cost: 10 });
}

export async function verifyPassword(plain: string, hash: string): Promise<boolean> {
	return password.verify(plain, hash);
}
