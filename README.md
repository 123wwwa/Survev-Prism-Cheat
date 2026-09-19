# survev-injector

Builds the upstream `survev/survev` project in production mode, extracts **the game entry and its shared chunk before identifier minification** as `app.js` and `shared.js`, and publishes both to this repository's `cdn` branch. jsDelivr serves the public GitHub files directly; no separate CDN upload or API key is required.

## Manual commands

Run these commands in PowerShell from the project directory.

```powershell
.\run.cmd login    # Authorize Git Credential Manager before the first local push
.\run.cmd check    # Check the upstream commit, local build, and public publication status
.\run.cmd build    # Update upstream and extract app.js and shared.js without publishing
.\run.cmd update   # Check for changes, build if needed, and push to the cdn branch
.\run.cmd test
```

`deploy` is an alias for `update`. If Node is on your PATH, you can also use `node scripts/pipeline.mjs check` or `node scripts/pipeline.mjs update`. The optional `watch` command repeats the update once a day while the process is running, but the daily GitHub Actions workflow is sufficient on its own. No background watcher starts automatically.

`run.cmd` calls `powershell -NoProfile -ExecutionPolicy Bypass -File run.ps1`. The execution policy override applies only to that process and does not change your user or system policy. Use `.\run.cmd` if PowerShell blocks `.\run.ps1`. Enforced organizational Group Policy takes precedence.

Requires Node.js 22.18+ (24 recommended), pnpm, and Git. If Node or pnpm is missing from PATH, `run.ps1` looks for the current user's bundled Codex runtime. Install the tools separately on machines without that runtime. Local pushes use your existing Git authentication, such as Git Credential Manager. Authentication failures return an error instead of waiting indefinitely for a prompt.

## Scheduled updates

The `Update client CDN` GitHub Actions workflow checks upstream **daily at 09:17 Asia/Seoul (00:17 UTC)**. GitHub may delay scheduled runs. To trigger it manually, use **Actions → Update client CDN → Run workflow**. The default branch is `main`.

The workflow uses `ubuntu-24.04`, Node.js 24, and action versions that run on Node.js 24. Its temporary GitHub token is used for Git publication and is not passed to upstream build processes or package installation scripts. Updates run on the daily schedule or by manual dispatch, not on every code push.

## Preserving the upstream build and imports

The upstream source and Vite configuration files remain unchanged. Production entry points, shared chunks, CSS and image processing, obfuscation plugins, and hashed filenames are preserved. The pipeline does not apply `minify: false` to the entire build.

The app and shared code are captured during Rolldown's `renderChunk` stage. The shared chunk is identified as the game's direct dependency containing upstream `shared/gameConfig.ts`, rather than by a hardcoded hash or file size. The runtime helper and statistics entry are excluded; ambiguous selection stops the build. The original build then completes Oxc minification and filename hashing normally. Internal hash placeholders in the captured code are replaced with **the filenames finalized by that same production build**. Import paths and exported aliases remain unchanged in both extracted files.

```js
import { a as __toESM } from "./B0Z9INg1.js";
import { U as GameConfig /* ... */ } from "./shared-chunk-hash.js";
var AliveCountsMsg = class { /* ... */ };
```

Filenames from an existing website, such as `Cbg9k6wS.js`, are not hardcoded. Matching a deployed site's hashes requires matching its source commit, configuration, dependencies, obfuscation output, and other build inputs. The upstream obfuscation plugin also uses randomness, so separate builds are not guaranteed to produce identical hashes. This tool preserves **the exact dependency filenames from its own production build** in the extracted JS. It does not restore property names already changed by the upstream obfuscation plugin.

## Files and CDN access

Before publication, `scripts/shared-patches.mjs` uses regular expressions on the readable shared output to insert five assignments: `window.bullets`, `window.explosions`, `window.guns`, `window.throwable`, and `window.objects`. These reference the existing bullet base definitions, explosion definitions, gun base definitions, throwable definitions, and map obstacle definitions (the table starting with `barrel_01`), respectively. They are available after those declarations execute in the browser. Base tables are exposed as requested; derived tables may contain additional entries or copied values.

