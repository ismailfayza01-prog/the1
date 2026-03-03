'use client';

import { useEffect, useRef, useState } from 'react';
import type { Map as MapLibreMap } from 'maplibre-gl';
import { MAP_DEFAULT_BEARING, MAP_DEFAULT_PITCH, resolveMapStyleUrl } from '@/components/maps/config';
import { ensure3DBuildingsLayer } from '@/components/maps/layers';
import type { Map3DBaseProps } from '@/components/maps/types';

export function Map3DBase({
  className,
  center,
  zoom = 13,
  minZoom = 10,
  maxZoom = 18,
  pitch = MAP_DEFAULT_PITCH,
  bearing = MAP_DEFAULT_BEARING,
  interactive = true,
  buildingsEnabled = true,
  fallback = null,
  onMapReady,
  onMapError,
}: Map3DBaseProps) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<MapLibreMap | null>(null);
  const onMapReadyRef = useRef(onMapReady);
  const onMapErrorRef = useRef(onMapError);
  const initOptionsRef = useRef({
    center,
    zoom,
    minZoom,
    maxZoom,
    pitch,
    bearing,
    interactive,
    buildingsEnabled,
  });
  const [failed, setFailed] = useState(false);

  useEffect(() => {
    onMapReadyRef.current = onMapReady;
  }, [onMapReady]);

  useEffect(() => {
    onMapErrorRef.current = onMapError;
  }, [onMapError]);

  useEffect(() => {
    let cancelled = false;
    let resizeObserver: ResizeObserver | null = null;

    async function init() {
      if (!containerRef.current) return;

      try {
        if (typeof window === 'undefined' || typeof window.WebGLRenderingContext === 'undefined') {
          throw new Error('WebGL is not supported by this browser');
        }

        const maplibre = await import('maplibre-gl');
        if (cancelled || !containerRef.current) return;

        const map = new maplibre.Map({
          container: containerRef.current,
          style: resolveMapStyleUrl(),
          center: [initOptionsRef.current.center.lng, initOptionsRef.current.center.lat],
          zoom: initOptionsRef.current.zoom,
          minZoom: initOptionsRef.current.minZoom,
          maxZoom: initOptionsRef.current.maxZoom,
          pitch: initOptionsRef.current.pitch,
          bearing: initOptionsRef.current.bearing,
          attributionControl: false,
          interactive: initOptionsRef.current.interactive,
        });

        map.addControl(new maplibre.NavigationControl({ showCompass: true, showZoom: true }), 'top-right');

        map.on('error', (event: { error?: Error }) => {
          if (cancelled) return;
          if (event.error) {
            setFailed(true);
            onMapErrorRef.current?.(event.error);
          }
        });

        map.once('load', () => {
          if (cancelled) return;
          if (initOptionsRef.current.buildingsEnabled) {
            ensure3DBuildingsLayer(map);
          }
          mapRef.current = map;
          onMapReadyRef.current?.(map);
        });

        resizeObserver = new ResizeObserver(() => {
          map.resize();
        });
        resizeObserver.observe(containerRef.current);
      } catch (error) {
        if (cancelled) return;
        setFailed(true);
        onMapErrorRef.current?.(error);
      }
    }

    void init();

    return () => {
      cancelled = true;
      if (resizeObserver) {
        resizeObserver.disconnect();
      }
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  if (failed) {
    return <>{fallback}</>;
  }

  return <div ref={containerRef} className={className} />;
}
