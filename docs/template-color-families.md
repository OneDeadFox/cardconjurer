# Template color families and CSV

A saved Frame Designer project supplies the complete layout. Color families change
linked layer artwork while preserving bounds, text areas, ranges, modules, opacity,
rotation, and neutral artwork. Existing projects retain their appearance until
color switching is enabled and layers are explicitly linked.

## Set up a layout

In **Frame Design → Element Tools → Template Colors**:

1. Create a family such as “Boss Pinline” or “Boss Rules Background”.
2. Select a color and upload that family's image for that color. All images in a
   family should have identical dimensions, framing, and element placement.
3. Select a layer and link it to the family. Other layers can share the family.
4. Enable CSV color switching and save the Frame Designer project.

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

Use **Keep Layer Fixed** for neutral borders, symbols, and other unchanged artwork.
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
Color Identity. A missing requested variant or family fails that row before the
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
