export interface LatLng {
  lat: number;
  lng: number;
}

export type RouteProfile = 'driving';
export type RouteLocale = 'fr';

export interface RouteRequest {
  origin: LatLng;
  destination: LatLng;
  profile: RouteProfile;
  locale: RouteLocale;
}

export interface RouteStep {
  index: number;
  instruction: string;
  distance_m: number;
  duration_s: number;
  name: string;
}

export interface RouteFallbackLinks {
  google_maps: string;
  waze: string;
}

export type RouteErrorCode = 'PROVIDER_UNAVAILABLE' | 'RATE_LIMIT' | 'INVALID_COORDS';

export interface RouteResponse {
  ok: boolean;
  provider: 'osrm';
  distance_m: number;
  duration_s: number;
  eta_iso: string;
  geometry: LatLng[];
  steps: RouteStep[];
  fallback_links: RouteFallbackLinks;
  degraded_mode?: boolean;
  error_code?: RouteErrorCode;
}
