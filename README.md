# Economic Strategies site

Static six-page site for economicstrategies.net: index, services, about, work, contact and privacy. Plain HTML, one stylesheet (`assets/css/site.css`), one script (`assets/js/site.js`), no build step, no analytics, no cookies.

Hosted on Render as the static site `economicstrategies-net`, deployed from the `main` branch of this repo (`render.yaml`).

## Changing copy

Edit the HTML file for the page, commit, push `main`. Render redeploys automatically. Photos are in `assets/img/` (credits in `CREDITS.md`).

## Contact form

`FORMSPREE_ID` is the single constant at the top of `assets/js/site.js`. While it is empty the form posts nowhere and shows "The contact form is being connected." Put the Formspree form id there to turn it on. Never use the legacy `formspree.io/<email>` action; it silently drops submissions.

## Tests

- `node tests/site.test.js` checks links, anchors, titles, descriptions, alt text, dashes and the form constant. No dependencies.
- `tests/shots.js` drives every page at 1440 and 375 in Playwright and saves screenshots to `tests/shots/`. The repo has no node_modules, so point NODE_PATH at a folder that has playwright:
  `NODE_PATH=<path to node_modules> node tests/shots.js` (local files) or `node tests/shots.js https://economicstrategies-net.onrender.com` (live).
