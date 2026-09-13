// Experimental Class layout. The original versionClass.js is intentionally unchanged.
if (!loadedVersions.includes('/js/frames/versionClassRange.js')) {
	loadedVersions.push('/js/frames/versionClassRange.js');
}

async function initializeClassRulesRange() {
	if (card.version !== 'classRange' || !window.RulesRange) return;
	const range = {
		id: 'class-rules-' + Date.now().toString(36),
		name: 'Class Levels', direction: 'vertical', rotation: 0,
		bounds: {x: 0.5093, y: 0.1129, width: 0.404, height: 0.7239},
		modules: []
	};
	const headerHeight = 0.0481 * card.height;
	for (let i = 0; i < 4; i++) {
		const module = {
			id: range.id + '-level-' + i, name: 'Level ' + (i + 1),
			sizing: 'flex', size: i === 0 ? 210 : 171, elements: []
		};
		const addText = (key, y, fitHeight, role) => {
			const field = card.text[key];
			if (!field) return;
			const entry = {kind: 'text', key, owned: true,
				offset: {x: (field.x - range.bounds.x) * card.width, y,
					width: field.width * card.width, height: field.height * card.height}};
			if (role) {entry.collisionGroup = 'class-header';entry.collisionRole = role;}
			if (fitHeight) entry.fitHeight = 0;
			module.elements.push(entry);
		};
		if (i > 0) {
			const header = {
				name: 'Level ' + (i + 1) + ' Header',
				src: '/img/frames/class/header.png', masks: [], noThumb: true,
				bounds: {x: range.bounds.x, y: range.bounds.y, width: 0.4, height: 0.0481},
				opacity: 100, designCreated: true, customField: true, classRangeBanner: true
			};
			ensureDesignLayerId(header);
			card.frames.unshift(header);
			await addFrame([], header);
			module.elements.push({kind: 'frame', key: header.designLayerId, owned: true,
				offset: {x: (0.5014 - range.bounds.x) * card.width, y: 0,
					width: 0.422 * card.width, height: headerHeight}});
			addText('level' + i + 'a', 0.012 * card.height, false, 'cost');
			addText('level' + i + 'b', 0.012 * card.height, false, 'name');
		}
		addText('level' + i + 'c', i ? headerHeight : 0, true);
		range.modules.push(module);
	}
	card.rulesRanges = card.rulesRanges || [];
	card.rulesRanges.push(range);
	window.RulesRange.syncElements();
	window.RulesRange.refresh();
}
