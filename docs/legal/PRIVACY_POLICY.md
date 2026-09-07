# PetPal Privacy Policy Draft

Last updated: 2026-05-04

This draft describes the intended PetPal privacy rules for the production mobile app. It must be reviewed before public launch.

## What PetPal Collects

PetPal collects account details, animal profile details, foster application details, foster home profile details, messages, safety reports, verification documents, push notification tokens, and payment-session records for donations or sponsorships.

## Why PetPal Uses Data

PetPal uses data to:

- authenticate users and keep sessions secure;
- show safe animal matching and foster discovery surfaces;
- keep exact locations private while showing coarse city or area information;
- unlock chat only after a mutual match, accepted foster application, or accepted foster invite;
- support animal welfare, moderation, reports, blocks, and verification;
- process donations or sponsorships through backend-created payment sessions;
- send safety, message, foster, and moderation notifications.

## Location Privacy

Exact location is never public in PetPal. Public discovery can show only coarse location such as city, county, or neighborhood-level area.

## Animal Photos And Documents

Public animal photos may be shown through safe public URLs. Private verification documents and health documents must stay separate from public animal photos and are reviewed only by authorized moderation or document-review roles.

## Payments

The mobile app must not store payment secrets or card details. Payment sessions are created by backend functions. Final payment state is confirmed through provider webhooks, not by trusting a mobile redirect.

## Safety Data

Reports, blocks, moderation decisions, suspensions, and audit logs may be retained to protect users, shelters, foster homes, and animals.

## User Controls

Users should be able to update profile information, update or delete animal profiles, export account-related data, manage notifications, and request support for privacy or safety concerns.

## Production Review Needed

Before launch, replace this draft with counsel-reviewed public policy text and confirm the exact retention periods, payment provider names, support email, controller identity, and data-subject request process.
