# PetPal local playground — 8 September 2026

Persistent examples are installed in the local Supabase used by the phone build: **10 new animals, 8 additional owners, 6 additional foster homes, and 6 foster cases/requests**. They use ordinary app workflows. Names marked `Demo` / `Playground` and their stock photographs represent fictional examples.

## Start here

Reopen the app to reload your animals, or use **Refresh** in Foster Network. Your current saved profile is **Rzv** with **Missy**. It now also owns **Buddy · Demo** and **Playground House · Demo**. Your existing profile, Missy, and Ana Popescu home were preserved.

In **Animal Match**, use the animal selector at the top to switch between Missy and Buddy. Use **Filters → Cats** for Missy's cat examples if other species appear first. In **Foster Network → My home**, choose **Playground House · Demo** in **Active home**; the older home may be selected initially.

## Matches and social walks

| Try | Starting state / expected result |
| --- | --- |
| Missy → Like Nori | Nori already liked Missy. Liking back creates a mutual playdate match and chat. |
| Buddy → Like Daisy | Daisy already liked Buddy. Liking back creates a mutual playdate match and chat. |
| Buddy → Like Rex | An ordinary one-way like; no immediate match or chat. |
| Missy → Olive | Missy has already liked Olive; Olive has not liked back. |
| Buddy + Hugo, in Messages | Already matched; open the conversation and try replying. |
| Buddy + Finn, in Messages | Incoming Social Walk request. Accept or decline it yourself. |
| Buddy + Theo, in Messages | Accepted Social Walk request; chat is available. |
| Buddy + Cleo, in Messages | Declined Social Walk request; chat is closed. |
| Poppy | Fresh cat profile to like, save, or pass. No prearranged match. |

Finn, Cleo, and Theo have **Social Walk only** enabled. Rex, Nori, and Olive have **Playdate only** enabled. Buddy, Daisy, Hugo, and Poppy support both.

**Not now** is a browse/pass action, not a message or rejection sent to the other owner. A single like does not guarantee a match.

## Foster Network

All six prepared requests relate to **Playground House · Demo**.

| Animal | Starting state | What to try |
| --- | --- | --- |
| Daisy | Incoming invitation — pending | Requests → Incoming → Accept or Decline. |
| Rex | Incoming invitation — declined | Inspect the history and closed conversation. |
| Nori | Accepted; reserved, awaiting arrival | My home → Nori → declare receipt, or cancel the reservation. |
| Finn | Accepted; already in care | Open the care record, add a note, or complete the water/walk tasks. One task starts overdue. |
| Cleo | Outgoing application — pending | Requests → Outgoing; inspect or withdraw it. |
| Theo | Completed stay | Inspect care history and try the participant review flow. |

Approval creates a reservation. Declaring receipt is a separate action by the receiving home owner. These are participant statements, not platform certification.

The new homes are Playground House, Sunny Paws, Cat Corner, Garden Lodge, Quiet Nest, and Weekend Retreat. Cat Corner and Quiet Nest accept cats; Garden Lodge accepts dogs and declares itself unavailable. Quiet Nest has limited availability. The other homes are available. Playground House has four declared spaces, a Main room and a Quiet room, one animal in care, and one reservation at installation.

## Optional: play the other side

These are local demo accounts only. Password for the eight new owners: `petpal-demo-password`.

| Owner | Email | Animals |
| --- | --- | --- |
| Elena | `elena.play@petpal.local` | Daisy |
| Andrei | `andrei.play@petpal.local` | Rex |
| Ioana | `ioana.play@petpal.local` | Nori |
| Matei | `matei.play@petpal.local` | Finn |
| Sofia | `sofia.play@petpal.local` | Cleo |
| Vlad | `vlad.play@petpal.local` | Hugo |
| Mara | `mara.play@petpal.local` | Olive, Poppy |
| PetPal Playground | `playground@petpal.local` | Theo |

To return to Rzv after switching accounts, the existing local login is `ana.foster@petpal.local`, password `petpal-demo-password`. Signing in does not rename the profile. The generic **Use local demo account** button selects a different pre-existing account, not Rzv.

These owners are not bots: they will not automatically answer new messages, return likes, or approve requests. Use a second browser session/account to act as the other owner when desired. Your decisions persist; the examples are not automatically reset. They live on this computer's local backend and require the same phone/backend connection as the current development build.

## Implementation and verification

- Manual creation script: `petpal-supabase/supabase/seed/playground.sql`. It uses one transaction and a dedicated `0908000…` UUID namespace. Running it again is a no-op once the dataset exists, preserving play progress. It is deliberately excluded from the normal reset seed.
- Asset originals and source URLs: `petpal-supabase/supabase/seed/playground-assets/`. Sixteen images were uploaded to the local public `animal-photos` bucket under the new animal/home IDs. The SQL references those uploaded objects; SQL alone does not upload images.
- Match, Social Walk, foster requests, receipt, care tasks and completion were created with the existing application RPCs. New owner/pet identity records were inserted as local seed data. No application rebuild was needed.
- Verified all nine other animals are visible to Rzv through the authenticated discovery view, all six homes are visible, and the six requests have the expected states.
- Under the authenticated Rzv role, exercised both mutual matches, Rex's one-way like, Finn's walk acceptance, Daisy's foster acceptance, Nori's receipt, and task completion. Rolled the transaction back so those actions remain available to try.
- Confirmed the Rzv browser UI shows Missy/Buddy, the match/walk conversations, incoming foster decisions, and the new home. Confirmed a new owner (Elena) can log in through the actual auth API. All sixteen public image URLs returned HTTP 200.
- The phone package was not rebuilt or reinstalled for this data-only task. Browser/backend verification does not claim a new hands-on phone UI pass.
