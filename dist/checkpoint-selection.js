// Shared by training, report generation, and gameplay. Test scores never enter selection.
export const VALIDATION_COURSES=Object.freeze(['ramp','drift','endurance']);
export function validationScore(metrics){
 const values=VALIDATION_COURSES.map(course=>{const matches=metrics.filter(m=>m.course===course);if(matches.length!==1||!Number.isFinite(matches[0].meanSeconds))throw new Error(`Missing or invalid validation result for ${course}.`);return matches[0].meanSeconds;});
 return values.reduce((sum,value)=>sum+value,0)/values.length;
}
export function selectBestCheckpoint(checkpoints){
 if(!checkpoints.length)throw new Error('No saved checkpoints are available.');
 return checkpoints.reduce((best,candidate)=>{const score=validationScore(candidate.validation),bestScore=validationScore(best.validation);return score>bestScore||(score===bestScore&&candidate.episode<best.episode)?candidate:best;});
}
export function selectionMetadata(checkpoints){const best=selectBestCheckpoint(checkpoints);return {checkpointId:best.id,episode:best.episode,source:'validation',criterion:'Mean survival seconds, equally weighted across ramp, drift, and endurance',tieBreak:'Earliest training episode',validationMeanSeconds:validationScore(best.validation),candidates:checkpoints.map(cp=>({checkpointId:cp.id,episode:cp.episode,validationMeanSeconds:validationScore(cp.validation)}))};}
