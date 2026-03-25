import { cookies, headers } from 'next/headers';
import { defaultLocale, Locale } from './messages';
import { resolveLocale } from './index';

const localeCookieKey = 'locale';

export async function getServerLocale(): Promise<Locale> {
  const cookieStore = await cookies();
  const cookieLocale = cookieStore.get(localeCookieKey)?.value;
  if (cookieLocale) {
    return resolveLocale(cookieLocale);
  }

  const headerStore = await headers();
  const acceptLanguage = headerStore.get('accept-language');
  if (!acceptLanguage) return defaultLocale;
  return resolveLocale(acceptLanguage);
}
