import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { transferRegions } from '../src/regionTransfer.js';
import { transferProxy } from '../src/proxyTransfer.js';

const app = await readFile(new URL('../../dist/app.js', import.meta.url), 'utf8');
const shared = await readFile(new URL('../../dist/shared.js', import.meta.url), 'utf8');
const originalRegions = 'for(let e in{na:{https:!0,address:`na.example`,l10n:`index-north-america`},asia:{https:!0,address:`asia.example`,l10n:`index-asia`}}){}';
const originalProxy = 'getProxyDef(){for(let e in{"game.example":{apiUrl:`https://api.example`,google:!0},default:{apiUrl:`https://fallback.example`}}){}}';
function module(source, path) {
    const start = source.indexOf(`//#region src/${path}`);
    return source.slice(start, source.indexOf('//#endregion', start));
}

test('region transfer populates main/team selectors and reports invalid site-info responses', async () => {
    const { code } = transferRegions(originalRegions, app);
    const options = { '#server-opts': [], '#team-server-opts': [] };
    const errors = [];
    const context = vm.createContext({
        import_jquery: { default: selector => ({ append: html => options[selector].push(html) }) },
        api: { resolveUrl: path => `https://api.example${path}` },
        fetch: async () => ({ ok: true, headers: { get: () => 'text/html' }, json: async () => { throw new SyntaxError('HTML'); } }),
        console: { error: (...args) => errors.push(args) },
    });
    vm.runInContext(module(code, 'siteInfo.ts') + ';globalThis.info = new SiteInfo({}, {getLocale:()=>"en", translate:key=>key}); info.load();', context);
    await new Promise(resolve => setImmediate(resolve));
    assert.equal(options['#server-opts'].length, 2);
    assert.deepEqual(options['#server-opts'], options['#team-server-opts']);
    assert.match(options['#server-opts'][1], /value='asia'.*index-asia/);
    assert.equal(context.info.loaded, false);
    assert.equal(errors[0][1], 'https://api.example/api/site_info?language=en');
    assert.match(errors[0][2].message, /Expected JSON.*text\/html/);
    assert.throws(() => transferRegions('', app), /expected one loop/);
    assert.throws(() => transferRegions(originalRegions + originalRegions, app), /expected one loop/);
});

test('proxy transfer preserves host routing, login flags and default behavior', () => {
    const { code } = transferProxy(originalProxy, shared);
    const context = vm.createContext({ window: { location: { hostname: 'game.example' } } });
    vm.runInContext(module(code, 'proxy.ts'), context);
    assert.equal(context.proxy.getProxyDef().def.apiUrl, 'https://api.example');
    assert.equal(context.proxy.loginSupported('google'), true);
    context.window.location.hostname = 'localhost';
    assert.equal(context.proxy.getProxyDef().def.apiUrl, 'https://fallback.example');
    assert.throws(() => transferProxy('', shared), /missing or ambiguous/);
    assert.throws(() => transferProxy(originalProxy.replace('google:!0', 'google:danger()'), shared), /Unsupported/);
});
