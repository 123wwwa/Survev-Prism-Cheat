import { validateMatches } from '../../scripts/patch-validation.mjs';
export function transferProxy(originalShared, injectedShared) {
    const matches = [...originalShared.matchAll(/getProxyDef\(\)\s*\{\s*for\s*\(\s*(?:let|const|var)\s+[$\w]+\s+in\s*(\{(?:\s*(?:"[^"\\]+"|'[^'\\]+'|`[^`\\]+`|[\w]+)\s*:\s*\{[^{}]*\}\s*,?)+\})\s*\)/g)];
    validateMatches(matches, { name: 'Original proxy settings', expectedMatches: 1, hint: 'missing or ambiguous' });
    const defs = Object.create(null);
    for (const entry of matches[0][1].matchAll(/("[^"\\]+"|'[^'\\]+'|`[^`\\]+`|[\w]+)\s*:\s*\{([^{}]*)\}/g)) {
        const key = /^["'`]/.test(entry[1]) ? entry[1].slice(1, -1) : entry[1];
        if (!/^[\w.-]+$/.test(key) || Object.hasOwn(defs, key)) throw new Error('Invalid proxy hostname');
        const def = Object.create(null);
        const field = /\s*(apiUrl|google|discord|mock|all)\s*:\s*(?:(["'`])(https?:\/\/[^"'`\\\s]+)\2|(!\s*[01]|true|false))\s*(?:,|$)/gy;
        let offset = 0;
        while (entry[2].slice(offset).trim()) {
            field.lastIndex = offset;
            const value = field.exec(entry[2]);
            if (!value || Object.hasOwn(def, value[1])) throw new Error('Unsupported proxy setting');
            if (value[1] === 'apiUrl') {
                if (!value[3] || value[3].includes('${')) throw new Error('Invalid proxy API URL');
                const url = new URL(value[3]);
                if (url.username || url.password) throw new Error('Invalid proxy API URL credentials');
                def.apiUrl = value[3];
            } else {
                if (!value[4]) throw new Error('Invalid proxy login flag');
                def[value[1]] = ['!0', 'true'].includes(value[4].replace(/\s/g, ''));
            }
            offset = field.lastIndex;
        }
        defs[key] = def;
    }
    const start = injectedShared.indexOf('//#region src/proxy.ts');
    const end = injectedShared.indexOf('//#endregion', start);
    if (start < 0 || end < 0) throw new Error('Injected proxy module missing');
    let scope = injectedShared.slice(start, end);
    const method = /getProxyDef\(\)\s*\{[\s\S]*?\},(?=\s*loginSupported\()/g;
    validateMatches([...scope.matchAll(method)], { name: 'Injected proxy method', expectedMatches: 1, hint: 'missing or ambiguous' });
    scope = scope.replace(method, () => `getProxyDef() {
        const defs = JSON.parse(${JSON.stringify(JSON.stringify(defs))});
        for (const name in defs) {
            if (window.location.hostname.indexOf(name) !== -1) return {proxy: name, def: defs[name]};
        }
        return defs.default ? {proxy: window.location.hostname, def: defs.default} : null;
    },`);
    return { code: injectedShared.slice(0, start) + scope + injectedShared.slice(end), hosts: Object.keys(defs) };
}
