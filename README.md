# survev-cheat-injector

A Survev userscript with configurable aim assist, visual options, and a TAB settings menu.

## Download and install

**Requires a Manifest V2 (MV2) extension environment. Firefox is recommended.**

1. Download and install [Firefox](https://www.mozilla.org/en-US/firefox/new/).
2. Open Firefox and install [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
3. Visit [Survev Ultimate Cheat Injector on Greasy Fork](https://greasyfork.org/en/scripts/596621-survev-ultimate-cheat-injector), click **Install this script**, and confirm installation in Tampermonkey.
4. Open or reload [Survev](https://survev.io/). Make sure the script is enabled in Tampermonkey.
5. Press **TAB** to open or close the settings menu. Press **ESC** to close it.

You do not need to clone this repository or install development tools to use the published userscript. Disable older copies of the injector to avoid running multiple versions together.

## Features

- **Configurable aim assist** — Adjust the total aiming cone from 5° to 180°. The default is 60° (30° on each side of the mouse direction), and your angle setting is saved locally.
- **Target checks** — Targets must be on the same floor and have a clear shot. Focused targets follow the same restrictions.
- **Movement prediction** — Predicts target movement and checks the predicted aim point against the cone and obstacles.
- **Automatic melee** — Supports close-range targeting and movement.
- **Visual controls** — Zoom, player tracers, grenade tracers, flashlight, and an optional status overlay.
- **TAB settings menu** — Toggle features and adjust aiming settings from one panel. Aim assist pauses while the menu is open.
- **Original game settings** — Transfers server lists, region settings, proxy configuration, and sprite atlases from the original client.
- **Patch validation** — Detects missing or duplicate patch targets and stops the build or injection when checks fail.

## Development

The sections below cover building, updating, and publishing the project from source.

Builds the upstream `survev/survev` project in production mode, extracts **the game entry and its shared chunk before identifier minification** as `app.js` and `shared.js`, and publishes both to this repository's `cdn` branch. jsDelivr serves the public GitHub files directly; no separate CDN upload or API key is required.

### Manual commands

Run these commands in PowerShell from the project directory.

```powershell
.\run.cmd login    # Authorize Git Credential Manager before the first local push
.\run.cmd check    # Check the upstream commit, local build, and public publication status
.\run.cmd build    # Build the userscript and upstream app/shared without publishing
.\run.cmd update   # Build the userscript, then update/publish app/shared if needed
.\run.cmd userscript # Build only the installable userscript, without checking upstream
.\run.cmd test
```

`deploy` is an alias for `update`. If Node is on your PATH, you can also use `node scripts/pipeline.mjs check` or `node scripts/pipeline.mjs update`. The optional `watch` command repeats the update once a day while the process is running, but the daily GitHub Actions workflow is sufficient on its own. No background watcher starts automatically.

`build`, `update`, `deploy`, and each `watch` cycle always build `userscript/dist/injector.user.js` first, including local userscript changes. Dependencies are installed from `userscript/pnpm-lock.yaml` with lifecycle scripts disabled. A userscript build failure stops the command before CDN publication. An unchanged upstream commit skips only the app/shared build and push; the userscript still rebuilds. Install the resulting `.user.js` file in your browser to apply changes. For update/deploy/watch, the final userscript pins both module URLs to the published CDN commit and is published separately to the `userscript` branch. Local build/userscript commands do not publish and retain the development branch URLs. `check` remains read-only.

`run.cmd` calls `powershell -NoProfile -ExecutionPolicy Bypass -File run.ps1`. The execution policy override applies only to that process and does not change your user or system policy. Use `.\run.cmd` if PowerShell blocks `.\run.ps1`. Enforced organizational Group Policy takes precedence.

Requires Node.js 22.18+ (24 recommended), pnpm, and Git. If Node or pnpm is missing from PATH, `run.ps1` looks for the current user's bundled Codex runtime. Install the tools separately on machines without that runtime. Local pushes use your existing Git authentication, such as Git Credential Manager. Authentication failures return an error instead of waiting indefinitely for a prompt.

### Scheduled updates

The `Update client CDN` GitHub Actions workflow checks upstream **daily at 09:17 Asia/Seoul (00:17 UTC)**. GitHub may delay scheduled runs. To trigger it manually, use **Actions → Update client CDN → Run workflow**. The default branch is `main`.

The workflow uses `ubuntu-24.04`, Node.js 24, and action versions that run on Node.js 24. Its temporary GitHub token is used for Git publication and is not passed to upstream build processes or package installation scripts. Updates run on the daily schedule or by manual dispatch, not on every code push.

### Preserving the upstream build and imports

The upstream checkout stays unchanged. The wrapper explicitly sets `build.minify: false` and removes `codefend-plugin`, which otherwise replaces `m_` properties with random names independently of minification. Both app and shared retain source properties such as `m_input`, `m_camera`, and `m_netData`. Production entry points, chunk splitting, CSS/image processing, and the hashed filename format are retained; actual hashes and chunk contents can differ from a normal upstream build.

The app and shared code are captured during Rolldown's `renderChunk` stage. The shared chunk is identified as the game's direct dependency containing upstream `shared/gameConfig.ts`, rather than by a hardcoded hash or file size. The runtime helper and statistics entry are excluded; ambiguous selection stops the build. Hash placeholders are replaced with the filenames finalized by the same unminified build. App/shared import and export aliases remain consistent with each other. Short bundle export aliases are module wiring, not renamed source properties.

```js
import { a as __toESM } from "./B0Z9INg1.js";
import { U as GameConfig /* ... */ } from "./shared-chunk-hash.js";
var AliveCountsMsg = class { /* ... */ };
```

Filenames from an existing website, such as `Cbg9k6wS.js`, are not hardcoded. Turning off minification and property obfuscation changes build contents and therefore hashes. The extracted files use dependency filenames from their own build. The userscript maps those imports to the injected shared module and the host's runtime helper.

### Files and CDN access

`scripts/app-patches.mjs` applies seven app patches before publication: a map-coloring hook after minimap sorting, raw network coordinates as `_x`/`_y` on the existing player position, mouse rotation from the game's input handler, `window.pieTimerClass`, `window.basicDataInfo`, `window.game`, and an input-message override. The `servers` patch is intentionally excluded: this configuration currently emits an empty ping-test list, not the requested server declaration.

The consuming script must define `window.mapColorizing(renders)` and `window.initGameControls(inputMsg)` before those hooks run. The latter must return a valid input message; that same returned object is sent and retained as the previous input. `window.game` is assigned during game initialization, and `window.basicDataInfo` when the join message is constructed. Mouse rotation uses the actual input property found in that build, rather than assuming an unobfuscated `m_input` property. The raw coordinate patch adds `_x`/`_y` to the existing position object; it does not rename the obfuscated position property or disable the rest of interpolation. The existing rotation already reads local mouse coordinates, so this source substitution alone does not establish a latency improvement.

App regexes are scoped to their original source-module sections and must match exactly once. Missing/ambiguous targets are reported by name and stop publication. The build checks patched JavaScript syntax and records `appPatches` in the manifest; import paths and export aliases remain unchanged.

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

### Troubleshooting and recovery

- `Cannot prompt because user interactivity has been disabled` or `could not read Username` means Git has no usable publishing credential. Run `.\run.cmd login`, open the displayed GitHub device URL, enter the displayed code, and authorize Git Credential Manager. Keep the terminal open until it reports success, then rerun `.\run.cmd update`. Signing in to the GitHub website or GitHub Desktop alone does not necessarily authenticate command-line Git. Do not paste tokens into this repository or chat. GitHub Actions uses its own temporary token and does not need this local login.
- `Public GitHub repository lookup returned HTTP 404` means the repository URL is incorrect or the repository is not publicly accessible. This was the confirmed publication blocker, separate from Node.js or Ubuntu deprecation warnings. jsDelivr cannot read private repositories. Set the repository to **Public** under **GitHub Settings → General → Change visibility**, or configure another public repository in `pipeline.config.json`, then rerun `update`.
- Build failures, ambiguous game entry selection, unresolved hashes, syntax errors, or artifacts larger than 20 MB stop publication. The last successful publication remains available.
- The pipeline never force-pushes to `cdn`. After a concurrent publication conflict, the next run checks the remote state again. The deployment script does not push to the project's `main` branch.
- If a forced shutdown leaves `.pipeline/pipeline.lock`, confirm that its recorded PID is no longer running before removing that lock file.
- Inspect unfinished changes in `.pipeline/publish` before continuing. Successfully published files remain on the remote `cdn` branch.
- A compatibility helper handles node-canvas file-opening issues with Korean paths on Windows by passing the same file bytes directly. It does not modify upstream or dependency files.

References: [jsDelivr caching policy](https://github.com/jsdelivr/jsdelivr#caching), [upstream project](https://github.com/survev/survev).

### Patch validation

Build patches declare expected match counts. Logs show `[OK]` or `[FAIL]`, the patch name and actual count. Missing or duplicate matches abort the build before publication artifacts are replaced. Patch validation results are written to `.pipeline/build/patch-report.json`; successful results are also included in `dist/manifest.json` under `patchValidation`.

Before loading injected modules, the userscript checks server, region, proxy, atlas and import transfers. It parses downloaded modules to verify required global assignments and hook calls, ignoring comments and string literals. A mismatch prints `[ERROR] aborting injection` and prevents the injected module from being appended. Inspect `window.__surverInjectorPatchReport` in the browser console for recorded counts. Structural validation does not guarantee runtime game behavior.

Run `.\run.cmd build` after changes and reinstall `userscript/dist/injector.user.js`. Use `.\run.cmd update` to also publish rebuilt client modules.

### Greasy Fork automatic synchronization

`update`, `deploy`, and scheduled runs now publish `injector.user.js` to the dedicated `userscript` branch after publishing or verifying app/shared. Both module URLs are pinned to the same full CDN commit SHA, avoiding stale branch caches. The userscript is built first as a preflight; its URLs and version header are finalized after the client commit is known and syntax is checked again before publishing.

The numeric `@version` increases only when the final script content changes, including a new client commit or discovered blocking rules. Unchanged releases retain their version and do not push. `.pipeline/userscript-published.json` records the release, and `release.json` on the publication branch records its checksum. Publication is fast-forward only. If userscript publication fails after client publication, rerun `update`; the client commit can be reused.

One-time account setup:

1. Sign in to Greasy Fork as the owner of [script 596621](https://greasyfork.org/en/scripts/596621-survev-ultimate-cheat-injector) and open its synchronization settings.
2. Set the source URL to `https://raw.githubusercontent.com/123wwwa/survev-injector/userscript/injector.user.js`. Use this raw GitHub URL, not a jsDelivr branch URL.
3. Open [Greasy Fork webhook instructions](https://greasyfork.org/en/users/webhook-info). In the GitHub repository's **Settings → Webhooks**, configure a webhook using the URL and any secret/options shown there, with push events enabled. Keep secrets out of source control.
4. Run a manual sync once and verify that Greasy Fork displays the published version. Subsequent changed releases are synchronized through the webhook. Automatic periodic synchronization is an alternative if immediate updates are unnecessary.

A successful Git push does not prove Greasy Fork accepted an update. Check GitHub webhook delivery results and Greasy Fork sync status separately. No Greasy Fork password or session cookie is stored by this pipeline. See the [official integration documentation](https://greasyfork.org/en/help/api).
