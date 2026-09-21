import { test } from 'node:test';
import assert from 'node:assert/strict';
import { simulateThrow, sweep } from '../src/throwPhysics.js';
import { createCookTimer, createProjectileTracker } from '../src/throwTimers.js';
const def={rad:1,fuseTime:4,throwPhysics:{speed:20,velZ:5,playerVelMult:0.6}};
const initial={pos:{x:0,y:0},velocity:{x:20,y:0}};
const wall={active:true,collidable:true,layer:0,height:10,collider:{type:1,min:{x:4,y:-5},max:{x:5,y:5}}};
test('bounce reverses movement, retains fuse, records landing and handles impact fuse',()=>{
    const r=simulateThrow(initial,def,[wall]);
    assert.equal(r.collisions.length,1);assert.ok(r.end.x<r.collisions[0].x);assert.ok(r.landing);assert.ok(Math.abs(r.time-4)<1e-8);
    const impact=simulateThrow(initial,{...def,explodeOnImpact:true},[wall]);
    assert.equal(impact.impact,true);assert.ok(impact.time<1);assert.ok(impact.end.x<4);
    const cooked=simulateThrow(initial,def,[],0,0.1);assert.equal(cooked.landing,null);assert.ok(cooked.end.x<3);
    assert.equal(simulateThrow(initial,def,[],0,0).time,0);
});
test('sweeps catch thin walls at high speed, circular obstacles and projectile radius',()=>{
    const h=sweep({x:0,y:0},{x:100,y:0},{type:1,min:{x:10,y:-2},max:{x:10.01,y:2}},0.25);
    assert.equal(h.normal.x,-1);assert.ok(h.point.x<10);
    const c=sweep({x:0,y:0},{x:100,y:0},{type:0,pos:{x:10,y:0},rad:1},0.25);
    assert.equal(c.normal.x,-1);assert.equal(c.point.x,8.75);
});
test('cook timer clamps at zero without restarting and resets for a new cook',()=>{
    const timer=createCookTimer(),me={active:true,throwableState:'cook',m_localData:{m_curWeapIdx:3},m_netData:{m_activeWeapon:'frag',m_animSeq:1}};
    const d={...def,cookable:true};
    assert.equal(timer(me,d,0).remaining,4);assert.equal(timer(me,d,1500).remaining,2.5);
    assert.equal(timer(me,d,5000).remaining,0);assert.equal(timer(me,d,6000).remaining,0);
    me.throwableState='equip';assert.equal(timer(me,d,6100).cooking,false);
    me.throwableState='cook';assert.equal(timer(me,d,6200).remaining,4);
});
test('projectile tracker uses first observation bounds and resets pooled objects',()=>{
    const track=createProjectileTracker(),p={__id:1,active:true,type:'frag',pos:{x:0,y:0},posZ:1};
    const game={m_projectileBarn:{projectilePool:{m_pool:[p]}}},defs={frag:def};
    assert.equal(track(game,defs,0)[0].remaining,4);
    p.pos.x=2;const r=track(game,defs,100)[0];assert.equal(r.remaining,3.9);assert.equal(r.velocity.x,20);
    assert.equal(track(game,defs,5000)[0].remaining,0);
    p.__id=2;assert.equal(track(game,defs,5100)[0].remaining,4);
    p.active=false;assert.deepEqual(track(game,defs,5200),[]);
});
