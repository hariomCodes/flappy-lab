import {ChallengeEnv,COURSES,adaptiveAction,challengeRun} from '../dist/challenge-engine.js';
import {policyAction} from '../dist/agent.js';
export function evaluateChallengePolicies(q,baseline,seeds,maxTicks){
 function stats(runs){const seconds=runs.map(r=>r.seconds).sort((a,b)=>a-b),n=seconds.length;return {meanScore:runs.reduce((s,r)=>s+r.score,0)/n,meanSeconds:seconds.reduce((s,v)=>s+v,0)/n,medianSeconds:(seconds[Math.floor((n-1)/2)]+seconds[Math.floor(n/2)])/2,capped:runs.filter(r=>r.capped).length,runs};}
 return Object.keys(COURSES).map(course=>({course,baseline:stats(seeds.map(seed=>challengeRun(new ChallengeEnv({seed,course}),e=>policyAction(e,baseline),{maxTicks}))),adapted:stats(seeds.map(seed=>challengeRun(new ChallengeEnv({seed,course}),e=>adaptiveAction(e,q),{maxTicks})))}));
}
