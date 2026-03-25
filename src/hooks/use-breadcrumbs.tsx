'use client';

import { useI18n } from '@/components/layout/i18n-provider';
import { usePathname } from 'next/navigation';
import { useMemo } from 'react';

type BreadcrumbItem = {
  title: string;
  link: string;
};

export function useBreadcrumbs() {
  const pathname = usePathname();
  const { translate } = useI18n();

  const breadcrumbs = useMemo(() => {
    const routeMapping: Record<string, BreadcrumbItem[]> = {
      '/dashboard': [{ title: translate('nav.dashboard'), link: '/dashboard' }]
    };

    if (routeMapping[pathname]) {
      return routeMapping[pathname];
    }

    const segments = pathname.split('/').filter(Boolean);
    return segments.map((segment, index) => {
      const path = `/${segments.slice(0, index + 1).join('/')}`;
      return {
        title: segment.charAt(0).toUpperCase() + segment.slice(1),
        link: path
      };
    });
  }, [pathname, translate]);

  return breadcrumbs;
}
