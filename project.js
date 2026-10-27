// Resource URLs are intentionally empty until the paper and code are public.
for(const link of document.querySelectorAll('[data-placeholder-link]'))link.addEventListener('click',event=>event.preventDefault());
import {ComparisonPose} from './assets/js/comparison-pose.js';
const $=id=>document.getElementById(id);
const mediaObserver=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
    if(isIntersecting&&target.dataset.src){target.src=target.dataset.src;delete target.dataset.src;target.load();}
    if(!isIntersecting&&!target.dataset.comparison)target.pause();
  }
},{rootMargin:'160px'});
function setVideo(video,item){
  video.pause();video.removeAttribute('src');video.load();
  video.poster=item.poster??'';video.dataset.src=item.video;mediaObserver.observe(video);
  const box=video.getBoundingClientRect();
  if(box.width>0&&box.height>0&&box.top<innerHeight+160&&box.bottom>-160){video.src=video.dataset.src;delete video.dataset.src;video.load();}
}
const duration=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const makeOption=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;};
const prettyStyle=style=>({static:'Static scene',dynamic:'Dynamic scene'}[style]??style.replaceAll('_',' '));

const dialog=$('media-dialog'),dialogVideo=$('dialog-video');

// Muted application previews loop independently while visible.
for(const video of document.querySelectorAll('video[data-ambient-loop]')){
  let visible=false;video.muted=true;video.defaultMuted=true;video.loop=true;
  const allowed=()=>visible&&!document.hidden&&!dialog.open;
  const resume=()=>{if(!allowed()){video.pause();return;}if(video.dataset.src){video.src=video.dataset.src;delete video.dataset.src;video.load();}if(video.currentSrc)video.play().catch(()=>{});};
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting&&entries[0].intersectionRatio>=.15;resume();},{threshold:[0,.15]}).observe(video);
  video.addEventListener('canplay',resume);video.addEventListener('play',()=>{if(!allowed())video.pause();});document.addEventListener('visibilitychange',resume);dialog.addEventListener('close',resume);
}
function openVideo(item,label){
  document.querySelectorAll('video').forEach(video=>video.pause());
  $('dialog-title').textContent=label;dialogVideo.poster=item.poster;dialogVideo.src=item.video;
  dialog.showModal();dialogVideo.play().catch(()=>{});
}
$('dialog-close').addEventListener('click',()=>dialog.close());
dialog.addEventListener('click',event=>{if(event.target===dialog){const rect=dialog.getBoundingClientRect();if(event.clientX<rect.left||event.clientX>rect.right||event.clientY<rect.top||event.clientY>rect.bottom)dialog.close();}});
dialog.addEventListener('close',()=>{dialogVideo.pause();dialogVideo.removeAttribute('src');dialogVideo.load();});

