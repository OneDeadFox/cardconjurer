(function () {
	'use strict';

	var selectedRangeId = '';
	var rangeCounter = 0;

	function clone(value) {
		return JSON.parse(JSON.stringify(value));
	}

	function ranges() {
		if (!window.card) return [];
		card.rulesRanges = Array.isArray(card.rulesRanges) ? card.rulesRanges : [];
		card.rulesRanges.forEach(normalizeRange);
		return card.rulesRanges;
	}

	function makeId() {
		rangeCounter += 1;
		return 'rules-range-' + Date.now().toString(36) + '-' + rangeCounter.toString(36);
	}

	function normalizeRange(range, index) {
		range.id = String(range.id || makeId());
		range.name = String(range.name || 'Rules Range ' + ((index || 0) + 1));
		range.direction = range.direction === 'horizontal' ? 'horizontal' : 'vertical';
		range.rotation = Number(range.rotation) || 0;
		range.bounds = range.bounds || {x:0.12, y:0.55, width:0.76, height:0.3};
		range.bounds.x = Number(range.bounds.x) || 0;
		range.bounds.y = Number(range.bounds.y) || 0;
		range.bounds.width = Math.max(10 / Math.max(Number(card.width) || 1, 1), Number(range.bounds.width) || 0.76);
		range.bounds.height = Math.max(10 / Math.max(Number(card.height) || 1, 1), Number(range.bounds.height) || 0.3);
		range.modules = Array.isArray(range.modules) ? range.modules : [];
		return range;
	}

	function selected() {
		var list = ranges();
		var match = list.find(function (range) { return range.id === selectedRangeId; });
		if (!match && list.length) {
			match = list[0];
			selectedRangeId = match.id;
		}
		return match || null;
	}

	function status(message, error) {
		var element = document.querySelector('#rules-range-status');
		if (!element) return;
		element.textContent = message;
		element.style.color = error ? '#ff8f8f' : '';
	}

	function setInput(id, value) {
		var input = document.querySelector('#' + id);
		if (input) input.value = value;
	}

	function pixelValue(value, dimension) {
		return Math.round((Number(value) || 0) * Math.max(Number(dimension) || 1, 1));
	}

	function refreshInputs() {
		var range = selected();
		var disabled = !range;
		['rules-range-name', 'rules-range-x', 'rules-range-y', 'rules-range-width', 'rules-range-height'].forEach(function (id) {
			var input = document.querySelector('#' + id);
			if (input) input.disabled = disabled;
		});
		if (!range) {
			setInput('rules-range-name', '');
			['x', 'y', 'width', 'height'].forEach(function (key) { setInput('rules-range-' + key, ''); });
			status('No rules range selected.');
			return;
		}
		setInput('rules-range-name', range.name);
		setInput('rules-range-x', pixelValue(range.bounds.x, card.width));
		setInput('rules-range-y', pixelValue(range.bounds.y, card.height));
		setInput('rules-range-width', pixelValue(range.bounds.width, card.width));
		setInput('rules-range-height', pixelValue(range.bounds.height, card.height));
		status('Selected “' + range.name + '”. Module controls will be added in the next Rules Range phase.');
	}

	function refresh() {
		var list = document.querySelector('#rules-range-list');
		if (!list) return;
		var current = selected();
		list.innerHTML = '';
		if (!ranges().length) {
			var empty = document.createElement('option');
			empty.value = '';
			empty.textContent = 'No rules ranges';
			list.appendChild(empty);
			list.disabled = true;
			selectedRangeId = '';
		} else {
			list.disabled = false;
			ranges().forEach(function (range) {
				var option = document.createElement('option');
				option.value = range.id;
				option.textContent = range.name;
				list.appendChild(option);
			});
			list.value = current.id;
		}
		refreshInputs();
		if (typeof drawCard === 'function') drawCard();
	}

	function add(bounds) {
		if (!window.card) return;
		var before = typeof createDesignStateSnapshot === 'function' ? createDesignStateSnapshot() : null;
		var index = ranges().length;
		var range = normalizeRange({
			id:makeId(),
			name:'Rules Range ' + (index + 1),
			direction:'vertical',
			bounds:bounds || {x:0.12, y:0.55, width:0.76, height:0.3},
			modules:[]
		}, index);
		ranges().push(range);
		selectedRangeId = range.id;
		refresh();
		if (typeof commitDesignUndoSnapshot === 'function') commitDesignUndoSnapshot(before, 'Add rules range');
	}

	function removeSelected() {
		var range = selected();
		if (!range || !confirm('Remove the rules range “' + range.name + '”? Its future modules and attached fields will also be removed.')) return;
		var before = typeof createDesignStateSnapshot === 'function' ? createDesignStateSnapshot() : null;
		card.rulesRanges = ranges().filter(function (item) { return item.id !== range.id; });
		selectedRangeId = card.rulesRanges.length ? card.rulesRanges[0].id : '';
		refresh();
		if (typeof commitDesignUndoSnapshot === 'function') commitDesignUndoSnapshot(before, 'Remove rules range');
	}

	function select(id) {
		if (ranges().some(function (range) { return range.id === id; })) selectedRangeId = id;
		refresh();
	}

	function renameSelected(value) {
		var range = selected();
		if (!range) return;
		var next = String(value || '').trim();
		if (!next || next === range.name) return;
		var before = typeof createDesignStateSnapshot === 'function' ? createDesignStateSnapshot() : null;
		range.name = next;
		refresh();
		if (typeof commitDesignUndoSnapshot === 'function') commitDesignUndoSnapshot(before, 'Rename rules range');
	}

	function numberInput(id, fallback) {
		var input = document.querySelector('#' + id);
		var value = Number(input && input.value);
		return Number.isFinite(value) ? value : fallback;
	}

	function updateBounds() {
		var range = selected();
		if (!range) return;
		var before = typeof createDesignStateSnapshot === 'function' ? createDesignStateSnapshot() : null;
		var width = Math.max(Number(card.width) || 1, 1);
		var height = Math.max(Number(card.height) || 1, 1);
		range.bounds.x = numberInput('rules-range-x', range.bounds.x * width) / width;
		range.bounds.y = numberInput('rules-range-y', range.bounds.y * height) / height;
		range.bounds.width = Math.max(10, numberInput('rules-range-width', range.bounds.width * width)) / width;
		range.bounds.height = Math.max(10, numberInput('rules-range-height', range.bounds.height * height)) / height;
		refreshInputs();
		if (typeof drawCard === 'function') drawCard();
		if (typeof commitDesignUndoSnapshot === 'function') commitDesignUndoSnapshot(before, 'Resize rules range');
	}

	window.RulesRange = {
		add:add,
		removeSelected:removeSelected,
		select:select,
		renameSelected:renameSelected,
		updateBounds:updateBounds,
		refresh:refresh,
		refreshInputs:refreshInputs,
		getSelected:selected,
		getAll:ranges,
		clone:clone
	};

	window.addEventListener('frameworkspacechanged', refresh);
	document.addEventListener('DOMContentLoaded', refresh);
})();
