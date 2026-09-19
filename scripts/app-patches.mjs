import { findMatches } from './patch-validation.mjs';
const id = String.raw`[$A-Z_a-z][$\w]*`;
const re = pattern => new RegExp(pattern, 'g');
function one(source, pattern, name) {
  const matches = findMatches(source, { name: `App patch ${name}`, pattern, expectedMatches: 1 });
  return matches[0];
}
function section(source, path) {
  const marker = `//#region src/${path}`;
  const start = source.indexOf(marker);
  if (start < 0 || source.indexOf(marker, start + marker.length) >= 0) throw new Error(`App patch: missing or ambiguous module ${path}.`);
  const end = source.indexOf('//#endregion', start);
  if (end < 0) throw new Error(`App patch: missing module boundary ${path}.`);
  return { start, code: source.slice(start, end) };
}

export function patchAppScript(source) {
  if (source.includes('/* survev-injector app patches */')) throw new Error('App patches already applied.');
  const edits = [];
  const missing = [];
  function patch(name, path, from, replacement) {
    try {
      const scope = section(source, path);
      const match = one(scope.code, from, name);
      edits.push({ name, start: scope.start + match.index, end: scope.start + match.index + match[0].length, text: replacement(match) });
    } catch (error) { missing.push(error.message); }
  }
  patch('Map colorizing', 'map.ts', re(String.raw`(${id})\.sort\(\((${id}),\s*(${id})\)\s*=>\s*\{\s*return\s+\2\.zIdx\s*-\s*\3\.zIdx;\s*\}\);`), m => `${m[0]}\nwindow.mapColorizing(${m[1]});`);
  patch('Position without interpolation', 'objects/player.ts', re(String.raw`this\.(${id})\s*=\s*(${id})\.copy\(this\.(${id})\.\1\);(?=\s*this\.(${id})\s*=\s*\2\.copy\(this\.\3\.\4\);\s*this\.layer\s*=)`), m => `${m[0]}\nthis.${m[1]}._x = this.${m[3]}.${m[1]}.x;\nthis.${m[1]}._y = this.${m[3]}.${m[1]}.y;`);
  let input;
  try {
    input = one(section(source, 'game.ts').code, re(String.raw`new Touch\(this\.(${id}),\s*this\.${id}\)`), 'game input property')[1];
  } catch (error) { missing.push(error.message); }
  patch('Mouse position without server delay', 'objects/player.ts', /this\.bodyContainer\.rotation\s*=\s*Math\.atan2\(\s*mouseY\s*-\s*window\.innerHeight\s*\/\s*2\s*,\s*mouseX\s*-\s*window\.innerWidth\s*\/\s*2\s*\)/g,
    () => `this.bodyContainer.rotation = Math.atan2(window.game.${input}.mousePos.y - window.innerHeight / 2, window.game.${input}.mousePos.x - window.innerWidth / 2)`);
  patch('Class definition with methods', 'ui/pieTimer.ts', re(String.raw`var\s+${id}\s*=\s*24;\s*var\s+(${id})\s*=\s*class\s*\{`), m => m[0].replace(/=\s*class\s*\{$/, () => `= window.pieTimerClass = class ${m[1]} {`));
  patch('isMobile (basicDataInfo)', 'game.ts', re(String.raw`(${id})\.isMobile\s*=\s*${id}\.mobile\s*\|\|\s*window\.mobile;`), m => `${m[0]}\nwindow.basicDataInfo = ${m[1]};`);
  patch('GameInitInjection', 'game.ts', re(String.raw`this\.${id}\s*=\s*this\.${id}\.renderer\.type\s*==\s*${id}\.CANVAS;`), m => `${m[0]}\nwindow.game = this;`);
  patch('Override gameControls', 'game.ts', re(String.raw`this\.(${id})\((${id})\.Input,\s*(${id}),\s*128\);\s*this\.(${id})\s*=\s*1;\s*this\.(${id})\s*=\s*\3;`), m => `this._newGameControls = window.initGameControls(${m[3]});\nthis.${m[1]}(${m[2]}.Input, this._newGameControls, 128);\nthis.${m[4]} = 1;\nthis.${m[5]} = this._newGameControls;`);
  if (missing.length) throw new Error(`App patches could not be applied:\n${missing.join('\n')}`);
  let code = source;
  for (const edit of [...edits].sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
  return { code: code + '\n/* survev-injector app patches */\n', applied: edits.map(edit => edit.name) };
}
