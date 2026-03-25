export type Locale = 'en' | 'zh';

export const defaultLocale: Locale = 'zh';

export const messages: Record<Locale, Record<string, string>> = {
  en: {
    'search.placeholder': 'Search',
    'kbar.navigation': 'Navigation',
    'kbar.goTo': 'Go to {target}',
    'infobar.defaultTitle': 'Docs',
    'infobar.defaultSectionTitle': 'Getting Started',
    'infobar.defaultSectionDescription':
      'This area will hold module notes, deployment tips, and business documentation as we iterate.',
    'infobar.defaultLinkTitle': 'Project Plan',
    'infobar.learnMore': 'Learn more',
    'infobar.noContent': 'No content available',
    'nav.dashboard': 'Dashboard'
  },
  zh: {
    'search.placeholder': '搜索',
    'kbar.navigation': '导航',
    'kbar.goTo': '前往 {target}',
    'infobar.defaultTitle': '项目说明',
    'infobar.defaultSectionTitle': '当前状态',
    'infobar.defaultSectionDescription':
      '这里会逐步承接模块说明、部署提示和业务约定，当前先作为基础信息面板使用。',
    'infobar.defaultLinkTitle': '查看计划',
    'infobar.learnMore': '延伸阅读',
    'infobar.noContent': '暂无内容',
    'nav.dashboard': '仪表盘'
  }
};
