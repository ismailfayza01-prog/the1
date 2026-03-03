import { NextRequest, NextResponse } from 'next/server';
import { buildFallbackLinks, fetchOsrmRoute } from '@/lib/navigation/osrm';
import type { LatLng, RouteErrorCode, RouteRequest, RouteResponse } from '@/lib/navigation/types';

const CACHE_TTL_MS = 60_000;
const RATE_LIMIT_WINDOW_MS = 60_000;
const RATE_LIMIT_MAX = 60;

interface RateLimitEntry {
  windowStart: number;
  count: number;
}

interface CacheEntry {
  expiresAt: number;
  payload: RouteResponse;
}

const routeCache = new Map<string, CacheEntry>();
const rateLimitStore = new Map<string, RateLimitEntry>();

function round5(value: number): number {
  return Number(value.toFixed(5));
}

function isFiniteNumber(value: unknown): value is number {
  return typeof value === 'number' && Number.isFinite(value);
}

function isValidLatLng(input: unknown): input is LatLng {
  if (!input || typeof input !== 'object') return false;
  const point = input as Partial<LatLng>;
  if (!isFiniteNumber(point.lat) || !isFiniteNumber(point.lng)) return false;
  if (point.lat < -90 || point.lat > 90) return false;
  if (point.lng < -180 || point.lng > 180) return false;
  return true;
}

function safePoint(input: unknown): LatLng {
  if (isValidLatLng(input)) {
    return { lat: input.lat, lng: input.lng };
  }
  return { lat: 0, lng: 0 };
}

function makeErrorResponse(errorCode: RouteErrorCode, fallbackLinks: RouteResponse['fallback_links']) {
  const statusByCode = {
    INVALID_COORDS: 400,
    RATE_LIMIT: 429,
    PROVIDER_UNAVAILABLE: 503,
  } as const;

  const payload: RouteResponse = {
    ok: false,
    provider: 'osrm',
    distance_m: 0,
    duration_s: 0,
    eta_iso: new Date().toISOString(),
    geometry: [],
    steps: [],
    fallback_links: fallbackLinks,
    degraded_mode: true,
    error_code: errorCode,
  };

  return NextResponse.json(payload, { status: statusByCode[errorCode] });
}

function getClientKey(request: NextRequest): string {
  const forwardedFor = request.headers.get('x-forwarded-for');
  if (forwardedFor) {
    return forwardedFor.split(',')[0].trim();
  }
  const realIp = request.headers.get('x-real-ip');
  if (realIp) return realIp.trim();
  return 'unknown';
}

function cleanupStores(now: number) {
  for (const [key, entry] of routeCache.entries()) {
    if (entry.expiresAt <= now) {
      routeCache.delete(key);
    }
  }

  for (const [key, entry] of rateLimitStore.entries()) {
    if (now - entry.windowStart > RATE_LIMIT_WINDOW_MS) {
      rateLimitStore.delete(key);
    }
  }
}

function isRateLimited(clientKey: string, now: number): boolean {
  const current = rateLimitStore.get(clientKey);

  if (!current || now - current.windowStart > RATE_LIMIT_WINDOW_MS) {
    rateLimitStore.set(clientKey, { windowStart: now, count: 1 });
    return false;
  }

  current.count += 1;
  rateLimitStore.set(clientKey, current);
  return current.count > RATE_LIMIT_MAX;
}

function makeCacheKey(origin: LatLng, destination: LatLng): string {
  return `${round5(origin.lat)},${round5(origin.lng)}|${round5(destination.lat)},${round5(destination.lng)}`;
}

export async function POST(request: NextRequest) {
  const body = (await request.json().catch(() => null)) as Partial<RouteRequest> | null;

  const fallbackLinks = buildFallbackLinks(safePoint(body?.origin), safePoint(body?.destination));

  if (!body || !isValidLatLng(body.origin) || !isValidLatLng(body.destination)) {
    return makeErrorResponse('INVALID_COORDS', fallbackLinks);
  }

  const origin = {
    lat: body.origin.lat,
    lng: body.origin.lng,
  };
  const destination = {
    lat: body.destination.lat,
    lng: body.destination.lng,
  };

  const now = Date.now();
  cleanupStores(now);

  const cacheKey = makeCacheKey(origin, destination);
  const cached = routeCache.get(cacheKey);
  if (cached && cached.expiresAt > now) {
    return NextResponse.json(cached.payload, { status: 200 });
  }

  const clientKey = getClientKey(request);
  if (isRateLimited(clientKey, now)) {
    return makeErrorResponse('RATE_LIMIT', fallbackLinks);
  }

  const route = await fetchOsrmRoute(origin, destination);

  if (!route.ok) {
    return makeErrorResponse(route.error_code ?? 'PROVIDER_UNAVAILABLE', route.fallback_links);
  }

  routeCache.set(cacheKey, {
    expiresAt: now + CACHE_TTL_MS,
    payload: route,
  });

  return NextResponse.json(route, { status: 200 });
}
