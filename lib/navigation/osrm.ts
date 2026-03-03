import { formatInstructionFr } from '@/lib/navigation/format-instructions-fr';
import type { LatLng, RouteErrorCode, RouteFallbackLinks, RouteResponse, RouteStep } from '@/lib/navigation/types';

const OSRM_BASE_URL = 'https://router.project-osrm.org';
const OSRM_TIMEOUT_MS = 6000;

interface OsrmManeuver {
  type?: string;
  modifier?: string;
  exit?: number;
}

interface OsrmStep {
  distance?: number;
  duration?: number;
  name?: string;
  maneuver?: OsrmManeuver;
}

interface OsrmLeg {
  steps?: OsrmStep[];
}

interface OsrmRoute {
  distance?: number;
  duration?: number;
  geometry?: {
    coordinates?: [number, number][];
  };
  legs?: OsrmLeg[];
}

interface OsrmRouteResponse {
  code?: string;
  routes?: OsrmRoute[];
}

export function buildFallbackLinks(origin: LatLng, destination: LatLng): RouteFallbackLinks {
  const originStr = `${origin.lat},${origin.lng}`;
  const destinationStr = `${destination.lat},${destination.lng}`;

  return {
    google_maps: `https://www.google.com/maps/dir/?api=1&origin=${encodeURIComponent(originStr)}&destination=${encodeURIComponent(destinationStr)}&travelmode=driving`,
    waze: `https://www.waze.com/ul?ll=${encodeURIComponent(destinationStr)}&navigate=yes`,
  };
}

function providerErrorResponse(
  fallbackLinks: RouteFallbackLinks,
  errorCode: RouteErrorCode
): RouteResponse {
  return {
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
}

function toRouteSteps(route: OsrmRoute): RouteStep[] {
  const legs = route.legs ?? [];
  const rawSteps = legs.flatMap((leg) => leg.steps ?? []);

  return rawSteps.slice(0, 40).map((step, index) => ({
    index,
    instruction: formatInstructionFr(step),
    distance_m: Math.max(0, Math.round(step.distance ?? 0)),
    duration_s: Math.max(0, Math.round(step.duration ?? 0)),
    name: (step.name ?? '').trim(),
  }));
}

function toGeometry(route: OsrmRoute): LatLng[] {
  const coordinates = route.geometry?.coordinates ?? [];
  return coordinates
    .filter((coord) => Array.isArray(coord) && coord.length === 2)
    .map((coord) => ({ lat: coord[1], lng: coord[0] }));
}

export async function fetchOsrmRoute(origin: LatLng, destination: LatLng): Promise<RouteResponse> {
  const fallbackLinks = buildFallbackLinks(origin, destination);

  const controller = new AbortController();
  const timeout = setTimeout(() => controller.abort(), OSRM_TIMEOUT_MS);

  try {
    const pair = `${origin.lng},${origin.lat};${destination.lng},${destination.lat}`;
    const params = new URLSearchParams({
      overview: 'full',
      geometries: 'geojson',
      steps: 'true',
      alternatives: 'false',
    });

    const response = await fetch(`${OSRM_BASE_URL}/route/v1/driving/${pair}?${params.toString()}`, {
      method: 'GET',
      headers: {
        Accept: 'application/json',
      },
      signal: controller.signal,
      cache: 'no-store',
    });

    if (!response.ok) {
      return providerErrorResponse(fallbackLinks, 'PROVIDER_UNAVAILABLE');
    }

    const payload = (await response.json()) as OsrmRouteResponse;
    const route = payload.routes?.[0];

    if (payload.code !== 'Ok' || !route) {
      return providerErrorResponse(fallbackLinks, 'PROVIDER_UNAVAILABLE');
    }

    const geometry = toGeometry(route);
    if (geometry.length < 2) {
      return providerErrorResponse(fallbackLinks, 'PROVIDER_UNAVAILABLE');
    }

    const distance = Math.max(0, Math.round(route.distance ?? 0));
    const duration = Math.max(0, Math.round(route.duration ?? 0));

    return {
      ok: true,
      provider: 'osrm',
      distance_m: distance,
      duration_s: duration,
      eta_iso: new Date(Date.now() + duration * 1000).toISOString(),
      geometry,
      steps: toRouteSteps(route),
      fallback_links: fallbackLinks,
    };
  } catch {
    return providerErrorResponse(fallbackLinks, 'PROVIDER_UNAVAILABLE');
  } finally {
    clearTimeout(timeout);
  }
}
