// HTML -> PDF with headless Chrome/Edge. Usage: node render_pdf.mjs <in.html> <out.pdf>
// Browser: env BROWSER_PATH, else installed Chrome, else installed Edge (Windows paths).
import { chromium } from 'playwright-core';
import { existsSync } from 'node:fs';
import { pathToFileURL } from 'node:url';

const [, , input, output] = process.argv;
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
await browser.close();
