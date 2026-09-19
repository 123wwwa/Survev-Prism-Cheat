import { state } from "../vars.js";


export function betterZoom(){
    Object.defineProperty(unsafeWindow.game.m_camera, "m_zoom", {
        get() {
            return Math.max(unsafeWindow.game.m_camera.m_targetZoom - (state.isZoomEnabled ? 0.45 : 0), 0.35);
        },
        set(value) {
        }
    });

    let oldScope = unsafeWindow.game.m_activePlayer.m_localData.m_scope;
    Object.defineProperty(unsafeWindow.game.m_camera, "m_targetZoom", {
        get(){
            return this._targetZoom;
        },
        set(value) {
            const newScope = unsafeWindow.game.m_activePlayer.m_localData.m_scope;
            const inventory = unsafeWindow.game.m_activePlayer.m_localData.m_inventory;

            const scopes = ['1xscope', '2xscope', '4xscope', '8xscope', '15xscope']

            // console.log(value, oldScope, newScope, newScope == oldScope, (inventory['2xscope'] || inventory['4xscope'] || inventory['8xscope'] || inventory['15xscope']));
            if ( (newScope == oldScope) && (inventory['2xscope'] || inventory['4xscope'] || inventory['8xscope'] || inventory['15xscope']) && value >= this._targetZoom
                || scopes.indexOf(newScope) > scopes.indexOf(oldScope) && value >= this._targetZoom
            ) return;

            oldScope = unsafeWindow.game.m_activePlayer.m_localData.m_scope;

            this._targetZoom = value;
        }
    });
}