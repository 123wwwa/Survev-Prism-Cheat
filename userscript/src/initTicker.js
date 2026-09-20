import { combatAssist } from './plugins/combatAssist.js';
import { esp } from './plugins/esp.js';
import { aimBot } from './plugins/aimbot.js';
import { autoSwitch } from './plugins/autoSwitch.js';
import { obstacleOpacity } from './plugins/obstacleOpacity.js';
import { grenadeTimer } from './plugins/grenadeTimer.js';


export function initTicker(){
    unsafeWindow.game.m_pixi._ticker.add(aimBot);
    unsafeWindow.game.m_pixi._ticker.add(esp);
    unsafeWindow.game.m_pixi._ticker.add(autoSwitch);
    unsafeWindow.game.m_pixi._ticker.add(combatAssist);
    unsafeWindow.game.m_pixi._ticker.add(obstacleOpacity);
    unsafeWindow.game.m_pixi._ticker.add(grenadeTimer);
    unsafeWindow.game.m_pixi._ticker.add(unsafeWindow.GameMod.startUpdateLoop.bind(unsafeWindow.GameMod));
}
