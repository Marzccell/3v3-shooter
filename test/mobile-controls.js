'use strict';

// Exercise the browser client with independent touch pointers and changing viewports.
const assert = require('node:assert/strict');
const fs = require('node:fs');
const path = require('node:path');
const vm = require('node:vm');
const nodes = new Map(), events = {}, sent = [];
let canvasRect = {left:0, top:44, width:844, height:346},textWrites=0,elementID=0;
const drawCalls=[];
const ctx = new Proxy({createLinearGradient:() => ({addColorStop(){}}),drawImage(source){drawCalls.push(source);}}, {
  get:(object, key) => object[key] || (() => {})
});
function node(key) {
  if (!nodes.has(key)) nodes.set(key, {
    value:'', style:{}, width:1200, height:720,
    get textContent(){return this.text||'';},set textContent(value){textWrites++;this.text=String(value);},
    setAttribute(key,value){this[key]=value;},
    classList:{add(){}, remove(){}, toggle(){}},
    addEventListener(type, fn){this[type] = fn;},
    getContext(type,options){this.contextOptions=options;return ctx;},
    getBoundingClientRect:() => key === 'game' ? canvasRect : {
      left:key === 'aimStick' ? 724 : 16, top:220, width:104, height:104
    },
    querySelector:() => node(key + '-knob'),
    setPointerCapture(id){this.pointer = id;},
    hasPointerCapture(id){return this.pointer === id;},
    releasePointerCapture(){this.pointer = null;},
    replaceChildren(){}, append(){}
  });
  return nodes.get(key);
}
const document = {
  body:{dataset:{}, classList:node('body').classList},
  documentElement:{}, getElementById:node, createElement:tag=>node(tag+'-'+(++elementID)),
  addEventListener(type, fn){events[type] = fn;}
};
const sandbox = {
  document,
  window:{devicePixelRatio:3, addEventListener(type, fn){events[type] = fn;}},
  screen:{orientation:{lock:async() => {}}},
  matchMedia:() => ({matches:true}),
  location:{protocol:'http:', host:'localhost', search:''}, URLSearchParams,
  performance:{now:() => 100},
  setInterval(fn){sandbox.tick = fn;},
  requestAnimationFrame(fn){sandbox.frame = fn;},
  WebSocket:class {
    constructor(){sandbox.socket = this;this.readyState = 1;}
    send(raw){sent.push(JSON.parse(raw));}
  }
};
vm.createContext(sandbox);
for(const file of ['arena-map.js','audio.js','app.js'])vm.runInContext(fs.readFileSync(path.join(__dirname, '../public/'+file), 'utf8'), sandbox);
sandbox.socket.onopen();
sandbox.socket.onmessage({data:JSON.stringify({type:'joined', id:'me'})});
sandbox.socket.onmessage({data:JSON.stringify({
  type:'state', phase:'playing',
  players:[{id:'me', name:'Bintang', team:'blue', x:100, y:360, hp:100, dashCooldown:0, invulnerable:1}],
  walls:[], bullets:[], score:{blue:0, red:0}, remaining:180
})});
const input = () => {sandbox.tick();return sent.at(-1).input;};
const pointer = (pointerId, clientX, clientY) => ({pointerId, clientX, clientY, preventDefault(){}});

const sameState=vm.runInContext('JSON.stringify(current)',sandbox),beforeWrites=textWrites;
for(let i=0;i<30;i++)sandbox.socket.onmessage({data:sameState});
assert.equal(textWrites,beforeWrites,'unchanged network snapshots must not rewrite HUD text');
const healthChanged=JSON.parse(sameState);healthChanged.players[0].hp=75;
sandbox.socket.onmessage({data:JSON.stringify(healthChanged)});assert.equal(node('health').textContent,'HP 75','real HUD changes still appear immediately');
sandbox.socket.onmessage({data:sameState});

// Two thumbs can move and shoot at the same time; releasing one preserves the other.
node('moveStick').onpointerdown(pointer(1, 104, 272));
node('aimStick').onpointerdown(pointer(2, 776, 236));
assert.ok(input().mx > .9);
assert.equal(input().ay, -1);
assert.equal(input().fire, true);
node('aimStick').onpointerup(pointer(99, 776, 236));
assert.equal(input().fire, true, 'an unrelated finger cannot release aim');
node('aimStick').onpointerup(pointer(2, 776, 236));
assert.equal(input().fire, false);
assert.ok(input().mx > .9, 'releasing aim must preserve movement');
node('moveStick').onpointercancel(pointer(1, 104, 272));
assert.equal(input().mx, 0);

