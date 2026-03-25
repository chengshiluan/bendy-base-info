'use client';

import { Locale } from '@/lib/i18n/messages';
import { t } from '@/lib/i18n';
import { createContext, useContext, useMemo } from 'react';

type I18nContextValue = {
  locale: Locale;
  translate: (
    key: string,
    vars?: Record<string, string | number | undefined>
  ) => string;
};

const I18nContext = createContext<I18nContextValue | null>(null);

export function I18nProvider({
  locale,
  children
}: {
  locale: Locale;
  children: React.ReactNode;
}) {
  const value = useMemo<I18nContextValue>(() => {
    return {
      locale,
      translate: (key, vars) => t(locale, key, vars)
    };
  }, [locale]);

  return <I18nContext.Provider value={value}>{children}</I18nContext.Provider>;
}

export function useI18n() {
  const context = useContext(I18nContext);
  if (!context) {
    throw new Error('useI18n must be used within I18nProvider');
  }
  return context;
}
