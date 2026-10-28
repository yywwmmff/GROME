import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';

const $=id=>document.getElementById(id);
const rgb=$('rgb'),geometry=$('geometry');
const names={parkour:'Parkour courtyard','snow-dog':'A walk in the snow','truck-pose':'The soapbox run'};
let scenes=[],selected=null,playing=false,sceneToken=0,sceneFrame=-1,viewMode='top';
let renderer,world,camera,controls,sceneGroup,cloudGroup,pathGroup,frustum,marker,pastPath,cameraData,dynamicData;
let currentCloud,pinkCloud,ghostClouds=[],dynamicCache=new Map(),sceneRadius=10;
let worldDirty=true;
let playbackToken=0,autoPreview=true;
let segments=[],activeSegment=-1;
let revisitIndex=0,revisitElements=[];
const inspection={
  parkour:{title:'The courtyard and the athlete.',copy:'Follow the concrete wall and railings as the viewpoint shifts. Toggle the current subject and its fading trail to inspect the athlete separately from the scene.'},
  'snow-dog':{title:'One landscape. Two moving subjects.',copy:'Use the tree line as a spatial reference. Separate the walker and dog from the snow, then inspect their recent motion in the 0.8-second trail.'},
  'truck-pose':{title:'A moving cart. A shared space.',copy:'Track the ramp and houses as the cart crosses the scene. Separate the cart and people from the static background with the viewer layers.'}
};
function buildTrajectory(){
  segments=[];activeSegment=-1;
  const timeline=selected.timeline??[];
  for(let i=1;i<timeline.length;i++){
    const action=timeline[i],signature=JSON.stringify([action.keys,action.look]);
    if(!segments.length||signature!==segments.at(-1).signature)segments.push({start:i,end:i+1,signature,keys:action.keys,look:action.look});
    else segments.at(-1).end=i+1;
  }
  const keyLabels={a:'Move left',d:'Move right',w:'Move forward',s:'Move backward'};
  const keySymbols={a:'←',d:'→',w:'↑',s:'↓'};
  const fragment=document.createDocumentFragment();
  segments.forEach((segment,index)=>{
    segment.label=segment.keys.length?segment.keys.map(k=>keyLabels[k]??k).join(' + '):segment.look?`Look ${segment.look}`:'Hold';
    segment.description=segment.keys.length?`${segment.label} along the recorded camera path.`:segment.look?`Turn the camera ${segment.look}.`:'Hold the camera position and viewing direction.';
    const button=document.createElement('button');button.type='button';button.className='trajectory-segment';
    const start=segment.start/selected.fps,end=segment.end/selected.fps;
    button.setAttribute('aria-label',`${segment.label}, ${start.toFixed(2)} to ${end.toFixed(2)} seconds`);
    button.setAttribute('aria-pressed','false');
    const meta=document.createElement('small'),time=document.createElement('span'),symbol=document.createElement('span');
    time.textContent=`${start.toFixed(1)}s`;symbol.textContent=segment.keys.map(k=>keySymbols[k]??'').join('')||(segment.look?'↻':'·');meta.append(time,symbol);
    const title=document.createElement('strong');title.textContent=segment.label;button.append(meta,title);
    button.title=`${segment.description} Frames ${segment.start}–${segment.end-1}`;
    button.addEventListener('click',()=>seek(start));fragment.append(button);segment.button=button;
  });
  $('action-timeline').replaceChildren(fragment);
}
const status=$('world-status');
const clockLabel=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const fail=message=>{$('media-error').textContent=message;$('media-error').hidden=false;};

