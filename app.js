(()=>{'use strict';
const $=s=>document.querySelector(s);
const el=(tag,cls,html)=>{const e=document.createElement(tag);if(cls)e.className=cls;if(html!=null)e.innerHTML=html;return e};
const clamp=(v,a,b)=>Math.max(a,Math.min(b,v));
const PH=.4; // altura de uma placa (1 pino = 1 unidade)

/* ---------- cores ---------- */
const COLORS=[
 ['white','Branco','#f4f4f1'],['lgray','Cinza claro','#a3a8ad'],['dgray','Cinza escuro','#62666b'],['black','Preto','#24282e'],
 ['red','Vermelho','#c91a09'],['dred','Vinho','#7a1215'],['orange','Laranja','#fe8a18'],['gold','Ouro','#f8b93a'],
 ['yellow','Amarelo','#f6d02f'],['lime','Lima','#b4dc12'],['green','Verde','#3f9a3e'],['dgreen','Verde escuro','#1c5236'],
 ['teal','Turquesa','#0a8f95'],['azure','Azul-celeste','#36aebf'],['sky','Azul claro','#9fc8ee'],['blue','Azul','#0b5bc4'],
 ['navy','Azul-marinho','#12366b'],['purple','Roxo','#7c2a9c'],['pink','Rosa','#f48fb7'],['magenta','Magenta','#b83280'],
 ['tan','Areia','#e4cd9e'],['brown','Marrom','#7e4a2a'],['dbrown','Marrom escuro','#47301c'],['olive','Oliva','#8f8f4f'],
 ['tclear','Transparente','#e6f1f5',1],['tblue','Vidro azul','#7fd0f5',1],['tred','Vidro vermelho','#e23a2e',1],
 ['tyellow','Vidro amarelo','#f9d949',1],['tgreen','Vidro verde','#63cf63',1]
];
const CMAP={};COLORS.forEach(c=>CMAP[c[0]]={name:c[1],hex:c[2],tr:!!c[3]});

/* ---------- tipos de peça ---------- */
const TYPES={},CATS={Tijolos:[],Placas:[],Especiais:[]};
const def=(id,name,w,d,h,shape,cat)=>{TYPES[id]={id,name,w,d,h,shape};CATS[cat].push(id)};
const SIZES=[[1,1],[1,2],[1,3],[1,4],[1,6],[1,8],[2,2],[2,3],[2,4],[2,6],[2,8]];
SIZES.forEach(([w,d])=>def(`b${w}x${d}`,`Tijolo ${w}×${d}`,w,d,3,'box','Tijolos'));
SIZES.concat([[4,4],[4,8],[6,6],[8,8]]).forEach(([w,d])=>def(`p${w}x${d}`,`Placa ${w}×${d}`,w,d,1,'box','Placas'));
def('s1x2','Rampa 1×2',1,2,3,'slope','Especiais');def('s2x2','Rampa 2×2',2,2,3,'slope','Especiais');
def('r1x1','Cilindro 1×1',1,1,3,'round','Especiais');def('r2x2','Cilindro 2×2',2,2,3,'round','Especiais');
def('c1x1','Cone 1×1',1,1,3,'cone','Especiais');def('c2x2','Cone 2×2',2,2,3,'cone','Especiais');
def('rp1x1','Botão 1×1',1,1,1,'round','Especiais');
[[1,1],[1,2],[1,4],[2,2]].forEach(([w,d])=>def(`t${w}x${d}`,`Lisa ${w}×${d}`,w,d,1,'tile','Especiais'));
const fp=(t,r)=>r%2?[t.d,t.w]:[t.w,t.d];
const normR=(t,r)=>t.shape==='slope'?r&3:(t.w===t.d?0:r&1);

/* ---------- geometria ---------- */
function mergeGeo(list){let n=0;list.forEach(g=>n+=g.attributes.position.array.length);
  const pos=new Float32Array(n),nor=new Float32Array(n);let o=0;
  list.forEach(g=>{pos.set(g.attributes.position.array,o);nor.set(g.attributes.normal.array,o);o+=g.attributes.position.array.length;g.dispose()});
  const out=new THREE.BufferGeometry();out.setAttribute('position',new THREE.BufferAttribute(pos,3));out.setAttribute('normal',new THREE.BufferAttribute(nor,3));return out}
function prism(w,d,H){
  const P=[[-d/2,0],[d/2,0],[d/2,.2],[-d/2+.97,H],[-d/2,H]],x0=-w/2,x1=w/2,T=[];
  const v=(x,p)=>[x,p[1],p[0]];
  for(let i=1;i<P.length-1;i++){T.push(v(x0,P[0]),v(x0,P[i]),v(x0,P[i+1]));T.push(v(x1,P[0]),v(x1,P[i]),v(x1,P[i+1]))}
  for(let i=0;i<P.length;i++){const a=P[i],b=P[(i+1)%P.length];T.push(v(x0,a),v(x0,b),v(x1,b),v(x0,a),v(x1,b),v(x1,a))}
  const pos=[],nor=[],A=new THREE.Vector3(),B=new THREE.Vector3(),C=new THREE.Vector3(),n=new THREE.Vector3(),m=new THREE.Vector3(),c=new THREE.Vector3(0,.1,0);
  for(let i=0;i<T.length;i+=3){A.fromArray(T[i]);B.fromArray(T[i+1]);C.fromArray(T[i+2]);
    n.subVectors(B,A).cross(m.subVectors(C,A)).normalize();m.copy(A).add(B).add(C).divideScalar(3).sub(c);
    let q=[A,B,C];if(n.dot(m)<0){q=[A,C,B];n.negate()}
    q.forEach(p=>{pos.push(p.x,p.y,p.z);nor.push(n.x,n.y,n.z)})}
  const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(new Float32Array(pos),3));g.setAttribute('normal',new THREE.BufferAttribute(new Float32Array(nor),3));return g}
const geoCache={};
function geo(id){if(geoCache[id])return geoCache[id];
  const t=TYPES[id],H=t.h*PH-.012,g=.03,L=[];
  const stud=(x,z)=>{const s=new THREE.CylinderGeometry(.3,.3,.17,14).toNonIndexed();s.translate(x,H+.085,z);L.push(s)};
  const studs=()=>{for(let i=0;i<t.w;i++)for(let j=0;j<t.d;j++)stud(-t.w/2+.5+i,-t.d/2+.5+j)};
  const body=b=>{const n=b.toNonIndexed();n.translate(0,H/2,0);L.push(n)};
  if(t.shape==='box'){body(new THREE.BoxGeometry(t.w-g,H,t.d-g));studs()}
  else if(t.shape==='tile')body(new THREE.BoxGeometry(t.w-g,H,t.d-g));
  else if(t.shape==='round'){body(new THREE.CylinderGeometry(t.w/2-.02,t.w/2-.02,H,24));studs()}
  else if(t.shape==='cone'){body(new THREE.CylinderGeometry(t.w===1?.3:.5,t.w/2-.02,H,24));stud(0,0)}
  else{L.push(prism(t.w-g,t.d-g,H));for(let i=0;i<t.w;i++)stud(-t.w/2+.5+i,-t.d/2+.5)}
  return geoCache[id]=mergeGeo(L)}
const matCache={},ghostCache={};
function mat(c){if(matCache[c])return matCache[c];const k=CMAP[c]||CMAP.red;
  return matCache[c]=new THREE.MeshPhongMaterial({color:k.hex,shininess:70,specular:0x3a3a3a,transparent:k.tr,opacity:k.tr?.62:1})}
function ghostMat(c){if(ghostCache[c])return ghostCache[c];
  return ghostCache[c]=new THREE.MeshPhongMaterial({color:(CMAP[c]||CMAP.red).hex,transparent:true,opacity:.55,depthWrite:false})}

/* ---------- cena ---------- */
const cv=$('#c'),app=$('#app');
const renderer=new THREE.WebGLRenderer({canvas:cv,antialias:true});
renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));
renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;
const scene=new THREE.Scene();scene.fog=new THREE.Fog(0xbfe4f8,70,230);
const camera=new THREE.PerspectiveCamera(42,1,.5,600);
const hemi=new THREE.HemisphereLight(0xffffff,0x8a9a80,.72);scene.add(hemi);
const sun=new THREE.DirectionalLight(0xffffff,.72);sun.castShadow=true;
sun.shadow.mapSize.set(2048,2048);Object.assign(sun.shadow.camera,{left:-48,right:48,top:48,bottom:-48,near:1,far:160});
sun.shadow.bias=-.0006;sun.shadow.normalBias=.03;scene.add(sun,sun.target);
// chão infinito: uma base de pinos que acompanha a câmera
const gtex=(()=>{const c=document.createElement('canvas');c.width=c.height=64;const x=c.getContext('2d');
  x.fillStyle='#e6e6e6';x.fillRect(0,0,64,64);x.strokeStyle='#d2d2d2';x.lineWidth=2;x.strokeRect(0,0,64,64);
  x.fillStyle='#bdbdbd';x.beginPath();x.arc(34,35,20,0,7);x.fill();
  x.fillStyle='#fafafa';x.beginPath();x.arc(32,32,19,0,7);x.fill();
  x.fillStyle='#ececec';x.beginPath();x.arc(32,32,15,0,7);x.fill();
  const t=new THREE.CanvasTexture(c);t.wrapS=t.wrapT=THREE.RepeatWrapping;t.repeat.set(600,600);t.anisotropy=renderer.capabilities.getMaxAnisotropy();return t})();
