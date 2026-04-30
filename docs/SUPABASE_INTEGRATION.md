# Supabase Integration

PetPal uses Supabase as the real backend. The small `backend/` FastAPI service is only a prototype health stub and is not the product backend.

## Mobile App Wiring

The Capacitor/React mobile app reads these public client variables:

```env
REACT_APP_SUPABASE_URL=http://127.0.0.1:54321
REACT_APP_SUPABASE_ANON_KEY=replace-with-local-anon-key
```

Optional local demo login:

```env
REACT_APP_SUPABASE_DEMO_EMAIL=adopter@petpal.local
REACT_APP_SUPABASE_DEMO_PASSWORD=petpal-demo-password
```

Demo credentials are never used for automatic login. They only enable the explicit **Use local demo account** button on the auth screen.

Only the anon key belongs in the mobile app. Never ship a service-role key in frontend or mobile code.

## Current Scope

When Supabase env vars are present, the app can hydrate:

- Auth session restore, sign in, sign up, sign out, and manual demo login through Supabase Auth
- Owner animal profiles from `my_animal_profiles_view`
- Owner animal profile create/update through `upsert_owner_animal_profile`
- Owner animal profile delete through `delete_owner_animal_profile`
- Animal profile photo upload through the `animal-photos` Supabase Storage bucket
- Foster discovery cases from `discovery_listings_view`
- My foster applications from `my_applications_view`
- Foster conversations and messages from `my_conversations_view` and `conversation_messages_view`
- Conversation safety actions through `report_conversation` and `block_conversation`
- User profile and roles from `profiles` and `profile_roles`
- Rescuer/shelter access requests through `request_rescuer_access` and `my_rescuer_access_view`
- Android push-token registration through `register_push_token`

If Supabase env vars are missing or local Supabase is offline, the app keeps using the existing mock prototype data.

## Local Runtime

Supabase local development requires Docker Desktop with the Linux engine running:

```powershell
cd "C:\BOTS\PetPal - every animal needs one\petpal-supabase"
pnpm install
pnpm run db:start
pnpm run db:reset
pnpm run db:test
```

For a physical Android phone connected to the laptop, keep local Supabase reachable through ADB reverse:

```powershell
adb reverse tcp:54321 tcp:54321
```

The debug Android app allows cleartext traffic only for local development hosts (`127.0.0.1`, `localhost`, and `10.0.2.2`) through `frontend/android/app/src/main/res/xml/network_security_config.xml`. Production Supabase should use HTTPS.

## Push Notifications

The mobile app may register an Android FCM token, but it never sends notifications directly. Server-side delivery is handled by the Supabase Edge Function:

```text
supabase/functions/send-push-notifications
```

Notification events are queued in `notification_events` for:

- accepted foster applications
- new messages
- moderation decisions

The Edge Function claims queued events with `claim_pending_push_notifications`, sends through FCM, then marks events with `mark_push_notification_sent` or `mark_push_notification_failed`.

Required deployed Edge Function secrets:

```env
SUPABASE_URL=...
SUPABASE_SERVICE_ROLE_KEY=...
FCM_PROJECT_ID=...
FCM_SERVICE_ACCOUNT_JSON=...
PUSH_FUNCTION_SECRET=...
```

For temporary local delivery checks only, `FCM_DRY_RUN=true` lets the Edge Function process queue rows without calling FCM. A real Android device notification requires a Firebase Android app, `google-services.json` in the Android project, and matching FCM server credentials in Supabase secrets.

## Backend Rules

- RLS stays enabled on app tables.
- Mobile discovery uses safe views, not private raw tables.
- Exact locations, private handover notes, contact data, and documents stay private.
- Service-role operations belong in Edge Functions or trusted admin tooling only.
- User-owned pet profiles live in `owner_animal_profiles`; rescue/shelter listing animals remain in the existing organization-scoped `animals` table.

## Animal Photos

Animal profile images are uploaded to Supabase Storage bucket `animal-photos`.

Client uploads use this path shape:

```text
{owner_user_id}/{animal_profile_id}/{timestamp}-{safe_file_name}
```

Storage policies allow authenticated users to write only inside their own user-id folder. The bucket is public for image display, but the app only stores coarse location and never exposes exact location data with photos.