function pause(){playbackToken++;playing=false;rgb.pause();geometry.pause();if(selected&&geometry.readyState>=1)geometry.currentTime=rgb.currentTime;$('hero-play').hidden=false;updateControls();}
async function play(){
  if(!selected)return;
  if(rgb.currentTime>=selected.duration-.1)seek(0);
  const token=++playbackToken;
  geometry.currentTime=rgb.currentTime;
  playing=true;$('hero-play').hidden=true;updateControls();
  try{
    // Starting both while RGB is still seeking lets its waiting handler abort
    // the geometry play promise. Start RGB first and preserve play intent while buffering.
    await rgb.play();
    if(token!==playbackToken||!playing||rgb.paused||rgb.ended)return;
    geometry.currentTime=rgb.currentTime;
    await geometry.play();
  }catch(error){
    if(token!==playbackToken||!playing)return;
    if(error.name==='AbortError'&&!rgb.paused)return;
    pause();fail('Playback could not start. Please press Play again.');
  }
}
function seek(time){
  const value=Math.min(Math.max(0,time),selected?.duration??0);
  rgb.currentTime=value;geometry.currentTime=value;sceneFrame=-1;updateControls();updateWorld(frameIndex());worldDirty=true;
}
function frameIndex(){return selected?Math.min(selected.frames-1,Math.max(0,Math.floor(rgb.currentTime*selected.fps+1e-3))):0;}
function updateControls(){
  if(!selected)return;
  const frame=frameIndex(),action=selected.timeline?.[frame],keys=action?.keys??[];
  $('seek').value=rgb.currentTime;$('time').textContent=`${clockLabel(rgb.currentTime)} / ${clockLabel(selected.duration)}`;
  $('world-time').textContent=`${rgb.currentTime.toFixed(2).padStart(5,'0')}s`;$('warp-query').textContent=`QUERY ${String(action?.latent??0).padStart(3,'0')}`;
  $('play').innerHTML=playing?'Ⅱ <span>Pause</span>':'▶ <span>Play</span>';
  document.querySelectorAll('[data-key]').forEach(button=>button.classList.toggle('active',keys.includes(button.dataset.key)));
  const labels={w:'FORWARD',a:'MOVE LEFT',s:'BACKWARD',d:'MOVE RIGHT'};
  $('action-label').textContent=frame===0?'INPUT IMAGE':keys.length?keys.map(k=>labels[k]).join(' + '):action?.look?`LOOK ${action.look.toUpperCase()}`:'HOLD POSITION';
  const segmentIndex=segments.findIndex(segment=>frame>=segment.start&&frame<segment.end);
  if(segmentIndex!==activeSegment){
    activeSegment=segmentIndex;
    segments.forEach((segment,index)=>{const active=index===segmentIndex;segment.button.classList.toggle('active',active);segment.button.classList.toggle('passed',index<segmentIndex);segment.button.setAttribute('aria-pressed',String(active));});
  }
  const segment=segments[segmentIndex];
  if(segment&&frame>0)$('action-label').textContent=segment.label.toUpperCase();
  $('action-description').textContent=frame===0?'One image is the starting observation.':segment?.description??'Recorded camera navigation';
  document.querySelectorAll('.revisit-frame').forEach(button=>button.classList.toggle('active',Math.abs(frame-Number(button.dataset.frame))<=2));
}
function ready(){
  if(rgb.readyState>=1&&geometry.readyState>=1){
    $('play').disabled=false;$('seek').disabled=false;
    if(autoPreview){autoPreview=false;const box=$('explorer').getBoundingClientRect();if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&box.top<innerHeight&&box.bottom>0)play();}
  }
}
for(const video of [rgb,geometry]){
  video.addEventListener('loadedmetadata',ready);
  video.addEventListener('error',()=>fail('A video could not be loaded. Select another scene or reload the page.'));
}
$('play').addEventListener('click',()=>playing?pause():play());
$('hero-play').addEventListener('click',play);
$('seek').addEventListener('input',event=>seek(Number(event.target.value)));
$('restart').addEventListener('click',()=>seek(0));
$('speed').addEventListener('change',event=>{rgb.playbackRate=geometry.playbackRate=Number(event.target.value);});
rgb.addEventListener('pause',()=>{if(playing&&rgb.paused&&!rgb.ended)pause();});
for(const video of [rgb,geometry])video.addEventListener('ended',()=>{if(playing&&video.ended){seek(0);play();}});
rgb.addEventListener('waiting',()=>{if(playing)geometry.pause();});
rgb.addEventListener('playing',()=>{if(playing&&!rgb.paused&&!rgb.ended)geometry.play().catch(()=>{});});
rgb.addEventListener('seeked',()=>{if(Math.abs(rgb.currentTime-geometry.currentTime)>.04)geometry.currentTime=rgb.currentTime;sceneFrame=-1;});
function jumpToKey(key){
  if(!selected)return;
  const starts=selected.timeline.filter((a,i)=>a.keys.includes(key)&&(i===0||!selected.timeline[i-1].keys.includes(key)));
  const next=starts.find(a=>a.frame>frameIndex()+1)??starts[0];
  if(next)seek(next.frame/selected.fps);
}
document.querySelectorAll('[data-key]').forEach(button=>button.addEventListener('click',()=>jumpToKey(button.dataset.key)));
document.addEventListener('keydown',event=>{
  if(['INPUT','SELECT','TEXTAREA','VIDEO'].includes(document.activeElement.tagName)||document.querySelector('dialog[open]'))return;
  const box=$('world-showcase').getBoundingClientRect();if(box.bottom<0||box.top>innerHeight)return;
  if(event.code==='Space'){event.preventDefault();playing?pause():play();}
  if('wasd'.includes(event.key.toLowerCase())&&event.key.length===1){event.preventDefault();jumpToKey(event.key.toLowerCase());}
});

