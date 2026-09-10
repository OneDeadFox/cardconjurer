(function () {
	'use strict';

	var templateCard = null;
	var artDirectoryHandle = null;
	var activeArtObjectUrl = '';

	function cloneSerializableCard(sourceCard) {
		var cloned = JSON.parse(JSON.stringify(sourceCard));
		(cloned.frames || []).forEach(function (frame) {
			delete frame.image;
			(frame.masks || []).forEach(function (mask) {
				delete mask.image;
			});
		});
		return cloned;
	}

	function hasOwn(object, key) {
		return Object.prototype.hasOwnProperty.call(object, key);
	}

	function isMapped(fields, keys) {
		return keys.some(function (key) { return hasOwn(fields, key); });
	}

	function parseBoolean(value) {
		var normalized = String(value || '').trim().toLowerCase();
		if (!normalized) {
			return false;
		}
		return ['true', 'yes', 'y', '1', 'x'].includes(normalized);
	}


	var frameAliases = {
		m15: 'M15Regular-1',
		regular: 'M15Regular-1',
		m15regular: 'M15Regular-1',
		m15regular1: 'M15Regular-1',
		m15accurate: 'M15RegularNew',
		m15regularaccurate: 'M15RegularNew',
		m15regularnew: 'M15RegularNew',
		universesbeyond: 'UB',
		ub: 'UB',
		ubregular: 'UB',
		borderless: 'Borderless',
		m15borderless: 'Borderless',
		borderlessub: 'BorderlessUB',
		universesbeyondborderless: 'BorderlessUB',
		etched: 'Etched',
		phyrexian: 'Praetors',
		praetors: 'Praetors',
		seventh: 'Seventh',
		seventhedition: 'Seventh',
		'7th': 'Seventh',
		eighth: '8th',
		eighthedition: '8th',
		'8th': '8th',
		extendedart: 'M15BoxTopper',
		m15extendedart: 'M15BoxTopper',
		m15boxtopper: 'M15BoxTopper',
		boxtopper: 'M15BoxTopper',
		m15extendedartshort: 'M15ExtendedArtShort',
		extendedartshort: 'M15ExtendedArtShort',
		fullart: 'FullArtNew',
		fullartaccurate: 'FullArtNew',
		japanshowcase: 'JapanShowcase',
		vault: 'Vault',
		adventure: 'Adventure',
		omen: 'Omen',
		prepare: 'Prepare',
		circuit: 'Circuit',
		m15eighth: 'M15Eighth',
		m15eighthub: 'M15EighthUB'
	};

	function normalizeFrameValue(value) {
		return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	function resolveFrameType(frameType, frameVariant) {
		var typeKey = normalizeFrameValue(frameType);
		var variantKey = normalizeFrameValue(frameVariant);
		var combinedKey = typeKey + variantKey;
		return frameAliases[combinedKey] || frameAliases[typeKey] || frameAliases[variantKey] || '';
	}

	function parseFrameColors(colorValue, identityValue, manaCost) {
		var colorText = String(colorValue || '').trim();
		var normalizedColor = normalizeFrameValue(colorText);
		if (['multi', 'multicolor', 'multicolored', 'multicolour', 'multicoloured'].includes(normalizedColor)) {
			colorText = String(identityValue || manaCost || '');
		} else if (!colorText) {
			colorText = String(manaCost || '');
		}

		if (['colorless', 'colourless', 'artifact', 'land', 'vehicle'].includes(normalizeFrameValue(colorText))) {
			return [];
		}

		var colorNames = {
			w: 'W',
			white: 'W',
			u: 'U',
			blue: 'U',
			b: 'B',
			black: 'B',
			r: 'R',
			red: 'R',
			g: 'G',
			green: 'G'
		};
		var colors = [];
		var tokens = String(colorText).toLowerCase().split(/[^a-z]+/).filter(Boolean);
		tokens.forEach(function (token) {
			if (colorNames[token] && !colors.includes(colorNames[token])) {
				colors.push(colorNames[token]);
			} else if (/^[wubrg]+$/.test(token)) {
				token.toUpperCase().split('').forEach(function (letter) {
					if (!colors.includes(letter)) {
						colors.push(letter);
					}
				});
			}
		});
		return colors;
	}

	async function waitForCardFonts() {
		if (!document.fonts || typeof document.fonts.load !== 'function') {
			return;
		}
		var fonts = ['belerenb', 'belerenbsc', 'mplantin', 'gothammedium'];
		Object.keys(card.text || {}).forEach(function (key) {
			var font = card.text[key] && card.text[key].font;
			if (font && !fonts.includes(font)) {
				fonts.push(font);
			}
		});
		await Promise.all(fonts.map(function (font) {
			return document.fonts.load('16px "' + font + '"');
		}));
		await document.fonts.ready;
	}

	async function waitForFrameImages(callback) {
		if (typeof ImageLoadTracker !== 'undefined') {
			ImageLoadTracker.start();
		}
		try {
			await callback();
			if (typeof ImageLoadTracker !== 'undefined') {
				await ImageLoadTracker.waitForAll();
			}
		} finally {
			if (typeof ImageLoadTracker !== 'undefined') {
				ImageLoadTracker.stop();
			}
		}
		if (typeof drawFrames === 'function') {
			await drawFrames();
		}
	}

	async function restoreCapturedFrames(serializedFrames) {
		if (typeof addFrame !== 'function') {
			return;
		}
		await waitForFrameImages(async function () {
			card.frames = [];
			var frameList = document.querySelector('#frame-list');
			if (frameList) {
				frameList.innerHTML = '';
			}
			for (var frame of (serializedFrames || [])) {
				await addFrame([], JSON.parse(JSON.stringify(frame)));
			}
		});
	}

	async function applyMappedFrame(result) {
		var fields = result.fields;
		var hasFrameRequest = String(fields.frameType || '').trim() || String(fields.frameVariant || '').trim();
		if (!hasFrameRequest) {
			await restoreCapturedFrames(result.card.frames);
			return 'Captured template';
		}

		var resolvedFrameType = resolveFrameType(fields.frameType, fields.frameVariant);
		if (!resolvedFrameType) {
			result.warnings.push('Frame Type "' + (fields.frameType || '') + '" with variant "' +
				(fields.frameVariant || '') + '" is not recognized; the captured frame was retained.');
			await restoreCapturedFrames(result.card.frames);
			return 'Captured template';
		}
		if (typeof autoFrameUnified !== 'function' ||
			(typeof getFrameTypeConfig === 'function' && !getFrameTypeConfig(resolvedFrameType))) {
			result.warnings.push('Automatic frame type "' + resolvedFrameType + '" is unavailable; the captured frame was retained.');
			await restoreCapturedFrames(result.card.frames);
			return 'Captured template';
		}

		var colors = parseFrameColors(fields.color, fields.colorIdentity,
			(card.text.mana && card.text.mana.text) || '');
		await waitForFrameImages(async function () {
			await autoFrameUnified(
				resolvedFrameType,
				colors,
				(card.text.mana && card.text.mana.text) || '',
				(card.text.type && card.text.type.text) || '',
				(card.text.pt && card.text.pt.text) || ''
			);
		});
		result.card.csvImport.resolvedFrameType = resolvedFrameType;
		result.card.csvImport.frameColors = colors;
		return resolvedFrameType;
	}

	function collectMappedRow(csvState, rowIndex) {
		var row = csvState.rows[rowIndex];
		var fields = {};
		var metadata = {};
		var textboxes = {};

		csvState.mappings.forEach(function (target, columnIndex) {
			var value = row[columnIndex] === undefined ? '' : String(row[columnIndex]);
			var header = csvState.headers[columnIndex];

			if (target === 'ignore') {
				return;
			}
			if (target === 'metadata') {
				metadata[header] = value;
				return;
			}
			if (target.indexOf('field:') === 0) {
				fields[target.substring(6)] = value;
				return;
			}
			if (target.indexOf('textbox:') === 0) {
				var textboxKey = target.substring(8);
				if (!textboxes[textboxKey]) {
					textboxes[textboxKey] = [];
				}
				if (value.trim()) {
					textboxes[textboxKey].push(value);
				}
			}
		});

		return {
			fields: fields,
			metadata: metadata,
			textboxes: textboxes,
			sourceRow: rowIndex + 2
		};
	}

	function assembleTypeLine(fields) {
		if (hasOwn(fields, 'typeLine')) {
			return fields.typeLine;
		}

		var supertypes = ['supertype1', 'supertype2', 'supertype3'].map(function (key) {
			return fields[key] || '';
		}).filter(Boolean);
		var cardTypes = ['cardType1', 'cardType2', 'cardType3'].map(function (key) {
			return fields[key] || '';
		}).filter(Boolean);
		var subtypes = ['subtype1', 'subtype2', 'subtype3'].map(function (key) {
			return fields[key] || '';
		}).filter(Boolean);

		var mainTypes = supertypes.concat(cardTypes).join(' ').trim();
		if (subtypes.length) {
			return mainTypes + (mainTypes ? ' — ' : '') + subtypes.join(' ');
		}
		return mainTypes;
	}

	function assembleRules(fields, alternate) {
		var prefix = alternate ? 'altAbility' : 'ability';
		var flavorKey = alternate ? 'altFlavorText' : 'flavorText';
		var paragraphs = [1, 2, 3, 4].map(function (number) {
			return fields[prefix + number] || '';
		}).filter(function (value) {
			return String(value).trim() !== '';
		});
		var result = paragraphs.join('\n');
		var flavor = fields[flavorKey] || '';
		if (String(flavor).trim()) {
			result += (result ? '' : '') + '{flavor}' + flavor;
		}
		return result;
	}

	function assemblePowerToughness(fields, alternate) {
		var powerKey = alternate ? 'altPower' : 'power';
		var toughnessKey = alternate ? 'altToughness' : 'toughness';
		var power = fields[powerKey] || '';
		var toughness = fields[toughnessKey] || '';
		return power || toughness ? power + '/' + toughness : '';
	}

	function setTextbox(cardData, key, value, warnings) {
		if (!cardData.text || !cardData.text[key]) {
			if (String(value || '').trim()) {
				warnings.push('The selected template does not contain the text field "' + key + '".');
			}
			return;
		}
		cardData.text[key].text = value;
	}

	function applyCoreFields(cardData, mapped, warnings) {
		var fields = mapped.fields;

		if (hasOwn(fields, 'name')) {
			setTextbox(cardData, 'title', fields.name, warnings);
		}
		if (hasOwn(fields, 'manaCost')) {
			setTextbox(cardData, 'mana', fields.manaCost, warnings);
		}
		if (isMapped(fields, ['typeLine', 'supertype1', 'supertype2', 'supertype3', 'cardType1', 'cardType2', 'cardType3', 'subtype1', 'subtype2', 'subtype3'])) {
			setTextbox(cardData, 'type', assembleTypeLine(fields), warnings);
		}
		if (isMapped(fields, ['ability1', 'ability2', 'ability3', 'ability4', 'flavorText'])) {
			setTextbox(cardData, 'rules', assembleRules(fields, false), warnings);
		}
		if (isMapped(fields, ['power', 'toughness'])) {
			setTextbox(cardData, 'pt', assemblePowerToughness(fields, false), warnings);
		}
		if (hasOwn(fields, 'loyalty')) {
			setTextbox(cardData, 'loyalty', fields.loyalty, warnings);
		}
		if (hasOwn(fields, 'defense')) {
			setTextbox(cardData, 'defense', fields.defense, warnings);
		}

		if (hasOwn(fields, 'altName')) {
			setTextbox(cardData, 'title2', fields.altName, warnings);
		}
		if (hasOwn(fields, 'altManaCost')) {
			setTextbox(cardData, 'mana2', fields.altManaCost, warnings);
		}
		if (hasOwn(fields, 'altTypeLine')) {
			setTextbox(cardData, 'type2', fields.altTypeLine, warnings);
		}
		if (isMapped(fields, ['altAbility1', 'altAbility2', 'altAbility3', 'altAbility4', 'altFlavorText'])) {
			setTextbox(cardData, 'rules2', assembleRules(fields, true), warnings);
		}
		if (isMapped(fields, ['altPower', 'altToughness'])) {
			setTextbox(cardData, 'pt2', assemblePowerToughness(fields, true), warnings);
		}
	}

	function applyCustomTextboxes(cardData, mapped, warnings) {
		Object.keys(mapped.textboxes).forEach(function (key) {
			var values = mapped.textboxes[key];
			if (!cardData.text || !cardData.text[key]) {
				warnings.push('The custom mapping target "' + key + '" is not present in the captured template.');
				return;
			}
			var customText = values.join('\n');
			var existingText = cardData.text[key].text || '';
			cardData.text[key].text = [existingText, customText].filter(function (value) {
				return String(value).trim() !== '';
			}).join('\n');
		});
	}

	function applyCollectorFields(cardData, fields) {
		if (hasOwn(fields, 'collectorNumber')) {
			cardData.infoNumber = fields.collectorNumber;
		}
		if (hasOwn(fields, 'rarity')) {
			cardData.infoRarity = String(fields.rarity || '').trim().substring(0, 1).toUpperCase();
		}
		if (hasOwn(fields, 'setCode')) {
			cardData.infoSet = String(fields.setCode || '').trim().toUpperCase();
		}
		if (hasOwn(fields, 'language')) {
			cardData.infoLanguage = String(fields.language || '').trim().toUpperCase();
		}
		if (hasOwn(fields, 'year')) {
			cardData.infoYear = fields.year;
		}
		if (hasOwn(fields, 'artist')) {
			cardData.infoArtist = fields.artist;
		}
	}

	function buildCard(rowIndex) {
		if (!templateCard) {
			throw new Error('Capture the current card as a batch template first.');
		}

		var csvState = CSVImporter.getState();
		var mapped = collectMappedRow(csvState, rowIndex);
		var builtCard = cloneSerializableCard(templateCard);
		var warnings = [];

		applyCoreFields(builtCard, mapped, warnings);
		applyCustomTextboxes(builtCard, mapped, warnings);
		applyCollectorFields(builtCard, mapped.fields);

		builtCard.csvImport = {
			sourceRow: mapped.sourceRow,
			chunk: mapped.fields.chunk || '',
			cardId: mapped.fields.cardId || '',
			frameType: mapped.fields.frameType || '',
			frameVariant: mapped.fields.frameVariant || '',
			template: mapped.fields.template || '',
			outputFilename: mapped.fields.outputFilename || '',
			transform: parseBoolean(mapped.fields.transform),
			flip: parseBoolean(mapped.fields.flip),
			color: mapped.fields.color || '',
			colorIdentity: mapped.fields.colorIdentity || '',
			metadata: mapped.metadata
		};

		return {
			card: builtCard,
			fields: mapped.fields,
			warnings: warnings
		};
	}

	function setInputValue(selector, value) {
		var input = document.querySelector(selector);
		if (input) {
			input.value = value === undefined || value === null ? '' : value;
		}
	}

	function setArtFolderStatus(message) {
		var status = document.querySelector('#csv-art-folder-status');
		if (status) {
			status.textContent = message;
		}
	}

	async function selectArtFolder() {
		if (typeof window.showDirectoryPicker !== 'function') {
			setArtFolderStatus('This browser does not support folder selection. Use a current version of Edge or Chrome.');
			return;
		}
		try {
			var selectedHandle = await window.showDirectoryPicker({mode: 'read'});
			artDirectoryHandle = selectedHandle;
			setArtFolderStatus('Selected art folder: ' + selectedHandle.name + '. This permission lasts for this browser session.');
		} catch (error) {
			if (error && error.name === 'AbortError') {
				setArtFolderStatus(artDirectoryHandle ?
					'Folder selection canceled. Still using: ' + artDirectoryHandle.name + '.' :
					'Folder selection canceled. No art folder selected.');
				return;
			}
			console.error('Unable to select the CSV art folder:', error);
			setArtFolderStatus('The art folder could not be opened: ' + (error.message || 'unknown error') + '.');
		}
	}

	function normalizeArtPath(fileName) {
		var normalized = String(fileName || '').trim().replace(/\\/g, '/').replace(/^\/+|\/+$/g, '');
		if (!normalized) {
			return [];
		}
		var parts = normalized.split('/').filter(Boolean);
		if (parts.some(function (part) { return part === '.' || part === '..'; })) {
			throw new Error('Art File paths cannot contain "." or ".." folders.');
		}
		return parts;
	}

	async function getSelectedArtFile(fileName) {
		if (!artDirectoryHandle) {
			throw new Error('Select an art folder before using the Art File column.');
		}
		var parts = normalizeArtPath(fileName);
		if (!parts.length) {
			throw new Error('The Art File value is blank.');
		}
		var currentDirectory = artDirectoryHandle;
		for (var index = 0; index < parts.length - 1; index++) {
			currentDirectory = await currentDirectory.getDirectoryHandle(parts[index]);
		}
		var fileHandle = await currentDirectory.getFileHandle(parts[parts.length - 1]);
		return fileHandle.getFile();
	}

	async function resolveMappedArt(fields, fallbackSource) {
		var artUrl = String(fields.artUrl || '').trim();
		if (artUrl) {
			return {
				source: artUrl,
				autoFit: true,
				objectUrl: false,
				label: 'Art URL'
			};
		}

		var artFileName = String(fields.artFile || '').trim();
		if (artFileName) {
			var file;
			try {
				file = await getSelectedArtFile(artFileName);
			} catch (error) {
				if (error && error.name === 'NotFoundError') {
					throw new Error('Art file "' + artFileName + '" was not found in "' + artDirectoryHandle.name + '".');
				}
				throw error;
			}
			if (file.type && file.type.indexOf('image/') !== 0) {
				throw new Error('Art file "' + artFileName + '" is not a recognized image.');
			}
			return {
				source: URL.createObjectURL(file),
				autoFit: true,
				objectUrl: true,
				label: 'Art File: ' + artFileName
			};
		}

		return {
			source: fallbackSource || '/img/blank.png',
			autoFit: false,
			objectUrl: false,
			label: 'Captured template art'
		};
	}

	async function waitForImage(image, label) {
		if (!image) {
			return;
		}
		if (image.complete) {
			if (!image.naturalWidth) {
				throw new Error((label || 'Artwork') + ' could not be loaded.');
			}
			if (typeof image.decode === 'function') {
				try {
					await image.decode();
				} catch (error) {
					throw new Error((label || 'Artwork') + ' could not be decoded.');
				}
			}
			return;
		}
		await new Promise(function (resolve, reject) {
			var cleanup = function () {
				image.removeEventListener('load', loaded);
				image.removeEventListener('error', failed);
			};
			var loaded = function () {
				cleanup();
				resolve();
			};
			var failed = function () {
				cleanup();
				reject(new Error((label || 'Artwork') + ' could not be loaded.'));
			};
			image.addEventListener('load', loaded);
			image.addEventListener('error', failed);
		});
	}

	async function applyMappedArt(result) {
		if (typeof uploadArt !== 'function' || typeof art === 'undefined') {
			return;
		}
		['artX', 'artY', 'artZoom', 'artRotate', 'artBounds', 'artSource'].forEach(function (key) {
			if (hasOwn(result.card, key)) {
				card[key] = JSON.parse(JSON.stringify(result.card[key]));
			}
		});

		var resolvedArt = await resolveMappedArt(result.fields, result.card.artSource);
		var nextObjectUrl = resolvedArt.objectUrl ? resolvedArt.source : '';
		try {
			uploadArt(resolvedArt.source, resolvedArt.autoFit ? 'autoFit' : '');
			await waitForImage(art, resolvedArt.label);
		} catch (error) {
			if (nextObjectUrl) {
				URL.revokeObjectURL(nextObjectUrl);
			}
			throw error;
		}

		if (activeArtObjectUrl && activeArtObjectUrl !== nextObjectUrl) {
			URL.revokeObjectURL(activeArtObjectUrl);
		}
		activeArtObjectUrl = nextObjectUrl;
		result.appliedArt = resolvedArt.label;

		setInputValue('#art-x', scaleX(card.artX) - scaleWidth(card.marginX || 0));
		setInputValue('#art-y', scaleY(card.artY) - scaleHeight(card.marginY || 0));
		setInputValue('#art-zoom', (card.artZoom || 1) * 100);
		setInputValue('#art-rotate', card.artRotate || 0);
	}

	async function applyPreviewToCurrentCard(result) {
		var previewText = JSON.parse(JSON.stringify(result.card.text));
		card.text = card.text || {};
		Object.keys(previewText).forEach(function (key) {
			if (card.text[key]) {
				card.text[key].text = previewText[key].text;
			} else {
				card.text[key] = previewText[key];
			}
		});
		card.csvImport = JSON.parse(JSON.stringify(result.card.csvImport));

		['infoNumber', 'infoRarity', 'infoSet', 'infoLanguage', 'infoYear', 'infoArtist'].forEach(function (key) {
			if (hasOwn(result.card, key)) {
				card[key] = result.card[key];
			}
		});

		setInputValue('#info-number', card.infoNumber);
		setInputValue('#info-rarity', card.infoRarity);
		setInputValue('#info-set', card.infoSet);
		setInputValue('#info-language', card.infoLanguage);
		setInputValue('#info-year', card.infoYear);
		setInputValue('#info-artist', card.infoArtist);
		setInputValue('#art-artist', card.infoArtist);

		var selectedKey = Object.keys(card.text)[selectedTextIndex] || Object.keys(card.text)[0];
		if (selectedKey) {
			setInputValue('#text-editor', card.text[selectedKey].text || '');
			setInputValue('#text-editor-font-size', card.text[selectedKey].fontSize || 0);
		}

		await applyMappedArt(result);
		await waitForCardFonts();
		result.appliedFrameType = await applyMappedFrame(result);

		if (typeof bottomInfoEdited === 'function') {
			await bottomInfoEdited();
		}
		if (typeof drawText === 'function') {
			await drawText();
		} else if (typeof drawTextBuffer === 'function') {
			drawTextBuffer();
		} else if (typeof drawCard === 'function') {
			drawCard();
		}
	}


	function shouldIncludeRow(fields) {
		if (!hasOwn(fields, 'include') || String(fields.include || '').trim() === '') {
			return true;
		}
		var value = String(fields.include).trim().toLowerCase();
		return !['false', 'no', 'n', '0', 'off', 'exclude', 'skip'].includes(value);
	}

	function sanitizeBaseName(value, fallback) {
		var safe = String(value || '').trim()
			.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '_')
			.replace(/[. ]+$/g, '')
			.replace(/\s+/g, ' ');
		if (!safe) {
			safe = fallback;
		}
		if (/^(con|prn|aux|nul|com[1-9]|lpt[1-9])$/i.test(safe)) {
			safe = '_' + safe;
		}
		return safe.substring(0, 120);
	}

	function uniqueFileName(baseName, extension, usedNames) {
		var candidate = baseName + extension;
		var number = 2;
		while (usedNames[candidate.toLowerCase()]) {
			candidate = baseName + ' (' + number + ')' + extension;
			number++;
		}
		usedNames[candidate.toLowerCase()] = true;
		return candidate;
	}

	function canvasToBlob(canvas) {
		return new Promise(function (resolve, reject) {
			canvas.toBlob(function (blob) {
				if (blob) {
					resolve(blob);
				} else {
					reject(new Error('The rendered card could not be converted to PNG.'));
				}
			}, 'image/png');
		});
	}

	function downloadBlob(blob, fileName) {
		var link = document.createElement('a');
		var url = URL.createObjectURL(blob);
		link.href = url;
		link.download = fileName;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function () {
			URL.revokeObjectURL(url);
		}, 30000);
	}

	async function writeBlobToDirectory(directoryHandle, fileName, blob) {
		var fileHandle = await directoryHandle.getFileHandle(fileName, {create: true});
		var writable = await fileHandle.createWritable();
		await writable.write(blob);
		await writable.close();
	}

	async function renderBatchCard(job) {
		await applyPreviewToCurrentCard(job.result);
		await new Promise(function (resolve) {
			requestAnimationFrame(function () {
				requestAnimationFrame(resolve);
			});
		});
		if (typeof drawCard === 'function') {
			drawCard();
		}
		return canvasToBlob(cardCanvas);
	}

	async function exportBatch() {
		var status = document.querySelector('#csv-batch-status');
		var progress = document.querySelector('#csv-batch-progress');
		var button = document.querySelector('#csv-batch-export');
		var validationErrors = CSVImporter.getValidationErrors();

		if (validationErrors.length) {
			status.textContent = 'Resolve the CSV validation issues before exporting.';
			return;
		}
		if (!templateCard) {
			status.textContent = 'Capture the current card as a batch template before exporting.';
			return;
		}
		if (typeof JSZip === 'undefined') {
			status.textContent = 'The offline ZIP library did not load. Reload the page and try again.';
			return;
		}

		var csvState = CSVImporter.getState();
		var chunks = new Map();
		var totalCards = 0;
		for (var rowIndex = 0; rowIndex < csvState.rows.length; rowIndex++) {
			var result = buildCard(rowIndex);
			if (!shouldIncludeRow(result.fields)) {
				continue;
			}
			var chunkName = String(result.fields.chunk || '').trim() || 'Unassigned';
			if (!chunks.has(chunkName)) {
				chunks.set(chunkName, []);
			}
			chunks.get(chunkName).push({rowIndex: rowIndex, result: result});
			totalCards++;
		}
		if (!totalCards) {
			status.textContent = 'No CSV rows are marked for inclusion.';
			return;
		}

		var directoryHandle = null;
		var usesFolderPicker = typeof window.showDirectoryPicker === 'function';
		if (usesFolderPicker) {
			try {
				status.textContent = 'Choose the folder where the chunk ZIP files should be saved.';
				directoryHandle = await window.showDirectoryPicker({mode: 'readwrite'});
			} catch (error) {
				if (error && error.name === 'AbortError') {
					status.textContent = 'Batch export canceled.';
					return;
				}
				console.warn('Folder picker unavailable; using browser downloads instead.', error);
				usesFolderPicker = false;
			}
		}

		button.disabled = true;
		progress.max = totalCards;
		progress.value = 0;
		var completed = 0;
		var failedCards = [];
		var usedZipNames = {};
		var selectedRow = document.querySelector('#csv-card-preview-row');
		var selectedRowIndex = selectedRow && selectedRow.value !== '' ? Number(selectedRow.value) : null;

		try {
			for (var chunkEntry of chunks.entries()) {
				var rawChunkName = chunkEntry[0];
				var jobs = chunkEntry[1];
				var zip = new JSZip();
				var usedCardNames = {};
				var addedCards = 0;

				for (var job of jobs) {
					var displayName = job.result.fields.name || 'Row ' + (job.rowIndex + 2);
					status.textContent = 'Rendering ' + (completed + 1) + ' of ' + totalCards + ': ' + displayName + '…';
					try {
						var pngBlob = await renderBatchCard(job);
						var requestedName = job.result.fields.outputFilename || displayName;
						requestedName = String(requestedName).replace(/\.png$/i, '');
						var safeCardName = sanitizeBaseName(requestedName, 'Card-' + (job.rowIndex + 2));
						var pngName = uniqueFileName(safeCardName, '.png', usedCardNames);
						zip.file(pngName, pngBlob);
						addedCards++;
					} catch (error) {
						console.error('CSV batch row failed:', job.rowIndex + 2, error);
						failedCards.push(displayName + ': ' + (error.message || 'render failed'));
					}
					completed++;
					progress.value = completed;
				}

				if (addedCards) {
					status.textContent = 'Packaging ' + rawChunkName + '.zip…';
					var zipBlob = await zip.generateAsync({type: 'blob', compression: 'STORE'});
					var safeChunkName = sanitizeBaseName(rawChunkName, 'Unassigned');
					var zipName = uniqueFileName(safeChunkName, '.zip', usedZipNames);
					if (usesFolderPicker && directoryHandle) {
						await writeBlobToDirectory(directoryHandle, zipName, zipBlob);
					} else {
						downloadBlob(zipBlob, zipName);
						await new Promise(function (resolve) { setTimeout(resolve, 300); });
					}
				}
			}

			if (selectedRowIndex !== null) {
				await applyPreviewToCurrentCard(buildCard(selectedRowIndex));
			}
			var resultMessage = 'Finished: ' + (totalCards - failedCards.length) + ' card(s) exported across ' +
				chunks.size + ' ZIP file(s).';
			if (failedCards.length) {
				resultMessage += ' Failed: ' + failedCards.join(', ') + '.';
			}
			if (!usesFolderPicker && chunks.size > 1) {
				resultMessage += ' If Edge blocked some ZIPs, allow multiple downloads and run the export again.';
			}
			status.textContent = resultMessage;
		} catch (error) {
			console.error('CSV batch export failed:', error);
			status.textContent = error.message || 'CSV batch export failed.';
		} finally {
			button.disabled = false;
		}
	}

	function getNameColumn(csvState) {
		return csvState.mappings.indexOf('field:name');
	}

	function csvChanged() {
		var csvState = CSVImporter.getState();
		var selector = document.querySelector('#csv-card-preview-row');
		if (!selector) {
			return;
		}

		selector.innerHTML = '';
		var nameColumn = getNameColumn(csvState);
		csvState.rows.forEach(function (row, index) {
			var option = document.createElement('option');
			option.value = index;
			var name = nameColumn >= 0 ? String(row[nameColumn] || '').trim() : '';
			option.textContent = 'Row ' + (index + 2) + (name ? ': ' + name : '');
			selector.appendChild(option);
		});
	}

	function captureTemplate() {
		var status = document.querySelector('#csv-template-status');
		if (!window.card || !card.text) {
			if (status) {
				status.textContent = 'Load a frame version before capturing the template.';
			}
			return;
		}
		templateCard = cloneSerializableCard(card);
		if (status) {
			status.textContent = 'Captured template: ' + (card.version || 'current card layout') + '.';
		}
	}

	async function previewSelectedRow() {
		var status = document.querySelector('#csv-card-preview-status');
		var errors = CSVImporter.getValidationErrors();
		if (errors.length) {
			status.textContent = 'Resolve the CSV validation issues before previewing a card.';
			return;
		}

		var selector = document.querySelector('#csv-card-preview-row');
		if (!selector || selector.value === '') {
			status.textContent = 'Select a CSV row to preview.';
			return;
		}

		try {
			var result = buildCard(Number(selector.value));
			await applyPreviewToCurrentCard(result);
			window.lastCSVPreview = result;
			var appliedValues = [
				'Title: ' + ((card.text.title && card.text.title.text) || '(blank)'),
				'Mana: ' + ((card.text.mana && card.text.mana.text) || '(blank)'),
				'Type: ' + ((card.text.type && card.text.type.text) || '(blank)'),
				'Rules: ' + ((card.text.rules && card.text.rules.text) || '(blank)'),
				'P/T: ' + ((card.text.pt && card.text.pt.text) || '(blank)'),
				'Frame: ' + (result.appliedFrameType || 'Captured template'),
				'Art: ' + (result.appliedArt || 'Captured template art')
			];
			status.textContent = 'Previewed ' + (result.fields.name || 'row ' + (Number(selector.value) + 2)) +
				'. Applied ' + appliedValues.join('; ') + '.' +
				(result.warnings.length ? ' ' + result.warnings.join(' ') : '');
		} catch (error) {
			status.textContent = error.message || 'The selected row could not be previewed.';
		}
	}

	window.CSVCardBuilder = {
		csvChanged: csvChanged,
		captureTemplate: captureTemplate,
		selectArtFolder: selectArtFolder,
		previewSelectedRow: previewSelectedRow,
		exportBatch: exportBatch,
		buildCard: buildCard
	};
})();
