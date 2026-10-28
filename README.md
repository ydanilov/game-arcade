# Diego's Games

A dark, Netflix / eShop style storefront for Diego Danylov's browser games: Frankfurt Falls, Jutsu Clash and Paper Flight.

Live: https://diego-games.vercel.app

One static page: `index.html` (inline CSS and JS, Google Fonts) plus art in `assets/`. No build step; Vercel serves the repo as is.

## Deep links

- https://diego-games.vercel.app/#frankfurt-falls
- https://diego-games.vercel.app/#jutsu-clash
- https://diego-games.vercel.app/#paper-flight

## Add a new game

1. Put the art in `assets/` as 1024×572 WebP: one `xx_title.webp` cover (no text in the image) plus any screenshots.
2. In `index.html`, add an object to the `GAMES` array (near the top of the `<script>`). Copy an existing entry and change:
   - `id`: the URL hash for the detail view, e.g. `"my-game"`
   - `theme`: a colour class. Reuse `g-ff`, `g-jc` or `g-pf`, or add a new `.g-xx{--ac:#hex}` rule in the CSS (`--ac` is the game's accent, used for focus rings and the Play glow)
   - `focus`: optional `object-position` for cropping the cover in the hero and tiles, e.g. `"60% 50%"`
   - `title`, `logo` (HTML for the typeset title) and `logoClass` (`logo-ff`, `logo-jc`, `logo-pf` or a new style)
   - `genre`, `pitch`, `platforms` (`desktop`, `mobile`, `gamepad`)
   - `play` (game URL), `code` (GitHub URL), `cover`, `coverAlt`, `shots` (`[[src, caption]]`)
   - `lede`, `about` (paragraphs), `features`, `controls` (`[action, keyboard, gamepad, touch]`)
   - `landscape: true` if phones should be asked to rotate in the in-page player
3. The hero, the Games row, the Moments row (built from `shots`), the detail page, lightbox and player all pick it up automatically.

The game must allow being framed (no `X-Frame-Options: DENY`) for "Play here" to work; "Play now" always opens it in a new tab.

## Test

```
cd tools && npm i playwright && npx playwright install chromium && cd ..
node tools/test.mjs
```

Checks 390×844, 768×1024, 1440×900 and 1920×1080: no console errors, no horizontal overflow, no chips, hero rotation (indicator, auto, arrow keys), arrow-key navigation across rows, detail page via tile and deep link, screenshot viewer, lightbox, player open and Esc close, focus trap. Screenshots go to `tools/shots/` (gitignored).

Made by Diego Danylov · built with Claude · art made in Google Flow