// A small finger wobble near the center must neither move nor fire.
node('moveStick').onpointerdown(pointer(3, 69, 272));
node('aimStick').onpointerdown(pointer(4, 777, 272));
assert.equal(input().mx, 0);
assert.equal(input().fire, false);
events.blur();

for (const [width, height] of [[844,346], [667,331], [915,368], [390,800], [3840,2160]]) {
  canvasRect = {left:0, top:44, width, height};
  node('moveStick').onpointerdown(pointer(5, 104, 272));
  node('dash').onpointerdown({preventDefault(){}});
  events.resize();
  const view = vm.runInContext('view', sandbox);
  const canvas = node('game');
  const density=Math.min(1,1280/Math.max(width,height));
  assert.equal(canvas.width,Math.round(width*density),'mobile pixel surface is bounded');
  assert.equal(canvas.height,Math.round(height*density));
  assert.ok(canvas.width*canvas.height<=width*height,'high-DPI screens no longer multiply the render workload');
  assert.ok(view.x >= 0 && view.y >= 0);
  assert.ok(view.x + sandbox.ArenaMap.width * view.scale <= canvas.width + .001);
  assert.ok(view.y + sandbox.ArenaMap.height * view.scale <= canvas.height + .001, 'the entire arena remains visible');
  assert.equal(input().mx, 0, 'rotation clears held movement');
  assert.equal(input().dash, false);
  assert.equal(node('moveStick-knob').style.transform, '');
  sandbox.frame();
  const layer=vm.runInContext('arenaLayer',sandbox),backdrop=vm.runInContext('arenaBackdrop',sandbox);
  const floorCopies=drawCalls.filter(source=>source===layer).length;
  sandbox.frame();events.resize();sandbox.frame();
  assert.equal(drawCalls.filter(source=>source===layer).length,floorCopies,'unchanged frames and resize notifications reuse the pre-scaled map');
  assert.equal(backdrop.width,canvas.width);assert.equal(backdrop.height,canvas.height);
  assert.equal(canvas.contextOptions.alpha,false);assert.equal(backdrop.contextOptions.alpha,false);
  node('game').pointermove({pointerType:'mouse',clientX:canvasRect.left+(view.x+500*view.scale)*width/canvas.width,clientY:canvasRect.top+(view.y+360*view.scale)*height/canvas.height});
  const mouse=vm.runInContext('mouse',sandbox);assert.ok(Math.abs(mouse.x-1)<.000001&&Math.abs(mouse.y)<.000001,'world-space aim is independent of render resolution');
}

async function fullscreen() {
  let requests = 0;
  document.documentElement.requestFullscreen = async() => {requests++;document.fullscreenElement = document.documentElement;};
  document.exitFullscreen = async() => {document.fullscreenElement = null;};
  await node('fullscreen').onclick();
  assert.equal(requests, 1);
  events.fullscreenchange();
  assert.equal(node('fullscreen').textContent, 'Keluar layar penuh');
  await node('fullscreen').onclick();
  assert.equal(document.fullscreenElement, null);
  document.documentElement.requestFullscreen = async() => {throw Error('Unsupported');};
  await node('fullscreen').onclick(); // Rejection must leave browser play usable.
  assert.equal(input().fire, false);
  node('controlMode').onclick();
  assert.equal(node('game').width,sandbox.ArenaMap.width);
  const key=code=>({code,repeat:false,preventDefault(){}});
  events.keydown(key('KeyD'));events.keydown(key('KeyW'));events.keydown(key('Space'));
  const desktopInput=input();assert.equal(desktopInput.mx,1);assert.equal(desktopInput.my,-1);assert.equal(desktopInput.dash,true);assert.equal(input().dash,false,'dash is sent once');
  events.keyup(key('KeyW'));events.keyup(key('KeyD'));assert.equal(input().mx,0);assert.equal(input().my,0);
  node('game').pointerdown({pointerType:'mouse',button:0,pointerId:9,clientX:canvasRect.width*500/node('game').width,clientY:canvasRect.top+canvasRect.height*360/node('game').height});
  assert.equal(input().ax,1);assert.equal(input().ay,0,'mouse aims correctly on the enlarged map');assert.equal(input().fire,true);
  node('game').pointerup();assert.equal(input().fire,false);
  events.keydown({...key('KeyD'),target:{closest:()=>true}});assert.equal(input().mx,0,'audio slider keyboard controls do not move the player');
  console.log('LULUS: joystick dua jari, 5 ukuran HP/tablet, render ringan, cache latar, HUD tanpa penulisan berulang, rotasi/fullscreen, WASD dan bidikan sesuai koordinat arena.');
}
fullscreen().catch(error => {console.error(error);process.exitCode = 1;});
