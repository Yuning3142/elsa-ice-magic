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
  snow(x,y,amount=6){for(let i=0;i<Math.round(amount*this.intensity);i++)this.spawn(x+rnd(-35,35),y+rnd(-35,35),{vx:rnd(-95,95),vy:rnd(-110,30),size:rnd(10,33),life:rnd(.7,1.7),gravity:20})}
  trail(x,y){for(let i=0;i<Math.round(6*this.intensity);i++)this.spawn(x+rnd(-9,9),y+rnd(-9,9),{vx:rnd(-35,35),vy:rnd(-45,45),size:rnd(8,24),life:rnd(.2,.7),gravity:0})}
  charge(x,y){for(let i=0;i<Math.round(8*this.intensity);i++){const a=rnd(0,Math.PI*2),r=rnd(30,95);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:-Math.cos(a)*r*1.6,vy:-Math.sin(a)*r*1.6,size:rnd(12,29),life:rnd(.25,.7),gravity:0,color:0x72caff})}}
  burst(x,y){for(let i=0;i<Math.round(135*this.intensity);i++){const a=rnd(0,Math.PI*2),v=rnd(80,600);this.spawn(x,y,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.65,1.65),size:rnd(10,44),gravity:25,star:i%3===0})}}
  // Heavy snowfall from the top edge, slanted by wind; fill=true seeds the whole screen so it doesn't start empty
  storm(fill=false){const n=Math.round((fill?160:34)*this.intensity),wind=rnd(60,140);for(let i=0;i<n;i++){const near=Math.random(),sz=8+near*40,speed=180+near*320,y0=fill?rnd(0,innerHeight):innerHeight+rnd(10,60);this.spawn(rnd(-innerWidth*.15,innerWidth),y0,{vx:wind*(.6+near)+rnd(-30,30),vy:-speed,life:(y0+40)/speed+rnd(0,.3),size:sz,gravity:-30,star:near>.55&&Math.random()<.5,opacity:.5+near*.45})}}
  // Solid ice spires that burst out of the ground (bottom edge) up to the hand, hold, then shatter into frost
  pillar(x,y){
    const top=Math.max(y,innerHeight*.25),g=new THREE.Group(),shards=[];g.position.set(x,0,0);
    const add=(h,r,dx,tilt,delay)=>{
      const geo=new THREE.ConeGeometry(r,h,6,1);geo.translate(0,h/2,0);
      const mat=this.iceMat.clone(),edge=new THREE.LineSegments(new THREE.EdgesGeometry(geo),this.edgeMat.clone());
      const m=new THREE.Mesh(geo,mat);m.add(edge);m.position.x=dx;m.rotation.set(rnd(-.25,.25),rnd(0,Math.PI),tilt);m.scale.y=.001;g.add(m);shards.push({m,delay});
    };
    const w=Math.min(Math.max(top*.11,38),80);
    add(top,w,0,rnd(-.04,.04),0);
    for(let k=0;k<5;k++){const side=k%2?1:-1,f=rnd(.3,.7);add(top*f,w*rnd(.45,.7),side*rnd(w*.5,w*1.4),-side*rnd(.15,.5),.06+k*.04)}
    this.scene.add(g);this.spires.push({g,shards,top,x,age:0,hold:2.6});
    for(let k=0;k<Math.round(30*this.intensity);k++)this.spawn(x+rnd(-w*1.8,w*1.8),rnd(0,20),{vx:rnd(-260,260),vy:rnd(40,260),life:rnd(.4,.9),size:rnd(10,26),gravity:-420,color:0xd8f8ff});
  }
  // Generic timed animation: step(t in 0..1, dt) every frame, end() once when done
  animate(life,step,end){this.anims.push({age:0,life,step,end})}
  disposeObj(o){this.scene.remove(o);o.traverse(c=>{c.geometry?.dispose();c.material?.dispose()})}
  // Rotating six-armed snowflake sigil that unfolds at (x,y), then dissolves into crystals
  sigil(x,y){
    const R=Math.min(innerWidth,innerHeight)*.38,segs=[];const seg=(a,b)=>segs.push([a,b]),P=(r,a)=>new THREE.Vector2(Math.cos(a)*r,Math.sin(a)*r);
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
      ()=>{this.disposeObj(g);for(let k=0;k<Math.round(110*this.intensity);k++){const a=rnd(0,Math.PI*2),v=rnd(60,320);this.spawn(x+Math.cos(a)*R*.7,y+Math.sin(a)*R*.7,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.5,1.2),size:rnd(12,32),gravity:20,star:k%2===0})}});
  }
  // Ice shard projectile flying with velocity (vx,vy) px/s, leaving a frost trail
  shard(x,y,vx,vy){
    const geo=new THREE.ConeGeometry(11,80,6);geo.rotateZ(-Math.PI/2); // tip points along +x
    const m=new THREE.Mesh(geo,this.iceMat.clone());m.add(new THREE.LineSegments(new THREE.EdgesGeometry(geo),this.edgeMat.clone()));m.position.set(x,y,2);m.rotation.z=Math.atan2(vy,vx);this.scene.add(m);
    const hit=()=>{for(let k=0;k<Math.round(35*this.intensity);k++){const a=rnd(0,Math.PI*2),v=rnd(60,300);this.spawn(m.position.x,m.position.y,{vx:Math.cos(a)*v,vy:Math.sin(a)*v,life:rnd(.4,.9),size:rnd(10,26),gravity:30,star:k%3===0})}this.disposeObj(m)};
    const a={age:0,life:1.4,step:(t,dt)=>{m.position.x+=vx*dt;m.position.y+=vy*dt;m.rotation.x+=dt*9;for(let k=0;k<3;k++)this.spawn(m.position.x-vx*.03+rnd(-6,6),m.position.y-vy*.03+rnd(-6,6),{vx:rnd(-30,30),vy:rnd(-30,30),size:rnd(8,20),life:rnd(.2,.5),gravity:0});const p=m.position;if(p.x<-40||p.x>innerWidth+40||p.y<-40||p.y>innerHeight+40)a.age=a.life},end:hit};
    this.anims.push(a);
  }
  // Expanding shockwave ring of ice
  ring(x,y){
    const mat=new THREE.MeshBasicMaterial({color:0xaeeeff,transparent:true,blending:THREE.AdditiveBlending,depthWrite:false,side:THREE.DoubleSide}),m=new THREE.Mesh(new THREE.RingGeometry(0,1,96),mat);m.position.set(x,y,3);this.scene.add(m);
    const maxR=Math.hypot(innerWidth,innerHeight)*.55;let lastR=0;
    this.animate(.8,t=>{const r=Math.max(12,maxR*(1-(1-t)**2.4));m.geometry.dispose();m.geometry=new THREE.RingGeometry(r-10*(1-t)-2,r,96);mat.opacity=1-t;if(r-lastR>14){const n=Math.round(14*this.intensity);for(let k=0;k<n;k++){const a=rnd(0,Math.PI*2);this.spawn(x+Math.cos(a)*r,y+Math.sin(a)*r,{vx:Math.cos(a)*60,vy:Math.sin(a)*60,size:rnd(10,26),life:rnd(.3,.7),gravity:0,star:Math.random()<.4})}lastR=r}},()=>this.disposeObj(m));
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
  // Ice gauntlet: one seamless glove silhouette drawn on a 2D canvas under the particles.
  // pts = 21 landmarks in Three coords (y up), fed via armorTrack().
  armorOn(id){
    if(this.armors.has(id))return;
    if(!this.gloveCanvas){
      this.gloveCanvas=document.createElement('canvas');Object.assign(this.gloveCanvas.style,{position:'absolute',inset:0,width:'100%',height:'100%',pointerEvents:'none'});this.root.insertBefore(this.gloveCanvas,this.renderer.domElement);
      this.gloveBuf=document.createElement('canvas');
      const f=document.createElement('canvas');f.width=f.height=220;const x=f.getContext('2d'); // crackle texture for the ice surface
      for(let k=0;k<26;k++){x.strokeStyle=`rgba(255,255,255,${rnd(.15,.45)})`;x.lineWidth=rnd(.6,1.6);x.beginPath();let px=rnd(0,220),py=rnd(0,220);x.moveTo(px,py);for(let n=0;n<4;n++){px+=rnd(-45,45);py+=rnd(-45,45);x.lineTo(px,py)}x.stroke()}
      for(let k=0;k<14;k++){x.fillStyle=`rgba(${k%2?'255,255,255':'40,120,190'},${rnd(.05,.14)})`;x.beginPath();const cx=rnd(0,220),cy=rnd(0,220);for(let n=0;n<3;n++)x.lineTo(cx+rnd(-40,40),cy+rnd(-40,40));x.fill()}
      this.crackle=f;
    }
    this.armors.set(id,{age:0,seen:-1,spikes:Array.from({length:9},()=>rnd(.12,.3))});
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
    const xs=P.map(p=>p.x),ys=P.map(p=>p.y),pad=size*1.2,bx=Math.min(...xs)-pad,by=Math.min(...ys)-pad,bw=Math.max(...xs)-bx+pad,bh=Math.max(...ys)-by+pad;
    const b=this.gloveBuf;b.width=Math.ceil(bw);b.height=Math.ceil(bh);const m=b.getContext('2d');m.translate(-bx,-by);
    // 1. Silhouette: round-capped bones (thicker at the base), palm, pointed fingertips, knuckle ridges, flared spiky cuff
    m.lineCap=m.lineJoin='round';m.fillStyle=m.strokeStyle='#fff';
    for(const [i,j] of ARMOR_BONES){const d=ARMOR_DEPTH[j];m.lineWidth=size*(d<=1?.34:i<5?.3-.02*d:.3-.025*d);m.beginPath();m.moveTo(P[i].x,P[i].y);m.lineTo(P[j].x,P[j].y);m.stroke()}
    m.beginPath();[0,1,2,5,9,13,17].forEach((k,n)=>n?m.lineTo(P[k].x,P[k].y):m.moveTo(P[k].x,P[k].y));m.closePath();m.fill();
    for(const j of TIPS){const p=P[j-1],q=P[j],L=Math.hypot(q.x-p.x,q.y-p.y)||1,dx=(q.x-p.x)/L,dy=(q.y-p.y)/L,w=size*.1;m.beginPath();m.moveTo(q.x-dy*w,q.y+dx*w);m.lineTo(q.x+dx*size*.24,q.y+dy*size*.24);m.lineTo(q.x+dy*w,q.y-dx*w);m.fill()}
    [5,9,13,17].forEach((j,k)=>{const dx=P[j].x-P[0].x,dy=P[j].y-P[0].y,L=Math.hypot(dx,dy),w=size*.08,h=size*(.16+a.spikes[k]*.3);m.beginPath();m.moveTo(P[j].x-dy/L*w,P[j].y+dx/L*w);m.lineTo(P[j].x+dx/L*h-dy/L*size*.05,P[j].y+dy/L*h+dx/L*size*.05);m.lineTo(P[j].x+dy/L*w,P[j].y-dx/L*w);m.fill()});
    const w0=size*.42,w1=size*.62,cl=size*.6,cx0=P[0].x-ux*size*.05,cy0=P[0].y-uy*size*.05,ex=cx0-ux*cl,ey=cy0-uy*cl;
    m.beginPath();m.moveTo(cx0+nx*w0,cy0+ny*w0);m.lineTo(ex+nx*w1,ey+ny*w1);
    for(let k=0;k<a.spikes.length;k++){const f=1-2*(k+.5)/a.spikes.length,sp=size*a.spikes[k];m.lineTo(ex+nx*w1*f-ux*sp,ey+ny*w1*f-uy*sp);const g=1-2*(k+1)/a.spikes.length;m.lineTo(ex+nx*w1*g,ey+ny*w1*g)}
    m.lineTo(cx0-nx*w0,cy0-ny*w0);m.closePath();m.fill();
    // 2. Ice surface: gradient along the hand, crackle texture, specular streaks down each finger
    m.globalCompositeOperation='source-in';const grad=m.createLinearGradient(ex,ey,P[12].x,P[12].y);grad.addColorStop(0,'rgba(170,230,255,.92)');grad.addColorStop(.45,'rgba(110,195,250,.78)');grad.addColorStop(1,'rgba(215,248,255,.9)');m.fillStyle=grad;m.fillRect(bx,by,bw,bh);
    m.globalCompositeOperation='source-atop';m.fillStyle=m.createPattern(this.crackle,'repeat');m.fillRect(bx,by,bw,bh);
    m.strokeStyle='rgba(255,255,255,.55)';m.lineWidth=Math.max(1.5,size*.035);for(const f of [[1,2,3,4],[5,6,7,8],[9,10,11,12],[13,14,15,16],[17,18,19,20]]){m.beginPath();f.forEach((k,n)=>{const x=P[k].x-nx*size*.05,y=P[k].y-ny*size*.05;n?m.lineTo(x,y):m.moveTo(x,y)});m.stroke()}
    const sweep=(t*.6%1.6)-.3,sg=m.createLinearGradient(ex,ey,P[12].x,P[12].y);const cl01=v=>Math.min(1,Math.max(0,v));sg.addColorStop(cl01(sweep-.12),'rgba(255,255,255,0)');sg.addColorStop(cl01(sweep),'rgba(255,255,255,.4)');sg.addColorStop(cl01(sweep+.12),'rgba(255,255,255,0)');m.fillStyle=sg;m.fillRect(bx,by,bw,bh); // light sweeping up the glove
    // 3. Freeze reveal: grows outward from the wrist over ~0.6s
    const reveal=size*5*Math.min(t/.6,1);if(reveal<size*5){m.globalCompositeOperation='destination-in';const rg=m.createRadialGradient(ex,ey,0,ex,ey,reveal+1);rg.addColorStop(0,'#fff');rg.addColorStop(.85,'#fff');rg.addColorStop(1,'rgba(255,255,255,0)');m.fillStyle=rg;m.fillRect(bx,by,bw,bh)}
    // 4. Composite with a cold outer glow
    ctx.save();ctx.shadowColor='rgba(120,215,255,.9)';ctx.shadowBlur=size*.35*(.85+.15*Math.sin(t*4));ctx.drawImage(b,bx,by);ctx.restore();
    if(Math.random()<.4){const j=TIPS[Math.floor(Math.random()*5)];this.spawn(P[j].x+rnd(-6,6),H-P[j].y+rnd(-6,6),{vx:rnd(-20,20),vy:rnd(-60,-10),size:rnd(8,18),life:rnd(.3,.7),gravity:-40,star:Math.random()<.3})}
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
