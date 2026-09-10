(function () {
	'use strict';

	var DATABASE_NAME = 'cardconjurer-frame-designer';
	var DATABASE_VERSION = 1;
	var ASSET_STORE = 'assets';
	var PROJECT_STORE = 'projects';
	var dbPromise = null;
	var assets = [];
	var projects = [];
	var currentProjectId = '';
	var objectUrls = new Map();

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

	function renderAssetOptions(selectedId) {
		var select = document.querySelector('#frame-asset-list');
		if (!select) {
			return;
		}
		select.innerHTML = '';
		if (!assets.length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No saved frame assets';
			select.appendChild(empty);
			select.disabled = true;
			return;
		}
		select.disabled = false;
		assets.forEach(function (asset) {
			var option = document.createElement('option');
			option.value = asset.id;
			option.textContent = asset.name + (asset.kind === 'mask' ? ' (mask)' : '');
			select.appendChild(option);
		});
		if (selectedId && assets.some(function (asset) { return asset.id === selectedId; })) {
			select.value = selectedId;
		}
	}

	async function refreshAssets(selectedId) {
		assets = (await getAll(ASSET_STORE)).sort(function (left, right) {
			return left.name.localeCompare(right.name);
		});
		renderAssetOptions(selectedId);
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
			if (asset.kind === 'mask' && selectedFrame) {
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
		if (String(layer.src || '').indexOf('data:') === 0) {
			var asset = await saveSourceAsset(layer.src, layer.name || 'Project image', kind);
			layer.assetId = asset.id;
			layer.src = 'asset://' + asset.id;
		}
	}

	async function createProjectSnapshot() {
		var snapshot = JSON.parse(JSON.stringify(card, stripRuntimeImages));
		snapshot.frames = snapshot.frames || [];
		for (var frame of snapshot.frames) {
			await externalizeLayerImage(frame, 'frame');
			frame.masks = frame.masks || [];
			for (var mask of frame.masks) {
				await externalizeLayerImage(mask, 'mask');
			}
		}
		if (String(snapshot.artSource || '').indexOf('data:') === 0 || String(snapshot.artSource || '').indexOf('blob:') === 0) {
			snapshot.artSource = '/img/blank.png';
		}
		return snapshot;
	}

	async function hydrateLayerImage(layer) {
		if (!layer) {
			return;
		}
		var match = String(layer.src || '').match(/^asset:\/\/(.+)$/);
		if (match) {
			layer.assetId = match[1];
			layer.src = await getAssetSource(match[1]);
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
	}

	async function saveProject(asNew) {
		var input = document.querySelector('#frame-project-name');
		var name = String(input ? input.value : '').trim();
		if (!name) {
			setStatus('#frame-project-status', 'Enter a project name first.', true);
			return;
		}
		try {
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
			currentProjectId = project.id;
			var input = document.querySelector('#frame-project-name');
			if (input) { input.value = project.name; }
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

	async function init() {
		try {
			await Promise.all([refreshAssets(), refreshProjects()]);
			setStatus('#frame-project-status', 'Frame projects are stored on this device.', false);
			setStatus('#frame-asset-status', assets.length ? assets.length + ' saved frame asset' + (assets.length === 1 ? '' : 's') + ' available.' : 'No saved frame assets yet.', false);
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
		loadSelectedProject: loadSelectedProject,
		deleteSelectedProject: deleteSelectedProject,
		saveSourceAsset: saveSourceAsset,
		getAssetSource: getAssetSource,
		sourceFromParams: sourceFromParams
	};

	init();
})();
