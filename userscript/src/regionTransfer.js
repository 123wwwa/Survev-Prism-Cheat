import { validateMatches } from '../../scripts/patch-validation.mjs';
export function transferRegions(originalApp, injectedApp) {
    const candidates = [...originalApp.matchAll(/for\s*\(\s*(?:const|let|var)\s+[$\w]+\s+in\s*(\{(?:\s*[$\w]+\s*:\s*\{[^{}]*\}\s*,?)+\})\s*\)/g)]
        .filter(match => match[1].includes('l10n'));
    validateMatches(candidates, { name: 'Original region settings', expectedMatches: 1, hint: 'expected one loop' });
    const regions = Object.create(null);
    for (const match of candidates[0][1].matchAll(/([$\w]+)\s*:\s*\{([^{}]*)\}/g)) {
        const labels = [...match[2].matchAll(/\bl10n\s*:\s*(["'`])([\w-]+)\1/g)];
        if (labels.length !== 1 || Object.hasOwn(regions, match[1])) throw new Error('Invalid or duplicate region label');
        regions[match[1]] = { l10n: labels[0][2] };
    }
    if (!Object.keys(regions).length) throw new Error('Original region settings are empty');
    const start = injectedApp.indexOf('//#region src/siteInfo.ts');
    const end = injectedApp.indexOf('//#endregion', start);
    if (start < 0 || end < 0) throw new Error('Injected SiteInfo module not found');
    let scope = injectedApp.slice(start, end);
    const loop = /for\s*\(const\s+([$\w]+)\s+in\s*\{\}\)\s*\{\s*const\s+([$\w]+)\s*=\s*\{\}\[\1\];/g;
    validateMatches([...scope.matchAll(loop)], { name: 'Injected empty region settings', expectedMatches: 1 });
    const json = JSON.stringify(regions);
    scope = scope.replace(loop, (_, region, data) => `for (const ${region} in ${json}) {\nconst ${data} = ${json}[${region}];`);
    // Report the URL/status when site_info returns HTML or an HTTP error. Keep
    // loaded=false on failure instead of pretending a missing response succeeded.
    const request = /fetch\(([$\w]+)\)\.then\(\(([$\w]+)\) => \2\.json\(\)\)/g;
    const matches = [...scope.matchAll(request)];
    validateMatches(matches, { name: 'SiteInfo request', expectedMatches: 1 });
    const url = matches[0][1];
    scope = scope.replace(request, () => `fetch(${url}).then(async (response) => {
        if (!response.ok) throw new Error('HTTP ' + response.status);
        try { return await response.json(); }
        catch { throw new Error('Expected JSON; received ' + (response.headers.get('content-type') || 'unknown content type')); }
    })`);
    const completion = /this\.updatePageFromInfo\(\);\s*\}\);/g;
    validateMatches([...scope.matchAll(completion)], { name: 'SiteInfo completion', expectedMatches: 1 });
    scope = scope.replace(completion, match => `${match.slice(0, -1)}.catch(error => console.error('[SiteInfo] Failed to load', ${url}, error));`);
    return { code: injectedApp.slice(0, start) + scope + injectedApp.slice(end), regions };
}
