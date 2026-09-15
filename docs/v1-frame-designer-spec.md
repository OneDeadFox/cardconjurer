# V1 Frame Designer Specification

## Goal

Turn Card Conjurer's existing Frame tab into a persistent, reusable frame-authoring workspace. Imported frame images should survive browser restarts, drafts should be resumable, and completed projects will later become named templates available to CSV generation.

## Terminology

- **Asset:** An imported frame image or mask stored once in IndexedDB.
- **Project:** An editable draft containing the current card dimensions, frame layers, masks, text layout, art bounds, and other card-layout settings.
- **Template:** A published project assigned a Frame Type and Frame Variant for reuse and CSV generation. Template publishing is the next phase after project persistence.

## Workspace organization

The existing top-level **Frame** tab contains two internal workspaces that share the same card canvas and current card state:

- **Browse Frames:** frame groups, frame packs, search, built-in frame images, and built-in masks.
- **Design Frame:** saved projects, the persistent asset library, and access to layer editing.
- **Current Frame Layers:** shared between both workspaces. Layers can be reordered in either workspace, but clicking a layer opens its editor only in Design Frame.

General display options remain visible beneath both workspaces. The Frame Image Editor is a compact movable panel limited to less than half the viewport width. Its six primary numeric controls use a 3-by-2 grid, the HSL sliders are labeled, and mask/action controls sit beside the HSL section. Drag the title to reposition it. Scrolling a numeric layer input changes the value and redraws immediately; typed values apply only after Enter or leaving the field.

## Current foundation

The Frame tab now includes:

- A persistent Frame Asset Library backed by IndexedDB.
- Multi-file image import for PNG, SVG, JPG, BMP, and WebP files.
- Linked image URL entries.
- Reuse of one stored asset across multiple frame projects.
- Adding a stored frame asset as a new frame layer.
- Persistent uploaded masks.
- Named project creation.
- Updating the currently loaded project.
- **Save as New** for branching a project.
- Loading and deleting projects.
- A warning before deleting an asset referenced by a saved project.

Imported local files are stored as image blobs. A project stores asset IDs rather than embedding duplicate image data in every project.

## Existing frame controls preserved

Card Conjurer's existing per-layer controls continue to work inside a saved project:

- Layer order.
- X and Y position.
- Width and height.
- Opacity.
- Erase compositing.
- Alpha preservation.
- Color overlay.
- Hue, saturation, and lightness.
- Uploaded masks.
- Rotation around the layer's bounding-box center.
- Horizontal and vertical flipping.
- Non-destructive visibility toggling.
- Layer duplication.
- Resetting editable controls to the values captured when the layer was added.

All of these properties are serialized with Frame Designer projects. Reset restores position, size, opacity, compositing, color adjustments, rotation, flips, and visibility. It does not delete masks that were added later.

## Current workflow

1. Open the **Frame** tab and select **Design Frame**.
2. Import one or more images under **Persistent Frame Asset Library**.
3. Select an asset and choose **Add Selected Asset**.
4. Click the new layer in the frame list to edit its existing controls.
5. Enter a name under **Frame Designer Projects**.
6. Choose **Save Project**.
7. Later, select the project and choose **Load Project**.
8. Use **Save as New** when making a separate variant.

## Storage boundary

IndexedDB data belongs to the exact browser site origin. Continue opening the app from the same Live Server address and port (currently `http://127.0.0.1:5500`). Opening `localhost`, another port, another browser profile, or a file-system URL creates a separate storage area.

Local image assets remain available offline. Assets saved as remote URLs still depend on that URL remaining accessible.

## Frame construction resource library

The Design Frame workspace now provides the first usable construction library:

- Nine built-in M15 base textures: artifact, black, blue, colorless, green, land, multicolor, red, and white.
- Nine premade M15 regular power/toughness pieces.
- User-imported textures stored in IndexedDB.
- Bulk import for textures and custom masks.
- Ninety curated component choices across General, Regular, Battle, Commander Legends, Legendary, Transform, Borderless Transform, Japan Showcase, Zendikar Rising, Nickname, Showcase, Saga, Planeswalker, Split/Room, Borderless, and Sliver families.
- Separate frame-family and component-type filters plus component search.
- Side-by-side texture and component-mask previews.
- A **Full Image (No Mask)** choice for premade pieces that should be added unchanged.
- A non-destructive **Create Layer from Texture + Mask** action.
- Automatic project references to the imported texture and custom-mask assets, so constructed layers remain reusable after the project is saved and reopened.

