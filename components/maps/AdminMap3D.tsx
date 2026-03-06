'use client';

import { useEffect, useRef, useState } from 'react';
import type { ReactNode } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import type { Delivery, Rider } from '@/lib/types';
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

const RIDERS_SOURCE_ID = 'admin-riders-source';
const RIDERS_LAYER_ID = 'admin-riders-layer';
const RIDERS_LABEL_LAYER_ID = 'admin-riders-label-layer';

const DELIVERY_LINES_SOURCE_ID = 'admin-delivery-lines-source';
const DELIVERY_LINES_LAYER_ID = 'admin-delivery-lines-layer';
const DELIVERY_LINES_GLOW_LAYER_ID = 'admin-delivery-lines-glow';

const DELIVERY_POINTS_SOURCE_ID = 'admin-delivery-points-source';
const DELIVERY_POINTS_LAYER_ID = 'admin-delivery-points-layer';

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

  const current = rider.current_location as { lat: number; lng: number } | null;
  if (current) return current;

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

function getRiderStatusColor(status: Rider['status']): string {
  if (status === 'available') return '#10b981';
  if (status === 'busy') return '#f59e0b';
  return '#94a3b8';
}

function getRouteColor(status: Delivery['status']): string {
  const byStatus: Record<Delivery['status'], string> = {
    pending: '#f59e0b',
    offered: '#f59e0b',
    accepted: '#0284c7',
    picked_up: '#8b5cf6',
    in_transit: '#06b6d4',
    delivered: '#10b981',
    cancelled: '#64748b',
    expired: '#64748b',
  };

  return byStatus[status] || '#94a3b8';
}

interface AdminMap3DProps {
  riders: Rider[];
  deliveries: Delivery[];
  focusDeliveryId?: string | null;
  focusRiderId?: string | null;
  className?: string;
  fallback?: ReactNode;
}

export function AdminMap3D({
  riders,
  deliveries,
  focusDeliveryId = null,
  focusRiderId = null,
  className,
  fallback = null,
}: AdminMap3DProps) {
  const mapRef = useRef<MapLibreMap | null>(null);
  const didFitBoundsRef = useRef(false);
  const [mapReady, setMapReady] = useState(false);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;

    const map = mapRef.current;
    const activeStatuses: Delivery['status'][] = ['pending', 'offered', 'accepted', 'picked_up', 'in_transit'];
    const activeDeliveries = deliveries.filter((delivery) => activeStatuses.includes(delivery.status));
    const focusedDelivery = focusDeliveryId ? deliveries.find((delivery) => delivery.id === focusDeliveryId) : null;
    if (focusedDelivery && !activeDeliveries.some((delivery) => delivery.id === focusedDelivery.id)) {
      activeDeliveries.push(focusedDelivery);
    }

    const riderPoints: MapPointFeature[] = riders.map((rider) => {
      const location = getRiderLocation(rider);
      return {
        id: rider.id,
        lat: location.lat,
        lng: location.lng,
        label: `${rider.name} (${rider.status})`,
        color: getRiderStatusColor(rider.status),
        radius: 7,
        strokeColor: '#ffffff',
        strokeWidth: 2,
      };
    });

    const deliveryPoints: MapPointFeature[] = activeDeliveries.flatMap((delivery) => {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');

      return [
        {
          id: `${delivery.id}-pickup`,
          lat: pickup.lat,
          lng: pickup.lng,
          color: '#38bdf8',
          radius: 5,
          label: 'Pickup',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
        {
          id: `${delivery.id}-dropoff`,
          lat: dropoff.lat,
          lng: dropoff.lng,
          color: '#ef4444',
          radius: 5,
          label: 'Dropoff',
          strokeColor: '#ffffff',
          strokeWidth: 1.5,
        },
      ];
    });

    const lines: MapLineFeature[] = activeDeliveries.map((delivery) => {
      const pickup = getDeliveryPoint(delivery, 'pickup');
      const dropoff = getDeliveryPoint(delivery, 'dropoff');

      return {
        id: delivery.id,
        points: [pickup, dropoff],
        color: getRouteColor(delivery.status),
        width: 3,
        opacity: 0.9,
        glowColor: getRouteColor(delivery.status),
        glowWidth: 8,
        dashed: delivery.status === 'pending' || delivery.status === 'offered',
      };
    });

    upsertGeoJsonSource(map, RIDERS_SOURCE_ID, pointFeaturesToGeoJson(riderPoints));
    upsertPointLayers(map, RIDERS_SOURCE_ID, RIDERS_LAYER_ID, RIDERS_LABEL_LAYER_ID);

    upsertGeoJsonSource(map, DELIVERY_POINTS_SOURCE_ID, pointFeaturesToGeoJson(deliveryPoints));
    upsertPointLayers(map, DELIVERY_POINTS_SOURCE_ID, DELIVERY_POINTS_LAYER_ID);

    upsertGeoJsonSource(map, DELIVERY_LINES_SOURCE_ID, lineFeaturesToGeoJson(lines));
    upsertLineLayers(map, DELIVERY_LINES_SOURCE_ID, DELIVERY_LINES_LAYER_ID, DELIVERY_LINES_GLOW_LAYER_ID);

    if (!didFitBoundsRef.current) {
      const fitPoints = [...riderPoints, ...deliveryPoints].map((point) => ({ lat: point.lat, lng: point.lng }));
      fitMapToPoints(map, fitPoints, 14);
      if (fitPoints.length > 0) {
        didFitBoundsRef.current = true;
      }
    }
  }, [deliveries, focusDeliveryId, mapReady, riders]);

  useEffect(() => {
    if (!mapReady || !mapRef.current) return;
    if (!focusDeliveryId && !focusRiderId) return;

    const focusPoints: Array<{ lat: number; lng: number }> = [];
    if (focusRiderId) {
      const rider = riders.find((row) => row.id === focusRiderId);
      if (rider) {
        focusPoints.push(getRiderLocation(rider));
      }
    }

    if (focusDeliveryId) {
      const delivery = deliveries.find((row) => row.id === focusDeliveryId);
      if (delivery) {
        focusPoints.push(getDeliveryPoint(delivery, 'pickup'));
        focusPoints.push(getDeliveryPoint(delivery, 'dropoff'));
        if (delivery.rider_id) {
          const rider = riders.find((row) => row.id === delivery.rider_id);
          if (rider) {
            focusPoints.push(getRiderLocation(rider));
          }
        }
      }
    }

    if (focusPoints.length > 0) {
      fitMapToPoints(mapRef.current, focusPoints, 15);
    }
  }, [deliveries, focusDeliveryId, focusRiderId, mapReady, riders]);

  return (
    <Map3DBase
      className={className}
      center={{ lat: 35.7595, lng: -5.834 }}
      zoom={13}
      pitch={42}
      bearing={12}
      onMapReady={(map) => {
        mapRef.current = map;
        setMapReady(true);
      }}
      onMapError={(error) => {
        console.error('Admin 3D map failed, using Leaflet fallback', error);
      }}
      fallback={fallback}
    />
  );
}
