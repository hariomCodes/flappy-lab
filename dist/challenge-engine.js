import {FlappyEnv,CONFIG} from './engine.js';

export const COURSES=Object.freeze({
  ramp:{name:'Rising pressure',description:'Speed climbs and gaps narrow continuously.'},
  drift:{name:'Drifting gates',description:'Moving openings, rising speed, shrinking room.'},
  endurance:{name:'Endurance climb',description:'No pipe limit. Speed and motion keep increasing.'}
});
export function conditionsAt(ticks,course='ramp',offsetSeconds=0){
 const seconds=offsetSeconds+ticks/60;
 if(course==='drift')return {speed:2.8+seconds*.022,gap:Math.max(82,148-seconds*.65),amplitude:Math.min(24,8+seconds*.1),level:1+Math.floor(seconds/15)};
 if(course==='endurance')return {speed:2.7+seconds*.03,gap:Math.max(72,157-seconds*.85),amplitude:Math.min(24,Math.max(0,(seconds-20)*.18)),level:1+Math.floor(seconds/15)};
 return {speed:2.7+seconds*.0225,gap:Math.max(82,157-seconds*.75),amplitude:0,level:1+Math.floor(seconds/15)};
}
/** Classic engine remains untouched. Difficulty depends on time, never player score. */
export class ChallengeEnv extends FlappyEnv {
 constructor({seed=42,course='ramp',offsetSeconds=0}={}){super({seed});if(!COURSES[course])throw new RangeError('Unknown challenge course.');this.course=course;this.offsetSeconds=offsetSeconds;this.reset(seed);}
 reset(seed=42){this.config={...CONFIG,...conditionsAt(0,this.course,this.offsetSeconds||0)};super.reset(seed);return this.observe();}
 addPipe(x){const center=143.5+this.random()*157,phase=this.random()*Math.PI*2,p={x,center,phase,top:0,passed:false,gateVelocity:0};this.placePipe(p,this.ticks||0);this.pipes.push(p);}
 placePipe(p,tick){const c=this.config,angle=tick*.018+p.phase;const center=Math.max(c.gap/2+42,Math.min(c.ground-c.gap/2-42,p.center+Math.sin(angle)*c.amplitude));p.top=center-c.gap/2;p.gateVelocity=Math.cos(angle)*.018*c.amplitude;}
 step(action=0){if(this.done)return super.step(action);Object.assign(this.config,conditionsAt(this.ticks+1,this.course,this.offsetSeconds||0));for(const p of this.pipes)this.placePipe(p,this.ticks+1);return super.step(action);}
 observe(){return {...super.observe(),speed:this.config.speed/6,gapSize:this.config.gap/this.config.ground,gateVelocity:(this.nextPipe()?.gateVelocity||0)/2};}
 info(){return {...super.info(),course:this.course||'ramp',level:this.config.level,speed:this.config.speed,gap:this.config.gap};}
}

export const ADAPTIVE_TABLE_SIZE=21*13*12*2*4*3;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export function adaptiveStateIndex(env){const p=env.nextPipe(),c=env.config;const dy=clamp(Math.round((env.y-p.top-c.gap/2)/20)+10,0,20),v=clamp(Math.round((env.velocity-(p.gateVelocity||0)+6)/1.5),0,12),d=clamp(Math.floor((p.x-c.birdX+c.pipeWidth)/40),0,11);const speed=c.speed<3.2?0:c.speed<3.8?1:c.speed<4.6?2:3,gap=c.gap>140?0:c.gap>110?1:2;return ((speed*3+gap)*21*13*12+((dy*13+v)*12+d))*2;}
export function adaptiveAction(env,q){const i=adaptiveStateIndex(env);return q[i+1]>q[i]?1:0;}
export function challengeRun(env,actionFor,{maxTicks=10800,record=false}={}){const trace=record?[]:undefined;let reward=0;while(!env.done&&env.ticks<maxTicks){const action=env.ticks%3===0?actionFor(env):0;reward+=env.step(action).reward;if(trace)trace.push(action);}return {...env.info(),reward,capped:!env.done,...(record?{actions:trace}:{})};}

/** Independent birds, identical seed and clock. The first collision ends a race. */
export class RaceSession {
 constructor({seed=42,course='ramp',actionFor,maxTicks=10800}={}){if(typeof actionFor!=='function')throw new TypeError('A race needs an AI policy.');this.human=new ChallengeEnv({seed,course});this.ai=new ChallengeEnv({seed,course});this.actionFor=actionFor;this.maxTicks=maxTicks;this.ticks=0;this.humanDeathTick=null;this.aiDeathTick=null;this.done=false;}
 step(humanAction=0){if(this.done)return this.summary();if(!this.human.done){this.human.step(humanAction);if(this.human.done)this.humanDeathTick=this.ticks+1;}if(!this.ai.done){this.ai.step(this.ticks%3===0?this.actionFor(this.ai):0);if(this.ai.done)this.aiDeathTick=this.ticks+1;}this.ticks++;this.done=this.human.done||this.ai.done||this.ticks>=this.maxTicks;return this.summary();}
 summary(){const h=this.human,a=this.ai;let result=null;if(this.done)result=h.done&&!a.done?'ai':a.done&&!h.done?'human':'draw';return {ticks:this.ticks,done:this.done,result,humanScore:h.score,aiScore:a.score,humanAlive:!h.done,aiAlive:!a.done,humanSeconds:h.ticks/60,aiSeconds:a.ticks/60,capped:this.ticks>=this.maxTicks};}
}
