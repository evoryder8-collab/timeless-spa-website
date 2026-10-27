// Timeless Spa's brand concept: claim, philosophy and the six experience worlds.
// Source: the client's concept document (Vision, Philosophie, Erlebniswelten).

import type { ImageMetadata } from 'astro';
import type { Lang } from './site';
import type { PageKey } from '../i18n/routes';
import oil from '../assets/photos/amber-oil-bottle.jpg';
import candles from '../assets/photos/candles.jpg';
import herbalBack from '../assets/photos/herbal-compress-back.jpg';
import towels from '../assets/photos/towels-candles.jpg';
import herbs from '../assets/photos/herbal-bundles.jpg';
import forearm from '../assets/photos/forearm-massage.jpg';

type Text = Record<Lang, string>;

export const brand = {
  tagline: 'Ancient Traditions · Modern Wellness',
  claim: { de: 'Thai Heart. German Quality. <em>Timeless</em> Experience.', en: 'Thai Heart. German Quality. <em>Timeless</em> Experience.' } as Text,
  journey: {
    de: 'Eine einzigartige Reise zwischen thailändischer Heiltradition und deutschen Qualitätsstandards.',
    en: 'A unique journey between Thai healing traditions and German quality standards.',
  } as Text,
  promise: {
    de: 'Jede Behandlung erzählt eine Geschichte. Jeder Besuch wird zur Erinnerung.',
    en: 'Every treatment tells a story. Every visit becomes a memory.',
  } as Text,
};

export const pillars: { title: string; text: Text }[] = [
  {
    title: 'Thai Service',
    text: {
      de: 'Herzlichkeit, Achtsamkeit, Gastfreundschaft und traditionelle Berührungskunst.',
      en: 'Warmth, mindfulness, hospitality and the traditional art of touch.',
    },
  },
  {
    title: 'German Quality',
    text: {
      de: 'Präzision, Hygiene, strukturierte Abläufe, nachvollziehbare Qualität und professionelle Ausbildung.',
      en: 'Precision, hygiene, structured processes, traceable quality and professional training.',
    },
  },
  {
    title: 'Natural by Tradition',
    text: {
      de: 'Pflanzlich inspirierte Pflege, sorgfältig ausgewählte Rohstoffe und transparente Rezepturen.',
      en: 'Plant-inspired care, carefully selected raw materials and transparent recipes.',
    },
  },
];

export interface ExperienceWorld {
  id: string;
  name: Text;
  text: Text;
  photo: ImageMetadata;
  /** where the card leads: a page, optionally with a section anchor */
  page: PageKey;
  hash?: string;
  warm?: boolean;
}

export const experienceWorlds: ExperienceWorld[] = [
  {
    id: 'head',
    name: { de: 'Head Spa – Ancient Hair Rituals', en: 'Head Spa – Ancient Hair Rituals' },
    text: {
      de: 'Kopfhaut- und Haarpflege mit thailändischen Kräutern, Kokosöl, Butterfly Pea, Birke, Brennnessel und Kamille.',
      en: 'Scalp and hair care with Thai herbs, coconut oil, butterfly pea, birch, nettle and chamomile.',
    },
    photo: oil,
    page: 'massages',
    hash: 'head-spa',
    warm: true,
  },
  {
    id: 'handfoot',
    name: { de: 'Hand & Foot Spa', en: 'Hand & Foot Spa' },
    text: {
      de: 'Warme Kräuterbäder, Peelings, Pflege und entspannende Massagetechniken für Hände und Füße.',
      en: 'Warm herbal baths, scrubs, care and relaxing massage techniques for hands and feet.',
    },
    photo: candles,
    page: 'massages',
    hash: 'hand-foot-spa',
    warm: true,
  },
  {
    id: 'massage',
    name: { de: 'Signature Massage Treatments', en: 'Signature Massage Treatments' },
    text: {
      de: 'Individuell abgestimmte Thai-, Aromaöl-, Kopf-, Nacken-, Rücken- und Kräuterstempelmassagen.',
      en: 'Thai, aromatherapy, head, neck, back and herbal compress massages, tailored to you.',
    },
    photo: herbalBack,
    page: 'massages',
    hash: 'thai',
    warm: true,
  },
  {
    id: 'pregnancy',
    name: { de: 'Pregnancy Herbal Spa Experience', en: 'Pregnancy Herbal Spa Experience' },
    text: {
      de: 'Sanfte, schwangerschaftsgerechte Behandlungen mit einem sorgfältig abgestimmten Kräuter- und Wärmeritual.',
      en: 'Gentle, pregnancy-appropriate treatments with a carefully balanced herbal and warmth ritual.',
    },
    photo: towels,
    page: 'massages',
    hash: 'pregnancy',
    warm: true,
  },
  {
    id: 'botanicals',
    name: { de: 'Timeless Organic Botanicals', en: 'Timeless Organic Botanicals' },
    text: {
      de: 'Eigene, frisch zubereitete Kräuteraufgüsse und ausgewählte natürliche Pflegeprodukte aus thailändischer und deutscher Pflanzentradition.',
      en: 'Our own freshly prepared herbal infusions and selected natural care products, from Thai and German plant traditions.',
    },
    photo: herbs,
    page: 'about',
    hash: 'botanicals',
  },
  {
    id: 'academy',
    name: { de: 'Timeless Spa Academy', en: 'Timeless Spa Academy' },
    text: {
      de: 'Professionelle Schulungen in Head Spa, Thai-Wellness, Hand- und Fußpflege, Spa-Service, Hygiene und Behandlungsqualität.',
      en: 'Professional training in Head Spa, Thai wellness, hand and foot care, spa service, hygiene and treatment quality.',
    },
    photo: forearm,
    page: 'academy',
  },
];
