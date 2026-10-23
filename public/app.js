'use strict';
const $=id=>document.getElementById(id),admin=document.body.dataset.admin==='true';let ws,id=null,current=null,frames=[],connected=false,keys={},mouse={x:1,y:0,fire:false},movement={x:0,y:0},aim={x:1,y:0,fire:false},dash=false,ready=false,touchMode=matchMedia('(pointer:coarse), (any-pointer:coarse)').matches;
const canvas=$('game'),ctx=canvas.getContext('2d',{alpha:false});$('code')&&($('code').value=new URLSearchParams(location.search).get('room')||'');
const send=m=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};function notice(s){$('notice').textContent=s;}
const arena=globalThis.ArenaMap;
let view={scale:1,x:0,y:0};
function updateAudioUI(){
  for(const [kind,key] of [['music','musicToggle'],['effects','effectsToggle']]){const button=$(key);button.textContent=(kind==='music'?'Musik':'Efek')+(sound[kind]?': aktif':': mati');button.setAttribute('aria-pressed',String(sound[kind]));}
  $('musicVolume').value=Math.round(sound.volume*100);$('volumeLabel').textContent=Math.round(sound.volume*100)+'%';
}
const sound=admin?null:new ArenaAudio(updateAudioUI);
function syncAudio(){sound?.setState(connected&&current?.phase==='playing',document.hidden===true);}
function showAudio(open){if(open)resetControls();$('audioSettings').classList.toggle('hidden',!open);for(const key of ['sound','soundLobby'])$(key).setAttribute('aria-expanded',String(open));}
if(!admin){
  updateAudioUI();let audioOpen=false;
  for(const key of ['sound','soundLobby'])$(key).onclick=()=>{audioOpen=!audioOpen;showAudio(audioOpen);void sound.unlock();};
  $('closeAudio').onclick=()=>{audioOpen=false;showAudio(false);};
  for(const [kind,key] of [['music','musicToggle'],['effects','effectsToggle']])$(key).onclick=async()=>{if(!await sound.toggle(kind))$('audioStatus').textContent='Audio belum tersedia. Coba ketuk lagi atau gunakan browser lain.';else $('audioStatus').textContent='';};
  $('musicVolume').oninput=e=>sound.setVolume(Number(e.target.value)/100);
  document.addEventListener('pointerdown',()=>{if(sound.context&&sound.context.state!=='running')void sound.unlock();});
}

