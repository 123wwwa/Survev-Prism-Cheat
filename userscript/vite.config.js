import { defineConfig } from 'vite';
import { metadata } from './src/metadata.js';
import banner from 'vite-plugin-banner'
import { discoverScripts, renderMetadata } from './scripts/discover-scripts.mjs';


export default defineConfig(async () => {
    const discovery = await discoverScripts('https://survev.io/');
    console.log('[Upstream scripts] app:', discovery.appURL);
    console.log('[Upstream scripts] shared:', discovery.sharedURL);
    return {
    build: {
        minify: false,
        target: 'esnext',
        rollupOptions: {
          input: {
            main: 'src/init.js'
          },
          output: {
            dir: 'dist',
            entryFileNames: 'injector.user.js',
            format: 'iife',
          },
        },
    },
    plugins: [
        banner({
            verify: false,
            content: renderMetadata(metadata, discovery),
        }),
        {
            name: 'record-upstream-script-urls',
            generateBundle() {
                this.emitFile({ type: 'asset', fileName: 'upstream-scripts.json', source: JSON.stringify(discovery, null, 2) });
            },
        },
    ],
    };
});