Only `window.<name> = ` is inserted before each object initializer. Local variables, object contents, imports, exports, and original production output remain unchanged. Each pattern must match exactly once; missing, duplicate, or already patched targets stop publication. The patched file is syntax-checked, and its final bytes are used for manifest hashes. Patch edits also invalidate the build cache. `manifest.json` records the applied patch names.

- `vendor/survev/`: Managed upstream checkout, excluded from this project's Git history. Local modifications stop automatic updates to protect your changes.
- `.pipeline/build/`: Full upstream production output, plus the separately extracted `readable-app.js` and `readable-shared.js`.
- `dist/app.js`: Readable game entry, previously published as `survev-readable.js`.
- `dist/shared.js`: Readable shared chunk corresponding to the game's original hashed shared dependency.
- `dist/manifest.json`: Upstream commit, build time, and per-file SHA-256, byte size, original filename, and JS dependency paths.
- `client-config.hjson`: Public client configuration, including server regions. Copied into the upstream local configuration file on each update cycle.
- `.pipeline/published.json`: Publication commit and jsDelivr URLs. This does not indicate that CDN propagation has been verified.

Publication includes `app.js`, `shared.js`, and the supporting `manifest.json`, `LICENSE`, `THIRD_PARTY_LICENSES.md`, and `README.md`. Both JavaScript files are validated before publication and committed together. The old managed `survev-readable.js` is removed during migration. Runtime helper JS, statistics JS, images, CSS, and HTML are intentionally excluded.

The names `app.js` and `shared.js` are publication names only. For example, `app.js` still imports `./BvmdDwTY.js` when that is the original production filename; it is not rewritten to `./shared.js`. The consuming environment must map/provide these original paths and the remaining resources. The two CDN files alone are not a standalone game.

Stable URLs:

```text
https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/app.js
https://cdn.jsdelivr.net/gh/123wwwa/survev-injector@cdn/shared.js
```

A GitHub push makes the file available for jsDelivr to serve. **Branch URLs have a default CDN cache duration of 12 hours**, independent of the daily GitHub update schedule. Browser caching also applies. The pipeline does not automatically purge caches or wait for CDN responses, so CDN delays cannot turn a successful Git push into a failed publication. To address a specific version, replace `@cdn` with **the publishing repository's commit SHA**, not the upstream survev commit. Use the filename shown above: requesting `.min.js` may cause jsDelivr to generate a minified version.

## Troubleshooting and recovery

- `Cannot prompt because user interactivity has been disabled` or `could not read Username` means Git has no usable publishing credential. Run `.\run.cmd login`, open the displayed GitHub device URL, enter the displayed code, and authorize Git Credential Manager. Keep the terminal open until it reports success, then rerun `.\run.cmd update`. Signing in to the GitHub website or GitHub Desktop alone does not necessarily authenticate command-line Git. Do not paste tokens into this repository or chat. GitHub Actions uses its own temporary token and does not need this local login.
- `Public GitHub repository lookup returned HTTP 404` means the repository URL is incorrect or the repository is not publicly accessible. This was the confirmed publication blocker, separate from Node.js or Ubuntu deprecation warnings. jsDelivr cannot read private repositories. Set the repository to **Public** under **GitHub Settings → General → Change visibility**, or configure another public repository in `pipeline.config.json`, then rerun `update`.
- Build failures, ambiguous game entry selection, unresolved hashes, syntax errors, or artifacts larger than 20 MB stop publication. The last successful publication remains available.
- The pipeline never force-pushes to `cdn`. After a concurrent publication conflict, the next run checks the remote state again. The deployment script does not push to the project's `main` branch.
- If a forced shutdown leaves `.pipeline/pipeline.lock`, confirm that its recorded PID is no longer running before removing that lock file.
- Inspect unfinished changes in `.pipeline/publish` before continuing. Successfully published files remain on the remote `cdn` branch.
- A compatibility helper handles node-canvas file-opening issues with Korean paths on Windows by passing the same file bytes directly. It does not modify upstream or dependency files.

References: [jsDelivr caching policy](https://github.com/jsdelivr/jsdelivr#caching), [upstream project](https://github.com/survev/survev).
