export function getTeam(player) {
    return Object.keys(unsafeWindow.game.m_playerBarn.teamInfo).find(team => unsafeWindow.game.m_playerBarn.teamInfo[team].playerIds.includes(player.__id));
}

export function findWeap(player) {
    const weapType = player.m_netData.m_activeWeapon;
    return weapType && unsafeWindow.guns[weapType] ? unsafeWindow.guns[weapType] : null;
}

export function findBullet(weapon) {
    return weapon ? unsafeWindow.bullets[weapon.bulletType] : null;
}
