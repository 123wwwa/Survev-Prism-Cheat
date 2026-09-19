import { state } from '../vars.js';
import { inputs, inputCommands } from '../overrideInputs.js';


const ammo = [
    {
        name: "",
        ammo: null,
        lastShotDate: Date.now()
    },
    {
        name: "",
        ammo: null,
        lastShotDate: Date.now()
    },
    {
        name: "",
        ammo: null,
    },
    {
        name: "",
        ammo: null,
    },
]
export function autoSwitch(){
    if (!(unsafeWindow.game?.m_connection && unsafeWindow.game?.m_activePlayer?.m_localData?.m_curWeapIdx != null)) return; 

    if (!state.isAutoSwitchEnabled) return;

    try {
    const curWeapIdx = unsafeWindow.game.m_activePlayer.m_localData.m_curWeapIdx;
    const weaps = unsafeWindow.game.m_activePlayer.m_localData.m_weapons;
    const curWeap = weaps[curWeapIdx];
    const shouldSwitch = gun => {
        let s = false;
        try {
            s =
                (unsafeWindow.guns[gun].fireMode === "single"
                || unsafeWindow.guns[gun].fireMode === "burst") 
                && unsafeWindow.guns[gun].fireDelay >= 0.45;
        }
        catch (e) {
        }
        return s;
    }
    const weapsEquip = ['EquipPrimary', 'EquipSecondary']
    if(curWeap.ammo !== ammo[curWeapIdx].ammo) {
        const otherWeapIdx = (curWeapIdx == 0) ? 1 : 0
        const otherWeap = weaps[otherWeapIdx]
        if ((curWeap.ammo < ammo[curWeapIdx].ammo || (ammo[curWeapIdx].ammo === 0 && curWeap.ammo > ammo[curWeapIdx].ammo && (  unsafeWindow.game.m_touch.shotDetected ||  unsafeWindow.game.m_inputBinds.isBindDown(inputCommands.Fire) ))) && shouldSwitch(curWeap.type) && curWeap.type == ammo[curWeapIdx].type) {
            ammo[curWeapIdx].lastShotDate = Date.now();
            console.log("Switching weapon due to ammo change");
            if ( shouldSwitch(otherWeap.type) && otherWeap.ammo && !state.isUseOneGunEnabled) { inputs.push(weapsEquip[otherWeapIdx]); } // && ammo[curWeapIdx].ammo !== 0
            else if ( otherWeap.type !== "" ) { inputs.push(weapsEquip[otherWeapIdx]); inputs.push(weapsEquip[curWeapIdx]); }
            else { inputs.push('EquipMelee'); inputs.push(weapsEquip[curWeapIdx]); }
        }
        ammo[curWeapIdx].ammo = curWeap.ammo
        ammo[curWeapIdx].type = curWeap.type
    }
    }catch(err){
        console.error('autoswitch', err)
    }
}