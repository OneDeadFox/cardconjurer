// Experimental room-module dungeon. The original packDungeon.js remains unchanged.
var masks = [{src:'/img/frames/dungeon/regular/pinline.svg', name:'Pinline'}, {src:'/img/frames/m15/regular/m15MaskTitle.png', name:'Title'}, {src:'/img/frames/dungeon/regular/frame.svg', name:'Frame'}];
availableFrames = [
	{name:'White Frame', src:'/img/frames/dungeon/regular/w.png', complementary:6, masks:masks},
	{name:'Blue Frame', src:'/img/frames/dungeon/regular/u.png', complementary:6, masks:masks},
	{name:'Black Frame', src:'/img/frames/dungeon/regular/b.png', complementary:6, masks:masks},
	{name:'Red Frame', src:'/img/frames/dungeon/regular/r.png', complementary:6, masks:masks},
	{name:'Green Frame', src:'/img/frames/dungeon/regular/g.png', complementary:6, masks:masks},
	{name:'Colorless Frame', src:'/img/frames/dungeon/regular/c.png', complementary:6, masks:masks},
	{name:'Floor', src:'/img/frames/dungeon/regular/floor.png'}
];
document.querySelector('#loadFrameVersion').disabled = false;
document.querySelector('#loadFrameVersion').onclick = async function() {
	await resetCardIrregularities();
	card.version = 'dungeonModules';
	card.onload = '/js/frames/versionDungeon.js';
	card.artBounds = {x:0, y:0, width:1, height:1};
	autoFitArt();
	card.setSymbolBounds = {x:0.5, y:0.8967, width:0.12, height:0.0410, vertical:'center', horizontal:'center'};
	resetSetSymbol();
	card.watermarkBounds = {x:0.3027, y:0.4748, width:0.3547, height:0.6767};
	resetWatermark();
	loadTextOptions({title:{name:'Title', text:'', x:0.0854, y:0.0522, width:0.8292, height:0.0543, oneLine:true, font:'belerenbsc', size:0.0381, color:'white', align:'center'}});
	DungeonModules.initialize();
	await loadScript('/js/frames/versionDungeon.js');
	DungeonModules.mount();
	DungeonModules.render();
};
loadFramePack();
