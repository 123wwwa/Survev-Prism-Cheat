import { defineConfig } from 'vite';
import { metadata } from './src/metadata.js';
import banner from 'vite-plugin-banner'
import { discoverScripts, renderMetadata } from './scripts/discover-scripts.mjs';
import { loadConfig, updateMetadata } from '../scripts/config.mjs';
import { cdnUrl } from '../scripts/lib.mjs';
import { fileURLToPath } from 'node:url';


export default defineConfig(async () => {
    const config = await loadConfig(fileURLToPath(new URL('../', import.meta.url)));
    const discovery = await discoverScripts('https://survev.io/');
    console.log('[Upstream scripts] app:', discovery.appURL);
    console.log('[Upstream scripts] shared:', discovery.sharedURL);
    return {
    define: {
        __INJECTOR_PROJECT_URL__: JSON.stringify(config.publishRepository.replace(/\.git$/,'')),
        __INJECTOR_INSTALL_URL__: JSON.stringify(config.userscript.greasyForkScriptId ? `https://greasyfork.org/scripts/${config.userscript.greasyForkScriptId}` : config.publishRepository.replace(/\.git$/,'')+'#readme'),
        __INJECTOR_APP_URL__: JSON.stringify(cdnUrl(config,config.publishBranch,config.fileNames.app)),
        __INJECTOR_SHARED_URL__: JSON.stringify(cdnUrl(config,config.publishBranch,config.fileNames.shared)),
    },
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
            content: renderMetadata(updateMetadata(metadata, config), discovery),
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
