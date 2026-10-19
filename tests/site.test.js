// Dependency-free site checks. Run: node tests/site.test.js
const fs = require('fs');
const path = require('path');

const root = path.join(__dirname, '..');
const PAGES = ['index', 'services', 'about', 'work', 'contact', 'privacy'];
const DASH = new RegExp('[\\u2013\\u2014]');
let checks = 0;
const failures = [];
function ok(cond, msg) { checks++; if (!cond) failures.push(msg); }

function walk(dir, out) {
  for (const f of fs.readdirSync(dir, { withFileTypes: true })) {
    if (f.name === '.git' || f.name === 'node_modules' || f.name === 'shots') continue;
    const p = path.join(dir, f.name);
    if (f.isDirectory()) walk(p, out); else out.push(p);
  }
  return out;
}

const htmlFiles = walk(root, []).filter(f => f.endsWith('.html'));
ok(PAGES.every(p => fs.existsSync(path.join(root, p + '.html'))), 'all six pages exist: ' + PAGES.join(', '));

for (const file of htmlFiles) {
  const rel = path.relative(root, file).split(path.sep).join('/');
  const src = fs.readFileSync(file, 'utf8');
  const idsOf = (s) => new Set([...s.matchAll(/\bid="([^"]+)"/g)].map(m => m[1]));

  ok(!/data:/i.test(src.replace(/<script[\s\S]*?<\/script>/g, '')), rel + ': no data: URIs');
  ok(!DASH.test(src), rel + ': no dash characters');
  ok(/^<!doctype html>/i.test(src.trim()), rel + ': doctype');
  ok(/<meta charset="utf-8">/i.test(src), rel + ': charset');
  ok(/<meta name="viewport"/i.test(src), rel + ': viewport');
  ok((src.match(/<title>/g) || []).length === 1, rel + ': exactly one title');
  ok((src.match(/<meta name="description"/g) || []).length === 1, rel + ': exactly one meta description');
  ok(/<link rel="icon"/.test(src), rel + ': favicon link');
  ok(src.includes('Copyright 2014 Economic Strategies'), rel + ': footer copyright');
  ok(!/formspree\.io\/[^f"'\s]/.test(src), rel + ': no legacy formspree.io/<email> action');
  for (const m of src.matchAll(/<img\b[^>]*>/g)) {
    ok(/\balt="/.test(m[0]), rel + ': img has alt: ' + m[0].slice(0, 80));
  }
  ok(!/illustrative/i.test(src), rel + ': no illustrative wording');
  ok(!/Name to follow|Role to follow|class="team"/.test(src), rel + ': no team placeholders');
  ok(!/\{\{/.test(src), rel + ': no raw template tokens');
  ok(/<a[^>]*href="privacy\.html"[^>]*>Privacy<\/a>/.test(src) || rel === 'privacy.html', rel + ': footer Privacy links to privacy.html');

  // every internal href and src resolves; anchors checked against ids in target
  for (const m of src.matchAll(/\b(?:href|src)="([^"]*)"/g)) {
    const v = m[1];
    if (/^(https?:|mailto:|tel:|#$)/.test(v)) continue;
    if (v.startsWith('#')) {
      ok(idsOf(src).has(v.slice(1)), rel + ': anchor ' + v + ' exists in same file');
      continue;
    }
    const [target, hash] = v.split('#');
    const tp = path.join(path.dirname(file), target);
    const exists = fs.existsSync(tp);
    ok(exists, rel + ': link resolves: ' + v);
    if (exists && hash && target.endsWith('.html')) {
      ok(idsOf(fs.readFileSync(tp, 'utf8')).has(hash), rel + ': anchor ' + v + ' exists in target');
    }
  }
}

// four Read more links
const index = fs.existsSync(path.join(root, 'index.html')) ? fs.readFileSync(path.join(root, 'index.html'), 'utf8') : '';
for (const a of ['strategy', 'property', 'portfolio', 'incentives']) {
  ok(index.includes('class="more" href="services.html#' + a + '"'), 'index.html: Read more to services.html#' + a);
}

// contact form + site.js
const siteJs = fs.existsSync(path.join(root, 'assets/js/site.js')) ? fs.readFileSync(path.join(root, 'assets/js/site.js'), 'utf8') : '';
ok(/^const FORMSPREE_ID = '';/m.test(siteJs), 'site.js defines FORMSPREE_ID (empty this session)');
ok(!DASH.test(siteJs), 'site.js: no dash characters');
ok(siteJs.includes('The contact form is being connected. Please use the email address on this page.'), 'site.js carries the empty-id message');
ok(/formspree\.io\/f\//.test(siteJs), 'site.js posts to formspree.io/f/<id>');

// aria-current set statically on each page's own nav item
const navHref = { index: 'index.html', services: 'services.html', about: 'about.html', work: 'work.html', contact: 'contact.html' };
for (const p of Object.keys(navHref)) {
  const f = path.join(root, p + '.html');
  if (!fs.existsSync(f)) { ok(false, p + '.html missing for aria-current check'); continue; }
  const s = fs.readFileSync(f, 'utf8');
  ok(new RegExp('<a href="' + navHref[p] + '" aria-current="page">').test(s), p + '.html: aria-current on own nav item');
  ok((s.match(/aria-current="page"/g) || []).length === 1, p + '.html: exactly one aria-current');
}

// support files
for (const f of ['favicon.svg', 'robots.txt', 'sitemap.xml', 'render.yaml', 'README.md', 'CREDITS.md', 'assets/css/site.css']) {
  ok(fs.existsSync(path.join(root, f)), 'exists: ' + f);
}
const sm = fs.existsSync(path.join(root, 'sitemap.xml')) ? fs.readFileSync(path.join(root, 'sitemap.xml'), 'utf8') : '';
for (const p of PAGES) {
  const u = p === 'index' ? 'https://economicstrategies.net/' : 'https://economicstrategies.net/' + p + '.html';
  ok(sm.includes('<loc>' + u + '</loc>'), 'sitemap lists ' + u);
}
const photos = ['hero', 'joburg', 'capetown', 'boardroom', 'facade', 'build', 'workers', 'towers', 'office', 'dusk', 'maps', 'interior'];
for (const k of photos) ok(fs.existsSync(path.join(root, 'assets/img/' + k + '.jpg')), 'photo ' + k + '.jpg');

if (failures.length) {
  console.error('FAIL ' + failures.length + ' of ' + checks + ' checks');
  failures.slice(0, 40).forEach(f => console.error(' - ' + f));
  process.exit(1);
}
console.log('OK ' + checks + ' checks green');