const groundMat=new THREE.MeshPhongMaterial({map:gtex,color:0x5aad4c,shininess:12});
const ground=new THREE.Mesh(new THREE.PlaneGeometry(600,600),groundMat);ground.rotation.x=-Math.PI/2;ground.receiveShadow=true;scene.add(ground);
const brickGroup=new THREE.Group();scene.add(brickGroup);

function applyTheme(){const cs=getComputedStyle(document.documentElement);
  const sky=cs.getPropertyValue('--sky').trim()||'#bfe4f8',gr=cs.getPropertyValue('--ground').trim()||'#5aad4c';
  scene.background=new THREE.Color(sky);scene.fog.color.set(sky);groundMat.color.set(gr);
  const dark=new THREE.Color(sky).getHSL({h:0,s:0,l:0}).l<.4;hemi.intensity=dark?.6:.72}
applyTheme();
matchMedia('(prefers-color-scheme: dark)').addEventListener('change',applyTheme);
new MutationObserver(applyTheme).observe(document.documentElement,{attributes:true,attributeFilter:['data-theme']});

const cam={target:new THREE.Vector3(0,2,0),az:Math.PI*.3,pol:1.0,dist:36};
function resize(){const w=app.clientWidth,h=app.clientHeight;if(!w||!h)return;renderer.setSize(w,h,false);camera.aspect=w/h;camera.updateProjectionMatrix()}
new ResizeObserver(resize).observe(app);resize();
new ResizeObserver(()=>app.style.setProperty('--top',$('#top').offsetHeight+'px')).observe($('#top'));
function updateCamera(){const s=Math.sin(cam.pol),t=cam.target;
  camera.position.set(t.x+cam.dist*s*Math.cos(cam.az),t.y+cam.dist*Math.cos(cam.pol),t.z+cam.dist*s*Math.sin(cam.az));camera.lookAt(t);
  ground.position.set(Math.round(t.x),0,Math.round(t.z));
  sun.position.set(t.x+26,56,t.z+18);sun.target.position.set(t.x,0,t.z)}

/* ---------- mundo ---------- */
// Cada peça é um registro { id, mod }: `mod` decide quem vence na sincronização e `tomb` guarda as exclusões.
const KEY='blocos-sem-fim-v2';
const pieces=new Set(),occ=new Map(),anims=new Set(),byId=new Map();
let tomb={};
const SET={gClient:'',gWas:false,som:true};
const uid=()=>Date.now().toString(36)+Math.random().toString(36).slice(2,8);
const undoS=[],redoS=[];
const S={tool:'build',type:'b2x4',rot:0,color:'red',tab:'Tijolos'};
const key=(x,y,z)=>x+','+y+','+z;
function cellsOf(p,fn){const t=TYPES[p.t],[W,D]=fp(t,p.r);for(let i=0;i<W;i++)for(let k=0;k<D;k++)for(let j=0;j<t.h;j++)if(fn(key(p.x+i,p.y+j,p.z+k))===false)return false;return true}
const canPlace=p=>p.y>=0&&cellsOf(p,k=>!occ.has(k));
function addPiece(p,anim){const t=TYPES[p.t],[W,D]=fp(t,p.r);if(!p.id)p.id=uid();if(!p.mod)p.mod=Date.now();byId.set(p.id,p);cellsOf(p,k=>{occ.set(k,p)});
  const m=new THREE.Mesh(geo(p.t),mat(p.c));m.position.set(p.x+W/2,p.y*PH,p.z+D/2);m.rotation.y=p.r*Math.PI/2;
  m.castShadow=m.receiveShadow=true;m.userData.p=p;p.mesh=m;brickGroup.add(m);pieces.add(p);
  if(anim){p.t0=performance.now();m.position.y+=1.6;anims.add(p)}}
function removePiece(p){cellsOf(p,k=>{if(occ.get(k)===p)occ.delete(k)});if(p.mesh){brickGroup.remove(p.mesh);p.mesh=null}pieces.delete(p);anims.delete(p);byId.delete(p.id)}
// alterações feitas por você: carimbam a data (as vindas da sincronização usam addPiece/removePiece direto)
function uAdd(p,anim){if(pieces.has(p)||!canPlace(p))return false;p.mod=Date.now();addPiece(p,anim);return true}
function uDel(p){if(!pieces.has(p))return;removePiece(p);tomb[p.id]=Date.now()}
function uPaint(p,c){p.c=c;p.mod=Date.now();if(p.mesh)p.mesh.material=mat(c)}
function commit(a){undoS.push(a);if(undoS.length>300)undoS.shift();redoS.length=0;changed()}
function undo(){const a=undoS.pop();if(!a)return;(a.add||[]).forEach(uDel);(a.rem||[]).forEach(p=>uAdd(p));(a.paint||[]).forEach(q=>uPaint(q.p,q.from));redoS.push(a);changed();snd(300)}
function redo(){const a=redoS.pop();if(!a)return;(a.rem||[]).forEach(uDel);(a.add||[]).forEach(p=>uAdd(p,true));(a.paint||[]).forEach(q=>uPaint(q.p,q.to));undoS.push(a);changed();snd(520)}
let saveT=0;
function refresh(){$('#count').textContent=pieces.size.toLocaleString('pt-BR')+(pieces.size===1?' peça':' peças');
  $('#undo').disabled=!undoS.length;$('#redo').disabled=!redoS.length}
function changed(){refresh();clearTimeout(saveT);saveT=setTimeout(save,500);if(BSF.onChange)BSF.onChange()}
const pack=p=>[p.id,p.t,p.x,p.y,p.z,p.r,p.c,p.mod];
function unpack(a){if(!Array.isArray(a)||!a[0]||!TYPES[a[1]]||!CMAP[a[6]])return null;
  const p={id:String(a[0]),t:a[1],x:Math.round(a[2])||0,y:Math.round(a[3])||0,z:Math.round(a[4])||0,r:(Math.round(a[5])||0)&3,c:a[6],mod:Number(a[7])||1};
  return p.y<0||Math.abs(p.x)>1e6||Math.abs(p.z)>1e6||p.y>1e5?null:p}
function save(){try{localStorage.setItem(KEY,JSON.stringify({pecas:[...pieces].map(pack),tomb}))}catch(e){}}
function saveSet(){try{localStorage.setItem(KEY+'-set',JSON.stringify(SET))}catch(e){}}
function load(){try{Object.assign(SET,JSON.parse(localStorage.getItem(KEY+'-set')||'{}'))}catch(e){}
  try{const d=JSON.parse(localStorage.getItem(KEY)||'null');if(!d||!Array.isArray(d.pecas))return false;
    tomb=d.tomb&&typeof d.tomb==='object'?d.tomb:{};
    d.pecas.forEach(a=>{const p=unpack(a);if(p&&!byId.has(p.id)&&canPlace(p))addPiece(p)});return true}catch(e){return false}}

/* ---------- sincronização: o que sai e como entra ---------- */
function payload(){const old=Date.now()-365*864e5;for(const k in tomb)if(tomb[k]<old&&k[0]!=='s')delete tomb[k];
  return {app:'blocos-sem-fim',v:1,at:Date.now(),pecas:[...pieces].map(pack),tomb}}
// impressão digital do conteúdo, para só regravar quando há diferença
const print=p=>(p.pecas||[]).length+':'+(p.pecas||[]).reduce((n,a)=>n+(Number(a[7])||0)%1e9,0)+'|'+Object.keys(p.tomb||{}).length;
// Mescla por peça: vale a versão mais recente e as exclusões são propagadas.
// Se duas peças de aparelhos diferentes ocupam o mesmo lugar, fica a mais nova.
function merge(r){if(!r||r.app!=='blocos-sem-fim'||!Array.isArray(r.pecas))return false;
  let ch=false;const rt=r.tomb&&typeof r.tomb==='object'?r.tomb:{},now=Date.now();
  for(const a of r.pecas){const rec=unpack(a);if(!rec||(tomb[rec.id]||0)>=rec.mod)continue;
    const loc=byId.get(rec.id);
    if(loc){if(rec.mod>loc.mod){loc.c=rec.c;loc.mod=rec.mod;if(loc.mesh)loc.mesh.material=mat(loc.c);ch=true}continue}
    const hits=new Set();cellsOf(rec,k=>{const o=occ.get(k);if(o)hits.add(o)});
    if([...hits].some(o=>o.mod>=rec.mod)){tomb[rec.id]=now;ch=true;continue}
    hits.forEach(o=>{removePiece(o);tomb[o.id]=now});addPiece(rec,true);ch=true}
  for(const id in rt){const ts=Number(rt[id])||0;if((tomb[id]||0)<ts){tomb[id]=ts;ch=true}
    const loc=byId.get(id);if(loc&&loc.mod<=ts){removePiece(loc);ch=true}}
  if(ch){refresh();save();hideHover();if(guide)renderStatus()}
  return ch}