Frame images already in the persistent asset library can also be selected as texture sources. The curated manifest intentionally exposes usable source masks rather than the hundreds of duplicates and thumbnails in the raw asset tree. The intended construction model is **base material + component mask**: select a colored or imported texture, then use a title, type-line, rules-box, pinline, border, crown, or other mask to cut it into that component. Premade pieces such as power/toughness boxes use **Full Image (No Mask)** instead.

To build a layer, choose a built-in texture or import your own, select a frame family and component type, choose a component mask, then choose **Create Layer from Texture + Mask**. The resulting layer appears under **Current Frame Layers** and uses the existing non-destructive position, size, rotation, flip, opacity, color, HSL, mask, duplicate, visibility, and reset controls.

## Custom CSV template fields

The Design Frame workspace can add labeled fields before a project is published:

- **Add Text Field** creates an editable textbox with a stable CSV key. Its font, text, and bounds use the existing Text tab controls.
- **Add Image Field** creates a special frame layer with a stable CSV key. Its position, size, rotation, flips, opacity, masks, and layer order use the existing Frame Image Editor.
- Custom field labels appear under **Available template text fields** or **Available template image fields** in CSV Import.
- An exact CSV header-to-label match is selected automatically when the CSV is loaded. **Refresh Current Template Fields** also matches newly added fields while preserving deliberate mappings.
- A custom image cell may contain an image filename from the selected art folder, including a subfolder path, or an HTTP(S), data-image, blob, or app-relative URL. A blank mapped cell clears the image slot for that row.
- Custom field definitions and labels are part of the card snapshot, so Frame Designer project save/load and CSV template capture retain them.
- The CSV **Template** value selects a saved Frame Designer project by its exact name. **Frame Type** and **Frame Variant** must be blank on that row.
- Rows with a saved **Template** can render without first capturing a session template. Capturing the current card supplies the fallback only for rows whose Template cell is blank.
- When a row selects a built-in Frame Type/Variant, template-only custom text and image fields are removed so values from a previously previewed custom template cannot remain visible.

## Rules Range foundation

Frame Designer projects can define any number of named Rules Ranges. A Rules Range is a persistent outer layout boundary reserved for a future stack of repeatable rules modules.

- Add, select, rename, and remove Rules Ranges in Design Frame.
- Edit X, Y, width, and height in editor pixels.
- Move and resize the purple range outline directly on the card canvas.
- Set module flow independently to vertical or horizontal, and rotate the complete range without changing that flow.
- Double-click or right-click a highlighted range to edit its name, bounds, rotation, and module flow in a floating Design Frame editor.
- Preserve ranges in saved projects, project backups, and full-library backups as part of the card snapshot.
- Include range changes in Design Frame undo history.
- Rotate range bounds with the rest of the layout when switching between portrait and landscape.
- Load older projects without Rules Range data as an empty range collection.

Design Frame also provides canvas creation tools. Select Text, Image, or Range and drag on the preview to create an element at that bounding box. Right-click an empty point on the preview to create an element there with a default size. Right-clicking an existing highlighted text box, custom image, frame component, or Rules Range opens its floating geometry editor; **Open Full Editor** remains available for detailed settings.

Editable text boxes, image/frame components, and Rules Ranges display a small red **X** at a corner of their canvas highlight. Clicking it removes that element as an undoable Design Frame change.

Rules Ranges support ordered repeatable modules. Each module can reserve a fixed pixel size or consume a weighted share of the remaining space, and the allocation follows the range's vertical or horizontal module flow. If fixed sizes exceed the range, they are proportionally compressed and highlighted as an overflow condition. Duplicate Module copies its configuration and attached text/image elements as independent fields and focuses its name for editing. Attached elements store pixel offsets from the module's top-left corner plus pixel width and height, editable in the module panel. Their position follows the module when the range or allocation changes; their dimensions stay consistent. Previously saved proportional attachments remain readable and can be converted by editing their anchor. Detaching leaves an element at its current location. Newly created canvas elements appear in the attachment list immediately (and the list refreshes on focus). During creation and editing, element edges snap within 8 editor pixels of range and module edges.

Adding a module immediately reflows attached elements and records one undo step. Removing a duplicated module also removes only the independently copied text and image layers it owns; undo restores the module and those layers together. The module panel has a direct Undo Module Change button, and Ctrl+Z works while the auto-selected module name is unchanged (normal text editing retains its native undo).

### Class Rules Range prototype

The frame browser offers **Class (Rules Range Prototype)** alongside the unchanged **Class (D&D)** and **Class (Universes Beyond)** options. The legacy Class implementation remains in `js/frames/versionClass.js` and `js/frames/packClass.js`; the pre-prototype repository is preserved on the `backup/legacy-class-before-rules-range` branch. Selecting the prototype creates four Class modules with anchored ability text, cost and title fields, and level-header image layers. Ability text heights follow the module's allocated space, so changing module count or size reflows text. Duplicate Module copies the cost, title, text, and header as independent elements. The prototype is for manual Frame Designer testing; the legacy Class height editor and automatic Scryfall ability mapping do not apply to this experimental variant yet.

