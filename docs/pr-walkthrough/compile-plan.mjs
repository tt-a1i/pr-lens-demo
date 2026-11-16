import fs from 'node:fs';
import path from 'node:path';
import {Film,here,native,fit,bounds,inside,transform} from './motion.mjs';
import {plans} from './design-plans.mjs';

const plot={x:38,y:124,w:884,h:400};
const left={x:40,y:160,w:422,h:324};
const boundsFile=path.join(here,'native-content-bounds.json');
const measuredBounds=fs.existsSync(boundsFile)?JSON.parse(fs.readFileSync(boundsFile,'utf8')):{};
const fade=(film,selector,points)=>film.frames(selector,points.map(([t,v])=>({t,v:'filter:opacity('+v+')'})));
function frame(part){
 const points=part.edges.flatMap(e=>e.points||[]);
 return bounds([...part.nodes,...points.map(([x,y])=>({x:x-10,y:y-10,width:20,height:20})),...(part.contentBox?[part.contentBox]:[])]);
}
function metric(f,part,item){
 const n=part.nodes.find(n=>n.id===item.node);if(!n)throw Error('Unknown metric node '+item.node);
 const x=n.x+n.width*(item.slot==='left'?.25:item.slot==='right'?.75:.5),y=n.y+n.height+25;
 const prefix='measure-'+(item.id||item.node),color=item.tone==='neutral'?f.c.text:f.c.accent;
 const a=`<g id="${prefix}-before">${f.text(item.label,x,y,11,f.c.muted,400,'text-anchor="middle"')}${f.text(item.before,x,y+25,20,f.c.text,600,'text-anchor="middle"')}</g>`;
 const b=`<g id="${prefix}-after" style="filter:opacity(0)">${f.text(item.label,x,y,11,f.c.muted,400,'text-anchor="middle"')}${f.text(item.before+' → '+item.after,x,y+25,20,color,650,'text-anchor="middle"')}</g>`;
 part.svg=inside(part.svg,item.node,a+b);
 fade(f,'#'+prefix+'-before',[[0,1],[item.at,1],[item.at+.8,0],[f.duration,0]]);
 fade(f,'#'+prefix+'-after',[[0,0],[item.at,0],[item.at+.8,1],[f.duration,1]]);
 part.box=bounds([part.box,{x:n.x,y:n.y,width:n.width,height:n.height+65}]);
 part.extraBoxes=[...(part.extraBoxes||[]),{id:item.node,x:n.x,y:n.y,width:n.width,height:n.height+65}];
}
function excerpt(f,item){
 const code=fs.readFileSync(path.join(here,item.file),'utf8').split(/\r?\n/);
 const x=530,y=145,width=396,rows=[];
 const units=s=>[...s].reduce((n,c)=>n+(/[\u2E80-\uFFFF]/.test(c)?1:.57),0);
 for(const number of item.lines){
  const text=code[number-1];if(text===undefined)throw Error('Unknown source line '+number);
  let remaining=text,first=true;
  while(units(remaining)>27.5){
   let cut=0;while(cut<remaining.length&&units(remaining.slice(0,cut+1))<=27.5)cut++;
   const boundary=Math.max(remaining.lastIndexOf(', ',cut),remaining.lastIndexOf(' ',cut));
   if(boundary>8)cut=boundary+1;
   rows.push({line:first?number:'',sourceLine:number,text:remaining.slice(0,cut),highlight:item.highlight?.includes(number)});
   first=false;remaining='      '+remaining.slice(cut).trimStart();
  }
  rows.push({line:first?number:'',sourceLine:number,text:remaining,highlight:item.highlight?.includes(number)});
 }
 const font=rows.length>10?12.2:13.2,gap=rows.length>10?24:27;
 let content=`<line x1="506" x2="506" y1="125" y2="493" stroke="${f.c.line}"/>`;
 content+=f.text(item.title,x,y,15,f.c.text,550)+f.text(item.note,x,y+28,11.5,f.c.muted);
 const selections=item.selections||[{at:item.start,lines:item.highlight||[]}];
 rows.forEach((row,index)=>{
  const yy=y+77+index*gap;
  if(selections.some(s=>s.lines.includes(row.sourceLine))){
   const id='source-highlight-'+index;
   content+=`<rect id="${id}" x="${x+29}" y="${yy-18}" width="${width-29}" height="${gap}" fill="${f.c.accent}" fill-opacity=".075"/>`;
   let current=selections[0].lines.includes(row.sourceLine)?1:0;
   const points=[{t:0,v:'opacity:'+current}];
   for(const selection of selections.slice(1)){const next=selection.lines.includes(row.sourceLine)?1:0;points.push({t:selection.at,v:'opacity:'+current},{t:selection.at+.5,v:'opacity:'+next});current=next;}
   points.push({t:f.duration,v:'opacity:'+current});f.frames('#'+id,points);
  }
  if(row.line)content+=f.text(row.line,x,yy,10.5,f.c.muted);
  content+=f.text(row.text,x+34,yy,font,f.c.text,400,'style="font-family:Consolas,monospace;white-space:pre"');
 });
 f.layers.push(`<g id="source-detail" style="opacity:0">${content}</g>`);
 f.frames('#source-detail',[{t:0,v:'opacity:0;transform:translateX(22px)'},{t:item.start+.6,v:'opacity:0;transform:translateX(22px)'},{t:item.start+1.7,v:'opacity:1;transform:translateX(0px)'},{t:f.duration,v:'opacity:1;transform:translateX(0px)'}]);
}

