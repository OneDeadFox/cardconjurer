//URL Params
var params = new URLSearchParams(window.location.search);
const debugging = params.get('debug') != null;
if (debugging) {
	alert('debugging - 4.0');
	document.querySelectorAll('.debugging').forEach(element => element.classList.remove('hidden'));
}

//To save the server from being overloaded? Maybe?
function fixUri(input) {
	/* --- DISABLED FOR LOCAL VERSION --
	var prefix = 'https://card-conjurer.storage.googleapis.com';//'https://raw.githubusercontent.com/ImKyle4815/cardconjurer/remake';
	if (input.includes(prefix) || input.includes('http') || input.includes('data:image') || window.location.href.includes('localhost')) {
		return input;
	} else {
		return prefix + input; //input.replace('/img/frames', prefix + '/img/frames');
	} */
	return input;
}
function setImageUrl(image, source) {
	image.crossOrigin = 'anonymous';
	image.src = fixUri(source);
}

const baseWidth = 1500;
const baseHeight = 2100;
const highResScale = 1.34;
// function getStandardWidth() {
// 	var value = baseWidth;
// 	if (localStorage.getItem('high-res') == 'true') {
// 		value *= highResScale;
// 	}
// 	return value;
// }
// function getStandardHeight() {
// 	var value = baseHeight;
// 	if (localStorage.getItem('high-res') == 'true') {
// 		value *= highResScale;
// 	}
// 	return value;
// }
function getStandardWidth() {
	return 2010;
}
function getStandardHeight() {
	return 2814;
}

// Trackers for bulk download
window.ImageLoadTracker = {
    promises: [],
    isTracking: false,

    // Call this to start a new tracking session.
    start: function() {
        this.promises = [];
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function() {
        this.isTracking = false;
        this.promises = [];
    },

    /**
     * Creates a promise that resolves when the image from 'src' is loaded.
     * Adds this promise to the tracking array.
     * @param {string} src - The source URL of the image to load.
     */
    track: function(src) {
        // Only track if a session is active and the src is valid.
        if (!this.isTracking || !src || src.includes('blank.png')) {
            return;
        }

        const promise = new Promise((resolve) => {
            const img = new Image();
            img.crossOrigin = 'anonymous';
            // Resolve the promise on load.
            img.onload = () => resolve(img);
            // Also resolve on error to prevent Promise.all from failing on a single broken image.
            // The app's own error handlers will manage displaying a blank image.
            img.onerror = () => {
                console.warn(`Could not load tracked image: ${src}`);
                resolve(null); 
            };
            img.src = src;
        });
        this.promises.push(promise);
    },

    /**
     * Returns a single promise that resolves when all tracked images have finished loading.
     */
    waitForAll: function() {
        return Promise.all(this.promises);
    }
};
window.FontLoadTracker = {
    fonts: new Set(),
    isTracking: false,

    // Call this to start a new font tracking session.
    start: function() {
        this.fonts.clear();
        this.isTracking = true;
    },

    // Call this to end the session.
    stop: function() {
        this.isTracking = false;
        this.fonts.clear();
    },

    /**
     * Adds a font family to the set of required fonts for the current card.
     * @param {string} fontFamily - The name of the font family to track (e.g., 'belerenbsc').
     */
    track: function(fontFamily) {
        if (this.isTracking && fontFamily) {
            this.fonts.add(fontFamily);
        }
    },

    /**
     * Uses the document.fonts API to wait for all tracked fonts to be loaded and ready.
     * @returns {Promise} A promise that resolves when all fonts in the set are available.
     */
    waitForAll: function() {
        if (this.fonts.size === 0) {
            return Promise.resolve(); // No fonts to wait for.
        }

        const fontPromises = [];
        // The document.fonts.load() method checks if a font is ready for use.
        // It requires a size (e.g., '12px'), but the family name is the crucial part.
        for (const font of this.fonts) {
            fontPromises.push(document.fonts.load(`12px ${font}`));
        }

        console.log('Waiting for fonts to load:', Array.from(this.fonts));
        return Promise.all(fontPromises);
    }
};

//card object
var card = {width:getStandardWidth(), height:getStandardHeight(), marginX:0, marginY:0, orientation:'portrait', orientationRotation:0, landscape:false, frames:[], artSource:fixUri('/img/blank.png'), artX:0, artY:0, artZoom:1, artRotate:0, setSymbolSource:fixUri('/img/blank.png'), setSymbolX:0, setSymbolY:0, setSymbolZoom:1, setSymbolRotate:0, watermarkSource:fixUri('/img/blank.png'), watermarkX:0, watermarkY:0, watermarkZoom:1, watermarkRotate:0, watermarkLeft:'none', watermarkRight:'none', watermarkOpacity:0.4, version:'', manaSymbols:[]};
window.cardDrawingPromiseResolver = null;
//core images/masks
const black = new Image(); black.crossOrigin = 'anonymous'; black.src = fixUri('/img/black.png');
const blank = new Image(); blank.crossOrigin = 'anonymous'; blank.src = fixUri('/img/blank.png');
const right = new Image(); right.crossOrigin = 'anonymous'; right.src = fixUri('/img/frames/maskRightHalf.png');
const middle = new Image(); middle.crossOrigin = 'anonymous'; middle.src = fixUri('/img/frames/maskMiddleThird.png');
const corner = new Image(); corner.crossOrigin = 'anonymous'; corner.src = fixUri('/img/frames/cornerCutout.png');
const serial = new Image(); serial.crossOrigin = 'anonymous'; serial.src = fixUri('/img/frames/serial.png');
//art
art = new Image(); art.crossOrigin = 'anonymous'; art.src = blank.src;
art.onerror = function() {if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}}
art.onload = artEdited;
//set symbol
setSymbol = new Image(); setSymbol.crossOrigin = 'anonymous'; setSymbol.src = blank.src;
setSymbol.onerror = function() {
	if (this.src.includes('gatherer.wizards.com')) {
		notify('<a target="_blank" href="http' + this.src.split('http')[2] + '">Loading the set symbol from Gatherer failed. Please check this link to see if it exists. If it does, it may be necessary to manually download and upload the image.</a>', 5);
	}
	if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}
}
setSymbol.onload = setSymbolEdited;
//watermark
watermark = new Image(); watermark.crossOrigin = 'anonymous'; watermark.src = blank.src;
watermark.onerror = function() {if (!this.src.includes('/img/blank.png')) {this.src = fixUri('/img/blank.png');}}
watermark.onload = watermarkEdited;
//preview canvas
var previewCanvas = document.querySelector('#previewCanvas');
var previewContext = previewCanvas.getContext('2d');
var canvasList = [];
//frame/mask picker stuff
var availableFrames = [];
var selectedFrame = null;
var selectedFrameIndex = 0;
var selectedMaskIndex = 0;
var selectedTextIndex = 0;
var replacementMasks = {};
var customCount = 0;
var lastFrameClick = null;
var lastMaskClick = null;
//for imports
var scryfallArt;
var scryfallCard;
//for text
var drawTextBetweenFrames = false;
var redrawFrames = false;
var savedTextXPosition = 0;
var savedTextXPosition2 = 0;
var savedRollYPosition = null;
var savedFont = null;
var savedTextContents = {};
//for misc
var date = new Date();
card.infoYear = date.getFullYear();
document.querySelector("#info-year").value = card.infoYear;
//to avoid rerunning special scripts (planeswalker, saga, etc...)

