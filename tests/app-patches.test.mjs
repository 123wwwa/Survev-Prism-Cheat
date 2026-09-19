import test from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { patchAppScript } from '../scripts/app-patches.mjs';

const fixture = `//#region src/map.ts
function draw(items) { items.sort((a, b) => { return a.zIdx - b.zIdx; }); }
//#endregion
//#region src/objects/player.ts
class Player {
 update() {
  this.position = vec.copy(this.net.position);
  this.direction = vec.copy(this.net.direction);
  this.layer = this.net.layer;
  const mouseY = -100, mouseX = -100;
  this.bodyContainer.rotation = Math.atan2(mouseY - window.innerHeight / 2, mouseX - window.innerWidth / 2);
 }
}
//#endregion
//#region src/ui/pieTimer.ts
var width = 24;
var Timer = class { nested() { return { value: 24 }; } };
//#endregion
//#region src/game.ts
class Game {
 init() {
  this.canvas = this.pixi.renderer.type == Renderer.CANVAS;
  this.touch = new Touch(this.input, this.config);
 }
 join(message) { message.isMobile = device.mobile || window.mobile; }
 send(inputMsg) {
  this.sendMsg(MsgType.Input, inputMsg, 128);
  this.timeout = 1;
  this.previous = inputMsg;
 }
}
//#endregion
`;

test('seven app patches expose original objects and invoke hooks with correct values', () => {
  const { code, applied } = patchAppScript(fixture);
  assert.equal(applied.length, 7);
  assert.ok(!code.includes('window.servers'));
  const context = vm.createContext({ window: { innerWidth: 100, innerHeight: 100, mobile: true },
    Renderer: { CANVAS: 1 }, MsgType: { Input: 4 }, device: { mobile: false },
    Touch: class {}, vec: { copy: value => ({ ...value }) } });
  vm.runInContext(code + `
    const game = new Game();
    game.pixi = { renderer: { type: 1 } };
    game.input = { mousePos: { x: 70, y: 60 } };
    game.init();
    const message = {}; game.join(message);
    window.mapColorizing = items => { window.sorted = items.map(i => i.zIdx).join(','); };
    draw([{ zIdx: 2 }, { zIdx: 1 }]);
    const replacement = { changed: true };
    window.initGameControls = msg => { window.originalInput = msg; return replacement; };
    game.sendMsg = (type, msg, size) => { window.sent = {type, msg, size}; };
    const original = {}; game.send(original);
    const player = new Player();
    player.net = { position: {x: 4, y: 7}, direction: {x: 1, y: 0}, layer: 0 };
    player.bodyContainer = {}; player.update();
    window.result = [window.game === game, window.basicDataInfo === message,
      window.pieTimerClass === Timer, Timer.name === 'Timer', new Timer().nested().value === 24,
      window.sorted === '1,2', window.sent.msg === replacement, game.previous === replacement,
      window.originalInput === original, window.sent.type === 4, window.sent.size === 128,
      player.position._x === 4, player.position._y === 7,
      player.bodyContainer.rotation === Math.atan2(10,20)];
  `, context);
  assert.ok(context.window.result.every(Boolean));
});

test('app patches reject missing, duplicate, or already patched targets', () => {
  assert.throws(() => patchAppScript(fixture.replace('return a.zIdx - b.zIdx;', 'return 0;')), /Map colorizing.*found 0/);
  assert.throws(() => patchAppScript(fixture.replace('function draw(items)', 'items.sort((a,b) => { return a.zIdx - b.zIdx; });\nfunction draw(items)')), /Map colorizing.*found 2/);
  assert.throws(() => patchAppScript(patchAppScript(fixture).code), /already applied/);
  assert.throws(() => patchAppScript(fixture.replace('new Touch', 'new Other')), /game input property/);
});

test('patches track changed obfuscated properties, including dollar signs', () => {
  const source = fixture.replaceAll('position', 'p$1').replaceAll('direction', 'd$2').replaceAll('this.net', 'this.n$3').replaceAll('this.input', 'this.i$4');
  const { code } = patchAppScript(source);
  assert.ok(code.includes('this.p$1._x = this.n$3.p$1.x;'));
  assert.ok(code.includes('window.game.i$4.mousePos.y'));
});