const stickResets=[];function resetControls(){keys={};mouse.fire=false;movement={x:0,y:0};aim.fire=false;dash=false;for(const reset of stickResets)reset();}
function connect(){ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);ws.onopen=()=>{connected=true;if(admin)send({type:'admin',token:location.hash.slice(1)});else notice('Terhubung. Masukkan nama dan gabung.');};ws.onclose=()=>{connected=false;syncAudio();resetControls();document.body.classList.remove('playing');$('arena').classList.add('hidden');notice('Koneksi terputus. Pastikan Wi-Fi tersambung, lalu muat ulang halaman untuk masuk kembali.');if(admin)$('connection').textContent='Koneksi terputus — muat ulang setelah server aktif.';};ws.onerror=()=>notice('Tidak dapat terhubung ke server. Periksa alamat dan Wi-Fi.');ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='ping'){send({type:'pong'});return;}if(m.type==='error'){notice(m.message);return;}if(m.type==='adminOK'){$('connection').textContent='Pengelola terhubung';notice('');return;}if(m.type==='joined'){id=m.id;$('joinPanel').classList.add('hidden');$('lobby').classList.remove('hidden');notice('');}if(m.type==='state'){if(!admin&&!id)return;const prev=current;current=m;frames.push({time:performance.now(),s:m});if(frames.length>8)frames.shift();const phaseChanged=prev?.phase!==m.phase;if(phaseChanged){resetControls();frames=[{time:performance.now(),s:m}];}updateUI();if(phaseChanged){resizeCanvas();syncAudio();}}};}
function updateTeams(){const target=$('teams');target.replaceChildren();for(const team of ['blue','red']){const div=document.createElement('div');div.className='team '+team;const h=document.createElement('h3');h.textContent=`Tim ${team==='blue'?'Biru':'Merah'} (${current.players.filter(p=>p.team===team).length}/3)`;div.append(h);for(const p of current.players.filter(p=>p.team===team)){const row=document.createElement('div');row.className='player';const n=document.createElement('span');n.textContent=p.name+(p.id===id?' (kamu)':'');row.append(n);const mark=document.createElement('span');mark.className='readyMark';mark.textContent=p.ready?'✓ Siap':'Menunggu';row.append(mark);if(admin&&current.phase==='lobby'){const select=document.createElement('select');for(const t of ['blue','red']){const opt=new Option(t==='blue'?'Biru':'Merah',t);select.add(opt);}select.value=p.team;select.onchange=()=>send({type:'team',id:p.id,team:select.value});row.append(select);}div.append(row);}target.append(div);}}
function setText(key,value){const node=$(key),text=String(value);if(node.textContent!==text)node.textContent=text;}
let teamSignature='';function updateUI(){const playing=current.phase==='playing';document.body.classList.toggle('playing',playing);$('arena').classList.toggle('hidden',!playing);$('result').classList.toggle('hidden',current.phase!=='results');const signature=JSON.stringify([current.phase,current.players.map(p=>[p.id,p.name,p.team,p.ready])]);if(signature!==teamSignature){teamSignature=signature;updateTeams();}if(admin){$('create').disabled=current.phase!=='empty';$('roomInfo').classList.toggle('hidden',!current.code);if(current.code){setText('roomCode',current.code);updateJoin();}$('start').disabled=current.phase!=='lobby'||current.players.length!==6||current.players.some(p=>!p.ready)||current.players.filter(p=>p.team==='blue').length!==3;$('reset').disabled=current.phase==='empty';}else{$('lobby').classList.toggle('hidden',current.phase!=='lobby');ready=current.players.find(p=>p.id===id)?.ready||false;setText('ready',ready?'Siap ✓ (klik untuk batal)':'Saya siap!');}setText('lobbyMsg',current.message||'Tunggu pengelola memulai pertandingan.');if(current.phase==='results'){setText('winner',current.message);setText('finalScore',`Biru ${current.score.blue} : ${current.score.red} Merah`);}if(playing){setText('scoreB',current.score.blue);setText('scoreR',current.score.red);const seconds=current.remaining;setText('timer',`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`);const me=current.players.find(p=>p.id===id);if(me){setText('health',`HP ${me.hp}`);setText('respawn',me.hp<=0?'HP habis — kembali dalam 3 detik…':'');setText('dash',me.dashCooldown>.1?`${me.dashCooldown.toFixed(1)}s`:'DASH');}}}
function updateJoin(){if(!admin||!current?.code||!$('ip').value)return;const url=`http://${$('ip').value}:${location.port||3000}/?room=${current.code}`;$('joinLink').textContent=url;$('joinLink').href=url;const qrURL=`/qr?host=${encodeURIComponent($('ip').value)}&room=${current.code}`;if($('qr').getAttribute('src')!==qrURL)$('qr').src=qrURL;}
if(admin){fetch('/api/network').then(r=>r.json()).then(n=>{for(const ip of n.ips)$('ip').add(new Option(ip,ip));if(!n.ips.length){$('ip').add(new Option('localhost (jaringan belum terdeteksi)','localhost'));notice('Jaringan LAN belum terdeteksi. Sambungkan laptop ke Wi-Fi dan muat ulang.');}updateJoin();});$('ip').onchange=updateJoin;$('create').onclick=()=>send({type:'create'});$('start').onclick=()=>{notice('');send({type:'start'});};$('reset').onclick=()=>send({type:'reset'});}else{$('joinForm').onsubmit=e=>{e.preventDefault();if(!connected)return notice('Server belum tersambung');void sound.unlock();send({type:'join',code:$('code').value.trim(),name:$('nickname').value});};$('ready').onclick=()=>{void sound.unlock();send({type:'ready',ready:!ready});if(touchMode&&!ready)enterFullscreen();};}
window.addEventListener('keydown',e=>{if(current?.phase!=='playing'||admin||e.target?.closest?.('#audioSettings'))return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Space'&&!e.repeat)dash=true;});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',resetControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetControls();syncAudio();});
function updateMouseAim(e){if(e.pointerType==='touch')return;const p=current?.players.find(p=>p.id===id);if(!p)return;const rect=canvas.getBoundingClientRect();let dx=((e.clientX-rect.left)*canvas.width/rect.width-view.x)/view.scale-p.x,dy=((e.clientY-rect.top)*canvas.height/rect.height-view.y)/view.scale-p.y,l=Math.hypot(dx,dy)||1;mouse.x=dx/l;mouse.y=dy/l;}canvas.addEventListener('pointermove',updateMouseAim);canvas.addEventListener('pointerdown',e=>{if(e.pointerType!=='touch'&&e.button===0){updateMouseAim(e);mouse.fire=true;canvas.setPointerCapture(e.pointerId);}});canvas.addEventListener('pointerup',()=>mouse.fire=false);canvas.addEventListener('pointercancel',()=>mouse.fire=false);canvas.addEventListener('lostpointercapture',()=>mouse.fire=false);canvas.oncontextmenu=e=>e.preventDefault();
function stick(el,isAim){
  let pointer=null;const knob=el.querySelector('i');
  stickResets.push(()=>{const held=pointer;pointer=null;knob.style.transform='';if(held!==null&&el.hasPointerCapture(held))el.releasePointerCapture(held);});
  function move(e){
    const r=el.getBoundingClientRect(),max=r.width*.32;
    const dx=e.clientX-r.left-r.width/2,dy=e.clientY-r.top-r.height/2,length=Math.hypot(dx,dy);
    const radius=Math.min(length,max),nx=length?dx/length:0,ny=length?dy/length:0;
    knob.style.transform=`translate(${nx*radius}px,${ny*radius}px)`;
    const strength=Math.max(0,(radius/max-.12)/.88);
    if(isAim){if(strength>0)aim={x:nx,y:ny,fire:true};else aim.fire=false;}
    else movement={x:nx*strength,y:ny*strength};
  }
  el.onpointerdown=e=>{e.preventDefault();if(pointer!==null)return;pointer=e.pointerId;el.setPointerCapture(pointer);move(e);};
  el.onpointermove=e=>{if(pointer===e.pointerId){e.preventDefault();move(e);}};
  function end(e){if(pointer!==e.pointerId)return;pointer=null;knob.style.transform='';if(isAim)aim.fire=false;else movement={x:0,y:0};}
  el.onpointerup=end;el.onpointercancel=end;el.onlostpointercapture=end;
}
if(!admin){stick($('moveStick'),false);stick($('aimStick'),true);$('dash').onpointerdown=e=>{e.preventDefault();dash=true;};}