function showVisit(visit){pause();seek(visit.time);}
function buildRevisits(base){
  revisitIndex=0;revisitElements=[];$('explorer').dataset.comparisonMode=selected.comparison_mode??'same_view';
  $('revisit-locations').setAttribute('aria-label',selected.comparison_mode==='complex'?'Choose a scene viewpoint':'Choose a repeated viewpoint');
  for(const id of ['revisit-map-labels','revisit-pins','revisit-connectors','revisit-locations'])$(id).replaceChildren();
  (selected.revisits??[]).forEach((point,index)=>{
    const card=document.createElement('button');card.type='button';card.className='revisit-map-card';card.dataset.point=point.id;
    card.title=selected.comparison_mode==='complex'?`${point.label}: inspect this scene viewpoint`:`${point.label}: inspect the same viewpoint on return`;
    const image=document.createElement('img');image.src=base+point.visits.at(-1).image;image.alt=selected.comparison_mode==='complex'?point.label:`${point.label} on return`;
    const label=document.createElement('span');label.textContent=`${point.id} · ${point.label}`;card.append(image,label);
    const pin=document.createElement('button');pin.type='button';pin.className='revisit-pin';pin.setAttribute('aria-label',`Inspect ${point.id}, ${point.label}`);pin.title=`${point.id} · ${point.label}`;
    const button=document.createElement('button');button.type='button';button.className='revisit-location';button.dataset.point=point.id;
    const badge=document.createElement('b');badge.textContent=point.id;const title=document.createElement('span');title.textContent=point.short_label??point.label.replace(' view','').replace('point','');button.append(badge,title);
    const select=()=>{selectRevisit(index);showVisit(point.visits.at(-1));};
    card.addEventListener('click',select);pin.addEventListener('click',select);button.addEventListener('click',select);
    const line=document.createElementNS('http://www.w3.org/2000/svg','line');line.setAttribute('stroke-width','1');line.setAttribute('stroke-dasharray','3 3');
    $('revisit-map-labels').append(card);$('revisit-pins').append(pin);$('revisit-connectors').append(line);$('revisit-locations').append(button);
    revisitElements.push({card,pin,button,line,position:new THREE.Vector3(...point.position)});
  });
  selectRevisit(0);
}
function comparisonVisits(){
  if(selected.comparison_mode==='complex')return selected.revisits.flatMap((point,index)=>point.visits.map(visit=>({...visit,pointIndex:index})));
  return selected.revisits[revisitIndex].visits.map(visit=>({...visit,pointIndex:revisitIndex}));
}
function selectRevisit(index){
  const point=selected.revisits?.[index];if(!point)return;
  revisitIndex=index;
  const complex=selected.comparison_mode==='complex',visits=comparisonVisits();
  $('revisit-kicker').textContent=selected.comparison_heading??'SAME-VIEW REVISIT';
  const anchorLabels=selected.comparison_anchor_labels??[selected.comparison_anchor_label??'landmark'];
  $('revisit-kicker').setAttribute('aria-label',`Open ${complex?'complex revisit':'revisit'} comparison with ${anchorLabels.join(' and ')} boxes`);
  $('revisit-title').textContent=complex?(selected.comparison_title??'Left → Right → Wider view'):`${point.id} · ${point.label}`;
  document.querySelector('#world .revisit-help').textContent=complex?'Different viewpoints · compare shared landmarks. Click a frame to replay.':'Click a frame to replay that visit.';
  $('revisit-gallery').style.setProperty('--visits',visits.length);$('revisit-gallery').dataset.point=point.id;
  const base=selected.asset_base;
  const fragment=document.createDocumentFragment();
  for(const visit of visits){
    const button=document.createElement('button');button.type='button';button.className='revisit-frame';button.dataset.frame=visit.frame;
    button.setAttribute('aria-label',`Replay ${point.label}, ${visit.label}, ${visit.time.toFixed(2)} seconds`);
    const image=document.createElement('img');image.src=base+visit.image;image.alt=`${point.label}, ${visit.label} at ${visit.time.toFixed(2)} seconds`;
    const caption=document.createElement('strong'),label=document.createElement('span'),time=document.createElement('time');label.textContent=visit.label;time.textContent=`${visit.time.toFixed(2)}s`;caption.append(label,time);button.append(image,caption);
    button.addEventListener('click',()=>{if(complex)selectRevisit(visit.pointIndex);showVisit(visit);});fragment.append(button);
  }
  $('revisit-gallery').replaceChildren(fragment);
  revisitElements.forEach((item,i)=>{for(const el of [item.card,item.pin,item.button]){el.classList.toggle('active',i===index);el.setAttribute('aria-pressed',String(i===index));}item.line.setAttribute('stroke',i===index?'#ffad58':'#8b9da9');item.line.setAttribute('opacity',i===index?'.9':'.45');});
  worldDirty=true;updateControls();
}
function updateRevisitProjection(){
  if(!cameraData||!renderer||viewMode==='chase')return;
  camera.updateMatrixWorld();
  const canvas=$('world-canvas'),box=canvas.getBoundingClientRect();
  revisitElements.forEach(item=>{
    const p=item.position.clone().project(camera);
    const visible=p.z>=-1&&p.z<=1&&Math.abs(p.x)<1&&Math.abs(p.y)<1;
    if(!visible){item.pin.hidden=true;item.line.style.display='none';return;}
    const x=(p.x+1)*box.width/2,y=(1-p.y)*box.height/2;
    item.pin.hidden=!visible;item.line.style.display=visible?'':'none';
    item.pin.style.left=`${x}px`;item.pin.style.top=`${y}px`;
    const card=item.card.getBoundingClientRect();
    item.line.setAttribute('x1',String(card.left-box.left+card.width/2));item.line.setAttribute('y1',String(card.bottom-box.top));item.line.setAttribute('x2',String(x));item.line.setAttribute('y2',String(y));
  });
}
const revisitDialog=$('revisit-lightbox');
let comparisonAnchorsVisible=true;
function updateAnchorVisibility(){
  revisitDialog.dataset.anchorsVisible=String(comparisonAnchorsVisible);
  $('revisit-anchor-toggle').setAttribute('aria-pressed',String(comparisonAnchorsVisible));
  $('revisit-anchor-toggle').textContent=comparisonAnchorsVisible?'Hide boxes':'Show boxes';
}
$('revisit-anchor-toggle').addEventListener('click',()=>{comparisonAnchorsVisible=!comparisonAnchorsVisible;updateAnchorVisibility();});
function annotatedComparisonImage(image,visit){
  const media=document.createElement('div');media.className='comparison-media';media.append(image);
  const layer=document.createElement('div');layer.className='comparison-anchors';layer.setAttribute('aria-hidden','true');
  for(const anchor of visit.anchors??[]){
    const box=document.createElement('span');box.className='comparison-anchor';box.dataset.anchorId=anchor.id;
    const [x,y,w,h]=anchor.box;box.style.left=`${x*100}%`;box.style.top=`${y*100}%`;box.style.width=`${w*100}%`;box.style.height=`${h*100}%`;box.style.setProperty('--anchor-color',anchor.color??'#ffb36b');
    const label=document.createElement('span');label.className='comparison-anchor-label';label.textContent=anchor.label;box.append(label);layer.append(box);
  }
  media.append(layer);return media;
}
function openRevisitComparison(){
  const point=selected?.revisits?.[revisitIndex];if(!point)return;
  const complex=selected.comparison_mode==='complex',visits=comparisonVisits();
  pause();$('revisit-lightbox-title').textContent=`${selected.title} · ${complex?'Complex revisit':point.label}`;
  $('comparison-modal-kicker').textContent=complex?'THREE CAMERA POSITIONS · ONE SCENE':'GENERATED VIEWS AT THE SAME RECORDED CAMERA POSE';
  $('comparison-modal-note').textContent=complex?'Compare the café corner, awnings, crossing, and façades from the left, right, and wider views. Select a timestamp to replay it.':'Compare persistent landmarks and scene layout across visits. Select a timestamp to replay it.';
  if(visits.some(visit=>visit.anchors?.length)){
    const labels=new Set(visits.flatMap(visit=>(visit.anchors??[]).map(anchor=>anchor.label)));
    $('comparison-modal-note').textContent+=labels.has('Café')&&labels.has('Person')?' Orange boxes mark the café storefront; pink boxes mark visible pedestrians.':labels.has('Person')?' The pink boxes highlight the visible person in each image.':' The orange boxes highlight the visible café storefront.';
  }
  $('revisit-lightbox-frames').style.setProperty('--visits',visits.length);
  $('revisit-anchor-toggle').disabled=!visits.some(visit=>visit.anchors?.length);updateAnchorVisibility();
  const fragment=document.createDocumentFragment();
  for(const visit of visits){
    const figure=document.createElement('figure'),image=document.createElement('img'),caption=document.createElement('figcaption'),label=document.createElement('span'),button=document.createElement('button');
    image.src=selected.asset_base+visit.image;image.alt=`${point.label}, ${visit.label}`;label.textContent=visit.label;button.textContent=`▶ ${visit.time.toFixed(2)}s`;
    const labels=[...new Set((visit.anchors??[]).map(a=>a.label))];if(labels.length)image.alt+=`. Box highlights ${labels.join(', ')}.`;
    button.addEventListener('click',()=>{revisitDialog.close();if(complex)selectRevisit(visit.pointIndex);showVisit(visit);});caption.append(label,button);figure.append(annotatedComparisonImage(image,visit),caption);
    const notes=[...new Set((visit.anchors??[]).map(a=>a.note).filter(Boolean))];if(notes.length){const note=document.createElement('p');note.className='anchor-visibility';note.textContent=notes.join(' · ');figure.append(note);}fragment.append(figure);
  }
  $('revisit-lightbox-frames').replaceChildren(fragment);revisitDialog.showModal();
}
$('revisit-compare').addEventListener('click',openRevisitComparison);
$('revisit-kicker').addEventListener('click',openRevisitComparison);
$('revisit-close').addEventListener('click',()=>revisitDialog.close());
revisitDialog.addEventListener('click',event=>{if(event.target!==revisitDialog)return;const r=revisitDialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)revisitDialog.close();});

