---
name: field-operations-ui
description: Design and review dense, touch-first operational interfaces for phones and tablets used during real work. Use for field tools, crew or roster management, rapid data entry, assignments, evaluations, warnings, and compact responsive mockups; avoid for marketing pages or decorative portfolio sites.
---

# Field Operations UI

Design calm, modern working screens where a hurried user can identify context, people, status, and the next action without interpreting decoration.

## Product contract first

Preserve domain rules, data distinctions, navigation constraints, and explicit user choices. Treat a visual mock as a proposal until approved. Do not modify product code when the task is limited to planning or design.

Map every screen to one primary decision. Put the information needed for that decision together. Remove repeated explanations, empty wrappers, oversized headings, and navigation that is invalid in the current state.

## Visual direction

Use restrained brand cues: a neutral surface, strong readable ink, one primary action color, and semantic warning colors. Prefer whitespace, alignment, typography, borders, and small brand assets over gradients, animation, decorative illustrations, or dashboard chrome.

Derive brand cues from supplied authoritative assets and references. Distinguish observed style from an official brand standard. Preserve original marks; crop or place them without implying a redesigned logo was approved.

Use a system sans-serif or the confirmed brand typeface. Keep a small hierarchy with consistent weights and line height. Use icons with coherent stroke, size, and button treatment; do not substitute arbitrary text characters when the user expects controls.

## Density and touch

Prioritize names and identifiers. Give them enough width to remain on one line in normal data, and test long names explicitly. Use secondary text only when it helps the immediate decision.

Keep interactive targets about 44 CSS pixels where practical. A compact control may look smaller while its hit area remains large. Direct selection is preferred for short finite choices. Use a switch for a binary preference and visible buttons for mutually exclusive values.

Sticky or floating controls must not cover content. Reserve a stable rail when multiple bottom actions are required. Keep error or warning reasons reachable from the indicator itself.

On narrow screens, change grouping before shrinking text. Record intentional scrolling as a tradeoff; do not compress the whole screen to meet a zero-scroll target.

## Interaction completeness

Mock the actual path, including where navigation appears or disappears. A modal or sheet flow stays in context when leaving the page would interrupt the task. Camera capture may use a full-screen surface, then return to crop/rotate/review. Rotation controls should represent the supported range instead of implying only a fixed 90-degree step.

For selections and assignments, make add, move, remove, cancel, conflict explanation, and confirmation discoverable. A label must not rely on color or a symbol alone. Warnings open their reasons; destination controls open destination choices.

Design normal, dense/long-name, warning, empty, loading, error, permission-denied, and recoverable states where relevant. Do not claim persistence, hardware access, OCR accuracy, or other real behavior from a synthetic mock.

## Review loop

Render the agreed large, middle, small, and stress widths with realistic record counts. Inspect screenshots as well as numeric checks.

Check:

- no page-level horizontal overflow;
- names, identifiers, and active context remain readable;
- buttons look actionable and have usable hit areas;
- fixed elements do not cover data or controls;
- empty and error states still expose recovery;
- same record and status look consistent across screens;
- the visual hierarchy remains calm when warnings are present.

Record measured scroll and unresolved visual tradeoffs. Ask the user to judge the few decisions that require taste or field context; carry clear corrections directly into the next revision.

## Anti-template pass

Before presenting a revision, remove choices that came from generic UI defaults rather than the subject:

- repeated identical rounded cards for ordinary list rows;
- decorative pills, metrics, uppercase eyebrow labels, middle-dot metadata, and arrow suffixes;
- one border radius and one shadow applied to every object;
- gradient washes, warm cream/terracotta presets, or dark-and-acid palettes without a brief-specific reason;
- framing every section when alignment or a divider already separates it.

Differentiate content in this order: spacing and alignment, typography, a row divider, a subtle surface change, then a border. Use shadow only when actual elevation or overlap needs explanation.

For this class of product, distinctiveness should come from the operational subject: course/session notation, boat identity, day rhythm, crew structure, and the supplied institutional marks. Do not manufacture visual personality that competes with the work.

## Concept and evidence discipline

Design the complete requested surface and its important states before calling a direction ready. Use separate detail views when a dense screen would make interaction or typography ambiguous.

Ground each revision in the user's latest accepted feedback and the visual assets actually provided. When reviewing an existing revision, use screenshots captured in the current run. Inspect the image itself, reject blank, cropped, stale, or loading captures, and tie findings to the visible screen. Do not claim accessibility compliance from screenshots.

Use [design research](references/design-research.md) when revising the skill or when a task needs the rationale behind these rules.
