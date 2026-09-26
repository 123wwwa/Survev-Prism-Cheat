import test from 'node:test';
import assert from 'node:assert/strict';
import { bundledDefinitionIds, sourceDefinitionIds, sameDefinitionIds } from '../scripts/definition-ids.mjs';

test('bundle ID extraction preserves spread order and replacement positions without executing values', () => {
 const code = 'const x={tree:dangerous(),barn:{}}, y={...x,tree:{},hut:{}}, list=[{gun:{}},{ammo:{}}], raw={}; for(let i=0;i<list.length;i++){const defs=list[i]; for(const key of Object.keys(defs)) raw[key]=defs[key];} const map=new R(`Map`,y,12), game=new R(`Game`,raw,10);';
 const ids=bundledDefinitionIds(code);
 assert.deepEqual(ids,{Map:['','tree','barn','hut'],Game:['','gun','ammo']});
 assert.equal(sameDefinitionIds(ids,{...ids,Map:['','barn','tree','hut']}),false);
 assert.throws(()=>bundledDefinitionIds('const map=new R("Map",getDefs(),12);'),/Unsupported/);
});

test('source IDs follow TypeScript imports and static definition list', async () => {
 const files={
  'shared/defs/mapObjectDefs.ts':'import {Defs} from "./parts.ts"; export const RawMapObjectDefs: Record<string, unknown>={...Defs,barn:{}};',
  'shared/defs/parts.ts':'export const Defs={tree:{}};',
  'shared/defs/gameObjectDefs.ts':'const Guns={gun:{}}; const ObjectDefsList=[Guns,{ammo:{}}];',
 };
 const ids=await sourceDefinitionIds(async path=>{assert.ok(path in files,path);return files[path];});
 assert.deepEqual(ids,{Map:['','tree','barn'],Game:['','gun','ammo']});
});
