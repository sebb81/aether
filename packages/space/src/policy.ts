import {isShortcut} from '@aether/core';
import type {Point,SpaceCamera,SpacePreferences,SpaceSelection,SpaceViewWrite,PortalSettings} from '@aether/shared';

export const DEFAULT_PORTAL_SETTINGS:PortalSettings={shortcut:'Control+Alt+A'};
export const DEFAULT_SPACE_PREFERENCES:SpacePreferences={schemaVersion:1,camera:{x:0,y:0,zoom:.86},labels:true,depth:true,selection:null,lastVisitedAt:null};
const object=(value:unknown):value is Record<string,unknown>=>Boolean(value)&&typeof value==='object'&&!Array.isArray(value);
function keys(value:Record<string,unknown>,allowed:string[]){if(Object.keys(value).some(key=>!allowed.includes(key)))throw new Error('Champ SPACE non autorisé.');}
export function parsePortalSettings(value:unknown):PortalSettings{if(!object(value))throw new Error('Réglages PORTAL invalides.');keys(value,['shortcut']);if(!isShortcut(value.shortcut))throw new Error('Raccourci PORTAL invalide.');return {shortcut:value.shortcut as string};}
export function parseSpaceView(value:unknown):SpaceViewWrite {
  if(!object(value)||!object(value.camera))throw new Error('Navigation SPACE invalide.');keys(value,['camera','labels','depth','selection']);keys(value.camera,['x','y','zoom']);
  const {x,y,zoom}=value.camera;
  if(typeof x!=='number'||typeof y!=='number'||typeof zoom!=='number'||![x,y,zoom].every(Number.isFinite)||Math.abs(x)>6000||Math.abs(y)>6000||zoom<.4||zoom>2.4||typeof value.labels!=='boolean'||typeof value.depth!=='boolean')throw new Error('Caméra ou préférences SPACE invalides.');
  let selection:SpaceSelection|null=null;
  if(value.selection!==null){if(!object(value.selection))throw new Error('Sélection SPACE invalide.');keys(value.selection,['kind','id']);if(!['memory','interest','question','hypothesis','discovery','exploration','connection','echo-session','habit'].includes(String(value.selection.kind))||typeof value.selection.id!=='string'||!/^[a-f0-9-]{36}$/.test(value.selection.id))throw new Error('Objet SPACE invalide.');selection={kind:value.selection.kind as SpaceSelection['kind'],id:value.selection.id};}
  return {camera:{x,y,zoom},labels:value.labels,depth:value.depth,selection};
}
export function parseSpacePreferences(value:unknown):SpacePreferences {
  if(!object(value)||value.schemaVersion!==1)throw new Error('Version SPACE inconnue.');keys(value,['schemaVersion','camera','labels','depth','selection','lastVisitedAt']);
  if(value.lastVisitedAt!==null&&(typeof value.lastVisitedAt!=='string'||!Number.isFinite(Date.parse(value.lastVisitedAt))))throw new Error('Date de visite SPACE invalide.');
  return {...parseSpaceView({camera:value.camera,labels:value.labels,depth:value.depth,selection:value.selection}),schemaVersion:1,lastVisitedAt:value.lastVisitedAt as string|null};
}
export function pan(camera:SpaceCamera,delta:Point):SpaceCamera{return {...camera,x:Math.max(-6000,Math.min(6000,camera.x+delta.x)),y:Math.max(-6000,Math.min(6000,camera.y+delta.y))};}
export function zoomAt(camera:SpaceCamera,factor:number,point:Point):SpaceCamera {
  const zoom=Math.max(.4,Math.min(2.4,camera.zoom*factor)),ratio=zoom/camera.zoom;
  return pan({x:0,y:0,zoom},{x:point.x-(point.x-camera.x)*ratio,y:point.y-(point.y-camera.y)*ratio});
}
