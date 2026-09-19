import { transferServers, moduleImports, rewriteImports } from './serverTransfer.js';
import { transferAtlases } from './atlasTransfer.js';
import { transferRegions } from './regionTransfer.js';
import { transferProxy } from './proxyTransfer.js';

const injectedSharedUrl = 'https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/shared.js';
const injectedAppUrl = 'https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/app.js';

async function requestScript(url) {
    const response = await GM.xmlHttpRequest({ method: 'GET', url, timeout: 30000 });
    if (response.status < 200 || response.status >= 300 || !response.responseText?.trim()) {
        throw new Error(`Script download failed: HTTP ${response.status} (${url})`);
    }
    return response.responseText;
}

(async () => {
    // The local host page must suppress its original app module before injection.
    // Removing an already executed module cannot undo its side effects.
    const apps = [...document.querySelectorAll('script[type="module"][src]')];
    if (apps.length !== 1) throw new Error(`Expected one original app module, found ${apps.length}`);
    const originalAppURL = apps[0].src;
    const [originalApp, injectedApp, injectedShared] = await Promise.all([
        requestScript(originalAppURL), requestScript(injectedAppUrl), requestScript(injectedSharedUrl),
    ]);
    const originalImports = moduleImports(originalApp);
    if (originalImports.length !== 2) throw new Error('Original app must have runtime and shared imports');
    const originalRuntimeURL = new URL(originalImports[0][2], originalAppURL).href;
    const originalSharedURL = new URL(originalImports[1][2], originalAppURL).href;
    if (originalRuntimeURL === originalSharedURL) throw new Error('Original dependencies are ambiguous');
    const originalShared = await requestScript(originalSharedURL);
    const proxied = transferProxy(originalShared, injectedShared);
    console.info('[ProxyTransfer] Copied original API settings for:', proxied.hosts);

    const transferred = transferServers(originalApp, injectedApp);
    console.info('[ServerTransfer] Copied regions:', transferred.servers.map(server => server.region));
    const regional = transferRegions(originalApp, transferred.code);
    console.info('[RegionTransfer] Copied dropdown regions:', Object.keys(regional.regions));
    const textured = transferAtlases(originalApp, regional.code, document.baseURI);
    console.info('[AtlasTransfer] Copied original atlas metadata and image URLs:', textured.images);

    let sharedBlobURL;
    let appBlobURL;
    try {
        // Runtime helpers are provided by the local original build, not the CDN.
        const sharedContent = rewriteImports(proxied.code, [originalRuntimeURL]);
        sharedBlobURL = URL.createObjectURL(new Blob([sharedContent], { type: 'application/javascript' }));
        const appContent = rewriteImports(textured.code, [originalRuntimeURL, sharedBlobURL]);
        appBlobURL = URL.createObjectURL(new Blob([appContent], { type: 'application/javascript' }));

        const listeners = [];
        const originalAdd = document.addEventListener;
        const intercept = function (type, listener, options) {
            if (type === 'DOMContentLoaded' && document.readyState !== 'loading') listeners.push({ listener, options });
            else originalAdd.call(this, type, listener, options);
        };
        document.addEventListener = intercept;
        try {
            await new Promise((resolve, reject) => {
                const script = document.createElement('script');
                script.type = 'module';
                script.src = appBlobURL;
                script.onload = resolve;
                script.onerror = () => { script.remove(); reject(new Error('Injected module failed to load; inspect browser console')); };
                document.head.append(script);
            });
        } finally {
            if (document.addEventListener === intercept) document.addEventListener = originalAdd;
        }
        const event = new Event('DOMContentLoaded');
        for (const { listener, options } of listeners) {
            if (!listener || options?.signal?.aborted) continue;
            if (typeof listener === 'function') listener.call(document, event);
            else listener.handleEvent(event);
        }
        console.info('[Injector] App and shared loaded with original server settings');
    } finally {
        if (appBlobURL) URL.revokeObjectURL(appBlobURL);
        if (sharedBlobURL) URL.revokeObjectURL(sharedBlobURL);
    }
})().catch(error => console.error('[Injector] Injection stopped:', error));