const BSF=window.BSF={set:SET,saveSet,payload,print,merge,onChange:null,toast:t=>toast(t)};

/* ---------- som ---------- */
let actx;
function snd(f){if(!SET.som)return;try{actx=actx||new(window.AudioContext||window.webkitAudioContext)();const o=actx.createOscillator(),g=actx.createGain(),t=actx.currentTime;
  o.type='square';o.frequency.setValueAtTime(f,t);o.frequency.exponentialRampToValueAtTime(f*.6,t+.06);g.gain.setValueAtTime(.045,t);g.gain.exponentialRampToValueAtTime(.0001,t+.08);
  o.connect(g);g.connect(actx.destination);o.start(t);o.stop(t+.09)}catch(e){}}

/* ---------- modelos prontos ---------- */
function buildModel(fn){
  const vox=new Map(),raw=[];
  const F=(x,y,z,w,h,d,c)=>{for(let i=0;i<w;i++)for(let j=0;j<h;j++)for(let k=0;k<d;k++)vox.set(key(x+i,y+j,z+k),c)};
  const B=(x,y,z,w,h,d,c)=>F(x,y*3,z,w,h*3,d,c);
  const X=(x,y,z,w,h,d)=>{for(let i=0;i<w;i++)for(let j=0;j<h*3;j++)for(let k=0;k<d;k++)vox.delete(key(x+i,y*3+j,z+k))};
  const K=(t,x,y,z,r,c)=>raw.push({t,x,y,z,r:r||0,c});
  const SL=(x,y,z,n,r,c)=>{for(let i=0;i<n;i++)K('s2x2',x+(r%2?0:2*i),y*3,z+(r%2?2*i:0),r,c)};
  const ART=(rows,pal,x0,y0,z0,depth)=>rows.forEach((row,ri)=>[...row].forEach((ch,ci)=>{if(pal[ch])B(x0+ci,y0+rows.length-1-ri,z0,1,1,depth||1,pal[ch])}));
  fn({F,B,X,K,SL,ART});
  const out=[],taken=new Set();
  raw.forEach(p=>{let ok=true;cellsOf(p,k=>{if(taken.has(k))ok=false});if(!ok)return;cellsOf(p,k=>{taken.add(k);vox.delete(k)});out.push(p)});
  const cells=[];vox.forEach((c,k)=>{const a=k.split(',');cells.push([+a[0],+a[1],+a[2],c])});
  cells.sort((p,q)=>p[1]-q[1]||p[2]-q[2]||p[0]-q[0]);
  const used=new Set(),SZ=[8,6,4,3,2,1];
  const at=(x,y,z)=>{const k=key(x,y,z);return used.has(k)?undefined:vox.get(k)};
  for(const [x,y,z,c] of cells){if(used.has(key(x,y,z)))continue;
    const h=(at(x,y+1,z)===c&&at(x,y+2,z)===c)?3:1;
    const ok=(a,b)=>{for(let j=0;j<h;j++)if(at(a,y+j,b)!==c)return false;return true};
    const plan=(dx,dz)=>{let L=1;while(L<8&&ok(x+dx*L,z+dz*L))L++;let L2=0;while(L2<L&&ok(x+dz+dx*L2,z+dx+dz*L2))L2++;
      const a=SZ.find(s=>s<=L),b=L2?SZ.find(s=>s<=L2):0;return b*2>a?{len:b,wd:2,dx}:{len:a,wd:1,dx}};
    const P1=plan(1,0),P2=plan(0,1),a1=P1.len*P1.wd,a2=P2.len*P2.wd;
    const Q=a1>a2?P1:a2>a1?P2:(Math.floor(y/3)%2===0?P1:P2);
    const WX=Q.dx?Q.len:Q.wd,WZ=Q.dx?Q.wd:Q.len;
    for(let i=0;i<WX;i++)for(let k=0;k<WZ;k++)for(let j=0;j<h;j++)used.add(key(x+i,y+j,z+k));
    out.push({t:(h===3?'b':'p')+Math.min(WX,WZ)+'x'+Math.max(WX,WZ),x,y,z,r:WX>WZ?1:0,c})}
  return normalize(out)}
function normalize(ps){let mx=1e9,my=1e9,mz=1e9,Mx=-1e9,My=-1e9,Mz=-1e9;
  ps.forEach(p=>{const t=TYPES[p.t],[W,D]=fp(t,p.r);mx=Math.min(mx,p.x);my=Math.min(my,p.y);mz=Math.min(mz,p.z);Mx=Math.max(Mx,p.x+W);My=Math.max(My,p.y+t.h);Mz=Math.max(Mz,p.z+D)});
  ps.forEach(p=>{p.x-=mx;p.y-=my;p.z-=mz});ps.sort((a,b)=>a.y-b.y||a.z-b.z||a.x-b.x);
  return {pieces:ps,size:[Mx-mx,My-my,Mz-mz]}}
function rotated(model,k){let ps=model.pieces.map(p=>({...p}));
  for(let n=0;n<k;n++)ps=ps.map(p=>{const t=TYPES[p.t],[W]=fp(t,p.r);return {...p,x:p.z,z:-p.x-W,r:normR(t,p.r+1)}});
  return normalize(ps)}