var loadedVersions = [];
//Card Object managament
async function resetCardIrregularities({canvas = [getStandardWidth(), getStandardHeight(), 0, 0], resetOthers = true} = {}) {
	var requestedOrientation = Number(canvas[0]) > Number(canvas[1]) ? 'landscape' : 'portrait';
	if (currentCardOrientation() !== requestedOrientation) {
		await setCardOrientation(requestedOrientation, {recordUndo:false, redraw:false});
	}
	//misc details
	card.margins = false;
	card.bottomInfoTranslate = {x:0, y:0};
	card.bottomInfoRotate = 0;
	card.bottomInfoZoom = 1;
	card.bottomInfoColor = 'white';
	replacementMasks = {};
	// Reset layout orientation before the selected frame pack applies its own coordinates.
	previewContext.setTransform(1, 0, 0, 1, 0, 0);
	card.width = canvas[0];
	card.height = canvas[1];
	card.marginX = canvas[2];
	card.marginY = canvas[3];
	card.orientationRotation = 0;
	card.setSymbolRotate = 0;
	card.watermarkRotate = 0;
	syncCardOrientationState();
	//canvases
	canvasList.forEach(name => {
		if (window[name + 'Canvas'].width != card.width * (1 + card.marginX) || window[name + 'Canvas'].height != card.height * (1 + card.marginY)) {
			sizeCanvas(name);
		}
	});
	if (resetOthers) {
		setBottomInfoStyle();
		//onload
		card.onload = null;

		card.hideBottomInfoBorder = false;
		card.showsFlavorBar = true;
	}
}
async function setBottomInfoStyle() {
	if (document.querySelector('#enableNewCollectorStyle').checked) {
			await loadBottomInfo({
				midLeft: {text:'{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}', x:0.0647, y:0.9548, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				topLeft: {text:'{elemidinfo-rarity} {kerning3}{elemidinfo-number}{kerning0}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				note: {text:'{loadx}{elemidinfo-note}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				bottomLeft: {text:'NOT FOR SALE', x:0.0647, y:0.9719, width:0.8707, height:0.0143, oneLine:true, font:'gothammedium', size:0.0143, color:card.bottomInfoColor, outlineWidth:0.003},
				wizards: {name:'wizards', text:'{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast', x:0.0647, y:0.9377, width:0.8707, height:0.0167, oneLine:true, font:'mplantin', size:0.0162, color:card.bottomInfoColor, align:'right', outlineWidth:0.003},
				bottomRight: {text:'{ptshift0,0.0172}CardConjurer.com', x:0.0647, y:0.9548, width:0.8707, height:0.0143, oneLine:true, font:'mplantin', size:0.0143, color:card.bottomInfoColor, align:'right', outlineWidth:0.003}
			});
		} else {
			await loadBottomInfo({
				midLeft: {text:'{elemidinfo-set} \u2022 {elemidinfo-language}  {savex}{fontbelerenbsc}{fontsize' + scaleHeight(0.001) + '}{upinline' + scaleHeight(0.0005) + '}\uFFEE{savex2}{elemidinfo-artist}', x:0.0647, y:0.9548, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color: card.bottomInfoColor, outlineWidth:0.003},
				topLeft: {text:'{elemidinfo-number}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				note: {text:'{loadx2}{elemidinfo-note}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				rarity: {text:'{loadx}{elemidinfo-rarity}', x:0.0647, y:0.9377, width:0.8707, height:0.0171, oneLine:true, font:'gothammedium', size:0.0171, color:card.bottomInfoColor, outlineWidth:0.003},
				bottomLeft: {text:'NOT FOR SALE', x:0.0647, y:0.9719, width:0.8707, height:0.0143, oneLine:true, font:'gothammedium', size:0.0143, color:card.bottomInfoColor, outlineWidth:0.003},
				wizards: {name:'wizards', text:'{ptshift0,0.0172}\u2122 & \u00a9 {elemidinfo-year} Wizards of the Coast', x:0.0647, y:0.9377, width:0.8707, height:0.0167, oneLine:true, font:'mplantin', size:0.0162, color:card.bottomInfoColor, align:'right', outlineWidth:0.003},
				bottomRight: {text:'{ptshift0,0.0172}CardConjurer.com', x:0.0647, y:0.9548, width:0.8707, height:0.0143, oneLine:true, font:'mplantin', size:0.0143, color:card.bottomInfoColor, align:'right', outlineWidth:0.003}
			});
		}
}
//Canvas management
function sizeCanvas(name, width = Math.round(card.width * (1 + 2 * card.marginX)), height = Math.round(card.height * (1 + 2 * card.marginY))) {
	if (!window[name + 'Canvas']) {
		window[name + 'Canvas'] = document.createElement('canvas');
		window[name + 'Context'] = window[name + 'Canvas'].getContext('2d');
		canvasList[canvasList.length] = name;
	}
	window[name + 'Canvas'].width = width;
	window[name + 'Canvas'].height = height;
	if (name == 'line') { //force true to view all canvases - must restore to name == 'line' for proper kerning adjustments
		window[name + 'Canvas'].style = 'width: 20rem; height: 28rem; border: 1px solid red;';
		const label = document.createElement('div');
		label.innerHTML = name + '<br>If you can see this and don\'t want to, please clear your cache.';
		label.appendChild(window[name + 'Canvas']);
		label.classList = 'fake-hidden'; //Comment this out to view canvases
		document.body.appendChild(label);
	}
}
//create main canvases
sizeCanvas('card');
sizeCanvas('frame');
sizeCanvas('frameMasking');
sizeCanvas('frameCompositing');
sizeCanvas('text');
sizeCanvas('paragraph');
sizeCanvas('line');
sizeCanvas('watermark');
sizeCanvas('bottomInfo');
sizeCanvas('guidelines');
sizeCanvas('prePT');
syncCardOrientationState();
//Scaling
function scaleX(input) {
	return Math.round((input + card.marginX) * card.width);
}
function scaleWidth(input) {
	return Math.round(input * card.width);
}
function scaleY(input) {
	return Math.round((input + card.marginY) * card.height);
}
function scaleHeight(input) {
	return Math.round(input * card.height);
}

function normalizeCardOrientation(value) {
	return String(value || '').toLowerCase() === 'landscape' ? 'landscape' : 'portrait';
}
function normalizeRotationDegrees(value) {
	var rotation = Number(value) || 0;
	rotation %= 360;
	if (rotation < 0) rotation += 360;
	return rotation;
}
function currentCardOrientation() {
	if (card && Number(card.width) > Number(card.height)) {
		return 'landscape';
	}
	return 'portrait';
}
function syncCardOrientationState(preferredOrientation) {
	if (!card || !previewCanvas) return;
	var inferred = currentCardOrientation();
	var orientation = preferredOrientation ? normalizeCardOrientation(preferredOrientation) : inferred;
	if ((orientation === 'landscape') !== (Number(card.width) > Number(card.height))) {
		orientation = inferred;
	}
	card.orientation = orientation;
	card.landscape = orientation === 'landscape';
	if (card.orientationRotation === undefined) {
		card.orientationRotation = 0;
	}
	var previewWidth = Math.max(1, Math.round(card.width * (1 + 2 * (Number(card.marginX) || 0)) / 2));
	var previewHeight = Math.max(1, Math.round(card.height * (1 + 2 * (Number(card.marginY) || 0)) / 2));
	if (previewCanvas.width !== previewWidth || previewCanvas.height !== previewHeight) {
		previewCanvas.width = previewWidth;
		previewCanvas.height = previewHeight;
	}
	previewContext.setTransform(1, 0, 0, 1, 0, 0);
	var select = document.querySelector('#card-orientation');
	if (select) select.value = orientation;
	var status = document.querySelector('#card-orientation-status');
	if (status) {
		status.textContent = (orientation === 'landscape' ? 'Landscape' : 'Portrait') +
			' canvas: ' + card.width + ' × ' + card.height +
			'. Changing this rotates the complete editable layout.';
	}
}
function rotateEnvelopeBounds(bounds, clockwise) {
	if (!bounds) return bounds;
	var x = Number(bounds.x) || 0;
	var y = Number(bounds.y) || 0;
	var width = Number(bounds.width) || 0;
	var height = Number(bounds.height) || 0;
	if (clockwise) {
		bounds.x = 1 - y - height;
		bounds.y = x;
	} else {
		bounds.x = y;
		bounds.y = 1 - x - width;
	}
	bounds.width = height;
	bounds.height = width;
	return bounds;
}
function rotatePositionedBounds(bounds, oldWidth, oldHeight, clockwise) {
	if (!bounds) return bounds;
	var x = Number(bounds.x) || 0;
	var y = Number(bounds.y) || 0;
	var width = Number(bounds.width);
	var height = Number(bounds.height);
	if (!Number.isFinite(width)) width = 1;
	if (!Number.isFinite(height)) height = 1;
	var pixelWidth = width * oldWidth;
	var pixelHeight = height * oldHeight;
	var centerX = (x + width / 2) * oldWidth;
	var centerY = (y + height / 2) * oldHeight;
	var newWidth = oldHeight;
	var newHeight = oldWidth;
	var rotatedCenterX = clockwise ? oldHeight - centerY : centerY;
	var rotatedCenterY = clockwise ? centerX : oldWidth - centerX;
	bounds.width = pixelWidth / newWidth;
	bounds.height = pixelHeight / newHeight;
	bounds.x = (rotatedCenterX - pixelWidth / 2) / newWidth;
	bounds.y = (rotatedCenterY - pixelHeight / 2) / newHeight;
	return bounds;
}
function rotateTextOriginBounds(bounds, oldWidth, oldHeight, clockwise) {
	if (!bounds) return bounds;
	var x = Number(bounds.x) || 0;
	var y = Number(bounds.y) || 0;
	var width = Number(bounds.width);
	var height = Number(bounds.height);
	if (!Number.isFinite(width)) width = 1;
	if (!Number.isFinite(height)) height = 1;
	var pixelWidth = width * oldWidth;
	var pixelHeight = height * oldHeight;
	if (clockwise) {
		bounds.x = 1 - y;
		bounds.y = x;
	} else {
		bounds.x = y;
		bounds.y = 1 - x;
	}
	bounds.width = pixelWidth / oldHeight;
	bounds.height = pixelHeight / oldWidth;
	return bounds;
}
function rotateRasterPlacement(placement, pixelWidth, pixelHeight, oldWidth, oldHeight, clockwise) {
	if (!placement) return placement;
	var centerX = (Number(placement.x) || 0) * oldWidth + pixelWidth / 2;
	var centerY = (Number(placement.y) || 0) * oldHeight + pixelHeight / 2;
	var rotatedCenterX = clockwise ? oldHeight - centerY : centerY;
	var rotatedCenterY = clockwise ? centerX : oldWidth - centerX;
	placement.x = (rotatedCenterX - pixelWidth / 2) / oldHeight;
	placement.y = (rotatedCenterY - pixelHeight / 2) / oldWidth;
	return placement;
}
function rotateTextDefinition(definition, oldWidth, oldHeight, clockwise) {
	if (!definition) return;
	rotateTextOriginBounds(definition, oldWidth, oldHeight, clockwise);
	if (Number.isFinite(Number(definition.size))) {
		definition.size = Number(definition.size) * oldHeight / oldWidth;
	}
	definition.rotation = normalizeRotationDegrees((Number(definition.rotation) || 0) + (clockwise ? 90 : -90));
}
function rotateTextCollection(collection, oldWidth, oldHeight, clockwise) {
	Object.values(collection || {}).forEach(function (definition) {
		rotateTextDefinition(definition, oldWidth, oldHeight, clockwise);
	});
}
function rotateFrameDefinition(frame, oldWidth, oldHeight, clockwise) {
	if (!frame) return;
	frame.bounds = frame.bounds || {x:0, y:0, width:1, height:1};
	frame.maskCanvasBounds = frame.maskCanvasBounds || {x:0, y:0, width:1, height:1};
	rotatePositionedBounds(frame.bounds, oldWidth, oldHeight, clockwise);
	if (frame.ogBounds) rotatePositionedBounds(frame.ogBounds, oldWidth, oldHeight, clockwise);
	rotatePositionedBounds(frame.maskCanvasBounds, oldWidth, oldHeight, clockwise);
	frame.rotation = normalizeRotationDegrees((Number(frame.rotation) || 0) + (clockwise ? 90 : -90));
	if (frame.editorDefaults) {
		if (frame.editorDefaults.bounds) rotatePositionedBounds(frame.editorDefaults.bounds, oldWidth, oldHeight, clockwise);
		if (frame.editorDefaults.ogBounds) rotatePositionedBounds(frame.editorDefaults.ogBounds, oldWidth, oldHeight, clockwise);
		frame.editorDefaults.maskCanvasBounds = frame.editorDefaults.maskCanvasBounds || {x:0, y:0, width:1, height:1};
		rotatePositionedBounds(frame.editorDefaults.maskCanvasBounds, oldWidth, oldHeight, clockwise);
		frame.editorDefaults.rotation = normalizeRotationDegrees(
			(Number(frame.editorDefaults.rotation) || 0) + (clockwise ? 90 : -90)
		);
	}
}
function rotateDefaultPlacement(placement, image, oldWidth, oldHeight, clockwise, rotationProperty) {
	if (!placement) return;
	var zoom = Number(placement.zoom) || 0;
	rotateRasterPlacement(
		placement,
		(Number(image && image.width) || 0) * zoom,
		(Number(image && image.height) || 0) * zoom,
		oldWidth,
		oldHeight,
		clockwise
	);
	if (rotationProperty) {
		placement[rotationProperty] = normalizeRotationDegrees(
			(Number(placement[rotationProperty]) || 0) + (clockwise ? 90 : -90)
		);
	}
}
function rotateStoredDesignDefaults(defaults, oldWidth, oldHeight, clockwise) {
	if (!defaults) return;
	rotateTextCollection(defaults.text, oldWidth, oldHeight, clockwise);
	rotateEnvelopeBounds(defaults.artBounds, clockwise);
	rotateEnvelopeBounds(defaults.setSymbolBounds, clockwise);
	rotateEnvelopeBounds(defaults.watermarkBounds, clockwise);
	rotateDefaultPlacement(defaults.artPlacement, art, oldWidth, oldHeight, clockwise, 'rotate');
	rotateDefaultPlacement(defaults.setSymbolPlacement, setSymbol, oldWidth, oldHeight, clockwise, 'rotate');
	rotateDefaultPlacement(defaults.watermarkPlacement, watermark, oldWidth, oldHeight, clockwise, 'rotate');
	defaults.orientation = clockwise ? 'landscape' : 'portrait';
	defaults.orientationRotation = normalizeRotationDegrees(
		(Number(defaults.orientationRotation)||0) + (clockwise ? 90 : -90)
	);
	defaults.width = oldHeight;
	defaults.height = oldWidth;
}
function prepareNewDesignElementForOrientation(element) {
	if (!element || element.orientationPrepared) return element;
	var rotation = normalizeRotationDegrees(card && card.orientationRotation);
	if (rotation === 90) {
		var bounds = element.bounds || element;
		if (element.bounds) {
			rotatePositionedBounds(bounds, card.height, card.width, true);
			element.maskCanvasBounds = element.maskCanvasBounds || {x:0, y:0, width:1, height:1};
			rotatePositionedBounds(element.maskCanvasBounds, card.height, card.width, true);
		} else {
			rotateTextOriginBounds(bounds, card.height, card.width, true);
			if (Number.isFinite(Number(element.size))) {
				element.size = Number(element.size) * card.width / card.height;
			}
		}
		element.rotation = normalizeRotationDegrees((Number(element.rotation) || 0) + 90);
	}
	element.orientationPrepared = card ? card.orientation : 'portrait';
	return element;
}
async function setCardOrientation(value, options = {}) {
	if (!card) return false;
	var target = normalizeCardOrientation(value);
	var current = currentCardOrientation();
	if (target === current) {
		syncCardOrientationState(target);
		if (options.redraw !== false) {
			drawCard();
		}
		return true;
	}
	var before = options.recordUndo === false || typeof createDesignStateSnapshot !== 'function'
		? null
		: createDesignStateSnapshot();
	var oldWidth = Number(card.width) || getStandardWidth();
	var oldHeight = Number(card.height) || getStandardHeight();
	var oldMarginX = Number(card.marginX) || 0;
	var oldMarginY = Number(card.marginY) || 0;
	var clockwise = current === 'portrait' && target === 'landscape';

	(card.frames || []).forEach(function (frame) {
		rotateFrameDefinition(frame, oldWidth, oldHeight, clockwise);
	});
	rotateTextCollection(card.text, oldWidth, oldHeight, clockwise);
	rotateTextCollection(card.bottomInfo, oldWidth, oldHeight, clockwise);
	rotateEnvelopeBounds(card.artBounds, clockwise);
	rotateEnvelopeBounds(card.setSymbolBounds, clockwise);
	rotateEnvelopeBounds(card.watermarkBounds, clockwise);

	var artPlacement = {x:Number(card.artX)||0, y:Number(card.artY)||0};
	rotateRasterPlacement(artPlacement, (Number(art.width)||0)*(Number(card.artZoom)||0),
		(Number(art.height)||0)*(Number(card.artZoom)||0), oldWidth, oldHeight, clockwise);
	card.artX = artPlacement.x;
	card.artY = artPlacement.y;
	card.artRotate = normalizeRotationDegrees((Number(card.artRotate)||0) + (clockwise ? 90 : -90));

	var symbolPlacement = {x:Number(card.setSymbolX)||0, y:Number(card.setSymbolY)||0};
	rotateRasterPlacement(symbolPlacement, (Number(setSymbol.width)||0)*(Number(card.setSymbolZoom)||0),
		(Number(setSymbol.height)||0)*(Number(card.setSymbolZoom)||0), oldWidth, oldHeight, clockwise);
	card.setSymbolX = symbolPlacement.x;
	card.setSymbolY = symbolPlacement.y;
	card.setSymbolRotate = normalizeRotationDegrees((Number(card.setSymbolRotate)||0) + (clockwise ? 90 : -90));

	var watermarkPlacement = {x:Number(card.watermarkX)||0, y:Number(card.watermarkY)||0};
	rotateRasterPlacement(watermarkPlacement, (Number(watermark.width)||0)*(Number(card.watermarkZoom)||0),
		(Number(watermark.height)||0)*(Number(card.watermarkZoom)||0), oldWidth, oldHeight, clockwise);
	card.watermarkX = watermarkPlacement.x;
	card.watermarkY = watermarkPlacement.y;
	card.watermarkRotate = normalizeRotationDegrees((Number(card.watermarkRotate)||0) + (clockwise ? 90 : -90));

	rotateStoredDesignDefaults(card.designDefaults, oldWidth, oldHeight, clockwise);
	card.width = oldHeight;
	card.height = oldWidth;
	card.marginX = oldMarginY;
	card.marginY = oldMarginX;
	card.orientation = target;
	card.landscape = target === 'landscape';
	card.orientationRotation = normalizeRotationDegrees(
		(Number(card.orientationRotation)||0) + (clockwise ? 90 : -90)
	);

	canvasList.forEach(function (name) { sizeCanvas(name); });
	syncCardOrientationState(target);
	setDesignPlacementInputs('art', {x:card.artX, y:card.artY, zoom:card.artZoom, rotate:card.artRotate});
	setDesignPlacementInputs('setSymbol', {x:card.setSymbolX, y:card.setSymbolY, zoom:card.setSymbolZoom, rotate:card.setSymbolRotate});
	setDesignPlacementInputs('watermark', {x:card.watermarkX, y:card.watermarkY, zoom:card.watermarkZoom, rotate:card.watermarkRotate, opacity:card.watermarkOpacity});
	if (selectedFrame && card.frames.includes(selectedFrame)) refreshSelectedFrameEditor();
	if (options.redraw !== false) {
		drawFrames();
		await drawText();
		if (card.bottomInfo && typeof bottomInfoEdited === 'function') {
			await bottomInfoEdited();
		}
		if (typeof watermarkEdited === 'function') {
			watermarkEdited();
		}
		drawCard();
	}
	if (before) commitDesignUndoSnapshot(before, 'Change card orientation');
	return true;
}
//Other nifty functions
function getElementIndex(element) {
	return Array.prototype.indexOf.call(element.parentElement.children, element);
}
function getCardName() {
	if (card.text == undefined || card.text.title == undefined) {
		return 'unnamed';
	}
	var imageName = card.text.title.text || 'unnamed';
	if (card.text.nickname) {
		imageName += ' (' + card.text.nickname.text + ')';
	}
	return imageName.replace(/\{[^}]+\}/g, '');
}
function getInlineCardName() {
	if (card.text == undefined || card.text.title == undefined) {
		return 'unnamed';
	}
	var imageName = card.text.title.text || 'unnamed';
	if (card.text.nickname) {
		imageName = card.text.nickname.text;
	}
	return imageName.replace(/\{[^}]+\}/g, '');
}
//UI
function toggleCreatorTabs(event, target) {
	Array.from(document.querySelector('#creator-menu-sections').children).forEach(element => element.classList.add('hidden'));
	document.querySelector('#creator-menu-' + target).classList.remove('hidden');
	selectSelectable(event);
	drawCard();
}
var activeFrameWorkspace = 'browse';
var suppressFrameVersionAutoload = false;
function getCurrentFrameLayoutSelection() {
	const groupSelect = document.querySelector('#selectFrameGroup');
	const packSelect = document.querySelector('#selectFramePack');
	const groupValue = groupSelect?.value || '';
	const packValue = packSelect?.value || '';
	return {
		groupValue: groupValue,
		packValue: packValue,
		groupLabel: groupSelect?.selectedOptions?.[0]?.textContent?.trim() || groupValue,
		packLabel: packSelect?.selectedOptions?.[0]?.textContent?.trim() || packValue,
		key: groupValue && packValue ? groupValue + ':' + packValue : ''
	};
}
function setFrameLayoutTemplateStatus(message, isError = false) {
	const status = document.querySelector('#frame-layout-template-status');
	if (!status) {
		return;
	}
	status.textContent = message;
	status.classList.toggle('error', isError);
}
function syncFrameLayoutTemplateControls() {
	const browseGroup = document.querySelector('#selectFrameGroup');
	const browsePack = document.querySelector('#selectFramePack');
	const designGroup = document.querySelector('#frame-layout-template-group');
	const designPack = document.querySelector('#frame-layout-template-pack');
	if (browseGroup && designGroup) {
		if (!designGroup.options.length) {
			designGroup.innerHTML = browseGroup.innerHTML;
		}
		designGroup.value = browseGroup.value;
	}
	if (browsePack && designPack) {
		designPack.innerHTML = browsePack.innerHTML;
		designPack.value = browsePack.value;
	}
	const applyButton = document.querySelector('#apply-frame-layout-template');
	const versionButton = document.querySelector('#loadFrameVersion');
	if (applyButton) {
		applyButton.disabled = !versionButton || versionButton.disabled || typeof versionButton.onclick != 'function';
	}
}
function selectFrameLayoutGroup(value) {
	const browseGroup = document.querySelector('#selectFrameGroup');
	const applyButton = document.querySelector('#apply-frame-layout-template');
	if (!browseGroup || !value) {
		return;
	}
	browseGroup.value = value;
	if (applyButton) {
		applyButton.disabled = true;
	}
	setFrameLayoutTemplateStatus('Loading layout variants...');
	loadScript('/js/frames/group' + value + '.js').catch(() => {
		setFrameLayoutTemplateStatus('That frame type could not be loaded.', true);
	});
}
function selectFrameLayoutPack(value) {
	const browsePack = document.querySelector('#selectFramePack');
	const applyButton = document.querySelector('#apply-frame-layout-template');
	if (!browsePack || !value) {
		return;
	}
	browsePack.value = value;
	if (applyButton) {
		applyButton.disabled = true;
	}
	setFrameLayoutTemplateStatus('Loading layout template...');
	loadScript('/js/frames/pack' + value + '.js').catch(() => {
		setFrameLayoutTemplateStatus('That frame variant could not be loaded.', true);
	});
}
function registerCurrentFrameLayoutTemplate() {
	const versionButton = document.querySelector('#loadFrameVersion');
	const selection = getCurrentFrameLayoutSelection();
	if (!versionButton || versionButton.disabled || typeof versionButton.onclick != 'function' || !selection.key) {
		syncFrameLayoutTemplateControls();
		if (selection.packLabel) {
			setFrameLayoutTemplateStatus(selection.packLabel + ' is an image-only frame pack and has no separate layout template.');
		}
		return false;
	}
	if (versionButton.onclick.frameLayoutTemplateKey != selection.key) {
		const loadLayout = versionButton.onclick;
		const layoutKey = selection.key;
		const layoutLabel = selection.groupLabel + ' / ' + selection.packLabel;
		const wrappedLoader = async function(event) {
			const result = await loadLayout.call(this, event);
			if (card) {
				card.frameLayoutSource = layoutKey;
				card.frameLayoutLabel = layoutLabel;
				captureCurrentDesignDefaults(false);
				clearDesignUndoHistory();
			}
			syncFrameLayoutTemplateControls();
			setFrameLayoutTemplateStatus('Applied ' + layoutLabel + '.');
			return result;
		};
		wrappedLoader.frameLayoutTemplateKey = layoutKey;
		wrappedLoader.frameLayoutTemplateLoader = loadLayout;
		versionButton.onclick = wrappedLoader;
	}
	syncFrameLayoutTemplateControls();
	setFrameLayoutTemplateStatus('Ready to apply ' + selection.groupLabel + ' / ' + selection.packLabel + '.');
	return true;
}
async function applyCurrentFrameLayout({force = false, source = 'design'} = {}) {
	const selection = getCurrentFrameLayoutSelection();
	const versionButton = document.querySelector('#loadFrameVersion');
	if (!registerCurrentFrameLayoutTemplate() || !versionButton || !selection.key) {
		return false;
	}
	if (!force && card?.frameLayoutSource == selection.key) {
		return true;
	}
	setFrameLayoutTemplateStatus('Applying ' + selection.groupLabel + ' / ' + selection.packLabel + '...');
	try {
		await versionButton.onclick.call(versionButton);
		if (source == 'browse') {
			setFrameLayoutTemplateStatus('Applied ' + selection.groupLabel + ' / ' + selection.packLabel + ' while adding the frame.');
		}
		return true;
	} catch (error) {
		console.error('Frame layout template failed to load.', error);
		setFrameLayoutTemplateStatus('The selected layout template could not be applied.', true);
		return false;
	}
}
async function loadFrameLayoutTemplateForPack(packValue, groupValue = '') {
	if (!packValue) {
		return false;
	}
	const groupSelect = document.querySelector('#selectFrameGroup');
	const packSelect = document.querySelector('#selectFramePack');
	if (!packSelect) {
		return false;
	}
	if (groupValue && groupSelect && Array.from(groupSelect.options).some(option => option.value == groupValue)) {
		groupSelect.value = groupValue;
	}
	var option = Array.from(packSelect.options).find(item => item.value == packValue);
	if (!option) {
		option = document.createElement('option');
		option.value = packValue;
		option.textContent = packValue;
		packSelect.appendChild(option);
	}
	packSelect.value = packValue;
	syncFrameLayoutTemplateControls();
	suppressFrameVersionAutoload = true;
	try {
		await loadScript('/js/frames/pack' + packValue + '.js');
	} finally {
		suppressFrameVersionAutoload = false;
	}
	return applyCurrentFrameLayout({force:true, source:'csv'});
}
async function toggleFrameWorkspace(event, target) {
	if (!['browse', 'design'].includes(target)) {
		return;
	}
	activeFrameWorkspace = target;
	['browse', 'design'].forEach(workspace => {
		const panel = document.querySelector('#frame-workspace-' + workspace);
		if (panel) {
			panel.classList.toggle('hidden', workspace != target);
		}
	});
	Array.from(document.querySelectorAll('[data-frame-workspace]')).forEach(tab => {
		const selected = tab.dataset.frameWorkspace == target;
		tab.classList.toggle('selected', selected);
		tab.setAttribute('aria-selected', selected ? 'true' : 'false');
	});
	const description = document.querySelector('#frame-list-description');
	if (description) {
		description.textContent = target == 'design'
			? 'Drag layers to reorder them, or click a layer to open its editor.'
			: 'Drag layers to reorder them. Switch to Design Frame to edit a layer.';
	}
	if (target != 'design') {
		document.querySelector('#frame-element-editor')?.classList.remove('opened');
	} else {
		await decomposePendingBuiltInFrames();
	}
	drawCard();
}
function selectSelectable(event) {
	var eventTarget = event.target.closest('.selectable');
	Array.from(eventTarget.parentElement.children).forEach(element => element.classList.remove('selected'));
	eventTarget.classList.add('selected');
}
function initializeFrameEditorInteractions() {
	const editor = document.querySelector('#frame-element-editor');
	const handle = editor?.querySelector('.frame-element-editor-title');
	if (editor && handle && !handle.dataset.dragReady) {
		handle.dataset.dragReady = 'true';
		handle.addEventListener('pointerdown', event => {
			if (event.button !== undefined && event.button !== 0) {
				return;
			}
			const rectangle = editor.getBoundingClientRect();
			const offsetX = event.clientX - rectangle.left;
			const offsetY = event.clientY - rectangle.top;
			editor.style.left = rectangle.left + 'px';
			editor.style.top = rectangle.top + 'px';
			editor.style.right = 'auto';
			editor.style.transform = 'none';
			const moveEditor = moveEvent => {
				const maximumLeft = Math.max(0, window.innerWidth - editor.offsetWidth);
				const maximumTop = Math.max(0, window.innerHeight - editor.offsetHeight);
				editor.style.left = Math.max(0, Math.min(maximumLeft, moveEvent.clientX - offsetX)) + 'px';
				editor.style.top = Math.max(0, Math.min(maximumTop, moveEvent.clientY - offsetY)) + 'px';
			};
			const stopMoving = () => {
				document.removeEventListener('pointermove', moveEditor);
				document.removeEventListener('pointerup', stopMoving);
				document.removeEventListener('pointercancel', stopMoving);
			};
			document.addEventListener('pointermove', moveEditor);
			document.addEventListener('pointerup', stopMoving);
			document.addEventListener('pointercancel', stopMoving);
			event.preventDefault();
		});
	}

	document.querySelectorAll('#frame-element-editor input[type="number"]').forEach(input => {
		if (input.dataset.wheelReady) {
			return;
		}
		input.dataset.wheelReady = 'true';
		input.addEventListener('wheel', event => {
			event.preventDefault();
			const step = Number(input.step) > 0 ? Number(input.step) : 1;
			const minimum = input.min === '' ? -Infinity : Number(input.min);
			const maximum = input.max === '' ? Infinity : Number(input.max);
			const direction = event.deltaY < 0 ? 1 : -1;
			let value = (Number(input.value) || 0) + direction * step;
			value = Math.max(minimum, Math.min(maximum, value));
			const decimalPlaces = String(step).includes('.') ? String(step).split('.')[1].length : 0;
			input.value = decimalPlaces ? value.toFixed(decimalPlaces) : String(Math.round(value));
			input.dispatchEvent(new Event('change', {bubbles: true}));
		}, {passive: false});
		input.addEventListener('keydown', event => {
			if (event.key === 'Enter') {
				event.preventDefault();
				input.blur();
			}
		});
	});
}
initializeFrameEditorInteractions();

function dragStart(event) {
	Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
	event.target.closest('.draggable').classList.add('dragging');
}
function dragEnd(event) {
	Array.from(document.querySelectorAll('.dragging')).forEach(element => element.classList.remove('dragging'));
}
function touchMove(event) {
	if (event.target.nodeName != 'H4') {
		event.preventDefault();
	}
	var clientX = event.touches[0].clientX;
	var clientY = event.touches[0].clientY;
	Array.from(document.querySelector('.dragging').parentElement.children).forEach(element => {
		var elementBounds = element.getBoundingClientRect();
		if (clientY > elementBounds.top && clientY < elementBounds.bottom) {
			dragOver(element, false);
		}
	})
}
function dragOver(event, drag=true) {
	var eventTarget;
	if (drag) {
		eventTarget = event.target.closest('.draggable');
	} else {
		eventTarget = event;
	}
	var movingElement = document.querySelector('.dragging');
	if (document.querySelector('.dragging') && !eventTarget.classList.contains('dragging') && eventTarget.parentElement == movingElement.parentElement) {
		var parentElement = eventTarget.parentElement;
		var elements = document.createDocumentFragment();
		var movingElementPassed = false;
		var movingElementOldIndex = -1;
		var movingElementNewIndex = -1;
		Array.from(parentElement.children).forEach((element, index) => {
			if (element == eventTarget) {
				movingElementNewIndex = index;
				if(movingElementPassed) {
					elements.appendChild(element.cloneNode(true));
					elements.appendChild(movingElement.cloneNode(true));
				} else {
					elements.appendChild(movingElement.cloneNode(true));
					elements.appendChild(element.cloneNode(true));
				}
			} else if(element != movingElement) {
				elements.appendChild(element.cloneNode(true));
			} else {
				movingElementOldIndex = index;
				movingElementPassed = true;
			}
		});
		Array.from(elements.children).forEach(element => {
			element.ondragstart = dragStart;
			element.ontouchstart = dragStart;
			element.ondragend = dragEnd;
			element.ontouchend = dragEnd;
			element.ondragover = dragOver;
			element.ontouchmove = touchMove;
			element.onclick = frameElementClicked;
			element.children[3].onclick = removeFrame;
		})
		parentElement.innerHTML = null;
		parentElement.appendChild(elements);
		if (movingElementNewIndex >= 0) {
			var originalMovingElement = card.frames[movingElementOldIndex];
			card.frames.splice(movingElementOldIndex, 1);
			card.frames.splice(movingElementNewIndex, 0, originalMovingElement);
			drawFrames();
		}
	}
}
//Set Symbols
const setSymbolAliases = new Map([
	["anb", "ana"],
	["tsb", "tsp"],
	["pmei", "sld"],
]);
//Mana Symbols
const mana = new Map();
// var manaSymbols = [];
loadManaSymbols(['0', '1', '2', '3', '4', '5', '6', '7', '8', '9', '10', '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
				 'w', 'u', 'b', 'r', 'g', 'c', 'x', 'y', 'z', 't', 'untap', 's', 'oldtap', 'originaltap', 'purple', "inf", "alchemy"]);
loadManaSymbols(true, ['e', 'a', 'p']);
loadManaSymbols(['wu', 'wb', 'ub', 'ur', 'br', 'bg', 'rg', 'rw', 'gw', 'gu', '2w', '2u', '2b', '2r', '2g', 'wp', 'up', 'bp', 'rp', 'gp', 'h',
				 'wup', 'wbp', 'ubp', 'urp', 'brp', 'bgp', 'rgp', 'rwp', 'gwp', 'gup', 'purplew', 'purpleu', 'purpleb', 'purpler', 'purpleg',
				 '2purple', 'purplep', 'cw', 'cu', 'cb', 'cr', 'cg'], [1.2, 1.2]);
loadManaSymbols(['bar.png', 'whitebar.png']);
loadManaSymbols(['brush', 'whitebrush'], [2.85, 2.85]);
loadManaSymbols(['xxbgw', 'xxbrg', 'xxgub', 'xxgwu', 'xxrgw', 'xxrwu', 'xxubr', 'xxurg', 'xxwbr', 'xxwub'], [1.2, 1.2]);
loadManaSymbols(true, ['chaos'], [1.2, 1]);
loadManaSymbols(true, ['tk'], [0.8, 1]);
loadManaSymbols(true, ['planeswalker'], [0.6, 1.2]);
loadManaSymbols(true, ['+1', '+2', '+3', '+4', '+5', '+6', '+7', '+8', '+9', '-1', '-2', '-3', '-4', '-5', '-6', '-7', '-8', '-9', '+0'], [1.6, 1]);
function loadManaSymbols(matchColor, manaSymbolPaths, size = [1, 1]) {
	if (typeof matchColor === 'object') {
		// Hacky way to add a default argument for matchColor without breaking the function call from other places
		size = manaSymbolPaths || [1,1];
		manaSymbolPaths = matchColor;
		matchColor = false;
	}

	manaSymbolPaths.forEach(item => {
		var manaSymbol = {};
		if (typeof item == 'string') {
			manaSymbol.name = item.split('.')[0];
			manaSymbol.path = item;
		} else {
			manaSymbol.name = item[0].split('.')[0];
			manaSymbol.path = item[0];
		}
		if (manaSymbol.name.includes('/')) {
			manaSymbol.name = manaSymbol.name.split('/');
			manaSymbol.name = manaSymbol.name[manaSymbol.name.length - 1];
		}
		if (typeof item != 'string') {
			manaSymbol.back = item[1];
			manaSymbol.backs = item[2];
			for (var i = 0; i < item[2]; i ++) {
				loadManaSymbols([manaSymbol.path.replace(manaSymbol.name, 'back' + i + item[1])])
			}
		}

		manaSymbol.matchColor = matchColor;

		manaSymbol.width = size[0];
		manaSymbol.height = size[1];
		manaSymbol.image = new Image();
		manaSymbol.image.crossOrigin = 'anonymous';
		var manaSymbolPath = '/img/manaSymbols/' + manaSymbol.path;
		if (!manaSymbolPath.includes('.png')) {
			manaSymbolPath += '.svg';
		}
		manaSymbol.image.src = fixUri(manaSymbolPath);
		mana.set(manaSymbol.name, manaSymbol);
		// manaSymbols.push(manaSymbol);
	});
}
function findManaSymbolIndex(string) {
	return mana.get(key) || -1;
}
function getManaSymbol(key) {
	return mana.get(key);
}

const builtInManaSymbolNames = new Set(mana.keys());
const customManaSymbolNames = new Set();
const reservedCustomSymbolCodes = new Set([
	'line', 'lns', 'linenospace', 'bullet', 'bar', 'i', '/i', 'bold', '/bold',
	'left', 'center', 'right', 'justify-left', 'justify-center', 'justify-right',
	'planechase', 'indent', '/indent', 'savex', 'loadx', 'savex2', 'loadx2',
	'manacolordefault', 'fixtextalign', 'divider', 'flavor', 'oldflavor', 'cardname'
]);
const reservedCustomSymbolPrefixes = [
	'ruby:', 'conditionalcolor', 'fontcolor', 'fontsize', 'font', 'outlinecolor',
	'outline', 'linecap', 'linejoin', 'upinline', 'up', 'down', 'left', 'right',
	'shadow', 'elemid', 'ptshift', 'rollcolor', 'roll', 'permashift', 'arcradius',
	'arcstart', 'rotate', 'manacolor', 'kerning'
];

function normalizeCustomManaSymbolName(value) {
	return String(value || '').trim().replace(/^\{|\}$/g, '').toLowerCase();
}

function isReservedCustomManaSymbolName(value) {
	const name = normalizeCustomManaSymbolName(value);
	if (!/^[a-z][a-z0-9_-]{0,31}$/.test(name)) {
		return true;
	}
	return builtInManaSymbolNames.has(name) ||
		reservedCustomSymbolCodes.has(name) ||
		reservedCustomSymbolPrefixes.some(prefix => name.startsWith(prefix));
}

function registerCustomManaSymbol(name, source) {
	name = normalizeCustomManaSymbolName(name);
	if (isReservedCustomManaSymbolName(name)) {
		return Promise.reject(new Error('The custom symbol code {' + name + '} is reserved.'));
	}
	return new Promise((resolve, reject) => {
		const symbolImage = new Image();
		symbolImage.crossOrigin = 'anonymous';
		symbolImage.onload = () => {
			mana.set(name, {
				name: name,
				path: source,
				matchColor: false,
				width: 1,
				height: 1,
				image: symbolImage,
				custom: true
			});
			customManaSymbolNames.add(name);
			drawTextBuffer();
			resolve(true);
		};
		symbolImage.onerror = () => reject(new Error('The image for {' + name + '} could not be loaded.'));
		symbolImage.src = source;
	});
}

function clearCustomManaSymbols() {
	customManaSymbolNames.forEach(name => mana.delete(name));
	customManaSymbolNames.clear();
	drawTextBuffer();
}

window.CardConjurerManaSymbols = {
	register: registerCustomManaSymbol,
	clear: clearCustomManaSymbols,
	isReserved: isReservedCustomManaSymbolName,
	normalize: normalizeCustomManaSymbolName
};
//FRAME TAB
function cloneFrameEditorValue(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function getFrameEditorState(frame) {
	return {
		bounds: cloneFrameEditorValue(frame.bounds || {}),
		ogBounds: cloneFrameEditorValue(frame.ogBounds),
		maskCanvasBounds: cloneFrameEditorValue(frame.maskCanvasBounds),
		opacity: frame.opacity === undefined ? 100 : Number(frame.opacity),
		erase: !!frame.erase,
		preserveAlpha: !!frame.preserveAlpha,
		colorOverlayCheck: !!frame.colorOverlayCheck,
		colorOverlay: frame.colorOverlay || '#000000',
		hslHue: Number(frame.hslHue) || 0,
		hslSaturation: Number(frame.hslSaturation) || 0,
		hslLightness: Number(frame.hslLightness) || 0,
		rotation: Number(frame.rotation) || 0,
		flipX: !!frame.flipX,
		flipY: !!frame.flipY,
		hidden: !!frame.hidden
	};
}
function ensureFrameEditorDefaults(frame) {
	if (!frame.editorDefaults) {
		frame.editorDefaults = getFrameEditorState(frame);
	}
	return frame.editorDefaults;
}

var DESIGN_UNDO_LIMIT = 30;
var designUndoHistory = [];
var designEditorUndoStart = null;
var designUndoApplying = false;
var designLayerSequence = 0;
function ensureDesignLayerId(frame) {
	if (!frame) return '';
	if (!frame.designLayerId) {
		designLayerSequence++;
		const uniquePart = window.crypto?.randomUUID
			? window.crypto.randomUUID()
			: Date.now() + '-' + designLayerSequence + '-' + Math.random().toString(16).slice(2);
		frame.designLayerId = 'layer-' + uniquePart;
	}
	return frame.designLayerId;
}
function cloneDesignValue(value) {
	return value === undefined ? undefined : JSON.parse(JSON.stringify(value));
}
function applyFrameEditorState(frame, state) {
	if (!frame || !state) return;
	frame.bounds = cloneDesignValue(state.bounds || {});
	if (state.ogBounds === undefined) delete frame.ogBounds;
	else frame.ogBounds = cloneDesignValue(state.ogBounds);
	if (state.maskCanvasBounds === undefined) delete frame.maskCanvasBounds;
	else frame.maskCanvasBounds = cloneDesignValue(state.maskCanvasBounds);
	frame.opacity = state.opacity;
	frame.erase = !!state.erase;
	frame.preserveAlpha = !!state.preserveAlpha;
	frame.colorOverlayCheck = !!state.colorOverlayCheck;
	frame.colorOverlay = state.colorOverlay;
	frame.hslHue = state.hslHue;
	frame.hslSaturation = state.hslSaturation;
	frame.hslLightness = state.hslLightness;
	frame.rotation = state.rotation;
	frame.flipX = !!state.flipX;
	frame.flipY = !!state.flipY;
	frame.hidden = !!state.hidden;
}
function currentDesignDefaultsSnapshot() {
	const textDefaults = {};
	Object.entries(card.text || {}).forEach(([key, value]) => {
		textDefaults[key] = cloneDesignValue(value);
		delete textDefaults[key].text;
	});
	return {
		orientation: currentCardOrientation(),
		orientationRotation: Number(card.orientationRotation) || 0,
		width: card.width,
		height: card.height,
		text: textDefaults,
		artBounds: cloneDesignValue(card.artBounds),
		artPlacement: {x:Number(card.artX)||0, y:Number(card.artY)||0, zoom:Number(card.artZoom)||0, rotate:Number(card.artRotate)||0},
		setSymbolBounds: cloneDesignValue(card.setSymbolBounds),
		setSymbolPlacement: {x:Number(card.setSymbolX)||0, y:Number(card.setSymbolY)||0, zoom:Number(card.setSymbolZoom)||0, rotate:Number(card.setSymbolRotate)||0},
		watermarkBounds: cloneDesignValue(card.watermarkBounds),
		watermarkPlacement: {
			x:Number(card.watermarkX)||0, y:Number(card.watermarkY)||0, zoom:Number(card.watermarkZoom)||0,
			rotate:Number(card.watermarkRotate)||0,
			opacity:card.watermarkOpacity === undefined ? 0.4 : Number(card.watermarkOpacity)
		}
	};
}
function captureCurrentDesignDefaults(rebaseFrameLayers = true) {
	if (!card) return null;
	card.designDefaults = currentDesignDefaultsSnapshot();
	if (rebaseFrameLayers) {
		(card.frames || []).forEach(frame => {
			ensureDesignLayerId(frame);
			frame.editorDefaults = getFrameEditorState(frame);
		});
	}
	return card.designDefaults;
}
function saveCurrentDesignAsDefaults() {
	return captureCurrentDesignDefaults(true);
}
function createDesignStateSnapshot() {
	return {
		cardGeometry:{
			width:card.width, height:card.height, marginX:Number(card.marginX)||0, marginY:Number(card.marginY)||0,
			orientation:currentCardOrientation(), landscape:!!card.landscape,
			orientationRotation:Number(card.orientationRotation)||0
		},
		frames:(card.frames || []).map(frame => ({id:ensureDesignLayerId(frame), state:getFrameEditorState(frame)})),
		text:cloneDesignValue(card.text || {}),
		bottomInfo:cloneDesignValue(card.bottomInfo),
		designDefaults:cloneDesignValue(card.designDefaults),
		artBounds:cloneDesignValue(card.artBounds),
		artPlacement:{x:Number(card.artX)||0, y:Number(card.artY)||0, zoom:Number(card.artZoom)||0, rotate:Number(card.artRotate)||0},
		setSymbolBounds:cloneDesignValue(card.setSymbolBounds),
		setSymbolPlacement:{x:Number(card.setSymbolX)||0, y:Number(card.setSymbolY)||0, zoom:Number(card.setSymbolZoom)||0, rotate:Number(card.setSymbolRotate)||0},
		watermarkBounds:cloneDesignValue(card.watermarkBounds),
		watermarkPlacement:{
			x:Number(card.watermarkX)||0, y:Number(card.watermarkY)||0, zoom:Number(card.watermarkZoom)||0,
			rotate:Number(card.watermarkRotate)||0,
			opacity:card.watermarkOpacity === undefined ? 0.4 : Number(card.watermarkOpacity)
		}
	};
}
function designStatesMatch(left, right) {
	return JSON.stringify(left) === JSON.stringify(right);
}
function updateDesignUndoStatus(message) {
	const status = document.querySelector('#design-undo-status');
	if (!status) return;
	status.textContent = message || (designUndoHistory.length
		? designUndoHistory.length + ' change' + (designUndoHistory.length == 1 ? '' : 's') + ' available to undo (maximum ' + DESIGN_UNDO_LIMIT + ').'
		: 'No design changes to undo. Up to ' + DESIGN_UNDO_LIMIT + ' changes are retained.');
}
function clearDesignUndoHistory() {
	designUndoHistory = [];
	designEditorUndoStart = null;
	updateDesignUndoStatus();
}
function commitDesignUndoSnapshot(before, label) {
	if (!before || designUndoApplying) return false;
	const after = createDesignStateSnapshot();
	if (designStatesMatch(before, after)) return false;
	designUndoHistory.push({state:before, label:label || 'Design change'});
	if (designUndoHistory.length > DESIGN_UNDO_LIMIT) {
		designUndoHistory.splice(0, designUndoHistory.length - DESIGN_UNDO_LIMIT);
	}
	updateDesignUndoStatus();
	return true;
}
function setDesignPlacementInputs(prefix, placement) {
	if (!placement) return;
	const x=document.querySelector('#'+prefix+'-x');
	const y=document.querySelector('#'+prefix+'-y');
	const zoom=document.querySelector('#'+prefix+'-zoom');
	const rotate=document.querySelector('#'+prefix+'-rotate');
	const opacity=document.querySelector('#'+prefix+'-opacity');
	if (x) x.value=placement.x*card.width;
	if (y) y.value=placement.y*card.height;
	if (zoom) zoom.value=placement.zoom*100;
	if (rotate) rotate.value=placement.rotate||0;
	if (opacity) opacity.value=placement.opacity*100;
}
async function applyDesignStateSnapshot(snapshot) {
	if (!snapshot) return;
	if (snapshot.cardGeometry) {
		card.width=snapshot.cardGeometry.width;
		card.height=snapshot.cardGeometry.height;
		card.marginX=snapshot.cardGeometry.marginX;
		card.marginY=snapshot.cardGeometry.marginY;
		card.orientation=snapshot.cardGeometry.orientation;
		card.landscape=!!snapshot.cardGeometry.landscape;
		card.orientationRotation=snapshot.cardGeometry.orientationRotation||0;
		canvasList.forEach(function(name){sizeCanvas(name);});
		syncCardOrientationState(card.orientation);
	}
	(snapshot.frames || []).forEach(record => {
		const frame=(card.frames || []).find(item => ensureDesignLayerId(item)==record.id);
		if (frame) {
			applyFrameEditorState(frame,record.state);
			syncFrameElementVisibility(frame);
		}
	});
	card.text=cloneDesignValue(snapshot.text||{});
	card.bottomInfo=cloneDesignValue(snapshot.bottomInfo);
	card.designDefaults=cloneDesignValue(snapshot.designDefaults);
	card.artBounds=cloneDesignValue(snapshot.artBounds);
	card.artX=snapshot.artPlacement.x; card.artY=snapshot.artPlacement.y;
	card.artZoom=snapshot.artPlacement.zoom; card.artRotate=snapshot.artPlacement.rotate;
	card.setSymbolBounds=cloneDesignValue(snapshot.setSymbolBounds);
	card.setSymbolX=snapshot.setSymbolPlacement.x; card.setSymbolY=snapshot.setSymbolPlacement.y;
	card.setSymbolZoom=snapshot.setSymbolPlacement.zoom; card.setSymbolRotate=snapshot.setSymbolPlacement.rotate||0;
	card.watermarkBounds=cloneDesignValue(snapshot.watermarkBounds);
	card.watermarkX=snapshot.watermarkPlacement.x; card.watermarkY=snapshot.watermarkPlacement.y;
	card.watermarkZoom=snapshot.watermarkPlacement.zoom; card.watermarkRotate=snapshot.watermarkPlacement.rotate||0;
	card.watermarkOpacity=snapshot.watermarkPlacement.opacity;
	setDesignPlacementInputs('art',snapshot.artPlacement);
	setDesignPlacementInputs('setSymbol',snapshot.setSymbolPlacement);
	setDesignPlacementInputs('watermark',snapshot.watermarkPlacement);
	const textKeys=Object.keys(card.text);
	if (textKeys.length) {
		selectedTextIndex=Math.min(selectedTextIndex,textKeys.length-1);
		const selectedText=card.text[textKeys[selectedTextIndex]];
		const editor=document.querySelector('#text-editor');
		const fontSize=document.querySelector('#text-editor-font-size');
		if (editor) editor.value=selectedText.text||'';
		if (fontSize) fontSize.value=selectedText.fontSize||0;
	}
	if (selectedFrame && card.frames.includes(selectedFrame)) refreshSelectedFrameEditor();
	drawFrames();
	await drawText();
	watermarkEdited();
	drawCard();
}
async function undoDesignChange() {
	if (!designUndoHistory.length || designUndoApplying) {
		updateDesignUndoStatus('No design changes are available to undo.');
		return false;
	}
	const entry=designUndoHistory.pop();
	designUndoApplying=true;
	try {
		await applyDesignStateSnapshot(entry.state);
		updateDesignUndoStatus('Undid: '+entry.label+'. '+designUndoHistory.length+' earlier change'+(designUndoHistory.length==1?'':'s')+' remain.');
		return true;
	} finally {
		designUndoApplying=false;
	}
}
function getSelectedTextDefault() {
	const key=Object.keys(card.text||{})[selectedTextIndex];
	return {key:key,value:key?card.designDefaults?.text?.[key]:null};
}
function restoreSelectedTextFieldDefaults() {
	const target=getSelectedTextDefault();
	if (!target.key || !target.value) {
		notify('This text field has no default in the current layout. Save the Frame Designer project to make the current position its default.',5);
		return;
	}
	const undoSnapshot=createDesignStateSnapshot();
	const currentText=card.text[target.key]?.text||'';
	card.text[target.key]=Object.assign(cloneDesignValue(target.value),{text:currentText});
	textboxEditor();
	drawTextBuffer();
	drawCard();
	commitDesignUndoSnapshot(undoSnapshot,'Restore text field default');
}
function restoreArtLayoutDefault() {
	const defaults=card.designDefaults;
	if (!defaults?.artBounds) {notify('This layout has no saved art default.',5);return;}
	const undoSnapshot=createDesignStateSnapshot();
	card.artBounds=cloneDesignValue(defaults.artBounds);
	card.artX=defaults.artPlacement.x; card.artY=defaults.artPlacement.y;
	card.artZoom=defaults.artPlacement.zoom; card.artRotate=defaults.artPlacement.rotate;
	setDesignPlacementInputs('art',defaults.artPlacement);
	drawCard();
	commitDesignUndoSnapshot(undoSnapshot,'Restore art default');
}
function restoreSetSymbolLayoutDefault() {
	const defaults=card.designDefaults;
	if (!defaults?.setSymbolBounds) {notify('This layout has no saved set-symbol default.',5);return;}
	const undoSnapshot=createDesignStateSnapshot();
	card.setSymbolBounds=cloneDesignValue(defaults.setSymbolBounds);
	card.setSymbolX=defaults.setSymbolPlacement.x; card.setSymbolY=defaults.setSymbolPlacement.y;
	card.setSymbolZoom=defaults.setSymbolPlacement.zoom; card.setSymbolRotate=defaults.setSymbolPlacement.rotate||0;
	setDesignPlacementInputs('setSymbol',defaults.setSymbolPlacement);
	drawCard();
	commitDesignUndoSnapshot(undoSnapshot,'Restore set symbol default');
}
function restoreWatermarkLayoutDefault() {
	const defaults=card.designDefaults;
	if (!defaults?.watermarkBounds) {notify('This layout has no saved watermark default.',5);return;}
	const undoSnapshot=createDesignStateSnapshot();
	card.watermarkBounds=cloneDesignValue(defaults.watermarkBounds);
	card.watermarkX=defaults.watermarkPlacement.x; card.watermarkY=defaults.watermarkPlacement.y;
	card.watermarkZoom=defaults.watermarkPlacement.zoom; card.watermarkRotate=defaults.watermarkPlacement.rotate||0;
	card.watermarkOpacity=defaults.watermarkPlacement.opacity;
	setDesignPlacementInputs('watermark',defaults.watermarkPlacement);
	watermarkEdited();
	commitDesignUndoSnapshot(undoSnapshot,'Restore watermark default');
}
function isDesignEditorControl(element) {
	if (!element || activeFrameWorkspace!='design') return false;
	const insideEditor=element.closest('#frame-element-editor, #textbox-editor, #creator-menu-art, #creator-menu-setSymbol, #creator-menu-watermark');
	if (!insideEditor || !element.matches('input, select')) return false;
	return !['file','text','url','search'].includes(String(element.type||'').toLowerCase());
}
function beginDesignEditorUndo(event) {
	if (designUndoApplying || !isDesignEditorControl(event.target) || designEditorUndoStart) return;
	designEditorUndoStart={state:createDesignStateSnapshot(),label:event.target.getAttribute('aria-label')||event.target.id||'Editor change'};
}
function finishDesignEditorUndo(event) {
	if (!designEditorUndoStart || designUndoApplying || !isDesignEditorControl(event.target)) return;
	const pending=designEditorUndoStart;
	designEditorUndoStart=null;
	commitDesignUndoSnapshot(pending.state,pending.label);
}
function initializeDesignUndoInteractions() {
	if (document.body.dataset.designUndoReady) return;
	document.body.dataset.designUndoReady='true';
	document.addEventListener('focusin',beginDesignEditorUndo,true);
	document.addEventListener('pointerdown',beginDesignEditorUndo,true);
	document.addEventListener('wheel',beginDesignEditorUndo,true);
	document.addEventListener('change',finishDesignEditorUndo);
	document.addEventListener('keydown',event => {
		if (!(event.ctrlKey||event.metaKey) || event.key.toLowerCase()!='z' || event.shiftKey) return;
		const editingText=event.target.matches?.('textarea, input[type="text"], input[type="url"], input[type="search"]');
		if (activeFrameWorkspace!='design' || editingText || !designUndoHistory.length) return;
		event.preventDefault();
		undoDesignChange();
	});
	updateDesignUndoStatus();
}

function drawFrameLayerImage(context, image, x, y, width, height, frame) {
	const rotation = Number(frame.rotation) || 0;
	const scaleHorizontal = frame.flipX ? -1 : 1;
	const scaleVertical = frame.flipY ? -1 : 1;
	if (!rotation && scaleHorizontal == 1 && scaleVertical == 1) {
		context.drawImage(image, x, y, width, height);
		return;
	}
	context.save();
	context.translate(x + width / 2, y + height / 2);
	context.rotate(rotation * Math.PI / 180);
	context.scale(scaleHorizontal, scaleVertical);
	context.drawImage(image, -width / 2, -height / 2, width, height);
	context.restore();
}
function drawFrameLayerMask(context, image, x, y, width, height, frame, pivotX, pivotY) {
	const rotation = Number(frame.rotation) || 0;
	const scaleHorizontal = frame.flipX ? -1 : 1;
	const scaleVertical = frame.flipY ? -1 : 1;
	if (!rotation && scaleHorizontal == 1 && scaleVertical == 1) {
		context.drawImage(image, x, y, width, height);
		return;
	}
	context.save();
	context.translate(pivotX, pivotY);
	context.rotate(rotation * Math.PI / 180);
	context.scale(scaleHorizontal, scaleVertical);
	context.drawImage(image, x - pivotX, y - pivotY, width, height);
	context.restore();
}
function syncFrameElementVisibility(frame) {
	const index = card.frames.indexOf(frame);
	const element = document.querySelector('#frame-list')?.children[index];
	if (element) {
		element.classList.toggle('frame-element-hidden', !!frame.hidden);
	}
}
function refreshSelectedFrameEditor() {
	const index = card.frames.indexOf(selectedFrame);
	const element = document.querySelector('#frame-list')?.children[index];
	if (element) {
		frameElementClicked({target: element});
	}
}
async function duplicateSelectedFrame() {
	if (!selectedFrame) {
		return;
	}
	const copy = JSON.parse(JSON.stringify(selectedFrame, (key, value) => key == 'image' ? undefined : value));
	copy.name = (copy.name || 'Frame Layer') + ' Copy';
	copy.masks = copy.masks || [];
	delete copy.designLayerId;
	delete copy.editorDefaults;
	ensureFrameEditorDefaults(copy);
	card.frames.unshift(copy);
	await addFrame([], copy);
	selectedFrame = copy;
	syncFrameElementVisibility(copy);
	refreshSelectedFrameEditor();
	drawFrames();
}
function resetSelectedFrame() {
	if (!selectedFrame || !confirm('Restore this layer to the default values for the current layout or saved project?')) {
		return;
	}
	const undoSnapshot = createDesignStateSnapshot();
	const defaults = cloneFrameEditorValue(ensureFrameEditorDefaults(selectedFrame));
	selectedFrame.bounds = defaults.bounds || {};
	if (defaults.ogBounds === undefined) {
		delete selectedFrame.ogBounds;
	} else {
		selectedFrame.ogBounds = defaults.ogBounds;
	}
	if (defaults.maskCanvasBounds === undefined) {
		delete selectedFrame.maskCanvasBounds;
	} else {
		selectedFrame.maskCanvasBounds = defaults.maskCanvasBounds;
	}
	selectedFrame.opacity = defaults.opacity;
	selectedFrame.erase = defaults.erase;
	selectedFrame.preserveAlpha = defaults.preserveAlpha;
	selectedFrame.colorOverlayCheck = defaults.colorOverlayCheck;
	selectedFrame.colorOverlay = defaults.colorOverlay;
	selectedFrame.hslHue = defaults.hslHue;
	selectedFrame.hslSaturation = defaults.hslSaturation;
	selectedFrame.hslLightness = defaults.hslLightness;
	selectedFrame.rotation = defaults.rotation;
	selectedFrame.flipX = defaults.flipX;
	selectedFrame.flipY = defaults.flipY;
	selectedFrame.hidden = defaults.hidden;
	syncFrameElementVisibility(selectedFrame);
	refreshSelectedFrameEditor();
	drawFrames();
	commitDesignUndoSnapshot(undoSnapshot, 'Restore frame component default');
}

var frameComponentRecipes = {
	'M15Regular-1': ['Border', 'Title', 'Type', 'Rules', 'Pinline', 'Frame'],
	'Class': ['Border', 'Text Boxes', 'Title', 'Type', 'Rules', 'Pinline', 'Frame'],
	'ClassUB': ['Border', 'Text Boxes', 'Title', 'Type', 'Rules', 'Pinline', 'Frame']
};
var genericFrameComponentOrder = [
	'Border',
	'Power/Toughness',
	'Text Boxes',
	'Title',
	'Type',
	'Rules',
	'Pinline',
	'Frame'
];
function normalizeFrameComponentName(value) {
	return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function setFrameDecompositionStatus(message, isError = false) {
	const status = document.querySelector('#frame-decomposition-status');
	if (!status) {
		return;
	}
	status.textContent = message;
	status.classList.toggle('error', isError);
}
function selectFrameComponentMasks(frame) {
	const masks = cloneFrameEditorValue(frame.designComponentMasks || []);
	if (masks.length < 2) {
		return [];
	}
	const recipe = frameComponentRecipes[frame.designSourcePack] || genericFrameComponentOrder;
	const masksByName = {};
	masks.forEach(mask => {
		const key = normalizeFrameComponentName(mask.name);
		if (key && !masksByName[key]) {
			masksByName[key] = mask;
		}
	});
	const selected = [];
	recipe.forEach(name => {
		const mask = masksByName[normalizeFrameComponentName(name)];
		if (mask) {
			selected.push(mask);
		}
	});
	return selected.length > 1 ? selected : [];
}
function cloneFrameForComponent(frame, mask) {
	const copy = JSON.parse(JSON.stringify(frame, (key, value) => {
		return key == 'image' || key == 'editorDefaults' ? undefined : value;
	}));
	const sourceName = frame.designSourceFrameName || frame.name || 'Frame';
	copy.name = sourceName + ' — ' + (mask.name || 'Component');
	copy.componentLabel = copy.name;
	copy.componentKind = mask.name || 'Component';
	copy.masks = [cloneFrameEditorValue(mask)];
	copy.designComponentPending = false;
	copy.designComponentDecomposed = true;
	delete copy.designComponentMasks;
	delete copy.designLayerId;
	delete copy.editorDefaults;
	return copy;
}
async function rebuildFrameLayerList() {
	const list = document.querySelector('#frame-list');
	if (!list) {
		return;
	}
	list.innerHTML = '';
	const framesInLoadOrder = (card.frames || []).slice().reverse();
	for (const frame of framesInLoadOrder) {
		await addFrame([], frame);
	}
}
async function decomposePendingBuiltInFrames() {
	const frames = card.frames || [];
	var decomposedFrameCount = 0;
	var componentCount = 0;
	var skippedFrameCount = 0;
	const rebuiltFrames = [];
	frames.forEach(frame => {
		if (!frame.designComponentPending) {
			rebuiltFrames.push(frame);
			return;
		}
		const componentMasks = selectFrameComponentMasks(frame);
		if (!componentMasks.length) {
			frame.designComponentPending = false;
			rebuiltFrames.push(frame);
			skippedFrameCount++;
			return;
		}
		const componentLayers = componentMasks.map(mask => cloneFrameForComponent(frame, mask));
		rebuiltFrames.push(...componentLayers);
		decomposedFrameCount++;
		componentCount += componentLayers.length;
	});
	if (!decomposedFrameCount && !skippedFrameCount) {
		setFrameDecompositionStatus('No newly added combined frame is waiting to be decomposed.');
		return false;
	}
	card.frames = rebuiltFrames;
	selectedFrame = null;
	document.querySelector('#frame-element-editor')?.classList.remove('opened');
	await rebuildFrameLayerList();
	drawFrames();
	bottomInfoEdited();
	if (decomposedFrameCount) {
		var message = 'Split ' + decomposedFrameCount + ' built-in frame' +
			(decomposedFrameCount == 1 ? '' : 's') + ' into ' + componentCount +
			' editable components using the selected pack\'s masks.';
		if (skippedFrameCount) {
			message += ' Kept ' + skippedFrameCount + ' unsupported frame combined.';
		}
		setFrameDecompositionStatus(message);
	} else {
		setFrameDecompositionStatus('This pack does not expose a safe component recipe, so its frame was kept combined.', true);
	}
	return !!decomposedFrameCount;
}

function drawFrames() {
	frameContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
	var frameToDraw = card.frames.slice().reverse();
	var haveDrawnPrePTCanvas = false;
	frameToDraw.forEach(item => {
		if (item.image && !item.hidden) {
			if (!haveDrawnPrePTCanvas && drawTextBetweenFrames && item.name.includes('Power/Toughness')) {
				haveDrawnPrePTCanvas = true;
				frameContext.globalCompositeOperation = 'source-over';
				frameContext.globalAlpha = 1;
				frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
			}
			frameContext.globalCompositeOperation = item.mode || 'source-over';
			frameContext.globalAlpha = item.opacity / 100 || 1;
			if (item.opacity == 0) {
				frameContext.globalAlpha = 0;
			}
			var bounds = item.bounds || {};
			var ogBounds = item.ogBounds || bounds;
			frameX = Math.round(scaleX(bounds.x || 0));
			frameY = Math.round(scaleY(bounds.y || 0));
			frameWidth = Math.round(scaleWidth(bounds.width || 1));
			frameHeight = Math.round(scaleHeight(bounds.height || 1));
			frameMaskingContext.globalCompositeOperation = 'source-over';
			frameMaskingContext.drawImage(black, 0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);
			frameMaskingContext.globalCompositeOperation = 'source-in';
			item.masks.forEach(mask => {
				// Masks are authored against the complete source canvas. Keep that
				// source canvas in the same local coordinate system as the frame
				// image so card-level orientation changes rotate both together.
				const maskCanvasBounds = item.maskCanvasBounds || {x:0, y:0, width:1, height:1};
				const boundsWidth = Number(bounds.width) || 1;
				const boundsHeight = Number(bounds.height) || 1;
				const originalWidth = Number(ogBounds.width) || 1;
				const originalHeight = Number(ogBounds.height) || 1;
				const scaleHorizontal = boundsWidth / originalWidth;
				const scaleVertical = boundsHeight / originalHeight;
				const maskX = scaleX((Number(bounds.x) || 0) +
					((Number(maskCanvasBounds.x) || 0) - (Number(ogBounds.x) || 0)) * scaleHorizontal);
				const maskY = scaleY((Number(bounds.y) || 0) +
					((Number(maskCanvasBounds.y) || 0) - (Number(ogBounds.y) || 0)) * scaleVertical);
				const maskWidth = scaleWidth((Number(maskCanvasBounds.width) || 1) * scaleHorizontal);
				const maskHeight = scaleHeight((Number(maskCanvasBounds.height) || 1) * scaleVertical);
				drawFrameLayerMask(frameMaskingContext, mask.image, maskX, maskY, maskWidth, maskHeight, item, frameX + frameWidth / 2, frameY + frameHeight / 2);
			});
			if (item.preserveAlpha) { //preserves alpha, and blends colors using an alpha that only cares about the mask(s), and the user-set opacity value
				//draw the image onto a separate canvas to view its unaltered state
				frameCompositingContext.clearRect(0, 0, frameCanvas.width, frameCanvas.height);
				drawFrameLayerImage(frameCompositingContext, item.image, frameX, frameY, frameWidth, frameHeight, item);
				//create pixel arrays for the existing image, new image, and alpha mask
				var existingData = frameContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height)
				var existingPixels = existingData.data;
				var newPixels = frameCompositingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
				var maskPixels = frameMaskingContext.getImageData(0, 0, frameCanvas.width, frameCanvas.height).data;
				const functionalAlphaMultiplier = frameContext.globalAlpha / 255;
				//manually blends colors, basing blending-alpha on the masks and desired draw-opacity, but preserving alpha
				for (var i = 0; i < existingPixels.length; i += 4) {
					const functionalAlpha = maskPixels[i + 3] * functionalAlphaMultiplier //functional alpha = alpha ignoring source image
					if (newPixels[i + 3] > 0) { //Only blend if the new image has alpha
						existingPixels[  i  ] = existingPixels[  i  ] * (1 - functionalAlpha) + newPixels[  i  ] * functionalAlpha; //RED
						existingPixels[i + 1] = existingPixels[i + 1] * (1 - functionalAlpha) + newPixels[i + 1] * functionalAlpha; //GREEN
						existingPixels[i + 2] = existingPixels[i + 2] * (1 - functionalAlpha) + newPixels[i + 2] * functionalAlpha; //BLUE
					}
				}
				frameContext.putImageData(existingData, 0, 0);
			} else {
				//mask the image
				drawFrameLayerImage(frameMaskingContext, item.image, frameX, frameY, frameWidth, frameHeight, item);
				//color overlay
				if (item.colorOverlayCheck) {frameMaskingContext.globalCompositeOperation = 'source-in'; frameMaskingContext.fillStyle = item.colorOverlay; frameMaskingContext.fillRect(0, 0, frameMaskingCanvas.width, frameMaskingCanvas.height);}
				//HSL adjustments
				if (item.hslHue || item.hslSaturation || item.hslLightness) {
					hsl(frameMaskingCanvas, item.hslHue || 0, item.hslSaturation || 0, item.hslLightness || 0);
				}
				//erase mode
				if (item.erase) {frameContext.globalCompositeOperation = 'destination-out';}
				frameContext.drawImage(frameMaskingCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
			}
		}
	});
	if (!haveDrawnPrePTCanvas && drawTextBetweenFrames) {
		haveDrawnPrePTCanvas = true;
		frameContext.globalCompositeOperation = 'source-over';
		frameContext.globalAlpha = 1;
		frameContext.drawImage(prePTCanvas, 0, 0, frameCanvas.width, frameCanvas.height);
	}
	drawCard();
}
function loadFramePacks(framePackOptions = []) {
	document.querySelector('#selectFramePack').innerHTML = null;
	framePackOptions.forEach(item => {
		var framePackOption = document.createElement('option');
		framePackOption.innerHTML = item.name;
		if (item.value == 'disabled') {
			framePackOption.disabled = true;
		} else {
			framePackOption.value = item.value;
		}
		document.querySelector('#selectFramePack').appendChild(framePackOption);
	});
	syncFrameLayoutTemplateControls();
	const selectedPack = document.querySelector('#selectFramePack').value;
	setFrameLayoutTemplateStatus('Loading ' + (document.querySelector('#selectFramePack').selectedOptions[0]?.textContent || selectedPack) + '...');
	return loadScript("/js/frames/pack" + selectedPack + ".js");
}
function loadFramePack(frameOptions = availableFrames) {
	resetDoubleClick();
	document.querySelector('#frame-picker').innerHTML = null;
	frameOptions.forEach(item => {
		var frameOption = document.createElement('div');
		frameOption.classList = 'frame-option hidden';
		frameOption.onclick = frameOptionClicked;
		var frameOptionImage = document.createElement('img');
		frameOption.appendChild(frameOptionImage);
		frameOptionImage.onload = function() {
			this.parentElement.classList.remove('hidden');
		}
		if (!item.noThumb && !item.src.includes('/img/black.png')) {
			frameOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
		} else {
			frameOptionImage.src = fixUri(item.src);
		}
		document.querySelector('#frame-picker').appendChild(frameOption);

	})
	document.querySelector('#mask-picker').innerHTML = '';
	document.querySelector('#frame-picker').children[0].click();
	registerCurrentFrameLayoutTemplate();
	if (!suppressFrameVersionAutoload && localStorage.getItem('autoLoadFrameVersion') == 'true') {
		applyCurrentFrameLayout({force:true, source:'auto'});
	}
}
function autoLoadFrameVersion() {
	localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}
function frameOptionClicked(event) {
	const button = doubleClick(event, 'frame');
	const clickedFrameOption = event.target.closest('.frame-option');
	const newFrameIndex = getElementIndex(clickedFrameOption);
	if (newFrameIndex != selectedFrameIndex || document.querySelector('#mask-picker').innerHTML == '') {
		resetDoubleClick();
		Array.from(document.querySelectorAll('.frame-option.selected')).forEach(element => element.classList.remove('selected'));
		clickedFrameOption.classList.add('selected');
		selectedFrameIndex = newFrameIndex;
		if (!availableFrames[selectedFrameIndex].noDefaultMask) {
			document.querySelector('#mask-picker').innerHTML = '<div class="mask-option" onclick="maskOptionClicked(event)"><img src="' + black.src + '"><p>No Mask</p></div>';
		} else {
			document.querySelector('#mask-picker').innerHTML = '';
		}
		document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', No Mask)';
		if (availableFrames[selectedFrameIndex].masks) {
			availableFrames[selectedFrameIndex].masks.forEach(item => {
				const maskOption = document.createElement('div');
				maskOption.classList = 'mask-option hidden';
				maskOption.onclick = maskOptionClicked;
				const maskOptionImage = document.createElement('img');
				maskOption.appendChild(maskOptionImage);
				maskOptionImage.onload = function() {
					this.parentElement.classList.remove('hidden');
				}
				maskOptionImage.src = fixUri(item.src.replace('.png', 'Thumb.png').replace('.svg', 'Thumb.png'));
				const maskOptionLabel = document.createElement('p');
				maskOptionLabel.innerHTML = item.name;
				maskOption.appendChild(maskOptionLabel);
				document.querySelector('#mask-picker').appendChild(maskOption);
			});
		}
		const firstChild = document.querySelector('#mask-picker').firstChild;
		firstChild.classList.add('selected');
		firstChild.click();
	} else if (button) { button.click(); resetDoubleClick(); }
}
function maskOptionClicked(event) {
	var button = doubleClick(event, 'mask');
	const clickedMaskOption = event.target.closest('.mask-option');
	(document.querySelector('.mask-option.selected').classList || document.querySelector('body').classList).remove('selected');
	clickedMaskOption.classList.add('selected');
	const newMaskIndex = getElementIndex(clickedMaskOption)
	if (newMaskIndex != selectedMaskIndex) { button = null; }
	selectedMaskIndex = newMaskIndex;
	var selectedMaskName = 'No Mask'
	if (selectedMaskIndex > 0) {selectedMaskName = availableFrames[selectedFrameIndex].masks[selectedMaskIndex - 1].name;}
	document.querySelector('#selectedPreview').innerHTML = '(Selected: ' + availableFrames[selectedFrameIndex].name + ', ' + selectedMaskName + ')';
	if (button) { button.click(); resetDoubleClick(); }
}
function resetDoubleClick() {
	lastFrameClick, lastMaskClick = null, null;
}
function doubleClick(event, maskOrFrame) {
	const currentClick = (new Date()).getTime();
	var lastClick = null;
	if (maskOrFrame == 'mask') {
		lastClick = lastMaskClick;
		lastMaskClick = currentClick;
	} else {
		lastClick = lastFrameClick + 0;
		lastFrameClick = currentClick + 0;
	}
	if (lastClick && lastClick + 500 > currentClick) {
		var buttonID = null;
		if (event.shiftKey) {
			buttonID = '#addToRightHalf';
		} else if (event.ctrlKey) {
			buttonID = '#addToLeftHalf';
		} else if (event.altKey) {
			buttonID = '#addToMiddleThird';
		} else {
			buttonID = '#addToFull';
		}
		return document.querySelector(buttonID);
	}
	return null;
}
function cardFrameProperties(colors, manaCost, typeLine, power, style) {
	var colors = colors.map(color => color.toUpperCase())
	if ([
			['U', 'W'],
			['B', 'W'],
			['R', 'B'],
			['G', 'B'],
			['B', 'U'],
			['R', 'U'],
			['G', 'R'],
			['W', 'R'],
			['W', 'G'],
			['U', 'G']
		].map(arr => JSON.stringify(arr) === JSON.stringify(colors)).includes(true)) {
		colors.reverse();
	}

	var isHybrid = manaCost.includes('/');

	var rules;
	if (style == 'Seventh') {
		if (typeLine.includes('Land')) {
			if (colors.length == 0 || colors.length > 2) {
				rules = 'L';
			} else {
				rules = colors[0] + 'L';
			}
		} else {
			if (colors.length == 1) {
				rules = colors[0];
			} else if (colors.length >=2) {
				rules = 'M';
			} else if (typeLine.includes("Artifact")) {
				rules = 'A';
			} else {
				rules = 'C';
			}
		}

	} else {
		if (typeLine.includes('Land')) {
			if (colors.length == 0) {
				rules = 'L';
			} else if (colors.length > 2) {
				rules = 'ML';
			} else {
				rules = colors[0] + 'L';
			}
		} else if (colors.length > 2) {
			if (style == 'Etched' && typeLine.includes('Artifact')) {
				rules = 'A';
			} else {
				rules = 'M';
			}
		} else if (colors.length != 0) {
			rules = colors[0];
		} else if (style == 'Borderless' && !typeLine.includes('Artifact')) {
			rules = 'C';
		} else {
			rules = 'A';
		}
	}

	var rulesRight;
	if (colors.length == 2) {
		if (typeLine.includes('Land')) {
			rulesRight = colors[1] + 'L';
		} else if (style != 'Seventh') {
			rulesRight = colors[1];
		}
	}

	var pinline = rules;
	var pinlineRight = rulesRight;

	if (style == 'Seventh' && typeLine.includes('Land') && colors.length >= 2) {
		pinline = 'L';
		pinlineRight = null;
	}

	var typeTitle;
	if (colors.length >= 2) {
		if (isHybrid || typeLine.includes('Land')) {
			if (colors.length >= 3) {
				typeTitle = 'M';
			} else {
				typeTitle = 'L';
			}
		} else {
			typeTitle = 'M';
		}
	} else if (typeLine.includes('Land')) {
		if (colors.length == 0) {
			typeTitle = 'L';
		} else if (style == 'Etched') {
			if (colors.length > 2) {
				typeTitle = 'M';
			} else if (colors.length == 1) {
				typeTitle = colors[0];
			} else {
				typeTitle = 'L';
			}
		} else {
			typeTitle = colors[0] + 'L';
		}
	} else if (colors.length == 1) {
		typeTitle = colors[0];
	} else if (style == 'Borderless' && !typeLine.includes('Artifact')) {
		typeTitle = 'C';
	} else {
		typeTitle = 'A';
	}

	var pt;
	if (power) {
		if (typeLine.includes('Vehicle')) {
			pt = 'V';
		} else if (typeTitle == 'L') {
			pt = 'C';
		} else {
			pt = typeTitle;
		}
	}

	var frame;
	if (style == 'Seventh') {
		if (typeLine.includes('Land')) {
			frame = 'L'
		} else {
			frame = pinline;
		}
	} else if (typeLine.includes('Land')) {
		if (style == 'Etched') {
			if (colors.length > 2) {
				frame = 'M';
			} else if (colors.length > 0) {
				frame = colors[0];
			} else {
				frame = 'L';
			}
		} else {
			frame = 'L';
		}
	} else if (typeLine.includes('Vehicle')) {
		frame = 'V';
	} else if (typeLine.includes('Artifact')) {
		frame = 'A';
	} else if (colors.length > 2) {
		frame = 'M';
	} else if (colors.length == 2) {
		if (isHybrid || style == 'Etched') {
			frame = colors[0];
		} else {
			frame = 'M';
		}
	} else if (colors.length == 1) {
		frame = colors[0];
	} else {
		frame = 'L';
	}

	var frameRight;
	if (!(typeLine.includes('Vehicle') || typeLine.includes('Artifact'))) {
		if (colors.length == 2 && (isHybrid || style == 'Etched')) {
			frameRight = colors[1];
		}
	}

	return {
		'pinline': pinline,
		'pinlineRight': pinlineRight,
		'rules': rules,
		'rulesRight': rulesRight,
		'typeTitle': typeTitle,
		'pt': pt,
		'frame': frame,
		'frameRight': frameRight
	}
}

function setAutoframeNyx(value) {
	localStorage.setItem('autoframe-always-nyx', document.querySelector('#autoframe-always-nyx').checked);
	setAutoFrame();
}

var autoFramePack;

async function addFrame(additionalMasks = [], loadingFrame = false) {
	if (!loadingFrame && activeFrameWorkspace == 'browse') {
		await applyCurrentFrameLayout({source:'browse'});
	}
	// Restored frames must keep the same object reference stored in card.frames.
	// addFrame attaches runtime Image objects to this object; cloning it here would
	// populate the layer list while leaving the canvas copy without an image.
	var frameToAdd = loadingFrame
		? loadingFrame
		: JSON.parse(JSON.stringify(availableFrames[selectedFrameIndex]));
	if (!loadingFrame && frameToAdd.designCreated) {
		prepareNewDesignElementForOrientation(frameToAdd);
	}
	ensureDesignLayerId(frameToAdd);
	var maskThumbnail = true;
	if (!loadingFrame) {
		// Keep an untouched copy of the pack's component masks. When an unmasked
		// built-in frame is taken into Design Frame, these definitions let us
		// split the combined texture into editable semantic layers.
		var packComponentMasks = cloneFrameEditorValue(frameToAdd.masks || []);
		var noDefaultMask = frameToAdd.noDefaultMask ? 1 : 0;
		var hasSelectedComponentMask = !!(frameToAdd.masks && selectedMaskIndex + noDefaultMask > 0);
		frameToAdd.designSourcePack = document.querySelector('#selectFramePack')?.value || '';
		frameToAdd.designSourceFrameName = frameToAdd.name || 'Frame';
		frameToAdd.designComponentMasks = packComponentMasks;
		frameToAdd.designComponentPending = packComponentMasks.length > 1 &&
			!hasSelectedComponentMask && additionalMasks.length == 0;
		// The frame is being added manually by the user, so we must process which mask(s) they have selected
		if (hasSelectedComponentMask) {
			frameToAdd.masks = frameToAdd.masks.slice(selectedMaskIndex - 1 + noDefaultMask, selectedMaskIndex + noDefaultMask);
		} else {
		 	frameToAdd.masks = [];
		 	maskThumbnail = false;
		}
		additionalMasks.forEach(item => {
			if (item.name in replacementMasks) {
				const replacement = replacementMasks[item.name];
				if (typeof replacement === 'string') {
					// String value: just replace the src
					item.src = replacement;
				} else if (typeof replacement === 'object') {
					// Object value: merge properties
					Object.assign(item, replacement);
				}
			}
			frameToAdd.masks.push(item);
		});
		// Check if any mask has preserveAlpha and transfer it to the frame
		frameToAdd.masks.forEach(mask => {
			if (mask.preserveAlpha) {
				frameToAdd.preserveAlpha = true;
			}
		});
		// Likewise, we now add any complementary frames
		if ('complementary' in frameToAdd && frameToAdd.masks.length == 0) {
			if (typeof frameToAdd.complementary == 'number') {
				frameToAdd.complementary = [frameToAdd.complementary];
			} else if (typeof frameToAdd.complementary == 'string') {
				availableFrames.forEach((availableFrame, index, availableFrames) => {
				  if (availableFrame.name == frameToAdd.complementary) {
				  	frameToAdd.complementary = [index];
				  }
				})
			}
			const realFrameIndex = selectedFrameIndex;
			for (const index of frameToAdd.complementary) {
				selectedFrameIndex = index;
				await addFrame();
			}
			selectedFrameIndex = realFrameIndex;
		}
	} else {
		frameToAdd.masks = frameToAdd.masks || [];
		if (frameToAdd.masks.length == 0 || (frameToAdd.masks[0].src.includes('/img/frames/mask'))) {
			maskThumbnail = false;
		}
	}
	ensureFrameEditorDefaults(frameToAdd);
	frameToAdd.masks.forEach(item => {
		item.image = new Image();
		item.image.crossOrigin = 'anonymous';
		item.image.src = blank.src;
		item.image.onload = drawFrames;
		ImageLoadTracker.track(fixUri(item.src));
		item.image.src = fixUri(item.src);
	});
	frameToAdd.image = new Image();
	frameToAdd.image.crossOrigin = 'anonymous'
	frameToAdd.image.src = blank.src;
	frameToAdd.image.onload = drawFrames;
	if ('stretch' in frameToAdd) {
		stretchSVG(frameToAdd);
	} else {
		ImageLoadTracker.track(fixUri(frameToAdd.src));
		frameToAdd.image.src = fixUri(frameToAdd.src);
	}
	if (!loadingFrame) {
		card.frames.unshift(frameToAdd);
	}
	var frameElement = document.createElement('div');
	frameElement.classList = 'draggable frame-element';
	frameElement.dataset.designLayerId = frameToAdd.designLayerId;
	if (frameToAdd === selectedFrame) {
		frameElement.classList.add('design-selected');
	}
	frameElement.draggable = 'true';
	frameElement.ondragstart = dragStart;
	frameElement.ondragend = dragEnd;
	frameElement.ondragover = dragOver;
	frameElement.ontouchstart = dragStart;
	frameElement.ontouchend = dragEnd;
	frameElement.ontouchmove = touchMove;
	frameElement.onclick = frameElementClicked;
	var frameElementImage = document.createElement('img');
	if (frameToAdd.noThumb || frameToAdd.src.includes('/img/black.png')) {
		frameElementImage.src = fixUri(frameToAdd.src);
	} else {
		frameElementImage.src = fixUri(frameToAdd.src.replace('.png', 'Thumb.png'));
	}
	frameElement.appendChild(frameElementImage);
	var frameElementMask = document.createElement('img');
	if (maskThumbnail) {
		var frameElementMaskDefinition = frameToAdd.masks[0];
		frameElementMask.src = fixUri(frameElementMaskDefinition.noThumb
			? frameElementMaskDefinition.src
			: frameElementMaskDefinition.src.replace('.png', 'Thumb.png'));
	} else {
		frameElementMask.src = black.src;
	}
	frameElement.appendChild(frameElementMask);
	var frameElementLabel = document.createElement('h4');
	frameElementLabel.innerHTML = frameToAdd.componentLabel || frameToAdd.name;
	if (!frameToAdd.componentLabel) {
		frameToAdd.masks.forEach(item => frameElementLabel.innerHTML += ', ' + item.name);
	}
	frameElement.appendChild(frameElementLabel);
	var frameElementClose = document.createElement('h4');
	frameElementClose.innerHTML = 'X';
	frameElementClose.classList = 'frame-element-close';
	frameElementClose.onclick = removeFrame;
	frameElement.appendChild(frameElementClose);
	document.querySelector('#frame-list').prepend(frameElement);
	syncFrameElementVisibility(frameToAdd);
	bottomInfoEdited();
}
function removeFrame(event) {
	card.frames.splice(getElementIndex(event.target.parentElement), 1);
	event.target.parentElement.remove();
	drawFrames();
	bottomInfoEdited();
}
function frameElementClicked(event) {
	if (activeFrameWorkspace != 'design') {
		return;
	}
	if (!event.target.classList.contains('frame-element-close')) {
		var selectedFrameElement = event.target.closest('.frame-element');
		selectedFrame = card.frames[Array.from(selectedFrameElement.parentElement.children).indexOf(selectedFrameElement)];
		ensureDesignLayerId(selectedFrame);
		Array.from(document.querySelectorAll('#frame-list .frame-element')).forEach(element => {
			element.classList.toggle('design-selected', element === selectedFrameElement);
		});
		setFrameDesignMode('frames');
		document.querySelector('#frame-element-editor').classList.add('opened');
		selectedFrame.bounds = selectedFrame.bounds || {};
		if (selectedFrame.ogBounds == undefined) {
			selectedFrame.ogBounds = JSON.parse(JSON.stringify(selectedFrame.bounds));
		}
		// Basic manipulations
		document.querySelector('#frame-editor-x').value = scaleWidth(selectedFrame.bounds.x || 0);
		document.querySelector('#frame-editor-x').onchange = (event) => {selectedFrame.bounds.x = (event.target.value / card.width); drawFrames();}
		document.querySelector('#frame-editor-y').value = scaleHeight(selectedFrame.bounds.y || 0);
		document.querySelector('#frame-editor-y').onchange = (event) => {selectedFrame.bounds.y = (event.target.value / card.height); drawFrames();}
		document.querySelector('#frame-editor-width').value = scaleWidth(selectedFrame.bounds.width || 1);
		document.querySelector('#frame-editor-width').onchange = (event) => {selectedFrame.bounds.width = (event.target.value / card.width); drawFrames();}
		document.querySelector('#frame-editor-height').value = scaleHeight(selectedFrame.bounds.height || 1);
		document.querySelector('#frame-editor-height').onchange = (event) => {selectedFrame.bounds.height = (event.target.value / card.height); drawFrames();}
		document.querySelector('#frame-editor-rotation').value = Number(selectedFrame.rotation) || 0;
		document.querySelector('#frame-editor-rotation').onchange = (event) => {selectedFrame.rotation = Number(event.target.value) || 0; drawFrames();}
		document.querySelector('#frame-editor-visible').checked = !selectedFrame.hidden;
		document.querySelector('#frame-editor-visible').onchange = (event) => {selectedFrame.hidden = !event.target.checked; syncFrameElementVisibility(selectedFrame); drawFrames();}
		document.querySelector('#frame-editor-flip-x').checked = !!selectedFrame.flipX;
		document.querySelector('#frame-editor-flip-x').onchange = (event) => {selectedFrame.flipX = event.target.checked; drawFrames();}
		document.querySelector('#frame-editor-flip-y').checked = !!selectedFrame.flipY;
		document.querySelector('#frame-editor-flip-y').onchange = (event) => {selectedFrame.flipY = event.target.checked; drawFrames();}
		document.querySelector('#frame-editor-opacity').value = selectedFrame.opacity || 100;
		document.querySelector('#frame-editor-opacity').onchange = (event) => {selectedFrame.opacity = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-erase').checked = selectedFrame.erase || false;
		document.querySelector('#frame-editor-erase').onchange = (event) => {selectedFrame.erase = event.target.checked; drawFrames();}
		document.querySelector('#frame-editor-alpha').checked = selectedFrame.preserveAlpha || false;
		document.querySelector('#frame-editor-alpha').onchange = (event) => {selectedFrame.preserveAlpha = event.target.checked; drawFrames();}
		document.querySelector('#frame-editor-color-overlay-check').checked = selectedFrame.colorOverlayCheck || false;
		document.querySelector('#frame-editor-color-overlay-check').onchange = (event) => {selectedFrame.colorOverlayCheck = event.target.checked; drawFrames();}
		document.querySelector('#frame-editor-color-overlay').value = selectedFrame.colorOverlay || false;
		document.querySelector('#frame-editor-color-overlay').onchange = (event) => {selectedFrame.colorOverlay = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-hue').value = selectedFrame.hslHue || 0;
		document.querySelector('#frame-editor-hsl-hue-slider').value = selectedFrame.hslHue || 0;
		document.querySelector('#frame-editor-hsl-hue').onchange = (event) => {selectedFrame.hslHue = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-hue-slider').onchange = (event) => {selectedFrame.hslHue = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-saturation').value = selectedFrame.hslSaturation || 0;
		document.querySelector('#frame-editor-hsl-saturation-slider').value = selectedFrame.hslSaturation || 0;
		document.querySelector('#frame-editor-hsl-saturation').onchange = (event) => {selectedFrame.hslSaturation = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-saturation-slider').onchange = (event) => {selectedFrame.hslSaturation = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-lightness').value = selectedFrame.hslLightness || 0;
		document.querySelector('#frame-editor-hsl-lightness-slider').value = selectedFrame.hslLightness || 0;
		document.querySelector('#frame-editor-hsl-lightness').onchange = (event) => {selectedFrame.hslLightness = event.target.value; drawFrames();}
		document.querySelector('#frame-editor-hsl-lightness-slider').onchange = (event) => {selectedFrame.hslLightness = event.target.value; drawFrames();}
		// Removing masks
		const selectMaskElement = document.querySelector('#frame-editor-masks');
		selectMaskElement.innerHTML = null;
		const maskOptionNone = document.createElement('option');
		maskOptionNone.disabled = true;
		maskOptionNone.innerHTML = 'None Selected';
		selectMaskElement.appendChild(maskOptionNone);
		selectedFrame.masks.forEach(mask => {
			const maskOption = document.createElement('option');
			maskOption.innerHTML = mask.name;
			selectMaskElement.appendChild(maskOption);
		});
		selectMaskElement.selectedIndex = 0;
		drawCard();
	}
}
function frameElementMaskRemoved() {
	const selectElement = document.querySelector('#frame-editor-masks');
	const selectedOption = selectElement.value;
	if (selectedOption != 'None Selected') {
		selectElement.remove(selectElement.selectedIndex);
		selectElement.selectedIndex = 0;
		selectedFrame.masks.forEach(mask => {
			if (mask.name == selectedOption) {
				selectedFrame.masks = selectedFrame.masks.filter(item => item.name != selectedOption);
				drawFrames();
			}
		});
	}
}
async function uploadMaskOption(imageSource, otherParams) {
	const fallbackName = `Uploaded Mask (${customCount})`;
	const assetName = window.FrameProjectStore
		? FrameProjectStore.sourceFromParams(otherParams, fallbackName)
		: fallbackName;
	const uploadedMask = {name:assetName, src:imageSource, noThumb:true, image:new Image()};
	customCount ++;
	if (window.FrameProjectStore) {
		try {
			const savedAsset = await FrameProjectStore.saveSourceAsset(imageSource, assetName, 'mask');
			uploadedMask.assetId = savedAsset.id;
		} catch (error) {
			console.warn('The uploaded mask could not be added to the persistent asset library.', error);
		}
	}
	selectedFrame.masks.push(uploadedMask);
	uploadedMask.image.onload = drawFrames;
	uploadedMask.image.src = imageSource;
}
async function uploadFrameOption(imageSource, otherParams) {
	const fallbackName = `Uploaded Image (${customCount})`;
	const assetName = window.FrameProjectStore
		? FrameProjectStore.sourceFromParams(otherParams, fallbackName)
		: fallbackName;
	const uploadedFrame = {
		name:assetName,
		src:imageSource,
		noThumb:true,
		masks:[],
		bounds:{x:0, y:0, width:1, height:1},
		designCreated:true
	};
	customCount ++;
	if (window.FrameProjectStore) {
		try {
			const savedAsset = await FrameProjectStore.saveSourceAsset(imageSource, assetName, 'frame');
			uploadedFrame.assetId = savedAsset.id;
		} catch (error) {
			console.warn('The uploaded frame could not be added to the persistent asset library.', error);
		}
	}
	availableFrames.push(uploadedFrame);
	loadFramePack();
}
function hsl(canvas, inputH, inputS, inputL) {
	//adjust inputs
	var hue = parseInt(inputH) / 360;
	var saturation = parseInt(inputS) / 100;
	var lightness = parseInt(inputL) / 100;
	//create needed objects
	var context = canvas.getContext('2d')
	var imageData = context.getImageData(0, 0, canvas.width, canvas.height);
	var pixels = imageData.data;
	//for every pixel...
	for (var i = 0; i < pixels.length; i += 4) {
		//grab rgb
		var r = pixels[i];
		var g = pixels[i + 1];
		var b = pixels[i + 2];
		//convert to hsl
		var res = rgbToHSL(r, g, b);
		h = res[0];
		s = res[1];
		l = res[2];
		//make adjustments
		h += hue;
		while (h > 1) {h --;}
		s = Math.min(Math.max(s + saturation, 0), 1);
		l = Math.min(Math.max(l + lightness, 0), 1);
		//convert back to rgb
		res = hslToRGB(h, s, l);
		r = res[0];
		g = res[1];
		b = res[2];
		//and reassign
		pixels[i] = r;
		pixels[i + 1] = g;
		pixels[i + 2] = b;
	}
	//then put the new image data back
	context.putImageData(imageData, 0, 0);
}
function croppedCanvas(oldCanvas, sensitivity = 0) {
	var oldContext = oldCanvas.getContext('2d');
	var newCanvas = document.createElement('canvas');
	var newContext = newCanvas.getContext('2d');
	var pixels = oldContext.getImageData(0, 0, oldCanvas.width, oldCanvas.height).data;
	var pixX = [];
	var pixY = [];
	for (var x = 0; x < oldCanvas.width; x += 1) {
		for (var y = 0; y < oldCanvas.height; y += 1) {
			if (pixels[(y * oldCanvas.width + x) * 4 + 3] > sensitivity) {
				pixX.push(x);
				pixY.push(y);
			}
		}
	}
	pixX.sort(function(a, b) { return a - b });
	pixY.sort(function(a, b) { return a - b });
	var n = pixX.length - 1;
	var newWidth = 1 + pixX[n] - pixX[0];
	var newHeight = 1 + pixY[n] - pixY[0];
	newCanvas.width = newWidth;
	newCanvas.height = newHeight;
	newContext.putImageData(oldCanvas.getContext('2d').getImageData(pixX[0], pixY[0], newWidth, newHeight), 0, 0);
	return newCanvas;
}
/*
shoutout to https://stackoverflow.com/questions/2353211/hsl-to-rgb-color-conversion for providing the hsl-rgb conversion algorithms
*/
function rgbToHSL(r, g, b){
    r /= 255, g /= 255, b /= 255;
    var max = Math.max(r, g, b), min = Math.min(r, g, b);
    var h, s, l = (max + min) / 2;

    if(max == min){
        h = s = 0; // achromatic
    }else{
        var d = max - min;
        s = l > 0.5 ? d / (2 - max - min) : d / (max + min);
        switch(max){
            case r: h = (g - b) / d + (g < b ? 6 : 0); break;
            case g: h = (b - r) / d + 2; break;
            case b: h = (r - g) / d + 4; break;
        }
        h /= 6;
    }

    return [h, s, l];
}
function hslToRGB(h, s, l){
    var r, g, b;

    if(s == 0){
        r = g = b = l; // achromatic
    }else{
        var hue2rgb = function hue2rgb(p, q, t){
            if(t < 0) t += 1;
            if(t > 1) t -= 1;
            if(t < 1/6) return p + (q - p) * 6 * t;
            if(t < 1/2) return q;
            if(t < 2/3) return p + (q - p) * (2/3 - t) * 6;
            return p;
        }

        var q = l < 0.5 ? l * (1 + s) : l + s - l * s;
        var p = 2 * l - q;
        r = hue2rgb(p, q, h + 1/3);
        g = hue2rgb(p, q, h);
        b = hue2rgb(p, q, h - 1/3);
    }

    return [Math.round(r * 255), Math.round(g * 255), Math.round(b * 255)];
}
//TEXT TAB
var writingText;
var autoFrameTimer;
function loadTextOptions(textObject, replace=true) {
	var oldCardText = card.text || {};
	Object.entries(oldCardText).forEach(item => {
		savedTextContents[item[0]] = oldCardText[item[0]].text;
	});
	if (replace) {
		card.text = textObject;
	} else {
		Object.keys(textObject).forEach(key => {
			card.text[key] = textObject[key];
		});
	}
	document.querySelector('#text-options').innerHTML = null;
	Object.entries(card.text).forEach(item => {
		if (oldCardText[item[0]]) {
			card.text[item[0]].text = oldCardText[item[0]].text;
		} else if (savedTextContents[item[0]]) {
			card.text[item[0]].text = savedTextContents[item[0]];
		}
		var textOptionElement = document.createElement('h4');
		textOptionElement.innerHTML = item[1].name;
		textOptionElement.classList = 'selectable text-option'
		textOptionElement.onclick = textOptionClicked;
		document.querySelector('#text-options').appendChild(textOptionElement);
	});
	document.querySelector('#text-options').firstChild.click();
	drawTextBuffer();
	drawNewGuidelines();
}
function textOptionClicked(event) {
	selectedTextIndex = getElementIndex(event.target);
	document.querySelector('#text-editor').value = Object.entries(card.text)[selectedTextIndex][1].text;
	document.querySelector('#text-editor-font-size').value = Object.entries(card.text)[selectedTextIndex][1].fontSize;
	selectSelectable(event);
}
function textboxEditor() {
	var selectedTextbox = card.text[Object.keys(card.text)[selectedTextIndex]];
	document.querySelector('#textbox-editor').classList.add('opened');
	document.querySelector('#textbox-editor-x').value = scaleWidth(selectedTextbox.x || 0);
	document.querySelector('#textbox-editor-x').onchange = (event) => {selectedTextbox.x = (event.target.value / card.width); textEdited();}
	document.querySelector('#textbox-editor-y').value = scaleHeight(selectedTextbox.y || 0);
	document.querySelector('#textbox-editor-y').onchange = (event) => {selectedTextbox.y = (event.target.value / card.height); textEdited();}
	document.querySelector('#textbox-editor-width').value = scaleWidth(selectedTextbox.width || 1);
	document.querySelector('#textbox-editor-width').onchange = (event) => {selectedTextbox.width = (event.target.value / card.width); textEdited();}
	document.querySelector('#textbox-editor-height').value = scaleHeight(selectedTextbox.height || 1);
	document.querySelector('#textbox-editor-height').onchange = (event) => {selectedTextbox.height = (event.target.value / card.height); textEdited();}
}
function restoreCurrentTextboxDefault() {
	restoreSelectedTextFieldDefaults();
}
function textEdited() {
	card.text[Object.keys(card.text)[selectedTextIndex]].text = curlyQuotes(document.querySelector('#text-editor').value);
	drawTextBuffer();
	autoFrameBuffer();
}
function fontSizedEdited() {
	card.text[Object.keys(card.text)[selectedTextIndex]].fontSize = document.querySelector('#text-editor-font-size').value;
	drawTextBuffer();
}

var CARD_TEXT_COLLISION_MINIMUM_REDUCTION = 25;
var cardTextFitResults = [];
var cardTextCollisionWarnings = [];
window.CardTextFitResults = [];
window.CardTextCollisionWarnings = [];

function normalizeCardTextSemantic(value) {
	return String(value || '').toLowerCase().replace(/[^a-z0-9]+/g, '');
}
function cardTextObjectKey(textObject) {
	return Object.keys(card.text || {}).find(function (key) {
		return card.text[key] === textObject;
	}) || '';
}
function cardTextSemanticRole(textObject, key) {
	var keyName = normalizeCardTextSemantic(key || cardTextObjectKey(textObject));
	var label = normalizeCardTextSemantic(textObject && (textObject.csvFieldLabel || textObject.name));
	if ((textObject && textObject.manaCost) || /^mana\d*$/.test(keyName) || /^manacost\d*$/.test(label)) return 'mana';
	if (/^title\d*$/.test(keyName) || /^(title|cardtitle|cardname)\d*$/.test(label)) return 'title';
	if (/^type\d*$/.test(keyName) || /^(type|typeline|cardtype)\d*$/.test(label)) return 'type';
	if (/^rules\d*$/.test(keyName) || /^(rules|rulestext)\d*$/.test(label)) return 'rules';
	if (/^pt\d*$/.test(keyName) || /^(pt|frontpt|reversept|powertoughness)\d*$/.test(label)) return 'pt';
	if (/^rarity\d*$/.test(keyName) || /^rarity\d*$/.test(label)) return 'rarity';
	return '';
}
function cardTextHasVisibleContent(textObject) {
	if (!textObject || textObject.hidden) return false;
	var visible = String(textObject.text || '')
		.replace(/{[^{}]*}/g, '')
		.replace(/[\s\uFFEE]+/g, '');
	return visible.length > 0 || /{[^{}]+}/.test(String(textObject.text || ''));
}
function cardTextPixelRect(textObject, widthOverride, heightOverride) {
	var width = widthOverride === undefined ? scaleWidth(Number(textObject.width) || 1) : widthOverride;
	var height = heightOverride === undefined ? scaleHeight(Number(textObject.height) || 1) : heightOverride;
	var x = scaleX(Number(textObject.x) || 0);
	var y = scaleY(Number(textObject.y) || 0);
	return {
		x:x,
		y:y,
		width:Math.max(1, width),
		height:Math.max(1, height),
		rotation:Number(textObject.rotation) || 0,
		pivotX:x,
		pivotY:y
	};
}
function cardTextRotatedCorners(rect) {
	var pivotX = Number.isFinite(Number(rect.pivotX)) ? Number(rect.pivotX) : rect.x + rect.width / 2;
	var pivotY = Number.isFinite(Number(rect.pivotY)) ? Number(rect.pivotY) : rect.y + rect.height / 2;
	var radians = (Number(rect.rotation) || 0) * Math.PI / 180;
	var cosine = Math.cos(radians);
	var sine = Math.sin(radians);
	return [
		{x:rect.x, y:rect.y},
		{x:rect.x + rect.width, y:rect.y},
		{x:rect.x + rect.width, y:rect.y + rect.height},
		{x:rect.x, y:rect.y + rect.height}
	].map(function (point) {
		var relativeX = point.x - pivotX;
		var relativeY = point.y - pivotY;
		return {
			x:pivotX + relativeX * cosine - relativeY * sine,
			y:pivotY + relativeX * sine + relativeY * cosine
		};
	});
}
function cardTextRectInLocalCoordinates(rect, targetRect) {
	var targetPivotX = Number.isFinite(Number(targetRect.pivotX)) ? Number(targetRect.pivotX) : targetRect.x;
	var targetPivotY = Number.isFinite(Number(targetRect.pivotY)) ? Number(targetRect.pivotY) : targetRect.y;
	var radians = -(Number(targetRect.rotation) || 0) * Math.PI / 180;
	var cosine = Math.cos(radians);
	var sine = Math.sin(radians);
	var points = cardTextRotatedCorners(rect).map(function (point) {
		var relativeX = point.x - targetPivotX;
		var relativeY = point.y - targetPivotY;
		return {
			x:targetPivotX + relativeX * cosine - relativeY * sine - targetRect.x,
			y:targetPivotY + relativeX * sine + relativeY * cosine - targetRect.y
		};
	});
	return {
		left:Math.min.apply(null, points.map(function (point) { return point.x; })),
		right:Math.max.apply(null, points.map(function (point) { return point.x; })),
		top:Math.min.apply(null, points.map(function (point) { return point.y; })),
		bottom:Math.max.apply(null, points.map(function (point) { return point.y; }))
	};
}
function estimateManaCostWidth(textObject) {
	var textSize = Math.max(1,
		(scaleHeight(Number(textObject.size) || 0.038)) + (parseInt(textObject.fontSize || '0') || 0));
	var manaSpacing = textSize * 0.04 + (scaleWidth(Number(textObject.manaSpacing)) || 0);
	var rawText = String(textObject.text || '');
	var tokenPattern = /{([^{}]+)}/g;
	var match;
	var width = 0;
	var matchedToken = false;
	while ((match = tokenPattern.exec(rawText))) {
		var token = match[1];
		var manaSymbol = null;
		try {
			manaSymbol = getManaSymbol(token) || getManaSymbol(token.split('').reverse().join(''));
		} catch (error) {
			manaSymbol = null;
		}
		if (manaSymbol) {
			width += (Number(manaSymbol.width) || 1) * textSize * 0.78 + manaSpacing * 2;
			matchedToken = true;
		}
	}
	if (!matchedToken) {
		var measurementCanvas = estimateManaCostWidth.canvas ||
			(estimateManaCostWidth.canvas = document.createElement('canvas'));
		var measurementContext = measurementCanvas.getContext('2d');
		measurementContext.font = (textObject.fontStyle || '') + textSize + 'px ' + (textObject.font || 'mplantin');
		width = measurementContext.measureText(rawText.replace(/{[^{}]*}/g, '')).width;
	}
	return Math.max(1, width);
}
function estimateOneLineTextWidth(textObject) {
	var textSize = Math.max(1,
		(scaleHeight(Number(textObject.size) || 0.038)) + (parseInt(textObject.fontSize || '0') || 0));
	var measurementCanvas = estimateOneLineTextWidth.canvas ||
		(estimateOneLineTextWidth.canvas = document.createElement('canvas'));
	var measurementContext = measurementCanvas.getContext('2d');
	measurementContext.font = (textObject.fontStyle || '') + textSize + 'px ' + (textObject.font || 'mplantin');
	var plainText = String(textObject.text || '')
		.replace(/{[^{}]*}/g, '')
		.replace(/~/g, typeof getInlineCardName === 'function' ? getInlineCardName() : '');
	return Math.max(1, measurementContext.measureText(plainText).width);
}
function cardTextContentRect(textObject) {
	var fieldRect = cardTextPixelRect(textObject);
	var role = cardTextSemanticRole(textObject);
	var contentWidth = role === 'mana'
		? estimateManaCostWidth(textObject)
		: (textObject.oneLine ? estimateOneLineTextWidth(textObject) : fieldRect.width);
	var x = fieldRect.x;
	if (textObject.align === 'right') {
		x += fieldRect.width - contentWidth;
	} else if (textObject.align === 'center') {
		x += (fieldRect.width - contentWidth) / 2;
	}
	return {
		x:x,
		y:fieldRect.y,
		width:contentWidth,
		height:fieldRect.height,
		rotation:fieldRect.rotation,
		pivotX:fieldRect.x,
		pivotY:fieldRect.y
	};
}
function cardSetSymbolCollisionRect() {
	var source = String((card && card.setSymbolSource) || (setSymbol && setSymbol.src) || '');
	if (!source || source.includes('/img/blank.png')) return null;
	var symbolZoom = Number(card.setSymbolZoom);
	if (!Number.isFinite(symbolZoom) || symbolZoom <= 0) return null;
	var imageWidth = (Number(setSymbol && (setSymbol.naturalWidth || setSymbol.width)) || 0) * symbolZoom;
	var imageHeight = (Number(setSymbol && (setSymbol.naturalHeight || setSymbol.height)) || 0) * symbolZoom;
	if (imageWidth > 1 && imageHeight > 1) {
		return {
			x:scaleX(Number(card.setSymbolX) || 0),
			y:scaleY(Number(card.setSymbolY) || 0),
			width:imageWidth,
			height:imageHeight,
			rotation:Number(card.setSymbolRotate) || 0
		};
	}
	var bounds = card.setSymbolBounds;
	if (!bounds) return null;
	var fallbackWidth = scaleWidth(Number(bounds.width) || 0.12);
	var fallbackHeight = scaleHeight(Number(bounds.height) || 0.04);
	var fallbackX = scaleX(Number(bounds.x) || 0);
	var fallbackY = scaleY(Number(bounds.y) || 0);
	if (bounds.horizontal === 'right') fallbackX -= fallbackWidth;
	else if (bounds.horizontal === 'center') fallbackX -= fallbackWidth / 2;
	if (bounds.vertical === 'bottom') fallbackY -= fallbackHeight;
	else if (bounds.vertical === 'center') fallbackY -= fallbackHeight / 2;
	return {x:fallbackX, y:fallbackY, width:fallbackWidth, height:fallbackHeight, rotation:Number(card.setSymbolRotate) || 0};
}
function cardPowerToughnessCollisionRects() {
	var activePTFields = Object.entries(card.text || {}).filter(function (entry) {
		return cardTextSemanticRole(entry[1], entry[0]) === 'pt' && cardTextHasVisibleContent(entry[1]);
	});
	if (!activePTFields.length) return [];
	var frameRects = (card.frames || []).filter(function (frame) {
		if (!frame || frame.hidden || Number(frame.opacity) === 0) return false;
		var label = normalizeCardTextSemantic((frame.componentLabel || '') + ' ' + (frame.name || ''));
		return label.includes('powertoughness') || /^pt(inner|box|frame|background)/.test(label);
	}).map(function (frame) {
		var bounds = frame.bounds || {};
		return {
			x:scaleX(Number(bounds.x) || 0),
			y:scaleY(Number(bounds.y) || 0),
			width:scaleWidth(Number(bounds.width) || 1),
			height:scaleHeight(Number(bounds.height) || 1),
			rotation:Number(frame.rotation) || 0
		};
	});
	if (frameRects.length) return frameRects;
	return activePTFields.map(function (entry) {
		return cardTextPixelRect(entry[1]);
	});
}
function cardTextCollisionObstacles(textObject, role) {
	var obstacles = [];
	if (role === 'title') {
		Object.entries(card.text || {}).forEach(function (entry) {
			if (cardTextSemanticRole(entry[1], entry[0]) === 'mana' && cardTextHasVisibleContent(entry[1])) {
				obstacles.push({label:entry[1].name || 'Mana Cost', rect:cardTextContentRect(entry[1])});
			}
		});
	} else if (role === 'type') {
		var setSymbolRect = cardSetSymbolCollisionRect();
		if (setSymbolRect) obstacles.push({label:'Set/Rarity Symbol', rect:setSymbolRect});
		Object.entries(card.text || {}).forEach(function (entry) {
			if (cardTextSemanticRole(entry[1], entry[0]) === 'rarity' && cardTextHasVisibleContent(entry[1])) {
				obstacles.push({label:entry[1].name || 'Rarity', rect:cardTextContentRect(entry[1])});
			}
		});
	} else if (role === 'rules') {
		cardPowerToughnessCollisionRects().forEach(function (rect) {
			obstacles.push({label:'Power/Toughness Box', rect:rect});
		});
	}
	return obstacles;
}
function getCardTextCollisionFit(textObject, originalWidth, originalHeight) {
	var key = cardTextObjectKey(textObject);
	var role = cardTextSemanticRole(textObject, key);
	var result = {
		key:key,
		role:role,
		label:textObject.name || key || 'Text field',
		width:originalWidth,
		height:originalHeight,
		obstacles:[],
		restricted:false
	};
	if (!cardTextHasVisibleContent(textObject) || !['title', 'type', 'rules'].includes(role)) return result;
	var targetRect = cardTextPixelRect(textObject, originalWidth, originalHeight);
	var horizontalPadding = Math.max(4, scaleWidth(0.008));
	var verticalPadding = Math.max(4, scaleHeight(0.006));
	cardTextCollisionObstacles(textObject, role).forEach(function (obstacle) {
		var local = cardTextRectInLocalCoordinates(obstacle.rect, targetRect);
		if ((role === 'title' || role === 'type') &&
			local.bottom > 0 && local.top < originalHeight &&
			local.left > 0 && local.left < result.width) {
			result.width = Math.max(1, local.left - horizontalPadding);
			result.obstacles.push(obstacle.label);
		} else if (role === 'rules' &&
			local.right > 0 && local.left < originalWidth &&
			local.top > 0 && local.top < result.height) {
			result.height = Math.max(1, local.top - verticalPadding);
			result.obstacles.push(obstacle.label);
		}
	});
	result.obstacles = Array.from(new Set(result.obstacles));
	result.restricted = result.width < originalWidth || result.height < originalHeight;
	return result;
}
function resetCardTextFitState() {
	cardTextFitResults = [];
	cardTextCollisionWarnings = [];
	window.CardTextFitResults = [];
	window.CardTextCollisionWarnings = [];
}
function recordCardTextFit(textObject, collisionFit, originalSize, finalSize, failed) {
	if (!collisionFit || (!collisionFit.restricted && !failed)) return;
	var reduction = Math.max(0, Math.round(originalSize - finalSize));
	var obstacleLabel = collisionFit.obstacles.join(' and ') || 'a neighboring field';
	var record = {
		key:collisionFit.key,
		label:collisionFit.label,
		obstacles:collisionFit.obstacles.slice(),
		reduction:reduction,
		failed:!!failed
	};
	var existingIndex = cardTextFitResults.findIndex(function (item) { return item.key === record.key; });
	if (existingIndex === -1) cardTextFitResults.push(record);
	else cardTextFitResults[existingIndex] = record;
	if (failed) {
		var warning = collisionFit.restricted
			? collisionFit.label + ' still overlaps ' + obstacleLabel +
				' at the minimum {fontsize-25} size.'
			: collisionFit.label + ' still exceeds its own text box at the minimum {fontsize-25} size.';
		if (!cardTextCollisionWarnings.includes(warning)) cardTextCollisionWarnings.push(warning);
	}
}
function publishCardTextFitState() {
	window.CardTextFitResults = cardTextFitResults.slice();
	window.CardTextCollisionWarnings = cardTextCollisionWarnings.slice();
	var status = document.querySelector('#text-collision-status');
	if (!status) return;
	if (cardTextCollisionWarnings.length) {
		status.textContent = 'Text collision warning: ' + cardTextCollisionWarnings.join(' ');
		status.classList.add('error');
		return;
	}
	status.classList.remove('error');
	var adjusted = cardTextFitResults.filter(function (item) { return item.reduction > 0; });
	if (adjusted.length) {
		status.textContent = 'Automatically fitted: ' + adjusted.map(function (item) {
			return item.label + ' −' + item.reduction + ' px';
		}).join('; ') + '.';
	} else {
		status.textContent = 'No active text collisions.';
	}
}
function drawTextBuffer() {
	clearTimeout(writingText);
	writingText = setTimeout(drawText, 500);
}
function autoFrameBuffer() {
	clearTimeout(autoFrameTimer);
	autoFrameTimer = setTimeout(autoFrame, 500);
}
async function drawText() {
	textContext.clearRect(0, 0, textCanvas.width, textCanvas.height);
	prePTContext.clearRect(0, 0, prePTCanvas.width, prePTCanvas.height);
	drawTextBetweenFrames = false;
	resetCardTextFitState();
	for (var textObject of Object.entries(card.text)) {
		await writeText(textObject[1], textContext);
		continue;
	}
	publishCardTextFitState();
	if (drawTextBetweenFrames || redrawFrames) {
		drawFrames();
		if (!drawTextBetweenFrames) {
			redrawFrames = false;
		}
	} else {
		drawCard();
	}
}
var justifyWidth = 90;
let manaSymbolsToRender = [];
//Split CJK characters individually so Japanese/Chinese text can wrap per-character
function splitCJKCharacters(splitText) {
	var result = [];
	for (var i = 0; i < splitText.length; i++) {
		var segment = splitText[i];
		if (segment.includes('{') || segment === ' ') {
			result.push(segment);
		} else if (/[\u3000-\u9FFF\uF900-\uFAFF]/.test(segment)) {
			for (var j = 0; j < segment.length; j++) {
				result.push(segment[j]);
			}
		} else {
			result.push(segment);
		}
	}
	return result;
}
//Pre-scan ruby codes to find the smallest annotation size needed so all ruby text is consistent
function prescanRubySize(splitText, textObject, ctx, textSize, fontStyle, font, fontExt) {
	var annSize = textObject.vertical ? textSize * 0.35 : textSize * 0.5;
	for (var i = 0; i < splitText.length; i++) {
		var word = splitText[i];
		if (!word || !word.toLowerCase().startsWith('{ruby:')) { continue; }
		var parts = word.replace(/[{}]/g, '').split(':');
		var base = parts[1] || '';
		var annotation = parts[2] || '';
		if (base.length == 0) { continue; }
		if (textObject.vertical) {
			var charsPerBase = Math.ceil(annotation.length / base.length);
			for (var j = 0; j < base.length; j++) {
				var charCount = Math.min(charsPerBase, annotation.length - j * charsPerBase);
				if (charCount > 0) {
					annSize = Math.min(annSize, textSize / charCount);
				}
			}
		} else {
			var baseWidth = ctx.measureText(base).width;
			ctx.font = fontStyle + annSize + 'px ' + font + fontExt;
			var annWidth = ctx.measureText(annotation).width;
			if (annWidth > baseWidth && baseWidth > 0) {
				annSize = Math.min(annSize, annSize * (baseWidth / annWidth));
			}
			ctx.font = fontStyle + textSize + 'px ' + font + fontExt;
		}
	}
	return annSize;
}
//Draw ruby text (base with annotation above or to the right)
function drawRubyText(word, textObject, ctx, paragraphCtx, lineCanvas, annSize, state, opts) {
	var parts = word.replace(/[{}]/g, '').split(':');
	var base = parts[1] || '';
	var annotation = parts[2] || '';
	var savedFont = ctx.font;
	if (textObject.vertical) {
		drawRubyVertical(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont);
	} else {
		drawRubyHorizontal(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont);
	}
}
//Vertical ruby: base chars stacked top-to-bottom, annotation to the right
function drawRubyVertical(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont) {
	var charsPerBase = Math.ceil(annotation.length / base.length);
	for (var i = 0; i < base.length; i++) {
		var baseChar = base[i];
		var annStart = i * charsPerBase;
		var annChars = annotation.substring(annStart, Math.min(annStart + charsPerBase, annotation.length));
		//Flush line before drawing next base character
		if (i > 0) {
			var hAdj = 0;
			if (opts.textAlign == 'center') { hAdj = (opts.textWidth - state.currentX) / 2; }
			else if (opts.textAlign == 'right') { hAdj = opts.textWidth - state.currentX; }
			if (state.currentX > state.widestLineWidth) { state.widestLineWidth = state.currentX; }
			paragraphCtx.drawImage(lineCanvas, hAdj, state.currentY);
			state.lineY = 0;
			ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
			state.currentX = opts.startingCurrentX;
			state.currentY += opts.textSize + state.newLineSpacing;
			state.newLineSpacing = (textObject.lineSpacing || 0) * opts.textSize;
		}
		//Draw base character
		var baseCharWidth = ctx.measureText(baseChar).width;
		var baseY = opts.canvasMargin + opts.textSize * opts.textFontHeightRatio + state.lineY;
		if (opts.textOutlineWidth >= 1) { ctx.strokeText(baseChar, state.currentX + opts.canvasMargin, baseY); }
		ctx.fillText(baseChar, state.currentX + opts.canvasMargin, baseY);
		//Draw annotation chars to the right, centered vertically
		if (annChars.length > 0) {
			ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
			var annX = state.currentX + opts.canvasMargin + baseCharWidth;
			var totalAnnH = annChars.length * annSize;
			var baseTopY = opts.canvasMargin + state.lineY;
			var annStartY = baseTopY + (opts.textSize - totalAnnH) / 2 + annSize * opts.textFontHeightRatio - opts.textSize * 0.08;
			for (var j = 0; j < annChars.length; j++) {
				var charY = annStartY + j * annSize;
				if (opts.textOutlineWidth >= 1) { ctx.strokeText(annChars[j], annX, charY); }
				ctx.fillText(annChars[j], annX, charY);
			}
			ctx.font = savedFont;
		}
		state.currentX += baseCharWidth;
	}
}
//Horizontal ruby: annotation drawn above base text, evenly distributed
function drawRubyHorizontal(base, annotation, ctx, paragraphCtx, lineCanvas, annSize, state, opts, savedFont) {
	var baseWidth = ctx.measureText(base).width;
	ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
	var annWidth = ctx.measureText(annotation).width;
	ctx.font = savedFont;
	var totalWidth = Math.max(baseWidth, annWidth);
	//Wrap to new line if needed
	if (totalWidth + state.currentX >= opts.textWidth && opts.textArcRadius == 0 && !opts.textOneLine) {
		var hAdj = 0;
		if (opts.textAlign == 'center') { hAdj = (opts.textWidth - state.currentX) / 2; }
		else if (opts.textAlign == 'right') { hAdj = opts.textWidth - state.currentX; }
		if (state.currentX > state.widestLineWidth) { state.widestLineWidth = state.currentX; }
		paragraphCtx.drawImage(lineCanvas, hAdj, state.currentY);
		state.lineY = 0;
		ctx.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
		state.currentX = opts.startingCurrentX;
		state.currentY += opts.textSize + state.newLineSpacing;
		state.newLineSpacing = (textObject.lineSpacing || 0) * opts.textSize;
	}
	var baseOffsetX = (totalWidth - baseWidth) / 2;
	var baseY = opts.canvasMargin + opts.textSize * opts.textFontHeightRatio + state.lineY;
	//Position annotation using font metrics for zero-gap placement
	var baseMetrics = ctx.measureText(base);
	var baseFontAscent = baseMetrics.fontBoundingBoxAscent || opts.textSize * opts.textFontHeightRatio;
	ctx.font = opts.textFontStyle + annSize + 'px ' + opts.textFont + opts.textFontExtension;
	var annMetrics = ctx.measureText(annotation);
	var annFontDescent = annMetrics.fontBoundingBoxDescent || annSize * 0.1;
	var annY = baseY - baseFontAscent - annFontDescent;
	//Distribute annotation chars evenly when base is wider
	if (annotation.length > 1 && baseWidth > annWidth) {
		var charWidths = [];
		var totalCharWidth = 0;
		for (var i = 0; i < annotation.length; i++) {
			var w = ctx.measureText(annotation[i]).width;
			charWidths.push(w);
			totalCharWidth += w;
		}
		var spacing = (baseWidth - totalCharWidth) / (annotation.length + 1);
		var drawX = state.currentX + opts.canvasMargin + baseOffsetX + spacing;
		for (var i = 0; i < annotation.length; i++) {
			if (opts.textOutlineWidth >= 1) { ctx.strokeText(annotation[i], drawX, annY); }
			ctx.fillText(annotation[i], drawX, annY);
			drawX += charWidths[i] + spacing;
		}
	} else {
		var annOffsetX = (totalWidth - annWidth) / 2;
		if (opts.textOutlineWidth >= 1) { ctx.strokeText(annotation, state.currentX + opts.canvasMargin + annOffsetX, annY); }
		ctx.fillText(annotation, state.currentX + opts.canvasMargin + annOffsetX, annY);
	}
	ctx.font = savedFont;
	//Draw base text
	if (opts.textOutlineWidth >= 1) { ctx.strokeText(base, state.currentX + opts.canvasMargin + baseOffsetX, baseY); }
	ctx.fillText(base, state.currentX + opts.canvasMargin + baseOffsetX, baseY);
	state.currentX += totalWidth;
}
function writeText(textObject, targetContext) {
	manaSymbolsToRender = [];
	//Most bits of info about text loaded, with defaults when needed
	var textX = scaleX(textObject.x) || scaleX(0);
	var textY = scaleY(textObject.y) || scaleY(0);
	var textWidth = scaleWidth(textObject.width) || scaleWidth(1);
	var textHeight = scaleHeight(textObject.height) || scaleHeight(1);
	var startingTextSize = scaleHeight(textObject.size) || scaleHeight(0.038);
	var originalStartingTextSize = startingTextSize;
	var fontSizeModifier = parseInt(textObject.fontSize || '0') || 0;
	var collisionMinimumTextSize = Math.max(1, Math.min(startingTextSize,
		originalStartingTextSize - CARD_TEXT_COLLISION_MINIMUM_REDUCTION - fontSizeModifier));
	var collisionFit = getCardTextCollisionFit(textObject, textWidth, textHeight);
	var collisionFitFailed = false;
	textWidth = collisionFit.width;
	textHeight = collisionFit.height;
	var textFontHeightRatio = 0.7;
	var textBounded = textObject.bounded || true;
	var textOneLine = textObject.oneLine || false;
	var textManaCost = textObject.manaCost || false;
	var textAllCaps = textObject.allCaps || false;
	var textManaSpacing = scaleWidth(textObject.manaSpacing) || 0;
	//Buffers the canvases accordingly
	var canvasMargin = 300;
	paragraphCanvas.width = textWidth + 2 * canvasMargin;
	paragraphCanvas.height = textHeight + 2 * canvasMargin;
	lineCanvas.width = textWidth + 2 * canvasMargin;
	lineCanvas.height = startingTextSize + 2 * canvasMargin;
	//Preps the text string
	var splitString = '6GJt7eL8';
	var rawText = textObject.text
	if (document.querySelector('#hide-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
		var rulesText = rawText;
		var flavorText = '';
		var flavorIndex = rawText.indexOf('{flavor}') || rawText.indexOf('///');
		if (flavorIndex >= 0) {
			flavorText = rawText.substring(flavorIndex);
			rulesText = rawText.substring(0, flavorIndex);
		}

		rulesText = rulesText.replace(/ ?{i}\([^\)]+\){\/i}/g, '');

		rawText = rulesText + flavorText;
	} else if (document.querySelector('#italicize-reminder-text').checked && textObject.name && textObject.name != 'Title' && textObject.name != 'Type' && textObject.name != 'Mana Cost' && textObject.name != 'Power/Toughness') {
		var rulesText = rawText;
		var flavorText = '';
		var flavorIndex = rawText.indexOf('{flavor}') || rawText.indexOf('///');
		if (flavorIndex >= 0) {
			flavorText = rawText.substring(flavorIndex);
			rulesText = rawText.substring(0, flavorIndex);
		}

		rulesText = rulesText.replace(/\(([^)]+)\)/g, '{i}($1){/i}');

		rawText = rulesText + flavorText;
	}
	if (textAllCaps) {
		rawText = rawText.toUpperCase();
	}
	if ((textObject.name == 'wizards' || textObject.name == 'copyright') && params.get('copyright') != null && (params.get('copyright') != '' || card.margins)) {
		rawText = params.get('copyright'); //so people using CC for custom card games without WotC's IP can customize their copyright info
		if (rawText == 'none') { rawText = ''; }
	}
	if (rawText.toLowerCase().includes('{cardname}') || rawText.toLowerCase().includes('~')) {
		rawText = rawText.replace(/{cardname}|~/ig, getInlineCardName());
	}
	if (document.querySelector('#info-artist').value == '') {
		rawText = rawText.replace('\uFFEE{savex2}{elemidinfo-artist}', '');
	}
	if (rawText.includes('///')) {
		rawText = rawText.replace(/\/\/\//g, '{flavor}');
	}
	if (rawText.includes('//')) {
		rawText = rawText.replace(/\/\//g, '{lns}');
	}

	if (card.version == 'pokemon') {
		rawText = rawText.replace(/{flavor}/g, '{oldflavor}{fontsize-20}{fontgillsansbolditalic}');
	} else if (card.version == 'dossier') {
		rawText = rawText.replace(/{flavor}(.*)/g, function(v) { return '{/indent}{lns}{bar}{lns}{fixtextalign}' + v.replace(/{flavor}/g, '').toUpperCase(); });
	} else if (!card.showsFlavorBar) {
		rawText = rawText.replace(/{flavor}/g, '{oldflavor}');
	}

	if (textObject.font == 'saloongirl') {
		rawText = rawText.replace(/\*/g, '{fontbelerenbsc}*{fontsaloongirl}');
	}
	rawText = rawText.replace(/ - /g, ' — ');
	var splitText = rawText.replace(/\n/g, '{line}').replace(/{-}/g, '\u2014').replace(/{divider}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}');
	if (rawText.trim().startsWith('{flavor}') || rawText.trim().startsWith('{oldflavor}')) {
		splitText = splitText.replace(/{flavor}/g, '{i}').replace(/{oldflavor}/g, '{i}');
	} else {
		splitText = splitText.replace(/{flavor}/g, '{/indent}{lns}{bar}{lns}{fixtextalign}{i}').replace(/{oldflavor}/g, '{/indent}{lns}{lns}{up30}{i}');
	}
	splitText = splitText.replace(/{/g, splitString + '{').replace(/}/g, '}' + splitString).replace(/ /g, splitString + ' ' + splitString).split(splitString);

	splitText = splitText.filter(item => item);
	splitText = splitCJKCharacters(splitText);
	if (textObject.manaCost) {
		splitText = splitText.filter(item => item != ' ');
	}
	if (textObject.vertical) {
		newSplitText = [];
		splitText.forEach((item, index) => {
			if (item.includes('{') && item.includes('}')) {
				newSplitText.push(item, '{lns}');
			} else if (item == ' ') {
				newSplitText.push(`{down${scaleHeight(0.01)}}`);
			} else {
				item.split('').forEach(char => {
					if (char == '’') {
						newSplitText.push(`{right${startingTextSize * 0.6}}`, '’', '{lns}', `{up${startingTextSize * 0.75}}`);
					} else if (textManaCost && index == splitText.length-1) {
						newSplitText.push(char);
					} else {
						newSplitText.push(char, '{lns}');
					}
				});
				// newSplitText = newSplitText.concat(item.split(''));
			}
		});
		splitText = newSplitText;
	}
	// if (textManaCost && textObject.arcStart > 0) {
	// 	splitText.reverse();
	// }
	splitText.push('');
	//Manages the redraw loop
	var drawingText = true;
	//Repeatedly tries to draw the text at smaller and smaller sizes until it fits
	outerloop: while (drawingText) {
		//Rest of the text info loaded that may have been changed by a previous attempt at drawing the text
		var textColor = textObject.color || 'black';
		if (textObject.conditionalColor != undefined) {
			var codeParams = textObject.conditionalColor.split(":");
			const tagParts = codeParams[0].split(",");
		    const colorToApply = codeParams[1];

		    for (let part of tagParts) {

		        // Split into frame name + mask rules
		        const [rawFrameName, ...maskRuleParts] = part.split("*");
		        const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

		        const positiveMasks = [];
		        const negativeMasks = [];

		        for (let rule of maskRuleParts) {
		            if (!rule) continue;
		            if (rule.startsWith("!")) {
		                negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
		            } else {
		                positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
		            }
		        }

		        const matchingFrames = card.frames.filter(f =>
		            f.name.toLowerCase().includes(frameName)
		        );

		        for (const frame of matchingFrames) {
		            const masks = frame.masks || [];

		            // --------------------------------------
		            // SPECIAL RULE:
		            // If NO masks → always match immediately
		            // --------------------------------------
		            if (masks.length === 0) {
		                textColor = colorToApply;
		                lineContext.fillStyle = textColor;
		                continue;
		            }

		            const maskNames = masks.map(m => m.name.toLowerCase());

		            // --- Positive mask rules -------------------------
		            let passesPositive = true;

		            if (positiveMasks.length > 0) {
		                passesPositive = positiveMasks.every(pos =>
		                    maskNames.some(mask => mask.includes(pos))
		                );
		            }

		            if (!passesPositive) continue;

		            // --- Negative mask rules -------------------------
		            let passesNegative = true;

		            if (negativeMasks.length > 0) {
		                passesNegative = negativeMasks.every(neg =>
		                    !maskNames.some(mask => mask.includes(neg))
		                );
		            }

		            if (!passesNegative) continue;

		            // All conditions passed
		            textColor = colorToApply;
		        }
		    }
		}
		var textFont = textObject.font || 'mplantin';
		FontLoadTracker.track(textFont);
		var textAlign = textObject.align || 'left';
		var textJustify = textObject.justify || 'left';
		var textShadowColor = textObject.shadow || 'black';
		var textShadowOffsetX = scaleWidth(textObject.shadowX) || 0;
		var textShadowOffsetY = scaleHeight(textObject.shadowY) || 0;
		var textShadowBlur = scaleHeight(textObject.shadowBlur) || 0;
		var textArcRadius = scaleHeight(textObject.arcRadius) || 0;
		var manaSymbolColor = textObject.manaSymbolColor || null;
		var textRotation = textObject.rotation || 0;
		if (textArcRadius > 0) {
			//Buffers the canvases accordingly
			var canvasMargin = 300 + textArcRadius;
			paragraphCanvas.width = textWidth + 2 * canvasMargin;
			paragraphCanvas.height = textHeight + 2 * canvasMargin;
			lineCanvas.width = textWidth + 2 * canvasMargin;
			lineCanvas.height = startingTextSize + 2 * canvasMargin;
		}
		var textArcStart = textObject.arcStart || 0;
		//Variables for tracking text position/size/font
		var currentX = 0;
		var startingCurrentX = 0;
		var currentY = 0;
		var lineY = 0;
		var newLine = false;
		var textFontExtension = '';
		var textFontStyle = textObject.fontStyle || '';
		var manaPlacementCounter = 0;
		var realTextAlign = textAlign;
		savedRollYPosition = null;
		var savedRollColor = 'black';
		var drawToPrePTCanvas = false;
		var widestLineWidth = 0;
		//variables that track various... things?
		var textSize = startingTextSize;
		var newLineSpacing = (textObject.lineSpacing || 0) * textSize;
		var ptShift = [0, 0];
		var permaShift = [0, 0];
		var fillJustify = false;
		//Finish prepping canvases
		paragraphContext.clearRect(0, 0, paragraphCanvas.width, paragraphCanvas.height);
		lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
		lineContext.letterSpacing = (scaleWidth(textObject.kerning) || 0) + 'px';
		// if (textFont == 'goudymedieval') {
		// 	lineCanvas.style.letterSpacing = '3.5px';
		// }
		textSize += parseInt(textObject.fontSize || '0');
		lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
		lineContext.fillStyle = textColor;
		lineContext.shadowColor = textShadowColor;
		lineContext.shadowOffsetX = textShadowOffsetX;
		lineContext.shadowOffsetY = textShadowOffsetY;
		lineContext.shadowBlur = textShadowBlur;
		lineContext.strokeStyle = textObject.outlineColor || 'black';
		var textOutlineWidth = scaleHeight(textObject.outlineWidth) || 0;
		var textLineCap = textObject.lineCap || 'round';
		var textLineJoin = textObject.lineJoin || 'round';
		var hideBottomInfoBorder = card.hideBottomInfoBorder || false;
		if (hideBottomInfoBorder && ['midLeft', 'topLeft', 'note', 'bottomLeft', 'wizards', 'bottomRight', 'rarity'].includes(textObject.name)) {
			textOutlineWidth = 0;
		}
		lineContext.lineWidth = textOutlineWidth;
		lineContext.lineCap = textLineCap;
		lineContext.lineJoin = textLineJoin;
		var rubyGlobalAnnSize = prescanRubySize(splitText, textObject, lineContext, textSize, textFontStyle, textFont, textFontExtension);
		//Begin looping through words/codes
		innerloop: for (word of splitText) {
			var wordToWrite = word;
			if (wordToWrite.includes('{') && wordToWrite.includes('}') || textManaCost || savedFont) {
				var possibleCode = wordToWrite.toLowerCase().replace('{', '').replace('}', '');
				wordToWrite = null;
				if (possibleCode == 'line') {
					newLine = true;
					startingCurrentX = 0;
					newLineSpacing = textSize * 0.35;
				} else if (possibleCode == 'lns' || possibleCode == 'linenospace') {
					newLine = true;
				} else if (possibleCode == 'bullet' || possibleCode == '•') {
					wordToWrite = '•';
				} else if (possibleCode == 'bar') {
					var barWidth = textWidth * 0.96;
					var barHeight = scaleHeight(0.03);
					var barImageName = 'bar';
					var barDistance = 0;
					realTextAlign = textAlign;
					textAlign = 'left';
					if (card.version == 'cartoony') {
						barImageName = 'cflavor';
						barWidth = scaleWidth(0.8547);
						barHeight = scaleHeight(0.0458);
						barDistance = -0.23;
						newLineSpacing = textSize * -0.23;
						textSize -= scaleHeight(0.0086);
					}
					lineContext.drawImage(getManaSymbol(barImageName).image, canvasMargin + (textWidth - barWidth) / 2, canvasMargin + barDistance * textSize, barWidth, barHeight);
				} else if (possibleCode == 'i') {
					if (textFont == 'gilllsans' || textFont == 'neosans') {
						textFontExtension = 'italic';
					} else if (textFont == 'mplantin') {
						textFontExtension = 'i';
						textFontStyle = textFontStyle.replace('italic ', '');
					} else {
						textFontExtension = '';
						if (!textFontStyle.includes('italic')) {textFontStyle += 'italic ';}
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == '/i') {
					textFontExtension = '';
					textFontStyle = textFontStyle.replace('italic ', '');
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == 'bold') {
					if (textFont == 'gillsans') {
						textFontExtension = 'bold';
					} else {
						if (!textFontStyle.includes('bold')) {textFontStyle += 'bold ';}
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == '/bold') {
					if (textFont == 'gillsans') {
						textFontExtension = '';
					} else {
						textFontStyle = textFontStyle.replace('bold ', '');
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode == 'left') {
					textAlign = 'left';
				} else if (possibleCode == 'center') {
					textAlign = 'center';
				} else if (possibleCode == 'right') {
					textAlign = 'right';
				} else if (possibleCode == 'justify-left') {
					textJustify = 'left';
				} else if (possibleCode == 'justify-center') {
					textJustify = 'center';
				} else if (possibleCode == 'justify-right') {
					textJustify = 'right';
				} else if (possibleCode.startsWith('ruby:')) {
					var rubyState = {currentX:currentX, currentY:currentY, lineY:lineY, widestLineWidth:widestLineWidth, newLineSpacing:newLineSpacing};
					drawRubyText(word, textObject, lineContext, paragraphContext, lineCanvas, rubyGlobalAnnSize, rubyState, {
						textSize:textSize, textFontStyle:textFontStyle, textFont:textFont, textFontExtension:textFontExtension,
						textFontHeightRatio:textFontHeightRatio, textAlign:textAlign, textWidth:textWidth, textArcRadius:textArcRadius,
						textOneLine:textOneLine, textOutlineWidth:textOutlineWidth, canvasMargin:canvasMargin, startingCurrentX:startingCurrentX
					});
					currentX = rubyState.currentX; currentY = rubyState.currentY; lineY = rubyState.lineY;
					widestLineWidth = rubyState.widestLineWidth; newLineSpacing = rubyState.newLineSpacing;
					wordToWrite = null;
				} else if (possibleCode.includes('conditionalcolor')) {
				    const codeParams = possibleCode.split(":");
				    const tagParts = codeParams[1].split(",");
				    const colorToApply = codeParams[2];

				    for (let part of tagParts) {

				        // Split into frame name + mask rules
				        const [rawFrameName, ...maskRuleParts] = part.split("*");
				        const frameName = rawFrameName.replace(/_/g, " ").toLowerCase();

				        const positiveMasks = [];
				        const negativeMasks = [];

				        for (let rule of maskRuleParts) {
				            if (!rule) continue;
				            if (rule.startsWith("!")) {
				                negativeMasks.push(rule.substring(1).replace(/_/g, " ").toLowerCase());
				            } else {
				                positiveMasks.push(rule.replace(/_/g, " ").toLowerCase());
				            }
				        }

				        const matchingFrames = card.frames.filter(f =>
				            f.name.toLowerCase().includes(frameName)
				        );

				        for (const frame of matchingFrames) {
				            const masks = frame.masks || [];

				            // --------------------------------------
				            // SPECIAL RULE:
				            // If NO masks → always match immediately
				            // --------------------------------------
				            if (masks.length === 0) {
				                textColor = colorToApply;
				                lineContext.fillStyle = textColor;
				                continue;
				            }

				            const maskNames = masks.map(m => m.name.toLowerCase());

				            // --- Positive mask rules -------------------------
				            let passesPositive = true;

				            if (positiveMasks.length > 0) {
				                passesPositive = positiveMasks.every(pos =>
				                    maskNames.some(mask => mask.includes(pos))
				                );
				            }

				            if (!passesPositive) continue;

				            // --- Negative mask rules -------------------------
				            let passesNegative = true;

				            if (negativeMasks.length > 0) {
				                passesNegative = negativeMasks.every(neg =>
				                    !maskNames.some(mask => mask.includes(neg))
				                );
				            }

				            if (!passesNegative) continue;

				            // All conditions passed
				            textColor = colorToApply;
				            lineContext.fillStyle = textColor;
				        }
				    }
				} else if (possibleCode.includes('fontcolor')) {
					textColor = possibleCode.replace('fontcolor', '');
					lineContext.fillStyle = textColor;
				} else if (possibleCode.includes('fontsize')) {
					if (possibleCode.slice(-2) === "pt") {
						textSize = (parseInt(possibleCode.replace('fontsize', '').replace('pt', '')) * 600 / 72) || 0;
					} else {
						textSize += parseInt(possibleCode.replace('fontsize', '')) || 0;
					}
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
				} else if (possibleCode.includes('font') || savedFont) {
					textFont = word.replace('{font', '').replace('}', '');
					if (savedFont) {
						textFont = savedFont;
						wordToWrite = word;
					}
					FontLoadTracker.track(textFont);
					textFontExtension = '';
					textFontStyle = '';
					lineContext.font = textFontStyle + textSize + 'px ' + textFont + textFontExtension;
					savedFont = null;
				} else if (possibleCode.includes('outlinecolor')) {
					lineContext.strokeStyle = possibleCode.replace('outlinecolor', '');
				} else if (possibleCode.includes('outline')) {
					textOutlineWidth = parseInt(possibleCode.replace('outline', ''));
					lineContext.lineWidth = textOutlineWidth;
				} else if (possibleCode.includes('linecap')) {
					lineContext.lineCap = possibleCode.replace('linecap', '').trim();
				} else if (possibleCode.includes('linejoin')) {
					lineContext.lineJoin = possibleCode.replace('linejoin', '').trim();
				} else if (possibleCode.includes('upinline')) {
					lineY -= parseInt(possibleCode.replace('upinline', '')) || 0;
				} else if (possibleCode.substring(0, 2) == 'up' && possibleCode != 'up') {
					currentY -= parseInt(possibleCode.replace('up', '')) || 0;
				} else if (possibleCode.includes('down')) {
					currentY += parseInt(possibleCode.replace('down', '')) || 0;
				} else if (possibleCode.includes('left')) {
					currentX -= parseInt(possibleCode.replace('left', '')) || 0;
				} else if (possibleCode.includes('right')) {
					currentX += parseInt(possibleCode.replace('right', '')) || 0;
				} else if (possibleCode.includes('shadow')) {
					if (possibleCode.includes('color')) {
						textShadowColor = possibleCode.replace('shadowcolor', '');
						lineContext.shadowColor = textShadowColor;
					} else if (possibleCode.includes('blur')) {
						textShadowBlur = parseInt(possibleCode.replace('shadowblur', '')) || 0;
						lineContext.shadowBlur = textShadowBlur
					} else if (possibleCode.includes('shadowx')) {
						textShadowOffsetX = parseInt(possibleCode.replace('shadowx', '')) || 0;
						lineContext.shadowOffsetX = textShadowOffsetX;
					} else if (possibleCode.includes('shadowy')) {
						textShadowOffsetY = parseInt(possibleCode.replace('shadowy', '')) || 0;
						lineContext.shadowOffsetY = textShadowOffsetY;
					} else {
						textShadowOffsetX = parseInt(possibleCode.replace('shadow', '')) || 0;
						textShadowOffsetY = textShadowOffsetX;
						lineContext.shadowOffsetX = textShadowOffsetX;
						lineContext.shadowOffsetY = textShadowOffsetY;
					}
				} else if (possibleCode == 'planechase') {
					var planechaseHeight = textSize * 1.8;
					lineContext.drawImage(getManaSymbol('chaos').image, currentX + canvasMargin, canvasMargin, planechaseHeight * 1.2, planechaseHeight);
					currentX += planechaseHeight * 1.3;
					startingCurrentX += planechaseHeight * 1.3;
				} else if (possibleCode == 'indent') {
					startingCurrentX += currentX;
					currentY -= 10;
				} else if (possibleCode == '/indent') {
					startingCurrentX = 0;
				} else if (possibleCode.includes('elemid')) {
					if (document.querySelector('#' + word.replace('{elemid', '').replace('}', ''))) {
						wordToWrite = document.querySelector('#' + word.replace('{elemid', '').replace('}', '')).value || '';
					}
					if (word.includes('set')) {
						var bottomTextSubstring = card.bottomInfo.midLeft.text.substring(0, card.bottomInfo.midLeft.text.indexOf('  {savex}')).replace('{elemidinfo-set}', document.querySelector('#info-set').value || '').replace('{elemidinfo-language}', document.querySelector('#info-language').value || '');
						justifyWidth = lineContext.measureText(bottomTextSubstring).width;
					} else if (word.includes('number') && wordToWrite.includes('/') && !['pokemon', '8thPlaytest'].includes(card.version)) {
						fillJustify = true;
						wordToWrite = Array.from(wordToWrite).join(' ');
					}
				} else if (possibleCode == 'savex') {
					savedTextXPosition = currentX;
				} else if (possibleCode == 'loadx') {
					if (savedTextXPosition > currentX) {
						currentX = savedTextXPosition;
					}
				} else if (possibleCode == 'savex2') {
					savedTextXPosition2 = currentX;
				} else if (possibleCode == 'loadx2') {
					if (savedTextXPosition2 > currentX) {
						currentX = savedTextXPosition2;
					}
				} else if (possibleCode.includes('ptshift')) {
					if (card.frames.findIndex(element => element.name.toLowerCase().includes('power/toughness')) >= 0 || card.version.includes('planeswalker') || ['commanderLegends', 'm21', 'mysticalArchive', 'customDualLands', 'feuerAmeiseKaldheim'].includes(card.version)) {
						ptShift[0] = scaleWidth(parseFloat(possibleCode.replace('ptshift', '').split(',')[0]));
						ptShift[1] = scaleHeight(parseFloat(possibleCode.split(',')[1]));
					}
				} else if (possibleCode.includes('rollcolor')) {
					savedRollColor = possibleCode.replace('rollcolor', '') || 'black';
				} else if (possibleCode.includes('roll')) {
					drawTextBetweenFrames = true;
					redrawFrames = true;
					drawToPrePTCanvas = true;
					if (savedRollYPosition == null) {
						savedRollYPosition = currentY;
					} else {
						savedRollYPosition = -1;
					}
					savedFont = textFont;
					lineContext.font = textFontStyle + textSize + 'px ' + 'belerenb' + textFontExtension;
					wordToWrite = possibleCode.replace('roll', '');
				} else if (possibleCode.includes('permashift')) {
					permaShift = [parseFloat(possibleCode.replace('permashift', '').split(',')[0]), parseFloat(possibleCode.split(',')[1])];
				} else if (possibleCode.includes('arcradius')) {
					textArcRadius = parseInt(possibleCode.replace('arcradius', '')) || 0;
				} else if (possibleCode.includes('arcstart')) {
					textArcStart = parseFloat(possibleCode.replace('arcstart', '')) || 0;
				} else if (possibleCode.includes('rotate')) {
					textRotation = parseInt(possibleCode.replace('rotate', '')) % 360;
				} else if (possibleCode === 'manacolordefault') {
					manaSymbolColor = null;
				} else if (possibleCode.includes('manacolor')) {
					manaSymbolColor = possibleCode.replace('manacolor', '') || 'white';
				} else if (possibleCode.includes('fixtextalign')) {
					textAlign = realTextAlign;
				} else if (possibleCode.includes('kerning')) {
					lineContext.letterSpacing = possibleCode.replace('kerning', '') + 'px';
					lineContext.font = lineContext.font; //necessary for the letterspacing update to be recognized
				} else if (getManaSymbol(possibleCode.replaceAll('/', '')) != undefined || getManaSymbol(possibleCode.replaceAll('/', '').split('').reverse().join('')) != undefined) {
					var possibleCode = possibleCode.replaceAll('/', '');
					var manaSymbol;
					// Add symbol to render queue without drawing immediately
					if (textObject.manaPrefix && 
						(getManaSymbol(textObject.manaPrefix + possibleCode) != undefined || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join('')) != undefined)) {
						manaSymbol = getManaSymbol(textObject.manaPrefix + possibleCode) || getManaSymbol(textObject.manaPrefix + possibleCode.split('').reverse().join(''));
					} else {
						if (possibleCode == 'brush' && textColor == 'white') {
							possibleCode = 'whitebrush';
						}
						manaSymbol = getManaSymbol(possibleCode) || getManaSymbol(possibleCode.split('').reverse().join(''));
					} 

					var origManaSymbolColor = manaSymbolColor;
					if (manaSymbol.matchColor && !manaSymbolColor && textColor !== 'black') {
						manaSymbolColor = textColor;
					}

					var manaSymbolSpacing = textSize * 0.04 + textManaSpacing;
					var manaSymbolWidth = manaSymbol.width * textSize * 0.78;
					var manaSymbolHeight = manaSymbol.height * textSize * 0.78;
					var manaSymbolX = currentX + canvasMargin + manaSymbolSpacing;
					var manaSymbolY = canvasMargin + textSize * 0.34 - manaSymbolHeight / 2;
					if (textObject.manaPlacement) {
						manaSymbolX = scaleWidth(textObject.manaPlacement.x[manaPlacementCounter] || 0) + canvasMargin;
						manaSymbolY = canvasMargin;
						currentY = scaleHeight(textObject.manaPlacement.y[manaPlacementCounter] || 0);
						manaPlacementCounter ++;
						newLine = true;
					} else if (textObject.manaLayout) {
						var layoutOption = 0;
						var manaSymbolCount = splitText.length - 1;
						while (textObject.manaLayout[layoutOption].max < manaSymbolCount && layoutOption < textObject.manaLayout.length - 1) {
							layoutOption ++;
						}
						var manaLayout = textObject.manaLayout[layoutOption];
						if (manaLayout.pos[manaPlacementCounter] == undefined) {
							manaLayout.pos[manaPlacementCounter] = [0, 0];
						}
						manaSymbolX = scaleWidth(manaLayout.pos[manaPlacementCounter][0] || 0) + canvasMargin;
						manaSymbolY = canvasMargin;
						currentY = scaleHeight(manaLayout.pos[manaPlacementCounter][1] || 0);
						manaPlacementCounter ++;
						manaSymbolWidth *= manaLayout.size;
						manaSymbolHeight *= manaLayout.size;
						newLine = true;
					}
					if (textObject.manaImageScale) {
						currentX -= (textObject.manaImageScale - 1) * manaSymbolWidth;
						manaSymbolX -= (textObject.manaImageScale - 1) / 2 * manaSymbolWidth;
						manaSymbolY -= (textObject.manaImageScale - 1) / 2 * manaSymbolHeight;
						manaSymbolWidth *= textObject.manaImageScale;
						manaSymbolHeight *= textObject.manaImageScale;
					}
					var backImage = null;
					if (manaSymbol.backs) {
						backImage = getManaSymbol('back' + Math.floor(Math.random() * manaSymbol.backs) + manaSymbol.back).image;
					}
					// Add to render queue
					manaSymbolsToRender.push({
						symbol: manaSymbol,
						x: manaSymbolX,
						y: manaSymbolY, 
						width: manaSymbolWidth,
						height: manaSymbolHeight,
						hasOutline: textOutlineWidth > 0,
						color: manaSymbolColor,
						radius: textArcRadius,
						arcStart: textArcStart,
						currentX: currentX,
						backImage: backImage,
						outlineWidth: textOutlineWidth,
						shadowColor: textShadowColor,
						shadowOffsetX: textShadowOffsetX,
						shadowOffsetY: textShadowOffsetY,
						shadowBlur: textShadowBlur
					});
					currentX += manaSymbolWidth + manaSymbolSpacing * 2;

					manaSymbolColor = origManaSymbolColor;
				} else {
					wordToWrite = word;
				}
			}

			function renderManaSymbols() {
				if (manaSymbolsToRender.length === 0) return;

				// Detect Safari browser
				var isSafari = /^((?!chrome|android).)*safari/i.test(navigator.userAgent);

				// Check if any symbols actually need outlines
				var hasAnyOutlines = manaSymbolsToRender.some(symbolData => symbolData.hasOutline);
				
				if (!hasAnyOutlines) {
					// Simple path: no outlines needed, just draw symbols normally
					manaSymbolsToRender.forEach(symbolData => {
						var imageToUse = symbolData.symbol.image;
						var backImageToUse = symbolData.backImage;
						
						// For Safari, create a combined canvas first, then apply shadow
						if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
							// Create a combined canvas for both symbols
							var combinedCanvas = document.createElement('canvas');
							combinedCanvas.width = symbolData.width;
							combinedCanvas.height = symbolData.height;
							var combinedContext = combinedCanvas.getContext('2d');
							
							// Draw back image first (if exists)
							if (symbolData.symbol.backs && backImageToUse) {
								combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
							}
							
							// Draw main symbol on top
							combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);
							
							// Now use the combined canvas as the image source
							imageToUse = combinedCanvas;
							backImageToUse = null; // Don't draw back separately since it's already combined
						}
						
						if (symbolData.radius > 0) {
							if (symbolData.symbol.backs && backImageToUse) {
								lineContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y, 
									symbolData.width, symbolData.height, symbolData.radius, 
									symbolData.arcStart, symbolData.currentX);
							}
							lineContext.drawImageArc(imageToUse, symbolData.x, symbolData.y, 
								symbolData.width, symbolData.height, symbolData.radius,
								symbolData.arcStart, symbolData.currentX);
						} else if (symbolData.color) {
							lineContext.fillImage(imageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height, symbolData.color);
						} else {
							if (symbolData.symbol.backs && backImageToUse) {
								lineContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
									symbolData.width, symbolData.height);
							}
							lineContext.drawImage(imageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height);
						}
					});
					
					manaSymbolsToRender = [];
					return; // This exits the function completely - no complex rendering
				}

				// Complex path: outlines needed, do multi-pass rendering
				// This code should ONLY run when hasAnyOutlines is true
				var outlineCanvas = lineCanvas.cloneNode(); 
				var outlineContext = outlineCanvas.getContext('2d');
				var symbolCanvas = lineCanvas.cloneNode();
				var symbolContext = symbolCanvas.getContext('2d');
				symbolContext.shadowColor = lineContext.shadowColor;
				symbolContext.shadowOffsetX = lineContext.shadowOffsetX;
				symbolContext.shadowOffsetY = lineContext.shadowOffsetY;
				symbolContext.shadowBlur = lineContext.shadowBlur;

				// Save existing text content
				var tempCanvas = lineCanvas.cloneNode();
				var tempContext = tempCanvas.getContext('2d');
				tempContext.drawImage(lineCanvas, 0, 0);
				// Clear the line context
				lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
				
				// First pass: Draw outlines only
				manaSymbolsToRender.forEach(symbolData => {
					if (!symbolData.hasOutline) return;
					outlineContext.fillStyle = 'black';
					outlineContext.beginPath();
					var centerX = symbolData.x + symbolData.width/2;
					var centerY = symbolData.y + symbolData.height/2;
					var baseRadius = Math.max(symbolData.width, symbolData.height) / 2;
					// Fix: Use half the outline width to match text rendering behavior
					var outlineRadius = baseRadius + (symbolData.outlineWidth || 0) / 2;
					outlineContext.arc(centerX, centerY + (symbolData.radius ?? 0), outlineRadius, 0, 2 * Math.PI);
					outlineContext.fill();
				});
				// Transfer outlines to main canvas
				lineContext.drawImage(outlineCanvas, 0, 0);
				
				// Restore text content on top of outlines
				lineContext.drawImage(tempCanvas, 0, 0);
				
				// Second pass: Draw mana symbols
				manaSymbolsToRender.forEach(symbolData => {
					var imageToUse = symbolData.symbol.image;
					var backImageToUse = symbolData.backImage;
					
					// For Safari, create a combined canvas first, then apply shadow
					if (isSafari && (symbolData.symbol.image.src?.includes('.svg') || (backImageToUse?.src?.includes('.svg')))) {
						// Create a combined canvas for both symbols
						var combinedCanvas = document.createElement('canvas');
						combinedCanvas.width = symbolData.width;
						combinedCanvas.height = symbolData.height;
						var combinedContext = combinedCanvas.getContext('2d');
						
						// Draw back image first (if exists)
						if (symbolData.symbol.backs && backImageToUse) {
							combinedContext.drawImage(backImageToUse, 0, 0, symbolData.width, symbolData.height);
						}
						
						// Draw main symbol on top
						combinedContext.drawImage(symbolData.symbol.image, 0, 0, symbolData.width, symbolData.height);
						
						// Now use the combined canvas as the image source
						imageToUse = combinedCanvas;
						backImageToUse = null; // Don't draw back separately since it's already combined
					}
					
					if (symbolData.radius > 0) {
						if (symbolData.symbol.backs && backImageToUse) {
							symbolContext.drawImageArc(backImageToUse, symbolData.x, symbolData.y, 
								symbolData.width, symbolData.height, symbolData.radius, 
								symbolData.arcStart, symbolData.currentX);
						}
						symbolContext.drawImageArc(imageToUse, symbolData.x, symbolData.y, 
							symbolData.width, symbolData.height, symbolData.radius,
							symbolData.arcStart, symbolData.currentX);
					} else if (symbolData.color) {
						symbolContext.fillImage(imageToUse, symbolData.x, symbolData.y,
							symbolData.width, symbolData.height, symbolData.color);
					} else {
						if (symbolData.symbol.backs && backImageToUse) {
							symbolContext.drawImage(backImageToUse, symbolData.x, symbolData.y,
								symbolData.width, symbolData.height);
						}
						symbolContext.drawImage(imageToUse, symbolData.x, symbolData.y,
							symbolData.width, symbolData.height);
					}
				});

				// Draw symbols on top of text
				lineContext.drawImage(symbolCanvas, 0, 0);
				
				manaSymbolsToRender = [];
			}
			if (wordToWrite && lineContext.font.endsWith('belerenb')) {
				wordToWrite = wordToWrite.replace(/f(?:\s|$)/g, '\ue006').replace(/h(?:\s|$)/g, '\ue007').replace(/m(?:\s|$)/g, '\ue008').replace(/n(?:\s|$)/g, '\ue009').replace(/k(?:\s|$)/g, '\ue00a');
			}

			//if the word goes past the max line width, go to the next line
			if (wordToWrite && lineContext.measureText(wordToWrite).width + currentX >= textWidth && textArcRadius == 0) {
				if (textOneLine && startingTextSize > collisionMinimumTextSize) {
					// Does not fit beside the active neighboring field. Retry at
					// a smaller size, but never beyond the {fontsize-25} floor.
					startingTextSize = Math.max(collisionMinimumTextSize, startingTextSize - 1);
					continue outerloop;
				}
				if (textOneLine) {
					collisionFitFailed = true;
				}
				newLine = true;
			}
			//if we need a new line, go to the next line
			if ((newLine && !textOneLine) || splitText.indexOf(word) == splitText.length - 1) {
				var horizontalAdjust = 0
				if (textAlign == 'center') {
					horizontalAdjust = (textWidth - currentX) / 2;
				} else if (textAlign == 'right') {
					horizontalAdjust = textWidth - currentX;
				}
				if (currentX > widestLineWidth) {
					widestLineWidth = currentX;
				}
				if (manaSymbolsToRender.length > 0) {
					renderManaSymbols();
				}
				paragraphContext.drawImage(lineCanvas, horizontalAdjust, currentY);
				lineY = 0;
				lineContext.clearRect(0, 0, lineCanvas.width, lineCanvas.height);
				// boxes for 'roll a d20' cards
				if (savedRollYPosition != null && (newLineSpacing != 0 || !(newLine && !textOneLine))) {
					if (savedRollYPosition != -1) {
						paragraphContext.globalCompositeOperation = 'destination-over';
						paragraphContext.globalAlpha = 0.25;
						paragraphContext.fillStyle = savedRollColor;
						paragraphContext.fillRect(canvasMargin - textSize * 0.1, savedRollYPosition + canvasMargin - textSize * 0.28, paragraphCanvas.width - 2 * canvasMargin + textSize * 0.2, currentY - savedRollYPosition + textSize * 1.3);
						paragraphContext.globalCompositeOperation = 'source-over';
						paragraphContext.globalAlpha = 1;
						savedRollYPosition = -1;
					} else {
						savedRollYPosition = null;
					}
				}
				//reset
				currentX = startingCurrentX;
				currentY += textSize + newLineSpacing;
				newLineSpacing = (textObject.lineSpacing || 0) * textSize;
				newLine = false;
			}
			//if there's a word to write, it's not a space on a new line, and it's allowed to write words, then we write the word
			if (wordToWrite && (currentX != startingCurrentX || wordToWrite != ' ') && !textManaCost) {
				var justifySettings = {
					maxSpaceSize: 6,
					minSpaceSize: 0
				};
				//Rotate katakana prolonged sound mark (ー) 90° CW in vertical text
				var verticalRotateChar = textObject.vertical && wordToWrite === '\u30FC';
				if (verticalRotateChar) {
					var charWidth = lineContext.measureText(wordToWrite).width;
					var centerX = currentX + canvasMargin + charWidth / 2;
					var centerY = canvasMargin + textSize * textFontHeightRatio + lineY - textSize * 0.3;
					lineContext.save();
					lineContext.translate(centerX, centerY);
					lineContext.rotate(Math.PI / 2);
					lineContext.translate(-centerX, -centerY);
				}
				if (textArcRadius > 0) {
					lineContext.fillTextArc(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, textArcRadius, textArcStart, currentX, textOutlineWidth);
				} else {
					if (textOutlineWidth >= 1) {
						if (fillJustify) {
							lineContext.strokeJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
						} else {
							lineContext.strokeText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
						}
					}
					if (fillJustify) {
						lineContext.fillJustifyText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY, justifyWidth, justifySettings);
					} else {
						lineContext.fillText(wordToWrite, currentX + canvasMargin, canvasMargin + textSize * textFontHeightRatio + lineY);
					}
				}
				if (verticalRotateChar) {
					lineContext.restore();
				}

				if (fillJustify) {
					currentX += lineContext.measureJustifiedText(wordToWrite, justifyWidth, justifySettings);
				} else {
					currentX += lineContext.measureText(wordToWrite).width;
				}
			}
			if (currentY > textHeight && textBounded && !textOneLine && textArcRadius == 0) {
				if (startingTextSize > collisionMinimumTextSize) {
					// Does not fit above the active neighboring field. Retry at
					// a smaller size, but never beyond the {fontsize-25} floor.
					startingTextSize = Math.max(collisionMinimumTextSize, startingTextSize - 1);
					continue outerloop;
				}
				collisionFitFailed = true;
			}
			if (splitText.indexOf(word) == splitText.length - 1) {
				//should manage vertical centering here
				var verticalAdjust = 0;
				if (!textObject.noVerticalCenter) {
					verticalAdjust = (textHeight - currentY + textSize * 0.15) / 2;
				}
				var finalHorizontalAdjust = 0;
				const horizontalAdjustUnit = (textWidth - widestLineWidth) / 2;
				if (textJustify == 'right' && textAlign != 'right') {
					finalHorizontalAdjust = 2 * horizontalAdjustUnit;
					if (textAlign == 'center') {
						finalHorizontalAdjust = horizontalAdjustUnit;
					}
				} else if (textJustify == 'center' && textAlign != 'center') {
					finalHorizontalAdjust = horizontalAdjustUnit;
					if (textAlign == 'right') {
						finalHorizontalAdjust = - horizontalAdjustUnit;
					}
				}
				recordCardTextFit(textObject, collisionFit, originalStartingTextSize,
					startingTextSize, collisionFitFailed);
				var trueTargetContext = targetContext;
				if (drawToPrePTCanvas) {
					trueTargetContext = prePTContext;
				}
				if (textRotation) {
					trueTargetContext.save();
					trueTargetContext
					const shapeX = textX + ptShift[0];
					const shapeY = textY + ptShift[1];
					trueTargetContext.translate(shapeX, shapeY);
					trueTargetContext.rotate(Math.PI * textRotation / 180);
					trueTargetContext.drawImage(paragraphCanvas, permaShift[0] - canvasMargin + finalHorizontalAdjust, verticalAdjust - canvasMargin + permaShift[1]);
					trueTargetContext.restore();
				} else {
					trueTargetContext.drawImage(paragraphCanvas, textX - canvasMargin + ptShift[0] + permaShift[0] + finalHorizontalAdjust, textY - canvasMargin + verticalAdjust + ptShift[1] + permaShift[1]);
				}
				drawingText = false;
			}
		}
	}
}

CanvasRenderingContext2D.prototype.fillTextArc = function(text, x, y, radius, startRotation, distance = 0, outlineWidth = 0) {
	this.save();
	this.translate(x - distance + scaleWidth(0.5), y + radius);
	this.rotate(startRotation + widthToAngle(distance, radius));
	for (var i = 0; i < text.length; i++) {
		var letter = text[i];
		if (outlineWidth >= 1) {
			this.strokeText(letter, 0, -radius);
		}
		this.fillText(letter, 0, -radius);
		this.rotate(widthToAngle(this.measureText(letter).width, radius));
	}
	this.restore();
}
CanvasRenderingContext2D.prototype.drawImageArc = function(image, x, y, width, height, radius, startRotation, distance = 0) {
	this.save();
	this.translate(x - distance + scaleWidth(0.5), y + radius);
	this.rotate(startRotation + widthToAngle(distance, radius));
	this.drawImage(image, 0, -radius, width, height);
	this.restore();
}
CanvasRenderingContext2D.prototype.fillImage = function(image, x, y, width, height, color = 'white', margin = 10) {
	var canvas = document.createElement('canvas');
	canvas.width = width + margin * 2;
	canvas.height = height + margin * 2;
	var context = canvas.getContext('2d');
	context.drawImage(image, margin, margin, width, height);
	context.globalCompositeOperation = 'source-in';
	context.fillStyle = pinlineColors(color);
	context.fillRect(0, 0, width + margin * 2, height + margin * 2);
	this.drawImage(canvas, x - margin, y - margin, width + margin * 2, height + margin * 2);
}

const FILL = 0; //const to indicate filltext render
const STROKE = 1;
const MEASURE = 2;
var maxSpaceSize = 3; // Multiplier for max space size. If greater then no justification applied
var minSpaceSize = 0.5; // Multiplier for minimum space size
function renderTextJustified(ctx, text, x, y, width, renderType) {
	var splitChar = " ";

	var words, wordsWidth, count, spaces, spaceWidth, adjSpace, renderer, i, textAlign, useSize, totalWidth;
	textAlign = ctx.textAlign;
	ctx.textAlign = "left";
	wordsWidth = 0;
	words = text.split(splitChar).map(word => {
		var w = ctx.measureText(word).width;
		wordsWidth += w;
		return {
			width: w,
			word: word
		};
	});
	// count = num words, spaces = number spaces, spaceWidth normal space size
	// adjSpace new space size >= min size. useSize Reslting space size used to render
	count = words.length;
	spaces = count - 1;
	spaceWidth = ctx.measureText(splitChar).width;
	adjSpace = Math.max(spaceWidth * minSpaceSize, (width - wordsWidth) / spaces);
	useSize = adjSpace > spaceWidth * maxSpaceSize ? spaceWidth : adjSpace;
	totalWidth = wordsWidth + useSize * spaces;
	if (renderType === MEASURE) { // if measuring return size
		ctx.textAlign = textAlign;
		return totalWidth;
	}
	renderer = renderType === FILL ? ctx.fillText.bind(ctx) : ctx.strokeText.bind(ctx); // fill or stroke
	switch(textAlign) {
	case "right":
		x -= totalWidth;
		break;
	case "end":
		x += width - totalWidth;
		break;
	case "center": // intentional fall through to default
		x -= totalWidth / 2;
	default:
	}
	if (useSize === spaceWidth) { // if space size unchanged
		renderer(text, x, y);
	} else {
		for(i = 0; i < count; i += 1) {
			renderer(words[i].word,x,y);
			x += words[i].width;
			x += useSize;
		}
	}
	ctx.textAlign = textAlign;
}

// Parse vet and set settings object.
function justifiedTextSettings(settings) {
	var min,max;
	var vetNumber = (num, defaultNum) => {
		num = num !== null && num !== null && !isNaN(num) ? num : defaultNum;
		if(num < 0){
			num = defaultNum;
		}
		return num;
	}
	if(settings === undefined || settings === null){
		return;
	}
	max = vetNumber(settings.maxSpaceSize, maxSpaceSize);
	min = vetNumber(settings.minSpaceSize, minSpaceSize);
	if(min > max){
		return;
	}
	minSpaceSize = min;
	maxSpaceSize = max;
}
CanvasRenderingContext2D.prototype.fillJustifyText = function(text, x, y, width, settings) {
	justifiedTextSettings(settings);
	renderTextJustified(this, text, x, y, width, FILL);
}
CanvasRenderingContext2D.prototype.strokeJustifyText = function(text, x, y, width, settings){
	justifiedTextSettings(settings);
	renderTextJustified(this, text, x, y, width, STROKE);
}
CanvasRenderingContext2D.prototype.measureJustifiedText = function(text, width, settings) {
	justifiedTextSettings(settings);
	renderTextJustified(this, text, 0, 0, width, MEASURE);
}

function widthToAngle(width, radius) {
	return width / radius;
}
function curlyQuotes(input) {
	return input.replace(/ '/g, ' ‘').replace(/^'/, '‘').replace(/'/g, '’').replace(/ "/g, ' “').replace(/" /g, '” ').replace(/\."/, '.”').replace(/"$/, '”').replace(/"\)/g, '”)').replace(/"/g, '“');
}
function pinlineColors(color) {
	return color.replace('white', '#fcfeff').replace('blue', '#0075be').replace('black', '#272624').replace('red', '#ef3827').replace('green', '#007b43')
}
async function addTextbox(textboxType) {
	if (textboxType == 'Nickname' && !card.text.nickname && card.text.title) {
		await loadTextOptions({nickname: {name:'Nickname', text:card.text.title.text, x:0.14, y:0.1129, width:0.72, height:0.0243, oneLine:true, font:'mplantini', size:0.0229, color:'white', shadowX:0.0014, shadowY:0.001, align:'center'}}, false);
		var nickname = card.text.title;
		nickname.name = 'Nickname';
		card.text.title = card.text.nickname;
		card.text.title.name = 'Title';
		card.text.nickname = nickname;
	} else if (textboxType == 'Power/Toughness' && !card.text.pt) {
		loadTextOptions({pt: {name:'Power/Toughness', text:'', x:0.7928, y:0.902, width:0.1367, height:0.0372, size:0.0372, font:'belerenbsc', oneLine:true, align:'center'}}, false);
	} else if (textboxType == 'DateStamp' && !card.text.dateStamp) {
		loadTextOptions({dateStamp: {name:'Date Stamp', text:'', x:0.11, y:0.5072, width:0.78, height:0.0286, size:0.0286, font:'belerenb', oneLine:true, align:'right', color:'#ffd35b', shadowX:-0.0007, shadowY:-0.001}}, false);
	}
}
function setCustomTemplateFieldStatus(message, isError) {
	var status = document.querySelector('#custom-template-field-status');
	if (!status) {
		return;
	}
	status.textContent = message;
	status.classList.toggle('csv-import-error', !!isError);
}

function customTemplateFieldLabelExists(label) {
	var normalized = String(label || '').trim().toLowerCase();
	var textMatch = Object.keys(card.text || {}).some(function (key) {
		var field = card.text[key] || {};
		return field.customField && String(field.csvFieldLabel || field.name || key).trim().toLowerCase() === normalized;
	});
	var imageMatch = (card.frames || []).some(function (frame) {
		return frame.csvImageFieldKey &&
			String(frame.csvFieldLabel || frame.name || frame.csvImageFieldKey).trim().toLowerCase() === normalized;
	});
	return textMatch || imageMatch;
}

function customTemplateFieldKey(label, prefix, existingKeys) {
	var slug = String(label || '').trim().toLowerCase()
		.replace(/[^a-z0-9]+/g, '-')
		.replace(/^-+|-+$/g, '') || 'field';
	var base = prefix + '-' + slug;
	var key = base;
	var number = 2;
	while (existingKeys.indexOf(key) !== -1) {
		key = base + '-' + number;
		number++;
	}
	return key;
}

async function addCustomTemplateField(kind) {
	var input = document.querySelector('#custom-template-field-label');
	var label = String(input ? input.value : '').trim();
	if (!label) {
		setCustomTemplateFieldStatus('Enter a field label first.', true);
		return;
	}
	if (customTemplateFieldLabelExists(label)) {
		setCustomTemplateFieldStatus('A custom field named "' + label + '" already exists.', true);
		return;
	}

	try {
		if (kind === 'text') {
			card.text = card.text || {};
			var textKey = customTemplateFieldKey(label, 'custom-text', Object.keys(card.text));
			var definition = {};
			definition[textKey] = {
				name: label,
				csvFieldLabel: label,
				customField: true,
				text: '',
				x: 0.1,
				y: 0.1,
				width: 0.8,
				height: 0.06,
				size: 0.035,
				fontSize: 0,
				font: 'mplantin',
				color: 'black',
				align: 'left'
			};
			prepareNewDesignElementForOrientation(definition[textKey]);
			loadTextOptions(definition, false);
			var textIndex = Object.keys(card.text).indexOf(textKey);
			var textOptions = document.querySelectorAll('#text-options .text-option');
			if (textOptions[textIndex]) {
				textOptions[textIndex].click();
			}
			setCustomTemplateFieldStatus('Added text field "' + label + '". Open the Text tab to edit its text and bounds.', false);
		} else if (kind === 'image') {
			var imageKeys = (card.frames || []).map(function (frame) { return frame.csvImageFieldKey || ''; });
			var imageKey = customTemplateFieldKey(label, 'custom-image', imageKeys);
			var frame = {
				name: 'Image Field: ' + label,
				csvFieldLabel: label,
				csvImageFieldKey: imageKey,
				customField: true,
				designCreated: true,
				src: '/img/blank.png',
				noThumb: true,
				masks: [],
				bounds: {x: 0.1, y: 0.1, width: 0.25, height: 0.25},
				opacity: 100
			};
			prepareNewDesignElementForOrientation(frame);
			card.frames = card.frames || [];
			card.frames.unshift(frame);
			await addFrame([], frame);
			selectedFrame = frame;
			var frameElement = document.querySelector('#frame-list')?.firstElementChild;
			if (frameElement) {
				frameElementClicked({target: frameElement});
			}
			setCustomTemplateFieldStatus('Added image field "' + label + '". Use the Frame Image Editor to set its position and size.', false);
		} else {
			throw new Error('Unknown custom field type.');
		}
		if (input) {
			input.value = '';
		}
		if (window.CSVImporter) {
			CSVImporter.refreshTextFields();
		}
	} catch (error) {
		setCustomTemplateFieldStatus(error.message || 'The custom field could not be added.', true);
	}
}

//ART TAB
function uploadArt(imageSource, otherParams) {
	ImageLoadTracker.track(imageSource);
	art.src = imageSource;
	if (otherParams && otherParams == 'autoFit') {
		art.onload = function() {
			autoFitArt();
			art.onload = artEdited;
		};
	}
}
async function pasteArt() {
  try {
    const clipboardItems = await navigator.clipboard.read();
    
    for (const item of clipboardItems) {
      for (const type of item.types) {
        if (type.startsWith('image/')) {
          const blob = await item.getType(type);
          
          const url = URL.createObjectURL(blob);

          uploadArt(url, document.querySelector("#art-update-autofit").checked ? "autoFit" : "");
          // document.getElementById('preview').src = url;
          return;
        }
      }
    }

    notify('No image found in clipboard!');
  } catch (err) {
    console.error('Failed to read clipboard: ', err);
    notify('Clipboard access not allowed or no image available.');
  }
}
function artEdited() {
	card.artSource = art.src;
	card.artX = document.querySelector('#art-x').value / card.width;
	card.artY = document.querySelector('#art-y').value / card.height;
	card.artZoom = document.querySelector('#art-zoom').value / 100;
	card.artRotate = document.querySelector('#art-rotate').value;
	drawCard();
}
function autoFitArt() {
	if (document.querySelector("#art-preserve-position")?.checked) return;
	document.querySelector('#art-rotate').value = 0;
	if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
		document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - scaleHeight(card.marginY));
		document.querySelector('#art-zoom').value = (scaleHeight(card.artBounds.height) / art.height * 100).toFixed(1);
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
	} else {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
		document.querySelector('#art-zoom').value = (scaleWidth(card.artBounds.width) / art.width * 100).toFixed(1);
		document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
	}
	artEdited();
}

function centerArtX() {
	document.querySelector('#art-rotate').value = 0;
	if (art.width / art.height > scaleWidth(card.artBounds.width) / scaleHeight(card.artBounds.height)) {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - (document.querySelector('#art-zoom').value / 100 * art.width - scaleWidth(card.artBounds.width)) / 2 - scaleWidth(card.marginX));
	} else {
		document.querySelector('#art-x').value = Math.round(scaleX(card.artBounds.x) - scaleWidth(card.marginX));
	}
	artEdited();
}

