# Timeless Spa website: design

Approved by the user on 2026-10-27.

## Client

- Timeless Spa, a massage-focused spa.
- Address: Melatengürtel 131A, 50825 Köln-Ehrenfeld.
- Phone, WhatsApp, email and opening hours are not known yet. They are placeholders in `src/data/site.ts`.
- The real massage menu is still to come from the user. Until then `src/data/massages.ts` holds a sample menu marked as placeholder.
- No existing logo or photos. The logo is a typographic wordmark. Photos are free Unsplash images listed in `CREDITS.md`.

## Concept

"Hier steht die Zeit still" (Where time stands still). Warm and natural: sand `#EDE4D8`, clay `#B5704F`, olive `#6B7257` and espresso `#2A211B` for text and evening sections. Headings in Fraunces, body in Karla, both self-hosted with Fontsource so no requests go to Google.

## Pages

German is the default language at `/`, English is at `/en/`. Every page links to its counterpart in the other language.

| Key      | German          | English          |
|----------|-----------------|------------------|
| home     | `/`             | `/en/`           |
| massages | `/massagen/`    | `/en/massages/`  |
| about    | `/ueber-uns/`   | `/en/about/`     |
| vouchers | `/gutscheine/`  | `/en/vouchers/`  |
| contact  | `/kontakt/`     | `/en/contact/`   |
| imprint  | `/impressum/`   | `/en/imprint/`   |
| privacy  | `/datenschutz/` | `/en/privacy/`   |

- **Home:** water-and-stones hero, welcome, three signature massages, voucher teaser, location teaser, booking call to action.
- **Massages & Prices:** the whole menu from `massages.ts`, with filters (relaxing, deep work, couples), durations and prices.
- **About / Team:** the story, the therapists (placeholders) and the space.
- **Vouchers:** a tilting 3D voucher card, and how to buy one by phone, WhatsApp or in person. No online sales.
- **Contact & Hours:** a map that loads on tap, opening hours, contact buttons, and a directions chooser for Google Maps or Apple Maps.
- **Imprint / Privacy:** structured placeholder pages, clearly marked as needing real details and legal review.

## Booking

No booking backend. "Termin buchen" (book an appointment) opens a panel with three options: call (`tel:`), WhatsApp (`wa.me`) and email (`mailto:`). On phones a booking button stays fixed at the bottom of the screen.

## Motion, 3D and sound

- **Hero (Home):** a Three.js scene with a water surface driven by a GPU height-field ripple simulation, and a cairn of three basalt stones balanced on it, with rising steam. Pointer movement makes ripples. Scrolling lifts the camera and drifts the stones apart. It pauses when off screen.
- **Warm stone:** one small persistent WebGL stone (`transition:persist`, so it survives page changes). It rolls, with rotation matching the distance travelled, to the current "rest spot": elements marked `data-stone-spot`, and on the price list the massage card being hovered. It glows clay-red on hot-stone treatments. On Home it starts as the top stone of the cairn.
- **Voucher card:** CSS 3D tilt that follows the pointer, with a moving sheen.
- **Map:** MapLibre GL with OpenFreeMap vector tiles recoloured in the brand palette, warm 3D buildings, and a cinematic `flyTo` from above Cologne to the spa with a glowing pin. Nothing loads until the visitor taps "Karte anzeigen" (show map).
- **Scrolling:** Lenis smooth scrolling. GSAP ScrollTrigger reveals, with text rising like steam and images unmasking. Page transitions through the Astro ClientRouter show a linen-coloured wipe.
- **Sound:** off until the visitor chooses it. Everything is generated with the Web Audio API: a warm ambient bed with distant water, drips on ripples, a singing bowl on primary buttons, wooden clicks on navigation, and a soft whoosh on page changes. The choice is kept across pages and for the session.
- **Intro:** on the first visit per session, a breathing circle ("Einatmen… Ausatmen", breathe in… breathe out) with two choices, "Mit Klang eintreten" (enter with sound) or "Ohne Klang" (without sound). It is skipped when reduced motion is set.

## Tech

- Astro (static output) with vanilla TypeScript client modules, GSAP with ScrollTrigger, Lenis, Three.js and MapLibre GL. It is the same toolkit as the AusMC landing page.
- Content lives in `src/data/` (site details and massages) and `src/i18n/` (interface strings and routes).
- Client code re-initialises on `astro:page-load` and cleans up on `astro:before-swap`.

## Quality

- `prefers-reduced-motion`: no WebGL scenes, no smooth scroll, simple fades.
- No WebGL: static image fallback for the hero, and the stone is hidden.
- Phones: a lower-resolution simulation, a capped pixel ratio, and fewer particles.
- Keyboard and screen readers: semantic HTML, focus states, a dialog role for the panels, and `lang` on each page.
- Verified in the browser at desktop and phone sizes, plus a production build.

## Out of scope

Online booking, contact form, reviews and testimonials, online voucher sales, CMS.
