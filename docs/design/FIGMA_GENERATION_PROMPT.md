# PetPal Figma Generation Prompt

Use this prompt to generate the next full Figma design system and app screen set for PetPal.

```text
Design a complete mobile app UI for PetPal, a trusted local adoption and foster platform for animals.

PetPal is not a dating app and not a marketplace for selling animals. It is a safe matching and workflow app between people who want to adopt or foster animals and verified shelters, rescuers, and animal volunteers.

The app should feel elegant, modern, emotionally warm, trustworthy, and serious enough for real animal welfare work. It should not feel like a childish pet app, a generic social network, or a basic demo. It should feel like a fundable v1 product.

Create a full mobile app design for iOS/Android with the following structure.

App name:
PetPal

Tagline:
Every animal needs one.

Main product thesis:
A trusted local platform where verified shelters and rescuers can list animals, and people can safely apply to adopt or foster.

Launch scope:
Bucharest / Ilfov pilot region
Dogs and cats only
Adoption and foster only
No animal sales
No breeding
No mating
No random open chat
No exact public location

Core safety principles:
Verified shelters and rescuers
Approved listings before public visibility
Exact addresses hidden
Application before chat
Private documents
Report and block flows
Admin moderation
Clear listing status
Fresh listings only

Main navigation tabs:
1. Discover
2. Applications
3. Inbox
4. Shelter
5. Profile

Create a polished mobile app with a persistent bottom tab bar. Each tab should have a distinct screen identity, clear primary actions, and strong section separation.

DISCOVER TAB

Purpose:
Help users browse verified animals available for adoption or foster in the launch region.

The first screen should immediately communicate:
PetPal
Bucharest / Ilfov pilot
Adopt or foster verified animals
Application first, chat later
Exact location hidden

Discover screen sections:
1. Top app header
- PetPal logo or wordmark
- Region label: Bucharest / Ilfov
- Status badge: Demo or Live
- Short trust signal

2. Hero area
- Large animal-focused visual area
- Main headline:
  “Find the right next home, not just the nearest one.”
- Supporting text:
  “Animal-first profiles, safer applications, private exact locations, and shelter-led handoff.”
- Small trust labels:
  “Verified rescuers”
  “Application first”
  “Private location”

3. Trust metrics strip
Show three compact metrics:
- 3 approved profiles
- 1 urgent foster need
- 0 animal sales

4. Local trust feed status
- Title: Local trust feed
- Message:
  “Live local feed is unavailable, so polished demo listings are shown.”
- Action: Refresh

5. Filter section
Title:
“Choose your rescue lane”
Description:
“Filters are intentionally simple for v1: adoption, foster, dogs, and cats only.”
Controls:
- All
- Adopt
- Foster
- Dogs + Cats
- Dog
- Cat

6. Animal listing section
Title:
“Verified animals ready for a serious request”
Each animal card should include:
- Large animal photo
- Animal name
- Adopt or Foster label
- Species
- Age
- Size
- Coarse location only
- Short temperament note
- Organization name
- Verification indicator
- Primary action: View profile

Sample listings:
Luna
Cat
Adopt
1 year 6 months
Small
Bucharest / Sector 3
Quiet, affectionate, prefers slow introductions.
PetPal Rescue Demo

Bruno
Dog
Foster
3 years
Medium
Ilfov / Otopeni
Friendly, people-focused, needs quiet recovery time.
PetPal Rescue Demo

Mara
Dog
Adopt
8 months
Medium
Bucharest / Sector 6
Playful, shy at first, good with gentle dogs.
West Side Rescuers

ANIMAL DETAIL SCREEN

Purpose:
Give enough trustworthy information before a person applies.

Sections:
1. Back action
2. Large animal profile header
- Photo
- Animal name
- Adopt or Foster label
- Species, age, size
- Verified rescue label

3. Animal summary
Example:
“Luna is a gentle young cat who does best with patient people and a predictable home rhythm.”

4. Information sections
- Coarse location
- Temperament
- Public health summary
- Organization
- Listing freshness/status

5. Safety rules panel
Title:
“Trust rules for this handoff”
Items:
- Application first
- Exact address hidden
- Chat only after acceptance
- Reports and blocks available

6. Actions
- Apply to adopt / Apply to foster
- Save

APPLICATION FLOW

Purpose:
A calm, structured application flow before any private chat opens.

Use a multi-step wizard with clear progress.

Steps:
1. Home
2. Experience
3. Motivation
4. Review

Application screen title:
“Application studio”

Description:
“A calmer form flow gives rescuers useful context before any private conversation opens.”

Step 1: Home
Title:
“A realistic home fit for Luna”
Fields:
- Housing type
- Other pets
- Children in home
- Landlord approval if relevant

Step 2: Experience
Title:
“Care experience”
Fields:
- Previous pets
- Foster experience
- Training or medical care experience
- Daily routine availability

Step 3: Motivation
Title:
“Why this match works”
Fields:
- Why this animal?
- Why now?
- What support do you need?

Step 4: Review
Title:
“Final check before the shelter sees it”
Show summarized answers.
Include status:
“Ready to submit”
Primary action:
Submit application

After demo submit, show:
“Demo application validated locally. Configure live backend to submit for real.”

APPLICATIONS TAB

Purpose:
Let adopters and fosters track submitted requests.

Screen title:
“My requests”

Description:
“Follow each adoption or foster request without chasing messages across apps.”

Empty state:
Title:
“No submitted applications”
Body:
“Start from a verified listing, complete the guided form, and the request will appear here.”

Application card should include:
- Animal name
- Adopt or Foster
- Status
- Organization
- Submitted date
- Review note if available
- Open chat button only if accepted

Statuses:
Submitted
In review
Accepted
Rejected
Withdrawn

INBOX TAB

Purpose:
Protected messaging that only opens after an application has been accepted.

Screen title:
“Protected inbox”

Description:
“Threads unlock only when an application has been accepted, so shelters avoid random DM noise.”

Empty state:
Title:
“No open conversations”
Body:
“Accepted applications will unlock a protected chat thread here.”

Conversation thread should include:
- Animal name
- Organization
- Application status
- Last message
- Message composer
- Send
- Report
- Block

Safety copy:
“Chat opens only after a shelter accepts an application.”

SHELTER TAB

Purpose:
A lightweight dashboard for shelters and rescuers.

Screen title:
“Shelter command”

Description:
“A focused control room for live listings, serious applicants, and safe handoffs.”

Sections:
1. Metrics
- Active listings
- Pending applications
- Foster needs

2. Latest applicant
- Applicant status
- Animal name
- Organization
- Status controls:
  In review
  Accepted
  Rejected
- Action:
  Accept latest and open chat

3. Listing health
Show animal listings with:
- Animal name
- Adopt or Foster
- City
- Status: Active

4. Future shelter actions
- Create animal listing
- Submit listing for review
- Pause listing
- Archive listing
- Mark adopted
- Mark fostered

PROFILE TAB

Purpose:
Account, trust, role, privacy, and safety defaults.

Screen title:
“Trust profile”

Description:
“Identity, role, saved animals, and privacy controls stay separate from discovery content.”

Sections:
1. User identity
- PetPal Demo User
- Adopter / foster applicant

2. Connection status
- Demo fallback or Live local feed

3. Current interest
- Luna / Adopt

4. Privacy summary
Text:
“Exact addresses, documents, reports, and application answers are private.”

5. Safety defaults
Show settings as always-on items:
- Gated chat
- Exact location hidden
- Reports reviewed by admin
- Blocked users cannot message

ADMIN / MODERATION CONCEPT

Include a few optional frames showing the internal moderation concept, but keep it separate from the public app.

Admin screens:
1. Organization verification queue
2. Listing approval queue
3. Report review queue
4. User suspension detail
5. Audit log

Admin actions:
- Approve organization
- Reject organization
- Approve listing
- Reject listing
- Pause listing
- Suspend user
- Resolve report

OVERALL UX REQUIREMENTS

The app should feel:
- Trustworthy
- Animal-first
- Local
- Safe
- Structured
- Emotional but not childish
- Operationally useful for shelters
- Easy for adopters to understand
- Clear enough for investors to understand the v1 product

Avoid:
- Swipe-first dating app patterns
- Marketplace sale language
- Breeder or mating features
- Overly cute cartoon style
- Generic white-card dashboard look
- Random social feed feeling
- Open chat before application
- Exact address exposure
- Overcrowded screens

The design should include:
- Complete mobile app frame set
- Discover flow
- Animal detail flow
- Application wizard
- Applications tracking
- Protected inbox
- Shelter dashboard
- Profile and safety settings
- Empty states
- Demo fallback states
- Loading states
- Error states
- Clear button hierarchy
- Strong visual section separation
- Animal imagery as a major part of the experience
- Professional product copy throughout

Generate polished production-ready mobile UI screens, not wireframes.
```
