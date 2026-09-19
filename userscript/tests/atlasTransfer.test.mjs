import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { transferAtlases } from '../src/atlasTransfer.js';

function atlas(scale, suffix, x) {
    return { loadout: [{ meta: { image: `assets/loadout-${suffix}.webp`, size: { w: 256, h: 256 }, scale },
        frames: { 'sprite.img': { frame: { x, y: 10, w: 20, h: 30 }, rotated: false } } }] };
}
function source(suffix, x, quote = '"') {
    const literal = data => quote === '"' ? JSON.stringify(JSON.stringify(data)) : `${quote}${JSON.stringify(data)}${quote}`;
    return `var high = JSON.parse(${literal(atlas(1, suffix, x))});\nvar low = JSON.parse(${literal(atlas(.5, suffix, x))});`;
}

test('transfers image paths AND matching sprite frames, preserving surrounding code', () => {
    for (const quote of ['"', "'", '`']) {
        const original = source('live', 99, quote);
        const injected = `const before = 1;\n${source('local', 5)}\nconst after = 2;`;
        const { code, images } = transferAtlases(original, injected, 'https://example.test/game/');
        const context = vm.createContext({});
        vm.runInContext(code, context);
        assert.equal(context.high.loadout[0].frames['sprite.img'].frame.x, 99);
        assert.equal(context.low.loadout[0].frames['sprite.img'].frame.x, 99);
        assert.equal(context.high.loadout[0].meta.image, 'https://example.test/game/assets/loadout-live.webp');
        assert.equal(images.length, 2);
        assert.ok(code.startsWith('const before = 1;'));
        assert.ok(code.endsWith('const after = 2;'));
        assert.ok(!code.includes('loadout-local.webp'));
    }
});

test('refuses missing, duplicate, unsupported and executable atlas data', () => {
    const injected = source('local', 0);
    assert.throws(() => transferAtlases('', injected, 'https://example.test/'), /expected one source/);
    assert.throws(() => transferAtlases(injected + injected, injected, 'https://example.test/'), /expected one source/);
    assert.throws(() => transferAtlases(source('live', 1, '`').replace('assets/loadout-live.webp', '${danger()}'), injected, 'https://example.test/'), /interpolation/);
    assert.throws(() => transferAtlases(injected.replaceAll('assets/loadout-local.webp', 'javascript:danger()'), injected, 'https://example.test/'), /Unsupported atlas image URL/);
});
