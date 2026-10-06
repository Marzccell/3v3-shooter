'use strict';
const $=id=>document.getElementById(id),admin=document.body.dataset.admin==='true';let ws,id=null,current=null,frames=[],connected=false,keys={},mouse={x:1,y:0,fire:false},movement={x:0,y:0},aim={x:1,y:0,fire:false},dash=false,ready=false,audio=null,touchMode=matchMedia('(pointer:coarse), (any-pointer:coarse)').matches;
const canvas=$('game'),ctx=canvas.getContext('2d');$('code')&&($('code').value=new URLSearchParams(location.search).get('room')||'');
const send=m=>{if(ws?.readyState===1)ws.send(JSON.stringify(m));};function notice(s){$('notice').textContent=s;}
let view={scale:1,x:0,y:0};
const stickResets=[];function resetControls(){keys={};mouse.fire=false;movement={x:0,y:0};aim.fire=false;dash=false;for(const reset of stickResets)reset();}
function connect(){ws=new WebSocket(`${location.protocol==='https:'?'wss':'ws'}://${location.host}`);ws.onopen=()=>{connected=true;if(admin)send({type:'admin',token:location.hash.slice(1)});else notice('Terhubung. Masukkan nama dan gabung.');};ws.onclose=()=>{connected=false;resetControls();document.body.classList.remove('playing');$('arena').classList.add('hidden');notice('Koneksi terputus. Pastikan Wi-Fi tersambung, lalu muat ulang halaman untuk masuk kembali.');if(admin)$('connection').textContent='Koneksi terputus — muat ulang setelah server aktif.';};ws.onerror=()=>notice('Tidak dapat terhubung ke server. Periksa alamat dan Wi-Fi.');ws.onmessage=e=>{const m=JSON.parse(e.data);if(m.type==='ping'){send({type:'pong'});return;}if(m.type==='error'){notice(m.message);return;}if(m.type==='adminOK'){$('connection').textContent='Pengelola terhubung';notice('');return;}if(m.type==='joined'){id=m.id;$('joinPanel').classList.add('hidden');$('lobby').classList.remove('hidden');notice('');}if(m.type==='state'){if(!admin&&!id)return;const prev=current;current=m;frames.push({time:performance.now(),s:m});if(frames.length>8)frames.shift();const phaseChanged=prev?.phase!==m.phase;if(phaseChanged){resetControls();frames=[{time:performance.now(),s:m}];}updateUI();if(phaseChanged)resizeCanvas();}};}
function updateTeams(){const target=$('teams');target.replaceChildren();for(const team of ['blue','red']){const div=document.createElement('div');div.className='team '+team;const h=document.createElement('h3');h.textContent=`Tim ${team==='blue'?'Biru':'Merah'} (${current.players.filter(p=>p.team===team).length}/3)`;div.append(h);for(const p of current.players.filter(p=>p.team===team)){const row=document.createElement('div');row.className='player';const n=document.createElement('span');n.textContent=p.name+(p.id===id?' (kamu)':'');row.append(n);const mark=document.createElement('span');mark.className='readyMark';mark.textContent=p.ready?'✓ Siap':'Menunggu';row.append(mark);if(admin&&current.phase==='lobby'){const select=document.createElement('select');for(const t of ['blue','red']){const opt=new Option(t==='blue'?'Biru':'Merah',t);select.add(opt);}select.value=p.team;select.onchange=()=>send({type:'team',id:p.id,team:select.value});row.append(select);}div.append(row);}target.append(div);}}
let teamSignature='';function updateUI(){const playing=current.phase==='playing';document.body.classList.toggle('playing',playing);$('arena').classList.toggle('hidden',!playing);$('result').classList.toggle('hidden',current.phase!=='results');const signature=JSON.stringify([current.phase,current.players.map(p=>[p.id,p.name,p.team,p.ready])]);if(signature!==teamSignature){teamSignature=signature;updateTeams();}if(admin){$('create').disabled=current.phase!=='empty';$('roomInfo').classList.toggle('hidden',!current.code);if(current.code){$('roomCode').textContent=current.code;updateJoin();}$('start').disabled=current.phase!=='lobby'||current.players.length!==6||current.players.some(p=>!p.ready)||current.players.filter(p=>p.team==='blue').length!==3;$('reset').disabled=current.phase==='empty';}else{$('lobby').classList.toggle('hidden',current.phase!=='lobby');ready=current.players.find(p=>p.id===id)?.ready||false;$('ready').textContent=ready?'Siap ✓ (klik untuk batal)':'Saya siap!';}$('lobbyMsg').textContent=current.message||'Tunggu pengelola memulai pertandingan.';if(current.phase==='results'){$('winner').textContent=current.message;$('finalScore').textContent=`Biru ${current.score.blue} : ${current.score.red} Merah`;}if(playing){$('scoreB').textContent=current.score.blue;$('scoreR').textContent=current.score.red;const seconds=current.remaining;$('timer').textContent=`${Math.floor(seconds/60)}:${String(seconds%60).padStart(2,'0')}`;const me=current.players.find(p=>p.id===id);if(me){$('health').textContent=`HP ${me.hp}`;$('respawn').textContent=me.hp<=0?'HP habis — kembali dalam 3 detik…':'';$('dash').textContent=me.dashCooldown>.1?`${me.dashCooldown.toFixed(1)}s`:'DASH';}}}
function updateJoin(){if(!admin||!current?.code||!$('ip').value)return;const url=`http://${$('ip').value}:${location.port||3000}/?room=${current.code}`;$('joinLink').textContent=url;$('joinLink').href=url;const qrURL=`/qr?host=${encodeURIComponent($('ip').value)}&room=${current.code}`;if($('qr').getAttribute('src')!==qrURL)$('qr').src=qrURL;}
if(admin){fetch('/api/network').then(r=>r.json()).then(n=>{for(const ip of n.ips)$('ip').add(new Option(ip,ip));if(!n.ips.length){$('ip').add(new Option('localhost (jaringan belum terdeteksi)','localhost'));notice('Jaringan LAN belum terdeteksi. Sambungkan laptop ke Wi-Fi dan muat ulang.');}updateJoin();});$('ip').onchange=updateJoin;$('create').onclick=()=>send({type:'create'});$('start').onclick=()=>{notice('');send({type:'start'});};$('reset').onclick=()=>send({type:'reset'});}else{$('joinForm').onsubmit=e=>{e.preventDefault();if(!connected)return notice('Server belum tersambung');send({type:'join',code:$('code').value.trim(),name:$('nickname').value});};$('ready').onclick=()=>{send({type:'ready',ready:!ready});if(touchMode&&!ready)enterFullscreen();};$('sound').onclick=()=>{if(audio){audio.close();audio=null;$('sound').textContent='Suara: mati';}else{audio=new(window.AudioContext||window.webkitAudioContext)();$('sound').textContent='Suara: aktif';}};}
function blip(){if(!audio)return;const o=audio.createOscillator(),g=audio.createGain();o.type='triangle';o.frequency.setValueAtTime(420,audio.currentTime);o.frequency.exponentialRampToValueAtTime(140,audio.currentTime+.08);g.gain.setValueAtTime(.025,audio.currentTime);g.gain.exponentialRampToValueAtTime(.001,audio.currentTime+.08);o.connect(g);g.connect(audio.destination);o.start();o.stop(audio.currentTime+.09);}
window.addEventListener('keydown',e=>{if(current?.phase!=='playing'||admin)return;if(['Space','ArrowUp','ArrowDown','ArrowLeft','ArrowRight','KeyW','KeyA','KeyS','KeyD'].includes(e.code))e.preventDefault();keys[e.code]=true;if(e.code==='Space'&&!e.repeat)dash=true;});window.addEventListener('keyup',e=>keys[e.code]=false);window.addEventListener('blur',resetControls);document.addEventListener('visibilitychange',()=>{if(document.hidden)resetControls();});
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
  if(!touchMode||admin){canvas.width=1200;canvas.height=720;view={scale:1,x:0,y:0};return;}
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  const dpr=Math.min(window.devicePixelRatio||1,2),w=Math.round(r.width*dpr),h=Math.round(r.height*dpr);
  if(canvas.width!==w)canvas.width=w;if(canvas.height!==h)canvas.height=h;
  const scale=Math.min(w/1200,h/720);view={scale,x:(w-1200*scale)/2,y:(h-720*scale)/2};
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

