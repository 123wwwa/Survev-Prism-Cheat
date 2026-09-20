import { test } from 'node:test';
import assert from 'node:assert/strict';
import vm from 'node:vm';
import { readFileSync } from 'node:fs';
import { position, clearShot } from '../src/aimGeometry.js';

test('ESP distinguishes blocked and tracked targets, initializes graphics, and refreshes cover cache',()=>{
    const draws=[];
    class Graphics {
        clear(){draws.length=0;}
        lineStyle(...args){draws.push(['style',...args]);}
        moveTo(...args){draws.push(['move',...args]);}
        lineTo(...args){draws.push(['line',...args]);}
        drawCircle(...args){draws.push(['circle',...args]);}
    }
    const me={__id:1,active:true,layer:0,m_pos:{x:0,y:0},m_netData:{},container:{addChild(){}}};
    const enemy={__id:2,active:true,layer:0,m_pos:{x:10,y:0},m_netData:{},nameText:{_text:'enemy'}};
    const obstacles=[];
    const game={m_pixi:{},m_connection:{},m_activePlayer:me,m_playerBarn:{playerPool:{m_pool:[me,enemy]}},m_map:{m_obstaclePool:{m_pool:obstacles}}};
    const state={isLineDrawerEnabled:true,isAimBotEnabled:true,friends:[]};
    const unsafeWindow={game}; let now=0;
    const context=vm.createContext({unsafeWindow,state,PIXI:{Graphics},getTeam:p=>p.__id,position,clearShot,RED:0xff0000,BLUE:0x00f3f3,GREEN:0x00ff00,WHITE:0xffffff,performance:{now:()=>now}});
    const source=readFileSync(new URL('../src/plugins/esp.js',import.meta.url),'utf8').replace(/^import .*;\r?\n/gm,'').replace(/export /g,'');
    vm.runInContext(source,context);
    const run=()=>vm.runInContext('esp()',context);
    run();assert.deepEqual(draws[0],['style',2,0xff0000,1]);
    obstacles.push({active:true,layer:0,height:1,collider:{type:0,pos:{x:5,y:0},rad:1}});
    now=100;run();assert.deepEqual(draws[0],['style',2,0xffb547,0.8]);
    assert.ok(draws.filter(d=>d[0]==='line').length>1);
    obstacles.length=0;now=200;state.enemyAimBot=enemy;unsafeWindow.lastAimPos={clientX:10,clientY:0};
    run();assert.deepEqual(draws[0],['style',4,0xbf7aff,1]);assert.ok(draws.some(d=>d[0]==='circle'));
    state.coverTarget={};run();assert.deepEqual(draws[0],['style',4,0xffb547,0.8]);
    state.enemyAimBot=null;state.coverTarget=null;unsafeWindow.lastAimPos=null;now=300;
    run();assert.deepEqual(draws[0],['style',2,0xff0000,1]);assert.ok(!draws.some(d=>d[0]==='circle'));
    state.isLineDrawerEnabled=false;run();assert.equal(draws.length,0);
});
