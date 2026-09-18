export async function compressImage(buffer: Uint8Array, maxKb: number = 200): Promise<Buffer> {
	const targetBytes = maxKb * 1024;
	if (buffer.length <= targetBytes) {
		return Buffer.from(buffer);
	}
	let low = 1;
	let high = 100;
	let quality = 80;
	while (low <= high) {
		const mid = Math.floor((low + high) / 2);
		quality = mid;
		const compressed = await simulateCompress(buffer, quality);
		if (compressed.length <= targetBytes) {
			if (mid === high || compressed.length === targetBytes) {
				return compressed;
			}
			low = mid + 1;
		} else {
			high = mid - 1;
		}
	}
	const finalQuality = high;
	return simulateCompress(buffer, finalQuality);
}

async function simulateCompress(buffer: Uint8Array, quality: number): Promise<Buffer> {
	const ratio = quality / 100;
	const targetSize = Math.max(1, Math.floor(buffer.length * ratio * 0.7));
	const result = Buffer.alloc(targetSize);
	for (let i = 0; i < targetSize && i < buffer.length; i += 2) {
		result[i / 2] = buffer[i];
	}
	return result;
}
