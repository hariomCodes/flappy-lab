import {FlappyEnv} from './engine.js';
import {policyAction} from './agent.js';
import {ChallengeEnv,COURSES,RaceSession} from './challenge-engine.js';
import {renderGame} from './renderer.js';
import {loadLearningLab} from './lab.js';
import {loadChallengeUI} from './challenge-ui.js';

const $=id=>document.getElementById(id),canvas=$('game'),ctx=canvas.getContext('2d');
let pilot='human',mode='ready',humanDifficulty='classic',env=new FlappyEnv(),race,lab,arena,agentContext,arenaContext;
let queued=false,last=0,accumulator=0,sound=false,audio,journeyTimer,toastTimer,best={},history=[],runs=0;
try{best=JSON.parse(localStorage.getItem('flappy-lab-best')||'{}')||{};}catch{}
const isArena=()=>pilot==='challenge'||pilot==='race';
const rate=()=>pilot==='agent'?(agentContext?.speed||4):pilot==='challenge'?(arenaContext?.speed||4):1;
function tone(frequency,duration=.08){if(!sound)return;try{audio??=new (window.AudioContext||window.webkitAudioContext)();audio.resume();const o=audio.createOscillator(),g=audio.createGain();o.frequency.setValueAtTime(frequency,audio.currentTime);o.frequency.exponentialRampToValueAtTime(frequency*.6,audio.currentTime+duration);g.gain.setValueAtTime(.035,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+duration);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+duration);}catch{}}
function overlay(label,title,text,button,hint=''){ $('overlayLabel').textContent=label;$('overlayTitle').textContent=title;$('overlayText').innerHTML=text;$('start').innerHTML=button+' <span>↗</span>';$('overlayHint').innerHTML=hint;$('overlay').hidden=false; }
function setPauseButton(){ $('pause').disabled=mode!=='playing'&&mode!=='paused';$('pause').textContent=mode==='paused'?'▷':'Ⅱ';$('pause').setAttribute('aria-label',mode==='paused'?'Resume game':'Pause game'); }
function addHistory(title,points){runs++;history.unshift({title,points,seconds:env.ticks/60});history=history.slice(0,4);$('runCount').textContent=runs;$('history').innerHTML=history.map(h=>`<div class="history-row"><div><strong>${h.title}</strong><small>${h.seconds.toFixed(1)}s in the air</small></div><b>${h.points}</b></div>`).join('');}
function updateCourseDisplay(){const dynamic=env instanceof ChallengeEnv;$('courseLive').hidden=!dynamic;if(dynamic){$('courseSpeed').textContent=(env.config.speed/2.7).toFixed(2)+'×';$('courseGap').textContent=Math.round(env.config.gap)+'px';$('courseLevel').textContent='Level '+env.config.level;$('courseMotion').textContent=env.config.amplitude>0?Math.round(env.config.amplitude)+'px drift':'Steady gates';}}
function refresh(){const o=env.observe();$('score').textContent=String(env.score).padStart(2,'0');$('airtime').innerHTML=(env.ticks/60).toFixed(1)+'<span>s</span>';$('flaps').textContent=env.flaps;$('height').textContent=o.birdY.toFixed(2);$('velocity').textContent=o.velocity.toFixed(2);$('distance').textContent=o.pipeDistance.toFixed(2);$('gap').textContent=o.gapTop.toFixed(2)+' / '+o.gapBottom.toFixed(2);if(pilot==='race')$('best').textContent=String(race.ai.score).padStart(2,'0');updateCourseDisplay();}
function footer(text){document.querySelector('.game-footer').firstElementChild.textContent=text;}
function reset(){
 clearTimeout(journeyTimer);clearTimeout(toastTimer);$('toast').classList.remove('show');queued=false;last=0;accumulator=0;mode='ready';race=null;$('scoreLabel').textContent=pilot==='race'?'YOU · GOLD':'SCORE';
 if(pilot==='agent'){
  agentContext=lab.context();env=new FlappyEnv({seed:agentContext.seed});const cp=agentContext.checkpoint,test=agentContext.report.test.results.find(r=>r.episode===cp.episode);
  $('bestLabel').textContent='TEST AVERAGE';$('best').textContent=test.meanScore.toFixed(2);$('status').textContent='AGENT READY';
  overlay(cp.episode===0?'BEFORE THE FIRST LESSON':'SAVED TRAINING CHECKPOINT',cp.episode===0?'Meet the beginner.':`${cp.episode.toLocaleString()} games later.`,`Course ${agentContext.course+1} · same game, learned decisions<br>Press play to see this policy in action.`,'Play sample','<kbd>P</kbd> pause · <kbd>R</kbd> replay');
  footer(`Agent / ${cp.episode.toLocaleString()} training games / Course ${agentContext.course+1} / ${rate()}×`);
 }else if(isArena()){
  arenaContext=arena.context();env=new ChallengeEnv({seed:arenaContext.seed,course:arenaContext.course});
  if(pilot==='race'){
   race=new RaceSession({seed:arenaContext.seed,course:arenaContext.course,actionFor:arenaContext.actionFor,maxTicks:arenaContext.report.maxTicks});env=race.human;
   $('bestLabel').textContent='AI · BLUE';$('best').textContent='00';$('status').textContent='RACE READY';
   overlay('ONE SKY. TWO PILOTS.','Ready to race?',`${COURSES[arenaContext.course].name} · ${arenaContext.name}<br>You’re gold. AI is blue. Last bird flying wins.`,'Start race','<kbd>Space</kbd> / <kbd>↑</kbd> / tap to flap · <kbd>P</kbd> pauses both');
   footer('You control gold / Same pipes, same clock / 1× race speed');
  }else{
   $('bestLabel').textContent=arenaContext.opponent==='adapted'?'EXTRA TRAINING':'TRAINING GAMES';$('best').textContent=(arenaContext.opponent==='adapted'?arenaContext.checkpoint:arenaContext.opponent==='classic'?50000:10000)/1000+'k';$('status').textContent='CHALLENGE READY';
   overlay('THE SKY KEEPS CHANGING',COURSES[arenaContext.course].name,`${arenaContext.name}<br>Speed rises. Gaps tighten. No pipe-score limit.`,'Watch this agent','180-second safety limit · <kbd>P</kbd> pause · <kbd>R</kbd> replay');
   footer(`${arenaContext.name} / Course ${arenaContext.seedIndex+1} / ${rate()}× playback`);
  }
 }else{
  const seed=Math.floor(Math.random()*4294967296);env=COURSES[humanDifficulty]?new ChallengeEnv({seed,course:humanDifficulty}):new FlappyEnv({seed,difficulty:humanDifficulty});
  $('bestLabel').innerHTML='PERSONAL BEST <span class="star">✦</span>';$('best').textContent=String(best[humanDifficulty]||0).padStart(2,'0');$('status').textContent='READY TO FLY';
  overlay('THE SKY IS YOURS','Find your rhythm.','Keep your wings moving.<br>Find your way through the green.','Let’s fly','or press <kbd>space</kbd> to begin');
  document.querySelector('.game-footer').firstElementChild.innerHTML='<kbd>Space</kbd><span>or</span><kbd>↑</kbd><span>to flap</span><span class="divider">/</span><span>Click or tap anywhere</span>';
 }
 $('raceLegend').hidden=pilot!=='race';document.querySelector('.scorebar').classList.toggle('is-race',pilot==='race');setPauseButton();refresh();
}
function start(){if(mode==='paused'){pause();return;}if(mode==='over')reset();if(mode==='ready'){mode='playing';$('overlay').hidden=true;$('status').textContent=pilot==='race'?'RACING':pilot==='challenge'?'CHALLENGE IN FLIGHT':'IN FLIGHT';last=0;accumulator=0;setPauseButton();$('announcement').textContent=pilot==='race'?'Race started. You control the gold bird.':'Flight started.';}if(pilot==='human'||pilot==='race')queued=true;canvas.focus({preventScroll:true});}
function pause(){if(mode==='playing'){mode='paused';queued=false;overlay('TAKE A BREATHER','Holding steady.',pilot==='race'?'Both birds and the difficulty clock are paused.':'Your flight will be right here.','Resume flight','or press <kbd>P</kbd> to resume');$('status').textContent='PAUSED';}else if(mode==='paused'){mode='playing';last=0;accumulator=0;$('overlay').hidden=true;$('status').textContent=pilot==='race'?'RACING':'IN FLIGHT';}setPauseButton();}
function finish(){
 mode='over';setPauseButton();const seconds=(env.ticks/60).toFixed(1);
 if(pilot==='race'){
  const winner=race.human.done&&!race.ai.done?'ai':race.ai.done&&!race.human.done?'human':'draw';const title=winner==='human'?'You take the skies.':winner==='ai'?'AI takes this flight.':'A photo finish.';
  $('status').textContent=winner==='human'?'YOU WIN':winner==='ai'?'AI WINS':'DRAW';overlay(race.summary().capped?'180-SECOND SAFETY DRAW':'LAST BIRD FLYING',title,`You: ${race.human.score} pipes · AI: ${race.ai.score} pipes<br>${seconds}s together · ${race.summary().capped?'Both birds reached the safety cutoff.':winner==='draw'?'Both birds collided on the same step.':winner==='human'?'The blue bird hit an obstacle.':'Your gold bird hit an obstacle.'}`,'Race again','Same course, same opponent. Change either in the setup above.');
  addHistory(winner==='human'?'You beat the AI':winner==='ai'?'AI wins the race':'Race draw',`${race.human.score}–${race.ai.score}`);$('announcement').textContent=`${winner==='human'?'You win':winner==='ai'?'AI wins':'Draw'}. You ${race.human.score} pipes. AI ${race.ai.score} pipes.`;
 }else if(pilot==='challenge'){
  const capped=!env.done;$('status').textContent=capped?'SAFETY LIMIT REACHED':'CHALLENGE COMPLETE';overlay(capped?'180-SECOND SAFETY LIMIT':'A REAL CHALLENGE RUN',`${env.score} pipes under pressure.`,`${seconds}s survived · Level ${env.config.level}<br>${(env.config.speed/2.7).toFixed(2)}× Classic speed · ${Math.round(env.config.gap)}px gap`,'Replay challenge',capped?'Stopped by the safety limit, not a crash.':'Compare the Classic and adapted agents on this same course.');addHistory(COURSES[arenaContext.course].name,env.score+' pts');$('announcement').textContent=`Challenge complete. ${env.score} pipes in ${seconds} seconds.`;
 }else if(pilot==='agent'){
  const capped=!env.done,cp=agentContext.checkpoint;$('status').textContent=capped?'30-PIPE LIMIT REACHED':'SAMPLE COMPLETE';overlay(capped?'THE EVALUATION LIMIT':'A REAL CHECKPOINT RUN',capped?'Thirty pipes. Still flying.':`${env.score} pipes cleared.`,`${cp.episode.toLocaleString()} training games · ${seconds}s aloft<br>${capped?'Stopped at the shared 30-pipe limit.':'This policy still has room to learn.'}`,'Replay sample',agentContext.journey?'The next checkpoint starts shortly.':'Choose another checkpoint or course above.');
  if(agentContext.journey)journeyTimer=setTimeout(()=>{if(pilot==='agent'&&!document.hidden&&!lab.next())$('overlayHint').textContent='Journey complete. Replay any checkpoint above.';},1400);
 }else{
  const record=env.score>(best[humanDifficulty]||0);if(record){best[humanDifficulty]=env.score;try{localStorage.setItem('flappy-lab-best',JSON.stringify(best));}catch{}$('best').textContent=String(env.score).padStart(2,'0');}
  $('status').textContent=env.done?'FLIGHT COMPLETE':'SAFETY LIMIT REACHED';overlay(!env.done?'180-SECOND SAFETY LIMIT':record?'A NEW PERSONAL BEST':'EVERY FLIGHT TEACHES YOU',record?'A new high.':'Back to the skies?',`${env.score} pipes cleared · ${seconds}s aloft<br>${env.done?'A fresh start is just a flap away.':'Stopped at the safety cutoff, still flying.'}`,'Fly again','or press <kbd>space</kbd> to try again');addHistory(COURSES[humanDifficulty]?.name||(humanDifficulty==='classic'?'Classic skies':'Gentle skies'),env.score+' pts');$('announcement').textContent=`Flight complete. Score ${env.score}.`;
 }
 tone(140,.2);refresh();
}
function tick(){
 if(pilot==='race'){
  race.step(queued?1:0);if(queued)tone(520);queued=false;env=race.human;if(race.human.done||race.ai.done||race.done)finish();return;
 }
 const previous=env.score;let action=queued?1:0;
 if(pilot==='agent')action=env.ticks%3===0?policyAction(env,agentContext.checkpoint.q):0;
 if(pilot==='challenge')action=env.ticks%3===0?arenaContext.actionFor(env):0;
 queued=false;env.step(action);if(action&&rate()<=2)tone(520);
 if(env.score>previous){tone(950,.12);$('toast').textContent='+1 · Nicely flown';$('toast').classList.add('show');clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('toast').classList.remove('show'),800);}
 const capped=pilot==='agent'&&(env.score>=agentContext.report.test.maxScore||env.ticks>=agentContext.report.test.maxTicks)||pilot==='challenge'&&env.ticks>=arenaContext.report.maxTicks||pilot==='human'&&env instanceof ChallengeEnv&&env.ticks>=10800;
 if(env.done||capped)finish();
}
function frame(t){if(!last)last=t;const elapsed=Math.min(100,t-last);last=t;if(mode==='playing'){accumulator+=elapsed*rate();while(accumulator>=1000/60&&mode==='playing'){accumulator-=1000/60;tick();}refresh();}renderGame(ctx,env,{time:t,mode,inspect:$('inspect').checked,rival:pilot==='race'?race?.ai:null});requestAnimationFrame(frame);}
function switchMode(value){if(value==='agent'&&!lab||['race','challenge'].includes(value)&&!arena)return;clearTimeout(journeyTimer);lab?.stop();pilot=value;for(const key of ['agent','human','challenge','race']){$(key+'Mode').classList.toggle('active',key===value);$(key+'Mode').setAttribute('aria-pressed',String(key===value));}$('learningLab').hidden=value!=='agent';$('challengeLab').hidden=!isArena();if(isArena())arena.setMode(value);$('difficulty').disabled=value!=='human';$('difficulty').value=value==='human'?humanDifficulty:'classic';$('difficultyHelp').textContent=isArena()?'Course and difficulty are set above.':value==='agent'?'Classic rules, identical to training.':'Choose a sky and find your rhythm.';document.querySelector('.mode-badge strong').textContent=value==='race'?'Human vs AI':value==='challenge'?'The pressure is rising':value==='agent'?'The agent is the pilot':'You’re the pilot';document.querySelector('.mode-badge small').textContent=value==='race'?'Same sky · Same clock · 1× speed':value==='challenge'?'Real adaptation. Measured results.':value==='agent'?'Saved Q-learning policies':'Your turn to fly';$('labStatus').textContent=value==='race'?'Last bird flying wins.':value==='challenge'?'Three changing courses. One tougher test.':value==='human'?'Your turn. Same rules, human intuition.':'Real saved checkpoints';reset();}
function scrollToGame(){$('stage').scrollIntoView({behavior:'smooth',block:'center'});}
$('start').addEventListener('click',start);canvas.addEventListener('pointerdown',e=>{e.preventDefault();start();});$('pause').addEventListener('click',pause);$('restart').addEventListener('click',()=>{const active=mode==='playing'||mode==='paused';reset();if(active)start();});
for(const key of ['agent','human','challenge','race'])$(key+'Mode').addEventListener('click',()=>switchMode(key));
$('sound').addEventListener('click',()=>{sound=!sound;$('sound').innerHTML='♪<span>Sound '+(sound?'on':'off')+'</span>';$('sound').setAttribute('aria-label',sound?'Mute sound':'Enable sound');tone(650);});
$('inspect').addEventListener('change',e=>{$('telemetry').hidden=!e.target.checked;});$('difficulty').addEventListener('change',e=>{humanDifficulty=e.target.value;reset();});
window.addEventListener('keydown',e=>{if(['SELECT','INPUT','TEXTAREA'].includes(document.activeElement.tagName))return;if(e.target.closest('button')&&['Space','Enter'].includes(e.code))return;if(['Space','ArrowUp','KeyW'].includes(e.code)){e.preventDefault();if(!e.repeat)start();}if(e.code==='KeyP'&&!e.repeat){e.preventDefault();pause();}if(e.code==='KeyR'&&!e.repeat){e.preventDefault();reset();start();}});
document.addEventListener('visibilitychange',()=>{if(document.hidden&&mode==='playing')pause();});window.addEventListener('blur',()=>{if(mode==='playing')pause();});
window.flappyLab=Object.freeze({createEnv:options=>new FlappyEnv(options),createChallenge:options=>new ChallengeEnv(options),getState:()=>({mode,pilot,checkpoint:pilot==='agent'?agentContext?.checkpoint.episode:isArena()?arenaContext?.checkpoint:null,...env.info(),observation:env.observe(),...(pilot==='race'?{race:race.summary()}:{} )}),pause:()=>{if(mode==='playing')pause();}});
reset();requestAnimationFrame(frame);
const legacyReady=loadLearningLab((context,autoplay)=>{agentContext=context;if(pilot!=='agent')return;if(autoplay===null){footer(`Agent / ${context.checkpoint.episode.toLocaleString()} games / ${context.speed}×`);return;}reset();if(autoplay){start();scrollToGame();}}).then(x=>{lab=x;}).catch(error=>{$('labLoading').textContent=error.message;});
const arenaReady=loadChallengeUI(autoplay=>{if(!isArena())return;if(autoplay===null){arenaContext=arena.context();footer(`${arenaContext.name} / ${arenaContext.speed}× playback`);return;}reset();if(autoplay){start();scrollToGame();}}).then(x=>{arena=x;}).catch(error=>{$('challengeLoading').textContent=error.message;});
Promise.all([legacyReady,arenaReady]).then(()=>{if(arena)switchMode('challenge');else if(lab)switchMode('agent');else switchMode('human');document.querySelector('.next-note').innerHTML='<div class="next-icon">✳</div><div><span>BUILT TO HANDLE CHANGE</span><p>Rising speed. Moving gaps.<br>A learning agent. And you.</p></div>';document.querySelector('.engine-note').innerHTML='<span class="green-dot"></span>Classic learning · Challenge adaptation';});