const MODELS=[
{n:'Casinha',cat:'Construções',f:({B,X,SL})=>{B(0,0,0,8,4,6,'white');X(1,0,1,6,4,4);
  B(3,0,5,2,3,1,'brown');B(1,1,5,1,2,1,'tblue');B(6,1,5,1,2,1,'tblue');B(7,1,2,1,2,2,'tblue');B(0,1,2,1,2,2,'tblue');
  B(0,4,1,8,1,4,'white');SL(0,4,-1,4,2,'red');SL(0,4,5,4,0,'red');SL(0,5,1,4,2,'red');SL(0,5,3,4,0,'red')}},
{n:'Torre de vigia',cat:'Construções',f:({F,B,X})=>{B(0,0,0,6,7,6,'lgray');X(1,0,1,4,7,4);B(2,0,5,2,3,1,'dbrown');B(2,4,5,2,1,1,'black');B(5,4,2,1,1,2,'black');
  F(-1,21,-1,8,1,8,'dgray');for(let i=-1;i<7;i+=2)[-1,6].forEach(k=>{F(i,22,k,1,3,1,'lgray');F(k,22,i,1,3,1,'lgray')});F(6,22,6,1,3,1,'lgray');
  F(2,22,2,1,12,1,'brown');F(3,30,2,2,4,1,'red')}},
{n:'Castelo',cat:'Construções',f:({F,B,X})=>{B(1,0,1,14,4,14,'lgray');X(2,0,2,12,4,12);
  [[0,0],[12,0],[0,12],[12,12]].forEach(([a,b])=>{B(a,0,b,4,6,4,'lgray');[0,3].forEach(i=>[0,3].forEach(j=>B(a+i,6,b+j,1,1,1,'dgray')))});
  for(let i=5;i<=10;i+=2){B(i,4,1,1,1,1,'lgray');B(i,4,14,1,1,1,'lgray');B(1,4,i,1,1,1,'lgray');B(14,4,i,1,1,1,'lgray')}
  B(7,0,14,2,3,1,'dbrown');B(6,0,6,4,7,4,'dgray');[0,3].forEach(i=>[0,3].forEach(j=>B(6+i,7,6+j,1,1,1,'lgray')));
  F(7,21,7,1,12,1,'brown');F(8,29,7,2,3,1,'blue');F(13,18,13,1,9,1,'brown');F(14,24,13,2,3,1,'red');F(1,18,1,1,9,1,'brown');F(2,24,1,2,3,1,'red')}},
{n:'Farol',cat:'Construções',f:({F,B,K})=>{B(0,0,0,8,1,8,'dgray');B(1,1,1,6,1,6,'lgray');
  for(let i=0;i<8;i++)B(2,2+i,2,4,1,4,i%2?'white':'red');B(3,2,5,2,2,1,'dbrown');B(3,6,5,2,1,1,'tblue');
  F(1,30,1,6,1,6,'black');F(3,31,3,2,6,2,'tyellow');F(2,37,2,4,1,4,'red');K('c2x2',3,38,3,0,'red')}},
{n:'Ponte suspensa',cat:'Construções',f:({F,B})=>{F(0,12,0,24,1,4,'lgray');F(0,13,0,24,1,1,'white');F(0,13,3,24,1,1,'white');
  [3,19].forEach(x=>{B(x,0,0,2,4,4,'dgray');B(x-2,3,0,2,1,4,'dgray');B(x+2,3,0,2,1,4,'dgray');[0,3].forEach(z=>F(x,13,z,2,15,1,'red'));F(x,28,0,2,1,4,'red')});
  for(let i=0;i<7;i++)[0,3].forEach(z=>{F(5+i,25-2*i,z,1,2,1,'dred');F(18-i,25-2*i,z,1,2,1,'dred')});
  for(let i=0;i<3;i++)[0,3].forEach(z=>{F(2-i,24-5*i,z,1,4,1,'dred');F(21+i,24-5*i,z,1,4,1,'dred')})}},
{n:'Arranha-céu',cat:'Construções',f:({B})=>{B(0,0,0,8,1,8,'dgray');for(let i=0;i<12;i++)B(1,1+i,1,6,1,6,i%3===2?'lgray':'tblue');
  [[1,1],[6,1],[1,6],[6,6]].forEach(([x,z])=>B(x,1,z,1,12,1,'lgray'));B(3,1,6,2,1,1,'black');
  B(1,13,1,6,1,6,'lgray');B(2,14,2,4,1,4,'dgray');B(3,15,3,1,4,1,'lgray');B(3,19,3,1,1,1,'red')}},
{n:'Moinho de vento',cat:'Construções',f:({B})=>{B(0,0,0,6,3,6,'white');B(1,3,1,4,5,4,'white');B(1,8,1,4,1,4,'dred');B(2,9,2,2,1,2,'dred');
  B(2,0,5,2,2,1,'brown');B(3,5,4,2,1,1,'tblue');B(2,7,5,1,1,2,'dgray');
  B(2,8,6,1,5,1,'tan');B(2,2,6,1,5,1,'tan');B(-3,7,6,5,1,1,'tan');B(3,7,6,5,1,1,'tan')}},
{n:'Pirâmide',cat:'Construções',f:({B})=>{for(let i=0;i<6;i++)B(i,i,i,12-2*i,1,12-2*i,i===5?'gold':'tan');B(5,0,11,2,1,1,'black')}},
{n:'Pagode',cat:'Construções',f:({F,B})=>{for(let t=0;t<3;t++){const s=8-2*t,y=t*4;B(t+1,y,t+1,s-2,3,s-2,'red');
    F(t-1,y*3+9,t-1,s+2,1,s+2,'dgray');F(t,y*3+10,t,s,2,s,'dgray');B(t+1,y+1,t+s-2,s-2,1,1,'white')}
  B(3,0,6,2,2,1,'dbrown');B(3,12,3,2,1,2,'gold');B(3,13,3,1,2,1,'gold')}},

{n:'Carro',cat:'Veículos',f:({F,B})=>{[1,6].forEach(x=>[0,3].forEach(z=>B(x,0,z,2,1,1,'black')));B(0,0,1,9,1,2,'dgray');
  B(0,1,0,9,1,4,'red');B(2,2,0,5,1,4,'tblue');F(2,9,0,5,1,4,'red');
  [0,3].forEach(z=>{F(8,3,z,1,2,1,'yellow');F(0,3,z,1,2,1,'tred')})}},
{n:'Caminhão',cat:'Veículos',f:({F,B})=>{[1,7,10].forEach(x=>[0,4].forEach(z=>B(x,0,z,2,1,1,'black')));B(0,0,1,14,1,3,'dgray');F(0,3,0,14,1,5,'dgray');
  F(0,4,0,9,12,5,'azure');F(0,9,0,9,2,5,'white');F(10,4,0,4,9,5,'red');
  F(13,8,1,1,4,3,'tblue');[0,4].forEach(z=>{F(11,8,z,2,4,1,'tblue');F(13,4,z,1,2,1,'yellow')})}},
{n:'Ônibus escolar',cat:'Veículos',f:({F,B})=>{[2,10].forEach(x=>[0,4].forEach(z=>B(x,0,z,2,1,1,'black')));B(0,0,1,14,1,3,'dgray');
  F(0,3,0,14,4,5,'yellow');F(0,5,0,14,1,5,'black');F(0,7,0,14,4,5,'tblue');[0,3,6,9,12].forEach(x=>F(x,7,0,1,4,5,'yellow'));
  F(0,11,0,14,2,5,'yellow');F(11,3,4,1,8,1,'dgray');[0,4].forEach(z=>{F(13,3,z,1,2,1,'white');F(0,3,z,1,2,1,'tred')})}},
{n:'Locomotiva',cat:'Veículos',f:({F,B,K})=>{[1,4,8].forEach(x=>[0,3].forEach(z=>B(x,0,z,2,1,1,'black')));B(0,0,1,11,1,2,'dgray');B(0,1,0,11,1,4,'red');
  B(0,2,0,4,4,4,'red');B(1,4,0,2,1,4,'tblue');F(-1,18,-1,6,1,6,'black');
  B(4,2,0,6,2,4,'black');B(4,4,1,6,1,2,'black');B(8,5,1,2,2,2,'dgray');F(8,21,1,2,1,2,'gold');B(5,5,1,2,1,2,'gold');
  B(10,2,1,1,1,2,'yellow');K('s2x2',11,0,0,1,'dgray');K('s2x2',11,0,2,1,'dgray')}},
{n:'Avião',cat:'Veículos',f:({F,B})=>{B(0,1,5,14,2,2,'white');B(14,1,5,2,1,2,'lgray');B(11,2,5,2,1,2,'tblue');F(0,5,5,11,1,2,'blue');
  F(5,3,0,4,2,5,'red');F(5,3,7,4,2,5,'red');F(0,6,3,2,1,2,'red');F(0,6,7,2,1,2,'red');B(0,3,5,2,1,2,'red');B(0,4,5,1,1,2,'red');
  B(6,0,2,2,1,1,'dgray');B(6,0,9,2,1,1,'dgray');B(11,0,5,1,1,2,'black');B(4,0,5,1,1,2,'black')}},
{n:'Helicóptero',cat:'Veículos',f:({F,B})=>{[0,4].forEach(z=>{F(0,0,z,7,1,1,'dgray');F(1,1,z,1,2,1,'dgray');F(5,1,z,1,2,1,'dgray')});
  B(0,1,0,6,3,5,'red');B(4,2,0,2,2,5,'tblue');B(6,1,1,1,2,3,'tblue');B(-6,3,2,6,1,1,'red');B(-6,4,2,1,2,1,'red');F(-6,12,3,1,3,1,'white');
  B(2,4,2,1,1,1,'dgray');F(-4,15,2,13,1,1,'black');F(2,15,-4,1,1,13,'black')}},
{n:'Veleiro',cat:'Veículos',f:({F,B})=>{B(2,0,1,9,1,3,'brown');B(1,1,0,11,1,5,'brown');B(12,1,1,1,1,3,'brown');B(13,1,2,1,1,1,'brown');F(1,5,0,11,1,5,'white');
  B(6,2,2,1,9,1,'dbrown');for(let i=0;i<6;i++)B(7,3+i,2,6-i,1,1,'white');for(let i=0;i<4;i++)B(2+i,3+i,2,4-i,1,1,'sky');F(7,31,2,2,2,1,'red')}},
{n:'Foguete',cat:'Veículos',f:({B,K})=>{B(0,0,3,2,3,2,'red');B(6,0,3,2,3,2,'red');B(3,0,0,2,3,2,'red');B(3,0,6,2,3,2,'red');
  K('s2x2',0,9,3,3,'red');K('s2x2',6,9,3,1,'red');K('s2x2',3,9,0,2,'red');K('s2x2',3,9,6,0,'red');
  B(3,0,3,2,1,2,'dgray');B(2,1,2,4,10,4,'white');B(2,5,2,4,1,4,'red');B(2,9,2,4,1,4,'red');B(3,7,5,2,1,1,'tblue');
  B(3,11,3,2,2,2,'red');K('c2x2',3,39,3,0,'red')}},
{n:'Disco voador',cat:'Veículos',f:({F,K})=>{const disc=(y,h,r,c)=>{for(let x=0;x<12;x++)for(let z=0;z<12;z++)if((x-5.5)**2+(z-5.5)**2<=r*r)F(x,y,z,1,h,1,c)};
  [[2,2],[9,2],[2,9],[9,9]].forEach(([x,z])=>F(x,0,z,1,7,1,'dgray'));
  disc(6,1,4.3,'dgray');disc(7,2,6.3,'lgray');disc(9,1,5.3,'lgray');disc(10,3,3.3,'tblue');disc(13,3,2.2,'tblue');F(5,10,5,2,3,2,'lime');
  for(let x=0;x<12;x++)for(let z=0;z<12;z++){const r=(x-5.5)**2+(z-5.5)**2;if(r>5.3*5.3&&r<=6.3*6.3&&(x+z)%2===0)K('rp1x1',x,9,z,0,(x+z)%4?'tyellow':'tred')}}},

{n:'Robô',cat:'Diversão',f:({B})=>{[0,4].forEach(x=>{B(x,0,0,2,1,3,'dgray');B(x,1,0,2,3,2,'lgray')});B(0,4,0,6,1,2,'dgray');B(0,5,0,6,4,3,'azure');
  B(2,7,2,1,1,1,'red');B(3,7,2,1,1,1,'yellow');B(2,6,2,2,1,1,'tgreen');
  [-2,6].forEach(x=>{B(x,5,0,2,4,2,'lgray');B(x,4,0,2,1,2,'red')});B(2,9,0,2,1,2,'dgray');B(1,10,0,4,3,3,'lgray');
  B(1,11,2,1,1,1,'tblue');B(4,11,2,1,1,1,'tblue');B(2,10,2,2,1,1,'black');[1,4].forEach(x=>{B(x,13,1,1,1,1,'dgray');B(x,14,1,1,1,1,'red')})}},
{n:'Boneco de neve',cat:'Diversão',f:({F,B})=>{B(1,0,1,6,1,6,'white');B(0,1,0,8,3,8,'white');B(1,4,1,6,1,6,'white');B(1,5,1,6,2,6,'white');
  B(2,7,2,4,1,4,'red');B(2,8,2,4,3,4,'white');B(2,10,5,1,1,1,'black');B(5,10,5,1,1,1,'black');F(3,28,6,2,2,1,'orange');
  B(4,5,6,1,1,1,'black');B(4,3,7,1,1,1,'black');F(1,33,1,6,1,6,'black');F(2,34,2,4,6,4,'black');F(2,34,2,4,1,4,'red');
  B(-2,6,3,3,1,1,'brown');B(7,6,3,3,1,1,'brown')}},
{n:'Bolo de aniversário',cat:'Diversão',f:({F,B,K})=>{B(0,0,0,8,2,8,'tan');F(0,6,0,8,1,8,'pink');F(2,7,2,4,5,4,'tan');F(2,12,2,4,1,4,'white');
  [[2,2,'azure'],[5,2,'yellow'],[2,5,'lime'],[5,5,'magenta']].forEach(([x,z,c])=>{K('r1x1',x,13,z,0,c);K('c1x1',x,16,z,0,'orange')});
  [[0,0],[7,0],[0,7],[7,7],[3,7],[4,0],[0,3],[7,4]].forEach(([x,z])=>K('rp1x1',x,7,z,0,'red'))}},
{n:'Coração',cat:'Diversão',f:({ART})=>ART([' rr rr ','rwrrrrr','rrrrrrr',' rrrrr ','  rrr  ','   r   '],{r:'red',w:'pink'},0,0,0,2)},
{n:'Arco-íris',cat:'Diversão',f:({B})=>{const cs=['red','orange','yellow','green','blue','purple'];
  for(let x=-9;x<=9;x++)for(let y=0;y<=9;y++){const i=Math.floor(9.5-Math.hypot(x,y*1.1));if(i>=0&&i<6)B(x,y,0,1,1,2,cs[i])}
  B(-11,0,-1,5,2,4,'white');B(-10,2,0,3,1,2,'white');B(7,0,-1,5,2,4,'white');B(8,2,0,3,1,2,'white')}},
{n:'Alienígena pixel',cat:'Diversão',f:({ART})=>ART(['  g     g  ','   g   g   ','  ggggggg  ',' gg ggg gg ','ggggggggggg','g ggggggg g','g g     g g','   gg gg   '],{g:'lime'},0,0,0,1)},

{n:'Cachorro',cat:'Animais',f:({F,B})=>{[0,5].forEach(x=>[0,2].forEach(z=>B(x,0,z,1,2,1,'brown')));B(0,2,0,6,2,3,'brown');B(1,2,0,3,1,3,'white');
  B(5,4,0,3,2,3,'brown');F(8,12,0,1,3,3,'tan');B(8,4,1,1,1,1,'black');B(5,6,0,1,1,1,'dbrown');B(5,6,2,1,1,1,'dbrown');
  B(7,5,0,1,1,1,'black');B(7,5,2,1,1,1,'black');B(-1,3,1,1,2,1,'brown');F(4,12,0,1,1,3,'red')}},
{n:'Gato',cat:'Animais',f:({B})=>{[0,5].forEach(x=>[0,2].forEach(z=>B(x,0,z,1,1,1,'orange')));B(0,1,0,6,2,3,'orange');B(1,1,0,1,2,3,'gold');B(3,1,0,1,2,3,'gold');
  B(4,3,0,3,2,3,'orange');B(5,5,0,1,1,1,'orange');B(5,5,2,1,1,1,'orange');B(6,4,0,1,1,1,'lime');B(6,4,2,1,1,1,'lime');B(6,3,1,1,1,1,'pink');
  B(-1,2,1,1,3,1,'orange');B(-2,4,1,1,1,1,'white')}},
{n:'Patinho',cat:'Animais',f:({F,B})=>{B(2,0,0,2,1,1,'orange');B(2,0,3,2,1,1,'orange');B(0,1,0,6,2,4,'yellow');B(3,3,0,3,2,4,'yellow');
  B(5,4,0,1,1,1,'black');B(5,4,3,1,1,1,'black');F(6,9,1,2,2,2,'orange');B(-1,2,1,1,1,2,'yellow');B(1,1,-1,3,1,1,'gold');B(1,1,4,3,1,1,'gold')}},
{n:'Girafa',cat:'Animais',f:({B})=>{[0,4].forEach(x=>[0,2].forEach(z=>B(x,0,z,1,4,1,'yellow')));B(0,4,0,5,2,3,'yellow');B(4,6,1,1,5,1,'yellow');
  B(4,11,0,3,2,3,'yellow');B(6,11,0,1,1,3,'tan');B(4,13,0,1,1,1,'brown');B(4,13,2,1,1,1,'brown');B(6,12,0,1,1,1,'black');B(6,12,2,1,1,1,'black');
  [[1,5,0],[3,4,0],[2,5,2],[0,4,2],[4,8,1],[2,5,1]].forEach(([x,y,z])=>B(x,y,z,1,1,1,'brown'));B(-1,4,1,1,2,1,'brown')}},
{n:'Elefante',cat:'Animais',f:({B})=>{[0,5].forEach(x=>[0,4].forEach(z=>B(x,0,z,2,2,2,'lgray')));B(0,2,0,7,4,6,'lgray');B(7,3,1,3,4,4,'lgray');
  B(7,4,0,2,3,1,'dgray');B(7,4,5,2,3,1,'dgray');B(10,1,2,1,4,2,'lgray');B(11,1,2,1,1,2,'lgray');B(10,3,1,1,1,1,'white');B(10,3,4,1,1,1,'white');
  B(9,6,1,1,1,1,'black');B(9,6,4,1,1,1,'black');B(-1,3,3,1,2,1,'dgray')}},
{n:'Dinossauro',cat:'Animais',f:({F,B})=>{[0,3].forEach(z=>{B(3,0,z,2,3,1,'green');B(5,0,z,1,1,1,'green')});B(1,3,0,6,3,4,'green');B(2,3,1,4,1,2,'lime');
  B(-2,3,1,3,2,2,'green');B(-5,3,1,3,1,2,'green');B(-7,3,1,2,1,1,'green');B(6,6,1,2,2,2,'green');B(6,8,0,5,2,4,'green');
  B(8,6,1,3,1,2,'green');F(8,21,1,3,1,2,'white');B(9,9,0,1,1,1,'yellow');B(9,9,3,1,1,1,'yellow');
  B(7,4,-1,2,1,1,'green');B(7,4,4,2,1,1,'green');[1,3,5].forEach(x=>B(x,6,2,1,1,1,'dgreen'))}},
{n:'Pinguim',cat:'Animais',f:({F,B})=>{B(1,0,0,2,1,4,'black');B(0,0,2,1,1,3,'orange');B(3,0,2,1,1,3,'orange');B(0,1,0,4,5,4,'black');B(1,1,3,2,4,1,'white');
  B(0,5,3,1,1,1,'white');B(3,5,3,1,1,1,'white');F(1,13,4,2,2,1,'orange');B(-1,2,1,1,3,2,'black');B(4,2,1,1,3,2,'black')}},
{n:'Tartaruga',cat:'Animais',f:({F,B})=>{[0,5].forEach(x=>[0,5].forEach(z=>B(x,0,z,2,1,2,'lime')));B(0,1,0,7,1,7,'dgreen');B(1,2,1,5,1,5,'green');F(2,9,2,3,1,3,'dgreen');
  B(7,1,2,2,1,3,'lime');B(8,1,2,1,1,1,'black');B(8,1,4,1,1,1,'black');B(-1,1,3,1,1,1,'lime')}},
{n:'Peixe-palhaço',cat:'Animais',f:({ART})=>ART(['   oooo   ','  owoowo o',' oowoowooo','ookwoowoo ',' oowoowooo','  owoowo o','   oooo   '],{o:'orange',w:'white',k:'black'},0,0,0,2)},

{n:'Árvore',cat:'Natureza',f:({B})=>{B(2,0,2,2,3,2,'brown');B(0,3,1,6,3,4,'green');B(1,3,0,4,3,6,'green');B(1,6,1,4,1,4,'lime');
  B(0,4,2,1,1,1,'red');B(4,5,5,1,1,1,'red');B(5,3,3,1,1,1,'red');B(2,4,0,1,1,1,'red')}},
{n:'Pinheiro',cat:'Natureza',f:({F,B})=>{B(3,0,3,2,2,2,'brown');[8,6,6,4,4,2,2].forEach((s,i)=>B((8-s)/2,2+i,(8-s)/2,s,1,s,i%2?'green':'dgreen'));F(3,27,3,2,1,2,'yellow')}},
{n:'Flor no vaso',cat:'Natureza',f:({B,ART})=>{B(2,0,-1,3,2,3,'dred');B(3,2,0,1,4,1,'green');B(2,3,0,1,1,1,'lime');B(4,4,0,1,1,1,'lime');
  ART([' ppp ','ppypp','pyyyp','ppypp',' ppp '],{p:'pink',y:'yellow'},1,6,0,1)}},
{n:'Cacto',cat:'Natureza',f:({F,B})=>{B(1,0,0,4,2,4,'orange');B(2,2,1,2,6,2,'green');B(0,4,1,2,1,2,'green');B(0,5,1,1,2,2,'green');
  B(4,5,1,2,1,2,'green');B(5,6,1,1,2,2,'green');F(2,24,1,2,1,2,'pink')}},
{n:'Cogumelo',cat:'Natureza',f:({F,B})=>{B(2,0,2,2,3,2,'white');B(0,3,0,6,1,6,'red');B(1,4,1,4,1,4,'red');F(2,15,2,2,1,2,'red');
  [[1,3,5],[4,3,5],[5,3,2],[0,3,3],[2,3,0],[2,4,4],[4,4,2]].forEach(([x,y,z])=>B(x,y,z,1,1,1,'white'))}}
];
MODELS.forEach((m,i)=>{m.id=i});
const modelData=m=>m.data||(m.data=buildModel(m.f));

