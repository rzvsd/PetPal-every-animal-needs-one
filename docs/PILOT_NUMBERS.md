# Pilot numbers

Eight counts that say whether the Foster pilot is working. Each has an
all-time total and the last 7 days.

| # | Number | What it counts |
|---|--------|----------------|
| 1 | Accounts | Every profile created. |
| 2 | Foster homes listed | Published homes that moderators have not hidden and whose owner is not suspended. |
| 3 | Animals posted | Foster cases posted. |
| 4 | Requests sent | Applications and invitations between homes and animals. |
| 5 | Requests accepted | Requests that became a reservation. |
| 6 | Animals received in care | Placements where the home confirmed the animal arrived. |
| 7 | Animals adopted after care | Care that ended with the foster or someone else adopting. |
| 8 | Danger reports answered within 2 hours | "Animal in danger" reports with a moderator decision within 2 hours, shown as answered / all. |

## Where to see them

- **In the app:** Profile → PetPal moderation → Pilot numbers (moderators only).
- **In Supabase:** SQL editor → `select * from public.pilot_numbers();`

A signed-in member who is not a moderator gets "Platform moderator required".
The function is defined in `petpal-supabase/supabase/migrations/0047_pilot_numbers.sql`.