function centerArtY() {
	document.querySelector('#art-rotate').value = 0;
	document.querySelector('#art-y').value = Math.round(scaleY(card.artBounds.y) - (document.querySelector('#art-zoom').value / 100 * art.height - scaleHeight(card.artBounds.height)) / 2 - scaleHeight(card.marginY));
	artEdited();
}

function artFromScryfall(scryfallResponse) {
	scryfallArt = []
	const artIndex = document.querySelector('#art-index');
	artIndex.innerHTML = null;
	var optionIndex = 0;
	scryfallResponse.forEach(card => {
		if (card.image_uris && (card.object == 'card' || card.type_line != 'Card') && card.artist) {
			scryfallArt.push(card);
			var option = document.createElement('option');
			option.innerHTML = `${card.name} (${card.set.toUpperCase()} - ${card.artist})`;
			option.value = optionIndex;
			artIndex.appendChild(option);
			optionIndex ++;
		}
	});

	if (document.querySelector('#importAllPrints').checked) {
		// If importing unique prints, the art should change to match the unique print selected.

		// First we find the illustration ID of the imported print
		var illustrationID = scryfallCard[document.querySelector('#import-index').value].illustration_id;

		// Find all unique arts for that card
		var artIllustrations = scryfallArt.map(card => card.illustration_id);

		// Find the art that matches the selected print
		var index = artIllustrations.indexOf(illustrationID);
		if (index < 0) {
			// Couldn't find art
			index = 0;
		}

		// Use that art
		artIndex.value = index;
	}

	changeArtIndex();
}
function changeArtIndex() {
	const artIndexValue = document.querySelector('#art-index').value;
	if (artIndexValue != 0 || artIndexValue == '0') {
		const scryfallCardForArt = scryfallArt[artIndexValue];
		uploadArt(scryfallCardForArt.image_uris.art_crop, 'autoFit');
		artistEdited(scryfallCardForArt.artist);
		if (params.get('mtgpics') != null) {
			imageURL(`https://www.mtgpics.com/pics/art/${scryfallCardForArt.set.toLowerCase()}/${("00" + scryfallCardForArt.collector_number).slice(-3)}.jpg`, tryMTGPicsArt);
		}
	}
}
function tryMTGPicsArt(src) {
	var attemptedImage = new Image();
	attemptedImage.onload = function() {
		if (this.complete) {
			art.onload = function() {
				autoFitArt();
				art.onload = artEdited;
			};
			art.src = this.src;
		}
	}
	attemptedImage.src = src;
}
function initDraggableArt() {
	previewCanvas.onmousedown = artStartDrag;
	previewCanvas.onmousemove = artDrag;
	previewCanvas.onmouseout = artStopDrag;
	previewCanvas.onmouseup = artStopDrag;
	draggingArt = false;
	lastArtDragTime = 0;
}
function artStartDrag(e) {
	e.preventDefault();
	e.stopPropagation();
	startX = parseInt(e.clientX);
	startY = parseInt(e.clientY);
	draggingArt = true;
}
function artDrag(e) {
	var target = document.querySelector('#drag-target-setSymbol').checked ? "setSymbol" : "art";
	var canRotate = target == "art";
	var edited = target == "art" ? artEdited : setSymbolEdited;

	e.preventDefault();
	e.stopPropagation();
	if (draggingArt && Date.now() > lastArtDragTime + 25) {
		lastArtDragTime = Date.now();
		if (e.shiftKey || e.ctrlKey) {
			startX = parseInt(e.clientX);
			const endY = parseInt(e.clientY);
			if (e.ctrlKey && canRotate) {
				document.querySelector(`#${target}-rotate`).value = Math.round((parseFloat(document.querySelector(`#${target}-rotate`).value) - (startY - endY) / 10) % 360 * 10) / 10;
			} else {
				document.querySelector(`#${target}-zoom`).value = Math.round((parseFloat(document.querySelector(`#${target}-zoom`).value) * (1.002 ** (startY - endY))) * 10) / 10;
			}
			startY = endY;
			edited();
		} else {
			const endX = parseInt(e.clientX);
			const endY = parseInt(e.clientY);
			var changeX = (endX - startX) * 2;
			var changeY = (endY - startY) * 2;
			document.querySelector(`#${target}-x`).value = parseInt(document.querySelector(`#${target}-x`).value) + changeX;
			document.querySelector(`#${target}-y`).value = parseInt(document.querySelector(`#${target}-y`).value) + changeY;
			startX = endX;
			startY = endY;
			edited();
		}

	}
}
function artStopDrag(e) {
	e.preventDefault();
	e.stopPropagation();
	if (draggingArt) {
		draggingArt = false;
	}
}
//SET SYMBOL TAB
function uploadSetSymbol(imageSource, otherParams) {
	ImageLoadTracker.track(imageSource);
	return new Promise(function (resolve) {
		var finished = false;
		function finish(loaded) {
			if (finished) {
				return;
			}
			finished = true;
			resolve(loaded);
		}
		setSymbol.addEventListener('load', function () { finish(true); }, {once:true});
		setSymbol.addEventListener('error', function () { finish(false); }, {once:true});
		setSymbol.src = imageSource;
		if (otherParams && otherParams == 'resetSetSymbol') {
			setSymbol.onload = function() {
				resetSetSymbol();
				setSymbol.onload = setSymbolEdited;
			};
		}
	});
}

