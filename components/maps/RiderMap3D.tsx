'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Delivery, Rider } from '@/lib/types';
import type { RouteResponse } from '@/lib/navigation/types';
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

const MAP_BOUNDS = { latMin: 35.74, latMax: 35.79, lngMin: -5.86, lngMax: -5.8 };

const RIDER_SOURCE_ID = 'rider-live-source';
const RIDER_LAYER_ID = 'rider-live-layer';

const STOPS_SOURCE_ID = 'rider-stops-source';
const STOPS_LAYER_ID = 'rider-stops-layer';
const STOPS_LABEL_LAYER_ID = 'rider-stops-label-layer';

const ROUTE_SOURCE_ID = 'rider-route-source';
const ROUTE_LAYER_ID = 'rider-route-layer';
const ROUTE_GLOW_LAYER_ID = 'rider-route-glow-layer';

type NavigationStage = 'pickup' | 'dropoff';

function seedLocation(id: string): { lat: number; lng: number } {
  let h = 0;
  for (let i = 0; i < id.length; i++) h = (h * 31 + id.charCodeAt(i)) & 0xffff;
  const lat = MAP_BOUNDS.latMin + ((h & 0xff) / 255) * (MAP_BOUNDS.latMax - MAP_BOUNDS.latMin);
  const lng = MAP_BOUNDS.lngMin + (((h >> 8) & 0xff) / 255) * (MAP_BOUNDS.lngMax - MAP_BOUNDS.lngMin);
  return { lat, lng };
}

function getRiderLocation(rider: Rider): { lat: number; lng: number } {
  if (typeof rider.last_lat === 'number' && typeof rider.last_lng === 'number') {
    return { lat: rider.last_lat, lng: rider.last_lng };
  }
  const fromJson = rider.current_location as { lat: number; lng: number } | null;
  if (fromJson) return fromJson;
  return seedLocation(rider.id);
}

function getDeliveryPoint(delivery: Delivery, kind: 'pickup' | 'dropoff'): { lat: number; lng: number } {
  if (kind === 'pickup' && typeof delivery.pickup_lat === 'number' && typeof delivery.pickup_lng === 'number') {
    return { lat: delivery.pickup_lat, lng: delivery.pickup_lng };
  }
  if (kind === 'dropoff' && typeof delivery.dropoff_lat === 'number' && typeof delivery.dropoff_lng === 'number') {
    return { lat: delivery.dropoff_lat, lng: delivery.dropoff_lng };
  }
  return seedLocation(`${delivery.id}-${kind}`);
}

function getNavigationStage(status: Delivery['status']): NavigationStage {
  if (status === 'picked_up' || status === 'in_transit') return 'dropoff';
  return 'pickup';
}

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

interface RiderMap3DProps {
  rider: Rider;
  activeDelivery: Delivery | null;
  assignedDelivery: Delivery | null;
  liveLocation: { lat: number; lng: number } | null;
  navigationRoute: RouteResponse | null;
  className?: string;
  fallback?: ReactNode;
}

