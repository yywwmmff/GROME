// Resource URLs are intentionally empty until the paper and code are public.
for(const link of document.querySelectorAll('[data-placeholder-link]'))link.addEventListener('click',event=>event.preventDefault());
import {ComparisonPose} from './assets/js/comparison-pose.js?v=bilingual-v14';
const $=id=>document.getElementById(id);
const mediaObserver=new IntersectionObserver(entries=>{
  for(const {target,isIntersecting} of entries){
    if(isIntersecting&&target.dataset.src){target.src=target.dataset.src;delete target.dataset.src;target.load();}
    if(!isIntersecting&&!target.dataset.comparison)target.pause();
  }
},{rootMargin:'160px'});
function setVideo(video,item){
  video.pause();video.removeAttribute('src');video.load();
  video.poster=item.poster??'';const cover=video.parentElement.querySelector('.external-video-cover');if(cover)cover.src=video.poster;video.dataset.src=item.video;mediaObserver.observe(video);
  const box=video.getBoundingClientRect();
  if(box.width>0&&box.height>0&&box.top<innerHeight+160&&box.bottom>-160){video.src=video.dataset.src;delete video.dataset.src;video.load();}
}
const duration=t=>`${Math.floor(t/60)}:${String(Math.floor(t%60)).padStart(2,'0')}`;
const makeOption=(value,label)=>{const option=document.createElement('option');option.value=value;option.textContent=label;return option;};
// Image choices share the same selection treatment throughout the page.
function sceneThumbnails(host,items,choose){
  const buttons=items.map((item,index)=>{const button=document.createElement('button');button.type='button';button.className='scene-thumbnail';button.dataset.sceneIndex=String(index);const label=item.title??item.label??'Scene';button.title=label;button.setAttribute('aria-label',`Select ${label}`);button.setAttribute('aria-pressed','false');const image=document.createElement('img');image.src=item.input_image??item.poster??item.image;image.alt='';image.loading='lazy';button.append(image);button.addEventListener('click',()=>choose(index));return button;});
  host.replaceChildren(...buttons);
  return {select(index){host.dataset.selectedIndex=String(index);buttons.forEach((button,i)=>button.setAttribute('aria-pressed',String(i===index)));},label(index,label){buttons[index].title=label;buttons[index].setAttribute('aria-label',`Select ${label}`);}};
}
function cyclicSceneSteps(prefix,count,choose){
  const step=offset=>{const index=Number($(prefix+'-thumbnails').dataset.selectedIndex??0);choose((index+offset+count)%count);};
  $(prefix+'-previous').addEventListener('click',()=>step(-1));$(prefix+'-next').addEventListener('click',()=>step(1));
}
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
let stopGalleryPreview=()=>{};
const galleryPreviewObserver=new IntersectionObserver(entries=>{
  for(const entry of entries)if(!entry.isIntersecting&&entry.target.classList.contains('is-previewing'))stopGalleryPreview();
});
document.addEventListener('visibilitychange',()=>{if(document.hidden)stopGalleryPreview();});
function attachGalleryPreview(button,imageBox,item,existingPreview=null){
  const preview=existingPreview??document.createElement('video');preview.className='gallery-preview';preview.muted=true;preview.defaultMuted=true;preview.loop=true;preview.playsInline=true;preview.preload='none';preview.setAttribute('aria-hidden','true');preview.tabIndex=-1;imageBox.append(preview);
  let requested=false;
  const stop=()=>{requested=false;preview.pause();if(preview.readyState)preview.currentTime=0;button.classList.remove('is-previewing');};
  const start=()=>{
    if(dialog.open||document.hidden)return;
    stopGalleryPreview();stopGalleryPreview=stop;requested=true;button.classList.add('is-previewing');
    if(preview.dataset.src){preview.src=preview.dataset.src;delete preview.dataset.src;}
    if(!preview.hasAttribute('src'))preview.src=(typeof item==='function'?item():item).video;
    preview.play().catch(()=>{if(requested)stop();});
  };
  button.addEventListener('pointerenter',event=>{if(event.pointerType==='mouse')start();});
  button.addEventListener('pointerleave',stop);
  button.addEventListener('focus',()=>{if(button.matches(':focus-visible'))start();});
  button.addEventListener('blur',stop);
  galleryPreviewObserver.observe(button);
}
function drawGallery(){
  stopGalleryPreview();
  $('gallery-grid').querySelectorAll('.gallery-card').forEach(card=>galleryPreviewObserver.unobserve(card));
  const matched=galleryItems.filter(item=>(galleryFilter==='all'||item.scene_type===galleryFilter)&&(galleryTag==='all'||item.tags?.includes(galleryTag)));
  const visible=galleryExpanded?matched:matched.slice(0,6);
  const fragment=document.createDocumentFragment();
  for(const item of visible){
    const button=document.createElement('button');button.type='button';button.className='gallery-card';
    const title=item.category||'World exploration';const label=title.replaceAll('_',' ');
    button.setAttribute('aria-label',`Play ${prettyStyle(item.style)} ${label}`);
    const imageBox=document.createElement('div');imageBox.className='gallery-image';
    const image=document.createElement('img');image.src=item.poster;image.alt=`${prettyStyle(item.style)} ${label}`;image.loading='lazy';imageBox.append(image);attachGalleryPreview(button,imageBox,item);
    const meta=document.createElement('div');meta.className='gallery-meta';
    const heading=document.createElement('h3');heading.textContent=label.charAt(0).toUpperCase()+label.slice(1);
    const style=document.createElement('span');style.textContent=prettyStyle(item.style);meta.append(heading,style);const tags=document.createElement('div');tags.className='gallery-tag-list';for(const tag of item.tags??[]){const chip=document.createElement('small');chip.textContent=tagLabels[tag]??tag;tags.append(chip);}meta.append(tags);button.append(imageBox,meta);
    button.addEventListener('click',()=>{stopGalleryPreview();openVideo(item,`${prettyStyle(item.style)} · ${label}`);});fragment.append(button);
  }
  $('gallery-grid').replaceChildren(fragment);$('gallery-more').hidden=matched.length<=6;
  $('gallery-more').innerHTML=galleryExpanded?'Show fewer scenes <span>↑</span>':'Show more scenes <span>↓</span>';
  document.querySelectorAll('[data-gallery]').forEach(button=>{const active=button.dataset.gallery===galleryFilter;button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));});
}
document.querySelectorAll('[data-gallery]').forEach(button=>button.addEventListener('click',()=>{galleryFilter=button.dataset.gallery;galleryExpanded=false;drawGallery();}));
document.querySelectorAll('[data-gallery-tag]').forEach(button=>button.addEventListener('click',()=>{galleryTag=button.dataset.galleryTag;galleryExpanded=false;drawGallery();document.querySelectorAll('[data-gallery-tag]').forEach(b=>{const selected=b===button;b.classList.toggle('active',selected);b.setAttribute('aria-pressed',String(selected));});}));
$('gallery-more').addEventListener('click',()=>{galleryExpanded=!galleryExpanded;drawGallery();});

