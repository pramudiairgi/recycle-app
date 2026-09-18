import { UnauthorizedError } from '../errors/unauthorized-error';

export interface JwtPayload {
	sub: number; // user id
	tenantId: number;
	role: string;
	iat: number;
	exp: number;
}

function base64UrlEncode(bytes: Uint8Array): string {
	let bin = '';
	for (const b of bytes) bin += String.fromCharCode(b);
	return btoa(bin).replace(/\+/g, '-').replace(/\//g, '_').replace(/=+$/, '');
}

function base64UrlDecode(input: string): Uint8Array {
	const padded = input.replace(/-/g, '+').replace(/_/g, '/');
	const bin = atob(padded);
	const out = new Uint8Array(bin.length);
	for (let i = 0; i < bin.length; i++) out[i] = bin.charCodeAt(i);
	return out;
}

async function getKey(secret: string): Promise<CryptoKey> {
	return crypto.subtle.importKey(
		'raw',
		new TextEncoder().encode(secret),
		{ name: 'HMAC', hash: 'SHA-256' },
		false,
		['sign', 'verify'],
	);
}

export async function signJwt(
	claims: { sub: number; tenantId: number; role: string },
	secret: string,
	expiresInSec: number,
): Promise<string> {
	const now = Math.floor(Date.now() / 1000);
	const payload: JwtPayload = { ...claims, iat: now, exp: now + expiresInSec };
	const header = base64UrlEncode(new TextEncoder().encode(JSON.stringify({ alg: 'HS256', typ: 'JWT' })));
	const body = base64UrlEncode(new TextEncoder().encode(JSON.stringify(payload)));
	const key = await getKey(secret);
	const sig = await crypto.subtle.sign('HMAC', key, new TextEncoder().encode(`${header}.${body}`));
	return `${header}.${body}.${base64UrlEncode(new Uint8Array(sig))}`;
}

export async function verifyJwt(token: string, secret: string): Promise<JwtPayload> {
	const parts = token.split('.');
	if (parts.length !== 3) throw new UnauthorizedError('Malformed token');
	const [header, body, sig] = parts;
	const key = await getKey(secret);
	const sigBytes = Uint8Array.from(base64UrlDecode(sig));
	const valid = await crypto.subtle.verify(
		'HMAC',
		key,
		sigBytes,
		new TextEncoder().encode(`${header}.${body}`),
	);
	if (!valid) throw new UnauthorizedError('Invalid token signature');
	const payload = JSON.parse(new TextDecoder().decode(base64UrlDecode(body))) as JwtPayload;
	if (typeof payload.exp !== 'number' || payload.exp * 1000 < Date.now()) {
		throw new UnauthorizedError('Token expired');
	}
	return payload;
}
