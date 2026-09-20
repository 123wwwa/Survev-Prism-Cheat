import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { angleFromMouse, clearShot, intersectsSegment, position } from '../src/aimGeometry.js';

test('mouse cone uses angles, handles wraparound and rejects invalid directions', () => {
    assert.equal(angleFromMouse({x:0,y:0}, {x:1,y:0}, {x:2,y:0}), 0);
    assert.equal(angleFromMouse({x:0,y:0}, {x:1,y:0}, {x:0,y:2}), 90);
    assert.equal(angleFromMouse({x:0,y:0}, {x:0,y:0}, {x:2,y:0}), Infinity);
    assert.ok(angleFromMouse({x:0,y:0}, {x:-1,y:0.01}, {x:-1,y:-0.01}) < 2);
});
test('cover checks circles, boxes, parallel rays, layers and destroyed obstacles', () => {
    const a={x:0,y:0}, b={x:10,y:0};
    const circle={type:0,pos:{x:5,y:0},rad:1};
    const box={type:1,min:{x:4,y:-1},max:{x:6,y:1}};
    assert.equal(intersectsSegment(a,b,circle),true);
    assert.equal(intersectsSegment(a,b,box),true);
    assert.equal(intersectsSegment(a,{x:0,y:10},box),false);
    assert.equal(intersectsSegment(a,b,{...circle,pos:{x:15,y:0}}),false);
    const obstacle={active:true,dead:false,layer:0,height:1,collider:box};
    assert.equal(clearShot(a,b,0,[obstacle]),false);
    for (const change of [{dead:true},{active:false},{layer:1},{height:0.1}]) assert.equal(clearShot(a,b,0,[{...obstacle,...change}]),true);
    assert.equal(clearShot(a,b,0,undefined),false);
});

const code=readFileSync(new URL('../src/plugins/aimbot.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
function fixture() {
    const me={__id:1,active:true,layer:0,m_netData:{m_dead:false},m_pos:{_x:0,_y:0}};
    const enemy={__id:2,active:true,layer:0,m_netData:{m_dead:false},m_pos:{_x:10,_y:0},nameText:{_text:'enemy'}};
    const state={isAimBotEnabled:true,aimConeDegrees:60,isAimAtKnockedOutEnabled:true,friends:[],lastFrames:{}};
    const game={m_activePlayer:me,m_playerBarn:{playerPool:{m_pool:[me,enemy]}},m_map:{m_obstaclePool:{m_pool:[]}},m_camera:{m_pointToScreen:p=>p},m_input:{mousePos:{_x:100,_y:0}}};
    const context=vm.createContext({state,unsafeWindow:{game},aimbotDot:{style:{}},position,angleFromMouse,clearShot,getTeam:p=>p.__id,updateOverlay(){},findWeap(){},findBullet(){},performance:{now:()=>100},console:{log(){},error(e){throw e;}}});
    vm.runInContext(code,context);
    return {context,state,game,enemy,run:()=>vm.runInContext('aimBot()',context)};
}
test('focused targets obey cone, layer and cover; stale aiming clears immediately', () => {
    for (const change of [f=>f.enemy.layer=1,f=>f.enemy.m_pos={_x:0,_y:10},f=>f.game.m_map.m_obstaclePool.m_pool.push({active:true,layer:0,height:1,collider:{type:0,pos:{x:5,y:0},rad:1}})]) {
        const f=fixture(); f.run(); assert.ok(f.context.unsafeWindow.lastAimPos);
        f.state.focusedEnemy=f.enemy; change(f); f.run();
        assert.equal(f.context.unsafeWindow.lastAimPos,null);
        assert.equal(f.context.unsafeWindow.aimTouchMoveDir,null);
        assert.equal(f.state.focusedEnemy,null);
    }
});
test('opening menu or disabling aim clears aim state', () => {
    for (const change of [f=>f.state.isMenuOpen=true,f=>f.state.isAimBotEnabled=false]) {
        const f=fixture(); f.run(); change(f); f.run();
        assert.equal(f.context.unsafeWindow.lastAimPos,null);
        assert.equal(f.context.aimbotDot.style.display,'none');
    }
});
