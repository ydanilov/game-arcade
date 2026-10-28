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
const TYPES = { ".html": "text/html", ".webp": "image/webp", ".js": "text/javascript", ".css": "text/css" };
const server = http.createServer((req, res) => {
  const p = path.join(root, decodeURIComponent(new URL(req.url, "http://x").pathname).replace(/\/$/, "/index.html"));
  if (!p.startsWith(root) || !fs.existsSync(p)) { res.writeHead(404); return res.end(); }
  res.writeHead(200, { "content-type": TYPES[path.extname(p)] || "application/octet-stream" });
  fs.createReadStream(p).pipe(res);
}).listen(0);
const base = `http://127.0.0.1:${server.address().port}/`;

const VIEWS = [["phone", 390, 844, true], ["tablet", 768, 1024, true], ["desktop", 1440, 900, false]];
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
  const errors = [];
  page.on("console", m => { if (m.type() === "error") errors.push(m.text()); });
  page.on("pageerror", e => errors.push(String(e)));
  await page.goto(base, { waitUntil: "networkidle" });
  await page.waitForTimeout(400);

  const overflow = async () => page.evaluate(() => document.documentElement.scrollWidth - window.innerWidth);
  ok((await overflow()) <= 0, `no horizontal overflow (${await overflow()})`);
  await page.screenshot({ path: `${shots}/${name}-home.png` });
  await page.screenshot({ path: `${shots}/${name}-home-full.png`, fullPage: true });

  // carousel: next button and auto-advance
  const active = () => page.evaluate(() => document.querySelector(".slide.on").id);
  const a0 = await active();
  await page.mouse.move(1, height - 1);
  await page.click("#hNext");
  ok((await active()) !== a0, "carousel advances with next button");
  await page.mouse.move(1, 1); // leave console so hover-pause ends
  await page.evaluate(() => document.activeElement.blur());
  const a1 = await active();
  await page.waitForTimeout(7600);
  ok((await active()) !== a1, "carousel auto-advances");
  await page.focus("#carousel");
  const a2 = await active();
  await page.keyboard.press("ArrowRight");
  ok((await active()) !== a2, "carousel advances with arrow key");

  // detail via card
  for (const id of IDS) {
    await page.locator(`.shelf .cart[data-open="${id}"]`).click();
    await page.waitForTimeout(450);
    ok(await page.evaluate(i => document.querySelector("#detail").open && location.hash === "#" + i, id), `detail opens via card: ${id}`);
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
  await page.locator("#detail [data-shot]").first().scrollIntoViewIfNeeded();
  await page.locator("#detail [data-shot]").first().click();
  await page.waitForTimeout(250);
  ok(await page.evaluate(() => document.querySelector("#lightbox").open), "lightbox opens");
  const c1 = await page.textContent("#lbCount");
  await page.keyboard.press("ArrowRight");
  ok((await page.textContent("#lbCount")) !== c1, "lightbox arrow key advances");
  await page.screenshot({ path: `${shots}/${name}-lightbox.png` });
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.querySelector("#lightbox").open && document.querySelector("#detail").open), "lightbox closes with Esc, detail stays");

  // player
  await page.locator("#detail [data-play-here]").click();
  await page.waitForTimeout(600);
  ok(await page.evaluate(() => document.querySelector("#player").open && document.querySelector("#plFrame").src.includes("jutsu")), "player opens with iframe");
  await page.screenshot({ path: `${shots}/${name}-player.png` });
  // focus trap: tab many times, focus must stay in player
  for (let k = 0; k < 6; k++) await page.keyboard.press("Tab");
  ok(await page.evaluate(() => document.querySelector("#player").contains(document.activeElement)), "focus trapped in player");
  await page.evaluate(() => document.querySelector("#player [data-close]").focus());
  await page.keyboard.press("Escape");
  await page.waitForTimeout(200);
  ok(await page.evaluate(() => !document.querySelector("#player").open && document.querySelector("#plFrame").src === "about:blank"), "player closes with Esc and unloads game");

  ok(errors.length === 0, `no console errors${errors.length ? ": " + errors.join(" | ") : ""}`);
  await ctx.close();
}
await browser.close();
server.close();
console.log(`\n${fails ? fails + " FAILED" : "ALL PASSED"}`);
process.exit(fails ? 1 : 0);
