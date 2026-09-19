// node-canvas on Windows cannot open some Unicode filenames through its native
// fopen implementation. Feed identical bytes instead; inherited by atlas workers.
if (process.platform === 'win32' && process.env.SURVEV_SOURCE) {
  const { createRequire } = require('node:module');
  const { resolve } = require('node:path');
  const { readFileSync, existsSync } = require('node:fs');
  const localRequire = createRequire(resolve(process.env.SURVEV_SOURCE, 'client/package.json'));
  const canvas = localRequire('canvas');
  const original = canvas.loadImage;
  canvas.loadImage = function (source, ...args) {
    if (typeof source === 'string' && /[^\x00-\x7f]/.test(source) && existsSync(source)) {
      source = readFileSync(source);
    }
    return original.call(this, source, ...args);
  };
}
