PetPal Codex Bluebook 🐾
UI/UX Rebuild Plan, Strict Implementation Manual
Use this as the source of truth for Codex.
The goal is to stop Codex from improvising and force it to build PetPal as a clean, structured mobile app with four clear tabs:
TAB 1: MatchesTAB 2: FosterTAB 3: MessagesTAB 4: Profile
OpenAI’s Codex use cases include frontend work from design inputs, Figma selections, screenshots, and visual checks, so this bluebook should be treated as Codex’s design-and-build contract, not just a casual prompt. 

0. Main Product Direction
PetPal is no longer only an adoption/foster app.
PetPal is now:
PetPal
Animal matching and foster, in one safe app.
The app has two main engines:
1. Animal Matches
Users create profiles for their own animals, then swipe through compatible dogs or cats.
The matching flow can support:


play


socialization


verified mating / breeding interest


But mating must be gated, verified, and safe.
2. Foster
Users can browse animals that need temporary foster homes.
Rescuers or shelters can manage foster cases, review applications, and open conversations after approval.

1. Non-Negotiable Rules for Codex
Codex must obey these rules.
Do not create a messy one-screen app
Do not put everything into one long scroll.
The app must use four clear tabs:
MatchesFosterMessagesProfile
Do not create adoption-first UI
The new primary entry point is animal matching, not adoption.
Foster is still important, but it is Tab 2.
Do not create public chat before permission
Messages open only after:


mutual match in Matches


accepted foster application in Foster


Do not create free/open breeding
Mating or breeding must be called something like:
Verified Mate
or:
Verified Pairing
It must require verification and health/eligibility fields.
Do not expose exact location
Show only:
City / coarse area
Never exact address.
Do not remove safety, reports, or blocks
Every message flow must support:


report


block


view context


Do not add Mate, Breeding, Payments, Services, Community as random extra tabs
The bottom tabs stay:
MatchesFosterMessagesProfile

2. Recommended UI Language
The bluebook is in English for Codex.
But the app is Romania-first.
So the UI should support Romanian labels.
For now, implement labels in Romanian or make a small copy file that can be changed later.
Recommended tab labels:
PotriviriFosterMesajeProfil
If Codex needs English internal names, use:
type MainTab = 'matches' | 'foster' | 'messages' | 'profile';
But rendered UI labels should be:
PotriviriFosterMesajeProfil

3. Final App Navigation
The bottom navigation has exactly four tabs.
┌─────────────────────────────┐│ Current screen content       ││                             ││                             │├─────────────────────────────┤│ Potriviri | Foster | Mesaje | Profil │└─────────────────────────────┘
Tab 1
Potriviri
Purpose:
Animal Tinder-like matching.
Tab 2
Foster
Purpose:
Find foster animals, submit applications, or manage foster cases.
Tab 3
Mesaje
Purpose:
All conversations from matches and foster approvals.
Tab 4
Profil
Purpose:
User profile, animals, verification, preferences, settings.

4. App Entry Flow
When the user enters the app for the first time, do not show a long marketing screen.
Show a short choice screen.
PetPalFiecare animal merită omul lui.What do you want to do?[ I have an animal and want matches ][ I want to offer foster ][ I am a rescuer / shelter ]
Romanian UI version:
PetPalFiecare animal merită omul lui.Ce vrei să faci?[ Am un animal și caut potriviri ][ Vreau să ofer foster ][ Sunt salvator / adăpost ]
If user chooses “I have an animal”
Send to animal profile creation.
If user chooses “I want to offer foster”
Send to foster preferences setup.
If user chooses “I am rescuer / shelter”
Send to organization/rescuer verification flow.

5. Tab 1: Matches
Internal name:
matches
Rendered label:
Potriviri
This is the main product tab.
This tab should feel like Tinder for animal profiles, but safer, warmer, and more structured.

5.1 What the user sees first
If user has no animal profile:
Create your animal profileTo find good matches, PetPal needs your animal’s species, breed, age, sex, photos, temperament, and matching goal.[ Create animal profile ]
Romanian:
Creează profilul animalului tăuPentru potriviri bune, PetPal are nevoie de specie, rasă, vârstă, sex, poze, temperament și scopul potrivirii.[ Creează profil animal ]

5.2 If user has animal profile
Show:
PetPalPotriviri pentru animalul tăuAnimalul meu: Max ▼What are you looking for?[ Play ] [ Social ] [ Verified Mate ][ Dogs ] [ Cats ] [ Breed ] [ Filters ]Swipe card
Romanian:
PetPalPotriviri pentru animalul tăuAnimalul meu: Max ▼Ce cauți?[ Joacă ] [ Socializare ] [ Montă verificată ][ Câini ] [ Pisici ] [ Rasă ] [ Filtre ]

