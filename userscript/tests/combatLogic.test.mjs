import { test } from 'node:test';
import assert from 'node:assert/strict';
import { panBlocks, targetScore, chooseWeapon, previewThrow, weaponScore } from '../src/combatLogic.js';
test('throw passes breakable windows but bounces at reinforced windows and subsequent walls',()=>{
    const def={fuseTime:4,throwPhysics:{speed:20,velZ:5,playerVelMult:0.6}};
    const window={type:'window',isWindow:true,destructible:true,healthT:1,active:true,collidable:true,height:10,layer:0,collider:{type:1,min:{x:4,y:-3},max:{x:5,y:3}}};
    const simulate=(obstacles,health=1)=>previewThrow({x:0,y:0},{x:18,y:0},def,{x:0,y:0},obstacles,0,4,{window:{health}});
    assert.equal(simulate([window]).blocked,false);
    assert.equal(simulate([window],75).collisions.length,1);
    assert.equal(simulate([{...window,healthT:0.01}],75).blocked,false);
    assert.equal(simulate([{...window,healthT:undefined}]).collisions.length,1);
    assert.equal(simulate([{...window,destructible:false}]).collisions.length,1);
    const wall={...window,isWindow:false,collider:{type:1,min:{x:10,y:-3},max:{x:11,y:3}}};
    const hit=simulate([window,wall]);assert.equal(hit.collisions.length,1);assert.ok(hit.collisions[0].x>5);
    assert.equal(window.healthT,1);assert.equal(window.dead,undefined);
    assert.equal(simulate([{...wall,layer:1}]).blocked,false);
});
test('throw broad phase reads distant colliders once instead of every physics step',()=>{
    let reads=0;
    const far=Array.from({length:2000},(_,i)=>({active:true,collidable:true,height:5,layer:0,get collider(){reads++;return {type:0,pos:{x:i,y:500},rad:1};}}));
    const def={fuseTime:4,throwPhysics:{speed:20,velZ:5,playerVelMult:0}};
    const result=previewThrow({x:0,y:0},{x:18,y:0},def,{x:0,y:0},far);
    assert.equal(result.blocked,false);assert.equal(reads,2000);assert.ok(result.points.length>200);
    assert.deepEqual(result,previewThrow({x:0,y:0},{x:18,y:0},def));
});
test('pan protection rotates with the actual player direction',()=>{
    const player={m_pos:{x:10,y:0},m_dir:{x:1,y:0},m_hasActivePan:()=>true,m_getPanSegment:()=>({p0:{x:-1,y:-2},p1:{x:-1,y:2}})};
    assert.equal(panBlocks({x:0,y:0},{x:10,y:0},player),true);
    player.m_dir={x:-1,y:0};
    assert.equal(panBlocks({x:0,y:0},{x:10,y:0},player),false);
});
test('weapon selection respects range, ammo, throwable and one-gun modes',()=>{
    const guns={short:{bulletType:'short'},long:{bulletType:'long'}};
    const bullets={short:{distance:20,speed:100},long:{distance:100,speed:200}};
    const weapons=[{type:'short',ammo:2},{type:'long',ammo:4},{type:'fists'}];
    assert.equal(chooseWeapon(weapons,0,40,guns,bullets,false,false),1);
    assert.equal(chooseWeapon(weapons,0,40,guns,bullets,true,false),0);
    assert.equal(chooseWeapon(weapons,3,40,guns,bullets,false,false),3);
    assert.equal(chooseWeapon(weapons,0,2,guns,bullets,false,true),2);
    weapons[1].ammo=0;
    assert.equal(chooseWeapon(weapons,0,40,guns,bullets,false,false),0);
    assert.equal(weaponScore(guns.short,bullets.short,30),Infinity);
});
test('threat priority favors enemies facing and approaching the player',()=>{
    const args={angle:10,range:10,me:{m_pos:{x:0,y:0}},enemy:{m_pos:{x:10,y:0},m_dir:{x:-1,y:0}},threat:true,velocity:{x:-3,y:0}};
    const facing=targetScore(args);
    args.enemy.m_dir.x=1; args.velocity.x=3;
    assert.ok(facing<targetScore(args));
    assert.equal(targetScore({...args,threat:false}),10);
});
test('throw estimation scales with mouse distance and bounces at collisions',()=>{
    const def={fuseTime:4,throwPhysics:{speed:20,velZ:5,playerVelMult:0.6}};
    const a={x:0,y:0};
    const near=previewThrow(a,{x:3,y:0},def), far=previewThrow(a,{x:18,y:0},def);
    assert.ok(far.end.x>near.end.x);
    assert.equal(far.blocked,false);
    const wall={active:true,collidable:true,height:5,layer:0,collider:{type:1,min:{x:4,y:-3},max:{x:5,y:3}}};
    assert.equal(previewThrow(a,{x:18,y:0},def,{x:0,y:0},[wall]).collisions.length,1);
    assert.equal(previewThrow(a,a,def),null);
});
