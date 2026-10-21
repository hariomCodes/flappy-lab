// Tabular Q-learning policy. Training and browser inference share these exact bins.
export const AGENT_CONFIG = Object.freeze({decisionFrames:3,dyBins:21,velocityBins:13,distanceBins:12,dyStep:20,velocityStep:1.5,distanceStep:40});
export const TABLE_SIZE=21*13*12*2;
const clamp=(x,lo,hi)=>Math.max(lo,Math.min(hi,x));
export function stateIndex(env){const p=env.nextPipe(),c=env.config;const dy=clamp(Math.round((env.y-p.top-c.gap/2)/20)+10,0,20),v=clamp(Math.round((env.velocity+6)/1.5),0,12),d=clamp(Math.floor((p.x-c.birdX+c.pipeWidth)/40),0,11);return ((dy*13+v)*12+d)*2;}
export function policyAction(env,q){const s=stateIndex(env);return q[s+1]>q[s]?1:0;}
export function runPolicy(env,q,{maxScore=30,maxTicks=6000,record=false}={}){let totalReward=0;const actions=record?[]:null;while(!env.done&&env.score<maxScore&&env.ticks<maxTicks){const a=policyAction(env,q);for(let f=0;f<AGENT_CONFIG.decisionFrames&&!env.done&&env.score<maxScore&&env.ticks<maxTicks;f++){const action=f===0?a:0;totalReward+=env.step(action).reward;if(record)actions.push(action);}}return {...env.info(),reward:totalReward,capped:!env.done,actions};}