let buildingRenderer,firstPersonCamera,progressiveManifest;
const srgbTable=Float32Array.from({length:256},(_,i)=>{const x=i/255;return x<=.04045?x/12.92:Math.pow((x+.055)/1.055,2.4);});
function colorsToLinear(bytes){const values=new Float32Array(bytes.length);for(let i=0;i<bytes.length;i++)values[i]=srgbTable[bytes[i]];return values;}
function pointTexture(){const c=document.createElement('canvas');c.width=c.height=32;const x=c.getContext('2d');x.fillStyle='white';x.beginPath();x.arc(16,16,14,0,Math.PI*2);x.fill();return new THREE.CanvasTexture(c);}
const dot=pointTexture();
function material(size,extra={}){return new THREE.PointsMaterial({size,sizeAttenuation:false,map:dot,alphaTest:.25,vertexColors:true,...extra});}
function cloudGeometry(positions,colors){const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));g.setAttribute('color',new THREE.BufferAttribute(colors,3));return g;}
function binaryCloud(buffer){const count=new DataView(buffer).getUint32(0,true);return cloudGeometry(new Float32Array(buffer,4,count*3),colorsToLinear(new Uint8Array(buffer,4+count*12,count*3)));}
async function getFile(url,type){const response=await fetch(url,{cache:type==='json'?'no-cache':'default'});if(!response.ok)throw new Error(`${url}: ${response.status}`);return type==='json'?response.json():response.arrayBuffer();}
function makeRenderer(id){const r=new THREE.WebGLRenderer({antialias:true,alpha:true,powerPreference:'high-performance'});r.setPixelRatio(Math.min(devicePixelRatio,1.5));r.outputColorSpace=THREE.SRGBColorSpace;r.setClearColor(0x000000,0);$(id).append(r.domElement);return r;}
function initWorld(){
  try{
    renderer=makeRenderer('world-canvas');buildingRenderer=makeRenderer('building-canvas');world=new THREE.Scene();
    camera=new THREE.PerspectiveCamera(48,1,.01,100000);camera.up.set(0,-1,0);
    firstPersonCamera=new THREE.PerspectiveCamera();firstPersonCamera.matrixAutoUpdate=false;
    configureControls();new ResizeObserver(resize).observe($('world-canvas'));new ResizeObserver(resizeBuilding).observe($('building-canvas'));resize();resizeBuilding();
  }catch(error){status.hidden=false;$('building-status').hidden=false;status.textContent='The interactive point cloud needs WebGL. The original online warp remains available.';$('building-status').textContent='WebGL is unavailable.';console.error(error);}
}
function configureControls(){
  controls?.dispose();controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.dampingFactor=.07;
  controls.enabled=['top','orbit'].includes(viewMode);controls.enableRotate=viewMode==='orbit';if(viewMode==='top')controls.mouseButtons.LEFT=THREE.MOUSE.PAN;
  controls.addEventListener('change',()=>{worldDirty=true;});
}
function resize(){if(!renderer)return;const b=$('world-canvas');renderer.setSize(b.clientWidth,b.clientHeight,false);camera.aspect=b.clientWidth/Math.max(1,b.clientHeight);camera.updateProjectionMatrix();if(cameraData)overview(viewMode);worldDirty=true;}
function resizeBuilding(){if(!buildingRenderer)return;const b=$('building-canvas');buildingRenderer.setSize(b.clientWidth,b.clientHeight,false);worldDirty=true;}
function disposeWorld(){
  dynamicCache.forEach(g=>g.dispose());dynamicCache.clear();
  if(sceneGroup){world.remove(sceneGroup);sceneGroup.traverse(o=>{o.geometry?.dispose();if(Array.isArray(o.material))o.material.forEach(m=>m.dispose());else o.material?.dispose();});}
  sceneGroup=undefined;cameraData=undefined;dynamicData=undefined;progressiveManifest=undefined;sceneFrame=-1;
  renderer?.clear();buildingRenderer?.clear();
}
function overview(mode='top'){
  if(!cameraData||!renderer)return;
  viewMode=mode;const low=new THREE.Vector3(...cameraData.bounds[0]),high=new THREE.Vector3(...cameraData.bounds[1]);
  for(const row of cameraData.warp){low.min(new THREE.Vector3(row[3],row[7],row[11]));high.max(new THREE.Vector3(row[3],row[7],row[11]));}
  const center=low.clone().add(high).multiplyScalar(.5);sceneRadius=Math.max(.1,low.distanceTo(high)*.5);
  if(mode==='top'){
    const t=Math.tan(THREE.MathUtils.degToRad(camera.fov/2));const d=Math.max((high.z-low.z)/t,(high.x-low.x)/(t*camera.aspect))*.62+(high.y-low.y)*.5;
    camera.up.set(0,0,1);camera.position.copy(center).add(new THREE.Vector3(0,-d,0));
  }else if(mode==='orbit'){
    camera.up.set(0,-1,0);camera.position.copy(center).add(new THREE.Vector3(.85,-.65,-1.35).multiplyScalar(sceneRadius));
  }
  configureControls();controls.target.copy(center);camera.near=sceneRadius/2000;camera.far=sceneRadius*60;camera.updateProjectionMatrix();controls.minDistance=sceneRadius*.03;controls.maxDistance=sceneRadius*10;if(['top','orbit'].includes(mode))controls.update();
  for(const [id,value] of [['top-view','top'],['orbit-view','orbit'],['chase-view','chase']])$(id).setAttribute('aria-pressed',String(mode===value));
  const labels={top:'BIRD’S-EYE',orbit:'3D ORBIT',chase:'FOLLOW · OBSERVER OFFSET'};
  $('world-view-label').textContent=labels[mode];$('world-canvas').dataset.view=mode;$('world').dataset.cameraMode=mode;
  document.querySelector('#world .orbit-hint').textContent=mode==='top'?'DRAG TO PAN · SCROLL TO ZOOM':mode==='orbit'?'DRAG TO ORBIT · SCROLL TO ZOOM':'';worldDirty=true;
}
for(const [id,mode] of [['top-view','top'],['orbit-view','orbit'],['chase-view','chase']])$(id).addEventListener('click',()=>overview(mode));
$('reset-view').addEventListener('click',()=>overview('top'));
$('show-path').addEventListener('change',()=>{if(pathGroup)pathGroup.visible=$('show-path').checked;worldDirty=true;});
for(const id of ['show-static','show-current','show-trails'])$(id).addEventListener('change',()=>{sceneFrame=-1;worldDirty=true;});
function dynamicGeometry(frame){
  if(dynamicCache.has(frame))return dynamicCache.get(frame);
  const a=dynamicData.offsets[frame],b=dynamicData.offsets[frame+1];
  const g=cloudGeometry(dynamicData.positions.subarray(a*3,b*3),dynamicData.colors.subarray(a*3,b*3));dynamicCache.set(frame,g);
  if(dynamicCache.size>40){const key=dynamicCache.keys().next().value;dynamicCache.get(key).dispose();dynamicCache.delete(key);}return g;
}
function updateWorld(frame){
  if(!progressiveManifest||!sceneGroup)return;
  cloudGroup.visible=$('show-static').checked;currentCloud.visible=pinkCloud.visible=$('show-current').checked;
  if(frame===sceneFrame)return;
  worldDirty=true;sceneFrame=frame;const count=progressiveManifest.reveal_counts[frame];
  cloudGroup.geometry.setDrawRange(0,count);
  const current=dynamicGeometry(frame);currentCloud.geometry=pinkCloud.geometry=current;
  ghostClouds.forEach((cloud,i)=>{const past=frame-Math.round((i+1)*.16*selected.fps);cloud.visible=$('show-trails').checked&&past>=0;if(past>=0)cloud.geometry=dynamicGeometry(past);});
  const row=cameraData.warp[frame];frustum.matrix.fromArray(row).transpose();marker.position.set(row[3],row[7],row[11]);pastPath.geometry.setDrawRange(0,frame+1);
  $('history-time').textContent=`Revealed through ${(frame/selected.fps).toFixed(2)}s`;
  const box=$('building-canvas');box.dataset.points=String(count);box.dataset.totalPoints=String(progressiveManifest.point_count);box.dataset.frame=String(frame);box.dataset.revealFrame=String(frame);box.dataset.geometryMode='global_progressive';
  $('world-canvas').dataset.frame=String(frame);$('world-canvas').dataset.cameraPosition=[row[3],row[7],row[11]].map(x=>x.toFixed(4)).join(',');
}
function alignFirstPerson(frame){
  const K=progressiveManifest.intrinsics[frame],w=progressiveManifest.width,h=progressiveManifest.height,n=.01,f=100000;
  firstPersonCamera.projectionMatrix.set(2*K[0][0]/w,0,1-2*K[0][2]/w,0,0,2*K[1][1]/h,2*K[1][2]/h-1,0,0,0,-(f+n)/(f-n),-2*f*n/(f-n),0,0,-1,0);
  firstPersonCamera.projectionMatrixInverse.copy(firstPersonCamera.projectionMatrix).invert();
  firstPersonCamera.matrix.fromArray(cameraData.warp[frame]).transpose().multiply(new THREE.Matrix4().makeScale(1,-1,-1));
  firstPersonCamera.matrixWorld.copy(firstPersonCamera.matrix);firstPersonCamera.matrixWorldInverse.copy(firstPersonCamera.matrixWorld).invert();
  $('building-canvas').dataset.cameraPosition=[cameraData.warp[frame][3],cameraData.warp[frame][7],cameraData.warp[frame][11]].map(x=>x.toFixed(4)).join(',');
  $('building-canvas').dataset.cameraContract='original-global-c2w-and-intrinsics';
  $('building-canvas').cameraDebug={world:firstPersonCamera.matrixWorld.toArray(),projection:firstPersonCamera.projectionMatrix.toArray(),frame,scene:selected.name,drawCount:cloudGroup.geometry.drawRange.count,sourceCount:cloudGroup.geometry.attributes.position.count};
}
function renderAligned(r){
  const w=r.domElement.clientWidth,h=r.domElement.clientHeight,aspect=(selected.video_width||rgb.videoWidth||768)/(selected.video_height||rgb.videoHeight||512);
  let width=w,height=w/aspect;if(height>h){height=h;width=h*aspect;}r.setViewport(0,0,w,h);r.clear();r.setViewport((w-width)/2,(h-height)/2,width,height);r.render(world,firstPersonCamera);r.setViewport(0,0,w,h);
}
function renderViews(){
  if(!sceneGroup||!progressiveManifest)return;
  alignFirstPerson(frameIndex());const pathVisible=pathGroup.visible;pathGroup.visible=false;renderAligned(buildingRenderer);
  pathGroup.visible=pathVisible;
  if(viewMode==='chase'){
    pathGroup.visible=false;const matrix=new THREE.Matrix4().fromArray(cameraData.warp[frameIndex()]).transpose(),near=cameraData.follow_distance;
    camera.up.set(0,-1,0);camera.position.copy(new THREE.Vector3(.1*near,-.16*near,-.65*near).applyMatrix4(matrix));camera.lookAt(new THREE.Vector3(0,0,1.2*near).applyMatrix4(matrix));
  }
  renderer.setViewport(0,0,renderer.domElement.clientWidth,renderer.domElement.clientHeight);renderer.render(world,camera);
  pathGroup.visible=pathVisible;
}
async function loadWorld(base,token){
  if(!renderer)return;
  disposeWorld();status.hidden=true;$('building-status').hidden=true;status.textContent='';$('building-status').textContent='';
  $('history-time').textContent='';
  $('world-canvas').setAttribute('aria-busy','true');$('building-canvas').setAttribute('aria-busy','true');
  try{
    const path=selected.progressive_manifest??'progressive_global/manifest.json',folder=base+path.slice(0,path.lastIndexOf('/')+1);
    const manifest=await getFile(base+path,'json');
    if(token!==sceneToken)return;
    if(!manifest.original_positions_and_colors_preserved||!manifest.full_sequence_geometry_used||manifest.strict_causal_reconstruction)throw new Error('Global reconstruction provenance check failed');
    const [staticBuffer,dynamicBuffer,originalCameras]=await Promise.all([getFile(folder+manifest.points),getFile(base+'dynamic.bin'),getFile(base+'cameras.json','json')]);
    if(token!==sceneToken)return;
    if(new DataView(staticBuffer).getUint32(0,true)!==manifest.point_count)throw new Error('Original global point count mismatch');
    progressiveManifest=manifest;cameraData={warp:manifest.camera_poses_reconstructed,bounds:manifest.bounds,follow_distance:originalCameras.follow_distance};
    const view=new DataView(dynamicBuffer),frames=view.getUint32(0,true),total=view.getUint32(4,true),offset=8+(frames+1)*4;
    dynamicData={offsets:new Uint32Array(dynamicBuffer,8,frames+1),positions:new Float32Array(dynamicBuffer,offset,total*3),colors:colorsToLinear(new Uint8Array(dynamicBuffer,offset+total*12,total*3))};
    sceneGroup=new THREE.Group();world.add(sceneGroup);cloudGroup=new THREE.Points(binaryCloud(staticBuffer),material(1.6));sceneGroup.add(cloudGroup);
    pathGroup=new THREE.Group();sceneGroup.add(pathGroup);pathGroup.visible=$('show-path').checked;
    const positions=new Float32Array(cameraData.warp.flatMap(r=>[r[3],r[7],r[11]]));const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.BufferAttribute(positions,3));
    pastPath=new THREE.Line(g,new THREE.LineBasicMaterial({color:0xffad58,transparent:true,opacity:.9,depthTest:false}));pathGroup.add(pastPath);
    const corners=[[-.65,-.4,1],[.65,-.4,1],[.65,.4,1],[-.65,.4,1]],lines=[];for(let i=0;i<4;i++)lines.push(0,0,0,...corners[i],...corners[i],...corners[(i+1)%4]);
    frustum=new THREE.LineSegments(new THREE.BufferGeometry().setAttribute('position',new THREE.Float32BufferAttribute(lines,3)),new THREE.LineBasicMaterial({color:0xffc27e,depthTest:false}));frustum.matrixAutoUpdate=false;pathGroup.add(frustum);
    marker=new THREE.Mesh(new THREE.SphereGeometry(.18,10,8),new THREE.MeshBasicMaterial({color:0xffad58,depthTest:false}));pathGroup.add(marker);
    currentCloud=new THREE.Points(new THREE.BufferGeometry(),material(2.2,{depthTest:false}));currentCloud.renderOrder=4;sceneGroup.add(currentCloud);
    pinkCloud=new THREE.Points(new THREE.BufferGeometry(),material(3.2,{vertexColors:false,color:0xff71b1,depthWrite:false,depthTest:false}));pinkCloud.renderOrder=3;sceneGroup.add(pinkCloud);
    ghostClouds=[];for(let i=0;i<2;i++){const cloud=new THREE.Points(new THREE.BufferGeometry(),material(2,{transparent:true,opacity:.2*Math.pow(1-(i+1)*.16/.8,1.5),depthWrite:false}));cloud.renderOrder=2;ghostClouds.push(cloud);sceneGroup.add(cloud);}
    overview('top');updateWorld(frameIndex());status.hidden=true;$('building-status').hidden=true;$('world-canvas').setAttribute('aria-busy','false');$('building-canvas').setAttribute('aria-busy','false');worldDirty=true;
  }catch(error){if(token!==sceneToken)return;status.hidden=false;$('building-status').hidden=false;status.textContent='The global reconstruction could not be loaded.';$('building-status').textContent='The global reconstruction could not be loaded.';$('world-canvas').setAttribute('aria-busy','false');$('building-canvas').setAttribute('aria-busy','false');console.error(error);}
}

