const vm=require('node:vm'),fs=require('node:fs'),assert=require('node:assert/strict');
const ctx={card:{version:'dungeonModules',width:1000,height:1000,text:{},dungeonModules:[]},document:{querySelector(){return null}},scaleX:x=>x*1000,scaleY:y=>y*1000};ctx.window=ctx;
for(const f of ['js/dungeonModules.js','js/dungeonCorners.js'])vm.runInNewContext(fs.readFileSync(f,'utf8'),ctx);
const C=ctx.DungeonCorners,D=ctx.DungeonModules;
function room(id,x=0.1,y=0.1,w=.8,h=.8){return {id,bounds:{x,y,width:w,height:h},cornerStyles:{}};}
for(const style of ['square','rounded','beveled','inward']){
 const r=room('a');ctx.card.dungeonModules=[r];for(const key of ['tl','tr','bl','br'])r.cornerStyles[key]={style,size:.1,fades:{}};
 const model=C.geometry(D.wallSegments([r]));assert.equal(model.paths.length,1);const p=model.paths[0];assert.deepEqual(p[0],p[p.length-1],style+' remains closed');
 assert.ok(model.nodes.every(n=>n.radius<=Math.min(...Object.values(n.arms))*.45));
}
ctx.card.dungeonModules=[room('a',.1,.1,.4,.4),room('b',.5,.1,.4,.4)];
const shared=C.collect().find(n=>n.refs.length===2);assert.ok(shared);
let before,committed;ctx.createDesignStateSnapshot=()=>JSON.parse(JSON.stringify(ctx.card));ctx.commitDesignUndoSnapshot=(s)=>{before=s;committed=true;};D.render=()=>{};
C.setSettings(shared,{style:'rounded',size:.03});assert.ok(committed);assert.equal(Object.keys(before.dungeonModules[0].cornerStyles).length,0);
for(const ref of shared.refs)assert.equal(ref.room.cornerStyles[ref.key].style,'rounded');
const saved=JSON.parse(JSON.stringify(ctx.card));ctx.card=saved;ctx.card.dungeonModules[0].bounds.x=.05;assert.ok(C.collect().some(n=>n.settings.style==='rounded'&&n.x===450));
console.log('PASS: closed shapes, bounded corner sizes, shared edits, undo snapshots, save/load, moved rooms.');
