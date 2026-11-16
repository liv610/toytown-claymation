# Phase 1, Milestone 1: visitor flow review screenshots

Prototype screens on `experiment/visitor-flow`. Fictional test campaigns (example.org links); story copy is a draft
for Toys for Tots to review; scenes are placeholders (stills from earlier felt work, or "Scene in development" slates).

Made by `tools/tests/visitor_flow_shots.js` (headless Chromium, SwiftShader, no GPU; 2× pixel density,
desktop 1280×800 and phone 390×844, reduced motion).

| # | Screen | Desktop | Phone |
|---|---|---|---|
| 1 | Landing: the map with both entry points (find a campaign, Explore Toy Town) | `screens/desktop_1_landing.jpg` | `screens/phone_1_landing.jpg` |
| 2 | Journey A: ZIP 00101 → the serving campaign's card and "Visit Campaign Website" | `screens/desktop_2_campaign_found.jpg` | `screens/phone_2_campaign_found.jpg` |
| 3 | Journey B: Chapter 1, first beat | `screens/desktop_3_story_chapter1.jpg` | `screens/phone_3_story_chapter1.jpg` |
| 4 | Chapter 3: how requesting toys usually works (four steps) | `screens/desktop_4_story_chapter3_steps.jpg` | `screens/phone_4_story_chapter3_steps.jpg` |
| 5 | The finder opened from Chapter 3, with the chosen campaign kept and "Back to the story" | `screens/desktop_5_finder_over_story.jpg` | `screens/phone_5_finder_over_story.jpg` |
| 6 | Finale: "Every community has a part to play. Find yours." | `screens/desktop_6_finale.jpg` | `screens/phone_6_finale.jpg` |

Automated checks: `tools/tests/visitor_flow.js` (both journeys, the finder from every chapter with exact resume,
keyboard and focus, inert background, reduced motion, map off, phones, the Maple Hollow flag).
