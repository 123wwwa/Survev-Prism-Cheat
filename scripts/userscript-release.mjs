import { sha256, cdnUrl } from './lib.mjs';

const versionLine = /^\/\/ @version\s+[^\r\n]+$/gm;
export function prepareUserscriptRelease(code, config, commit, previous, now = Date.now()) {
  if (!/^[a-f0-9]{40}$/.test(commit)) throw new Error('Userscript requires a full publication commit SHA.');
  code = code.replaceAll('\r\n', '\n');
  for (const file of Object.values(config.fileNames)) {
    const original = cdnUrl(config, config.publishBranch, file);
    if (code.split(original).length !== 2) throw new Error(`Expected one userscript CDN URL for ${file}.`);
    code = code.replace(original, cdnUrl(config, commit, file));
  }
  if ([...code.matchAll(versionLine)].length !== 1) throw new Error('Expected one userscript version header.');
  const contentHash = sha256(code.replace(versionLine, '// @version CONTENT'));
  const unchanged = previous?.contentHash === contentHash;
  // One large numeric component is ordered consistently by userscript managers.
  const version = unchanged ? previous.version : String(Math.max(now, Number(previous?.version || 0) + 1));
  if (!/^\d+$/.test(version)) throw new Error('Invalid publication version.');
  code = code.replace(versionLine, `// @version      ${version}`);
  return { code, unchanged, manifest: { kind: 'survev-userscript-release', version, contentHash,
    sha256: sha256(code), clientCommit: commit } };
}
