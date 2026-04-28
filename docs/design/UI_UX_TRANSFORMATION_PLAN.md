# PetPal UI/UX Transformation Plan

## Goal

Move PetPal from a smoke-test app into a polished, trustworthy adoption/foster product surface.

Target quality: a 9/10 v1 mobile experience that feels calm, local, safe, and emotionally warm without becoming childish, cluttered, or swipe-gimmicky.

## Product Personality

PetPal should feel like:

- A trusted shelter workflow tool, not a casual classified feed.
- A warm local guide, not a corporate CRM.
- A carefully moderated adoption/foster space, not a generic dating clone.
- A beautiful animal-first product, but still clear enough for repeat shelter use.

The app should use visual emotion to create care, then use structure to create trust.

## Current State

The current mobile app proves backend behavior well, but the UI is still a milestone smoke harness:

- One long scroll contains discovery, detail, application, inbox, and chat at once.
- Actions are technically present but not arranged as natural user journeys.
- There is no bottom tab structure or persistent app shell.
- Listings are plain data cards with no strong animal-first visual treatment.
- The safety story exists in text, but not as interaction design.
- Organization and adopter roles are mixed on one surface.
- Styling is beige/green and functional, but not yet distinctive or premium.

This is acceptable for M6 proof. It is not acceptable for a fundable v1 demo.

## UX Principles

1. Trust before motion

Do not make this a swipe-first app. Adoption/foster needs comprehension, screening, and safe pacing.

2. Animal first, workflow second

Each animal should feel like a real profile, not a database row. But the next responsible action must always be obvious.

3. Separate adopter and shelter mental models

Adopters browse, save, apply, and chat after approval. Shelters manage listings, review applications, and moderate communication.

4. Exact location stays private by design

The UI should show locality without implying public addresses.

5. Progressive disclosure

Show enough to decide interest, then reveal deeper temperament, health, and application content when the user intentionally opens detail.

6. Calm density

Operational surfaces can be information-rich, but not noisy. Discovery can be more visual and emotional.

## App Information Architecture

Public v1 should use five clear tabs.

### 1. Discover

Primary user: adopter/foster applicant.

Purpose:

- Browse approved adoption/foster listings.
- Filter by mode, species, city/area, age, size, and urgency.
- Open animal detail.

Main actions:

- Open animal profile.
- Save animal.
- Start application.
- Share public profile.

Visual treatment:

- Large animal card with photo or illustrated placeholder.
- Mode badge: Adopt or Foster.
- Urgency/status chip only when meaningful.
- Coarse area, not exact location.
- Trust badge for verified organization.

### 2. Applications

Primary user: adopter/foster applicant.

Purpose:

- Track submitted applications.
- See status and next steps.
- Continue incomplete drafts.

Main states:

- Draft
- Submitted
- In review
- Accepted
- Rejected
- Withdrawn

Main actions:

- Continue draft.
- View submitted answers.
- Open chat when accepted.
- Withdraw application.

### 3. Inbox

Primary user: both adopter and organization members.

Purpose:

- Show conversations opened by accepted applications only.
- Keep report/block actions available but not visually loud.

Main actions:

- Open conversation.
- Send message.
- Report message/user.
- Block participant.

UX rule:

- No conversation can appear without an accepted application.

### 4. Shelter

Primary user: shelter/rescuer.

Purpose:

- Manage own listings.
- Review applications.
- See pending operational work.

Main actions:

- Create animal/listing.
- Submit listing for review.
- Review applications.
- Accept/reject application.
- Pause/archive listing.

Initial mobile scope:

- Lightweight dashboard and application review.
- Full admin moderation remains in `petpal-admin`.

### 5. Profile

Primary user: everyone.

Purpose:

- Identity, role, organization membership, preferences, privacy, saved animals.

Main actions:

- Edit profile.
- Switch role context.
- View verification status.
- Manage saved animals.
- Open safety/privacy settings.

Do not mix app settings into content tabs.

## Primary Journeys

### Adopter/Foster Journey

1. Lands on Discover.
2. Filters to Adopt or Foster.
3. Opens animal detail.
4. Reviews temperament, health summary, location, organization trust signals.
5. Starts application.
6. Completes guided sections.
7. Submits application.
8. Tracks status in Applications.
9. Chat opens only after acceptance.
10. Reports or blocks if needed.

### Shelter Journey

