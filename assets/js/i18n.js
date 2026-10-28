// Translate presentation text while retaining the English source and existing DOM controls.
(() => {
  const scriptURL=document.currentScript.src,root=document.documentElement;
  const normalize=value=>['cn','zh','zh-cn'].includes(String(value).toLowerCase())?'cn':'en';
  let language='en',dictionary={},lowercase=new Map(),initialized=false;
  try{language=normalize(new URL(location.href).searchParams.get('lang')??localStorage.getItem('grome-language')??'en');}catch{}
  const textSources=new WeakMap(),attributeSources=new WeakMap(),svgSources=new WeakMap(),cache=new Map();
  const attributes=['aria-label','aria-roledescription','title','alt','placeholder','content'];
  const skip=element=>!element||element.closest('script,style,[data-no-i18n]');
  function translate(source){
    if(language!=='cn'||!source)return source;
    const key=source.trim().replace(/\s+/g,' ');if(cache.has(key))return cache.get(key);
    let result=dictionary[key]??lowercase.get(key.toLowerCase())??lowercase.get(key.toLowerCase()+'.');
    if(result===undefined){
      let m;
      if((m=key.match(/^([▶Ⅱ↺↻←→↑↓]+\s*)(.+)$/)))result=m[1]+translate(m[2]);
      else if((m=key.match(/^(Static|Dynamic) scene (\d+)$/i)))result=`${m[1].toLowerCase()==='static'?'静态':'动态'}场景 ${m[2]}`;
      else if((m=key.match(/^(?:Static scene|Dynamic scene) ((?:Static|Dynamic) scene \d+)$/i)))result=translate(m[1]);
      else if((m=key.match(/^Rollout (\d+)$/i)))result=`生成序列 ${m[1]}`;
      else if((m=key.match(/^Camera-controlled exploration (\d+)$/i)))result=`相机控制案例 ${m[1]}`;
      else if((m=key.match(/^Real-video continuation (\d+)$/i)))result=`真实视频续写 ${m[1]}`;
      else if((m=key.match(/^Memory-composed exploration (\d+)$/i)))result=`组合记忆生成 ${m[1]}`;
      else if((m=key.match(/^Case (\d+) of (\d+)$/i)))result=`案例 ${m[1]}，共 ${m[2]} 个`;
      else if((m=key.match(/^Revealed through ([\d.]+)s$/i)))result=`已显示至 ${m[1]} 秒`;
      else if((m=key.match(/^QUERY (\d+)$/)))result=`查询 ${m[1]}`;
      else if((m=key.match(/^([\d.,]+[KMB]?) points$/i)))result=`${m[1]} 个点`;
      else if((m=key.match(/^(\d+(?:\.\d+)?) s$/)))result=`${m[1]} 秒`;
      else if((m=key.match(/^Return (\d+)$/i)))result=`第 ${m[1]} 次返回`;
      else if((m=key.match(/^chunk (.+)$/i)))result=`片段 ${m[1]}`;
      else if((m=key.match(/^Input image for (.+)$/i)))result=`${translate(m[1])}的输入图像`;
      else if((m=key.match(/^Compare GROME with (.+)$/)))result=`对比 GROME 与 ${translate(m[1])}`;
      else if((m=key.match(/^(.+) comparison video$/)))result=`${translate(m[1])}对比视频`;
      else if((m=key.match(/^looking (up|down|left|right)$/i)))result=translate(`Look ${m[1]}`);
      else if((m=key.match(/^moving (forward|backward|left|right)$/i)))result=translate(`Move ${m[1]}`);
      else if((m=key.match(/^Jump to the next (.+) segment$/)))result=`跳转到下一段 ${m[1]} 动作`;
      else if((m=key.match(/^Jump to (.+)$/i)))result=`跳转至${translate(m[1])}`;
      else if((m=key.match(/^Select (.+)$/)))result=`选择${translate(m[1])}`;
      else if((m=key.match(/^Choose (.+)$/)))result=`选择${translate(m[1])}`;
      else if((m=key.match(/^Play (.+)$/)))result=`播放${translate(m[1])}`;
      else if((m=key.match(/^(.+) at ([\d.]+) seconds$/)))result=`${m[2]} 秒：${translate(m[1])}`;
      else if((m=key.match(/^(.+) along the recorded camera path\.$/)))result=`沿已记录的相机轨迹${translate(m[1]).replace(/。$/,'')}。`;
      else if((m=key.match(/^Turn the camera (.+)\.$/)))result=`将相机朝${translate(m[1])}转动。`;
      else if((m=key.match(/^(.+) Frames (\d+)[–-](\d+)$/)))result=`${translate(m[1])} 帧 ${m[2]}–${m[3]}`;
      else if((m=key.match(/^Replay (.+), (.+), ([\d.]+) seconds$/)))result=`重播${translate(m[1])}，${translate(m[2])}，${m[3]} 秒`;
      else if((m=key.match(/^Inspect (.+), (.+)$/)))result=`查看 ${m[1]}，${translate(m[2])}`;
      else if((m=key.match(/^(.+): inspect this scene viewpoint$/)))result=`${translate(m[1])}：查看此场景视角`;
      else if((m=key.match(/^(.+): inspect the same viewpoint on return$/)))result=`${translate(m[1])}：查看重访时的同一视角`;
      else if((m=key.match(/^Open (complex revisit|revisit) comparison with (.+) boxes$/)))result=`打开${m[1]==='complex revisit'?'复杂重访':'重访'}对比，显示${translate(m[2].replace(' and ',' · '))}标注框`;
      else if(key.includes(' · '))result=key.split(' · ').map(translate).join(' · ');
      else if(key.includes(' + '))result=key.split(' + ').map(translate).join(' + ');
      else if((m=key.match(/^(Dynamic scenes|Static scenes): (.+)$/)))result=`${translate(m[1])}：${translate(m[2])}`;
      else result=source.trim();
    }
    cache.set(key,result);return result;
  }
  function translateText(node){
    const parent=node.parentElement;if(skip(parent)||parent.closest('.diagram-vector text'))return;
    const current=node.nodeValue;if(!current.trim())return;
    let record=textSources.get(node);
    if(!record||current!==record.output){record={source:current,output:current};textSources.set(node,record);}
    const core=record.source.trim(),translated=translate(core),display=parent.closest('h1,h2,h3,h4,h5,h6')?translated.replace(/[.。]+$/,''):translated,output=record.source.replace(core,display);
    record.output=output;if(current!==output)node.nodeValue=output;
  }
  function translateAttributes(element){
    if(skip(element))return;
    let records=attributeSources.get(element);if(!records){records={};attributeSources.set(element,records);}
    for(const name of attributes){
      if(!element.hasAttribute(name))continue;const current=element.getAttribute(name);let record=records[name];
      if(!record||current!==record.output)record=records[name]={source:current,output:current};
      const output=translate(record.source);record.output=output;if(current!==output)element.setAttribute(name,output);
    }
  }
  function translateSvgLabel(label){
    let record=svgSources.get(label);
    if(!record){const walker=document.createTreeWalker(label,NodeFilter.SHOW_TEXT),nodes=[];while(walker.nextNode())nodes.push({node:walker.currentNode,source:walker.currentNode.nodeValue});record={nodes,source:nodes.map(x=>x.source).join('')};svgSources.set(label,record);}
    const output=translate(record.source),replace=language==='cn'&&output!==record.source.trim();
    record.nodes.forEach((item,index)=>{const text=replace?(index===0?output:''):item.source;if(item.node.nodeValue!==text)item.node.nodeValue=text;});
  }
  function scan(node){
    if(node.nodeType===Node.TEXT_NODE){
      const label=node.parentElement?.closest('.diagram-vector .TextPosition');if(label)translateSvgLabel(label);else translateText(node);return;
    }
    if(node.nodeType!==Node.ELEMENT_NODE||skip(node))return;
    translateAttributes(node);
    node.querySelectorAll('[aria-label],[aria-roledescription],[title],[alt],[placeholder],meta[content]').forEach(translateAttributes);
    const walker=document.createTreeWalker(node,NodeFilter.SHOW_TEXT);while(walker.nextNode())translateText(walker.currentNode);
    const labels=node.matches('.diagram-vector .TextPosition')?[node]:[...node.querySelectorAll('.diagram-vector .TextPosition')];
    // An SVG subtree may be added directly inside the diagram vector host.
    if(node.closest('.diagram-vector'))labels.push(...node.querySelectorAll('.TextPosition'));
    new Set(labels).forEach(translateSvgLabel);
  }
  function updateControls(){
    root.lang=language==='cn'?'zh-CN':'en';root.dataset.language=language;
    document.querySelectorAll('[data-language-choice]').forEach(button=>button.setAttribute('aria-pressed',String(button.dataset.languageChoice===language)));
  }
  function setLanguage(value,persist=true){
    language=normalize(value);updateControls();if(initialized)scan(root);
    if(persist){try{localStorage.setItem('grome-language',language);}catch{}const url=new URL(location.href);url.searchParams.set('lang',language);history.replaceState(null,'',url);}
    window.dispatchEvent(new CustomEvent('grome-language-change',{detail:language}));
  }
  window.GROME_I18N={t:translate,setLanguage,get language(){return language;}};updateControls();
  document.querySelectorAll('[data-language-choice]').forEach(button=>button.addEventListener('click',()=>setLanguage(button.dataset.languageChoice)));
  const ready=new Promise(resolve=>document.readyState==='complete'?resolve():document.addEventListener('DOMContentLoaded',resolve,{once:true}));
  Promise.all([ready,fetch(new URL('../i18n/cn.json',scriptURL),{cache:'no-cache'}).then(response=>{if(!response.ok)throw Error('Language dictionary unavailable');return response.json();})]).then(([,data])=>{
    dictionary=data;lowercase=new Map(Object.entries(data).map(([en,cn])=>[en.toLowerCase(),cn]));cache.clear();initialized=true;setLanguage(language,false);
    new MutationObserver(records=>{
      const nodes=new Set();for(const record of records){if(record.type==='characterData')nodes.add(record.target);else if(record.type==='attributes')translateAttributes(record.target);else record.addedNodes.forEach(node=>nodes.add(node));}nodes.forEach(scan);
    }).observe(root,{subtree:true,childList:true,characterData:true,attributes:true,attributeFilter:attributes});
    root.dataset.i18nReady='true';
  }).catch(error=>console.error(error.message));
})();
