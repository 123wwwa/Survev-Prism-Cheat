import { parse as parseHtml } from 'parse5';
import { parse as parseJs } from 'acorn';

export function findAppURL(html, pageURL) {
    const scripts = [];
    let base;
    function visit(node) {
        const attrs = Object.fromEntries((node.attrs ?? []).map(attr => [attr.name, attr.value]));
        if (node.tagName === 'base' && attrs.href !== undefined && base === undefined) base = new URL(attrs.href, pageURL).href;
        if (node.tagName === 'script' && attrs.type?.trim().toLowerCase() === 'module' && attrs.src) scripts.push(attrs.src);
        for (const child of node.childNodes ?? []) visit(child);
    }
    visit(parseHtml(html));
    if (scripts.length !== 1) throw new Error(`Expected one original app module, found ${scripts.length}`);
    return new URL(scripts[0], base ?? pageURL).href;
}

function hasProxyMethod(source) {
    let found = false;
    function visit(node) {
        if (!node?.type) return;
        if ((node.type === 'Property' || node.type === 'MethodDefinition') &&
            (node.key.name ?? node.key.value) === 'getProxyDef' && (node.method || node.type === 'MethodDefinition')) found = true;
        for (const value of Object.values(node)) {
            if (Array.isArray(value)) value.forEach(visit);
            else if (value?.type) visit(value);
        }
    }
    visit(parseJs(source, { ecmaVersion: 'latest', sourceType: 'module' }));
    return found;
}

export async function discoverScripts(pageURL = 'https://survev.io/', fetcher = fetch) {
    const origin = new URL(pageURL).origin;
    async function download(url) {
        if (new URL(url).origin !== origin) throw new Error(`Unexpected cross-origin upstream script: ${url}`);
        const response = await fetcher(url, { signal: AbortSignal.timeout(30000), cache: 'no-store' });
        if (!response.ok) throw new Error(`Upstream lookup failed: HTTP ${response.status} (${url})`);
        if (response.url && new URL(response.url).origin !== origin) throw new Error('Unexpected upstream redirect');
        const text = await response.text();
        if (!text.trim()) throw new Error(`Empty upstream response: ${url}`);
        return text;
    }
    const appURL = findAppURL(await download(pageURL), pageURL);
    const app = parseJs(await download(appURL), { ecmaVersion: 'latest', sourceType: 'module' });
    const imports = app.body.filter(node => node.type === 'ImportDeclaration').map(node => new URL(node.source.value, appURL).href);
    if (imports.length !== 2) throw new Error(`Expected runtime/shared app dependencies, found ${imports.length}`);
    const candidates = await Promise.all(imports.map(async url => ({ url, shared: hasProxyMethod(await download(url)) })));
    const shared = candidates.filter(candidate => candidate.shared);
    if (shared.length !== 1) throw new Error(`Expected one shared module with getProxyDef, found ${shared.length}`);
    if (shared[0].url !== imports[1]) throw new Error('App import order changed; review userscript runtime/shared mapping');
    const selectors = [appURL, shared[0].url].map(url => {
        const name = new URL(url).pathname.split('/').pop();
        if (!/^[\w-]+\.js$/.test(name) || new URL(url).search) throw new Error(`Unsupported script filename: ${url}`);
        return `*${name}`;
    });
    if (new Set(selectors).size !== 2) throw new Error('App/shared filenames must be distinct');
    return { pageURL, appURL, sharedURL: shared[0].url, selectors, checkedAt: new Date().toISOString() };
}

export function renderMetadata(template, discovery) {
    const token = '// @upstream-webRequest';
    if (template.split(token).length !== 2) throw new Error('Expected one generated webRequest marker');
    return template.replace(token, discovery.selectors.map(selector =>
        `// @webRequest   ${JSON.stringify([{ selector, action: 'cancel' }])}`).join('\n'));
}
