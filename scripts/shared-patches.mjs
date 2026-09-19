// Patch readable output only. Match declaration prefixes and leave all existing
// bytes (including imports, exports, object contents and local names) intact.
const declaration = String.raw`^(?:var|let|const)\s+[$A-Z_a-z][$\w]*\s*=\s*`;
const key = String.raw`[$\w]+`;
export const sharedScriptPatches = [
  { name: 'bullets', shape: String.raw`\{\s*${key}\s*:\s*\{\s*type\s*:\s*"bullet"\s*,\s*damage\s*:` },
  { name: 'explosions', shape: String.raw`\{\s*explosion_frag\s*:\s*\{\s*type\s*:\s*"explosion"\s*,\s*damage\s*:` },
  { name: 'guns', shape: String.raw`\{\s*${key}\s*:\s*\{\s*name\s*:\s*"[^"]+"\s*,\s*type\s*:\s*"gun"\s*,\s*quality\s*:` },
  { name: 'throwable', shape: String.raw`\{\s*${key}\s*:\s*\{\s*name\s*:\s*"[^"]+"\s*,\s*type\s*:\s*"throwable"\s*,\s*quality\s*:` },
  { name: 'objects', shape: String.raw`\{\s*barrel_01\s*:\s*${key}\(\s*\{\s*\}\s*\)\s*,\s*barrel_01b\s*:\s*${key}\(` },
].map(({ name, shape }) => ({ name, from: new RegExp(`${declaration}(?=${shape})`, 'gm') }));

export function patchSharedScript(source) {
  // Validate every match before applying any insertion. Never publish a partial
  // patch after an upstream change, or accept already patched input.
  const insertions = sharedScriptPatches.map(({ name, from }) => {
    if (new RegExp(String.raw`\bwindow\s*\.\s*${name}\s*=`).test(source)) {
      throw new Error(`Shared patch ${name}: input already exposes window.${name}.`);
    }
    const matches = [...source.matchAll(from)];
    if (matches.length !== 1) throw new Error(`Shared patch ${name}: expected exactly one match, found ${matches.length}.`);
    return { name, offset: matches[0].index + matches[0][0].length };
  });
  let code = source;
  for (const { name, offset } of [...insertions].sort((a, b) => b.offset - a.offset)) {
    code = `${code.slice(0, offset)}window.${name} = ${code.slice(offset)}`;
  }
  return { code, applied: insertions.map(({ name }) => name) };
}
