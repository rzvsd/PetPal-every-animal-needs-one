# PetPal design system

The one source for how PetPal looks, moves and speaks. The code that implements
it lives in `frontend/src/ui/` (tokens in `frontend/src/index.css`). Older drafts
are kept in `docs/history/` for reference only.

## Direction: alive

Real animals, real footage, bold colour. The app opens on a short film of
happy animals, lands on two living video doors (Match and Foster), and each
world has its own saturated palette. Inside, the photo is the screen: the
Match card, Foster's hero card and the animal shelves put the animal's picture
edge to edge with the words on top.

Rules that follow from this:

- **Footage, not illustration, for the big moments.** Launch, doors and bursts
  use short muted clips (`frontend/public/film/`, Pexels licence, 540×960,
  under 1 MB each). The 3D characters are kept for small empty states.
- **Two worlds, one system.** `[data-world='match']` (sunset: coral, amber, hot
  pink on peach) and `[data-world='foster']` (forest: green, gold on mint)
  override the same tokens, so every component recolours with the world.
- **Photos carry the page.** Name and actions sit on the picture with a
  gradient; lists of animals are photo tiles, not text rows.
- **Only floating things are raised,** and nothing blurs over a moving
  surface (backdrop filters on the Match card cost 30% of frames on device).
- **Moments people record:** hearts from under the thumb on like, the
  full-screen sunset match, the world burst on entering.

## Tokens (`frontend/src/index.css`)

| Token | Value | Use |
| --- | --- | --- |
| `--pp-night` | `#0e1612` | Launch, doors, tab bar |
| `--pp-bg` | world tint (peach `#ffe9d6` / mint `#dff1de`) | Page background inside a world |
| `--pp-bg-deep` | `#ece4d6` | Fields, segmented tracks, skeletons, secondary buttons |
| `--pp-surface` | `#fffdf8` | Sheets, tab bar, raised panels |
| `--pp-ink` | `#1b2520` | Text (13.9:1 on paper) |
| `--pp-muted` | `#5a665f` | Secondary text (5.3:1 on paper, 4.75:1 on deep) |
| `--pp-faint` | `#8b948d` | Chevrons and decorative marks only (2.75:1, never text) |
| `--pp-line` | `#e2d8c7` | Hairlines |
| `--pp-green` / `--pp-accent` | coral `#ff5a3c` / green `#157a45` | The world's action colour; text on it is `--pp-on-accent` |
| `--pp-accent-2` | amber `#ffb347` / gold `#f7c948` | Tags, active tab, highlights |
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