function resizeCanvas(){
  if(!touchMode||admin){
    if(canvas.width!==arena.width)canvas.width=arena.width;
    if(canvas.height!==arena.height)canvas.height=arena.height;
    view={scale:1,x:0,y:0};return;
  }
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  // Mobile draws at CSS resolution instead of paying for 2x pixels per axis.
  // Keep a bounded surface on tablets too; world coordinates stay unchanged.
  const dpr=Math.min(window.devicePixelRatio||1,1,1280/Math.max(r.width,r.height));
  const w=Math.max(1,Math.round(r.width*dpr)),h=Math.max(1,Math.round(r.height*dpr));
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  const scale=Math.min(w/arena.width,h/arena.height);view={scale,x:(w-arena.width*scale)/2,y:(h-arena.height*scale)/2};
}
function updateFullscreenLabel(){
  if(admin)return;const active=!!(document.fullscreenElement||document.webkitFullscreenElement);
  for(const key of ['fullscreen','fullscreenLobby']){$(key).textContent=active?'Keluar layar penuh':'Layar penuh';$(key).classList.toggle('hidden',!(document.documentElement.requestFullscreen||document.documentElement.webkitRequestFullscreen));}
}
async function enterFullscreen(){
  const root=document.documentElement,request=root.requestFullscreen||root.webkitRequestFullscreen;
  if(!(document.fullscreenElement||document.webkitFullscreenElement)&&request){try{await request.call(root);}catch{return;}}
  if(touchMode&&screen.orientation?.lock){try{await screen.orientation.lock('landscape');}catch{}}
  resizeCanvas();updateFullscreenLabel();
}
if(!admin){
  const toggleFullscreen=async()=>{const exit=document.exitFullscreen||document.webkitExitFullscreen;if((document.fullscreenElement||document.webkitFullscreenElement)&&exit){try{await exit.call(document);}catch{}}else await enterFullscreen();};
  $('fullscreen').onclick=toggleFullscreen;$('fullscreenLobby').onclick=toggleFullscreen;updateFullscreenLabel();
  for(const event of ['fullscreenchange','webkitfullscreenchange'])document.addEventListener(event,()=>{resetControls();resizeCanvas();updateFullscreenLabel();});
  window.addEventListener('resize',()=>{resetControls();resizeCanvas();});
  if(window.visualViewport)window.visualViewport.addEventListener('resize',resizeCanvas);
  if(typeof ResizeObserver!=='undefined')new ResizeObserver(resizeCanvas).observe(canvas);
}

