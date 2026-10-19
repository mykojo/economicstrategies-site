// Playwright page sweep. The repo has no node_modules, so set NODE_PATH to a folder that has playwright.
//   NODE_PATH="<path>/node_modules" node tests/shots.js                  (local files)
//   NODE_PATH="<path>/node_modules" node tests/shots.js https://host     (live URL)
const { chromium } = require('playwright');
const path = require('path');
const fs = require('fs');
const { pathToFileURL } = require('url');

const PAGES = ['index', 'services', 'about', 'work', 'contact', 'privacy'];
const TITLES = {
  index: 'Economic Strategies', services: 'Services', about: 'About',
  work: 'Work', contact: 'Contact', privacy: 'Privacy'
};
const base = process.argv[2];
const root = path.join(__dirname, '..');
const outDir = path.join(__dirname, 'shots', base ? 'live' : 'local');
fs.mkdirSync(outDir, { recursive: true });

function urlFor(p, hash) {
  const file = p === 'index' && base ? '' : p + '.html';
  const u = base ? base.replace(/\/$/, '') + '/' + file : pathToFileURL(path.join(root, p + '.html')).href;
  return u + (hash || '');
}

(async () => {
  const b = await chromium.launch();
  const errs = [];
  const fails = [];
  const check = (cond, msg) => { if (!cond) fails.push(msg); };

  for (const [w, h, name] of [[1440, 900, 'desk'], [375, 812, 'mob']]) {
    const ctx = await b.newContext({ viewport: { width: w, height: h } });
    for (const p of PAGES) {
      const page = await ctx.newPage();
      page.on('console', m => { if (m.type() === 'error') errs.push(`${name} ${p}: ${m.text()}`); });
      page.on('pageerror', e => errs.push(`${name} ${p}: ${e.message}`));
      const resp = await page.goto(urlFor(p), { waitUntil: 'load' });
      if (base) check(resp && resp.status() === 200, `${name} ${p}: HTTP ${resp && resp.status()}`);
      await page.waitForLoadState('networkidle').catch(() => {});
      // lazy images: scroll through so every photo loads before the full-page shot
      await page.evaluate(async () => {
        for (let y = 0; y < document.body.scrollHeight; y += 600) { window.scrollTo(0, y); await new Promise(r => setTimeout(r, 60)); }
        window.scrollTo(0, 0);
      });
      await page.waitForTimeout(400);
      const title = await page.title();
      check(title.startsWith(TITLES[p]), `${name} ${p}: title "${title}"`);
      check(await page.locator('header.nav').count() === 1, `${name} ${p}: shared header`);
      const sw = await page.evaluate(() => document.documentElement.scrollWidth);
      check(sw === w, `${name} ${p}: scrollWidth ${sw} vs viewport ${w}`);
      const broken = await page.evaluate(() => [...document.images].filter(i => i.complete && i.naturalWidth === 0).map(i => i.getAttribute('src')));
      check(broken.length === 0, `${name} ${p}: broken images ${broken.join(',')}`);
      await page.screenshot({ path: path.join(outDir, `${p}-${name}.png`), fullPage: true });
      console.log(name, p, 'scrollWidth', sw);

      if (name === 'mob' && p === 'index') {
        await page.locator('#menuBtn').click();
        check(await page.locator('#menu.open').count() === 1, 'mob: hamburger opens the menu');
        check(await page.locator('#menu a', { hasText: 'Services' }).isVisible(), 'mob: open menu shows Services');
        await page.screenshot({ path: path.join(outDir, 'menu-open-mob.png') });
      }
      await page.close();
    }

    // Read more links land on the named service row
    for (const id of ['strategy', 'property', 'portfolio', 'incentives']) {
      const page = await ctx.newPage();
      page.on('console', m => { if (m.type() === 'error') errs.push(`${name} readmore ${id}: ${m.text()}`); });
      await page.goto(urlFor('index'), { waitUntil: 'load' });
      await page.locator(`a.more[href="services.html#${id}"]`).click();
      await page.waitForLoadState('load');
      await page.waitForTimeout(900);
      check(page.url().endsWith(`services.html#${id}`), `${name}: Read more ${id} url ${page.url()}`);
      const top = await page.evaluate(i => document.getElementById(i).getBoundingClientRect().top, id);
      check(top >= 0 && top < 400, `${name}: Read more ${id} row top ${top}`);
      await page.close();
    }

    // every nav, footer and hero link on index goes to a real page
    {
      const page = await ctx.newPage();
      await page.goto(urlFor('index'), { waitUntil: 'load' });
      const hrefs = await page.evaluate(() => [...new Set([...document.querySelectorAll('a[href]')].map(a => a.getAttribute('href')))].filter(h => !/^(https?:|mailto:|tel:)/.test(h)));
      for (const hr of hrefs) {
        const u = new URL(hr, page.url()).href;
        const r = await ctx.newPage();
        const resp = await r.goto(u, { waitUntil: 'load' });
        if (base) check(resp && resp.status() === 200, `${name}: link ${hr} HTTP ${resp && resp.status()}`);
        else check(await r.locator('header.nav').count() === 1, `${name}: link ${hr} lands on a page`);
        await r.close();
      }
      await page.close();
    }

    // contact form with an empty FORMSPREE_ID: no request leaves, inline message appears
    {
      const page = await ctx.newPage();
      const sent = [];
      page.on('request', r => { if (/formspree/.test(r.url())) sent.push(r.url()); });
      await page.goto(urlFor('contact'), { waitUntil: 'load' });
      await page.fill('#f-name', 'Test Person');
      await page.fill('#f-email', 'test@example.com');
      await page.fill('#f-msg', 'Test message');
      await page.click('button[type=submit]');
      await page.waitForTimeout(400);
      const text = await page.locator('#formMsg').innerText();
      check(text === 'The contact form is being connected. Please use the email address on this page.', `${name}: form message "${text}"`);
      check(sent.length === 0, `${name}: form sent ${sent.length} formspree requests`);
      await page.screenshot({ path: path.join(outDir, `contact-form-${name}.png`) });
      await page.close();
    }
    await ctx.close();
  }

  console.log('console errors', errs.length, errs.slice(0, 8));
  console.log('failures', fails.length, fails.slice(0, 20));
  await b.close();
  process.exit(errs.length || fails.length ? 1 : 0);
})();
