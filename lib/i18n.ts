export const SUPPORTED_LANGUAGES = ['fr', 'en', 'ar'] as const;

export type AppLanguage = (typeof SUPPORTED_LANGUAGES)[number];

export const DEFAULT_LANGUAGE: AppLanguage = 'fr';

export const LANGUAGE_STORAGE_KEY = 'the1000-language';

export function isAppLanguage(value: unknown): value is AppLanguage {
  return typeof value === 'string' && SUPPORTED_LANGUAGES.includes(value as AppLanguage);
}

export function isRtlLanguage(language: AppLanguage): boolean {
  return language === 'ar';
}