5.3 Matching modes
Use these internal modes:
type MatchMode = 'PLAY' | 'SOCIAL' | 'VERIFIED_MATE';
Rendered Romanian labels:
PLAY = JoacăSOCIAL = SocializareVERIFIED_MATE = Montă verificată
Do not render plain “Breeding” as the main UI language.
Use “Verified Mate” internally and “Montă verificată” in Romanian.

5.4 Animal selector
At the top of Matches, user can choose which of their animals is searching.
Animalul meu: Max ▼
If multiple animals:
MaxBellaMilo+ Add animal
Every match must be calculated relative to the selected animal.

5.5 Match card structure
Each card must show:
[ Large animal photo ]LunaGolden Retriever · Female · 2 yearsFor: Verified MateBucharest / Sector 3✓ Owner verified✓ Vaccines confirmed✓ Profile completeCompatibility with Max: 84%Calm, social, used to other dogs.[ X ] [ Details ] [ ♥ ]
Romanian:
LunaGolden Retriever · Femelă · 2 aniPentru: Montă verificatăBucurești / Sector 3✓ Owner verificat✓ Vaccinuri confirmate✓ Profil completCompatibilitate cu Max: 84%Calmă, sociabilă, obișnuită cu alți câini.[ X ] [ Detalii ] [ ♥ ]

5.6 Card actions
Swipe left
Action:
PASS
Rendered:
Nu acum
Swipe right
Action:
LIKE
Rendered:
Îmi place
Tap details
Opens animal detail screen.
Save
Optional.
Rendered:
Salvează

5.7 Match detail screen
When user taps a card, show:
LunaGolden Retriever · Female · 2 yearsGoal:Verified MateCompatibility with Max:84%Why this match makes sense:- Same species- Compatible age- Compatible size- Nearby area- Owner verified- Health fields availableTemperament:Calm, social, comfortable around other dogs.Health:Vaccines confirmed.Medical documents uploaded.Location:Bucharest / Sector 3.Exact location stays private.[ Like ] [ Not now ] [ Report ]
Romanian:
LunaGolden Retriever · Femelă · 2 aniScop:Montă verificatăCompatibilitate cu Max:84%De ce se potrivește:- aceeași specie- vârstă compatibilă- talie compatibilă- zonă apropiată- owner verificat- câmpuri medicale disponibileTemperament:Calmă, sociabilă, obișnuită cu alți câini.Sănătate:Vaccinuri confirmate.Documente medicale încărcate.Locație:București / Sector 3.Locația exactă rămâne privată.[ Îmi place ] [ Nu acum ] [ Raportează ]

5.8 Filters in Matches
Basic filters:
SpeciesBreedSexAge rangeSizeCity / areaDistanceOnly verified owners
Advanced filters:
Goal: Play / Social / Verified MateVaccines confirmedHealth documents uploadedProfile completeEnergy levelTemperamentBreed exact matchMixed breed accepted
For verified mating:
Health documents requiredOwner verification requiredAnimal profile complete requiredAge eligibility requiredSex requiredSterilization status requiredAdmin approval may be required

5.9 Match result
When both owners like each other:
New match!Max and Luna matched.[ Open messages ]
Romanian:
Potrivire nouă!Max și Luna s-au potrivit.[ Deschide mesajele ]
This creates a conversation in Tab 3.

6. Tab 2: Foster
Internal name:
foster
Rendered label:
Foster
Purpose:


Find foster cases


Apply to foster


Track applications


Manage foster cases if user is rescuer/shelter



6.1 Foster top sections
At the top of Foster tab, show segmented sections:
[ Find ] [ Applications ] [ Manage ]
Romanian:
[ Găsește ] [ Cereri ] [ Gestionează ]
Important:
Manage appears only if user has rescuer/shelter permissions.
If not authorized, hide it or show locked state.

6.2 Foster / Find section
This section shows animals needing foster.
Layout:
FosterAnimals needing temporary homes[ Dogs ] [ Cats ] [ Urgent ] [ Duration ] [ Size ] [ Filters ]BrunoDog · 2 years · Urgent fosterNeeds foster for 2-4 weeks.Food and vet care covered.Bucharest / Sector 4✓ Verified rescuer[ View case ] [ Save ]
Romanian:
FosterAnimale care au nevoie de casă temporară[ Câini ] [ Pisici ] [ Urgent ] [ Durată ] [ Talie ] [ Filtre ]BrunoCâine · 2 ani · Foster urgentAre nevoie de foster 2-4 săptămâni.Mâncarea și veterinarul sunt acoperite.București / Sector 4✓ Salvator verificat[ Vezi cazul ] [ Salvează ]