let lastSound=0;setInterval(()=>{if(admin||current?.phase!=='playing'||!connected)return;const coarse=touchMode;const input={mx:coarse?movement.x:(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),my:coarse?movement.y:(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0),ax:coarse?aim.x:mouse.x,ay:coarse?aim.y:mouse.y,fire:coarse?aim.fire:mouse.fire,dash};send({type:'input',input});dash=false;if(input.fire&&performance.now()-lastSound>320){lastSound=performance.now();sound.blip();}},1000/30);

let arenaLayer=null,arenaBackdrop=null,backdropKey='';
function buildArenaLayer(){
  arenaLayer=document.createElement('canvas');arenaLayer.width=arena.width;arenaLayer.height=arena.height;
  const g=arenaLayer.getContext('2d'),w=arena.width,h=arena.height;
  const floor=g.createLinearGradient(0,0,w,h);floor.addColorStop(0,'#264c4d');floor.addColorStop(.5,'#315a55');floor.addColorStop(1,'#23474c');
  g.fillStyle=floor;g.fillRect(0,0,w,h);
  // Keep the familiar open middle and two flanks, with subtle training lanes.
  g.fillStyle='#adc9bb0b';for(const y of [35,h/2-52,h-135])g.fillRect(24,y,w-48,100);
  g.strokeStyle='#d0e9d00a';g.lineWidth=1;
  for(let x=0;x<w;x+=50){g.beginPath();g.moveTo(x,0);g.lineTo(x,h);g.stroke();}
  for(let y=0;y<h;y+=50){g.beginPath();g.moveTo(0,y);g.lineTo(w,y);g.stroke();}
  for(const blue of [true,false]){
    const x=blue?20:w-190,center=blue?arena.spawnInset:w-arena.spawnInset;
    g.fillStyle=blue?'#4baef014':'#f4877214';g.fillRect(x,20,170,h-40);
    g.strokeStyle=blue?'#78c9ff48':'#ffa18b48';g.lineWidth=2;
    g.setLineDash([8,10]);g.beginPath();g.moveTo(blue?190:w-190,35);g.lineTo(blue?190:w-190,h-35);g.stroke();g.setLineDash([]);
    for(const y of arena.spawnYs){g.beginPath();g.arc(center,y,38,0,Math.PI*2);g.stroke();g.beginPath();g.arc(center,y,30,0,Math.PI*2);g.stroke();}
    g.fillStyle=blue?'#91d6ff99':'#ffb3a099';g.font='bold 16px system-ui';g.textAlign='center';g.fillText(blue?'BIRU':'MERAH',center,60);
  }
  g.strokeStyle='#b7d9b725';g.lineWidth=2;g.beginPath();g.arc(w/2,h/2,44,0,Math.PI*2);g.stroke();
  g.beginPath();g.moveTo(w/2-14,h/2);g.lineTo(w/2+14,h/2);g.moveTo(w/2,h/2-14);g.lineTo(w/2,h/2+14);g.stroke();
  for(const wall of current.walls){
    const {x,y,w:width,h:height,kind}=wall;
    g.fillStyle='#071c2866';g.beginPath();g.roundRect(x+6,y+9,width,height,6);g.fill();
    const top=g.createLinearGradient(x,y,x,y+height);top.addColorStop(0,kind==='crate'?'#a69a72':kind==='planter'?'#6d8975':'#77969a');top.addColorStop(1,kind==='crate'?'#6b715e':'#4b6d75');
    g.fillStyle=top;g.strokeStyle='#233e49';g.lineWidth=3;g.beginPath();g.roundRect(x,y,width,height,5);g.fill();g.stroke();
    g.fillStyle='#d5e7db55';g.fillRect(x+5,y+3,width-10,4);
    g.fillStyle='#1d3f4c55';g.fillRect(x+5,y+height-9,width-10,5);
    if(kind==='planter'){
      g.fillStyle='#254d41';g.fillRect(x+8,y+10,width-16,height-20);
      for(let n=0;n<5;n++){g.fillStyle=n%2?'#6eae7d':'#4b8d69';g.beginPath();g.ellipse(x+18+n*(width-36)/4,y+height/2,14,12,n*.7,0,Math.PI*2);g.fill();}
    }else if(kind==='crate'){
      g.strokeStyle='#d6d1a44d';g.lineWidth=2;g.strokeRect(x+10,y+12,width-20,height-24);
      g.beginPath();g.moveTo(x+12,y+height-14);g.lineTo(x+width-12,y+14);g.stroke();
      g.fillStyle='#edd88d';g.fillRect(x+width/2-8,y+height/2-3,16,6);
    }else{
      g.strokeStyle='#c9e0da22';g.lineWidth=2;
      if(width>height){for(let n=x+34;n<x+width-12;n+=40){g.beginPath();g.moveTo(n,y+12);g.lineTo(n,y+height-12);g.stroke();}}
      else{for(let n=y+36;n<y+height-12;n+=42){g.beginPath();g.moveTo(x+12,n);g.lineTo(x+width-12,n);g.stroke();}}
      g.fillStyle='#b8d6c9';for(const dx of [10,width-13])for(const dy of [11,height-14])g.fillRect(x+dx,y+dy,3,3);
    }
  }
  g.strokeStyle='#98baaa';g.lineWidth=4;g.strokeRect(2,2,w-4,h-4);
  g.strokeStyle='#132d37';g.lineWidth=6;g.strokeRect(8,8,w-16,h-16);
}

