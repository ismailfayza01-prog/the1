'use client';

import { useEffect, useRef, useState, useCallback } from 'react';
import type { ReactNode } from 'react';
import type { Map as MapLibreMap, MapLayerMouseEvent } from 'maplibre-gl';
import type { Rider } from '@/lib/types';
import { Map3DBase } from '@/components/maps/Map3DBase';
import {
  fitMapToPoints,
  lineFeaturesToGeoJson,
  pointFeaturesToGeoJson,
  upsertGeoJsonSource,
  upsertLineLayers,
  upsertPointLayers,
} from '@/components/maps/layers';
import type { MapLineFeature, MapPointFeature } from '@/components/maps/types';
import { fetchOsrmRoute } from '@/lib/navigation/osrm';

const DEFAULT_BIZ_LOCATION = { lat: 35.7595, lng: -5.8340 };

const RIDERS_SOURCE_ID = 'business-riders-source';
const RIDERS_LAYER_ID = 'business-riders-layer';
const RIDERS_LABEL_LAYER_ID = 'business-riders-label-layer';

const STATIC_POINTS_SOURCE_ID = 'business-static-points-source';
const STATIC_POINTS_LAYER_ID = 'business-static-points-layer';

const ROUTE_SOURCE_ID = 'business-route-source';
const ROUTE_LAYER_ID = 'business-route-layer';
const ROUTE_GLOW_LAYER_ID = 'business-route-glow-layer';

const DELIVERY_ROUTE_SOURCE_ID = 'business-delivery-route-source';
const DELIVERY_ROUTE_LAYER_ID = 'business-delivery-route-layer';
const DELIVERY_ROUTE_GLOW_LAYER_ID = 'business-delivery-route-glow-layer';

function getRiderLocation(rider: Rider): { lat: number; lng: number } {
  if (typeof rider.last_lat === 'number' && typeof rider.last_lng === 'number') {
    return { lat: rider.last_lat, lng: rider.last_lng };
  }

  const fromJson = rider.current_location as { lat: number; lng: number } | null;
  if (fromJson) return fromJson;

  // Deterministic fallback
  let h = 0;
  for (let i = 0; i < rider.id.length; i++) h = (h * 31 + rider.id.charCodeAt(i)) & 0xffff;
  return {
    lat: 35.65 + ((h & 0xff) / 255) * 0.18,
    lng: -5.98 + (((h >> 8) & 0xff) / 255) * 0.28,
  };
}

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

export interface RoutePreview {
  distance_m: number;
  duration_s: number;
}

interface BusinessMap3DProps {
  riders: Rider[];
  businessLocation?: { lat: number; lng: number };
  selectedRiderId: string | null;
  onSelectRider: (id: string | null) => void;
  pinMode?: 'pickup' | 'dropoff' | null;
  pickupPin?: { lat: number; lng: number } | null;
  dropoffPin?: { lat: number; lng: number } | null;
  onMapPin?: (lat: number, lng: number) => void;
  onRoutePreview?: (preview: RoutePreview | null) => void;
  className?: string;
  fallback?: ReactNode;
}

