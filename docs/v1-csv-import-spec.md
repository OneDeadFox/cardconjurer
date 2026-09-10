# V1 CSV Import Specification

Status: Draft

## Goal

Import flexible CSV files, map their columns to Card Conjurer fields, generate cards without using the existing 5 MB localStorage saved-card list, and export the batch sequentially.

## Built-in import fields

### Primary face

- Card ID
- Include
- Name
- Player
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
- Transform (boolean)
- Flip (boolean)

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
- Template
- Output Filename

`Frame Type` selects Card Conjurer's layout or frame family. `Template` selects a saved user configuration within that frame type.

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
