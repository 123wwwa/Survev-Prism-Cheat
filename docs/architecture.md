# Architecture

[Back to README](../README.md) · [Development guide](development.md) · [Userscript internals](../userscript/README.md)

PrismCheat has two parts: a build and publication pipeline, and a userscript that adapts the published modules to the current game page. GitHub renders the Mermaid diagrams below directly.

## Build and publication

```mermaid
flowchart TD
    Local["Local run.cmd command"] --> Pipeline["scripts/pipeline.mjs"]
    Actions["Daily or manual GitHub Actions"] --> Pipeline
    Config["Base config + local overrides or environment"] --> Pipeline
    Pipeline --> UserBuild["Build userscript with Vite"]
    Site["Live survev.io HTML and module imports"] --> Discovery["Discover app/shared filenames"]
    Discovery --> UserBuild
    UserBuild --> Rules["Generated webRequest blocking rules"]
    UserBuild --> Upstream["Sync managed survev/survev checkout"]
    Upstream --> Cache{"Matching verified build available?"}
    Cache -->|No| Build["Production client build: minify false; codefend excluded"]
    Build --> Extract["Extract game entry and shared chunk"]
    Extract --> Patch["Scoped patches + GPL and upstream notices"]
    Patch --> Validate["Match counts, syntax and artifact validation"]
    Validate --> Artifacts["dist/app.js + shared.js + manifest"]
    Cache -->|Yes| Reuse["Reuse matching artifacts or publication"]
    Artifacts --> Publish{"Publication enabled?"}
    Reuse --> Publish
    Publish -->|No| LocalOutput["Local output only"]
    Publish -->|Yes| CDN["GitHub cdn branch / reuse existing commit"]
    CDN --> Finalize["Pin both module URLs to CDN commit; finalize release version"]
    Rules --> Finalize
    Finalize --> Release{"Userscript publication enabled?"}
    Release -->|Yes| Branch["GitHub userscript branch"]
    Branch -->|Changed release push| Hook["Owner-configured GitHub webhook"]
    Hook --> GF["Greasy Fork fetches configured source"]
    CDN --> JSDelivr["jsDelivr serves public GitHub files"]
```

The diagram describes an update cycle. `check` is read-only; `userscript` stops after the userscript build. A failed preflight or patch validation stops publication. Unchanged releases do not create another push. Greasy Fork synchronization is an external account setting, not a direct upload performed by this pipeline.

## Browser loading and adaptation

```mermaid
flowchart TD
    Installed["Installed userscript"] --> Block["Extension webRequest rules block original app/shared execution"]
    Installed --> Hooks["Register global hooks and feature modules"]
    Installed --> Injector["src/injecting.js"]
    Page["Original page module URL"] --> Injector
    Injector --> Original["Download original app and shared source"]
    Injector --> Modified["Download patched app/shared from jsDelivr"]
    Original --> Transfer["Transfer servers, regions, proxy settings and sprite atlases"]
    Modified --> Transfer
    Transfer --> Validate["Validate transfers and required AST assignments/calls"]
    Validate -->|Mismatch| Stop["Abort injection and report failed patch"]
    Validate -->|Valid| Rewrite["Rewrite static module imports"]
    Runtime["Original host runtime helper URL"] --> Rewrite
    Rewrite --> Shared["Shared Blob module"]
    Shared --> App["App Blob module imports shared Blob"]
    Hooks --> App
    App --> Game["Game initialization and registered feature hooks"]
    Assets["Original host images and other resources"] --> Game
```

Blocking depends on extension support and filenames discovered at build time. Injection cannot undo an original module that has already executed. Localhost builds with different hashes need matching blocking rules. The two CDN JavaScript files are not a standalone game: runtime helpers and assets still come from the original host.

## Runtime responsibilities

```mermaid
flowchart LR
    Shared["Shared definition tables"] --> Exports["window.guns / bullets / explosions / throwable / objects"]
    App["Patched app"] --> Exposure["window.game / basicDataInfo / pieTimerClass"]
    Exposure --> Init["initGame and initTicker"]
    UI["TAB settings menu"] --> State["Feature state and saved preferences"]
    State --> Features["Feature modules: aim, ESP, swapping, pan defense, throw preview"]
    Init --> Features
    Exports --> Features
    Features --> Visuals["Overlay, tracers and prediction displays"]
    Features --> Input["Mouse and input hooks"]
    Input --> Client["Existing game client input flow"]
```

Client-visible state drives predictions; unreplicated server information is not available. Structural patch checks detect missing integration points, but do not prove gameplay accuracy. See [combat limitations](combat-details.md).

## Source map

| Responsibility | Main source |
| --- | --- |
| Commands, caching and publication | [pipeline.mjs](../scripts/pipeline.mjs) |
| Configuration and metadata | [config.mjs](../scripts/config.mjs) |
| Client build and chunk selection | [build-client.mjs](../scripts/build-client.mjs) |
| Build-time transformations | [app-patches.mjs](../scripts/app-patches.mjs), [shared-patches.mjs](../scripts/shared-patches.mjs) |
| Userscript build and live discovery | [vite.config.js](../userscript/vite.config.js), [discover-scripts.mjs](../userscript/scripts/discover-scripts.mjs) |
| Browser module adaptation | [injecting.js](../userscript/src/injecting.js) and adjacent transfer modules |
| Runtime patch checks | [patchValidation.js](../userscript/src/patchValidation.js) |
| Settings and feature state | [iceHackMenu.js](../userscript/src/iceHackMenu.js), [vars.js](../userscript/src/vars.js) |

Local publication settings are ignored by Git. Forks do not inherit the original owner's webhook or credentials. Published userscripts pin app/shared to the same commit; branch URLs used by local builds can be cached.
