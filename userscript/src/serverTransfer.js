function exactlyOne(matches, label) {
    if (matches.length !== 1) throw new Error(`${label}: expected one match, found ${matches.length}`);
    return matches[0];
}

// Read literals only: never evaluate code downloaded from the original app.
export function extractServers(source) {
    const methods = [...source.matchAll(/\bgetRegionList\s*\(\s*\)\s*\{[\s\S]*?\breturn\s+[$\w]+\s*;?\s*\}/g)];
    const method = exactlyOne(methods, 'Original getRegionList')[0];
    const array = exactlyOne([...method.matchAll(/\[((?:\s*\{[^{}]*\}\s*,?)+)\]\s*\[\s*[$\w]+\s*\]\s*\.region\b/g)], 'Original server array')[1];
    const servers = [...array.matchAll(/\{([^{}]*)\}/g)].map(match => {
        const server = {};
        const field = /\s*(region|zone|url|https)\s*:\s*(?:"([^"\\]*)"|'([^'\\]*)'|`([^`\\]*)`|(!\s*[01]|true|false))\s*(?:,|$)/gy;
        let offset = 0;
        while (offset < match[1].length && match[1].slice(offset).trim()) {
            field.lastIndex = offset;
            const value = field.exec(match[1]);
            if (!value || Object.hasOwn(server, value[1])) throw new Error('Unsupported or duplicate server field');
            const key = value[1];
            const literal = value[2] ?? value[3] ?? value[4];
            if (key === 'https') {
                if (!value[5]) throw new Error('Server https must be a boolean literal');
                server[key] = ['!0', 'true'].includes(value[5].replace(/\s/g, ''));
            } else {
                if (!literal || literal.includes('${')) throw new Error('Server fields must be nonempty static strings');
                server[key] = literal;
            }
            offset = field.lastIndex;
        }
        if (!['region', 'zone', 'url', 'https'].every(key => Object.hasOwn(server, key))) throw new Error('Incomplete server entry');
        return server;
    });
    if (!servers.length) throw new Error('Original server list is empty');
    return servers;
}

export function transferServers(originalApp, injectedApp) {
    const servers = extractServers(originalApp);
    const begin = injectedApp.indexOf('//#region src/pingTest.ts');
    const end = injectedApp.indexOf('//#endregion', begin);
    if (begin < 0 || end < 0 || injectedApp.indexOf('//#region src/pingTest.ts', begin + 1) >= 0) throw new Error('Injected PingTest module is missing or ambiguous');
    let scope = injectedApp.slice(begin, end);
    const initializer = /\btests\s*=\s*\[\s*\]\s*\.map\(/g;
    exactlyOne([...scope.matchAll(initializer)], 'Injected empty ping-test list');
    const regionList = /\bgetRegionList\s*\(\s*\)\s*\{[\s\S]*?\breturn\s+[$\w]+\s*;?\s*\}/g;
    exactlyOne([...scope.matchAll(regionList)], 'Injected getRegionList');
    scope = scope.replace(initializer, () => `tests = (window.servers = ${JSON.stringify(servers)}).map(`);
    scope = scope.replace(regionList, 'getRegionList() { return [...new Set(window.servers.map(server => server.region))]; }');
    return { code: injectedApp.slice(0, begin) + scope + injectedApp.slice(end), servers };
}

export function moduleImports(source) {
    return [...source.matchAll(/\bimport\s*[$\w*{},\s]+?\s*from\s*(["'])([^"']+)\1\s*;?/g)];
}

// The current build has two app dependencies and one shared runtime dependency.
// Refuse changed chunk layouts rather than redirecting an arbitrary import.
export function rewriteImports(source, urls) {
    const imports = moduleImports(source);
    if (imports.length !== urls.length) throw new Error(`Unexpected import layout: expected ${urls.length}, found ${imports.length}`);
    for (let i = imports.length - 1; i >= 0; i--) {
        const match = imports[i];
        const replacement = match[0].replace(/\bfrom\s*(["'])([^"']+)\1/, () => `from ${JSON.stringify(urls[i])}`);
        source = source.slice(0, match.index) + replacement + source.slice(match.index + match[0].length);
    }
    return source;
}
