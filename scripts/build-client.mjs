import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { selectGameEntry, restoreChunkHashes, sha256 } from './lib.mjs';

// Runs in a separate process: upstream config changes are never held in an import cache.
const source = resolve(process.argv[2]);
const outputDirectory = resolve(process.argv[3]);
const client = resolve(source, 'client');
process.env.SURVEV_SOURCE = source;
if (process.platform === 'win32') {
  const preload = fileURLToPath(new URL('./canvas-paths.cjs', import.meta.url)).replaceAll('\\', '/');
  process.env.NODE_OPTIONS = `${process.env.NODE_OPTIONS ?? ''} --require ${JSON.stringify(preload)}`;
  await import('./canvas-paths.cjs');
}
process.chdir(client);
const require = createRequire(resolve(client, 'package.json'));
const { build, loadConfigFromFile } = await import(pathToFileURL(require.resolve('vite')));
const loaded = await loadConfigFromFile(
  { command: 'build', mode: 'production' }, resolve(client, 'vite.config.mts'), client,
);
if (!loaded) throw new Error('Upstream Vite config could not be loaded.');
const config = loaded.config;
let readableGame;
await build({
  ...config,
  configFile: false,
  root: client,
  mode: 'production',
  plugins: [
    ...(config.plugins ?? []),
    {
      name: 'capture-game-before-native-minification',
      enforce: 'post',
      configResolved(resolved) {
        if (resolved.build.minify !== 'oxc') throw new Error('The upstream minifier changed; review the capture adapter.');
      },
      renderChunk: {
        order: 'post',
        handler(code, chunk) {
          if (chunk.isEntry && chunk.facadeModuleId?.replaceAll('\\', '/') === resolve(client, 'index.html').replaceAll('\\', '/')) {
            readableGame = code;
          }
          // Observe only: the original production chunks must remain untouched.
          return null;
        },
      },
      generateBundle: { order: 'post', handler(_, bundle) {
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
        const game = selectGameEntry(chunks, resolve(client, 'index.html'));
        if (!readableGame) throw new Error('The game entry was not captured before minification.');
        const readableFile = 'readable-game.js';
        if (bundle[readableFile]) throw new Error('Readable output filename conflicts with upstream output.');
        this.emitFile({ type: 'asset', fileName: readableFile, source: restoreChunkHashes(readableGame, chunks) });
        this.emitFile({ type: 'asset', fileName: 'build-report.json', source: JSON.stringify({
          entry: game.fileName,
          readableEntry: readableFile,
          imports: game.imports,
          dynamicImports: game.dynamicImports,
          generatedJavaScript: chunks.map(item => item.fileName),
          productionHashes: Object.fromEntries(chunks.map(item => [item.fileName, sha256(item.code)])),
        }, null, 2) });
      } },
    },
  ],
  build: {
    ...config.build,
    outDir: outputDirectory,
    emptyOutDir: true,
    reportCompressedSize: false,
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
  },
});
