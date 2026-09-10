(function () {
	'use strict';

	if (window.FrameResourceLibrary) {
		window.FrameResourceLibrary.init();
		return;
	}

	var BUILT_IN_TEXTURES = [
		{
			"id": "builtin:m15-artifact",
			"name": "M15 Artifact",
			"src": "/img/textures/m15/artifact.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-black",
			"name": "M15 Black",
			"src": "/img/textures/m15/black.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-blue",
			"name": "M15 Blue",
			"src": "/img/textures/m15/blue.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-colorless",
			"name": "M15 Colorless",
			"src": "/img/textures/m15/colorless.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-green",
			"name": "M15 Green",
			"src": "/img/textures/m15/green.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-land",
			"name": "M15 Land",
			"src": "/img/textures/m15/land.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-multicolor",
			"name": "M15 Multicolor",
			"src": "/img/textures/m15/multicolor.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-red",
			"name": "M15 Red",
			"src": "/img/textures/m15/red.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-white",
			"name": "M15 White",
			"src": "/img/textures/m15/white.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Base Texture"
		},
		{
			"id": "builtin:m15-pt-artifact",
			"name": "M15 P/T — Artifact",
			"src": "/img/frames/m15/regular/m15PTA.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-black",
			"name": "M15 P/T — Black",
			"src": "/img/frames/m15/regular/m15PTB.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-colorless",
			"name": "M15 P/T — Colorless",
			"src": "/img/frames/m15/regular/m15PTC.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-green",
			"name": "M15 P/T — Green",
			"src": "/img/frames/m15/regular/m15PTG.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-multicolor",
			"name": "M15 P/T — Multicolor",
			"src": "/img/frames/m15/regular/m15PTM.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-red",
			"name": "M15 P/T — Red",
			"src": "/img/frames/m15/regular/m15PTR.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-blue",
			"name": "M15 P/T — Blue",
			"src": "/img/frames/m15/regular/m15PTU.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-vehicle",
			"name": "M15 P/T — Vehicle",
			"src": "/img/frames/m15/regular/m15PTV.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		},
		{
			"id": "builtin:m15-pt-white",
			"name": "M15 P/T — White",
			"src": "/img/frames/m15/regular/m15PTW.png",
			"builtIn": true,
			"family": "M15 Regular",
			"component": "Power / Toughness"
		}
	];

	var BUILT_IN_MASKS = [
		{
			"name": "Full Image (No Mask)",
			"family": "General",
			"category": "Full Image",
			"noMask": true
		},
		{
			"name": "Left Half",
			"family": "General",
			"category": "Split Regions",
			"src": "/img/frames/maskLeftHalf.png",
			"preview": "/img/frames/maskLeftHalfThumb.png"
		},
		{
			"name": "Right Half",
			"family": "General",
			"category": "Split Regions",
			"src": "/img/frames/maskRightHalf.png",
			"preview": "/img/frames/maskRightHalfThumb.png"
		},
		{
			"name": "Top Half",
			"family": "General",
			"category": "Split Regions",
			"src": "/img/frames/maskTopHalf.png",
			"preview": "/img/frames/maskTopHalfThumb.png"
		},
		{
			"name": "Bottom Half",
			"family": "General",
			"category": "Split Regions",
			"src": "/img/frames/maskBottomHalf.png",
			"preview": "/img/frames/maskBottomHalfThumb.png"
		},
		{
			"name": "Middle Third",
			"family": "General",
			"category": "Split Regions",
			"src": "/img/frames/maskMiddleThird.png",
			"preview": "/img/frames/maskMiddleThirdThumb.png"
		},
		{
			"name": "Corner Cutout",
			"family": "General",
			"category": "General Shapes",
			"src": "/img/frames/cornerCutout.png",
			"preview": "/img/frames/cornerCutoutThumb.png"
		},
		{
			"name": "Regular Frame Body",
			"family": "M15 Regular",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/regular/m15MaskFrame.png"
		},
		{
			"name": "Regular Border",
			"family": "M15 Regular",
			"category": "Borders",
			"src": "/img/frames/m15/regular/m15MaskBorder.png"
		},
		{
			"name": "Regular Pinline",
			"family": "M15 Regular",
			"category": "Pinlines",
			"src": "/img/frames/m15/regular/m15MaskPinline.png"
		},
		{
			"name": "Regular Super Pinline",
			"family": "M15 Regular",
			"category": "Pinlines",
			"src": "/img/frames/m15/regular/m15MaskPinlineSuper.png"
		},
		{
			"name": "Regular Rules Box",
			"family": "M15 Regular",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/regular/m15MaskRules.png"
		},
		{
			"name": "Regular Title Bar",
			"family": "M15 Regular",
			"category": "Title Bars",
			"src": "/img/frames/m15/regular/m15MaskTitle.png"
		},
		{
			"name": "Regular Type Line",
			"family": "M15 Regular",
			"category": "Type Lines",
			"src": "/img/frames/m15/regular/m15MaskType.png"
		},
		{
			"name": "Battle Frame Border",
			"family": "M15 Battle",
			"category": "Borders",
			"src": "/img/frames/m15/battle/maskBorder.png",
			"preview": "/img/frames/m15/battle/maskBorderThumb.png"
		},
		{
			"name": "Battle Defense Box",
			"family": "M15 Battle",
			"category": "Power / Defense",
			"src": "/img/frames/m15/battle/maskDefense.png",
			"preview": "/img/frames/m15/battle/maskDefenseThumb.png"
		},
		{
			"name": "Battle Pinline",
			"family": "M15 Battle",
			"category": "Pinlines",
			"src": "/img/frames/m15/battle/maskPinline.png",
			"preview": "/img/frames/m15/battle/maskPinlineThumb.png"
		},
		{
			"name": "Battle Rules Box",
			"family": "M15 Battle",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/battle/maskRules.png",
			"preview": "/img/frames/m15/battle/maskRulesThumb.png"
		},
		{
			"name": "Battle Title Bar",
			"family": "M15 Battle",
			"category": "Title Bars",
			"src": "/img/frames/m15/battle/maskTitle.png",
			"preview": "/img/frames/m15/battle/maskTitleThumb.png"
		},
		{
			"name": "Battle Type Line",
			"family": "M15 Battle",
			"category": "Type Lines",
			"src": "/img/frames/m15/battle/maskType.png",
			"preview": "/img/frames/m15/battle/maskTypeThumb.png"
		},
		{
			"name": "Commander Legends Frame",
			"family": "M15 Commander Legends",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskFrame.png",
			"preview": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskFrameThumb.png"
		},
		{
			"name": "Commander Legends Rules Box",
			"family": "M15 Commander Legends",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskRules.png",
			"preview": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskRulesThumb.png"
		},
		{
			"name": "Commander Legends Title Bar",
			"family": "M15 Commander Legends",
			"category": "Title Bars",
			"src": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTitle.png",
			"preview": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTitleThumb.png"
		},
		{
			"name": "Commander Legends Type Line",
			"family": "M15 Commander Legends",
			"category": "Type Lines",
			"src": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskType.png",
			"preview": "/img/frames/m15/commanderLegends/m15CommanderLegendsMaskTypeThumb.png"
		},
		{
			"name": "Legendary Crown",
			"family": "M15 Legendary",
			"category": "Crowns",
			"src": "/img/frames/m15/crowns/m15MaskLegendCrown.png",
			"preview": "/img/frames/m15/crowns/m15MaskLegendCrownThumb.png"
		},
		{
			"name": "Legendary Crown Pinline",
			"family": "M15 Legendary",
			"category": "Pinlines",
			"src": "/img/frames/m15/crowns/m15MaskLegendCrownPinline.png",
			"preview": "/img/frames/m15/crowns/m15MaskLegendCrownPinlineThumb.png"
		},
		{
			"name": "Transform Front Frame",
			"family": "M15 Transform",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/transform/regular/maskFrameFront.png"
		},
		{
			"name": "Transform Back Frame",
			"family": "M15 Transform",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/transform/regular/maskFrameBack.png"
		},
		{
			"name": "Transform Front Border",
			"family": "M15 Transform",
			"category": "Borders",
			"src": "/img/frames/m15/transform/regular/maskBorderFront.png"
		},
		{
			"name": "Transform Front Pinline",
			"family": "M15 Transform",
			"category": "Pinlines",
			"src": "/img/frames/m15/transform/regular/maskPinlineFront.png"
		},
		{
			"name": "Transform Back Pinline",
			"family": "M15 Transform",
			"category": "Pinlines",
			"src": "/img/frames/m15/transform/regular/maskPinlineBack.png"
		},
		{
			"name": "Transform Front Rules Box",
			"family": "M15 Transform",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/transform/regular/maskRulesFront.png"
		},
		{
			"name": "Transform Title Bar",
			"family": "M15 Transform",
			"category": "Title Bars",
			"src": "/img/frames/m15/transform/regular/maskTitle.png"
		},
		{
			"name": "Borderless Transform Front Border",
			"family": "M15 Borderless Transform",
			"category": "Borders",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskBorderFront.png"
		},
		{
			"name": "Borderless Transform Back Border",
			"family": "M15 Borderless Transform",
			"category": "Borders",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskBorderBack.png"
		},
		{
			"name": "Borderless Transform Front Cutout",
			"family": "M15 Borderless Transform",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskNoBorderFront.png"
		},
		{
			"name": "Borderless Transform Back Cutout",
			"family": "M15 Borderless Transform",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskNoBorderBack.png"
		},
		{
			"name": "Borderless Transform Front Pinline",
			"family": "M15 Borderless Transform",
			"category": "Pinlines",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskPinlineFront.png"
		},
		{
			"name": "Borderless Transform Back Pinline",
			"family": "M15 Borderless Transform",
			"category": "Pinlines",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskPinlineBack.png"
		},
		{
			"name": "Borderless Transform Front Rules",
			"family": "M15 Borderless Transform",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskRulesFront.png"
		},
		{
			"name": "Borderless Transform Back Rules",
			"family": "M15 Borderless Transform",
			"category": "Rules Boxes",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskRulesBack.png"
		},
		{
			"name": "Borderless Transform Front Text Boxes",
			"family": "M15 Borderless Transform",
			"category": "Combined Text Boxes",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskTextBoxesFront.png"
		},
		{
			"name": "Borderless Transform Back Text Boxes",
			"family": "M15 Borderless Transform",
			"category": "Combined Text Boxes",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskTextBoxesBack.png"
		},
		{
			"name": "Borderless Transform Front Title",
			"family": "M15 Borderless Transform",
			"category": "Title Bars",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskTitleFront.png"
		},
		{
			"name": "Borderless Transform Back Title",
			"family": "M15 Borderless Transform",
			"category": "Title Bars",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskTitleBack.png"
		},
		{
			"name": "Borderless Transform Type Line",
			"family": "M15 Borderless Transform",
			"category": "Type Lines",
			"src": "/img/frames/m15/transform/borderlessAlt/masks/maskType.png"
		},
		{
			"name": "Japan Showcase Bottom",
			"family": "M15 Japan Showcase",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/japanShowcase/mask/MaskBottom.png"
		},
		{
			"name": "Japan Showcase Bottom Pinline",
			"family": "M15 Japan Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/japanShowcase/mask/MaskBottomPinline.png"
		},
		{
			"name": "Japan Showcase Pinline",
			"family": "M15 Japan Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/japanShowcase/mask/MaskPinline.png"
		},
		{
			"name": "Japan Showcase P/T Pinline",
			"family": "M15 Japan Showcase",
			"category": "Power / Defense",
			"src": "/img/frames/m15/japanShowcase/mask/MaskPtBoxPinline.png"
		},
		{
			"name": "Japan Showcase Title Bar",
			"family": "M15 Japan Showcase",
			"category": "Title Bars",
			"src": "/img/frames/m15/japanShowcase/mask/MaskTitle.png"
		},
		{
			"name": "Japan Showcase Type Line",
			"family": "M15 Japan Showcase",
			"category": "Type Lines",
			"src": "/img/frames/m15/japanShowcase/mask/MaskType.png"
		},
		{
			"name": "Japan Showcase Margin Border",
			"family": "M15 Japan Showcase",
			"category": "Borders",
			"src": "/img/frames/m15/japanShowcase/margin/masks/maskBorder.png"
		},
		{
			"name": "Japan Showcase Margin Pinlines",
			"family": "M15 Japan Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/japanShowcase/margin/masks/maskBorderPinlines.png"
		},
		{
			"name": "Zendikar Rising Border",
			"family": "M15 Zendikar Rising",
			"category": "Borders",
			"src": "/img/frames/m15/zendikarRising/m15ZendikarRisingMaskBorder.png"
		},
		{
			"name": "Zendikar Rising Frame",
			"family": "M15 Zendikar Rising",
			"category": "Frame Bodies",
			"src": "/img/frames/m15/zendikarRising/m15ZendikarRisingMaskFrame.png"
		},
		{
			"name": "Zendikar Rising Pinline",
			"family": "M15 Zendikar Rising",
			"category": "Pinlines",
			"src": "/img/frames/m15/zendikarRising/m15ZendikarRisingMaskPinline.png"
		},
		{
			"name": "Zendikar Rising Text",
			"family": "M15 Zendikar Rising",
			"category": "Combined Text Boxes",
			"src": "/img/frames/m15/zendikarRising/m15ZendikarRisingMaskText.png"
		},
		{
			"name": "Nickname Crown",
			"family": "M15 Nickname",
			"category": "Crowns",
			"src": "/img/frames/m15/nickname/smooth/masks/maskCrown.png"
		},
		{
			"name": "Nickname Title Bar",
			"family": "M15 Nickname",
			"category": "Title Bars",
			"src": "/img/frames/m15/nickname/smooth/masks/maskTitle.png"
		},
		{
			"name": "Nickname True Name",
			"family": "M15 Nickname",
			"category": "Title Bars",
			"src": "/img/frames/m15/nickname/smooth/masks/maskTrueName.png"
		},
		{
			"name": "Generic Showcase Pinline",
			"family": "M15 Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/genericShowcase/m15GenericShowcaseMaskPinline.png"
		},
		{
			"name": "Oil Slick Pinline",
			"family": "M15 Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/oilslick/m15OilSlickMaskPinline.png"
		},
		{
			"name": "Oil Slick Crown Pinline",
			"family": "M15 Showcase",
			"category": "Crowns",
			"src": "/img/frames/m15/oilslick/m15OilSlickCrownMaskPinline.png"
		},
		{
			"name": "Prototype Pinline",
			"family": "M15 Showcase",
			"category": "Pinlines",
			"src": "/img/frames/m15/prototype/regular/maskPinline.png"
		},
		{
			"name": "Saga Banner",
			"family": "M15 Saga",
			"category": "Title Bars",
			"src": "/img/frames/saga/sagaMaskBanner.png"
		},
		{
			"name": "Saga Right Banner",
			"family": "M15 Saga",
			"category": "Title Bars",
			"src": "/img/frames/saga/sagaMaskBannerRight.png"
		},
		{
			"name": "Saga Border",
			"family": "M15 Saga",
			"category": "Borders",
			"src": "/img/frames/saga/sagaMaskBorder.png"
		},
		{
			"name": "Saga Frame",
			"family": "M15 Saga",
			"category": "Frame Bodies",
			"src": "/img/frames/saga/sagaMaskFrame.png"
		},
		{
			"name": "Saga Pinline",
			"family": "M15 Saga",
			"category": "Pinlines",
			"src": "/img/frames/saga/sagaMaskPinline.png"
		},
		{
			"name": "Saga Text",
			"family": "M15 Saga",
			"category": "Rules Boxes",
			"src": "/img/frames/saga/sagaMaskText.png"
		},
		{
			"name": "Saga Right Text",
			"family": "M15 Saga",
			"category": "Rules Boxes",
			"src": "/img/frames/saga/sagaMaskTextRight.png"
		},
		{
			"name": "Saga Type Line",
			"family": "M15 Saga",
			"category": "Type Lines",
			"src": "/img/frames/saga/sagaMaskType.png"
		},
		{
			"name": "Planeswalker Border",
			"family": "M15 Planeswalker",
			"category": "Borders",
			"src": "/img/frames/planeswalker/regular/planeswalkerMaskBorder.png"
		},
		{
			"name": "Planeswalker Frame",
			"family": "M15 Planeswalker",
			"category": "Frame Bodies",
			"src": "/img/frames/planeswalker/regular/planeswalkerMaskFrame.png"
		},
		{
			"name": "Planeswalker Pinline",
			"family": "M15 Planeswalker",
			"category": "Pinlines",
			"src": "/img/frames/planeswalker/regular/planeswalkerMaskPinline.png"
		},
		{
			"name": "Planeswalker Title Bar",
			"family": "M15 Planeswalker",
			"category": "Title Bars",
			"src": "/img/frames/planeswalker/regular/planeswalkerMaskTitle.png"
		},
		{
			"name": "Planeswalker Type Line",
			"family": "M15 Planeswalker",
			"category": "Type Lines",
			"src": "/img/frames/planeswalker/regular/planeswalkerMaskType.png"
		},
		{
			"name": "Planeswalker Rules Area",
			"family": "M15 Planeswalker",
			"category": "Rules Boxes",
			"src": "/img/frames/planeswalker/planeswalkerMaskText.png"
		},
		{
			"name": "Planeswalker Loyalty",
			"family": "M15 Planeswalker",
			"category": "Power / Defense",
			"src": "/img/frames/planeswalker/maskLoyalty.png"
		},
		{
			"name": "Tall Planeswalker Frame",
			"family": "M15 Planeswalker Tall",
			"category": "Frame Bodies",
			"src": "/img/frames/planeswalker/tall/planeswalkerTallMaskFrame.png"
		},
		{
			"name": "Tall Planeswalker Pinline",
			"family": "M15 Planeswalker Tall",
			"category": "Pinlines",
			"src": "/img/frames/planeswalker/tall/planeswalkerTallMaskPinline.png"
		},
		{
			"name": "Tall Planeswalker Rules Area",
			"family": "M15 Planeswalker Tall",
			"category": "Rules Boxes",
			"src": "/img/frames/planeswalker/tall/planeswalkerTallMaskRules.png"
		},
		{
			"name": "Tall Planeswalker Type Line",
			"family": "M15 Planeswalker Tall",
			"category": "Type Lines",
			"src": "/img/frames/planeswalker/tall/planeswalkerTallMaskType.png"
		},
		{
			"name": "Split Bottom Left",
			"family": "M15 Split / Room",
			"category": "Split Regions",
			"src": "/img/frames/m15/split/maskBottomLeft.png"
		},
		{
			"name": "Split Top Right",
			"family": "M15 Split / Room",
			"category": "Split Regions",
			"src": "/img/frames/m15/split/maskTopRight.png"
		},
		{
			"name": "Room Right Half",
			"family": "M15 Split / Room",
			"category": "Split Regions",
			"src": "/img/frames/m15/room/maskRight.png"
		},
		{
			"name": "Borderless Cutout",
			"family": "M15 Borderless",
			"category": "Borders",
			"src": "/img/frames/m15/borderless/masks/maskNoBorder.png"
		},
		{
			"name": "Sliver Border",
			"family": "M15 Sliver",
			"category": "Borders",
			"src": "/img/frames/m15/m15MaskBorderSliver.png"
		},
		{
			"name": "Sliver Crown Border",
			"family": "M15 Sliver",
			"category": "Crowns",
			"src": "/img/frames/m15/m15MaskBorderSliverCrown.png"
		}
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
				family: 'Custom Masks',
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
		if (!mask || mask.noMask) {
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
			var mask = selectedMask();
			var emptyText = mask && mask.noMask ? 'The full texture image will be used.' : 'Select a mask';
			await setPreview('#frame-resource-mask-preview', await resolveMaskSource(mask, true), emptyText);
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

	function renderFamilies() {
		var select = element('#frame-resource-mask-family');
		if (!select) {
			return;
		}
		var previous = select.value;
		var families = Array.from(new Set(maskResources().map(function (mask) { return mask.family || 'General'; }))).sort();
		select.innerHTML = '';
		appendOption(select, '', 'All frame families');
		families.forEach(function (family) { appendOption(select, family, family); });
		if (families.indexOf(previous) !== -1) {
			select.value = previous;
		}
	}

	function renderCategories() {
		var select = element('#frame-resource-mask-category');
		if (!select) {
			return;
		}
		var previous = select.value;
		var family = element('#frame-resource-mask-family');
		var familyValue = family ? family.value : '';
		var resources = maskResources().filter(function (mask) {
			return !familyValue || (mask.family || 'General') === familyValue;
		});
		var categories = Array.from(new Set(resources.map(function (mask) { return mask.category; }))).sort();
		select.innerHTML = '';
		appendOption(select, '', 'All component types');
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
		var family = element('#frame-resource-mask-family');
		var category = element('#frame-resource-mask-category');
		var search = element('#frame-resource-mask-search');
		var familyValue = family ? family.value : '';
		var categoryValue = category ? category.value : '';
		var searchValue = String(search ? search.value : '').trim().toLowerCase();
		visibleMasks = maskResources().filter(function (mask) {
			var familyName = mask.family || 'General';
			var familyMatches = !familyValue || familyName === familyValue;
			var categoryMatches = !categoryValue || mask.category === categoryValue;
			var searchMatches = !searchValue || (mask.name + ' ' + familyName + ' ' + mask.category).toLowerCase().indexOf(searchValue) !== -1;
			return familyMatches && categoryMatches && searchMatches;
		});
		select.innerHTML = '';
		if (!visibleMasks.length) {
			appendOption(select, '', 'No masks match this filter');
			select.disabled = true;
		} else {
			select.disabled = false;
			visibleMasks.forEach(function (mask, index) {
				appendOption(select, String(index), mask.name + ' — ' + (mask.family || 'General'));
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

	function filterFamily() {
		renderCategories();
		renderMasks();
	}

	function refresh() {
		renderTextures();
		renderFamilies();
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
			var layerName = mask.noMask ? texture.name : texture.name + ' — ' + mask.name;
			var frame = {
				name: layerName,
				src: textureSource,
				noThumb: true,
				masks: [],
				bounds: {x: 0, y: 0, width: 1, height: 1},
				opacity: 100
			};
			if (!texture.builtIn) {
				frame.assetId = texture.id;
			}
			var maskDefinition = null;
			if (!mask.noMask) {
				maskDefinition = {name: mask.name, src: maskSource, noThumb: true};
				if (mask.assetId) {
					maskDefinition.assetId = mask.assetId;
				}
			}
			var previousFrameIndex = selectedFrameIndex;
			availableFrames.push(frame);
			selectedFrameIndex = availableFrames.length - 1;
			try {
				await addFrame(maskDefinition ? [maskDefinition] : []);
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
		filterFamily: filterFamily,
		filterMasks: renderMasks,
		updateTexturePreview: updateTexturePreview,
		updateMaskPreview: updateMaskPreview,
		createLayer: createLayer,
		builtInMasks: BUILT_IN_MASKS.slice(),
		builtInTextures: BUILT_IN_TEXTURES.slice()
	};

	init();
})();
