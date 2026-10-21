'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),vm=require('node:vm');
const game=require('../game'),arena=game.arena;

// Preserve the six original covers, symmetry, open middle, and all spawn routes.
const original=[[260,130,90,180],[850,130,90,180],[520,260,160,60],[520,400,160,60],[260,410,90,180],[850,410,90,180]];
for(let i=0;i<original.length;i++)assert.deepEqual(['x','y','w','h'].map(key=>arena.walls[i][key]),original[i].map(value=>value*1.25));
assert.equal(arena.walls.length,18);
for(const wall of arena.walls){
  assert.ok(wall.x>18&&wall.y>18&&wall.x+wall.w<arena.width-18&&wall.y+wall.h<arena.height-18);
  assert.ok(arena.walls.some(other=>other.x===arena.width-wall.x-wall.w&&other.y===wall.y&&other.w===wall.w&&other.h===wall.h),'both teams get mirrored cover');
}
function free(x,y){return !arena.walls.some(wall=>{
  const dx=x-game.clamp(x,wall.x,wall.x+wall.w),dy=y-game.clamp(y,wall.y,wall.y+wall.h);
  return dx*dx+dy*dy<18*18;
});}
const columns=147,rows=87,visited=new Set(),queue=[[0,0]];
visited.add(0);
for(let i=0;i<queue.length;i++){
  const [x,y]=queue[i];
  for(const [dx,dy] of [[1,0],[-1,0],[0,1],[0,-1]]){
    const nx=x+dx,ny=y+dy,key=ny*columns+nx;
    if(nx<0||ny<0||nx>=columns||ny>=rows||visited.has(key)||!free(20+nx*10,20+ny*10))continue;
    visited.add(key);queue.push([nx,ny]);
  }
}
for(let y=0;y<rows;y++)for(let x=0;x<columns;x++)if(free(20+x*10,20+y*10))assert.ok(visited.has(y*columns+x),'no isolated walkable pockets');
for(const team of ['blue','red'])for(let i=0;i<3;i++){
  const player={team};game.spawn(player,i);assert.ok(free(player.x,player.y));
  const x=Math.round((player.x-20)/10),y=Math.round((player.y-20)/10);assert.ok(visited.has(y*columns+x),'all six spawn positions connect');
}
for(let x=20;x<arena.width-20;x+=10)assert.ok(free(x,arena.height/2),'the familiar central lane stays open');
// Every additional cover stops both movement/dashes and projectiles.
for(const wall of arena.walls.slice(6)){
  const player={team:'blue',id:'test'};game.spawn(player);player.x=wall.x-25;player.y=wall.y+wall.h/2;
  player.input={mx:1,my:0,ax:1,ay:0,fire:false,dash:true};
  const room={players:[player],score:{blue:0,red:0},bullets:[]};game.step(room,.15,10);
  assert.ok(player.x<=wall.x-18,'dash stops at new cover');
  player.x=wall.x-25;player.input={mx:0,my:0,ax:1,ay:0,fire:true,dash:false};player.cooldown=0;game.step(room,.1,11);
  assert.equal(room.bullets.length,0,'new cover blocks shots');
}

const timers=new Map(),tones=[];let timerID=0,saved=null;
const parameter=()=>({value:0,setValueAtTime(){},exponentialRampToValueAtTime(){},setTargetAtTime(value){this.value=value;}});
class FakeContext{
  constructor(){this.currentTime=0;this.state='suspended';this.destination={};}
  async resume(){this.state='running';}
  createGain(){return {gain:parameter(),connect(){},disconnect(){}};}
  createOscillator(){const oscillator={frequency:parameter(),connect(){},disconnect(){},start(){},stop(){}};tones.push(oscillator);return oscillator;}
}
const sandbox={AudioContext:FakeContext,localStorage:{getItem:()=>saved,setItem:(key,value)=>saved=value},setInterval(fn){timers.set(++timerID,fn);return timerID;},clearInterval(id){timers.delete(id);}};
vm.createContext(sandbox);vm.runInContext(fs.readFileSync(require.resolve('../public/audio.js'),'utf8'),sandbox);
async function run(){
  const audio=new sandbox.ArenaAudio();assert.equal(audio.context,null,'no audio before a gesture');
  audio.setState(true,false);assert.equal(timers.size,0);
  assert.equal(await audio.unlock(),true);assert.equal(timers.size,1);assert.ok(tones.length>0);
  audio.setState(true,false);assert.equal(timers.size,1,'state updates do not duplicate the sequencer');
  const before=tones.length;audio.blip();assert.equal(tones.length,before+1);
  await audio.toggle('effects');audio.blip();assert.equal(tones.length,before+1,'effects mute independently');assert.equal(timers.size,1);
  audio.setVolume(.7);assert.equal(audio.volume,.7);assert.equal(new sandbox.ArenaAudio().volume,.7,'settings persist');
  audio.setVolume(5);assert.equal(audio.volume,1);audio.setVolume(NaN);assert.equal(audio.volume,1);
  for(const [playing,hidden] of [[true,true],[false,false]]){audio.setState(playing,hidden);assert.equal(timers.size,0);assert.equal(audio.bus.gain.value,0);}
  audio.setState(true,false);assert.equal(timers.size,1);audio.context.currentTime+=120;const count=tones.length;audio.schedule();assert.ok(tones.length-count<15,'returning to the tab never replays the backlog');
  await audio.toggle('music');assert.equal(timers.size,0);assert.equal(audio.bus.gain.value,0);
  saved='{broken';assert.doesNotThrow(()=>new sandbox.ArenaAudio());
  sandbox.AudioContext=undefined;assert.equal(await new sandbox.ArenaAudio().unlock(),false,'unavailable audio does not break the game');
  console.log('LULUS: geometri map lama, 18 cover simetris, seluruh jalur/spawn tersambung, collision/peluru cover baru, musik/efek, volume, penyimpanan, pause/resume, tanpa autoplay atau penjadwal ganda.');
}
run().catch(error=>{console.error(error);process.exitCode=1;});
