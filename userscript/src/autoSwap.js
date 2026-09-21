const equip = ['EquipPrimary', 'EquipSecondary', 'EquipMelee'];
// Upstream identifies shotguns by ammunition and manually cycled rifles by pullDelay.
export const mandatorySwap = (gun, type) => !!gun && (type === 'potato_cannon' || gun.ammo === '12gauge' || gun.pullDelay > 0);
const eligible = gun => mandatorySwap(gun) || !!gun && ['single', 'burst'].includes(gun.fireMode) && gun.fireDelay >= 0.45;

export function createAutoSwap() {
    let owner, previousGame, snapshot = [], pending;
    return (game, guns, state, inputs, now) => {
        const me = game?.m_activePlayer, local = me?.m_localData;
        if (game !== previousGame || me !== owner) {
            owner = me; previousGame = game; snapshot = []; pending = null; state.autoSwapUntil = 0;
        }
        const weapons = local?.m_weapons || [], slot = local?.m_curWeapIdx;
        const previous = snapshot;
        snapshot = weapons.map(w => ({ type: w.type, ammo: w.ammo }));
        if (!game?.m_connection || !me?.active || me.m_netData?.m_dead || !state.isAutoSwitchEnabled || state.isMenuOpen) {
            pending = null; state.autoSwapUntil = 0; return;
        }
        if (pending) {
            if (now > pending.deadline || weapons[pending.from]?.type !== pending.type || ![pending.from, pending.to].includes(slot)) {
                pending = null; return;
            }
            // Recheck the destination after equip: the initial ammo snapshot can be stale.
            if (slot === pending.to && inputs.length === 0) {
                const destination = weapons[slot];
                const reloading = [1, 2].includes(me.m_netData?.m_actionType) &&
                    me.m_netData.m_actionItem === destination?.type;
                if (pending.returnAlways || !(destination?.ammo > 0) || reloading) {
                    inputs.push(equip[pending.from]);
                }
                pending = null; state.autoSwapUntil = now + 700;
            }
            return;
        }
        if (slot !== 0 && slot !== 1) return;
        const weapon = weapons[slot], old = previous[slot], gun = guns?.[weapon?.type];
        if (!eligible(gun) || (state.isSmartSwitchEnabled && !mandatorySwap(gun, weapon.type))) return;
        if (!old || old.type !== weapon.type || !(weapon.ammo < old.ammo) || inputs.some(command => command.startsWith('Equip'))) return;
        const other = 1 - slot, alternate = weapons[other];
        state.autoSwapUntil = now + 1500;
        const to = alternate?.type ? other : 2;
        const returnAlways = state.isUseOneGunEnabled || !(alternate?.ammo > 0) || !eligible(guns?.[alternate?.type]);
        inputs.push(equip[to]);
        pending = { from: slot, to, type: weapon.type, returnAlways, deadline: now + 1500 };
    };
}