6.3 Foster filters
Implement these filters:
SpeciesSizeAgeUrgencyFoster durationGood with childrenGood with other animalsMedical needsTransport availableFood coveredVet coveredCity / areaOnly verified rescuers
Foster duration values:
Few days1-2 weeks1 monthUntil adoptionUnknown
Romanian:
Câteva zile1-2 săptămâni1 lunăPână la adopțieNu se știe încă

6.4 Foster case detail screen
When user opens a case:
BrunoDog · 2 years · Medium sizeFoster need:2-4 weeksUrgency:This weekWhat is covered:✓ Food✓ Vet care✓ Transport supportHome fit:Calm home, no small children preferred.Health:Vaccines started.Needs quiet recovery.Location:Bucharest / Sector 4.Exact location stays private.Rescuer:Hope RescueVerified rescuer[ Apply to foster ] [ Save ] [ Report ]
Romanian:
BrunoCâine · 2 ani · Talie medieAre nevoie de foster:2-4 săptămâniUrgență:Săptămâna aceastaCe este acoperit:✓ Mâncare✓ Veterinar✓ Ajutor transportPotrivire pentru casă:Casă liniștită, preferabil fără copii mici.Sănătate:Vaccinuri începute.Are nevoie de recuperare liniștită.Locație:București / Sector 4.Locația exactă rămâne privată.Salvator:Hope RescueSalvator verificat[ Aplică pentru foster ] [ Salvează ] [ Raportează ]

6.5 Foster application flow
Use a guided form.
Steps:
1. Home2. Experience3. Availability4. Household5. Review
Romanian:
1. Locuință2. Experiență3. Disponibilitate4. Casă5. Verificare
Fields:
Housing typeAvailable durationAnimal experienceOther petsChildren in homeWork scheduleCan transport animal?Can handle medical needs?MotivationAge confirmed
Submit button:
Trimite cerere foster
After submit:
Your foster application was sent.The rescuer will review it before chat opens.
Romanian:
Cererea ta de foster a fost trimisă.Salvatorul o va analiza înainte ca mesajele să se deschidă.

6.6 Foster / Applications section
Show user’s foster applications.
Card:
BrunoFoster · SubmittedHope RescueStatus:In reviewNext:Wait for rescuer response.[ View application ]
Statuses:
type FosterApplicationStatus =  | 'DRAFT'  | 'SUBMITTED'  | 'IN_REVIEW'  | 'ACCEPTED'  | 'REJECTED'  | 'WITHDRAWN'  | 'COMPLETED';
Romanian labels:
Draft = CiornăSubmitted = TrimisăIn Review = În analizăAccepted = AcceptatăRejected = RespinsăWithdrawn = RetrasăCompleted = Finalizată
If accepted:
[ Open messages ]

6.7 Foster / Manage section
Only for rescuers/shelters/foster admins.
Do not call this “admin” in the user UI.
Use:
Gestionează
Show:
Manage fosterActive cases: 12New applications: 5Urgent cases: 3[ Add foster case ][ Review applications ][ Active cases ][ Foster families ]
Romanian:
Gestionează fosterCazuri active: 12Cereri noi: 5Urgente: 3[ Adaugă caz foster ][ Vezi cereri ][ Cazuri active ][ Familii foster ]

6.8 What foster manager can do
A foster manager can:
Create foster caseEdit foster caseSet urgencySet foster durationSet what is coveredUpload photosReview applicationsAccept applicationReject applicationOpen messages after acceptancePause caseMark foster foundMark adoptedArchive case
Never expose exact address publicly.

7. Tab 3: Messages
Internal name:
messages
Rendered label:
Mesaje
Purpose:
All conversations from:


mutual animal matches


accepted foster applications



7.1 Message categories
At top:
[ All ] [ Matches ] [ Foster ]
Romanian:
[ Toate ] [ Potriviri ] [ Foster ]

7.2 Conversation card
Each conversation card must show context.
Do not show only the person name.
Example match conversation:
Max + LunaMatch · Verified MateLast message: Can we discuss health documents?
Romanian:
Max + LunaPotrivire · Montă verificatăUltimul mesaj: Putem discuta despre documente?
Example foster conversation:
BrunoFoster · Application acceptedLast message: We can coordinate transport Friday.
Romanian:
BrunoFoster · Cerere acceptatăUltimul mesaj: Putem coordona transportul vineri.

7.3 Message rules
Conversations can exist only if:
For Matches
Both owners liked each other.
For Foster
Foster application was accepted.
Never allow direct messages from public profile cards.

