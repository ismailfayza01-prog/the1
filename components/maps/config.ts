export const MAP_3D_ENABLED = process.env.NEXT_PUBLIC_MAP_3D_ENABLED === 'true';

function parseNumberEnv(value: string | undefined, fallback: number): number {
  const parsed = Number(value);
  if (!Number.isFinite(parsed)) return fallback;
  return parsed;
}

export const MAP_DEFAULT_PITCH = Math.min(60, Math.max(0, parseNumberEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_PITCH, 45)));
export const MAP_DEFAULT_BEARING = Math.min(180, Math.max(-180, parseNumberEnv(process.env.NEXT_PUBLIC_MAP_DEFAULT_BEARING, 12)));

export function resolveMapStyleUrl(): string {
  const customStyle = process.env.NEXT_PUBLIC_MAP_STYLE_URL?.trim();
  if (customStyle) return customStyle;

  const mapTilerKey = process.env.NEXT_PUBLIC_MAPTILER_KEY?.trim();
  if (mapTilerKey) {
    return `https://api.maptiler.com/maps/streets-v2/style.json?key=${mapTilerKey}`;
  }

  // Safe fallback for local development if key is missing.
  return 'https://demotiles.maplibre.org/style.json';
}
