// Deterministic, cumulative component reveals. The timeline explains the method;
// it is not a recording of model execution.
const SVG_NS='http://www.w3.org/2000/svg';
const clamp=value=>Math.max(0,Math.min(1,value));
const ease=value=>{value=clamp(value);return value*value*(3-2*value);};
// Source slides used a dark palette; adapt vector fills without altering their bitmap evidence.
function prepareDiagramTheme(svg){
  for(const node of svg.querySelectorAll('[fill],[stroke]')){
    const text=Boolean(node.closest('text'));
    for(const attr of ['fill','stroke']){
      const color=node.getAttribute(attr);if(!/^#[0-9a-f]{6}$/i.test(color??''))continue;
      const rgb=[1,3,5].map(offset=>parseInt(color.slice(offset,offset+2),16)),light=rgb.reduce((a,b)=>a+b,0)/3;
      let replacement;
      if(text)replacement=['#e2e8ed','#b6c1ca','#d5e4eb'].includes(color)?'var(--text)':`color-mix(in srgb, ${color} 25%, #27313b)`;
      else if(attr==='fill'&&color==='#1d3921')replacement='#376847';
      else if(attr==='fill'&&light<125)replacement=`color-mix(in srgb, ${color} 9%, var(--surface))`;
      else if(attr==='stroke')replacement=`color-mix(in srgb, ${color} 55%, #58616a)`;
      if(replacement){node.dataset['light'+attr[0].toUpperCase()+attr.slice(1)]='';node.style.setProperty('--diagram-light-'+attr,replacement);}
    }
  }
}
class DiagramPlayer{
  constructor(element){
    this.element=element;this.stage=element.querySelector('.diagram-stage');this.tabs=[...element.querySelectorAll('[data-diagram-step]')];
    this.playbackRate=Math.max(.1,Number(element.dataset.playbackRate)||1);
    this.playButton=element.querySelector('.diagram-play');this.overview=element.querySelector('.diagram-overview');
    this.paused=matchMedia('(prefers-reduced-motion: reduce)').matches;this.full=this.paused;this.time=.5;this.last=0;this.visible=false;this.index=-2;this.parts=[];
    const controls=element.querySelector('.diagram-playback');
    this.replay=this.button('↺ Replay','Replay the component animation',()=>{this.full=false;this.time=0;this.paused=false;this.last=0;this.updatePlayback();this.render();});controls.prepend(this.replay);
    const footer=element.querySelector('.diagram-explainer');const navigation=document.createElement('div');navigation.className='diagram-step-navigation';
    this.previous=this.button('←','Previous component',()=>this.jump(Math.max(0,this.currentIndex()-1)));
    this.next=this.button('→','Next component',()=>this.jump(Math.min(this.steps.length-1,this.currentIndex()+1)));
    navigation.append(this.previous,this.next);footer.append(navigation);
    this.scrub=document.createElement('input');this.scrub.type='range';this.scrub.min='0';this.scrub.step='.05';this.scrub.value='0';this.scrub.className='diagram-scrub';this.scrub.setAttribute('aria-label','Component animation position');footer.append(this.scrub);
    this.scrub.addEventListener('input',()=>{this.paused=true;this.full=false;this.time=Number(this.scrub.value);this.render();this.updatePlayback();});
    this.tabs.forEach((button,chapter)=>button.addEventListener('click',()=>{if(this.steps)this.jump(this.steps.findIndex(step=>step.chapter===chapter));}));
    this.overview.addEventListener('click',()=>{this.full=true;this.paused=true;this.render();this.updatePlayback();});
    this.playButton.addEventListener('click',()=>{if(this.full){this.full=false;this.time=0;}this.paused=!this.paused;this.last=0;this.render();this.updatePlayback();});
    new IntersectionObserver(entries=>{this.visible=entries[0].isIntersecting;this.element.classList.toggle('is-offscreen',!this.visible);this.last=0;},{threshold:.1}).observe(element);
    this.setEnabled(false);this.load();this.updatePlayback();requestAnimationFrame(time=>this.tick(time));
  }
  button(label,aria,callback){const button=document.createElement('button');button.type='button';button.textContent=label;button.setAttribute('aria-label',aria);button.addEventListener('click',callback);return button;}
  setEnabled(value){[...this.tabs,this.playButton,this.overview,this.replay,this.previous,this.next,this.scrub].forEach(control=>control.disabled=!value);}
  async load(){
    try{
      const response=await fetch(this.element.dataset.asset);if(!response.ok)throw Error('Figure asset unavailable');
      const doc=new DOMParser().parseFromString(await response.text(),'image/svg+xml');if(doc.querySelector('parsererror'))throw Error('Figure could not be parsed');
      this.svg=document.importNode(doc.documentElement,true);this.svg.removeAttribute('width');this.svg.removeAttribute('height');prepareDiagramTheme(this.svg);
      let start=0;this.steps=JSON.parse(this.svg.dataset.animationSteps).map(step=>{const item={...step,start};start+=step.duration;return item;});this.contentDuration=start;this.duration=start+3;
      this.scrub.max=String(this.contentDuration);this.element.querySelector('.diagram-vector').append(this.svg);
      this.parts=[...this.svg.querySelectorAll('[data-reveal]')].map(node=>{
        const index=Number(node.dataset.reveal),delay=Number(node.dataset.delay??0),part={node,index,start:this.steps[index].start+delay,lastOpacity:-1,paths:[]};
        const connector=node.closest('.flow-line')||node.querySelector('.flow-line');
        if(connector){
          for(const path of node.querySelectorAll('path')){
            if(!path.getAttribute('stroke')||path.getAttribute('stroke')==='none')continue;
            try{
              const length=path.getTotalLength();if(length<1)continue;
              const dot=document.createElementNS(SVG_NS,'circle');dot.setAttribute('r','53');dot.setAttribute('fill','#ffd2a9');dot.setAttribute('stroke','#10161c');dot.setAttribute('stroke-width','18');dot.style.display='none';dot.setAttribute('aria-hidden','true');path.parentNode.append(dot);
              part.paths.push({path,length,dot,lastDraw:-1});
            }catch{/* Non-geometric source paths remain ordinary reveal layers. */}
          }
        }
        return part;
      });
      this.stage.classList.add('is-vector');this.element.dataset.ready='true';this.stage.dataset.totalParts=String(this.parts.length);this.setEnabled(true);this.render();
    }catch(error){this.element.dataset.ready='fallback';this.stage.querySelector('.diagram-fallback span').textContent='The animated figure is unavailable.';const note=this.element.querySelector('.figure-resource span');if(note)note.textContent='Open the full figure for a static view. Serve this folder over HTTP for the component animation.';console.warn(error.message);}
  }
  currentIndex(){if(!this.steps)return 0;if(this.full)return this.steps.length-1;for(let i=this.steps.length-1;i>=0;i--)if(this.time>=this.steps[i].start)return i;return 0;}
  jump(index){if(!this.steps||index<0)return;this.full=false;this.paused=true;this.time=this.steps[index].start+this.steps[index].duration-.01;this.last=0;this.render();this.updatePlayback();}
  render(){
    if(!this.steps)return;
    const index=this.currentIndex();let shown=0;
    for(const part of this.parts){
      const progress=this.full?1:clamp((this.time-part.start)/.55),opacity=ease(progress);
      if(opacity!==part.lastOpacity){part.node.style.opacity=String(opacity);part.node.style.visibility=opacity===0?'hidden':'visible';part.node.style.pointerEvents=opacity===0?'none':'';part.lastOpacity=opacity;}
      if(part.node.dataset.transferDelta){const [dx,dy]=JSON.parse(part.node.dataset.transferDelta),move=this.full?1:ease((this.time-part.start)/1.05);part.node.style.transform=`translate(${dx*(1-move)}px,${dy*(1-move)}px)`;}
      if(opacity>.99)shown++;
      for(const line of part.paths){
        const draw=this.full?1:clamp((this.time-part.start)/.8);
        if(draw!==line.lastDraw){line.path.style.strokeDasharray=String(line.length);line.path.style.strokeDashoffset=String(line.length*(1-ease(draw)));line.lastDraw=draw;}
        if(draw>0&&draw<1){const point=line.path.getPointAtLength(line.length*ease(draw));line.dot.setAttribute('cx',String(point.x));line.dot.setAttribute('cy',String(point.y));line.dot.style.display='';}else line.dot.style.display='none';
      }
    }
    this.stage.dataset.visibleParts=String(shown);this.stage.dataset.activeStep=this.full?'all':String(index);this.stage.dataset.activeChapter=this.full?'all':String(this.steps[index].chapter);
    const state=this.full?-1:index;
    if(state!==this.index){
      this.index=state;const step=this.steps[index];this.tabs.forEach((button,chapter)=>button.setAttribute('aria-pressed',String(!this.full&&chapter===step.chapter)));
      this.overview.setAttribute('aria-pressed',String(this.full));this.element.querySelector('.diagram-counter').textContent=this.full?'ALL':`${String(index+1).padStart(2,'0')} / ${this.steps.length}`;
      this.element.querySelector('.diagram-caption-title').textContent=this.full?'The complete diagram':step.title;
      this.element.querySelector('.diagram-caption-copy').textContent=this.full?(this.element.dataset.diagram==='core-idea'?'GROME keeps persistent scene geometry and recent entity states separately retrievable, grounding both place and motion.':'Local scene retrieval and recent entity references guide a frozen video backbone through separate, training-free conditioning pathways.'):step.copy;
    }
    const fraction=this.full?1:Math.min(1,this.time/this.contentDuration);this.element.querySelector('.diagram-track span').style.width=`${fraction*100}%`;this.scrub.value=String(this.full?this.contentDuration:Math.min(this.time,this.contentDuration));
    this.previous.disabled=!this.full&&index===0;this.next.disabled=index===this.steps.length-1;
  }
  updatePlayback(){this.element.classList.toggle('is-paused',this.paused);this.playButton.textContent=this.paused?'▶ Play':'Ⅱ Pause';this.playButton.setAttribute('aria-label',this.paused?'Play component animation':'Pause component animation');}
  tick(time){
    if(this.visible&&!this.paused&&this.steps&&!document.hidden){if(this.last)this.time+=Math.min(time-this.last,100)/1000*this.playbackRate;if(this.time>=this.duration){this.time=0;this.index=-2;}this.render();}
    this.last=time;requestAnimationFrame(next=>this.tick(next));
  }
}
for(const element of document.querySelectorAll('[data-diagram]'))new DiagramPlayer(element);