document.querySelectorAll('.memory-case-carousel').forEach(carousel=>{
  const cards=[...carousel.querySelectorAll('.memory-case-card')];
  const rail=carousel.querySelector('.case-thumbnail-rail');
  const show=index=>{cards.forEach((card,i)=>{card.hidden=i!==index;if(i!==index)card.querySelector('video')?.pause();});cards[index].querySelector('.memory-case-output').append(rail);navigation.select(index);};
  const navigation=sceneThumbnails(rail,cards.map(card=>({title:card.dataset.caseTitle,input_image:card.querySelector('.memory-case-input img').getAttribute('src')})),show);show(0);
});

// Read recorded camera controls for every memory example and follow its video clock.
fetch('assets/memory-cases.json').then(response=>{if(!response.ok)throw Error('Missing memory cases');return response.json();}).then(manifest=>{
  const items=[...manifest.static,...manifest.dynamic];
  document.querySelectorAll('[data-memory-case]').forEach(card=>{
    const item=items.find(item=>item.id===card.dataset.memoryCase);if(!item)return;
    const video=card.querySelector('video'),keys=[...card.querySelectorAll('[data-memory-key]')];
    const segmentKeys=segment=>[...(segment?.keys??[]),...(segment?.look?segment.look.split('+'):[])];
    const used=new Set(item.actions.flatMap(segmentKeys));let frameToken=0;
    const update=()=>{const time=video.currentTime,segment=item.actions.find(segment=>time>=segment.start&&time<segment.end),active=segmentKeys(segment);
      keys.forEach(button=>{const pressed=active.includes(button.dataset.memoryKey);button.classList.toggle('active',pressed);button.setAttribute('aria-pressed',String(pressed));});
    };
    const seek=time=>{const apply=()=>{video.currentTime=Math.min(time+.001,Math.max(0,video.duration-.001));update();};if(video.readyState>=1)apply();else{video.addEventListener('loadedmetadata',apply,{once:true});video.load();}};
    keys.forEach(button=>{button.disabled=!used.has(button.dataset.memoryKey);button.addEventListener('click',()=>{const matches=item.actions.filter(segment=>segmentKeys(segment).includes(button.dataset.memoryKey));const next=matches.find(segment=>segment.start>video.currentTime+.05)??matches[0];if(next)seek(next.start);});});
    for(const event of ['timeupdate','seeking','seeked','loadedmetadata','ended'])video.addEventListener(event,update);
    video.addEventListener('play',()=>{const token=++frameToken;const tick=()=>{if(token!==frameToken||video.paused)return;update();if(video.requestVideoFrameCallback)video.requestVideoFrameCallback(tick);else requestAnimationFrame(tick);};tick();});
    video.addEventListener('pause',()=>{frameToken++;update();});update();
  });
}).catch(error=>console.warn(error.message));

