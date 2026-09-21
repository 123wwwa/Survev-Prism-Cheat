// Swept circle against world-space circle/AABB obstacles. AABB corners are conservative.
export function sweep(a,b,c,r=0) {
    const dx=b.x-a.x,dy=b.y-a.y;
    if(c?.type===0){
        const x=a.x-c.pos.x,y=a.y-c.pos.y,rad=c.rad+r,A=dx*dx+dy*dy;
        const C=x*x+y*y-rad*rad, B=x*dx+y*dy;
        let t;
        if(C<=0)t=0;
        else {const D=B*B-A*C;if(!A||D<0)return null;t=(-B-Math.sqrt(D))/A;}
        if(t<0||t>1)return null;
        const px=a.x+dx*t,py=a.y+dy*t,len=Math.hypot(px-c.pos.x,py-c.pos.y)||1;
        return {t,point:{x:px,y:py},normal:{x:(px-c.pos.x)/len,y:(py-c.pos.y)/len}};
    }
    if(c?.type===1){
        let lo=0,hi=1,normal=null;
        for(const axis of ['x','y']){
            const delta=b[axis]-a[axis],min=c.min[axis]-r,max=c.max[axis]+r;
            if(Math.abs(delta)<1e-9){if(a[axis]<min||a[axis]>max)return null;continue;}
            const t1=(min-a[axis])/delta,t2=(max-a[axis])/delta,near=Math.min(t1,t2);
            if(near>=lo){lo=near;normal=axis==='x'?{x:-Math.sign(delta),y:0}:{x:0,y:-Math.sign(delta)};}
            hi=Math.min(hi,Math.max(t1,t2));if(lo>hi)return null;
        }
        if(!normal){ // Already overlapping: use the nearest face.
            const faces=[{d:Math.abs(a.x-c.min.x+r),x:-1,y:0},{d:Math.abs(c.max.x+r-a.x),x:1,y:0},{d:Math.abs(a.y-c.min.y+r),x:0,y:-1},{d:Math.abs(c.max.y+r-a.y),x:0,y:1}];
            faces.sort((a,b)=>a.d-b.d);normal=faces[0];
        }
        return {t:lo,point:{x:a.x+dx*lo,y:a.y+dy*lo},normal};
    }
    return null;
}

export function simulateThrow(initial,def,obstacles=[],layer=0,remaining=def.fuseTime,defs={}) {
    if(!def.throwPhysics||!Number.isFinite(remaining)||remaining<0)return null;
    let p={...initial.pos},v={...initial.velocity},z=initial.z??0.5,vz=initial.vz??def.throwPhysics.velZ;
    if(![p.x,p.y,v.x,v.y,z,vz].every(Number.isFinite))return null;
    const duration=Math.min(remaining,10),r=(def.rad||0)/4;
    const reach=Math.hypot(v.x,v.y)*(duration+1/60)+r+1;
    const candidates=obstacles.filter(o=>{
        if(!o.active||o.dead||!o.collidable||!((o.layer&1)===(layer&1)||(o.layer&2&&layer&2)))return false;
        const c=o.collider;
        if(c?.type===0)return Math.hypot(c.pos.x-p.x,c.pos.y-p.y)<=reach+c.rad;
        if(c?.type===1)return c.max.x>=p.x-reach&&c.min.x<=p.x+reach&&c.max.y>=p.y-reach&&c.min.y<=p.y+reach;
        return false;
    }).map(o=>({o,c:o.collider}));
    const points=[{...p}],collisions=[],broken=new Set();
    let landing=z<=0?{...p}:null,elapsed=0,floor=0,impact=false;
    for(let tick=0;tick<Math.ceil(duration*60);tick++){
        const dt=Math.min(1/60,duration-elapsed);if(dt<=0)break;
        if(z<=floor){v.x/=1+dt*2.3;v.y/=1+dt*2.3;}
        vz-=10.5*dt;z=Math.max(floor,Math.min(5,z+vz*dt));
        const height=def.throwPhysics.fixedCollisionHeight||z;
        let left=dt,nextFloor=0;
        for(let contact=0;contact<4&&left>1e-6;contact++){
            const next={x:p.x+v.x*left,y:p.y+v.y*left};let hit=null;
            for(const item of candidates){
                const {o,c}=item;if(broken.has(o))continue;
                const h=sweep(p,next,c,r);if(!h)continue;
                if(o.height<=height){if(sweep(next,next,c,r))nextFloor=Math.max(nextFloor,o.height);continue;}
                const hp=defs?.[o.type]?.health*o.healthT;
                if(o.isWindow&&o.destructible&&Number.isFinite(hp)&&hp<=1){broken.add(o);continue;}
                if(v.x*h.normal.x+v.y*h.normal.y>=0)continue;
                if(!hit||h.t<hit.t)hit=h;
            }
            if(!hit){p=next;break;}
            p={x:hit.point.x+hit.normal.x*0.1,y:hit.point.y+hit.normal.y*0.1};
            collisions.push({...p});points.push({...p});
            if(def.explodeOnImpact){impact=true;break;}
            const speed=Math.hypot(v.x,v.y),dot=(v.x*hit.normal.x+v.y*hit.normal.y)/(speed||1);
            const scale=Math.max(1+dot,0.15),projection=v.x*hit.normal.x+v.y*hit.normal.y;
            v={x:(v.x-2*projection*hit.normal.x)*scale,y:(v.y-2*projection*hit.normal.y)*scale};
            left*=1-hit.t;
        }
        floor=nextFloor;elapsed+=dt;points.push({...p});
        if(z<=floor){if(!landing)landing={...p};if(def.explodeOnImpact)impact=true;}
        if(impact)break;
    }
    return {points,end:p,landing,collisions,blocked:false,time:elapsed,impact};
}

export function previewThrow(start,target,def,velocity={x:0,y:0},obstacles=[],layer=0,remaining=def.fuseTime,defs={}) {
    const physics=def.throwPhysics,dx=target.x-start.x,dy=target.y-start.y,len=Math.hypot(dx,dy);
    if(!physics||!len)return null;
    const dir={x:dx/len,y:dy/len},strength=def.forceMaxThrowDistance?1:Math.min(1,len/18);
    return simulateThrow({pos:{x:start.x+dir.x*0.5+dir.y,y:start.y+dir.y*0.5-dir.x},velocity:{x:dir.x*physics.speed*strength+velocity.x*physics.playerVelMult,y:dir.y*physics.speed*strength+velocity.y*physics.playerVelMult}},def,obstacles,layer,remaining,defs);
}
