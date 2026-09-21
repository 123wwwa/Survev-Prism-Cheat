# PrismCheat — Survev Prism Cheat

PrismCheat is an open-source cheat userscript for Survev, featuring configurable aim assist, ESP, combat tools, and automated client updates. It includes a TAB settings menu and a source-based pipeline for building and validating patched client modules.

<div align="center">

<img
src="https://readme-typing-svg.demolab.com?font=Orbitron&weight=700&size=38&duration=3000&pause=1000&color=00E5FF&center=true&vCenter=true&width=1000&height=70&lines=SURVEV-PRISM-CHEAT"
alt="PrismCheat  -  Survev Prism Cheat"
/>

<img
src="https://readme-typing-svg.demolab.com?font=Share+Tech+Mono&size=19&duration=3000&pause=1000&color=8A7DFF&center=true&vCenter=true&width=900&height=40&lines=%3E+AUTOMATED+CLIENT+PATCHING+FRAMEWORK_"
alt="Automated Client Patching Framework"
/>

<img
src="https://github.com/user-attachments/assets/3d98d2ba-d337-4f68-9d90-3657506e819f"
width="430"
alt="Survev Prism Cheat"
/>
<br>
<img src="https://img.shields.io/badge/Version-v3.0.0-00AEEF?style=for-the-badge" alt="Version">
<img src="https://img.shields.io/badge/License-GPL--3.0--or--later-8A2BE2?style=for-the-badge" alt="License">
<img src="https://img.shields.io/badge/GitHub-Repository-181717?style=for-the-badge&logo=github&logoColor=white" alt="GitHub">
<br>

**⚡ A Survev userscript with configurable aim assist, visual options, and a TAB settings menu.**

<br>
<img
src="https://github.com/user-attachments/assets/e1846861-12fa-44ef-8e3a-c6a627162b65"
width="300"
alt="Settings menu"
/>
<br>
<img
src="https://github.com/user-attachments/assets/3e5e84f2-a4ba-4d57-b540-3f32327a5435"
width="850"
alt="Gameplay"
/>
<br>

<img
src="https://github.com/user-attachments/assets/8d4d25d1-346d-4ffc-91b1-b7f27e323a47"
width="750"
alt="Visual features"
/>

</div>

## Download and install

**Requires a Manifest V2 (MV2) extension environment. Firefox is recommended.**

1. Download and install [Firefox](https://www.mozilla.org/en-US/firefox/new/).
2. Open Firefox and install [Tampermonkey for Firefox](https://addons.mozilla.org/en-US/firefox/addon/tampermonkey/).
3. Visit [Survev Prism Cheat on Greasy Fork](https://greasyfork.org/en/scripts/596621-survev-ultimate-cheat-injector), click **Install this script**, and confirm installation in Tampermonkey.
4. Open or reload [Survev](https://survev.io/). Make sure the script is enabled in Tampermonkey.
5. Press **TAB** to open or close the settings menu. Press **ESC** to close it.

You do not need to clone this repository or install development tools to use the published userscript. Disable older copies of the injector to avoid running multiple versions together.

## Features

- **Configurable aim assist(sophisticated Aimbot)** — Adjust the total aiming cone from 5° to 180°. The default is 60° (30° on each side of the mouse direction), and your angle setting is saved locally.
- **Target checks** — Targets must be on the same floor and have a clear shot. Focused targets follow the same restrictions.
- **Automatic melee** — Supports close-range targeting and movement.
- **Visual controls(ESP, Zoom)** — Zoom, player tracers, grenade tracers, flashlight, and an optional status overlay.
- **TAB settings menu** — Toggle features and adjust aiming settings from one panel. Aim assist pauses while the menu is open.

## Combat options

Open **TAB → Combat options**. Each option has its own saved toggle.

| Option | Behavior | Default |
| --- | --- | --- |
| Weapon-aware targets | Scores targets using bullet range, speed and weapon spread. | Off |
| Avoid active frying pans | Checks the target's actual pan reflection segment against the shot path. | Off |
| Break weak cover first | Aims at one destructible, non-explosive obstacle estimated to take at most three hits. Does not fire automatically. | Off |
| Threat priority | Weights enemy proximity, facing and approach velocity; does not assume enemy health. | Off |
| Estimated throw path & blast radius | Shows bounce paths, landing/detonation markers, blast radius, fuse timers and a moving-target marker. | On |
| Smart weapon switching | Chooses loaded weapons by range and suitability, considers reloading, and allows close-range melee. Preserves post-shot swaps for shotguns, bolt-action rifles and the Potato Cannon. | Off |
| Back-pan defense | Rotates the character to face the back-mounted pan toward a threat while holding a gun and idle or reloading. Approaching shots take priority by estimated arrival time. | On |

Prediction displays are estimates, not guaranteed outcomes. See [combat behavior and limitations](docs/combat-details.md) for details.

## Development

See the [architecture diagrams](docs/architecture.md) for the build, publication and browser runtime flows.

For local builds, fork configuration, GitHub Actions, CDN publication, Greasy Fork synchronization and troubleshooting, see the [development guide](docs/development.md).

## License

GPL-3.0-or-later. See [LICENSE](LICENSE). Derived from [survev/survev](https://github.com/survev/survev) (GPL-3.0-or-later). Existing upstream and third-party notices are retained.
