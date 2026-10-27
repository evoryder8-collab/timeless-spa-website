// Everything about the spa that appears on more than one page.
// Fields marked PLACEHOLDER are not known yet and must be replaced before going live.

export type Lang = 'de' | 'en';
type Text = Record<Lang, string>;

export const site = {
  name: 'Timeless Spa',
  address: {
    street: 'Melatengürtel 131A',
    zip: '50825',
    city: 'Köln',
    district: 'Ehrenfeld',
  },
  /** Map position of Melatengürtel 131 (OpenStreetMap), [longitude, latitude] */
  lngLat: [6.91425, 50.94835] as [number, number],

  // PLACEHOLDER: phone number, WhatsApp number and email
  phone: { display: '+49 221 000 000 0', href: 'tel:+492210000000' },
  whatsapp: { display: '+49 221 000 000 0', href: 'https://wa.me/492210000000' },
  email: 'hallo@timeless-spa.example',

  // PLACEHOLDER: opening hours. `days` lists ISO weekdays (1 = Monday … 7 = Sunday); `time` null means closed.
  hours: [
    { days: [1, 2, 3, 4, 5], label: { de: 'Montag – Freitag', en: 'Monday – Friday' } as Text, time: '10:00 – 20:00' },
    { days: [6], label: { de: 'Samstag', en: 'Saturday' } as Text, time: '10:00 – 18:00' },
    { days: [7], label: { de: 'Sonntag', en: 'Sunday' } as Text, time: null },
  ],
  hoursNote: { de: 'Termine nach Vereinbarung', en: 'By appointment' } as Text,
};

export const fullAddress = `${site.address.street}, ${site.address.zip} ${site.address.city}`;

/** "Bring me there" links for the directions chooser */
export const directions = {
  google: `https://www.google.com/maps/dir/?api=1&destination=${encodeURIComponent(`${site.name}, ${fullAddress}`)}`,
  apple: `https://maps.apple.com/?daddr=${encodeURIComponent(fullAddress)}&ll=${site.lngLat[1]},${site.lngLat[0]}`,
};

export const mailto = (subject: string) => `mailto:${site.email}?subject=${encodeURIComponent(subject)}`;
export const whatsappWith = (text: string) => `${site.whatsapp.href}?text=${encodeURIComponent(text)}`;
