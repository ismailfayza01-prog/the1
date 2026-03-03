import type { ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';

export interface MapLatLng {
  lat: number;
  lng: number;
}

export interface MapPointFeature extends MapLatLng {
  id: string;
  label?: string;
  color?: string;
  radius?: number;
  strokeColor?: string;
  strokeWidth?: number;
  opacity?: number;
  textColor?: string;
  kind?: string;
  selected?: boolean;
  riderId?: string;
}

export interface MapLineFeature {
  id: string;
  points: MapLatLng[];
  color?: string;
  width?: number;
  opacity?: number;
  glowColor?: string;
  glowWidth?: number;
  dashed?: boolean;
}

export interface Map3DBaseProps {
  className?: string;
  center: MapLatLng;
  zoom?: number;
  minZoom?: number;
  maxZoom?: number;
  pitch?: number;
  bearing?: number;
  interactive?: boolean;
  buildingsEnabled?: boolean;
  fallback?: ReactNode;
  onMapReady?: (map: MapLibreMap) => void;
  onMapError?: (error: unknown) => void;
}
