/** Renderer-independent, deterministic 60 Hz environment. No browser dependencies. */
export const CONFIG = Object.freeze({width:900,height:500,ground:444,birdX:210,radius:14,gravity:0.38,flap:-6.25,pipeWidth:68,spacing:235,speed:2.7,gap:157});
export class FlappyEnv {
  constructor({seed=42,difficulty='classic'}={}) { this.config={...CONFIG,...(difficulty==='gentle'?{gap:190,speed:2.35}:{})}; this.reset(seed); }
  random(){ let t=this.rng+=0x6D2B79F5;t=Math.imul(t^t>>>15,t|1);t^=t+Math.imul(t^t>>>7,t|61);return ((t^t>>>14)>>>0)/4294967296; }
  reset(seed=42){this.seed=seed>>>0;this.rng=this.seed;this.y=222;this.velocity=0;this.score=0;this.ticks=0;this.flaps=0;this.done=false;this.pipes=[];for(let i=0;i<5;i++)this.addPipe(630+i*this.config.spacing);return this.observe();}
  addPipe(x){const c=this.config;this.pipes.push({x,top:65+this.random()*(c.ground-c.gap-130),passed:false});}
  nextPipe(){return this.pipes.find(p=>p.x+this.config.pipeWidth>=this.config.birdX-this.config.radius)||this.pipes[this.pipes.length-1];}
  observe(){const c=this.config,p=this.nextPipe();return {birdY:this.y/c.ground,velocity:this.velocity/10,pipeDistance:(p.x-c.birdX)/c.width,gapTop:p.top/c.ground,gapBottom:(p.top+c.gap)/c.ground};}
  step(action=0){if(action!==0&&action!==1)throw new RangeError('Action must be 0 (coast) or 1 (flap).');if(this.done)return {observation:this.observe(),reward:0,terminated:true,info:this.info()};const c=this.config; if(action===1){this.velocity=c.flap;this.flaps++;}this.velocity=Math.min(10,this.velocity+c.gravity);this.y+=this.velocity;this.ticks++;let reward=0.01;
    for(const p of this.pipes){p.x-=c.speed;if(!p.passed&&p.x+c.pipeWidth<c.birdX-c.radius){p.passed=true;this.score++;reward+=1;}}
    if(this.pipes[0].x+c.pipeWidth<0){this.pipes.shift();this.addPipe(this.pipes[this.pipes.length-1].x+c.spacing);}
    this.done=this.y-c.radius<=0||this.y+c.radius>=c.ground||this.pipes.some(p=>{const nearX=Math.max(p.x,Math.min(c.birdX,p.x+c.pipeWidth));const topY=Math.min(this.y,p.top),bottomY=Math.max(this.y,p.top+c.gap);return Math.hypot(c.birdX-nearX,this.y-topY)<c.radius||Math.hypot(c.birdX-nearX,this.y-bottomY)<c.radius;});
    if(this.done)reward=-1;return {observation:this.observe(),reward,terminated:this.done,info:this.info()};
  }
  info(){return {score:this.score,ticks:this.ticks,flaps:this.flaps,seconds:this.ticks/60,seed:this.seed};}
}
