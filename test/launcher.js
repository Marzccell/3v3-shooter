'use strict';
const assert=require('node:assert/strict'),fs=require('node:fs'),path=require('node:path'),os=require('node:os'),vm=require('node:vm'),net=require('node:net');
const {spawn}=require('node:child_process');
const root=path.resolve(__dirname,'..'),children=[];
const runtime=process.platform==='win32'?path.join(root,'runtime/node.exe'):process.execPath;
function start(port){
  const child=spawn(runtime,[path.join(root,'peluncur.js')],{cwd:os.tmpdir(),env:{...process.env,PORT:String(port),OPEN_ADMIN:'0'},windowsHide:true,stdio:['pipe','pipe','pipe']});
  children.push(child);child.output='';child.stdout.on('data',data=>child.output+=data);child.stderr.on('data',data=>child.output+=data);
  child.finished=new Promise((resolve,reject)=>{child.once('error',reject);child.once('exit',code=>resolve(code));});
  return child;
}
async function until(check,label){for(let i=0;i<100;i++){if(check())return;await new Promise(resolve=>setTimeout(resolve,30));}throw Error('Timeout: '+label);}
async function exited(child,label){
  let timer;
  try{return await Promise.race([child.finished,new Promise((resolve,reject)=>{timer=setTimeout(()=>reject(Error('Timeout: '+label+'\n'+child.output)),8000);})]);}
  finally{clearTimeout(timer);}
}
async function run(){
  const port=await new Promise(resolve=>{const probe=net.createServer();probe.listen(0,'127.0.0.1',()=>{const port=probe.address().port;probe.close(()=>resolve(port));});});
  const child=start(port);await until(()=>child.output.includes('Pengelola: '),'portable launcher start');
  assert.match(child.output,new RegExp('http://localhost:'+port+'/admin#[a-f0-9]+'));
  const origin='http://127.0.0.1:'+port;
  for(const file of ['','admin','app.js','arena-map.js','audio.js','style.css']){
    const response=await fetch(origin+'/'+file);assert.equal(response.status,200,file+' is available through portable launch');
    const content=await response.text();assert.ok(content.length>100);
    if(file===''||file==='admin')for(const script of ['arena-map.js','audio.js','app.js'])assert.ok(content.includes('/'+script));
  }
  assert.equal((await fetch(origin+'/api/network').then(response=>response.json())).port,port);
  const duplicate=start(port);duplicate.stdin.end();assert.equal(await exited(duplicate,'busy port'),1,'a second launch exits cleanly on a busy port');
  assert.match(duplicate.output,/sedang digunakan/);assert.doesNotMatch(duplicate.output,/Unhandled|uncaught/i);
  assert.match(duplicate.output,/Server lain yang sedang berjalan tidak dihentikan/);
  assert.doesNotMatch(duplicate.output,/Semua pemain terputus/,'a failed launch must not claim it stopped the existing server');
  assert.equal((await fetch(origin+'/')).status,200,'the first server keeps working');
  child.stdin.end('Q\n');assert.equal(await exited(child,'Q/stop'),0,'Q cleanly stops the portable server');
  assert.match(child.output,/Server Arena Sahabat sudah berhenti/);
  await assert.rejects(fetch(origin+'/'),'the listening port is released');

  // A missing new asset produces the existing helpful launcher error.
  const errors=[],sandbox={__dirname:root,console:{error:message=>errors.push(message),log(){}},process:{chdir(){},exitCode:0},require(name){
    if(name==='node:fs')return {existsSync:file=>!file.endsWith(path.join('public','audio.js'))};
    if(name==='node:path')return path;if(name==='node:readline')return {};
    throw Error('An incomplete package must not start the server');
  }};
  vm.runInNewContext(fs.readFileSync(path.join(root,'peluncur.js'),'utf8'),sandbox);
  assert.equal(sandbox.process.exitCode,1);assert.ok(errors.join('\n').includes('public/audio.js'));
  const batch=fs.readFileSync(path.join(root,'MULAI GAME.bat'),'utf8');
  assert.ok(batch.includes('pushd "%~dp0"'));assert.ok(batch.includes('"runtime\\node.exe" "peluncur.js"'));
  console.log('LULUS: runtime portabel, peluncuran dari folder lain, semua aset/halaman baru, alamat pengelola, port bentrok, Q/stop, file hilang, dan jalur BAT.');
}
run().catch(error=>{console.error(error);process.exitCode=1;}).finally(()=>{for(const child of children)if(child.exitCode===null)child.kill();});
