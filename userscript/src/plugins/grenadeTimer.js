import { state } from '../vars.js';
import { cookTimer, createProjectileTracker } from '../throwTimers.js';
import { simulateThrow } from '../throwPhysics.js';
import { position } from '../aimGeometry.js';

const track=createProjectileTracker();
let canvas,ctx,lastDraw=-Infinity;
let cacheGame,predictions=new WeakMap();
export function grenadeTimer(){
    const game=unsafeWindow.game,me=game?.m_activePlayer,defs=unsafeWindow.throwable;
    const now=performance.now(),cook=cookTimer(me,defs?.[me?.m_netData?.m_activeWeapon],now);
    if(cacheGame!==game){cacheGame=game;predictions=new WeakMap();}
    // Observe lifecycle even while hidden so an already visible projectile never gets a fresh fuse.
    const projectiles=track(game,defs,now);
    if(!game?.m_connection||!me?.active||me.m_netData?.m_dead||state.isMenuOpen||!state.isThrowPreviewEnabled){
        if(canvas)canvas.style.display='none';lastDraw=-Infinity;return;
    }
    if(now-lastDraw<100)return;
    lastDraw=now;
    if(!canvas){canvas=document.createElement('canvas');Object.assign(canvas.style,{position:'fixed',inset:'0',pointerEvents:'none',zIndex:'899'});document.body.append(canvas);ctx=canvas.getContext('2d');}
    canvas.style.display='block';
    if(canvas.width!==window.innerWidth)canvas.width=window.innerWidth;
    if(canvas.height!==window.innerHeight)canvas.height=window.innerHeight;
    ctx.clearRect(0,0,canvas.width,canvas.height);ctx.font='bold 12px system-ui';ctx.lineWidth=1.5;
    const camera=game.m_camera;
    function label(pos,text,color){const s=camera.m_pointToScreen(pos);ctx.fillStyle=color;ctx.strokeStyle='#111';ctx.lineWidth=3;ctx.strokeText(text,s.x+10,s.y-14);ctx.fillText(text,s.x+10,s.y-14);ctx.lineWidth=1.5;}
    if(cook.cooking)label(position(me.m_pos),`FUSE ~${cook.remaining.toFixed(1)}s`,cook.remaining<1?'#ff6677':'#65e7cf');
    // Bound rendering/physics work in MIRV-heavy scenes; closest visible threats first.
    const origin=position(me.m_pos);
    projectiles.filter(x=>x.projectile.layer===me.layer).sort((a,b)=>Math.hypot(a.projectile.pos.x-origin.x,a.projectile.pos.y-origin.y)-Math.hypot(b.projectile.pos.x-origin.x,b.projectile.pos.y-origin.y)).slice(0,12).forEach(item=>{
        const {projectile:p,def,remaining,velocity,vz}=item;
        const s=camera.m_pointToScreen(p.pos);
        if(s.x<-100||s.y<-100||s.x>canvas.width+100||s.y>canvas.height+100)return;
        const color=remaining<1?'#ff6677':'#ffcc77';
        label(p.pos,def.explodeOnImpact?'IMPACT':remaining>0?`FUSE ≤${remaining.toFixed(1)}s`:'FUSE ?',color);
        if(!velocity||remaining<=0||remaining>10)return;
        let cached=predictions.get(p);
        if(!cached||cached.id!==p.__id||cached.type!==p.type||now-cached.time>=200){
            cached={id:p.__id,type:p.type,time:now,path:simulateThrow({pos:p.pos,velocity,z:p.posZ,vz},def,game.m_map.m_obstaclePool.m_pool,p.layer,remaining,unsafeWindow.objects)};
            predictions.set(p,cached);
        }
        const path=cached.path;
        if(!path)return;
        ctx.strokeStyle=color;ctx.setLineDash([3,6]);ctx.beginPath();
        path.points.forEach((point,i)=>{if(i%4&&i!==path.points.length-1)return;const q=camera.m_pointToScreen(point);i?ctx.lineTo(q.x,q.y):ctx.moveTo(q.x,q.y);});ctx.stroke();ctx.setLineDash([]);
        const end=camera.m_pointToScreen(path.end);ctx.beginPath();ctx.arc(end.x,end.y,5,0,Math.PI*2);ctx.stroke();
        const radius=unsafeWindow.explosions?.[def.explosionType]?.rad?.max;
        if(Number.isFinite(radius)){
            const edge=camera.m_pointToScreen({x:path.end.x+radius,y:path.end.y});
            ctx.setLineDash([3,6]);ctx.beginPath();ctx.arc(end.x,end.y,Math.abs(edge.x-end.x),0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);
        }
        // For foreign grenades the endpoint is a scenario at maximum fuse, not an exact detonation point.
        label(path.end,def.explodeOnImpact?'Impact estimate':'Max-fuse endpoint',color);
    });
}