function drawCharacter(p,x,y){
  const blue=p.team==='blue',color=blue?'#53b8fb':'#fb8079',dark=blue?'#245b90':'#944340',light=blue?'#b3e9ff':'#ffd0bc';
  ctx.save();ctx.translate(x,y);
  ctx.fillStyle='#07121c66';ctx.beginPath();ctx.ellipse(0,8,23,16,0,0,Math.PI*2);ctx.fill();
  if(p.id===id||p.invulnerable>0){ctx.strokeStyle=p.id===id?'#dbff94':'#ffffffaa';ctx.lineWidth=2;ctx.setLineDash(p.invulnerable>0?[5,4]:[]);ctx.beginPath();ctx.arc(0,0,26,0,Math.PI*2);ctx.stroke();ctx.setLineDash([]);}
  ctx.rotate(p.angle||0);
  // A compact top-down pilot: backpack, shoulder armor, blaster and visor.
  ctx.fillStyle='#102a3b';ctx.strokeStyle='#0b202e';ctx.lineWidth=2;
  ctx.beginPath();ctx.roundRect(-21,-10,12,20,4);ctx.fill();ctx.stroke();
  for(const side of [-1,1]){ctx.fillStyle=dark;ctx.beginPath();ctx.ellipse(-1,side*13,12,7,0,0,Math.PI*2);ctx.fill();ctx.stroke();ctx.fillStyle=light;ctx.fillRect(-5,side*13-1,9,2);}
  ctx.fillStyle='#dce8ef';ctx.beginPath();ctx.roundRect(10,-5,24,10,3);ctx.fill();ctx.stroke();
  ctx.fillStyle='#486678';ctx.fillRect(27,-5,7,10);ctx.fillStyle=light;ctx.fillRect(17,-3,7,3);
  const helmet=ctx.createLinearGradient(-12,-14,14,14);helmet.addColorStop(0,light);helmet.addColorStop(.45,color);helmet.addColorStop(1,dark);
  ctx.fillStyle=helmet;ctx.beginPath();ctx.arc(-1,0,16,0,Math.PI*2);ctx.fill();ctx.stroke();
  ctx.strokeStyle='#ffffff88';ctx.lineWidth=2;ctx.beginPath();ctx.arc(-1,0,12,Math.PI*.95,Math.PI*1.55);ctx.stroke();
  ctx.fillStyle='#102b40';ctx.beginPath();ctx.roundRect(3,-9,10,18,4);ctx.fill();
  ctx.fillStyle='#b7f3ff';ctx.beginPath();ctx.roundRect(5,-6,4,12,2);ctx.fill();
  ctx.fillStyle=light;ctx.beginPath();ctx.arc(-8,0,2,0,Math.PI*2);ctx.fill();ctx.restore();
}