/* ---------- seleção com o mouse ---------- */
const ray=new THREE.Raycaster(),ndc=new THREE.Vector2(),gplane=new THREE.Plane(new THREE.Vector3(0,1,0),0);
function pick(cx,cy){const r=cv.getBoundingClientRect();ndc.set((cx-r.left)/r.width*2-1,-((cy-r.top)/r.height*2-1));ray.setFromCamera(ndc,camera);
  const h=ray.intersectObjects(brickGroup.children,false)[0];
  if(h&&h.face)return {piece:h.object.userData.p,point:h.point,normal:h.face.normal.clone().applyQuaternion(h.object.quaternion)};
  const p=new THREE.Vector3();return ray.ray.intersectPlane(gplane,p)?{point:p}:null}
function hitCell(hit,h){let cx,cz,y=0,nx=0,nz=0;
  if(hit.piece){const n=hit.normal,q=hit.point.clone().addScaledVector(n,.05),hp=hit.piece,top=hp.y+TYPES[hp.t].h;
    cx=Math.floor(q.x);cz=Math.floor(q.z);
    if(n.y>.3||q.y>=top*PH-.01)y=top;else if(n.y<-.5)y=Math.max(0,hp.y-h);else{y=hp.y;nx=Math.round(n.x);nz=Math.round(n.z)}}
  else{cx=Math.floor(hit.point.x);cz=Math.floor(hit.point.z)}
  return {cx,cz,y,nx,nz}}
