import * as THREE from 'three';

function texture(kind){
  const c=document.createElement('canvas');c.width=c.height=128;const x=c.getContext('2d');
  x.translate(64,64);
  if(kind==='star'){
    x.shadowColor='#9ceaff';x.shadowBlur=15;x.strokeStyle='#e3fbff';x.lineWidth=3;
    for(let a=0;a<6;a++){x.save();x.rotate(a*Math.PI/3);x.beginPath();x.moveTo(0,0);x.lineTo(0,-48);x.stroke();for(const y of [-19,-31]){x.beginPath();x.moveTo(0,y);x.lineTo(-8,y+8);x.moveTo(0,y);x.lineTo(8,y+8);x.stroke()}x.restore()}
    x.beginPath();x.arc(0,0,5,0,Math.PI*2);x.fillStyle='white';x.fill();
  }else{
    const g=x.createRadialGradient(0,0,0,0,0,64);g.addColorStop(0,'rgba(255,255,255,1)');g.addColorStop(.14,'rgba(195,244,255,.95)');g.addColorStop(.38,'rgba(65,175,255,.48)');g.addColorStop(1,'rgba(10,110,255,0)');x.fillStyle=g;x.fillRect(-64,-64,128,128);
  }
  const t=new THREE.CanvasTexture(c);t.colorSpace=THREE.SRGBColorSpace;return t;
}
const rnd=(a,b)=>a+Math.random()*(b-a);
// Hand skeleton (MediaPipe landmark indices) and each joint's distance from the wrist, for the armor freeze wave
const ARMOR_BONES=[[0,1],[1,2],[2,3],[3,4],[0,5],[5,6],[6,7],[7,8],[5,9],[9,10],[10,11],[11,12],[9,13],[13,14],[14,15],[15,16],[13,17],[0,17],[17,18],[18,19],[19,20]];
const ARMOR_DEPTH=[0,1,2,3,4,1,2,3,4,1,2,3,4,1,2,3,4,1,2,3,4],TIPS=[4,8,12,16,20];
export class MagicEffects{
  constructor(root){
    this.root=root;this.scene=new THREE.Scene();this.camera=new THREE.OrthographicCamera(0,innerWidth,innerHeight,0,-1000,1000);this.renderer=new THREE.WebGLRenderer({alpha:true,antialias:true,powerPreference:'high-performance'});this.renderer.setPixelRatio(Math.min(devicePixelRatio,2));this.renderer.setSize(innerWidth,innerHeight);root.appendChild(this.renderer.domElement);this.renderer.domElement.addEventListener('webglcontextlost',e=>e.preventDefault());
    this.dot=texture('dot');this.star=texture('star');this.particles=[];this.spires=[];this.anims=[];this.armors=new Map();
    this.iceMat=new THREE.MeshPhongMaterial({color:0x8fdcff,emissive:0x0b4f86,specular:0xffffff,shininess:140,flatShading:true,transparent:true,opacity:.82,depthWrite:false});this.edgeMat=new THREE.LineBasicMaterial({color:0xeafcff,transparent:true,blending:THREE.AdditiveBlending});
    this.scene.add(new THREE.AmbientLight(0x9fdfff,.9));const sun=new THREE.DirectionalLight(0xffffff,2.2);sun.position.set(-.6,.8,1);this.scene.add(sun);this.intensity=1;this.last=performance.now();this.time=0;
    this.frost=document.createElement('canvas');Object.assign(this.frost.style,{position:'absolute',inset:0,width:'100%',height:'100%',opacity:0,transition:'opacity 1.4s ease',pointerEvents:'none'});root.appendChild(this.frost);this.drawFrost();
    window.addEventListener('resize',()=>this.resize());this.loop=this.loop.bind(this);requestAnimationFrame(this.loop);
  }
  resize(){this.camera.right=innerWidth;this.camera.top=innerHeight;this.camera.updateProjectionMatrix();this.renderer.setSize(innerWidth,innerHeight);this.drawFrost()}
  spawn(x,y,opts={}){
    if(this.particles.length>1800)return;
    const star=opts.star??Math.random()<.22;const mat=new THREE.SpriteMaterial({map:star?this.star:this.dot,color:opts.color??(Math.random()<.5?0xa4ecff:0xffffff),transparent:true,depthWrite:false,blending:THREE.AdditiveBlending,opacity:opts.opacity??.9});
    const s=new THREE.Sprite(mat);s.position.set(x,y,rnd(-5,5));const size=opts.size??rnd(12,30);s.scale.set(size,size,1);this.scene.add(s);
    this.particles.push({s,vx:opts.vx??rnd(-80,80),vy:opts.vy??rnd(-100,40),life:opts.life??rnd(.5,1.25),max:opts.life??1.25,gravity:opts.gravity??20,spin:rnd(-2,2),size});
  }
  // p = power: 1 normal, 2 when cast with the frost glove on (bigger, brighter, more star crystals)
  snow(x,y,amount=6,p=1){if(p>1){for(let i=0;i<Math.round(amount*2*this.intensity);i++){const a=rnd(0,Math.PI*2),r=rnd(40,95);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:-Math.sin(a)*170+rnd(-20,20),vy:Math.cos(a)*170+rnd(-20,20),size:rnd(14,40),life:rnd(.8,1.6),gravity:0,star:Math.random()<.55,color:0xffffff})}return}
    for(let i=0;i<Math.round(amount*this.intensity);i++)this.spawn(x+rnd(-35,35),y+rnd(-35,35),{vx:rnd(-95,95),vy:rnd(-110,30),size:rnd(10,33),life:rnd(.7,1.7),gravity:20})}
  trail(x,y,p=1){for(let i=0;i<Math.round(6*p*this.intensity);i++)this.spawn(x+rnd(-9,9)*p,y+rnd(-9,9)*p,{vx:rnd(-35,35),vy:rnd(-45,45),size:rnd(8,24)*(p>1?1.4:1),life:rnd(.2,.7)*p,gravity:0,star:p>1&&Math.random()<.5})}
  charge(x,y,p=1){for(let i=0;i<Math.round(8*p*this.intensity);i++){const a=rnd(0,Math.PI*2),r=rnd(30,95)*(p>1?1.5:1);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:-Math.cos(a)*r*1.6,vy:-Math.sin(a)*r*1.6,size:rnd(12,29),life:rnd(.25,.7),gravity:0,color:0x72caff})}}
  burst(x,y,p=1){for(let i=0;i<Math.round(135*(p>1?1.8:1)*this.intensity);i++){const a=rnd(0,Math.PI*2),v=rnd(80,600)*(p>1?1.5:1);this.spawn(x,y,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.65,1.65),size:rnd(10,44),gravity:25,star:i%(p>1?2:3)===0})}
    if(p>1){this.ring(x,y,1,.45);for(let k=0;k<8;k++){const a=k*Math.PI/4;this.shard(x,y,Math.cos(a)*950,Math.sin(a)*950)}}}
  // Heavy snowfall from the top edge, slanted by wind; fill=true seeds the whole screen so it doesn't start empty
  storm(fill=false,p=1){const n=Math.round((fill?160:34)*(p>1?1.7:1)*this.intensity),wind=rnd(60,140);for(let i=0;i<n;i++){const near=Math.random(),sz=8+near*40,speed=180+near*320,y0=fill?rnd(0,innerHeight):innerHeight+rnd(10,60);this.spawn(rnd(-innerWidth*.15,innerWidth),y0,{vx:wind*(.6+near)+rnd(-30,30),vy:-speed,life:(y0+40)/speed+rnd(0,.3),size:sz,gravity:-30,star:near>.55&&Math.random()<(p>1?.8:.5),opacity:.5+near*.45})}}
  // Solid ice spires that burst out of the ground (bottom edge) up to the hand, hold, then shatter into frost
  pillar(x,y,p=1){
    const top=Math.max(y,innerHeight*.25),g=new THREE.Group(),shards=[];g.position.set(x,0,0);
    const add=(h,r,dx,tilt,delay)=>{
      const geo=new THREE.ConeGeometry(r,h,6,1);geo.translate(0,h/2,0);
      const mat=this.iceMat.clone(),edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo),this.edgeMat.clone());
      const m=new THREE.Mesh(geo,mat);m.add(edge);m.position.x=dx;m.rotation.set(rnd(-.25,.25),rnd(0,Math.PI),tilt);m.scale.y=.001;g.add(m);shards.push({m,delay});
    };
    const w=Math.min(Math.max(top*.11,38),80)*(p>1?1.35:1);
    add(top,w,0,rnd(-.04,.04),0);
    for(let k=0;k<(p>1?9:5);k++){const side=k%2?1:-1,f=rnd(.3,.75);add(top*f,w*rnd(.45,.7),side*rnd(w*.5,w*(p>1?2:1.4)),-side*rnd(.15,.55),.06+k*.035)}
    this.scene.add(g);this.spires.push({g,shards,top,x,age:0,hold:2.6});
    for(let k=0;k<Math.round(30*this.intensity);k++)this.spawn(x+rnd(-w*1.8,w*1.8),rnd(0,20),{vx:rnd(-260,260),vy:rnd(40,260),life:rnd(.4,.9),size:rnd(10,26),gravity:-420,color:0xd8f8ff});
  }
  // Generic timed animation: step(t in 0..1, dt) every frame, end() once when done
  animate(life,step,end){this.anims.push({age:0,life,step,end})}
  disposeObj(o){this.scene.remove(o);o.traverse(c=>{c.geometry?.dispose();c.material?.dispose()})}
  // Rotating six-armed snowflake sigil that unfolds at (x,y), then dissolves into crystals
  sigil(x,y,p=1){
    const R=Math.min(innerWidth,innerHeight)*.38*(p>1?1.3:1),segs=[];const seg=(a,b)=>segs.push([a,b]),P=(r,a)=>new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r);
    for(let k=0;k<6;k++){const a=k*Math.PI/3;seg(P(R*.16,a),P(R,a));for(const f of [.36,.58,.8]){const b=P(R*f,a),len=R*(1.05-f)*.6;seg(b,b.clone().add(P(len,a+.6)));seg(b,b.clone().add(P(len,a-.6)))}seg(P(R*.5,a),P(R*.5,a+Math.PI/3));seg(P(R*.16,a),P(R*.16,a+Math.PI/3))}
    for(let ring of [1.08,1.16])for(let k=0;k<72;k++)seg(P(R*ring,k*Math.PI/36),P(R*ring,(k+1)*Math.PI/36));
    for(let k=0;k<12;k++){const a=k*Math.PI/6+Math.PI/12;seg(P(R*1.08,a),P(R*1.16,a))} // rune ticks between the two outer rings
    // WebGL lines are 1px, so build each segment as a quad of the given pixel width
    const thick=w=>{const v=[];for(const [a,b] of segs){const d=b.clone().sub(a).normalize(),n=new THREE.Vector2(-d.y,d.x).multiplyScalar(w/2);const A1=a.clone().add(n),A2=a.clone().sub(n),B1=b.clone().add(n),B2=b.clone().sub(n);v.push(A1.x,A1.y,0,A2.x,A2.y,0,B1.x,B1.y,0,B1.x,B1.y,0,A2.x,A2.y,0,B2.x,B2.y,0)}const geo=new THREE.BufferGeometry();geo.setAttribute('position',new THREE.Float32BufferAttribute(v,3));return geo};
    const mat=(c,o)=>new THREE.MeshBasicMaterial({color:c,transparent:true,opacity:o,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide});
    const g=new THREE.Group(),glow=new THREE.Mesh(thick(16),mat(0x3aa8ff,.35)),core=new THREE.Mesh(thick(4.5),mat(0xeafcff,1));
    const halo=new THREE.Sprite(new THREE.SpriteMaterial({map:this.dot,color:0x7fd8ff,transparent:true,opacity:.5,blending:THREE.AdditiveBlending,depthWrite:false}));halo.scale.set(R*2.6,R*2.6,1);
    g.add(halo,glow,core);g.position.set(x,y,1);this.scene.add(g);
    this.animate(2.3,t=>{const grow=1-(1-Math.min(t/.28,1))**3,fade=t<.78?1:1-(t-.78)/.22;g.scale.setScalar(grow);glow.rotation.z=core.rotation.z=t*1.8;glow.material.opacity=.35*fade*(.8+.2*Math.sin(t*40));core.material.opacity=fade;halo.material.opacity=.5*fade;for(let k=0;k<2;k++){const a=rnd(0,Math.PI*2),r=R*grow*rnd(.2,1.16);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:0,vy:rnd(-10,10),size:rnd(12,28),life:rnd(.3,.7),gravity:0,star:true})}},
      ()=>{this.disposeObj(g);for(let k=0;k<Math.round(110*this.intensity);k++){const a=rnd(0,Math.PI*2),v=rnd(60,320);this.spawn(x+Math.cos(a)*R*.7,y+Math.sin(a)*R*.7,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.5,1.2),size:rnd(12,32),gravity:20,star:k%2===0})}
        if(p>1){this.ring(x,y,1,.7);for(let k=0;k<6;k++){const a=k*Math.PI/3+Math.PI/6;this.shard(x,y,Math.cos(a)*1000,Math.sin(a)*1000,2)}}});
  }
  // Ice shard projectile flying with velocity (vx,vy) px/s, leaving a frost trail
  shard(x,y,vx,vy,p=1){
    const geo=new THREE.ConeGeometry(11*(p>1?1.5:1),80*(p>1?1.5:1),6);geo.rotateZ(-Math.PI/2); // tip points along +x
    const m=new THREE.Mesh(geo,this.iceMat.clone());m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),this.edgeMat.clone()));m.position.set(x,y,2);m.rotation.z=Math.atan2(vy,vx);this.scene.add(m);
    const hit=()=>{for(let k=0;k<Math.round(35*(p>1?2.5:1)*this.intensity);k++){const a=rnd(0,Math.PI*2),v=rnd(60,300);this.spawn(m.position.x,m.position.y,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.4,.9),size:rnd(10,26),gravity:30,star:k%3===0})}this.disposeObj(m)};
    const a={age:0,life:1.4,step:(t,dt)=>{m.position.x+=vx*dt;m.position.y+=vy*dt;m.rotation.x+=dt*9;for(let k=0;k<3;k++)this.spawn(m.position.x-vx*.03+rnd(-6,6),m.position.y-vy*.03+rnd(-6,6),{vx:rnd(-30,30),vy:rnd(-30,30),size:rnd(8,20),life:rnd(.2,.5),gravity:0});const p=m.position;if(p.x<-40||p.x>innerWidth+40||p.y<-40||p.y>innerHeight+40)a.age=a.life},end:hit};
    this.anims.push(a);
  }
  // Expanding shockwave ring of ice
  ring(x,y,p=1,scale=1){
    if(p>1&&scale===1)this.animate(.18,()=>{},()=>this.ring(x,y,1,.75)); // upgraded: a second, trailing ring
    const mat=new THREE.MeshBasicMaterial({color:0xaeeeff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),m=new THREE.Mesh(new THREE.RingGeometry(0,1,96),mat);m.position.set(x,y,3);this.scene.add(m);
    const maxR=Math.hypot(innerWidth,innerHeight)*.55*scale*(p>1?1.25:1),band=p>1?22:10;let lastR=0;
    this.animate(.8,t=>{const r=Math.max(12,maxR*(1-(1-t)**2.4));m.geometry.dispose();m.geometry=new THREE.RingGeometry(Math.max(0,r-band*(1-t)-2),r,96);mat.opacity=1-t;if(r-lastR>14){const n=Math.round(14*this.intensity);for(let k=0;k<n;k++){const a=rnd(0,Math.PI*2);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:Math.cos(a)*60,vy:Math.sin(a)*60,size:rnd(10,26),life:rnd(.3,.7),gravity:0,star:Math.random()<.4})}lastR=r}},()=>this.disposeObj(m));
  }
  // Frost creeping in from the screen edges; setFrost(0..1) fades it in/out
  setFrost(v){this.frost.style.opacity=String(v)}
  drawFrost(){
    const c=this.frost,w=c.width=innerWidth,h=c.height=innerHeight,x=c.getContext('2d');
    const g=x.createRadialGradient(w/2,h/2,Math.min(w,h)*.28,w/2,h/2,Math.hypot(w,h)*.55);g.addColorStop(0,'rgba(200,240,255,0)');g.addColorStop(.6,'rgba(190,235,255,.28)');g.addColorStop(1,'rgba(225,248,255,.82)');x.fillStyle=g;x.fillRect(0,0,w,h);
    x.lineCap='round';x.shadowColor='#bff3ff';x.shadowBlur=4;
    const branch=(px,py,a,len,depth)=>{if(depth>4||len<3)return;const nx=px+Math.cos(a)*len,ny=py+Math.sin(a)*len;x.strokeStyle=`rgba(235,252,255,${.55-depth*.07})`;x.lineWidth=Math.max(.5,2-depth*.35);x.beginPath();x.moveTo(px,py);x.lineTo(nx,ny);x.stroke();branch(nx,ny,a+rnd(-.25,.25),len*.78,depth+.4);if(Math.random()<.75)branch(nx,ny,a+rnd(.5,1.1),len*.5,depth+1);if(Math.random()<.75)branch(nx,ny,a-rnd(.5,1.1),len*.5,depth+1)};
    const n=Math.round((w+h)/9);for(let k=0;k<n;k++){const side=k%4,u=Math.random();const [px,py,a]=side===0?[u*w,0,Math.PI/2]:side===1?[u*w,h,-Math.PI/2]:side===2?[0,u*h,0]:[w,u*h,Math.PI];branch(px,py,a+rnd(-.6,.6),rnd(8,22)*(Math.random()<.15?2:1),0)}
  }
  // Ice-blue satin opera glove: one seamless silhouette drawn on a 2D canvas under the particles.
  // pts = 21 landmarks in Three coords (y up), fed via armorTrack().
  armorOn(id){
    if(this.armors.has(id))return;
    if(!this.gloveCanvas){this.gloveCanvas=document.createElement('canvas');Object.assign(this.gloveCanvas.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'});this.root.insertBefore(this.gloveCanvas,this.renderer.domElement);this.gloveBuf=document.createElement('canvas')}
    // glitter: fixed spots on the glove (bone index, position along it, sideways offset) that twinkle
    const glitter=Array.from({length:34},()=>({b:Math.floor(Math.random()*ARMOR_BONES.length),t:Math.random(),o:rnd(-.08,.08),ph:rnd(0,Math.PI*2),sp:rnd(2,4)}));
    this.armors.set(id,{age:0,seen:-1,glitter});
  }
  armorTrack(id,pts){const a=this.armors.get(id);if(a){a.pts=pts;a.seen=performance.now()}}
  armorOff(id){
    const a=this.armors.get(id);if(!a)return;this.armors.delete(id);
    if(a.pts&&performance.now()-a.seen<400)for(const [i,j] of ARMOR_BONES){const p=a.pts[i],q=a.pts[j];for(let k=0;k<5;k++){const f=Math.random();this.spawn(p.x+(q.x-p.x)*f,p.y+(q.y-p.y)*f,{vx:rnd(-240,240),vy:rnd(-80,240),size:rnd(10,28),life:rnd(.4,1),gravity:-380,star:k===0})}}
  }
  isArmored(id){return this.armors.has(id)}
  updateArmors(dt){
    const now=performance.now(),c=this.gloveCanvas;if(!c||!this.armors.size&&this.gloveClear)return;this.gloveClear=!this.armors.size;
    if(c.width!==innerWidth||c.height!==innerHeight){c.width=innerWidth;c.height=innerHeight}
    const ctx=c.getContext('2d');ctx.clearRect(0,0,c.width,c.height);
    for(const a of this.armors.values()){if(a.pts&&now-a.seen<400){a.age+=dt;this.drawGlove(ctx,a)}}
  }
  drawGlove(ctx,a){
    const H=innerHeight,P=a.pts.map(p=>({x:p.x,y:H-p.y})),size=Math.hypot(P[9].x-P[0].x,P[9].y-P[0].y),t=a.age;
    const ux=(P[9].x-P[0].x)/size,uy=(P[9].y-P[0].y)/size,nx=-uy,ny=ux; // hand axis (wrist -> middle knuckle) and its normal
    const E={x:P[0].x-ux*size*1.1,y:P[0].y-uy*size*1.1}; // end of the opera-length sleeve on the forearm
    const xs=[...P.map(p=>p.x),E.x],ys=[...P.map(p=>p.y),E.y],pad=size*.9,bx=Math.min(...xs)-pad,by=Math.min(...ys)-pad,bw=Math.max(...xs)-bx+pad,bh=Math.max(...ys)-by+pad;
    const b=this.gloveBuf;b.width=Math.ceil(bw);b.height=Math.ceil(bh);const m=b.getContext('2d');m.translate(-bx,-by);
    const line=(pts,w,style)=>{m.lineWidth=w;m.strokeStyle=style;m.beginPath();pts.forEach((p,n)=>n?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y));m.stroke()};
    const FINGERS=[[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]],WIDTH=[.3,.27,.27,.25,.22]; // base width per finger, tapering toward the tip
    // 1. Smooth silhouette: rounded fingers, palm, sleeve up the forearm
    m.lineCap=m.lineJoin='round';m.fillStyle='#fff';
    FINGERS.forEach((f,k)=>{for(let n=0;n<3;n++)line([P[f[n]],P[f[n+1]]],size*WIDTH[k]*(1-.08*n),'#fff')});
    line([P[0],P[1]],size*.32,'#fff');line([P[0],P[5]],size*.3,'#fff');line([P[0],P[17]],size*.3,'#fff');line([P[5],P[9],P[13],P[17]],size*.28,'#fff');
    m.beginPath();[0,1,2,5,9,13,17].forEach((k,n)=>n?m.lineTo(P[k].x,P[k].y):m.moveTo(P[k].x,P[k].y));m.closePath();m.fill();
    const w0=size*.36,w1=size*.46;
    // heel of the hand: hull of the knuckles and both sleeve corners, sorted by angle so it never self-intersects
    const hc={x:(P[0].x+P[9].x)/2,y:(P[0].y+P[9].y)/2},heel=[P[1],P[5],P[9],P[13],P[17],{x:P[0].x+nx*w0,y:P[0].y+ny*w0},{x:P[0].x-nx*w0,y:P[0].y-ny*w0}].sort((p,q)=>Math.atan2(p.y-hc.y,p.x-hc.x)-Math.atan2(q.y-hc.y,q.x-hc.x));
    m.beginPath();heel.forEach((p,n)=>n?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y));m.closePath();m.fill();line([...heel,heel[0]],size*.12,'#fff');
    m.beginPath();m.moveTo(P[0].x+nx*w0,P[0].y+ny*w0);m.lineTo(E.x+nx*w1,E.y+ny*w1);m.lineTo(E.x-nx*w1,E.y-ny*w1);m.lineTo(P[0].x-nx*w0,P[0].y-ny*w0);m.closePath();m.fill();
    // 2. One-piece shading. Soft base gradient, then an inner shadow and a rim light computed from the whole
    //    silhouette at once, so fingers, palm and sleeve read as a single seamless glove.
    const inv=this.gloveInv??=document.createElement('canvas');inv.width=b.width;inv.height=b.height;const iv=inv.getContext('2d');iv.fillStyle='#000';iv.fillRect(0,0,inv.width,inv.height);iv.globalCompositeOperation='destination-out';iv.drawImage(b,0,0);
    m.globalCompositeOperation='source-in';
    const g=m.createLinearGradient(E.x,E.y,P[12].x,P[12].y);g.addColorStop(0,'#7cc3ee');g.addColorStop(.45,'#a3d8f8');g.addColorStop(1,'#bfe6fc');m.fillStyle=g;m.fillRect(bx,by,bw,bh);
    m.globalCompositeOperation='source-atop';
    const edge=(color,blur,dx,dy)=>{m.save();m.shadowColor=color;m.shadowBlur=blur;m.shadowOffsetX=dx;m.shadowOffsetY=dy;m.drawImage(inv,bx,by);m.restore()};
    edge('rgba(28,90,165,.75)',size*.16,0,0);           // rounded, darker edges everywhere
    edge('rgba(255,255,255,.75)',size*.05,-nx*size*.04,-ny*size*.04); // rim light along one side
    const L=(al,sd)=>({x:P[0].x+ux*size*al+nx*size*sd,y:P[0].y+uy*size*al+ny*size*sd}); // hand-local coords: along / sideways
    const glowC=L(.5,0),rg=m.createRadialGradient(glowC.x,glowC.y,0,glowC.x,glowC.y,size*.8);rg.addColorStop(0,'rgba(255,255,255,.3)');rg.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=rg;m.fillRect(bx,by,bw,bh);
    const cl01=v=>Math.min(1,Math.max(0,v)),sweep=(t*.45%1.6)-.3,sg=m.createLinearGradient(E.x,E.y,P[12].x,P[12].y);sg.addColorStop(cl01(sweep-.15),'rgba(255,255,255,0)');sg.addColorStop(cl01(sweep),'rgba(255,255,255,.25)');sg.addColorStop(cl01(sweep+.15),'rgba(255,255,255,0)');m.fillStyle=sg;m.fillRect(bx,by,bw,bh);
    // 3. Frost embroidery: snowflake on the back of the hand, scrollwork vines to the knuckles and down the sleeve
    m.save();m.strokeStyle=m.fillStyle='rgba(255,255,255,.85)';m.lineCap=m.lineJoin='round';m.shadowColor='rgba(210,245,255,.9)';m.shadowBlur=size*.03;
    const lw=Math.max(1.2,size*.021);m.lineWidth=lw;
    const curve=(...q)=>{m.beginPath();m.moveTo(q[0].x,q[0].y);for(let k=1;k<q.length;k+=2)m.quadraticCurveTo(q[k].x,q[k].y,q[k+1].x,q[k+1].y);m.stroke()};
    const curl=(al,sd,r,dir)=>{m.beginPath();for(let k=0;k<=16;k++){const a=dir*k*.42,rr=r*(1-k/20);const p=L(al+Math.sin(a)*rr,sd+dir*(1-Math.cos(a))*rr);k?m.lineTo(p.x,p.y):m.moveTo(p.x,p.y)}m.stroke()};
    const dot=(p,r)=>{m.beginPath();m.arc(p.x,p.y,r,0,Math.PI*2);m.fill()};
    const sf={al:.42,sd:0},R=.26;                          // central snowflake
    for(let k=0;k<6;k++){const a=k*Math.PI/3,ax=Math.cos(a),ay=Math.sin(a),pt=f=>L(sf.al+ax*R*f,sf.sd+ay*R*f);curve(pt(0),pt(.5),pt(1));for(const f of [.45,.72]){const base=pt(f),bl=R*.28;for(const sgn of [1,-1]){const ba=a+sgn*.75;m.beginPath();m.moveTo(base.x,base.y);const e=L(sf.al+ax*R*f+Math.cos(ba)*bl,sf.sd+ay*R*f+Math.sin(ba)*bl);m.lineTo(e.x,e.y);m.stroke()}}dot(pt(1.12),lw*1.3)}
    dot(L(sf.al,0),lw*2.2);
    for(const side of [1,-1]){                             // vines from the snowflake toward the outer knuckles
      curve(L(.6,side*.08),L(.78,side*.12),L(.82,side*.3));curl(.82,side*.3,.07,-side);
      curve(L(.3,side*.14),L(.28,side*.3),L(.42,side*.36));curl(.42,side*.36,.06,side);
      for(const al of [.66,.74])dot(L(al,side*.2),lw*1.1);
    }
    for(const k of [5,9,13,17]){const p=P[k],q=P[k+1];dot({x:p.x+(q.x-p.x)*.55,y:p.y+(q.y-p.y)*.55},lw*1.6)} // jewel on each first finger joint
    for(const k of [6,10,14,18]){const p=P[k],q=P[k+1];dot({x:p.x+(q.x-p.x)*.5,y:p.y+(q.y-p.y)*.5},lw*1)}
    let side=1;for(let al=-.08;al>-.95;al-=.22){curve(L(al,0),L(al-.06,side*.06),L(al-.12,0),L(al-.17,-side*.06),L(al-.22,0));curl(al-.06,side*.07,.05,side);side=-side} // sleeve scrollwork
    m.restore();

    // 3. Lace cuff: a light band with a scalloped edge at the top of the sleeve
    m.globalCompositeOperation='source-over';
    const cuffA={x:E.x+ux*size*.06,y:E.y+uy*size*.06};line([{x:cuffA.x+nx*w1,y:cuffA.y+ny*w1},{x:cuffA.x-nx*w1,y:cuffA.y-ny*w1}],size*.14,'rgba(225,245,255,.95)');
    const nS=9,r=w1/nS*1.15;for(let k=0;k<nS;k++){const f=-1+(2*k+1)/nS,q={x:E.x+nx*w1*f-ux*size*.02,y:E.y+ny*w1*f-uy*size*.02};m.fillStyle='rgba(240,250,255,.9)';m.beginPath();m.arc(q.x,q.y,r,0,Math.PI*2);m.fill();m.fillStyle='rgba(120,190,240,.55)';m.beginPath();m.arc(q.x-ux*r*.25,q.y-uy*r*.25,r*.32,0,Math.PI*2);m.fill()}
    line([{x:cuffA.x+nx*w1,y:cuffA.y+ny*w1},{x:cuffA.x-nx*w1,y:cuffA.y-ny*w1}],Math.max(1,size*.018),'rgba(110,180,235,.8)');
    // 4. Put-on reveal: the glove slides on from the sleeve to the fingertips over ~0.6s
    const reach=size*4.5*Math.min(t/.6,1);if(reach<size*4.5){m.globalCompositeOperation='destination-in';const rv=m.createRadialGradient(E.x,E.y,0,E.x,E.y,reach+1);rv.addColorStop(0,'#fff');rv.addColorStop(.88,'#fff');rv.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=rv;m.fillRect(bx,by,bw,bh)}
    // 5. Composite with a soft shadow for depth and a faint frosty glow, then twinkling glitter on top
    ctx.save();ctx.shadowColor='rgba(120,200,255,.55)';ctx.shadowBlur=size*.18;ctx.drawImage(b,bx,by);ctx.restore();
    const shown=Math.min(t/.6,1);ctx.save();ctx.fillStyle='#fff';ctx.shadowColor='#bff0ff';ctx.shadowBlur=6;
    for(const gl of a.glitter){const [i,j]=ARMOR_BONES[gl.b],p=P[i],q=P[j];if(Math.hypot((p.x+q.x)/2-E.x,(p.y+q.y)/2-E.y)>size*4.5*shown)continue;const x=p.x+(q.x-p.x)*gl.t+nx*size*gl.o,y=p.y+(q.y-p.y)*gl.t+ny*size*gl.o,tw=Math.max(0,Math.sin(t*gl.sp+gl.ph))**6,r=size*.045*tw;if(r<.6)continue;ctx.globalAlpha=tw;ctx.beginPath();ctx.moveTo(x,y-r*2);ctx.lineTo(x+r*.4,y-r*.4);ctx.lineTo(x+r*2,y);ctx.lineTo(x+r*.4,y+r*.4);ctx.lineTo(x,y+r*2);ctx.lineTo(x-r*.4,y+r*.4);ctx.lineTo(x-r*2,y);ctx.lineTo(x-r*.4,y-r*.4);ctx.fill()}
    ctx.restore();
    if(Math.random()<.25){const j=TIPS[Math.floor(Math.random()*5)];this.spawn(P[j].x+rnd(-6,6),H-P[j].y+rnd(-6,6),{vx:rnd(-20,20),vy:rnd(-50,-10),size:rnd(8,16),life:rnd(.3,.6),gravity:-40,star:true})}
  }
  updateSpires(dt){
    for(let i=this.spires.length-1;i>=0;i--){
      const s=this.spires[i];s.age+=dt;
      for(const {m,delay} of s.shards){const t=Math.min(Math.max((s.age-delay)/.32,0),1),c=1.70158;m.scale.y=Math.max(.001,1+(c+1)*(t-1)**3+c*(t-1)**2)} // ease-out-back: overshoots then settles
      const fade=Math.min(Math.max((s.age-s.hold)/.45,0),1);
      for(const {m} of s.shards){m.material.opacity=.82*(1-fade);m.children[0].material.opacity=1-fade}
      if(s.age>s.hold&&!s.shattered){s.shattered=true;for(let k=0;k<Math.round(70*this.intensity);k++){const yy=rnd(0,s.top);this.spawn(s.x+rnd(-40,40)*(1-yy/s.top),yy,{vx:rnd(-160,160),vy:rnd(-40,120),life:rnd(.5,1.2),size:rnd(10,28),gravity:-260,star:k%3===0})}}
      if(fade>=1){this.scene.remove(s.g);s.g.traverse(o=>{o.geometry?.dispose();o.material?.dispose()});this.spires.splice(i,1)}
    }
  }
  // Schedule the next frame first so one bad frame can't stop the animation for good
  loop(now){requestAnimationFrame(this.loop);const dt=Math.min((now-this.last)/1000,.05);this.last=now;try{this.time+=dt;this.updateSpires(dt);this.updateArmors(dt);for(let i=this.anims.length-1;i>=0;i--){const a=this.anims[i];a.age+=dt;if(a.age<a.life)a.step(a.age/a.life,dt);else{this.anims.splice(i,1);a.end?.()}}for(let i=this.particles.length-1;i>=0;i--){const p=this.particles[i];p.life-=dt;if(p.life<=0){this.scene.remove(p.s);p.s.material.dispose();this.particles.splice(i,1);continue}p.vy+=p.gravity*dt;p.s.position.x+=p.vx*dt;p.s.position.y+=p.vy*dt;p.s.material.opacity=Math.min(1,p.life/.35)*.9;p.s.material.rotation+=p.spin*dt;p.s.scale.setScalar(p.size*(.8+.2*p.life/p.max))}this.renderer.render(this.scene,this.camera);}catch(e){console.error(e)}}
}
