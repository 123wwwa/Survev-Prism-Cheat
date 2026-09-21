import { version } from './constants.js';
import { state } from './vars.js';

const overlay = document.createElement('div');
overlay.className = 'surver-injector-overlay';

const injectorTitle = document.createElement('h3');
injectorTitle.className = 'surver-injector-title';
injectorTitle.innerText = `Survev Prism Cheat ${version}`;

export const aimbotDot = document.createElement('div')
aimbotDot.className = 'aimbotDot';

export function updateOverlay() {
    overlay.innerHTML = ``;

    const controls = [
        [ '[B] AimBot:', state.isAimBotEnabled, state.isAimBotEnabled ? 'ON' : 'OFF' ],
        [ '[Z] Zoom:', state.isZoomEnabled, state.isZoomEnabled ? 'ON' : 'OFF' ],
        [ '[M] MeleeAtk:', state.meleeStatus, state.meleeStatus ? 'ON' : 'OFF' ],
        [ '[Y] SpinBot:', state.isSpinBotEnabled, state.isSpinBotEnabled ? 'ON' : 'OFF' ],
        [ '[T] FocusedEnemy:', state.focusedEnemyStatus, state.focusedEnemy?.nameText?._text ? state.focusedEnemy?.nameText?._text : 'OFF' ],
        [ '[V] UseOneGun:', state.isUseOneGunEnabled, state.isUseOneGunEnabled ? 'ON' : 'OFF' ],
    ];

    controls.forEach((control, index) => {
        let [name, isEnabled, optionalText] = control;
        const text = `${name} ${optionalText}`;

        const line = document.createElement('p');
        line.className = 'surver-injector-control';
        line.style.opacity = isEnabled ? 1 : 0.5;
        line.textContent = text;
        overlay.appendChild(line);
    });
}

export function overlayToggle(){
    state.isOverlayEnabled = !state.isOverlayEnabled;
    overlay.style.display = state.isOverlayEnabled ? 'block' : 'none';
}

document.querySelector('#ui-game').append(overlay);
// Branding is shown in the TAB settings panel.
document.querySelector('#ui-game').append(aimbotDot);

overlay.style.display = state.isOverlayEnabled ? 'block' : 'none';
