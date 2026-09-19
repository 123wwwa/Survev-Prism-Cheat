import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFile } from 'node:fs/promises';
import { extractServers, transferServers, moduleImports, rewriteImports } from '../src/serverTransfer.js';

const original = 'getRegionList(){let e=[];for(let t=0;t<5;t++){let n=[' +
    ['na', 'eu', 'ru', 'asia', 'sa'].map(region => '{region:`' + region + '`,zone:`' + region + '`,url:`' + region + '.example.test:8001`,https:!0}').join(',') +
    '][t].region;e.includes(n)||e.push(n)}return e}';
const injected = `const before = 1;
//#region src/pingTest.ts
class PingTest {
 tests = [].map((config) => ({ ...config, ping: 9999 }));
 getRegionList() {
  const regions = [];
  for (let i=0; i<0; i++) { const region = [][i].region; if (!regions.includes(region)) regions.push(region); }
  return regions;
 }
}
//#endregion
const after = 2;`;

test('extracts the five original server literals without evaluating app code', () => {
    const servers = extractServers(original);
    assert.deepEqual(servers.map(s => s.region), ['na', 'eu', 'ru', 'asia', 'sa']);
    assert.ok(servers.every(s => s.https && s.url.endsWith(':8001')));
    for (const quote of ['"', "'"]) {
        assert.equal(extractServers(original.replaceAll('`', quote).replaceAll('!0', 'false'))[0].https, false);
    }
    assert.throws(() => extractServers(original.replace('na.example.test:8001', '${danger()}')), /server array|static strings/);
    assert.throws(() => extractServers(original.replace('https:!0', 'https:danger()')), /Unsupported/);
    assert.throws(() => extractServers(original + original), /expected one match/);
    assert.throws(() => extractServers('getRegionList(){return regions}'), /server array/);
});

test('updates ping targets, region selection and global servers together', () => {
    const { code, servers } = transferServers(original, injected);
    const context = vm.createContext({ window: {} });
    vm.runInContext(code + ';window.ping = new PingTest(); window.regions = window.ping.getRegionList();', context);
    assert.deepEqual(JSON.parse(JSON.stringify(context.window.servers)), servers);
    assert.equal(context.window.ping.tests.length, 5);
    assert.equal(context.window.regions.join(','), 'na,eu,ru,asia,sa');
    context.window.servers.push({ ...context.window.servers[0] });
    assert.equal(context.window.ping.getRegionList().length, 5);
    assert.ok(code.startsWith('const before = 1;'));
    assert.ok(code.endsWith('const after = 2;'));
    assert.throws(() => transferServers(original, code), /empty ping-test list/);
    assert.throws(() => transferServers(original, injected.replace('tests = []', 'tests = other')), /empty ping-test list/);
});

test('rewrites both adjacent minified imports and resolves shared to a blob', () => {
    const source = 'import{a as b}from"./runtime.js";import{X as Y}from"./shared.js";const untouched=1;';
    assert.equal(moduleImports(source).length, 2);
    const output = rewriteImports(source, ['http://localhost:8000/runtime.js', 'blob:http://localhost/shared']);
    assert.deepEqual(moduleImports(output).map(m => m[2]), ['http://localhost:8000/runtime.js', 'blob:http://localhost/shared']);
    assert.ok(output.endsWith('const untouched=1;'));
    assert.throws(() => rewriteImports(source, ['one']), /Unexpected import layout/);
});

test('server transfer works with the current real app artifact', async () => {
    const app = await readFile(new URL('../../dist/app.js', import.meta.url), 'utf8');
    const { code } = transferServers(original, app);
    assert.deepEqual(moduleImports(code).map(m => m[0]), moduleImports(app).map(m => m[0]));
    assert.ok(code.includes('window.servers = [{"region":"na"'));
    assert.ok(code.includes('window.initGameControls'));
});

test('import rewriting ignores documentation, strings, templates and dynamic imports', () => {
    const source = `/* import { Color } from 'pixi.js'; */
import { a } /* from 'misleading' */ from './runtime.js';
// import { Sprite } from 'pixi.js';
const example = "import { Fake } from 'fake';";
const template = \`import { Fake } from 'fake';\`;
const lazy = () => import('./lazy.js');`;
    const imports = moduleImports(source);
    assert.equal(imports.length, 1);
    const rewritten = rewriteImports(source, ['https://example.test/runtime.js']);
    assert.equal(rewritten, source.replace("'./runtime.js'", '"https://example.test/runtime.js"'));
});

test('unminified shared has one actual import despite PixiJS documentation examples', async () => {
    const shared = await readFile(new URL('../../dist/shared.js', import.meta.url), 'utf8');
    assert.equal(moduleImports(shared).length, 1);
    const rewritten = rewriteImports(shared, ['https://example.test/runtime.js']);
    assert.equal(moduleImports(rewritten)[0][2], 'https://example.test/runtime.js');
});
