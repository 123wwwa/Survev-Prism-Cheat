import test from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { validateConfig, githubSlug, cdnUrl, matchesBuild, validateArtifact, sha256, selectGameEntry, selectSharedChunk, restoreChunkHashes } from '../scripts/lib.mjs';

const config = JSON.parse(await readFile(new URL('../pipeline.config.json', import.meta.url)));
test('publish destination is restricted to a dedicated branch and a simple JS filename', () => {
  assert.equal(validateConfig(config), config);
  assert.throws(() => validateConfig({ ...config, publishBranch: 'main' }));
  assert.throws(() => validateConfig({ ...config, fileNames: { app: '../private.js', shared: 'shared.js' } }));
  assert.throws(() => validateConfig({ ...config, fileNames: { app: 'app.js', shared: 'app.js' } }));
  assert.throws(() => validateConfig({ ...config, publishRepository: 'https://user:secret@github.com/a/b' }));
  assert.throws(() => validateConfig({ ...config, upstreamBranch: '--upload-pack=evil' }));
});
test('unchanged source skips only when the build configuration also matches', () => {
  const manifest = { upstreamCommit: 'abc', inputHash: 'config-v1' };
  assert.ok(matchesBuild(manifest, 'abc', 'config-v1'));
  assert.ok(!matchesBuild(manifest, 'new-commit', 'config-v1'));
  assert.ok(!matchesBuild(manifest, 'abc', 'config-v2'));
  assert.ok(!matchesBuild(null, 'abc', 'config-v1'));
});
test('empty or oversized JS is rejected before publication', () => {
  assert.throws(() => validateArtifact(Buffer.alloc(0)), /Empty/);
  assert.throws(() => validateArtifact({ length: 20_000_001 }), /20 MB/);
  validateArtifact(Buffer.from('const player = 1;'));
});
test('CDN links preserve file extension and distinguish latest from immutable version', () => {
  assert.equal(githubSlug(config.publishRepository), '123wwwa/survev-injector');
  assert.equal(cdnUrl(config, 'abc123'), 'https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@abc123/app.js');
  assert.equal(cdnUrl(config, 'abc123', config.fileNames.shared), 'https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@abc123/shared.js');
  assert.match(cdnUrl(config, 'cdn', 'manifest.json'), /@cdn\/manifest\.json$/);
});
test('artifact integrity changes when any byte changes', () => {
  assert.equal(sha256('abc'), 'ba7816bf8f01cfea414140de5dae2223b00361a396177a9cb410ff61f20015ad');
  assert.notEqual(sha256('abc'), sha256('abd'));
});
test('publication selects game entry by HTML identity, never by size or hashed filename', () => {
  const game = { isEntry: true, facadeModuleId: 'C:/repo/client/index.html', fileName: 'js/random.js' };
  const stats = { isEntry: true, facadeModuleId: 'C:/repo/client/stats/index.html', fileName: 'js/bigger.js' };
  const common = { isEntry: false, facadeModuleId: null, fileName: 'js/shared.js' };
  assert.equal(selectGameEntry([stats, common, game], 'C:\\repo\\client\\index.html'), game);
  assert.throws(() => selectGameEntry([stats, common], game.facadeModuleId), /exactly one/);
  assert.throws(() => selectGameEntry([game, { ...game }], game.facadeModuleId), /exactly one/);
});
test('readable game imports retain the exact original production dependency filename', () => {
  const before = 'import { a as GameConfig } from "./!~{001}~.js";';
  assert.equal(restoreChunkHashes(before, [{ preliminaryFileName: 'js/!~{001}~.js', fileName: 'js/Cbg9k6wS.js' }]),
    'import { a as GameConfig } from "./Cbg9k6wS.js";');
  assert.throws(() => restoreChunkHashes(before, []), /Unresolved/);
  assert.throws(() => restoreChunkHashes(before, [{ preliminaryFileName: 'js/!~{001}~.js', fileName: 'renamed/shared.js' }]), /naming pattern/);
});
test('shared selection follows the game dependency and module identity, excluding runtime and stats', () => {
  const shared = { isEntry: false, fileName: 'js/new-hash.js', moduleIds: ['C:\\repo\\shared\\gameConfig.ts'] };
  const runtime = { isEntry: false, fileName: 'js/runtime.js', moduleIds: ['\0rolldown/runtime.js'] };
  const game = { imports: [shared.fileName, runtime.fileName] };
  const stats = { ...shared, isEntry: true, fileName: 'stats.js' };
  assert.equal(selectSharedChunk([runtime, stats, shared], game, 'C:/repo'), shared);
  assert.throws(() => selectSharedChunk([runtime, stats], game, 'C:/repo'), /exactly one/);
  assert.throws(() => selectSharedChunk([shared, { ...shared }], game, 'C:/repo'), /exactly one/);
});
