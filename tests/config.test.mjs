import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFile } from 'node:fs/promises';
import { resolveConfig, updateMetadata } from '../scripts/config.mjs';
import { metadata as sourceMetadata } from '../userscript/src/metadata.js';
const base=JSON.parse(await readFile(new URL('../pipeline.config.json',import.meta.url),'utf8'));
const metadata='// ==UserScript==\n// @version 0.1\n// @updateURL https://old.invalid\n// @downloadURL https://old.invalid\n// ==/UserScript==';
test('fork metadata uses its own identity, links and optional author without original account values',()=>{
 const config=resolveConfig(base,{publishRepository:'https://github.com/alice/fork.git',userscript:{name:'Alice Injector',author:'Alice'}});
 const result=updateMetadata(sourceMetadata,config);
 assert.ok(result.includes('@name    Alice Injector'));assert.ok(result.includes('@author    Alice'));
 assert.ok(result.includes('@namespace    https://github.com/alice/fork'));
 assert.ok(result.includes('@supportURL    https://github.com/alice/fork/issues'));
 assert.ok(!result.includes('123wwwa'));assert.ok(!result.includes('596621'));assert.ok(!result.includes('fissure'));
 assert.throws(()=>resolveConfig(base,{userscript:{author:'Alice\n// @grant unsafeWindow'}}));
});
test('fresh clones cannot publish and do not update from the original Greasy Fork script',()=>{
 const config=resolveConfig(base);
 assert.equal(config.publishingEnabled,false);assert.equal(config.userscript.publish,false);
 const result=updateMetadata(metadata,config);
 assert.ok(result.includes('@updateURL    none'));assert.ok(!result.includes('@downloadURL'));assert.ok(!result.includes('596621'));
});
test('explicit local and Actions settings independently enable publication and Greasy Fork metadata',()=>{
 const local=resolveConfig(base,{publishingEnabled:true,userscript:{publish:true,greasyForkScriptId:'123'}});
 assert.equal(local.publishingEnabled,true);assert.equal(local.userscript.publish,true);
 assert.ok(updateMetadata(metadata,local).includes('/scripts/123/'));
 const ci=resolveConfig(base,{}, {PUBLISH_ENABLED:'true',PUBLISH_REPOSITORY:'https://github.com/fork/example.git',USERSCRIPT_PUBLISH_ENABLED:'true',GREASYFORK_SCRIPT_ID:'456'});
 assert.equal(ci.publishRepository,'https://github.com/fork/example.git');assert.ok(updateMetadata(metadata,ci).includes('/scripts/456/'));
 assert.throws(()=>resolveConfig(base,{}, {PUBLISH_ENABLED:'yes'}));
 assert.throws(()=>resolveConfig(base,{userscript:{greasyForkScriptId:'abc'}}));
});
