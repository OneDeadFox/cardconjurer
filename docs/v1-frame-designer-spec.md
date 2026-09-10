# V1 Frame Designer Specification

## Goal

Turn Card Conjurer's existing Frame tab into a persistent, reusable frame-authoring workspace. Imported frame images should survive browser restarts, drafts should be resumable, and completed projects will later become named templates available to CSV generation.

## Terminology

- **Asset:** An imported frame image or mask stored once in IndexedDB.
- **Project:** An editable draft containing the current card dimensions, frame layers, masks, text layout, art bounds, and other card-layout settings.
- **Template:** A published project assigned a Frame Type and Frame Variant for reuse and CSV generation. Template publishing is the next phase after project persistence.

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

## Current workflow

1. Open the **Frame** tab.
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

## Next V1 phases

1. Layer rotation, horizontal flip, vertical flip, visibility, duplicate, and reset.
2. Direct manipulation handles on the card canvas.
3. Portrait and landscape project orientation.
4. Publish a project as a named Frame Type and Frame Variant.
5. Make published templates selectable by the CSV builder.
6. Export/import a portable project package containing its project data and image assets.

## Deferred to V2

Raster painting and image-authoring tools are deferred:

- Pencil and brush tools.
- Pixel eraser.
- Freeform selection.
- Bezier/curve drawing.
- Full undo/redo history.
- Rasterized editing exports.

V1 may include non-destructive rectangle and ellipse masks without introducing a complete raster editor.