async function choose(index){
  pause();selected=scenes[index];const token=++sceneToken;$('media-error').hidden=true;
  $('play').disabled=true;$('seek').disabled=true;$('seek').max=selected.duration;
  const base=selected.asset_base;
  rgb.src=base+'generation.mp4';geometry.src=base+(selected.online_warp??'online_warp.mp4');rgb.poster=base+'poster.jpg';geometry.poster=base+'online_warp_poster.jpg';
  const complex=selected.comparison_mode==='complex';
  $('explorer-story-title').innerHTML=complex?'One scene.<br><span>Connected by memory.</span>':'Leave a place.<br><span>Return to the same view.</span>';
  $('explorer-story-copy').textContent=complex?selected.comparison_description:'Follow the camera through a generated world. Select a marked viewpoint to compare its first visit and later returns.';
  $('explorer-input-prompt').textContent=selected.display_prompt??selected.prompt??'';
  $('camera-count').textContent=selected.frames;
  $('cloud-download').href=base+'scene.ply';
  const note=inspection[selected.name];$('inspection-title').textContent=note?.title??'Structure. Motion. Perspective.';$('inspection-copy').textContent=note?.copy??'Inspect geometry and recent motion in the same scene.';
  buildTrajectory();buildRevisits(base);
  document.querySelectorAll('[data-key]').forEach(button=>{
    const available=selected.timeline.some(action=>action.keys.includes(button.dataset.key));
    button.disabled=!available;
    button.title=available?`Jump to the next ${button.textContent} segment`:'This key is not used in this recorded trajectory';
  });
  document.querySelectorAll('.case-tab').forEach((button,i)=>{button.classList.toggle('active',i===index);button.setAttribute('aria-pressed',String(i===index));});
  sceneFrame=-1;updateControls();await loadWorld(base,token);
}
function tick(){
  if(selected){
    if(playing&&!rgb.paused&&!rgb.seeking&&rgb.readyState>=3&&geometry.readyState>=2){if(Math.abs(rgb.currentTime-geometry.currentTime)>.04)geometry.currentTime=rgb.currentTime;if(geometry.paused)geometry.play().catch(()=>{});}
    updateControls();updateWorld(frameIndex());
  }
  if(renderer){if(['top','orbit'].includes(viewMode))controls.update();if(worldDirty){updateRevisitProjection();renderViews();worldDirty=false;}}
  requestAnimationFrame(tick);
}
new IntersectionObserver(entries=>{if(entries.some(entry=>!entry.isIntersecting)&&playing)pause();},{threshold:.01}).observe($('world-showcase'));
initWorld();
getFile($('explorer').dataset.manifest,'json').then(data=>{
  scenes=data;if(!scenes.length)throw new Error('No completed scenes');
  scenes.forEach((scene,index)=>{const button=document.createElement('button');button.className='case-tab';button.type='button';button.setAttribute('aria-label',`Choose ${scene.title??names[scene.name]??scene.name}`);
    const image=document.createElement('img');image.src=(scene.asset_base)+'poster.jpg';image.alt='';const label=document.createElement('span');label.textContent=scene.title??names[scene.name]??scene.name;const number=document.createElement('small');number.textContent=String(index+1).padStart(2,'0');button.append(image,label,number);button.addEventListener('click',()=>choose(index));$('case-tabs').append(button);});
  choose(0);
}).catch(error=>fail('The scene manifest could not be loaded. Serve this page over HTTP and reload.'));
tick();
