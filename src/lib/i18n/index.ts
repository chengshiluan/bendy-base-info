import { defaultLocale, Locale, messages } from './messages';

export function resolveLocale(input?: string | null): Locale {
  if (!input) return defaultLocale;
  const normalized = input.toLowerCase();
  if (normalized.startsWith('zh')) return 'zh';
  return 'en';
}

export function t(
  locale: Locale,
  key: string,
  vars?: Record<string, string | number | undefined>
): string {
  const value = messages[locale][key] ?? messages[defaultLocale][key] ?? key;
  if (!vars) return value;

  return Object.entries(vars).reduce((result, [token, replacement]) => {
    return result.replaceAll(`{${token}}`, `${replacement ?? ''}`);
  }, value);
}
