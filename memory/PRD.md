# PetPal - Mobile Web UI/UX Prototype

## Original Problem Statement
Build a mobile-responsive web prototype for PetPal - a Romania-first animal matching and foster app with 4 tabs: Matches (Tinder-like swipe), Foster, Messages, Profile. Focus on UI/UX design and interaction flow. No backend, no auth, no payments. Mock data only.

## Architecture
- **Frontend**: React 18 + Tailwind CSS + Framer Motion + Lucide React
- **Backend**: Minimal FastAPI (health endpoint only)
- **Data**: All mock data in frontend (`src/data/mockData.js`)
- **Styling**: Warm organic palette (cream/paper, deep green, sage, clay, sky, rose)
- **Layout**: Phone frame container (max-w-430px) centered on desktop, full-width on mobile

## User Personas
1. **Animal Owner (Alex)** - Has pets, wants to find play/social/mating matches
2. **Foster Volunteer** - Wants to temporarily home animals in need
3. **Rescuer/Shelter** - Manages foster cases, reviews applications

## Core Requirements (Static)
- 4 bottom tabs only: Matches, Foster, Messages, Profile
- No exact location exposure (city/area only)
- No direct chat from public cards
- Messages open only after mutual match or accepted foster application
- Verified Mate must be gated behind verification checklist
- Foster management tools are role-gated
- EN/RO language toggle

## What's Been Implemented (Jan 29, 2026)

### TAB 1: Matches (Potriviri)
- Animal selector dropdown (switch between Max/Bella)
- Match mode selector (Play/Social/Verified Mate)
- Photo-first swipeable card deck (Framer Motion drag gestures)
- Card actions: Not now, Details, Like, Save
- Filter chips: Dogs, Cats, Verified, Filters
- Filter sheet (bottom modal)
- Match detail screen with compatibility reasons
- Match success modal with animation
- Verified Mate locked state with verification checklist
- Mutual match creates conversation in Messages

### TAB 2: Foster
- Section tabs: Find / My Requests / Manage
- Foster case cards with photo, urgency, duration, coverage
- Foster case detail screen
- Multi-step foster application flow (5 steps)
- Application tracking with status badges
- Rescuer access request flow
- Demo preview mode with banner
- Manage dashboard (role-gated) with stats

### TAB 3: Messages (Mesaje)
- Context-aware conversation inbox
- Filter tabs: All / Matches / Foster
- Grouped conversation list
- Conversation thread with context header
- Message input and send functionality
- Safety menu (View context, Report, Block)
- Privacy note in every thread
- Unread message badge on tab

### TAB 4: Profile (Profil)
- User summary card with roles & verification status
- My Animals section with animal cards
- Verification checklist overview
- Preferences sections (Match, Foster, Notifications)
- Privacy & Safety section with location privacy note
- App settings with language toggle (EN/RO)
- Help & Legal section
- Delete account option

### Shared Components
- Badge, Chip, Button variants (Primary, Secondary, Clay)
- Screen header with back navigation
- Empty states, Locked states
- Privacy notes, Verification badges
- Filter sheet modal, Safety menu
- Animal selector dropdown
- Compatibility score ring
- Demo preview banner
- Phone frame container with desktop notch

## Testing Status
- **All 24 features tested: 100% PASS** (iteration_1.json)
- Tab navigation, card interactions, match flow, foster flow, messages, profile all verified

## Prioritized Backlog

### P0 (Critical for Production)
- Backend API integration (Supabase)
- Real authentication
- Real image upload for animal photos

### P1 (Important)
- Swipe gesture sensitivity tuning
- Foster application form validation
- Push notifications
- Real-time message delivery

### P2 (Nice to have)
- Animal profile creation/editing flow
- Match/Foster preference settings that persist
- Accessibility improvements (screen reader support)
- Offline mode
- Photo carousel on match cards

## Next Tasks
1. Gather feedback from user on visual design and interaction flows
2. Connect to Supabase backend when ready
3. Add real authentication flow
4. Implement photo upload for animal profiles
5. Add actual swipe gesture calibration for mobile devices