7.4 Conversation detail screen
Show a context header:
Max + LunaMatch · Verified MateBucharest / Sector 3Exact location private
or:
BrunoFoster · Application acceptedHope RescueExact location private
Then messages.
Bottom actions:
Type message...[ Send ]
Safety menu:
View contextReportBlock

8. Tab 4: Profile
Internal name:
profile
Rendered label:
Profil
This tab contains account, animals, verification, preferences, and settings.
Do not create a bottom tab called “Settings”.
Settings live inside Profile.

8.1 Profile sections
Show:
ProfileMy accountMy animalsVerificationMatch preferencesFoster preferencesNotificationsPrivacyBlocked usersLanguageHelpTerms and safetyDelete account
Romanian:
ProfilContul meuAnimalele meleVerificăriPreferințe potriviriPreferințe fosterNotificăriConfidențialitateUtilizatori blocațiLimbăAjutorTermeni și siguranțăȘterge cont

8.2 My animals section
This is central.
Card:
MaxLabrador · Male · 3 yearsProfile complete: 82%Active goals: Play, Verified Mate[ Edit ] [ Match settings ]
Romanian:
MaxLabrador · Mascul · 3 aniProfil complet: 82%Scopuri active: Joacă, Montă verificată[ Editează ] [ Setări potriviri ]

8.3 Animal profile fields
Fields:
NameSpecies: Dog / CatBreedMixed breed?AgeSexSizeWeightSterilized?Vaccines statusHealth documentsTemperamentEnergy levelGood with dogsGood with catsGood with childrenPhotosCityCoarse areaMatching goals
Matching goals:
PlaySocialVerified Mate

8.4 Verification section
Show:
VerificationOwner verification: Not verified / Pending / VerifiedAnimal profile: Incomplete / CompleteHealth documents: Missing / Uploaded / ApprovedVerified Mate eligibility: Locked / Pending / Approved
For Verified Mate, require:
Owner verifiedAnimal profile completeSex setAge eligibility passedSterilization status setVaccination status setHealth documents uploadedAdmin approval if required

9. Data Model Required by New UI
Codex must not hack this only in frontend state.
The new UI requires clear data types.

9.1 Core types
type Species = 'DOG' | 'CAT';type MatchMode = 'PLAY' | 'SOCIAL' | 'VERIFIED_MATE';type VerificationStatus =  | 'UNVERIFIED'  | 'PENDING'  | 'VERIFIED'  | 'REJECTED';type MatchAction = 'LIKE' | 'PASS' | 'SAVE';type MatchStatus =  | 'PENDING'  | 'MUTUAL'  | 'BLOCKED'  | 'ARCHIVED';type FosterCaseStatus =  | 'DRAFT'  | 'PENDING_REVIEW'  | 'ACTIVE'  | 'PAUSED'  | 'FOSTER_FOUND'  | 'ADOPTED'  | 'ARCHIVED';

9.2 Animal profile
type AnimalProfile = {  id: string;  ownerId: string;  name: string;  species: Species;  breed: string | null;  isMixedBreed: boolean;  ageMonths: number | null;  sex: 'MALE' | 'FEMALE' | 'UNKNOWN';  sizeLabel: 'SMALL' | 'MEDIUM' | 'LARGE' | 'UNKNOWN';  weightKg: number | null;  sterilizedStatus: 'YES' | 'NO' | 'UNKNOWN';  vaccineStatus: 'UNKNOWN' | 'PARTIAL' | 'UP_TO_DATE';  temperamentTags: string[];  energyLevel: 'LOW' | 'MEDIUM' | 'HIGH' | 'UNKNOWN';  goodWithDogs: boolean | null;  goodWithCats: boolean | null;  goodWithChildren: boolean | null;  city: string;  coarseArea: string | null;  photoUrls: string[];  activeMatchModes: MatchMode[];  profileCompleteness: number;  verificationStatus: VerificationStatus;};

9.3 Match candidate
type MatchCandidate = {  animal: AnimalProfile;  mode: MatchMode;  compatibilityScore: number;  compatibilityReasons: string[];  ownerVerificationStatus: VerificationStatus;  healthDocumentStatus: VerificationStatus;  distanceLabel: string;  exactLocationHidden: true;};

9.4 Match interaction
type MatchInteraction = {  id: string;  fromAnimalId: string;  toAnimalId: string;  mode: MatchMode;  action: 'LIKE' | 'PASS' | 'SAVE';  createdAt: string;};

9.5 Mutual match
type AnimalMatch = {  id: string;  animalAId: string;  animalBId: string;  ownerAId: string;  ownerBId: string;  mode: MatchMode;  status: MatchStatus;  createdAt: string;};

