'use client';

import { useState, useRef, useEffect, useCallback } from 'react';
import { Input } from '@/components/ui/input';
import { geocodeForward, type GeocodeSuggestion } from '@/lib/geocode';
import { MapPin } from 'lucide-react';

interface AddressAutocompleteProps {
  value: string;
  onChange: (address: string, coords: { lat: number; lng: number } | null) => void;
  placeholder?: string;
  id?: string;
  required?: boolean;
  className?: string;
}

export function AddressAutocomplete({
  value,
  onChange,
  placeholder = 'Search address...',
  id,
  required,
  className,
}: AddressAutocompleteProps) {
  const [suggestions, setSuggestions] = useState<GeocodeSuggestion[]>([]);
  const [open, setOpen] = useState(false);
  const [loading, setLoading] = useState(false);
  const abortRef = useRef<AbortController | null>(null);
  const debounceRef = useRef<ReturnType<typeof setTimeout> | null>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const justSelectedRef = useRef(false);

  const search = useCallback((query: string) => {
    if (debounceRef.current) clearTimeout(debounceRef.current);
    if (abortRef.current) abortRef.current.abort();

    if (query.trim().length < 3) {
      setSuggestions([]);
      setOpen(false);
      return;
    }

    setLoading(true);

    debounceRef.current = setTimeout(async () => {
      const controller = new AbortController();
      abortRef.current = controller;

      const results = await geocodeForward(query, 5, controller.signal);
      if (!controller.signal.aborted) {
        setSuggestions(results);
        setOpen(results.length > 0);
        setLoading(false);
      }
    }, 400); // 400ms debounce respects Nominatim rate limits
  }, []);

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const text = e.target.value;
    justSelectedRef.current = false;
    onChange(text, null); // Clear coords when typing manually
    search(text);
  };

  const handleSelect = (suggestion: GeocodeSuggestion) => {
    justSelectedRef.current = true;
    onChange(suggestion.short_name, { lat: suggestion.lat, lng: suggestion.lng });
    setSuggestions([]);
    setOpen(false);
  };

  // Close dropdown on outside click
  useEffect(() => {
    const handler = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        setOpen(false);
      }
    };
    document.addEventListener('mousedown', handler);
    return () => document.removeEventListener('mousedown', handler);
  }, []);

  // Cleanup on unmount
  useEffect(() => {
    return () => {
      if (debounceRef.current) clearTimeout(debounceRef.current);
      if (abortRef.current) abortRef.current.abort();
    };
  }, []);

  return (
    <div ref={containerRef} className="relative">
      <div className="relative">
        <Input
          id={id}
          value={value}
          onChange={handleInputChange}
          onFocus={() => {
            if (suggestions.length > 0 && !justSelectedRef.current) setOpen(true);
          }}
          placeholder={placeholder}
          required={required}
          className={`mt-1 text-sm pr-8 ${className ?? ''}`}
          autoComplete="off"
        />
        {loading && (
          <div className="absolute right-2 top-1/2 -translate-y-1/2 mt-0.5">
            <div className="w-4 h-4 border-2 border-sky-300 border-t-transparent rounded-full animate-spin" />
          </div>
        )}
      </div>

      {open && suggestions.length > 0 && (
        <div className="absolute z-50 mt-1 w-full bg-white border border-border rounded-lg shadow-lg max-h-52 overflow-y-auto">
          {suggestions.map((s) => (
            <button
              key={s.place_id}
              type="button"
              className="w-full text-left px-3 py-2.5 text-sm hover:bg-sky-50 transition-colors flex items-start gap-2 border-b border-border/50 last:border-b-0"
              onClick={() => handleSelect(s)}
            >
              <MapPin size={14} className="text-sky-500 mt-0.5 flex-shrink-0" />
              <div className="min-w-0">
                <div className="font-medium text-foreground truncate">{s.short_name}</div>
                <div className="text-xs text-muted-foreground truncate">{s.display_name}</div>
              </div>
            </button>
          ))}
        </div>
      )}
    </div>
  );
}
