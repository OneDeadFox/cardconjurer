(function () {
	'use strict';

	var DATABASE_NAME = 'cardconjurer-frame-designer';
	var DATABASE_VERSION = 1;
	var ASSET_STORE = 'assets';
	var PROJECT_STORE = 'projects';
	var dbPromise = null;
	var readyPromise = null;
	var assets = [];
	var projects = [];
	var currentProjectId = '';
	var objectUrls = new Map();
	var blankProjectCard = null;

	function makeId(prefix) {
		if (window.crypto && typeof window.crypto.randomUUID === 'function') {
			return prefix + '-' + window.crypto.randomUUID();
		}
		return prefix + '-' + Date.now() + '-' + Math.random().toString(16).slice(2);
	}

	function requestResult(request) {
		return new Promise(function (resolve, reject) {
			request.onsuccess = function () { resolve(request.result); };
			request.onerror = function () { reject(request.error || new Error('IndexedDB request failed.')); };
		});
	}

	function transactionFinished(transaction) {
		return new Promise(function (resolve, reject) {
			transaction.oncomplete = function () { resolve(); };
			transaction.onerror = function () { reject(transaction.error || new Error('IndexedDB transaction failed.')); };
			transaction.onabort = function () { reject(transaction.error || new Error('IndexedDB transaction was cancelled.')); };
		});
	}

	function openDatabase() {
		if (dbPromise) {
			return dbPromise;
		}
		dbPromise = new Promise(function (resolve, reject) {
			if (!window.indexedDB) {
				reject(new Error('This browser does not support IndexedDB.'));
				return;
			}
			var request = indexedDB.open(DATABASE_NAME, DATABASE_VERSION);
			request.onupgradeneeded = function () {
				var database = request.result;
				if (!database.objectStoreNames.contains(ASSET_STORE)) {
					var assetStore = database.createObjectStore(ASSET_STORE, {keyPath: 'id'});
					assetStore.createIndex('name', 'name', {unique: false});
					assetStore.createIndex('updatedAt', 'updatedAt', {unique: false});
				}
				if (!database.objectStoreNames.contains(PROJECT_STORE)) {
					var projectStore = database.createObjectStore(PROJECT_STORE, {keyPath: 'id'});
					projectStore.createIndex('name', 'name', {unique: false});
					projectStore.createIndex('updatedAt', 'updatedAt', {unique: false});
				}
			};
			request.onsuccess = function () {
				request.result.onversionchange = function () { request.result.close(); };
				resolve(request.result);
			};
			request.onerror = function () {
				reject(request.error || new Error('The Frame Designer database could not be opened.'));
			};
		});
		return dbPromise;
	}

	async function getAll(storeName) {
		var database = await openDatabase();
		var transaction = database.transaction(storeName, 'readonly');
		var values = await requestResult(transaction.objectStore(storeName).getAll());
		await transactionFinished(transaction);
		return values;
	}

	async function getOne(storeName, id) {
		var database = await openDatabase();
		var transaction = database.transaction(storeName, 'readonly');
		var value = await requestResult(transaction.objectStore(storeName).get(id));
		await transactionFinished(transaction);
		return value;
	}

	async function putOne(storeName, value) {
		var database = await openDatabase();
		var transaction = database.transaction(storeName, 'readwrite');
		transaction.objectStore(storeName).put(value);
		await transactionFinished(transaction);
		return value;
	}

	async function deleteOne(storeName, id) {
		var database = await openDatabase();
		var transaction = database.transaction(storeName, 'readwrite');
		transaction.objectStore(storeName).delete(id);
		await transactionFinished(transaction);
	}

	function setStatus(selector, message, isError) {
		var element = document.querySelector(selector);
		if (!element) {
			return;
		}
		element.textContent = message;
		element.classList.toggle('csv-import-error', !!isError);
	}

	function extensionlessName(value) {
		var name = String(value || 'Imported frame image').trim();
		return name.replace(/\.[^.]+$/, '') || 'Imported frame image';
	}

	function sourceType(source) {
		var match = String(source || '').match(/^data:([^;,]+)/i);
		return match ? match[1] : '';
	}

	function dataUrlToBlob(source) {
		var parts = String(source).split(',');
		var header = parts.shift() || '';
		var bytes;
		if (/;base64/i.test(header)) {
			var binary = atob(parts.join(','));
			var array = new Uint8Array(binary.length);
			for (var index = 0; index < binary.length; index++) {
				array[index] = binary.charCodeAt(index);
			}
			bytes = array;
		} else {
			bytes = decodeURIComponent(parts.join(','));
		}
		return new Blob([bytes], {type: sourceType(source) || 'application/octet-stream'});
	}

	function sourceFromParams(params, fallback) {
		var parsed = new URLSearchParams(String(params || ''));
		return extensionlessName(parsed.get('filename') || fallback);
	}

	async function saveSourceAsset(source, name, kind, existingId) {
		if (!source) {
			throw new Error('The image source was empty.');
		}
		var now = new Date().toISOString();
		var record = {
			id: existingId || makeId('asset'),
			name: extensionlessName(name),
			kind: kind || 'frame',
			mimeType: sourceType(source),
			createdAt: now,
			updatedAt: now
		};
		var previous = existingId ? await getOne(ASSET_STORE, existingId) : null;
		if (previous) {
			record.createdAt = previous.createdAt || now;
		}
		if (String(source).indexOf('data:') === 0) {
			record.blob = dataUrlToBlob(source);
			record.mimeType = record.blob.type || record.mimeType;
		} else if (String(source).indexOf('blob:') === 0) {
			var response = await fetch(source);
			if (!response.ok) {
				throw new Error('A temporary frame image could not be preserved. Re-select the image and save the project again.');
			}
			record.blob = await response.blob();
			record.mimeType = record.blob.type || record.mimeType;
		} else {
			record.sourceUrl = source;
		}
		await putOne(ASSET_STORE, record);
		await refreshAssets(record.id);
		return record;
	}

	async function importFiles(fileList, kind) {
		var files = Array.from(fileList || []);
		if (!files.length) {
			return;
		}
		var lastId = '';
		try {
			for (var file of files) {
				if (!String(file.type || '').startsWith('image/')) {
					throw new Error('"' + file.name + '" is not an image file.');
				}
				var now = new Date().toISOString();
				var record = {
					id: makeId('asset'),
					name: extensionlessName(file.name),
					kind: kind || 'frame',
					mimeType: file.type,
					blob: file,
					createdAt: now,
					updatedAt: now
				};
				await putOne(ASSET_STORE, record);
				lastId = record.id;
			}
			await refreshAssets(lastId);
			setStatus('#frame-asset-status', files.length + ' image' + (files.length === 1 ? '' : 's') + ' saved to the asset library.', false);
		} catch (error) {
			setStatus('#frame-asset-status', error.message, true);
		}
	}

	async function importUrl(url) {
		url = String(url || '').trim();
		if (!url) {
			setStatus('#frame-asset-status', 'Enter an image URL first.', true);
			return;
		}
		try {
			var resolvedUrl = url;
			if (typeof imageURL === 'function') {
				imageURL(url, function (source) { resolvedUrl = source; });
			}
			var name = extensionlessName(url.split('/').pop().split('?')[0] || 'Linked frame image');
			var record = await saveSourceAsset(resolvedUrl, name, 'frame');
			var input = document.querySelector('#frame-asset-url');
			if (input) { input.value = ''; }
			setStatus('#frame-asset-status', 'Saved "' + record.name + '" to the asset library.', false);
		} catch (error) {
			setStatus('#frame-asset-status', error.message, true);
		}
	}

	async function getAssetSource(id) {
		var asset = assets.find(function (item) { return item.id === id; }) || await getOne(ASSET_STORE, id);
		if (!asset) {
			throw new Error('A project references a frame asset that is no longer available.');
		}
		if (asset.blob) {
			if (!objectUrls.has(id)) {
				objectUrls.set(id, URL.createObjectURL(asset.blob));
			}
			return objectUrls.get(id);
		}
		return asset.sourceUrl;
	}

	function normalizeCustomSymbolToken(value) {
		return String(value || '').trim().replace(/^\{|\}$/g, '').toLowerCase();
	}

	function getCustomSymbolAssets() {
		return assets.filter(function (asset) { return asset.kind === 'custom-symbol'; });
	}

	function customSymbolValidationError(token, ignoreId) {
		token = normalizeCustomSymbolToken(token);
		if (!/^[a-z][a-z0-9_-]{0,31}$/.test(token)) {
			return 'Use 1-32 characters: start with a letter, then use letters, numbers, hyphens, or underscores.';
		}
		if (window.CardConjurerManaSymbols && window.CardConjurerManaSymbols.isReserved(token)) {
			return 'The code {' + token + '} is reserved by Card Conjurer.';
		}
		var duplicate = getCustomSymbolAssets().find(function (asset) {
			return asset.id !== ignoreId && normalizeCustomSymbolToken(asset.token) === token;
		});
		return duplicate ? 'A custom symbol already uses {' + token + '}.' : '';
	}

	function renderCustomSymbolOptions(selectedId) {
		var select = document.querySelector('#custom-symbol-list');
		if (!select) {
			return;
		}
		var symbolAssets = getCustomSymbolAssets();
		select.innerHTML = '';
		if (!symbolAssets.length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No custom symbols saved';
			select.appendChild(empty);
			select.disabled = true;
			var preview = document.querySelector('#custom-symbol-preview');
			if (preview) {
				preview.hidden = true;
				preview.removeAttribute('src');
			}
			return;
		}
		select.disabled = false;
		symbolAssets.sort(function (left, right) {
			return String(left.token || '').localeCompare(String(right.token || ''));
		}).forEach(function (asset) {
			var option = document.createElement('option');
			option.value = asset.id;
			option.textContent = '{' + asset.token + '} — ' + asset.name;
			select.appendChild(option);
		});
		if (selectedId && symbolAssets.some(function (asset) { return asset.id === selectedId; })) {
			select.value = selectedId;
		}
		previewSelectedCustomSymbol();
	}

	async function previewSelectedCustomSymbol() {
		var select = document.querySelector('#custom-symbol-list');
		var asset = select && getCustomSymbolAssets().find(function (item) { return item.id === select.value; });
		var preview = document.querySelector('#custom-symbol-preview');
		if (!asset) {
			if (preview) { preview.hidden = true; }
			return;
		}
		var tokenInput = document.querySelector('#custom-symbol-token');
		if (tokenInput) { tokenInput.value = asset.token || ''; }
		if (preview) {
			try {
				preview.src = await getAssetSource(asset.id);
				preview.alt = 'Preview of {' + asset.token + '}';
				preview.hidden = false;
			} catch (error) {
				preview.hidden = true;
			}
		}
	}

	async function syncCustomManaSymbols(selectedId) {
		if (!window.CardConjurerManaSymbols) {
			return;
		}
		window.CardConjurerManaSymbols.clear();
		var failures = [];
		for (var asset of getCustomSymbolAssets()) {
			try {
				await window.CardConjurerManaSymbols.register(asset.token, await getAssetSource(asset.id));
			} catch (error) {
				failures.push('{' + asset.token + '}');
			}
		}
		renderCustomSymbolOptions(selectedId);
		var status = document.querySelector('#custom-symbol-status');
		if (status && failures.length) {
			setStatus('#custom-symbol-status', 'Could not load ' + failures.join(', ') + '. Replace or delete the affected symbol.', true);
		}
	}

	async function saveCustomSymbol(token, file) {
		token = normalizeCustomSymbolToken(token);
		var existing = getCustomSymbolAssets().find(function (asset) {
			return normalizeCustomSymbolToken(asset.token) === token;
		});
		var validationError = customSymbolValidationError(token, existing && existing.id);
		if (validationError) {
			setStatus('#custom-symbol-status', validationError, true);
			return;
		}
		if (!file) {
			setStatus('#custom-symbol-status', 'Choose a PNG, SVG, JPG, or WebP image first.', true);
			return;
		}
		if (!String(file.type || '').startsWith('image/')) {
			setStatus('#custom-symbol-status', '"' + file.name + '" is not an image file.', true);
			return;
		}
		try {
			var now = new Date().toISOString();
			var record = {
				id: existing ? existing.id : makeId('asset'),
				name: extensionlessName(file.name),
				kind: 'custom-symbol',
				token: token,
				mimeType: file.type,
				blob: file,
				createdAt: existing ? existing.createdAt : now,
				updatedAt: now
			};
			await putOne(ASSET_STORE, record);
			if (objectUrls.has(record.id)) {
				URL.revokeObjectURL(objectUrls.get(record.id));
				objectUrls.delete(record.id);
			}
			await refreshAssets(null, record.id);
			var fileInput = document.querySelector('#custom-symbol-file');
			if (fileInput) { fileInput.value = ''; }
			setStatus('#custom-symbol-status', (existing ? 'Replaced ' : 'Saved ') + '{' + token + '}. It can now be used in any text or CSV field.', false);
		} catch (error) {
			setStatus('#custom-symbol-status', error.message, true);
		}
	}

	async function renameSelectedCustomSymbol(token) {
		var select = document.querySelector('#custom-symbol-list');
		var asset = select && getCustomSymbolAssets().find(function (item) { return item.id === select.value; });
		if (!asset) {
			setStatus('#custom-symbol-status', 'Select a custom symbol first.', true);
			return;
		}
		token = normalizeCustomSymbolToken(token);
		var validationError = customSymbolValidationError(token, asset.id);
		if (validationError) {
			setStatus('#custom-symbol-status', validationError, true);
			return;
		}
		var oldToken = asset.token;
		asset.token = token;
		asset.updatedAt = new Date().toISOString();
		await putOne(ASSET_STORE, asset);
		await refreshAssets(null, asset.id);
		setStatus('#custom-symbol-status', 'Renamed {' + oldToken + '} to {' + token + '}. Existing card text is not changed automatically.', false);
	}

	async function deleteSelectedCustomSymbol() {
		var select = document.querySelector('#custom-symbol-list');
		var asset = select && getCustomSymbolAssets().find(function (item) { return item.id === select.value; });
		if (!asset) {
			setStatus('#custom-symbol-status', 'Select a custom symbol first.', true);
			return;
		}
		var tokenPattern = '{' + normalizeCustomSymbolToken(asset.token) + '}';
		var referencingProjects = projects.filter(function (project) {
			var serialized = JSON.stringify(project.card || {}).toLowerCase();
			return serialized.indexOf(tokenPattern) !== -1 || serialized.indexOf(asset.id.toLowerCase()) !== -1;
		});
		var warning = 'Delete the custom symbol ' + tokenPattern + '?';
		if (referencingProjects.length) {
			warning += '\n\nIt is used by ' + referencingProjects.length + ' saved project' + (referencingProjects.length === 1 ? '' : 's') + '.';
		}
		if (!confirm(warning)) {
			return;
		}
		await deleteOne(ASSET_STORE, asset.id);
		if (objectUrls.has(asset.id)) {
			URL.revokeObjectURL(objectUrls.get(asset.id));
			objectUrls.delete(asset.id);
		}
		await refreshAssets();
		setStatus('#custom-symbol-status', 'Deleted ' + tokenPattern + '.', false);
	}

	function insertSelectedCustomSymbol() {
		var select = document.querySelector('#custom-symbol-list');
		var asset = select && getCustomSymbolAssets().find(function (item) { return item.id === select.value; });
		var editor = document.querySelector('#text-editor');
		if (!asset || !editor) {
			setStatus('#custom-symbol-status', 'Select a custom symbol and text field first.', true);
			return;
		}
		var code = '{' + asset.token + '}';
		var start = editor.selectionStart === null ? editor.value.length : editor.selectionStart;
		var end = editor.selectionEnd === null ? start : editor.selectionEnd;
		editor.value = editor.value.slice(0, start) + code + editor.value.slice(end);
		editor.focus();
		editor.setSelectionRange(start + code.length, start + code.length);
		if (typeof textEdited === 'function') {
			textEdited();
		}
		setStatus('#custom-symbol-status', 'Inserted ' + code + ' into the selected text field.', false);
	}

	function normalizeSetSymbolFamily(value) {
		return String(value || '').trim().toLowerCase();
	}

	function normalizeSetSymbolRarity(value) {
		var rarity = String(value || '').trim().toLowerCase();
		if (rarity.indexOf('mythic') === 0 || rarity === 'm') { return 'm'; }
		if (rarity.indexOf('rare') === 0 || rarity === 'r') { return 'r'; }
		if (rarity.indexOf('uncommon') === 0 || rarity === 'u') { return 'u'; }
		return 'c';
	}

	function getCustomSetSymbolAssets() {
		return assets.filter(function (asset) { return asset.kind === 'custom-set-symbol'; });
	}

	function getSetSymbolFamilies() {
		var families = new Map();
		getCustomSetSymbolAssets().forEach(function (asset) {
			var family = normalizeSetSymbolFamily(asset.family);
			if (!families.has(family)) {
				families.set(family, {family:family, name:asset.familyName || asset.family, assets:{}});
			}
			families.get(family).assets[normalizeSetSymbolRarity(asset.rarity)] = asset;
		});
		return Array.from(families.values()).sort(function (left, right) {
			return left.family.localeCompare(right.family);
		});
	}

	function validateSetSymbolFamily(value) {
		var family = normalizeSetSymbolFamily(value);
		if (!/^[a-z][a-z0-9_-]{0,31}$/.test(family)) {
			throw new Error('Set-symbol family codes must start with a letter and use only letters, numbers, hyphens, or underscores.');
		}
		return family;
	}

	function renderSetSymbolFamilyOptions(selectedFamily) {
		var select = document.querySelector('#custom-set-symbol-list');
		if (!select) {
			return;
		}
		var families = getSetSymbolFamilies();
		select.innerHTML = '';
		if (!families.length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No custom set-symbol families saved';
			select.appendChild(empty);
			select.disabled = true;
			['c','u','r','m'].forEach(function (rarity) {
				var image = document.querySelector('#custom-set-symbol-preview-' + rarity);
				if (image) { image.hidden = true; }
			});
			return;
		}
		select.disabled = false;
		families.forEach(function (family) {
			var option = document.createElement('option');
			option.value = family.family;
			option.textContent = family.family.toUpperCase();
			select.appendChild(option);
		});
		if (selectedFamily && families.some(function (family) { return family.family === normalizeSetSymbolFamily(selectedFamily); })) {
			select.value = normalizeSetSymbolFamily(selectedFamily);
		}
		previewSelectedSetSymbolFamily();
	}

	async function previewSelectedSetSymbolFamily() {
		var select = document.querySelector('#custom-set-symbol-list');
		var family = select ? normalizeSetSymbolFamily(select.value) : '';
		var familyData = getSetSymbolFamilies().find(function (item) { return item.family === family; });
		if (!familyData) {
			return;
		}
		var input = document.querySelector('#custom-set-symbol-family');
		if (input) { input.value = family; }
		for (var rarity of ['c','u','r','m']) {
			var preview = document.querySelector('#custom-set-symbol-preview-' + rarity);
			var asset = familyData.assets[rarity];
			if (preview && asset) {
				preview.src = await getAssetSource(asset.id);
				preview.alt = family.toUpperCase() + ' ' + rarity.toUpperCase() + ' set symbol';
				preview.hidden = false;
			}
		}
	}

	async function saveCustomSetSymbolFamily(familyValue, files) {
		try {
			var family = validateSetSymbolFamily(familyValue);
			files = files || {};
			var existingFamily = getSetSymbolFamilies().find(function (item) { return item.family === family; });
			var missing = ['c','u','r','m'].filter(function (rarity) {
				return !(files[rarity] || (existingFamily && existingFamily.assets[rarity]));
			});
			if (missing.length) {
				throw new Error('Choose all four rarity images for a new family. Missing: ' + missing.join(', ').toUpperCase() + '.');
			}
			if (!['c','u','r','m'].some(function (rarity) { return !!files[rarity]; })) {
				throw new Error('Choose at least one replacement image.');
			}
			var now = new Date().toISOString();
			for (var rarity of ['c','u','r','m']) {
				var file = files[rarity];
				if (!file) { continue; }
				if (!String(file.type || '').startsWith('image/')) {
					throw new Error('"' + file.name + '" is not an image file.');
				}
				var previous = existingFamily && existingFamily.assets[rarity];
				var record = {
					id: previous ? previous.id : makeId('asset'),
					name: family.toUpperCase() + ' ' + rarity.toUpperCase(),
					kind: 'custom-set-symbol',
					family: family,
					familyName: family.toUpperCase(),
					rarity: rarity,
					mimeType: file.type,
					blob: file,
					createdAt: previous ? previous.createdAt : now,
					updatedAt: now
				};
				await putOne(ASSET_STORE, record);
				if (objectUrls.has(record.id)) {
					URL.revokeObjectURL(objectUrls.get(record.id));
					objectUrls.delete(record.id);
				}
			}
			['c','u','r','m'].forEach(function (rarity) {
				var input = document.querySelector('#custom-set-symbol-file-' + rarity);
				if (input) { input.value = ''; }
			});
			await refreshAssets(null, null, family);
			setStatus('#custom-set-symbol-status', 'Saved the ' + family.toUpperCase() + ' Common, Uncommon, Rare, and Mythic set symbols.', false);
		} catch (error) {
			setStatus('#custom-set-symbol-status', error.message, true);
		}
	}

	async function getCustomSetSymbolSource(familyValue, rarityValue) {
		await ensureReady();
		var family = normalizeSetSymbolFamily(familyValue);
		var rarity = normalizeSetSymbolRarity(rarityValue);
		var asset = getCustomSetSymbolAssets().find(function (item) {
			return normalizeSetSymbolFamily(item.family) === family && normalizeSetSymbolRarity(item.rarity) === rarity;
		});
		if (!asset) {
			return null;
		}
		return {
			family: family,
			rarity: rarity,
			assetId: asset.id,
			source: await getAssetSource(asset.id)
		};
	}

	async function applyCustomSetSymbolFamily(familyValue, rarityValue) {
		var resolved = await getCustomSetSymbolSource(familyValue, rarityValue);
		if (!resolved) {
			throw new Error('The custom set-symbol family "' + familyValue + '" does not contain the requested rarity.');
		}
		var loaded = await uploadSetSymbol(resolved.source, 'resetSetSymbol');
		if (!loaded) {
			throw new Error('The ' + resolved.family.toUpperCase() + ' set symbol could not be loaded.');
		}
		card.setSymbolFamily = resolved.family;
		card.setSymbolRarity = resolved.rarity;
		card.setSymbolAssetId = resolved.assetId;
		card.setSymbolSource = resolved.source;
		document.querySelector('#set-symbol-code').value = resolved.family;
		document.querySelector('#set-symbol-rarity').value = resolved.rarity;
		return resolved;
	}

	async function applySelectedSetSymbolFamily() {
		var select = document.querySelector('#custom-set-symbol-list');
		var family = select ? select.value : '';
		if (!family) {
			setStatus('#custom-set-symbol-status', 'Select a custom set-symbol family first.', true);
			return;
		}
		try {
			var rarity = document.querySelector('#set-symbol-rarity').value || document.querySelector('#info-rarity').value || 'c';
			var resolved = await applyCustomSetSymbolFamily(family, rarity);
			setStatus('#custom-set-symbol-status', 'Applied ' + resolved.family.toUpperCase() + '-' + resolved.rarity.toUpperCase() + ' to the current card.', false);
		} catch (error) {
			setStatus('#custom-set-symbol-status', error.message, true);
		}
	}

	async function deleteSelectedSetSymbolFamily() {
		var select = document.querySelector('#custom-set-symbol-list');
		var family = select ? normalizeSetSymbolFamily(select.value) : '';
		var familyData = getSetSymbolFamilies().find(function (item) { return item.family === family; });
		if (!familyData) {
			setStatus('#custom-set-symbol-status', 'Select a custom set-symbol family first.', true);
			return;
		}
		var ids = Object.keys(familyData.assets).map(function (rarity) { return familyData.assets[rarity].id; });
		var referencingProjects = projects.filter(function (project) {
			var serialized = JSON.stringify(project.card || {}).toLowerCase();
			return serialized.indexOf('"setsymbolfamily":"' + family + '"') !== -1 ||
				ids.some(function (id) { return serialized.indexOf(id.toLowerCase()) !== -1; });
		});
		var warning = 'Delete all four symbols in the ' + family.toUpperCase() + ' family?';
		if (referencingProjects.length) {
			warning += '\n\nThis family is used by ' + referencingProjects.length + ' saved project' + (referencingProjects.length === 1 ? '' : 's') + '.';
		}
		if (!confirm(warning)) {
			return;
		}
		for (var id of ids) {
			await deleteOne(ASSET_STORE, id);
			if (objectUrls.has(id)) {
				URL.revokeObjectURL(objectUrls.get(id));
				objectUrls.delete(id);
			}
		}
		await refreshAssets();
		setStatus('#custom-set-symbol-status', 'Deleted the ' + family.toUpperCase() + ' set-symbol family.', false);
	}

	function uniqueImportedSetSymbolFamily(value, claimedFamilies) {
		var base = normalizeSetSymbolFamily(value).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
		if (!/^[a-z]/.test(base)) { base = 'set-' + base; }
		base = base.slice(0, 32) || 'imported-set';
		var candidate = base;
		var counter = 2;
		while (claimedFamilies.has(candidate)) {
			var suffix = counter === 2 ? '-imported' : '-imported-' + counter;
			candidate = base.slice(0, 32 - suffix.length) + suffix;
			counter++;
		}
		claimedFamilies.add(candidate);
		return candidate;
	}

	function uniqueImportedSymbolToken(value, claimedTokens) {
		var base = normalizeCustomSymbolToken(value).replace(/[^a-z0-9_-]+/g, '-').replace(/^-+|-+$/g, '');
		if (!/^[a-z]/.test(base)) {
			base = 'symbol-' + base;
		}
		base = base.slice(0, 32) || 'imported-symbol';
		var candidate = base;
		var counter = 2;
		while (claimedTokens.has(candidate) || (window.CardConjurerManaSymbols && window.CardConjurerManaSymbols.isReserved(candidate))) {
			var suffix = counter === 2 ? '-imported' : '-imported-' + counter;
			candidate = base.slice(0, 32 - suffix.length) + suffix;
			counter++;
		}
		claimedTokens.add(candidate);
		return candidate;
	}

	function renderAssetOptions(selectedId) {
		var select = document.querySelector('#frame-asset-list');
		if (!select) {
			return;
		}
		var frameAssets = assets.filter(function (asset) { return asset.kind !== 'custom-symbol' && asset.kind !== 'custom-set-symbol' && asset.kind !== 'set-symbol-single'; });
		select.innerHTML = '';
		if (!frameAssets.length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No saved frame assets';
			select.appendChild(empty);
			select.disabled = true;
			return;
		}
		select.disabled = false;
		frameAssets.forEach(function (asset) {
			var option = document.createElement('option');
			option.value = asset.id;
			option.textContent = asset.name + ' (' + (asset.kind || 'frame') + ')';
			select.appendChild(option);
		});
		if (selectedId && frameAssets.some(function (asset) { return asset.id === selectedId; })) {
			select.value = selectedId;
		}
	}

	async function refreshAssets(selectedId, selectedSymbolId, selectedSetFamily) {
		assets = (await getAll(ASSET_STORE)).sort(function (left, right) {
			return left.name.localeCompare(right.name);
		});
		renderAssetOptions(selectedId);
		await syncCustomManaSymbols(selectedSymbolId);
		renderSetSymbolFamilyOptions(selectedSetFamily);
		window.dispatchEvent(new CustomEvent('frameassetschanged'));
	}

	async function addSelectedAsset() {
		var select = document.querySelector('#frame-asset-list');
		var asset = select && assets.find(function (item) { return item.id === select.value; });
		if (!asset) {
			setStatus('#frame-asset-status', 'Select a saved frame asset first.', true);
			return;
		}
		try {
			var source = await getAssetSource(asset.id);
			if (asset.kind === 'mask') {
				if (!selectedFrame) {
					setStatus('#frame-asset-status', 'Select a frame layer before adding this saved mask.', true);
					return;
				}
				var mask = {name: asset.name, src: source, noThumb: true, assetId: asset.id, image: new Image()};
				mask.image.onload = drawFrames;
				mask.image.src = source;
				selectedFrame.masks = selectedFrame.masks || [];
				selectedFrame.masks.push(mask);
				drawFrames();
				setStatus('#frame-asset-status', 'Added "' + asset.name + '" as a mask on the selected layer.', false);
				return;
			}
			var frame = {
				name: asset.name,
				src: source,
				assetId: asset.id,
				noThumb: true,
				masks: [],
				bounds: {x: 0, y: 0, width: 1, height: 1},
				opacity: 100
			};
			availableFrames.push(frame);
			selectedFrameIndex = availableFrames.length - 1;
			await addFrame();
			setStatus('#frame-asset-status', 'Added "' + asset.name + '" as a frame layer.', false);
		} catch (error) {
			setStatus('#frame-asset-status', error.message, true);
		}
	}

	async function deleteSelectedAsset() {
		var select = document.querySelector('#frame-asset-list');
		var asset = select && assets.find(function (item) { return item.id === select.value; });
		if (!asset) {
			return;
		}
		var referencingProjects = projects.filter(function (project) {
			return JSON.stringify(project.card || {}).indexOf('asset://' + asset.id) !== -1;
		});
		var warning = 'Delete the saved asset "' + asset.name + '"?';
		if (referencingProjects.length) {
			warning += '\n\nIt is used by ' + referencingProjects.length + ' saved frame project' + (referencingProjects.length === 1 ? '' : 's') + '. Those projects will no longer load correctly.';
		}
		if (!confirm(warning)) {
			return;
		}
		await deleteOne(ASSET_STORE, asset.id);
		if (objectUrls.has(asset.id)) {
			URL.revokeObjectURL(objectUrls.get(asset.id));
			objectUrls.delete(asset.id);
		}
		await refreshAssets();
		setStatus('#frame-asset-status', 'Deleted "' + asset.name + '" from the asset library.', false);
	}

	function stripRuntimeImages(key, value) {
		if (key === 'image') {
			return undefined;
		}
		return value;
	}

	async function externalizeLayerImage(layer, kind) {
		if (!layer) {
			return;
		}
		if (layer.assetId) {
			layer.src = 'asset://' + layer.assetId;
			return;
		}
		var source = String(layer.src || '');
		if (source.indexOf('data:') === 0 || source.indexOf('blob:') === 0) {
			var asset = await saveSourceAsset(source, layer.name || 'Project image', kind);
			layer.assetId = asset.id;
			layer.src = 'asset://' + asset.id;
		}
	}

	async function createProjectSnapshot() {
		var snapshot = JSON.parse(JSON.stringify(card, stripRuntimeImages));
		snapshot.frames = snapshot.frames || [];
		for (var frame of snapshot.frames) {
			if (frame.csvImageFieldKey && !frame.assetId && String(frame.src || '').indexOf('blob:') === 0) {
				// CSV image fields save their bounds and label, not a session-only preview file.
				frame.src = '/img/blank.png';
			} else {
				await externalizeLayerImage(frame, 'frame');
			}
			frame.masks = frame.masks || [];
			for (var mask of frame.masks) {
				await externalizeLayerImage(mask, 'mask');
			}
		}
		if (String(snapshot.artSource || '').indexOf('data:') === 0 || String(snapshot.artSource || '').indexOf('blob:') === 0) {
			snapshot.artSource = '/img/blank.png';
		}
		snapshot.customSymbols = getCustomSymbolAssets().map(function (asset) {
			return {assetId: asset.id, token: asset.token};
		});
		snapshot.customSetSymbolFamily = [];
		if (snapshot.setSymbolFamily) {
			var family = normalizeSetSymbolFamily(snapshot.setSymbolFamily);
			snapshot.customSetSymbolFamily = getCustomSetSymbolAssets()
				.filter(function (asset) { return normalizeSetSymbolFamily(asset.family) === family; })
				.map(function (asset) {
					return {assetId: asset.id, family: family, rarity: normalizeSetSymbolRarity(asset.rarity)};
				});
			var activeSetSymbol = getCustomSetSymbolAssets().find(function (asset) {
				return normalizeSetSymbolFamily(asset.family) === family &&
					normalizeSetSymbolRarity(asset.rarity) === normalizeSetSymbolRarity(snapshot.setSymbolRarity);
			});
			if (activeSetSymbol) {
				snapshot.setSymbolAssetId = activeSetSymbol.id;
				snapshot.setSymbolSource = 'asset://' + activeSetSymbol.id;
			}
		} else if (String(snapshot.setSymbolSource || '').indexOf('data:') === 0 || String(snapshot.setSymbolSource || '').indexOf('blob:') === 0) {
			var savedSetSymbol = await saveSourceAsset(snapshot.setSymbolSource, 'Project set symbol', 'set-symbol-single', snapshot.setSymbolAssetId);
			snapshot.setSymbolAssetId = savedSetSymbol.id;
			snapshot.setSymbolSource = 'asset://' + savedSetSymbol.id;
		}
		return snapshot;
	}

	async function hydrateLayerImage(layer) {
		if (!layer) {
			return;
		}
		var source = String(layer.src || '');
		var match = source.match(/^asset:\/\/(.+)$/);
		if (match) {
			layer.assetId = match[1];
			layer.src = await getAssetSource(match[1]);
			return;
		}
		if (source.indexOf('blob:') === 0) {
			if (layer.csvImageFieldKey) {
				// Repair projects saved before CSV image previews were normalized.
				layer.src = '/img/blank.png';
				return;
			}
			throw new Error('This saved project contains an expired temporary frame image. Re-select that frame image and save the project again.');
		}
	}

	async function hydrateProjectSnapshot(snapshot) {
		var hydrated = JSON.parse(JSON.stringify(snapshot));
		hydrated.frames = hydrated.frames || [];
		for (var frame of hydrated.frames) {
			await hydrateLayerImage(frame);
			frame.masks = frame.masks || [];
			for (var mask of frame.masks) {
				await hydrateLayerImage(mask);
			}
		}
		var setSymbolMatch = String(hydrated.setSymbolSource || '').match(/^asset:\/\/(.+)$/);
		if (setSymbolMatch) {
			hydrated.setSymbolAssetId = setSymbolMatch[1];
			hydrated.setSymbolSource = await getAssetSource(setSymbolMatch[1]);
		}
		return hydrated;
	}

	function renderProjectOptions(selectedId) {
		var select = document.querySelector('#frame-project-list');
		if (!select) {
			return;
		}
		select.innerHTML = '';
		if (!projects.length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No saved frame projects';
			select.appendChild(empty);
			select.disabled = true;
			return;
		}
		select.disabled = false;
		projects.forEach(function (project) {
			var option = document.createElement('option');
			option.value = project.id;
			option.textContent = project.name;
			select.appendChild(option);
		});
		if (selectedId && projects.some(function (project) { return project.id === selectedId; })) {
			select.value = selectedId;
		}
	}

	async function refreshProjects(selectedId) {
		projects = (await getAll(PROJECT_STORE)).sort(function (left, right) {
			return left.name.localeCompare(right.name);
		});
		renderProjectOptions(selectedId);
		window.dispatchEvent(new CustomEvent('frameprojectschanged'));
	}

	function uniqueNewProjectName(value) {
		var base = String(value || 'Untitled Project').trim() || 'Untitled Project';
		var used = new Set(projects.map(function (project) {
			return String(project.name || '').trim().toLowerCase();
		}));
		if (!used.has(base.toLowerCase())) {
			return base;
		}
		var counter = 2;
		var candidate = base + ' ' + counter;
		while (used.has(candidate.toLowerCase())) {
			counter++;
			candidate = base + ' ' + counter;
		}
		return candidate;
	}

	async function startNewProject(requestedName, skipConfirmation) {
		await ensureReady();
		if (!skipConfirmation && !confirm('Start a new project? Save any changes you want to keep in the current project first.')) {
			return false;
		}
		try {
			var name = uniqueNewProjectName(requestedName);
			var cleanCard = blankProjectCard ? JSON.parse(JSON.stringify(blankProjectCard)) : {
				width: typeof getStandardWidth === 'function' ? getStandardWidth() : 2010,
				height: typeof getStandardHeight === 'function' ? getStandardHeight() : 2814,
				marginX: 0,
				marginY: 0,
				frames: [],
				text: {},
				artSource: '/img/blank.png',
				setSymbolSource: '/img/blank.png',
				watermarkSource: '/img/blank.png',
				manaSymbols: []
			};
			if (typeof loadCardData !== 'function') {
				throw new Error('Card Creator is not ready to start a new project.');
			}
			await loadCardData(cleanCard, name);
			if (typeof saveCurrentDesignAsDefaults === 'function') {
				saveCurrentDesignAsDefaults();
			}
			var now = new Date().toISOString();
			var project = {
				id: makeId('project'),
				name: name,
				schemaVersion: 1,
				card: await createProjectSnapshot(),
				createdAt: now,
				updatedAt: now
			};
			await putOne(PROJECT_STORE, project);
			currentProjectId = project.id;
			await refreshProjects(project.id);
			var nameInput = document.querySelector('#frame-project-name');
			if (nameInput) { nameInput.value = name; }
			await viewCurrentProjectAssets();
			setStatus('#frame-project-status', 'Created and loaded new project "' + name + '".', false);
			return true;
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
			return false;
		}
	}

	function projectAssetLabel(asset) {
		if (asset.kind === 'custom-symbol') {
			return 'Custom Mana Symbol {' + asset.token + '}';
		}
		if (asset.kind === 'custom-set-symbol') {
			return 'Set Symbol ' + String(asset.family || '').toUpperCase() + '-' + String(asset.rarity || '').toUpperCase();
		}
		if (asset.kind === 'set-symbol-single') {
			return 'Uploaded Set Symbol';
		}
		if (asset.kind === 'mask') {
			return 'Mask';
		}
		return 'Frame Asset';
	}

	function addLinkedProjectAsset(descriptors, seen, type, name, source) {
		source = String(source || '');
		if (!source || source.indexOf('blank.png') !== -1 || source.indexOf('asset://') === 0) {
			return;
		}
		var key = type + '|' + source;
		if (seen.has(key)) {
			return;
		}
		seen.add(key);
		descriptors.push({type:type, name:name || type, source:source, stored:false});
	}

	async function viewCurrentProjectAssets() {
		await ensureReady();
		var container = document.querySelector('#current-project-assets');
		if (!container) {
			return;
		}
		container.innerHTML = '';
		if (!currentProjectId) {
			container.textContent = 'No project is currently loaded. Load or start a project to inspect its assets.';
			return;
		}
		var project = await getOne(PROJECT_STORE, currentProjectId);
		if (!project) {
			container.textContent = 'The current project could not be found.';
			return;
		}
		var projectCard = project.card || {};
		var liveCard = typeof card === 'object' && card ? card : projectCard;
		var assetIds = collectAssetIds(projectCard);
		collectAssetIds(liveCard, assetIds);
		var symbolsByToken = new Map(getCustomSymbolAssets().map(function (asset) {
			return [normalizeCustomSymbolToken(asset.token), asset];
		}));
		collectCustomSymbolTokens(projectCard, new Set(symbolsByToken.keys())).forEach(function (token) {
			assetIds.add(symbolsByToken.get(token).id);
		});
		collectCustomSymbolTokens(liveCard, new Set(symbolsByToken.keys())).forEach(function (token) {
			assetIds.add(symbolsByToken.get(token).id);
		});
		var activeFamily = normalizeSetSymbolFamily(liveCard.setSymbolFamily || projectCard.setSymbolFamily);
		if (activeFamily) {
			getCustomSetSymbolAssets().forEach(function (asset) {
				if (normalizeSetSymbolFamily(asset.family) === activeFamily) {
					assetIds.add(asset.id);
				}
			});
		}

		var descriptors = [];
		var seen = new Set();
		for (var assetId of assetIds) {
			var asset = assets.find(function (item) { return item.id === assetId; });
			if (!asset) {
				descriptors.push({type:'Missing Asset', name:assetId, source:'', missing:true});
				continue;
			}
			seen.add('stored|' + asset.id);
			var source = '';
			try { source = await getAssetSource(asset.id); } catch (error) {}
			descriptors.push({type:projectAssetLabel(asset), name:asset.name, source:source, stored:true});
		}

		(liveCard.frames || []).forEach(function (frame) {
			if (!frame.assetId) {
				addLinkedProjectAsset(descriptors, seen, 'Frame Layer', frame.name, frame.src);
			}
			(frame.masks || []).forEach(function (mask) {
				if (!mask.assetId) {
					addLinkedProjectAsset(descriptors, seen, 'Frame Mask', mask.name, mask.src);
				}
			});
		});
		addLinkedProjectAsset(descriptors, seen, 'Artwork', 'Card artwork', liveCard.artSource);
		if (!liveCard.setSymbolAssetId) {
			addLinkedProjectAsset(descriptors, seen, 'Set Symbol', 'Current set symbol', liveCard.setSymbolSource);
		}
		addLinkedProjectAsset(descriptors, seen, 'Watermark', 'Current watermark', liveCard.watermarkSource);

		var heading = document.createElement('h5');
		heading.className = 'padding input-description';
		heading.textContent = project.name + ': ' + descriptors.length + ' asset' + (descriptors.length === 1 ? '' : 's');
		container.appendChild(heading);
		if (!descriptors.length) {
			var empty = document.createElement('p');
			empty.className = 'padding';
			empty.textContent = 'This project does not contain any image assets yet.';
			container.appendChild(empty);
			return;
		}
		var list = document.createElement('div');
		list.className = 'project-asset-list';
		descriptors.forEach(function (descriptor) {
			var row = document.createElement('div');
			row.className = 'project-asset-row';
			var preview = document.createElement('div');
			preview.className = 'project-asset-preview';
			if (descriptor.source) {
				var image = document.createElement('img');
				image.src = descriptor.source;
				image.alt = descriptor.name;
				preview.appendChild(image);
			} else {
				preview.textContent = descriptor.missing ? '!' : '—';
			}
			var details = document.createElement('div');
			var type = document.createElement('strong');
			type.textContent = descriptor.type;
			var name = document.createElement('span');
			name.textContent = descriptor.name;
			details.appendChild(type);
			details.appendChild(name);
			row.appendChild(preview);
			row.appendChild(details);
			list.appendChild(row);
		});
		container.appendChild(list);
	}

	async function getProjectCardByName(name) {
		await ensureReady();
		var requested = String(name || '').trim().toLowerCase();
		if (!requested) {
			return null;
		}
		var matches = projects.filter(function (project) {
			return String(project.name || '').trim().toLowerCase() === requested;
		}).sort(function (left, right) {
			return String(right.updatedAt || '').localeCompare(String(left.updatedAt || ''));
		});
		if (!matches.length) {
			throw new Error('Saved frame project "' + name + '" was not found. Load or save that project in Frame Designer first.');
		}
		return hydrateProjectSnapshot(matches[0].card);
	}

	async function saveProject(asNew) {
		var input = document.querySelector('#frame-project-name');
		var name = String(input ? input.value : '').trim();
		if (!name) {
			setStatus('#frame-project-status', 'Enter a project name first.', true);
			return;
		}
		try {
			if (typeof saveCurrentDesignAsDefaults === 'function') {
				saveCurrentDesignAsDefaults();
			}
			var id = (!asNew && currentProjectId) ? currentProjectId : makeId('project');
			var previous = await getOne(PROJECT_STORE, id);
			var now = new Date().toISOString();
			var project = {
				id: id,
				name: name,
				schemaVersion: 1,
				card: await createProjectSnapshot(),
				createdAt: previous ? previous.createdAt : now,
				updatedAt: now
			};
			await putOne(PROJECT_STORE, project);
			currentProjectId = id;
			await refreshProjects(id);
			await viewCurrentProjectAssets();
			setStatus('#frame-project-status', 'Saved frame project "' + name + '".', false);
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
		}
	}

	async function loadSelectedProject() {
		var select = document.querySelector('#frame-project-list');
		var id = select ? select.value : '';
		if (!id) {
			setStatus('#frame-project-status', 'Select a saved frame project first.', true);
			return;
		}
		try {
			var project = await getOne(PROJECT_STORE, id);
			if (!project) {
				throw new Error('The selected frame project could not be found.');
			}
			if (typeof loadCardData !== 'function') {
				throw new Error('Card Conjurer is not ready to restore frame projects.');
			}
			var hydrated = await hydrateProjectSnapshot(project.card);
			await loadCardData(hydrated, project.name);
			if (!hydrated.designDefaults && typeof saveCurrentDesignAsDefaults === 'function') {
				saveCurrentDesignAsDefaults();
			}
			currentProjectId = project.id;
			var input = document.querySelector('#frame-project-name');
			if (input) { input.value = project.name; }
			await viewCurrentProjectAssets();
			setStatus('#frame-project-status', 'Loaded frame project "' + project.name + '".', false);
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
		}
	}

	async function deleteSelectedProject() {
		var select = document.querySelector('#frame-project-list');
		var project = select && projects.find(function (item) { return item.id === select.value; });
		if (!project || !confirm('Delete the frame project "' + project.name + '"? Imported assets will remain in the asset library.')) {
			return;
		}
		await deleteOne(PROJECT_STORE, project.id);
		if (currentProjectId === project.id) {
			currentProjectId = '';
		}
		await refreshProjects();
		setStatus('#frame-project-status', 'Deleted frame project "' + project.name + '".', false);
	}

	function ensureProjectArchiveSupport() {
		if (typeof JSZip !== 'function') {
			throw new Error('Project backup support is still loading. Wait a moment and try again.');
		}
	}

	function collectAssetIds(value, result, visited) {
		result = result || new Set();
		visited = visited || new Set();
		if (value === null || value === undefined) {
			return result;
		}
		if (typeof value === 'string') {
			var match = value.match(/^asset:\/\/(.+)$/);
			if (match) {
				result.add(match[1]);
			}
			return result;
		}
		if (typeof value !== 'object' || visited.has(value)) {
			return result;
		}
		visited.add(value);
		if (value.assetId) {
			result.add(String(value.assetId));
		}
		if (Array.isArray(value)) {
			value.forEach(function (item) { collectAssetIds(item, result, visited); });
		} else {
			Object.keys(value).forEach(function (key) { collectAssetIds(value[key], result, visited); });
		}
		return result;
	}

	function collectCustomSymbolTokens(value, knownTokens, result, visited) {
		result = result || new Set();
		visited = visited || new Set();
		if (typeof value === 'string') {
			value.replace(/\{([^{}]+)\}/g, function (match, token) {
				token = normalizeCustomSymbolToken(token);
				if (knownTokens.has(token)) {
					result.add(token);
				}
				return match;
			});
			return result;
		}
		if (!value || typeof value !== 'object' || visited.has(value)) {
			return result;
		}
		visited.add(value);
		if (Array.isArray(value)) {
			value.forEach(function (item) { collectCustomSymbolTokens(item, knownTokens, result, visited); });
		} else {
			Object.keys(value).forEach(function (key) { collectCustomSymbolTokens(value[key], knownTokens, result, visited); });
		}
		return result;
	}

	function archiveExtension(mimeType) {
		var extensions = {
			'image/png': 'png',
			'image/jpeg': 'jpg',
			'image/jpg': 'jpg',
			'image/svg+xml': 'svg',
			'image/webp': 'webp',
			'image/bmp': 'bmp',
			'image/gif': 'gif'
		};
		return extensions[String(mimeType || '').toLowerCase()] || 'bin';
	}

	function safeDownloadName(value) {
		var name = String(value || 'Frame Project').trim()
			.replace(/[<>:"/\\|?*\u0000-\u001f]/g, '-')
			.replace(/\s+/g, ' ')
			.replace(/[. ]+$/g, '');
		return name || 'Frame Project';
	}

	function downloadBlob(blob, filename) {
		var url = URL.createObjectURL(blob);
		var link = document.createElement('a');
		link.href = url;
		link.download = filename;
		document.body.appendChild(link);
		link.click();
		link.remove();
		setTimeout(function () { URL.revokeObjectURL(url); }, 1000);
	}

	async function exportSelectedProject() {
		await ensureReady();
		var select = document.querySelector('#frame-project-list');
		var id = select ? select.value : '';
		if (!id) {
			setStatus('#frame-project-status', 'Select a saved frame project to export.', true);
			return;
		}
		try {
			ensureProjectArchiveSupport();
			var project = await getOne(PROJECT_STORE, id);
			if (!project) {
				throw new Error('The selected frame project could not be found.');
			}
			var zip = new JSZip();
			var assetIdSet = collectAssetIds(project.card);
			var symbolsByToken = new Map(getCustomSymbolAssets().map(function (asset) {
				return [normalizeCustomSymbolToken(asset.token), asset];
			}));
			collectCustomSymbolTokens(project.card, new Set(symbolsByToken.keys())).forEach(function (token) {
				assetIdSet.add(symbolsByToken.get(token).id);
			});
			var assetIds = Array.from(assetIdSet);
			var exportedAssets = [];
			var linkedAssetWarnings = [];

			for (var index = 0; index < assetIds.length; index++) {
				var assetId = assetIds[index];
				var asset = await getOne(ASSET_STORE, assetId);
				if (!asset) {
					throw new Error('The project references a missing asset (' + assetId + '). Restore that image before exporting.');
				}
				var blob = asset.blob || null;
				if (!blob && asset.sourceUrl) {
					try {
						var response = await fetch(asset.sourceUrl);
						if (response.ok) {
							blob = await response.blob();
						}
					} catch (error) {
						// Cross-origin linked images may not be downloadable. Preserve their URL below.
					}
				}
				var metadata = {
					id: asset.id,
					name: asset.name,
					kind: asset.kind || 'frame',
					mimeType: (blob && blob.type) || asset.mimeType || '',
					createdAt: asset.createdAt || '',
					updatedAt: asset.updatedAt || ''
				};
				if (asset.kind === 'custom-symbol') {
					metadata.token = asset.token;
				} else if (asset.kind === 'custom-set-symbol') {
					metadata.family = asset.family;
					metadata.familyName = asset.familyName || asset.family;
					metadata.rarity = normalizeSetSymbolRarity(asset.rarity);
				}
				if (blob) {
					metadata.file = 'assets/' + String(index + 1).padStart(3, '0') + '-' + asset.id + '.' + archiveExtension(metadata.mimeType);
					zip.file(metadata.file, blob);
				} else if (asset.sourceUrl) {
					metadata.sourceUrl = asset.sourceUrl;
					linkedAssetWarnings.push(asset.name);
				} else {
					throw new Error('The asset "' + asset.name + '" does not contain an image that can be exported.');
				}
				exportedAssets.push(metadata);
			}

			var manifest = {
				format: 'cardconjurer-frame-project',
				formatVersion: 1,
				exportedAt: new Date().toISOString(),
				project: project,
				assets: exportedAssets
			};
			zip.file('manifest.json', JSON.stringify(manifest, null, 2));
			var archive = await zip.generateAsync({
				type: 'blob',
				mimeType: 'application/zip',
				compression: 'DEFLATE',
				compressionOptions: {level: 6}
			});
			downloadBlob(archive, safeDownloadName(project.name) + '.ccproject');
			var message = 'Exported "' + project.name + '" with ' + exportedAssets.length + ' asset' + (exportedAssets.length === 1 ? '' : 's') + '.';
			if (linkedAssetWarnings.length) {
				message += ' ' + linkedAssetWarnings.length + ' linked image' + (linkedAssetWarnings.length === 1 ? '' : 's') + ' could not be embedded and will still require its original URL.';
			}
			setStatus('#frame-project-status', message, false);
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
		}
	}

	async function archiveAsset(zip, asset, index, warnings) {
		var blob = asset.blob || null;
		if (!blob && asset.sourceUrl) {
			try {
				var response = await fetch(asset.sourceUrl);
				if (response.ok) { blob = await response.blob(); }
			} catch (error) {}
		}
		var metadata = {
			id: asset.id,
			name: asset.name,
			kind: asset.kind || 'frame',
			mimeType: (blob && blob.type) || asset.mimeType || '',
			createdAt: asset.createdAt || '',
			updatedAt: asset.updatedAt || ''
		};
		if (asset.kind === 'custom-symbol') {
			metadata.token = asset.token;
		} else if (asset.kind === 'custom-set-symbol') {
			metadata.family = asset.family;
			metadata.familyName = asset.familyName || asset.family;
			metadata.rarity = normalizeSetSymbolRarity(asset.rarity);
		}
		if (blob) {
			metadata.file = 'assets/' + String(index + 1).padStart(4, '0') + '-' + asset.id + '.' + archiveExtension(metadata.mimeType);
			zip.file(metadata.file, blob);
		} else if (asset.sourceUrl) {
			metadata.sourceUrl = asset.sourceUrl;
			warnings.push(asset.name);
		} else {
			throw new Error('The asset "' + asset.name + '" does not contain exportable image data.');
		}
		return metadata;
	}

	async function exportProjectLibrary() {
		try {
			await ensureReady();
			ensureProjectArchiveSupport();
			var zip = new JSZip();
			var warnings = [];
			var exportedAssets = [];
			for (var index = 0; index < assets.length; index++) {
				exportedAssets.push(await archiveAsset(zip, assets[index], index, warnings));
			}
			var manifest = {
				format: 'cardconjurer-project-library',
				formatVersion: 1,
				exportedAt: new Date().toISOString(),
				projects: JSON.parse(JSON.stringify(projects)),
				assets: exportedAssets
			};
			zip.file('manifest.json', JSON.stringify(manifest, null, 2));
			var archive = await zip.generateAsync({
				type: 'blob',
				mimeType: 'application/zip',
				compression: 'DEFLATE',
				compressionOptions: {level: 6}
			});
			var date = new Date().toISOString().slice(0, 10);
			downloadBlob(archive, 'CardConjurer-Project-Library-' + date + '.cclibrary');
			var message = 'Exported ' + projects.length + ' project' + (projects.length === 1 ? '' : 's') +
				' and ' + exportedAssets.length + ' asset' + (exportedAssets.length === 1 ? '' : 's') + '.';
			if (warnings.length) {
				message += ' ' + warnings.length + ' linked image' + (warnings.length === 1 ? '' : 's') + ' still require their original URL.';
			}
			setStatus('#frame-library-status', message, false);
		} catch (error) {
			setStatus('#frame-library-status', error.message, true);
		}
	}

	async function putImportedLibraryBundle(assetRecords, projectRecords) {
		var database = await openDatabase();
		var transaction = database.transaction([ASSET_STORE, PROJECT_STORE], 'readwrite');
		var assetStore = transaction.objectStore(ASSET_STORE);
		var projectStore = transaction.objectStore(PROJECT_STORE);
		assetRecords.forEach(function (asset) { assetStore.put(asset); });
		projectRecords.forEach(function (project) { projectStore.put(project); });
		await transactionFinished(transaction);
	}

	async function importProjectLibrary(file) {
		if (!file) { return; }
		try {
			await ensureReady();
			ensureProjectArchiveSupport();
			var zip = await JSZip.loadAsync(file);
			var manifestEntry = zip.file('manifest.json');
			if (!manifestEntry) {
				throw new Error('This file is not a Card Conjurer project-library backup.');
			}
			var manifest;
			try {
				manifest = JSON.parse(await manifestEntry.async('string'));
			} catch (error) {
				throw new Error('The library manifest is damaged or unreadable.');
			}
			if (!manifest || manifest.format !== 'cardconjurer-project-library' || manifest.formatVersion !== 1) {
				throw new Error('This backup uses an unsupported project-library format.');
			}
			var assetMetadata = Array.isArray(manifest.assets) ? manifest.assets : [];
			var projectMetadata = Array.isArray(manifest.projects) ? manifest.projects : [];
			if (assetMetadata.length > 5000 || projectMetadata.length > 1000) {
				throw new Error('This library contains too many records to import safely.');
			}
			var idMap = Object.create(null);
			var tokenMap = Object.create(null);
			var familyMap = Object.create(null);
			var claimedTokens = new Set(getCustomSymbolAssets().map(function (asset) {
				return normalizeCustomSymbolToken(asset.token);
			}));
			var claimedFamilies = new Set(getSetSymbolFamilies().map(function (family) { return family.family; }));
			var importedAssets = [];
			var now = new Date().toISOString();

			for (var index = 0; index < assetMetadata.length; index++) {
				var metadata = assetMetadata[index] || {};
				var oldId = String(metadata.id || '');
				if (!oldId || idMap[oldId]) {
					throw new Error('The library contains an invalid or duplicate asset identifier.');
				}
				var record = {
					id: makeId('asset'),
					name: extensionlessName(metadata.name),
					kind: metadata.kind || 'frame',
					mimeType: metadata.mimeType || '',
					createdAt: metadata.createdAt || now,
					updatedAt: now
				};
				idMap[oldId] = record.id;
				if (record.kind === 'custom-symbol') {
					var oldToken = normalizeCustomSymbolToken(metadata.token);
					if (!oldToken) { throw new Error('A custom mana symbol is missing its code.'); }
					record.token = uniqueImportedSymbolToken(oldToken, claimedTokens);
					tokenMap[oldToken] = record.token;
				} else if (record.kind === 'custom-set-symbol') {
					var oldFamily = normalizeSetSymbolFamily(metadata.family);
					if (!oldFamily) { throw new Error('A set-symbol image is missing its family code.'); }
					if (!familyMap[oldFamily]) {
						familyMap[oldFamily] = uniqueImportedSetSymbolFamily(oldFamily, claimedFamilies);
					}
					record.family = familyMap[oldFamily];
					record.familyName = record.family.toUpperCase();
					record.rarity = normalizeSetSymbolRarity(metadata.rarity);
				}
				if (metadata.file) {
					var archivePath = String(metadata.file);
					if (!/^assets\/[A-Za-z0-9._-]+$/.test(archivePath)) {
						throw new Error('The library contains an unsafe asset path.');
					}
					var entry = zip.file(archivePath);
					if (!entry) { throw new Error('The library is missing "' + archivePath + '".'); }
					var blob = await entry.async('blob');
					record.blob = record.mimeType ? new Blob([blob], {type:record.mimeType}) : blob;
					record.mimeType = record.blob.type || record.mimeType;
				} else if (metadata.sourceUrl) {
					record.sourceUrl = String(metadata.sourceUrl);
				} else {
					throw new Error('A library asset does not contain image data.');
				}
				importedAssets.push(record);
			}

			var claimedProjectNames = new Set(projects.map(function (project) {
				return String(project.name || '').trim().toLowerCase();
			}));
			var importedProjects = [];
			var missingReferences = 0;
			projectMetadata.forEach(function (sourceProject) {
				if (!sourceProject || !sourceProject.card) { return; }
				var referencedIds = Array.from(collectAssetIds(sourceProject.card));
				missingReferences += referencedIds.filter(function (id) { return !idMap[id]; }).length;
				var importedCard = rewriteAssetReferences(JSON.parse(JSON.stringify(sourceProject.card)), idMap);
				importedCard = rewriteCustomSymbolReferences(importedCard, tokenMap);
				importedCard = rewriteSetSymbolFamilyReferences(importedCard, familyMap);
				if (importedCard.setSymbolAssetId && idMap[importedCard.setSymbolAssetId]) {
					importedCard.setSymbolAssetId = idMap[importedCard.setSymbolAssetId];
				}
				importedProjects.push({
					id: makeId('project'),
					name: uniqueImportedProjectName(sourceProject.name, claimedProjectNames),
					schemaVersion: sourceProject.schemaVersion || 1,
					card: importedCard,
					createdAt: now,
					updatedAt: now,
					importedAt: now
				});
			});
			await putImportedLibraryBundle(importedAssets, importedProjects);
			await Promise.all([
				refreshAssets(),
				refreshProjects(importedProjects.length ? importedProjects[0].id : undefined)
			]);
			var message = 'Imported ' + importedProjects.length + ' project' + (importedProjects.length === 1 ? '' : 's') +
				' and ' + importedAssets.length + ' asset' + (importedAssets.length === 1 ? '' : 's') + '.';
			if (missingReferences) {
				message += ' Warning: ' + missingReferences + ' project asset reference' + (missingReferences === 1 ? ' was' : 's were') + ' already missing from the backup.';
			}
			setStatus('#frame-library-status', message, !!missingReferences);
		} catch (error) {
			setStatus('#frame-library-status', error.message, true);
		}
	}

	function rewriteAssetReferences(value, idMap, visited) {
		visited = visited || new Set();
		if (typeof value === 'string') {
			var match = value.match(/^asset:\/\/(.+)$/);
			return match && idMap[match[1]] ? 'asset://' + idMap[match[1]] : value;
		}
		if (!value || typeof value !== 'object' || visited.has(value)) {
			return value;
		}
		visited.add(value);
		if (value.assetId && idMap[String(value.assetId)]) {
			value.assetId = idMap[String(value.assetId)];
		}
		if (Array.isArray(value)) {
			for (var index = 0; index < value.length; index++) {
				value[index] = rewriteAssetReferences(value[index], idMap, visited);
			}
		} else {
			Object.keys(value).forEach(function (key) {
				value[key] = rewriteAssetReferences(value[key], idMap, visited);
			});
		}
		return value;
	}

	function rewriteCustomSymbolReferences(value, tokenMap, visited) {
		visited = visited || new Set();
		if (typeof value === 'string') {
			return value.replace(/\{([^{}]+)\}/g, function (match, token) {
				var replacement = tokenMap[normalizeCustomSymbolToken(token)];
				return replacement ? '{' + replacement + '}' : match;
			});
		}
		if (!value || typeof value !== 'object' || visited.has(value)) {
			return value;
		}
		visited.add(value);
		if (value.token && tokenMap[normalizeCustomSymbolToken(value.token)]) {
			value.token = tokenMap[normalizeCustomSymbolToken(value.token)];
		}
		if (Array.isArray(value)) {
			for (var index = 0; index < value.length; index++) {
				value[index] = rewriteCustomSymbolReferences(value[index], tokenMap, visited);
			}
		} else {
			Object.keys(value).forEach(function (key) {
				value[key] = rewriteCustomSymbolReferences(value[key], tokenMap, visited);
			});
		}
		return value;
	}

	function rewriteSetSymbolFamilyReferences(value, familyMap, visited) {
		visited = visited || new Set();
		if (!value || typeof value !== 'object' || visited.has(value)) {
			return value;
		}
		visited.add(value);
		if (value.setSymbolFamily && familyMap[normalizeSetSymbolFamily(value.setSymbolFamily)]) {
			var oldFamily = normalizeSetSymbolFamily(value.setSymbolFamily);
			value.setSymbolFamily = familyMap[oldFamily];
			if (String(value.infoSet || '').toLowerCase() === oldFamily) {
				value.infoSet = familyMap[oldFamily].toUpperCase();
			}
		}
		if (value.family && familyMap[normalizeSetSymbolFamily(value.family)]) {
			value.family = familyMap[normalizeSetSymbolFamily(value.family)];
		}
		if (Array.isArray(value)) {
			value.forEach(function (item) { rewriteSetSymbolFamilyReferences(item, familyMap, visited); });
		} else {
			Object.keys(value).forEach(function (key) {
				rewriteSetSymbolFamilyReferences(value[key], familyMap, visited);
			});
		}
		return value;
	}

	function uniqueImportedProjectName(value, claimedNames) {
		var base = String(value || 'Imported Frame Project').trim() || 'Imported Frame Project';
		var used = claimedNames || new Set(projects.map(function (project) {
			return String(project.name || '').trim().toLowerCase();
		}));
		if (!used.has(base.toLowerCase())) {
			used.add(base.toLowerCase());
			return base;
		}
		var suffix = ' (Imported)';
		var candidate = base + suffix;
		var counter = 2;
		while (used.has(candidate.toLowerCase())) {
			candidate = base + suffix + ' ' + counter;
			counter++;
		}
		used.add(candidate.toLowerCase());
		return candidate;
	}

	async function putImportedBundle(assetRecords, projectRecord) {
		var database = await openDatabase();
		var transaction = database.transaction([ASSET_STORE, PROJECT_STORE], 'readwrite');
		var assetStore = transaction.objectStore(ASSET_STORE);
		assetRecords.forEach(function (asset) { assetStore.put(asset); });
		transaction.objectStore(PROJECT_STORE).put(projectRecord);
		await transactionFinished(transaction);
	}

	async function importProjectFile(file) {
		if (!file) {
			return;
		}
		try {
			await ensureReady();
			ensureProjectArchiveSupport();
			var zip = await JSZip.loadAsync(file);
			var manifestEntry = zip.file('manifest.json');
			if (!manifestEntry) {
				throw new Error('This file is not a Card Conjurer project backup.');
			}
			var manifest;
			try {
				manifest = JSON.parse(await manifestEntry.async('string'));
			} catch (error) {
				throw new Error('The project manifest is damaged or unreadable.');
			}
			if (!manifest || manifest.format !== 'cardconjurer-frame-project' || manifest.formatVersion !== 1 || !manifest.project || !manifest.project.card) {
				throw new Error('This project backup uses an unsupported format.');
			}
			var assetMetadata = Array.isArray(manifest.assets) ? manifest.assets : [];
			if (assetMetadata.length > 1000) {
				throw new Error('This project contains too many assets to import safely.');
			}
			var idMap = Object.create(null);
			var tokenMap = Object.create(null);
			var importedAssets = [];
			var claimedTokens = new Set(getCustomSymbolAssets().map(function (asset) {
				return normalizeCustomSymbolToken(asset.token);
			}));
			var familyMap = Object.create(null);
			var claimedFamilies = new Set(getSetSymbolFamilies().map(function (family) { return family.family; }));
			var now = new Date().toISOString();

			for (var index = 0; index < assetMetadata.length; index++) {
				var metadata = assetMetadata[index] || {};
				var oldId = String(metadata.id || '');
				if (!oldId || idMap[oldId]) {
					throw new Error('The project backup contains an invalid or duplicate asset identifier.');
				}
				var newId = makeId('asset');
				idMap[oldId] = newId;
				var record = {
					id: newId,
					name: extensionlessName(metadata.name),
					kind: metadata.kind || 'frame',
					mimeType: metadata.mimeType || '',
					createdAt: metadata.createdAt || now,
					updatedAt: now
				};
				if (record.kind === 'custom-symbol') {
					var oldToken = normalizeCustomSymbolToken(metadata.token);
					if (!oldToken) {
						throw new Error('The project backup contains a custom symbol without a code.');
					}
					record.token = uniqueImportedSymbolToken(oldToken, claimedTokens);
					tokenMap[oldToken] = record.token;
				} else if (record.kind === 'custom-set-symbol') {
					var oldFamily = normalizeSetSymbolFamily(metadata.family);
					if (!oldFamily) {
						throw new Error('The project backup contains a set symbol without a family code.');
					}
					if (!familyMap[oldFamily]) {
						familyMap[oldFamily] = uniqueImportedSetSymbolFamily(oldFamily, claimedFamilies);
					}
					record.family = familyMap[oldFamily];
					record.familyName = record.family.toUpperCase();
					record.rarity = normalizeSetSymbolRarity(metadata.rarity);
				}
				if (metadata.file) {
					var archivePath = String(metadata.file);
					if (!/^assets\/[A-Za-z0-9._-]+$/.test(archivePath)) {
						throw new Error('The project backup contains an unsafe asset path.');
					}
					var assetEntry = zip.file(archivePath);
					if (!assetEntry) {
						throw new Error('The project backup is missing "' + archivePath + '".');
					}
					var importedBlob = await assetEntry.async('blob');
					record.blob = record.mimeType ? new Blob([importedBlob], {type: record.mimeType}) : importedBlob;
					record.mimeType = record.blob.type || record.mimeType;
				} else if (metadata.sourceUrl) {
					record.sourceUrl = String(metadata.sourceUrl);
				} else {
					throw new Error('The project backup contains an asset without image data.');
				}
				importedAssets.push(record);
			}

			var referencedIds = Array.from(collectAssetIds(manifest.project.card));
			var missingIds = referencedIds.filter(function (id) { return !idMap[id]; });
			if (missingIds.length) {
				throw new Error('The project backup is incomplete and is missing ' + missingIds.length + ' referenced asset' + (missingIds.length === 1 ? '' : 's') + '.');
			}
			var importedCard = rewriteAssetReferences(JSON.parse(JSON.stringify(manifest.project.card)), idMap);
			importedCard = rewriteCustomSymbolReferences(importedCard, tokenMap);
			importedCard = rewriteSetSymbolFamilyReferences(importedCard, familyMap);
			if (importedCard.setSymbolAssetId && idMap[importedCard.setSymbolAssetId]) {
				importedCard.setSymbolAssetId = idMap[importedCard.setSymbolAssetId];
			}
			var importedProject = {
				id: makeId('project'),
				name: uniqueImportedProjectName(manifest.project.name),
				schemaVersion: manifest.project.schemaVersion || 1,
				card: importedCard,
				createdAt: now,
				updatedAt: now,
				importedAt: now
			};
			await putImportedBundle(importedAssets, importedProject);
			await Promise.all([refreshAssets(), refreshProjects(importedProject.id)]);
			setStatus('#frame-project-status', 'Imported "' + importedProject.name + '" with ' + importedAssets.length + ' asset' + (importedAssets.length === 1 ? '' : 's') + '. It is selected and ready to load.', false);
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
		}
	}

	function ensureReady() {
		if (!readyPromise) {
			readyPromise = init();
		}
		return readyPromise;
	}

	async function init() {
		try {
			if (!blankProjectCard && typeof card === 'object' && card) {
				blankProjectCard = JSON.parse(JSON.stringify(card, stripRuntimeImages));
			}
			await Promise.all([refreshAssets(), refreshProjects()]);
			var pendingProjectName = sessionStorage.getItem('cardconjurer-new-project-name');
			if (pendingProjectName !== null) {
				sessionStorage.removeItem('cardconjurer-new-project-name');
				setStatus('#frame-project-status', 'Starting new project...', false);
				setTimeout(function () { startNewProject(pendingProjectName, true); }, 0);
			} else {
				setStatus('#frame-project-status', 'Frame projects are stored on this device. Export a .ccproject backup to keep a portable copy.', false);
			}
			var frameAssetCount = assets.filter(function (asset) { return !['custom-symbol', 'custom-set-symbol', 'set-symbol-single'].includes(asset.kind); }).length;
			var customSymbolCount = getCustomSymbolAssets().length;
			setStatus('#frame-asset-status', frameAssetCount ? frameAssetCount + ' saved frame asset' + (frameAssetCount === 1 ? '' : 's') + ' available.' : 'No saved frame assets yet.', false);
			setStatus('#custom-symbol-status', customSymbolCount ? customSymbolCount + ' custom symbol' + (customSymbolCount === 1 ? '' : 's') + ' ready.' : 'No custom symbols saved yet.', false);
			var setFamilyCount = getSetSymbolFamilies().length;
			setStatus('#custom-set-symbol-status', setFamilyCount ? setFamilyCount + ' custom set-symbol famil' + (setFamilyCount === 1 ? 'y' : 'ies') + ' ready.' : 'No custom set-symbol families saved yet.', false);
		} catch (error) {
			setStatus('#frame-project-status', error.message, true);
			setStatus('#frame-asset-status', error.message, true);
		}
	}

	window.addEventListener('beforeunload', function () {
		objectUrls.forEach(function (url) { URL.revokeObjectURL(url); });
		objectUrls.clear();
	});

	window.FrameProjectStore = {
		init: init,
		importFiles: importFiles,
		importUrl: importUrl,
		addSelectedAsset: addSelectedAsset,
		deleteSelectedAsset: deleteSelectedAsset,
		saveProject: function () { return saveProject(false); },
		saveProjectAs: function () { return saveProject(true); },
		startNewProject: startNewProject,
		loadSelectedProject: loadSelectedProject,
		viewCurrentProjectAssets: viewCurrentProjectAssets,
		deleteSelectedProject: deleteSelectedProject,
		exportSelectedProject: exportSelectedProject,
		importProjectFile: importProjectFile,
		exportProjectLibrary: exportProjectLibrary,
		importProjectLibrary: importProjectLibrary,
		saveCustomSymbol: saveCustomSymbol,
		renameSelectedCustomSymbol: renameSelectedCustomSymbol,
		deleteSelectedCustomSymbol: deleteSelectedCustomSymbol,
		insertSelectedCustomSymbol: insertSelectedCustomSymbol,
		previewSelectedCustomSymbol: previewSelectedCustomSymbol,
		saveCustomSetSymbolFamily: saveCustomSetSymbolFamily,
		previewSelectedSetSymbolFamily: previewSelectedSetSymbolFamily,
		applySelectedSetSymbolFamily: applySelectedSetSymbolFamily,
		deleteSelectedSetSymbolFamily: deleteSelectedSetSymbolFamily,
		getCustomSetSymbolSource: getCustomSetSymbolSource,
		applyCustomSetSymbolFamily: applyCustomSetSymbolFamily,
		saveSourceAsset: saveSourceAsset,
		getAssetSource: getAssetSource,
		getAssets: function () { return assets.slice(); },
		getProjects: function () { return JSON.parse(JSON.stringify(projects)); },
		getProjectCardByName: getProjectCardByName,
		ready: ensureReady,
		sourceFromParams: sourceFromParams
	};

	readyPromise = init();
})();
