// The treatment menu, grouped by Timeless Spa's experience worlds. Edit this file to change what appears
// on the Treatments & Prices page.
//
// PLACEHOLDER: names follow the brand concept, but durations and prices are samples. Replace them with the
// real menu, then set `menuIsSample` to false (it hides the "sample menu" notice on the page).
//
// Wording rule from the brand concept: never promise "chemiefrei" / "chemical-free". Say
// "mit ausgewählten natürlichen Inhaltsstoffen und transparenten Rezepturen" instead.

import type { ImageMetadata } from 'astro';
import type { Lang } from './site';
import oil from '../assets/photos/amber-oil-bottle.jpg';
import oilJar from '../assets/photos/oil-jar-linen.jpg';
import herbalBack from '../assets/photos/herbal-compress-back.jpg';
import backLight from '../assets/photos/back-massage-light.jpg';
import backWarm from '../assets/photos/back-massage-warm.jpg';
import towels from '../assets/photos/towels-candles.jpg';
import candles from '../assets/photos/candles.jpg';

export const menuIsSample = true;

export type World = 'head' | 'handfoot' | 'massage' | 'pregnancy';

export const worldLabels: Record<World | 'all', Record<Lang, string>> = {
  all: { de: 'Alle', en: 'All' },
  head: { de: 'Head Spa', en: 'Head Spa' },
  handfoot: { de: 'Hand & Fuß', en: 'Hand & Foot' },
  massage: { de: 'Massagen', en: 'Massages' },
  pregnancy: { de: 'Schwangerschaft', en: 'Pregnancy' },
};

export interface Treatment {
  id: string;
  world: World;
  name: Record<Lang, string>;
  text: Record<Lang, string>;
  /** a short safety or practical note shown under the prices */
  note?: Record<Lang, string>;
  /** warm treatments (herbal compresses, warm baths): the travelling stone glows on them */
  warm?: boolean;
  options: { minutes: number; price: number }[];
  photo?: ImageMetadata;
}

export const treatments: Treatment[] = [
  {
    id: 'head-spa',
    world: 'head',
    name: { de: 'Head Spa – Ancient Hair Ritual', en: 'Head Spa – Ancient Hair Ritual' },
    text: {
      de: 'Ein besonderes Kopfhaut- und Haarpflegeerlebnis mit traditionellen thailändischen Kräutern, Kokosöl, Butterfly Pea und deutschen Pflanzen wie Birke, Brennnessel und Kamille.',
      en: 'A special scalp and hair ritual with traditional Thai herbs, coconut oil, butterfly pea and German plants such as birch, nettle and chamomile.',
    },
    warm: true,
    options: [{ minutes: 60, price: 79 }, { minutes: 90, price: 109 }],
    photo: oil,
  },
  {
    id: 'hand-foot-spa',
    world: 'handfoot',
    name: { de: 'Hand & Foot Spa', en: 'Hand & Foot Spa' },
    text: {
      de: 'Verwöhnende Hand- und Fußrituale mit warmen Kräuterbädern, Peelings, Pflege und entspannenden Massagetechniken.',
      en: 'Indulgent hand and foot rituals with warm herbal baths, scrubs, care and relaxing massage techniques.',
    },
    warm: true,
    options: [{ minutes: 45, price: 55 }, { minutes: 75, price: 85 }],
    photo: candles,
  },
  {
    id: 'thai',
    world: 'massage',
    name: { de: 'Traditionelle Thai-Massage', en: 'Traditional Thai massage' },
    text: {
      de: 'Dehnungen, Druckpunkte und rhythmische Bewegung nach thailändischer Tradition, individuell auf Sie abgestimmt.',
      en: 'Stretches, pressure points and rhythmic movement in the Thai tradition, shaped around you.',
    },
    options: [{ minutes: 60, price: 75 }, { minutes: 90, price: 105 }],
    photo: backWarm,
  },
  {
    id: 'aroma',
    world: 'massage',
    name: { de: 'Aromaöl-Massage', en: 'Aromatherapy oil massage' },
    text: {
      de: 'Fließende Griffe mit warmem Öl und ausgewählten natürlichen Inhaltsstoffen, für tiefe Entspannung.',
      en: 'Flowing strokes with warm oil and carefully selected natural ingredients, for deep relaxation.',
    },
    options: [{ minutes: 60, price: 80 }, { minutes: 90, price: 110 }],
    photo: oilJar,
  },
  {
    id: 'head-neck-back',
    world: 'massage',
    name: { de: 'Kopf-, Nacken- & Rückenmassage', en: 'Head, neck & back massage' },
    text: {
      de: 'Konzentriert dort, wo sich der Alltag festsetzt: die kurze, wirkungsvolle Auszeit.',
      en: 'Focused where everyday life settles in: the short, effective break.',
    },
    options: [{ minutes: 30, price: 45 }, { minutes: 45, price: 60 }],
    photo: backLight,
  },
  {
    id: 'herbal-compress',
    world: 'massage',
    name: { de: 'Kräuterstempel-Massage', en: 'Herbal compress massage' },
    text: {
      de: 'Warme, gedämpfte Kräuterstempel nach thailändischer Tradition werden auf den Körper gedrückt und gerollt.',
      en: 'Warm, steamed herbal compresses in the Thai tradition are pressed and rolled over the body.',
    },
    warm: true,
    options: [{ minutes: 75, price: 95 }, { minutes: 90, price: 115 }],
    photo: herbalBack,
  },
  {
    id: 'pregnancy',
    world: 'pregnancy',
    name: { de: 'Pregnancy Herbal Spa Experience', en: 'Pregnancy Herbal Spa Experience' },
    text: {
      de: 'Ein liebevoll gestaltetes Wellnesserlebnis für die Schwangerschaft, mit sanften, schwangerschaftsgerechten Behandlungen und einem sorgfältig abgestimmten Kräuter- und Wärmeritual.',
      en: 'A lovingly designed pregnancy wellness experience with gentle, pregnancy-appropriate treatments and a carefully balanced herbal and warmth ritual.',
    },
    note: {
      de: 'Dampfanwendungen nur nach individueller Sicherheitsprüfung und fachlicher Freigabe.',
      en: 'Steam treatments only after an individual safety check and professional approval.',
    },
    warm: true,
    options: [{ minutes: 60, price: 85 }, { minutes: 90, price: 115 }],
    photo: towels,
  },
];

export const euro = (n: number, lang: Lang) =>
  new Intl.NumberFormat(lang === 'de' ? 'de-DE' : 'en-GB', { style: 'currency', currency: 'EUR', maximumFractionDigits: 0 }).format(n);
