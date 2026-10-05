# Template color families and CSV

A saved Frame Designer project supplies the complete layout. Color families change
linked layer artwork while preserving bounds, text areas, ranges, modules, opacity,
rotation, and neutral artwork. Recognized stock elements automatically select existing catalog assets from CSV
colors. Custom artwork changes only when custom color switching is enabled and
its layers are explicitly linked. Blank CSV colors retain the saved appearance.

## Set up a layout

In **Frame Design → Element Tools → Template Colors**:

1. Create a family such as “Boss Pinline” or “Boss Rules Background”.
2. Select a color and upload that family's image for that color. All images in a
   family should have identical dimensions, framing, and element placement.
3. Select a layer and link it to the family. Other layers can share the family.
4. Enable custom family color switching and save the Frame Designer project.

Stock P/T badges, catalog sections, crowns, and attached prototype pieces do not
need families. Automatic stock colors are on by default and can be disabled with
**Automatically color recognized stock elements from CSV**. Stock P/T selection
follows the regular importer: two colors use the multicolor badge, with artifact
and vehicle badges chosen for those card types. Uploaded custom artwork remains
unchanged unless linked. Stock source/style metadata is retained through container
resizing so artwork can still change after editing geometry.

“Use Layer Artwork for Selected Color” records the selected layer's existing
image. “Add Available Stock Colors” generates variants for supported stock P/T
layers, rules backgrounds with a catalog appearance, attached prototype backgrounds,
and their optional mana/P/T pieces. Custom title bars, crowns, and pinlines can
use uploaded or captured variants. The stock shortcut does not link the layer;
choose **Link Layer to Family** afterward.

A family normally contains an image of just its element. For a complete-frame
upload, expand **Source region** and specify its crop as fractions of the source
image. Multiple layers can link to the same family using different crops. The
crop must describe the same region in every color image. Existing layer masks
are retained. “Left color” and “Right color” choose the requested side's artwork;
they do not introduce a new half mask. Use these with existing masked half layers
or half-specific images. “Single color or blended two colors” composes both colors
with the existing feathered right-half mask at the layer's card coordinates.

Use **Remove Family from Layer** to detach a custom link. It does not delete the
family, its uploaded assets, or the layer. Recognized stock elements then resume
automatic selection; unrecognized custom artwork remains unchanged. Explicit
custom links take precedence over stock lookup. Neutral borders and symbols
need no links.
Families, variants, and linked masks are included in project save/export/import.
Family creation, image association, linking, and unlinking participate in design
undo/redo.

## CSV columns

| Column | Behavior |
| --- | --- |
| Template | Exact saved Frame Designer project name |
| Color | W, U, B, R, G, C, M; names such as Blue; or pairs such as BG |
| Color Identity | Used when Color is blank |
| Frame Left Color | Explicit single color for the left side |
| Frame Right Color | Optional single color for the right side; requires Frame Left Color |

Blank colors preserve the saved artwork. More than two colors select the
Multicolor variant. Explicit left/right columns take precedence over Color and
Color Identity. A missing requested custom or stock variant or family fails that row before the
live card is loaded; there is no silent fallback to an unrelated color.

Map custom text columns using **Template fields by label**. Fields match their
CSV label or display name rather than a generated textbox ID, so equivalent fields
can have different IDs across templates. Custom field headers auto-map by label;
existing standard column aliases retain priority. Give fields distinct labels
within a template. Missing or ambiguous labels appear as warnings and do not
replace text in an arbitrary field. Blank mapped cells clear the field, and
multiple columns mapped to one label are joined with a newline.

This mechanism is layout-independent. Class and Dungeon templates can use the
same families and CSV label mappings; specialized room/level content and count
columns remain separate future work.