let galleryItems=[],galleryFilter='all',galleryTag='all',galleryExpanded=false;
const tagLabels={anime:'Anime',illustration:'Illustration','ink-painting':'Ink painting',nature:'Nature',urban:'Urban',interior:'Interiors',animals:'Animals',realistic:'Photorealistic'};
function drawGallery(){
  const matched=galleryItems.filter(item=>(galleryFilter==='all'||item.scene_type===galleryFilter)&&(galleryTag==='all'||item.tags?.includes(galleryTag)));
  const visible=galleryExpanded?matched:matched.slice(0,6);
  const fragment=document.createDocumentFragment();
  for(const item of visible){
    const button=document.createElement('button');button.type='button';button.className='gallery-card';
    const title=item.category||'World exploration';const label=title.replaceAll('_',' ');
    button.setAttribute('aria-label',`Play ${prettyStyle(item.style)} ${label}`);
    const imageBox=document.createElement('div');imageBox.className='gallery-image';
    const image=document.createElement('img');image.src=item.poster;image.alt=`${prettyStyle(item.style)} ${label}`;image.loading='lazy';imageBox.append(image);
    const meta=document.createElement('div');meta.className='gallery-meta';
    const heading=document.createElement('h3');heading.textContent=label.charAt(0).toUpperCase()+label.slice(1);
    const style=document.createElement('span');style.textContent=prettyStyle(item.style);meta.append(heading,style);const tags=document.createElement('div');tags.className='gallery-tag-list';for(const tag of item.tags??[]){const chip=document.createElement('small');chip.textContent=tagLabels[tag]??tag;tags.append(chip);}meta.append(tags);button.append(imageBox,meta);
    button.addEventListener('click',()=>openVideo(item,`${prettyStyle(item.style)} · ${label}`));fragment.append(button);
  }
  $('gallery-grid').replaceChildren(fragment);$('gallery-more').hidden=matched.length<=6;
  $('gallery-more').innerHTML=galleryExpanded?'Show fewer scenes <span>↑</span>':'Show more scenes <span>↓</span>';
  document.querySelectorAll('[data-gallery]').forEach(button=>{const active=button.dataset.gallery===galleryFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
document.querySelectorAll('[data-gallery]').forEach(button=>button.addEventListener('click',()=>{galleryFilter=button.dataset.gallery;galleryExpanded=false;drawGallery();}));
document.querySelectorAll('[data-gallery-tag]').forEach(button=>button.addEventListener('click',()=>{galleryTag=button.dataset.galleryTag;galleryExpanded=false;drawGallery();document.querySelectorAll('[data-gallery-tag]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}));
$('gallery-more').addEventListener('click',()=>{galleryExpanded=!galleryExpanded;drawGallery();});

const comparisonRows=[];
const comparisonVideos=[];
function pauseComparison(){comparisonRows.forEach(row=>row.pause());}
class ComparisonRow{
  constructor(scene,catalog){
    this.scene=scene;this.prefix=scene==='static'?'':'dynamic-';this.$=id=>document.getElementById(this.prefix+id);this.root=document.querySelector(`[data-comparison-row="${scene}"]`);this.cases=catalog.filter(item=>item.scene===scene);this.videos=[this.$('baseline-ours'),this.$('baseline-video-1'),this.$('baseline-video-2')];this.playing=false;this.changing=false;this.token=0;
    this.pose=new ComparisonPose(this.$('comparison-pose'),this.videos[0]);
    new ResizeObserver(()=>{const height=this.videos[0].getBoundingClientRect().height;if(height>0)this.root.style.setProperty('--comparison-video-height',`${height}px`);}).observe(this.videos[0]);
    this.videos.forEach(video=>{video.dataset.comparison='true';comparisonVideos.push(video);});
    this.cases.forEach((item,index)=>this.$('comparison-scene').append(makeOption(String(index),item.label)));
    this.$('comparison-scene').addEventListener('change',()=>this.choose(Number(this.$('comparison-scene').value)));
    for(const id of ['baseline-select-1','baseline-select-2'])this.$(id).addEventListener('change',()=>this.configure());
    this.$('comparison-play').addEventListener('click',()=>this.playing?this.pause():this.play());
    this.$('comparison-restart').addEventListener('click',()=>{const resume=this.playing;this.pause();this.videos.forEach(v=>{if(v.readyState>=1)v.currentTime=0;});if(resume)this.play();});
    for(const button of this.root.querySelectorAll('[data-compare-position]'))button.addEventListener('click',()=>this.checkpoint(Number(button.dataset.comparePosition),button));
    for(const video of this.videos){
      video.addEventListener('play',()=>{if(!this.playing&&!this.changing)this.play();});
      video.addEventListener('pause',()=>{if(this.playing&&!this.changing&&video.paused&&!video.ended&&video.currentTime<video.duration-.08)this.pause();});
      video.addEventListener('ended',()=>{if(this.videos.every(v=>v.ended||v.currentTime>=v.duration-.08))this.pause();});
      video.addEventListener('seeking',()=>{if(this.changing)return;for(const other of this.videos)if(other!==video&&other.readyState>=1){const target=Math.min(video.currentTime,Math.max(0,other.duration-.001));if(Math.abs(other.currentTime-target)>.1)other.currentTime=target;}});
    }
    new IntersectionObserver(entries=>{if(entries.some(e=>!e.isIntersecting))this.pause();},{threshold:.01}).observe(this.root);
    this.choose(0);this.tick();
  }
  pause(){this.token++;this.playing=false;this.videos.forEach(v=>v.pause());this.$('comparison-play').textContent='▶ Play together';}
  async play(){
    if(this.changing)return;const token=++this.token;
    this.videos.forEach(v=>{if(v.dataset.src){v.src=v.dataset.src;delete v.dataset.src;v.load();}});
    if(this.videos.every(v=>v.ended||v.currentTime>=v.duration-.08))this.videos.forEach(v=>v.currentTime=0);
    this.playing=true;this.$('comparison-play').textContent='Ⅱ Pause together';
    const results=await Promise.allSettled(this.videos.filter(v=>!v.ended).map(v=>v.play()));if(token!==this.token)return;if(results.some(r=>r.status==='rejected'))this.pause();
  }
  choose(index){
    this.item=this.cases[index];this.loadInputConditions();const models=this.item.models.filter(m=>!m.ours);
    for(let i=1;i<=2;i++){const select=this.$('baseline-select-'+i),previous=select.value;select.replaceChildren(...models.map(m=>makeOption(m.id,m.label)));const target=previous||(i===1?'worldplay':'lingbotv2');select.value=models.some(m=>m.id===target)?target:models[Math.min(i-1,models.length-1)].id;}
    this.configure();
  }
  async loadInputConditions(){
    this.inputRequest?.abort();const request=new AbortController();this.inputRequest=request;const base=this.item.image.slice(0,this.item.image.lastIndexOf('/')+1);this.pose.clear();this.root.dataset.conditionsState='loading';this.$('comparison-prompt').textContent='Loading the supplied prompt…';const status=this.$('comparison-pose-status');status.hidden=false;status.textContent='Loading camera poses…';
    this.$('comparison-prompt-download').href=base+'input_text.txt';this.$('comparison-pose-download').href=base+'camera_pose.json';
    try{
      const responses=await Promise.all([fetch(base+'input_text.txt',{signal:request.signal}),fetch(base+'camera_pose.json',{signal:request.signal})]);if(responses.some(r=>!r.ok))throw Error('Comparison input conditions unavailable');const [prompt,poses]=await Promise.all([responses[0].text(),responses[1].json()]);if(this.inputRequest!==request)return;this.$('comparison-prompt').textContent=prompt.trim();this.pose.setData(poses,base);status.hidden=true;this.root.dataset.conditionsState='ready';this.root.dataset.conditionsKey=base;
    }catch(error){if(error.name==='AbortError'||this.inputRequest!==request)return;this.$('comparison-prompt').textContent='The input conditions could not be loaded.';status.hidden=false;status.textContent='Camera poses unavailable.';this.root.dataset.conditionsState='error';console.warn(error.message);}
  }
  configure(){
    this.pause();this.changing=true;
    const selected=[this.item.models.find(m=>m.ours),this.item.models.find(m=>m.id===this.$('baseline-select-1').value),this.item.models.find(m=>m.id===this.$('baseline-select-2').value)];
    this.videos.forEach((video,index)=>{setVideo(video,{...selected[index],poster:this.item.image});video.dataset.referenceDuration=String(selected[index].duration);});this.$('baseline-input').src=this.item.image;
    this.root.querySelectorAll('[data-compare-position]').forEach(b=>b.classList.remove('active'));this.changing=false;
  }
  async metadata(video){
    if(video.readyState>=1)return;
    await new Promise((resolve,reject)=>{const done=()=>{cleanup();resolve();},fail=()=>{cleanup();reject(Error('Comparison video unavailable'));},cleanup=()=>{video.removeEventListener('loadedmetadata',done);video.removeEventListener('error',fail);};video.addEventListener('loadedmetadata',done,{once:true});video.addEventListener('error',fail,{once:true});if(video.dataset.src){video.src=video.dataset.src;delete video.dataset.src;video.load();}});
  }
  async checkpoint(fraction,button){
    this.pause();const token=this.token;try{await Promise.all(this.videos.map(v=>this.metadata(v)));if(token!==this.token)return;const time=Math.min(...this.videos.map(v=>v.duration))*fraction;this.videos.forEach(v=>v.currentTime=time);this.root.querySelectorAll('[data-compare-position]').forEach(b=>b.classList.toggle('active',b===button));}catch(error){if(token===this.token)console.warn(error.message);}
  }
  tick(){
    if(this.playing){
      const ready=this.videos.filter(v=>Number.isFinite(v.duration));const clock=ready.reduce((a,b)=>!a||b.duration>a.duration?b:a,null);
      if(clock){for(const video of ready){if(video===clock)continue;if(clock.currentTime>=video.duration-.04){if(!video.paused)video.pause();continue;}if(video.readyState>=2&&Math.abs(video.currentTime-clock.currentTime)>.1)video.currentTime=clock.currentTime;}}
    }
    requestAnimationFrame(()=>this.tick());
  }
}

// Load the point-cloud renderer and binary assets only near the applications.
function memoryPanel(prefix){
  const panel=$(prefix+'-memory-panel'),host=$(prefix+'-memory-canvas'),status=$(prefix+'-memory-status'),download=$(prefix+'-memory-download');let visible=false,entry=null,message='',selection=0,viewer=null;
  async function render(){
    if(!visible)return;const current=selection;
    if(!entry?.ply){if(viewer)viewer.showMemory(null,prefix);host.dataset.status='missing';status.hidden=false;status.textContent=message||'Input point cloud coming soon.';return;}
    try{const module=await import('./assets/js/continuation-memory.js');if(current!==selection)return;viewer=module;module.showMemory(entry,prefix);}catch(error){if(current!==selection)return;host.dataset.status='error';status.hidden=false;status.textContent='The input point cloud could not be loaded.';console.warn(error.message);}
  }
  new IntersectionObserver(entries=>{visible=entries[0].isIntersecting;if(visible&&host.dataset.status!=='ready'&&host.dataset.status!=='loading')render();},{rootMargin:'300px'}).observe(panel);
  return {setEntry(value,pendingMessage=''){
    selection++;viewer?.clearMemory(prefix);entry=value;message=pendingMessage;host.dataset.status=value?.ply?'queued':'missing';status.hidden=false;status.textContent=pendingMessage||(value?.ply?'Loading input memory…':'Input point cloud coming soon.');$(prefix+'-memory-reset').disabled=true;$(prefix+'-memory-count').textContent='';download.hidden=!value?.ply;if(value?.ply)download.href=value.ply;else download.removeAttribute('href');render();
  }};
}

// Two visible cases per page, cycling through all third-person examples.
const identityCarousel=$('identity-carousel'),identityCards=[...identityCarousel.querySelectorAll('[data-identity-index]')];
let identityPage=0,identityVisible=false,identityHovered=false,identityPaused=matchMedia('(prefers-reduced-motion: reduce)').matches,identityLastAdvance=performance.now();
function showIdentityPage(page){
  const pages=Math.ceil(identityCards.length/2);identityPage=((page%pages)+pages)%pages;identityCards.forEach((card,index)=>{const shown=Math.floor(index/2)===identityPage;card.hidden=!shown;card.setAttribute('aria-hidden',String(!shown));if(!shown)card.querySelector('video').pause();});
  identityCarousel.dataset.page=String(identityPage);identityLastAdvance=performance.now();requestAnimationFrame(positionIdentityArrows);
}
function positionIdentityArrows(){
 const video=identityCards.find(card=>!card.hidden)?.querySelector('video');if(!video)return;const rect=video.getBoundingClientRect(),host=identityCarousel.getBoundingClientRect();if(rect.height>0)identityCarousel.style.setProperty('--identity-video-center',`${rect.top-host.top+rect.height/2}px`);
}
new ResizeObserver(positionIdentityArrows).observe(identityCarousel.querySelector('.identity-grid'));
function updateIdentityRotation(){const button=$('identity-rotation');button.textContent=identityPaused?'▶ Resume rotation':'Ⅱ Pause rotation';button.setAttribute('aria-pressed',String(identityPaused));button.setAttribute('aria-label',identityPaused?'Resume automatic case rotation':'Pause automatic case rotation');}
$('identity-prev').addEventListener('click',()=>showIdentityPage(identityPage-1));$('identity-next').addEventListener('click',()=>showIdentityPage(identityPage+1));$('identity-rotation').addEventListener('click',()=>{identityPaused=!identityPaused;identityLastAdvance=performance.now();updateIdentityRotation();});
identityCarousel.addEventListener('pointerenter',()=>identityHovered=true);identityCarousel.addEventListener('pointerleave',()=>{identityHovered=false;identityLastAdvance=performance.now();});
for(const video of identityCarousel.querySelectorAll('video'))for(const event of ['play','pause','ended'])video.addEventListener(event,()=>identityLastAdvance=performance.now());
new IntersectionObserver(entries=>{identityVisible=entries[0].isIntersecting;identityLastAdvance=performance.now();},{threshold:.1}).observe(identityCarousel);
document.addEventListener('visibilitychange',()=>identityLastAdvance=performance.now());
setInterval(()=>{
 const focused=identityCarousel.contains(document.activeElement)&&document.activeElement.closest('.media-card');const playing=identityCards.some(card=>!card.hidden&&!card.querySelector('video').paused&&!card.querySelector('video').ended);
 if(!identityPaused&&identityVisible&&!identityHovered&&!focused&&!playing&&!document.hidden&&!dialog.open&&performance.now()-identityLastAdvance>=8000)showIdentityPage(identityPage+1);
},250);
showIdentityPage(0);updateIdentityRotation();

fetch('assets/media-catalog.json').then(response=>{if(!response.ok)throw Error('Missing media catalog');return response.json();}).then(catalog=>{
  const rollouts=catalog.third_person_consistency??catalog.long_horizon_consistency;
  document.querySelectorAll('[data-identity-index]').forEach(card=>{const item=rollouts[Number(card.dataset.identityIndex)];if(!item)return;setVideo(card.querySelector('video'),item);card.querySelector('h3').textContent=item.title;card.querySelector('[data-identity-duration]').textContent=duration(item.duration);});
  const continuation=catalog.video_continuation;
  continuation.forEach((item,index)=>$('continuation-picker').append(makeOption(String(index),item.title)));
  const continuationPanel=memoryPanel('continuation'),compositionPanel=memoryPanel('composition');
  const continuationManifest=fetch('assets/continuation-memories.json').then(r=>{if(!r.ok)throw Error('Missing continuation memory index');return r.json();});
  const compositionManifest=fetch('assets/composition-memories.json').then(r=>{if(!r.ok)throw Error('Missing composition memory index');return r.json();});
  let continuationSelection=0,compositionSelection=0;
  async function chooseContinuation(index){
    const item=continuation[index];if(!item)return;setVideo($('continuation-video'),item);const selection=++continuationSelection;continuationPanel.setEntry(null,'Loading input memory…');
    try{const manifest=await continuationManifest;if(selection!==continuationSelection)return;continuationPanel.setEntry(manifest.cases[item.video]);}catch(error){if(selection===continuationSelection)continuationPanel.setEntry(null,'The input point cloud could not be loaded.');console.warn(error.message);}
  }
  continuationManifest.then(manifest=>continuation.forEach((item,index)=>{$('continuation-picker').options[index].textContent=`${String(index+1).padStart(2,'0')} / ${manifest.cases[item.video]?.label??item.title}`;})).catch(()=>{});
  if(continuation.length)chooseContinuation(0);$('continuation-picker').addEventListener('change',event=>chooseContinuation(Number(event.target.value)));
  const compositions=catalog.scene_exploration;
  compositions.forEach((item,index)=>$('composition-picker').append(makeOption(String(index),item.title)));
  async function chooseCompositionMemory(){
    const selection=++compositionSelection;compositionPanel.setEntry(null,'Loading input memory…');
    try{const manifest=await compositionManifest;if(selection!==compositionSelection)return;const source=$('composition-memory-picker').value;const entry=source==='case'?manifest.cases[compositions[Number($('composition-picker').value)].video]:manifest.sources.find(entry=>entry.id===source);compositionPanel.setEntry(entry);}catch(error){if(selection===compositionSelection)compositionPanel.setEntry(null,'The input point cloud could not be loaded.');console.warn(error.message);}
  }
  function selectComposition(){const item=compositions[Number($('composition-picker').value)];if(!item)return;setVideo($('composition-video'),item);$('composition-memory-picker').value='case';chooseCompositionMemory();}
  $('composition-memory-picker').append(makeOption('case','Composed input · selected video'));
  compositionManifest.then(manifest=>{
    const sources=document.createElement('optgroup');sources.label='Source point clouds';for(const entry of manifest.sources)sources.append(makeOption(entry.id,`Source · ${entry.label}`));$('composition-memory-picker').append(sources);
    compositions.forEach((item,index)=>{$('composition-picker').options[index].textContent=`${String(index+1).padStart(2,'0')} / ${manifest.cases[item.video]?.label??item.title}`;});
  }).catch(()=>{});
  $('composition-picker').addEventListener('change',selectComposition);$('composition-memory-picker').addEventListener('change',chooseCompositionMemory);selectComposition();
  galleryItems=catalog.more_results;drawGallery();
  comparisonRows.push(new ComparisonRow('static',catalog.comparisons),new ComparisonRow('dynamic',catalog.comparisons));
}).catch(error=>{$('catalog-status').textContent='Some media could not be loaded. Serve this directory over HTTP and reload the page.';$('catalog-status').hidden=false;console.error(error);});

// Ordinary media yield to the focused clip; comparison videos remain a group.
document.addEventListener('play',event=>{
  const active=event.target;if(!(active instanceof HTMLVideoElement)||active.dataset.ambientLoop)return;
  if(active.dataset.comparison){document.querySelectorAll('video').forEach(video=>{if(!video.dataset.comparison&&!video.dataset.ambientLoop)video.pause();});return;}
  pauseComparison();document.querySelectorAll('video').forEach(video=>{
    if(video===active||video.dataset.ambientLoop)return;
    if((active.id==='rgb'||active.id==='geometry')&&(video.id==='rgb'||video.id==='geometry'))return;
    video.pause();
  });
},true);


const navLinks=[...document.querySelectorAll('.nav-links a')];
const sectionObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(entry.isIntersecting)navLinks.forEach(link=>link.classList.toggle('active',link.hash===`#${entry.target.id}`));
},{rootMargin:'-15% 0px -55% 0px'});
for(const id of ['explorer','memory','comparisons','method','long-horizon','applications','results'])sectionObserver.observe($(id));

// Application memories sit flush inside the automatically looping videos.
for(const prefix of ['continuation','composition']){
  const panel=$(prefix+'-memory-panel'),button=$(prefix+'-memory-expand');
  button.addEventListener('click',()=>{const expanded=panel.classList.toggle('expanded');button.setAttribute('aria-expanded',String(expanded));button.setAttribute('aria-label',expanded?'Shrink input point cloud':'Expand input point cloud');button.textContent=expanded?'⤡':'⤢';});
  document.addEventListener('keydown',event=>{if(event.key==='Escape'&&panel.classList.contains('expanded'))button.click();});
}


// Expand the independent global overview and position its layer controls.
const worldInset=$('world'),expandWorld=$('expand-world');
expandWorld.addEventListener('click',()=>{
  const expanded=worldInset.classList.toggle('expanded');
  expandWorld.setAttribute('aria-expanded',String(expanded));expandWorld.setAttribute('aria-label',expanded?'Shrink the global point cloud':'Expand the global point cloud');
  expandWorld.textContent=expanded?'⤡':'⤢';
});
const insetSettings=document.querySelector('.inset-settings'),insetMenu=insetSettings.querySelector('.inset-menu');
function positionInsetMenu(){
  if(!insetSettings.open)return;
  const box=insetSettings.getBoundingClientRect();
  insetMenu.style.left=`${Math.max(10,Math.min(innerWidth-275,box.right-265))}px`;
  const height=insetMenu.getBoundingClientRect().height;
  insetMenu.style.top=`${Math.max(10,Math.min(innerHeight-height-10,box.bottom+8))}px`;
}
insetSettings.addEventListener('toggle',positionInsetMenu);window.addEventListener('resize',positionInsetMenu);
document.addEventListener('pointerdown',event=>{if(insetSettings.open&&!insetSettings.contains(event.target))insetSettings.open=false;});
document.addEventListener('keydown',event=>{if(event.key==='Escape'){insetSettings.open=false;if(worldInset.classList.contains('expanded'))expandWorld.click();}});
window.addEventListener('scroll',()=>{if(insetSettings.open)insetSettings.open=false;},{passive:true});

