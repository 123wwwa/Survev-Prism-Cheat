import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, open, unlink, rename, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { sha256, validateConfig, validateArtifact, matchesBuild, githubSlug, cdnUrl } from './lib.mjs';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const config = validateConfig(JSON.parse(await readFile(resolve(root, 'pipeline.config.json'), 'utf8')));
const source = resolve(root, 'vendor/survev');
const stateDir = resolve(root, '.pipeline');
const publishDir = resolve(stateDir, 'publish');
const buildDir = resolve(stateDir, 'build');
const dist = resolve(root, 'dist');
const gitExe = process.env.GIT_BIN || (process.platform === 'win32' && existsSync('C:/Program Files/Git/cmd/git.exe')
  ? 'C:/Program Files/Git/cmd/git.exe' : 'git');
const mode = process.argv[2] ?? 'build';
if (!['build', 'deploy', 'watch'].includes(mode)) throw new Error('Usage: pipeline.mjs build|deploy|watch');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

function run(executable, args, cwd = root, capture = false) {
  return new Promise((accept, reject) => {
    const child = spawn(executable, args, {
      cwd, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: { ...process.env, GIT_TERMINAL_PROMPT: '0' },
    });
    let stdout = '', stderr = '';
    child.stdout?.on('data', data => { stdout += data; });
    child.stderr?.on('data', data => { stderr += data; });
    child.on('error', reject);
    child.on('exit', code => code === 0 ? accept(stdout.trim()) : reject(new Error(
      `${executable} ${args[0]} failed (${code}). ${stderr.trim()}`,
    )));
  });
}
async function git(args, cwd = root, capture = true) {
  // actions/checkout stores its scoped credential in the root checkout. Our
  // separate publication checkout needs that same header, without persisting it.
  if (cwd === publishDir && process.env.GITHUB_ACTIONS === 'true') {
    const key = 'http.https://github.com/.extraheader';
    const header = await run(gitExe, ['config', '--get', key], root, true).catch(() => '');
    if (header) args = ['-c', `${key}=${header}`, ...args];
  }
  return run(gitExe, args, cwd, capture);
}
const pnpm = args => process.platform === 'win32'
  ? run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/invoke-pnpm.ps1'), ...args], source)
  : run('pnpm', args, source);
async function readJson(path) {
  try { return JSON.parse(await readFile(path, 'utf8')); }
  catch (error) { if (error.code === 'ENOENT') return null; throw error; }
}
async function atomicWrite(path, data) {
  await mkdir(dirname(path), { recursive: true });
  await writeFile(`${path}.tmp`, data);
  await rename(`${path}.tmp`, path);
}
const writeJson = (path, value) => atomicWrite(path, `${JSON.stringify(value, null, 2)}\n`);

async function syncSource() {
  if (!existsSync(resolve(source, '.git/config'))) {
    await mkdir(dirname(source), { recursive: true });
    await git(['clone', '--depth', '1', '--branch', config.upstreamBranch, config.upstreamRepository, source]);
  }
  const remote = await git(['remote', 'get-url', 'origin'], source);
  if (remote !== config.upstreamRepository) throw new Error('Unexpected upstream origin; refusing to update.');
  if (await git(['status', '--porcelain'], source)) throw new Error('vendor/survev contains local changes; preserve or commit them before updating.');
  await git(['fetch', '--depth', '1', 'origin', config.upstreamBranch], source);
  // No reset/clean: checkout refuses to overwrite local files. Detached checkout also
  // handles an upstream branch whose history was rewritten.
  await git(['checkout', '--detach', 'FETCH_HEAD'], source);
  // Avoid upstream's randomly generated secrets/config on every fresh CI checkout.
  // This tracked public configuration is the sole source for client build settings.
  await copyFile(resolve(root, 'client-config.hjson'), resolve(source, 'survev-config.hjson'));
  return git(['rev-parse', 'HEAD'], source);
}