export function BusinessMap3D({
  riders,
  businessLocation = DEFAULT_BIZ_LOCATION,
  selectedRiderId,
  onSelectRider,
  pinMode = null,
  pickupPin = null,
  dropoffPin = null,
  onMapPin,
  onRoutePreview,
  className,
  fallback = null,
}: BusinessMap3DProps) {
  const mapCenter = businessLocation ?? DEFAULT_BIZ_LOCATION;
  const mapRef = useRef<MapLibreMap | null>(null);
  const previousSelectedRiderRef = useRef<string | null>(null);
  const lastCenteredBusinessRef = useRef<{ lat: number; lng: number } | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const [deliveryRoutePoints, setDeliveryRoutePoints] = useState<{ lat: number; lng: number }[]>([]);
  const routeFetchRef = useRef(0); // For cancellation

  // Fetch OSRM route when pickup + dropoff are both set
  const fetchRoute = useCallback(async (
    origin: { lat: number; lng: number },
    destination: { lat: number; lng: number }
  ) => {
    const fetchId = ++routeFetchRef.current;
    try {
      const result = await fetchOsrmRoute(origin, destination);
      if (fetchId !== routeFetchRef.current) return; // stale
      if (result.ok && result.geometry.length >= 2) {
        setDeliveryRoutePoints(result.geometry);
        onRoutePreview?.({ distance_m: result.distance_m, duration_s: result.duration_s });
      } else {
        // Fallback to straight line
        setDeliveryRoutePoints([origin, destination]);
        onRoutePreview?.(null);
      }
    } catch {
      setDeliveryRoutePoints([origin, destination]);
      onRoutePreview?.(null);
    }
  }, [onRoutePreview]);

  useEffect(() => {
    const origin = pickupPin ?? mapCenter;
    if (dropoffPin) {
      fetchRoute(origin, dropoffPin);
    } else {
      setDeliveryRoutePoints([]);
      onRoutePreview?.(null);
    }
  }, [pickupPin?.lat, pickupPin?.lng, dropoffPin?.lat, dropoffPin?.lng, mapCenter.lat, mapCenter.lng, fetchRoute, onRoutePreview]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const previous = lastCenteredBusinessRef.current;
    const sameCenter = !!previous && previous.lat === mapCenter.lat && previous.lng === mapCenter.lng;
    if (sameCenter) return;

    mapRef.current.easeTo({
      center: [mapCenter.lng, mapCenter.lat],
      zoom: 13,
      duration: 500,
    });
    lastCenteredBusinessRef.current = { lat: mapCenter.lat, lng: mapCenter.lng };
  }, [mapCenter.lat, mapCenter.lng, mapReady]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    const riderPoints: MapPointFeature[] = riders.map((rider) => {
      const location = getRiderLocation(rider);
      const selected = rider.id === selectedRiderId;

      return {
        id: rider.id,
        riderId: rider.id,
        lat: location.lat,
        lng: location.lng,
        label: rider.name,
        color: getRiderStatusColor(rider.status),
        radius: selected ? 9 : 7,
        strokeColor: '#ffffff',
        strokeWidth: selected ? 2.4 : 1.8,
        opacity: selected ? 1 : 0.92,
      };
    });

    const staticPoints: MapPointFeature[] = [
      {
        id: 'business-origin',
        lat: mapCenter.lat,
        lng: mapCenter.lng,
        label: 'Business',
        color: '#0ea5e9',
        radius: 7,
        strokeColor: '#ffffff',
        strokeWidth: 2,
      },
      ...(pickupPin
        ? [{
            id: 'pickup-pin',
            lat: pickupPin.lat,
            lng: pickupPin.lng,
            label: 'Pickup',
            color: '#38bdf8',
            radius: 6,
            strokeColor: '#ffffff',
            strokeWidth: 1.5,
          }]
        : []),
      ...(dropoffPin
        ? [{
            id: 'dropoff-pin',
            lat: dropoffPin.lat,
            lng: dropoffPin.lng,
            label: 'Dropoff',
            color: '#ef4444',
            radius: 6,
            strokeColor: '#ffffff',
            strokeWidth: 1.5,
          }]
        : []),
    ];

    // Rider selection route (straight line to business)
    const selectedRider = riders.find((rider) => rider.id === selectedRiderId) ?? null;
    const riderRouteLines: MapLineFeature[] = selectedRider
      ? [{
          id: `route-${selectedRider.id}`,
          points: [mapCenter, getRiderLocation(selectedRider)],
          color: '#10b981',
          width: 4,
          opacity: 0.95,
          glowColor: '#10b981',
          glowWidth: 9,
          dashed: true,
        }]
      : [];

    // Delivery route (OSRM-based pickup→dropoff route)
    const deliveryRouteLines: MapLineFeature[] = deliveryRoutePoints.length >= 2
      ? [{
          id: 'delivery-route',
          points: deliveryRoutePoints,
          color: '#6366f1',
          width: 4,
          opacity: 0.9,
          glowColor: '#6366f1',
          glowWidth: 10,
          dashed: false,
        }]
      : [];

    upsertGeoJsonSource(map, RIDERS_SOURCE_ID, pointFeaturesToGeoJson(riderPoints));
    upsertPointLayers(map, RIDERS_SOURCE_ID, RIDERS_LAYER_ID, RIDERS_LABEL_LAYER_ID);

    upsertGeoJsonSource(map, STATIC_POINTS_SOURCE_ID, pointFeaturesToGeoJson(staticPoints));
    upsertPointLayers(map, STATIC_POINTS_SOURCE_ID, STATIC_POINTS_LAYER_ID);

    upsertGeoJsonSource(map, ROUTE_SOURCE_ID, lineFeaturesToGeoJson(riderRouteLines));
    upsertLineLayers(map, ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID);

    upsertGeoJsonSource(map, DELIVERY_ROUTE_SOURCE_ID, lineFeaturesToGeoJson(deliveryRouteLines));
    upsertLineLayers(map, DELIVERY_ROUTE_SOURCE_ID, DELIVERY_ROUTE_LAYER_ID, DELIVERY_ROUTE_GLOW_LAYER_ID);

    // Fit to show all relevant points
    if (selectedRider) {
      fitMapToPoints(map, [mapCenter, getRiderLocation(selectedRider)], 15);
      previousSelectedRiderRef.current = selectedRider.id;
      return;
    }

    if (deliveryRoutePoints.length >= 2) {
      const origin = pickupPin ?? mapCenter;
      fitMapToPoints(map, [origin, dropoffPin!], 15);
      previousSelectedRiderRef.current = null;
      return;
    }

    if (previousSelectedRiderRef.current) {
      map.easeTo({
        center: [mapCenter.lng, mapCenter.lat],
        zoom: 13,
        duration: 400,
      });
      previousSelectedRiderRef.current = null;
    }
  }, [deliveryRoutePoints, dropoffPin, mapCenter, mapReady, pickupPin, riders, selectedRiderId]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;

    const onRiderClick = (event: MapLayerMouseEvent) => {
      const feature = event.features?.[0];
      const riderId = typeof feature?.properties?.riderId === 'string'
        ? feature.properties.riderId
        : typeof feature?.properties?.id === 'string'
          ? feature.properties.id
          : null;
      if (!riderId) return;
      const rider = riders.find((entry) => entry.id === riderId);
      if (!rider || rider.status !== 'available') return;

      onSelectRider(riderId === selectedRiderId ? null : riderId);
    };

    const onMapClick = (event: MapLayerMouseEvent) => {
      if (!pinMode || !onMapPin) return;

      const riderHit = map.queryRenderedFeatures(event.point, {
        layers: [RIDERS_LAYER_ID],
      });

      if (riderHit.length > 0) return;
      onMapPin(event.lngLat.lat, event.lngLat.lng);
    };

    const onMouseEnter = () => {
      map.getCanvas().style.cursor = 'pointer';
    };

    const onMouseLeave = () => {
      map.getCanvas().style.cursor = '';
    };

    map.on('click', RIDERS_LAYER_ID, onRiderClick);
    map.on('click', onMapClick);
    map.on('mouseenter', RIDERS_LAYER_ID, onMouseEnter);
    map.on('mouseleave', RIDERS_LAYER_ID, onMouseLeave);

    return () => {
      map.off('click', RIDERS_LAYER_ID, onRiderClick);
      map.off('click', onMapClick);
      map.off('mouseenter', RIDERS_LAYER_ID, onMouseEnter);
      map.off('mouseleave', RIDERS_LAYER_ID, onMouseLeave);
    };
  }, [mapReady, onMapPin, onSelectRider, pinMode, riders, selectedRiderId]);

  return (
    <Map3DBase
      className={className}
      center={{ lat: mapCenter.lat, lng: mapCenter.lng }}
      zoom={13}
      pitch={45}
      bearing={12}
      onMapReady={(map) => {
        mapRef.current = map;
        setMapReady(true);
      }}
      onMapError={(error) => {
        console.error('Business 3D map failed, using Leaflet fallback', error);
      }}
      fallback={fallback}
    />
  );
}
