import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import vm from 'node:vm';
import { position, angleFromMouse } from '../src/aimGeometry.js';
import { createCookTimer } from '../src/throwTimers.js';

test('preview throttles simulation, reuses canvas storage, and hides immediately',()=>{
    let now=0, simulations=0, resizes=0, clears=0, width=300, height=150;
    const ctx={clearRect(){clears++;},setLineDash(){},beginPath(){},moveTo(){},lineTo(){},stroke(){},fillText(){},arc(){},strokeRect(){}};
    const canvas={style:{},getContext:()=>ctx,get width(){return width;},set width(v){width=v;resizes++;},get height(){return height;},set height(v){height=v;resizes++;}};
    const me={__id:1,m_pos:{x:0,y:0},m_netData:{m_activeWeapon:'frag'},m_localData:{m_curWeapIdx:3}};
    const game={m_camera:{m_screenToPoint:p=>p,m_pointToScreen:p=>p},m_input:{mousePos:{x:18,y:0}},m_map:{m_obstaclePool:{m_pool:[]}},m_playerBarn:{playerPool:{m_pool:[]}}};
    const state={isThrowPreviewEnabled:true},window={innerWidth:1920,innerHeight:1080};
    const context=vm.createContext({game,me,state,window,position,angleFromMouse,cookTimer:createCookTimer(),getTeam:()=>1,performance:{now:()=>now},unsafeWindow:{throwable:{frag:{fuseTime:4}},objects:{}},document:{createElement:()=>canvas,body:{append(){}}},previewThrow(){simulations++;return {points:[{x:0,y:0},{x:10,y:0}],end:{x:10,y:0},time:4,collisions:[]};}});
    const code=readFileSync(new URL('../src/plugins/combatAssist.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
    vm.runInContext(code,context);
    const draw=()=>vm.runInContext('drawPreview(game,me)',context);
    for(now=0;now<1000;now+=10)draw();
    assert.equal(simulations,20);assert.equal(resizes,2);assert.equal(clears,20);
    window.innerWidth=1000;now=1000;draw();assert.equal(resizes,3);
    state.isThrowPreviewEnabled=false;now=1001;draw();assert.equal(canvas.style.display,'none');
    state.isThrowPreviewEnabled=true;draw();assert.equal(canvas.style.display,'block');assert.equal(simulations,22);
    me.m_localData.m_curWeapIdx=0;draw();assert.equal(canvas.style.display,'none');
});