async function inputHash() {
  const files = ['pipeline.config.json', 'scripts/build-client.mjs', 'scripts/canvas-paths.cjs',
    'scripts/pipeline.mjs', 'scripts/lib.mjs', 'scripts/invoke-pnpm.ps1'];
  const normalized = async path => Buffer.from((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'));
  const contents = await Promise.all(files.map(file => normalized(resolve(root, file))));
  // Also observe locally supplied client build configuration without publishing it.
  for (const file of ['survev-config.hjson', 'client/.env', 'client/.env.local',
    'client/.env.production', 'client/.env.production.local']) {
    const path = resolve(source, file);
    if (existsSync(path)) contents.push(await normalized(path));
  }
  contents.push(Buffer.from(JSON.stringify(Object.fromEntries(
    Object.entries(process.env).filter(([key]) => key.startsWith('VITE_')).sort(),
  ))));
  return sha256(Buffer.concat(contents));
}

async function preparePublish() {
  // jsDelivr only serves public GitHub repositories.
  const response = await fetch(`https://api.github.com/repos/${githubSlug(config.publishRepository)}`, {
    headers: { 'User-Agent': 'survev-injector' }, signal: AbortSignal.timeout(20_000),
  });
  if (!response.ok) throw new Error(`Public GitHub repository lookup returned HTTP ${response.status}. Check visibility, repository URL or API rate limits.`);
  if ((await response.json()).private !== false) throw new Error('jsDelivr requires a public publishing repository.');
  if (!existsSync(resolve(publishDir, '.git/config'))) {
    await mkdir(publishDir, { recursive: true });
    await git(['init', '--initial-branch', config.publishBranch], publishDir);
    await git(['remote', 'add', 'origin', config.publishRepository], publishDir);
  }
  if (await git(['remote', 'get-url', 'origin'], publishDir) !== config.publishRepository) {
    throw new Error('Unexpected publication origin.');
  }
  if (await git(['status', '--porcelain'], publishDir)) throw new Error('Publication checkout has unfinished changes; inspect .pipeline/publish.');
  const remote = await git(['ls-remote', '--heads', 'origin', `refs/heads/${config.publishBranch}`], publishDir);
  if (!remote) return null;
  await git(['fetch', 'origin', `${config.publishBranch}:refs/remotes/origin/${config.publishBranch}`], publishDir);
  const sha = await git(['rev-parse', `origin/${config.publishBranch}`], publishDir);
  // Read the remote state even if a prior push failed and left a local commit.
  let manifest;
  try { manifest = JSON.parse(await git(['show', `${sha}:manifest.json`], publishDir)); }
  catch { throw new Error('Existing cdn branch lacks a valid manifest; refusing to overwrite unrelated content.'); }
  return { sha, manifest };
}

async function build(revision) {
  log(`Installing client/shared dependencies for ${revision.slice(0, 12)}`);
  await pnpm(['install', '--frozen-lockfile', '--filter', '@survev/client...', '--filter', '@survev/shared...', '--filter', 'survev']);
  await run(process.execPath, [resolve(root, 'scripts/build-client.mjs'), source, buildDir]);
  const report = JSON.parse(await readFile(resolve(buildDir, 'build-report.json'), 'utf8'));
  const artifactPath = resolve(buildDir, report.entry);
  if (!artifactPath.startsWith(buildDir + (process.platform === 'win32' ? '\\' : '/'))) {
    throw new Error('Build report points outside the build directory.');
  }
  const data = await readFile(artifactPath);
  validateArtifact(data);
  await run(process.execPath, ['--check', artifactPath], root, true);
  const manifest = {
    upstreamRepository: config.upstreamRepository,
    upstreamCommit: revision,
    inputHash: await inputHash(),
    builtAt: new Date().toISOString(),
    file: config.fileName,
    bytes: data.length,
    sha256: sha256(data),
    sourceUrl: `https://github.com/${githubSlug(config.upstreamRepository)}/tree/${revision}`,
    latestUrl: cdnUrl(config, config.publishBranch),
    build: report,
    publicationMode: 'game-entry-only',
  };
  await atomicWrite(resolve(dist, config.fileName), data);
  await copyFile(resolve(source, 'LICENSE'), resolve(dist, 'LICENSE'));
  await copyFile(resolve(buildDir, 'THIRD_PARTY_LICENSES.md'), resolve(dist, 'THIRD_PARTY_LICENSES.md'));
  await writeJson(resolve(dist, 'manifest.json'), manifest);
  log(`Built ${config.fileName}: ${(data.length / 1_000_000).toFixed(2)} MB`);
  return manifest;
}

async function publish(manifest, remote) {
  if (remote) {
    // A failed push can leave an unpublished commit. Rebase is deliberately not
    // automatic: a competing publisher must not be silently overwritten.
    await git(['merge', '--ff-only', remote.sha], publishDir);
  }
  for (const file of [config.fileName, 'manifest.json', 'LICENSE', 'THIRD_PARTY_LICENSES.md']) {
    await copyFile(resolve(dist, file), resolve(publishDir, file));
  }
  await writeFile(resolve(publishDir, 'README.md'),
    `# Survev client build\n\nSource: ${manifest.sourceUrl}\n\n` +
    `Build scripts: https://github.com/${githubSlug(config.publishRepository)}\n\n` +
    `Unminified game entry JS only. Its relative imports are preserved. Shared JS, HTML, CSS, images and a game server are NOT included.\n`);
  await git(['add', '--', config.fileName, 'manifest.json', 'LICENSE', 'THIRD_PARTY_LICENSES.md', 'README.md'], publishDir);
  if (await git(['diff', '--cached', '--name-only'], publishDir)) {
    await git(['-c', 'user.name=survev-injector', '-c', 'user.email=survev-injector@users.noreply.github.com',
      'commit', '-m', `Build survev ${manifest.upstreamCommit.slice(0, 12)}`], publishDir);
  }
  await git(['push', 'origin', `HEAD:refs/heads/${config.publishBranch}`], publishDir);
  return git(['rev-parse', 'HEAD'], publishDir);
}

async function verifyCdn(manifest, revision) {
  const url = cdnUrl(config, revision);
  let lastError;
  for (let attempt = 0; attempt < 4; attempt++) {
    if (attempt) await delay(5_000 * attempt);
    try {
      const response = await fetch(url, { signal: AbortSignal.timeout(30_000) });
      if (!response.ok) throw new Error(`jsDelivr HTTP ${response.status}`);
      if (sha256(Buffer.from(await response.arrayBuffer())) !== manifest.sha256) throw new Error('CDN content hash mismatch.');
      lastError = null;
      break;
    } catch (error) { lastError = error; }
  }
  if (lastError) throw lastError;
  let purgeSucceeded = true;
  for (const file of [config.fileName, 'manifest.json']) {
    try {
      const purgeUrl = cdnUrl(config, config.publishBranch, file).replace('cdn.jsdelivr.net', 'purge.jsdelivr.net');
      const response = await fetch(purgeUrl, { signal: AbortSignal.timeout(20_000) });
      const result = await response.json();
      if (!response.ok || result.status !== 'finished') throw new Error(`Purge status: ${result.status ?? response.status}`);
    } catch (error) {
      purgeSucceeded = false;
      log(`Cache purge pending: ${error.message}. The commit URL is already verified.`);
    }
  }
  const state = { publicationCommit: revision, verifiedUrl: url,
    latestUrl: cdnUrl(config, config.publishBranch), purgeSucceeded, verifiedAt: new Date().toISOString() };
  await writeJson(resolve(stateDir, 'published.json'), state);
  log(`Verified CDN: ${url}`);
  return state;
}

async function cycle() {
  const revision = await syncSource();
  const hash = await inputHash();
  const remote = mode === 'build' ? null : await preparePublish();
  if (remote && matchesBuild(remote.manifest, revision, hash)) {
    const state = await readJson(resolve(stateDir, 'published.json'));
    if (state?.publicationCommit !== remote.sha || !state.purgeSucceeded) await verifyCdn(remote.manifest, remote.sha);
    else log(`Unchanged: ${revision.slice(0, 12)}`);
    return;
  }
  let manifest = await readJson(resolve(dist, 'manifest.json'));
  let validLocal = false;
  if (matchesBuild(manifest, revision, hash) && existsSync(resolve(dist, config.fileName))) {
    validLocal = sha256(await readFile(resolve(dist, config.fileName))) === manifest.sha256;
  }
  if (!validLocal) manifest = await build(revision);
  else log(`Reusing verified local build ${revision.slice(0, 12)}`);
  if (mode !== 'build') {
    const sha = await publish(manifest, remote);
    await verifyCdn(manifest, sha);
  }
}

await mkdir(stateDir, { recursive: true });
const lockPath = resolve(stateDir, 'pipeline.lock');
let lock;
try { lock = await open(lockPath, 'wx'); }
catch (error) {
  if (error.code === 'EEXIST') throw new Error('Another pipeline may be running. Inspect .pipeline/pipeline.lock; remove only after confirming its PID is no longer running.');
  throw error;
}
await lock.writeFile(JSON.stringify({ pid: process.pid, startedAt: new Date().toISOString() }));
let stopping = false;
const stopSleep = new AbortController();
for (const signal of ['SIGINT', 'SIGTERM']) process.on(signal, () => {
  stopping = true;
  stopSleep.abort();
});
try {
  do {
    try { await cycle(); }
    catch (error) {
      if (mode !== 'watch') throw error;
      log(`Cycle failed; last published artifact is retained. ${error.message}`);
    }
    if (mode !== 'watch' || stopping) break;
    await delay(config.pollSeconds * 1000, undefined, { signal: stopSleep.signal }).catch(() => {});
  } while (!stopping);
} finally {
  await lock.close();
  await unlink(lockPath);
}
