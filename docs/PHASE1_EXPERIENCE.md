# Phase 1 experience and Toy Town storyboard (summary)

**Full proposal (living document):** [Railroad of Hope: Phase 1 experience and Toy Town storyboard](https://claude.ai/artifact/KGMGwiFCR4kubUSyrB94hF), 16 November 2026.

It has nine sections:
1. Summary
2. What exists today
3. Visitor flow, with a diagram
4. Four-chapter storyboard
5. Environment requirements
6. Navigation and interface
7. Accessibility
8. Roadmap
9. Decisions and facts to confirm

This file is the repo copy of its key points. It is a plan only: no code was changed for it.

## The plan in brief

- **One page, two equal doors.**
  - **Find My Local Campaign:** about 15 seconds. ZIP, then the serving campaign's card, then its website. No story is needed.
  - **Explore Toy Town:** a 2–3 minute guided story in four chapters.
  - Neither door depends on the other.
- **The finder is always one tap away.** That includes every chapter, without losing story progress. It reuses the existing finder, shared selection and campaign card; there is no second finder.
- **The story follows one red toy truck** through Toy Town:
  1. **What is Toys for Tots?** Arrival by train; the Marine welcomes visitors.
  2. **How does it work?** Collection at the red box, sorting in the hall, distribution shown symbolically (a bag carried home, a lit window).
  3. **How do I request toys?** Four general steps, each campaign's own process. No requests on this site.
  4. **How can I help?** Toys, money (the Marine Toys for Tots Foundation), volunteering.
  - **Finale:** the camera rises to the map, the three lines brighten, and the visitor is invited to Find My Local Campaign.
- **Dignity:** no child is shown receiving a gift, and no names. Receiving help is shown symbolically.
- **Every factual line is marked "(confirm)"** in the full document. It must be checked against official Toys for Tots sources before publication.

## What exists versus what's missing (short)

- **Built:**
  - the felt national map, its routes and trains;
  - the descent into Maple Hollow and Chapter 1 (national app);
  - the Toy Town village, red box, Marine collection scene, storybook toy shop and station (journey app);
  - the ZIP finder with fictional test data and safeguards;
  - non-3D fallbacks.
- **Missing:**
  - a chapter engine and Chapters 2–4;
  - chapter progress, Back and Next, and resuming after the finder;
  - a full text version of the story;
  - a sorting-hall interior;
  - real donation and campaign destinations;
  - an Explore Toy Town entrance.

## Recommended decisions (awaiting the owner)

1. **One place:** Maple Hollow and Toy Town become one place called Toy Town, at the hub where the three lines meet.
2. **One page:** the national page hosts the story; the journey app stays as a preserved prototype.
3. **Visitor-paced beats:** each beat plays, then waits for Next. Nothing auto-advances.
4. **Out of Phase 1:** the journey's online-gift flow and its "wrapped toy" departure, because they conflict with "new, unwrapped". Their code is kept.

## Smallest next milestone

**Milestone 1, the story frame with stand-in scenes.**
- **Build:**
  - an Explore Toy Town entrance;
  - one chapter data file with all four chapters' beats and draft copy;
  - progress, Back, Next, Skip, Exit;
  - Find Local Campaign that pauses and resumes the story;
  - Read as text, generated from the same data.
- **Reuse:** Chapter 1's single-clock engine and the existing finder.
- **Not started:** it waits for the owner's review.
