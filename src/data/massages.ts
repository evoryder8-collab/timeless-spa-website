// The massage menu. Edit this file to change what appears on the Massages & Prices page
// and the signature massages on the home page.
//
// PLACEHOLDER: this is a sample menu. Replace it with Timeless Spa's real massages and prices,
// then set `menuIsSample` to false (it hides the "sample menu" notice on the page).

import type { ImageMetadata } from 'astro';
import type { Lang } from './site';
import hotStones from '../assets/photos/hot-stones-back.jpg';
import backWarm from '../assets/photos/back-massage-warm.jpg';
import backLight from '../assets/photos/back-massage-light.jpg';
import herbalBack from '../assets/photos/herbal-compress-back.jpg';
import herbalBundles from '../assets/photos/herbal-bundles.jpg';
import forearm from '../assets/photos/forearm-massage.jpg';
import oilJar from '../assets/photos/oil-jar-linen.jpg';
import candles from '../assets/photos/candles.jpg';

export const menuIsSample = true;

export type Focus = 'relax' | 'deep' | 'couples';

export interface Massage {
  id: string;
  name: Record<Lang, string>;
  text: Record<Lang, string>;
  focus: Focus[];
  /** warm treatments (hot stones, herbal compresses): the stone glows when you point at them */
  warm?: boolean;
  /** shown on the home page */
  signature?: boolean;
  /** duration in minutes and price in euros; `forTwo` prices are for both guests together */
  options: { minutes: number; price: number }[];
  forTwo?: boolean;
  photo?: ImageMetadata;
}

export const massages: Massage[] = [
  {
    id: 'classic',
    name: { de: 'Klassische Massage', en: 'Classic massage' },
    text: {
      de: 'Ruhige, fließende Griffe lösen Verspannungen in Rücken, Nacken und Beinen. Der beste Einstieg, wenn Sie einfach abschalten möchten.',
      en: 'Slow, flowing strokes ease tension in the back, neck and legs. The best place to start when you simply want to switch off.',
    },
    focus: ['relax'],
    options: [{ minutes: 30, price: 45 }, { minutes: 60, price: 75 }, { minutes: 90, price: 105 }],
    photo: backLight,
  },
  {
    id: 'hot-stone',
    name: { de: 'Hot-Stone-Massage', en: 'Hot stone massage' },
    text: {
      de: 'Warme Basaltsteine gleiten über den Körper und geben ihre Wärme tief an die Muskeln ab. Schwer, warm, still.',
      en: 'Warm basalt stones glide over the body and carry their heat deep into the muscles. Heavy, warm, still.',
    },
    focus: ['relax'],
    warm: true,
    signature: true,
    options: [{ minutes: 75, price: 95 }, { minutes: 90, price: 115 }],
    photo: hotStones,
  },
  {
    id: 'aroma',
    name: { de: 'Aromaöl-Massage', en: 'Aromatherapy oil massage' },
    text: {
      de: 'Sanfte Massage mit warmem Öl und einem Duft, den Sie selbst wählen: belebend, ausgleichend oder beruhigend.',
      en: 'A gentle massage with warm oil and a scent you choose yourself: uplifting, balancing or calming.',
    },
    focus: ['relax'],
    options: [{ minutes: 60, price: 80 }, { minutes: 90, price: 110 }],
    photo: oilJar,
  },
  {
    id: 'deep-tissue',
    name: { de: 'Tiefengewebsmassage', en: 'Deep tissue massage' },
    text: {
      de: 'Langsamer, fester Druck für tief sitzende Verspannungen und müde Muskeln. Für alle, die es kräftig mögen.',
      en: 'Slow, firm pressure for deep-seated knots and tired muscles. For anyone who likes it strong.',
    },
    focus: ['deep'],
    options: [{ minutes: 45, price: 65 }, { minutes: 60, price: 85 }, { minutes: 90, price: 120 }],
    photo: backWarm,
  },
  {
    id: 'thai',
    name: { de: 'Traditionelle Thai-Massage', en: 'Traditional Thai massage' },
    text: {
      de: 'Bekleidet auf der Matte: Dehnungen, Druckpunkte und rhythmische Bewegung bringen Beweglichkeit und Energie zurück.',
      en: 'Fully clothed on the mat: stretches, pressure points and rhythmic movement bring back mobility and energy.',
    },
    focus: ['deep'],
    signature: true,
    options: [{ minutes: 60, price: 75 }, { minutes: 90, price: 105 }],
    photo: forearm,
  },
  {
    id: 'herbal',
    name: { de: 'Kräuterstempel-Massage', en: 'Herbal compress massage' },
    text: {
      de: 'Gedämpfte Kräuterstempel werden warm auf den Körper gedrückt und gerollt. Wohltuend für Muskeln und Sinne.',
      en: 'Steamed herbal compresses are pressed and rolled over the body while warm. Soothing for muscles and senses.',
    },
    focus: ['relax', 'deep'],
    warm: true,
    options: [{ minutes: 75, price: 95 }],
    photo: herbalBack,
  },
  {
    id: 'sports',
    name: { de: 'Sportmassage', en: 'Sports massage' },
    text: {
      de: 'Gezielte Arbeit an beanspruchten Muskeln vor oder nach dem Training, für schnellere Regeneration.',
      en: 'Focused work on overworked muscles before or after training, for faster recovery.',
    },
    focus: ['deep'],
    options: [{ minutes: 45, price: 60 }, { minutes: 60, price: 80 }],
  },
  {
    id: 'back-neck',
    name: { de: 'Rücken, Nacken & Schultern', en: 'Back, neck & shoulders' },
    text: {
      de: 'Die kurze Auszeit für den Schreibtischrücken: konzentriert dort, wo sich der Alltag festsetzt.',
      en: 'The short break for a desk-bound back: concentrated where everyday life settles in.',
    },
    focus: ['relax', 'deep'],
    options: [{ minutes: 30, price: 45 }],
  },
  {
    id: 'couples',
    name: { de: 'Paarmassage', en: 'Couples massage' },
    text: {
      de: 'Zwei Liegen, ein Raum, dieselbe Ruhe. Jede Person wählt ihre eigene Massage.',
      en: 'Two tables, one room, the same calm. Each of you chooses your own massage.',
    },
    focus: ['couples', 'relax'],
    forTwo: true,
    options: [{ minutes: 60, price: 150 }, { minutes: 90, price: 210 }],
    photo: candles,
  },
  {
    id: 'timeless-ritual',
    name: { de: 'Timeless Ritual', en: 'Timeless Ritual' },
    text: {
      de: 'Unser langes Ritual: warme Steine, Aromaöl und eine Kopfmassage zum Schluss. Zwei Stunden, in denen nichts drängt.',
      en: 'Our long ritual: warm stones, aromatic oil and a head massage to finish. Two hours in which nothing is urgent.',
    },
    focus: ['relax'],
    warm: true,
    signature: true,
    options: [{ minutes: 120, price: 160 }],
    photo: herbalBundles,
  },
];

export const focusLabels: Record<Focus | 'all', Record<Lang, string>> = {
  all: { de: 'Alle', en: 'All' },
  relax: { de: 'Entspannung', en: 'Relaxing' },
  deep: { de: 'Tiefenwirkung', en: 'Deep work' },
  couples: { de: 'Zu zweit', en: 'For two' },
};

export const euro = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);

export const fromPrice = (m: Massage) => Math.min(...m.options.map((o) => o.price));