function setSymbolEdited() {
	card.setSymbolSource = setSymbol.src;
	if (document.querySelector('#lockSetSymbolURL').checked) {
		localStorage.setItem('lockSetSymbolURL', card.setSymbolSource);
	}
	localStorage.setItem('set-symbol-source', document.querySelector('#set-symbol-source').value);
	card.setSymbolX = document.querySelector('#setSymbol-x').value / card.width;
	card.setSymbolY = document.querySelector('#setSymbol-y').value / card.height;
	card.setSymbolZoom = document.querySelector('#setSymbol-zoom').value / 100;
	drawCard();
}
function resetSetSymbol() {
	if (card.setSymbolBounds == undefined) {
		return;
	}
	document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x));
	document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y));
	var setSymbolZoom;
	if (setSymbol.width / setSymbol.height > scaleWidth(card.setSymbolBounds.width) / scaleHeight(card.setSymbolBounds.height)) {
		setSymbolZoom = (scaleWidth(card.setSymbolBounds.width) / setSymbol.width * 100).toFixed(1);
	} else {
		setSymbolZoom = (scaleHeight(card.setSymbolBounds.height) / setSymbol.height * 100).toFixed(1);
	}
	document.querySelector('#setSymbol-zoom').value = setSymbolZoom;
	if (card.setSymbolBounds.horizontal == 'center') {
		document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) / 2 - scaleWidth(card.marginX));
	} else if (card.setSymbolBounds.horizontal == 'right') {
		document.querySelector('#setSymbol-x').value = Math.round(scaleX(card.setSymbolBounds.x) - (setSymbol.width * setSymbolZoom / 100) - scaleWidth(card.marginX));
	}
	if (card.setSymbolBounds.vertical == 'center') {
		document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) / 2 - scaleHeight(card.marginY));
	} else if (card.setSymbolBounds.vertical == 'bottom') {
		document.querySelector('#setSymbol-y').value = Math.round(scaleY(card.setSymbolBounds.y) - (setSymbol.height * setSymbolZoom / 100) - scaleHeight(card.marginY));
	}
	setSymbolEdited();
}
function fetchSetSymbol() {
	var setCode = document.querySelector('#set-symbol-code').value.toLowerCase() || 'cmd';
	if (document.querySelector('#lockSetSymbolCode').checked) {
		localStorage.setItem('lockSetSymbolCode', setCode);
	}
	var setRarity = document.querySelector('#set-symbol-rarity').value.toLowerCase()
		.replace('uncommon', 'u').replace('common', 'c').replace('rare', 'r').replace('mythic', 'm') || 'c';
	var source;
	if (['a22', 'a23', 'j22', 'hlw'].includes(setCode.toLowerCase())) {
		source = fixUri('/img/setSymbols/custom/' + setCode.toLowerCase() + '-' + setRarity + '.png');
	} else if (['cc', 'logan', 'joe'].includes(setCode.toLowerCase())) {
		source = fixUri('/img/setSymbols/custom/' + setCode.toLowerCase() + '-' + setRarity + '.svg');
	} else if (document.querySelector('#set-symbol-source').value == 'gatherer') {
		if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
		source = 'http://gatherer.wizards.com/Handlers/Image.ashx?type=symbol&set=' + setCode + '&size=large&rarity=' + setRarity;
	} else if (document.querySelector('#set-symbol-source').value == 'hexproof') {
		if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
		source = 'https://api.hexproof.io/symbols/set/' + setCode + '/' + setRarity;
		if (params.get('noproxy') == null) {
			source = 'https://corsproxy.io/?url=' + encodeURIComponent(source);
		}
	} else {
		var extension = ['xxxx'].includes(setCode.toLowerCase()) ? 'png' : 'svg';
		if (setSymbolAliases.has(setCode.toLowerCase())) setCode = setSymbolAliases.get(setCode.toLowerCase());
		source = fixUri('/img/setSymbols/official/' + setCode.toLowerCase() + '-' + setRarity + '.' + extension);
	}
	card.setSymbolFamily = '';
	card.setSymbolAssetId = '';
	return uploadSetSymbol(source, 'resetSetSymbol');
}

