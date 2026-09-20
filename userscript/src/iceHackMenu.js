import { state } from './vars.js';
import { aimBotToggle, meleeAttackToggle, clearAim } from './plugins/aimbot.js';
import { updateOverlay, overlayToggle } from './overlay.js';
import { version } from './constants.js';

const host = document.createElement('div');
host.id = 'surver-settings';
const root = host.attachShadow({ mode: 'open' });
root.innerHTML = `<style>
:host{font:14px system-ui,sans-serif;color:#e8edf5;position:fixed;inset:0;z-index:2147483647;display:none}
*{box-sizing:border-box} .backdrop{position:absolute;inset:0;background:#08101bb3;display:grid;place-items:center;padding:20px}
.panel{width:430px;max-width:100%;max-height:85vh;overflow:auto;background:#131c2a;border:1px solid #324056;border-radius:18px;box-shadow:0 24px 90px #0009;padding:26px}
header{display:flex;justify-content:space-between;align-items:start}h1{font-size:21px;margin:0 0 6px}p{color:#9caec5;margin:0 0 20px;line-height:1.5}
h2{font-size:11px;letter-spacing:.14em;color:#88a1be;margin:24px 0 8px;text-transform:uppercase}
.row{display:flex;align-items:center;justify-content:space-between;gap:16px;padding:11px 0;border-bottom:1px solid #253246}
button{font:inherit;cursor:pointer;color:#c8d7eb;background:#243249;border:1px solid #3a4b62;border-radius:8px;padding:5px 10px}button:focus-visible,input:focus-visible{outline:2px solid #63d4bd;outline-offset:3px}
button[aria-pressed=true]{background:#163f3b;border-color:#398d7e;color:#91ecd8}
input{width:100%;accent-color:#63d4bd;margin:14px 0}output{color:#91ecd8;font-variant-numeric:tabular-nums}.hint{font-size:12px;margin:0;color:#96a8bd}footer{margin-top:22px;color:#8d9db3;font-size:12px}
</style><div class="backdrop"><section class="panel" role="dialog" aria-modal="true" aria-labelledby="title" tabindex="-1">
<header><div><h1 id="title">surver-injector</h1><p>Settings · v${version}</p></div><button id="close" aria-label="Close settings">✕</button></header>
<h2>Aiming</h2><div id="aiming"></div>
<label class="row" for="angle">Aim cone <output id="angle-value"></output></label>
<input id="angle" type="range" min="5" max="180" step="5" aria-describedby="angle-help">
<p class="hint" id="angle-help">Total angle around the mouse direction. Targets must be on the same floor with a clear shot.</p>
<h2>Combat options</h2><div id="combat"></div><p class="hint">Throw preview estimates dry-ground, full-fuse motion; stops at cover. Cover breaking excludes explosives and allows at most 3 estimated hits.</p><h2>Display & controls</h2><div id="features"></div><footer>TAB to toggle · ESC to close</footer>
</section></div>`;
document.body.append(host);
const switches = [];
function addSwitch(group, label, key, handler = () => { state[key] = !state[key]; }) {
    const row = document.createElement('div'); row.className = 'row';
    const text = document.createElement('span'); text.textContent = label;
    const button = document.createElement('button'); button.setAttribute('aria-label', label);
    button.addEventListener('click', () => { handler(); updateButtonColors(); updateOverlay(); });
    row.append(text, button); root.getElementById(group).append(row);
    switches.push({ button, key });
}
addSwitch('aiming', 'Aim assist', 'isAimBotEnabled', aimBotToggle);
addSwitch('aiming', 'Include downed players', 'isAimAtKnockedOutEnabled');
addSwitch('aiming', 'Automatic melee', 'isMeleeAttackEnabled', meleeAttackToggle);
for (const [label, key] of [['Zoom', 'isZoomEnabled'], ['Player tracers', 'isLineDrawerEnabled'], ['Grenade tracers', 'isNadeDrawerEnabled'], ['Flashlight', 'isLaserDrawerEnabled'], ['Spin', 'isSpinBotEnabled'], ['Use one gun', 'isUseOneGunEnabled']]) addSwitch('features', label, key);
const combatOptions = [
    ['Weapon-aware targets', 'isWeaponAwareEnabled'],
    ['Avoid active frying pans', 'isPanAvoidanceEnabled'],
    ['Back-pan defense · idle / reloading', 'isPanDefenseEnabled'],
    ['Break weak cover first', 'isCoverBreakEnabled'],
    ['Prioritize nearby / aiming / approaching enemies', 'isThreatPriorityEnabled'],
    ['Estimated throw path & blast radius', 'isThrowPreviewEnabled'],
    ['Smart weapon switching', 'isSmartSwitchEnabled'],
];
for (const [label, key] of combatOptions) {
    try {
        const saved=localStorage.getItem('surver-injector.' + key);
        if(saved!==null) state[key]=saved==='true';
    } catch {}
    addSwitch('combat', label, key, () => {
        state[key] = !state[key]; clearAim(); state.panDefense=null;
        try { localStorage.setItem('surver-injector.' + key, String(state[key])); } catch {}
    });
}
addSwitch('features', 'Status overlay', 'isOverlayEnabled', overlayToggle);
const angle = root.getElementById('angle');
try {
    const saved = Number(localStorage.getItem('surver-injector.aimConeDegrees'));
    if (Number.isFinite(saved) && saved >= 5 && saved <= 180) state.aimConeDegrees = saved;
} catch { /* Storage may be disabled. */ }
angle.addEventListener('input', () => {
    state.aimConeDegrees = Number(angle.value);
    clearAim();
    try { localStorage.setItem('surver-injector.aimConeDegrees', String(state.aimConeDegrees)); } catch {}
    updateButtonColors();
});
export function updateButtonColors() {
    for (const { button, key } of switches) {
        button.setAttribute('aria-pressed', String(Boolean(state[key])));
        button.textContent = state[key] ? 'On' : 'Off';
    }
    angle.value = state.aimConeDegrees;
    root.getElementById('angle-value').textContent = `${state.aimConeDegrees}° (±${state.aimConeDegrees / 2}°)`;
}
let previousFocus;
function setOpen(open) {
    state.isMenuOpen = open;
    state.panDefense=null;
    host.style.display = open ? 'block' : 'none';
    const binds = unsafeWindow.game?.m_inputBinds;
    if (binds) binds.menuHovered = open;
    clearAim();
    if (open) { previousFocus = document.activeElement; updateButtonColors(); root.getElementById('close').focus(); }
    else previousFocus?.focus?.();
}
root.getElementById('close').addEventListener('click', () => setOpen(false));
root.querySelector('.backdrop').addEventListener('click', event => { if (event.target.classList.contains('backdrop')) setOpen(false); });
for (const type of ['pointerdown', 'pointerup', 'mousedown', 'mouseup', 'click', 'wheel', 'keydown', 'keyup']) host.addEventListener(type, event => event.stopPropagation());
window.addEventListener('keydown', event => {
    const editing = event.target?.matches?.('input,textarea,select,[contenteditable=true]');
    if (event.key === 'Tab' && (state.isMenuOpen || !editing)) {
        event.preventDefault(); event.stopImmediatePropagation();
        if (!event.repeat) setOpen(!state.isMenuOpen);
    } else if (state.isMenuOpen && event.key === 'Escape') {
        event.preventDefault(); event.stopImmediatePropagation(); setOpen(false);
    }
}, true);
window.addEventListener('keyup', event => {
    if (state.isMenuOpen || event.key === 'Tab') { event.preventDefault(); event.stopImmediatePropagation(); }
}, true);
updateButtonColors();
