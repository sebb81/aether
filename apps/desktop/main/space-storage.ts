import {existsSync,mkdirSync,readFileSync,renameSync,unlinkSync,writeFileSync} from 'node:fs';
import {dirname} from 'node:path';
import {DEFAULT_PORTAL_SETTINGS,DEFAULT_SPACE_PREFERENCES,parsePortalSettings,parseSpacePreferences} from '@aether/space';
import type {PortalSettings,SpacePreferences} from '@aether/shared';

function atomic(path:string,value:unknown){mkdirSync(dirname(path),{recursive:true});const temporary=`${path}.${process.pid}.tmp`;try{writeFileSync(temporary,`${JSON.stringify(value,null,2)}\n`,{encoding:'utf8',mode:0o600});renameSync(temporary,path);}finally{if(existsSync(temporary))unlinkSync(temporary);}}
export class SpacePreferencesStore {
  notice:string|null=null;
  constructor(readonly path:string){}
  load():SpacePreferences{if(!existsSync(this.path))return structuredClone(DEFAULT_SPACE_PREFERENCES);try{return parseSpacePreferences(JSON.parse(readFileSync(this.path,'utf8')));}catch{renameSync(this.path,`${this.path}.invalid-${Date.now()}`);this.notice='Navigation SPACE invalide préservée. Vue recentrée ; données MEMORY/CURIOSITY conservées.';return structuredClone(DEFAULT_SPACE_PREFERENCES);}}
  save(value:SpacePreferences){atomic(this.path,parseSpacePreferences(value));}
}
export class PortalSettingsStore {
  notice:string|null=null;
  constructor(readonly path:string){}
  load():PortalSettings{if(!existsSync(this.path))return {...DEFAULT_PORTAL_SETTINGS};try{const value=JSON.parse(readFileSync(this.path,'utf8'));if(value.schemaVersion!==1)throw new Error('schema');return parsePortalSettings(value.settings);}catch{renameSync(this.path,`${this.path}.invalid-${Date.now()}`);this.notice='Réglages PORTAL invalides préservés. Vérifiez son raccourci.';return {...DEFAULT_PORTAL_SETTINGS};}}
  save(value:PortalSettings){atomic(this.path,{schemaVersion:1,settings:parsePortalSettings(value)});}
}
