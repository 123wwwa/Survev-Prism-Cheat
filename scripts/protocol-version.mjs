export function protocolVersion(source) {
  const matches = [...source.matchAll(/\bprotocolVersion\s*:\s*(\d+)\b/g)];
  if (matches.length !== 1) throw new Error(`Expected one protocolVersion, found ${matches.length}`);
  return Number(matches[0][1]);
}

// Newest first-parent commit with the requested protocol. Check the tip of
// each configuration interval, not only the commit that introduced a version.
export async function selectProtocolCommit(git, head, target) {
  const read = async ref => protocolVersion(await git(['show', `${ref}:shared/gameConfig.ts`]));
  if (await read(head) === target) return head;
  const changes = (await git(['log', '--first-parent', '--format=%H', head, '--', 'shared/gameConfig.ts'])).split(/\s+/).filter(Boolean);
  for (const change of changes) {
    const parents = (await git(['rev-list', '--parents', '-n', '1', change])).split(/\s+/);
    if (parents.length < 2) continue;
    const parent = parents[1];
    // Older history may predate this file; never substitute a guessed version.
    const exists = await git(['ls-tree', '--name-only', parent, '--', 'shared/gameConfig.ts']);
    if (!exists) continue;
    if (await read(parent) === target) return parent;
  }
  throw new Error(`No upstream commit matches live protocol ${target}; build/publication aborted.`);
}
