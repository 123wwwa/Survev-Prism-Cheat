import { test } from 'node:test';
import assert from 'node:assert/strict';
import { prepareUserscriptRelease } from '../scripts/userscript-release.mjs';
const config = { publishRepository: 'https://github.com/a/b.git', publishBranch: 'cdn', fileNames: { app: 'app.js', shared: 'shared.js' } };
const code = '// ==UserScript==\n// @version 0.1\n// ==/UserScript==\nconst app="https://cdn.jsdelivr.net/gh/a/b@cdn/app.js";const shared="https://cdn.jsdelivr.net/gh/a/b@cdn/shared.js";';
test('pins both modules, versions changed content only, handles rollback and clock skew', () => {
  const sha = 'a'.repeat(40);
  const first = prepareUserscriptRelease(code, config, sha, null, 1000);
  assert.ok(first.code.includes(`@${sha}/app.js`));
  assert.ok(first.code.includes(`@${sha}/shared.js`));
  assert.ok(!first.code.includes('@cdn/'));
  const same = prepareUserscriptRelease(code.replaceAll('\n','\r\n'), config, sha, first.manifest, 2000);
  assert.equal(same.code, first.code);
  assert.equal(same.unchanged, true);
  const updated = prepareUserscriptRelease(code + '\n// change', config, sha, first.manifest, 900);
  assert.equal(updated.manifest.version, '1001');
  assert.equal(updated.unchanged, false);
  const rollback = prepareUserscriptRelease(code, config, sha, updated.manifest, 900);
  assert.equal(rollback.manifest.version, '1002');
  assert.equal(prepareUserscriptRelease(code, config, 'b'.repeat(40), first.manifest, 1001).unchanged, false);
});
test('rejects invalid commit and missing or ambiguous metadata and URLs', () => {
  assert.throws(() => prepareUserscriptRelease(code, config, 'cdn'));
  for (const broken of [code.replace('@version','@other'), code+'\n// @version 2', code.replace('/app.js','/missing.js'), code+'\n"https://cdn.jsdelivr.net/gh/a/b@cdn/app.js"']) {
    assert.throws(() => prepareUserscriptRelease(broken, config, 'a'.repeat(40)));
  }
});
