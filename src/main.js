import './style.css';
import {HandLandmarker,FilesetResolver} from '@mediapipe/tasks-vision';
import {MagicEffects} from './effects.js';

const $=s=>document.querySelector(s),video=$('#camera'),status=$('#status'),start=$('#start'),spell=$('#spell');
const fx=new MagicEffects($('#canvas-root'));
let detector,stream,running=false,lastVideoTime=-1,lastDetect=0,handStates=new Map(),stormAt=0,pillarAt=0,clapAt=0,bothFistSince=0,frozen=false,pairHist=[],spellTimer;
// Served locally from node_modules (copied by the copy-wasm script) so the WASM always matches the installed JS version
const WASM=`${import.meta.env.BASE_URL}mediapipe-wasm`;
const MODEL='https://storage.googleapis.com/mediapipe-models/hand_landmarker/hand_landmarker/float16/1/hand_landmarker.task';
const CAMERA_ERRORS={NotAllowedError:'没有摄像头权限，请在浏览器和系统设置中允许',NotReadableError:'摄像头被其他程序占用（如 Teams、Zoom、相机），请关闭后重试',NotFoundError:'没有找到摄像头',OverconstrainedError:'摄像头不支持所需的分辨率'};
function errText(e){return CAMERA_ERRORS[e?.name]??(e instanceof Error?e.message:e?.type==='error'&&e.target?.src?`无法加载 ${e.target.src}`:String(e))}
function notice(t){spell.textContent=t;spell.classList.add('show');clearTimeout(spellTimer);spellTimer=setTimeout(()=>spell.classList.remove('show'),900)}
function distance(a,b){return Math.hypot(a.x-b.x,a.y-b.y)}
function point(p){return {x:(1-p.x)*innerWidth,y:(1-p.y)*innerHeight}} // video is CSS-mirrored; Three coordinates use bottom-left origin
function classify(l){const wrist=l[0],tips=[8,12,16,20],pips=[6,10,14,18];const raised=tips.map((t,i)=>distance(l[t],wrist)>distance(l[pips[i]],wrist)*1.13);const count=raised.filter(Boolean).length;
  // OK sign: thumb tip touching index tip while middle, ring and pinky are all extended
  const pinch=distance(l[4],l[8])<distance(l[0],l[9])*.17&&raised[1]&&raised[2]&&raised[3];
  const peace=raised[0]&&raised[1]&&!raised[2]&&!raised[3];
  return {kind:count>=4?'open':count===0?'fist':raised[0]&&count===1?'point':peace?'peace':'other',count,pinch}}
