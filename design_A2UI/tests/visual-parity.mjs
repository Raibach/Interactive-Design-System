/**
 * THE DESIGN A2UI RENDERED PARITY CHECK.
 *
 * It opens the built application, signs in, screenshots the current Design seat and the Design
 * A2UI seat at the same viewport, masks the regions whose content is data or state (the top tab
 * labels, the readout, the conversation list and thread, the console card grid), and compares the
 * furniture that remains. The diff image and the counts are written beside this script.
 *
 * Run from frontend/:  npm run parity:design2
 * The app must be serving at BASE_URL (default http://localhost:4173).
 */
import { chromium } from 'playwright';
import pixelmatch from 'pixelmatch';
import pkg from 'pngjs';
const { PNG } = pkg;
import { mkdir, writeFile } from 'node:fs/promises';
import { dirname, join } from 'node:path';
import { fileURLToPath } from 'node:url';

const BASE_URL = process.env.BASE_URL || 'http://localhost:4173';
const OUT = dirname(fileURLToPath(import.meta.url));
const PARITY_DIR = join(OUT, 'parity');
const TOLERANCE = 0; // any non-masked pixel difference is a defect

/**
 * THE MASK LIST IS FROZEN. Each region is justified by name:
 *   - the top tab labels and active state (the two tabs' names differ);
 *   - the readout (timestamps and usage);
 *   - the conversation list and thread (data);
 *   - the console card grid (data).
 * Any non-masked pixel difference is a defect. Never add a mask to reach zero.
 */
const masksFor = async (page) => {
  const selectors = [
    '[data-lit-id^="nav-tab-"]',
    'output-header, design2-output-header',
    'design-chat-header, design2-chat-header',
    'design-chat-messages, design2-chat-messages',
    'a2ui-console-card-grid',
  ];
  const masks = [];
  for (const selector of selectors) {
    masks.push(...(await page.locator(selector).all()));
  }
  return masks;
};

const shot = async (page, path) => {
  const masks = await masksFor(page);
  const buffer = await page.screenshot({ mask: masks });
  await writeFile(path, buffer);
  return buffer;
};

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
try {
  await page.goto(BASE_URL);
  await page.waitForLoadState('domcontentloaded');
  await page.waitForTimeout(1200);
  const pin = page.getByRole('textbox', { name: 'PIN code' });
  if ((await pin.count()) !== 1) throw new Error('the PIN field is not unique');
  await pin.fill('7377');
  await page.getByRole('button', { name: 'Sign in' }).click();
  await page.waitForTimeout(5000);

  const design = page.getByRole('button', { name: /^Design$/ });
  if ((await design.count()) !== 1) throw new Error('the Design tab is not unique');
  await design.click();
  await page.waitForTimeout(4500);
  const designShot = await shot(page, join(PARITY_DIR, 'design.png'));

  const design2 = page.getByRole('button', { name: /^Design A2UI$/ });
  if ((await design2.count()) !== 1) throw new Error('the Design A2UI tab is not unique');
  await design2.click();
  await page.waitForTimeout(4500);
  const design2Shot = await shot(page, join(PARITY_DIR, 'design-a2ui.png'));

  const a = PNG.sync.read(designShot);
  const b = PNG.sync.read(design2Shot);
  if (a.width !== b.width || a.height !== b.height) {
    throw new Error(`the screenshots differ in size: ${a.width}x${a.height} vs ${b.width}x${b.height}`);
  }
  const diff = new PNG({ width: a.width, height: a.height });
  const mismatched = pixelmatch(a.data, b.data, diff.data, a.width, a.height, { threshold: 0.1 });
  await writeFile(join(PARITY_DIR, 'diff.png'), PNG.sync.write(diff));
  const ratio = mismatched / (a.width * a.height);
  console.log(`Design A2UI parity: ${mismatched} pixels differ (${(ratio * 100).toFixed(4)}%)`);
  console.log(`images: ${join(PARITY_DIR, 'design.png')}, ${join(PARITY_DIR, 'design-a2ui.png')}`);
  console.log(`diff:   ${join(PARITY_DIR, 'diff.png')}`);
  if (ratio > TOLERANCE) {
    console.error(`PARITY FAILED: ${(ratio * 100).toFixed(4)}% > ${(TOLERANCE * 100).toFixed(4)}%`);
    process.exitCode = 1;
  } else {
    console.log('PARITY PASSED');
  }
} finally {
  await browser.close();
}
