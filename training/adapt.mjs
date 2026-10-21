import {readFile,writeFile} from 'node:fs/promises';
import {createHash} from 'node:crypto';
import {policyAction,TABLE_SIZE} from '../dist/agent.js';
import {ChallengeEnv,COURSES,ADAPTIVE_TABLE_SIZE,adaptiveStateIndex,adaptiveAction,challengeRun} from '../dist/challenge-engine.js';
const original=JSON.parse(await readFile('dist/models/training.json','utf8')),base=original.checkpoints.at(-1).q;
const episodes=Number(process.argv[2]||80000),q=new Float64Array(ADAPTIVE_TABLE_SIZE),seed=20261022;
for(let i=0;i<q.length;i++)q[i]=base[i%TABLE_SIZE];
let rng=seed;function random(){let t=rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296;}
const names=Object.keys(COURSES),validationSeeds=Array.from({length:20},(_,i)=>0x90000000+i*7907),testSeeds=Array.from({length:100},(_,i)=>0xe0000000+i*15427),maxTicks=10800,checkpoints=[],curve=[];
function evaluate(ep){const metrics=names.map(course=>{const runs=validationSeeds.map(seed=>challengeRun(new ChallengeEnv({seed,course}),e=>adaptiveAction(e,q),{maxTicks}));return {course,meanScore:runs.reduce((s,r)=>s+r.score,0)/runs.length,meanSeconds:runs.reduce((s,r)=>s+r.seconds,0)/runs.length};});const point={episode:ep,metrics};curve.push(point);console.log(JSON.stringify(point));if([0,10000,30000,50000,80000,episodes].includes(ep))checkpoints.push({id:'adapt-'+ep,episode:ep,q:Array.from(q),validation:metrics});}
const start=Date.now();evaluate(0);const history=[];
for(let ep=1;ep<=episodes;ep++){
 const course=names[Math.floor(random()*names.length)],courseSeed=1+Math.floor(random()*1000000),progress=Math.min(1,ep/40000);const offsetSeconds=random()<.55?0:Math.floor(random()*60*progress);
 const env=new ChallengeEnv({seed:courseSeed,course,offsetSeconds}),epsilon=Math.max(.002,.06*Math.exp(-ep/15000)),alpha=.045/(1+ep/60000);let sum=0;
 while(!env.done&&env.ticks<6000){const s=adaptiveStateIndex(env),action=random()<epsilon?(random()<.5?0:1):(q[s+1]>q[s]?1:0);let r=0,discount=1;for(let f=0;f<3&&!env.done&&env.ticks<6000;f++){const reward=env.step(f===0?action:0).reward;r+=discount*reward;sum+=reward;discount*=.995;}const next=adaptiveStateIndex(env);q[s+action]+=alpha*(r+(env.done?0:discount*Math.max(q[next],q[next+1]))-q[s+action]);}
 history.push([ep,course,courseSeed,offsetSeconds,env.score,env.ticks,epsilon,sum]);if(ep%5000===0||ep===episodes)evaluate(ep);
}
const results=names.map(course=>{const baseline=testSeeds.map(seed=>challengeRun(new ChallengeEnv({seed,course}),e=>policyAction(e,base),{maxTicks}));const trained=testSeeds.map(seed=>challengeRun(new ChallengeEnv({seed,course}),e=>adaptiveAction(e,q),{maxTicks}));function stats(runs){const seconds=runs.map(r=>r.seconds).sort((a,b)=>a-b);return {meanScore:runs.reduce((s,r)=>s+r.score,0)/runs.length,meanSeconds:seconds.reduce((s,v)=>s+v,0)/seconds.length,medianSeconds:(seconds[49]+seconds[50])/2,capped:runs.filter(r=>r.capped).length,runs};}return {course,baseline:stats(baseline),adapted:stats(trained)};});
const engineHash=createHash('sha256').update(await readFile('dist/challenge-engine.js')).digest('hex');
const report={schemaVersion:1,algorithm:'Contextual tabular Q-learning, fine-tuned from the Classic agent',seed,episodes,baselineEpisode:50000,engineHash,maxTicks,training:{seedRange:[1,1000000],maxTicks:6000,offsetSeconds:[0,60],initialEpsilon:.06,minimumEpsilon:.002,alphaInitial:.045,alphaDecay:60000,gammaPerFrame:.995,seconds:(Date.now()-start)/1000},validationSeeds,testSeeds,curve,checkpoints,results};
await writeFile('dist/models/challenges.json',JSON.stringify(report));await writeFile('training/adaptation-history.csv','episode,course,seed,startSeconds,score,ticks,epsilon,return\n'+history.map(r=>r.join(',')).join('\n')+'\n');console.log('FINAL '+JSON.stringify(results.map(({course,baseline,adapted})=>({course,baseline:baseline.meanScore,adapted:adapted.meanScore,baselineSeconds:baseline.meanSeconds,adaptedSeconds:adapted.meanSeconds,capped:adapted.capped}))));console.log(`Saved ${checkpoints.length} checkpoints in ${report.training.seconds}s.`);