// Sensitivity slider: <1 makes spells harder to trigger (longer holds, bigger motions), >1 easier
let S=1;try{S=Number(localStorage.getItem('sensitivity'))||1}catch{}
const hold=ms=>ms/S,move=frac=>frac/S;
// Big spells share a short lockout so one motion can't fire several of them at once
let lockUntil=0;
function cast(now,name,fn){if(now<lockUntil)return false;fn();lockUntil=now+hold(700);notice(name);return true}
const STABLE_FRAMES=3; // a gesture must be seen this many detection frames in a row (~0.1s) before it counts
function renderHands(result,now){
  const seen=new Set(),hands=[];
  for(let i=0;i<result.landmarks.length;i++){
    const l=result.landmarks[i],id=result.handednesses?.[i]?.[0]?.categoryName??String(i);seen.add(id);
    const center=point(l[9]),tip=point(l[8]),gesture=classify(l),prev=handStates.get(id);
    // Debounce: switch the stable gesture only after the raw gesture repeats STABLE_FRAMES times
    const rawCount=gesture.kind===prev?.raw?prev.rawCount+1:1,kind=rawCount>=STABLE_FRAMES||!prev?gesture.kind:prev.kind;
    const kindSince=kind===prev?.kind?prev.kindSince:now,held=now-kindSince;
    const st={...prev,raw:gesture.kind,rawCount,kind,kindSince,lastSeen:now,y:center.y,tip};
    if(kind==='open')fx.snow(center.x,center.y,5);
    if(kind==='point')fx.trail(tip.x,tip.y);

    st.tipHist=[...(prev?.tipHist??[]).filter(p=>now-p.t<150),{t:now,x:tip.x,y:tip.y}];
    // Flick: a steady point, then the fingertip moves fast AND far within 150ms
    if(kind==='point'&&held>150){const o=st.tipHist[0],dx=tip.x-o.x,dy=tip.y-o.y,dist=Math.hypot(dx,dy),dt=now-o.t;
      if(dt>40&&dist>innerWidth*move(.12)&&dist/dt>2.2/S&&now-(prev?.shardAt??0)>hold(500))cast(now,'❄ ICE SHARD ❄',()=>{const a=Math.atan2(dy,dx);(fx.isArmored(id)?[-.18,0,.18]:[0]).forEach(o=>fx.shard(tip.x,tip.y,Math.cos(a+o)*1100,Math.sin(a+o)*1100));st.shardAt=now;st.tipHist=[]})}
    // Sigil: hold a clean OK sign; fires once per hold
    st.pinchSince=gesture.pinch?prev?.pinchSince||now:0;st.sigilFired=gesture.pinch&&prev?.sigilFired;
    if(gesture.pinch&&!st.sigilFired&&now-st.pinchSince>hold(600))st.sigilFired=cast(now,'❄ SNOWFLAKE SIGIL ❄',()=>{const p=point({x:(l[4].x+l[8].x)/2,y:(l[4].y+l[8].y)/2});fx.sigil(p.x,p.y)});
    // Burst: charge a fairly steady fist for 0.45s (charge glow brightens when ready), then open it within 0.5s.
    // A fist moving across the screen doesn't charge, since moving/turning hands are often misread as fists.
    // The open is checked on the raw gesture (2 frames in a row) so the debounce doesn't eat the time window.
    if(kind==='fist'){
      if(prev?.kind!=='fist'||distance(center,st.fistAnchor??center)>innerWidth*.12){st.fistAnchor=center;st.fistChargeFrom=now}
      const ready=now-st.fistChargeFrom>hold(450);fx.charge(center.x,center.y);if(ready){fx.charge(center.x,center.y);fx.charge(center.x,center.y);st.fistReadyAt=now}
    }
    if(gesture.kind==='open'&&rawCount>=2&&now-(st.fistReadyAt??-1e9)<500&&cast(now,'❄ FROST BURST ❄',()=>fx.burst(center.x,center.y)))st.fistReadyAt=-1e9;
    // Ice armor: hold ✌ to toggle; the hand must leave ✌ before it can toggle again
    st.armorToggled=kind==='peace'&&prev?.armorToggled;
    if(kind==='peace'&&!st.armorToggled&&held>hold(800))st.armorToggled=fx.isArmored(id)?cast(now,'❄ ARMOR SHATTERED ❄',()=>fx.armorOff(id)):cast(now,'❄ ICE GAUNTLET ❄',()=>fx.armorOn(id));
    if(fx.isArmored(id))fx.armorTrack(id,l.map(point));
    st.hist=[...(prev?.hist??[]).filter(p=>now-p.t<450),{t:now,y:center.y}];
    hands.push({center,kind,held,hist:st.hist});handStates.set(id,st);
  }
  for(const [id,s] of handStates)if(!seen.has(id)&&now-s.lastSeen>500)handStates.delete(id);
  const two=hands.length===2,both=k=>two&&hands.every(h=>h.kind===k);
  // Blizzard: both hands open and well apart for a moment; keeps snowing while held
  if(both('open')){
    const d=distance(hands[0].center,hands[1].center);
    if(d>innerWidth*Math.min(move(.35),.8)&&hands.every(h=>h.held>hold(300))&&now-stormAt>110){fx.storm(now-stormAt>600);if(now-stormAt>1500)notice('❄ BLIZZARD ❄');stormAt=now}
  }
  // Ice spires: both open hands rose a lot within 450ms, by similar amounts (a deliberate lift, not drift). Three's y axis points up.
  if(both('open')&&now-pillarAt>hold(1500)){
    const rises=hands.map(h=>h.center.y-Math.min(...h.hist.map(p=>p.y))),need=innerHeight*move(.18);
    if(rises.every(r=>r>need)&&Math.max(...rises)<Math.min(...rises)*2&&cast(now,'❄ ICE PILLARS ❄',()=>hands.forEach(h=>fx.pillar(h.center.x,h.center.y))))pillarAt=now;
  }
  // Clap: hands that were far apart closed in fast. When they touch, the tracker often merges them
  // into one hand, so a pair that was approaching and then vanished within 200ms also counts.
  pairHist=pairHist.filter(p=>now-p.t<500);
  if(two){const c0=hands[0].center,c1=hands[1].center;pairHist.push({t:now,d:distance(c0,c1),x:(c0.x+c1.x)/2,y:(c0.y+c1.y)/2})}
  const last=pairHist.at(-1),widest=Math.max(0,...pairHist.map(p=>p.d));
  if(last&&now-clapAt>hold(1000)&&widest-last.d>innerWidth*move(.25)&&(two?last.d<innerWidth*.18:now-last.t<200&&last.d<innerWidth*.28)&&cast(now,'❄ FROST SHOCKWAVE ❄',()=>fx.ring(last.x,last.y))){clapAt=now;pairHist=[]}
  // Freeze: both fists held frosts the screen; opening any hand thaws it
  if(both('fist')){bothFistSince||=now;if(!frozen&&now-bothFistSince>hold(1200)){frozen=true;notice('❄ ETERNAL WINTER ❄')}}
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
    // CPU delegate avoids competing with Three.js for the GPU, which can drop the WebGL context
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
const sens=$('#sensitivity');sens.value=S;sens.addEventListener('input',e=>{S=Number(e.target.value);try{localStorage.setItem('sensitivity',S)}catch{}});
$('#intensity').addEventListener('input',e=>fx.intensity=Number(e.target.value));
$('#fullscreen').addEventListener('click',()=>document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen());
window.addEventListener('keydown',e=>{if(e.key.toLowerCase()==='h')document.body.classList.toggle('hide-ui');if(e.key.toLowerCase()==='f'&&!e.repeat)document.fullscreenElement?document.exitFullscreen():document.documentElement.requestFullscreen()});
// Short synthesized chime, no copyrighted audio or audio file required.
let audio,enabled=false;const sound=$('#sound');sound.disabled=false;
sound.addEventListener('click',()=>{enabled=!enabled;sound.textContent=`音效：${enabled?'开':'关'}`;if(enabled)audio??=new (window.AudioContext||window.webkitAudioContext)()});
const originalBurst=fx.burst.bind(fx);fx.burst=(x,y)=>{originalBurst(x,y);if(!enabled)return;audio.resume();[523,784,1046].forEach((freq,i)=>{const osc=audio.createOscillator(),gain=audio.createGain(),t=audio.currentTime+i*.07;osc.type='sine';osc.frequency.setValueAtTime(freq,t);gain.gain.setValueAtTime(.0001,t);gain.gain.exponentialRampToValueAtTime(.075,t+.02);gain.gain.exponentialRampToValueAtTime(.0001,t+.5);osc.connect(gain).connect(audio.destination);osc.start(t);osc.stop(t+.51)})};
