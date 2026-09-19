import { createRequire } from 'node:module';
import { resolve } from 'node:path';
import { pathToFileURL, fileURLToPath } from 'node:url';
import { selectGameEntry } from './lib.mjs';

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
async function flatten(items) {
  return (await Promise.all(items.map(async item => {
    item = await item;
    return Array.isArray(item) ? flatten(item) : item ? [item] : [];
  }))).flat();
}
const plugins = await flatten(config.plugins ?? []);
if (!plugins.some(plugin => plugin.name === 'codefend-plugin')) {
  throw new Error('Upstream obfuscation plugin changed. Review the build adapter before publishing.');
}
await build({
  ...config,
  configFile: false,
  root: client,
  mode: 'production',
  plugins: [
    ...plugins.filter(plugin => plugin.name !== 'codefend-plugin'),
    {
      name: 'select-game-entry',
      generateBundle(_, bundle) {
        const chunks = Object.values(bundle).filter(item => item.type === 'chunk');
        const game = selectGameEntry(chunks, resolve(client, 'index.html'));
        this.emitFile({ type: 'asset', fileName: 'build-report.json', source: JSON.stringify({
          entry: game.fileName,
          imports: game.imports,
          dynamicImports: game.dynamicImports,
          generatedJavaScript: chunks.map(item => item.fileName),
        }, null, 2) });
      },
    },
  ],
  build: {
    ...config.build,
    outDir: outputDirectory,
    emptyOutDir: true,
    minify: false,
    sourcemap: false,
    reportCompressedSize: false,
    license: { fileName: 'THIRD_PARTY_LICENSES.md' },
  },
});
