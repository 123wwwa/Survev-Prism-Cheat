import { position, angleFromMouse, clearShot } from './aimGeometry.js';

export function panFacingDirection(segment, me, enemy) {
    if (!segment?.p0 || !segment?.p1) return null;
    const mid={x:(segment.p0.x+segment.p1.x)/2,y:(segment.p0.y+segment.p1.y)/2};
    const dx=enemy.x-me.x,dy=enemy.y-me.y;
    if (![mid.x,mid.y,dx,dy].every(Number.isFinite) || Math.hypot(mid.x,mid.y)<1e-6 || Math.hypot(dx,dy)<1e-6) return null;
    // Rotate the actual back-pan midpoint toward the attacker, not a guessed 180-degree offset.
    const angle=Math.atan2(dy,dx)-Math.atan2(mid.y,mid.x);
    return {x:Math.cos(angle),y:Math.sin(angle)};
}
export function canDefend(game,state) {
    const me=game?.m_activePlayer;
    const slot=me?.m_localData?.m_curWeapIdx;
    // Action.Reload / ReloadAlt: defend even while Fire is held until reload ends.
    const reloading=[1,2].includes(me?.m_netData?.m_actionType);
    const attacking=game?.m_touch?.shotDetected || game?.m_inputBinds?.isBindDown(4);
    return !!(state.isPanDefenseEnabled && !state.isMenuOpen && game?.m_connection && me?.active &&
        !me.m_netData?.m_dead && !me.downed && me.m_netData?.m_wearingPan &&
        (slot===0 || slot===1) && me.m_netData?.m_activeWeapon!=='pan' && me.currentAnim?.()!==1 &&
        (reloading || !attacking) &&
        !game.m_inputBinds?.isBindDown(31) && !game.m_inputBinds?.isBindPressed?.(31));
}
// Time to first intersection with the player's collision circle, in seconds.
export function incomingShotTime(bullet, center, radius=1) {
    if(!bullet?.alive || bullet.collided || !(bullet.speed>0)) return Infinity;
    const p=position(bullet.pos), d=bullet.dir, length=Math.hypot(d?.x,d?.y);
    if(![p.x,p.y,center.x,center.y,length,bullet.speed,radius].every(Number.isFinite) || length<=0 || radius<=0) return Infinity;
    const x=d.x/length,y=d.y/length,dx=center.x-p.x,dy=center.y-p.y;
    const along=dx*x+dy*y, perpendicular2=Math.max(0,dx*dx+dy*dy-along*along);
    if(along<=0 || perpendicular2>radius*radius) return Infinity;
    const distance=Math.max(0,along-Math.sqrt(radius*radius-perpendicular2));
    if(bullet.startPos && Number.isFinite(bullet.distance)) {
        const remaining=bullet.distance-Math.hypot(p.x-bullet.startPos.x,p.y-bullet.startPos.y);
        if(distance>remaining) return Infinity;
    }
    const time=distance/bullet.speed;
    return time<=1.5 ? time : Infinity;
}
export function selectPanDefense(game,state,teamOf) {
    if (!canDefend(game,state)) return null;
    const me=game.m_activePlayer, camera=game.m_camera;
    const start=position(me.m_pos), origin=camera.m_pointToScreen(start);
    const mouse=position(game.m_input.mousePos), team=teamOf(me);
    let target=null, best=Infinity, bestTime=Infinity, incoming=null;
    for(const p of game.m_playerBarn.playerPool.m_pool){
        if(!p.active || p.__id===me.__id || p.m_netData?.m_dead || p.downed || p.layer!==me.layer ||
           (team!=null && teamOf(p)===team) || state.friends.includes(p.nameText?._text)) continue;
        const end=position(p.m_pos), angle=angleFromMouse(origin,mouse,camera.m_pointToScreen(end));
        if(angle>state.aimConeDegrees/2 || !clearShot(start,end,me.layer,game.m_map.m_obstaclePool.m_pool)) continue;
        let shot=null, eta=Infinity;
        for(const bullet of game.m_bulletBarn?.bullets || []) {
            if(bullet.playerId!==p.__id || bullet.layer!==me.layer) continue;
            const time=incomingShotTime(bullet,start,me.m_rad || 1);
            if(time<eta && clearShot(position(bullet.pos),start,me.layer,game.m_map.m_obstaclePool.m_pool)){eta=time;shot=bullet;}
        }
        if(eta<bestTime || (eta===bestTime && angle<best)) {
            best=angle;bestTime=eta;target=p;incoming=shot;
        }
    }
    if(!target) return null;
    const dir=panFacingDirection(me.m_getPanSegment?.(),start,position(incoming?.pos || target.m_pos));
    if(!dir) return null;
    const screen=camera.m_pointToScreen({x:start.x+dir.x*10,y:start.y+dir.y*10});
    return {game,player:me,target,dir,screen,incoming,arrivalTime:bestTime};
}
export function activePanDefense(game,state) {
    const value=state.panDefense;
    return canDefend(game,state) && value?.game===game && value.player===game.m_activePlayer &&
        value.target?.active && !value.target.m_netData?.m_dead && value.target.layer===value.player.layer ? value : null;
}