function placement(hit){const t=TYPES[S.type],r=normR(t,S.rot),[W,D]=fp(t,r),c=hitCell(hit,t.h);
  const p={t:S.type,x:c.cx-((W-1)>>1),y:c.y,z:c.cz-((D-1)>>1),r,c:S.color};
  if(canPlace(p))return p;
  if(c.nx||c.nz)for(let s=1;s<=8;s++){const q={...p,x:p.x+c.nx*s,z:p.z+c.nz*s};if(canPlace(q))return q}
  for(let u=1;u<=90;u++){const q={...p,y:p.y+u};if(canPlace(q))return q}
  return null}

const ghost=new THREE.Mesh(geo('b2x4'),ghostMat('red'));ghost.visible=false;scene.add(ghost);
const hl=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.4,depthWrite:false}));hl.visible=false;scene.add(hl);
const nextGhost=new THREE.Mesh(geo('b2x4'),new THREE.MeshBasicMaterial({color:0xffffff,transparent:true,opacity:.6,depthWrite:false}));nextGhost.visible=false;scene.add(nextGhost);
function poseMesh(m,p){const t=TYPES[p.t],[W,D]=fp(t,p.r);m.geometry=geo(p.t);m.position.set(p.x+W/2,p.y*PH,p.z+D/2);m.rotation.y=p.r*Math.PI/2}
function hideHover(){ghost.visible=false;hl.visible=false;if(stamp)stamp.group.visible=false}
let hoverXY=null;
function updateHover(){hideHover();if(!hoverXY)return;const hit=pick(hoverXY[0],hoverXY[1]);if(!hit)return;
  if(stamp){const a=stampAnchor(hit);if(a){stamp.group.position.set(a.x,a.y*PH,a.z);stamp.group.visible=true}return}
  if(S.tool==='build'){const p=placement(hit);if(p){poseMesh(ghost,p);ghost.material=ghostMat(p.c);ghost.visible=true}}
  else if(hit.piece){const p=hit.piece,t=TYPES[p.t],[W,D]=fp(t,p.r);hl.scale.set(W+.08,t.h*PH+.25,D+.08);hl.position.set(p.x+W/2,p.y*PH+t.h*PH/2+.06,p.z+D/2);
    hl.material.color.set(S.tool==='erase'?0xff3030:S.tool==='paint'?CMAP[S.color].hex:0xffffff);hl.visible=true}}

/* ---------- ações ---------- */
function clickAt(x,y,btn){const hit=pick(x,y);if(!hit)return;
  if(btn===2){if(hit.piece)erase(hit.piece);return}
  if(stamp){const a=stampAnchor(hit);if(a)placeStamp(a);return}
  if(S.tool==='build'){const p=placement(hit);if(!p)return;uAdd(p,true);commit({add:[p]});snd(540)}
  else if(!hit.piece)return;
  else if(S.tool==='erase')erase(hit.piece);
  else if(S.tool==='paint'){const p=hit.piece;if(p.c===S.color)return;const from=p.c;uPaint(p,S.color);commit({paint:[{p,from,to:S.color}]});snd(700)}
  else if(S.tool==='pick'){const p=hit.piece;S.type=p.t;S.rot=p.r;setColor(p.c);S.tab=Object.keys(CATS).find(k=>CATS[k].includes(p.t));setTool('build');renderPieces();toast('Copiado: '+TYPES[p.t].name+' '+CMAP[p.c].name.toLowerCase())}
  if(hoverXY)updateHover()}
function erase(p){uDel(p);commit({rem:[p]});snd(240);if(hoverXY)updateHover()}

/* ---------- modelos: posicionar e montar ---------- */
let stamp=null,guide=null;
function startStamp(model,mode){cancelStamp();stopGuide();stamp={model,mode,rot:0,group:new THREE.Group()};scene.add(stamp.group);buildStampGroup();closeGallery();renderStatus();
  toast('Clique no chão para posicionar o modelo')}
function buildStampGroup(){const g=stamp.group;while(g.children.length)g.remove(g.children[0]);
  stamp.data=rotated(modelData(stamp.model),stamp.rot);
  stamp.data.pieces.forEach(p=>{const m=new THREE.Mesh(geo(p.t),ghostMat(p.c));poseMesh(m,p);g.add(m)});g.visible=false}
function cancelStamp(){if(!stamp)return;scene.remove(stamp.group);stamp=null;renderStatus()}
function stampAnchor(hit){const d=stamp.data,c=hitCell(hit,0),x=c.cx-(d.size[0]>>1),z=c.cz-(d.size[2]>>1);
  for(let y=c.y;y<c.y+120;y++){if(d.pieces.every(p=>canPlace({...p,x:p.x+x,y:p.y+y,z:p.z+z})))return {x,y,z}}return null}
function placeStamp(a){const d=stamp.data,list=d.pieces.map(p=>({t:p.t,x:p.x+a.x,y:p.y+a.y,z:p.z+a.z,r:p.r,c:p.c})),m=stamp.model,mode=stamp.mode;
  cancelStamp();
  cam.target.set(a.x+d.size[0]/2,(a.y+d.size[1]/2)*PH,a.z+d.size[2]/2);cam.dist=clamp(Math.max(d.size[0],d.size[2],d.size[1]*PH)*2.6,16,110);
  if(mode==='instant'){list.forEach((p,i)=>{uAdd(p,true);p.t0+=Math.min(i*6,900)});commit({add:list});snd(540);toast(m.n+' colocado: '+list.length+' peças')}
  else{guide={model:m,list,i:0,auto:false,last:0,speed:140};renderStatus()}}
function guideNext(){if(!guide)return;
  while(guide.i<guide.list.length){const p=guide.list[guide.i++];if(uAdd(p,true)){commit({add:[p]});snd(480+(guide.i%5)*40);break}}
  if(guide.i>=guide.list.length){const n=guide.model.n;stopGuide();toast(n+' pronto!');snd(880)}else renderStatus()}