1. Opens Shelter tab.
2. Sees pending applications and listing health.
3. Opens an application with structured applicant answers.
4. Accepts, rejects, or moves to review.
5. Accepted application opens chat.
6. Listing state can be paused, archived, or refreshed.

## Visual Direction

### Brand Feel

Smart, modern, gentle, and local. Avoid cartoon pet-store energy. Avoid sterile SaaS coldness.

### Palette

Do not keep the app as one-note beige/green.

Recommended palette:

- Ink: `#17231F`
- Paper: `#FAF7F0`
- Surface: `#FFFFFF`
- Sage: `#3F7A68`
- Moss: `#6D8C54`
- Clay: `#B86642`
- Sky: `#A7C7D9`
- Butter: `#F1C85B`
- Rose warning: `#C76D6D`
- Border: `#E3DACB`

Usage:

- Sage for primary trust/action.
- Clay for warmth and foster/urgent accents.
- Sky for calm informational states.
- Butter sparingly for highlight/attention.
- Rose only for destructive or safety states.

### Shape And Spacing

- Cards: 8px radius max.
- Buttons: 8px radius max.
- Strong spacing scale: 4, 8, 12, 16, 20, 24, 32.
- Avoid cards inside cards.
- Use full-screen sections and sheets, not nested boxes.

### Imagery

Use real animal photos when available. For missing photos, generate a tasteful abstract animal portrait placeholder set:

- Dog placeholder
- Cat placeholder
- Foster/medical hold placeholder
- Shelter profile placeholder
- Empty-state illustration for no listings

Imagegen should be used for these project-bound bitmap assets after the design skeleton is ready.

Style:

- Soft editorial illustration.
- Natural paper texture.
- No text inside images.
- No fake UI in images.
- No cartoon mascot as primary brand.

### Motion

Use subtle interaction only:

- Tab transition: instant or very short fade.
- Card press: slight scale/opacity.
- Application progress: calm step indicator.
- Chat message send: small optimistic state.

Sora is not needed for in-app UI. Use Sora later for a launch teaser or investor demo clip.

## Screen Designs

### Discover Screen

Header:

- App name.
- Current region: Bucharest / Ilfov.
- Verified listings count.

Controls:

- Segmented mode control: All, Adopt, Foster.
- Species chips: Dog, Cat.
- Filter button opens a sheet.

Content:

- Featured urgent foster row.
- Main listing cards.

Card content:

- Photo/placeholder.
- Animal name.
- Mode badge.
- Species, age, size.
- City/coarse area.
- Organization badge.
- One temperament line.
- Save/share icons.

Primary action:

- Open detail.

### Animal Detail Screen

Hero:

- Large image.
- Name and key metadata.
- Adopt/Foster badge.
- Verified organization badge.

Sections:

- About
- Temperament
- Health summary
- Home fit
- Organization
- Privacy note

Sticky action:

- Apply to adopt/foster.

Secondary actions:

- Save.
- Share.
- Report listing.

### Application Flow

Use a guided multi-step form:

1. Home
2. Experience
3. Household
4. Motivation
5. Review

Each step:

- Has one clear title.
- Shows required fields.
- Saves draft locally in state for now.
- Ends with Next/Back.

Acceptance rule:

- Submit disabled until required fields pass validation.

### Applications Screen

Layout:

- Status tabs: Active, Accepted, Closed.
- Application cards grouped by status.

Card:

- Animal name.
- Listing mode.
- Organization.
- Status.
- Last update.
- Next action.

### Inbox Screen

Layout:

- Conversation list.
- Conversation detail.

Mobile v1 can show one mode at a time:

- List first.
- Tap opens thread.

Safety:

- Report/block available behind a menu or small safety row.
- Do not make destructive actions look like primary workflow buttons.

### Shelter Screen

Top summary:

- Active listings.
- Pending applications.
- Listings expiring soon.

Sections:

- Pending applications.
- Active listings.
- Quick create listing.

Application review:

- Applicant profile summary.
- Answers grouped by category.
- Accept / reject / move to review.
- Internal note placeholder.

## Technical Architecture

Move from one giant `App.tsx` to a small app shell plus focused modules.

Target mobile structure:

```text
petpal-mobile/
  src/
    app/
      PetPalApp.tsx
      navigation.ts
    design/
      tokens.ts
      theme.ts
    components/
      AppShell.tsx
      BottomTabs.tsx
      Button.tsx
      Chip.tsx
      EmptyState.tsx
      ListingCard.tsx
      SectionHeader.tsx
      StatusBadge.tsx
      TextField.tsx
    screens/
      DiscoverScreen.tsx
      AnimalDetailScreen.tsx
      ApplicationFlowScreen.tsx
      ApplicationsScreen.tsx
      InboxScreen.tsx
      ShelterScreen.tsx
      ProfileScreen.tsx
    hooks/
      useDiscovery.ts
      useApplications.ts
      useConversations.ts
    assets/
      placeholders/
```

Keep `App.tsx` as a tiny entry surface:

```text
App -> PetPalApp -> AppShell -> active screen
```

Do not introduce a heavy navigation dependency in the first UI pass unless needed. A typed local tab state is enough for the v1 demo and keeps risk low.

## Implementation Milestones

### UX-M1: App Shell And Design System

Output:

- Design tokens.
- Shared button, chip, badge, card, input components.
- Bottom tab shell.
- `App.tsx` reduced to entry only.
- Existing M6 data flow preserved.

Acceptance:

- App launches on phone.
- Five tabs visible.
- Tabs switch without losing app state.
- TypeScript passes.
- Existing Supabase discovery still loads.

### UX-M2: Discover And Animal Detail

Output:

- Polished Discover screen.
- Animal detail screen.
- Better filters.
- Animal-first listing cards.
- Placeholder image system wired.

Acceptance:

- User can browse Bruno and Luna.
- User can open detail.
- Exact location remains hidden.
- Empty/loading/error states are designed.

### UX-M3: Guided Application Flow

Output:

- Multi-step application flow.
- Draft state.
- Review step.
- Submit to Supabase.

Acceptance:

- Required fields gate submission.
- Submitted application appears in Applications.
- Phone smoke can submit a foster application.

### UX-M4: Applications And Gated Inbox

Output:

- Applications tab.
- Inbox tab.
- Chat thread screen.
- Safer report/block placement.

Acceptance:

- Accepted application opens conversation.
- Message sends.
- Report creates moderation report.
- Block closes messaging.
- Blocked follow-up send fails.

### UX-M5: Shelter Dashboard

Output:

- Shelter tab.
- Pending application review.
- Listing status summary.
- Accept/reject flow.

Acceptance:

- Shelter can review latest application.
- Accepting opens chat.
- UI clearly separates shelter actions from adopter actions.

### UX-M6: Polish And Asset Pass

Output:

- Project-bound generated placeholder images.
- Splash/icon review.
- Microcopy pass.
- Accessibility labels.
- Phone screenshots.

Acceptance:

- No overlapping text on phone.
- No warning/error RedBox.
- Screens look deliberate across small and tall devices.
- Evidence folder updated.

## Quality Checks

Every UX milestone should run:

```bash
pnpm exec tsc --noEmit
```

When backend behavior is touched:

```bash
pnpm run db:test
```

Phone smoke after UX-M2 and later:

- Launch app.
- Confirm Discover loads local Supabase.
- Switch tabs.
- Open detail.
- Submit application.
- Accept latest application.
- Open chat.
- Send/report/block.

Visual QA:

- Capture phone screenshot for each main tab.
- Check no text overlaps.
- Check button labels fit.
- Check cards do not shift size unexpectedly.
- Check all empty/loading/error states.

## Asset Plan

Generate later with imagegen:

- `dog-placeholder.png`
- `cat-placeholder.png`
- `foster-placeholder.png`
- `empty-discover.png`
- `shelter-placeholder.png`

Possible Sora launch assets later:

- 8 second vertical teaser: adopter browsing verified local listings.
- 12 second investor demo mood clip: safe adoption workflow from listing to accepted chat.

Possible Canva outputs later:

- Investor pitch deck from product milestones.
- Social launch kit in Instagram/Facebook/LinkedIn formats.

These are not needed before the core app UI is structurally correct.

## Definition Of Done For 9/10 v1 Demo

- Product opens into Discover, not a smoke-test scroll.
- Five tabs are clear and purposeful.
- Adopter and shelter actions are separated.
- Animal profiles feel emotionally rich and trustworthy.
- Application flow feels guided and safe.
- Chat clearly opens only after acceptance.
- Safety actions exist but do not dominate the happy path.
- Visual style is distinctive, calm, and polished.
- Real Supabase data still drives the demo.
- Phone E2E proof is updated after the redesign.
