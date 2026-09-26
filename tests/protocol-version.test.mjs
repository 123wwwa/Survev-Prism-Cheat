import test from 'node:test';
import assert from 'node:assert/strict';
import { mkdtemp, mkdir, writeFile, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import { join } from 'node:path';
import { execFileSync } from 'node:child_process';
import { protocolVersion, selectProtocolCommit } from '../scripts/protocol-version.mjs';

test('protocol extraction fails closed on missing or ambiguous versions', () => {
  assert.equal(protocolVersion('const config = { protocolVersion: 1026, };'), 1026);
  assert.throws(() => protocolVersion('const config = {};'));
  assert.throws(() => protocolVersion('protocolVersion: 1026, protocolVersion: 1027'));
});

test('selects latest compatible snapshot before protocol bump, not introduction', async () => {
  const dir = await mkdtemp(join(tmpdir(), 'prism-protocol-'));
  const git = async args => execFileSync('git', args, { cwd: dir, encoding: 'utf8', windowsHide: true }).trim();
  try {
    await git(['init', '-q']);
    await git(['config', 'user.email', 'test@example.com']);
    await git(['config', 'user.name', 'Test']);
    await mkdir(join(dir, 'shared'));
    const commit = async (file, content) => {
      await writeFile(join(dir, file), content);
      await git(['add', '.']); await git(['commit', '-qm', 'fixture']);
      return git(['rev-parse', 'HEAD']);
    };
    await commit('shared/gameConfig.ts', 'export const config = { protocolVersion: 1026 };');
    const compatible = await commit('feature.txt', 'latest feature before protocol bump');
    await commit('shared/gameConfig.ts', 'export const config = { protocolVersion: 1027 };');
    const head = await commit('feature.txt', 'new protocol feature');
    assert.equal(await selectProtocolCommit(git, head, 1026), compatible);
    assert.equal(await selectProtocolCommit(git, head, 1027), head);
    await assert.rejects(selectProtocolCommit(git, head, 9999), /No upstream commit/);
  } finally { await rm(dir, { recursive: true, force: true }); }
});
