import { readFile } from 'node:fs/promises';
import { resolve } from 'node:path';
import { validateConfig } from './lib.mjs';

export function resolveConfig(base, local={}, env={}) {
  const config={...base,...local, publishingEnabled:local.publishingEnabled??base.publishingEnabled??false,
    userscript:{publish:false,greasyForkScriptId:null,...base.userscript,...local.userscript}};
  if(env.PUBLISH_ENABLED) {
    if(!['true','false'].includes(env.PUBLISH_ENABLED)) throw new Error('PUBLISH_ENABLED must be true or false.');
    config.publishingEnabled=env.PUBLISH_ENABLED==='true';
  }
  if(env.PUBLISH_REPOSITORY) config.publishRepository=env.PUBLISH_REPOSITORY;
  if(env.USERSCRIPT_PUBLISH_ENABLED){
    if(!['true','false'].includes(env.USERSCRIPT_PUBLISH_ENABLED))throw new Error('USERSCRIPT_PUBLISH_ENABLED must be true or false.');
    config.userscript.publish=env.USERSCRIPT_PUBLISH_ENABLED==='true';
  }
  if(env.GREASYFORK_SCRIPT_ID)config.userscript.greasyForkScriptId=env.GREASYFORK_SCRIPT_ID;
  for(const [key,variable] of Object.entries({name:'USERSCRIPT_NAME',author:'USERSCRIPT_AUTHOR',namespace:'USERSCRIPT_NAMESPACE'})){
    if(env[variable])config.userscript[key]=env[variable];
    if(config.userscript[key]!==undefined&&(typeof config.userscript[key]!=='string'||!config.userscript[key].trim()||/[\r\n]/.test(config.userscript[key])))throw new Error(`Invalid userscript ${key}.`);
  }
  if(typeof config.publishingEnabled!=='boolean'||typeof config.userscript.publish!=='boolean')throw new Error('Publication switches must be booleans.');
  const id=config.userscript.greasyForkScriptId;
  if(id!==null&&!/^[1-9]\d*$/.test(String(id)))throw new Error('Invalid Greasy Fork script ID.');
  if(env.GITHUB_ACTIONS==='true'&&config.publishingEnabled&&env.GITHUB_REPOSITORY){
    config.publishRepository ||= `https://github.com/${env.GITHUB_REPOSITORY}.git`;
  }
  return validateConfig(config);
}
export async function loadConfig(root,env=process.env){
  const base=JSON.parse(await readFile(resolve(root,'pipeline.config.json'),'utf8'));
  let local={};
  // Never import machine-specific publication settings into CI.
  if(env.GITHUB_ACTIONS!=='true'){
    try{local=JSON.parse(await readFile(resolve(root,'pipeline.local.json'),'utf8'));}
    catch(error){if(error.code!=='ENOENT')throw error;}
  }
  return resolveConfig(base,local,env);
}
export function updateMetadata(metadata,config){
  let result=metadata.replace(/^\/\/ @(?:updateURL|downloadURL)\s+[^\r\n]*\r?\n/gm,'');
  const project=config.publishRepository.replace(/\.git$/,'');
  const fields={name:config.userscript.name||'Survev Prism Cheat',author:config.userscript.author||'Survev Prism Cheat contributors',namespace:config.userscript.namespace||project,homepageURL:project,supportURL:project+'/issues'};
  for(const [key,value] of Object.entries(fields))result=result.replace(new RegExp(`^// @${key}\\s+[^\\r\\n]*`,'m'),()=>`// @${key}    ${value}`);
  const id=config.userscript.greasyForkScriptId;
  const scriptFileName=encodeURIComponent(fields.name);
  const directives=id
    ? `// @updateURL    https://update.greasyfork.org/scripts/${id}/${scriptFileName}.meta.js\n// @downloadURL  https://update.greasyfork.org/scripts/${id}/${scriptFileName}.user.js\n`
    : '// @updateURL    none\n';
  return result.replace('// ==/UserScript==',directives+'// ==/UserScript==');
}
