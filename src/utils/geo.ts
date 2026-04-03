/** Haversine distance in km between two lat/lon pairs. */
export function haversine(
	lat1: number,
	lon1: number,
	lat2: number,
	lon2: number,
): number {
	const R = 6371;
	const dLat = ((lat2 - lat1) * Math.PI) / 180;
	const dLon = ((lon2 - lon1) * Math.PI) / 180;
	const a =
		Math.sin(dLat / 2) ** 2 +
		Math.cos((lat1 * Math.PI) / 180) *
			Math.cos((lat2 * Math.PI) / 180) *
			Math.sin(dLon / 2) ** 2;
	return R * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));
}

/** Geocode an address via Nominatim (GB only). Returns [lat, lon] or null. */
export async function geocodeAddress(
	address: string,
	cache: Map<string, [number, number]>,
): Promise<[number, number] | null> {
	const cached = cache.get(address);
	if (cached) return cached;
	try {
		const res = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(address)}&format=json&limit=1&countrycodes=gb`,
			{ headers: { "User-Agent": "PipeLineApp/1.0" } },
		);
		const data = await res.json();
		if (data.length > 0) {
			const coords: [number, number] = [
				parseFloat(data[0].lat),
				parseFloat(data[0].lon),
			];
			cache.set(address, coords);
			return coords;
		}
	} catch {
		// skip
	}
	return null;
}
