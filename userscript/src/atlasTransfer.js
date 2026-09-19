import { validateMatches } from '../../scripts/patch-validation.mjs';
// Decode a static JS string literal without evaluating downloaded JavaScript.
function decodeLiteral(literal) {
    const body = literal.slice(1, -1);
    let result = '';
    const escapes = { n: '\n', r: '\r', t: '\t', b: '\b', f: '\f', v: '\v', '0': '\0' };
    for (let i = 0; i < body.length; i++) {
        const char = body[i];
        if (literal[0] === '`' && char === '$' && body[i + 1] === '{') throw new Error('Atlas template interpolation is unsupported');
        if (char !== '\\') { result += char; continue; }
        const escaped = body[++i];
        if (escaped === '\n') continue;
        if (escaped === '\r') { if (body[i + 1] === '\n') i++; continue; }
        if (escaped === 'x' || escaped === 'u') {
            const length = escaped === 'x' ? 2 : 4;
            const hex = body.slice(i + 1, i + 1 + length);
            if (hex.length !== length || !/^[a-f\d]+$/i.test(hex)) throw new Error('Unsupported atlas string escape');
            result += String.fromCharCode(parseInt(hex, 16));
            i += length;
        } else if (escaped in escapes) result += escapes[escaped];
        else if (['\\', '"', "'", '`', '/', '$'].includes(escaped)) result += escaped;
        else throw new Error('Unsupported atlas string escape');
    }
    return result;
}

function atlasLiterals(source) {
    const pattern = /JSON\.parse\(\s*("(?:\\[\s\S]|[^"\\])*"|'(?:\\[\s\S]|[^'\\])*'|`(?:\\[\s\S]|[^`\\])*`)\s*\)/g;
    const atlases = [];
    for (const match of source.matchAll(pattern)) {
        // Avoid decoding unrelated JSON in the rest of the application.
        if (!match[1].includes('loadout') || !match[1].includes('frames')) continue;
        const data = JSON.parse(decodeLiteral(match[1]));
        if (!Array.isArray(data.loadout)) throw new Error('Unsupported atlas structure');
        const sheets = Object.values(data).flat();
        if (!sheets.length || sheets.some(sheet => !sheet?.meta?.image || !sheet.meta.size || !sheet.frames || typeof sheet.frames !== 'object')) {
            throw new Error('Incomplete atlas metadata');
        }
        const scale = Number(data.loadout[0]?.meta.scale);
        const resolution = scale === 1 ? 'high' : scale === 0.5 ? 'low' : null;
        if (!resolution || sheets.some(sheet => Number(sheet.meta.scale) !== scale)) throw new Error('Unsupported atlas resolution');
        atlases.push({ match, data, resolution });
    }
    return atlases;
}

export function transferAtlases(originalApp, injectedApp, pageBaseURL) {
    const original = atlasLiterals(originalApp);
    const targets = atlasLiterals(injectedApp);
    const edits = [];
    const images = [];
    for (const resolution of ['high', 'low']) {
        const sources = original.filter(atlas => atlas.resolution === resolution);
        const destinations = targets.filter(atlas => atlas.resolution === resolution);
        validateMatches(sources, { name: `Atlas ${resolution} source`, expectedMatches: 1, hint: 'expected one source and target' });
        validateMatches(destinations, { name: `Atlas ${resolution} target`, expectedMatches: 1, hint: 'expected one source and target' });
        const { data } = sources[0];
        for (const sheets of Object.values(data)) for (const sheet of sheets) {
            const url = new URL(sheet.meta.image, pageBaseURL);
            if (!['http:', 'https:'].includes(url.protocol)) throw new Error('Unsupported atlas image URL');
            sheet.meta.image = url.href;
            images.push(url.href);
        }
        const { match } = destinations[0];
        // Preserve the initializer and variable name, replacing only its data.
        edits.push({ start: match.index, end: match.index + match[0].length,
            text: `JSON.parse(${JSON.stringify(JSON.stringify(data))})` });
    }
    let code = injectedApp;
    for (const edit of edits.sort((a, b) => b.start - a.start)) code = code.slice(0, edit.start) + edit.text + code.slice(edit.end);
    return { code, images };
}
