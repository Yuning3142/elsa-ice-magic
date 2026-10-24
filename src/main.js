import './style.css';
import {HandLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
import {MagicEffects} from './effects.js';

const $=s=>document.querySelector(s),video=$('#camera'),status=$('#status'),start=$('#start'),spell=$('#spell');
const fx=new MagicEffects($('#canvas-root'));
let detector,stream,running=false,lastVideoTime=-1,lastDetect=0,handStates=new Map(),stormAt=0,pillarAt=0,clapAt=0,bothFistSince=0,frozen=false,pairHist=[],spellTimer;
// Served locally from node_modules (copied by the copy-wasm script) so the WASM always matches the installed JS version
const WASM=`${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
function errText(e){return e instanceof Error?e.message:e?.type==='error'&&e.target?.src?`无法加载 ${e.target.src}`:String(e)}
function notice(t){spell.textContent=t;spell.classList.add('show');clearTimeout(spellTimer);spellTimer=setTimeout(()=>spell.classList.remove('show'),900)}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function point(p){return {x:(1-p.x)*innerWidth,y:(1-p.y)*innerHeight}} // video is CSS-mirrored; Three coordinates use bottom-left origin
function classify(l){const wrist=l[0],tips=[8,12,16,20],pips=[6,10,14,18];const raised=tips.map((t,i)=>distance(l[t],wrist)>distance(l[pips[i]],wrist)*1.13);const count=raised.filter(Boolean).length;
  // OK sign: thumb tip touching index tip while middle, ring and pinky are all extended
  const pinch=distance(l[4],l[8])<distance(l[0],l[9])*.17&&raised[1]&&raised[2]&&raised[3];
  const peace=raised[0]&&raised[1]&&!raised[2]&&!raised[3];
  return {kind:count>=4?'open':count===0?'fist':raised[0]&&count===1?'point':peace?'peace':'other',count,pinch}}
function renderHands(result,now){
  const seen=new Set(),hands=[];
  for(let i=0;i<result.landmarks.length;i++){
    const l=result.landmarks[i],handLabel=result.handednesses?.[i]?.[0]?.categoryName??String(i),id=handLabel;seen.add(id);
    const center=point(l[9]),tip=point(l[8]),gesture=classify(l),prev=handStates.get(id),kind=gesture.kind;
    if(kind==='open')fx.snow(center.x,center.y,5);
    if(kind==='point')fx.trail(tip.x,tip.y);
    // Flick: pointing fingertip moving faster than ~1500px/s fires an ice shard in that direction
    let shardAt=prev?.shardAt??0;
    if(kind==='point'&&prev?.kind==='point'&&prev.tip&&now-shardAt>350){const dt=now-prev.lastSeen,vx=(tip.x-prev.tip.x)/dt,vy=(tip.y-prev.tip.y)/dt,sp=Math.hypot(vx,vy);if(dt>0&&sp>1.5){const a=Math.atan2(vy,vx),spread=fx.isArmored(id)?[-.18,0,.18]:[0];spread.forEach(o=>fx.shard(tip.x,tip.y,Math.cos(a+o)*1100,Math.sin(a+o)*1100));shardAt=now;notice('❄ ICE SHARD ❄')}}
    // Sigil: hold the OK sign for 0.4s; fires once per hold
    let sigilAt=prev?.sigilAt??0,pinchSince=gesture.pinch?prev?.pinchSince||now:0,sigilFired=gesture.pinch&&prev?.sigilFired;
    if(gesture.pinch&&!sigilFired&&now-pinchSince>400&&now-sigilAt>1500){sigilFired=true;const p=point({x:(l[4].x+l[8].x)/2,y:(l[4].y+l[8].y)/2});fx.sigil(p.x,p.y);sigilAt=now;notice('❄ SNOWFLAKE SIGIL ❄')}
    if(kind==='fist')fx.charge(center.x,center.y);
    let fistAt=kind==='fist'?now:prev?.fistAt??-Infinity;
    if(kind==='open'&&prev?.kind!=='open'&&now-fistAt<350){fx.burst(center.x,center.y);notice('❄ FROST BURST ❄');fistAt=-Infinity}
    // Ice armor: hold ✌ for 0.5s to toggle; the hand must leave ✌ before it can toggle again
    let peaceSince=kind==='peace'?prev?.peaceSince||now:0,armorToggled=kind==='peace'&&prev?.armorToggled;
    if(kind==='peace'&&!armorToggled&&now-peaceSince>500){if(fx.isArmored(id)){fx.armorOff(id);notice('❄ ARMOR SHATTERED ❄')}else{fx.armorOn(id);notice('❄ ICE GAUNTLET ❄')}armorToggled=true}
    if(fx.isArmored(id))fx.armorTrack(id,l.map(point));
    const hist=[...(prev?.hist??[]).filter(p=>now-p.t<450),{t:now,y:center.y}];
    hands.push({center,kind,prev,hist});handStates.set(id,{kind,lastSeen:now,y:center.y,fistAt,hist,tip,shardAt,sigilAt,pinchSince,sigilFired,peaceSince,armorToggled});
  }
  for(const [id,s] of handStates)if(!seen.has(id)&&now-s.lastSeen>500)handStates.delete(id);
  if(hands.length===2&&hands.every(h=>h.kind==='open')){
    const d=distance(hands[0].center,hands[1].center);
    if(d>innerWidth*.25&&now-stormAt>110){fx.storm(now-stormAt>600);if(now-stormAt>1500)notice('❄ BLIZZARD ❄');stormAt=now}
  }
  // Ice pillars: both hands (not fists) rose >12% of screen height within the last 450ms. Three's y axis points up.
  if(hands.length===2&&hands.every(h=>h.kind!=='fist')){
    const rise=hands.every(h=>h.center.y-Math.min(...h.hist.map(p=>p.y))>innerHeight*.12);
    if(rise&&now-pillarAt>1500){hands.forEach(h=>fx.pillar(h.center.x,h.center.y));pillarAt=now;notice('❄ ICE PILLARS ❄')}
  }
  // Clap: hands closed in fast. When they touch, the tracker often merges them into one hand,
  // so a pair that was approaching and then vanished within 250ms also counts.
  pairHist=pairHist.filter(p=>now-p.t<500);
  if(hands.length===2){const c0=hands[0].center,c1=hands[1].center;pairHist.push({t:now,d:distance(c0,c1),x:(c0.x+c1.x)/2,y:(c0.y+c1.y)/2})}
  const last=pairHist.at(-1),widest=Math.max(0,...pairHist.map(p=>p.d));
  if(last&&now-clapAt>900&&widest-last.d>innerWidth*.15&&(hands.length===2?last.d<innerWidth*.22:now-last.t<250&&last.d<innerWidth*.35)){fx.ring(last.x,last.y);clapAt=now;pairHist=[];notice('❄ FROST SHOCKWAVE ❄')}
  // Freeze: both fists held for 1s frosts the screen; opening any hand thaws it
  if(hands.length===2&&hands.every(h=>h.kind==='fist')){bothFistSince||=now;if(!frozen&&now-bothFistSince>1000){frozen=true;notice('❄ ETERNAL WINTER ❄')}}
  else{bothFistSince=0;if(frozen&&hands.some(h=>h.kind==='open')){frozen=false;notice('☀ THAW ☀')}}
  fx.setFrost(frozen?1:now-stormAt<400?.45:0); // blizzard also frosts the screen edges a little
  status.textContent=`正在施法 · 检测到 ${hands.length} 只手`;
}
function frame(now){if(!running)return;if(video.readyState>=2&&video.currentTime!==lastVideoTime&&now-lastDetect>32){lastVideoTime=video.currentTime;lastDetect=now;try{renderHands(detector.detectForVideo(video,now),now)}catch(e){console.error(e);status.textContent=`手势识别错误：${errText(e)}`}}requestAnimationFrame(frame)}
start.addEventListener('click',async()=>{
  if(running)return;start.disabled=true;status.textContent='正在申请摄像头权限…';
  try{
    stream=await navigator.mediaDevices.getUserMedia({audio:false,video:{facingMode:'user',width:{ideal:1280},height:{ideal:720}}});video.srcObject=stream;await video.play();status.textContent='正在加载手势识别模型（首次需要联网）…';
    const vision=await FilesetResolver.forVisionTasks(WASM);
    // CPU delegate avoids competing with Three.js for the GPU, which can drop the WebGL context on Mac Chrome
    const opts=delegate=>({baseOptions:{modelAssetPath:MODEL,delegate},runningMode:'VIDEO',numHands:2,minHandDetectionConfidence:.55,minTrackingConfidence:.5});
    try{detector=await HandLandmarker.createFromOptions(vision,opts('CPU'))}
    catch{detector=await HandLandmarker.createFromOptions(vision,opts('GPU'))}
    running=true;start.textContent='魔法已开启';notice('LET IT SNOW');requestAnimationFrame(frame);
  }catch(e){console.error(e);status.textContent=`启动失败：${errText(e)}`;start.disabled=false;stream?.getTracks().forEach(t=>t.stop())}
});
window.addEventListener('error',e=>{status.textContent=`出错：${e.message}`});
window.addEventListener('unhandledrejection',e=>{status.textContent=`出错：${errText(e.reason)}`});
fx.renderer.domElement.addEventListener('webglcontextlost',()=>{status.textContent='图形上下文丢失，正在恢复…'});
fx.renderer.domElement.addEventListener('webglcontextrestored',()=>{status.textContent='图形已恢复'});
$('#intensity').addEventListener('input',e=>fx.intensity=Number(e.target.value));
$('#fullscreen').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h')document.body.classList.toggle('hide-ui');if(e.key.toLowerCase()==='f'&&!e.repeat)document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()});
// Short synthesized chime, no copyrighted audio or audio file required.
let audio,enabled=false;const sound=$('#sound');sound.disabled=false;
sound.addEventListener('click',()=>{enabled=!enabled;sound.textContent=`音效：${enabled?'开':'关'}`;if(enabled)audio??=new (window.AudioContext||window.webkitAudioContext)()});
const originalBurst=fx.burst.bind(fx);fx.burst=(x,y)=>{originalBurst(x,y);if(!enabled)return;audio.resume();[523,784,1046].forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.07;osc.type='sine';osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.075,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.5);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+.51)})};
