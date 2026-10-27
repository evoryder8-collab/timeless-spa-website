# Timeless Spa website

Bilingual (German / English) website for Timeless Spa, Melatengürtel 131A, 50825 Köln-Ehrenfeld: "Thai Heart. German Quality. Timeless Experience." It is a premium spa joining Thai healing traditions with German quality standards. It offers six experience worlds: Head Spa, Hand & Foot Spa, Signature Massages, Pregnancy Herbal Spa, Timeless Organic Botanicals and the Timeless Spa Academy. German is at `/`, English at `/en/`.

Built with Astro (static HTML). The motion and sound use GSAP + ScrollTrigger, Lenis, Three.js, MapLibre GL and the Web Audio API.

## Run it

```bash
npm install
npm run dev       # http://localhost:4321/timeless-spa-website/
npm run build     # static site in dist/
npm run preview   # serve dist/ locally
```

## Review site (GitHub Pages)

Every push to `main` builds the site and publishes it to **https://evoryder8-collab.github.io/timeless-spa-website/** (workflow in `.github/workflows/deploy.yml`). The repository is public.

While the site is under review, every page has `<meta name="robots" content="noindex">` (in `src/layouts/Base.astro`) so search engines leave it alone. When Timeless Spa moves to its own domain:
1. remove the noindex line;
2. set `site` to the real domain and remove `base` in `astro.config.mjs`.

`dist/` is plain HTML, CSS and JS, so any static host works.

## Before going live

These are placeholders and must be replaced:

| What | Where |
|---|---|
| Phone, WhatsApp number, email | `src/data/site.ts` |
| Opening hours | `src/data/site.ts` |
| Treatment durations and prices (sample prices right now) | `src/data/treatments.ts`, then set `menuIsSample = false` |
| Academy dates, formats and prices | `src/views/Academy.astro` |
| Team names and photos | `src/views/About.astro` |
| Photos for Head Spa, Hand & Foot, Pregnancy, Botanicals and Academy | `src/data/brand.ts`, `src/data/treatments.ts` |
| Impressum and Datenschutz (operator details, hosting provider, legal review) | `src/views/Legal.astro` |
| Real domain (and removing the review-only `noindex`) | `astro.config.mjs`, `src/layouts/Base.astro` |
| Photos (currently Unsplash stock, credited in `CREDITS.md`) | `src/assets/photos/` |

All copy is a draft for the spa to review.

## Where things live

- `src/data/` holds:
  - the spa's details (`site.ts`)
  - the brand concept (`brand.ts`): claim, philosophy and the six experience worlds
  - the treatment menu (`treatments.ts`)

  Copy rule from the concept: never write "chemiefrei" / "chemical-free". Use "mit ausgewählten natürlichen Inhaltsstoffen und transparenten Rezepturen" (with selected natural ingredients and transparent recipes).
- `src/i18n/` holds the interface text (`ui.ts`) and the page URLs in both languages (`routes.ts`).
- `src/views/` has one file per page, with its German and English copy at the top. `src/pages/` only maps URLs to views.
- `src/components/` contains the header, footer, booking panel, intro, cards, voucher and map block.
- `src/scripts/` contains the behaviour:
  - `app.ts` starts each page.
  - `hero.ts` is the water and stone cairn.
  - `stone.ts` is the travelling stone.
  - `stone-shape.ts` makes the procedural stones.
  - `audio.ts` generates all sounds.
  - `map.ts` is the map.
  - `reveal.ts` runs the scroll reveals.
  - `ui.ts` handles the menus, booking panel and filters.

## How the effects work

- **Intro:** shown once per browser session. A breathing circle, then "Mit Klang eintreten" (enter with sound) or "Ohne Klang" (without sound). It is skipped when the visitor's system asks for reduced motion.
- **Hero:** the water is a GPU ripple simulation drawn with a planar reflection. The pointer makes ripples, and a click or tap makes a bigger drop. Scrolling lifts the camera and drifts the stones apart. Rendering stops when the hero is off screen.
- **Travelling stone:** the cairn's top stone lifts off when you scroll past the hero. It rests on elements marked `data-stone-spot="top-left|top-right"`, moves to cards marked `data-stone-hover` and glows on `data-warm` cards. Its layer survives page changes (Astro `transition:persist`), so it follows the visitor from page to page. Clicking it makes it wobble.
- **Sound:** generated in the browser with Web Audio, so there are no audio files. It is off until the visitor chooses it. The header switch turns it on and off, and the choice is kept for the session.
- **Map:** a spinning NASA Blue Marble Earth (from `src/assets/earth/`, drawn by `src/scripts/globe.ts`) is there straight away. Nothing third-party loads until "Zum Timeless Spa fliegen" (fly to Timeless Spa) or the globe is tapped. Then MapLibre takes over at the same size, using NASA Blue Marble imagery on its own globe with an atmosphere and a starfield, and dives down to the spa. Around zoom 7–9 the satellite picture hands over to OpenFreeMap streets, recoloured in the brand palette with warm 3D buildings.
- **On phones:**
  - Ripples follow each finger on the water, even while it scrolls the page.
  - Tilting the phone moves the camera around the cairn and tilts the voucher card. iOS asks for motion access once, when the visitor enters the site.
  - Taps give a light vibration on phones that support it.
  - The travelling stone moves to the massage card in the middle of the screen, glows on warm treatments, and rides on the booking bar when there's nothing else to sit on.
  - The signature massages are a swipe carousel.
  - The menu opens as a ripple from its button.
- **Reduced motion or no WebGL:** a photo replaces the hero scene, there is no stone and no smooth scrolling, and content simply appears.

## Privacy

- No cookies and no tracking.
- Fonts are self-hosted.
- `sessionStorage` only remembers whether the intro was seen and whether sound is on.
- The only third-party requests are the map tiles and NASA imagery, after the click.