function guideFinish(){if(!guide)return;const rest=guide.list.slice(guide.i).filter(p=>uAdd(p,true));if(rest.length)commit({add:rest});const n=guide.model.n;stopGuide();toast(n+' pronto!');snd(880)}
function stopGuide(){guide=null;nextGhost.visible=false;renderStatus()}
function renderStatus(){const s=$('#status');
  if(stamp){s.hidden=false;s.innerHTML=`<div class="txt"><b>${stamp.model.n}</b><span>Clique onde quer ${stamp.mode==='guide'?'montar':'colocar'}.</span></div><div class="row"><button class="btn" data-a="rot">Girar <kbd>R</kbd></button><button class="btn" data-a="cancel">Cancelar</button></div>`}
  else if(guide){const p=guide.list[guide.i],n=guide.list.length;s.hidden=false;
    s.innerHTML=`<div class="txt"><b>${guide.model.n}: peça ${guide.i+1} de ${n}</b><span>${TYPES[p.t].name}, ${CMAP[p.c].name.toLowerCase()}</span><div class="bar"><i style="width:${guide.i/n*100}%"></i></div></div>
    <div class="row"><button class="btn sun" data-a="next">Encaixar <kbd>Espaço</kbd></button><button class="btn" data-a="auto" aria-pressed="${guide.auto}">${guide.auto?'Pausar':'Automático'}</button><button class="btn" data-a="finish">Terminar tudo</button><button class="btn" data-a="stop">Parar</button></div>`;
    poseMesh(nextGhost,p);nextGhost.material.color.set(CMAP[p.c].hex);nextGhost.visible=true}
  else s.hidden=true}
$('#status').addEventListener('click',e=>{const b=e.target.closest('[data-a]');if(!b)return;const a=b.dataset.a;
  if(a==='rot')rotate();else if(a==='cancel')cancelStamp();else if(a==='next')guideNext();else if(a==='finish')guideFinish();else if(a==='stop')stopGuide();
  else if(a==='auto'){guide.auto=!guide.auto;renderStatus()}});

/* ---------- galeria ---------- */
let galCat='Todos',thumbQ=null;
function openGallery(){$('#gallery').hidden=false;$('#menu').hidden=true;renderGallery()}
function closeGallery(){$('#gallery').hidden=true}
function renderGallery(){const cats=['Todos',...new Set(MODELS.map(m=>m.cat))],C=$('#cats'),G=$('#grid');C.innerHTML='';G.innerHTML='';
  cats.forEach(c=>{const b=el('button','btn',c+(c==='Todos'?` (${MODELS.length})`:''));b.setAttribute('aria-pressed',c===galCat);b.onclick=()=>{galCat=c;renderGallery()};C.append(b)});
  const need=[];
  MODELS.filter(m=>galCat==='Todos'||m.cat===galCat).forEach(m=>{const d=modelData(m),n=d.pieces.length;
    const card=el('div','card'),th=el('div','th'),img=el('img');img.alt=m.n;if(m.thumb)img.src=m.thumb;else need.push([m,img]);th.append(img);
    const row=el('div','row'),b1=el('button','btn sun','Montar'),b2=el('button','btn','Colocar');
    b1.title='Montar peça por peça';b2.title='Colocar o modelo pronto';b1.onclick=()=>startStamp(m,'guide');b2.onclick=()=>startStamp(m,'instant');row.append(b1,b2);
    card.append(th,el('h3','',m.n),el('small','',`${n} peças · ${n<45?'fácil':n<110?'médio':'grande'}`),row);G.append(card)});
  thumbQ=need;if(need.length)setTimeout(thumbStep,30)}
let tr=null;
function thumbStep(){if(!thumbQ||!thumbQ.length||$('#gallery').hidden)return;const [m,img]=thumbQ.shift();
  try{if(!tr){const r=new THREE.WebGLRenderer({antialias:true,alpha:true,preserveDrawingBuffer:true});r.setSize(320,240,false);r.setClearColor(0,0);
      const sc=new THREE.Scene();sc.add(new THREE.HemisphereLight(0xffffff,0x90908a,.8));const dl=new THREE.DirectionalLight(0xffffff,.7);dl.position.set(3,6,4);sc.add(dl);
      const g=new THREE.Group();sc.add(g);tr={r,sc,g,cam:new THREE.PerspectiveCamera(30,4/3,.5,500)}}
    const d=modelData(m),g=tr.g;while(g.children.length)g.remove(g.children[0]);
    d.pieces.forEach(p=>{const me=new THREE.Mesh(geo(p.t),mat(p.c));poseMesh(me,p);g.add(me)});
    const c=new THREE.Vector3(d.size[0]/2,d.size[1]*PH/2,d.size[2]/2),R=Math.hypot(d.size[0],d.size[1]*PH,d.size[2])/2;
    tr.cam.position.copy(c).add(new THREE.Vector3(.75,.62,1).normalize().multiplyScalar(R/Math.sin(.24)));tr.cam.lookAt(c);
    tr.r.render(tr.sc,tr.cam);m.thumb=tr.r.domElement.toDataURL('image/png');img.src=m.thumb}catch(e){}
  setTimeout(thumbStep,16)}

/* ---------- interface ---------- */
function toast(t){const e=$('#toast');e.textContent=t;e.classList.add('on');clearTimeout(toast.t);toast.t=setTimeout(()=>e.classList.remove('on'),2600)}
function setTool(t){S.tool=t;document.querySelectorAll('[data-tool]').forEach(b=>b.setAttribute('aria-pressed',b.dataset.tool===t));cv.style.cursor=t==='build'?'crosshair':'pointer';if(hoverXY)updateHover()}
function setColor(c){S.color=c;$('#pieces').style.setProperty('--cur',CMAP[c].hex);document.querySelectorAll('.sw').forEach(b=>b.setAttribute('aria-pressed',b.dataset.c===c));if(hoverXY)updateHover()}
function rotate(){if(stamp){stamp.rot=(stamp.rot+1)%4;buildStampGroup()}else S.rot=(S.rot+1)%4;snd(380);if(hoverXY)updateHover()}
function icon(t){const u=9,cols=t.d,rows=t.w,W=cols*u,H=rows*u;let s=`<svg viewBox="-1 -1 ${W+2} ${H+2}" width="${Math.min(W*2,76)}" aria-hidden="true">`;
  const round=t.shape==='round'||t.shape==='cone';
  s+=round?`<ellipse cx="${W/2}" cy="${H/2}" rx="${W/2}" ry="${H/2}" fill="var(--cur)" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`:`<rect width="${W}" height="${H}" rx="1.4" fill="var(--cur)" stroke="rgba(0,0,0,.35)" stroke-width=".6"/>`;
  if(t.shape==='slope')s+=`<rect x="${u}" width="${W-u}" height="${H}" rx="1.4" fill="rgba(0,0,0,.22)"/>`;
  if(t.shape==='cone')s+=`<circle cx="${W/2}" cy="${H/2}" r="2.8" fill="rgba(255,255,255,.35)" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`;
  else if(t.shape!=='tile')for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){if(t.shape==='slope'&&i>0)continue;s+=`<circle cx="${i*u+u/2}" cy="${j*u+u/2}" r="2.8" fill="rgba(255,255,255,.3)" stroke="rgba(0,0,0,.3)" stroke-width=".5"/>`}
  if(t.h===1)s+=`<rect x="0" y="${H-1.6}" width="${W}" height="1.6" fill="rgba(0,0,0,.18)"/>`;
  return s+'</svg>'}
function renderPieces(){const T=$('#tabs'),L=$('#plist');T.innerHTML='';L.innerHTML='';
  Object.keys(CATS).forEach(c=>{const b=el('button','btn',c);b.setAttribute('aria-pressed',c===S.tab);b.onclick=()=>{S.tab=c;renderPieces()};T.append(b)});
  CATS[S.tab].forEach(id=>{const t=TYPES[id],b=el('button','pc',icon(t)+`<span>${t.name}</span>`);b.setAttribute('aria-pressed',id===S.type);
    b.onclick=()=>{S.type=id;cancelStamp();setTool('build');renderPieces()};L.append(b)})}
(function renderColors(){const C=$('#colors');COLORS.forEach(c=>{const b=el('button','sw'+(c[3]?' tr':''));b.style.backgroundColor=c[2];b.dataset.c=c[0];b.title=c[1];b.setAttribute('aria-label',c[1]);b.setAttribute('aria-pressed','false');
  b.onclick=()=>setColor(c[0]);C.append(b)})})();
const touch=matchMedia('(pointer:coarse)').matches;
$('#helpList').innerHTML=(touch?['Toque no chão ou numa peça para encaixar.','Arraste com um dedo para girar a câmera.','Use dois dedos para aproximar e mover.','O chão não tem fim: construa em qualquer direção.']
  :['<b>Clique</b> para encaixar a peça escolhida.','<b>Arraste</b> para girar a câmera; <b>botão direito</b> ou <b>Shift</b> + arrastar para mover.','<b>Roda do mouse</b> aproxima; <b>W A S D</b> passeia pelo chão sem fim.','<b>R</b> gira a peça. Clique com o <b>botão direito</b> numa peça para removê-la.','<b>Ctrl+Z</b> desfaz. Tudo fica salvo neste navegador.']).map(t=>`<li>${t}</li>`).join('');

