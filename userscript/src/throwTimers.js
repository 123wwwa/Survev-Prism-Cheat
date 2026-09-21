export function createCookTimer(){
    let player,type,started,seq;
    return (me,def,now)=>{
        const cooking=me?.active&&!me.m_netData?.m_dead&&me.m_localData?.m_curWeapIdx===3&&me.throwableState==='cook'&&def?.cookable;
        if(!cooking){player=null;return {cooking:false,remaining:def?.fuseTime};}
        if(player!==me||type!==me.m_netData.m_activeWeapon||seq!==me.m_netData.m_animSeq){player=me;type=me.m_netData.m_activeWeapon;seq=me.m_netData.m_animSeq;started=now;}
        return {cooking:true,remaining:Math.max(0,def.fuseTime-(now-started)/1000)};
    };
}
export const cookTimer=createCookTimer();

// Fuse time and thrower ID are not replicated. Never present first-seen time as exact fuse age.
export function createProjectileTracker(){
    const records=new Map();let previousGame;
    return (game,defs,now)=>{
        if(game!==previousGame){records.clear();previousGame=game;}
        const seen=new Set(),result=[];
        for(const p of game?.m_projectileBarn?.projectilePool?.m_pool||[]){
            const def=defs?.[p.type];if(!p.active||!def||!Number.isFinite(def.fuseTime))continue;
            seen.add(p);let old=records.get(p);
            if(!old||old.id!==p.__id||old.type!==p.type){old={id:p.__id,type:p.type,first:now,time:now,pos:{...p.pos},z:p.posZ,velocity:null};records.set(p,old);}
            const dt=(now-old.time)/1000;
            if(dt>=0.05){
                old.velocity=dt<=0.5?{x:(p.pos.x-old.pos.x)/dt,y:(p.pos.y-old.pos.y)/dt}:null;
                old.vz=dt<=0.5?(p.posZ-old.z)/dt:0;
                old.pos={...p.pos};old.z=p.posZ;old.time=now;
            }
            result.push({projectile:p,def,remaining:Math.max(0,def.fuseTime+(def.fuseVariance||0)-(now-old.first)/1000),velocity:old.velocity,vz:old.vz});
        }
        for(const p of records.keys())if(!seen.has(p))records.delete(p);
        return result;
    };
}
