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

// UK postcode (e.g. "BH15 1NN", "BH1 4QR") — used as a geocoding fallback.
const UK_POSTCODE = /[A-Z]{1,2}\d[A-Z\d]?\s*\d[A-Z]{2}/i;

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function nominatimLookup(query: string): Promise<[number, number] | null> {
	try {
		const res = await fetch(
			`https://nominatim.openstreetmap.org/search?q=${encodeURIComponent(query)}&format=json&limit=1&countrycodes=gb`,
			{ headers: { "User-Agent": "HiveQApp/1.0" } },
		);
		const data = await res.json();
		if (data.length > 0) {
			return [parseFloat(data[0].lat), parseFloat(data[0].lon)];
		}
	} catch {
		// skip
	}
	return null;
}

/**
 * Geocode an address via Nominatim (GB only). Returns [lat, lon] or null.
 * Falls back to the UK postcode if the full address can't be resolved — many
 * real addresses (flats, units, business parks) don't match at street level but
 * their postcode does.
 */
export async function geocodeAddress(
	address: string,
	cache: Map<string, [number, number]>,
): Promise<[number, number] | null> {
	const cached = cache.get(address);
	if (cached) return cached;

	let coords = await nominatimLookup(address);
	if (!coords) {
		const pc = address.match(UK_POSTCODE);
		if (pc) {
			await sleep(1100); // stay within Nominatim's ~1 req/s policy
			coords = await nominatimLookup(pc[0]);
		}
	}

	if (coords) cache.set(address, coords);
	return coords;
}
