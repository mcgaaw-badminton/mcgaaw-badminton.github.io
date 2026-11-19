// HTML -> PDF with headless Chrome/Edge. Usage: node render_pdf.mjs <in.html> <out.pdf> [out.png]  (png = first page at 2x, for chat apps)
// Browser: env BROWSER_PATH, else installed Chrome, else installed Edge (Windows paths).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , input, output, png] = process.argv;
if (!input || !output) { console.error('[ERROR] usage: node render_pdf.mjs <in.html> <out.pdf>'); process.exit(1); }

const candidates = [
  process.env.BROWSER_PATH,
  'C:/Program Files/Google/Chrome/Application/chrome.exe',
  'C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe',
  '/opt/pw-browsers/chromium',
].filter(Boolean);
const executablePath = candidates.find((p) => existsSync(p));

const browser = await chromium.launch(executablePath ? { executablePath } : {});
const page = await browser.newPage();
await page.goto(pathToFileURL(input).href);
await page.evaluate(() => document.fonts.ready);
await page.pdf({ path: output, preferCSSPageSize: true, printBackground: true });
if (png) {
  const shot = await browser.newPage({ viewport: { width: 1123, height: 794 }, deviceScaleFactor: 2 });
  await shot.goto(pathToFileURL(input).href);
  await shot.evaluate(() => document.fonts.ready);
  await shot.screenshot({ path: png, clip: { x: 0, y: 0, width: 1123, height: 794 } });
}
await browser.close();
