import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { patchSharedScript } from '../scripts/shared-patches.mjs';

const fixture = `var BaseDefs$5 = { bullet_mp5: { type: "bullet", damage: 11 } };
const ExplosionDefs = { explosion_frag: { type: "explosion", damage: 125 } };
let BaseDefs$3 = { mp5: { name: "MP5", type: "gun", quality: 0 } };
var ThrowableDefs = { frag: { name: "Frag Grenade", type: "throwable", quality: 0 } };
function createBarrel(value) { return value; }
var MapObstacleDefs = { barrel_01: createBarrel({}), barrel_01b: createBarrel({img: {tint: 123}}) };
`;

test('only inserts five global assignments; preserves all other bytes and object identity', () => {
  for (const source of [fixture, fixture.replaceAll('\n', '\r\n').replaceAll(' = ', '=')]) {
    const { code, applied } = patchSharedScript(source);
    assert.deepEqual(applied, ['bullets', 'explosions', 'guns', 'throwable', 'objects']);
    assert.equal(code.replace(/window\.(bullets|explosions|guns|throwable|objects) = /g, ''), source);
    const context = vm.createContext({ window: {} });
    vm.runInContext(code, context);
    assert.ok(vm.runInContext('window.bullets === BaseDefs$5 && window.explosions === ExplosionDefs && window.guns === BaseDefs$3 && window.throwable === ThrowableDefs && window.objects === MapObstacleDefs', context));
    vm.runInContext('window.guns.mp5.quality = 9', context);
    assert.equal(vm.runInContext('BaseDefs$3.mp5.quality', context), 9);
  }
});

test('missing, duplicate and already patched declarations stop publication', () => {
  assert.throws(() => patchSharedScript(fixture.replace('"bullet"', '"changed"')), /bullets.*found 0/);
  assert.throws(() => patchSharedScript(fixture + fixture), /bullets.*found 2/);
  assert.throws(() => patchSharedScript(patchSharedScript(fixture).code), /already exposes/);
});
