# PetPal UI/UX Transformation Plan

## Implementation Target

The active mobile app is `PetPalMobileBuild`. The transformation target is a visibly premium, animal-first adoption/foster product, not a smoke-test demo.

## Implemented Surfaces

- Compact PetPal command header instead of the old oversized header.
- Dark, compact bottom navigation with stable letter marks.
- Photo-led Discover screen with local feed metrics, trust status, filters, and editorial listing cards.
- Detail screen with a dark animal profile hero, visible trust rules, and application-first actions.
- Guided application flow preserved with structured Home, Experience, Motivation, and Review steps.
- Applications, Inbox, Shelter, and Profile remain modular and connected to shared design tokens.

## Acceptance Criteria

- The phone-loaded first screen must look materially different from the earlier smoke-test surface.
- Discover uses real/generated animal imagery as the first visual signal.
- Adopt/Foster remain the only active public modes.
- Exact locations remain private; only coarse location is shown.
- Chat remains gated behind accepted applications.
- `pnpm exec tsc --noEmit` must pass before device install.
- Android debug APK must build and install to the connected phone.

## Figma Contract

The repo-level Figma generation prompt is:

`..\docs\design\FIGMA_GENERATION_PROMPT.md`

The milestone proof for this contract is:

`..\docs\milestones\M7_UI_UX_FIGMA_CONTRACT_PROOF.md`

Once a Figma file exists, implementation must use the exact selected frame or frame URL as the source of truth. The mobile app should then be adjusted to match that frame rather than continuing with hand-authored approximations.
