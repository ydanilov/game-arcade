// Builds link-preview assets from the GAMES list in index.html:
//   og/og.jpg            1200x630 storefront card (collage of the three covers)
//   og/<slug>.jpg        1200x630 card per game (its key art + title)
//   g/<slug>/index.html  share page with that game's Open Graph tags, redirecting to /#<slug>
// Run from the repo root: node tools/build-share.mjs
import { chromium } from "playwright";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath, pathToFileURL } from "node:url";

const SITE = "https://diego-games.vercel.app";
const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const html = fs.readFileSync(path.join(root, "index.html"), "utf8");
const src = html.slice(html.indexOf("const GAMES = ["), html.indexOf("\n];\n", html.indexOf("const GAMES = [")) + 3);
const GAMES = new Function(src.replace("const GAMES =", "return"))();
const esc = s => String(s).replace(/[&<>"]/g, c => ({ "&": "&amp;", "<": "&lt;", ">": "&gt;", '"': "&quot;" }[c]));
const asset = p => pathToFileURL(path.join(root, p)).href;

// Title styles copied from the storefront so cards match the site.
const FONTS = `<link href="https://fonts.googleapis.com/css2?family=Inter:wght@500;700;800&family=Dela+Gothic+One&family=Gochi+Hand&family=Lilita+One&display=block" rel="stylesheet">`;
const BASE = `*{box-sizing:border-box;margin:0}html,body{width:1200px;height:630px;overflow:hidden;background:#0b0b0f;color:#f4f4f6;font-family:Inter,sans-serif;-webkit-font-smoothing:antialiased}
.logo{font-weight:400;line-height:.95}
.logo-ff{font-family:"Lilita One";color:#ffc23a;-webkit-text-stroke:.09em #3a1206;paint-order:stroke fill;text-shadow:0 .06em 0 #3a1206}.logo-ff span{color:#fff3d6}
.logo-jc{font-family:"Dela Gothic One";color:#fff;letter-spacing:-.01em;text-shadow:.045em .045em 0 #7d4ed8}.logo-jc span{color:#ff8fb6}
.logo-pf{font-family:"Gochi Hand";color:#fff;line-height:.9;text-shadow:0 2px 14px rgba(0,0,0,.5)}
.word{font-weight:800;font-size:30px;letter-spacing:-.02em}`;

const gameCard = g => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
.art{position:absolute;inset:0;background:url("${asset(g.cover)}") ${g.focus || "50% 50%"}/cover}
.art::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#0b0b0f 0%,rgba(11,11,15,.75) 22%,rgba(11,11,15,0) 55%),linear-gradient(90deg,rgba(11,11,15,.85) 0%,rgba(11,11,15,.4) 34%,rgba(11,11,15,0) 60%)}
.copy{position:absolute;left:64px;bottom:56px;right:64px}
.logo{font-size:${g.logoClass === "logo-pf" ? 128 : 108}px}
.genre{margin-top:18px;font-size:26px;font-weight:500;color:#c9c9d2}
.word{position:absolute;top:44px;left:64px}
</style></head><body><div class="art"></div><div class="word">Diego's Games</div>
<div class="copy"><div class="logo ${g.logoClass}">${g.logo}</div><div class="genre">${esc(g.genre)}</div></div></body></html>`;

const siteCard = () => `<!doctype html><html><head><meta charset="utf-8">${FONTS}<style>${BASE}
.grid{position:absolute;inset:0;display:grid;grid-template-columns:1.45fr 1fr;grid-template-rows:1fr 1fr;gap:6px}
.t{background-size:cover;position:relative}
.t:first-child{grid-row:1/3}
.grid::after{content:"";position:absolute;inset:0;background:linear-gradient(0deg,#0b0b0f 0%,rgba(11,11,15,.82) 24%,rgba(11,11,15,0) 58%)}
.copy{position:absolute;left:64px;bottom:52px;right:64px}
.word{font-size:84px;line-height:1}
.sub{margin-top:14px;font-size:27px;font-weight:500;color:#c9c9d2}
</style></head><body><div class="grid">${GAMES.map(g => `<div class="t" style="background-image:url('${asset(g.cover)}');background-position:${g.focus || "50% 50%"}"></div>`).join("")}</div>
<div class="copy"><div class="word">Diego's Games</div><div class="sub">${GAMES.map(g => esc(g.title)).join(", ").replace(/, ([^,]*)$/, " and $1")}. Free in your browser.</div></div></body></html>`;

const sharePage = g => {
  const url = `${SITE}/g/${g.id}/`, img = `${SITE}/og/${g.id}.jpg`, to = `/#${g.id}`;
  const title = `${g.title}, a game by Diego Danylov`;
  return `<!doctype html>
<html lang="en">
<head>
<meta charset="utf-8">
<meta name="viewport" content="width=device-width, initial-scale=1">
<title>${esc(title)}</title>
<meta name="description" content="${esc(g.pitch)}">
<meta name="author" content="Diego Danylov">
<meta name="theme-color" content="#0b0b0f">
<link rel="canonical" href="${url}">
<meta property="og:type" content="website">
<meta property="og:site_name" content="Diego's Games">
<meta property="og:title" content="${esc(title)}">
<meta property="og:description" content="${esc(g.pitch)}">
<meta property="og:url" content="${url}">
<meta property="og:image" content="${img}">
<meta property="og:image:type" content="image/jpeg">
<meta property="og:image:width" content="1200">
<meta property="og:image:height" content="630">
<meta property="og:image:alt" content="${esc(g.coverAlt)}">
<meta name="twitter:card" content="summary_large_image">
<meta name="twitter:title" content="${esc(title)}">
<meta name="twitter:description" content="${esc(g.pitch)}">
<meta name="twitter:image" content="${img}">
<meta name="twitter:image:alt" content="${esc(g.coverAlt)}">
<meta http-equiv="refresh" content="0; url=${to}">
<style>html{background:#0b0b0f;color:#a9a9b4;font:16px/1.5 Inter,system-ui,sans-serif}body{display:grid;place-items:center;min-height:100vh;margin:0}a{color:#fff}</style>
<script>location.replace(${JSON.stringify(to)});</script>
</head>
<body><p>Opening <a href="${to}">${esc(g.title)}</a>…</p></body>
</html>
`;
};

fs.mkdirSync(path.join(root, "og"), { recursive: true });
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1200, height: 630 } });
const shot = async (markup, file) => {
  const tmp = path.join(root, "og", ".card.html");
  fs.writeFileSync(tmp, markup);
  await page.goto(pathToFileURL(tmp).href, { waitUntil: "networkidle" });
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: path.join(root, "og", file), type: "jpeg", quality: 84 });
  fs.unlinkSync(tmp);
};
await shot(siteCard(), "og.jpg");
for (const g of GAMES) {
  await shot(gameCard(g), `${g.id}.jpg`);
  fs.mkdirSync(path.join(root, "g", g.id), { recursive: true });
  fs.writeFileSync(path.join(root, "g", g.id, "index.html"), sharePage(g));
}
await browser.close();
console.log("built og/ and g/ for", GAMES.map(g => g.id).join(", "));
