---
version: "alpha"
name: "PetPal Rescue Editorial"
description: "A trusted, local adoption and foster product for verified shelters and serious applicants."
colors:
  primary: "#10251F"
  on-primary: "#F8E6C9"
  secondary: "#3F7A68"
  on-secondary: "#FFF3DF"
  tertiary: "#B86642"
  on-tertiary: "#FFF3DF"
  neutral: "#C8AE84"
  surface: "#F4D8AD"
  surface-muted: "#D7E5DA"
  surface-sky: "#BFD8E2"
  text: "#17231F"
  text-muted: "#53615A"
  border: "#A9825B"
typography:
  hero:
    fontFamily: System
    fontSize: 34px
    fontWeight: 900
    lineHeight: 38px
    letterSpacing: 0px
  title:
    fontFamily: System
    fontSize: 22px
    fontWeight: 900
    lineHeight: 27px
    letterSpacing: 0px
  body:
    fontFamily: System
    fontSize: 15px
    fontWeight: 500
    lineHeight: 22px
    letterSpacing: 0px
  label:
    fontFamily: System
    fontSize: 12px
    fontWeight: 900
    lineHeight: 16px
    letterSpacing: 0px
rounded:
  sm: 6px
  md: 8px
spacing:
  xs: 8
  sm: 12
  md: 16
  lg: 20
  xl: 24
components:
  hero:
    backgroundColor: "{colors.primary}"
    textColor: "{colors.on-primary}"
    rounded: "{rounded.md}"
    padding: 20px
  panel:
    backgroundColor: "{colors.surface-muted}"
    textColor: "{colors.text}"
    rounded: "{rounded.md}"
    padding: 16px
  button-primary:
    backgroundColor: "{colors.secondary}"
    textColor: "{colors.on-secondary}"
    rounded: "{rounded.md}"
    padding: 12px
---

## Overview

PetPal should feel like a trusted rescue intake room translated into software:
warm, organized, serious, and humane. The app is not a playful dating clone.
It is a calm workflow layer for verified shelters, rescuers, adopters, and foster
families.

## Colors

Use deep forest green for navigation and trust surfaces. Use warm limestone and
clay for the product canvas, not pure white. Sage, sky, and clay bands separate
workflows: discovery, application, shelter review, chat, and safety.

## Typography

Headlines should be confident and editorial. Body copy should explain the trust
model in short, useful sentences. Avoid generic labels like "Browse animals"
when the section can say what makes PetPal safer.

## Layout

The app should open into the real experience, not a landing page. Use an
immersive photographic hero, then strong workflow bands. Tabs stay clear and
persistent: Discover, Applications, Inbox, Shelter, Profile.

## Elevation & Depth

Favor matte borders, section bands, and imagery over floating white cards.
Cards exist only for repeated animals, applications, messages, and metrics.

## Shapes

Use restrained 6-8px radii. Avoid pill-heavy decoration except for compact
status badges and filters.

## Components

Animal cards must show real imagery, status, location, and why the animal is
listed. Application screens must feel guided and private. Shelter screens must
feel operational, not cute.

## Do's and Don'ts

Do use real animal imagery, warm matte color, strong hierarchy, and visible
safety copy.

Do not use stark white backgrounds, decorative blobs, dating-app language,
generic filler writing, or sections that visually run into each other.
