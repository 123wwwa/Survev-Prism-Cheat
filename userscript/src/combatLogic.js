import { position, intersectsSegment } from './aimGeometry.js';
const distance = (a,b) => Math.hypot(a.x-b.x,a.y-b.y);
export function segmentCross(a,b,c,d) {
    const rx=b.x-a.x, ry=b.y-a.y, sx=d.x-c.x, sy=d.y-c.y;
    const cross=rx*sy-ry*sx;
    if (Math.abs(cross)<1e-8) return false;
    const t=((c.x-a.x)*sy-(c.y-a.y)*sx)/cross;
    const u=((c.x-a.x)*ry-(c.y-a.y)*rx)/cross;
    return t>=0 && t<=1 && u>=0 && u<=1;
}
export function panBlocks(start, end, player) {
    if (!player.m_hasActivePan?.()) return false;
    const seg=player.m_getPanSegment?.(), p=position(player.m_pos), dir=player.m_dir;
    if (!seg || !dir) return false;
    const angle=Math.atan2(dir.y,dir.x), c=Math.cos(angle), s=Math.sin(angle);
    const transform=q=>({x:p.x+q.x*c-q.y*s,y:p.y+q.x*s+q.y*c});
    return segmentCross(start,end,transform(seg.p0),transform(seg.p1));
}
export function blockingCover(start,end,layer,obstacles) {
    if (!Array.isArray(obstacles)) return null;
    return obstacles.filter(o=>o.active && !o.dead &&
        ((o.layer&1)===(layer&1) || (o.layer&2 && layer&2)) && o.height>=0.25 && intersectsSegment(start,end,o.collider));
}
export function weaponScore(gun, bullet, range) {
    if (!gun || !bullet || !Number.isFinite(bullet.distance) || range>bullet.distance) return Infinity;
    const spread=Math.max(0,gun.shotSpread||0)*Math.PI/180;
    const pelletCount=gun.bulletCount || 1;
    // Heuristic, not a probability: penalize broad spread and slow travel.
    return range/Math.max(1,bullet.distance) + spread*range/(pelletCount>1 ? 2 : 5) + range/Math.max(1,bullet.speed||1);
}
export function targetScore({angle,range,gun,bullet,threat,weaponAware,me,enemy,velocity}) {
    let score=angle;
    if (weaponAware) { const suitability=weaponScore(gun,bullet,range); if (!Number.isFinite(suitability)) return Infinity; score+=suitability*12; }
    if (threat) {
        const a=position(me.m_pos), b=position(enemy.m_pos), len=Math.max(0.001,range);
        const toward={x:(a.x-b.x)/len,y:(a.y-b.y)/len};
        const dir=enemy.m_dir, dlen=dir?Math.hypot(dir.x,dir.y):0;
        const facing=dlen?Math.max(0,(dir.x*toward.x+dir.y*toward.y)/dlen):0;
        const approach=velocity?Math.max(0,velocity.x*toward.x+velocity.y*toward.y):0;
        score-=facing*8 + Math.max(0,1-range/40)*8 + Math.min(6,approach)*1.5;
    }
    return score;
}
export function chooseWeapon(weapons,current,range,guns,bullets,useOneGun,melee,reloading=false) {
    if (useOneGun || current===3) return current;
    if (melee && range<=4 && weapons[2]?.type) return 2;
    const candidates=[0,1].map(slot=>({slot,score:weapons[slot]?.ammo>0 && !(reloading && slot===current) ? weaponScore(guns[weapons[slot].type],bullets[guns[weapons[slot].type]?.bulletType],range) : Infinity}));
    candidates.sort((a,b)=>a.score-b.score);
    const best=candidates[0], own=candidates.find(c=>c.slot===current);
    return Number.isFinite(best.score) && (!Number.isFinite(own?.score) || best.score+0.3<own.score) ? best.slot : current;
}
export { previewThrow } from './throwPhysics.js';
export { distance };
