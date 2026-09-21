import { test } from 'node:test';
import assert from 'node:assert/strict';
import { createAutoSwap } from '../src/autoSwap.js';

function fixture(type='mosin') {
    const local={m_curWeapIdx:0,m_weapons:[{type,ammo:5},{type:'rifle',ammo:20},{type:'fists'}]};
    const game={m_connection:{},m_activePlayer:{active:true,m_netData:{},m_localData:local}};
    const guns={mosin:{pullDelay:1},m870:{ammo:'12gauge'},potato_cannon:{ammo:'potato_ammo',fireMode:'single',fireDelay:1.2},rifle:{fireMode:'auto'},slow:{fireMode:'single',fireDelay:1}};
    const state={isAutoSwitchEnabled:true,isSmartSwitchEnabled:true}, inputs=[];
    const update=createAutoSwap(); let now=0;
    const tick=()=>update(game,guns,state,inputs,now+=50);
    tick(); return {local,game,guns,state,inputs,tick};
}
for(const type of ['mosin','m870','potato_cannon']) test(`${type} shot overrides smart selection; return waits for observed equip`,()=>{
    const f=fixture(type);
    f.local.m_weapons[0].ammo--; f.tick();
    assert.deepEqual(f.inputs,['EquipSecondary']);
    f.inputs.length=0; f.tick(); assert.deepEqual(f.inputs,[]);
    f.local.m_curWeapIdx=1; f.tick(); assert.deepEqual(f.inputs,['EquipPrimary']);
    assert.ok(f.state.autoSwapUntil>200);
});
test('reload, first observation and gun replacement do not trigger swaps',()=>{
    const f=fixture(); assert.deepEqual(f.inputs,[]);
    f.local.m_weapons[0].ammo=10; f.tick();
    f.local.m_weapons[0]={type:'m870',ammo:2};f.tick();
    assert.deepEqual(f.inputs,[]);
});

test('empty or reloading destination returns once after equip, including changed ammo snapshots',()=>{
    for(const mode of ['empty','became-empty','reloading']){
        const f=fixture();
        f.local.m_weapons[1]={type:'m870',ammo:mode==='empty'?0:2};f.tick();
        f.local.m_weapons[0].ammo--;f.tick();
        assert.deepEqual(f.inputs,['EquipSecondary']);
        f.inputs.length=0;f.tick();assert.deepEqual(f.inputs,[]);
        f.local.m_curWeapIdx=1;
        if(mode==='became-empty') f.local.m_weapons[1].ammo=0;
        if(mode==='reloading') Object.assign(f.game.m_activePlayer.m_netData,{m_actionType:1,m_actionItem:'m870'});
        f.tick();assert.deepEqual(f.inputs,['EquipPrimary']);
        f.inputs.length=0;f.local.m_curWeapIdx=0;f.tick();f.tick();assert.deepEqual(f.inputs,[]);
    }
});
test('two eligible guns stay switched unless one-gun mode is enabled',()=>{
    for(const one of [false,true]){
        const f=fixture(); f.state.isUseOneGunEnabled=one;
        f.local.m_weapons[1]={type:'m870',ammo:2};f.tick();
        f.local.m_weapons[0].ammo--;f.tick();assert.deepEqual(f.inputs,['EquipSecondary']);
        f.inputs.length=0;f.local.m_curWeapIdx=1;f.tick();
        assert.deepEqual(f.inputs,one?['EquipPrimary']:[]);
    }
});
test('melee fallback, timeout and menu cancellation do not retain a return command',()=>{
    for(const cancel of ['timeout','menu','manual']){
        const f=fixture(); f.local.m_weapons[1].type='';f.tick();
        f.local.m_weapons[0].ammo--;f.tick();assert.deepEqual(f.inputs,['EquipMelee']);
        f.inputs.length=0;
        if(cancel==='timeout')for(let i=0;i<32;i++)f.tick();
        if(cancel==='menu'){f.state.isMenuOpen=true;f.tick();f.state.isMenuOpen=false;}
        if(cancel==='manual'){f.local.m_curWeapIdx=3;f.tick();}
        f.local.m_curWeapIdx=2;f.tick();assert.deepEqual(f.inputs,[]);
    }
});
test('smart selection still owns ordinary weapons; disabled auto-swap observes ammo without firing later',()=>{
    const f=fixture('slow');f.local.m_weapons[0].ammo--;f.tick();assert.deepEqual(f.inputs,[]);
    f.state.isSmartSwitchEnabled=false; f.state.isAutoSwitchEnabled=false;
    f.local.m_weapons[0].ammo--;f.tick();f.state.isAutoSwitchEnabled=true;f.tick();assert.deepEqual(f.inputs,[]);
    f.local.m_weapons[0].ammo--;f.tick();assert.deepEqual(f.inputs,['EquipSecondary']);
});
