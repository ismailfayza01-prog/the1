import type { Feature, FeatureCollection, LineString, Point } from 'geojson';
import type { GeoJSONSource, Map as MapLibreMap } from 'maplibre-gl';
import type { MapLineFeature, MapPointFeature } from '@/components/maps/types';

function getGeoJsonSource(map: MapLibreMap, sourceId: string): GeoJSONSource | null {
  const source = map.getSource(sourceId);
  if (!source || !('setData' in source)) return null;
  return source as GeoJSONSource;
}

export function pointFeaturesToGeoJson(points: MapPointFeature[]): FeatureCollection<Point> {
  const features: Feature<Point>[] = points.map((point) => ({
    type: 'Feature',
    geometry: {
      type: 'Point',
      coordinates: [point.lng, point.lat],
    },
    properties: {
      id: point.id,
      label: point.label ?? '',
      color: point.color ?? '#10b981',
      radius: point.radius ?? 6,
      strokeColor: point.strokeColor ?? '#ffffff',
      strokeWidth: point.strokeWidth ?? 1.5,
      opacity: point.opacity ?? 1,
      textColor: point.textColor ?? '#0f172a',
      kind: point.kind ?? '',
      selected: point.selected ?? false,
      riderId: point.riderId ?? '',
    },
  }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function lineFeaturesToGeoJson(lines: MapLineFeature[]): FeatureCollection<LineString> {
  const features: Feature<LineString>[] = lines
    .filter((line) => line.points.length >= 2)
    .map((line) => ({
      type: 'Feature',
      geometry: {
        type: 'LineString',
        coordinates: line.points.map((point) => [point.lng, point.lat]),
      },
      properties: {
        id: line.id,
        color: line.color ?? '#10b981',
        width: line.width ?? 4,
        opacity: line.opacity ?? 0.95,
        glowColor: line.glowColor ?? line.color ?? '#10b981',
        glowWidth: line.glowWidth ?? ((line.width ?? 4) + 4),
        dashed: line.dashed ?? false,
      },
    }));

  return {
    type: 'FeatureCollection',
    features,
  };
}

export function upsertGeoJsonSource(
  map: MapLibreMap,
  sourceId: string,
  data: FeatureCollection<Point> | FeatureCollection<LineString>
) {
  const existing = getGeoJsonSource(map, sourceId);
  if (existing) {
    existing.setData(data);
    return;
  }

  map.addSource(sourceId, {
    type: 'geojson',
    data,
  });
}

export function upsertPointLayers(map: MapLibreMap, sourceId: string, circleLayerId: string, labelLayerId?: string) {
  if (!map.getLayer(circleLayerId)) {
    map.addLayer({
      id: circleLayerId,
      type: 'circle',
      source: sourceId,
      paint: {
        'circle-color': ['coalesce', ['get', 'color'], '#10b981'],
        'circle-radius': ['coalesce', ['get', 'radius'], 6],
        'circle-stroke-color': ['coalesce', ['get', 'strokeColor'], '#ffffff'],
        'circle-stroke-width': ['coalesce', ['get', 'strokeWidth'], 1.5],
        'circle-opacity': ['coalesce', ['get', 'opacity'], 1],
      },
    } as any);
  }

  if (labelLayerId && !map.getLayer(labelLayerId)) {
    map.addLayer({
      id: labelLayerId,
      type: 'symbol',
      source: sourceId,
      layout: {
        'text-field': ['coalesce', ['get', 'label'], ''],
        'text-size': 11,
        'text-offset': [0, 1.1],
        'text-anchor': 'top',
        'text-optional': true,
      },
      paint: {
        'text-color': ['coalesce', ['get', 'textColor'], '#0f172a'],
        'text-halo-color': '#ffffff',
        'text-halo-width': 1,
      },
    } as any);
  }
}

export function upsertLineLayers(
  map: MapLibreMap,
  sourceId: string,
  lineLayerId: string,
  glowLayerId?: string
) {
  if (glowLayerId && !map.getLayer(glowLayerId)) {
    map.addLayer({
      id: glowLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['coalesce', ['get', 'glowColor'], '#10b981'],
        'line-width': ['coalesce', ['get', 'glowWidth'], 8],
        'line-opacity': 0.24,
        'line-blur': 0.7,
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
      },
    } as any);
  }

  if (!map.getLayer(lineLayerId)) {
    map.addLayer({
      id: lineLayerId,
      type: 'line',
      source: sourceId,
      paint: {
        'line-color': ['coalesce', ['get', 'color'], '#10b981'],
        'line-width': ['coalesce', ['get', 'width'], 4],
        'line-opacity': ['coalesce', ['get', 'opacity'], 0.95],
      },
      layout: {
        'line-cap': 'round',
        'line-join': 'round',
        'line-dasharray': [
          'case',
          ['boolean', ['get', 'dashed'], false],
          ['literal', [2, 2]],
          ['literal', [1, 0]],
        ],
      },
    } as any);
  }
}

export function ensure3DBuildingsLayer(map: MapLibreMap, layerId = 'the1000-3d-buildings') {
  if (map.getLayer(layerId)) return;

  const style = map.getStyle();
  const sources = (style.sources ?? {}) as Record<string, { type?: string }>;
  const sourceId = Object.entries(sources).find(([, source]) => source.type === 'vector')?.[0];
  if (!sourceId) return;

  const styleLayers = (style.layers ?? []) as Array<{ id: string; type?: string }>;
  const firstSymbolLayerId = styleLayers.find((layer) => layer.type === 'symbol')?.id;

  try {
    map.addLayer(
      {
        id: layerId,
        type: 'fill-extrusion',
        source: sourceId,
        'source-layer': 'building',
        minzoom: 13,
        paint: {
          'fill-extrusion-color': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13,
            '#dbeafe',
            16,
            '#bfdbfe',
          ],
          'fill-extrusion-height': [
            'interpolate',
            ['linear'],
            ['zoom'],
            13,
            0,
            14,
            ['coalesce', ['get', 'render_height'], ['get', 'height'], 18],
          ],
          'fill-extrusion-base': ['coalesce', ['get', 'render_min_height'], ['get', 'min_height'], 0],
          'fill-extrusion-opacity': 0.42,
        },
      },
      firstSymbolLayerId
    );
  } catch {
    // Some third-party styles may not expose a compatible "building" source layer.
  }
}

export function fitMapToPoints(map: MapLibreMap, points: Array<{ lat: number; lng: number }>, maxZoom = 15) {
  if (points.length === 0) return;
  if (points.length === 1) {
    map.easeTo({
      center: [points[0].lng, points[0].lat],
      zoom: Math.min(map.getZoom(), maxZoom),
      duration: 450,
    });
    return;
  }

  const lats = points.map((point) => point.lat);
  const lngs = points.map((point) => point.lng);

  const bounds: [[number, number], [number, number]] = [
    [Math.min(...lngs), Math.min(...lats)],
    [Math.max(...lngs), Math.max(...lats)],
  ];

  map.fitBounds(bounds, {
    padding: 46,
    maxZoom,
    duration: 500,
  });
}
