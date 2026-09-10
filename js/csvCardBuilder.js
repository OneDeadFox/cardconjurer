(function () {
	'use strict';

	var templateCard = null;

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

	async function applyPreviewToCurrentCard(result) {
		card.text = JSON.parse(JSON.stringify(result.card.text));
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

		var artUrl = result.fields.artUrl || '';
		if (artUrl && typeof uploadArt === 'function') {
			uploadArt(artUrl, 'autoFit');
		}

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
			status.textContent = 'Previewed ' + (result.fields.name || 'row ' + (Number(selector.value) + 2)) +
				(result.warnings.length ? '. ' + result.warnings.join(' ') : '.');
		} catch (error) {
			status.textContent = error.message || 'The selected row could not be previewed.';
		}
	}

	window.CSVCardBuilder = {
		csvChanged: csvChanged,
		captureTemplate: captureTemplate,
		previewSelectedRow: previewSelectedRow,
		buildCard: buildCard
	};
})();
