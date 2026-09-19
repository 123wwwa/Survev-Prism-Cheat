import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { selectGameEntry, selectSharedChunk, restoreChunkHashes, sha256 } from './lib.mjs';

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
const upstreamPlugins = (await Promise.all(config.plugins ?? [])).flat(Infinity).filter(Boolean);
if (upstreamPlugins.filter(plugin => plugin.name === 'codefend-plugin').length !== 1) {
  throw new Error('Upstream property obfuscator changed; review the readable build configuration.');
}
const captured = new Map();
await build({
  ...config,
  configFile: false,
  root: client,
  mode: 'production',
  plugins: [
    ...upstreamPlugins.filter(plugin => plugin.name !== 'codefend-plugin'),
    {
      name: 'capture-app-and-shared-before-native-minification',
      enforce: 'post',
      configResolved(resolved) {
        if (resolved.build.minify !== false) throw new Error('Readable builds require minify: false.');
        if (resolved.plugins.some(plugin => plugin.name === 'codefend-plugin')) throw new Error('Property obfuscation must be disabled.');
      },
      renderChunk: {
        order: 'post',
        handler(code, chunk) {
          captured.set(chunk.fileName, code);
          // Observe only: the original production chunks must remain untouched.
          return null;
        },
      },
      generateBundle: { order: 'post', handler(_, bundle) {
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
        const game = selectGameEntry(chunks, resolve(client, 'index.html'));
        const shared = selectSharedChunk(chunks, game, source);
        const artifacts = {};
        for (const [name, chunk] of Object.entries({ app: game, shared })) {
          const code = captured.get(chunk.preliminaryFileName);
          if (!code) throw new Error(`${name} was not captured before minification.`);
          const readableFile = `readable-${name}.js`;
          if (bundle[readableFile]) throw new Error('Readable output filename conflicts with upstream output.');
          this.emitFile({ type: 'asset', fileName: readableFile, source: restoreChunkHashes(code, chunks) });
          artifacts[name] = { entry: chunk.fileName, readableEntry: readableFile,
            imports: chunk.imports, dynamicImports: chunk.dynamicImports };
        }
        this.emitFile({ type: 'asset', fileName: 'build-report.json', source: JSON.stringify({
          artifacts,
          minify: false,
          propertyObfuscation: false,
          generatedJavaScript: chunks.map(item => item.fileName),
          productionHashes: Object.fromEntries(chunks.map(item => [item.fileName, sha256(item.code)])),
        }, null, 2) });
      } },
    },
  ],
  build: {
    ...config.build,
    minify: false,
    outDir: outputDirectory,
    emptyOutDir: true,
    reportCompressedSize: false,
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
  },
});
