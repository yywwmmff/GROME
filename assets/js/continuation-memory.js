import * as THREE from 'three';
import {OrbitControls} from '../vendor/OrbitControls.js';
import {PLYLoader} from '../vendor/PLYLoader.js';

// Each application owns its canvas, request lifecycle, and orbit controls.
class MemoryViewer{
 constructor(prefix){
  this.host=document.getElementById(`${prefix}-memory-canvas`);this.status=document.getElementById(`${prefix}-memory-status`);this.count=document.getElementById(`${prefix}-memory-count`);this.reset=document.getElementById(`${prefix}-memory-reset`);this.token=0;this.dirty=true;this.visible=false;
  this.renderer=new THREE.WebGLRenderer({antialias:true,alpha:true});this.renderer.setPixelRatio(Math.min(devicePixelRatio,1.5));this.renderer.outputColorSpace=THREE.SRGBColorSpace;this.renderer.domElement.tabIndex=0;this.renderer.domElement.setAttribute('aria-label','Interactive input point cloud. Drag to orbit and scroll to zoom.');this.host.append(this.renderer.domElement);
  this.scene=new THREE.Scene();this.camera=new THREE.PerspectiveCamera(45,1,.001,100000);this.createControls();this.reset.addEventListener('click',()=>this.fit());
  new ResizeObserver(()=>{const width=this.host.clientWidth,height=this.host.clientHeight;if(!width||!height)return;this.renderer.setSize(width,height,false);this.camera.aspect=width/height;this.camera.updateProjectionMatrix();this.dirty=true;}).observe(this.host);
  new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this.dirty=true;},{rootMargin:'100px'}).observe(this.host);
  const tick=()=>{if(this.visible&&!document.hidden){this.controls.update();if(this.dirty){this.renderer.render(this.scene,this.camera);this.dirty=false;}}requestAnimationFrame(tick);};tick();
 }
 createControls(){
  this.controls?.dispose();this.controls=new OrbitControls(this.camera,this.renderer.domElement);this.controls.enableDamping=true;this.controls.listenToKeyEvents(this.renderer.domElement);this.controls.addEventListener('change',()=>this.dirty=true);
 }
 clear(){
  this.token++;this.request?.abort();if(this.cloud){this.scene.remove(this.cloud);this.cloud.geometry.dispose();this.cloud.material.dispose();this.cloud=null;}this.entry=null;this.reset.disabled=true;this.count.textContent='';delete this.host.dataset.points;delete this.host.dataset.asset;this.host.dataset.status='idle';this.renderer.clear();this.dirty=true;
 }
 fit(){
  if(!this.cloud||!this.entry)return;const entry=this.entry;const sphere=this.cloud.geometry.boundingSphere;const center=entry.target?new THREE.Vector3(...entry.target):sphere.center;const radius=Math.max(entry.radius??sphere.radius,.001);this.camera.up.set(...(entry.up??[0,-1,0]));this.controls.target.copy(center);
  const direction=new THREE.Vector3(...(entry.view_direction??[.22,-.12,-1])).normalize(),right=new THREE.Vector3().crossVectors(this.camera.up,direction).normalize(),up=new THREE.Vector3().crossVectors(direction,right).normalize();
  const vertical=THREE.MathUtils.degToRad(this.camera.fov),horizontal=2*Math.atan(Math.tan(vertical/2)*this.camera.aspect),tanX=Math.tan(horizontal/2)*.88,tanY=Math.tan(vertical/2)*.88;
  const positions=this.cloud.geometry.getAttribute('position'),requirements=[],stride=Math.max(1,Math.floor(positions.count/24000)),relative=new THREE.Vector3();
  for(let index=0;index<positions.count;index+=stride){relative.fromBufferAttribute(positions,index).sub(center);requirements.push(relative.dot(direction)+Math.max(Math.abs(relative.dot(right))/tanX,Math.abs(relative.dot(up))/tanY));}
  requirements.sort((a,b)=>a-b);const distance=Math.max(radius*.1,requirements[Math.floor(requirements.length*.985)]);
  this.camera.position.copy(center).addScaledVector(direction,distance);this.camera.near=Math.max(radius/3000,.00001);this.camera.far=Math.max(radius*150,10);this.camera.updateProjectionMatrix();this.createControls();this.controls.target.copy(center);this.controls.update();this.dirty=true;

 }
 async show(entry){
  this.clear();this.entry=entry;if(!entry?.ply){this.host.dataset.status='missing';this.status.textContent='Input point cloud coming soon.';this.status.hidden=false;return;}
  const token=this.token;this.request=new AbortController();this.host.dataset.status='loading';this.status.textContent='Loading input memory…';this.status.hidden=false;
  try{
   const response=await fetch(entry.ply,{signal:this.request.signal});if(!response.ok)throw Error('Input point cloud unavailable');const data=await response.arrayBuffer();if(token!==this.token)return;
   const geometry=new PLYLoader().parse(data);if(token!==this.token){geometry.dispose();return;}geometry.computeBoundingSphere();
   this.cloud=new THREE.Points(geometry,new THREE.PointsMaterial({size:entry.point_size??1.7,sizeAttenuation:false,vertexColors:!!geometry.getAttribute('color'),color:geometry.getAttribute('color')?0xffffff:0xb9d3e7}));this.scene.add(this.cloud);this.fit();this.reset.disabled=false;this.status.hidden=true;this.host.dataset.status='ready';this.host.dataset.asset=entry.ply;this.host.dataset.points=String(geometry.getAttribute('position').count);this.count.textContent=`${new Intl.NumberFormat('en',{notation:'compact',maximumFractionDigits:0}).format(geometry.getAttribute('position').count)} points`;
  }catch(error){if(token!==this.token||error.name==='AbortError')return;this.host.dataset.status='error';this.status.textContent='The input point cloud could not be loaded.';this.status.hidden=false;console.warn(error.message);}
 }
}
const viewers=new Map();
export function showMemory(entry,prefix='continuation'){
 if(!viewers.has(prefix))viewers.set(prefix,new MemoryViewer(prefix));return viewers.get(prefix).show(entry);
}
export function clearMemory(prefix='continuation'){viewers.get(prefix)?.clear();}
