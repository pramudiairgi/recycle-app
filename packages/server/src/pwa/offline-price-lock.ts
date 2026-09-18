interface LockedPrice {
	deviceId: string;
	priceIdr: number;
	offlineTimestamp: number;
	syncedAt?: number;
}

const lockedPrices = new Map<string, LockedPrice>();

export function lockPrice(priceIdr: number, timestamp: number, deviceId: string): LockedPrice {
	const locked: LockedPrice = {
		deviceId,
		priceIdr,
		offlineTimestamp: timestamp,
	};
	lockedPrices.set(deviceId, locked);
	return locked;
}

export function getLockedPrice(deviceId: string): LockedPrice | null {
	return lockedPrices.get(deviceId) ?? null;
}

export function syncLockedPrices(deviceId: string, serverTimestamp: number): LockedPrice | null {
	const locked = lockedPrices.get(deviceId);
	if (!locked) {
		return null;
	}
	locked.syncedAt = serverTimestamp;
	lockedPrices.set(deviceId, locked);
	return locked;
}

export function getAllLockedPrices(): LockedPrice[] {
	return Array.from(lockedPrices.values());
}

export function clearLockedPrice(deviceId: string): void {
	lockedPrices.delete(deviceId);
}
