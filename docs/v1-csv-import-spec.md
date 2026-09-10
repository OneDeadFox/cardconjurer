# V1 CSV Import Specification

Status: Draft

## Goal

Import flexible CSV files, map their columns to Card Conjurer fields, generate cards without using the existing 5 MB localStorage saved-card list, and export the batch sequentially.

## Built-in import fields

### Primary face

- Card ID
- Include
- Name
- Chunk (the current test CSV uses the header Player as an alias)
- Color
- Color Identity
- Mana Cost
- Mana Value
- Rarity
- Type Line, or structured Supertype / Card Type / Subtype fields
- Ability 1
- Ability 2
- Ability 3
- Ability 4
- Flavor Text
- Power
- Toughness
- Loyalty
- Defense
- Art File
- Art URL
- Artist
- Set Code
- Collector Number
- Language
- Year

### Alternate face

- Alt Ability 1
- Alt Ability 2
- Alt Ability 3
- Alt Ability 4
- Alt Power
- Alt Toughness
- Alt Flavor Text
- Transform (boolean): use a double-faced transform layout
- Flip (boolean): use the classic Kamigawa-style 180-degree flip layout

Transform and Flip are distinct layout modes. For V1, the importer must report an error when both are true for the same row. A future layout mode should support cards that intentionally use both.

### Current Transform generation

- A true `Transform` value renders two independent card faces.
- The front uses the primary Name, Mana Cost, Type Line, Ability, Flavor Text, Power/Toughness, Color, and Art fields.
- The back uses the corresponding `Alt` fields. Blank Alt Name, Alt Type Line, Alt Color, and Alt Artist values inherit their primary-face values where appropriate.
- The preview face selector can display either face before export.
- Each Transform row exports `Output Filename - Front.png` and `Output Filename - Back.png` into the row's Chunk ZIP.
- Transform artwork uses `Art File` / `Art URL` for the front and `Alt Art File` / `Alt Art URL` for the back.
- `Alt Art` is accepted as an alias for `Alt Art File`; `Alt Creature Type` and `Alt Type` are accepted as aliases for `Alt Type Line`.
- The initial implementation uses Card Conjurer's regular M15 transform-front and transform-back frames. Additional transform frame variants remain future work.
- `Flip` remains a separate single-canvas layout and is the next implementation step.


Complete two-face support should also provide:

- Alt Name
- Alt Mana Cost
- Alt Type Line, or structured Alt Supertype / Card Type / Subtype fields
- Alt Color
- Alt Color Identity
- Alt Art File
- Alt Art URL
- Alt Artist

### Generation controls

- Frame Type
- Frame Variant
- Template
- Output Filename

`Frame Type` selects Card Conjurer's layout or frame family. `Frame Variant` refines that choice (for example, `M15` + `Regular`). If both are blank, the row inherits the captured template frame. `Color` selects the frame color; when `Color` is `Multi`, `Color Identity` supplies its component colors. `Template` selects a saved user configuration within that frame type.

## Artwork files

- `Art File` contains a filename relative to a folder selected for the current browser session (for example, `Test Card 1.png` or `blue/Test Card 1.png`).
- The file extension may be omitted; the importer checks PNG, JPG, JPEG, WebP, BMP, and SVG in that order.
- The user selects the artwork folder with the CSV import panel before preview or export.
- Artwork is read directly from that folder, auto-fitted, and loaded before the canvas is captured.
- Folder handles and artwork data are not stored in localStorage.
- `Art URL` is an alternative and takes precedence when both artwork fields contain a value.
- Missing, unreadable, or non-image files produce a row-specific preview/export error.


## Ability assembly

- Nonblank Ability 1 through Ability 4 values are combined in numeric order.
- The default separator is a paragraph break.
- Nonblank Alt Ability 1 through Alt Ability 4 values are combined in numeric order for the alternate face.
- A mapping preset may override the destination textbox, order, and separator.

## Flexible column mapping

- Detect every CSV header.
- Automatically map recognized headers and aliases.
- Allow any unknown or custom column to be:
  - ignored;
  - retained as metadata; or
  - mapped to a labeled template text field.
- Give every template text field a stable ID, editable label, and optional import key.
- Permit several source columns to target one text field with configurable order and separator.
- Save reusable mapping presets with templates.
- Warn when a mapping references a text field missing from the selected template.
- Support common boolean forms such as TRUE/FALSE, Yes/No, and 1/0.

## Current feature-control registry

The CSV mapper exposes a controlled, expandable list of Card Conjurer controls. A custom CSV header can be manually assigned to any of these destinations without adding a new hard-coded import column.

- Artwork: X, Y, scale, rotation, and grayscale.
- Set symbol: X, Y, and scale.
- Watermark: X, Y, scale, and opacity.
- Every textbox in the captured template: text content, X, Y, width, height, and font-size adjustment.

X, Y, width, and height values use the same editor-pixel measurements shown by Card Conjurer. Scale and opacity use percentages, rotation uses degrees, and grayscale accepts the same boolean forms as Transform and Flip. Blank cells keep the captured template value.

This registry deliberately exposes supported controls instead of executing arbitrary object paths from a CSV. New Card Conjurer controls can be added to the registry without redesigning the importer. Feature-control values currently apply to both faces of a Transform card; face-specific controls can be added later.

## Chunked export

- Group every generated card by its Chunk value.
- Export each nonblank Chunk as its own ZIP file.
- Use a safe version of the Chunk value as the ZIP filename.
- Put rows with no Chunk value into an Unassigned ZIP.
- Treat the current Player header as an alias for Chunk so the test CSV remains valid.
- Keep Chunk as the internal field name even while the interface temporarily displays Player.

## Storage and export

- Keep CSV batches in session memory.
- Snapshot the selected template once.
- Render cards sequentially.
- Do not require saving generated cards to localStorage.
- Use a streaming ZIP export where supported.
- Provide chunked ZIP downloads as a bounded-memory fallback.
- Store persistent templates, mapping presets, and custom image assets in IndexedDB.
- Support portable JSON/project export for backups and sharing.

## Current test CSV

The initial parser test contains these headers:

`Name, Player, Color, Identity, Cost, Rarity, Creature Type, Ability, Power, Toughness`

This sample validates parsing only and does not define the final schema.
