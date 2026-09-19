import { spawn } from 'node:child_process';
import { existsSync } from 'node:fs';
import { readFile, writeFile, mkdir, open, unlink, rename, copyFile } from 'node:fs/promises';
import { resolve, dirname } from 'node:path';
import { fileURLToPath } from 'node:url';
import { setTimeout as delay } from 'node:timers/promises';
import { sha256, validateConfig, validateArtifact, matchesBuild, githubSlug, cdnUrl } from './lib.mjs';
import { patchSharedScript } from './shared-patches.mjs';
import { patchAppScript } from './app-patches.mjs';

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
if (!['check', 'build', 'update', 'deploy', 'watch', 'userscript'].includes(mode)) throw new Error('Usage: pipeline.mjs check|build|update|deploy|watch|userscript');
const log = message => console.log(`[${new Date().toISOString()}] ${message}`);

function run(executable, args, cwd = root, capture = false) {
  return new Promise((accept, reject) => {
    const childEnv = { ...process.env, GIT_TERMINAL_PROMPT: '0', GCM_INTERACTIVE: 'never' };
    // Git receives its scoped authentication header explicitly. Build scripts
    // and dependency lifecycle commands do not need the publication token.
    delete childEnv.GH_TOKEN;
    delete childEnv.GITHUB_TOKEN;
    const child = spawn(executable, args, {
      cwd, windowsHide: true, stdio: capture ? ['ignore', 'pipe', 'pipe'] : 'inherit',
      env: childEnv,
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
    const header = process.env.GH_TOKEN ? `AUTHORIZATION: basic ${Buffer.from(`x-access-token:${process.env.GH_TOKEN}`).toString('base64')}`
      : await run(gitExe, ['config', '--get', key], root, true).catch(() => '');
    if (header) args = ['-c', `${key}=${header}`, ...args];
  }
  return run(gitExe, args, cwd, capture);
}
const pnpm = (args, cwd = source) => process.platform === 'win32'
  ? run('powershell.exe', ['-NoProfile', '-ExecutionPolicy', 'Bypass', '-File', resolve(root, 'scripts/invoke-pnpm.ps1'), ...args], cwd)
  : run('pnpm', args, cwd);

async function buildUserscript() {
  const directory = resolve(root, 'userscript');
  log('Building userscript (including local source changes)...');
  await pnpm(['install', '--frozen-lockfile', '--ignore-scripts'], directory);
  await pnpm(['run', 'build'], directory);
  const output = resolve(directory, 'dist/injector.user.js');
  const data = await readFile(output, 'utf8');
  if (!data.startsWith('// ==UserScript==') || !data.includes('// ==/UserScript==')) {
    throw new Error('Userscript build is missing its installation metadata.');
  }
  await run(process.execPath, ['--check', output], root, true);
  log(`Userscript built: ${output}`);
}
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
  const files = ['pipeline.config.json', 'client-config.hjson', 'scripts/build-client.mjs', 'scripts/canvas-paths.cjs',
    'scripts/pipeline.mjs', 'scripts/lib.mjs', 'scripts/shared-patches.mjs', 'scripts/app-patches.mjs', 'scripts/invoke-pnpm.ps1'];
  const normalized = async path => Buffer.from((await readFile(path, 'utf8')).replaceAll('\r\n', '\n'));
  const contents = await Promise.all(files.map(file => normalized(resolve(root, file))));
  // Also observe locally supplied client build configuration without publishing it.
  for (const file of ['client/.env', 'client/.env.local',
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
  // Drain error responses as well, allowing the HTTP connection to close cleanly.
  const repository = await response.json();
  if (response.status === 404) throw new Error(`Publishing repository is not publicly accessible: https://github.com/${githubSlug(config.publishRepository)}. jsDelivr cannot serve a private repository. Set Settings > General > Change visibility > Public (or configure an existing public repository), then rerun update.`);
  if (!response.ok) throw new Error(`Public GitHub repository lookup returned HTTP ${response.status}. Check API rate limits.`);
  if (repository.private !== false) throw new Error('jsDelivr requires a public publishing repository.');
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
  // Only this disposable, clean publication checkout is moved. A prior failed
  // push is abandoned without rewriting the remote or the user's main branch.
  await git(['checkout', '--detach', sha], publishDir);
  return { sha, manifest };
}

async function build(revision) {
  log(`Installing client/shared dependencies for ${revision.slice(0, 12)}`);
  await pnpm(['install', '--frozen-lockfile', '--filter', '@survev/client...', '--filter', '@survev/shared...', '--filter', 'survev']);
  await run(process.execPath, [resolve(root, 'scripts/build-client.mjs'), source, buildDir]);
  const report = JSON.parse(await readFile(resolve(buildDir, 'build-report.json'), 'utf8'));
  const artifacts = {};
  const buffers = {};
  let sharedPatches = [];
  let appPatches = [];
  for (const name of ['app', 'shared']) {
    const artifactPath = resolve(buildDir, report.artifacts[name].readableEntry);
    if (!artifactPath.startsWith(buildDir + (process.platform === 'win32' ? '\\' : '/'))) {
      throw new Error('Build report points outside the build directory.');
    }
    let data = await readFile(artifactPath);
    let validationPath = artifactPath;
    {
      const patched = (name === 'shared' ? patchSharedScript : patchAppScript)(data.toString('utf8'));
      data = Buffer.from(patched.code);
      if (name === 'shared') sharedPatches = patched.applied;
      else appPatches = patched.applied;
      validationPath = resolve(buildDir, `patched-${name}.mjs`);
      await writeFile(validationPath, data);
      log(`${name} patches applied: ${patched.applied.join(', ')}`);
    }
    validateArtifact(data);
    await run(process.execPath, ['--check', validationPath], root, true);
    buffers[name] = data;
    artifacts[name] = { file: config.fileNames[name], bytes: data.length, sha256: sha256(data),
      originalFile: report.artifacts[name].entry, latestUrl: cdnUrl(config, config.publishBranch, config.fileNames[name]) };
  }
  const manifest = {
    schemaVersion: 2,
    upstreamRepository: config.upstreamRepository,
    upstreamCommit: revision,
    inputHash: await inputHash(),
    builtAt: new Date().toISOString(),
    artifacts,
    sharedPatches,
    appPatches,
    sourceUrl: `https://github.com/${githubSlug(config.upstreamRepository)}/tree/${revision}`,
    build: report,
    publicationMode: 'readable-app-and-shared-original-production-imports',
  };
  // Validate both outputs before replacing either publication artifact.
  for (const name of ['app', 'shared']) await atomicWrite(resolve(dist, config.fileNames[name]), buffers[name]);
  await copyFile(resolve(source, 'LICENSE'), resolve(dist, 'LICENSE'));
  await copyFile(resolve(buildDir, 'THIRD_PARTY_LICENSES.md'), resolve(dist, 'THIRD_PARTY_LICENSES.md'));
  await writeJson(resolve(dist, 'manifest.json'), manifest);
  if (existsSync(resolve(dist, 'survev-readable.js'))) await unlink(resolve(dist, 'survev-readable.js'));
  for (const artifact of Object.values(artifacts)) log(`Built ${artifact.file}: ${(artifact.bytes / 1_000_000).toFixed(2)} MB`);
  return manifest;
}

async function publish(manifest, remote) {
  if (remote) {
    // Push remains fast-forward only; concurrent publication is retried next cycle.
    await git(['merge', '--ff-only', remote.sha], publishDir);
  }
  for (const file of [...Object.values(config.fileNames), 'manifest.json', 'LICENSE', 'THIRD_PARTY_LICENSES.md']) {
    await copyFile(resolve(dist, file), resolve(publishDir, file));
  }
  await writeFile(resolve(publishDir, 'README.md'),
    `# Survev client build\n\nSource: ${manifest.sourceUrl}\n\n` +
    `Build scripts: https://github.com/${githubSlug(config.publishRepository)}\n\n` +
    `Readable app.js and shared.js from the same production build. Original hashed imports and export aliases are preserved. Runtime chunks, HTML, CSS, images and a game server are NOT included.\n`);
  // Migrate the previous managed artifact name; do not remove other files.
  await git(['rm', '--ignore-unmatch', '--', 'survev-readable.js'], publishDir);
  await git(['add', '--', ...Object.values(config.fileNames), 'manifest.json', 'LICENSE', 'THIRD_PARTY_LICENSES.md', 'README.md'], publishDir);
  if (await git(['diff', '--cached', '--name-only'], publishDir)) {
    await git(['-c', 'user.name=survev-injector', '-c', 'user.email=survev-injector@users.noreply.github.com',
      'commit', '-m', `Build survev ${manifest.upstreamCommit.slice(0, 12)}`], publishDir);
  }
  await git(['push', 'origin', `HEAD:refs/heads/${config.publishBranch}`], publishDir);
  return git(['rev-parse', 'HEAD'], publishDir);
}

async function recordPublication(revision) {
  const urls = Object.fromEntries(Object.entries(config.fileNames).map(([name, file]) => [name, {
    immutableUrl: cdnUrl(config, revision, file), latestUrl: cdnUrl(config, config.publishBranch, file),
  }]));
  const state = { publicationCommit: revision, artifacts: urls, recordedAt: new Date().toISOString() };
  await writeJson(resolve(stateDir, 'published.json'), state);
  log(`GitHub commit: ${revision}`);
  for (const [name, links] of Object.entries(urls)) {
    log(`${name} jsDelivr branch URL (12-hour cache): ${links.latestUrl}`);
    log(`${name} jsDelivr immutable URL: ${links.immutableUrl}`);
  }
}

async function checkUpdates() {
  const remote = await git(['ls-remote', '--heads', config.upstreamRepository, `refs/heads/${config.upstreamBranch}`]);
  const revision = remote.split(/\s+/)[0];
  if (!/^[a-f0-9]{40}$/.test(revision)) throw new Error('Upstream branch was not found.');
  const local = await readJson(resolve(dist, 'manifest.json'));
  log(`Upstream: ${revision}`);
  log(`Local build: ${local?.upstreamCommit ?? 'none'}`);
  log(matchesBuild(local, revision, await inputHash()) ? 'Local build is up to date.' : 'An update/build is available. Run .\\run.ps1 update to build and publish.');
  // Read-only: no checkout, build, commit, push, or CDN purge.
  const publicManifest = await fetch(`https://raw.githubusercontent.com/${githubSlug(config.publishRepository)}/${config.publishBranch}/manifest.json`, {
    signal: AbortSignal.timeout(20_000),
  });
  if (publicManifest.ok) {
    const published = await publicManifest.json();
    log(`Published upstream commit: ${published.upstreamCommit}`);
  } else log(`Public publication manifest is unavailable (HTTP ${publicManifest.status}); the cdn branch may not exist yet or the repository may still be private.`);
}

async function cycle() {
  if (mode === 'check') return checkUpdates();
  // Always rebuild the installable userscript, even when upstream/CDN is unchanged.
  // Fail before publication if local userscript edits do not build.
  await buildUserscript();
  if (mode === 'userscript') return;
  const revision = await syncSource();
  const hash = await inputHash();
  const remote = mode === 'build' ? null : await preparePublish();
  if (remote && matchesBuild(remote.manifest, revision, hash)) {
    log(`CDN unchanged: ${revision.slice(0, 12)}. No app/shared build or push needed; userscript was rebuilt.`);
    await recordPublication(remote.sha);
    return;
  }
  let manifest = await readJson(resolve(dist, 'manifest.json'));
  let validLocal = false;
  if (matchesBuild(manifest, revision, hash)) {
    validLocal = true;
    for (const [name, file] of Object.entries(config.fileNames)) {
      if (manifest.artifacts?.[name]?.file !== file || !existsSync(resolve(dist, file)) ||
          sha256(await readFile(resolve(dist, file))) !== manifest.artifacts[name].sha256) validLocal = false;
    }
  }
  if (!validLocal) manifest = await build(revision);
  else log(`Reusing verified local build ${revision.slice(0, 12)}`);
  if (mode !== 'build') {
    const sha = await publish(manifest, remote);
    await recordPublication(sha);
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
} catch (error) {
  console.error(`[pipeline] ${error.message}`);
  // Let pending HTTP handles close normally instead of terminating through an
  // uncaught top-level rejection (which can trigger a libuv assertion on Windows).
  process.exitCode = 1;
} finally {
  await lock.close();
  await unlink(lockPath);
}
