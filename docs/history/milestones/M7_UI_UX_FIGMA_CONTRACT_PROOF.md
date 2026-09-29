# M7 UI/UX Figma Contract Proof

## Status

Implemented as the next milestone boundary.

M7 does not replace the backend milestones. It locks the visual product direction and the Figma-to-code contract so the next design pass can be implemented 1:1 instead of guessed from chat.

## Goal

Make PetPal ready for a proper Figma design pass and prevent the old smoke-test UI from being treated as complete.

## Scope

M7 covers:

- Full Figma generation prompt.
- Public mobile screen inventory.
- Tab-by-tab product purpose.
- Required screen sections.
- Product wording.
- Empty, demo fallback, and error states.
- Safety and moderation expectations.
- Phone evidence for the current v2 mobile surface.

M7 does not cover:

- Implementing a future Figma frame before it exists.
- Adding Mate, Play, Services, or Community to public v1.
- Reopening animal sales, breeding, or open chat.
- Replacing the Supabase/runtime milestones.

## Active Mobile App

The active mobile app remains:

`C:\BOTS\PetPal - every animal needs one\PetPalMobileBuild`

The phone-loaded package is:

`com.petpal.app`

## Figma Prompt Artifact

The Figma generation prompt is stored at:

`docs/design/FIGMA_GENERATION_PROMPT.md`

This prompt defines:

- PetPal product thesis.
- Launch boundary.
- Safety principles.
- Main tabs.
- Discover screen.
- Animal detail screen.
- Application wizard.
- Applications tab.
- Inbox tab.
- Shelter tab.
- Profile tab.
- Optional admin moderation concept.
- UX requirements and avoid list.

## Mobile Implementation State

The active mobile implementation now includes:

- Compact command header.
- Photo-led Discover screen.
- Trust metrics strip.
- Local feed status panel.
- Rescue-lane filters.
- Editorial animal cards.
- Animal detail profile hero.
- Trust rules section.
- Application-first action flow.
- Modular tabs for Discover, Applications, Inbox, Shelter, and Profile.

The mobile app keeps:

- Adopt and Foster only.
- Dogs and cats only.
- Coarse location only.
- Application before chat.
- Gated inbox.
- Report/block affordances.

## Phone Evidence

Evidence folder:

`C:\BOTS\PetPal - every animal needs one\evidence\ui-v2-implementation-2026-04-27`

Key evidence:

- `01-discover-v2.png`
- `01-discover-v2-ui.xml`
- `02-package.txt`
- `03-logcat.txt`

Installed proof:

- Device: `R3CXA03J3LH`
- Package: `com.petpal.app`
- Version: `1.0.0`
- Last update time: `2026-04-27 19:50:32`

The screenshot shows:

- Compact PetPal header.
- `trusted rescue pilot` label.
- `Find the right next home, not just the nearest one.`
- `Demo field board`.
- Trust metrics.
- Local trust feed.
- New compact bottom tabs.

## Quality Checks

Passed:

- `pnpm exec tsc --noEmit`
- Android debug build
- `adb install -r`
- Device launch
- UI tree capture
- Screenshot capture
- Logcat scan for fatal, RedBox, unresolved module, TypeError, ReferenceError, invariant, and syntax failures

## Acceptance Criteria

M7 is accepted when:

- The Figma generation prompt exists in repo documentation.
- The active mobile implementation no longer presents the old smoke-test visual surface as final.
- The phone evidence proves the v2 UI is installed and visible.
- The next design step is unblocked: create Figma frames from the prompt, then implement them with Figma MCP using exact frame links.

## Next Milestone

M8 should be **Figma-to-Code Implementation**.

M8 begins only after a Figma design file exists and the exact frame link or selected node is available.

M8 acceptance should require:

- Figma design context fetched.
- Figma screenshot fetched.
- Assets exported or referenced.
- Mobile implementation updated for visual parity.
- Phone screenshots captured against the implemented frames.
- No regressions to Adopt/Foster-only, privacy, and gated chat rules.