9.6 Foster case
type FosterCase = {  id: string;  animalId: string;  organizationId: string | null;  rescuerId: string;  title: string;  description: string;  status: FosterCaseStatus;  urgency: 'LOW' | 'MEDIUM' | 'HIGH';  duration: 'FEW_DAYS' | 'ONE_TWO_WEEKS' | 'ONE_MONTH' | 'UNTIL_ADOPTION' | 'UNKNOWN';  foodCovered: boolean;  vetCovered: boolean;  transportAvailable: boolean;  medicalNeeds: string | null;  city: string;  coarseArea: string | null;  exactLocationPrivate: string | null;  createdAt: string;};

9.7 Foster application
type FosterApplication = {  id: string;  fosterCaseId: string;  applicantId: string;  status:    | 'DRAFT'    | 'SUBMITTED'    | 'IN_REVIEW'    | 'ACCEPTED'    | 'REJECTED'    | 'WITHDRAWN'    | 'COMPLETED';  housingType: string;  availability: string;  experience: string;  otherPets: string | null;  childrenInHome: string | null;  canTransport: boolean | null;  canHandleMedicalNeeds: boolean | null;  motivation: string;  createdAt: string;};

10. Recommended File Structure
Codex should restructure the mobile app like this.
PetPalMobileBuild/  src/    app/      PetPalApp.tsx      navigation.ts      onboarding/        EntryChoiceScreen.tsx    design/      tokens.ts      theme.ts      copy.ts    components/      layout/        AppShell.tsx        BottomTabs.tsx        Screen.tsx      ui/        Button.tsx        Chip.tsx        Badge.tsx        TextField.tsx        EmptyState.tsx        SectionHeader.tsx        FilterSheet.tsx      animals/        AnimalPhotoCarousel.tsx        AnimalMatchCard.tsx        AnimalProfileCard.tsx        CompatibilityScore.tsx        VerificationBadges.tsx      foster/        FosterCaseCard.tsx        FosterStatusBadge.tsx        FosterFilters.tsx      messages/        ConversationCard.tsx        MessageBubble.tsx        SafetyMenu.tsx    screens/      matches/        MatchesScreen.tsx        AnimalSetupPrompt.tsx        AnimalProfileEditorScreen.tsx        MatchCardDeck.tsx        MatchDetailScreen.tsx        MatchFiltersScreen.tsx        MatchSuccessScreen.tsx      foster/        FosterScreen.tsx        FosterFindSection.tsx        FosterApplicationsSection.tsx        FosterManageSection.tsx        FosterCaseDetailScreen.tsx        FosterApplicationFlowScreen.tsx      messages/        MessagesScreen.tsx        ConversationThreadScreen.tsx      profile/        ProfileScreen.tsx        MyAnimalsScreen.tsx        VerificationScreen.tsx        MatchPreferencesScreen.tsx        FosterPreferencesScreen.tsx        SettingsScreen.tsx    hooks/      useMyAnimals.ts      useMatchCandidates.ts      useMatchInteractions.ts      useFosterCases.ts      useFosterApplications.ts      useConversations.ts    api/      petpalApi.ts      matchApi.ts      fosterApi.ts      conversationApi.ts    types/      petpal.ts      matches.ts      foster.ts      conversations.ts    data/      demoAnimals.ts      demoMatchCandidates.ts      demoFosterCases.ts

11. Implementation Order
Codex must implement in phases.
Do not build everything in one task.

Phase 1: Navigation and App Shell
Goal
Create the new 4-tab shell.
Build
PotriviriFosterMesajeProfil
Tasks


Replace current tab structure with four tabs.


Keep App.tsx small.


Put navigation state in PetPalApp.tsx.


Create BottomTabs.


Make every tab render a placeholder first.


Do not touch backend yet.


Acceptance


App launches.


Four tabs are visible.


Tabs switch correctly.


No screen contains all flows at once.


TypeScript passes.



Phase 2: Profile + My Animals
Goal
Users need animal profiles before Matches can work.
Build


Profile screen


My animals section


Animal setup prompt


Animal profile editor


demo animal data


Tasks


Create AnimalProfile type.


Create useMyAnimals.


If no animals, Matches shows setup prompt.


If animals exist, Matches shows selected animal selector.


Profile tab shows “My animals”.


Add animal profile form fields.


Acceptance


User can see “My animals”.


User can create/edit a local demo animal profile.


Matches tab can select current animal.


No matching deck appears if no animal exists.



Phase 3: Matches UI Deck
Goal
Build Tinder-like swipe/card UI.
Build


Match card deck


Like/pass/save buttons


Filters


Animal detail


Match success screen


Tasks


Create MatchCandidate type.


Create demo candidates.