const comparisonRows=[];
const comparisonVideos=[];
function pauseComparison(){comparisonRows.forEach(row=>row.pause());}
class ComparisonRow{
  constructor(scene,catalog){
    this.scene=scene;this.prefix=scene==='static'?'':'dynamic-';this.$=id=>document.getElementById(this.prefix+id);this.root=document.querySelector(`[data-comparison-row="${scene}"]`);this.cases=catalog.filter(item=>item.scene===scene);this.videos=[this.$('baseline-ours'),this.$('baseline-video-1')];this.playing=false;this.changing=false;this.token=0;this.baselineModelId='worldplay';
    this.pose=new ComparisonPose(this.$('comparison-pose'),this.videos[0]);
    new ResizeObserver(()=>{const height=this.videos[0].getBoundingClientRect().height;if(height>0)this.root.style.setProperty('--comparison-video-height',`${height}px`);}).observe(this.videos[0]);
    this.videos.forEach(video=>{video.dataset.comparison='true';comparisonVideos.push(video);});
    this.sceneNavigation=sceneThumbnails(this.$('comparison-scene-thumbnails'),this.cases,index=>this.choose(index));
    this.$('comparison-play').addEventListener('click',()=>this.playing?this.pause():this.play());
    this.$('comparison-restart').addEventListener('click',()=>{const resume=this.playing;this.pause();this.videos.forEach(v=>{if(v.readyState>=1)v.currentTime=0;});if(resume)this.play();});
    for(const button of this.root.querySelectorAll('[data-compare-position]'))button.addEventListener('click',()=>this.checkpoint(Number(button.dataset.comparePosition),button));
    for(const video of this.videos){
      video.addEventListener('play',()=>{if(!this.playing&&!this.changing)this.play();});
      video.addEventListener('pause',()=>{if(this.playing&&!this.changing&&video.paused&&!video.ended&&video.currentTime<video.duration-.08)this.pause();});
      video.addEventListener('ended',()=>{if(this.playing&&!this.changing&&video.ended)this.repeat();});
      video.addEventListener('seeking',()=>{if(this.changing)return;for(const other of this.videos)if(other!==video&&other.readyState>=1){const target=Math.min(video.currentTime,Math.max(0,other.duration-.001));if(Math.abs(other.currentTime-target)>.1)other.currentTime=target;}});
    }
    new IntersectionObserver(entries=>{if(entries.some(e=>!e.isIntersecting))this.pause();},{threshold:.01}).observe(this.root);
    this.choose(0);this.tick();
  }
  pause(){this.token++;this.playing=false;this.videos.forEach(v=>v.pause());this.$('comparison-play').textContent='▶ Play together';}
  repeat(){
    if(!this.playing||this.changing)return;this.changing=true;this.token++;
    this.videos.forEach(video=>video.pause());this.videos.forEach(video=>{if(video.readyState>=1)video.currentTime=0;});
    this.root.querySelectorAll('[data-compare-position]').forEach(button=>button.classList.remove('active'));this.changing=false;this.play();
  }
  async play(){
    if(this.changing)return;const token=++this.token;
    this.videos.forEach(v=>{if(v.dataset.src){v.src=v.dataset.src;delete v.dataset.src;v.load();}});
    if(this.videos.some(v=>v.ended||v.currentTime>=v.duration-.08))this.videos.forEach(v=>v.currentTime=0);
    this.playing=true;this.$('comparison-play').textContent='Ⅱ Pause together';
    const results=await Promise.allSettled(this.videos.filter(v=>!v.ended).map(v=>v.play()));if(token!==this.token)return;if(results.some(r=>r.status==='rejected'))this.pause();
  }
  choose(index){
    this.item=this.cases[index];this.sceneNavigation.select(index);this.loadInputConditions();const models=this.item.models.filter(m=>!m.ours);
    if(!models.some(m=>m.id===this.baselineModelId))this.baselineModelId=models.find(m=>m.id==='worldplay')?.id||models[0]?.id;
    const track=this.$('baseline-track');track.querySelectorAll('video').forEach(video=>video.pause());
    track.replaceChildren(...models.map(model=>{const button=document.createElement('button');button.type='button';button.className='comparison-model-option';button.dataset.modelId=model.id;button.setAttribute('role','tab');button.setAttribute('aria-selected',String(model.id===this.baselineModelId));button.setAttribute('aria-label',`Compare GROME with ${model.label}`);
      const preview=document.createElement('video');preview.dataset.ambientLoop='true';preview.muted=true;preview.defaultMuted=true;preview.loop=true;preview.playsInline=true;preview.preload='none';preview.poster=`assets/comparison-previews/${this.item.id}/${model.id}.jpg`;preview.dataset.previewSrc=`assets/comparison-previews/${this.item.id}/${model.id}.mp4`;preview.setAttribute('aria-hidden','true');
      const label=document.createElement('span');label.textContent=model.label;button.append(preview,label);button.addEventListener('click',()=>this.selectBaseline(model.id));return button;}));
    this.previewObserver?.disconnect();this.previewObserver=new IntersectionObserver(entries=>{for(const {target,isIntersecting} of entries){if(isIntersecting&&!matchMedia('(prefers-reduced-motion: reduce)').matches){if(!target.currentSrc)target.src=target.dataset.previewSrc;target.play().catch(()=>{});}else target.pause();}},{threshold:.1});track.querySelectorAll('video').forEach(video=>this.previewObserver.observe(video));
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
    const selected=[this.item.models.find(m=>m.ours),this.item.models.find(m=>m.id===this.baselineModelId)];
    this.videos.forEach((video,index)=>{setVideo(video,{...selected[index],poster:this.item.image});video.dataset.referenceDuration=String(selected[index].duration);});this.$('baseline-input').src=this.item.image;
    this.updateModelSelection();
    this.root.querySelectorAll('[data-compare-position]').forEach(b=>b.classList.remove('active'));this.changing=false;
  }
  updateModelSelection(){
    const model=this.item.models.find(model=>model.id===this.baselineModelId);
    this.$('baseline-track').querySelectorAll('[role=tab]').forEach(button=>button.setAttribute('aria-selected',String(button.dataset.modelId===this.baselineModelId)));
    this.$('baseline-model-name').textContent=model.label;this.$('baseline-video-1').setAttribute('aria-label',`${model.label} comparison video`);this.root.dataset.selectedModel=model.id;
  }
  async selectBaseline(id){
    if(id===this.baselineModelId)return;const resume=this.playing,time=this.videos[0].currentTime;this.pause();const token=this.token;this.changing=true;this.baselineModelId=id;
    const model=this.item.models.find(model=>model.id===id),video=this.videos[1];setVideo(video,{...model,poster:this.item.image});video.dataset.referenceDuration=String(model.duration);this.updateModelSelection();
    try{await this.metadata(video);if(token!==this.token)return;video.currentTime=Math.min(time,Math.max(0,video.duration-.001));this.changing=false;if(resume)this.play();}catch(error){if(token===this.token){this.changing=false;console.warn(error.message);}}
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
      const ready=this.videos.filter(v=>Number.isFinite(v.duration));const clock=ready.reduce((a,b)=>!a||b.duration<a.duration?b:a,null);
      if(clock){for(const video of ready){if(video===clock)continue;if(video.readyState>=2&&Math.abs(video.currentTime-clock.currentTime)>.1)video.currentTime=clock.currentTime;}}
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

// One selected case, with its input image, prompt, and synchronized recorded inputs.
const identityCarousel=$('identity-carousel'),identityCards=[...identityCarousel.querySelectorAll('[data-identity-index]')];
let identityItems=[],identityNavigation=null,identityPage=0;
function showIdentityPage(page){
  const pages=identityCards.length;identityPage=((page%pages)+pages)%pages;
  identityCards.forEach((card,index)=>{const shown=index===identityPage;card.hidden=!shown;card.setAttribute('aria-hidden',String(!shown));if(!shown)card.querySelector('video').pause();});
  identityCarousel.dataset.page=String(identityPage);identityNavigation?.select(identityPage);updateIdentityInputs();
}
function selectedIdentityVideo(){return identityCards[identityPage].querySelector('video');}
function identitySegmentKeys(segment){return [...(segment?.keys??[]),...(segment?.look?segment.look.split('+'):[])];}
function updateIdentityInputs(){
  const item=identityItems[identityPage];if(!item)return;
  $('identity-input-image').src=item.input_image;$('identity-input-image').alt=`Input image for ${item.title}`;
  $('identity-prompt').textContent=item.prompt;
  const usedKeys=new Set((item.actions??[]).flatMap(identitySegmentKeys));
  for(const key of identityCarousel.querySelectorAll('[data-identity-key]'))key.disabled=!usedKeys.has(key.dataset.identityKey);
  updateIdentityAction();
}
function updateIdentityAction(){
  const item=identityItems[identityPage],video=selectedIdentityVideo(),time=video.currentTime;
  const segment=item?.actions?.find(segment=>time>=segment.start&&time<segment.end);
  const keys=identitySegmentKeys(segment);
  for(const button of identityCarousel.querySelectorAll('[data-identity-key]')){const active=keys.includes(button.dataset.identityKey);button.classList.toggle('active',active);button.setAttribute('aria-pressed',String(active));}
}
function seekIdentity(time){
  const video=selectedIdentityVideo();
  const seek=()=>{video.currentTime=Math.min(time+.001,Math.max(0,video.duration-.001));updateIdentityAction();};
  if(video.readyState>=1)seek();else{video.addEventListener('loadedmetadata',seek,{once:true});if(video.dataset.src){video.src=video.dataset.src;delete video.dataset.src;video.load();}}
}
for(const button of identityCarousel.querySelectorAll('[data-identity-key]'))button.addEventListener('click',()=>{
  const item=identityItems[identityPage],key=button.dataset.identityKey,time=selectedIdentityVideo().currentTime;
  const matches=(item?.actions??[]).filter(segment=>identitySegmentKeys(segment).includes(key));
  const next=matches.find(segment=>segment.start>time+.05)??matches[0];if(next)seekIdentity(next.start);
});
for(const video of identityCarousel.querySelectorAll('video'))for(const event of ['timeupdate','seeking','seeked','loadedmetadata','ended'])video.addEventListener(event,()=>{if(video===selectedIdentityVideo())updateIdentityAction();});
showIdentityPage(0);

fetch('assets/media-catalog.json').then(response=>{if(!response.ok)throw Error('Missing media catalog');return response.json();}).then(catalog=>{
  const rollouts=catalog.third_person_consistency;
  identityItems=rollouts;
  identityNavigation=sceneThumbnails($('identity-scene-thumbnails'),rollouts,showIdentityPage);identityNavigation.select(identityPage);
  document.querySelectorAll('[data-identity-index]').forEach(card=>{const item=rollouts[Number(card.dataset.identityIndex)];if(!item)return;setVideo(card.querySelector('video'),item);card.querySelector('video').setAttribute('aria-label',item.title);});
  updateIdentityInputs();
  const continuation=catalog.video_continuation,compositions=catalog.scene_exploration;
  const continuationPanel=memoryPanel('continuation'),compositionPanel=memoryPanel('composition');
  const continuationManifest=fetch('assets/continuation-memories.json').then(r=>{if(!r.ok)throw Error('Missing continuation memory index');return r.json();});
  const compositionManifest=fetch('assets/composition-memories.json').then(r=>{if(!r.ok)throw Error('Missing composition memory index');return r.json();});
  for(const [prefix,items] of [['continuation',continuation],['composition',compositions]]){
    const stage=$(prefix+'-video-stage'),video=$(prefix+'-video');
    const selected=()=>items[Number($(prefix+'-thumbnails').dataset.selectedIndex??0)];
    const cover=document.createElement('img');cover.className='external-video-cover';cover.alt='';cover.loading='lazy';stage.prepend(cover);
    attachGalleryPreview(stage,stage,selected,video);
    stage.addEventListener('click',()=>{stopGalleryPreview();const item=selected();openVideo(item,item.title??'World exploration');});
  }
  let continuationSelection=0,compositionSelection=0,compositionIndex=0;
  async function chooseContinuation(index){
    const item=continuation[index];if(!item)return;stopGalleryPreview();continuationNavigation.select(index);setVideo($('continuation-video'),item);const selection=++continuationSelection;continuationPanel.setEntry(null,'Loading input memory…');
    try{const manifest=await continuationManifest;if(selection!==continuationSelection)return;continuationPanel.setEntry(manifest.cases[item.video]);}catch(error){if(selection===continuationSelection)continuationPanel.setEntry(null,'The input point cloud could not be loaded.');console.warn(error.message);}
  }
  const continuationNavigation=sceneThumbnails($('continuation-thumbnails'),continuation,chooseContinuation);cyclicSceneSteps('continuation',continuation.length,chooseContinuation);
  continuationManifest.then(manifest=>continuation.forEach((item,index)=>continuationNavigation.label(index,manifest.cases[item.video]?.label??item.title))).catch(()=>{});
  if(continuation.length)chooseContinuation(0);
  async function chooseCompositionMemory(){
    const selection=++compositionSelection;compositionPanel.setEntry(null,'Loading input memory…');
    try{const manifest=await compositionManifest;if(selection!==compositionSelection)return;const entry=manifest.cases[compositions[compositionIndex].video];compositionPanel.setEntry(entry);}catch(error){if(selection===compositionSelection)compositionPanel.setEntry(null,'The input point cloud could not be loaded.');console.warn(error.message);}
  }
  function selectComposition(index){compositionIndex=index;const item=compositions[index];if(!item)return;stopGalleryPreview();compositionNavigation.select(index);setVideo($('composition-video'),item);chooseCompositionMemory();}
  const compositionNavigation=sceneThumbnails($('composition-thumbnails'),compositions,selectComposition);cyclicSceneSteps('composition',compositions.length,selectComposition);
  compositionManifest.then(manifest=>compositions.forEach((item,index)=>compositionNavigation.label(index,manifest.cases[item.video]?.label??item.title))).catch(()=>{});
  if(compositions.length)selectComposition(0);
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
for(const id of ['capabilities','long-horizon','applications','memory','explorer','method','comparisons','results'])sectionObserver.observe($(id));

// Expand the input-memory panels beside the application videos.
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