function drawBackdrop(){
  if(!arenaLayer)buildArenaLayer();
  const key=[canvas.width,canvas.height,view.scale,view.x,view.y].join(':');
  if(key!==backdropKey){
    if(!arenaBackdrop)arenaBackdrop=document.createElement('canvas');
    arenaBackdrop.width=canvas.width;arenaBackdrop.height=canvas.height;
    const g=arenaBackdrop.getContext('2d',{alpha:false});
    g.fillStyle='#152f36';g.fillRect(0,0,canvas.width,canvas.height);
    g.setTransform(view.scale,0,0,view.scale,view.x,view.y);
    g.drawImage(arenaLayer,0,0);backdropKey=key;
  }
  // Copy a pre-scaled background; avoid resizing the full map every frame.
  ctx.setTransform(1,0,0,1,0,0);ctx.drawImage(arenaBackdrop,0,0);
}

function draw(){
  requestAnimationFrame(draw);if(current?.phase!=='playing')return;
  const now=performance.now()-70;let a=frames[0],b=frames[frames.length-1];
  for(let i=1;i<frames.length;i++)if(frames[i].time>=now){a=frames[i-1];b=frames[i];break;}
  const t=a===b?1:Math.max(0,Math.min(1,(now-a.time)/(b.time-a.time)));
  drawBackdrop();
  ctx.setTransform(view.scale,0,0,view.scale,view.x,view.y);
  for(const bullet of b.s.bullets){
    ctx.strokeStyle=bullet.team==='blue'?'#9fe3ff88':'#ffb6a088';ctx.lineWidth=4;
    ctx.beginPath();ctx.moveTo(bullet.x-(bullet.vx||0)*.012,bullet.y-(bullet.vy||0)*.012);ctx.lineTo(bullet.x,bullet.y);ctx.stroke();
    ctx.fillStyle=bullet.team==='blue'?'#c2efff':'#ffcfb6';ctx.beginPath();ctx.arc(bullet.x,bullet.y,5,0,Math.PI*2);ctx.fill();
  }
  for(const p of b.s.players){
    if(p.hp<=0)continue;const old=a.s.players.find(q=>q.id===p.id)||p;
    const interpolate=old.hp>0&&Math.hypot(old.x-p.x,old.y-p.y)<120;
    const x=interpolate?old.x+(p.x-old.x)*t:p.x,y=interpolate?old.y+(p.y-old.y)*t:p.y;
    drawCharacter(p,x,y);ctx.fillStyle='#122332';ctx.fillRect(x-24,y-35,48,6);
    ctx.fillStyle=p.hp>25?'#b6f37d':'#ffd479';ctx.fillRect(x-24,y-35,48*p.hp/100,6);
    ctx.textAlign='center';ctx.font='bold 15px system-ui';ctx.fillStyle='white';ctx.fillText(p.name,x,y-43);
    ctx.font='12px system-ui';ctx.fillText('HP '+p.hp,x,y+36);
  }
}
document.body.classList.toggle('touch-mode',touchMode);if(!admin){const setControlLabel=()=>$('controlMode').textContent=touchMode?'Kontrol: HP':'Kontrol: PC';setControlLabel();$('controlMode').onclick=()=>{touchMode=!touchMode;document.body.classList.toggle('touch-mode',touchMode);resetControls();resizeCanvas();setControlLabel();};}connect();requestAnimationFrame(draw);


