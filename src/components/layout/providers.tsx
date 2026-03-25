'use client';

import { SessionProvider } from 'next-auth/react';
import type { Session } from 'next-auth';
import { Locale } from '@/lib/i18n/messages';
import React from 'react';
import { I18nProvider } from './i18n-provider';
import { ActiveThemeProvider } from '../themes/active-theme';

export default function Providers({
  activeThemeValue,
  locale,
  session,
  children
}: {
  activeThemeValue: string;
  locale: Locale;
  session: Session | null;
  children: React.ReactNode;
}) {
  return (
    <SessionProvider session={session}>
      <I18nProvider locale={locale}>
        <ActiveThemeProvider initialTheme={activeThemeValue}>
          {children}
        </ActiveThemeProvider>
      </I18nProvider>
    </SessionProvider>
  );
}