export function RiderMap3D({
  rider,
  activeDelivery,
  assignedDelivery,
  liveLocation,
  navigationRoute,
  className,
  fallback = null,
}: RiderMap3DProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const [mapReady, setMapReady] = useState(false);
  const prevLocationRef = useRef<{ lat: number; lng: number } | null>(null);

  function computeBearing(from: { lat: number; lng: number }, to: { lat: number; lng: number }): number {
    const toRad = (d: number) => (d * Math.PI) / 180;
    const dLng = toRad(to.lng - from.lng);
    const lat1 = toRad(from.lat);
    const lat2 = toRad(to.lat);
    const x = Math.cos(lat1) * Math.sin(lat2) - Math.sin(lat1) * Math.cos(lat2) * Math.cos(dLng);
    const y = Math.sin(dLng) * Math.cos(lat2);
    const bearing = Math.atan2(y, x) * (180 / Math.PI);
    return (bearing + 360) % 360;
  }

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const riderLocation = liveLocation ?? getRiderLocation(rider);

    const riderPoints: MapPointFeature[] = [{
      id: rider.id,
      lat: riderLocation.lat,
      lng: riderLocation.lng,
      label: `You (${rider.status})`,
      color: getRiderStatusColor(rider.status),
      radius: 8,
      strokeColor: '#ffffff',
      strokeWidth: 2,
    }];

    const routeDelivery = activeDelivery ?? assignedDelivery;
    const stopPoints: MapPointFeature[] = [];
    const routeLines: MapLineFeature[] = [];

    if (routeDelivery) {
      const pickup = getDeliveryPoint(routeDelivery, 'pickup');
      const dropoff = getDeliveryPoint(routeDelivery, 'dropoff');
      const stage = getNavigationStage(routeDelivery.status);
      const destination = stage === 'pickup' ? pickup : dropoff;

      stopPoints.push(
        {
          id: `${routeDelivery.id}-pickup`,
          lat: pickup.lat,
          lng: pickup.lng,
          label: 'Pickup',
          color: '#38bdf8',
          radius: 6,
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
        {
          id: `${routeDelivery.id}-dropoff`,
          lat: dropoff.lat,
          lng: dropoff.lng,
          label: 'Dropoff',
          color: '#ef4444',
          radius: 6,
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        }
      );

      const routePoints = navigationRoute?.ok && navigationRoute.geometry.length > 1
        ? navigationRoute.geometry
        : [riderLocation, destination];

      routeLines.push({
        id: routeDelivery.id,
        points: routePoints,
        color: activeDelivery ? '#10b981' : '#f59e0b',
        width: 4,
        opacity: 0.95,
        glowColor: activeDelivery ? '#10b981' : '#f59e0b',
        glowWidth: 9,
        dashed: !navigationRoute?.ok,
      });

      fitMapToPoints(map, [riderLocation, pickup, dropoff, destination], 15);
    } else {
      fitMapToPoints(map, [riderLocation], 14);
    }

    upsertGeoJsonSource(map, RIDER_SOURCE_ID, pointFeaturesToGeoJson(riderPoints));
    upsertPointLayers(map, RIDER_SOURCE_ID, RIDER_LAYER_ID);

    upsertGeoJsonSource(map, STOPS_SOURCE_ID, pointFeaturesToGeoJson(stopPoints));
    upsertPointLayers(map, STOPS_SOURCE_ID, STOPS_LAYER_ID, STOPS_LABEL_LAYER_ID);

    upsertGeoJsonSource(map, ROUTE_SOURCE_ID, lineFeaturesToGeoJson(routeLines));
    upsertLineLayers(map, ROUTE_SOURCE_ID, ROUTE_LAYER_ID, ROUTE_GLOW_LAYER_ID);
  }, [activeDelivery, assignedDelivery, liveLocation, mapReady, navigationRoute, rider]);

  // Camera auto-follow with heading rotation
  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const riderLocation = liveLocation ?? getRiderLocation(rider);
    const hasActiveDelivery = !!(activeDelivery ?? assignedDelivery);

    let bearing = 0;
    const MIN_MOVE_METERS = 5;

    if (prevLocationRef.current && liveLocation) {
      const toRad = (d: number) => (d * Math.PI) / 180;
      const earth = 6_371_000;
      const dLat = toRad(liveLocation.lat - prevLocationRef.current.lat);
      const dLng = toRad(liveLocation.lng - prevLocationRef.current.lng);
      const a =
        Math.sin(dLat / 2) ** 2 +
        Math.cos(toRad(prevLocationRef.current.lat)) *
          Math.cos(toRad(liveLocation.lat)) *
          Math.sin(dLng / 2) ** 2;
      const distMoved = earth * 2 * Math.atan2(Math.sqrt(a), Math.sqrt(1 - a));

      if (distMoved >= MIN_MOVE_METERS) {
        bearing = computeBearing(prevLocationRef.current, liveLocation);
      } else {
        // Not enough movement — keep existing bearing
        bearing = map.getBearing();
      }
    }

    if (liveLocation) {
      prevLocationRef.current = liveLocation;
    }

    map.easeTo({
      center: [riderLocation.lng, riderLocation.lat],
      bearing: hasActiveDelivery ? bearing : 0,
      pitch: hasActiveDelivery ? 50 : 0,
      duration: 1000,
      essential: false,
    });
  }, [liveLocation, mapReady, activeDelivery, assignedDelivery, rider]);

  const riderLocation = liveLocation ?? getRiderLocation(rider);

  return (
    <Map3DBase
      className={className}
      center={{ lat: riderLocation.lat, lng: riderLocation.lng }}
      zoom={13}
      pitch={50}
      bearing={12}
      onMapReady={(map) => {
        mapRef.current = map;
        setMapReady(true);
      }}
      onMapError={(error) => {
        console.error('Rider 3D map failed, using Leaflet fallback', error);
      }}
      fallback={fallback}
    />
  );
}
