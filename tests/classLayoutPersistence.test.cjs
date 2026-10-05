const fs=require('node:fs');
const vm=require('node:vm');
const assert=require('node:assert/strict');
const source=fs.readFileSync('js/frameProjectStore.js','utf8');
const section=(from,to)=>source.slice(source.indexOf(from),source.indexOf(to,source.indexOf(from)));
const assets=new Map();let sequence=0;
const context=vm.createContext({
  console,Set,Blob,window:{TemplateThemes:{records:data=>[...data.templateThemes.families.flatMap(family=>Object.values(family.variants)),...data.frames.flatMap(frame=>frame.templateTheme?.masks||[])]}},
  card:{templateThemes:{enabled:true,families:[{id:'custom',name:'Custom',variants:{g:{src:'data:image/png;base64,green'}}}]},version:'classRange',frames:[{templateTheme:{familyId:'custom',masks:[{src:'data:image/png;base64,custommask'}]},name:'Banner',src:'data:image/png;base64,banner',image:{runtime:true},masks:[]}],rulesRanges:[{
    kind:'class',id:'class-rules-test',visualVariant:'u',
    visualFamilies:{banner:{variants:{u:{src:'data:image/png;base64,blue'},w:{src:'data:image/png;base64,white'}}}},
    laterLevelDesign:{elements:[{entry:{kind:'frame'},definition:{name:'Fallback',src:'blob:temporary-fallback',masks:[]}}]},
  }]},
  getCustomSymbolAssets:()=>[],getCustomSetSymbolAssets:()=>[],
  saveSourceAsset:async(src)=>{const id='asset-'+(++sequence);assets.set(id,src);return {id};},
  getAssetSource:async id=>{assert.ok(assets.has(id),'hydration must reference an exported asset');return 'blob:restored-'+id;},
  archiveExtension:()=> 'png',
});
vm.runInContext(section('function stripRuntimeImages(', 'function renderProjectOptions('),context);
vm.runInContext(section('function collectAssetIds(', 'function collectCustomSymbolTokens('),context);
vm.runInContext(section('function rewriteAssetReferences(', 'function rewriteCustomSymbolReferences('),context);
vm.runInContext(section('async function archiveAsset(', 'async function exportProjectLibrary('),context);
(async()=>{
  const snapshot=await context.createProjectSnapshot();
  assert.equal(snapshot.frames[0].image,undefined,'runtime images are excluded');
  assert.ok(!JSON.stringify(snapshot).includes('blob:'),'saved layout contains no expiring image URLs');
  const ids=[...context.collectAssetIds(snapshot)];assert.equal(ids.length,6,'backup includes appearances, fallback, theme variants and theme masks');
  const map=Object.fromEntries(ids.map(id=>[id,'imported-'+id]));
  const imported=context.rewriteAssetReferences(JSON.parse(JSON.stringify(snapshot)),map);
  for(const [oldId,newId]of Object.entries(map)){assets.set(newId,assets.get(oldId));assets.delete(oldId);}
  const hydrated=await context.hydrateProjectSnapshot(imported);
  assert.ok(hydrated.rulesRanges[0].visualFamilies.banner.variants.w.src.startsWith('blob:restored-imported-'));
  assert.ok(hydrated.rulesRanges[0].laterLevelDesign.elements[0].definition.src.startsWith('blob:restored-imported-'));
  assert.equal(hydrated.rulesRanges[0].visualVariant,'u');
  assert.ok(hydrated.templateThemes.families[0].variants.g.src.startsWith('blob:restored-imported-'));
  assert.ok(hydrated.frames[0].templateTheme.masks[0].src.startsWith('blob:restored-imported-'));
  assert.equal(hydrated.frames[0].templateTheme.familyId,'custom');
  const archived=await context.archiveAsset({file(){}},{id:'stage',kind:'custom-symbol',token:'stage',name:'Stage',blob:new Blob(['image'],{type:'image/png'}),scale:1.2,verticalOffset:.08},0,[]);
  assert.equal(archived.scale,1.2);assert.equal(archived.verticalOffset,.08,'symbol alignment survives library export');
  console.log('PASS: Class layout saves all appearance assets, remaps them on import, hydrates fallback design, and exports symbol alignment.');
})().catch(error=>{console.error(error);process.exitCode=1;});
