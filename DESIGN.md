# PetPal design system

The one source for how PetPal looks, moves and speaks. The code that implements
it lives in `frontend/src/ui/` (tokens in `frontend/src/index.css`). Older drafts
are kept in `docs/history/` for reference only.

## Direction: a field journal about animals

Warm paper, ink text, and photographs of the animals as the protagonists.
Structure comes from type, alignment and space, not from boxes. The app must look
finished with every animation turned off; motion only adds refinement.

Rules that follow from this:

- **Don't make every section a card.** Lists are rows on the paper separated by
  hairlines that start under the text, never under the picture.
- **Only floating things are raised:** sheets, the tab bar, toasts, and the one
  panel laid over a photo. Nothing else gets a shadow.
- **Photos carry the page.** The Match card is the photo; detail pages open on a
  full-bleed photo; lists lead with the animal's picture.
- **One accent per job.** Green means act. Clay means look here (unread, urgent,
  attention). Sun is used sparingly, for small highlights on dark ground.
- **No decoration without a role.** No gradients, blobs, emoji icons or looping
  animations.

## Tokens (`frontend/src/index.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--pp-bg` | `#f5f0e6` | The paper every screen sits on |
| `--pp-bg-deep` | `#ece4d6` | Fields, segmented tracks, skeletons, secondary buttons |
| `--pp-surface` | `#fffdf8` | Sheets, tab bar, raised panels |
| `--pp-ink` | `#1b2520` | Text (13.9:1 on paper) |
| `--pp-muted` | `#5a665f` | Secondary text (5.3:1 on paper, 4.75:1 on deep) |
| `--pp-faint` | `#8b948d` | Chevrons and decorative marks only (2.75:1, never text) |
| `--pp-line` | `#e2d8c7` | Hairlines |
| `--pp-green` / `-strong` / `-soft` | `#2e5b45` / `#21442f` / `#e1ebe2` | Actions, selection, success |
| `--pp-clay` / `-soft` | `#a94f33` / `#f4e2d8` | Unread counts, urgency, attention |
| `--pp-sun` / `-soft` | `#edc063` / `#fbf0d6` | Highlights on dark ground |
| `--pp-danger` / `-soft` | `#a8402f` / `#f6deda` | Errors and destructive actions |

All text meets WCAG AA. White on green is 7.8:1, white on clay 5.4:1.

**Type.** Fraunces (variable, `SOFT 100`) for titles, animal names and big
numbers; DM Sans for everything else. Both ship with the app
(`@fontsource-variable`), including Romanian ș and ț, so they work offline.

| Class | Size | Use |
| --- | --- | --- |
| `.ui-title-xl` | 34/1.08 Fraunces | Page titles, a name on its own page |
| `.ui-title-l` | 28 Fraunces | Card names, sheet highlights |
| `.ui-title-m` | 22 Fraunces | Sheet titles, empty states |
| `.ui-title-s` | 17 DM Sans 650 | Emphasis inside text |
| `.ui-lede` | 15.5 muted | The sentence under a title |
| `.ui-small` | 14 muted | Secondary text |
| `.ui-overline` | 12 caps, 0.08em | Section labels |

**Space and shape.** 20px side gutter (`--pp-gutter`), 4px rhythm, 28px between
sections. Radii: 10–14 for fields, chips and buttons; 16–20 for thumbnails and
tiles; 28 (`--pp-radius-xl`) for hero photos and sheets. Pills are for badges only.
Touch targets are at least 44px.

## Components (`frontend/src/ui/kit.js`)

`Button` (primary, secondary, quiet, danger; shows a spinner while busy),
`IconButton` (plain, soft, ring, float), `TextField` (label, hint, error that grows
in, show/hide password), `Segment` (pill or underline, the mark slides),
`Row` (the list row), `Section`, `PageTitle`, `Avatar`, `Count` (unread number with
an accessible label), `Notice`, `Empty`, `Skeleton`, `Art` (the 3D characters) and
`OverScreen` (full pages that cover the header and tabs).

Foster pages use the same system through `frontend/src/foster/ui.js`
(`Screen`, `Sheet`, `Choices`, `Card`), styled in `foster/foster.css`. Inside a list,
a `Card` renders as a row; only `.fx-next` (the next step) and `.fx-lift` (a panel
over a photo) are raised.

## Illustration

The 3D characters from the intro (dog, cat, house, paw, heart; Blender, see
`frontend/scripts/reel/`) are PetPal's only illustrations. `Art` plays their short
entrance once when they appear and shows the still (`public/art/`) otherwise, or
when motion is reduced. Use them for empty states, the space chooser, first-visit
choices and sign-in. Never mix in flat illustrations or emoji.

## Motion (`frontend/src/ui/motion.js`)

Every movement answers one question: what happened, where did I land, or what can
I do next. It is short, interruptible and never loops.

| Pattern | Motion |
| --- | --- |
| Tap | Scale to 0.97, immediate |
| Switch tabs | Fade through: out 90ms, in 220ms with a 6px settle |
| Open a page | Slides in from the side it leaves by (spring 340/36) |
| Photo to detail | Shared-element transform of the same photo (`layoutId`) |
| Choose one of a few | The selection mark slides to the new choice |
| Answer a Match card | After the server confirms, the card leaves left (no) or right (yes); the next one rises from behind. The card can also be dragged. |
| Something grows open | Height and opacity together (`expand`) |
| First appearance of a list | 35ms stagger, 8px rise; never on refresh |
| Title under a photo | The bar title rises into place once the big title scrolls away |

No celebration before an action is confirmed, no permanent animation, no
artificial delays. With reduced motion (the phone setting or Profile, Notifications
& comfort), `MotionConfig` removes movement and only opacity remains.

## States

Every screen designs all of its states: loading (skeletons shaped like the
content), empty (a 3D character, one sentence, one action), error (what happened
and a retry), success (a notice that fades after 5 seconds), offline (the network
message), forms (errors under the field, focus moves to the first one), the keyboard
open, and long text (truncate with an ellipsis in rows; wrap on detail pages).

## Words

Romanian first, with proper diacritics (ș and ț with a comma below). Plain words a
child could follow: "Accept", "Not now", "Offer my home", not "Receipt declaration"
or "Reconfirm historical reservation". Say what happens next. Numbers and dates
follow the chosen language. Legal disclaimers live in Help & rules, not on every
screen.