Create AnimalMatchCard.


Show one active candidate at a time.


Implement button-based like/pass first.


Add swipe gesture only after button flow works.


Add filters:


species


breed


sex


age


city


mode


verified only




Add compatibility score.


Add detail screen.


Add mutual match simulation.


Acceptance


User can browse candidates.


User can like/pass.


User can open details.


Match success appears on mutual match.


Messages get a match conversation placeholder.


UI does not expose exact location.



Phase 4: Verified Mate Gating
Goal
Make breeding/mating safe and gated.
Build


Verified Mate checklist


Locked state


Verification status


Health docs status


Tasks


Add VERIFIED_MATE mode.


Do not allow unverified animals in Verified Mate results.


If selected animal is not eligible, show locked panel.


Add checklist:


owner verified


animal profile complete


age eligible


sex known


sterilization status known


vaccines set


health docs uploaded




Add clear copy:


“Verified Mate requires additional checks.”




Acceptance


User cannot swipe Verified Mate if not eligible.


User can still use Play/Social.


UI clearly explains what is missing.


No free breeding marketplace exists.



Phase 5: Foster Find
Goal
Build Foster tab “Find” section.
Build


Foster section tabs


Foster case cards


Foster filters


Foster detail screen


Tasks


Create FosterCase type.


Create demo foster cases.


Create FosterScreen.


Add top segments:


Găsește


Cereri


Gestionează




Build Find section.


Build foster case detail screen.


Add filters:


species


size


urgency


duration


food covered


vet covered


transport


verified only




Acceptance


Foster tab opens to Găsește.


User can filter foster cases.


User can open case detail.


User sees what is covered.


User sees exact location privacy note.



Phase 6: Foster Application Flow
Goal
User can apply to foster.
Build


Multi-step foster application


Applications section


Status cards


Tasks


Create FosterApplication type.


Create application form steps:


Home


Experience


Availability


Household


Review




Add validation.


Add submit action using demo/local state first.


Show submitted application in Cereri section.


Add statuses.


Acceptance


User can submit foster application.


Application appears in Cereri.


Status is shown.


Chat is not open until accepted.



Phase 7: Foster Manage
Goal
Rescuers can manage foster cases.
Build


Foster manage section


Case creation


Application review


Accept/reject


Tasks


Add role gate:


regular user cannot manage


rescuer/shelter can manage




Show active cases.


Show new applications.


Add “Add foster case”.


Add accept/reject application.


Accepted application creates/open conversation.


Acceptance


Manage section is hidden or locked for regular users.


Rescuer can create foster case.


Rescuer can review application.


Accepting application creates message thread.



Phase 8: Messages
Goal
Messages work for matches and foster.
Build


Messages list


Conversation detail


Context header


Safety menu


Tasks


Create Conversation type.


Conversation source:


match


foster




Conversation card must show context.


Thread screen shows:


context header


messages


input


safety menu




Add report/block actions in UI.


Acceptance


Match conversations appear after mutual match.


Foster conversations appear after accepted application.


User sees context.


Report/block controls exist.


No direct chat from public cards.



Phase 9: Backend Integration
Goal
Connect UI to real Supabase, but only after demo UI is correct.
Tasks


Remove demo auth from production hooks.


Add real auth/session hooks.


Connect animal profiles.


Connect match candidates.


Connect like/pass/mutual match.


Connect foster cases.


Connect foster applications.


Connect conversations.


Keep demo data only as dev fallback.


Acceptance


No hardcoded demo emails in production code.


No hardcoded profile IDs in production code.


Real user session drives all actions.


Supabase RLS protects data.


TypeScript passes.


E2E smoke passes.



Phase 10: Polish and Phone QA
Goal
Make it feel like a real product.
Tasks


Test on physical phone.


Capture screenshots:


Entry screen


Matches no-animal state


Matches deck


Match detail


Match success


Foster find


Foster detail


Foster application


Messages list


Conversation thread


Profile




Check text truncation.


Check small Android screen.


Check tall iPhone-like screen.


Check keyboard behavior.


Check buttons are thumb-friendly.


Check no UI feels like a web page inside a phone.


Acceptance


No text overlap.


No broken card layout.


No impossible touch targets.


No exact location shown.


No chat before match/acceptance.


App feels coherent.



