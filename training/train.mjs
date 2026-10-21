import {mkdir,writeFile,readFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {resolve} from 'node:path';
import {FlappyEnv} from '../dist/engine.js';
import {AGENT_CONFIG,TABLE_SIZE,stateIndex,runPolicy} from '../dist/agent.js';
const episodes=Number(process.argv[2]||50000),trainingSeed=20261021,maxScore=30,maxTicks=6000;
let rng=trainingSeed;
function random(){let t=rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
const q=new Float64Array(TABLE_SIZE),evalSeeds=Array.from({length:30},(_,i)=>0xa0000000+i*7919),sampleSeeds=[evalSeeds[0],evalSeeds[10],evalSeeds[20]];
const checkpoints=[],curve=[],history=[];
const saveAt=new Set([0,100,500,2000,5000,8000,10000,20000,25000,50000,episodes].filter(n=>n<=episodes));
function evaluate(ep){const scores=evalSeeds.map(seed=>runPolicy(new FlappyEnv({seed}),q,{maxScore,maxTicks}));const meanScore=scores.reduce((s,r)=>s+r.score,0)/scores.length;const meanSeconds=scores.reduce((s,r)=>s+r.seconds,0)/scores.length;const sorted=scores.map(r=>r.score).sort((a,b)=>a-b);const metrics={meanScore,medianScore:(sorted[14]+sorted[15])/2,minScore:sorted[0],maxScore:sorted.at(-1),meanSeconds,capped:scores.filter(r=>r.capped).length};const point={episode:ep,...metrics};curve.push(point);console.log(JSON.stringify(point));if(saveAt.has(ep))checkpoints.push({id:'ep-'+ep,episode:ep,q:Array.from(q),metrics,evaluation:scores.map(({actions,...r})=>r),samples:sampleSeeds.map(seed=>{const {actions,...run}=runPolicy(new FlappyEnv({seed}),q,{maxScore,maxTicks,record:true});return {...run,actions};})});}
const started=Date.now();evaluate(0);
for(let episode=1;episode<=episodes;episode++){
 const seed=1+Math.floor(random()*1000000),env=new FlappyEnv({seed});const epsilon=Math.max(.015,.8*Math.exp(-episode/6000));let rewardSum=0;
 while(!env.done&&env.ticks<maxTicks&&env.score<maxScore){const s=stateIndex(env),action=random()<epsilon?(random()<.5?0:1):(q[s+1]>q[s]?1:0);let r=0,discount=1;for(let frame=0;frame<AGENT_CONFIG.decisionFrames&&!env.done&&env.score<maxScore&&env.ticks<maxTicks;frame++){const reward=env.step(frame===0?action:0).reward;r+=discount*reward;rewardSum+=reward;discount*=.995;}const next=stateIndex(env),target=r+(env.done?0:discount*Math.max(q[next],q[next+1]));q[s+action]+=.12*(target-q[s+action]);}
 history.push([episode,seed,env.score,env.ticks,epsilon,rewardSum]);
 if(episode%1000===0||saveAt.has(episode))evaluate(episode);
}
const testSeeds=Array.from({length:100},(_,i)=>0xc0000000+i*15427);
const testResults=checkpoints.map(cp=>{const runs=testSeeds.map(seed=>{const {actions,...run}=runPolicy(new FlappyEnv({seed}),cp.q,{maxScore,maxTicks});return run;});return {episode:cp.episode,meanScore:runs.reduce((s,r)=>s+r.score,0)/runs.length,capped:runs.filter(r=>r.capped).length,runs};});
const engineHash=createHash('sha256').update(await readFile(new URL('../dist/engine.js',import.meta.url))).digest('hex');
const report={schemaVersion:1,algorithm:'Tabular Q-learning',trainingSeed,episodes,difficulty:'classic',engineHash,agentConfig:AGENT_CONFIG,hyperparameters:{learningRate:.12,gammaPerFrame:.995,initialEpsilon:.8,minimumEpsilon:.015,epsilonDecayEpisodes:6000},reward:{survivingFrame:.01,passedPipe:1,collision:-1},evaluation:{seeds:evalSeeds,maxScore,maxTicks,sampleSeeds,exploration:false},test:{seeds:testSeeds,maxScore,maxTicks,results:testResults},training:{seedRange:[1,1000000],maxScore,maxTicks,seconds:(Date.now()-started)/1000},curve,checkpoints};
await mkdir(resolve('dist/models'),{recursive:true});await mkdir(resolve('training'),{recursive:true});await writeFile(resolve('dist/models/training.json'),JSON.stringify(report));await writeFile(resolve('training/history.csv'),'episode,seed,score,ticks,epsilon,return\n'+history.map(r=>r.join(',')).join('\n')+'\n');console.log(`Saved ${checkpoints.length} actual checkpoints. Training took ${report.training.seconds}s.`);
