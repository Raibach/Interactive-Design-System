import { chromium } from 'playwright';
const browser = await chromium.launch({ headless: true });
const context = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await context.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e).slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text().slice(0, 160)); });
const t0 = Date.now();
await page.goto('http://127.0.0.1:5001/', { waitUntil: 'domcontentloaded', timeout: 60000 });
await page.waitForSelector('input[aria-label="PIN code"]', { timeout: 30000 });
await page.fill('input[aria-label="PIN code"]', '7377');
await page.getByRole('button', { name: 'Sign in' }).click();
await page.waitForSelector('#left-column-header', { timeout: 120000 });
const appMs = Date.now() - t0;
const header = page.locator('#left-column-header');
const out = {};
for (const name of ['Console', 'Development', 'Product', 'Governance', 'Design', 'Composer']) {
  await header.getByRole('button', { name, exact: true }).click();
  await page.waitForSelector(`[data-room-box="${name.toLowerCase()}"]`, { timeout: 30000 });
  await page.waitForTimeout(1500);
  out[name] = await page.evaluate((n) => {
    const embed = document.querySelector('builder-embed');
    const frame = embed && embed.shadowRoot ? embed.shadowRoot.querySelector('iframe') : null;
    const cards = document.querySelectorAll('agent-card-element').length;
    return { embed: !!embed, src: embed ? (embed.src ?? embed.getAttribute('src')) : null, iframe: !!frame, cards };
  }, name);
}
console.log(JSON.stringify({ appMs, out, errors: errors.slice(0, 6) }));
await browser.close();
