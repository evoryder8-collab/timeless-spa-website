import type { Lang } from '../data/site';

export type PageKey = 'home' | 'massages' | 'academy' | 'about' | 'vouchers' | 'contact' | 'imprint' | 'privacy';

export const routes: Record<PageKey, Record<Lang, string>> = {
  home: { de: '/', en: '/en/' },
  massages: { de: '/behandlungen/', en: '/en/treatments/' },
  academy: { de: '/academy/', en: '/en/academy/' },
  about: { de: '/ueber-uns/', en: '/en/about/' },
  vouchers: { de: '/gutscheine/', en: '/en/vouchers/' },
  contact: { de: '/kontakt/', en: '/en/contact/' },
  imprint: { de: '/impressum/', en: '/en/imprint/' },
  privacy: { de: '/datenschutz/', en: '/en/privacy/' },
};

const base = import.meta.env.BASE_URL.replace(/\/$/, '');
export const href = (page: PageKey, lang: Lang) => base + routes[page][lang];

export const navPages: PageKey[] = ['massages', 'academy', 'about', 'vouchers', 'contact'];
