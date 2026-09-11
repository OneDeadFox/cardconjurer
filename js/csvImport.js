(function () {
	'use strict';

	var state = {
		fileName: '',
		headers: [],
		rows: [],
		mappings: [],
		structuralErrors: []
	};

	var fieldGroups = [
		{
			label: 'General',
			fields: [
				['field:cardId', 'Card ID'],
				['field:include', 'Include'],
				['field:name', 'Name'],
				['field:chunk', 'Player'],
				['field:outputFilename', 'Output Filename']
			]
		},
		{
			label: 'Color and cost',
			fields: [
				['field:color', 'Color'],
				['field:colorIdentity', 'Color Identity'],
				['field:manaCost', 'Mana Cost'],
				['field:manaValue', 'Mana Value']
			]
		},
		{
			label: 'Primary face',
			fields: [
				['field:rarity', 'Rarity'],
				['field:typeLine', 'Type Line'],
				['field:supertype1', 'Supertype 1'],
				['field:supertype2', 'Supertype 2'],
				['field:supertype3', 'Supertype 3'],
				['field:cardType1', 'Card Type 1'],
				['field:cardType2', 'Card Type 2'],
				['field:cardType3', 'Card Type 3'],
				['field:subtype1', 'Subtype 1'],
				['field:subtype2', 'Subtype 2'],
				['field:subtype3', 'Subtype 3'],
				['field:ability1', 'Ability 1'],
				['field:ability2', 'Ability 2'],
				['field:ability3', 'Ability 3'],
				['field:ability4', 'Ability 4'],
				['field:flavorText', 'Flavor Text'],
				['field:power', 'Power'],
				['field:toughness', 'Toughness'],
				['field:loyalty', 'Loyalty'],
				['field:defense', 'Defense'],
				['field:artFile', 'Art File'],
				['field:artUrl', 'Art URL'],
				['field:artist', 'Artist']
			]
		},
		{
			label: 'Alternate face',
			fields: [
				['field:altName', 'Alt Name'],
				['field:altColor', 'Alt Color'],
				['field:altColorIdentity', 'Alt Color Identity'],
				['field:altManaCost', 'Alt Mana Cost'],
				['field:altTypeLine', 'Alt Type Line'],
				['field:altAbility1', 'Alt Ability 1'],
				['field:altAbility2', 'Alt Ability 2'],
				['field:altAbility3', 'Alt Ability 3'],
				['field:altAbility4', 'Alt Ability 4'],
				['field:altFlavorText', 'Alt Flavor Text'],
				['field:altPower', 'Alt Power'],
				['field:altToughness', 'Alt Toughness'],
				['field:altArtFile', 'Alt Art File'],
				['field:altArtUrl', 'Alt Art URL'],
				['field:altArtist', 'Alt Artist'],
				['field:transform', 'Transform'],
				['field:flip', 'Flip']
			]
		},
		{
			label: 'Printing and generation',
			fields: [
				['field:setCode', 'Set Code'],
				['field:collectorNumber', 'Collector Number'],
				['field:language', 'Language'],
				['field:year', 'Year'],
				['field:frameType', 'Frame Type'],
				['field:frameVariant', 'Frame Variant'],
				['field:template', 'Saved Frame Project (Template)']
			]
		}
	];

	var featureDefinitions = [
		{group:'Artwork controls', id:'artX', label:'Art X (editor pixels)', property:'artX', input:'#art-x', unit:'x'},
		{group:'Artwork controls', id:'artY', label:'Art Y (editor pixels)', property:'artY', input:'#art-y', unit:'y'},
		{group:'Artwork controls', id:'artZoom', label:'Art Scale (%)', property:'artZoom', input:'#art-zoom', unit:'percent'},
		{group:'Artwork controls', id:'artRotate', label:'Art Rotation (degrees)', property:'artRotate', input:'#art-rotate', unit:'number'},
		{group:'Artwork controls', id:'artGrayscale', label:'Art Grayscale (boolean)', input:'#grayscale-art', unit:'boolean'},
		{group:'Set symbol controls', id:'setSymbolX', label:'Set Symbol X (editor pixels)', property:'setSymbolX', input:'#setSymbol-x', unit:'x'},
		{group:'Set symbol controls', id:'setSymbolY', label:'Set Symbol Y (editor pixels)', property:'setSymbolY', input:'#setSymbol-y', unit:'y'},
		{group:'Set symbol controls', id:'setSymbolZoom', label:'Set Symbol Scale (%)', property:'setSymbolZoom', input:'#setSymbol-zoom', unit:'percent'},
		{group:'Watermark controls', id:'watermarkX', label:'Watermark X (editor pixels)', property:'watermarkX', input:'#watermark-x', unit:'x'},
		{group:'Watermark controls', id:'watermarkY', label:'Watermark Y (editor pixels)', property:'watermarkY', input:'#watermark-y', unit:'y'},
		{group:'Watermark controls', id:'watermarkZoom', label:'Watermark Scale (%)', property:'watermarkZoom', input:'#watermark-zoom', unit:'percent'},
		{group:'Watermark controls', id:'watermarkOpacity', label:'Watermark Opacity (%)', property:'watermarkOpacity', input:'#watermark-opacity', unit:'percent'}
	];

	window.CSVFeatureRegistry = {
		definitions: featureDefinitions.slice(),
		get: function (id) {
			return featureDefinitions.find(function (definition) {
				return definition.id === id;
			}) || null;
		}
	};

	var aliases = {
		cardid: 'field:cardId',
		id: 'field:cardId',
		include: 'field:include',
		generate: 'field:include',
		name: 'field:name',
		cardname: 'field:name',
		player: 'field:chunk',
		chunk: 'field:chunk',
		group: 'field:chunk',
		owner: 'field:chunk',
		outputfilename: 'field:outputFilename',
		filename: 'field:outputFilename',
		color: 'field:color',
		colour: 'field:color',
		coloridentity: 'field:colorIdentity',
		colouridentity: 'field:colorIdentity',
		identity: 'field:colorIdentity',
		cost: 'field:manaCost',
		manacost: 'field:manaCost',
		manavalue: 'field:manaValue',
		mv: 'field:manaValue',
		rarity: 'field:rarity',
		typeline: 'field:typeLine',
		creaturetype: 'field:typeLine',
		supertype1: 'field:supertype1',
		supertype2: 'field:supertype2',
		supertype3: 'field:supertype3',
		cardtype: 'field:cardType1',
		cardtype1: 'field:cardType1',
		cardtype2: 'field:cardType2',
		cardtype3: 'field:cardType3',
		subtype: 'field:subtype1',
		subtype1: 'field:subtype1',
		subtype2: 'field:subtype2',
		subtype3: 'field:subtype3',
		ability: 'field:ability1',
		rulestext: 'field:ability1',
		oracletext: 'field:ability1',
		ability1: 'field:ability1',
		ability2: 'field:ability2',
		ability3: 'field:ability3',
		ability4: 'field:ability4',
		flavortext: 'field:flavorText',
		flavor: 'field:flavorText',
		power: 'field:power',
		toughness: 'field:toughness',
		loyalty: 'field:loyalty',
		defense: 'field:defense',
		defence: 'field:defense',
		artfile: 'field:artFile',
		artfilename: 'field:artFile',
		arturl: 'field:artUrl',
		artist: 'field:artist',
		artx: 'feature:artX',
		arty: 'feature:artY',
		artscale: 'feature:artZoom',
		artzoom: 'feature:artZoom',
		artrotation: 'feature:artRotate',
		artrotate: 'feature:artRotate',
		artgrayscale: 'feature:artGrayscale',
		grayscaleart: 'feature:artGrayscale',
		altname: 'field:altName',
		alternatename: 'field:altName',
		altcolor: 'field:altColor',
		altcoloridentity: 'field:altColorIdentity',
		altidentity: 'field:altColorIdentity',
		altcost: 'field:altManaCost',
		altmanacost: 'field:altManaCost',
		alternatemanacost: 'field:altManaCost',
		alttypeline: 'field:altTypeLine',
		alttype: 'field:altTypeLine',
		altcreaturetype: 'field:altTypeLine',
		alternatetypeline: 'field:altTypeLine',
		alternatetype: 'field:altTypeLine',
		alternatecreaturetype: 'field:altTypeLine',
		altability1: 'field:altAbility1',
		altability2: 'field:altAbility2',
		altability3: 'field:altAbility3',
		altability4: 'field:altAbility4',
		altflavortext: 'field:altFlavorText',
		altflavor: 'field:altFlavorText',
		altpower: 'field:altPower',
		alttoughness: 'field:altToughness',
		altartfile: 'field:altArtFile',
		altart: 'field:altArtFile',
		alternateartfile: 'field:altArtFile',
		alternateart: 'field:altArtFile',
		altarturl: 'field:altArtUrl',
		alternatearturl: 'field:altArtUrl',
		altartist: 'field:altArtist',
		alternateartist: 'field:altArtist',
		transform: 'field:transform',
		flip: 'field:flip',
		setcode: 'field:setCode',
		set: 'field:setCode',
		collectornumber: 'field:collectorNumber',
		cardnumber: 'field:collectorNumber',
		language: 'field:language',
		lang: 'field:language',
		year: 'field:year',
		frametype: 'field:frameType',
		frame: 'field:frameType',
		framevariant: 'field:frameVariant',
		framestyle: 'field:frameVariant',
		framesubtype: 'field:frameVariant',
		setsymbolx: 'feature:setSymbolX',
		setsymboly: 'feature:setSymbolY',
		setsymbolscale: 'feature:setSymbolZoom',
		setsymbolzoom: 'feature:setSymbolZoom',
		watermarkx: 'feature:watermarkX',
		watermarky: 'feature:watermarkY',
		watermarkscale: 'feature:watermarkZoom',
		watermarkzoom: 'feature:watermarkZoom',
		watermarkopacity: 'feature:watermarkOpacity',
		template: 'field:template'
	};

	function normalizeHeader(value) {
		return String(value || '').trim().toLowerCase().replace(/[^a-z0-9]+/g, '');
	}

	function parseCSV(text) {
		var rows = [];
		var row = [];
		var field = '';
		var quoted = false;
		var lineNumber = 1;

		for (var index = 0; index < text.length; index++) {
			var character = text[index];

			if (quoted) {
				if (character === '"') {
					if (text[index + 1] === '"') {
						field += '"';
						index++;
					} else {
						quoted = false;
					}
				} else {
					field += character;
					if (character === '\n') {
						lineNumber++;
					}
				}
				continue;
			}

			if (character === '"' && field.length === 0) {
				quoted = true;
			} else if (character === ',') {
				row.push(field);
				field = '';
			} else if (character === '\r' || character === '\n') {
				if (character === '\r' && text[index + 1] === '\n') {
					index++;
				}
				row.push(field);
				rows.push(row);
				row = [];
				field = '';
				lineNumber++;
			} else {
				field += character;
			}
		}

		if (quoted) {
			throw new Error('An opening quote was not closed near line ' + lineNumber + '.');
		}

		if (field.length > 0 || row.length > 0) {
			row.push(field);
			rows.push(row);
		}

		while (rows.length && rows[rows.length - 1].every(function (value) {
			return String(value).trim() === '';
		})) {
			rows.pop();
		}

		return rows;
	}

	function makeStructuralData(parsedRows) {
		if (!parsedRows.length) {
			throw new Error('The CSV file is empty.');
		}

		var headers = parsedRows.shift().map(function (header, index) {
			var cleaned = String(header).trim();
			if (index === 0) {
				cleaned = cleaned.replace(/^\uFEFF/, '');
			}
			return cleaned;
		});

		if (!headers.length || headers.every(function (header) { return !header; })) {
			throw new Error('The CSV file does not contain a header row.');
		}

		var errors = [];
		var seenHeaders = {};

		headers.forEach(function (header, index) {
			if (!header) {
				errors.push('Column ' + (index + 1) + ' has a blank header.');
				return;
			}
			var normalized = normalizeHeader(header);
			if (seenHeaders[normalized] !== undefined) {
				errors.push('Duplicate header "' + header + '" in columns ' + (seenHeaders[normalized] + 1) + ' and ' + (index + 1) + '.');
			} else {
				seenHeaders[normalized] = index;
			}
		});

		var rows = parsedRows.filter(function (sourceRow) {
			return sourceRow.some(function (value) { return String(value).trim() !== ''; });
		}).map(function (sourceRow, rowIndex) {
			var row = sourceRow.slice();
			if (row.length !== headers.length) {
				errors.push('Row ' + (rowIndex + 2) + ' contains ' + row.length + ' values; expected ' + headers.length + '.');
			}
			while (row.length < headers.length) {
				row.push('');
			}
			return row.slice(0, headers.length);
		});

		return {
			headers: headers,
			rows: rows,
			errors: errors
		};
	}

	function savedFrameProjects() {
		if (!window.FrameProjectStore || typeof FrameProjectStore.getProjects !== 'function') {
			return [];
		}
		return FrameProjectStore.getProjects();
	}

	function getTargets() {
		var groups = fieldGroups.map(function (group) {
			return {
				label: group.label,
				fields: group.fields.slice()
			};
		});

		var textFields = [];
		var seenTextFields = {};
		if (window.card && card.text) {
			Object.keys(card.text).forEach(function (key) {
				var textField = card.text[key] || {};
				var label = textField.csvFieldLabel || textField.name || key;
				var target = 'textbox:' + key;
				seenTextFields[target] = true;
				textFields.push([target, 'Text field: ' + label + ' (' + key + ')']);
			});
		}
		savedFrameProjects().forEach(function (project) {
			Object.keys((project.card && project.card.text) || {}).forEach(function (key) {
				var textField = project.card.text[key] || {};
				var target = 'textbox:' + key;
				if (!textField.customField || seenTextFields[target]) {
					return;
				}
				seenTextFields[target] = true;
				var label = textField.csvFieldLabel || textField.name || key;
				textFields.push([target, 'Text field: ' + label + ' (' + project.name + ')']);
			});
		});
		if (textFields.length) {
			groups.push({
				label: 'Available template text fields',
				fields: textFields
			});
		}

		var imageFields = [];
		var seenImageFields = {};
		function collectImageField(frame, projectName) {
			var key = frame.csvImageFieldKey;
			if (!key || seenImageFields[key]) {
				return;
			}
			seenImageFields[key] = true;
			var label = frame.csvFieldLabel || frame.name || key;
			imageFields.push(['imagefield:' + key, 'Image field: ' + label + (projectName ? ' (' + projectName + ')' : '')]);
		}
		if (window.card && card.frames) {
			card.frames.forEach(function (frame) { collectImageField(frame, ''); });
		}
		savedFrameProjects().forEach(function (project) {
			((project.card && project.card.frames) || []).forEach(function (frame) {
				collectImageField(frame, project.name);
			});
		});
		if (imageFields.length) {
			groups.push({
				label: 'Available template image fields',
				fields: imageFields
			});
		}

		var featureGroups = {};
		featureDefinitions.forEach(function (definition) {
			if (!featureGroups[definition.group]) {
				featureGroups[definition.group] = [];
			}
			featureGroups[definition.group].push([
				'feature:' + definition.id,
				definition.label
			]);
		});
		Object.keys(featureGroups).forEach(function (label) {
			groups.push({label: label, fields: featureGroups[label]});
		});

		var textboxControls = [];
		if (window.card && card.text) {
			Object.keys(card.text).forEach(function (key) {
				var textField = card.text[key] || {};
				var label = textField.csvFieldLabel || textField.name || key;
				[
					['x', 'X (editor pixels)'],
					['y', 'Y (editor pixels)'],
					['width', 'Width (editor pixels)'],
					['height', 'Height (editor pixels)'],
					['fontSize', 'Font-size adjustment']
				].forEach(function (property) {
					textboxControls.push([
						'textboxprop:' + key + ':' + property[0],
						label + ' — ' + property[1]
					]);
				});
			});
		}
		if (textboxControls.length) {
			groups.push({
				label: 'Current template textbox controls',
				fields: textboxControls
			});
		}

		return groups;
	}

	function getAutomaticTarget(header) {
		var normalized = normalizeHeader(header);
		if (aliases[normalized]) {
			return aliases[normalized];
		}
		function textTarget(text, key) {
			return text && text.customField &&
				normalizeHeader(text.csvFieldLabel || text.name || key) === normalized ?
				'textbox:' + key : '';
		}
		if (window.card && card.text) {
			for (var textKey of Object.keys(card.text)) {
				var currentTextTarget = textTarget(card.text[textKey], textKey);
				if (currentTextTarget) {
					return currentTextTarget;
				}
			}
		}
		for (var project of savedFrameProjects()) {
			for (var projectTextKey of Object.keys((project.card && project.card.text) || {})) {
				var projectTextTarget = textTarget(project.card.text[projectTextKey], projectTextKey);
				if (projectTextTarget) {
					return projectTextTarget;
				}
			}
		}
		function imageTarget(frame) {
			return frame && frame.csvImageFieldKey &&
				normalizeHeader(frame.csvFieldLabel || frame.name || frame.csvImageFieldKey) === normalized ?
				'imagefield:' + frame.csvImageFieldKey : '';
		}
		if (window.card && card.frames) {
			for (var frame of card.frames) {
				var currentImageTarget = imageTarget(frame);
				if (currentImageTarget) {
					return currentImageTarget;
				}
			}
		}
		for (var savedProject of savedFrameProjects()) {
			for (var projectFrame of ((savedProject.card && savedProject.card.frames) || [])) {
				var projectImageTarget = imageTarget(projectFrame);
				if (projectImageTarget) {
					return projectImageTarget;
				}
			}
		}
		return 'metadata';
	}

	function appendTargetOptions(select, selectedValue) {
		var controlGroup = document.createElement('optgroup');
		controlGroup.label = 'Column handling';

		[
			['ignore', 'Ignore'],
			['metadata', 'Keep as custom metadata']
		].forEach(function (optionData) {
			var option = document.createElement('option');
			option.value = optionData[0];
			option.textContent = optionData[1];
			controlGroup.appendChild(option);
		});
		select.appendChild(controlGroup);

		getTargets().forEach(function (group) {
			var optionGroup = document.createElement('optgroup');
			optionGroup.label = group.label;
			group.fields.forEach(function (field) {
				var option = document.createElement('option');
				option.value = field[0];
				option.textContent = field[1];
				optionGroup.appendChild(option);
			});
			select.appendChild(optionGroup);
		});

		var targetExists = Array.from(select.options).some(function (option) {
			return option.value === selectedValue;
		});
		if (!targetExists && selectedValue) {
			var unavailable = document.createElement('option');
			unavailable.value = selectedValue;
			unavailable.textContent = 'Unavailable target: ' + selectedValue;
			select.appendChild(unavailable);
		}

		select.value = selectedValue || 'metadata';
	}

	function renderMappings() {
		var container = document.querySelector('#csv-mapping-rows');
		if (!container) {
			return;
		}
		container.innerHTML = '';

		state.headers.forEach(function (header, index) {
			var mappingRow = document.createElement('div');
			mappingRow.className = 'csv-mapping-row';

			var source = document.createElement('h5');
			source.className = 'csv-mapping-source padding';
			source.textContent = header;

			var select = document.createElement('select');
			select.className = 'input';
			select.setAttribute('aria-label', 'Map CSV column ' + header);
			select.dataset.columnIndex = index;
			appendTargetOptions(select, state.mappings[index]);
			select.addEventListener('change', function () {
				state.mappings[index] = select.value;
				validateAndRenderStatus();
				if (window.CSVCardBuilder) {
					CSVCardBuilder.csvChanged();
				}
			});

			mappingRow.appendChild(source);
			mappingRow.appendChild(select);
			container.appendChild(mappingRow);
		});
	}

	function renderPreview() {
		var container = document.querySelector('#csv-preview');
		if (!container) {
			return;
		}
		container.innerHTML = '';

		var table = document.createElement('table');
		var head = document.createElement('thead');
		var headRow = document.createElement('tr');

		state.headers.forEach(function (header) {
			var cell = document.createElement('th');
			cell.textContent = header;
			headRow.appendChild(cell);
		});

		head.appendChild(headRow);
		table.appendChild(head);

		var body = document.createElement('tbody');
		state.rows.slice(0, 3).forEach(function (row) {
			var tableRow = document.createElement('tr');
			row.forEach(function (value) {
				var cell = document.createElement('td');
				cell.textContent = value;
				tableRow.appendChild(cell);
			});
			body.appendChild(tableRow);
		});

		table.appendChild(body);
		container.appendChild(table);
	}

	function parseBoolean(value) {
		var normalized = String(value || '').trim().toLowerCase();
		if (!normalized) {
			return false;
		}
		if (['true', 'yes', 'y', '1', 'x'].includes(normalized)) {
			return true;
		}
		if (['false', 'no', 'n', '0'].includes(normalized)) {
			return false;
		}
		return null;
	}

	function getMappedColumn(target) {
		return state.mappings.indexOf(target);
	}

	function getValidationErrors() {
		var errors = state.structuralErrors.slice();
		var nameIndex = getMappedColumn('field:name');

		if (nameIndex === -1) {
			errors.push('Map one CSV column to Name.');
		} else {
			state.rows.forEach(function (row, index) {
				if (!String(row[nameIndex] || '').trim()) {
					errors.push('Row ' + (index + 2) + ' is missing a card name.');
				}
			});
		}

		var transformIndex = getMappedColumn('field:transform');
		var flipIndex = getMappedColumn('field:flip');
		var templateIndex = getMappedColumn('field:template');
		var frameTypeIndex = getMappedColumn('field:frameType');
		var frameVariantIndex = getMappedColumn('field:frameVariant');
		var projectNames = savedFrameProjects().map(function (project) {
			return String(project.name || '').trim().toLowerCase();
		});

		state.rows.forEach(function (row, index) {
			var transform = transformIndex === -1 ? false : parseBoolean(row[transformIndex]);
			var flip = flipIndex === -1 ? false : parseBoolean(row[flipIndex]);
			var templateName = templateIndex === -1 ? '' : String(row[templateIndex] || '').trim();
			var frameType = frameTypeIndex === -1 ? '' : String(row[frameTypeIndex] || '').trim();
			var frameVariant = frameVariantIndex === -1 ? '' : String(row[frameVariantIndex] || '').trim();

			if (transform === null) {
				errors.push('Row ' + (index + 2) + ' has an invalid Transform value.');
			}
			if (flip === null) {
				errors.push('Row ' + (index + 2) + ' has an invalid Flip value.');
			}
			if (transform === true && flip === true) {
				errors.push('Row ' + (index + 2) + ' cannot be both Transform and Flip.');
			}
			if (templateName && (frameType || frameVariant)) {
				errors.push('Row ' + (index + 2) + ' cannot use both a saved Template and Frame Type/Variant.');
			}
			if (templateName && projectNames.indexOf(templateName.toLowerCase()) === -1) {
				errors.push('Row ' + (index + 2) + ' names an unknown saved frame project: "' + templateName + '".');
			}
		});

		var mappedSingles = {};
		state.mappings.forEach(function (target, index) {
			if (!target || target === 'ignore' || target === 'metadata' || target.indexOf('textbox:') === 0) {
				return;
			}
			if (mappedSingles[target] !== undefined) {
				errors.push('Columns "' + state.headers[mappedSingles[target]] + '" and "' + state.headers[index] + '" are both mapped to ' + target.replace('field:', '') + '.');
			} else {
				mappedSingles[target] = index;
			}
		});

		return errors;
	}

	function renderErrors(errors) {
		var container = document.querySelector('#csv-import-errors');
		if (!container) {
			return;
		}
		container.innerHTML = '';

		if (!errors.length) {
			container.classList.add('hidden');
			return;
		}

		var list = document.createElement('ul');
		errors.slice(0, 20).forEach(function (message) {
			var item = document.createElement('li');
			item.textContent = message;
			list.appendChild(item);
		});
		if (errors.length > 20) {
			var remaining = document.createElement('li');
			remaining.textContent = (errors.length - 20) + ' additional issues are not shown.';
			list.appendChild(remaining);
		}
		container.appendChild(list);
		container.classList.remove('hidden');
	}

	function validateAndRenderStatus() {
		var status = document.querySelector('#csv-import-status');
		if (!status) {
			return;
		}

		if (!state.fileName) {
			status.textContent = 'No CSV loaded.';
			renderErrors([]);
			return;
		}

		var errors = getValidationErrors();
		status.textContent = state.fileName + ': ' + state.rows.length + ' card rows and ' + state.headers.length + ' columns detected. ' +
			(errors.length ? errors.length + ' issue(s) need attention.' : 'No validation issues found.');
		renderErrors(errors);
	}

	async function loadFile(event) {
		var file = event.target.files && event.target.files[0];
		if (!file) {
			return;
		}

		state.fileName = file.name;
		state.headers = [];
		state.rows = [];
		state.mappings = [];
		state.structuralErrors = [];
		validateAndRenderStatus();

		try {
			var parsedRows = parseCSV(await file.text());
			var data = makeStructuralData(parsedRows);
			state.headers = data.headers;
			state.rows = data.rows;
			state.structuralErrors = data.errors;
			state.mappings = state.headers.map(getAutomaticTarget);

			renderMappings();
			renderPreview();
			document.querySelector('#csv-import-details').classList.remove('hidden');
			validateAndRenderStatus();
			if (window.CSVCardBuilder) {
				CSVCardBuilder.csvChanged();
			}
		} catch (error) {
			state.structuralErrors = [error.message || 'The CSV file could not be read.'];
			document.querySelector('#csv-import-details').classList.add('hidden');
			validateAndRenderStatus();
		}
	}

	function refreshTextFields() {
		if (!state.headers.length) {
			return;
		}
		state.mappings = state.mappings.map(function (mapping, index) {
			return mapping === 'metadata' ? getAutomaticTarget(state.headers[index]) : mapping;
		});
		renderMappings();
		validateAndRenderStatus();
	}


	window.addEventListener('frameprojectschanged', function () {
		refreshTextFields();
	});

	window.CSVImporter = {
		loadFile: loadFile,
		refreshTextFields: refreshTextFields,
		getValidationErrors: function () {
			return getValidationErrors().slice();
		},
		getState: function () {
			return JSON.parse(JSON.stringify(state));
		}
	};
})();
