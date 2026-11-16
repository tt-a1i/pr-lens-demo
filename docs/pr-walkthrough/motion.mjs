import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath,pathToFileURL} from 'node:url';
const arcRoot=process.env.ARCHIFY_SOURCE;
if(!arcRoot)throw Error('Set ARCHIFY_SOURCE to an existing Archify repository root.');
const {parseStylesheet}=await import(pathToFileURL(path.join(arcRoot,'archify/renderers/shared/svg-bake.mjs')).href);
const {layoutReportFromSvg}=await import(pathToFileURL(path.join(arcRoot,'archify/renderers/shared/layout-report.mjs')).href);
export const here=path.dirname(fileURLToPath(import.meta.url));
export const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const quote=s=>s.replace(/[.*+?^${}()|[\]\\]/g,'\\$&');
// Primer Octicons git-pull-request-16 (MIT), used only as the PR context icon.
const prIconPath='M1.5 3.25a2.25 2.25 0 1 1 3 2.122v5.256a2.251 2.251 0 1 1-1.5 0V5.372A2.25 2.25 0 0 1 1.5 3.25Zm5.677-.177L9.573.677A.25.25 0 0 1 10 .854V2.5h1A2.5 2.5 0 0 1 13.5 5v5.628a2.251 2.251 0 1 1-1.5 0V5a1 1 0 0 0-1-1h-1v1.646a.25.25 0 0 1-.427.177L7.177 3.427a.25.25 0 0 1 0-.354ZM3.75 2.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm0 9.5a.75.75 0 1 0 0 1.5.75.75 0 0 0 0-1.5Zm8.25.75a.75.75 0 1 0 1.5 0 .75.75 0 0 0-1.5 0Z';
export function element(source,attribute,id,tag='g'){
 const start=new RegExp(`<${tag}\\b[^>]*\\b${attribute}="${quote(id)}"[^>]*>`).exec(source);
 if(!start)return null;
 if(start[0].endsWith('/>'))return {start:start.index,end:start.index+start[0].length,svg:start[0]};
 const tokens=new RegExp(`<${tag}\\b|<\\/${tag}>`,'g');tokens.lastIndex=start.index;let depth=0;
 for(let t=tokens.exec(source);t;t=tokens.exec(source)){depth+=t[0]==='<'+tag?1:-1;if(!depth){const end=t.index+t[0].length;return {start:start.index,end,svg:source.slice(start.index,end)};}}
 return null;
}
export function inside(source,id,markup){const e=element(source,'data-node-id',id);if(!e)throw Error('Missing '+id);return source.slice(0,e.end-4)+markup+source.slice(e.end-4);}
export function bounds(boxes){const x=Math.min(...boxes.map(b=>b.x)),y=Math.min(...boxes.map(b=>b.y));return {x,y,width:Math.max(...boxes.map(b=>b.x+b.width))-x,height:Math.max(...boxes.map(b=>b.y+b.height))-y};}
export function fit(box,area,max=2){const scale=Math.min(max,area.w/(box.width+28),area.h/(box.height+28));return {scale,x:area.x+area.w/2-(box.x+box.width/2)*scale,y:area.y+area.h/2-(box.y+box.height/2)*scale};}
export const transform=p=>`translate(${p.x.toFixed(3)}px,${p.y.toFixed(3)}px) scale(${p.scale.toFixed(5)})`;
export function native(id,type,theme,sourceRoot=here){
 let svg=fs.readFileSync(path.join(sourceRoot,'native',id+'-'+theme+'.svg'),'utf8');
 const layout=layoutReportFromSvg(svg,type),viewBox=svg.match(/\bviewBox="([^"]+)"/)[1].split(/[\s,]+/).map(Number);
 if(type!=='erd')for(const node of layout.nodes){
   const group=element(svg,'data-node-id',node.id);if(!group)continue;
   const labels=[...group.svg.matchAll(/<text\b[^>]*(?:data-node-label|data-detail="(?:context|fine)")[^>]*>/g)].map(m=>{
     const y=Number(/\by="([^"]+)"/.exec(m[0])?.[1]);
     const size=m[0].includes('data-node-label')?14:m[0].includes('data-detail="fine"')?10:11.5;
     return {tag:m[0],y,size};
   }).filter(t=>Number.isFinite(t.y));
   if(!labels.length)continue;
   const top=Math.min(...labels.map(t=>t.y-t.size*.8)),bottom=Math.max(...labels.map(t=>t.y+t.size*.2));
   const dy=Math.round((node.y+node.height/2-(top+bottom)/2)*10)/10;
   let centered=group.svg;for(const t of labels)centered=centered.replace(t.tag,t.tag.replace(/\by="[^"]+"/,`y="${(t.y+dy).toFixed(1)}"`));
   svg=svg.slice(0,group.start)+centered+svg.slice(group.end);
 }
 // Expand the native node badge's existing state; table-row marks stay compact.
 for(const node of layout.nodes){
   const group=element(svg,'data-node-id',node.id);if(!group)continue;
   const state=/\bdata-change="(added|modified|removed)"/.exec(group.svg.slice(0,group.svg.indexOf('>')+1))?.[1];if(!state)continue;
   const badges=[...group.svg.matchAll(new RegExp(`<g\\b[^>]*data-change-badge="${state}"[^>]*>[\\s\\S]*?<\\/g>`,'g'))];
   const badge=badges.at(-1);if(!badge)continue;
   const r=/<rect\b[^>]*\bx="([^"]+)"[^>]*\by="([^"]+)"[^>]*\bwidth="([^"]+)"/.exec(badge[0]);if(!r)continue;
   const x=Number(r[1])+Number(r[3])-54,y=Number(r[2])-2.5;
   const label={added:'+ 新增',modified:'~ 修改',removed:'− 删除'}[state];
   const revised=`<g data-change-badge="${state}" data-story-node-badge="" pointer-events="none"><rect x="${x}" y="${y}" width="54" height="18" rx="6" class="c-mask"/><rect x="${x}" y="${y}" width="54" height="18" rx="6" class="c-change-badge-${state}" stroke-width="1"/><text x="${x+27}" y="${y+12.5}" class="t-change-badge-${state}" font-size="10.5" font-weight="600" text-anchor="middle">${label}</text></g>`;
   const replacement=group.svg.slice(0,badge.index)+revised+group.svg.slice(badge.index+badge[0].length);
   svg=svg.slice(0,group.start)+replacement+svg.slice(group.end);
 }
 svg=svg.replace(/<\?xml[^>]*>\s*/,'').replace(/<rect\b[^>]*class="archify-bake-background"[^>]*\/>/g,'').replace(/<rect\b[^>]*fill="url\(#grid\)"[^>]*\/>/g,'');
 if(theme==='light')svg=svg.replaceAll('#f4f5f7','#ffffff');
 const key='native-'+id;
 for(const old of [...svg.matchAll(/\sid="([^"]+)"/g)].map(m=>m[1]))svg=svg.replace(new RegExp(`(\\s)id="${quote(old)}"`,'g'),`$1id="${key}-${old}"`).replace(new RegExp(`#${quote(old)}(?=[^\\w-]|$)`,'g'),`#${key}-${old}`);
 svg=svg.replace(/<style[^>]*>([\s\S]*?)<\/style>/g,(_,css)=>'<style><![CDATA['+parseStylesheet(css.replace(/^\s*<!\[CDATA\[|\]\]>\s*$/g,'')).map(rule=>{
  const body=`[data-native-key="${key}"] :is(${rule.selector}){${rule.declarations.map(d=>d.property+':'+d.value+(d.important?'!important':'')).join(';')}}`;
  return rule.media?rule.media+'{'+body+'}':body;
 }).join('')+']]></style>');
 const close=svg.indexOf('>'),root=svg.slice(0,close+1).replace(/\s(?:x|y|width|height)="[^"]*"/g,'');
 svg=root.replace(/>$/,` x="${viewBox[0]}" y="${viewBox[1]}" width="${viewBox[2]}" height="${viewBox[3]}">`)+svg.slice(close+1);
 svg=svg.replace(/<g([^>]*data-graph-role="automatic-crossover"[^>]*)>([\s\S]*?)<\/g>/g,(all,attrs,body)=>{
   const id=/data-edge-id="([^"]+)"/.exec(body)?.[1];return id?`<g${attrs} data-story-edge-id="${id}">${body}</g>`:all;
 });
 const paths=new Map();
 for(const match of svg.matchAll(/<path\b[^>]*>/g)){
   const attr=name=>new RegExp(`\\b${name}="([^"]*)"`).exec(match[0])?.[1];
   if(attr('data-edge-id')&&attr('d'))paths.set(attr('data-edge-id'),{d:attr('d'),marker:attr('marker-end')});
 }
 for(const m of svg.matchAll(/<g\b[^>]*data-edge-id="([^"]+)"[^>]*>/g)){
   if(paths.has(m[1]))continue;
   const group=element(svg,'data-edge-id',m[1]);if(!group)continue;
   const route=/<path\b[^>]*\bd="([^"]+)"[^>]*>/.exec(group.svg);
   if(route)paths.set(m[1],{d:route[1],marker:/marker-end="([^"]+)"/.exec(route[0])?.[1],group:true});
 }
 return {id,key,type,svg,nodes:layout.nodes,edges:layout.edges,paths,viewBox,box:bounds(layout.nodes)};
}
export class Film{
 constructor(id,pr,title,theme,duration=26){
  Object.assign(this,{id,pr,title,theme,duration});this.css=[];this.layers=[];this.bindings=new Map();this.index=0;
  this.c=theme==='dark'?{bg:'#020617',text:'#eef2f8',muted:'#a6b4c8',accent:'#34d399',amber:'#f3b64f',line:'#293548'}:{bg:'#ffffff',text:'#172033',muted:'#647184',accent:'#159f88',amber:'#ac7007',line:'#e3e8ee'};
  this.css.push(`text{font-family:system-ui,-apple-system,Segoe UI,Microsoft YaHei,sans-serif}[data-native-key] [data-legend]{display:none}[data-native-key] [data-node-label]{font-size:14px!important;font-weight:600!important}[data-native-key] text[data-detail="context"]{font-size:11.5px!important}[data-native-key] [data-detail="fine"]{font-size:10px!important}.caption-title{font-weight:650;letter-spacing:-.3px}.caption-body{font-size:17px}`);
 }
 text(value,x,y,size=17,color=this.c.text,weight=400,extra=''){return `<text x="${x}" y="${y}" font-size="${size}" fill="${color}" font-weight="${weight}" ${extra}>${escape(value)}</text>`;}
 lines(values,x,y,size=17,color=this.c.muted,gap=26){return values.map((v,i)=>this.text(v,x,y+i*gap,size,color)).join('');}
 frames(selector,values,ease='cubic-bezier(.65,0,.35,1)'){
  const name='f'+this.index++;const pct=t=>(t/this.duration*100).toFixed(5)+'%';
  this.css.push(`@keyframes ${name}{${values.map(({t,v,easing})=>`${pct(t)}{${v};animation-timing-function:${easing||ease}}`).join('')}}`);
  // Bind each selector separately so grouped fades do not replace a node's
  // camera animation simply by assigning the animation shorthand again.
  let from=0,depth=0,quoteChar='';const selectors=[];
  for(let i=0;i<selector.length;i++){
    const ch=selector[i];if(quoteChar){if(ch===quoteChar&&selector[i-1]!=='\\')quoteChar='';continue;}
    if(ch==='"'||ch==="'"){quoteChar=ch;continue;}if(ch==='('||ch==='[')depth++;if(ch===')'||ch===']')depth--;
    if(ch===','&&!depth){selectors.push(selector.slice(from,i).trim());from=i+1;}
  }
  selectors.push(selector.slice(from).trim());
  for(const sel of selectors){const names=this.bindings.get(sel)||[];names.push(name);this.bindings.set(sel,names);}return name;
 }
 view(part,{id=part.id,camera,opacity=1,classes='',hide=[]}={}){
  const selector='#camera-'+id;
  this.layers.push(`<g id="view-${id}" class="view-stage ${classes}" data-native-key="${part.key}" style="opacity:${opacity}"><g id="camera-${id}" style="transform:${transform(camera)};transform-origin:0 0">${part.svg}</g></g>`);
  hide.forEach(node=>this.css.push(`#view-${id} [data-node-id="${node}"]{visibility:hidden}`));
  return {id,selector,camera,part};
 }
 show(view,start,end=this.duration){this.frames('#view-'+view.id,[...(start?[{t:0,v:'opacity:0'},{t:start,v:'opacity:0'},{t:start+1.15,v:'opacity:1'}]:[{t:0,v:'opacity:1'}]),{t:end,v:'opacity:1'},...(end<this.duration?[{t:end+.9,v:'opacity:0'},{t:this.duration,v:'opacity:0'}]:[])]);}
 pan(view,points){this.frames(view.selector,points.map(p=>({t:p.t,v:'transform:'+transform(p.camera)})));}
 nodeSelector(view,id){return `#view-${view.id} [data-node-id="${id}"]`;}
 edgeSelector(view,id){return `#view-${view.id} [data-edge-id="${id}"],#view-${view.id} path[data-edge-id="${id}"],#view-${view.id} [data-edge-id="${id}"] path,#view-${view.id} [data-story-edge-id="${id}"]`;}
 revealNode(view,id,start,duration=1.05,shift=20){
   const node=view.part.nodes.find(n=>n.id===id),sel=this.nodeSelector(view,id);
   this.css.push(`${sel}{transform-origin:${node.x+node.width/2}px ${node.y+node.height/2}px}`);
   this.frames(sel,[{t:0,v:`opacity:0;transform:translateY(${shift}px) scale(.96)`},{t:start,v:`opacity:0;transform:translateY(${shift}px) scale(.96)`},{t:start+duration,v:'opacity:1;transform:translateY(0px) scale(1)'},{t:this.duration,v:'opacity:1;transform:translateY(0px) scale(1)'}],'cubic-bezier(.2,.8,.25,1)');
 }
 revealEdge(view,id,start,duration=1.1){
   // Native route and arrowhead stay authoritative; only their reveal changes.
   const p=view.part.paths.get(id);if(!p)return;
   const addLength=source=>{
     if(!p.group)return source.replace(new RegExp(`(<path\\b[^>]*data-edge-id="${quote(id)}"[^>]*?)(/?>)`),'$1 pathLength="1"$2');
     const g=element(source,'data-edge-id',id);if(!g)return source;
     return source.slice(0,g.start)+g.svg.replace(/(<path\b[^>]*?)(\/?>)/g,'$1 pathLength="1"$2')+source.slice(g.end);
   };
   view.part.svg=addLength(view.part.svg);
   // view() already captured the source. Apply the same harmless path-length
   // attribute to that captured layer, rather than laying out another path.
   this.layers=this.layers.map(layer=>layer.includes(`id="view-${view.id}"`)?addLength(layer):layer);
   const sel=p.group?`#view-${view.id} [data-edge-id="${id}"] path`:`#view-${view.id} path[data-edge-id="${id}"]`;
   this.frames(this.edgeSelector(view,id),[{t:0,v:'opacity:0'},{t:start,v:'opacity:0'},{t:start+.15,v:'opacity:1'},{t:this.duration,v:'opacity:1'}]);
   this.frames(sel,[{t:0,v:'stroke-dasharray:1;stroke-dashoffset:1'},{t:start,v:'stroke-dasharray:1;stroke-dashoffset:1'},{t:start+duration,v:'stroke-dasharray:1;stroke-dashoffset:0'},{t:this.duration,v:'stroke-dasharray:1;stroke-dashoffset:0'}]);
   if(p.marker)this.frames(sel,[{t:0,v:'marker-end:none'},{t:start+duration-.02,v:'marker-end:none'},{t:start+duration,v:'marker-end:'+p.marker},{t:this.duration,v:'marker-end:'+p.marker}]);
 }
 caption({id,start,end=this.duration,eyebrow,title,body=[],fact,layout='lower',subtitle,x,y,size=22,change='modified'}){
   const side=layout==='right';x??=side?592:38;y??=side?168:layout==='middle'?396:484;
   const titles=Array.isArray(title)?title:[title];
   const titleY=y+28,bodyY=titleY+titles.length*28+6;
   // Annotations occupy authored whitespace. They never paint over the graph.
   let content=eyebrow?this.text(eyebrow,x,y,11,this.c.muted):'';
   content+=this.lines(titles,x,titleY,size,this.c.text,28);
   content+=this.lines(body,x,bodyY,15,this.c.muted,24);
   const factRows=fact?(Array.isArray(fact)?fact:[fact]):[];
   if(factRows.length)content+=this.lines(factRows,x,bodyY+body.length*24+12,16,this.c.accent,25);
   if(subtitle)content+=this.text(subtitle,x,bodyY+body.length*24+12+factRows.length*25+16,11,this.c.muted);
   if(this.captionBand){
     const tone=change==='added'?this.c.accent:change==='removed'?(this.theme==='dark'?'#f291a4':'#c64458'):this.c.text;
     const order=(this.captionIndex=(this.captionIndex||0)+1)-1,total=this.captionCount||4;
     content=`<line x1="30" x2="30" y1="29" y2="96" stroke="${change==='added'?this.c.accent:change==='removed'?'#c64458':this.c.amber}" stroke-width="2"/><g transform="translate(44 35)" fill="${this.c.muted}"><path d="${prIconPath}"/></g>`;
     content+=this.text(titles.join(''),70,49,20,tone,650);
     content+=this.text(body.join('；'),44,79,14.5,this.c.muted);
     for(let i=0;i<total;i++)content+=`<rect x="${798+i*19}" y="42" width="13" height="3" rx="1.5" fill="${i<=order?this.c.accent:this.c.line}"/>`;
   }
   const selector='#caption-'+id;this.layers.push(`<g id="caption-${id}" class="film-caption" style="opacity:${start?0:1}">${content}</g>`);
   const v=[{t:0,v:`opacity:${start?0:1};transform:translateY(${start?8:0}px)`}];
   if(start)v.push({t:start,v:'opacity:0;transform:translateY(8px)'},{t:start+.65,v:'opacity:1;transform:translateY(0px)'});
   v.push({t:end,v:'opacity:1;transform:translateY(0px)'});
   if(end<this.duration)v.push({t:end+.45,v:'opacity:0;transform:translateY(-6px)'},{t:this.duration,v:'opacity:0;transform:translateY(-6px)'});
   this.frames(selector,v,'cubic-bezier(.22,.7,.2,1)');
 }
 shared(first,second,id,start,duration=1.35,{after=[],subtitle,label}={}){
   const a=first.part.nodes.find(n=>n.id===id),b=second.part.nodes.find(n=>n.id===id);
   const original=element(first.part.svg,'data-node-id',id);if(!a||!b||!original)return;
   let markup=original.svg.replace(/\sid="[^"]*"/g,'');
   const pose=camera=>{const scale=camera.scale*b.width/a.width;return {scale,x:camera.x+(b.x+b.width/2)*camera.scale-(a.x+a.width/2)*scale,y:camera.y+(b.y+b.height/2)*camera.scale-(a.y+a.height/2)*scale};};
   const target=pose(second.camera);
   if(label){
     const tag=/<text\b[^>]*data-node-label[^>]*>/.exec(markup)?.[0]||'';
     const x=Number(/\bx="([^"]+)"/.exec(tag)?.[1]||a.x+a.width/2),y=Number(/\by="([^"]+)"/.exec(tag)?.[1]||a.y+a.height/2-2);
     markup=markup.replace(tag,tag.replace(/>$/,' data-shared-label-before="">')).replace(/<\/g>$/,this.text(label,x,y,14,this.c.text,600,`data-node-label="" id="shared-label-${id}" text-anchor="middle" style="opacity:0"`)+'</g>');
     this.frames(`#shared-${id} [data-shared-label-before]`,[{t:0,v:'opacity:1'},{t:start,v:'opacity:1'},{t:start+duration*.5,v:'opacity:0'},{t:this.duration,v:'opacity:0'}]);
     this.frames('#shared-label-'+id,[{t:0,v:'opacity:0'},{t:start+duration*.5,v:'opacity:0'},{t:start+duration,v:'opacity:1'},{t:this.duration,v:'opacity:1'}]);
   }
   if(subtitle){
     const originalSubtitle=/<text\b[^>]*data-detail="context"[^>]*>/.exec(markup)?.[0]||'';
     const sx=Number(/\bx="([^"]+)"/.exec(originalSubtitle)?.[1]||a.x+a.width/2),sy=Number(/\by="([^"]+)"/.exec(originalSubtitle)?.[1]||a.y+a.height/2+14);
     markup=markup.replace(/<\/g>$/,this.text(subtitle,sx,sy,11.5,this.c.muted,400,`id="shared-subtitle-${id}" text-anchor="middle" style="opacity:0"`)+'</g>');
     this.frames(`#shared-${id} [data-node-id="${id}"]>text:not([data-node-label]):not(#shared-subtitle-${id})`,[{t:0,v:'opacity:1'},{t:start,v:'opacity:1'},{t:start+duration,v:'opacity:0'},{t:this.duration,v:'opacity:0'}]);
     this.frames('#shared-subtitle-'+id,[{t:0,v:'opacity:0'},{t:start,v:'opacity:0'},{t:start+duration,v:'opacity:1'},{t:this.duration,v:'opacity:1'}]);
   }
   const targetNode=element(second.part.svg,'data-node-id',id);
   const targetBadge=targetNode?.svg.match(/<g\b[^>]*data-story-node-badge[^>]*>[\s\S]*?<\/g>/)?.[0];
   if(targetBadge&&!markup.includes('data-story-node-badge')){
     const map=`translate(${a.x} ${a.y}) scale(${a.width/b.width}) translate(${-b.x} ${-b.y})`;
     markup=markup.replace(/<\/g>$/,`<g id="shared-badge-${id}" transform="${map}" style="opacity:0">${targetBadge}</g></g>`);
     this.frames('#shared-badge-'+id,[{t:0,v:'opacity:0'},{t:start,v:'opacity:0'},{t:start+duration,v:'opacity:1'},{t:this.duration,v:'opacity:1'}]);
   }
   this.layers.push(`<g data-native-key="${first.part.key}"><g id="shared-${id}" style="transform:${transform(first.camera)};transform-origin:0 0">${markup}</g></g>`);
   const values=[{t:0,v:'transform:'+transform(first.camera)},{t:start,v:'transform:'+transform(first.camera)},{t:start+duration,v:'transform:'+transform(target)},...after.map(p=>({t:p.t,v:'transform:'+transform(pose(p.camera))}))];
   values.push({t:this.duration,v:values[values.length-1].v});
   this.frames('#shared-'+id,values);
 }
 token(view,edgeIds,times,{id=view.id,end=this.duration,color=this.c.accent}={}){
   let animation='';
   const first=view.part.paths.get(edgeIds[0]);if(!first)return;
   const match=/M\s*([-\d.]+)[ ,]+([-\d.]+)/i.exec(first.d);if(!match)return;
   animation+=`<animateMotion begin="0s;${this.duration}s" dur=".01s" path="M${match[1]} ${match[2]} L${match[1]} ${match[2]}" fill="freeze"/>`;
   edgeIds.forEach((id,i)=>{const p=view.part.paths.get(id);if(p)animation+=`<animateMotion begin="${times[i]}s;${times[i]+this.duration}s" dur="1.5s" path="${p.d}" calcMode="spline" keyTimes="0;1" keySplines=".4 0 .2 1" fill="freeze"/>`;});
   const markup=`<circle r="5" fill="${color}" stroke="${this.c.bg}" stroke-width="2">${animation}</circle>`;
   this.layers.push(`<g data-native-key="${view.part.key}" id="token-${id}" style="transform:${transform(view.camera)};transform-origin:0 0">${markup}</g>`);
   this.frames('#token-'+id,[{t:0,v:'opacity:0'},{t:times[0]-.3,v:'opacity:0'},{t:times[0],v:'opacity:1'},{t:end,v:'opacity:1'},...(end<this.duration?[{t:end+.35,v:'opacity:0'},{t:this.duration,v:'opacity:0'}]:[])]);
 }
 output(){
   for(const [selector,names] of this.bindings)this.css.push(`${selector}{animation:${names.map(name=>`${name} ${this.duration}s linear 2 both`).join(',')}}`);
   this.css.push('@media(prefers-reduced-motion:reduce){*{animation:none!important}g[id^="token-"]{display:none}.film-caption{display:none}.film-caption:last-of-type{display:inline;opacity:1!important}}');
   const brand=this.captionBand?'':this.text(this.label||this.title,28,26,12,this.c.muted);
   const h=this.canvasHeight||640;
   let layers=this.layers.join(''),viewport='';
   if(this.diagramViewport){
     const p=this.diagramViewport,id='story-diagram-viewport';
     const captions=this.layers.filter(layer=>layer.includes('class="film-caption"'));
     const diagram=this.layers.filter(layer=>!layer.includes('class="film-caption"'));
     viewport=`<defs><clipPath id="${id}" clipPathUnits="userSpaceOnUse"><rect x="${p.x}" y="${p.y}" width="${p.width}" height="${p.height}"/></clipPath></defs>`;
     layers=`<g data-story-layer="diagram" clip-path="url(#${id})">${diagram.join('')}</g><g data-story-layer="captions">${captions.join('')}</g>`;
   }
   return `<svg xmlns="http://www.w3.org/2000/svg" width="960" height="${h}" viewBox="0 0 960 ${h}" role="img" aria-label="${escape(this.title)}"><title>${escape(this.title)}</title><style><![CDATA[${this.css.join('\n')}]]></style><rect width="960" height="${h}" fill="${this.c.bg}"/>${viewport}${layers}${brand}</svg>`;
 }
 save(){const file=path.join(here,'images',this.id+'-'+this.theme+'.svg');fs.mkdirSync(path.dirname(file),{recursive:true});fs.writeFileSync(file,this.output());return file;}
}
