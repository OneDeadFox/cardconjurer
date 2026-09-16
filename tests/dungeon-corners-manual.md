# Dungeon corner controls

Select the dungeon rules-range prototype and open Design Frame in layout mode with range outlines enabled. Double-click a mint circle at a room corner to open its editor. The room delete button is offset left to keep the corner accessible; resize rooms using their edges.

Choose Square, Rounded, Beveled, or Inward cut. Corner size is in card pixels and is limited by nearby junctions and doorways. Coincident corners share edits. Under Transition, select an arm, enable its fade, and set the fade length. The wall and its outline become transparent toward the next junction or doorway. Reset restores the square shape and removes fades.

Browser checks: change all four presets; edit an exterior corner and a shared junction; toggle fades independently; duplicate, move, resize, and delete a room; save and reload; undo/redo edits; close with Escape and switch tabs. Confirm uploaded wall textures still show through the selected shapes. Automated geometry checks: `node tests/dungeonCorners.test.cjs`.

T up/down/left/right presets add a third arm at a corner. Incompatible orientations are disabled to preserve existing connected walls. Test project restore by saving two different dungeon layouts, switching between them (including different card sizes), and verifying room positions, T shapes, texture and auto-fit settings. Also test export/import and an intentionally empty layout. Regression check: `node tests/dungeonProjectRestore.test.cjs`.
