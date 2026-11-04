import fs from 'node:fs';
import vm from 'node:vm';
import assert from 'node:assert/strict';

// Generate the initial HTML from the same public renderers used in the browser.
// No content copy or third-party runtime is maintained by this build step.
// Run again after editing dist/home.js, dist/app.js, dist/data.js or icons.js.
const root = new URL('../', import.meta.url);
const indexUrl = new URL('dist/index.html', root);
const source = fs.readFileSync(indexUrl, 'utf8');
const mainPattern = /(<main\b[^>]*\bid="main"[^>]*>)[\s\S]*?(<\/main>)/;
assert.match(source, mainPattern, 'The public page must contain one #main landmark.');
assert.match(source, /<meta name="robots" content="noindex, nofollow">/, 'Keep the preview unindexed.');
const schemaBefore = source.match(/<script id="site-schema"[\s\S]*?<\/script>/)?.[0];
assert.ok(schemaBefore, 'Keep the static preview schema.');

const nodes = new Map();
function node() {
  const attributes = new Map();
  return {
    innerHTML: '', textContent: '', innerText: '', href: '', open: false,
    dataset: {}, style: {}, classList: { add() {}, remove() {}, toggle() {} },
    setAttribute(name, value) { attributes.set(name, String(value)); },
    getAttribute(name) { return attributes.get(name) ?? null; },
    hasAttribute(name) { return attributes.has(name); },
    removeAttribute(name) { attributes.delete(name); },
    focus() {}, scrollIntoView() {}, addEventListener() {},
    querySelector() { return null; }, querySelectorAll() { return []; }
  };
}
const document = {
  body: node(), documentElement: node(), title: '', activeElement: null,
  addEventListener() {}, querySelectorAll() { return []; },
  querySelector(selector) {
    if (selector === '#main h1') {
      const heading = nodes.get('#main')?.innerHTML.match(/<h1\b[^>]*>([\s\S]*?)<\/h1>/)?.[1];
      return heading ? { textContent: heading.replace(/<[^>]*>/g, ' ') } : null;
    }
    if (!nodes.has(selector)) nodes.set(selector, node());
    return nodes.get(selector);
  },
  getElementById(id) { return this.querySelector('#' + id); }
};
document.body.dataset.theme = 'vivo';
const context = {
  console, document, URLSearchParams, Map,
  location: { hash: '#/inicio', search: '', href: 'https://acheiquem.pages.dev/' },
  localStorage: { getItem() { return null; }, setItem() {} },
  setTimeout() { return 1; }, clearTimeout() {},
  requestAnimationFrame() { return 1; }
};
context.window = {
  document, location: context.location, localStorage: context.localStorage,
  addEventListener() {}, scrollTo() {}, matchMedia() { return { matches: false }; },
  requestAnimationFrame: context.requestAnimationFrame
};
vm.createContext(context);
for (const file of ['icons.js', 'data.js', 'home.js', 'seo.js', 'app.js']) {
  vm.runInContext(fs.readFileSync(new URL('dist/' + file, root), 'utf8'), context, {
    filename: file, timeout: 2000
  });
}
const html = nodes.get('#main')?.innerHTML;
assert.ok(html && html.length > 1000, 'The live home renderer must produce meaningful initial HTML.');
assert.equal((html.match(/<h1\b/g) || []).length, 1, 'The homepage must have one main heading.');
assert.match(html, /Perfil ilustrativo/, 'Illustrative profiles must remain identified.');
assert.match(html, /home-page--vivo/, 'Prerender only the approved Bora resolver homepage.');
assert.doesNotMatch(html, /<script\b/i, 'Generated home HTML must not introduce executable scripts.');
const output = source.replace(mainPattern, (_, start, end) =>
  `${start}\n    <!-- Gerado por scripts/prerender-home.mjs; a fonte de conteúdo está nos renderizadores públicos. -->\n    ${html}\n  ${end}`);
assert.equal(output.match(/<script id="site-schema"[\s\S]*?<\/script>/)?.[0], schemaBefore,
  'Prerender must preserve the reviewed WebSite/WebPage graph exactly.');
if (process.argv.includes('--check')) {
  assert.equal(source, output, 'Initial homepage HTML is stale. Run node scripts/prerender-home.mjs.');
  console.log('OK initial homepage HTML matches the public renderers; preview restrictions and schema preserved.');
} else {
  fs.writeFileSync(indexUrl, output, 'utf8');
  console.log(`Initial homepage HTML generated from public renderers (${Buffer.byteLength(html)} bytes).`);
}