function compile(plan,theme){
 const f=new Film(plan.id,plan.source.kind==='real-pr'?Number(plan.source.url.split('/').at(-1)):null,plan.question,theme,plan.duration);
 f.canvasHeight=560;f.captionBand=true;f.captionCount=plan.steps.length;
 f.diagramViewport={x:18,y:112,width:924,height:432};
 f.css.push('[data-composition-frame-kind="lane"]{fill:none!important;stroke-opacity:.28}[data-composition-frame-kind="stage"]{fill:none!important;stroke:none!important}[data-story-node-badge] text{font-size:10.5px!important}');
 const parts=Object.fromEntries(Object.entries(plan.views).map(([id,v])=>[id,native(v.model,v.type,theme)]));
 for(const [id,part] of Object.entries(parts))part.contentBox=measuredBounds[plan.views[id].model+'-'+theme];
 for(const [index,op] of (plan.relabel||[]).entries()){
  const p=parts[op.view],node=p.nodes.find(n=>n.id===op.node);if(!node)throw Error('Unknown relabel node '+op.node);
  const match=new RegExp(`(<g\\b[^>]*data-node-id="${op.node}"[^>]*>[\\s\\S]*?)(<text\\b[^>]*data-detail="context"[^>]*>)([^<]*)(<\\/text>)`).exec(p.svg);
  if(!match)throw Error('Missing native subtitle '+op.node);
  const tag=match[2],x=Number(/\bx="([^"]+)"/.exec(tag)?.[1]||node.x+node.width/2),y=Number(/\by="([^"]+)"/.exec(tag)?.[1]||node.y+node.height/2+14);
  p.svg=p.svg.replace(match[0],match[1]+tag.replace(/>$/,' id="relabel-old-'+index+'">')+match[3]+match[4]);
  p.svg=inside(p.svg,op.node,f.text(op.subtitle,x,y,11.5,f.c.muted,400,`id="relabel-new-${index}" text-anchor="middle" style="opacity:0"`));
  f.frames('#relabel-old-'+index,[{t:0,v:'opacity:1'},{t:op.at,v:'opacity:1'},{t:op.at+.8,v:'opacity:0'},{t:plan.duration,v:'opacity:0'}]);
  f.frames('#relabel-new-'+index,[{t:0,v:'opacity:0'},{t:op.at,v:'opacity:0'},{t:op.at+.8,v:'opacity:1'},{t:plan.duration,v:'opacity:1'}]);
 }
 for(const item of plan.metrics||[])metric(f,parts[item.view],item);
 const pair=plan.pair;
 let pairCamera;
 if(pair)pairCamera=fit(bounds([frame(parts[pair.before]),frame(parts[pair.after])]),plot,1.5);
 const cameras={},views={};
 for(const [id,spec] of Object.entries(plan.views)){
  const p=parts[id];cameras[id]=pair&&(id===pair.before||id===pair.after)?pairCamera:fit(bounds([frame(p),...(p.extraBoxes||[])]),plot,1.5);
  const hidden=pair&&(id===pair.before||id===pair.after)?pair.shared.map(n=>n.id):[];
  views[id]=f.view(p,{id,camera:cameras[id],opacity:pair&&id===pair.after||spec.start?0:1,hide:hidden});
  if(!pair||id!==pair.before&&id!==pair.after)f.show(views[id],spec.start||0,spec.end||plan.duration);
 }
 const cameraMoves={};
 for(const [id,v] of Object.entries(views))cameraMoves[id]=[{t:0,camera:cameras[id]}];
 const detail=plan.detail;
 const focusOps=[...(plan.focus||[]),...(detail?[{view:detail.view,nodes:detail.nodes,at:detail.start,end:detail.end,area:'left'}]:[])];
 for(const focus of focusOps){
  const p=parts[focus.view],selected=p.nodes.filter(n=>focus.nodes.includes(n.id));
  if(selected.length!==focus.nodes.length)throw Error(plan.id+': unknown focused node');
  const framed=bounds([...selected,...(p.extraBoxes||[]).filter(n=>focus.nodes.includes(n.id))]);
  const camera=fit(framed,focus.area==='left'?left:{x:200,y:150,w:560,h:360},1.55);
  cameraMoves[focus.view].push({t:focus.at,camera:cameras[focus.view]},{t:focus.at+1.5,camera});
 }
 for(const [id,points] of Object.entries(cameraMoves)){points.push({t:plan.duration,camera:points.at(-1).camera});f.pan(views[id],points);}
 if(pair){
  f.show(views[pair.before],0,pair.at);f.show(views[pair.after],pair.at,pair.until||plan.duration);
  for(const shared of pair.shared){
   if(!parts[pair.before].nodes.some(n=>n.id===shared.id)||!parts[pair.after].nodes.some(n=>n.id===shared.id))throw Error('Unknown shared identity '+shared.id);
   f.shared(views[pair.before],views[pair.after],shared.id,pair.at,1.6,{...shared,after:cameraMoves[pair.after].filter(p=>p.t>pair.at+1.6)});
   if(pair.until)fade(f,'#shared-'+shared.id,[[0,1],[pair.until,1],[pair.until+.85,0],[plan.duration,0]]);
  }
 }
 for(const op of plan.enter||[])for(const [i,id] of op.nodes.entries())f.revealNode(views[op.view],id,op.at+i*(op.stagger||.3),1.15,14);
 for(const op of plan.connect||[])for(const [i,id] of op.edges.entries()){
  if(!parts[op.view].paths.has(id))throw Error(plan.id+': missing native route '+id);
  f.revealEdge(views[op.view],id,op.at+i*(op.stagger||.4),1.1);
 }
 for(const op of plan.fade||[]){
  const selectors=[...(op.nodes||[]).map(id=>f.nodeSelector(views[op.view],id)),...(op.edges||[]).map(id=>f.edgeSelector(views[op.view],id))].join(',');
  fade(f,selectors,[[0,1],[op.at,1],[op.at+1,op.to],[plan.duration,op.to]]);
 }
 if(detail){
  const p=parts[detail.view];
  const other=p.nodes.filter(n=>!detail.nodes.includes(n.id)).flatMap(n=>[f.nodeSelector(views[detail.view],n.id),...(pair?.after===detail.view&&pair.shared.some(s=>s.id===n.id)?['#shared-'+n.id]:[])]);
  const outside=p.edges.filter(e=>!detail.nodes.includes(e.from)||!detail.nodes.includes(e.to)).map(e=>f.edgeSelector(views[detail.view],e.id));
  fade(f,[...other,...outside].join(','),[[0,1],[detail.start,1],[detail.start+1,0],[plan.duration,0]]);
  fade(f,`#view-${detail.view} text.t-dim,#view-${detail.view} [data-graph-role="structural-frame"]`,[[0,1],[detail.start,1],[detail.start+1,0],[plan.duration,0]]);
  excerpt(f,detail);
 }
 for(const op of plan.traces||[])f.token(views[op.view],op.edges,op.times,{id:op.id,end:op.end});
 for(const [i,step] of plan.steps.entries())f.caption({id:'step-'+i,start:step.at,end:plan.steps[i+1]?plan.steps[i+1].at-.65:plan.duration,title:step.title,body:[step.body],change:step.change||'modified'});
 if(plan.source.kind==='simulation')f.layers.push(f.text('模拟变更',28,541,10,f.c.muted));
 f.save();
}
const entries=[];
for(const plan of plans){
 for(const theme of ['light','dark'])compile(plan,theme);
 const typeLabels={architecture:'架构图',workflow:'流程图',dataflow:'数据流图',lifecycle:'生命周期',erd:'ER 图',tree:'结构树',class:'类型图'};
 const structures=[...new Set(Object.values(plan.views).map(v=>typeLabels[v.type]))].join(' → ');
 entries.push({id:plan.id,title:plan.title,pr:plan.source.kind==='real-pr'?Number(plan.source.url.split('/').at(-1)):null,question:plan.question,source:plan.source,structures,stills:plan.stills||plan.steps.map((s,i)=>Math.min(s.at+(plan.steps[i+1]?Math.min(3,plan.steps[i+1].at-s.at-1):3.5),plan.duration-.5)),shots:plan.steps.map(s=>s.title),duration:plan.duration});
 console.log(plan.id+' composed: '+plan.steps.length+' steps');
}
fs.writeFileSync(path.join(here,'cases.json'),JSON.stringify(entries,null,2)+'\n');
