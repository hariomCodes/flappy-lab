const $=id=>document.getElementById(id);
export async function loadLearningLab(callback){
 const response=await fetch('models/training.json');if(!response.ok)throw new Error('Saved training results could not be loaded.');const report=await response.json();
 const displayed=[0,2000,10000,25000,50000],names=['No lessons yet','Finding lift','First breakthroughs','More practice','50,000 flights'];
 let cp=report.checkpoints[0],course=0,speed=4,journey=false;
 const testFor=()=>report.test.results.find(r=>r.episode===cp.episode);
 const ctx=()=>({report,checkpoint:cp,seed:report.test.seeds[course],course,speed,journey});
 function refresh(){const test=testFor();$('agentMean').textContent=test.meanScore.toFixed(2);$('agentSuccess').textContent=`${test.capped} of 100 runs reached the 30-pipe limit`;$('checkpointSelect').value=cp.id;$('checkpointCards').querySelectorAll('button').forEach(b=>{b.classList.toggle('selected',b.dataset.id===cp.id);b.setAttribute('aria-pressed',b.dataset.id===cp.id?'true':'false');});const sample=test.runs[course];$('sampleExpected').textContent=`This course: ${sample.score} pipes · ${sample.seconds.toFixed(1)}s${sample.capped?' · limit reached':''}`;$('labStatus').textContent=`Saved checkpoint · ${cp.episode.toLocaleString()} training games`;$('watchJourney').innerHTML=journey?'Stop journey <span>Ⅱ</span>':'Watch the journey <span>▷</span>';$('watchJourney').setAttribute('aria-pressed',String(journey));}
 function choose(id,autoplay=true){cp=report.checkpoints.find(c=>c.id===id);refresh();callback(ctx(),autoplay);}
 $('checkpointCards').innerHTML=displayed.map((ep,i)=>{const c=report.checkpoints.find(c=>c.episode===ep),t=report.test.results.find(c=>c.episode===ep);return `<button class="checkpoint-card" data-id="${c.id}" aria-pressed="false"><small>${ep.toLocaleString()} GAMES</small><strong>${names[i]}</strong><b>${t.meanScore.toFixed(2)}</b><span>avg. pipes</span></button>`;}).join('');
 $('checkpointCards').querySelectorAll('button').forEach(b=>b.addEventListener('click',()=>{journey=false;choose(b.dataset.id);}));
 $('checkpointSelect').innerHTML=report.checkpoints.map(c=>`<option value="${c.id}">${c.episode.toLocaleString()} training games</option>`).join('');$('checkpointSelect').addEventListener('change',e=>{journey=false;choose(e.target.value);});
 $('courseSelect').innerHTML=report.test.seeds.map((seed,i)=>`<option value="${i}">Course ${String(i+1).padStart(2,'0')} · seed ${seed}</option>`).join('');$('courseSelect').addEventListener('change',e=>{course=Number(e.target.value);journey=false;refresh();callback(ctx(),true);});
 $('playbackSpeed').addEventListener('change',e=>{speed=Number(e.target.value);callback(ctx(),null);});
 $('watchJourney').addEventListener('click',()=>{journey=!journey;if(journey)choose('ep-0');else{refresh();callback(ctx(),false);}});
 const points=report.curve.map(p=>`${36+p.episode/report.episodes*595},${91-p.meanScore/30*79}`).join(' ');
 $('learningCurve').innerHTML=[0,10,20,30].map(n=>`<line x1="36" y1="${91-n/30*79}" x2="631" y2="${91-n/30*79}" stroke="#dfe6d5" stroke-dasharray="3 4"/><text x="23" y="${95-n/30*79}" text-anchor="end" font-size="8" fill="#9aac88">${n}</text>`).join('')+`<polyline points="${points}" fill="none" stroke="#6f9562" stroke-width="2.2" stroke-linejoin="round"/><text x="36" y="114" font-size="8" fill="#9aac88">0 games</text><text x="631" y="114" text-anchor="end" font-size="8" fill="#9aac88">50,000 games</text>`;
 $('labContent').hidden=false;$('labLoading').hidden=true;refresh();
 return {context:ctx,refresh,stop(){journey=false;refresh();},next(){if(!journey)return false;const index=displayed.indexOf(cp.episode);if(index>=0&&index<displayed.length-1){choose('ep-'+displayed[index+1]);return true;}journey=false;refresh();return false;}};
}
