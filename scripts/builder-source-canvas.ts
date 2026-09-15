import type { SourceInspection } from "../shared/builderSourceEditing";

/** Generated static-page bridge. Messages contain inspection IDs, never helper credentials. */
export function canvasScript(
  inspection: SourceInspection,
  nonce: string,
  parentOrigin: string,
  previewPrefix = `/__kaizen-preview/${nonce}`,
) {
  const config = JSON.stringify({
    fields: inspection.fields,
    groups: inspection.groups,
    boundaries: inspection.boundaries.slice(0, 3),
    nonce,
    parentOrigin,
    previewPrefix,
  }).replace(/</g, "\\u003c");
  return (
    `const kaizenCanvas = ${config};\n` +
    String.raw`
(() => {
  const {fields, groups, boundaries, nonce, parentOrigin, previewPrefix: prefix} = kaizenCanvas;
  const send = (type, data = {}) => window.parent.postMessage({type:'kaizen-source-' + type, nonce, ...data}, parentOrigin);
  const managedReason = 'Managed elsewhere: no safe literal match.' + (boundaries.length ? ' ' + boundaries.join(' ') : ' This value may come from code or a CMS.');
  const visibleText = value => value.trim().replace(/\s+/g,' ');
  const rawUrl = value => value?.split(prefix + '/').join('/');
  const previewUrl = value => value.startsWith('/') && !value.startsWith('//') ? prefix + value : value;
  const bindings = new Map(), byElement = new Map(), applied = new Map(fields.map(f=>[f.id,f.value]));
  const fieldIds = new Set(fields.map(f=>f.id));
  const groupBindings = new Map(), modified = new Set();
  const imageUrls = new Map();
  let active, selected, hovered, dragging, timer, locked = true;
  const outline = document.createElement('div');
  outline.setAttribute('data-kaizen-overlay','');
  outline.style.cssText='position:fixed;pointer-events:none;border:2px solid #6c5dd3;border-radius:3px;z-index:2147483646;display:none;box-sizing:border-box';
  const hint = document.createElement('div');
  hint.style.cssText='position:fixed;pointer-events:none;background:#1b1d21;color:white;font:13px/1.4 Inter,system-ui,sans-serif;padding:6px 10px;border-radius:8px;z-index:2147483647;display:none;max-width:320px;box-shadow:0 6px 20px rgba(0,0,0,.25)';
  const handles = document.createElement('div');
  handles.setAttribute('data-kaizen-overlay','');
  handles.style.cssText='position:fixed;display:none;align-items:center;gap:2px;z-index:2147483647;background:white;color:#1b1d21;border:1px solid #6c5dd3;padding:2px 4px 2px 8px;border-radius:8px;font:12px/1 Inter,system-ui,sans-serif;box-shadow:0 4px 14px rgba(0,0,0,.18)';
  const moveLabel=document.createElement('span'); moveLabel.textContent='Move'; moveLabel.style.cssText='margin-right:4px;color:#6f7181'; handles.append(moveLabel);
  for (const [label,by] of [['Move section up',-1],['Move section down',1]]) {
    const button=document.createElement('button'); button.textContent=by<0?'↑':'↓'; button.setAttribute('aria-label',label);
    button.style.cssText='font:inherit;padding:5px 8px;cursor:pointer;border:0;background:transparent;border-radius:6px;color:#1b1d21';
    button.addEventListener('mouseenter',()=>button.style.background='#eeebfb'); button.addEventListener('mouseleave',()=>button.style.background='transparent');
    button.addEventListener('click',()=>{ if(!hovered?.group || locked) return; const {group,id}=hovered.group; const model=groupBindings.get(group); const order=[...model.order]; const index=order.indexOf(id), to=index+by; if(to<0 || to>=order.length) return; [order[index],order[to]]=[order[to],order[index]]; reorder(group,order); send('order',{id:group,order}); });
    handles.append(button);
  }
  document.body.append(outline,hint,handles);
  const attrNames = ['href','src','poster','alt','title','placeholder','aria-label'];
  function mapFields() {
    const retained=[...bindings.entries()].filter(([id])=>modified.has(id)).flatMap(([id,list])=>list.filter(b=>b.element.isConnected&&(!b.node||b.node.isConnected)).map(b=>({...b,id})));
    bindings.clear(); byElement.clear(); groupBindings.clear();
    const elements=[...document.body.querySelectorAll('*')].filter(el=>!el.closest('[data-kaizen-overlay],astro-island[ssr]') && !['SCRIPT','STYLE','NOSCRIPT'].includes(el.tagName));
    const buckets=new Map();
    for(const field of fields) {
      if(field.design)continue;
      const key=field.kind+'\0'+(field.kind==='text'?visibleText(field.value):field.value)+'\0'+(field.registration?.blockId||'');
      if(!buckets.has(key)) buckets.set(key,[]); buckets.get(key).push(field);
    }
    for(const matches of buckets.values()) {
      const sample=matches[0]; if(!sample.value) continue;
      const candidates=[];
      for(const element of elements) {
        if(retained.some(b=>b.element===element))continue;
        if(sample.registration) {const owner=element.closest('[data-kaizen-block]');if(!owner || owner.getAttribute('data-kaizen-block')!==sample.registration.id || owner.getAttribute('data-kaizen-block-id')!==sample.registration.blockId)continue;}
        const attrs=sample.kind==='link'?['href']:sample.kind==='image'?['src','poster','srcset']:attrNames.filter(a=>!['href','src','poster'].includes(a));
        for(const attr of attrs) if(rawUrl(element.getAttribute(attr))===sample.value) candidates.push({element,attr,initialSrcset:element.getAttribute('srcset')});
        if(sample.kind==='text') {
          const nodes=[...element.childNodes].filter(n=>n.nodeType===Node.TEXT_NODE && (getComputedStyle(element).whiteSpace==='normal'||getComputedStyle(element).whiteSpace==='nowrap'?visibleText(n.textContent)===visibleText(sample.value):n.textContent.trim()===sample.value));
          for(const node of nodes) candidates.push({element,node,initialText:node.textContent,before:node.textContent.match(/^\s*/)[0],after:node.textContent.match(/\s*$/)[0]});
        }
      }
      // Equal counts establish an occurrence mapping. Mismatches remain explicit choices.
      candidates.forEach((binding,index)=>{
        const possible=candidates.length===matches.length ? [matches[index]] : matches;
        const ids=possible.map(f=>f.id);
        const existing=byElement.get(binding.element)||[];
        existing.push({...binding,ids}); byElement.set(binding.element,existing);
        for(const id of ids) { const list=bindings.get(id)||[]; list.push({...binding,ambiguous:ids.length!==1 || candidates.length!==matches.length}); bindings.set(id,list); }
        if(binding.node && binding.element.childNodes.length===1 && !binding.element.hasAttribute('tabindex')) binding.element.tabIndex=0;
      });
    }
    for(const binding of retained) {
      const {id}=binding;const list=bindings.get(id)||[];list.push(binding);bindings.set(id,list);
      const previous=byElement.get(binding.element)||[];previous.push({...binding,ids:[id]});byElement.set(binding.element,previous);
    }
    for(const field of fields.filter(f=>f.design&&f.registration)) {
      const owners=elements.filter(el=>el.getAttribute('data-kaizen-block')===field.registration.id&&el.getAttribute('data-kaizen-block-id')===field.registration.blockId);
      for(const element of owners) {
        const binding={element,design:field.design,registration:field.registration,ambiguous:owners.length!==1,ids:[field.id]};
        bindings.set(field.id,[binding]);const previous=byElement.get(element)||[];previous.push(binding);byElement.set(element,previous);
      }
    }
    for(const group of groups) {
      const nodes=group.items.map(item=>{
        const found=(item.fieldIds||[]).flatMap(id=>bindings.get(id)||[]).filter(b=>!b.ambiguous);
        if(!found.length) return null;
        return found[0].element;
      });
      if(nodes.some(n=>!n)) continue;
      // Find a common parent with exactly one immediate child per source item, in order.
      let parent=nodes[0].parentElement;
      while(parent && parent!==document.body.parentElement) {
        const children=[...parent.children].filter(el=>!['SCRIPT','STYLE'].includes(el.tagName)&&!el.hasAttribute('data-kaizen-overlay'));
        if(children.length===nodes.length && children.every((child,i)=>child===nodes[i]||child.contains(nodes[i]))) {
          const items=new Map(group.items.map((item,i)=>[item.id,children[i]]));
          for(const child of children) child.draggable=true;
          groupBindings.set(group.id,{parent,items,structural:children.every(el=>['SECTION','ARTICLE','HEADER','FOOTER'].includes(el.tagName)),order:group.items.map(i=>i.id)}); break;
        }
        parent=parent.parentElement;
      }
    }
  }
  function pick(element) {
    const target=element.closest('a,img,video')||element;
    const registered=target.closest('[data-kaizen-block]');
    const found=[]; let node=target;
    for(let depth=0;node && node!==document.body && depth<3;depth++,node=node.parentElement) {
      found.push(...(byElement.get(node)||[]));
      if(found.length) break;
    }
    if(registered) {found.push(...(byElement.get(registered)||[]));for(const child of registered.querySelectorAll('*'))found.push(...(byElement.get(child)||[]));}
    if(target.tagName==='A') for(const child of target.querySelectorAll('*')) found.push(...(byElement.get(child)||[]));
    let group, structural=false;
    for(const [id,model] of groupBindings) for(const [item,child] of model.items)
      if((child===target || child.contains(target)) && (!structural || model.structural)) {group={group:id,id:item};structural=model.structural;}
    return {element:target,registrationId:registered?.getAttribute('data-kaizen-block'),ids:[...new Set(found.flatMap(b=>b.ids))],found,group};
  }
  function highlight(picked) {
    if(!picked) return; hovered=picked;
    const rect=picked.element.getBoundingClientRect(), editable=picked.ids.length>0;
    Object.assign(outline.style,{display:'block',left:rect.left+'px',top:rect.top+'px',width:rect.width+'px',height:rect.height+'px',borderColor:editable?'#6c5dd3':'#9a9cad',borderStyle:editable?'solid':'dashed'});
    hint.textContent=editable?'Double-click or press Enter to edit':managedReason;
    Object.assign(hint.style,{display:editable?'none':'block',left:Math.max(4,Math.min(rect.left,innerWidth-324))+'px',top:Math.max(4,rect.top-40)+'px'});
    handles.style.display=picked.group&&!locked?'flex':'none';
    if(picked.group) {const section=groupBindings.get(picked.group.group).items.get(picked.group.id).getBoundingClientRect();Object.assign(handles.style,{left:Math.max(4,Math.min(innerWidth-88,section.right-80))+'px',top:Math.max(4,section.top-32)+'px'});}
  }
  function changeValue(id,value) {
    // Keep SSR bytes untouched until an actual edit; source whitespace may differ from rendered JSX.
    if(value===applied.get(id)&&!modified.has(id))return;
    modified.add(id);
    for(const binding of bindings.get(id)||[]) {
      if(binding.ambiguous) continue;
      if(binding.design) {
        const design=binding.design;
        if(design.min!==undefined && (!/^-?\d+(?:\.\d+)?$/.test(value)||!Number.isFinite(Number(value))||Number(value)<design.min||Number(value)>design.max))continue;
        if(design.min===undefined&&!/^(#[a-f0-9]{3,8}|transparent|white|black)$/i.test(value))continue;
        const devices=['desktop','tablet','mobile'];
        for(const device of devices.slice(devices.indexOf(design.device))) {
          if(device!==design.device&&fields.some(f=>f.design?.device===device&&f.design.property===design.property&&f.registration?.blockId===binding.registration.blockId))break;
          binding.element.style.setProperty('--'+device[0]+'-'+design.property,value+design.unit);
        }
      } else if(binding.attr) {
        binding.element.setAttribute(binding.attr,binding.attr==='srcset'?value.replace(/(^|,\s*|\s+)(\/[^\s,]+)/g,(_match,before,url)=>before+previewUrl(url)):['href','src','poster'].includes(binding.attr)?previewUrl(value):value);
        if(binding.attr==='src' && binding.initialSrcset) {
          if(value===applied.get(id)) binding.element.setAttribute('srcset',binding.initialSrcset);
          else binding.element.removeAttribute('srcset');
        }
      }
      else if(binding.node) binding.node.textContent=value===applied.get(id)?binding.initialText:(binding.before||'')+value+(binding.after||'');
    }
  }
  function flush() {
    clearTimeout(timer);
    if(!active?.changed)return;
    // A debounced edit has already been sent. Blur must not replay it after a
    // parent Undo; only a subsequent input may make this field dirty again.
    active.changed=false;
    modified.add(active.id);
    send('edit',{id:active.id,value:active.element.textContent.slice(0,20000)});
  }
  function finish(revert=false) {
    if(!active) return;
    if(revert) { clearTimeout(timer); const value=applied.get(active.id); active.element.textContent=value; send('edit',{id:active.id,value}); }
    else flush();
    const {element,id}=active; element.removeAttribute('contenteditable');
    for(const binding of bindings.get(id)||[]) if(binding.element===element && binding.node) binding.node=element.firstChild;
    active=undefined;
  }
  function edit(picked) {
    if(locked) return;
    const candidates=picked.found.filter(b=>b.node && (b.element===picked.element||picked.element.contains(b.element)) && b.ids.length===1 && b.element.childNodes.length===1 && !(bindings.get(b.ids[0])||[]).some(v=>v.ambiguous));
    if(candidates.length!==1) return;
    finish(); const candidate=candidates[0];
    active={id:candidate.ids[0],element:candidate.element}; active.element.setAttribute('contenteditable','plaintext-only'); active.element.focus();
    const range=document.createRange();range.selectNodeContents(active.element); const selection=getSelection(); selection.removeAllRanges();selection.addRange(range);
  }
  function reorder(id,order) {
    const model=groupBindings.get(id); if(!model || !Array.isArray(order) || order.length!==model.items.size || new Set(order).size!==order.length || order.some(item=>!model.items.has(item))) return;
    // Moving an unchanged Astro island can trigger its connection/hydration lifecycle again.
    if(order.every((item,index)=>item===model.order[index])) return;
    const marker=document.createComment('kaizen-order'); model.parent.insertBefore(marker,model.items.get(model.order[0]));
    for(const item of order) model.parent.insertBefore(model.items.get(item),marker);
    marker.remove();model.order=[...order];
  }
  document.addEventListener('pointermove',event=>{if(!(event.target instanceof Element)||event.target.closest('[data-kaizen-overlay]')||active)return; highlight(pick(event.target));},true);
  document.addEventListener('click',event=>{
    if(!(event.target instanceof Element)||event.target.closest('[data-kaizen-overlay]'))return;
    if(active?.element.contains(event.target))return;
    finish();event.preventDefault();event.stopImmediatePropagation();selected=pick(event.target); highlight(selected);
    send('select',{ids:selected.ids,registrationId:selected.registrationId,reason:selected.ids.length?'':managedReason});
  },true);
  document.addEventListener('dblclick',event=>{if(event.target instanceof Element && !event.target.closest('[data-kaizen-overlay]')) {event.preventDefault();edit(pick(event.target));}},true);
  document.addEventListener('keydown',event=>{
    if(event.key==='Escape') { finish(true); event.preventDefault(); }
    else if(event.key==='Enter' && !active && event.target instanceof Element && !event.target.closest('[data-kaizen-overlay]')) {event.preventDefault();edit(pick(event.target));}
    else if(event.key.toLowerCase()==='z' && (event.ctrlKey||event.metaKey) && !active) {event.preventDefault();send(event.shiftKey?'redo':'undo');}
  },true);
  document.addEventListener('input',event=>{if(active?.element===event.target) {active.changed=true;clearTimeout(timer);timer=setTimeout(flush,150);}},true);
  document.addEventListener('focusout',event=>{if(active?.element===event.target)finish();},true);
  document.addEventListener('dragstart',event=>{
    if(locked || active || !(event.target instanceof Element)) {event.preventDefault();return;}
    const picked=pick(event.target); if(!picked.group) {event.preventDefault();return;}
    dragging=picked.group;event.dataTransfer.effectAllowed='move';event.dataTransfer.setData('text/plain','Move section');
  },true);
  document.addEventListener('dragover',event=>{if(dragging && event.target instanceof Element && pick(event.target).group?.group===dragging.group)event.preventDefault();},true);
  document.addEventListener('drop',event=>{
    if(!dragging || locked || !(event.target instanceof Element))return;
    event.preventDefault();const target=pick(event.target).group;
    if(target?.group===dragging.group) {const model=groupBindings.get(target.group);const order=[...model.order];const from=order.indexOf(dragging.id),to=order.indexOf(target.id);order.splice(from,1);order.splice(to,0,dragging.id);reorder(target.group,order);send('order',{id:target.group,order});}
    dragging=undefined;
  },true);
  document.addEventListener('dragend',()=>{dragging=undefined;},true);
  window.addEventListener('message',event=>{
    if(event.source!==window.parent || event.origin!==parentOrigin || event.data?.nonce!==nonce)return;
    const data=event.data;
    if(data.type==='kaizen-source-hello') send('ready');
    else if(data.type==='kaizen-source-state') {
      locked=Boolean(data.locked);
      if(locked && active)finish();
      const keepImages=new Set();
      for(const field of fields) {
        let value=typeof data.values?.[field.id]==='string'?data.values[field.id]:field.value;
        const image=data.images?.[field.id];
        // Blob URLs belong to their creator's storage partition. Receive bytes from the
        // authenticated parent and create the URL here; never fetch through the helper.
        if(field.kind==='image' && image && typeof image.key==='string' && image.key.length<=200 && image.blob instanceof Blob && image.blob.size<=32*1024*1024 && /^image\/(png|jpeg|webp|avif|gif|svg\+xml)$/i.test(image.blob.type)) {
          if(!imageUrls.has(image.key))imageUrls.set(image.key,URL.createObjectURL(image.blob));
          keepImages.add(image.key);value=imageUrls.get(image.key);
        }
        if(active?.id!==field.id) changeValue(field.id,value);
      }
      for(const [key,url] of imageUrls)if(!keepImages.has(key)){URL.revokeObjectURL(url);imageUrls.delete(key);}
      for(const group of groups) reorder(group.id,data.orders?.[group.id]||group.items.map(i=>i.id));
    } else if(data.type==='kaizen-source-focus' && fieldIds.has(data.id)) {
      const binding=bindings.get(data.id)?.[0]; if(binding) {binding.element.scrollIntoView({block:'center'}); selected=pick(binding.element);highlight(selected);}
    } else if(data.type==='kaizen-source-scroll') window.scrollTo(0,Math.max(0,Number(data.y)||0));
  });
  let scrollTimer;
  window.addEventListener('resize',()=>{if(selected||hovered)highlight(selected||hovered);});
  window.addEventListener('scroll',()=>{if(selected||hovered)highlight(selected||hovered);clearTimeout(scrollTimer);scrollTimer=setTimeout(()=>send('scroll',{y:scrollY}),150);}, {passive:true});
  document.addEventListener('astro:hydrate',()=>{if(!active){mapFields();send('ready');}},true);
  mapFields();
  // Hydrated islands may replace nodes after initial load. Rebind only while no text is being edited.
  const observer=new MutationObserver(()=>{if(!active && [...bindings.values()].some(list=>list.some(b=>!b.element.isConnected))) {clearTimeout(observer.timer);observer.timer=setTimeout(()=>{mapFields();send('ready');},200);}});
  observer.observe(document.body,{childList:true,subtree:true});
  send('ready');
})();
`
  );
}
