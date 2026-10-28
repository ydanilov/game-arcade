# [game] Arcade

A store-style showcase for Yura Danilov's browser games: Frankfurt Falls, Jutsu Clash and Paper Flight.

Live: https://game-arcade.vercel.app

One static page: `index.html` (inline CSS and JS, Google Fonts) plus art in `assets/`. No build step; Vercel serves the repo as is.

## Deep links

- https://game-arcade.vercel.app/#frankfurt-falls
- https://game-arcade.vercel.app/#jutsu-clash
- https://game-arcade.vercel.app/#paper-flight

## Add a new game

1. Put the art in `assets/` as 1024×572 WebP: one `xx_title.webp` cover (no text in the image) plus any screenshots.
2. In `index.html`, add an object to the `GAMES` array (near the top of the `<script>`). Copy an existing entry and change:
   - `id`: the URL hash for the detail view, e.g. `"my-game"`
   - `theme`: a colour class. Reuse `g-ff`, `g-jc` or `g-pf`, or add a new `.g-xx{--c:…;--ci:…;--c2:…}` rule in the CSS (`--c` is the cartridge colour, `--ci` the text colour on it)
   - `title`, `logo` (HTML for the typeset title) and `logoClass` (`logo-ff`, `logo-jc`, `logo-pf` or a new style)
   - `genre`, `pitch`, `tags`, `badges` (`[["16", "levels"]]`), `platforms` (`desktop`, `mobile`, `gamepad`)
   - `play` (game URL), `code` (GitHub URL), `cover`, `coverAlt`, `shots` (`[[src, caption]]`)
   - `lede`, `about` (paragraphs), `features`, `controls` (`[action, keyboard, gamepad, touch]`)
   - `landscape: true` if phones should be asked to rotate in the in-page player
3. The hero carousel, shelf, detail view, lightbox and player all pick it up automatically.

The game must allow being framed (no `X-Frame-Options: DENY`) for "Play here" to work; "Play now" always opens it in a new tab.

## Test

```
cd tools && npm i playwright && npx playwright install chromium && cd ..
node tools/test.mjs
```

Checks 390×844, 768×1024 and 1440×900: no console errors, no horizontal overflow, carousel (button, auto, arrow keys), detail view via card and deep link, lightbox, player open and Esc close, focus trap. Screenshots go to `tools/shots/` (gitignored).

Made by Yura Danilov with Claude. Art made in Google Flow.
