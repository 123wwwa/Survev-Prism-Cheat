import { state } from '../vars.js';
import { inputs, inputCommands } from '../overrideInputs.js';
import { getTeam } from '../utils.js';
import { position, angleFromMouse } from '../aimGeometry.js';
import { chooseWeapon, previewThrow } from '../combatLogic.js';
const samples=new Map();
let lastSwitch=0, previousGame;
export function observeMotion(player,now=performance.now()) {
    const p=position(player.m_pos), old=samples.get(player.__id);
    if(old && now-old.time<30) return old.velocity;
    const dt=old?(now-old.time)/1000:0;
    const velocity=dt>0 && dt<0.5 ? {x:(p.x-old.p.x)/dt,y:(p.y-old.p.y)/dt}:{x:0,y:0};
    samples.set(player.__id,{p,time:now,velocity}); return velocity;
}
export function combatAssist() {
    const game=unsafeWindow.game, me=game?.m_activePlayer;
    if(game!==previousGame){samples.clear();lastSwitch=0;previousGame=game;}
    if(!me?.active || me.m_netData?.m_dead || state.isMenuOpen){hidePreview();return;}
    for(const [id,sample] of samples) if(performance.now()-sample.time>2000) samples.delete(id);
    observeMotion(me);
    for (const player of game.m_playerBarn.playerPool.m_pool) if(player.active) observeMotion(player);
    const target=state.enemyAimBot;
    if(state.isSmartSwitchEnabled && target && !state.coverTarget && (game.m_touch.shotDetected || game.m_inputBinds.isBindDown(inputCommands.Fire)) && performance.now()-lastSwitch>700){
        const local=me.m_localData, a=position(me.m_pos),b=position(target.m_pos);
        const slot=chooseWeapon(local.m_weapons,local.m_curWeapIdx,Math.hypot(a.x-b.x,a.y-b.y),unsafeWindow.guns,unsafeWindow.bullets,state.isUseOneGunEnabled,state.isMeleeAttackEnabled,[1,2].includes(me.m_netData.m_actionType));
        if(slot!==local.m_curWeapIdx){inputs.push(['EquipPrimary','EquipSecondary','EquipMelee'][slot]);lastSwitch=performance.now();}
    }
    drawPreview(game,me);
}
let canvas,ctx;
function hidePreview(){if(canvas) canvas.style.display='none';}
function drawPreview(game,me){
    const def=unsafeWindow.throwable?.[me.m_netData.m_activeWeapon];
    if(!state.isThrowPreviewEnabled || !def || me.m_localData.m_curWeapIdx!==3){hidePreview();return;}
    const camera=game.m_camera, mouse=camera.m_screenToPoint(position(game.m_input.mousePos));
    const preview=previewThrow(position(me.m_pos),mouse,def,observeMotion(me),game.m_map.m_obstaclePool.m_pool,me.layer);
    if(!preview){hidePreview();return;}
    if(!canvas){canvas=document.createElement('canvas');Object.assign(canvas.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'900'});document.body.append(canvas);ctx=canvas.getContext('2d');}
    canvas.style.display='block';canvas.width=window.innerWidth;canvas.height=window.innerHeight;
    ctx.strokeStyle=preview.blocked?'#ffbb66':'#65e7cf';ctx.lineWidth=2;ctx.setLineDash([6,4]);ctx.beginPath();
    preview.points.forEach((p,i)=>{const s=camera.m_pointToScreen(p);i?ctx.lineTo(s.x,s.y):ctx.moveTo(s.x,s.y);});ctx.stroke();ctx.setLineDash([]);
    const end=camera.m_pointToScreen(preview.end), radius=unsafeWindow.explosions?.[def.explosionType]?.rad?.max;
    if(!preview.blocked && Number.isFinite(radius)){const edge=camera.m_pointToScreen({x:preview.end.x+radius,y:preview.end.y});ctx.beginPath();ctx.arc(end.x,end.y,Math.abs(edge.x-end.x),0,Math.PI*2);ctx.stroke();}
    const origin=camera.m_pointToScreen(position(me.m_pos)), rawMouse=position(game.m_input.mousePos), myTeam=getTeam(me);
    let candidate=null, best=Infinity;
    for(const p of game.m_playerBarn.playerPool.m_pool){
        if(!p.active || p.__id===me.__id || p.m_netData.m_dead || p.layer!==me.layer ||
           (!state.isAimAtKnockedOutEnabled && p.downed) || state.friends.includes(p.nameText?._text) || (myTeam!=null && getTeam(p)===myTeam)) continue;
        const a=angleFromMouse(origin,rawMouse,camera.m_pointToScreen(position(p.m_pos)));
        if(a<=state.aimConeDegrees/2 && a<best){candidate=p;best=a;}
    }
    if(candidate){
        const p=position(candidate.m_pos), v=observeMotion(candidate);
        const future=camera.m_pointToScreen({x:p.x+v.x*def.fuseTime,y:p.y+v.y*def.fuseTime});
        if(Number.isFinite(future.x)&&Number.isFinite(future.y)){
            ctx.strokeStyle='#f7c977';ctx.beginPath();ctx.moveTo(future.x-7,future.y);ctx.lineTo(future.x+7,future.y);ctx.moveTo(future.x,future.y-7);ctx.lineTo(future.x,future.y+7);ctx.stroke();
            ctx.fillStyle='#f7c977';ctx.font='12px system-ui';ctx.fillText('Target at full fuse (estimate)',future.x+10,future.y+12);
        }
    }
    ctx.fillStyle='#e8edf5';ctx.font='12px system-ui';ctx.fillText(preview.blocked?'Collision: bounce path unknown':'Estimated throw · full fuse · dry ground',end.x+10,end.y-10);
}
