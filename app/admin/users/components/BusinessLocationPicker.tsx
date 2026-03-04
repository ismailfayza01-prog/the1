'use client';

import { useEffect, useRef } from 'react';
import type { CircleMarker, LeafletMouseEvent, Map as LeafletMap } from 'leaflet';
import 'leaflet/dist/leaflet.css';

export interface BusinessLocationValue {
  lat: number;
  lng: number;
}

interface BusinessLocationPickerProps {
  value: BusinessLocationValue | null;
  onChange: (coords: BusinessLocationValue) => void;
}

const TANGIER_CENTER: BusinessLocationValue = { lat: 35.7595, lng: -5.834 };

export function BusinessLocationPicker({ value, onChange }: BusinessLocationPickerProps) {
  const containerRef = useRef<HTMLDivElement | null>(null);
  const mapRef = useRef<LeafletMap | null>(null);
  const markerRef = useRef<CircleMarker | null>(null);
  const leafletRef = useRef<typeof import('leaflet') | null>(null);
  const onChangeRef = useRef(onChange);
  const lastAppliedValueRef = useRef<BusinessLocationValue | null>(null);

  useEffect(() => {
    onChangeRef.current = onChange;
  }, [onChange]);

  useEffect(() => {
    let active = true;

    async function init() {
      if (!containerRef.current || mapRef.current) return;

      const L = await import('leaflet');
      if (!active || !containerRef.current) return;
      leafletRef.current = L;

      const map = L.map(containerRef.current, {
        zoomControl: true,
      });

      map.setView([TANGIER_CENTER.lat, TANGIER_CENTER.lng], 13);

      L.tileLayer('https://{s}.tile.openstreetmap.org/{z}/{x}/{y}.png', {
        attribution: '&copy; OpenStreetMap contributors',
      }).addTo(map);

      map.on('click', (event: LeafletMouseEvent) => {
        const next = {
          lat: Number(event.latlng.lat.toFixed(6)),
          lng: Number(event.latlng.lng.toFixed(6)),
        };

        if (markerRef.current) {
          markerRef.current.setLatLng([next.lat, next.lng]);
        } else {
          markerRef.current = L.circleMarker([next.lat, next.lng], {
            radius: 8,
            color: '#0284c7',
            weight: 2,
            fillColor: '#38bdf8',
            fillOpacity: 0.9,
          }).addTo(map);
        }

        lastAppliedValueRef.current = next;
        onChangeRef.current(next);
      });

      mapRef.current = map;
      setTimeout(() => {
        map.invalidateSize();
      }, 50);
    }

    void init();

    return () => {
      active = false;
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
      markerRef.current = null;
      leafletRef.current = null;
      lastAppliedValueRef.current = null;
    };
  }, []);

  useEffect(() => {
    const map = mapRef.current;
    const L = leafletRef.current;
    if (!map || !L) return;
    if (!value) return;
    const lastApplied = lastAppliedValueRef.current;
    if (lastApplied && lastApplied.lat === value.lat && lastApplied.lng === value.lng) return;

    if (markerRef.current) {
      markerRef.current.setLatLng([value.lat, value.lng]);
    } else {
      markerRef.current = L.circleMarker([value.lat, value.lng], {
        radius: 8,
        color: '#0284c7',
        weight: 2,
        fillColor: '#38bdf8',
        fillOpacity: 0.9,
      }).addTo(map);
    }

    map.panTo([value.lat, value.lng]);
    lastAppliedValueRef.current = value;
  }, [value]);

  return <div ref={containerRef} className="h-64 w-full overflow-hidden rounded-lg border border-sky-200" />;
}
