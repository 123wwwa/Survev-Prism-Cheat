import { updateOverlay  } from './overlay.js';
import { bumpFire } from './plugins/bumpFire.js';
import { overrideMousePos } from './overrideMousePos.js';
import { betterZoom } from './plugins/betterZoom.js';
import { smokeOpacity } from './plugins/smokeOpacity.js';
import { visibleNames } from './plugins/visibleNames.js';
import { initTicker } from './initTicker.js';
import { state } from './vars.js';


let tickerOneTime = false;
export function initGame() {
    console.log('init game...........');

    unsafeWindow.lastAimPos = null;
    unsafeWindow.aimTouchMoveDir = null;
    state.enemyAimBot = null;
    state.focusedEnemy = null;
    state.friends = [];
    state.lastFrames = {};

    const tasks = [
        {isApplied: false, condition: () => unsafeWindow.game?.m_input?.mousePos && unsafeWindow.game?.m_touch?.aimMovement?.toAimDir, action: overrideMousePos},
        {isApplied: false, condition: () => unsafeWindow.game?.m_input?.mouseButtonsOld, action: bumpFire},
        {isApplied: false, condition: () => unsafeWindow.game?.m_activePlayer?.m_localData, action: betterZoom},
        {isApplied: false, condition: () => Array.prototype.push === unsafeWindow.game?.m_smokeBarn?.m_particles.push, action: smokeOpacity},
        {isApplied: false, condition: () => Array.prototype.push === unsafeWindow.game?.m_playerBarn?.playerPool?.m_pool.push, action: visibleNames},
        {isApplied: false, condition: () => unsafeWindow.game?.m_pixi?._ticker && unsafeWindow.game?.m_activePlayer?.container && unsafeWindow.game?.m_activePlayer?.m_pos, action: () => { if (!tickerOneTime) { tickerOneTime = true; initTicker(); } } },
    ];

    (function checkLocalData(){
        if(!unsafeWindow?.game?.m_connection) return;

        console.log('Checking local data')

        console.log(
            unsafeWindow.game?.m_activePlayer?.m_localData, 
            unsafeWindow.game?.m_map?.m_obstaclePool?.m_pool,
            unsafeWindow.game?.m_smokeBarn?.m_particles,
            unsafeWindow.game?.m_playerBarn?.playerPool?.m_pool
        );

        tasks.forEach(task => console.log(task.action, task.isApplied))
        
        tasks.forEach(task => {
            if (task.isApplied || !task.condition()) return;
            task.action();
            task.isApplied = true;
        });
        
        if (tasks.some(task => !task.isApplied)) setTimeout(checkLocalData, 5);
        else console.log('All functions applied, stopping loop.');
    })();

    updateOverlay();
}