let lastSound=0;setInterval(()=>{if(admin||current?.phase!=='playing'||!connected)return;const coarse=touchMode;const input={mx:coarse?movement.x:(keys.KeyD||keys.ArrowRight?1:0)-(keys.KeyA||keys.ArrowLeft?1:0),my:coarse?movement.y:(keys.KeyS||keys.ArrowDown?1:0)-(keys.KeyW||keys.ArrowUp?1:0),ax:coarse?aim.x:mouse.x,ay:coarse?aim.y:mouse.y,fire:coarse?aim.fire:mouse.fire,dash};send({type:'input',input});dash=false;if(input.fire&&performance.now()-lastSound>320){lastSound=performance.now();blip();}},1000/30);

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

function draw(){requestAnimationFrame(draw);if(current?.phase!=='playing')return;const now=performance.now()-70;let a=frames[0],b=frames[frames.length-1];for(let i=1;i<frames.length;i++)if(frames[i].time>=now){a=frames[i-1];b=frames[i];break;}const t=a===b?1:Math.max(0,Math.min(1,(now-a.time)/(b.time-a.time)));ctx.setTransform(1,0,0,1,0,0);ctx.fillStyle='#193d43';ctx.fillRect(0,0,canvas.width,canvas.height);ctx.setTransform(view.scale,0,0,view.scale,view.x,view.y);ctx.fillStyle='#285052';ctx.fillRect(0,0,1200,720);ctx.strokeStyle='#ffffff08';ctx.lineWidth=1;for(let x=0;x<1200;x+=40){ctx.beginPath();ctx.moveTo(x,0);ctx.lineTo(x,720);ctx.stroke();}for(let y=0;y<720;y+=40){ctx.beginPath();ctx.moveTo(0,y);ctx.lineTo(1200,y);ctx.stroke();}ctx.fillStyle='#3596ea18';ctx.fillRect(0,0,160,720);ctx.fillStyle='#ef6c6418';ctx.fillRect(1040,0,160,720);for(const w of current.walls){ctx.fillStyle='#122d39';ctx.fillRect(w.x+5,w.y+7,w.w,w.h);ctx.fillStyle='#607f87';ctx.fillRect(w.x,w.y,w.w,w.h);ctx.fillStyle='#8ba5a9';ctx.fillRect(w.x,w.y,w.w,7);}for(const bullet of b.s.bullets){ctx.fillStyle=bullet.team==='blue'?'#9fe3ff':'#ffb6a0';ctx.beginPath();ctx.arc(bullet.x,bullet.y,5,0,Math.PI*2);ctx.fill();}for(const p of b.s.players){if(p.hp<=0)continue;const old=a.s.players.find(q=>q.id===p.id)||p;const interpolate=old.hp>0&&Math.hypot(old.x-p.x,old.y-p.y)<120;const x=interpolate?old.x+(p.x-old.x)*t:p.x,y=interpolate?old.y+(p.y-old.y)*t:p.y;drawCharacter(p,x,y);ctx.fillStyle='#122332';ctx.fillRect(x-24,y-35,48,6);ctx.fillStyle=p.hp>25?'#b6f37d':'#ffd479';ctx.fillRect(x-24,y-35,48*p.hp/100,6);ctx.textAlign='center';ctx.font='bold 13px system-ui';ctx.fillStyle='white';ctx.fillText(p.name,x,y-43);ctx.font='11px system-ui';ctx.fillText(`HP ${p.hp}`,x,y+36);}ctx.strokeStyle='#90b0a3';ctx.lineWidth=4;ctx.strokeRect(2,2,1196,716);}
document.body.classList.toggle('touch-mode',touchMode);if(!admin){const setControlLabel=()=>$('controlMode').textContent=touchMode?'Kontrol: HP':'Kontrol: PC';setControlLabel();$('controlMode').onclick=()=>{touchMode=!touchMode;document.body.classList.toggle('touch-mode',touchMode);resetControls();resizeCanvas();setControlLabel();};}connect();requestAnimationFrame(draw);


