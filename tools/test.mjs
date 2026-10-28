// Playwright smoke test for [game] Arcade.
// Run from repo root:  node tools/test.mjs   (serves the repo on a local port)
import { chromium } from "playwright";
import http from "node:http";
import fs from "node:fs";
import path from "node:path";
import { fileURLToPath } from "node:url";

const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), "..");
const shots = path.join(root, "tools", "shots");
fs.mkdirSync(shots, { recursive: true });
const TYPES = { ".html": "text/html", ".webp": "image/webp", ".js": "text/javascript", ".css": "text/css", ".mp4": "video/mp4" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  const type = TYPES[path.extname(p)] || "application/octet-stream", size = fs.statSync(p).size;
  const m = /bytes=(\d*)-(\d*)/.exec(req.headers.range || "");
  if (m) { // range requests, like Vercel, so video can seek and loop
    const a = m[1] ? +m[1] : 0, b = m[2] ? +m[2] : size - 1;
    res.writeHead(206, { "content-type": type, "accept-ranges": "bytes", "content-range": `bytes ${a}-${b}/${size}`, "content-length": b - a + 1 });
    return fs.createReadStream(p, { start: a, end: b }).pipe(res);
  }
  res.writeHead(200, { "content-type": type, "accept-ranges": "bytes", "content-length": size });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const VIEWS = [["phone", 390, 844, true], ["tablet", 768, 1024, true], ["desktop", 1440, 900, false], ["wide", 1920, 1080, false]];
const IDS = ["frankfurt-falls", "jutsu-clash", "paper-flight"];
let fails = 0;
const ok = (c, m) => { console.log(`${c ? "PASS" : "FAIL"}  ${m}`); if (!c) fails++; };

const browser = await chromium.launch();
for (const [name, width, height, touch] of VIEWS) {
  console.log(`\n== ${name} ${width}x${height}`);
  const ctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && width < 500, deviceScaleFactor: 1 });
  // stub the external game pages so the iframe test is offline and deterministic
  await ctx.route(/game-.*\.vercel\.app/, r => r.fulfill({ contentType: "text/html", body: "<body style='background:#123;color:#fff'>stub game</body>" }));
  const page = await ctx.newPage();
  if (process.env.TRACE) await page.addInitScript(() => { const op = HTMLMediaElement.prototype.play; HTMLMediaElement.prototype.play = function () { console.log("TRACE play " + (this.closest("[id]") || {}).id + " stack " + new Error().stack.split("\n").slice(2, 5).map(x => x.trim().slice(0, 60)).join(" | ") + " stack=" + document.querySelectorAll("dialog[open]").length); return op.call(this); }; });
  if (process.env.TRACE) page.on("console", m => { if (m.text().startsWith("TRACE")) console.log(m.text()); });
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base, { waitUntil: "load" });
  await page.waitForTimeout(400);
  const heroVid = () => page.evaluate(() => { const v = document.querySelector(".slide.on video"); return { src: !!v.getAttribute("src"), playing: v.classList.contains("playing") && !v.paused, muted: v.muted }; });
  ok(await page.evaluate(() => document.querySelectorAll(".slide video[data-src]").length === 3 && [...document.querySelectorAll("video")].every(v => v.preload === "none" && !v.getAttribute("src"))), "video elements exist, nothing preloaded at first paint");
  await page.mouse.move(2, height - 2);
  await page.waitForTimeout(3200);
  const hv = await heroVid();
  ok(hv.playing && hv.muted, "hero crossfades into the muted trailer");
  await page.screenshot({ path: `${shots}/${name}-hero-video.png` });
  await page.locator("#hero .mute").click();
  ok(await page.evaluate(() => !document.querySelector(".slide.on video").muted && document.querySelector("#hero .mute").getAttribute("aria-pressed") === "true"), "mute toggle turns sound on");
  await page.locator("#hero .mute").click();
  ok(await page.evaluate(() => document.querySelector(".slide.on video").muted), "mute toggle turns sound off");
  ok(await page.evaluate(() => [...document.querySelectorAll("video")].filter(v => !v.paused).length === 1), "only one video plays");
  await page.evaluate(() => { document.body.style.paddingBottom = "100vh"; scrollTo(0, innerHeight); });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelector(".slide.on video").paused), "hero trailer pauses when scrolled out of view");
  await page.evaluate(() => { scrollTo(0, 0); document.body.style.paddingBottom = ""; });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => !document.querySelector(".slide.on video").paused), "hero trailer resumes when scrolled back");
  await page.evaluate(() => scrollTo(0, 0));

  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok((await overflow()) <= 0, `no horizontal overflow (${await overflow()})`);
  await page.screenshot({ path: `${shots}/${name}-home.png` });
  await page.screenshot({ path: `${shots}/${name}-home-full.png`, fullPage: true });

  // carousel: next button and auto-advance
  const active = () => page.evaluate(() => document.querySelector(".slide.on").id);
  const a0 = await active();
  await page.mouse.move(width / 2, height - 2);
  await page.locator("#dots button").nth(1).click();
  ok((await active()) !== a0, "carousel jumps with progress indicator");
  await page.mouse.move(width / 2, height - 2);
  await page.evaluate(() => { document.activeElement.blur(); scrollTo(0, 0); });
  await page.mouse.move(2, height - 2);
  const a1 = await active();
  await page.waitForFunction(a => document.querySelector(".slide.on").id !== a, a1, { timeout: 25000 }).catch(() => {});
  ok((await active()) !== a1, "carousel auto-advances after the trailer loops twice");
  await page.evaluate(() => scrollTo(0, 0));
  await page.focus("#hero");
  const a2 = await active();
  await page.keyboard.press("ArrowRight");
  ok((await active()) !== a2, "carousel advances with arrow key");
  // arrow navigation across rows
  await page.locator('.tile-link').first().focus();
  await page.keyboard.press("ArrowRight");
  ok(await page.evaluate(() => document.activeElement === document.querySelectorAll(".tile-link")[1]), "arrow right moves focus along games row");
  await page.keyboard.press("ArrowDown");
  ok(await page.evaluate(() => document.activeElement.classList.contains("moment")), "arrow down moves focus to moments row");
  if (!touch) {
    await page.evaluate(() => scrollTo(0, 0));
    await page.locator(".tile").nth(1).hover();
    await page.waitForTimeout(1800);
    ok(await page.evaluate(() => { const v = document.querySelectorAll(".tile video")[1]; return !v.paused && v.classList.contains("playing") && document.querySelector(".slide.on video").paused; }), "tile hover plays its trailer and pauses the hero");
    await page.screenshot({ path: `${shots}/${name}-tile-hover.png` });
    await page.mouse.move(2, height - 2);
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => document.querySelectorAll(".tile video")[1].paused), "tile trailer stops when the pointer leaves");
  }
  ok(await page.evaluate(() => !document.querySelector(".chip,.tag,.badge")), "no chips, tags or badges on the page");
  ok(await page.evaluate(() => !/yura/i.test(document.documentElement.outerHTML)), "no leftover Yura references");

  // detail via card
  for (const id of IDS) {
    await page.locator(`.tile-link[data-open="${id}"]`).click();
    await page.waitForTimeout(450);
    ok(await page.evaluate(i => document.querySelector("#detail").open && location.hash === "#" + i, id), `detail opens via card: ${id}`);
    await page.waitForFunction(() => { const v = document.querySelector(".d-hero video"); return v && !v.paused && v.classList.contains("playing"); }, null, { timeout: 8000 }).catch(() => {});
    ok(await page.evaluate(() => { const v = document.querySelector(".d-hero video"); return v && !v.paused && document.querySelector(".slide.on video").paused; }), `detail hero plays the trailer: ${id}`);
    ok((await page.evaluate(() => document.querySelector("#detail").scrollWidth - document.querySelector("#detail").clientWidth)) <= 0, `detail has no horizontal overflow: ${id}`);
    await page.screenshot({ path: `${shots}/${name}-detail-${id}.png` });
    if (name !== "tablet") await page.screenshot({ path: `${shots}/${name}-detail-${id}-full.png`, fullPage: false });
    await page.keyboard.press("Escape");
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => !document.querySelector("#detail").open && !location.hash), `detail closes with Esc: ${id}`);
  }
  // detail via deep link
  for (const id of IDS) {
    await page.goto(base + "#" + id, { waitUntil: "networkidle" });
    await page.waitForTimeout(300);
    ok(await page.evaluate(i => document.querySelector("#detail").open && document.querySelector("#dTitle").textContent.replace(/\s/g, "").length > 3, id), `detail opens via deep link: ${id}`);
  }
  // full-page detail screenshot (scroll inside the dialog)
  await page.evaluate(() => { const d = document.querySelector("#detail"); d.scrollTop = 900; });
  await page.waitForTimeout(400);
  await page.screenshot({ path: `${shots}/${name}-detail-scrolled.png` });

  // lightbox
  await page.goto(base + "#jutsu-clash", { waitUntil: "networkidle" });
  await page.locator("#detail [data-view='1']").click();
  ok(await page.evaluate(() => document.querySelector("[data-thumb='1']").getAttribute("aria-current") === "true"), "screenshot viewer advances");
  await page.locator("#detail .viewer-main").scrollIntoViewIfNeeded();
  await page.screenshot({ path: `${shots}/${name}-detail-viewer.png` });
  await page.locator("#detail .viewer-main").click();
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.querySelector("#lightbox").open), "lightbox opens");
  const c1 = await page.textContent("#lbCount");
  await page.keyboard.press("ArrowRight");
  ok((await page.textContent("#lbCount")) !== c1, "lightbox arrow key advances");
  await page.screenshot({ path: `${shots}/${name}-lightbox.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.querySelector("#lightbox").open && document.querySelector("#detail").open), "lightbox closes with Esc, detail stays");

  // trailer in the viewer and lightbox, with sound
  await page.goto(base + "#paper-flight", { waitUntil: "load" });
  await page.waitForTimeout(400);
  ok(await page.evaluate(() => document.querySelectorAll("#detail .thumb .vbadge").length === 2), "trailers lead the viewer with play badges");
  await page.locator("#detail .viewer-main").scrollIntoViewIfNeeded();
  await page.locator("#detail .viewer-main").click();
  await page.waitForFunction(() => { const v = document.querySelector("#lbVid"); return !v.hidden && !v.paused && v.currentTime > 0.3; }, null, { timeout: 8000 }).catch(() => {});
  ok(await page.evaluate(() => { const v = document.querySelector("#lbVid"); return !v.hidden && !v.paused && !v.muted && document.querySelector(".d-hero video").paused; }), "lightbox plays the trailer with sound and pauses the hero");
  await page.screenshot({ path: `${shots}/${name}-lightbox-trailer.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.querySelector("#lbVid").paused && !document.querySelector("#lightbox").open), "lightbox trailer stops on close");
  await page.goto(base + "#jutsu-clash", { waitUntil: "load" });
  await page.waitForTimeout(300);

  // player
  await page.locator("#detail [data-play-here]").click();
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector("#player").open && document.querySelector("#plFrame").src.includes("jutsu")), "player opens with iframe");
  await page.screenshot({ path: `${shots}/${name}-player.png` });
  const playingNow = await page.evaluate(() => [...document.querySelectorAll("video")].filter(v => !v.paused).map(v => (v.closest("[id]") || {}).id + ":" + v.className));
  ok(!playingNow.length, "game player pauses every trailer" + (playingNow.length ? ": " + playingNow.join(", ") : ""));

  // focus trap: tab many times, focus must stay in player
  for (let k = 0; k < 6; k++) await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.querySelector("#player").contains(document.activeElement)), "focus trapped in player");
  await page.evaluate(() => document.querySelector("#player [data-close]").focus());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.querySelector("#player").open && document.querySelector("#plFrame").src === "about:blank"), "player closes with Esc and unloads game");
  await page.waitForTimeout(300);
  ok(await page.evaluate(() => !document.querySelector(".d-hero video").paused), "detail trailer resumes after the player closes");

  ok(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await ctx.close();

  // reduced motion: stills only
  const rctx = await browser.newContext({ viewport: { width, height }, hasTouch: touch, isMobile: touch && width < 500, reducedMotion: "reduce" });
  const rp = await rctx.newPage();
  const rerr = []; rp.on("pageerror", e => rerr.push(String(e)));
  await rp.goto(base, { waitUntil: "load" });
  await rp.waitForTimeout(2600);
  ok(await rp.evaluate(() => [...document.querySelectorAll("video")].every(v => v.paused && !v.getAttribute("src")) && !document.querySelector(".slide.on video.playing")), "reduced motion keeps the hero on the still");
  await rp.goto(base + "#frankfurt-falls", { waitUntil: "load" });
  await rp.waitForTimeout(800);
  ok(await rp.evaluate(() => document.querySelector(".d-hero video").paused), "reduced motion keeps the detail hero on the still");
  ok(rerr.length === 0, "no errors under reduced motion");
  await rctx.close();
}
await browser.close();
server.close();
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"}`);
process.exit(fails ? 1 : 0);
