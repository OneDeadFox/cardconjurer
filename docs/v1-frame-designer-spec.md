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

## Next V1 phases

1. Direct manipulation handles on the card canvas.
2. Portrait and landscape project orientation.
3. Publish a project as a named Frame Type and Frame Variant.
4. Make published templates selectable by the CSV builder.
5. Export/import a portable project package containing its project data and image assets.

## Deferred to V2

Raster painting and image-authoring tools are deferred:

- Pencil and brush tools.
- Pixel eraser.
- Freeform selection.
- Bezier/curve drawing.
- Full undo/redo history.
- Rasterized editing exports.

V1 may include non-destructive rectangle and ellipse masks without introducing a complete raster editor.
