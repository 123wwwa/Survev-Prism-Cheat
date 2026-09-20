import { test } from 'node:test';
import assert from 'node:assert/strict';
import { incomingShotTime, panFacingDirection, canDefend, selectPanDefense, activePanDefense } from '../src/panDefense.js';
const segment={p0:{x:-0.625,y:-1.2},p1:{x:-1.4,y:-0.25}};
function fixture(){
 const me={__id:1,active:true,layer:0,m_pos:{x:0,y:0},m_netData:{m_wearingPan:true},m_localData:{m_curWeapIdx:0},currentAnim:()=>0,m_getPanSegment:()=>segment};
 const enemy={__id:2,active:true,layer:0,m_pos:{x:10,y:0},m_netData:{},nameText:{_text:'enemy'}};
 const game={m_connection:{},m_activePlayer:me,m_touch:{},m_inputBinds:{isBindDown:()=>false},m_input:{mousePos:{_x:100,_y:0}},m_camera:{m_pointToScreen:p=>p},m_playerBarn:{playerPool:{m_pool:[me,enemy]}},m_map:{m_obstaclePool:{m_pool:[]}}};
 const state={isPanDefenseEnabled:true,aimConeDegrees:60,friends:[]};
 return {game,state,me,enemy};
}
test('back pan midpoint faces attacker for all quadrants',()=>{
 for(const target of [{x:10,y:0},{x:-10,y:0},{x:0,y:10},{x:0,y:-10}]){
  const d=panFacingDirection(segment,{x:0,y:0},target);
  const x=(segment.p0.x+segment.p1.x)/2,y=(segment.p0.y+segment.p1.y)/2;
  const rx=x*d.x-y*d.y,ry=x*d.y+y*d.x;
  assert.ok(Math.abs(rx*target.y-ry*target.x)<1e-8);
  assert.ok(rx*target.x+ry*target.y>0);
 }
});
test('attack, melee animation, menu, removal, death and throwable immediately override defense',()=>{
 for(const mutate of [f=>f.game.m_touch.shotDetected=true,f=>f.game.m_inputBinds.isBindDown=()=>true,f=>f.me.currentAnim=()=>1,f=>f.state.isMenuOpen=true,f=>f.me.m_netData.m_wearingPan=false,f=>f.me.m_netData.m_dead=true,f=>f.me.m_localData.m_curWeapIdx=3,f=>f.state.isPanDefenseEnabled=false]){
  const f=fixture();f.state.panDefense=selectPanDefense(f.game,f.state,p=>p.__id);
  assert.ok(activePanDefense(f.game,f.state));mutate(f);
  assert.equal(canDefend(f.game,f.state),false);assert.equal(activePanDefense(f.game,f.state),null);
 }
});
test('selection excludes friends, other floors, cone and cover',()=>{
 for(const mutate of [f=>f.state.friends=['enemy'],f=>f.enemy.layer=1,f=>f.enemy.m_pos={x:0,y:10},f=>f.game.m_map.m_obstaclePool.m_pool=[{active:true,layer:0,height:1,collider:{type:0,pos:{x:5,y:0},rad:1}}]]){
  const f=fixture();mutate(f);assert.equal(selectPanDefense(f.game,f.state,p=>p.__id),null);
 }
});

test('shot priority uses approach, speed, remaining range and time to collision',()=>{
 const b={alive:true,pos:{x:10,y:0},dir:{x:-1,y:0},speed:10};
 assert.equal(incomingShotTime(b,{x:0,y:0},1),0.9);
 assert.equal(incomingShotTime({...b,speed:100},{x:0,y:0},1),0.09);
 assert.equal(incomingShotTime({...b,dir:{x:1,y:0}},{x:0,y:0}),Infinity);
 assert.equal(incomingShotTime({...b,pos:{x:10,y:3}},{x:0,y:0}),Infinity);
 assert.equal(incomingShotTime({...b,startPos:{x:10,y:0},distance:5},{x:0,y:0}),Infinity);
 const f=fixture();
 const other={...f.enemy,__id:3,m_pos:{x:20,y:2}};
 f.game.m_playerBarn.playerPool.m_pool.push(other);
 f.game.m_bulletBarn={bullets:[{...b,playerId:2,layer:0},{...b,playerId:3,layer:0,pos:{x:20,y:0},speed:100}]};
 const defense=selectPanDefense(f.game,f.state,p=>p.__id);
 assert.equal(defense.target.__id,3);assert.equal(defense.arrivalTime,0.19);
});
