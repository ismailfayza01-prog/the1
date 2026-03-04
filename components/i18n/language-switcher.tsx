'use client';

import { Languages } from 'lucide-react';
import { useLanguage } from '@/components/i18n/language-provider';
import type { AppLanguage } from '@/lib/i18n';
import { cn } from '@/lib/utils';

const LANGUAGES: Array<{ code: AppLanguage; label: string }> = [
  { code: 'fr', label: 'FR' },
  { code: 'en', label: 'EN' },
  { code: 'ar', label: 'AR' },
];

interface LanguageSwitcherProps {
  inline?: boolean;
}

export function LanguageSwitcher({ inline = false }: LanguageSwitcherProps) {
  const { language, setLanguage } = useLanguage();

  return (
    <div
      className={cn(
        'rounded-2xl border border-border/80 bg-white/90 p-1 shadow-md backdrop-blur',
        inline
          ? 'relative'
          : 'fixed top-4 z-[90]',
      )}
      style={inline ? undefined : { insetInlineEnd: '1rem' }}
    >
      <div className="flex items-center gap-1">
        <span className="inline-flex h-8 w-8 items-center justify-center rounded-xl bg-slate-100 text-slate-700">
          <Languages className="h-4 w-4" />
        </span>
        <div className="flex items-center gap-1">
          {LANGUAGES.map((item) => (
            <button
              key={item.code}
              type="button"
              onClick={() => setLanguage(item.code)}
              className={cn(
                'h-8 min-w-[42px] rounded-lg px-2 text-xs font-bold tracking-wide transition-colors',
                language === item.code
                  ? 'bg-gradient-to-r from-emerald-500 to-slate-800 text-white shadow-sm'
                  : 'text-slate-700 hover:bg-slate-100',
              )}
              aria-pressed={language === item.code}
              aria-label={`Switch language to ${item.label}`}
            >
              {item.label}
            </button>
          ))}
        </div>
      </div>
    </div>
  );
}
