---
version: "alpha"
name: PetPal
description: "A trusted local adoption and foster product for verified shelters, rescuers, and serious applicants."
colors:
  ink: "#14231E"
  ink-muted: "#5A6862"
  paper: "#F7F1E7"
  paper-raised: "#FFF8EC"
  rescue-green: "#2F6F5D"
  deep-green: "#102A23"
  foster-clay: "#B86642"
  warm-gold: "#E3B84B"
  calm-blue: "#DCEEF2"
  soft-rose: "#E9C7CB"
  line: "#D7C7AC"
typography:
  display:
    fontFamily: System
    fontSize: 34px
    fontWeight: 900
    lineHeight: 39px
  title:
    fontFamily: System
    fontSize: 22px
    fontWeight: 900
    lineHeight: 28px
  body:
    fontFamily: System
    fontSize: 16px
    fontWeight: 500
    lineHeight: 23px
  label:
    fontFamily: System
    fontSize: 12px
    fontWeight: 900
    lineHeight: 16px
rounded:
  sm: 6px
  md: 8px
spacing:
  xs: 8px
  sm: 12px
  md: 16px
  lg: 24px
components:
  button-primary:
    backgroundColor: "{colors.rescue-green}"
    textColor: "{colors.paper-raised}"
    rounded: "{rounded.md}"
    height: 52px
  card:
    backgroundColor: "{colors.paper-raised}"
    textColor: "{colors.ink}"
    rounded: "{rounded.md}"
    padding: "{spacing.md}"
  app-shell:
    backgroundColor: "{colors.paper}"
    textColor: "{colors.ink}"
---

## Overview

PetPal should feel like a calm rescue operations product, not a playful dating clone. The experience is warm, structured, humane, and credible. It should help a user understand three things immediately: the animals are real, the organizations are checked, and contact happens through applications before chat.

The app should avoid looking like a landing page inside a phone. The first screen inside the product must be useful: browse animals, filter intent, open a profile, and apply. Trust and safety should appear as short interface signals close to the action, not as long explanatory blocks.

## Colors

Use a soft paper base instead of stark white or a heavy tan wash. Use deep green for trust and app chrome, rescue green for primary action, clay for foster urgency, gold for small verified/status highlights, calm blue only for quiet privacy or information moments, and rose only for warnings or reports.

Screens should not be dominated by one hue. Each screen needs a clear base, one primary action color, and small supporting accents.

## Typography

Use strong headlines sparingly. Hero-scale type belongs on the welcome screen and major animal detail moments only. Operational surfaces like filters, forms, inbox, shelter review, and profile should use tighter titles and readable body copy.

Labels should be short, uppercase, and persistent. Form fields should not depend on placeholder text alone.

## Layout

The app uses five stable tabs: Find, Apply, Chat, Shelter, and Me. Tabs are navigation, not actions. They stay available and predictable. Empty or unavailable states explain what is needed instead of hiding tabs.

The main product surface should use full-width sections with clear spacing. Avoid cards inside cards. Use cards only for repeated animals, applications, conversations, and modals. Animal imagery should be visible early, but not so tall that it pushes all useful actions below the first phone screen.

## Elevation & Depth

Depth should be quiet: thin borders, slight tonal shifts, and restrained shadows. Do not use heavy floating panels or overlapping sections unless they clarify hierarchy.

## Shapes

Keep rounded corners at 8px or below. PetPal should feel precise and trustworthy, not bubbly.

## Components

Animal cards should lead with a real image, the animal name, mode, species, age, location, and one sentence of context. Application screens should feel like a guided checklist: current step, what is being asked, why it matters, and a clear next action.

Welcome should be visual and emotionally strong, but it must not become a wall of marketing text.

## Do's and Don'ts

Do use specific rescue language, private-location language, and application-first language.

Do keep exact addresses, documents, reports, and private answers out of public surfaces.

Do make primary actions obvious and thumb-friendly.

Do keep the product useful even with only a few launch listings.

Do not use swipe-first dating patterns for adoption or foster.

Do not use public chat as the first contact.

Do not use generic copy like "discover your perfect pet" when the real promise is safer local rescue workflow.

Do not let the app become all beige, all green, or all white.
