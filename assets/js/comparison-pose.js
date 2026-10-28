// Render the supplied camera-to-world matrices; the GROME video is the clock.
export class ComparisonPose{
 constructor(canvas,video){
  this.canvas=canvas;this.video=video;this.context=canvas.getContext('2d');this.poses=[];this.visible=false;this.lastFrame=-1;this.dirty=true;
  new ResizeObserver(()=>{this.width=canvas.clientWidth;this.height=canvas.clientHeight;const ratio=Math.min(devicePixelRatio||1,2);canvas.width=Math.round(this.width*ratio);canvas.height=Math.round(this.height*ratio);this.context.setTransform(ratio,0,0,ratio,0,0);this.dirty=true;this.draw();}).observe(canvas);
  new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;if(this.visible)this.dirty=true;},{rootMargin:'100px'}).observe(canvas);
  window.addEventListener('grome-theme-change',()=>{this.dirty=true;this.draw();});
  const tick=()=>{if(this.visible&&!document.hidden)this.draw();requestAnimationFrame(tick);};tick();
 }
 clear(){this.poses=[];this.lastFrame=-1;delete this.canvas.dataset.poseFrame;delete this.canvas.dataset.poseCount;this.context.clearRect(0,0,this.width||0,this.height||0);}
 setData(data,key){
  const matrices=data.cameras_interp;if(!Array.isArray(matrices)||!matrices.length||!matrices.every(m=>m.length===4&&m.every(r=>r.length===4&&r.every(Number.isFinite))))throw Error('Invalid camera poses');
  this.poses=matrices.map(m=>({p:[m[0][3],m[1][3],m[2][3]],r:m}));
  // Most files are per video frame; Alaya's expanded input declares its stride.
  this.fps=(data.fps??24)*(data.model_frames_per_pose&&data.worldscore_frames_per_latent?data.model_frames_per_pose/data.worldscore_frames_per_latent:1);
  this.canvas.dataset.poseKey=key;this.canvas.dataset.poseCount=String(this.poses.length);this.canvas.dataset.poseFps=String(this.fps);this.lastFrame=-1;this.dirty=true;this.draw();
 }
 project(p){return {x:p[0]-.65*p[1],y:p[2]-.28*p[0]-.28*p[1]};}
 draw(){
  if(!this.poses.length||!this.width||!this.height)return;const frame=Math.min(this.poses.length-1,Math.max(0,Math.floor((this.video.currentTime||0)*this.fps+1e-6)));if(frame===this.lastFrame&&!this.dirty)return;
  this.lastFrame=frame;this.dirty=false;this.canvas.dataset.poseFrame=String(frame);
  const c=this.context,w=this.width,h=this.height,projected=this.poses.map(p=>this.project(p.p));let minX=Infinity,maxX=-Infinity,minY=Infinity,maxY=-Infinity;for(const p of projected){minX=Math.min(minX,p.x);maxX=Math.max(maxX,p.x);minY=Math.min(minY,p.y);maxY=Math.max(maxY,p.y);}
  const scale=Math.min((w-58)/Math.max(maxX-minX,.1),(h-50)/Math.max(maxY-minY,.1));const pixel=p=>({x:w/2+(p.x-(minX+maxX)/2)*scale,y:h/2-(p.y-(minY+maxY)/2)*scale});c.clearRect(0,0,w,h);const styles=getComputedStyle(this.canvas),accent=styles.getPropertyValue('--orange').trim()||'#ffad70',muted=styles.getPropertyValue('--muted').trim()||'#a6b6c3',line=styles.getPropertyValue('--line').trim()||'#ffffff06';
  c.strokeStyle=line;c.lineWidth=1;for(let y=22;y<h;y+=24){c.beginPath();c.moveTo(0,y);c.lineTo(w,y);c.stroke();}
  const path=(end,color,width)=>{c.beginPath();projected.slice(0,end+1).forEach((p,i)=>{const q=pixel(p);i?c.lineTo(q.x,q.y):c.moveTo(q.x,q.y);});c.strokeStyle=color;c.lineWidth=width;c.stroke();};path(projected.length-1,'#566675',1.4);path(frame,accent,2);
  const depth=15/Math.max(scale,1e-6),fw=depth*.58,fh=depth*.42,vertices=[[0,0,0],[-fw,-fh,depth],[fw,-fh,depth],[fw,fh,depth],[-fw,fh,depth]],edges=[[0,1],[0,2],[0,3],[0,4],[1,2],[2,3],[3,4],[4,1]];
  const frustum=(pose,active)=>{
   const world=p=>pose.p.map((x,i)=>x+pose.r[i][0]*p[0]+pose.r[i][1]*p[1]+pose.r[i][2]*p[2]);const points=vertices.map(v=>pixel(this.project(world(v))));
   c.beginPath();[1,2,3,4].forEach((i,n)=>n?c.lineTo(points[i].x,points[i].y):c.moveTo(points[i].x,points[i].y));c.closePath();c.fillStyle=active?'#b4494420':'#709fbd12';c.fill();c.strokeStyle=active?accent:'#738e9e70';c.lineWidth=active?1.7:1;for(const [a,b] of edges){c.beginPath();c.moveTo(points[a].x,points[a].y);c.lineTo(points[b].x,points[b].y);c.stroke();}
   if(active){c.beginPath();c.arc(points[0].x,points[0].y,3.2,0,Math.PI*2);c.fillStyle=accent;c.fill();}
  };
  const stride=Math.max(1,Math.ceil(this.poses.length/10));for(let i=0;i<this.poses.length;i+=stride)frustum(this.poses[i],false);frustum(this.poses[this.poses.length-1],false);frustum(this.poses[frame],true);
  c.font='500 12px Manrope, sans-serif';c.fillStyle=muted;c.fillText('GROME current view',10,h-10);
 }
}