function lockSetSymbolCode() {
	var savedValue = '';
	if (document.querySelector('#lockSetSymbolCode').checked) {
		savedValue = document.querySelector('#set-symbol-code').value;
	}
	localStorage.setItem('lockSetSymbolCode', savedValue);
}
function lockSetSymbolURL() {
	var savedValue = '';
	if (document.querySelector('#lockSetSymbolURL').checked) {
		savedValue = card.setSymbolSource;
	}
	localStorage.setItem('lockSetSymbolURL', savedValue);
}
//WATERMARK TAB
function uploadWatermark(imageSource, otherParams) {
	ImageLoadTracker.track(imageSource);
	watermark.src = imageSource;
	if (otherParams && otherParams == 'resetWatermark') {
		watermark.onload = function() {
			resetWatermark();
			watermark.onload = watermarkEdited;
		};
	}
}
function watermarkLeftColor(c) {
	card.watermarkLeft = c;
	watermarkEdited();
}
function watermarkRightColor(c) {
	card.watermarkRight = c;
	watermarkEdited();
}
function watermarkEdited() {
	card.watermarkSource = watermark.src;
	card.watermarkX = document.querySelector('#watermark-x').value / card.width;
	card.watermarkY = document.querySelector('#watermark-y').value / card.height;
	card.watermarkZoom = document.querySelector('#watermark-zoom').value / 100;
	if (card.watermarkLeft == "none" && document.querySelector('#watermark-left').value != "none") {
		card.watermarkLeft = document.querySelector('#watermark-left').value;
	}
	// card.watermarkLeft = document.querySelector('#watermark-left').value;
	// card.watermarkRight =  document.querySelector('#watermark-right').value;
	card.watermarkOpacity = document.querySelector('#watermark-opacity').value / 100;
	watermarkContext.globalCompositeOperation = 'source-over';
	watermarkContext.globalAlpha = 1;
	watermarkContext.clearRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
	if (card.watermarkLeft != 'none' && !card.watermarkSource.includes('/blank.png') && card.watermarkZoom > 0) {
		if (card.watermarkRight != 'none') {
			watermarkContext.drawImage(right, scaleX(0), scaleY(0), scaleWidth(1), scaleHeight(1));
			watermarkContext.globalCompositeOperation = 'source-in';
			if (card.watermarkRight == 'default') {
				drawPlacedImage(watermarkContext, watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom, card.watermarkRotate);
			} else {
				watermarkContext.fillStyle = card.watermarkRight;
				watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
			}
			watermarkContext.globalCompositeOperation = 'destination-over';
		}
		if (card.watermarkLeft == 'default') {
			drawPlacedImage(watermarkContext, watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom, card.watermarkRotate);
		} else {
			watermarkContext.fillStyle = card.watermarkLeft;
			watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
		}
		watermarkContext.globalCompositeOperation = 'destination-in';
		drawPlacedImage(watermarkContext, watermark, scaleX(card.watermarkX), scaleY(card.watermarkY), watermark.width * card.watermarkZoom, watermark.height * card.watermarkZoom, card.watermarkRotate);
		watermarkContext.globalAlpha = card.watermarkOpacity;
		watermarkContext.fillRect(0, 0, watermarkCanvas.width, watermarkCanvas.height);
	}
	drawCard();
}
function resetWatermark() {
	var watermarkZoom;
	if (watermark.width / watermark.height > scaleWidth(card.watermarkBounds.width) / scaleHeight(card.watermarkBounds.height)) {
		watermarkZoom = (scaleWidth(card.watermarkBounds.width) / watermark.width * 100).toFixed(1);
	} else {
		watermarkZoom = (scaleHeight(card.watermarkBounds.height) / watermark.height * 100).toFixed(1);
	}
	document.querySelector('#watermark-zoom').value = watermarkZoom;
	document.querySelector('#watermark-x').value = Math.round(scaleX(card.watermarkBounds.x) - watermark.width * watermarkZoom / 200 - scaleWidth(card.marginX));
	document.querySelector('#watermark-y').value = Math.round(scaleY(card.watermarkBounds.y) - watermark.height * watermarkZoom / 200 - scaleHeight(card.marginY));
	watermarkEdited();
}
//svg cropper
function getSetSymbolWatermark(url, targetImage = watermark) {
	if (!url.includes('/')) {
		url = 'https://cdn.jsdelivr.net/npm/keyrune/svg/' + url + '.svg';
	}
	xhttp = new XMLHttpRequest();
	xhttp.open('GET', url, true);
	xhttp.overrideMimeType('image/svg+xml');
	xhttp.onload = function(event) {
		if (this.readyState == 4 && this.status == 200) {
		    var svg = document.body.appendChild(xhttp.responseXML.documentElement);
		    var box = svg.getBBox(svg);
			svg.setAttribute('viewBox', [box.x, box.y, box.width, box.height].join(' '));
			svg.setAttribute('width', box.width);
			svg.setAttribute('height', box.height);
			uploadWatermark('data:image/svg+xml,' + encodeURIComponent(svg.outerHTML), 'resetWatermark');
			svg.remove();
		} else if (this.status == 404) {
			throw new Error('Improper Set Code');
		}
	}
	xhttp.send();
}
//Bottom Info Tab
async function loadBottomInfo(textObjects = []) {
	await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
	card.bottomInfo = null;
	card.bottomInfo = textObjects;
	await bottomInfoEdited();
	bottomInfoEdited();
}
async function bottomInfoEdited() {
	await bottomInfoContext.clearRect(0, 0, bottomInfoCanvas.width, bottomInfoCanvas.height);
	card.infoNumber = document.querySelector('#info-number').value;
	card.infoRarity = document.querySelector('#info-rarity').value;
	card.infoSet = document.querySelector('#info-set').value;
	card.infoLanguage = document.querySelector('#info-language').value;
	card.infoArtist = document.querySelector('#info-artist').value;
	card.infoYear = document.querySelector('#info-year').value;
	card.infoNote = document.querySelector('#info-note').value;

	if (document.querySelector('#enableCollectorInfo').checked) {
		for (var textObject of Object.entries(card.bottomInfo)) {
			if (["NOT FOR SALE", "Wizards of the Coast", "CardConjurer.com", "cardconjurer.com"].some(v => textObject[1].text.includes(v))) {
				continue;
			} else {
				textObject[1].name = textObject[0];
				await writeText(textObject[1], bottomInfoContext);
			}
			continue;
		}
	}

	drawCard();
}
async function serialInfoEdited() {
	card.serialNumber = document.querySelector('#serial-number').value;
	card.serialTotal = document.querySelector('#serial-total').value;
	card.serialX = document.querySelector('#serial-x').value;
	card.serialY = document.querySelector('#serial-y').value;
	card.serialScale = document.querySelector('#serial-scale').value;

	drawCard();
}

