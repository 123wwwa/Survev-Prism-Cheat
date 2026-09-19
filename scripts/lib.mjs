import { createHash } from 'node:crypto';

export const sha256 = value => createHash('sha256').update(value).digest('hex');
export function selectGameEntry(chunks, htmlPath) {
  const normalize = path => path?.replaceAll('\\', '/');
  const entries = chunks.filter(item => item.isEntry && normalize(item.facadeModuleId) === normalize(htmlPath));
  if (entries.length !== 1) throw new Error('Could not identify exactly one game HTML entry; refusing ambiguous publication.');
  return entries[0];
}
export function githubSlug(repository) {
  const match = /^https:\/\/github\.com\/([\w.-]+\/[\w.-]+?)(?:\.git)?$/.exec(repository);
  if (!match) throw new Error('Expected a public https://github.com/owner/repository.git URL.');
  return match[1];
}
export function validateConfig(config) {
  githubSlug(config.upstreamRepository);
  githubSlug(config.publishRepository);
  for (const branch of [config.upstreamBranch, config.publishBranch]) {
    if (!/^[A-Za-z0-9][A-Za-z0-9_-]*$/.test(branch)) throw new Error('Use a simple branch name.');
  }
  if (config.publishBranch !== 'cdn') throw new Error('Publishing is restricted to the dedicated cdn branch.');
  if (!/^[A-Za-z0-9_-]+\.js$/.test(config.fileName)) throw new Error('Invalid JavaScript filename.');
  if (!Number.isInteger(config.pollSeconds) || config.pollSeconds < 15) throw new Error('pollSeconds must be at least 15.');
  return config;
}
export function matchesBuild(manifest, revision, inputHash) {
  return manifest?.upstreamCommit === revision && manifest?.inputHash === inputHash;
}
export function validateArtifact(data) {
  if (data.length === 0) throw new Error('Empty JavaScript artifact.');
  // Conservative decimal limit for the jsDelivr GitHub endpoint.
  if (data.length > 20_000_000) throw new Error('Artifact exceeds jsDelivr\'s 20 MB GitHub file limit.');
}
export function cdnUrl(config, revision, file = config.fileName) {
  return `https://cdn.jsdelivr.net/gh/${githubSlug(config.publishRepository)}@${revision}/${file}`;
}
