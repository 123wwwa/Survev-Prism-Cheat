import test from 'node:test';
import assert from 'node:assert/strict';
import { discoverScripts, findAppURL, renderMetadata } from '../scripts/discover-scripts.mjs';
const page = 'https://survev.io/';
function fixture(overrides = {}) {
    const responses = {
        [page]: '<!-- <script type="module" src="bad.js"></script> --><script src="analytics.js"></script><script src="./js/new-app.js" type="module"></script>',
        [page + 'js/new-app.js']: 'import {a} from "./runtime.js"; import {b} from "./new-shared.js";',
        [page + 'js/runtime.js']: 'export const a=1;',
        [page + 'js/new-shared.js']: 'export const b={getProxyDef(){return null}};',
        ...overrides,
    };
    return async url => ({ ok: responses[url] !== undefined, status: responses[url] === undefined ? 404 : 200, url, text: async () => responses[url] });
}
test('discovers fresh app/shared names and generates exactly two cancel rules', async () => {
    const found = await discoverScripts(page, fixture());
    assert.deepEqual(found.selectors, ['*new-app.js', '*new-shared.js']);
    const output = renderMetadata('// ==UserScript==\n// @upstream-webRequest\n// ==/UserScript==', found);
    const rules = output.split('\n').filter(line => line.startsWith('// @webRequest')).flatMap(line => JSON.parse(line.replace('// @webRequest', '').trim()));
    assert.deepEqual(rules, found.selectors.map(selector => ({ selector, action: 'cancel' })));
    assert.ok(!output.includes('runtime.js'));
});
test('HTML lookup respects base URL and ignores inert template scripts', () => {
    assert.equal(findAppURL('<base href="/client/"><template><script type="module" src="ignore.js"></script></template><script type="module" src="app.js"></script>', page), page + 'client/app.js');
    assert.throws(() => findAppURL('<html>challenge</html>', page), /found 0/);
    assert.throws(() => findAppURL('<script type="module" src="a.js"></script><script type="module" src="b.js"></script>', page), /found 2/);
});
test('failed fetches, ambiguous dependencies and altered ordering stop generation', async () => {
    await assert.rejects(discoverScripts(page, fixture({ [page + 'js/new-shared.js']: undefined })), /HTTP 404/);
    await assert.rejects(discoverScripts(page, fixture({ [page + 'js/runtime.js']: 'const a={getProxyDef(){}}' })), /found 2/);
    await assert.rejects(discoverScripts(page, fixture({ [page + 'js/new-app.js']: 'import {b} from "./new-shared.js";import {a} from "./runtime.js";' })), /order changed/);
    await assert.rejects(discoverScripts(page, fixture({ [page + 'js/new-app.js']: 'import "https://other.test/a.js";import "./runtime.js";' })), /cross-origin/);
});