async function resetSerial() {
	card.serialX = scaleX(172/2010);
	card.serialY = scaleY(1383/2814);
	card.serialScale = 1.0;

	document.querySelector('#serial-x').value = card.serialX;
	document.querySelector('#serial-y').value = card.serialY;
	document.querySelector('#serial-scale').value = card.serialScale;

	drawCard();
}

function artistEdited(value) {
	document.querySelector('#art-artist').value = value;
	document.querySelector('#info-artist').value = value;
	bottomInfoEdited();
}
function toggleStarDot() {
	for (var key of Object.keys(card.bottomInfo)) {
		var text = card.bottomInfo[key].text
		if (text.includes('*')) {
			card.bottomInfo[key].text = text.replace('*', ' \u2022 ');
		} else {
			card.bottomInfo[key].text = text.replace(' \u2022 ', '*');
		}
	}
	defaultCollector.starDot = !defaultCollector.starDot;
	bottomInfoEdited();
}
function enableNewCollectorInfoStyle() {
	localStorage.setItem('enableNewCollectorStyle', document.querySelector('#enableNewCollectorStyle').checked);
	setBottomInfoStyle();
	bottomInfoEdited();
}
function enableCollectorInfo() {
	localStorage.setItem('enableCollectorInfo', document.querySelector('#enableCollectorInfo').checked);
	bottomInfoEdited();
}
function enableImportCollectorInfo() {
	localStorage.setItem('enableImportCollectorInfo', document.querySelector('#enableImportCollectorInfo').checked);
}
function setAutoFrame() {
	var value = document.querySelector('#autoFrame').value;
	localStorage.setItem('autoFrame', value);

	if (value !== 'false') {
		document.querySelector('#autoLoadFrameVersion').checked = true;
		localStorage.setItem('autoLoadFrameVersion', 'true');
	}

	autoFrame();
}
function setAutofit() {
	localStorage.setItem('autoFit', document.querySelector('#art-update-autofit').checked);
}
function setPreserveArtPosition() {
	localStorage.setItem('preserveArtPosition', document.querySelector('#art-preserve-position').checked);
}
function removeDefaultCollector() {
	defaultCollector = {}; //{number: year, rarity:'P', setCode:'MTG', lang:'EN', starDot:false};
	localStorage.removeItem('defaultCollector'); //localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}
function setDefaultCollector() {
	starDot = defaultCollector.starDot;
	defaultCollector = {
		number: document.querySelector('#info-number').value,
		rarity: document.querySelector('#info-rarity').value,
		setCode: document.querySelector('#info-set').value,
		lang: document.querySelector('#info-language').value,
		note: document.querySelector('#info-note').value,
		starDot: starDot
	};
	localStorage.setItem('defaultCollector', JSON.stringify(defaultCollector));
}
function drawPlacedImage(context, image, x, y, width, height, rotation) {
	var angle = Number(rotation) || 0;
	if (!angle) {
		context.drawImage(image, x, y, width, height);
		return;
	}
	context.save();
	context.translate(x + width / 2, y + height / 2);
	context.rotate(angle * Math.PI / 180);
	context.drawImage(image, -width / 2, -height / 2, width, height);
	context.restore();
}
function drawSetSymbol(cardContext, setSymbol, bounds) {
	if (!bounds) return;
	var symbolWidth = setSymbol.width * card.setSymbolZoom;
	var symbolHeight = setSymbol.height * card.setSymbolZoom;
	var x = scaleX(card.setSymbolX);
	var y = scaleY(card.setSymbolY);
	var imageToDraw = setSymbol;
	var drawWidth = symbolWidth;
	var drawHeight = symbolHeight;

	if (bounds.outlineWidth && bounds.outlineWidth > 0) {
		var tempCanvas = document.createElement('canvas');
		var tempCtx = tempCanvas.getContext('2d');
		var outlineWidth = scaleHeight(bounds.outlineWidth);
		var margin = outlineWidth * 2;
		tempCanvas.width = symbolWidth + margin;
		tempCanvas.height = symbolHeight + margin;
		tempCtx.strokeStyle = bounds.outlineColor || 'black';
		tempCtx.lineWidth = outlineWidth;
		tempCtx.lineJoin = bounds.lineJoin || 'round';
		tempCtx.lineCap = bounds.lineCap || 'round';
		var outlineSteps = Math.max(8, Math.ceil(outlineWidth * 2));
		for (var index = 0; index < outlineSteps; index++) {
			var angle = (index / outlineSteps) * Math.PI * 2;
			var offsetX = Math.cos(angle) * (outlineWidth / 2);
			var offsetY = Math.sin(angle) * (outlineWidth / 2);
			tempCtx.globalCompositeOperation = 'source-over';
			tempCtx.drawImage(setSymbol, outlineWidth + offsetX, outlineWidth + offsetY, symbolWidth, symbolHeight);
			tempCtx.globalCompositeOperation = 'source-in';
			tempCtx.fillStyle = bounds.outlineColor || 'black';
			tempCtx.fillRect(0, 0, tempCanvas.width, tempCanvas.height);
			tempCtx.globalCompositeOperation = 'destination-over';
		}
		tempCtx.globalCompositeOperation = 'source-over';
		tempCtx.drawImage(setSymbol, outlineWidth, outlineWidth, symbolWidth, symbolHeight);
		imageToDraw = tempCanvas;
		x -= outlineWidth;
		y -= outlineWidth;
		drawWidth = tempCanvas.width;
		drawHeight = tempCanvas.height;
	}
	drawPlacedImage(cardContext, imageToDraw, x, y, drawWidth, drawHeight, card.setSymbolRotate);
}
// DESIGN FRAME LAYOUT HIGHLIGHTS
var activeFrameDesignMode = 'fields';
var layoutHighlightHitAreas = [];
var layoutHighlightDrag = null;
function layoutHighlightEnabled(id) {
	const input = document.querySelector('#' + id);
	return !!input?.checked;
}
function setFrameDesignMode(value) {
	activeFrameDesignMode = value == 'frames' ? 'frames' : 'fields';
	const select = document.querySelector('#frame-design-mode');
	if (select) {
		select.value = activeFrameDesignMode;
	}
	const status = document.querySelector('#frame-design-mode-status');
	if (status) {
		status.textContent = activeFrameDesignMode == 'frames'
			? 'Drag a component label to move it, drag an outlined edge to resize it, or double-click a component on the card to open its frame editor.'
			: 'Drag a field label to move it, drag an outlined edge to resize it, or double-click its label to open its editor.';
	}
	drawCard();
}
function shouldDrawLayoutHighlights() {
	const frameSection = document.querySelector('#creator-menu-frame');
	const hasFieldHighlight = ['layout-highlight-text', 'layout-highlight-art', 'layout-highlight-images', 'layout-highlight-symbols'].some(layoutHighlightEnabled);
	return activeFrameWorkspace == 'design' && frameSection && !frameSection.classList.contains('hidden') &&
		(activeFrameDesignMode == 'frames' || hasFieldHighlight);
}
function previewLayoutBounds(bounds, horizontal = 'left', vertical = 'top') {
	if (!bounds) {
		return null;
	}
	const ratioX = previewCanvas.width / cardCanvas.width;
	const ratioY = previewCanvas.height / cardCanvas.height;
	const width = scaleWidth(Number(bounds.width) || 0) * ratioX;
	const height = scaleHeight(Number(bounds.height) || 0) * ratioY;
	let x = scaleX(Number(bounds.x) || 0) * ratioX;
	let y = scaleY(Number(bounds.y) || 0) * ratioY;
	if (horizontal == 'center') {
		x -= width / 2;
	} else if (horizontal == 'right') {
		x -= width;
	}
	if (vertical == 'center') {
		y -= height / 2;
	} else if (vertical == 'bottom') {
		y -= height;
	}
	return {x:x, y:y, width:width, height:height};
}
function drawLayoutHighlightBox(bounds, color, label, options = {}) {
	const rectangle = previewLayoutBounds(bounds, options.horizontal, options.vertical);
	if (!rectangle || rectangle.width <= 0 || rectangle.height <= 0 ||
		rectangle.x >= previewCanvas.width || rectangle.y >= previewCanvas.height ||
		rectangle.x + rectangle.width <= 0 || rectangle.y + rectangle.height <= 0) {
		return;
	}
	previewContext.save();
	previewContext.strokeStyle = color;
	previewContext.lineWidth = Math.max(2, previewCanvas.width / 500);
	previewContext.setLineDash([8, 5]);
	const rotation = Number(options.rotation) || 0;
	if (rotation) {
		previewContext.translate(rectangle.x + rectangle.width / 2, rectangle.y + rectangle.height / 2);
		previewContext.rotate(rotation * Math.PI / 180);
		previewContext.strokeRect(-rectangle.width / 2, -rectangle.height / 2, rectangle.width, rectangle.height);
	} else {
		previewContext.strokeRect(rectangle.x, rectangle.y, rectangle.width, rectangle.height);
	}
	previewContext.restore();

	const fontSize = Math.max(11, Math.round(previewCanvas.width / 84));
	const padding = 3;
	previewContext.save();
	previewContext.font = 'bold ' + fontSize + 'px sans-serif';
	const labelWidth = Math.min(previewCanvas.width, previewContext.measureText(label).width + padding * 2);
	const labelHeight = fontSize + padding * 2;
	const offsetY = Number(options.labelOffsetY) || 0;
	const labelX = Math.max(0, Math.min(previewCanvas.width - labelWidth, rectangle.x));
	const labelY = Math.max(labelHeight, Math.min(previewCanvas.height, rectangle.y + offsetY));
	previewContext.globalAlpha = 0.92;
	previewContext.fillStyle = color;
	previewContext.fillRect(labelX, labelY - labelHeight, labelWidth, labelHeight);
	previewContext.globalAlpha = 1;
	previewContext.fillStyle = '#101010';
	previewContext.fillText(label, labelX + padding, labelY - padding - 1);
	previewContext.restore();

	if (options.target) {
		layoutHighlightHitAreas.push({
			kind: options.kind || 'field',
			key: options.key || '',
			target: options.target,
			rectangle: rectangle,
			labelRectangle: {x:labelX, y:labelY - labelHeight, width:labelWidth, height:labelHeight},
			horizontal: options.horizontal || 'left',
			vertical: options.vertical || 'top',
			rotation: rotation
		});
	}
}
function drawLayoutHighlights() {
	layoutHighlightHitAreas = [];
	if (!shouldDrawLayoutHighlights()) {
		return;
	}
	if (activeFrameDesignMode == 'frames') {
		const editableFrames = selectedFrame && (card.frames || []).includes(selectedFrame)
			? [selectedFrame]
			: (card.frames || []).slice().reverse();
		editableFrames.forEach((frame, reverseIndex) => {
			frame.bounds = frame.bounds || {x:0, y:0, width:1, height:1};
			const frameIndex = card.frames.indexOf(frame);
			drawLayoutHighlightBox(frame.bounds, '#ff9f43', frame.name || 'Frame Component', {
				kind:'frame',
				target:frame,
				rotation:frame.rotation,
				labelOffsetY:(frameIndex + 1) * Math.max(18, previewCanvas.width / 48)
			});
		});
		return;
	}
	if (layoutHighlightEnabled('layout-highlight-text')) {
		Object.entries(card.text || {}).forEach(item => {
			drawLayoutHighlightBox(item[1], '#43d9ff', item[1].name || item[0], {
				kind:'text', key:item[0], target:item[1], rotation:item[1].rotation
			});
		});
	}
	if (layoutHighlightEnabled('layout-highlight-art')) {
		drawLayoutHighlightBox(card.artBounds, '#52e36f', 'Art', {kind:'art', target:card.artBounds});
	}
	if (layoutHighlightEnabled('layout-highlight-images')) {
		(card.frames || []).filter(frame => frame.csvImageFieldKey).forEach(frame => {
			frame.bounds = frame.bounds || {x:0, y:0, width:1, height:1};
			drawLayoutHighlightBox(frame.bounds, '#ff59d6', frame.csvFieldLabel || frame.name || 'Custom Image', {
				kind:'frame', key:frame.csvImageFieldKey, target:frame, rotation:frame.rotation
			});
		});
	}
	if (layoutHighlightEnabled('layout-highlight-symbols')) {
		if (card.setSymbolBounds) {
			drawLayoutHighlightBox(card.setSymbolBounds, '#ffd34e', 'Set Symbol', {
				kind:'setSymbol', target:card.setSymbolBounds,
				horizontal:card.setSymbolBounds.horizontal, vertical:card.setSymbolBounds.vertical,
				rotation:card.setSymbolRotate
			});
		}
		if (card.watermarkBounds) {
			drawLayoutHighlightBox(card.watermarkBounds, '#ffd34e', 'Watermark', {
				kind:'watermark', target:card.watermarkBounds, horizontal:'center', vertical:'center',
				rotation:card.watermarkRotate
			});
		}
	}
}
function layoutHighlightPoint(event) {
	const rectangle = previewCanvas.getBoundingClientRect();
	return {
		x: (event.clientX - rectangle.left) * previewCanvas.width / rectangle.width,
		y: (event.clientY - rectangle.top) * previewCanvas.height / rectangle.height
	};
}
function pointInsideLayoutRectangle(point, rectangle, padding = 0) {
	return point.x >= rectangle.x - padding && point.x <= rectangle.x + rectangle.width + padding &&
		point.y >= rectangle.y - padding && point.y <= rectangle.y + rectangle.height + padding;
}
function pointInLayoutAreaCoordinates(point, area) {
	var rotation = Number(area && area.rotation) || 0;
	if (!rotation) return point;
	var rectangle = area.rectangle;
	var centerX = rectangle.x + rectangle.width / 2;
	var centerY = rectangle.y + rectangle.height / 2;
	var radians = -rotation * Math.PI / 180;
	var deltaX = point.x - centerX;
	var deltaY = point.y - centerY;
	return {
		x:centerX + deltaX * Math.cos(radians) - deltaY * Math.sin(radians),
		y:centerY + deltaX * Math.sin(radians) + deltaY * Math.cos(radians)
	};
}
function layoutHighlightHit(point, includeInterior = false) {
	for (var index = layoutHighlightHitAreas.length - 1; index >= 0; index--) {
		if (pointInsideLayoutRectangle(point, layoutHighlightHitAreas[index].labelRectangle)) {
			return {area:layoutHighlightHitAreas[index], action:'move'};
		}
	}
	const threshold = Math.max(7, previewCanvas.width / 145);
	for (var areaIndex = layoutHighlightHitAreas.length - 1; areaIndex >= 0; areaIndex--) {
		const area = layoutHighlightHitAreas[areaIndex];
		const rectangle = area.rectangle;
		const localPoint = pointInLayoutAreaCoordinates(point, area);
		if (!pointInsideLayoutRectangle(localPoint, rectangle, threshold)) {
			continue;
		}
		const onLeft = Math.abs(localPoint.x - rectangle.x) <= threshold;
		const onRight = Math.abs(localPoint.x - (rectangle.x + rectangle.width)) <= threshold;
		const onTop = Math.abs(localPoint.y - rectangle.y) <= threshold;
		const onBottom = Math.abs(localPoint.y - (rectangle.y + rectangle.height)) <= threshold;
		const horizontal = onLeft ? 'left' : (onRight ? 'right' : '');
		const vertical = onTop ? 'top' : (onBottom ? 'bottom' : '');
		if (horizontal || vertical) {
			return {area:area, action:[vertical, horizontal].filter(Boolean).join('-')};
		}
		if (includeInterior && pointInsideLayoutRectangle(localPoint, rectangle)) {
			return {area:area, action:'open'};
		}
	}
	return null;
}
function layoutHighlightCursor(action, area) {
	if (action == 'move') return 'move';
	var quarterTurn = Math.round(normalizeRotationDegrees(area && area.rotation) / 90) % 2;
	if (action == 'left' || action == 'right') return quarterTurn ? 'ns-resize' : 'ew-resize';
	if (action == 'top' || action == 'bottom') return quarterTurn ? 'ew-resize' : 'ns-resize';
	if (action == 'top-left' || action == 'bottom-right') return quarterTurn ? 'nesw-resize' : 'nwse-resize';
	if (action == 'top-right' || action == 'bottom-left') return quarterTurn ? 'nwse-resize' : 'nesw-resize';
	return action == 'open' ? 'pointer' : '';
}
function updateAnchoredCoordinate(original, delta, edge, anchor) {
	if (anchor == 'center') {
		return original + delta / 2;
	}
	if ((edge == 'left' || edge == 'top') && anchor != 'right' && anchor != 'bottom') {
		return original + delta;
	}
	if ((edge == 'right' || edge == 'bottom') && (anchor == 'right' || anchor == 'bottom')) {
		return original + delta;
	}
	return original;
}
function applyLayoutHighlightDrag(point) {
	if (!layoutHighlightDrag) {
		return;
	}
	const drag = layoutHighlightDrag;
	var deltaPoint = point;
	var deltaStart = drag.startPoint;
	if (drag.action != 'move' && drag.area.rotation) {
		deltaPoint = pointInLayoutAreaCoordinates(point, drag.area);
		deltaStart = pointInLayoutAreaCoordinates(drag.startPoint, drag.area);
	}
	const deltaX = (deltaPoint.x - deltaStart.x) * cardCanvas.width / previewCanvas.width / card.width;
	const deltaY = (deltaPoint.y - deltaStart.y) * cardCanvas.height / previewCanvas.height / card.height;
	const target = drag.area.kind == 'frame' ? drag.area.target.bounds : drag.area.target;
	const original = drag.original;
	if (drag.action == 'move') {
		target.x = original.x + deltaX;
		target.y = original.y + deltaY;
	} else {
		const minimumWidth = 10 / card.width;
		const minimumHeight = 10 / card.height;
		if (drag.action.includes('left')) {
			target.width = Math.max(minimumWidth, original.width - deltaX);
			target.x = updateAnchoredCoordinate(original.x, deltaX, 'left', drag.area.horizontal);
		} else if (drag.action.includes('right')) {
			target.width = Math.max(minimumWidth, original.width + deltaX);
			target.x = updateAnchoredCoordinate(original.x, deltaX, 'right', drag.area.horizontal);
		}
		if (drag.action.includes('top')) {
			target.height = Math.max(minimumHeight, original.height - deltaY);
			target.y = updateAnchoredCoordinate(original.y, deltaY, 'top', drag.area.vertical);
		} else if (drag.action.includes('bottom')) {
			target.height = Math.max(minimumHeight, original.height + deltaY);
			target.y = updateAnchoredCoordinate(original.y, deltaY, 'bottom', drag.area.vertical);
		}
	}
	if (drag.area.kind == 'frame') {
		drawFrames();
	} else {
		drawCard();
		if (drag.area.kind == 'text') {
			drawTextBuffer();
		}
	}
}
function activateCreatorEditorTab(target) {
	Array.from(document.querySelector('#creator-menu-sections').children).forEach(element => element.classList.add('hidden'));
	document.querySelector('#creator-menu-' + target)?.classList.remove('hidden');
	Array.from(document.querySelector('#creator-menu-tabs').children).forEach(tab => {
		const handler = tab.getAttribute('onclick') || '';
		const selected = handler.includes('"' + target + '"') || handler.includes('`' + target + '`');
		tab.classList.toggle('selected', selected);
	});
	drawCard();
}
function openLayoutHighlightEditor(area) {
	if (!area) {
		return;
	}
	if (area.kind == 'text') {
		const textIndex = Object.keys(card.text || {}).indexOf(area.key);
		if (textIndex >= 0) {
			selectedTextIndex = textIndex;
			activateCreatorEditorTab('text');
			document.querySelector('#text-options')?.children[textIndex]?.click();
			textboxEditor();
		}
		return;
	}
	if (area.kind == 'frame') {
		const frameIndex = card.frames.indexOf(area.target);
		const frameElement = document.querySelector('#frame-list')?.children[frameIndex];
		if (frameElement) {
			frameElementClicked({target:frameElement});
		}
		return;
	}
	if (area.kind == 'art') activateCreatorEditorTab('art');
	if (area.kind == 'setSymbol') activateCreatorEditorTab('setSymbol');
	if (area.kind == 'watermark') activateCreatorEditorTab('watermark');
}
function finishLayoutHighlightDrag(event) {
	if (!layoutHighlightDrag) {
		return;
	}
	const completedDrag = layoutHighlightDrag;
	const area = completedDrag.area;
	layoutHighlightDrag = null;
	if (event?.pointerId !== undefined && previewCanvas.hasPointerCapture?.(event.pointerId)) {
		previewCanvas.releasePointerCapture(event.pointerId);
	}
	if (area.kind == 'text') {
		drawText();
	} else if (area.kind == 'frame') {
		drawFrames();
	} else if (area.kind == 'art' && typeof autoFitArt == 'function') {
		autoFitArt();
	} else if (area.kind == 'setSymbol' && typeof resetSetSymbol == 'function') {
		resetSetSymbol();
	} else if (area.kind == 'watermark' && typeof resetWatermark == 'function') {
		resetWatermark();
	} else {
		drawCard();
	}
	commitDesignUndoSnapshot(completedDrag.undoSnapshot,
		area.kind == 'frame' ? 'Move or resize frame component' : 'Move or resize layout field');
}
function initializeLayoutHighlightInteractions() {
	if (!previewCanvas || previewCanvas.dataset.layoutEditingReady) {
		return;
	}
	previewCanvas.dataset.layoutEditingReady = 'true';
	previewCanvas.addEventListener('pointerdown', event => {
		if (!shouldDrawLayoutHighlights() || event.button != 0) {
			return;
		}
		const point = layoutHighlightPoint(event);
		const hit = layoutHighlightHit(point, false);
		if (!hit) {
			return;
		}
		const bounds = hit.area.kind == 'frame' ? hit.area.target.bounds : hit.area.target;
		layoutHighlightDrag = {
			area:hit.area,
			action:hit.action,
			startPoint:point,
			undoSnapshot:createDesignStateSnapshot(),
			original:{
				x:Number(bounds.x) || 0,
				y:Number(bounds.y) || 0,
				width:Number(bounds.width) || 1,
				height:Number(bounds.height) || 1
			}
		};
		previewCanvas.setPointerCapture?.(event.pointerId);
		event.preventDefault();
	});
	previewCanvas.addEventListener('pointermove', event => {
		const point = layoutHighlightPoint(event);
		if (layoutHighlightDrag) {
			applyLayoutHighlightDrag(point);
			return;
		}
		const hit = shouldDrawLayoutHighlights() ? layoutHighlightHit(point, activeFrameDesignMode == 'frames') : null;
		previewCanvas.style.cursor = layoutHighlightCursor(hit?.action || '', hit?.area);
	});
	previewCanvas.addEventListener('pointerup', finishLayoutHighlightDrag);
	previewCanvas.addEventListener('pointercancel', finishLayoutHighlightDrag);
	previewCanvas.addEventListener('dblclick', event => {
		if (!shouldDrawLayoutHighlights()) {
			return;
		}
		const hit = layoutHighlightHit(layoutHighlightPoint(event), activeFrameDesignMode == 'frames');
		if (hit && (hit.action == 'move' || (activeFrameDesignMode == 'frames' && hit.action == 'open'))) {
			openLayoutHighlightEditor(hit.area);
			event.preventDefault();
		}
	});
}
initializeLayoutHighlightInteractions();
initializeDesignUndoInteractions();

//DRAWING THE CARD (putting it all together)
function drawCard() {
	// reset
	cardContext.globalCompositeOperation = 'source-over';
	cardContext.clearRect(0, 0, cardCanvas.width, cardCanvas.height);
	// art
	cardContext.save();
	const drawnArtWidth = art.width * card.artZoom;
	const drawnArtHeight = art.height * card.artZoom;
	cardContext.translate(
		scaleX(card.artX) + drawnArtWidth / 2,
		scaleY(card.artY) + drawnArtHeight / 2
	);
	cardContext.rotate(Math.PI / 180 * (Number(card.artRotate) || 0));
	if (document.querySelector('#grayscale-art').checked) {
		cardContext.filter='grayscale(1)';
	}
	cardContext.drawImage(art, -drawnArtWidth / 2, -drawnArtHeight / 2, drawnArtWidth, drawnArtHeight);
	cardContext.restore();
	// frame elements
	if (card.version.includes('planeswalker') && typeof planeswalkerPreFrameCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	cardContext.drawImage(frameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerPostFrameCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('planeswalker') && typeof planeswalkerCanvas !== "undefined") {
		cardContext.drawImage(planeswalkerCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('station') && typeof stationPreFrameCanvas !== "undefined") {
		cardContext.drawImage(stationPreFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	if (card.version.toLowerCase().includes('station') && typeof stationPostFrameCanvas !== "undefined") {
		cardContext.drawImage(stationPostFrameCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('qrcode') && typeof qrCodeCanvas !== "undefined") {
		cardContext.drawImage(qrCodeCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} // REMOVE/DELETE PLANESWALKERCANVAS AFTER A FEW WEEKS
	// guidelines
	if (document.querySelector('#show-guidelines').checked) {
		cardContext.drawImage(guidelinesCanvas, scaleX(card.marginX) / 2, scaleY(card.marginY) / 2, cardCanvas.width, cardCanvas.height);
	}
	// watermark
	cardContext.drawImage(watermarkCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	// custom elements for sagas, classes, and dungeons
	if (card.version.toLowerCase().includes('saga') && typeof sagaCanvas !== "undefined") {
		cardContext.drawImage(sagaCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.includes('class') && !card.version.includes('classic') && typeof classCanvas !== "undefined") {
		cardContext.drawImage(classCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	} else if (card.version.toLowerCase().includes('dungeon') && typeof dungeonCanvas !== "undefined") {
		cardContext.drawImage(dungeonCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}
	// text
	cardContext.drawImage(textCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	// set symbol
	if (card.setSymbolBounds) {
		drawSetSymbol(cardContext, setSymbol, card.setSymbolBounds); 
	}
	// serial
	if (card.serialNumber || card.serialTotal) {
		var x = parseInt(card.serialX) || 172;
		var y = parseInt(card.serialY) || 1383;
		var scale = parseFloat(card.serialScale) || 1.0;

		cardContext.drawImage(serial, scaleX(x/2010), scaleY(y/2814), scaleWidth(464/2010) * scale, scaleHeight(143/2814) * scale);

		var number = {
			name:"Number",
			text: '{kerning3}' + card.serialNumber || '',
			x: (x+(30 * scale))/2010,
			y: (y+(52 * scale))/2814,
			width: (190 * scale)/2010,
			height: (55 * scale)/2814,
			oneLine: true,
			font: 'gothambold',
			color: 'white',
			size: (55 * scale)/2010,
			align: 'center'
		};

		var total = {
			name:"Number",
			text: '{kerning3}' + card.serialTotal || '',
			x: (x+(251 * scale))/2010,
			y: (y+(52 * scale))/2814,
			width: (190 * scale)/2010,
			height: (55 * scale)/2814,
			oneLine: true,
			font: 'gothambold',
			color: 'white',
			size: (55 * scale)/2010,
			align: 'center'
		};

		writeText(number, cardContext);
		writeText(total, cardContext);
	}
	// bottom info
	if (card.bottomInfoTranslate) {
		cardContext.save();
		cardContext.rotate(Math.PI / 180 * (card.bottomInfoRotate || 0));
		cardContext.translate(card.bottomInfoTranslate.x || 0, card.bottomInfoTranslate.y || 0);
		cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width * (card.bottomInfoZoom || 1), cardCanvas.height * (card.bottomInfoZoom || 1));
		cardContext.restore();
	} else {
		cardContext.drawImage(bottomInfoCanvas, 0, 0, cardCanvas.width, cardCanvas.height);
	}


	// cutout the corners
	cardContext.globalCompositeOperation = 'destination-out';
	if (!card.noCorners && (card.marginX == 0 && card.marginY == 0)) {
		var w = card.version == 'battle' ? 2100 : getStandardWidth();

		cardContext.drawImage(corner, 0, 0, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, 0, -card.width, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, -card.width, -card.height, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
		cardContext.drawImage(corner, -card.height, 0, scaleWidth(59/w), scaleWidth(59/w));
		cardContext.rotate(Math.PI / 2);
	}
	// show preview
	previewContext.clearRect(0, 0, previewCanvas.width, previewCanvas.height);
	previewContext.drawImage(cardCanvas, 0, 0, previewCanvas.width, previewCanvas.height);
	drawLayoutHighlights();

	if (window.cardDrawingPromiseResolver) {
        window.cardDrawingPromiseResolver();
        window.cardDrawingPromiseResolver = null;
	}
}
//DOWNLOADING
function downloadCard(alt = false, jpeg = false) {
	if (card.infoArtist.replace(/ /g, '') == '' && !card.artSource.includes('/img/blank.png') && !card.artZoom == 0) {
		notify('You must credit an artist before downloading!', 5);
	} else {
		// Prep file information
		var imageDataURL;
		var imageName = getCardName();
		if (jpeg) {
			imageDataURL = cardCanvas.toDataURL('image/jpeg', 0.8);
			imageName = imageName + '.jpg';
		} else {
			imageDataURL = cardCanvas.toDataURL('image/png');
			imageName = imageName + '.png';
		}
		// Download image
		if (alt) {
			const newWindow = window.open('about:blank');
			setTimeout(function(){
				newWindow.document.body.appendChild(newWindow.document.createElement('img')).src = imageDataURL;
				newWindow.document.querySelector('img').style = 'max-height: 100vh; max-width: 100vw;';
				newWindow.document.body.style = 'padding: 0; margin: 0; text-align: center; background-color: #888;';
				newWindow.document.title = imageName;
			}, 0);
		} else {
			const downloadElement = document.createElement('a');
			downloadElement.download = imageName;
			downloadElement.target = '_blank';
			downloadElement.href = imageDataURL;
			document.body.appendChild(downloadElement);
			downloadElement.click();
			downloadElement.remove();
		}
	}
}
async function bulkDownloadZip() {
    // 1. Initial checks for libraries and saved cards.
    if (typeof JSZip === 'undefined') {
        notify('Required library (JSZip) has not loaded yet. Please wait a moment and try again.', 5);
        return;
    }
    const cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
    if (!cardKeys || cardKeys.length === 0) {
        notify('No saved cards found to download.', 3);
        return;
    }

    let fileHandle = null;
    let useStreaming = false;

    // 2. Trigger the file picker immediately to capture the user gesture.
    if (window.showSaveFilePicker) {
        try {
            notify('Please choose a location to save your ZIP file.', 15);
            fileHandle = await window.showSaveFilePicker({
                suggestedName: 'CardConjurer_Bulk.zip',
                types: [{
                    description: 'ZIP file',
                    accept: { 'application/zip': ['.zip'] },
                }],
            });
            useStreaming = true;
        } catch (err) {
            // This error occurs if the user clicks "Cancel" in the save dialog.
            if (err.name === 'AbortError') {
                notify('Save operation cancelled.', 3);
                return; // Exit the function entirely if the user cancels.
            }
            // If another error occurs, fall back to the in-memory method.
            console.error("Could not get file handle, falling back to in-memory method:", err);
        }
    }

    // 3. Save the current state and prepare the zip object.
    notify(`Preparing to process ${cardKeys.length} cards...`, 10);
    const zip = new JSZip();
    const tempKey = '__temp_current_card_state__';
    const cardToSave = JSON.parse(JSON.stringify(card));
    cardToSave.frames.forEach(frame => {
        delete frame.image;
        frame.masks.forEach(mask => delete mask.image);
    });
    localStorage.setItem(tempKey, JSON.stringify(cardToSave));

    // 4. Loop through each saved card to render and add it to the zip object.
    for (const [index, key] of cardKeys.entries()) {
        try {
			notify(`Processing card ${index + 1} of ${cardKeys.length}: ${key}`, 1);

            ImageLoadTracker.start();
            FontLoadTracker.start();
            await loadCard(key);
            drawText();
            
            const imagePromise = ImageLoadTracker.waitForAll();
            const fontPromise = FontLoadTracker.waitForAll();
            await Promise.all([imagePromise, fontPromise]);
            
            await new Promise(resolve => setTimeout(resolve, 50));
            drawCard();
            
            const imageName = getCardName() + '.png';
            const imageData = cardCanvas.toDataURL('image/png').split(',')[1];
            
            zip.file(imageName, imageData, { base64: true });
            console.log(`Zipped: ${imageName}`);

        } catch (error) {
            console.error(`Failed to process and zip card "${key}":`, error);
            notify(`Skipping card "${key}" due to an error.`, 3);
        } finally {
            ImageLoadTracker.stop();
            FontLoadTracker.stop();
        }
    }

    // 5. Generate and save the ZIP file using the appropriate method.
    try {
        if (useStreaming && fileHandle) {
            // Ideal Path: Manually pump the JSZip stream to the WritableStream.
            notify('Saving ZIP file to disk...', 10);
            const writable = await fileHandle.createWritable();

            await new Promise((resolve, reject) => {
                const stream = zip.generateInternalStream({ type: 'uint8array', streamFiles: true });
                
                stream
                    .on('data', (chunk) => { writable.write(chunk).catch(reject); })
                    .on('end', () => { writable.close().then(resolve).catch(reject); })
                    .on('error', (err) => { reject(err); })
                    .resume();
            });
            notify('ZIP file saved successfully!', 5);

        } else {
            // Fallback Path: For browsers without streaming support.
            notify('Streaming not supported. Building ZIP in memory... This may be slow or fail.', 10);
            const content = await zip.generateAsync({ type: 'blob' });
            
            const downloadElement = document.createElement('a');
            downloadElement.href = URL.createObjectURL(content);
            downloadElement.download = 'CardConjurer_Bulk.zip';
            document.body.appendChild(downloadElement);
            downloadElement.click();
            document.body.removeChild(downloadElement);
        }
    } catch (err) {
        console.error('Failed to generate or save ZIP file:', err);
        notify('An error occurred while saving the ZIP file.', 5);
    }
    
    // 6. Restore the user's original card state.
    await loadCard(tempKey);
    localStorage.removeItem(tempKey);
    console.log('Bulk download process finished. User state restored.');
}
//IMPORT/SAVE TAB
function importCard(cardObject) {
	console.log('Import card called with:', cardObject); // Log initial import data
	scryfallCard = cardObject;
	const importIndex = document.querySelector('#import-index');
	importIndex.innerHTML = null;
	var optionIndex = 0;
	cardObject.forEach(card => {
		if (card.type_line && card.type_line != 'Card') {
			var option = document.createElement('option');
			var name = card.printed_name || card.name;
			if (card.flavor_name) {
				name += " (" + card.flavor_name +")";
			} else if (card.printed_name) {
				name += " (" + card.name + ")";
			}
			var title = `${name} `;
			if (document.querySelector('#importAllPrints').checked) {
				title += `(${card.set.toUpperCase()} #${card.collector_number})`;
			} else {
				title += `(${card.type_line})`
			}
			option.innerHTML = title;
			option.value = optionIndex;
			importIndex.appendChild(option);
		}
		optionIndex ++;
	});
	changeCardIndex();
}

async function pasteCardText() {
	try {
    const text = await navigator.clipboard.readText();
    console.log(text);
    const card = scryfallCardFromText(text);
    importCard([card]);
  } catch (err) {
    console.error('Failed to read clipboard text: ', err);
    notify('Clipboard access failed. Did you click the button?');
  }
}

function scryfallCardFromText(text) {
	var lines = text.trim().split("\n");

	if (lines.count == 0) {
  		return {};
	}

	lines = lines.map(item => item.trim()).filter(item => item != "");

  	var name = lines.shift();
  	var manaCost;
  	var manaCostStartIndex = name.indexOf("{");
  	if (manaCostStartIndex > 0) {
  	  manaCost = name.substring(manaCostStartIndex).trim();
  	  name = name.substring(0, manaCostStartIndex).trim();
  	}

 	 var cardObject = {
 	   "name": name,
 	   "lang": "en"
 	 };

 	 if (manaCost !== undefined) {
  	  cardObject.mana_cost = manaCost;
 	 }

  	if (lines.count == 0) {
  	  return cardObject;
  	}

 	 cardObject.type_line = lines.shift().trim();

  if (lines.count == 0) {
    return cardObject;
  }

  var regex = /[0-9+\-*]+\/[0-9+*]+/
  var match = lines[lines.length-1].match(regex);
  if (match) {
    var pt = match[0].split("/");
    cardObject.power = pt[0];
    cardObject.toughness = pt[1];
    lines.pop();
  }

  if (lines.count == 0) {
    return cardObject;
  }

  cardObject.oracle_text = lines.join("\n");

  return cardObject;
}

function parseSagaAbilities(text) {
  const stepsMap = {};

  // Remove reminder text
  const abilityText = text.replace(/^\(.*?\)\s*/, '');

  // Match "I — ability" or "I, II — ability"
  const regex = /([IVX, ]+)\s+—\s+([^]+?)(?=(?:\n[IVX, ]+\s+—|$))/g;

  let match;
  while ((match = regex.exec(abilityText)) !== null) {
    const stepsRaw = match[1].split(',').map(s => s.trim());
    const ability = match[2].trim();

    for (const step of stepsRaw) {
      stepsMap[step] = ability;
    }
  }

  // Lore step order
  const loreOrder = Array.from({ length: 24 }, (_, i) => romanNumeral(i + 1));

  // Track deduplicated abilities in order with count of steps
  const abilityMap = new Map();

  for (const step of loreOrder) {
    const ability = stepsMap[step];
    if (!ability) continue;

    if (abilityMap.has(ability)) {
      abilityMap.get(ability).steps += 1;
    } else {
      abilityMap.set(ability, { ability, steps: 1 });
    }
  }

  return Array.from(abilityMap.values());
}

function extractSagaReminderText(text) {
  const match = text.match(/^\([^)]*\)/);
  return match ? match[0] : null;
}

function parseClassAbilities(text) {
    const lines = text.split('\n'); // Split text into lines
    const abilities = [];
    let reminderText = '';
    let currentLevel = 1;

    // Check if the first line is reminder text
    if (lines[0].startsWith('(')) {
            reminderText = lines.shift(); // Extract reminder text
    }

    // Process each line
    for (let i = 0; i < lines.length; i++) {
            const line = lines[i].trim();

            // Check for "{cost}: Level X" format
            const levelMatch = line.match(/^(\{.*?\}):\s*Level \d+/); // Match cost and level
            if (levelMatch) {
                    const cost = `${levelMatch[1]}:`; // Extract cost (e.g., "{G}")
                    const ability = lines[i + 1]?.trim() || ''; // Get the next line as ability text
                    abilities.push({ cost, ability });
                    i++; // Skip the next line since it's already processed
                    currentLevel++;
            } else if (abilities.length === 0) {
                    // Handle the first level's ability text without "Level" heading
                    abilities.push({ cost: '', ability: line });
            }
    }

    // Prepend reminder text to the first ability if it exists
    if (reminderText && abilities.length > 0) {
            abilities[0].ability = `${reminderText}{lns}{bar}{lns}${abilities[0].ability}`;
    }

    return abilities;
}

function parseMultiFacedCards(card) {
    let [frontFace, backFace] = card.card_faces ?? []
    
    if (card.object === "card_face") {
        // Battle cards: find faces from scryfallCard array
        frontFace = card;
        backFace = scryfallCard.find(face => 
            face.object === "card_face" && 
            face.name !== card.name
        );
    }
    
    if (!frontFace || !backFace) {
        console.error('Could not find both faces for multi-faced card');
        return null;
    }
    
    // Single processing logic for both types
    const faces = {
        front: {
            name: frontFace.name || '',
            type: frontFace.type_line || '',
            rules: frontFace.oracle_text || '',
            mana: frontFace.mana_cost || '',
            pt: frontFace.power ? `${frontFace.power}/${frontFace.toughness}` : '',
            defense: frontFace.defense || '',
            flavor: frontFace.flavor_text || ''
        },
        back: {
            name: backFace.name || '',
            type: backFace.type_line || '',
            rules: backFace.oracle_text || '',
            mana: backFace.mana_cost || '',
            pt: backFace.power ? `${backFace.power}/${backFace.toughness}` : '',
            defense: backFace.defense || '',
            flavor: backFace.flavor_text || ''
        }
    };
    
    return faces;
}

function parseLevelerCard(card) {
    if (card.layout !== 'leveler' || !card.oracle_text) {
        console.error('Not a valid leveler card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Parse the oracle text sections
    const sections = oracleText.split('\n');
    
    // Find level up cost (first line)
    const levelUpMatch = sections[0].match(/Level up (.+?) \((.+?)\)/);
    const levelUpCost = levelUpMatch ? levelUpMatch[1] : '';
    const levelUpReminder = levelUpMatch ? levelUpMatch[2] : '';
    
    // Find level ranges and their content
    const levelSections = [];
    let currentSection = null;
    
    for (let i = 1; i < sections.length; i++) {
        const line = sections[i];
        
        // Check if this line defines a level range
        const levelMatch = line.match(/^LEVEL (.+)$/);
        if (levelMatch) {
            if (currentSection) {
                levelSections.push(currentSection);
            }
            currentSection = {
                levelRange: levelMatch[1],
                content: []
            };
        } else if (currentSection && line.trim()) {
            currentSection.content.push(line);
        }
    }
    
    // Add the last section if it exists
    if (currentSection) {
        levelSections.push(currentSection);
    }
    
    // Extract data for each level
    const parsedData = {
        layout: 'leveler', // Add this line for consistency
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        levelUpCost: levelUpCost,
        levelUpText: `Level up ${levelUpCost} {i}(${levelUpReminder}){/i}`,
        levels: []
    };
    
    // Process each level section
    levelSections.forEach(section => {
        const levelData = {
            range: section.levelRange,
            pt: '',
            abilities: []
        };
        
        // Look for P/T in the content (usually looks like "2/3")
        const ptMatch = section.content.find(line => /^\d+\/\d+$/.test(line.trim()));
        if (ptMatch) {
            levelData.pt = ptMatch.trim();
            // Remove P/T from abilities
            levelData.abilities = section.content.filter(line => line.trim() !== ptMatch.trim());
        } else {
            levelData.abilities = section.content;
        }
        
        // Join abilities into a single text block
        levelData.rulesText = levelData.abilities.join('\n');
        
        parsedData.levels.push(levelData);
    });
    
    return parsedData;
}

function parsePrototypeLayout(card) {
    if (card.layout !== 'prototype' || !card.oracle_text) {
        console.error('Not a valid prototype card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Match the entire prototype line: "Prototype {1}{U}{U} — 2/1 (reminder text)"
    const prototypeMatch = oracleText.match(/^Prototype (.+?) — (\d+)\/(\d+) \((.+?)\)/);
    
    if (!prototypeMatch) {
        console.error('Could not parse prototype information');
        return null;
    }
    
    const prototypeCost = prototypeMatch[1];
    const prototypePower = prototypeMatch[2];
    const prototypeToughness = prototypeMatch[3];
    const prototypeReminder = prototypeMatch[4];
    
    // Split by newlines and remove the first line (which contains the prototype)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();
    
    return {
        layout: 'prototype',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        prototype: {
            cost: prototypeCost,
            pt: `${prototypePower}/${prototypeToughness}`,
            reminderText: `Prototype ${prototypeCost} — ${prototypePower}/${prototypeToughness} {i}(${prototypeReminder}){/i}`
        }
    };
}

function parseMutateLayout(card) {
    if (card.layout !== 'mutate' || !card.oracle_text) {
        console.error('Not a valid mutate card');
        return null;
    }

    const oracleText = card.oracle_text;
    
    // Match the mutate line: "Mutate {3}{B} (reminder text)"
    const mutateMatch = oracleText.match(/^Mutate (.+?) \((.+?)\)/);
    
    if (!mutateMatch) {
        console.error('Could not parse mutate information');
        return null;
    }
    
    const mutateCost = mutateMatch[1];
    const mutateReminder = mutateMatch[2];
    
    // Split by newlines and remove the first line (which contains the mutate)
    const lines = oracleText.split('\n');
    const mainRules = lines.slice(1).join('\n').trim();
    
    return {
        layout: 'mutate',
        name: card.name || '',
        type: card.type_line || '',
        mana: card.mana_cost || '',
        basePT: card.power && card.toughness ? `${card.power}/${card.toughness}` : '',
        rules: mainRules,
        mutate: {
            cost: mutateCost,
            reminderText: `Mutate ${mutateCost} {i}(${mutateReminder}){/i}`
        }
    };
}

function parseVanguardLayout(card) {
    if (card.layout !== 'vanguard' || !card.oracle_text) {
        console.error('Not a valid vanguard card');
        return null;
    }

    return {
        layout: 'vanguard',
        name: card.name || '',
        type: card.type_line || '',
        rules: card.oracle_text || '',
        flavor: card.flavor_text || '',
        handModifier: card.hand_modifier || '',
        lifeModifier: card.life_modifier || ''
    };
}

function parseRollAbilities(text) {
    // Check if this is a roll card
    if (!text.toLowerCase().includes('roll a d20')) {
        return null;
    }

    let modifiedText = text;
    const lines = text.split('\n');
    
    // Skip the first line ("Roll a d20.")
    for (let i = 1; i < lines.length; i++) {
        const line = lines[i].trim();
        
        // Match patterns like "1—9 | ability" or "20 | ability"
        const rollMatch = line.match(/^(\d+(?:—\d+)?)\s*\|\s*(.+)$/);
        if (rollMatch) {
            const range = rollMatch[1];
            const ability = rollMatch[2];
            
            // Replace the line with the roll tag format
            const newLine = `{roll${range}} ${ability}`;
            modifiedText = modifiedText.replace(line, newLine);
        }
    }
    
    return modifiedText;
}

function parseStationCard(oracleText) {
    if (!oracleText || !oracleText.includes('Station')) {
        return null;
    }

    // Split the oracle text by STATION markers to get the pre-station text
    const parts = oracleText.split(/STATION \d+\+/);
    
    // The first part is the pre-station text (before any STATION abilities)
    let preStationText = parts[0].trim();
    
    // Format station reminder text with italics
    preStationText = preStationText.replace(/Station (\([^)]+\))/g, 'Station {i}$1{/i}');
    
    // Updated regex to match new scryfall format: "10+ | ability text"
    const stationRegex = /(\d+\+)\s*\|\s*([^\n]+)/g;
    const stationAbilities = [];
    
    let match;
    while ((match = stationRegex.exec(oracleText)) !== null) {
        stationAbilities.push({
            number: match[1], // e.g., "1+", "8+"
            text: match[2].trim()
        });
    }

    return {
        preStationText: preStationText,
        stationAbilities: stationAbilities
    };
}

function changeCardIndex() {
	let cardToImport = scryfallCard[document.querySelector('#import-index').value];
	// Add debug logging for card Layout detection
	console.log('Card layout:', cardToImport.layout);
	console.log('Card version:', card.version);

	if (cardToImport.set == "plst") {
		var components = cardToImport.collector_number.split('-');
		cardToImport.set = components[0];
		cardToImport.collector_number = components[1];
	}
	// Clear all existing text fields to prevent old data from persisting BUT preserve Multi Face reminder text if we're using a Multi Face frame
	var savedFuseReminderText = '';
	var savedDescriptiveTexts = {};
	if (card.text && card.text.reminder && card.version === 'fuse' || card.version === 'room') {
		savedFuseReminderText = card.text.reminder.text;
	}
	// Save descriptive texts for vanguard
	if (card.text) {
		// Save static descriptive texts that shouldn't be overwritten
		const descriptiveFields = ['left', 'right'];
		descriptiveFields.forEach(field => {
			if (card.text[field] && card.text[field].text) {
				savedDescriptiveTexts[field] = card.text[field].text;
			}
		});
	
		// Clear all text fields
		Object.keys(card.text).forEach(key => {
			card.text[key].text = '';
		});
		
		// Restore descriptive texts
		Object.keys(savedDescriptiveTexts).forEach(field => {
			if (card.text[field]) {
				card.text[field].text = savedDescriptiveTexts[field];
			}
		});
	}

	// Update reminder text from imported card if available
	var importedReminderText = '';
	if (cardToImport.oracle_text) {
		// Extract reminder text from oracle text (text in parentheses)
		var reminderMatch = cardToImport.oracle_text.match(/\([^)]+\)/);
		if (reminderMatch) {
			importedReminderText = reminderMatch[0];
		}
	}

	// Restore reminder text: use imported if available, otherwise use saved
	if (card.text && card.text.reminder && (card.version === 'fuse' || card.version === 'room')) {
		card.text.reminder.text = importedReminderText || savedFuseReminderText;
	}
		
	//text
	var langFontCode = "";
	if (cardToImport.lang == "ph") {langFontCode = "{fontphyrexian}"}
	// Handle Multi Faced Card Layouts
	const multiFacedVersions = ['flip', 'split', 'fuse', 'aftermath', 'adventure', 'omen', 'room', 'battle', 'transform', 'modal', 'prepare'];
	const isMultiFacedVersion = multiFacedVersions.some(keyword => card.version.toLowerCase().includes(keyword));
	if (['flip', 'modal_dfc', 'transform', 'split', 'adventure', 'omen', 'prepare'].includes(cardToImport.layout) && isMultiFacedVersion) {
		const flipData = parseMultiFacedCards(cardToImport);
		if (!flipData) {
			console.error('Failed to parse Multi Faced card data');
			return;
		}
	
		// Add artist info
		if (cardToImport.artist) {
			artistEdited(cardToImport.artist);
		}
	
		// Handle art loading 
		if (cardToImport.image_uris?.art_crop) {
			uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
		}
	
		// Handle set symbol
		if (!document.querySelector('#lockSetSymbolCode').checked) {
			document.querySelector('#set-symbol-code').value = cardToImport.set;
			document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
			if (!document.querySelector('#lockSetSymbolURL').checked) {
			fetchSetSymbol();
			}
		}
	
		// Multi Faced card handling
		// Update text fields based on card version
		//Front Face (standard handling for all multi-faced cards)
		if (card.text?.title && card.text?.mana) {
			card.text.title.text = langFontCode + flipData.front.name;
			card.text.type.text = langFontCode + flipData.front.type; 
			card.text.rules.text = langFontCode + flipData.front.rules;
			if (flipData.front.flavor) {
				card.text.rules.text += '{flavor}' + curlyQuotes(flipData.front.flavor.replace('\n', '{lns}'));
			}
			card.text.mana.text = flipData.front.mana || '';
			
			// Handle PT vs Defense based on card version
			if (card.version === 'battle') {
				// For battles, only the defense field is unique
				if (card.text.defense) {
					card.text.defense.text = flipData.front.defense || '';
				}
			} else {
				// For other multi-faced cards, use standard PT
				if (card.text.pt) {
					card.text.pt.text = flipData.front.pt || '';
				}
			}
		}

		// Handle MDFC cards separately (they use flipsideType and flipSideReminder)
		if (cardToImport.layout === 'modal_dfc' && card.text?.flipsideType && card.text?.flipSideReminder) {
			card.text.flipsideType.text = langFontCode + flipData.back.type;
			card.text.flipSideReminder.text = langFontCode + flipData.back.rules;
		}
		//Back Face (standard handling for other multi-faced cards)
		else if (card.text?.title2 && card.text?.mana2) {
			card.text.title2.text = langFontCode + flipData.back.name;
			// Skip importing back type for room cards AND battle cards
			if (!cardToImport.type_line?.toLowerCase().includes('room')) {
				card.text.type2.text = langFontCode + flipData.back.type;
			}
			card.text.rules2.text = langFontCode + flipData.back.rules;
			if (flipData.back.flavor) {
				card.text.rules2.text += '{flavor}' + curlyQuotes(flipData.back.flavor.replace('\n', '{lns}'));
			}
			card.text.mana2.text = flipData.back.mana || '';
			if (card.text.pt2) {
				card.text.pt2.text = flipData.back.pt || '';
			}
		}
		
		// Handle pt2 for battle and transform front faces (cards without title2/mana2)
		if ((card.version === 'battle' || card.version.includes('transform') || card.version.includes('Transform')) && card.text?.pt2) {
			card.text.pt2.text = flipData.back.pt || '';
		}

		if ((card.version.includes('transform') || card.version.includes('Transform')) && card.text?.reminder && flipData.back.pt) {
			card.text.reminder.text = flipData.back.pt;
		}
	
		textEdited();
	}

	// Handle Unique Layouts (Leveler, Prototype, Mutate, and Vanguard)
	else if (['leveler', 'prototype', 'mutate', 'vanguard'].includes(cardToImport.layout) && ['leveler', 'prototype', 'mutate', 'vanguard'].includes(card.version)) {
		let uniqueData;
		
		if (cardToImport.layout === 'leveler') {
			uniqueData = parseLevelerCard(cardToImport);
		} else if (cardToImport.layout === 'prototype') {
			uniqueData = parsePrototypeLayout(cardToImport);
		} else if (cardToImport.layout === 'mutate') {
			uniqueData = parseMutateLayout(cardToImport);
		} else if (cardToImport.layout === 'vanguard') {
			uniqueData = parseVanguardLayout(cardToImport);
		}

		// Add artist info
		if (cardToImport.artist) {
			artistEdited(cardToImport.artist);
		}

		// Handle art loading 
		if (cardToImport.image_uris?.art_crop) {
			uploadArt(cardToImport.image_uris.art_crop, 'autoFit');
		}

		// Handle set symbol
		if (!document.querySelector('#lockSetSymbolCode').checked) {
			document.querySelector('#set-symbol-code').value = cardToImport.set;
			document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
			if (!document.querySelector('#lockSetSymbolURL').checked) {
				fetchSetSymbol();
			}
		}

		// Populate text fields based on layout
		if (card.text?.title) {
			card.text.title.text = langFontCode + uniqueData.name;
			card.text.type.text = langFontCode + uniqueData.type;
			card.text.mana.text = uniqueData.mana;
			
			// Base P/T
			if (card.text.pt) {
				card.text.pt.text = uniqueData.basePT;
			}
			
			if (uniqueData.layout === 'leveler') {
				card.text.levelup.text = langFontCode + uniqueData.levelUpText;
				
				// Level 1-2 data
				if (uniqueData.levels[0]) {
					const level1Data = uniqueData.levels[0];
					if (card.text.level2) {
						card.text.level2.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level1Data.range}`;
					}
					if (card.text.rules2) {
						card.text.rules2.text = langFontCode + level1Data.rulesText;
					}
					if (card.text.pt2) {
						card.text.pt2.text = level1Data.pt;
					}
				}
				
				// Level 3+ data
				if (uniqueData.levels[1]) {
					const level2Data = uniqueData.levels[1];
					if (card.text.level3) {
						card.text.level3.text = `LEVEL\n{fontsize${scaleHeight(0.0162)}}${level2Data.range}`;
					}
					if (card.text.rules3) {
						card.text.rules3.text = langFontCode + level2Data.rulesText;
					}
					if (card.text.pt3) {
						card.text.pt3.text = level2Data.pt;
					}
				}
			} else if (uniqueData.layout === 'prototype') {
				if (card.text.rules2) {
					card.text.rules2.text = langFontCode + uniqueData.rules;
				}
				if (card.text.prototype) {
					card.text.prototype.text = langFontCode + uniqueData.prototype.reminderText;
				}
				if (card.text.mana2) {
					card.text.mana2.text = uniqueData.prototype.cost;
				}
				if (card.text.pt2) {
					card.text.pt2.text = uniqueData.prototype.pt;
				}
			} else if (uniqueData.layout === 'mutate') {
				if (card.text.rules2) {
					card.text.rules2.text = langFontCode + uniqueData.rules;
				}
				if (card.text.mutate) {
					card.text.mutate.text = langFontCode + uniqueData.mutate.reminderText;
				}
			} else if (uniqueData.layout === 'vanguard') {
				if (card.text.ability) {
					card.text.ability.text = langFontCode + uniqueData.rules;
				}
				if (card.text.flavor) {
					card.text.flavor.text = langFontCode + uniqueData.flavor;
				}
				if (card.text.leftval) {
					card.text.leftval.text = uniqueData.handModifier;
				}
				if (card.text.rightval) {
					card.text.rightval.text = uniqueData.lifeModifier;
				}
			}
		}

		textEdited();
	}

else if (cardToImport.oracle_text && cardToImport.oracle_text.includes('Station') && card.version.includes('station')) {

	// Clear existing station fields
	if (card.text) {
		['ability0', 'ability1', 'ability2'].forEach(field => {
			if (card.text[field]) card.text[field].text = '';
		});
	}
	
	// Clear station badge values immediately
	if (card.station?.badgeValues) {
		card.station.badgeValues[1] = '';
		card.station.badgeValues[2] = '';
	}
	
	const stationData = parseStationCard(cardToImport.oracle_text);
	const name = (cardToImport.printed_name || cardToImport.name || '').replace(/^A-/, '{alchemy}');

	// Populate basic text fields
	const basicFields = [
		['title', curlyQuotes(name)],
		['type', cardToImport.type_line],
		['mana', cardToImport.mana_cost || ''],
		['pt', cardToImport.power && cardToImport.toughness ? `${cardToImport.power}/${cardToImport.toughness}` : '']
	];
	
	basicFields.forEach(([field, value]) => {
		if (card.text?.[field]) card.text[field].text = langFontCode + value;
	});
	
	// Station ability placement logic
	if (stationData) {
		// Better regex to separate pre-text from Station reminder text
		let preText = '';
		let reminderText = '';
		
		if (stationData.preStationText) {
			// Look for Station reminder text (either already italicized or not)
			const stationReminderMatch = stationData.preStationText.match(/(.*?)(Station \{i\}\([^)]+\)\{\/i\}|Station \([^)]+\))/s);
			
			if (stationReminderMatch) {
				preText = stationReminderMatch[1].trim();
				
				// Format the reminder text with italics if not already done
				if (stationReminderMatch[2].includes('{i}')) {
					reminderText = stationReminderMatch[2];
				} else {
					reminderText = stationReminderMatch[2].replace(/Station (\([^)]+\))/, 'Station {i}$1{/i}');
				}
			} else {
				// If no Station reminder found, treat entire text as pre-text
				preText = stationData.preStationText.trim();
			}
		}
		
		const numAbilities = stationData.stationAbilities.length;
		
		// AUTO-CHECK DISABLE FIRST SQUARE FOR SINGLE ABILITIES
		const shouldDisableFirstSquare = numAbilities === 1;
		
		// Define placement scenarios as configuration
		const scenarios = {
			// [hasPreText, numAbilities]: [ability0, ability1, ability2, badgeSlots]
			[false + ',' + 1]: ['', reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
			[true + ',' + 1]: [preText, reminderText, stationData.stationAbilities[0]?.text, [null, stationData.stationAbilities[0]?.number]],
			[false + ',' + 2]: [reminderText, stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]],
			[true + ',' + 2]: [preText + (reminderText ? '\n' + reminderText : ''), stationData.stationAbilities[0]?.text, stationData.stationAbilities[1]?.text, [stationData.stationAbilities[0]?.number, stationData.stationAbilities[1]?.number]]
		};
		
		const scenario = scenarios[Boolean(preText) + ',' + numAbilities];
		if (scenario) {
			const [ability0, ability1, ability2, badges] = scenario;
			
			// Set abilities
			[ability0, ability1, ability2].forEach((text, i) => {
				if (text && card.text[`ability${i}`]) {
					card.text[`ability${i}`].text = langFontCode + text;
				}
			});
			
			// Set disable first square checkbox and station setting
			setTimeout(() => {
				const disableCheckbox = document.querySelector('#station-disable-first-ability');
				if (disableCheckbox) {
					disableCheckbox.checked = shouldDisableFirstSquare;
				}
				if (card.station) {
					card.station.disableFirstAbility = shouldDisableFirstSquare;
				}
				
				// SET STATION-SPECIFIC UI VALUES FOR SINGLE ABILITY IMPORTS
				if (shouldDisableFirstSquare && !Boolean(preText) && card.station?.importSettings?.singleAbility) {
					// Get version-specific settings or fall back to default
					const versionOverrides = card.station.importSettings.versionOverrides || {};
					const versionSettings = versionOverrides[card.version] || card.station.importSettings.singleAbility;
					
					// Set Y offset
					const yOffsetInput = document.querySelector('#station-square-y');
					if (yOffsetInput) {
						yOffsetInput.value = versionSettings.yOffset;
						if (card.station.squares && card.station.squares[1]) {
							card.station.squares[1].y = versionSettings.yOffset + 76;
						}
					}
					
					// Set first square height
					const height1Input = document.querySelector('#station-square-height-1');
					if (height1Input) {
						height1Input.value = versionSettings.height1;
						if (card.station.squares && card.station.squares[1]) {
							card.station.squares[1].height = versionSettings.height1;
						}
					}
				}
		
				
				// Clear DOM inputs first
				['#station-badge-value-1', '#station-badge-value-2'].forEach(selector => {
					const input = document.querySelector(selector);
					if (input) input.value = '';
				});
				
				// Set new badge values
				badges.forEach((badge, i) => {
					if (badge) {
						const input = document.querySelector(`#station-badge-value-${i + 1}`);
						if (input) input.value = badge;
						if (card.station?.badgeValues) card.station.badgeValues[i + 1] = badge;
					}
				});
				
				// Force station redraw after all values are set
				setTimeout(() => {
					if (typeof stationEdited === 'function') {
						stationEdited();
					}
				}, 50);
			}, 100);
		}
	}
	
	textEdited();
}

	var name = cardToImport.printed_name || cardToImport.name || '';
	if (name.startsWith('A-')) { name = name.replace('A-', '{alchemy}'); }

	if (card.text.title) {
		if (card.version == 'wanted') {
			var subtitle = '';
			var index = name.indexOf(', ');

			if (index > 0) {
			  card.text.subtitle.text = langFontCode + curlyQuotes(name.substring(index+2));
			  card.text.title.text = langFontCode + curlyQuotes(name.substring(0, index+1));
			} else {
				card.text.title.text = langFontCode + curlyQuotes(name);
				card.text.subtitle.text = '';
			}
		} else {
			card.text.title.text = langFontCode + curlyQuotes(name);
		}
	}

	if (card.text.nickname) {card.text.nickname.text = cardToImport.flavor_name || '';}
	if (card.text.mana) {card.text.mana.text = cardToImport.mana_cost || '';}
	if (card.text.type) {card.text.type.text = langFontCode + cardToImport.type_line || '';}

	var italicExemptions = ['Boast', 'Cycling', 'Visit', 'Prize', 'I', 'II', 'III', 'IV', 'I, II', 'II, III', 'III, IV', 'I, II, III', 'II, III, IV', 'I, II, III, IV', '• Khans', '• Dragons', '• Mirran', '• Phyrexian', 'Prototype', 'Companion', 'To solve', 'Solved'];
	var italicExemptions = ['Boast', 'Cycling', 'Visit', 'Prize', 'I', 'II', 'III', 'IV', 'I, II', 'II, III', 'III, IV', 'I, II, III', 'II, III, IV', 'I, II, III, IV', '• Khans', '• Dragons', '• Mirran', '• Phyrexian', 'Prototype', 'Companion', 'To solve', 'Solved'];
	if (cardToImport.oracle_text) {
		const hasRoll = cardToImport.oracle_text.toLowerCase().includes('roll a d20');		
		const hasNumberedAbilities = /\d+(?:—\d+)?\s*\|\s*.+/.test(cardToImport.oracle_text);		
		const rollText = parseRollAbilities(cardToImport.oracle_text);
		if (rollText) {
			// Use the modified text with roll tags for further processing
			var rulesText = rollText.replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function(a){
				if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {return a;}
				return '{i}' + a + '{/i}';
			});
		} else {
			// Regular processing for non-roll cards
			var rulesText = (cardToImport.oracle_text || '').replace(/(?:\((?:.*?)\)|[^"\n]+(?= — ))/g, function(a){
				if (italicExemptions.includes(a) || (cardToImport.keywords && cardToImport.keywords.indexOf('Spree') != -1 && a.startsWith('+'))) {return a;}
				return '{i}' + a + '{/i}';
			});
		}
		// Handle loyalty ability brackets - separate from roll handling, applies to ALL cards
		const isCleaveSpell = rulesText.toLowerCase().includes('cleave') || 
							 (cardToImport.keywords && cardToImport.keywords.includes('Cleave'));
		
		if (!isCleaveSpell) {
		// Replace loyalty ability brackets [+1], [-2], etc. with curly brackets
		// Also convert em dash (−) to regular hyphen (-)
		rulesText = rulesText.replace(/\[([+\-−]\d+)\]/g, function(match, number) {
			return '{' + number.replace('\u2212', '-') + '}';
		});
	}
	} else {
		var rulesText = '';
	}
	rulesText = curlyQuotes(rulesText).replace(/{Q}/g, '{untap}').replace(/{\u221E}/g, "{inf}").replace(/• /g, '• {indent}');
	rulesText = rulesText.replace('(If this card is your chosen companion, you may put it into your hand from outside the game for {3} any time you could cast a sorcery.)', '(If this card is your chosen companion, you may put it into your hand from outside the game for {3} as a sorcery.)')

	if (card.text.rules) {
		if (card.version == 'pokemon') {
			if (cardToImport.type_line.toLowerCase().includes('creature')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.middleStatTitle.text = 'power';
				card.text.rightStatTitle.text = 'toughness';

			} else if (cardToImport.type_line.toLowerCase().includes('planeswalker')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.pt.text = '{' + (cardToImport.loyalty || '' + '}');

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = 'loyalty';
			} else if (cardToImport.type_line.toLowerCase().includes('battle')) {
				card.text.rules.text = langFontCode + rulesText;
				card.text.rulesnoncreature.text = '';

				card.text.pt.text = '{' + (cardToImport.defense || '' + '}');

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = 'defense';
			} else {
				card.text.rulesnoncreature.text = langFontCode + rulesText;
				card.text.rules.text = '';

				card.text.middleStatTitle.text = '';
				card.text.rightStatTitle.text = '';
			}

		} else {
			card.text.rules.text = langFontCode + rulesText;
		}

		if (cardToImport.flavor_text) {
			var flavorText = cardToImport.flavor_text;
			var flavorTextCounter = 1;
			while (flavorText.includes('*') || flavorText.includes('"')) {
				if (flavorTextCounter % 2) {
					flavorText = flavorText.replace('*', '{/i}');
					flavorText = flavorText.replace('"', '\u201c');
				} else {
					flavorText = flavorText.replace('*', '{i}');
					flavorText = flavorText.replace('"', '\u201d');
				}
				flavorTextCounter ++;
			}

			if (card.version == 'pokemon') {
				if (cardToImport.type_line.toLowerCase().includes('creature')) {
					card.text.rules.text += '{flavor}';
					card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
				} else {
					card.text.rules.text += '{flavor}';
					card.text.rulesnoncreature.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
				}

			} else {
				card.text.rules.text += '{flavor}';
				card.text.rules.text += curlyQuotes(flavorText.replace('\n', '{lns}'));
			}


		}
	} else if (card.text.case) {
		rulesText = rulesText.replace(/(\r\n|\r|\n)/g, '//{bar}//');
		card.text.case.text = langFontCode + rulesText;
	}

	if (card.text.pt) {
		if (card.version == 'invocation') {
			card.text.pt.text = cardToImport.power + '\n' + cardToImport.toughness || '';
		} else if (card.version == 'pokemon') {
			card.text.middleStat.text = '{' + (cardToImport.power || '') + '}';
			card.text.pt.text = '{' + (cardToImport.toughness || '') + '}';

			if (card.text.middleStat && card.text.middleStat.text == '{}') {card.text.middleStat.text = '';}
		} else {
			card.text.pt.text = cardToImport.power + '/' + cardToImport.toughness || '';
		}
	}
	if (card.text.pt && card.text.pt.text == undefined + '/' + undefined) {card.text.pt.text = '';}
	if (card.text.pt && card.text.pt.text == undefined + '\n' + undefined) {card.text.pt.text = '';}
	if (card.text.pt && card.text.pt.text == '{}') {card.text.pt.text = '';}
	if (card.version.includes('planeswalker')) {
		card.text.loyalty.text = cardToImport.loyalty || '';
		var planeswalkerAbilities = cardToImport.oracle_text.split('\n');
		// Replace loyalty ability brackets [+1], [-2], etc. with curly brackets for each ability
		planeswalkerAbilities = planeswalkerAbilities.map(ability => {
			return ability.replace(/\[([+\-−]\d+)\]/g, function(match, number) {
				return '{' + number.replace('\u2212', '-') + '}';
			});
		});
		while (planeswalkerAbilities.length > 4) {
			var newAbility = planeswalkerAbilities[planeswalkerAbilities.length - 2] + '\n' + planeswalkerAbilities.pop();
			planeswalkerAbilities[planeswalkerAbilities.length - 1] = newAbility;
		}
		for (var i = 0; i < 4; i ++) {
			if (planeswalkerAbilities[i]) {
				var planeswalkerAbility = planeswalkerAbilities[i].replace(': ', 'splitstring').split('splitstring');
				if (!planeswalkerAbility[1]) {
					planeswalkerAbility = ['', planeswalkerAbility[0]];
				}
				card.text['ability' + i].text = planeswalkerAbility[1].replace('(', '{i}(').replace(')', '){/i}');
				if (card.version == 'planeswalkerTall' || card.version == 'planeswalkerCompleated') {
					document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.3572) / planeswalkerAbilities.length);
				} else {
					document.querySelector('#planeswalker-height-' + i).value = Math.round(scaleHeight(0.2915) / planeswalkerAbilities.length);
				}
				document.querySelector('#planeswalker-cost-' + i).value = planeswalkerAbility[0].replace('\u2212', '-');
			} else {
				card.text['ability' + i].text = '';
				document.querySelector('#planeswalker-height-' + i).value = 0;
			}
		}
		planeswalkerEdited();
	} else if (card.version.includes('saga')) {
		if (card.text.rules2) {
			const combinedText = [cardToImport.flavor_text, ...(cardToImport.keywords || [])]
				.filter(Boolean)
				.join('\n');
			card.text.rules2.text = combinedText;
		}
		const abilities = parseSagaAbilities(cardToImport.oracle_text);
		for (let i = 0; i < abilities.length; i++) {
			card.text[`ability${i}`].text = abilities[i].ability.replace('(', '{i}(').replace(')', '){/i}');
		}
		card.text.reminder.text = `{i}${extractSagaReminderText(cardToImport.oracle_text)}{/i}`;
		card.saga = {...card.saga, abilities: abilities.map(a => a.steps).concat(Array.from({ length: 4 - abilities.length}, () => 0)), count: abilities.length};
		updateAbilityHeights()
	} else if (card.version.toLowerCase().includes('class') && !card.version.includes('classicshifted') && typeof classCanvas !== "undefined") {
		if (card.text.flavor) {
			// future support classes with flavor text
			card.text.flavor.text = cardToImport.flavor_text || '';
		}
		const abilities = parseClassAbilities(cardToImport.oracle_text);
		for (let i = 0; i < abilities.length; i++) {
			const { cost, ability } = abilities[i];
			if (cost) {
				card.text[`level${i}a`].text = abilities[i].cost.replace('\u2212', '-');
			}
			if (i !== 0) {
				card.text[`level${i}b`].text = `Level ${i + 1}`;
			}
			card.text[`level${i}c`].text = ability.replace('(', '{i}(').replace(')', '){/i}');
		}
		card.class = {...card.class, abilities: abilities.map(a => a.cost).concat(Array.from({ length: 4 - abilities.length}, () => '')), count: abilities.length};
	} else if (card.version.includes('battle')) {
		card.text.defense.text = cardToImport.defense || '';
	}
	document.querySelector('#text-editor').value = card.text[Object.keys(card.text)[selectedTextIndex]].text;
	document.querySelector('#text-editor-font-size').value = 0;
	//font size
	Object.keys(card.text).forEach(key => {
			card.text[key].fontSize = 0;
		});
	textEdited();
	//collector's info
	if (localStorage.getItem('enableImportCollectorInfo') == 'true') {
		document.querySelector('#info-number').value = cardToImport.collector_number || "";
		document.querySelector('#info-rarity').value = (cardToImport.rarity || "")[0].toUpperCase();
		document.querySelector('#info-set').value = (cardToImport.set || "").toUpperCase();
		document.querySelector('#info-language').value = (cardToImport.lang || "").toUpperCase();
		var setXhttp = new XMLHttpRequest();
		setXhttp.onreadystatechange = function() {
			if (this.readyState == 4 && this.status == 200) {
				var setObject = JSON.parse(this.responseText)
				if (document.querySelector('#enableNewCollectorStyle').checked) {
					var number = document.querySelector('#info-number').value;

					while (number.length < 4) {
						number = '0' + number;
					}

					document.querySelector('#info-number').value = number;

					bottomInfoEdited();
				} else if (setObject.printed_size) {
					var number = document.querySelector('#info-number').value;

					while (number.length < 3) {
						number = '0' + number;
					}

					var printedSize = setObject.printed_size;
					while (printedSize.length < 3) {
						printedSize = '0' + printedSize;
					}

					if (parseInt(number) <= parseInt(printedSize)) {
						document.querySelector('#info-number').value = number + "/" + printedSize;
					} else {
						document.querySelector('#info-number').value = number;
					}


					bottomInfoEdited();
				}
			}
		}
		setXhttp.open('GET', "https://api.scryfall.com/sets/" + cardToImport.set, true);
		try {
			setXhttp.send();
		} catch {
			console.log('Scryfall API search failed.')
		}
	}
	//art
	document.querySelector('#art-name').value = cardToImport.name;
	fetchScryfallData(cardToImport.name, artFromScryfall, 'art');
	if (document.querySelector('#importAllPrints').checked) {
		document.querySelector('#art-index').value = document.querySelector('#import-index').value;
		changeArtIndex();
	}
	//set symbol
	if (!document.querySelector('#lockSetSymbolCode').checked) {
		document.querySelector('#set-symbol-code').value = cardToImport.set;
	}
	document.querySelector('#set-symbol-rarity').value = cardToImport.rarity.slice(0, 1);
	if (!document.querySelector('#lockSetSymbolURL').checked) {
		fetchSetSymbol();
	}
}
function loadAvailableCards(cardKeys = JSON.parse(localStorage.getItem('cardKeys'))) {
	if (!cardKeys) {
		cardKeys = [];
		cardKeys.sort();
		localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
	}
	document.querySelector('#load-card-options').innerHTML = '<option selected="selected" disabled>None selected</option>';
	cardKeys.forEach(item => {
		var cardKeyOption = document.createElement('option');
		cardKeyOption.innerHTML = item;
		document.querySelector('#load-card-options').appendChild(cardKeyOption);
	});
}
function importChanged() {
	var unique = document.querySelector('#importAllPrints').checked ? 'prints' : '';
	fetchScryfallData(document.querySelector("#import-name").value, importCard, unique);
}
function saveCard(saveFromFile) {
	var cardKeys = JSON.parse(localStorage.getItem('cardKeys')) || [];
	var cardKey, cardToSave;
	if (saveFromFile) {
		cardKey = saveFromFile.key;
	} else {
		cardKey = getCardName();
	}
	if (!saveFromFile) {
		cardKey = prompt('Enter the name you would like to save your card under:', cardKey);
		if (!cardKey) {return null;}
	}
	cardKey = cardKey.trim();
	if (cardKeys.includes(cardKey)) {
		if (!confirm('Would you like to overwrite your card previously saved as "' + cardKey + '"?\n(Clicking "cancel" will affix a version number)')) {
			var originalCardKey = cardKey;
			var cardKeyNumber = 1;
			while (cardKeys.includes(cardKey)) {
				cardKey = originalCardKey + ' (' + cardKeyNumber + ')';
				cardKeyNumber ++;
			}
		}
	}
	if (saveFromFile) {
		cardToSave = saveFromFile.data;
	} else {
		cardToSave = JSON.parse(JSON.stringify(card));
		cardToSave.frames.forEach(frame => {
			delete frame.image;
			frame.masks.forEach(mask => delete mask.image);
		});
	}
	try {
		localStorage.setItem(cardKey, JSON.stringify(cardToSave));
		if (!cardKeys.includes(cardKey)) {
			cardKeys.push(cardKey);
			cardKeys.sort();
			localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
			loadAvailableCards(cardKeys);
		}
	} catch (error) {
		notify('You have exceeded your 5MB of local storage, and your card has failed to save. If you would like to continue saving cards, please download all saved cards, then delete all saved cards to free up space.<br><br>Local storage is most often exceeded by uploading large images directly from your computer. If possible/convenient, using a URL avoids the need to save these large images.<br><br>Apologies for the inconvenience.');
	}
}
async function loadCardData(cardData, failureLabel) {
	// Clear the draggable frames, then restore a fresh copy of the supplied card data.
	document.querySelector('#frame-list').innerHTML = null;
	card = cardData ? JSON.parse(JSON.stringify(cardData)) : null;
	selectedFrame = null;
	document.querySelector('#frame-element-editor')?.classList.remove('opened');
	clearDesignUndoHistory();
	if (!card) {
		notify((failureLabel || 'The saved card') + ' failed to load.', 5);
		return false;
	}

	card.frames = card.frames || [];
	card.text = card.text || {};
	card.manaSymbols = card.manaSymbols || [];
	card.orientation = currentCardOrientation();
	card.landscape = card.orientation === 'landscape';
	card.orientationRotation = Number(card.orientationRotation) || 0;
	syncCardOrientationState(card.orientation);

	// Load values from the card into the editor inputs.
	document.querySelector('#info-number').value = card.infoNumber || '';
	document.querySelector('#info-rarity').value = card.infoRarity || '';
	document.querySelector('#info-set').value = card.infoSet || '';
	document.querySelector('#info-language').value = card.infoLanguage || '';
	document.querySelector('#info-note').value = card.infoNote || '';
	document.querySelector('#info-year').value = card.infoYear || date.getFullYear();
	artistEdited(card.infoArtist || '');

	const textKeys = Object.keys(card.text);
	if (textKeys.length) {
		const selectedKey = textKeys[selectedTextIndex] || textKeys[0];
		document.querySelector('#text-editor').value = card.text[selectedKey].text || '';
		document.querySelector('#text-editor-font-size').value = card.text[selectedKey].fontSize || 0;
		loadTextOptions(card.text);
	}

	document.querySelector('#art-x').value = scaleX(card.artX || 0) - scaleWidth(card.marginX || 0);
	document.querySelector('#art-y').value = scaleY(card.artY || 0) - scaleHeight(card.marginY || 0);
	document.querySelector('#art-zoom').value = (card.artZoom || 1) * 100;
	document.querySelector('#art-rotate').value = card.artRotate || 0;
	uploadArt(card.artSource || '/img/blank.png');
	document.querySelector('#setSymbol-x').value = scaleX(card.setSymbolX || 0) - scaleWidth(card.marginX || 0);
	document.querySelector('#setSymbol-y').value = scaleY(card.setSymbolY || 0) - scaleHeight(card.marginY || 0);
	document.querySelector('#setSymbol-zoom').value = (card.setSymbolZoom || 1) * 100;
	if (card.setSymbolFamily) {
		document.querySelector('#set-symbol-code').value = card.setSymbolFamily;
		document.querySelector('#set-symbol-rarity').value = card.setSymbolRarity || card.infoRarity || 'c';
	}
	await uploadSetSymbol(card.setSymbolSource || '/img/blank.png');
	document.querySelector('#watermark-x').value = scaleX(card.watermarkX || 0) - scaleWidth(card.marginX || 0);
	document.querySelector('#watermark-y').value = scaleY(card.watermarkY || 0) - scaleHeight(card.marginY || 0);
	document.querySelector('#watermark-zoom').value = (card.watermarkZoom || 1) * 100;
	document.querySelector('#watermark-opacity').value = (card.watermarkOpacity === undefined ? 0.4 : card.watermarkOpacity) * 100;
	document.getElementById('rounded-corners').checked = !card.noCorners;
	uploadWatermark(card.watermarkSource || '/img/blank.png');
	document.querySelector('#serial-number').value = card.serialNumber || '';
	document.querySelector('#serial-total').value = card.serialTotal || '';
	document.querySelector('#serial-x').value = card.serialX || 0;
	document.querySelector('#serial-y').value = card.serialY || 0;
	document.querySelector('#serial-scale').value = card.serialScale || 1;
	serialInfoEdited();

	// addFrame mutates each supplied frame with its runtime Image objects.
	const framesInLoadOrder = card.frames.slice().reverse();
	for (const frame of framesInLoadOrder) {
		await addFrame([], frame);
	}
	if (card.onload) {
		await loadScript(card.onload);
	}
	for (const manaSymbolScript of card.manaSymbols) {
		await loadScript(manaSymbolScript);
	}

	var canvasesResized = false;
	canvasList.forEach(name => {
		if (window[name + 'Canvas'].width != card.width * (1 + card.marginX) || window[name + 'Canvas'].height != card.height * (1 + card.marginY)) {
			sizeCanvas(name);
			canvasesResized = true;
		}
	});
	if (canvasesResized) {
		drawTextBuffer();
		drawFrames();
		bottomInfoEdited();
		watermarkEdited();
	} else {
		drawFrames();
		bottomInfoEdited();
		watermarkEdited();
	}
	return true;
}
async function loadCard(selectedCardKey) {
	return loadCardData(JSON.parse(localStorage.getItem(selectedCardKey)), selectedCardKey);
}
function deleteCard() {
	var keyToDelete = document.querySelector('#load-card-options').value;
	if (keyToDelete) {
		var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
		cardKeys.splice(cardKeys.indexOf(keyToDelete), 1);
		cardKeys.sort();
		localStorage.setItem('cardKeys', JSON.stringify(cardKeys));
		localStorage.removeItem(keyToDelete);
		loadAvailableCards(cardKeys);
	}
}
function deleteSavedCards() {
	if (confirm('WARNING:\n\nALL of your saved cards will be deleted! If you would like to save these cards, please make sure you have downloaded them first. There is no way to undo this.\n\n(Press "OK" to delete your cards)')) {
		var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
		cardKeys.forEach(key => localStorage.removeItem(key));
		localStorage.setItem('cardKeys', JSON.stringify([]));
		loadAvailableCards([]);
	}
}
async function downloadSavedCards() {
	var cardKeys = JSON.parse(localStorage.getItem('cardKeys'));
	if (cardKeys) {
		var allSavedCards = [];
		cardKeys.forEach(item => {
			allSavedCards.push({key:item, data:JSON.parse(localStorage.getItem(item))});
		});
		var download = document.createElement('a');
		download.href = URL.createObjectURL(new Blob([JSON.stringify(allSavedCards)], {type:'text'}));
		download.download = 'saved-cards.cardconjurer';
		document.body.appendChild(download);
		await download.click();
		download.remove();
	}
}
function uploadSavedCards(event) {
	var reader = new FileReader();
	reader.onload = function () {
		JSON.parse(reader.result).forEach(item => saveCard(item));
	}
	reader.readAsText(event.target.files[0]);
}
//TUTORIAL TAB
function loadTutorialVideo() {
	var video = document.querySelector('.video > iframe');
	if (video.src == '') {
		video.src = 'https://www.youtube-nocookie.com/embed/e4tnOiub41g?rel=0';
	}
}
// GUIDELINES
function drawNewGuidelines() {
	// clear
	guidelinesContext.clearRect(0, 0, guidelinesCanvas.width, guidelinesCanvas.height);
	// set opacity
	guidelinesContext.globalAlpha = 0.25;
	// textboxes
	guidelinesContext.fillStyle = 'blue';
	Object.entries(card.text).forEach(item => {
		guidelinesContext.fillRect(scaleX(item[1].x || 0), scaleY(item[1].y || 0), scaleWidth(item[1].width || 1), scaleHeight(item[1].height || 1));
	});
	// art
	guidelinesContext.fillStyle = 'green';
	guidelinesContext.fillRect(scaleX(card.artBounds.x), scaleY(card.artBounds.y), scaleWidth(card.artBounds.width), scaleHeight(card.artBounds.height));
	// watermark
	guidelinesContext.fillStyle = 'yellow';
	var watermarkWidth = scaleWidth(card.watermarkBounds.width);
	var watermarkHeight = scaleHeight(card.watermarkBounds.height);
	guidelinesContext.fillRect(scaleX(card.watermarkBounds.x) - watermarkWidth / 2, scaleY(card.watermarkBounds.y) - watermarkHeight / 2, watermarkWidth, watermarkHeight);
	// set symbol
	var setSymbolX = scaleX(card.setSymbolBounds.x);
	var setSymbolY = scaleY(card.setSymbolBounds.y);
	var setSymbolWidth = scaleWidth(card.setSymbolBounds.width);
	var setSymbolHeight = scaleHeight(card.setSymbolBounds.height);
	if (card.setSymbolBounds.vertical == 'center') {
		setSymbolY -= setSymbolHeight / 2;
	} else if (card.setSymbolBounds.vertical == 'bottom') {
		setSymbolY -= setSymbolHeight;
	}
	if (card.setSymbolBounds.horizontal == 'center') {
		setSymbolX -= setSymbolWidth / 2;
	} else if (card.setSymbolBounds.horizontal == 'right') {
		setSymbolX -= setSymbolWidth;
	}
	guidelinesContext.fillStyle = 'red';
	guidelinesContext.fillRect(setSymbolX, setSymbolY, setSymbolWidth, setSymbolHeight);
	// grid
	guidelinesContext.globalAlpha = 1;
	guidelinesContext.beginPath();
	guidelinesContext.strokeStyle = 'gray';
	guidelinesContext.lineWidth = 1;
	const boxPadding = 25;
	for (var x = 0; x <= card.width; x += boxPadding) {
		guidelinesContext.moveTo(x, 0);
		guidelinesContext.lineTo(x, card.height);
	}
	for (var y = 0; y <= card.height; y += boxPadding) {
		guidelinesContext.moveTo(0, y);
		guidelinesContext.lineTo(card.width, y);
	}
	guidelinesContext.stroke();
	//center lines
	guidelinesContext.beginPath();
	guidelinesContext.strokeStyle = 'black';
	guidelinesContext.lineWidth = 3;
	guidelinesContext.moveTo(card.width / 2, 0);
	guidelinesContext.lineTo(card.width / 2, card.height);
	guidelinesContext.moveTo(0, card.height / 2);
	guidelinesContext.lineTo(card.width, card.height / 2);
	guidelinesContext.stroke();
	//draw to card
	drawCard();
}
//HIGHLIGHT TRANSPARENCIES
function toggleCardBackgroundColor(highlight) {
	if (highlight) {
		previewCanvas.style["background-color"] = "#ff007fff";
	} else {
		previewCanvas.style["background-color"] = "#0000";
	}
}
//Rounded Corners
function setRoundedCorners(value) {
	card.noCorners = !value;
	drawCard();
}
//Various loaders
function imageURL(url, destination, otherParams) {
	var imageurl = url;
	// If an image URL does not have HTTP in it, assume it's a local file in the repo local_art directory.
	if (!url.includes('http')) {
		imageurl = '/local_art/' + url;
	} else if (params.get('noproxy') != '') {
		//CORS PROXY LINKS
		//Previously: https://cors.bridged.cc/
		imageurl = 'https://corsproxy.io/?url=' + encodeURIComponent(url);
	}
	destination(imageurl, otherParams);
}
async function imageLocal(event, destination, otherParams) {
	var reader = new FileReader();
	reader.onload = function () {
		destination(reader.result, otherParams);
	}
	reader.onerror = function () {
		destination('/img/blank.png', otherParams);
	}
	await reader.readAsDataURL(event.target.files[0]);
}
function loadScript(scriptPath) {
	return new Promise((resolve, reject) => {
	var script = document.createElement('script');
	script.setAttribute('type', 'text/javascript');
	script.onload = resolve;
	script.onerror = function(){
		notify('A script failed to load, likely due to an update. Please reload your page. Sorry for the inconvenience.');
		reject();
	}
	script.setAttribute('src', scriptPath);
	document.querySelectorAll('head')[0].appendChild(script);
	});
}
// Stretchable SVGs
function stretchSVG(frameObject) {
	xhr = new XMLHttpRequest();
	xhr.open('GET', fixUri(frameObject.src), true);
	xhr.overrideMimeType('image/svg+xml');
	xhr.onload = function(e) {
		if (this.readyState == 4 && this.status == 200) {
			frameObject.image.src = 'data:image/svg+xml;charset=utf-8,' + stretchSVGReal((new XMLSerializer).serializeToString(this.responseXML.documentElement), frameObject);
		}
	}
	xhr.send();
}
function stretchSVGReal(data, frameObject) {
	var returnData = data;
	frameObject.stretch.forEach(stretch => {
		const change = stretch.change;
		const targets = stretch.targets;
		const name = stretch.name;
		const oldData = returnData.split(name + '" d="')[1].split('" style=')[0];
		var newData = '';
		const listData = oldData.split(/(?=[clmz])/gi);
		for (i = 0; i < listData.length; i ++) {
			const item = listData[i];
			if (targets.includes(i) || targets.includes(-i)) {
				let sign = 1;
				if (i != 0 && targets.includes(-i)) {sign = -1};
				if (item[0] == 'C' || item[0] == 'c') {
					newCoords = [];
					item.slice(1).split(' ').forEach(pair => {
						coords = pair.split(',');
						newCoords.push((scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1])));
					});
					newData += item[0] + newCoords.join(' ');
				} else {
					const coords = item.slice(1).split(/[, ]/);
					newData += item[0] + (scaleWidth(change[0]) * sign + parseFloat(coords[0])) + ',' + (scaleHeight(change[1]) * sign + parseFloat(coords[1]))
				}
			} else {
				newData += item;
			}
		}
		returnData = returnData.replace(oldData, newData);
	});
	return returnData;
}
function processScryfallCard(card, responseCards) {
	if ('card_faces' in card) {
		card.card_faces.forEach(face => {
			face.set = card.set;
			face.rarity = card.rarity;
			face.collector_number = card.collector_number;
			face.lang = card.lang;
      face.layout = card.layout; // Add layout from parent card
			if (card.lang != 'en' || face.printed_name) {
				face.oracle_text = face.printed_text || face.oracle_text;
				face.name = face.printed_name || face.name;
				face.type_line = face.printed_type_line || face.type_line;
			}
			responseCards.push(face);
			if (!face.image_uris) {
				face.image_uris = card.image_uris;
			}
		});
	} else {
		if (card.lang != 'en' || card.printed_name) {
			card.oracle_text = card.printed_text || card.oracle_text;
			card.name = card.printed_name || card.name;
			card.type_line = card.printed_type_line || card.type_line;
		}
		// Ensure layout is set even for single-faced cards
		if (!card.layout) {
			card.layout = 'normal';
		}
		responseCards.push(card);
	}
}

function fetchScryfallCardByID(scryfallID, callback = console.log) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = [JSON.parse(this.responseText)];
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify(`No card found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
		}
	}
	xhttp.open('GET', 'https://api.scryfall.com/cards/' + scryfallID, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

function fetchScryfallCardByCodeNumber(code, number, callback = console.log) {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = [JSON.parse(this.responseText)];
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify('No card found for ' + code + ' #' + number, 5);
		}
	}
	xhttp.open('GET', 'https://api.scryfall.com/cards/' + code + '/' + number, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

//SCRYFALL STUFF MAY BE CHANGED IN THE FUTURE
function fetchScryfallData(cardName, callback = console.log, unique = '') {
	var xhttp = new XMLHttpRequest();
	xhttp.onreadystatechange = function() {
		if (this.readyState == 4 && this.status == 200) {
			responseCards = [];
			importedCards = JSON.parse(this.responseText).data;
			importedCards.forEach(card => {
				processScryfallCard(card, responseCards);
			});
			callback(responseCards);
		} else if (this.readyState == 4 && this.status == 404 && !unique && cardName != '') {
			notify(`No cards found for "${cardName}" in ${cardLanguageSelect.options[cardLanguageSelect.selectedIndex].text}.`, 5);
		}
	}
	cardLanguageSelect = document.querySelector('#import-language');
	var cardLanguage = `lang%3D${cardLanguageSelect.value}`;
	var uniqueArt = '';
	if (unique) {
		uniqueArt = '&unique=' + unique;
	}
	var url = `https://api.scryfall.com/cards/search?order=released&include_extras=true${uniqueArt}&q=name%3D${cardName.replace(/ /g, '_')}%20${cardLanguage}`;
	xhttp.open('GET', url, true);
	try {
		xhttp.send();
	} catch {
		console.log('Scryfall API search failed.')
	}
}

function toggleTextTag(tag) {
	var element = document.getElementById('text-editor');

	var text = element.value;

	var start = element.selectionStart;
	var end = element.selectionEnd;
	var selection = text.substring(start, end);

	var openTag = '{' + tag + '}';
	var closeTag = '{/' + tag + '}';

	var prefix = text.substring(0, start);
	var suffix = text.substring(end);

	if (prefix.endsWith(openTag) && suffix.startsWith(closeTag)) {
		prefix = prefix.substring(0, prefix.length-openTag.length);
		suffix = suffix.substring(closeTag.length);
	} else if (selection.startsWith(openTag) && selection.endsWith(closeTag)) {
		selection = selection.substring(openTag.length, selection.length-closeTag.length);
	} else {
		selection = openTag + selection + closeTag;
	}

	element.value = prefix + selection + suffix;

	textEdited();
}

function toggleHighRes() {
	localStorage.setItem('high-res', document.querySelector('#high-res').checked);
	drawCard();
}

// INITIALIZATION

// auto load frame version (user defaults)
if (!localStorage.getItem('autoLoadFrameVersion')) {
	localStorage.setItem('autoLoadFrameVersion', document.querySelector('#autoLoadFrameVersion').checked);
}
document.querySelector('#autoLoadFrameVersion').checked = 'true' == localStorage.getItem('autoLoadFrameVersion');
// document.querySelector('#high-res').checked = 'true' == localStorage.getItem('high-res');

// collector info (user defaults)
var defaultCollector = JSON.parse(localStorage.getItem('defaultCollector') || '{}');
if ('number' in defaultCollector) {
	document.querySelector('#info-number').value = defaultCollector.number;
	document.querySelector('#info-note').value = defaultCollector.note;
	document.querySelector('#info-rarity').value = defaultCollector.rarity;
	document.querySelector('#info-set').value = defaultCollector.setCode;
	document.querySelector('#info-language').value = defaultCollector.lang;
	if (defaultCollector.starDot) {setTimeout(function(){defaultCollector.starDot = false; toggleStarDot();}, 500);}
} else {
	document.querySelector('#info-number').value = date.getFullYear();
}
if (!localStorage.getItem('enableImportCollectorInfo')) {
	localStorage.setItem('enableImportCollectorInfo', 'false');
} else {
	document.querySelector('#enableImportCollectorInfo').checked = (localStorage.getItem('enableImportCollectorInfo') == 'true');
}
if (!localStorage.getItem('enableNewCollectorStyle')) {
	localStorage.setItem('enableNewCollectorStyle', 'false');
} else {
	document.querySelector('#enableNewCollectorStyle').checked = (localStorage.getItem('enableNewCollectorStyle') == 'true');
}
if (!localStorage.getItem('enableCollectorInfo')) {
	localStorage.setItem('enableCollectorInfo', 'true');
} else {
	document.querySelector('#enableCollectorInfo').checked = (localStorage.getItem('enableCollectorInfo') == 'true');
}
if (!localStorage.getItem('autoFrame')) {
	localStorage.setItem('autoFrame', 'false');
} else {
	document.querySelector('#autoFrame').value = localStorage.getItem('autoFrame');
}
if (!localStorage.getItem('autoframe-always-nyx')) {
	localStorage.setItem('autoframe-always-nyx', 'false');
}
document.querySelector('#autoframe-always-nyx').checked = localStorage.getItem('autoframe-always-nyx');
if (!localStorage.getItem('autoFit')) {
	localStorage.setItem('autoFit', 'true');
} else {
	document.querySelector('#art-update-autofit').checked = localStorage.getItem('autoFit');
}

// lock set symbol code (user defaults)
if (!localStorage.getItem('lockSetSymbolCode')) {
	localStorage.setItem('lockSetSymbolCode', '');
}
if (localStorage.getItem('set-symbol-source')) {
	document.querySelector('#set-symbol-source').value = localStorage.getItem('set-symbol-source');
}
document.querySelector('#lockSetSymbolCode').checked = '' != localStorage.getItem('lockSetSymbolCode');
if (document.querySelector('#lockSetSymbolCode').checked) {
	document.querySelector('#set-symbol-code').value = localStorage.getItem('lockSetSymbolCode');
	fetchSetSymbol();
}

// lock set symbol url (user defaults)
if (!localStorage.getItem('lockSetSymbolURL')) {
	localStorage.setItem('lockSetSymbolURL', '');
}
document.querySelector('#lockSetSymbolURL').checked = '' != localStorage.getItem('lockSetSymbolURL');
if (document.querySelector('#lockSetSymbolURL').checked) {
	setSymbol.src = localStorage.getItem('lockSetSymbolURL');
}

//bind inputs together
bindInputs('#frame-editor-hsl-hue', '#frame-editor-hsl-hue-slider');
bindInputs('#frame-editor-hsl-saturation', '#frame-editor-hsl-saturation-slider');
bindInputs('#frame-editor-hsl-lightness', '#frame-editor-hsl-lightness-slider');
bindInputs('#show-guidelines', '#show-guidelines-2', true);

// Load / init whatever
syncFrameLayoutTemplateControls();
loadScript('/js/frames/groupStandard-3.js');
loadAvailableCards();
initDraggableArt();
