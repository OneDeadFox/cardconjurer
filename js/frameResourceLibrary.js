(function () {
	'use strict';

	if (window.FrameResourceLibrary) {
		window.FrameResourceLibrary.init();
		return;
	}

	var BUILT_IN_TEXTURES = [
		{id: 'builtin:m15-artifact', name: 'M15 Artifact', src: '/img/textures/m15/artifact.png', builtIn: true},
		{id: 'builtin:m15-black', name: 'M15 Black', src: '/img/textures/m15/black.png', builtIn: true},
		{id: 'builtin:m15-blue', name: 'M15 Blue', src: '/img/textures/m15/blue.png', builtIn: true},
		{id: 'builtin:m15-colorless', name: 'M15 Colorless', src: '/img/textures/m15/colorless.png', builtIn: true},
		{id: 'builtin:m15-green', name: 'M15 Green', src: '/img/textures/m15/green.png', builtIn: true},
		{id: 'builtin:m15-land', name: 'M15 Land', src: '/img/textures/m15/land.png', builtIn: true},
		{id: 'builtin:m15-multicolor', name: 'M15 Multicolor', src: '/img/textures/m15/multicolor.png', builtIn: true},
		{id: 'builtin:m15-red', name: 'M15 Red', src: '/img/textures/m15/red.png', builtIn: true},
		{id: 'builtin:m15-white', name: 'M15 White', src: '/img/textures/m15/white.png', builtIn: true}
	];

	var BUILT_IN_MASKS = [
		{name: 'Left Half', category: 'Split Regions', src: '/img/frames/maskLeftHalf.png', preview: '/img/frames/maskLeftHalfThumb.png'},
		{name: 'Right Half', category: 'Split Regions', src: '/img/frames/maskRightHalf.png', preview: '/img/frames/maskRightHalfThumb.png'},
		{name: 'Top Half', category: 'Split Regions', src: '/img/frames/maskTopHalf.png', preview: '/img/frames/maskTopHalfThumb.png'},
		{name: 'Bottom Half', category: 'Split Regions', src: '/img/frames/maskBottomHalf.png', preview: '/img/frames/maskBottomHalfThumb.png'},
		{name: 'Middle Third', category: 'Split Regions', src: '/img/frames/maskMiddleThird.png', preview: '/img/frames/maskMiddleThirdThumb.png'},
		{name: 'Corner Cutout', category: 'General Shapes', src: '/img/frames/cornerCutout.png', preview: '/img/frames/cornerCutoutThumb.png'},
		{name: 'M15 Battle — Title Bar', category: 'Title Bars', src: '/img/frames/m15/battle/maskTitle.png', preview: '/img/frames/m15/battle/maskTitleThumb.png'},
		{name: 'M15 Battle — Type Line', category: 'Type Lines', src: '/img/frames/m15/battle/maskType.png', preview: '/img/frames/m15/battle/maskTypeThumb.png'},
		{name: 'M15 Battle — Rules Box', category: 'Rules Boxes', src: '/img/frames/m15/battle/maskRules.png', preview: '/img/frames/m15/battle/maskRulesThumb.png'},
		{name: 'M15 Battle — Pinline', category: 'Pinlines', src: '/img/frames/m15/battle/maskPinline.png', preview: '/img/frames/m15/battle/maskPinlineThumb.png'},
		{name: 'M15 Battle — Border', category: 'Borders', src: '/img/frames/m15/battle/maskBorder.png', preview: '/img/frames/m15/battle/maskBorderThumb.png'},
		{name: 'M15 Battle — Defense Box', category: 'Power / Defense', src: '/img/frames/m15/battle/maskDefense.png', preview: '/img/frames/m15/battle/maskDefenseThumb.png'},
		{name: 'M15 Commander Legends — Frame', category: 'Borders', src: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskFrame.png', preview: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskFrameThumb.png'},
		{name: 'M15 Commander Legends — Title Bar', category: 'Title Bars', src: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTitle.png', preview: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTitleThumb.png'},
		{name: 'M15 Commander Legends — Type Line', category: 'Type Lines', src: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskType.png', preview: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTypeThumb.png'},
		{name: 'M15 Commander Legends — Rules Box', category: 'Rules Boxes', src: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskRules.png', preview: '/img/frames/m15/commanderLegends/m15CommanderLegendsMaskRulesThumb.png'},
		{name: 'M15 Legendary Crown', category: 'Crowns', src: '/img/frames/m15/crowns/m15MaskLegendCrown.png', preview: '/img/frames/m15/crowns/m15MaskLegendCrownThumb.png'},
		{name: 'M15 Legendary Crown Pinline', category: 'Pinlines', src: '/img/frames/m15/crowns/m15MaskLegendCrownPinline.png', preview: '/img/frames/m15/crowns/m15MaskLegendCrownPinlineThumb.png'}
	];

	var visibleMasks = [];
	var initialized = false;

	function element(selector) {
		return document.querySelector(selector);
	}

	function setStatus(message, isError) {
		var status = element('#frame-resource-status');
		if (!status) {
			return;
		}
		status.textContent = message;
		status.classList.toggle('csv-import-error', !!isError);
	}

	function assets() {
		if (!window.FrameProjectStore || typeof FrameProjectStore.getAssets !== 'function') {
			return [];
		}
		return FrameProjectStore.getAssets();
	}

	function textureResources() {
		var saved = assets().filter(function (asset) {
			return asset.kind === 'texture' || asset.kind === 'frame';
		});
		return BUILT_IN_TEXTURES.concat(saved);
	}

	function selectedTexture() {
		var select = element('#frame-resource-texture');
		return select && textureResources().find(function (texture) { return texture.id === select.value; });
	}

	function customMaskResources() {
		return assets().filter(function (asset) {
			return asset.kind === 'mask';
		}).map(function (asset) {
			return {
				name: asset.name,
				category: 'Custom Masks',
				assetId: asset.id,
				custom: true
			};
		});
	}

	function maskResources() {
		return BUILT_IN_MASKS.concat(customMaskResources());
	}

	function appendOption(select, value, label) {
		var option = document.createElement('option');
		option.value = value;
		option.textContent = label;
		select.appendChild(option);
	}

	async function setPreview(selector, source, emptyText) {
		var preview = element(selector);
		if (!preview) {
			return;
		}
		preview.innerHTML = '';
		if (!source) {
			var empty = document.createElement('span');
			empty.textContent = emptyText;
			preview.appendChild(empty);
			return;
		}
		var image = document.createElement('img');
		image.alt = '';
		image.src = source;
		image.onerror = function () {
			preview.innerHTML = '';
			var failure = document.createElement('span');
			failure.textContent = 'Preview unavailable';
			preview.appendChild(failure);
		};
		preview.appendChild(image);
	}

	async function selectedTextureSource() {
		var texture = selectedTexture();
		if (!texture) {
			return '';
		}
		return texture.builtIn ? texture.src : FrameProjectStore.getAssetSource(texture.id);
	}

	function selectedMask() {
		var select = element('#frame-resource-mask');
		var index = select ? Number(select.value) : -1;
		return index >= 0 ? visibleMasks[index] : null;
	}

	async function resolveMaskSource(mask, previewOnly) {
		if (!mask) {
			return '';
		}
		if (mask.assetId) {
			return FrameProjectStore.getAssetSource(mask.assetId);
		}
		return previewOnly ? (mask.preview || mask.src) : mask.src;
	}

	async function updateTexturePreview() {
		try {
			await setPreview('#frame-resource-texture-preview', await selectedTextureSource(), 'Import and select a texture');
		} catch (error) {
			setStatus(error.message, true);
		}
	}

	async function updateMaskPreview() {
		try {
			await setPreview('#frame-resource-mask-preview', await resolveMaskSource(selectedMask(), true), 'Select a mask');
		} catch (error) {
			setStatus(error.message, true);
		}
	}

	function renderTextures(selectedId) {
		var select = element('#frame-resource-texture');
		if (!select) {
			return;
		}
		var list = textureResources();
		var previous = selectedId || select.value;
		select.innerHTML = '';
		if (!list.length) {
			appendOption(select, '', 'No imported textures');
			select.disabled = true;
		} else {
			select.disabled = false;
			list.forEach(function (asset) {
				var suffix = asset.builtIn ? ' (built-in)' : (asset.kind === 'texture' ? ' (texture)' : ' (frame image)');
				appendOption(select, asset.id, asset.name + suffix);
			});
			if (list.some(function (asset) { return asset.id === previous; })) {
				select.value = previous;
			}
		}
		updateTexturePreview();
	}

	function renderCategories() {
		var select = element('#frame-resource-mask-category');
		if (!select) {
			return;
		}
		var previous = select.value;
		var categories = Array.from(new Set(maskResources().map(function (mask) { return mask.category; }))).sort();
		select.innerHTML = '';
		appendOption(select, '', 'All mask categories');
		categories.forEach(function (category) { appendOption(select, category, category); });
		if (categories.indexOf(previous) !== -1) {
			select.value = previous;
		}
	}

	function renderMasks() {
		var select = element('#frame-resource-mask');
		if (!select) {
			return;
		}
		var current = selectedMask();
		var category = element('#frame-resource-mask-category');
		var search = element('#frame-resource-mask-search');
		var categoryValue = category ? category.value : '';
		var searchValue = String(search ? search.value : '').trim().toLowerCase();
		visibleMasks = maskResources().filter(function (mask) {
			var categoryMatches = !categoryValue || mask.category === categoryValue;
			var searchMatches = !searchValue || (mask.name + ' ' + mask.category).toLowerCase().indexOf(searchValue) !== -1;
			return categoryMatches && searchMatches;
		});
		select.innerHTML = '';
		if (!visibleMasks.length) {
			appendOption(select, '', 'No masks match this filter');
			select.disabled = true;
		} else {
			select.disabled = false;
			visibleMasks.forEach(function (mask, index) {
				appendOption(select, String(index), mask.name + ' — ' + mask.category);
			});
			var previousIndex = current ? visibleMasks.findIndex(function (mask) {
				return mask.name === current.name && mask.category === current.category;
			}) : -1;
			if (previousIndex >= 0) {
				select.value = String(previousIndex);
			}
		}
		updateMaskPreview();
	}

	function refresh() {
		renderTextures();
		renderCategories();
		renderMasks();
	}

	async function importFiles(fileList, kind) {
		var files = Array.from(fileList || []);
		if (!files.length) {
			return;
		}
		try {
			await FrameProjectStore.importFiles(files, kind);
			refresh();
			setStatus(files.length + ' ' + (kind === 'mask' ? 'mask' : 'texture') + (files.length === 1 ? '' : 's') + ' imported.', false);
		} catch (error) {
			setStatus(error.message, true);
		}
	}

	async function createLayer() {
		var texture = selectedTexture();
		var mask = selectedMask();
		if (!texture) {
			setStatus('Import and select a texture first.', true);
			return;
		}
		if (!mask) {
			setStatus('Select a mask first.', true);
			return;
		}
		if (typeof addFrame !== 'function' || typeof availableFrames === 'undefined') {
			setStatus('Card Conjurer is not ready to add the new layer.', true);
			return;
		}
		try {
			var textureSource = texture.builtIn ? texture.src : await FrameProjectStore.getAssetSource(texture.id);
			var maskSource = await resolveMaskSource(mask, false);
			var frame = {
				name: texture.name + ' — ' + mask.name,
				src: textureSource,
				noThumb: true,
				masks: [],
				bounds: {x: 0, y: 0, width: 1, height: 1},
				opacity: 100
			};
			if (!texture.builtIn) {
				frame.assetId = texture.id;
			}
			var maskDefinition = {name: mask.name, src: maskSource, noThumb: true};
			if (mask.assetId) {
				maskDefinition.assetId = mask.assetId;
			}
			var previousFrameIndex = selectedFrameIndex;
			availableFrames.push(frame);
			selectedFrameIndex = availableFrames.length - 1;
			try {
				await addFrame([maskDefinition]);
			} finally {
				selectedFrameIndex = previousFrameIndex;
			}
			setStatus('Created layer "' + frame.name + '". Click it under Current Frame Layers to edit it.', false);
		} catch (error) {
			setStatus(error.message, true);
		}
	}

	function init() {
		if (!element('#frame-resource-texture')) {
			return;
		}
		if (!initialized) {
			window.addEventListener('frameassetschanged', refresh);
			initialized = true;
		}
		refresh();
	}

	window.FrameResourceLibrary = {
		init: init,
		refresh: refresh,
		importFiles: importFiles,
		filterMasks: renderMasks,
		updateTexturePreview: updateTexturePreview,
		updateMaskPreview: updateMaskPreview,
		createLayer: createLayer,
		builtInMasks: BUILT_IN_MASKS.slice(),
		builtInTextures: BUILT_IN_TEXTURES.slice()
	};

	init();
})();
