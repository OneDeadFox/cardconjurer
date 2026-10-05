# Stage/Boss CSV test

Keep both faces in one row. Add `Transform` (`TRUE`), `Template` (saved Stage
project name), and `Alt Template` (`Boss Frame Established`). Use `Art File` or
`Art URL` for the front and `Alt Art File` or `Alt Art URL` for the back.
Both named projects must be saved in the browser's Frame Designer project store.

The importer recognizes these existing headers:

| Header | Mapping |
| --- | --- |
| Card # | Collector Number |
| Supertype | Supertype 1 |
| Alt Supertype / Alt Supertype 2 | Back supertypes |
| Alt Card Type–3 / Alt Subtype–3 | Back type-line parts |
| Ability 4/Boss Ability | Alt Ability 1 (Boss main rules) |
| Ability 5/Loot Box | Back template field: Prototype Rules |
| Recovery | Metadata; no text is generated yet |

Keep Color Bucket as metadata; Color Identity and Alt Color Identity select the
individual faces' colors. Existing primary Ability, Ability 2 and Ability 3 map
to the Stage's initial, first-level, and second-level ability fields respectively
when the template has numbered sections.

In the column-mapping dropdown, use **Front template text fields** for the Stage's
level titles and costs. For the Class-based Stage template, the first upgrade's
fields are normally `2 - Name` and `2 - Cost`; the second upgrade's are normally
`3 - Name` and `3 - Cost`. Select the labels that actually exist in your saved
Stage template. These mappings apply only to the front. **Back template text
fields → Prototype Rules** fills the Loot Box only on the Boss face. Both-face
label mappings remain available for intentionally shared fields.

Separate templates retain their own dimensions/orientation. Optional Alt Card
Orientation can override the back without applying the front's orientation to it.

Preview the front and back of the same row, then export both faces. Check Stage
section placement, Boss main rules and Loot Box, 0/18 P/T, independent artwork and
colors, and the pipeline blend. Missing named projects and Alt Template without
Transform = TRUE are validation errors. Extra reporting/detail columns can be
ignored; the importer does not parse Copy Package or combined Card Details text.