Each Rules Range has independent **Auto-size modules to text** and **Uniform text size across modules** checkboxes in the Design Frame panel and the floating range editor. With auto-size on, vertical modules reserve enough height for anchored image layers and an estimated wrapped-text layout, then the final flexible module consumes spare range space. A fixed module keeps at least its requested size. If content exceeds the range, font reduction is capped at 25 pixels and overflow remains visible. With uniform text size on, matching font styles use the smallest effective font size across modules and share any additional range-wide fit reduction; the renderer does not independently shrink them. Normal font-size values are preserved, and turning the options off returns to the original layout. Editing attached text triggers another layout calculation. Horizontal flow continues using the original sizing algorithm.

Class header image layers are composited above the base Class frame and remain individually attached to their modules. Cost and name text in the same Class header is clipped to separate parts of one shared lane without rewriting the text boxes' dragged geometry; long content receives a bounded font reduction rather than painting over its neighbor. Previously saved Class prototype ranges acquire those header-lane rules when reopened.

Double-clicking a text element in Design Frame opens its font, base size, font-size override, alignment, color, line/letter spacing, shadow offsets, outline, single-line, and top-alignment controls. The font menu lists only fonts bundled for card faces. A text field may create or join a range-local style family; editing one member's style propagates the same style properties to every member without copying text contents or geometry. Families and membership are stored inside the Rules Range, so project save/load and Design Frame undo keep them together. **Edit Module Elements** opens a module preview and element list, with controls to create text fields or image layers and open the selected element's editor. Image layers currently use the existing frame editor for geometry and image settings; image-specific shared families are not implemented.

The text popup treats geometry changes, text style changes, and style-family membership as separate actions. Font, top alignment, and family edits never round, snap, or rewrite a dragged box's anchor. A manual vertical resize clears the Class prototype's automatic text-height rule for that element. The popup can create an entire range-local family by selecting multiple text fields across the range, or update a family's selected membership later. The module preview labels family membership and returns after closing an element's floating editor.

The family picker also shows the current source field as permanently included (checked and disabled). Manual box movement and edge resizing snap to other text/image edges as well as range/module guides; movement can center-align with another element. The module editor preview uses the same attached bounds as the card: drag to move, use corner handles to resize, double-click to edit, and click the small X to remove an owned element or detach a pre-existing one. These changes update module anchors and are undoable.

## Next V1 phases

1. Save reusable module templates such as Class Level and Planeswalker Ability.
2. Expose Rules Range module fields to CSV mapping and collision-aware text fitting.
3. Publish a project as a named Frame Type and Frame Variant in the normal frame browser.

## Deferred to V2

Raster painting and image-authoring tools are deferred:

- Pencil and brush tools.
- Pixel eraser.
- Freeform selection.
- Bezier/curve drawing.
- Full undo/redo history.
- Rasterized editing exports.

V1 may include non-destructive rectangle and ellipse masks without introducing a complete raster editor.
### Dungeon room modules (prototype)

The existing Dungeon (AFR) frame and its coordinate-list editor remain available. The separate
Dungeon (Room Modules Prototype) frame uses the same wall artwork, but stores each room as a
card-relative module with a stable ID, name, bounds and owned text field. In the Dungeon tab,
select, rename, position, add, duplicate or remove rooms; in Frame Design, enable the purple
range highlights to move, resize, remove or double-click individual rooms. Canvas moves and
resizes preserve continuous card coordinates. Room walls and text follow room bounds.
For every nonzero shared wall segment between two rooms, draw one doorway at that segment's
midpoint, whether the wall is horizontal or vertical. Corner contact creates no doorway.
Rooms are free-form: dragging preserves continuous bounds; the coordinate fields are card pixels,
not old dungeon grid cells. A nearby shared edge snaps within eight pixels when the drag ends.
The preset wall colors use an image texture masked by the wall shape, plus an outline layer drawn from the same geometry. The Dungeon tab can upload a custom full-card wall-color texture; the image is saved on the
card and can be selected alongside the built-in colors. Large uploads can exhaust local save
storage. Room edits, texture changes and duplication/deletion participate in design undo. Custom
door positions and independently anchored frame components are not part of this prototype.

Dungeon prototype wall repair: coincident sides are merged into single wall segments before centered doorway intervals are removed. The prototype no longer positions opposite legacy wall sprites or overlays the fixed legacy perimeter, which caused double walls and offset doors. The original Dungeon (AFR) renderer still uses its original artwork.
