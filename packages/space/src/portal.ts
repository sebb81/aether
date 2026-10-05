import {EventBus} from '@aether/core';
import type {Point,PortalSnapshot,Rectangle} from '@aether/shared';

export class PortalLifecycle {
  readonly events=new EventBus<{changed:PortalSnapshot}>();
  private state:PortalSnapshot={phase:'closed',token:0,origin:{x:80,y:80},viewport:{x:0,y:0,width:1,height:1},durationMs:0,reducedMotion:false};
  snapshot(){return structuredClone(this.state);}
  open(origin:Point,viewport:Rectangle,reducedMotion:boolean){
    if(this.state.phase==='open'||this.state.phase==='opening')return false;
    if(![origin.x,origin.y,viewport.x,viewport.y,viewport.width,viewport.height].every(Number.isFinite)||viewport.width<1||viewport.height<1)throw new Error('Géométrie PORTAL invalide.');
    this.state={phase:'opening',token:this.state.token+1,origin:{...origin},viewport:{...viewport},durationMs:reducedMotion?90:640,reducedMotion};this.publish();return true;
  }
  close(){if(this.state.phase==='closed'||this.state.phase==='closing')return false;this.state={...this.state,phase:'closing',token:this.state.token+1,durationMs:this.state.reducedMotion?90:480};this.publish();return true;}
  settle(token:number){if(token!==this.state.token)return false;if(this.state.phase==='opening')this.state.phase='open';else if(this.state.phase==='closing')this.state.phase='closed';else return false;this.publish();return true;}
  reset(){this.state={...this.state,phase:'closed',token:this.state.token+1};this.publish();}
  private publish(){this.events.emit('changed',this.snapshot());}
}