document.querySelectorAll('[data-tool]').forEach(b=>b.onclick=()=>{cancelStamp();setTool(b.dataset.tool)});
$('#rot').onclick=rotate;$('#undo').onclick=undo;$('#redo').onclick=redo;
$('#openModels').onclick=openGallery;$('#closeGallery').onclick=closeGallery;
$('#gallery').addEventListener('pointerdown',e=>{if(e.target.id==='gallery')closeGallery()});
$('#more').onclick=()=>{const m=$('#menu');m.hidden=!m.hidden;$('#more').setAttribute('aria-expanded',!m.hidden)};
$('#home').onclick=()=>{cam.target.set(0,2,0);cam.dist=36;cam.az=Math.PI*.3;cam.pol=1;$('#menu').hidden=true};
$('#sound').onclick=()=>{SET.som=!SET.som;saveSet();$('#sound').textContent='Som: '+(SET.som?'ligado':'desligado');snd(600)};
$('#openSync').onclick=$('#syncChip').onclick=()=>{$('#menu').hidden=true;Sync.open()};
$('#export').onclick=()=>{$('#menu').hidden=true;const a=el('a');a.href=URL.createObjectURL(new Blob([JSON.stringify(payload())],{type:'application/json'}));a.download='blocos-sem-fim-backup.json';a.click();setTimeout(()=>URL.revokeObjectURL(a.href),5000)};
$('#import').onclick=()=>{$('#menu').hidden=true;$('#filepick').click()};
$('#filepick').onchange=async e=>{const f=e.target.files[0];e.target.value='';if(!f)return;
  try{const d=JSON.parse(await f.text());if(!d||d.app!=='blocos-sem-fim')throw 0;toast(merge(d)?'Backup importado.':'Nada de novo neste backup.');if(BSF.onChange)BSF.onChange()}catch(_){toast('Este arquivo não é um backup do Blocos Sem Fim.')}};
$('#showHelp').onclick=()=>{$('#help').hidden=false;$('#menu').hidden=true};
$('#closeHelp').onclick=()=>{$('#help').hidden=true;try{localStorage.setItem('blocos-ajuda','1')}catch(e){}};
$('#clear').onclick=()=>{$('#menu').hidden=true;stopGuide();cancelStamp();const all=[...pieces];if(!all.length)return;all.forEach(uDel);commit({rem:all});toast('Tudo limpo. Use Desfazer para trazer de volta.')};

/* ---------- controles ---------- */
const ptrs=new Map(),keys=new Set();let drag=null,pinch=null;
const pinchState=()=>{const [a,b]=[...ptrs.values()];return {d:Math.hypot(a.x-b.x,a.y-b.y)||1,mx:(a.x+b.x)/2,my:(a.y+b.y)/2}};
function pan(dx,dy){const k=cam.dist*.0017,ca=Math.cos(cam.az),sa=Math.sin(cam.az);
  // direita = (sa,0,-ca); frente = (-ca,0,-sa): alvo -= direita*dx, alvo += frente*dy
  cam.target.x+=(-sa*dx-ca*dy)*k;cam.target.z+=(ca*dx-sa*dy)*k}
cv.addEventListener('contextmenu',e=>e.preventDefault());
cv.addEventListener('pointerdown',e=>{$('#menu').hidden=true;try{cv.setPointerCapture(e.pointerId)}catch(_){}
  ptrs.set(e.pointerId,{x:e.clientX,y:e.clientY});
  if(ptrs.size===1)drag={x:e.clientX,y:e.clientY,lx:e.clientX,ly:e.clientY,btn:e.button,moved:false,touch:e.pointerType!=='mouse',shift:e.shiftKey};
  else if(ptrs.size===2){if(drag)drag.moved=true;pinch=pinchState();hideHover()}});
cv.addEventListener('pointermove',e=>{const p=ptrs.get(e.pointerId);
  if(!p){if(e.pointerType==='mouse'){hoverXY=[e.clientX,e.clientY];updateHover()}return}
  p.x=e.clientX;p.y=e.clientY;
  if(ptrs.size===2&&pinch){const s=pinchState();cam.dist=clamp(cam.dist*pinch.d/s.d,6,170);pan(s.mx-pinch.mx,s.my-pinch.my);pinch=s;return}
  if(!drag)return;const dx=e.clientX-drag.lx,dy=e.clientY-drag.ly;drag.lx=e.clientX;drag.ly=e.clientY;
  if(!drag.moved&&Math.hypot(e.clientX-drag.x,e.clientY-drag.y)>(drag.touch?10:5)){drag.moved=true;hideHover()}
  if(drag.moved){if(drag.btn===0&&!drag.shift){cam.az+=dx*.006;cam.pol=clamp(cam.pol-dy*.006,.1,1.5)}else pan(dx,dy)}});
function pointerEnd(e,cancel){if(!ptrs.has(e.pointerId))return;ptrs.delete(e.pointerId);if(ptrs.size<2)pinch=null;
  if(ptrs.size===0&&drag){const d=drag;drag=null;if(!cancel&&!d.moved)clickAt(e.clientX,e.clientY,d.btn);
    if(e.pointerType==='mouse'&&!cancel){hoverXY=[e.clientX,e.clientY];updateHover()}}}
cv.addEventListener('pointerup',e=>pointerEnd(e,false));cv.addEventListener('pointercancel',e=>pointerEnd(e,true));
cv.addEventListener('pointerleave',()=>{if(!drag){hoverXY=null;hideHover()}});
cv.addEventListener('wheel',e=>{e.preventDefault();cam.dist=clamp(cam.dist*Math.exp(e.deltaY*.0012),6,170);if(hoverXY)updateHover()},{passive:false});
addEventListener('keydown',e=>{if(e.target.matches('input,textarea'))return;const k=e.key.toLowerCase();
  if((e.ctrlKey||e.metaKey)&&k==='z'){e.preventDefault();e.shiftKey?redo():undo();return}
  if((e.ctrlKey||e.metaKey)&&k==='y'){e.preventDefault();redo();return}
  if(e.ctrlKey||e.metaKey||e.altKey)return;
  if(k==='escape'){if(!$('#gallery').hidden)closeGallery();else if(stamp)cancelStamp();else $('#menu').hidden=true;return}
  if(!$('#gallery').hidden)return;
  if(k==='r')rotate();else if(k==='m')openGallery();
  else if(k===' '){if(guide){e.preventDefault();guideNext()}}
  else if(k==='1')setTool('build');else if(k==='2')setTool('erase');else if(k==='3')setTool('paint');else if(k==='4')setTool('pick');
  else if(['w','a','s','d','arrowup','arrowdown','arrowleft','arrowright'].includes(k)){keys.add(k);e.preventDefault()}});
addEventListener('keyup',e=>keys.delete(e.key.toLowerCase()));addEventListener('blur',()=>keys.clear());

/* ---------- laço ---------- */
let lastT=performance.now();
function frame(now){requestAnimationFrame(frame);const dt=Math.min(.05,(now-lastT)/1000);lastT=now;
  if(keys.size){const v=cam.dist*.9*dt/(.0017*cam.dist);let dx=0,dy=0;
    if(keys.has('a')||keys.has('arrowleft'))dx+=v;if(keys.has('d')||keys.has('arrowright'))dx-=v;
    if(keys.has('w')||keys.has('arrowup'))dy+=v;if(keys.has('s')||keys.has('arrowdown'))dy-=v;pan(dx,dy)}
  anims.forEach(p=>{const k=clamp((now-p.t0)/200,0,1);if(!p.mesh){anims.delete(p);return}p.mesh.position.y=p.y*PH+(1-k)*(1-k)*1.6;if(k>=1)anims.delete(p)});
  if(guide){nextGhost.material.opacity=.45+.3*Math.sin(now*.008);if(guide.auto&&now-guide.last>guide.speed){guide.last=now;guideNext()}}
  updateCamera();renderer.render(scene,camera)}

/* ---------- início ---------- */
renderPieces();setColor('red');
// Primeira vez: uma cena de exemplo. Os ids fixos fazem dois aparelhos novos terem as mesmas peças, sem duplicar.
if(!load()){let n=0;const put=(name,x,z)=>{const d=modelData(MODELS.find(m=>m.n===name));d.pieces.forEach(p=>addPiece({id:'s'+(n++),mod:1,t:p.t,x:p.x+x,y:p.y,z:p.z+z,r:p.r,c:p.c}))};
  put('Casinha',-5,-4);put('Árvore',7,-1);put('Patinho',-2,7);save()}
$('#sound').textContent='Som: '+(SET.som?'ligado':'desligado');
refresh();
try{if('serviceWorker' in navigator&&(location.protocol==='https:'||/^(localhost|127\.0\.0\.1)$/.test(location.hostname)))navigator.serviceWorker.register('sw.js').catch(()=>{})}catch(e){}
let seen=false;try{seen=!!localStorage.getItem('blocos-ajuda')}catch(e){}
$('#help').hidden=seen;
requestAnimationFrame(frame);
})();
