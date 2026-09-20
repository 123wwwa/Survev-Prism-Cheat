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
            // Wait for the observed equip before returning; never send both in one input message.
            if (slot === pending.to && inputs.length === 0) {
                inputs.push(equip[pending.from]); pending = null; state.autoSwapUntil = now + 700;
            }
            return;
        }
        if (slot !== 0 && slot !== 1) return;
        const weapon = weapons[slot], old = previous[slot], gun = guns?.[weapon?.type];
        if (!eligible(gun) || (state.isSmartSwitchEnabled && !mandatorySwap(gun, weapon.type))) return;
        if (!old || old.type !== weapon.type || !(weapon.ammo < old.ammo) || inputs.some(command => command.startsWith('Equip'))) return;
        const other = 1 - slot, alternate = weapons[other];
        state.autoSwapUntil = now + 1500;
        if (!state.isUseOneGunEnabled && alternate?.ammo > 0 && eligible(guns?.[alternate.type])) {
            inputs.push(equip[other]);
        } else {
            const to = alternate?.type ? other : 2;
            inputs.push(equip[to]);
            pending = { from: slot, to, type: weapon.type, deadline: now + 1500 };
        }
    };
}