12. Codex Prompt To Start The Work
Copy this into Codex.
You are rebuilding the PetPal mobile UI/UX.Read this instruction carefully and do not improvise outside it.PetPal is now a 4-tab mobile app:1. Potriviri / Matches2. Foster3. Mesaje / Messages4. Profil / ProfileThe new product direction is:PetPal is an animal matching and foster app. The first tab is Tinder-like animal matching based on the user’s own animal profile. The second tab is Foster, where users can find animals needing temporary homes or manage foster cases if they are rescuers/shelters. The third tab is Messages for match conversations and accepted foster applications. The fourth tab is Profile for user settings, animal profiles, verification, preferences, and privacy.Non-negotiable rules:- Do not create one giant scroll screen.- Do not create more bottom tabs.- Do not make adoption the main first tab.- Do not allow direct public chat.- Do not expose exact location.- Do not create free/open breeding.- Verified mating must be gated behind owner verification, animal completeness, health/vaccine fields, and eligibility checks.- Keep UI copy Romania-friendly. Internal code can use English names, visible labels should be Romanian where practical.- Keep App.tsx small.- Use reusable components.- Do not add new heavy dependencies unless absolutely necessary.- Do not break existing TypeScript.- Do not remove safety/report/block concepts.- Do not connect backend until the UI skeleton and demo flow are correct.Implement Phase 1 only:Create the new 4-tab app shell with placeholders for:- Potriviri- Foster- Mesaje- ProfilKeep App.tsx as a tiny entry point.Create or update navigation types.Create or update BottomTabs.Make tab switching work.Do not implement matching logic yet.Do not modify Supabase schema yet.Run TypeScript after changes and summarize changed files.

13. Codex Prompt For Phase 2
Implement Phase 2: Profile + My Animals.Build the animal profile foundation needed by the Matches tab.Requirements:- Add AnimalProfile type.- Add demo animal data.- Add useMyAnimals hook with local/demo state.- In Potriviri tab, if user has no animal, show an AnimalSetupPrompt.- If user has animals, show selected animal selector.- In Profil tab, show My animals section.- Add AnimalProfileEditorScreen or component.- Fields: name, species, breed, mixed breed, age, sex, size, weight, sterilized status, vaccine status, temperament, energy, good with dogs/cats/children, city, coarse area, photos placeholder, active match modes.- Do not connect backend yet.- Do not implement swipe deck yet.- Keep all UI responsive and mobile-first.- Run TypeScript after changes.

14. Codex Prompt For Phase 3
Implement Phase 3: Matches UI Deck.Requirements:- Add MatchMode type: PLAY, SOCIAL, VERIFIED_MATE.- Add MatchCandidate type.- Add demo match candidates.- Build AnimalMatchCard.- Build MatchCardDeck.- Show one candidate at a time.- Add buttons: Nu acum, Detalii, Îmi place.- Add filter chips: Câini, Pisici, Rasă, Sex, Vârstă, Zonă, Verificați.- Add mode selector: Joacă, Socializare, Montă verificată.- Add compatibility score.- Add MatchDetailScreen.- Add simulated mutual match success screen.- Button-based like/pass is required first.- Swipe gesture can be added later, but do not add a heavy dependency.- No direct chat until mutual match.- No exact location.- Run TypeScript.

15. Codex Prompt For Phase 4
Implement Phase 4: Verified Mate gating.Requirements:- Verified Mate must not behave like open breeding.- If selected animal is not eligible, show locked state.- Add eligibility checklist:  - Owner verified  - Animal profile complete  - Age eligible  - Sex known  - Sterilization status known  - Vaccines set  - Health documents uploaded  - Admin approval if required- Only eligible candidates appear in Verified Mate mode.- Play and Social modes remain available.- Add clear UI copy explaining why Verified Mate is restricted.- Do not connect backend yet unless existing fields already support it.- Run TypeScript.

16. Codex Prompt For Phase 5
Implement Phase 5: Foster Find.Requirements:- Foster tab has top sections: Găsește, Cereri, Gestionează.- Gestionează is hidden or locked unless user role is rescuer/shelter.- Add FosterCase type.- Add demo foster cases.- Build FosterCaseCard.- Build FosterFindSection.- Add filters: Câini, Pisici, Urgent, Durată, Talie, Mâncare acoperită, Veterinar acoperit, Transport, Verificați.- Build FosterCaseDetailScreen.- Detail screen shows duration, urgency, what is covered, medical needs, home fit, coarse location, verified rescuer, and exact location privacy note.- Do not implement application flow yet.- Run TypeScript.

17. Codex Prompt For Phase 6
Implement Phase 6: Foster Application Flow.Requirements:- Add FosterApplication type.- Build multi-step FosterApplicationFlowScreen.- Steps: Locuință, Experiență, Disponibilitate, Casă, Verificare.- Required fields must gate submit.- Submit creates local/demo application state.- Application appears in Foster > Cereri.- Status labels: Ciornă, Trimisă, În analiză, Acceptată, Respinsă, Retrasă, Finalizată.- Chat must not open unless application is accepted.- Run TypeScript.

