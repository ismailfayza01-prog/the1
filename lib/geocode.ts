/**
 * Geocoding service using OpenStreetMap Nominatim API.
 * Provides forward geocoding (address → coordinates) and reverse geocoding (coordinates → address).
 * Biased toward Tangier, Morocco for relevance.
 */

export interface GeocodeSuggestion {
  display_name: string;
  short_name: string;
  lat: number;
  lng: number;
  place_id: number;
}

// Tangier bounding box for bias
const TANGIER_VIEWBOX = '-6.05,35.60,-5.65,35.88';

const NOMINATIM_BASE = 'https://nominatim.openstreetmap.org';

// Simple in-memory cache
const forwardCache = new Map<string, { ts: number; results: GeocodeSuggestion[] }>();
const reverseCache = new Map<string, { ts: number; result: string }>();
const CACHE_TTL_MS = 5 * 60 * 1000; // 5 minutes

function cacheKey(query: string): string {
  return query.trim().toLowerCase();
}

function reverseCacheKey(lat: number, lng: number): string {
  return `${lat.toFixed(5)},${lng.toFixed(5)}`;
}

function shortenDisplayName(display_name: string): string {
  // Nominatim returns very long names like "123 Rue X, Quartier Y, Tangier, Tanger-Tetouan-Al Hoceima, Morocco"
  // Shorten to the first 2-3 meaningful parts
  const parts = display_name.split(',').map((p) => p.trim());
  if (parts.length <= 2) return display_name;
  // Keep first 2 parts + city if present
  const meaningful = parts.slice(0, 3).join(', ');
  return meaningful;
}

/**
 * Forward geocode: search address text → list of coordinate suggestions.
 * Biased toward Tangier, Morocco.
 */
export async function geocodeForward(
  query: string,
  limit = 5,
  signal?: AbortSignal
): Promise<GeocodeSuggestion[]> {
  const trimmed = query.trim();
  if (trimmed.length < 2) return [];

  const key = cacheKey(trimmed);
  const cached = forwardCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.results;
  }

  const params = new URLSearchParams({
    q: trimmed,
    format: 'json',
    addressdetails: '1',
    limit: String(limit),
    viewbox: TANGIER_VIEWBOX,
    bounded: '0', // prefer viewbox but allow results outside
    countrycodes: 'ma',
    'accept-language': 'fr,en',
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/search?${params.toString()}`, {
      headers: { 'User-Agent': 'The1Courier/1.0' },
      signal,
    });

    if (!res.ok) return [];

    const data = await res.json();

    const results: GeocodeSuggestion[] = (data as any[]).map((item) => ({
      display_name: item.display_name,
      short_name: shortenDisplayName(item.display_name),
      lat: parseFloat(item.lat),
      lng: parseFloat(item.lon),
      place_id: item.place_id,
    }));

    forwardCache.set(key, { ts: Date.now(), results });
    return results;
  } catch {
    return [];
  }
}

/**
 * Reverse geocode: coordinates → human-readable address string.
 */
export async function geocodeReverse(
  lat: number,
  lng: number,
  signal?: AbortSignal
): Promise<string> {
  const key = reverseCacheKey(lat, lng);
  const cached = reverseCache.get(key);
  if (cached && Date.now() - cached.ts < CACHE_TTL_MS) {
    return cached.result;
  }

  const params = new URLSearchParams({
    lat: String(lat),
    lon: String(lng),
    format: 'json',
    zoom: '18',
    addressdetails: '1',
    'accept-language': 'fr,en',
  });

  try {
    const res = await fetch(`${NOMINATIM_BASE}/reverse?${params.toString()}`, {
      headers: { 'User-Agent': 'The1Courier/1.0' },
      signal,
    });

    if (!res.ok) return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    const data = await res.json();
    const name = shortenDisplayName(data.display_name ?? '');
    const result = name || `${lat.toFixed(5)}, ${lng.toFixed(5)}`;

    reverseCache.set(key, { ts: Date.now(), result });
    return result;
  } catch {
    return `${lat.toFixed(5)}, ${lng.toFixed(5)}`;
  }
}
