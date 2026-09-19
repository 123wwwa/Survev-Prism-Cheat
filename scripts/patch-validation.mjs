// Shared by Node build scripts and the browser bundle. No Node-only imports.
export const patchValidationReport = [];
export function resetPatchValidationReport() { patchValidationReport.length = 0; }

export function validateMatches(matches, { name, expectedMatches = 1, pattern, hint = '' }) {
    if (!Number.isInteger(expectedMatches) || expectedMatches < 0) throw new Error(`Invalid expectedMatches for ${name}`);
    const actualMatches = matches.length;
    const ok = actualMatches === expectedMatches;
    const row = { name, expectedMatches, actualMatches, status: ok ? 'OK' : 'FAIL',
        ...(pattern ? { pattern: String(pattern) } : {}), ...(hint ? { hint } : {}) };
    patchValidationReport.push(row);
    const message = `[${row.status}] ${name}: ${actualMatches} ${actualMatches === 1 ? 'match' : 'matches'} (expected ${expectedMatches})`;
    console[ok ? 'info' : 'error'](message);
    if (!ok) {
        const expected = expectedMatches === 1 ? 'exactly one match' : `${expectedMatches} matches`;
        const error = new Error(`${name}: expected ${expected}, found ${actualMatches}.${hint ? ` ${hint}` : ''}`);
        error.patchValidation = row;
        throw error;
    }
    return matches;
}

export function findMatches(source, spec) {
    const flags = spec.pattern.flags.includes('g') ? spec.pattern.flags : `${spec.pattern.flags}g`;
    // Always start at offset zero, even if the caller reused a stateful RegExp.
    const pattern = new RegExp(spec.pattern.source, flags);
    return validateMatches([...source.matchAll(pattern)], spec);
}