18. Codex Prompt For Phase 7
Implement Phase 7: Foster Manage.Requirements:- Build FosterManageSection for rescuer/shelter role.- Show metrics: Cazuri active, Cereri noi, Urgente.- Allow adding a demo foster case.- Show incoming foster applications.- Allow accept/reject in demo state.- Accepting an application should create a foster conversation in Messages.- Regular users must not see management actions.- Run TypeScript.

19. Codex Prompt For Phase 8
Implement Phase 8: Messages.Requirements:- Messages tab shows conversations from two sources: matches and foster.- Top filter: Toate, Potriviri, Foster.- Conversation cards must show context, not only person name.- Match conversation example: Max + Luna, Potrivire, Montă verificată.- Foster conversation example: Bruno, Foster, Cerere acceptată.- Build ConversationThreadScreen.- Show context header.- Add message input.- Add safety menu with View context, Report, Block.- No conversation should be created by tapping a public animal card directly.- Run TypeScript.

20. Codex Prompt For Phase 9
Implement Phase 9: Production cleanup and backend integration planning.First, audit the codebase.Find and list:- hardcoded demo emails- hardcoded profile IDs- demo auth calls inside production hooks- demo-only logic in user-facing flows- Supabase calls that assume seeded users- any place exact location could leak- any direct chat path before mutual match or accepted foster applicationDo not modify yet.Create a markdown report:docs/reviews/PETPAL_PRODUCTION_CLEANUP_PLAN.mdThe report must include:- file path- problem- risk- proposed fix- whether fix is required before public betaRun TypeScript after the audit if any code was touched.

21. Visual Style Rules
Codex must keep the app:
warmcleanmodernmobile-firstanimal-firstnot childishnot corporatenot OLXnot Facebook groupnot random marketplacenot messy
Colors
Use:
deep greencreamwarm papersageclaysoft skyrose only for warning/destructive
Avoid:
too much beigetoo much greenpure white everywhererainbow colorsneon colorsdating-app pink overload
Shape
Use:
8px radius maxclear cardsclean spacinglarge photosthumb-friendly buttons
Avoid:
bubbly cartoon UIcards inside cards inside cardstiny buttonsdense text blocks

22. UI Quality Checklist
Every phase must pass this checklist.
[ ] App has only four bottom tabs.[ ] Current phase does not add random new product areas.[ ] UI is mobile-first.[ ] Text does not overflow.[ ] Touch targets are large enough.[ ] Exact location is never displayed.[ ] Direct chat is not available from public cards.[ ] Verified Mate is gated.[ ] Foster management is role-gated.[ ] Demo data is separated from production logic.[ ] TypeScript passes.[ ] Changed files are summarized.

23. What Codex Must Not Do
Do not rename the product away from PetPal.Do not create a fifth bottom tab.Do not create a giant dashboard.Do not add payment logic.Do not add services marketplace.Do not add community feed.Do not make breeding open and public.Do not remove foster.Do not remove report/block.Do not remove location privacy.Do not silently change database schema.Do not add large dependencies without explaining why.Do not put demo auth inside production hooks.Do not use exact addresses in public UI.Do not make Settings a bottom tab.Do not make every screen English if the app is Romania-first.

24. What “Done” Means
The rebuild is done when a user can:
In Matches
create/select animalchoose matching modefilter by species/breed/detailssee animal cardslike/pass/saveopen detailsget mutual matchopen messages after match
In Foster
browse foster casesfilter casesopen case detailsubmit foster applicationtrack applicationrescuer can manage casesrescuer can accept applicationmessages open after acceptance
In Messages
see match conversationssee foster conversationsunderstand contextsend messagesreport/block
In Profile
edit profilemanage animalssee verification statusset preferencesaccess settings/privacy

25. Plain Summary For Codex
Use this as the final compact command:
Build PetPal as a four-tab animal matching and foster app.Tab 1 is Potriviri: Tinder-like animal matching based on the user’s own animal profile, with filters, breed selection, compatibility, like/pass, details, and mutual matches. Verified mating must be gated and safe.Tab 2 is Foster: users browse foster cases, apply, track applications, and rescuers manage foster cases and applications.Tab 3 is Mesaje: conversations from mutual matches and accepted foster applications only.Tab 4 is Profil: user account, animals, verification, preferences, privacy, and settings.Do not build a messy one-screen app. Do not add extra tabs. Do not expose exact location. Do not allow direct chat. Do not make breeding open/public. Build phase by phase, run TypeScript after each phase, and summarize changed files.
This is the blueprint I’d give Codex. It is strict enough to stop the spaghetti factory from reopening. 🐕‍🦺
