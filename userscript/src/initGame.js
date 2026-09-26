import { observeGameUpdates } from './gameUpdateDiagnostics.js';
import { updateOverlay  } from './overlay.js';
import { bumpFire } from './plugins/bumpFire.js';
import { overrideMousePos } from './overrideMousePos.js';
import { betterZoom } from './plugins/betterZoom.js';
import { smokeOpacity } from './plugins/smokeOpacity.js';
import { visibleNames } from './plugins/visibleNames.js';
import { initTicker } from './initTicker.js';
import { state } from './vars.js';


let tickerOneTime = false;
let pendingInitialization;
export function initGame() {
    clearTimeout(pendingInitialization);
    const game = unsafeWindow.game;
    const report = observeGameUpdates(game);
    if (report) unsafeWindow.__prismGameUpdateReport = report;
    const deadline = performance.now() + 30000;

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
        {isApplied: false, condition: () => Array.prototype.push === unsafeWindow.game?.m_smokeBarn?.m_particles?.push, action: smokeOpacity},
        {isApplied: false, condition: () => Array.prototype.push === unsafeWindow.game?.m_playerBarn?.playerPool?.m_pool?.push, action: visibleNames},
        {isApplied: false, condition: () => unsafeWindow.game?.m_pixi?._ticker && unsafeWindow.game?.m_activePlayer?.container && unsafeWindow.game?.m_activePlayer?.m_pos, action: () => { if (!tickerOneTime) { tickerOneTime = true; initTicker(); } } },
    ];

    (function checkLocalData(){
        if (unsafeWindow.game !== game || !game?.m_connection) return;

        try {
            for (const task of tasks) {
                if (task.isApplied || !task.condition()) continue;
                task.action();
                task.isApplied = true;
            }
        } catch (error) {
            console.error('[Injector] Plugin initialization stopped:', error);
            return;
        }

        if (!tasks.some(task => !task.isApplied)) return;
        if (performance.now() >= deadline) {
            console.error('[Injector] Player initialization timed out; retry loop stopped.', {
                activeId: game.m_activeId,
                activePlayerFound: Boolean(game.m_activePlayer),
                playerCount: game.m_playerBarn?.playerPool?.m_pool?.length,
                pending: tasks.filter(task => !task.isApplied).map(task => task.action.name),
            });
            return;
        }
        pendingInitialization = setTimeout(checkLocalData, 100);
    })();

    updateOverlay();
}

